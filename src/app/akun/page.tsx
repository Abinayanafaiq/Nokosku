import { logoutAction } from "@/app/actions";
import { PasswordForm } from "@/components/PasswordForm";
import { PageTitle } from "@/components/Notice";
import { requireUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { waktu } from "@/lib/format";

export const metadata = { title: "Akun" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const u = await requireUser("/akun");
  return (
    <div className="mx-auto max-w-xl px-4 pt-6">
      <PageTitle title="Akun" />
      <dl className="divide-y divide-line rounded-xl border border-line bg-surface">
        {[["Nama", u.name], ["Email", u.email], ["Terdaftar", waktu(u.created_at)], ["ID pengguna", `#${u.id}`]].map(([k, v]) => (
          <div key={k} className="flex gap-4 px-4 py-3">
            <dt className="w-28 shrink-0 text-ink-2">{k}</dt>
            <dd className="min-w-0 break-words font-bold">{v}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-8">
        <h2 className="font-display text-xl font-bold">Ganti password</h2>
        <PasswordForm />
      </section>

      <section className="mt-8 flex flex-wrap items-center gap-3">
        {config.contactUrl && (
          <a href={config.contactUrl} rel="noopener" className="rounded-xl border border-line px-4 py-3 font-bold hover:border-ink-2">{config.contactLabel}</a>
        )}
        <form action={logoutAction}>
          <button className="rounded-xl px-4 py-3 font-bold text-danger hover:bg-danger/10">Keluar</button>
        </form>
      </section>
    </div>
  );
}
