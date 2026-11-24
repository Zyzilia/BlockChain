# TiketAman

Platform tiket event anti-calo. Tiket diterbitkan sebagai token ERC-721 di blockchain, pembeli membayar dalam rupiah lewat Midtrans (sandbox).

Proyek mata kuliah Teknologi Blockchain dan Platform Keuangan Digital, Universitas Brawijaya.
Hanya memakai sandbox dan testnet. Tidak ada uang atau data pribadi asli.

## Cara kerja singkat

1. Pembeli memilih event dan membayar lewat VA, QRIS, atau e-wallet (Midtrans sandbox).
2. Setelah pembayaran sukses, server mencetak token tiket ke wallet pembeli (Sepolia testnet).
3. Smart contract menjaga tiga aturan: harga jual ulang maksimal 110%, maksimal 4 tiket per alamat, dan tiket hanya bisa dipakai sekali.

## Struktur folder

| Folder       | Isi                                                         |
| ------------ | ----------------------------------------------------------- |
| `contracts/` | Smart contract Solidity dan Hardhat                         |
| `backend/`   | API Express, database SQLite, integrasi Midtrans            |
| `frontend/`  | Tampilan web (React)                                        |
| `docs/`      | Arsitektur, ERD, API, setup Midtrans, jurnal, pernyataan AI |

## Status pengerjaan

| Tahap | Isi                                    | Status  |
| ----- | -------------------------------------- | ------- |
| 1     | Kerangka proyek, database, dokumentasi | Selesai |
| 2     | Smart contract, test, deploy Sepolia   | Selesai |
| 3     | Backend: auth, event, order            | Selesai |
| 4     | Midtrans sandbox dan webhook           | Selesai |
| 5     | Pembayaran memicu mint token           | Belum   |
| 6     | Resale dan check-in QR                 | Belum   |
| 7     | Frontend dan persiapan demo            | Belum   |

## Kebutuhan

- Node.js 20 atau lebih baru, Git
- Akun gratis: Alchemy (RPC Sepolia), Midtrans Sandbox, ngrok atau Cloudflare Tunnel
- Wallet MetaMask khusus testnet dengan SepoliaETH dari faucet

## Menjalankan

Semua perintah npm dijalankan dari folder yang tertulis. `ROOT` = folder utama repo ini.

```bash
# folder: backend
npm install
cp .env.example .env        # Windows: copy .env.example .env
npm run gen:keys            # salin JWT_SECRET dan WALLET_ENC_KEY ke .env
# isi RPC_URL, PLATFORM_PRIVATE_KEY, CONTRACT_ADDRESS, MIDTRANS_* di .env (jangan commit .env)
npm run db:init
npm run dev                 # server di http://localhost:3000
```

Panduan akun Midtrans dan tunnel: `docs/08-setup-midtrans-ngrok.md`. Daftar endpoint: `docs/07-dokumentasi-api.md`.

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
npm run deploy:sepolia      # butuh ETH testnet, hanya sekali
npm run demo:sepolia        # bukti di Sepolia (butuh CONTRACT_ADDRESS)
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

Prasyarat: `MIDTRANS_SERVER_KEY` dan `MIDTRANS_SIGNATURE_SECRET_KEY` (sandbox) terisi di `backend/.env`. Webhook diverifikasi dengan Signature Secret Key, bukan Server Key.

```bash
# folder: backend (terminal 1)
npm run dev
# folder: backend (terminal 2)
npm run test:payment
```

Hasil yang benar: semua baris `[OK]` (token Snap dibuat di Midtrans, webhook sukses, gagal, kedaluwarsa, signature palsu ditolak, notifikasi ganda tidak diproses ulang).

Uji bayar sungguhan di sandbox:

```bash
# folder: backend (terminal 1)
npm run dev
# terminal 2: nyalakan tunnel (ngrok http 3000) dan isi Notification URL di Midtrans
# folder: backend (terminal 3)
npm run demo:pay            # tanpa tunnel: npm run demo:pay -- --sync
```

Buka tautan yang dicetak, bayar lewat simulator Midtrans. Hasil yang benar: status order berubah ke `paid` dan 1 tiket `pending_mint` muncul.

## Catatan keamanan

- `backend/.env` berisi API key dan private key, sudah diabaikan oleh `.gitignore`.
- Gunakan akun MetaMask khusus testnet dan key Midtrans sandbox (diawali `SB-`).
- Webhook Midtrans diverifikasi dengan signature (Signature Secret Key), nominal dicek, dan tiap notifikasi diproses sekali.

## Smart contract di Sepolia

- Alamat contract: `ISI-SETELAH-DEPLOY`
- Etherscan: https://sepolia.etherscan.io/address/ISI-SETELAH-DEPLOY

## Tim

- Khansa Firyal Adila (245150700111029)
- Aurelia Callysta Mamahit (245150700111024)
- Gede Raditya Dharma Putra Ayudia (245150700111028)
- Zeva Wyakta Zaylendra (245150700111033)

Dosen pengampu: Hariz Farisi, S.Kom., M.T.
