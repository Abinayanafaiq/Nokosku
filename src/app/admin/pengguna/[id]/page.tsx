import { notFound } from "next/navigation";
import { adjustBalance, setUserPassword, toggleBan } from "../../actions";
import { Notice, one as first } from "@/components/Notice";
import { SubmitButton } from "@/components/ui";
import { one, q, type Deposit, type LedgerRow, type Order, type User } from "@/lib/db";
import { rp, statusLabel, waktu } from "@/lib/format";

export default async function AdminUser({ params, searchParams }:
  { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[]>> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const u = await one<User>("SELECT * FROM nokos.users WHERE id=$1", [Number(id)]);
  if (!u) notFound();
  const [orders, deposits, ledger] = await Promise.all([
    q<Order>("SELECT * FROM nokos.orders WHERE user_id=$1 AND status<>'PENDING' ORDER BY id DESC LIMIT 30", [u.id]),
    q<Deposit>("SELECT * FROM nokos.deposits WHERE user_id=$1 AND status<>'NEW' ORDER BY id DESC LIMIT 20", [u.id]),
    q<LedgerRow>("SELECT * FROM nokos.ledger WHERE user_id=$1 ORDER BY id DESC LIMIT 30", [u.id]),
  ]);
  const input = "w-full rounded-xl border border-line bg-paper px-3 py-2.5 outline-none focus:border-ink-2";

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div className="flex-1">
          <h1 className="font-display text-3xl font-extrabold tracking-tight">{u.name}</h1>
          <p className="text-ink-2">{u.email} · #{u.id} · daftar {waktu(u.created_at)} · terakhir masuk {waktu(u.last_login)}</p>
        </div>
        <div className="sim bg-ink px-5 py-3 text-paper">
          <p className="text-xs opacity-70">Saldo</p>
          <p className="tabular font-display text-2xl font-extrabold">{rp(u.balance)}</p>
        </div>
      </div>
      <Notice err={first(sp.err)} ok={first(sp.ok)} />

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <form action={adjustBalance} className="space-y-3 rounded-xl border border-line bg-surface p-4">
          <h2 className="font-bold">Ubah saldo</h2>
          <input type="hidden" name="uid" value={u.id} />
          <select name="arah" className={input}><option value="tambah">Tambah</option><option value="kurang">Kurangi</option></select>
          <input name="jumlah" inputMode="numeric" placeholder="Jumlah, contoh 10000" required className={input} />
          <input name="catatan" placeholder="Catatan (opsional)" className={input} />
          <SubmitButton className="w-full" pendingText="Menyimpan…">Simpan</SubmitButton>
        </form>
        <form action={setUserPassword} className="space-y-3 rounded-xl border border-line bg-surface p-4">
          <h2 className="font-bold">Reset password</h2>
          <p className="text-sm text-ink-2">Untuk pengguna yang lupa password. Semua sesinya akan keluar.</p>
          <input type="hidden" name="uid" value={u.id} />
          <input name="password" minLength={8} required placeholder="Password baru" className={input} />
          <SubmitButton className="w-full" pendingText="Menyimpan…">Ganti password</SubmitButton>
        </form>
        <form action={toggleBan} className="space-y-3 rounded-xl border border-line bg-surface p-4">
          <h2 className="font-bold">{u.banned ? "Akun diblokir" : "Blokir akun"}</h2>
          <p className="text-sm text-ink-2">{u.banned ? "Pengguna tidak bisa masuk." : "Pengguna langsung dikeluarkan dan tidak bisa masuk lagi."}</p>
          <input type="hidden" name="uid" value={u.id} />
          <SubmitButton className={`w-full ${u.banned ? "" : "!bg-danger"}`} pendingText="Menyimpan…">{u.banned ? "Buka blokir" : "Blokir"}</SubmitButton>
        </form>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="font-display text-lg font-bold">Order</h2>
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-surface text-sm">
            {orders.map((o) => (
              <li key={o.id} className="flex gap-3 px-4 py-2">
                <span className="flex-1">#{o.id} {o.service} <span className="text-ink-2">{o.phone}</span></span>
                <span className="tabular">{rp(o.price)}</span>
                <span className="w-24 text-right text-ink-2">{statusLabel(o.status)}</span>
              </li>
            ))}
            {!orders.length && <li className="px-4 py-4 text-ink-2">Belum ada order.</li>}
          </ul>
          <h2 className="mt-6 font-display text-lg font-bold">Deposit</h2>
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-surface text-sm">
            {deposits.map((d) => (
              <li key={d.id} className="flex gap-3 px-4 py-2">
                <span className="flex-1">#{d.id} · {waktu(d.created_at)}</span>
                <span className="tabular">{rp(d.amount)}</span>
                <span className="w-24 text-right text-ink-2">{statusLabel(d.status)}</span>
              </li>
            ))}
            {!deposits.length && <li className="px-4 py-4 text-ink-2">Belum ada deposit.</li>}
          </ul>
        </section>
        <section>
          <h2 className="font-display text-lg font-bold">Mutasi saldo</h2>
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-surface text-sm">
            {ledger.map((r) => (
              <li key={r.id} className="flex gap-3 px-4 py-2">
                <span className="flex-1">{r.reason} <span className="text-ink-2">{r.ref} · {waktu(r.created_at)}</span></span>
                <span className={`tabular font-bold ${r.delta > 0 ? "text-signal" : ""}`}>{r.delta > 0 ? "+" : "−"}{rp(Math.abs(r.delta))}</span>
                <span className="tabular w-24 text-right text-ink-2">{rp(r.balance_after)}</span>
              </li>
            ))}
            {!ledger.length && <li className="px-4 py-4 text-ink-2">Belum ada mutasi.</li>}
          </ul>
        </section>
      </div>
    </>
  );
}
