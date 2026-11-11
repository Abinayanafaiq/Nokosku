import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { cancelDepositAction } from "@/app/actions";
import { DepositWatcher } from "@/components/DepositWatcher";
import { Notice, one as first } from "@/components/Notice";
import { SubmitButton } from "@/components/ui";
import { isAdmin, requireUser } from "@/lib/auth";
import { sakupayTest } from "@/lib/config";
import { rp, statusLabel, waktu } from "@/lib/format";
import { getDeposit, syncDeposit } from "@/lib/shop";

export const metadata = { title: "Bayar QRIS" };
export const dynamic = "force-dynamic";

export default async function DepositDetail({ params, searchParams }:
  { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[]>> }) {
  const u = await requireUser("/deposit");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  let d = await getDeposit(Number(id));
  if (!d || (d.user_id !== u.id && !isAdmin(u))) notFound();
  if (d.status === "PENDING") d = await syncDeposit(d);

  const pending = d.status === "PENDING";
  const qr = pending && d.qr_string
    ? await QRCode.toString(d.qr_string, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#142038", light: "#ffffff" } })
    : null;

  return (
    <div className="mx-auto max-w-md px-4 pt-6">
      <Link href="/deposit" className="text-sm font-bold text-ink-2 hover:text-ink">← Isi saldo</Link>
      <div className="mt-3"><Notice err={first(sp.err)} ok={first(sp.ok)} /></div>

      <div className="sim mt-3 bg-surface p-6">
        <p className="text-sm text-ink-2">Tagihan #{d.id} · {waktu(d.created_at)}</p>
        <p className="mt-1 text-sm text-ink-2">Bayar tepat</p>
        <p className="tabular font-display text-4xl font-extrabold tracking-tight">{rp(d.payable ?? d.amount)}</p>
        {d.payable && d.payable !== d.amount && (
          <p className="text-sm text-ink-2">Saldo yang masuk {rp(d.amount)}. Selisihnya kode unik pembayaran.</p>
        )}

        {pending ? (
          <>
            {qr ? (
              <div className="mx-auto mt-5 w-full max-w-72 rounded-xl bg-white p-3 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
            ) : (
              <p className="mt-5 text-ink-2">QR tidak tersedia. Pakai tombol halaman bayar di bawah.</p>
            )}
            <DepositWatcher id={d.id} expiresAt={d.expires_at?.toISOString() ?? null} />
            <ol className="mt-5 list-decimal space-y-1 pl-5 text-sm text-ink-2">
              <li>Simpan atau screenshot QR ini, atau scan langsung dari HP lain.</li>
              <li>Buka aplikasi bank / e-wallet, pilih bayar QRIS.</li>
              <li>Pastikan nominal sama persis, lalu bayar. Halaman ini berubah sendiri.</li>
            </ol>
            {d.payment_url && (
              <a href={d.payment_url} target="_blank" rel="noopener"
                className="mt-5 block rounded-xl border border-line px-4 py-3 text-center font-bold hover:border-ink-2">
                Buka halaman bayar Sakupay
              </a>
            )}
            {sakupayTest() && (
              <p className="mt-3 rounded-lg bg-chip/15 px-3 py-2 text-xs font-semibold text-chip-deep">
                Mode uji coba: QR ini tidak bisa discan. Buka halaman bayar Sakupay lalu tekan “Saya sudah bayar”.
              </p>
            )}
            <form action={cancelDepositAction} className="mt-3">
              <input type="hidden" name="id" value={d.id} />
              <SubmitButton className="w-full !bg-transparent !text-ink-2 hover:!text-danger" pendingText="Membatalkan…">Batalkan tagihan</SubmitButton>
            </form>
          </>
        ) : (
          <div className="mt-5">
            <p className={`rounded-xl px-4 py-3 font-bold ${d.status === "PAID" ? "bg-signal/12 text-signal" : "bg-soft text-ink-2"}`}>
              {d.status === "PAID" ? `Lunas. ${rp(d.amount)} sudah masuk ke saldo.` : `Tagihan ${statusLabel(d.status).toLowerCase()}.`}
            </p>
            <Link href={d.status === "PAID" ? "/app" : "/deposit"}
              className="mt-4 block rounded-xl bg-ink px-4 py-3 text-center font-display font-bold text-paper hover:opacity-90">
              {d.status === "PAID" ? "Beli nomor sekarang" : "Buat tagihan baru"}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
