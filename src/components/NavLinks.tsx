"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const NAV = [
  { href: "/app", label: "Beli nomor", short: "Beli", icon: "M5 4h10l4 4v12H5z M9 13h6 M9 16h4" },
  { href: "/deposit", label: "Isi saldo", short: "Saldo", icon: "M12 5v14 M5 12h14" },
  { href: "/riwayat", label: "Riwayat", short: "Riwayat", icon: "M4 6h16 M4 12h16 M4 18h10" },
  { href: "/akun", label: "Akun", short: "Akun", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" },
];

const active = (path: string, href: string) => path === href || path.startsWith(href + "/");

export function NavLinks({ admin }: { admin: boolean }) {
  const path = usePathname();
  const items = admin ? [...NAV, { href: "/admin", label: "Admin", short: "Admin", icon: "" }] : NAV;
  return (
    <nav className="ml-4 hidden items-center gap-1 text-sm md:flex">
      {items.map((n) => (
        <Link key={n.href} href={n.href}
          className={`rounded-lg px-3 py-2 font-semibold ${active(path, n.href) ? "bg-soft text-ink" : "text-ink-2 hover:text-ink"}`}>
          {n.label}
        </Link>
      ))}
    </nav>
  );
}
