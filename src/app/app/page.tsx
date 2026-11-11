import { Terminal } from "@/components/Terminal";
import { requireUser } from "@/lib/auth";
import { countries } from "@/lib/shop";

export const metadata = { title: "Beli nomor" };
export const dynamic = "force-dynamic";

export default async function AppPage({ searchParams }: { searchParams: Promise<{ baru?: string }> }) {
  const u = await requireUser("/app");
  const { baru } = await searchParams;
  // Jangan tahan halaman kalau API katalog sedang lambat: browser akan memuat sendiri (Indonesia ada di urutan pertama).
  const idn = await Promise.race([
    countries().then((l) => l.find((c) => c.code === "ID")?.id ?? 0).catch(() => 0),
    new Promise<number>((res) => setTimeout(() => res(0), 1200)),
  ]);
  return <Terminal defaultCountry={idn} initialBalance={u.balance} welcome={baru === "1"} />;
}
