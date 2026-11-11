import Link from "next/link";
import { PageTitle } from "@/components/Notice";
import { requireUser } from "@/lib/auth";
import { q, type Deposit, type LedgerRow, type Order } from "@/lib/db";
import { rp, statusLabel, STATUS_TONE, waktu } from "@/lib/format";

export const metadata = { title: "Riwayat" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "order", label: "Order" },
  { key: "deposit", label: "Deposit" },
  { key: "mutasi", label: "Mutasi saldo" },
];

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const u = await requireUser("/riwayat");
  const { tab = "order" } = await searchParams;

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6">
      <PageTitle title="Riwayat" />
      <nav className="mb-5 flex gap-1 rounded-xl bg-soft p-1" aria-label="Jenis riwayat">
        {TABS.map((t) => (
          <Link key={t.key} href={`/riwayat?tab=${t.key}`} aria-current={tab === t.key ? "page" : undefined}
            className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-bold ${tab === t.key ? "bg-surface text-ink" : "text-ink-2"}`}>
            {t.label}
          </Link>
        ))}
      </nav>
      {tab === "deposit" ? <Deposits uid={u.id} /> : tab === "mutasi" ? <Ledger uid={u.id} /> : <Orders uid={u.id} />}
    </div>
  );
}

const Empty = ({ text }: { text: string }) => <p className="rounded-xl border border-dashed border-line px-4 py-10 text-center text-ink-2">{text}</p>;
const Pill = ({ s }: { s: string }) => (
  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_TONE[s] ?? "bg-soft text-ink-2"}`}>{statusLabel(s)}</span>
);

async function Orders({ uid }: { uid: number }) {
  const rows = await q<Order>("SELECT * FROM nokos.orders WHERE user_id=$1 AND status <> 'PENDING' ORDER BY id DESC LIMIT 100", [uid]);
  if (!rows.length) return <Empty text="Belum ada order." />;
  return (
    <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
      {rows.map((o) => (
        <li key={o.id} className="px-4 py-3">
          <div className="flex items-center gap-2">
            <p className="flex-1 truncate font-bold">{o.service} <span className="font-normal text-ink-2">· {o.country}</span></p>
            <Pill s={o.status} />
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
            <span className="tabular">{o.phone ?? "-"}</span>
            {o.otp_code && <span>OTP <b className="tabular text-ink">{o.otp_code}</b></span>}
            <span className="tabular">{rp(o.price)}{o.refunded ? " (dikembalikan)" : ""}</span>
            <span>{waktu(o.created_at)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

async function Deposits({ uid }: { uid: number }) {
  const rows = await q<Deposit>("SELECT * FROM nokos.deposits WHERE user_id=$1 AND status <> 'NEW' ORDER BY id DESC LIMIT 50", [uid]);
  if (!rows.length) return <Empty text="Belum ada deposit." />;
  return (
    <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
      {rows.map((d) => (
        <li key={d.id}>
          <Link href={`/deposit/${d.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-soft">
            <span className="tabular flex-1 font-bold">{rp(d.amount)}</span>
            <span className="text-sm text-ink-2">{waktu(d.created_at)}</span>
            <Pill s={d.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function Ledger({ uid }: { uid: number }) {
  const rows = await q<LedgerRow>("SELECT * FROM nokos.ledger WHERE user_id=$1 ORDER BY id DESC LIMIT 100", [uid]);
  if (!rows.length) return <Empty text="Belum ada mutasi saldo." />;
  return (
    <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center gap-3 px-4 py-3">
          <div className="flex-1">
            <p className="font-bold capitalize">{r.reason}</p>
            <p className="text-sm text-ink-2">{waktu(r.created_at)} · {r.ref}</p>
          </div>
          <div className="text-right">
            <p className={`tabular font-display font-bold ${r.delta > 0 ? "text-signal" : ""}`}>{r.delta > 0 ? "+" : "−"}{rp(Math.abs(r.delta))}</p>
            <p className="tabular text-xs text-ink-2">saldo {rp(r.balance_after)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
