/** Helper tampilan — aman dipakai di server maupun browser. */
export const rp = (n: number | null | undefined) => "Rp" + Math.round(Number(n ?? 0)).toLocaleString("id-ID");

export function waktu(v: Date | string | null | undefined, withDate = true) {
  if (!v) return "-";
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    ...(withDate ? { day: "numeric", month: "short", year: "numeric" } : {}),
    hour: "2-digit", minute: "2-digit",
  }) + (withDate ? "" : " WIB");
}

export const STATUS_LABEL: Record<string, string> = {
  PENDING: "Diproses", ACTIVE: "Menunggu SMS", OTP_RECEIVED: "SMS masuk", COMPLETED: "Selesai",
  CANCELED: "Dibatalkan", EXPIRED: "Waktu habis", FAILED: "Gagal",
  NEW: "Baru", PAID: "Lunas", CANCELLED: "Dibatalkan",
};
export const statusLabel = (s: string) => STATUS_LABEL[s] ?? s;

export const STATUS_TONE: Record<string, string> = {
  ACTIVE: "text-chip-deep bg-chip/15", OTP_RECEIVED: "text-signal bg-signal/12", COMPLETED: "text-ink-2 bg-soft",
  CANCELED: "text-ink-2 bg-soft", EXPIRED: "text-ink-2 bg-soft", FAILED: "text-danger bg-danger/10",
  PENDING: "text-chip-deep bg-chip/15", PAID: "text-signal bg-signal/12", CANCELLED: "text-ink-2 bg-soft",
};
