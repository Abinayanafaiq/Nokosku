# Website Jualan Nokos

Next.js 15 + Tailwind CSS 4 + PostgreSQL. Nomor dari **smscode.gg**, deposit QRIS lewat **Sakupay**.

## Fitur
**Pembeli**
- Daftar / masuk pakai email + password.
- Beli nomor: pilih negara, lalu layanan. Harga dan stok terlihat sebelum beli.
- Kode OTP muncul otomatis di layar (dicek tiap 4 detik). Ada tombol salin nomor, salin nomor tanpa kode negara, dan salin kode.
- Batal & refund (setelah ±2 menit). Kalau waktu habis tanpa SMS, saldo kembali otomatis.
- Isi saldo pakai QRIS Sakupay. Saldo masuk otomatis begitu dibayar.
- Riwayat order, deposit, dan mutasi saldo.

**Admin** (`/admin`, untuk email di `ADMIN_EMAILS`)
- Ringkasan: saldo modal smscode, saldo Sakupay, omzet & untung hari ini / 7 hari, peringatan kalau modal menipis.
- Pengguna: cari, tambah / kurangi saldo, reset password, blokir.
- Order & deposit: daftar lengkap + tombol cek ulang status.
- Harga: markup global + aturan per layanan (harga pas atau markup khusus, per negara atau semua negara). Ada pengecek harga.

**Pengaman**
- Tidak bisa rugi per order: bot hanya mengambil nomor kalau modalnya minimal Rp100 di bawah harga jual.
- Saldo tidak bisa minus, refund dan deposit tidak bisa masuk dua kali.
- Webhook Sakupay diverifikasi signature-nya, lalu dicek ulang ke API sebelum saldo ditambah.
- Semua tabel ada di schema `nokos`, jadi tidak mengganggu tabel lain di database yang sama.

## Menjalankan di komputer (Windows)
1. Install **Node.js LTS** dari https://nodejs.org
2. Buka file `.env` pakai Notepad, cek isinya (database & token smscode sudah terisi). Tambahkan `SAKUPAY_API_KEY`.
3. Double-click **`jalankan.bat`**. Pertama kali akan install library dan build (±2–3 menit).
4. Buka http://localhost:3000, lalu **daftar pakai email yang ada di `ADMIN_EMAILS`**. Akun itu otomatis jadi admin.

## Deploy ke VPS (termasuk VPS NAT)
1. Upload folder `web` ke VPS (WinSCP / FileZilla), misalnya ke `/root/nokosweb`. **Jangan** ikutkan folder `node_modules` dan `.next`.
2. Login SSH, lalu:
   ```bash
   cd /root/nokosweb
   sed -i 's/\r$//' install_vps.sh .env && bash install_vps.sh
   ```
3. Website jalan di port 3000 di dalam VPS. Supaya bisa diakses publik dengan https (dan webhook Sakupay jalan), pakai **Cloudflare Tunnel**. Cara ini juga bisa dipakai di VPS NAT karena tidak perlu buka port:
   - Domain kamu harus sudah memakai Cloudflare (nameserver diarahkan ke Cloudflare).
   - Buka dash.cloudflare.com, lalu **Zero Trust → Networks → Tunnels → Create a tunnel** (Cloudflared).
   - Pilih Debian/Ubuntu, lalu jalankan perintah instalasi yang diberikan di VPS (`sudo cloudflared service install eyJ...`).
   - Di bagian **Public Hostname**, isi domain kamu (misal `nokosku.com`). Service: `HTTP` → `localhost:3000`.
4. Ubah `.env` di VPS:
   ```
   SITE_URL=https://nokosku.com
   COOKIE_SECURE=true
   ```
   lalu `sudo systemctl restart nokosweb`.
5. Buka `https://domainkamu/admin`, lalu tekan **Hubungkan webhook**. Selesai.

Perintah berguna di VPS: `sudo journalctl -u nokosweb -f` (log) · `sudo systemctl restart nokosweb` (restart).
Update kode: upload file baru, lalu `npm ci && npm run build && sudo systemctl restart nokosweb`.

> Jalankan **satu** server saja. Kalau sudah di VPS, jangan jalankan `jalankan.bat` di komputer
> bersamaan, karena dua-duanya akan mengecek order yang sama.

## Sakupay: uji coba dulu
1. Isi `SAKUPAY_API_KEY=sk_test_...` lalu restart.
2. Isi saldo di website. QR mode tes tidak bisa discan, jadi tekan **Buka halaman bayar Sakupay**, lalu **Saya sudah bayar**.
3. Saldo akan masuk dalam ±8 detik. Kalau sudah lancar, ganti ke `sk_live_...`, restart, dan tekan **Hubungkan webhook** lagi di `/admin`.

## Struktur
```
src/lib/        logika: db.ts (tabel + saldo), shop.ts (katalog, harga, order, deposit), smscode.ts, sakupay.ts, auth.ts
src/app/        halaman: / (beranda), /app (beli), /deposit, /riwayat, /akun, /admin/*
src/app/api/    API JSON untuk halaman beli
src/app/webhook/sakupay   penerima webhook pembayaran
src/instrumentation.ts    menyalakan pengecek OTP & deposit di latar belakang
```
