import Link from "next/link";
import { checkDeposit } from "../actions";
import { Notice, one as first, PageTitle } from "@/components/Notice";
import { q } from "@/lib/db";
import { rp, statusLabel, waktu } from "@/lib/format";

export const metadata = { title: "Deposit" };

type Row = {
  id: number; user_id: number; email: string; amount: number; payable: number | null; fee: number | null;
  sp_id: string | null; status: string; created_at: Date; paid_at: Date | null;
};

export default async function AdminDeposits({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const sp = await searchParams;
  const rows = await q<Row>(
    `SELECT d.*, u.email FROM nokos.deposits d JOIN nokos.users u ON u.id=d.user_id WHERE d.status <> 'NEW' ORDER BY d.id DESC LIMIT 150`);
  return (
    <>
      <PageTitle title="Deposit" sub="Status dicek otomatis. Tombol Cek untuk memaksa cek ulang ke Sakupay." />
      <Notice err={first(sp.err)} ok={first(sp.ok)} />
      <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-left text-ink-2"><tr className="border-b border-line">
            <th className="px-3 py-2 font-semibold">#</th><th className="px-3 py-2 font-semibold">Pengguna</th>
            <th className="px-3 py-2 text-right font-semibold">Saldo masuk</th><th className="px-3 py-2 text-right font-semibold">Dibayar</th>
            <th className="px-3 py-2 text-right font-semibold">Fee</th><th className="px-3 py-2 font-semibold">Status</th>
            <th className="px-3 py-2 font-semibold">Dibuat</th><th className="px-3 py-2 font-semibold">ID Sakupay</th><th /></tr></thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="border-b border-line last:border-0">
                <td className="tabular px-3 py-2">{d.id}</td>
                <td className="max-w-40 truncate px-3 py-2"><Link href={`/admin/pengguna/${d.user_id}`} className="hover:underline">{d.email}</Link></td>
                <td className="tabular px-3 py-2 text-right font-bold">{rp(d.amount)}</td>
                <td className="tabular px-3 py-2 text-right">{d.payable ? rp(d.payable) : "-"}</td>
                <td className="tabular px-3 py-2 text-right text-ink-2">{d.fee ? rp(d.fee) : "-"}</td>
                <td className="px-3 py-2">{statusLabel(d.status)}</td>
                <td className="px-3 py-2 text-ink-2">{waktu(d.created_at)}</td>
                <td className="max-w-32 truncate px-3 py-2 font-mono text-xs text-ink-2">{d.sp_id}</td>
                <td className="px-3 py-2">
                  {d.status === "PENDING" && (
                    <form action={checkDeposit}>
                      <input type="hidden" name="id" value={d.id} />
                      <button className="rounded-lg border border-line px-2 py-1 text-xs font-bold hover:border-ink-2">Cek</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={9} className="px-4 py-6 text-center text-ink-2">Belum ada deposit.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
