import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { BalancePill } from "./BalancePill";
import { NavLinks } from "./NavLinks";

export function SiteHeader({ user, admin, siteName }: { user: { name: string; balance: number } | null; admin: boolean; siteName: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link href={user ? "/app" : "/"} className="flex items-center gap-2.5 font-display text-xl font-extrabold tracking-tight">
          <span className="chip chip-sm" aria-hidden />
          {siteName}
        </Link>

        {user ? (
          <>
            <NavLinks admin={admin} />
            <div className="ml-auto flex items-center gap-3">
              <BalancePill initial={user.balance} />
              <form action={logoutAction} className="hidden md:block">
                <button className="text-sm text-ink-2 hover:text-ink">Keluar</button>
              </form>
            </div>
          </>
        ) : (
          <nav className="ml-auto flex items-center gap-2 text-sm">
            <Link href="/masuk" className="rounded-lg px-3 py-2 font-semibold text-ink-2 hover:text-ink">Masuk</Link>
            <Link href="/daftar" className="rounded-lg bg-ink px-4 py-2 font-semibold text-paper hover:opacity-90">Daftar</Link>
          </nav>
        )}
      </div>
    </header>
  );
}
