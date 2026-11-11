import Link from "next/link";
import { createDepositAction } from "@/app/actions";
import { Notice, one as first, PageTitle } from "@/components/Notice";
import { SubmitButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { q, type Deposit } from "@/lib/db";
import { rp, statusLabel, STATUS_TONE, waktu } from "@/lib/format";

export const metadata = { title: "Isi saldo" };
export const dynamic = "force-dynamic";

const PRESETS = [10000, 20000, 50000, 100000, 200000, 500000];

export default async function DepositPage({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const u = await requireUser("/deposit");
  const sp = await searchParams;
  const recent = await q<Deposit>("SELECT * FROM nokos.deposits WHERE user_id=$1 AND status <> 'NEW' ORDER BY id DESC LIMIT 6", [u.id]);
  const presets = PRESETS.filter((p) => p >= config.depositMin && p <= config.depositMax);

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6">
      <PageTitle title="Isi saldo" sub="Bayar pakai QRIS dari aplikasi bank atau e-wallet apa saja. Saldo masuk otomatis." />

      <div className="sim mb-6 flex items-center gap-4 bg-ink p-5 text-paper">
        <span className="chip" aria-hidden />
        <div>
          <p className="text-sm opacity-70">Saldo sekarang</p>
          <p className="tabular font-display text-3xl font-extrabold">{rp(u.balance)}</p>
        </div>
      </div>

      <Notice err={first(sp.err)} ok={first(sp.ok)} />

      <form action={createDepositAction} className="mt-4 rounded-xl border border-line bg-surface p-5">
        <fieldset>
          <legend className="font-bold">Pilih nominal</legend>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {presets.map((p, i) => (
              <label key={p} className="cursor-pointer">
                <input type="radio" name="amount" value={p} defaultChecked={i === 1} className="peer sr-only" />
                <span className="tabular block rounded-xl border border-line px-2 py-3 text-center font-display font-bold peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline-2 peer-focus-visible:outline-chip">
                  {rp(p)}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-bold text-ink-2">Nominal lain</summary>
          <label className="mt-2 block">
            <span className="sr-only">Nominal lain</span>
            <input name="amount_custom" inputMode="numeric" placeholder={`Minimal ${rp(config.depositMin)}`}
              className="w-full rounded-xl border border-line bg-paper px-4 py-3 outline-none focus:border-ink-2" />
          </label>
          <p className="mt-1 text-xs text-ink-2">Kalau diisi, nominal ini yang dipakai.</p>
        </details>
        <SubmitButton className="mt-5 w-full" pendingText="Membuat QRIS…">Bayar pakai QRIS</SubmitButton>
        <p className="mt-3 text-center text-xs text-ink-2">
          Tagihan berlaku 20 menit. Nominal yang dibayar bisa lebih beberapa rupiah sebagai kode unik.
        </p>
      </form>

      {recent.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-bold">Tagihan terakhir</h2>
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
            {recent.map((d) => (
              <li key={d.id}>
                <Link href={`/deposit/${d.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-soft">
                  <span className="tabular flex-1 font-bold">{rp(d.amount)}</span>
                  <span className="text-sm text-ink-2">{waktu(d.created_at)}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_TONE[d.status] ?? "bg-soft text-ink-2"}`}>{statusLabel(d.status)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
