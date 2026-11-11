import Link from "next/link";
import { connectWebhook } from "./actions";
import { Notice, one as first, PageTitle } from "@/components/Notice";
import { SubmitButton } from "@/components/ui";
import { config, sakupayTest } from "@/lib/config";
import { getSetting, one, q } from "@/lib/db";
import { rp, statusLabel, waktu } from "@/lib/format";
import { sakupay } from "@/lib/sakupay";
import { smscode } from "@/lib/smscode";

export const metadata = { title: "Admin" };

type Stats = { orders: number; omzet: number; untung: number; dep_n: number; dep_total: number; users: number; new_users: number };

async function stats(sinceSql: string): Promise<Stats> {
  const r = await one<Stats>(`
    SELECT
      (SELECT COUNT(*)::int FROM nokos.orders WHERE refunded=FALSE AND sc_id IS NOT NULL AND status<>'FAILED' AND created_at >= ${sinceSql}) AS orders,
      (SELECT COALESCE(SUM(price),0)::int FROM nokos.orders WHERE refunded=FALSE AND sc_id IS NOT NULL AND status<>'FAILED' AND created_at >= ${sinceSql}) AS omzet,
      (SELECT COALESCE(SUM(price-COALESCE(cost,0)),0)::int FROM nokos.orders WHERE refunded=FALSE AND sc_id IS NOT NULL AND status<>'FAILED' AND created_at >= ${sinceSql}) AS untung,
      (SELECT COUNT(*)::int FROM nokos.deposits WHERE status='PAID' AND paid_at >= ${sinceSql}) AS dep_n,
      (SELECT COALESCE(SUM(amount),0)::int FROM nokos.deposits WHERE status='PAID' AND paid_at >= ${sinceSql}) AS dep_total,
      (SELECT COUNT(*)::int FROM nokos.users) AS users,
      (SELECT COUNT(*)::int FROM nokos.users WHERE created_at >= ${sinceSql}) AS new_users`);
  return r!;
}

export default async function AdminHome({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const sp = await searchParams;
  const today = "(date_trunc('day', now() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta')";
  const [st, st7, saldoUser, active, modal, gateway, secret, modalHabis] = await Promise.all([
    stats(today),
    stats("now() - interval '7 days'"),
    one<{ s: number }>("SELECT COALESCE(SUM(balance),0)::int s FROM nokos.users"),
    one<{ c: number }>("SELECT COUNT(*)::int c FROM nokos.orders WHERE status IN ('ACTIVE','OTP_RECEIVED')"),
    smscode.balance().then((b) => ({ b }), (e: Error) => ({ e: e.message })),
    sakupay.enabled()
      ? Promise.all([sakupay.balance(), sakupay.getWebhook()]).then(([b, w]) => ({ b, w }), (e: Error) => ({ e: e.message }))
      : Promise.resolve({ e: "SAKUPAY_API_KEY belum diisi" }),
    getSetting("sakupay_webhook_secret"),
    getSetting("modal_habis_at"),
  ]);
  const recent = await q<{ id: number; email: string; service: string; country: string; price: number; cost: number | null; status: string; created_at: Date }>(
    `SELECT o.id, u.email, o.service, o.country, o.price, o.cost, o.status, o.created_at FROM nokos.orders o
     JOIN nokos.users u ON u.id=o.user_id WHERE o.sc_id IS NOT NULL ORDER BY o.id DESC LIMIT 10`);

  const modalLow = "b" in modal && modal.b < 20000;
  const hasSecret = Boolean(secret || config.sakupayWebhookSecret);
  const whUrl = "w" in gateway ? gateway.w?.url : null;

  return (
    <>
      <PageTitle title="Ringkasan" sub="Angka hari ini dihitung dari jam 00:00 WIB." />
      <div className="space-y-3">
        <Notice err={first(sp.err)} ok={first(sp.ok)} />
        {sakupayTest() && <Notice err="Sakupay masih MODE TEST (sk_test_). Ganti ke sk_live_ di .env sebelum jualan sungguhan." />}
        {modalLow && <Notice err={`Saldo modal smscode.gg tinggal ${rp("b" in modal ? modal.b : 0)}. Segera top up supaya order tidak gagal.`} />}
        {modalHabis && <p className="text-sm text-ink-2">Terakhir ada order gagal karena modal habis: {waktu(modalHabis)}</p>}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Box label="Saldo modal smscode.gg" value={"b" in modal ? rp(modal.b) : "Gagal cek"} note={"e" in modal ? modal.e : "Dipakai untuk beli nomor"} strong />
        <Box label="Saldo Sakupay" value={"b" in gateway ? rp(gateway.b.balance) : "—"}
          note={"b" in gateway ? `Bisa ditarik ${rp(gateway.b.available)}` : gateway.e} />
        <Box label="Total saldo pelanggan" value={rp(saldoUser?.s)} note="Kewajiban yang belum dipakai" />
        <Box label="Nomor aktif sekarang" value={String(active?.c ?? 0)} note="Menunggu atau baru terima SMS" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {[["Hari ini", st], ["7 hari terakhir", st7]].map(([label, s]) => {
          const x = s as Stats;
          return (
            <section key={label as string} className="rounded-xl border border-line bg-surface p-5">
              <h2 className="font-display text-lg font-bold">{label as string}</h2>
              <dl className="mt-3 grid grid-cols-2 gap-y-3 text-sm">
                <dt className="text-ink-2">Order berhasil</dt><dd className="tabular text-right font-bold">{x.orders}</dd>
                <dt className="text-ink-2">Omzet</dt><dd className="tabular text-right font-bold">{rp(x.omzet)}</dd>
                <dt className="text-ink-2">Untung kotor</dt><dd className="tabular text-right font-bold text-signal">{rp(x.untung)}</dd>
                <dt className="text-ink-2">Deposit masuk</dt><dd className="tabular text-right font-bold">{x.dep_n} · {rp(x.dep_total)}</dd>
                <dt className="text-ink-2">Pengguna baru</dt><dd className="tabular text-right font-bold">{x.new_users} <span className="font-normal text-ink-2">/ {x.users} total</span></dd>
              </dl>
            </section>
          );
        })}
      </div>

      <section className="mt-8 rounded-xl border border-line bg-surface p-5">
        <h2 className="font-display text-lg font-bold">Webhook Sakupay</h2>
        <p className="mt-1 text-sm text-ink-2">
          Dengan webhook, deposit masuk dalam hitungan detik. Tanpa webhook tetap jalan, website mengecek status tiap 8 detik.
        </p>
        <p className="mt-3 text-sm">
          Status: {whUrl && hasSecret ? <b className="text-signal">Terhubung ke {whUrl}</b> : <b>Belum terhubung</b>}
        </p>
        <form action={connectWebhook} className="mt-3">
          <SubmitButton pendingText="Menghubungkan…" disabled={!config.siteUrl.startsWith("https://")}>
            {whUrl ? "Hubungkan ulang webhook" : "Hubungkan webhook"}
          </SubmitButton>
          {!config.siteUrl.startsWith("https://") && (
            <p className="mt-2 text-xs text-ink-2">Butuh domain https. Isi SITE_URL di .env (contoh https://nokosku.com), lalu restart website.</p>
          )}
        </form>
      </section>

      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-lg font-bold">Order terbaru</h2>
          <Link href="/admin/order" className="text-sm font-bold text-ink-2 hover:text-ink">Semua order</Link>
        </div>
        <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-ink-2"><tr className="border-b border-line">
              <th className="px-4 py-2 font-semibold">#</th><th className="px-4 py-2 font-semibold">Pengguna</th>
              <th className="px-4 py-2 font-semibold">Layanan</th><th className="px-4 py-2 text-right font-semibold">Jual</th>
              <th className="px-4 py-2 text-right font-semibold">Modal</th><th className="px-4 py-2 font-semibold">Status</th>
              <th className="px-4 py-2 font-semibold">Waktu</th></tr></thead>
            <tbody>
              {recent.map((o) => (
                <tr key={o.id} className="border-b border-line last:border-0">
                  <td className="tabular px-4 py-2">{o.id}</td>
                  <td className="max-w-40 truncate px-4 py-2">{o.email}</td>
                  <td className="px-4 py-2">{o.service} <span className="text-ink-2">{o.country}</span></td>
                  <td className="tabular px-4 py-2 text-right">{rp(o.price)}</td>
                  <td className="tabular px-4 py-2 text-right text-ink-2">{o.cost ? rp(o.cost) : "-"}</td>
                  <td className="px-4 py-2">{statusLabel(o.status)}</td>
                  <td className="px-4 py-2 text-ink-2">{waktu(o.created_at)}</td>
                </tr>
              ))}
              {!recent.length && <tr><td colSpan={7} className="px-4 py-6 text-center text-ink-2">Belum ada order.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function Box({ label, value, note, strong }: { label: string; value: string; note?: string; strong?: boolean }) {
  return (
    <div className={`${strong ? "sim bg-ink text-paper" : "rounded-xl border border-line bg-surface"} p-4`}>
      <p className={`text-sm ${strong ? "opacity-70" : "text-ink-2"}`}>{label}</p>
      <p className="tabular mt-1 font-display text-2xl font-extrabold">{value}</p>
      {note && <p className={`mt-1 truncate text-xs ${strong ? "opacity-60" : "text-ink-2"}`}>{note}</p>}
    </div>
  );
}
