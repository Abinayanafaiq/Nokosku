"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "./NavLinks";

export function BottomNav({ admin }: { admin: boolean }) {
  const path = usePathname();
  const items = admin
    ? [...NAV.slice(0, 3), { href: "/admin", label: "Admin", short: "Admin", icon: "M4 20V10 M10 20V4 M16 20v-7 M22 20H2" }]
    : NAV;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {items.map((n) => {
          const on = path === n.href || path.startsWith(n.href + "/");
          return (
            <li key={n.href}>
              <Link href={n.href} aria-current={on ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 text-xs font-semibold ${on ? "text-ink" : "text-ink-2"}`}>
                <svg viewBox="0 0 24 24" className={`size-5 ${on ? "stroke-chip-deep" : "stroke-current"}`} fill="none" strokeWidth={1.8}
                  strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={n.icon} />
                </svg>
                {n.short}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
