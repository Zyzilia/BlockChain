# Setup Midtrans Sandbox dan Tunnel (ngrok / Cloudflare)

Hanya SANDBOX. Jangan pakai key production atau uang sungguhan.

## 1. Akun Midtrans Sandbox
1. Daftar di https://dashboard.midtrans.com/register (data bisa dummy untuk nama bisnis), lalu verifikasi email dan login.
2. Pastikan environment di dashboard adalah **Sandbox**.
3. Buka **Settings > Access Keys**. Salin **Client Key** (`SB-Mid-client-...`) dan **Server Key** (`SB-Mid-server-...`).
   Sejak 28 Oktober 2026 Midtrans memakai sistem kunci baru:
   - **Server Key**: dibuat lewat tombol *Generate server key*, dengan izin **Snap Checkout = Write** dan **Core API = Read** (lainnya None). Nilainya hanya tampil **sekali**, jadi salin langsung.
   - **Signature Secret Key**: kunci terpisah untuk memverifikasi webhook. Klik ikon mata di sebelahnya (mungkin diminta kode 2FA).
   - **Client Key**: dipakai untuk Snap.js di browser (Tahap 7).
4. Isi di `backend/.env` (tanpa spasi setelah tanda `=`):
   ```
   MIDTRANS_SERVER_KEY=SB-Mid-server-xxxx
   MIDTRANS_SIGNATURE_SECRET_KEY=xxxx
   MIDTRANS_CLIENT_KEY=xxxx
   MIDTRANS_IS_PRODUCTION=false
   ```
   Semua kunci itu rahasia: jangan di-commit atau dikirim ke chat. Restart `npm run dev` setelah mengubah `.env`.
5. Server menolak start bila key bukan sandbox (tidak diawali `SB-`) atau `MIDTRANS_IS_PRODUCTION=true`.

## 2. Tunnel agar webhook sampai ke laptop
Midtrans tidak bisa memanggil `localhost`, jadi dibuat alamat publik sementara.

**ngrok**: daftar di ngrok.com, pasang, lalu `ngrok config add-authtoken <token>`. Jalankan `ngrok http 3000` dan salin alamat `https://....ngrok-free.dev`.
**Cloudflare Tunnel (tanpa daftar)**: `cloudflared tunnel --url http://localhost:3000`, salin alamat `https://....trycloudflare.com`.

Alamat gratis biasanya berubah setiap tunnel dijalankan ulang, jadi langkah 3 diulang sebelum demo.

## 3. Payment Notification URL
Di dashboard Midtrans Sandbox: **Settings > Configuration > Payment Notification URL**, isi:
```
https://ALAMAT-TUNNEL-KAMU/api/payments/notification
```
Simpan (Update). Finish/Unfinish/Error Redirect URL boleh dikosongkan sampai Tahap 7.

## 4. Membayar di sandbox
1. Jalankan `npm run demo:pay` (folder `backend`), buka tautan yang dicetak.
2. Pilih metode (VA bank, e-wallet, atau QRIS). Midtrans menampilkan nomor VA atau kode.
3. Selesaikan pembayaran lewat **simulator Midtrans** (daftar simulator ada di dokumentasi "Testing Payment on Sandbox": https://docs.midtrans.com/docs/testing-payment-on-sandbox).
4. Status order berubah menjadi `paid` lewat webhook.
**QRIS**: jangan dipindai dengan aplikasi bank atau e-wallet asli. Gunakan simulator saja, karena QRIS sandbox bisa terhubung ke merchant produksi.

`npm run demo:pay` otomatis mengecek status ke Midtrans tiap 15 detik bila webhook tidak sampai. Tanpa tunnel sama sekali: `npm run demo:pay:sync` (tiap 5 detik).

## Masalah umum
| Gejala | Penyebab |
|---|---|
| `/pay` 503 | `MIDTRANS_SERVER_KEY` belum diisi di `backend/.env` |
| `/pay` 502 "Access denied" | Server Key salah atau bukan sandbox |
| Bayar sukses tapi order tetap pending | Tunnel mati atau Notification URL belum diperbarui. Cek `POST /api/orders/:id/sync` |
| Webhook 403 "Signature tidak valid" di log server | `MIDTRANS_SIGNATURE_SECRET_KEY` salah atau belum diisi. Webhook ditandatangani dengan **Signature Secret Key**, bukan Server Key. Restart server setelah mengubah `.env` |
