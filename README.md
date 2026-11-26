# TiketAman

Platform tiket event anti-calo. Tiket diterbitkan sebagai token ERC-721 di blockchain, pembeli membayar dalam rupiah lewat Midtrans (sandbox).

Proyek mata kuliah Teknologi Blockchain dan Platform Keuangan Digital, Universitas Brawijaya.
Hanya memakai sandbox dan testnet. Tidak ada uang atau data pribadi asli.

## Cara kerja singkat
1. Pembeli memilih event dan membayar lewat VA, QRIS, atau e-wallet (Midtrans sandbox).
2. Setelah pembayaran sukses, server mencetak token tiket ke wallet pembeli (Sepolia testnet).
3. Smart contract menjaga tiga aturan: harga jual ulang maksimal 110%, maksimal 4 tiket per alamat, dan tiket hanya bisa dipakai sekali.

## Struktur folder
| Folder | Isi |
|---|---|
| `contracts/` | Smart contract Solidity dan Hardhat |
| `backend/` | API Express, database SQLite, Midtrans, pencetakan token, resale, check-in |
| `frontend/` | Tampilan web (React + Vite), gaya mengikuti `docs/DESIGN.md` |
| `docs/` | Arsitektur, ERD, API, setup Midtrans, desain, jurnal, pernyataan AI |

## Status pengerjaan
| Tahap | Isi | Status |
|---|---|---|
| 1 | Kerangka proyek, database, dokumentasi | Selesai |
| 2 | Smart contract, test, deploy Sepolia | Selesai |
| 3 | Backend: auth, event, order | Selesai |
| 4 | Midtrans sandbox dan webhook | Selesai |
| 5 | Pembayaran memicu pencetakan token | Selesai |
| 6 | Resale berbatas harga dan check-in QR | Selesai |
| 7 | Frontend, desain, dan persiapan demo | Selesai |

## Kebutuhan
- Node.js 20 atau lebih baru, Git
- Akun gratis: Alchemy (RPC Sepolia), Midtrans Sandbox, ngrok atau Cloudflare Tunnel
- Wallet MetaMask khusus testnet dengan SepoliaETH dari faucet

## Menjalankan
Perintah npm dijalankan dari folder yang tertulis. `ROOT` = folder utama repo ini.

```bash
# folder: backend
npm install
cp .env.example .env        # Windows: copy .env.example .env
npm run gen:keys            # salin JWT_SECRET dan WALLET_ENC_KEY ke .env
# isi sisa nilai di .env (lihat tabel di bawah). Jangan commit .env
npm run db:init
npm run dev                 # server di http://localhost:3000
```

Isi `backend/.env` (tanpa spasi setelah `=`):

| Variabel | Dari mana |
|---|---|
| `JWT_SECRET`, `WALLET_ENC_KEY` | `npm run gen:keys` |
| `RPC_URL` | Alchemy, jaringan Ethereum Sepolia |
| `PLATFORM_PRIVATE_KEY` | Akun MetaMask khusus testnet (pemilik contract) |
| `CONTRACT_ADDRESS` | Hasil `npm run deploy:sepolia` di folder `contracts` |
| `MIDTRANS_SERVER_KEY` | Midtrans Sandbox, Settings > Access Keys (Generate server key: Snap Checkout Write, Core API Read) |
| `MIDTRANS_SIGNATURE_SECRET_KEY` | Midtrans Sandbox, Settings > Access Keys (ikon mata). Untuk verifikasi webhook |
| `MIDTRANS_CLIENT_KEY` | Midtrans Sandbox, Settings > Access Keys (dipakai Tahap 7) |
| `MIDTRANS_IS_PRODUCTION` | `false` |

Panduan akun Midtrans dan tunnel: `docs/08-setup-midtrans-ngrok.md`. Daftar endpoint: `docs/07-dokumentasi-api.md`.
Setelah mengubah `.env`, **restart server** (`npm run dev` tidak membaca ulang `.env` sendiri).

**Tampilan web (frontend)**
```bash
# folder: frontend
npm install
npm run dev                 # buka http://localhost:5173 (backend harus menyala di port 3000)
```
Untuk demo, lebih praktis memakai satu alamat saja:
```bash
# folder: frontend
npm run build               # menghasilkan folder dist
# lalu restart backend (folder: backend, npm run dev) dan buka http://localhost:3000
```
Backend otomatis menyajikan `frontend/dist` bila ada, sehingga **satu tunnel ngrok cukup** untuk tampilan web dan webhook Midtrans.
Setelah mengubah kode frontend, jalankan `npm run build` lagi.

## Cara menguji

### Tahap 1: kerangka dan database
```bash
# folder: backend
npm run db:init
npm run dev
```
Buka http://localhost:3000/health. Hasil yang benar: `"status":"ok"` dan `"tables":8`.

### Tahap 2: smart contract
```bash
# folder: contracts
npm install
npm test                    # tanpa ETH, berjalan lokal
npm run deploy:sepolia      # butuh ETH testnet, cukup sekali
npm run demo:sepolia        # butuh CONTRACT_ADDRESS
```
Hasil yang benar: 20 test passing. Demo menampilkan link Etherscan, listing di atas 110% ditolak, dan check-in kedua ditolak.

### Tahap 3: akun, event, order
```bash
# folder: backend (terminal 1)
npm run dev
# folder: backend (terminal 2)
npm run smoke
```
Hasil yang benar: semua baris `[OK]`. Smoke test menerbitkan 1 event ke Sepolia (memakai sedikit gas).

### Tahap 4: pembayaran Midtrans
Prasyarat: `MIDTRANS_SERVER_KEY` dan `MIDTRANS_SIGNATURE_SECRET_KEY` (sandbox) terisi di `backend/.env`.
```bash
# folder: backend (terminal 1)
npm run dev
# folder: backend (terminal 2)
npm run test:payment
```
Hasil yang benar: semua baris `[OK]` (token Snap dibuat di Midtrans, webhook sukses, gagal, kedaluwarsa, signature palsu ditolak, notifikasi ganda tidak diproses ulang).

Uji bayar sungguhan di sandbox (menguji kecocokan kunci dengan Midtrans, jangan dilewati sebelum demo):
```bash
# folder: backend (terminal 1)
npm run dev
# terminal 2: nyalakan tunnel (ngrok http 3000), isi Payment Notification URL di Midtrans
# folder: backend (terminal 3)
npm run demo:pay            # tanpa tunnel: npm run demo:pay:sync
```
Buka tautan yang dicetak, bayar lewat simulator Midtrans. Hasil yang benar: log server menampilkan `settlement -> paid`.

### Tahap 5: token tercetak setelah bayar
Prasyarat: saldo SepoliaETH di akun platform (cek di MetaMask), `CONTRACT_ADDRESS` terisi, file `backend/src/abi/TiketAman.json` ada.
```bash
# folder: backend (terminal 1)
npm run dev
# folder: backend (terminal 2)
npm run test:mint           # pembayaran disimulasikan, pencetakan token sungguhan di Sepolia
npm run reconcile:chain
```
Hasil yang benar: 2 tiket menjadi `valid` dalam 20-60 detik, tiap tiket punya tokenId dan link Etherscan, pemilik di blockchain sama dengan wallet pembeli, dan rekonsiliasi menampilkan `Semua cocok (100%)`.

Uji penuh dengan pembayaran sandbox sungguhan: jalankan `npm run demo:pay` (folder `backend`), bayar lewat simulator. Setelah `LUNAS`, script menunggu token dan mencetak link Etherscan.

### Tahap 6: resale dan check-in QR
Prasyarat: saldo SepoliaETH cukup (tes ini mengirim sekitar 8 transaksi) dan server menyala.
```bash
# folder: backend (terminal 1)
npm run dev
# folder: backend (terminal 2)
npm run test:flow           # 3-5 menit, banyak menunggu konfirmasi blok Sepolia
npm run reconcile:chain
```
Hasil yang benar: semua baris `[OK]`. Yang dibuktikan: harga di atas 110% ditolak, harga tepat 110% diterima, hanya satu pembeli pada satu waktu, kepemilikan token berpindah di blockchain, penjual lama tidak bisa mengambil QR, QR yang dimodifikasi ditolak, hanya penyelenggara yang bisa memindai, check-in kedua ditolak, check-in tercatat di blockchain (`used = true`), dan penjualan bisa dibatalkan.

### Tahap 7: tampilan web dan uji menyeluruh
```bash
# folder: backend (terminal 1)
npm run dev
# folder: frontend (terminal 2)
npm install                 # sekali saja
npm run dev                 # buka http://localhost:5173
```
Hasil yang benar: beranda tampil dengan daftar event (atau pesan "Belum ada event terbit" bila database baru), tanpa error merah di konsol browser.

Uji menyeluruh semua tahap sekaligus (server harus menyala, sekitar 8 sampai 12 menit):
```bash
# folder: backend (terminal 3)
npm run test:all
```
Hasil yang benar: ringkasan di akhir menampilkan `[LULUS]` untuk keenam tahap dan `Semua tahap lulus. Siap demo.`

## Catatan penting dan checklist demo

### Satu hari sebelum demo
- [ ] Saldo SepoliaETH akun platform cukup (minimal sekitar 0,01 ETH). Habis berarti token tidak tercetak. Isi dari faucet bila menipis.
- [ ] `backend/.env` lengkap sesuai tabel di atas, tanpa spasi setelah `=`.
- [ ] `CONTRACT_ADDRESS` sama dengan contract yang dipakai, dan `backend/src/abi/TiketAman.json` ada. Jangan deploy ulang tanpa perlu: alamat baru berarti event lama tidak ada di contract baru.
- [ ] Key Midtrans adalah key **sandbox**. `MIDTRANS_SIGNATURE_SECRET_KEY` terisi (webhook ditandatangani dengan kunci ini, bukan Server Key).
- [ ] Jalankan `npm run test:all` (folder `backend`, server menyala). Semua tahap harus `[LULUS]`.
- [ ] `npm run build` di folder `frontend` terbaru, lalu restart backend.
- [ ] Latihan satu kali penuh dengan `npm run demo:pay`.
- [ ] Rekam video demo sebagai cadangan, simpan link Etherscan hasil latihan.

### Sebelum demo dimulai (urutan menyalakan)
1. Terminal 1, folder `backend`: `npm run dev`. Pastikan tidak ada pesan `Konfigurasi .env belum benar`.
2. Terminal 2: `ngrok http 3000`. Salin alamat di baris Forwarding.
3. Dashboard Midtrans Sandbox: pastikan **Payment Notification URL** = `https://ALAMAT-NGROK/api/payments/notification`. Alamat ngrok bisa berubah tiap dinyalakan ulang, jadi periksa setiap sesi.
4. Cek `https://ALAMAT-NGROK/health` di browser.
5. Terminal 3, folder `backend`: `npm run demo:pay`.

### Alur demo lewat tampilan web (5-7 menit)
Siapkan dua jendela browser terpisah (atau satu jendela biasa dan satu jendela penyamaran) supaya dua akun bisa login bersamaan.
Siapkan sebelumnya: akun penyelenggara, akun pembeli A, dan akun pembeli B (data dummy, email berakhiran `.ac.id`).
1. **Bukti on-chain.** Tunjukkan contract di Etherscan (tautan "Etherscan" di sisi kiri halaman) dan jelaskan tiga aturan anti-calo.
2. **Penyelenggara.** Menu Panitia, isi event baru, lalu **Terbitkan**. Tunggu 10 sampai 30 detik, kartu event menampilkan "Bukti di Etherscan" (konfigurasi terkunci di blockchain).
3. **Pembeli A.** Buka event, pilih 2 tiket, **Beli dan bayar** (Rp160.000). Popup Midtrans muncul, bayar lewat simulator Midtrans. Pelacak pembayaran berubah menjadi "Dibayar".
4. **Token tercetak.** Menu Tiket saya: status "Sedang dicetak" berubah menjadi "Valid" dengan nomor token. Klik **Verifikasi di blockchain**.
5. **Jual ulang.** Pasang satu tiket di Rp90.000 (ditolak, batas Rp82.500), lalu Rp82.500 (diterima, tampil rincian penerimaan).
6. **Pembeli B.** Menu Resale, **Beli tiket**, bayar lewat simulator. Token berpindah, tiket muncul di akun B, hilang dari akun A.
7. **QR berputar.** Di akun B, **Tampilkan QR** (berganti tiap 60 detik). Akun A tidak lagi bisa mengambil QR tiket itu.
8. **Check-in.** Akun penyelenggara, menu Pindai tiket: pindai QR (kamera) atau tempel kodenya (tombol "Salin kode QR"). Hasil hijau muncul dalam hitungan milidetik. Pindai lagi: ditolak.
9. Tunjukkan transaksi `markUsed` di Etherscan dan jalankan `npm run reconcile:chain` (folder `backend`): semua cocok 100%.

### Bila ada masalah
| Gejala | Penyebab dan cara mengatasi |
|---|---|
| Server tidak mau start, minta `JWT_SECRET` atau `WALLET_ENC_KEY` | Jalankan `npm run gen:keys` (folder `backend`), salin ke `.env` |
| Webhook ditolak 403 `Signature tidak valid` | `MIDTRANS_SIGNATURE_SECRET_KEY` salah atau belum diisi. Restart server setelah mengubah `.env` |
| Bayar sukses tetapi order tetap `pending` | Tunnel mati atau Notification URL tidak sama dengan alamat ngrok saat ini. Cadangan: `npm run demo:pay:sync` atau `POST /api/orders/:id/sync` |
| Order `paid` tetapi tiket tetap `pending_mint` | Lihat log server (`[MINT]`). Biasanya saldo SepoliaETH habis atau RPC bermasalah. Isi ETH, server mencoba ulang otomatis tiap 20 detik |
| `/pay` 503 atau 502 | `MIDTRANS_SERVER_KEY` kosong atau salah |
| `Cannot read properties of undefined (reading 'address')` saat deploy | `PLATFORM_PRIVATE_KEY` tidak terbaca. Pastikan isi file `.env`, bukan `.env.example` |
| Error `insufficient funds` | Saldo SepoliaETH habis |
| Check-in ditolak `QR sudah kedaluwarsa` | QR hanya berlaku 60-120 detik. Pemilik membuka ulang QR-nya |
| Resale sudah dibayar tetapi tiket belum pindah | Lihat log server (`[CHAIN]` atau `[RESALE]`), biasanya saldo SepoliaETH habis. Server mencoba ulang otomatis |
| Halaman web kosong atau error "Tidak bisa menghubungi server" | Backend belum menyala, atau frontend dijalankan tanpa backend di port 3000 |
| Popup Midtrans tidak muncul | `MIDTRANS_CLIENT_KEY` kosong atau salah. Halaman pembayaran otomatis dibuka di tab baru sebagai cadangan, atau pakai tautan "Buka halaman pembayaran" |
| Tampilan web lama setelah mengubah kode | Jalankan `npm run build` lagi di folder `frontend`, lalu muat ulang browser |
| Kamera pemindai tidak ada | Browser belum mendukung pemindaian QR. Tempel kode QR secara manual |
| Ingin mulai dari data bersih | Hentikan server, hapus `backend/db/tiketaman.db`, lalu `npm run db:init` (folder `backend`) |

### Batasan yang perlu diketahui (jujur saat presentasi)
- **Refund belum otomatis.** Bila pembayaran resale masuk tetapi token tidak bisa dipindahkan (misalnya kuota pembeli penuh di kontrak), order tetap `paid` dan dicoba ulang. Pengembalian dana dilakukan manual lewat dashboard Midtrans.
- **Pembayaran ke penjual dan penyelenggara dicatat, belum dicairkan.** Rincian komisi, bagian penyelenggara, dan penerimaan penjual dihitung di API, tetapi pencairan dana tidak dibuat (di luar lingkup sandbox).
- **Backend adalah pemilik contract.** Semua transaksi dikirim platform atas nama pengguna (wallet custodial). Aturan harga tetap tidak bisa dilanggar platform, karena dikunci di kontrak.
- **Check-in memakai database lebih dulu.** Gerbang menjawab dari database (cepat), pencatatan `markUsed` di blockchain menyusul beberapa detik kemudian.
- **Tanggal event belum dibatasi saat check-in** (memudahkan demo dengan event yang jauh di masa depan).

### Keamanan
- Jangan commit `backend/.env`. Periksa `git status` sebelum commit.
- Jangan kirim isi `.env` ke chat atau grup, sensor nilainya (`xxxx`) bila perlu mengirim screenshot.
- Pakai akun MetaMask khusus testnet dan key Midtrans sandbox saja.
- Jangan memindai QRIS sandbox dengan aplikasi bank atau e-wallet asli, pakai simulator Midtrans.
- Setelah penilaian selesai, ganti atau hapus key Alchemy dan Midtrans.

### Cadangan saat presentasi
Bila internet kampus bermasalah: putar video demo dan tunjukkan transaksi yang sudah tercatat di Etherscan Sepolia.

## Smart contract di Sepolia
- Alamat contract: `ISI-SETELAH-DEPLOY`
- Etherscan: https://sepolia.etherscan.io/address/ISI-SETELAH-DEPLOY

## Tim
- Khansa Firyal Adila (245150700111029)
- Aurelia Callysta Mamahit (245150700111024)
- Gede Raditya Dharma Putra Ayudia (245150700111028)
- Zeva Wyakta Zaylendra (245150700111033)

Dosen pengampu: Hariz Farisi, S.Kom., M.T.
