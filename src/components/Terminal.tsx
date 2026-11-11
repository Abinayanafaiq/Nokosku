"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { rp, statusLabel, STATUS_TONE } from "@/lib/format";
import { announceBalance } from "./BalancePill";
import { CopyButton } from "./ui";

type Country = { id: number; name: string; code: string; emoji: string; dial: string; popular: boolean };
type Service = { id: number; name: string; code: string; popular: boolean };
type Quote = { available: boolean; price?: number; stock?: number; balance: number };
type Order = {
  id: number; status: string; service: string; country: string; countryId: number; platformId: number;
  phone: string; phoneLocal: string; price: number; otpCode: string | null; otpMessage: string | null;
  refunded: boolean; canResend: boolean; cancelAt: string | null; expiresAt: string | null; createdAt: string;
};

class HttpError extends Error {
  constructor(message: string, public code?: string, public data?: Record<string, unknown>) {
    super(message);
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  if (res.status === 401) {
    window.location.href = "/masuk?next=/app";
    throw new HttpError("Silakan masuk dulu.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(data.error ?? "Terjadi kesalahan.", data.code, data);
  return data as T;
}

const secondsLeft = (iso: string | null, now: number) => (iso ? Math.max(0, Math.round((new Date(iso).getTime() - now) / 1000)) : 0);
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
/** +6285712334410 -> +62 857-1233-4410 (hanya tampilan; yang disalin tetap angka polos) */
function fmtPhone(full: string, local: string) {
  const digits = full.replace(/^\+/, "");
  if (!local || local === digits || !digits.endsWith(local)) return full;
  const cc = digits.slice(0, digits.length - local.length);
  const parts = [local.slice(0, 3)];
  for (let i = 3; i < local.length; i += 4) parts.push(local.slice(i, i + 4));
  return `+${cc} ${parts.join("-")}`;
}
const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function Terminal({ defaultCountry, initialBalance, welcome }: { defaultCountry: number; initialBalance: number; welcome: boolean }) {
  const [balance, setBalanceState] = useState(initialBalance);
  const setBalance = useCallback((n: number) => {
    setBalanceState(n);
    announceBalance(n);
  }, []);

  // ---------- katalog
  const [countries, setCountries] = useState<Country[]>([]);
  const [countryId, setCountryId] = useState(defaultCountry);
  const [countryOpen, setCountryOpen] = useState(false);
  const [countryQuery, setCountryQuery] = useState("");
  const [services, setServices] = useState<Service[] | null>(null);
  const [serviceQuery, setServiceQuery] = useState("");
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // ---------- order
  const [orders, setOrders] = useState<Order[]>([]);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState<{ msg: string; code?: string; price?: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busyOrder, setBusyOrder] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const ordersRef = useRef<HTMLDivElement>(null);

  const country = countries.find((c) => c.id === countryId) ?? null;
  const service = services?.find((s) => s.id === serviceId) ?? null;

  useEffect(() => {
    api<Country[]>("/api/negara")
      .then((list) => {
        setCountries(list);
        if (!list.some((c) => c.id === defaultCountry) && list[0]) setCountryId(list[0].id);
      })
      .catch((e) => setCatalogError(e.message));
  }, [defaultCountry]);

  useEffect(() => {
    if (!countryId) return;
    setServices(null);
    setServiceId(null);
    setQuote(null);
    api<Service[]>(`/api/layanan?negara=${countryId}`)
      .then(setServices)
      .catch((e) => setCatalogError(e.message));
  }, [countryId]);

  const loadQuote = useCallback(async (cid: number, pid: number) => {
    setQuoteLoading(true);
    setBuyError(null);
    try {
      const q = await api<Quote>(`/api/harga?negara=${cid}&layanan=${pid}`);
      setQuote(q);
      setBalance(q.balance);
    } catch (e) {
      setQuote(null);
      setBuyError({ msg: (e as Error).message });
    } finally {
      setQuoteLoading(false);
    }
  }, [setBalance]);

  useEffect(() => {
    if (countryId && serviceId) loadQuote(countryId, serviceId);
  }, [countryId, serviceId, loadQuote]);

  // ---------- polling order aktif
  const refreshOrders = useCallback(async () => {
    try {
      const r = await api<{ orders: Order[]; balance: number }>("/api/order/aktif");
      setOrders(r.orders);
      setBalance(r.balance);
    } catch {
      /* koneksi putus sebentar — dicoba lagi di putaran berikutnya */
    }
  }, [setBalance]);

  const hasOpen = orders.some((o) => o.status === "ACTIVE" || o.status === "OTP_RECEIVED");
  useEffect(() => {
    refreshOrders();
    const t = setInterval(refreshOrders, hasOpen ? 4000 : 15000);
    return () => clearInterval(t);
  }, [refreshOrders, hasOpen]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // ---------- aksi
  async function buy(price: number) {
    if (!countryId || !serviceId) return;
    setBuying(true);
    setBuyError(null);
    try {
      const r = await api<{ order: Order; balance: number }>("/api/order", {
        method: "POST", body: JSON.stringify({ negara: countryId, layanan: serviceId, harga: price }),
      });
      setOrders((list) => [r.order, ...list.filter((o) => o.id !== r.order.id)]);
      setBalance(r.balance);
      setToast(`Nomor ${r.order.service} siap. Kode OTP muncul otomatis di sini.`);
      requestAnimationFrame(() => ordersRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) {
      const err = e as HttpError;
      setBuyError({ msg: err.message, code: err.code, price: err.data?.price as number | undefined });
      if (err.code === "PRICE_CHANGED" && typeof err.data?.price === "number")
        setQuote((q) => (q ? { ...q, price: err.data!.price as number } : q));
    } finally {
      setBuying(false);
    }
  }

  async function act(o: Order, aksi: "batal" | "selesai" | "kirim-ulang" | "cek") {
    setBusyOrder(o.id);
    try {
      const r = await api<{ order: Order; message: string | null; balance: number }>(`/api/order/${o.id}/${aksi}`, { method: "POST" });
      setOrders((list) => list.map((x) => (x.id === o.id ? r.order : x)));
      setBalance(r.balance);
      setToast(r.message ?? (r.order.otpCode || r.order.otpMessage ? "SMS sudah masuk." : "Belum ada SMS. Tunggu sebentar."));
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusyOrder(null);
    }
  }

  // ---------- filter
  const filteredCountries = useMemo(() => {
    const k = fold(countryQuery.trim());
    return k ? countries.filter((c) => fold(c.name).includes(k) || c.code.toLowerCase() === k || c.dial.replace("+", "") === k.replace("+", "")) : countries;
  }, [countries, countryQuery]);

  const filteredServices = useMemo(() => {
    if (!services) return [];
    const k = fold(serviceQuery.trim());
    return k ? services.filter((s) => fold(s.name).includes(k) || s.code.includes(k)) : services;
  }, [services, serviceQuery]);

  const price = quote?.available ? quote.price! : null;
  const enough = price !== null && balance >= price;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6">
      {welcome && (
        <p className="mb-5 rounded-xl bg-chip/15 px-4 py-3 text-sm font-semibold text-chip-deep">
          Akun dibuat. Isi saldo dulu lewat menu <Link href="/deposit" className="underline">Isi saldo</Link>, lalu pilih nomor di bawah.
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* ============ BELI ============ */}
        <section aria-labelledby="beli" className="order-2 lg:order-1">
          <h1 id="beli" className="font-display text-3xl font-extrabold tracking-tight">Beli nomor</h1>
          <p className="mt-1 text-ink-2">Pilih negara dan layanan. Kalau SMS tidak masuk, saldo kembali utuh.</p>

          {catalogError && <p className="mt-4 rounded-xl bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">{catalogError}</p>}

          <ol className="mt-6 space-y-5">
            {/* Langkah 1 */}
            <li>
              <StepLabel n={1} text="Negara nomor" />
              <button type="button" onClick={() => setCountryOpen((v) => !v)} aria-expanded={countryOpen}
                className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left hover:border-ink-2">
                <span className="text-2xl leading-none">{country?.emoji ?? "🌐"}</span>
                <span className="flex-1">
                  <span className="block font-bold">{country?.name ?? "Memuat negara…"}</span>
                  {country?.dial && <span className="text-sm text-ink-2">Kode {country.dial}</span>}
                </span>
                <span className="text-sm font-bold text-ink-2">{countryOpen ? "Tutup" : "Ganti"}</span>
              </button>
              {countryOpen && (
                <div className="mt-2 rounded-xl border border-line bg-surface p-2">
                  <input autoFocus value={countryQuery} onChange={(e) => setCountryQuery(e.target.value)} placeholder="Cari negara, contoh: malay"
                    className="w-full rounded-lg bg-soft px-3 py-2.5 outline-none placeholder:text-ink-2/70" />
                  <ul className="mt-2 max-h-72 overflow-y-auto">
                    {filteredCountries.map((c) => (
                      <li key={c.id}>
                        <button type="button"
                          onClick={() => { setCountryId(c.id); setCountryOpen(false); setCountryQuery(""); setServiceQuery(""); }}
                          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-soft ${c.id === countryId ? "bg-soft font-bold" : ""}`}>
                          <span className="text-xl">{c.emoji}</span>
                          <span className="flex-1">{c.name}</span>
                          <span className="tabular text-sm text-ink-2">{c.dial}</span>
                        </button>
                      </li>
                    ))}
                    {!filteredCountries.length && <li className="px-3 py-4 text-sm text-ink-2">Negara tidak ditemukan.</li>}
                  </ul>
                </div>
              )}
            </li>

            {/* Langkah 2 */}
            <li>
              <StepLabel n={2} text="Layanan yang mau diverifikasi" />
              <div className="rounded-xl border border-line bg-surface p-2">
                <input value={serviceQuery} onChange={(e) => setServiceQuery(e.target.value)} placeholder="Cari layanan, contoh: whatsapp"
                  className="w-full rounded-lg bg-soft px-3 py-2.5 outline-none placeholder:text-ink-2/70" />
                {!services ? (
                  <p className="px-3 py-6 text-sm text-ink-2">Memuat layanan…</p>
                ) : (
                  <ul className="mt-2 grid max-h-80 grid-cols-2 gap-1 overflow-y-auto sm:grid-cols-3">
                    {filteredServices.map((s) => (
                      <li key={s.id}>
                        <button type="button" onClick={() => setServiceId(s.id)} aria-pressed={s.id === serviceId}
                          className={`w-full truncate rounded-lg px-3 py-2.5 text-left text-sm ${s.id === serviceId
                            ? "bg-ink font-bold text-paper" : s.popular ? "font-bold hover:bg-soft" : "hover:bg-soft"}`}>
                          {s.name}
                        </button>
                      </li>
                    ))}
                    {!filteredServices.length && <li className="col-span-full px-3 py-4 text-sm text-ink-2">Layanan tidak ditemukan di negara ini.</li>}
                  </ul>
                )}
              </div>
            </li>

            {/* Langkah 3 */}
            <li>
              <StepLabel n={3} text="Bayar pakai saldo" />
              <div className="rounded-xl border border-line bg-surface p-4">
                {!service ? (
                  <p className="text-ink-2">Pilih layanan dulu untuk melihat harga.</p>
                ) : quoteLoading ? (
                  <p className="text-ink-2">Mengecek harga dan stok…</p>
                ) : !quote?.available ? (
                  <p className="text-ink-2"><b className="text-ink">{service.name}</b> di {country?.name} sedang kosong. Coba negara lain.</p>
                ) : (
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <p className="text-sm text-ink-2">{service.name} · {country?.emoji} {country?.name}</p>
                      <p className="tabular font-display text-4xl font-extrabold tracking-tight">{rp(price)}</p>
                      <p className="text-sm text-ink-2">Stok {quote.stock! > 10000 ? "10.000+" : quote.stock!.toLocaleString("id-ID")} nomor</p>
                    </div>
                    {enough ? (
                      <button type="button" disabled={buying} onClick={() => buy(price!)}
                        className="w-full rounded-xl bg-ink px-6 py-3.5 font-display text-lg font-bold text-paper hover:opacity-90 disabled:opacity-60 sm:w-auto">
                        {buying ? "Mengambil nomor…" : `Beli ${rp(price)}`}
                      </button>
                    ) : (
                      <Link href="/deposit" className="w-full rounded-xl bg-chip px-6 py-3.5 text-center font-display text-lg font-bold text-ink hover:opacity-90 sm:w-auto">
                        Isi saldo (kurang {rp(price! - balance)})
                      </Link>
                    )}
                  </div>
                )}
                {buyError && (
                  <div className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm font-semibold text-danger" role="alert">
                    {buyError.msg}
                    {buyError.code === "PRICE_CHANGED" && buyError.price && (
                      <button type="button" onClick={() => buy(buyError.price!)} className="ml-2 underline">Beli {rp(buyError.price)}</button>
                    )}
                  </div>
                )}
              </div>
            </li>
          </ol>
        </section>

        {/* ============ NOMOR AKTIF ============ */}
        <section aria-labelledby="aktif" ref={ordersRef} className={`order-1 scroll-mt-20 lg:order-2 ${orders.length ? "" : "max-lg:hidden"}`}>
          <h2 id="aktif" className="font-display text-2xl font-extrabold tracking-tight lg:text-3xl">Nomor kamu</h2>
          <p className="mt-1 text-ink-2">Halaman ini cek SMS otomatis tiap beberapa detik.</p>
          <div className="mt-6 space-y-4">
            {orders.length === 0 && (
              <div className="sim rounded-none border-2 border-dashed border-line px-6 py-10 text-center text-ink-2">
                Belum ada nomor aktif. Nomor yang kamu beli akan muncul di sini beserta kode OTP-nya.
              </div>
            )}
            {orders.map((o) => (
              <OrderCard key={o.id} o={o} now={now} busy={busyOrder === o.id} onAct={(a) => act(o, a)}
                onAgain={() => { setCountryId(o.countryId); setTimeout(() => setServiceId(o.platformId), 400); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
            ))}
          </div>
        </section>
      </div>

      {toast && (
        <div role="status" className="fixed inset-x-4 bottom-24 z-40 mx-auto max-w-md rounded-xl bg-ink px-4 py-3 text-center text-sm font-semibold text-paper shadow-lg md:bottom-8">
          {toast}
        </div>
      )}
    </div>
  );
}

function StepLabel({ n, text }: { n: number; text: string }) {
  return (
    <p className="mb-2 flex items-center gap-2 text-sm font-bold text-ink-2">
      <span className="tabular grid size-6 place-items-center rounded-full bg-ink font-display text-xs text-paper">{n}</span>
      {text}
    </p>
  );
}

function OrderCard({ o, now, busy, onAct, onAgain }:
  { o: Order; now: number; busy: boolean; onAct: (a: "batal" | "selesai" | "kirim-ulang" | "cek") => void; onAgain: () => void }) {
  const open = o.status === "ACTIVE" || o.status === "OTP_RECEIVED";
  const left = secondsLeft(o.expiresAt, now);
  const cancelIn = secondsLeft(o.cancelAt, now);
  const code = o.otpCode?.replace(/\s/g, "") ?? "";
  return (
    <article className={`sim bg-surface p-5 ${open ? "" : "opacity-75"}`} aria-live="polite">
      <header className="flex items-start gap-3">
        <span className="chip mt-1" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-bold">{o.service}</p>
          <p className="truncate text-sm text-ink-2">{o.country} · {rp(o.price)}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_TONE[o.status] ?? "bg-soft text-ink-2"}`}>
          {statusLabel(o.status)}{o.status === "EXPIRED" || o.status === "CANCELED" ? (o.refunded ? " · saldo kembali" : "") : ""}
        </span>
      </header>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="tabular font-display text-2xl font-bold tracking-wide sm:text-3xl">{o.phone ? fmtPhone(o.phone, o.phoneLocal) : "-"}</p>
        {o.phone && (
          <span className="flex gap-1.5">
            <CopyButton text={o.phone.replace(/^\+/, "")} label="Salin" />
            {o.phoneLocal !== o.phone.replace(/^\+/, "") && <CopyButton text={o.phoneLocal} label="Tanpa kode negara" />}
          </span>
        )}
      </div>

      <div className="mt-4 rounded-xl bg-soft p-4">
        {code ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1.5" aria-label={`Kode OTP ${code}`}>
              {code.split("").map((d, i) => (
                <span key={i} style={{ animationDelay: `${i * 60}ms` }}
                  className="otp-tile tabular grid h-12 w-9 place-items-center rounded-lg border-2 border-chip bg-surface font-display text-2xl font-extrabold sm:h-14 sm:w-11 sm:text-3xl">
                  {d}
                </span>
              ))}
            </div>
            <CopyButton text={code} label="Salin kode" />
          </div>
        ) : o.otpMessage ? null : open ? (
          <p className="flex items-center gap-2 text-ink-2">
            <span className="flex gap-1" aria-hidden>
              <span className="waiting-dot size-2 rounded-full bg-chip" />
              <span className="waiting-dot size-2 rounded-full bg-chip" />
              <span className="waiting-dot size-2 rounded-full bg-chip" />
            </span>
            Masukkan nomor ini di aplikasi, lalu tunggu SMS-nya.
          </p>
        ) : (
          <p className="text-ink-2">{o.status === "EXPIRED" || o.status === "CANCELED"
            ? (o.refunded ? `Tidak ada SMS. ${rp(o.price)} sudah kembali ke saldo.` : "Order ditutup.") : "Order selesai."}</p>
        )}
        {o.otpMessage && <p className="mt-3 break-words text-sm text-ink-2">“{o.otpMessage}”</p>}
      </div>

      <footer className="mt-4 flex flex-wrap items-center gap-2">
        {open && left > 0 && <p className="tabular mr-auto text-sm text-ink-2">Sisa waktu {mmss(left)}</p>}
        {o.status === "ACTIVE" && (
          <>
            <button type="button" disabled={busy} onClick={() => onAct("cek")}
              className="rounded-lg border border-line px-3 py-2 text-sm font-bold hover:border-ink-2 disabled:opacity-50">Cek SMS</button>
            <button type="button" disabled={busy || cancelIn > 0} onClick={() => onAct("batal")}
              className="rounded-lg border border-danger/40 px-3 py-2 text-sm font-bold text-danger hover:bg-danger/10 disabled:opacity-50">
              {cancelIn > 0 ? `Batal (${mmss(cancelIn)})` : "Batal & refund"}
            </button>
          </>
        )}
        {o.status === "OTP_RECEIVED" && (
          <>
            {o.canResend && (
              <button type="button" disabled={busy} onClick={() => onAct("kirim-ulang")}
                className="rounded-lg border border-line px-3 py-2 text-sm font-bold hover:border-ink-2 disabled:opacity-50">Minta SMS lagi</button>
            )}
            <button type="button" disabled={busy} onClick={() => onAct("selesai")}
              className="rounded-lg bg-signal px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">Selesai</button>
          </>
        )}
        {!open && (
          <button type="button" onClick={onAgain} className="ml-auto rounded-lg border border-line px-3 py-2 text-sm font-bold hover:border-ink-2">
            Beli lagi
          </button>
        )}
      </footer>
    </article>
  );
}
