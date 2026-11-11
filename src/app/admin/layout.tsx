import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const LINKS = [
  ["/admin", "Ringkasan"],
  ["/admin/pengguna", "Pengguna"],
  ["/admin/order", "Order"],
  ["/admin/deposit", "Deposit"],
  ["/admin/harga", "Harga"],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-6xl px-4 pt-6">
      <nav className="-mx-4 mb-6 flex gap-1 overflow-x-auto px-4" aria-label="Menu admin">
        {LINKS.map(([href, label]) => (
          <Link key={href} href={href} className="shrink-0 rounded-lg bg-soft px-3 py-2 text-sm font-bold text-ink-2 hover:text-ink">
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
