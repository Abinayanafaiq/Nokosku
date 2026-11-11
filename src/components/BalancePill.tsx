"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { rp } from "@/lib/format";

/** Saldo di header. Ikut berubah saat halaman lain mengirim event "nokos:saldo". */
export function BalancePill({ initial }: { initial: number }) {
  const [bal, setBal] = useState(initial);
  useEffect(() => setBal(initial), [initial]);
  useEffect(() => {
    const on = (e: Event) => setBal((e as CustomEvent<number>).detail);
    window.addEventListener("nokos:saldo", on);
    return () => window.removeEventListener("nokos:saldo", on);
  }, []);
  return (
    <Link href="/deposit" title="Isi saldo"
      className="sim-sm flex items-center gap-2 bg-ink py-1.5 pl-2.5 pr-4 text-paper hover:opacity-90">
      <span className="chip chip-sm" aria-hidden />
      <span className="tabular font-display text-sm font-bold">{rp(bal)}</span>
      <span className="sr-only">Saldo, ketuk untuk isi saldo</span>
    </Link>
  );
}

export const announceBalance = (n: number) => window.dispatchEvent(new CustomEvent("nokos:saldo", { detail: n }));
