"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { announceBalance } from "./BalancePill";

/** Cek status tagihan tiap 4 detik; muat ulang halaman begitu lunas / kedaluwarsa. */
export function DepositWatcher({ id, expiresAt }: { id: number; expiresAt: string | null }) {
  const router = useRouter();
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/deposit/${id}`, { cache: "no-store" });
        const data = await r.json();
        if (data.balance !== undefined) announceBalance(data.balance);
        if (data.status && data.status !== "PENDING" && !stop) {
          stop = true;
          router.refresh();
        }
      } catch {
        /* dicoba lagi */
      }
    };
    const t = setInterval(tick, 4000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [id, router]);

  useEffect(() => {
    if (!expiresAt) return;
    const upd = () => setLeft(Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000)));
    upd();
    const t = setInterval(upd, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  return (
    <p className="mt-4 flex items-center justify-center gap-2 text-sm text-ink-2" role="status">
      <span className="flex gap-1" aria-hidden>
        <span className="waiting-dot size-2 rounded-full bg-chip" />
        <span className="waiting-dot size-2 rounded-full bg-chip" />
        <span className="waiting-dot size-2 rounded-full bg-chip" />
      </span>
      Menunggu pembayaran
      {left !== null && <span className="tabular">· sisa {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</span>}
    </p>
  );
}
