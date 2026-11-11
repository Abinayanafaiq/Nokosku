import Link from "next/link";
import { checkOrder } from "../actions";
import { Notice, one as first, PageTitle } from "@/components/Notice";
import { q } from "@/lib/db";
import { rp, statusLabel, waktu } from "@/lib/format";

export const metadata = { title: "Order" };

const FILTERS = ["", "ACTIVE", "OTP_RECEIVED", "COMPLETED", "CANCELED", "EXPIRED", "FAILED"];

type Row = {
  id: number; user_id: number; email: string; service: string; country: string; phone: string | null; otp_code: string | null;
  price: number; cost: number | null; status: string; refunded: boolean; created_at: Date;
};

export default async function AdminOrders({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const sp = await searchParams;
  const status = first(sp.status) ?? "";
  const rows = await q<Row>(
    `SELECT o.*, u.email FROM nokos.orders o JOIN nokos.users u ON u.id=o.user_id
     WHERE o.status <> 'PENDING' AND ($1 = '' OR o.status = $1) ORDER BY o.id DESC LIMIT 150`, [status]);
  return (
    <>
      <PageTitle title="Order" />
      <Notice err={first(sp.err)} ok={first(sp.ok)} />
      <nav className="my-4 flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <Link key={f} href={f ? `/admin/order?status=${f}` : "/admin/order"}
            className={`rounded-lg px-3 py-1.5 text-sm font-bold ${status === f ? "bg-ink text-paper" : "bg-soft text-ink-2"}`}>
            {f ? statusLabel(f) : "Semua"}
          </Link>
        ))}
      </nav>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="text-left text-ink-2"><tr className="border-b border-line">
            <th className="px-3 py-2 font-semibold">#</th><th className="px-3 py-2 font-semibold">Pengguna</th>
            <th className="px-3 py-2 font-semibold">Layanan</th><th className="px-3 py-2 font-semibold">Nomor / OTP</th>
            <th className="px-3 py-2 text-right font-semibold">Jual</th><th className="px-3 py-2 text-right font-semibold">Modal</th>
            <th className="px-3 py-2 font-semibold">Status</th><th className="px-3 py-2 font-semibold">Waktu</th><th /></tr></thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} className="border-b border-line last:border-0">
                <td className="tabular px-3 py-2">{o.id}</td>
                <td className="max-w-40 truncate px-3 py-2"><Link href={`/admin/pengguna/${o.user_id}`} className="hover:underline">{o.email}</Link></td>
                <td className="px-3 py-2">{o.service} <span className="text-ink-2">{o.country}</span></td>
                <td className="tabular px-3 py-2">{o.phone ?? "-"}{o.otp_code && <b className="ml-2">{o.otp_code}</b>}</td>
                <td className="tabular px-3 py-2 text-right">{rp(o.price)}</td>
                <td className="tabular px-3 py-2 text-right text-ink-2">{o.cost ? rp(o.cost) : "-"}</td>
                <td className="px-3 py-2">{statusLabel(o.status)}{o.refunded && <span className="text-ink-2"> · refund</span>}</td>
                <td className="px-3 py-2 text-ink-2">{waktu(o.created_at)}</td>
                <td className="px-3 py-2">
                  {(o.status === "ACTIVE" || o.status === "OTP_RECEIVED") && (
                    <form action={checkOrder}>
                      <input type="hidden" name="id" value={o.id} />
                      <input type="hidden" name="back" value={status ? `/admin/order?status=${status}` : "/admin/order"} />
                      <button className="rounded-lg border border-line px-2 py-1 text-xs font-bold hover:border-ink-2">Cek</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={9} className="px-4 py-6 text-center text-ink-2">Tidak ada order.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
