import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 pt-16 text-center">
      <p className="font-display text-6xl font-extrabold">404</p>
      <p className="mt-2 text-ink-2">Halaman ini tidak ada.</p>
      <Link href="/" className="mt-6 inline-block rounded-xl bg-ink px-5 py-3 font-bold text-paper">Ke beranda</Link>
    </div>
  );
}
