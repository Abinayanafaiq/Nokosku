import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { rp } from "@/lib/format";
import { cached, countries, quote, services } from "@/lib/shop";

export const dynamic = "force-dynamic";

type Price = { name: string; price: number };

async function loadPrices(): Promise<Price[]> {
  const idn = (await countries()).find((c) => c.code === "ID");
  if (!idn) return [];
  const list = await services(idn.id);
  const picks = ["whatsapp", "telegram", "shopee", "tiktok", "gojek", "google"]
    .map((code) => list.find((x) => x.code === code))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));
  const quotes = await Promise.all(picks.map((s) => quote(idn.id, s.id).catch(() => null)));
  const out = picks.flatMap((s, i) => (quotes[i] ? [{ name: s.name, price: quotes[i]!.price }] : []));
  if (!out.length) throw new Error("harga kosong");
  return out;
}

/** Harga untuk halaman depan. Kalau API lambat, halaman tetap tampil tanpa tabel harga. */
async function todayPrices(): Promise<Price[]> {
  const g = globalThis as unknown as { __nokosLandingLoad?: Promise<Price[]> | null };
  const job = (g.__nokosLandingLoad ??= cached("landing", 300, loadPrices).finally(() => (g.__nokosLandingLoad = null)));
  const timeout = new Promise<Price[]>((res) => setTimeout(() => res([]), 3500));
  return Promise.race([job.catch(() => [] as Price[]), timeout]);
}

export default async function Home() {
  if (await getUser().catch(() => null)) redirect("/app");
  const prices = await todayPrices();

  return (
    <div className="mx-auto max-w-6xl px-4">
      {/* HERO */}
      <section className="grid items-center gap-10 py-12 md:grid-cols-[1.1fr_1fr] md:py-20">
        <div>
          <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            Nomor virtual untuk kode OTP, siap dalam hitungan detik.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-ink-2">
            Daftar WhatsApp, Telegram, Shopee, dan ratusan aplikasi lain tanpa memakai nomor pribadi.
            Kode verifikasinya langsung muncul di layar. Kalau SMS tidak datang, saldo kembali utuh.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/daftar" className="rounded-xl bg-ink px-6 py-3.5 font-display text-lg font-bold text-paper hover:opacity-90">
              Buat akun gratis
            </Link>
            <Link href="/masuk" className="rounded-xl border border-line px-6 py-3.5 font-display text-lg font-bold hover:border-ink-2">
              Sudah punya akun
            </Link>
          </div>
        </div>

        {/* Kartu SIM dengan SMS OTP — satu-satunya animasi di halaman ini */}
        <div className="relative mx-auto w-full max-w-sm" aria-hidden>
          <div className="sim bg-ink p-6 text-paper shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="chip" />
              <span className="font-display text-sm font-bold opacity-70">+62 812-4471-0938</span>
            </div>
            <div className="mt-10 rounded-2xl rounded-bl-sm bg-paper/10 p-4">
              <p className="text-sm opacity-80">WhatsApp</p>
              <p className="mt-1 text-sm">Kode WhatsApp kamu:</p>
              <div className="mt-3 flex gap-1.5">
                {"482913".split("").map((d, i) => (
                  <span key={i} style={{ animationDelay: `${500 + i * 110}ms` }}
                    className="otp-tile tabular grid h-12 w-10 place-items-center rounded-lg border-2 border-chip bg-paper font-display text-2xl font-extrabold text-ink">
                    {d}
                  </span>
                ))}
              </div>
            </div>
            <p className="mt-6 text-xs opacity-60">Masuk otomatis · tidak perlu refresh</p>
          </div>
        </div>
      </section>

      {/* HARGA */}
      {prices.length > 0 && (
        <section className="border-t border-line py-12" aria-labelledby="harga">
          <h2 id="harga" className="font-display text-2xl font-extrabold tracking-tight">Harga nomor Indonesia hari ini</h2>
          <p className="mt-1 text-ink-2">Harga mengikuti stok. Ada lebih dari 200 negara lain di dalam.</p>
          <ul className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
            {prices.map((p) => (
              <li key={p.name} className="bg-surface px-5 py-4">
                <p className="text-sm text-ink-2">{p.name}</p>
                <p className="tabular font-display text-2xl font-bold">{rp(p.price)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* CARA PAKAI — memang berurutan */}
      <section className="border-t border-line py-12" aria-labelledby="cara">
        <h2 id="cara" className="font-display text-2xl font-extrabold tracking-tight">Cara pakai</h2>
        <ol className="mt-6 grid gap-6 md:grid-cols-3">
          {[
            ["Isi saldo pakai QRIS", "Scan dari aplikasi bank atau e-wallet apa saja. Saldo masuk otomatis begitu pembayaran terdeteksi."],
            ["Pilih negara dan layanan", "Harga dan stok terlihat sebelum beli. Nomor langsung keluar setelah kamu tekan beli."],
            ["Salin kode OTP", "Masukkan nomor di aplikasi tujuan, kodenya muncul sendiri. Tidak ada SMS? Batalkan, saldo kembali."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-4">
              <span className="tabular grid size-9 shrink-0 place-items-center rounded-full bg-ink font-display font-bold text-paper">{i + 1}</span>
              <div>
                <h3 className="font-display text-lg font-bold">{t}</h3>
                <p className="mt-1 text-ink-2">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <footer className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line py-8 text-sm text-ink-2">
        <span>© {new Date().getFullYear()} {config.siteName}</span>
        <Link href="/aturan" className="hover:text-ink">Aturan pemakaian</Link>
        {config.contactUrl && <a href={config.contactUrl} className="hover:text-ink" rel="noopener">{config.contactLabel}</a>}
      </footer>
    </div>
  );
}
