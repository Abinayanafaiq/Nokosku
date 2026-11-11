import "server-only";
import crypto from "node:crypto";
import { config } from "./config";
import { credit, debit, getSetting, one, q, setSetting, tx, type Deposit, type Order, type PriceRule } from "./db";
import { normStatus, sakupay, SakupayError } from "./sakupay";
import { smscode, SmsCodeError, type ScOrder } from "./smscode";

export class ShopError extends Error {
  constructor(message: string, public code = "ERROR", public extra: Record<string, unknown> = {}) {
    super(message);
  }
}

const OPEN = ["ACTIVE", "OTP_RECEIVED"];
const POPULAR_COUNTRIES = ["ID", "MY", "PH", "TH", "VN", "SG", "KH", "US", "GB", "IN", "BR", "RU"];
const POPULAR_SERVICES = ["whatsapp", "telegram", "shopee", "tokopedia", "gojek", "grab", "tiktok", "instagram",
  "facebook", "google", "dana", "ovo", "lazada", "line", "discord", "twitter", "openai"];

// ---------------------------------------------------------------- cache sederhana
type G = { __nokosCache?: Map<string, { t: number; v: unknown }>; __nokosLocks?: Set<number> };
const g = globalThis as unknown as G;
const store: Map<string, { t: number; v: unknown }> = (g.__nokosCache ??= new Map());
const busy: Set<number> = (g.__nokosLocks ??= new Set<number>());

/** Cache sederhana. Kalau sumber data sedang error, data lama (kalau ada) tetap dipakai. */
export async function cached<T>(key: string, ttlSec: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.t < ttlSec * 1000) return hit.v as T;
  try {
    const v = await fn();
    store.set(key, { t: Date.now(), v });
    return v;
  } catch (err) {
    if (hit && !key.startsWith("offer:")) {
      console.warn(`[cache] ${key}: pakai data lama karena ${(err as Error).message}`);
      return hit.v as T;
    }
    throw err;
  }
}
const uncache = (key: string) => store.delete(key);

// ---------------------------------------------------------------- katalog
export type Country = { id: number; name: string; code: string; emoji: string; dial: string; popular: boolean };
export type Service = { id: number; name: string; code: string; popular: boolean };
export type Offer = { cost: number; stock: number; catalogProductId: number | null; productId: number };

export const countries = () =>
  cached<Country[]>("countries", 3600, async () => {
    const rank = new Map(POPULAR_COUNTRIES.map((c, i) => [c, i]));
    return (await smscode.countries())
      .filter((c) => c.active !== false)
      .sort((a, b) => (rank.get(a.code) ?? 999) - (rank.get(b.code) ?? 999) || a.name.localeCompare(b.name))
      .map((c) => ({ id: c.id, name: c.name, code: c.code, emoji: c.emoji ?? "", dial: c.dial_code ?? "", popular: rank.has(c.code) }));
  });

export const country = async (id: number) => (await countries()).find((c) => c.id === id) ?? null;

export const services = (countryId: number) =>
  cached<Service[]>(`services:${countryId}`, 1800, async () => {
    const rank = new Map(POPULAR_SERVICES.map((c, i) => [c, i]));
    return (await smscode.services(countryId))
      .filter((s) => s.active !== false)
      .sort((a, b) => (rank.get(a.code) ?? 999) - (rank.get(b.code) ?? 999) || a.name.localeCompare(b.name))
      .map((s) => ({ id: s.id, name: s.name, code: s.code ?? "", popular: rank.has(s.code) }));
  });

export const service = async (cid: number, pid: number) => (await services(cid)).find((s) => s.id === pid) ?? null;

/** Penawaran termurah yang masih ada stok. */
export async function offer(cid: number, pid: number, fresh = false): Promise<Offer | null> {
  const key = `offer:${cid}:${pid}`;
  if (fresh) uncache(key);
  return cached(key, 20, async () => {
    const items = (await smscode.products(cid, pid)).filter((p) => p.active !== false && (p.available ?? 0) > 0);
    if (!items.length) return null;
    const cheapest = items.reduce((a, b) => (b.price < a.price ? b : a));
    const cat = cheapest.catalog_product_id;
    const same = cat ? items.filter((p) => p.catalog_product_id === cat) : [cheapest];
    return { cost: cheapest.price, stock: same.reduce((s, p) => s + p.available, 0), catalogProductId: cat, productId: cheapest.id };
  });
}

// ---------------------------------------------------------------- harga jual
export async function globalMarkup() {
  return cached("markup", 15, async () => ({
    pct: Number((await getSetting("markup_percent")) ?? config.markupPercent),
    min: Number((await getSetting("markup_min")) ?? config.markupMin),
  }));
}

export async function setGlobalMarkup(pct: number, min: number) {
  await setSetting("markup_percent", pct);
  await setSetting("markup_min", min);
  uncache("markup");
}

export const priceRules = () => cached("rules", 15, () => q<PriceRule>("SELECT * FROM nokos.price_rules ORDER BY service_name, country_name NULLS FIRST"));
export const clearRuleCache = () => uncache("rules");

const round100 = (x: number) => Math.ceil(x / 100) * 100;
export const markupPrice = (cost: number, pct: number, min: number) => round100(Math.max((cost * (100 + pct)) / 100, cost + min));

export async function findRule(code: string | null | undefined, cid: number) {
  if (!code) return null;
  const rules = (await priceRules()).filter((r) => r.service_code === code);
  return rules.find((r) => r.country_id === cid) ?? rules.find((r) => r.country_id === null) ?? null;
}

/**
 * Harga jual. Aturan per layanan menang dari markup global.
 * Harga pas yang lebih murah dari modal + Rp100 otomatis diganti markup global (anti rugi).
 */
export async function sellPrice(cost: number, code: string | null | undefined, cid: number) {
  const { pct, min } = await globalMarkup();
  const rule = await findRule(code, cid);
  if (rule?.mode === "fixed" && rule.fixed && rule.fixed >= cost + 100) return rule.fixed;
  if (rule?.mode === "markup") return markupPrice(cost, rule.pct ?? 0, rule.min_profit ?? 0);
  return markupPrice(cost, pct, min);
}

export async function quote(cid: number, pid: number, fresh = false) {
  const [o, s] = await Promise.all([offer(cid, pid, fresh), service(cid, pid)]);
  if (!o) return null;
  return { price: await sellPrice(o.cost, s?.code, cid), stock: o.stock, offer: o, service: s };
}

// ---------------------------------------------------------------- order
export function orderJson(o: Order) {
  const phone = o.phone ?? "";
  const dial = (o.dial ?? "").replace(/^\+/, "");
  const digits = phone.replace(/^\+/, "");
  return {
    id: o.id, status: o.status, service: o.service, country: o.country,
    countryId: o.country_id, platformId: o.platform_id,
    phone, phoneLocal: dial && digits.startsWith(dial) ? digits.slice(dial.length) : digits,
    price: o.price, otpCode: o.otp_code, otpMessage: o.otp_message, refunded: o.refunded,
    canResend: o.can_resend, cancelAt: o.cancel_at?.toISOString() ?? null,
    expiresAt: o.expires_at?.toISOString() ?? null, createdAt: o.created_at.toISOString(),
  };
}
export type OrderJson = ReturnType<typeof orderJson>;

const getOrder = (id: number) => one<Order>("SELECT * FROM nokos.orders WHERE id = $1", [id]);

async function updateOrder(id: number, f: Record<string, unknown>) {
  const keys = Object.keys(f);
  if (!keys.length) return;
  await q(`UPDATE nokos.orders SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(", ")}, updated_at = now() WHERE id = $1`,
    [id, ...keys.map((k) => f[k])]);
}

/** Kembalikan saldo order sekali saja. */
export async function refundOrder(id: number, reason: string) {
  return tx(async (c) => {
    const r = await c.query<{ user_id: number; price: number }>(
      "UPDATE nokos.orders SET refunded = TRUE, updated_at = now() WHERE id = $1 AND refunded = FALSE RETURNING user_id, price", [id]);
    if (!r.rowCount) return null;
    return credit(c, r.rows[0].user_id, r.rows[0].price, reason, `order#${id}`);
  });
}

const fmt = (n: number) => n.toLocaleString("id-ID");

export async function buy(uid: number, cid: number, pid: number, expectedPrice: number) {
  if (busy.has(uid)) throw new ShopError("Order sebelumnya masih diproses.", "BUSY");
  busy.add(uid);
  try {
    const qt = await quote(cid, pid, true);
    if (!qt) throw new ShopError("Stok sedang kosong. Coba negara lain atau beberapa saat lagi.", "OUT_OF_STOCK");
    const { price, offer: of } = qt;
    if (price > expectedPrice) throw new ShopError(`Harga berubah jadi Rp${fmt(price)}.`, "PRICE_CHANGED", { price });

    const c = await country(cid);
    const s = qt.service;
    const created = await tx(async (cl) => {
      const r = await cl.query<{ id: number }>(
        `INSERT INTO nokos.orders(user_id, price, status, country, dial, country_id, service, service_code, platform_id)
         VALUES ($1,$2,'PENDING',$3,$4,$5,$6,$7,$8) RETURNING id`,
        [uid, price, c ? `${c.emoji} ${c.name}`.trim() : String(cid), c?.dial ?? "", cid, s?.name ?? String(pid), s?.code ?? "", pid]);
      const oid = r.rows[0].id;
      const bal = await debit(cl, uid, price, "beli nomor", `order#${oid}`);
      if (bal === null) throw new ShopError("Saldo kamu kurang. Isi saldo dulu.", "INSUFFICIENT_FUNDS", { price });
      return oid;
    });

    // Batas harga modal: boleh ambil penawaran lebih mahal dari yang termurah,
    // asal masih untung minimal Rp100 dari harga jual. Jadi tidak pernah rugi.
    const maxCost = Math.max(of.cost, price - 100);
    let item: ScOrder;
    try {
      // Coba penawaran termurah dulu; kalau provider-nya kosong, coba penawaran dengan tingkat sukses terbaik
      // (tetap dibatasi maxCost, jadi tidak mungkin rugi).
      const policies = of.catalogProductId ? (["cheapest", "best_success"] as const) : (["cheapest"] as const);
      let res: Awaited<ReturnType<typeof smscode.createOrder>> | null = null;
      for (const policy of policies) {
        try {
          res = await smscode.createOrder({ catalogProductId: of.catalogProductId, productId: of.productId, maxPrice: maxCost, policy });
          if (res.orders?.length) break;
        } catch (err) {
          const code = (err as SmsCodeError).code;
          if (policy === policies[policies.length - 1] || !["PROVIDER_ERROR", "NO_OFFER_AVAILABLE"].includes(code)) throw err;
          console.info(`[order] #${created} ${policy} gagal (${code}), coba penawaran lain`);
        }
      }
      if (!res?.orders?.length) throw new SmsCodeError("NO_OFFER_AVAILABLE", "kosong");
      item = res.orders[0];
    } catch (err) {
      const e = err instanceof SmsCodeError ? err : new SmsCodeError("UNKNOWN", String(err));
      console.warn(`[order] #${created} gagal: ${e.message}`);
      await updateOrder(created, { status: "FAILED" });
      await refundOrder(created, "refund order gagal");
      if (e.code === "INSUFFICIENT_BALANCE") {
        console.error("[order] SALDO MODAL SMSCODE HABIS — segera top up");
        await setSetting("modal_habis_at", new Date().toISOString());
      }
      const msg: Record<string, string> = {
        INSUFFICIENT_BALANCE: "Stok server sedang kosong. Coba lagi beberapa saat lagi.",
        NO_OFFER_AVAILABLE: "Nomor untuk layanan ini sedang habis. Coba lagi atau pilih negara lain.",
        PROVIDER_ERROR: "Server nomor sedang gangguan. Coba lagi sebentar lagi.",
      };
      throw new ShopError(`${msg[e.code] ?? "Gagal mengambil nomor. Coba lagi."} Saldo sudah dikembalikan.`, e.code);
    }

    await updateOrder(created, {
      sc_id: item.id, phone: item.phone_number ?? null, cost: item.amount ?? of.cost, status: item.status || "ACTIVE",
      expires_at: item.expires_at ?? null, cancel_at: item.cancel_available_at ?? null, can_resend: Boolean(item.can_resend),
    });
    return (await getOrder(created))!;
  } finally {
    busy.delete(uid);
  }
}

/** Cocokkan order lokal dengan data smscode. Refund otomatis kalau batal / waktu habis tanpa SMS. */
export async function syncOrder(row: Order, remote: ScOrder) {
  const status = remote.status || row.status;
  const rev = Number(remote.sms_revision ?? 0);
  const upd: Record<string, unknown> = {};
  if (rev > row.last_rev && (remote.otp_code || remote.otp_message)) {
    Object.assign(upd, { last_rev: rev, otp_code: remote.otp_code || row.otp_code, otp_message: remote.otp_message || row.otp_message });
    if (OPEN.includes(status)) upd.status = "OTP_RECEIVED";
  }
  if (remote.can_resend !== undefined && remote.can_resend !== row.can_resend) upd.can_resend = Boolean(remote.can_resend);
  if (remote.cancel_available_at) upd.cancel_at = remote.cancel_available_at;
  if (remote.expires_at) upd.expires_at = remote.expires_at;
  if (status === "OTP_RECEIVED" && row.status === "ACTIVE") upd.status = "OTP_RECEIVED";
  await updateOrder(row.id, upd);

  const cur = (await getOrder(row.id))!;
  const hadOtp = cur.last_rev > 0 || Boolean(cur.otp_code) || Boolean(cur.otp_message);
  if (["COMPLETED", "CANCELED", "EXPIRED"].includes(status) && cur.status !== status) {
    await updateOrder(row.id, { status });
    if ((status === "CANCELED" || status === "EXPIRED") && !hadOtp) {
      await refundOrder(row.id, status === "EXPIRED" ? "refund waktu habis" : "refund batal");
    }
  }
  return (await getOrder(row.id))!;
}

const secondsUntil = (iso?: string | null) => (iso ? Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 1000)) : 0);

export async function orderAction(uid: number, id: number, action: string, admin = false) {
  const o = await getOrder(id);
  if (!o || (o.user_id !== uid && !admin)) throw new ShopError("Order tidak ditemukan.", "NOT_FOUND");
  if (!o.sc_id) throw new ShopError("Order ini belum aktif.", "NOT_ACTIVE");

  if (action === "cek") return { order: await syncOrder(o, await smscode.order(o.sc_id)), message: null };

  if (action === "batal") {
    if (o.status !== "ACTIVE" || o.last_rev > 0) throw new ShopError("Order ini tidak bisa dibatalkan.", "CONFLICT");
    try {
      await smscode.cancel(o.sc_id);
    } catch (err) {
      const e = err as SmsCodeError;
      const remote = await smscode.order(o.sc_id);
      await syncOrder(o, remote);
      if (e.code === "CANCEL_TOO_EARLY") {
        const wait = secondsUntil(remote.cancel_available_at) || 30;
        throw new ShopError(`Pembatalan baru bisa sekitar ${wait} detik lagi.`, "TOO_EARLY", { wait });
      }
      if (e.code === "CONFLICT") throw new ShopError("Tidak bisa dibatalkan, SMS sudah masuk.", "CONFLICT");
      throw new ShopError("Gagal membatalkan, coba lagi.", e.code);
    }
    await updateOrder(id, { status: "CANCELED" });
    await refundOrder(id, "refund batal");
    return { order: (await getOrder(id))!, message: `Order dibatalkan. Rp${fmt(o.price)} dikembalikan ke saldo.` };
  }

  if (action === "selesai") {
    try {
      await smscode.finish(o.sc_id);
    } catch (err) {
      if ((err as SmsCodeError).code !== "CONFLICT") throw new ShopError("Gagal menyelesaikan order, coba lagi.");
    }
    await updateOrder(id, { status: "COMPLETED" });
    return { order: (await getOrder(id))!, message: "Order selesai." };
  }

  if (action === "kirim-ulang") {
    let ok = false;
    try {
      ok = (await smscode.resend(o.sc_id)).resent;
    } catch {
      ok = false;
    }
    if (!ok) throw new ShopError("Layanan ini tidak mendukung kirim ulang SMS.", "NO_RESEND");
    return { order: o, message: "Permintaan SMS ulang terkirim." };
  }

  throw new ShopError("Aksi tidak dikenal.", "BAD_ACTION");
}

// ---------------------------------------------------------------- deposit (Sakupay QRIS)
export const getDeposit = (id: number) => one<Deposit>("SELECT * FROM nokos.deposits WHERE id = $1", [id]);

export async function createDeposit(uid: number, amount: number) {
  if (!sakupay.enabled()) throw new ShopError("Pembayaran belum diaktifkan admin.", "NO_GATEWAY");
  const d = await one<{ id: number }>("INSERT INTO nokos.deposits(user_id, amount, status) VALUES ($1,$2,'NEW') RETURNING id", [uid, amount]);
  const did = d!.id;
  try {
    const p = await sakupay.createPayment(amount, `DEP${did}`, `nokos-dep-${did}-${crypto.randomBytes(4).toString("hex")}`);
    await q(`UPDATE nokos.deposits SET sp_id=$2, status='PENDING', payable=$3, fee=$4, qr_string=$5, payment_url=$6, expires_at=$7
             WHERE id=$1`, [did, p.id, p.payable_amount ?? amount, p.fee_amount ?? null, p.qr_string ?? null, p.payment_url ?? null, p.expires_at ?? null]);
  } catch (err) {
    console.warn(`[deposit] buat tagihan #${did} gagal: ${(err as Error).message}`);
    await q("UPDATE nokos.deposits SET status='FAILED' WHERE id=$1", [did]);
    throw new ShopError("Gagal membuat tagihan QRIS. Coba lagi sebentar.", (err as SakupayError).code ?? "ERROR");
  }
  return (await getDeposit(did))!;
}

/** Tandai lunas + tambah saldo, sekali saja. */
async function creditDeposit(id: number, paidAt?: string | null) {
  return tx(async (c) => {
    const r = await c.query<{ user_id: number; amount: number }>(
      `UPDATE nokos.deposits SET status='PAID', credited=TRUE, paid_at=COALESCE($2::timestamptz, now())
       WHERE id=$1 AND credited=FALSE RETURNING user_id, amount`, [id, paidAt ?? null]);
    if (!r.rowCount) return null;
    return credit(c, r.rows[0].user_id, r.rows[0].amount, "deposit QRIS", `deposit#${id}`);
  });
}

/** Cek status tagihan ke Sakupay. Saldo ditambah kalau sudah PAID. */
export async function syncDeposit(d: Deposit) {
  if (!sakupay.enabled() || !d.sp_id || d.status !== "PENDING") return d;
  try {
    const p = await sakupay.payment(d.sp_id);
    const st = normStatus(p.status);
    if (st === "PAID") {
      if ((await creditDeposit(d.id, p.paid_at)) !== null) console.log(`[deposit] #${d.id} lunas, user ${d.user_id} +${d.amount}`);
    } else if (["EXPIRED", "FAILED", "CANCELLED"].includes(st)) {
      await q("UPDATE nokos.deposits SET status=$2 WHERE id=$1 AND status='PENDING'", [d.id, st]);
    }
  } catch (err) {
    console.info(`[deposit] cek #${d.id} gagal: ${(err as Error).message}`);
  }
  return (await getDeposit(d.id))!;
}

export async function cancelDeposit(uid: number, id: number) {
  let d = await getDeposit(id);
  if (!d || d.user_id !== uid) throw new ShopError("Tagihan tidak ditemukan.", "NOT_FOUND");
  if (d.status !== "PENDING") return d;
  d = await syncDeposit(d); // jangan sampai membatalkan tagihan yang ternyata sudah dibayar
  if (d.status !== "PENDING") return d;
  try {
    await sakupay.cancel(d.sp_id!);
  } catch (err) {
    if ((err as SakupayError).status !== 409) throw new ShopError("Gagal membatalkan tagihan, coba lagi.");
    return syncDeposit(d);
  }
  await q("UPDATE nokos.deposits SET status='CANCELLED' WHERE id=$1 AND status='PENDING'", [id]);
  return (await getDeposit(id))!;
}

// ---------------------------------------------------------------- pekerja latar belakang
export async function pollOrders() {
  const rows = await q<Order>("SELECT * FROM nokos.orders WHERE status IN ('ACTIVE','OTP_RECEIVED') AND sc_id IS NOT NULL");
  if (!rows.length) return;
  const active = new Map((await smscode.activeOrders()).map((o) => [o.id, o]));
  for (const r of rows) {
    let remote = active.get(r.sc_id!);
    if (!remote) {
      try {
        remote = await smscode.order(r.sc_id!);
      } catch (err) {
        console.info(`[order] cek #${r.id} gagal: ${(err as Error).message}`);
        continue;
      }
    }
    await syncOrder(r, remote);
  }
}

export async function pollDeposits() {
  const rows = await q<Deposit>(
    "SELECT * FROM nokos.deposits WHERE status='PENDING' AND sp_id IS NOT NULL AND created_at > now() - interval '2 hours'");
  for (const d of rows) await syncDeposit(d);
}
