import Link from "next/link";
import { PageTitle } from "@/components/Notice";
import { q, type User } from "@/lib/db";
import { rp, waktu } from "@/lib/format";

export const metadata = { title: "Pengguna" };

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q: term = "" } = await searchParams;
  const like = `%${term.trim()}%`;
  const users = await q<User>(
    `SELECT * FROM nokos.users WHERE email ILIKE $1 OR name ILIKE $1 OR id::text = $2 ORDER BY id DESC LIMIT 100`,
    [like, term.trim()]);
  return (
    <>
      <PageTitle title="Pengguna" />
      <form className="mb-4 flex gap-2">
        <input name="q" defaultValue={term} placeholder="Cari email, nama, atau ID"
          className="flex-1 rounded-xl border border-line bg-surface px-4 py-2.5 outline-none focus:border-ink-2" />
        <button className="rounded-xl bg-ink px-4 py-2.5 font-bold text-paper">Cari</button>
      </form>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-left text-ink-2"><tr className="border-b border-line">
            <th className="px-4 py-2 font-semibold">ID</th><th className="px-4 py-2 font-semibold">Nama / email</th>
            <th className="px-4 py-2 text-right font-semibold">Saldo</th><th className="px-4 py-2 font-semibold">Daftar</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-line last:border-0 hover:bg-soft">
                <td className="tabular px-4 py-2">{u.id}</td>
                <td className="px-4 py-2">
                  <Link href={`/admin/pengguna/${u.id}`} className="font-bold hover:underline">{u.name}</Link>
                  {u.banned && <span className="ml-2 rounded bg-danger/10 px-1.5 text-xs font-bold text-danger">diblokir</span>}
                  <span className="block text-ink-2">{u.email}</span>
                </td>
                <td className="tabular px-4 py-2 text-right font-bold">{rp(u.balance)}</td>
                <td className="px-4 py-2 text-ink-2">{waktu(u.created_at)}</td>
              </tr>
            ))}
            {!users.length && <tr><td colSpan={4} className="px-4 py-6 text-center text-ink-2">Tidak ada pengguna yang cocok.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
