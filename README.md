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
| `backend/` | API Express, database SQLite, integrasi Midtrans |
| `frontend/` | Tampilan web (React) |
| `docs/` | Arsitektur, ERD, user stories, jurnal, pernyataan AI |

## Status pengerjaan
| Tahap | Isi | Status |
|---|---|---|
| 1 | Kerangka proyek, database, dokumentasi | Selesai |
| 2 | Smart contract, test, deploy Sepolia | Selesai |
| 3 | Backend: auth, event, order | Belum |
| 4 | Midtrans sandbox dan webhook | Belum |
| 5 | Pembayaran memicu mint token | Belum |
| 6 | Resale dan check-in QR | Belum |
| 7 | Frontend dan persiapan demo | Belum |

## Kebutuhan
- Node.js 20 atau lebih baru
- Git
- Akun gratis: Alchemy (RPC Sepolia), Midtrans Sandbox
- Wallet MetaMask khusus testnet dengan SepoliaETH dari faucet

## Cara menjalankan

**Backend**
```bash
cd backend
npm install
cp .env.example .env      # Windows: copy .env.example .env
# isi nilai di .env (jangan commit file ini)
npm run db:init
npm run dev
```
Cek di http://localhost:3000/health

**Smart contract**
```bash
cd contracts
npm install
npm test                  # 20 test, berjalan lokal tanpa ETH
npm run deploy:sepolia    # butuh RPC_URL dan PLATFORM_PRIVATE_KEY di backend/.env
npm run demo:sepolia      # butuh CONTRACT_ADDRESS juga
```

## Smart contract di Sepolia
- Alamat contract: `ISI-SETELAH-DEPLOY`
- Etherscan: https://sepolia.etherscan.io/address/ISI-SETELAH-DEPLOY

## Catatan keamanan
- `backend/.env` berisi API key dan private key, sudah diabaikan oleh `.gitignore`.
- Gunakan akun MetaMask khusus testnet, bukan wallet utama.

## Tim
- Khansa Firyal Adila (245150700111029)
- Aurelia Callysta Mamahit (245150700111024)
- Gede Raditya Dharma Putra Ayudia (245150700111028)
- Zeva Wyakta Zaylendra (245150700111033)

Dosen pengampu: Hariz Farisi, S.Kom., M.T.
