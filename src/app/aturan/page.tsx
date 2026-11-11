import { PageTitle } from "@/components/Notice";
import { config } from "@/lib/config";

export const metadata = { title: "Aturan pemakaian" };

export default function RulesPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-6">
      <PageTitle title="Aturan pemakaian" />
      <div className="space-y-5 leading-relaxed text-ink-2 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink">
        <section>
          <h2>Pemakaian yang dilarang</h2>
          <p>Nomor dari {config.siteName} hanya boleh dipakai untuk verifikasi akun milik sendiri. Dilarang memakainya untuk penipuan, spam, pemalsuan identitas, atau kegiatan lain yang melanggar hukum. Akun yang melanggar diblokir dan saldonya tidak dikembalikan.</p>
        </section>
        <section>
          <h2>Nomor bersifat sementara</h2>
          <p>Nomor hanya aktif selama waktu yang tertera di layar dan bisa dipakai orang lain setelahnya. Jangan memakainya untuk akun penting yang butuh pemulihan lewat SMS di kemudian hari.</p>
        </section>
        <section>
          <h2>Pengembalian saldo</h2>
          <p>Kalau SMS tidak masuk, batalkan order (bisa setelah sekitar 2 menit) atau tunggu sampai waktunya habis. Saldo kembali utuh secara otomatis. Order yang sudah menerima SMS tidak bisa dikembalikan.</p>
        </section>
        <section>
          <h2>Deposit</h2>
          <p>Deposit dibayar lewat QRIS dan masuk otomatis. Saldo tidak bisa dicairkan kembali menjadi uang.</p>
        </section>
        {config.contactUrl && (
          <section>
            <h2>Bantuan</h2>
            <p>Ada kendala? <a href={config.contactUrl} className="font-bold text-ink underline" rel="noopener">{config.contactLabel}</a>.</p>
          </section>
        )}
      </div>
    </div>
  );
}
