export function Notice({ ok, err }: { ok?: string | null; err?: string | null }) {
  if (!ok && !err) return null;
  return (
    <p role={err ? "alert" : "status"}
      className={`rounded-xl px-4 py-3 text-sm font-semibold ${err ? "bg-danger/10 text-danger" : "bg-signal/12 text-signal"}`}>
      {err || ok}
    </p>
  );
}

export function PageTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{title}</h1>
      {sub && <p className="mt-1 text-ink-2">{sub}</p>}
    </div>
  );
}

export const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
