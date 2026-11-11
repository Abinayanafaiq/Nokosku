"use server";

import { redirect } from "next/navigation";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { config } from "@/lib/config";
import { credit, debit, one, q, setSetting, tx } from "@/lib/db";
import { sakupay, SakupayError } from "@/lib/sakupay";
import { clearRuleCache, countries, getDeposit, orderAction, services, setGlobalMarkup, ShopError, syncDeposit } from "@/lib/shop";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const digits = (s: string) => Number(s.replace(/\D/g, "") || 0);
const go = (path: string, kind: "ok" | "err", msg: string): never =>
  redirect(`${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(msg)}`);

export async function adjustBalance(f: FormData) {
  const a = await requireAdmin();
  const uid = Number(f.get("uid"));
  const amount = digits(str(f, "jumlah"));
  const note = str(f, "catatan").slice(0, 80);
  const reason = note ? `admin: ${note}` : "penyesuaian admin";
  const path = `/admin/pengguna/${uid}`;
  if (amount <= 0) go(path, "err", "Isi jumlah yang valid.");
  if (str(f, "arah") === "kurang") {
    const bal = await tx((c) => debit(c, uid, amount, reason, `admin#${a.id}`));
    if (bal === null) go(path, "err", "Saldo pengguna tidak cukup.");
    go(path, "ok", `Saldo dikurangi Rp${amount.toLocaleString("id-ID")}.`);
  }
  await tx((c) => credit(c, uid, amount, reason, `admin#${a.id}`));
  go(path, "ok", `Saldo ditambah Rp${amount.toLocaleString("id-ID")}.`);
}

export async function toggleBan(f: FormData) {
  await requireAdmin();
  const uid = Number(f.get("uid"));
  const u = await one<{ banned: boolean }>("UPDATE nokos.users SET banned = NOT banned WHERE id=$1 RETURNING banned", [uid]);
  if (u?.banned) await q("DELETE FROM nokos.sessions WHERE user_id=$1", [uid]);
  go(`/admin/pengguna/${uid}`, "ok", u?.banned ? "Pengguna diblokir dan dikeluarkan dari semua perangkat." : "Blokir dibuka.");
}

export async function setUserPassword(f: FormData) {
  await requireAdmin();
  const uid = Number(f.get("uid"));
  const pw = String(f.get("password") ?? "");
  if (pw.length < 8) go(`/admin/pengguna/${uid}`, "err", "Password minimal 8 karakter.");
  await q("UPDATE nokos.users SET password_hash=$2 WHERE id=$1", [uid, await hashPassword(pw)]);
  await q("DELETE FROM nokos.sessions WHERE user_id=$1", [uid]);
  go(`/admin/pengguna/${uid}`, "ok", "Password diganti. Beritahu password barunya ke pengguna.");
}

export async function checkOrder(f: FormData) {
  const a = await requireAdmin();
  const id = Number(f.get("id"));
  const back = str(f, "back") || "/admin/order";
  try {
    const { order } = await orderAction(a.id, id, "cek", true);
    go(back, "ok", `Order #${id}: ${order.status}.`);
  } catch (err) {
    if (err instanceof ShopError) go(back, "err", err.message);
    throw err;
  }
}

export async function checkDeposit(f: FormData) {
  await requireAdmin();
  const id = Number(f.get("id"));
  const d = await getDeposit(id);
  if (!d) go("/admin/deposit", "err", "Tagihan tidak ditemukan.");
  const after = await syncDeposit(d!);
  go("/admin/deposit", "ok", `Deposit #${id}: ${after.status}.`);
}

export async function saveGlobalMarkup(f: FormData) {
  await requireAdmin();
  const pct = Number(str(f, "pct").replace(",", "."));
  const min = digits(str(f, "min"));
  if (!Number.isFinite(pct) || pct < 0) go("/admin/harga", "err", "Persen markup tidak valid.");
  await setGlobalMarkup(pct, min);
  go("/admin/harga", "ok", `Markup global disimpan: +${pct}%, minimal untung Rp${min.toLocaleString("id-ID")}.`);
}

export async function addRule(f: FormData) {
  await requireAdmin();
  const code = str(f, "service_code").toLowerCase();
  const cid = digits(str(f, "country_id")) || null;
  const mode = str(f, "mode") === "markup" ? "markup" : "fixed";
  if (!code) go("/admin/harga", "err", "Pilih layanan.");
  const list = await countries();
  const c = cid ? list.find((x) => x.id === cid) : null;
  const lookCid = cid ?? list.find((x) => x.code === "ID")?.id ?? list[0]?.id;
  const s = lookCid ? (await services(lookCid)).find((x) => x.code === code) : null;
  if (!s) go("/admin/harga", "err", `Layanan "${code}" tidak ditemukan${c ? ` di ${c.name}` : ""}.`);
  let fixed: number | null = null, pct: number | null = null, minProfit: number | null = null;
  if (mode === "fixed") {
    fixed = digits(str(f, "fixed"));
    if (fixed < 100) go("/admin/harga", "err", "Isi harga jual.");
  } else {
    pct = Number(str(f, "pct").replace(",", ".") || 0);
    minProfit = digits(str(f, "min_profit"));
  }
  await q(`DELETE FROM nokos.price_rules WHERE service_code=$1 AND COALESCE(country_id,-1)=COALESCE($2::int,-1)`, [code, cid]);
  await q(`INSERT INTO nokos.price_rules(service_code, service_name, country_id, country_name, mode, fixed, pct, min_profit)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [code, s!.name, cid, c ? `${c.emoji} ${c.name}` : null, mode, fixed, pct, minProfit]);
  clearRuleCache();
  go("/admin/harga", "ok", `Aturan harga ${s!.name} disimpan.`);
}

export async function deleteRule(f: FormData) {
  await requireAdmin();
  await q("DELETE FROM nokos.price_rules WHERE id=$1", [Number(f.get("id"))]);
  clearRuleCache();
  go("/admin/harga", "ok", "Aturan harga dihapus.");
}

export async function connectWebhook() {
  await requireAdmin();
  if (!config.siteUrl.startsWith("https://")) go("/admin", "err", "Isi SITE_URL di .env dengan alamat https website kamu dulu, lalu restart.");
  if (!sakupay.enabled()) go("/admin", "err", "SAKUPAY_API_KEY belum diisi.");
  let secret = "";
  try {
    secret = (await sakupay.setWebhook(`${config.siteUrl}/webhook/sakupay`)).secret;
  } catch (err) {
    go("/admin", "err", `Gagal mendaftarkan webhook: ${(err as SakupayError).message}`);
  }
  await setSetting("sakupay_webhook_secret", secret);
  go("/admin", "ok", "Webhook Sakupay terhubung. Deposit sekarang masuk dalam hitungan detik.");
}
