# TiketAman (Prototipe)

Platform tiket event anti-calo: tiket = token ERC-721 di Sepolia testnet, bayar rupiah lewat Midtrans Sandbox.
Proyek kuliah Teknologi Blockchain dan Platform Keuangan Digital (hanya sandbox/testnet, data dummy).

## Struktur
- `contracts/`  Smart contract Solidity + Hardhat (Tahap 2)
- `backend/`    API Express + SQLite + integrasi Midtrans (Tahap 3-6)
- `frontend/`   React + Vite (Tahap 7)
- `docs/`       Arsitektur, ERD, user stories, log ide, pernyataan AI

## Prasyarat
- Node.js 20 LTS atau lebih baru (`node -v`)
- Git (`git --version`)

## Setup cepat (Tahap 1)
```bash
git init
cd backend
npm install
cp .env.example .env     # Windows PowerShell: copy .env.example .env
npm run db:init          # membuat database SQLite dari db/schema.sql
npm run dev              # server di http://localhost:3000
# cek: buka http://localhost:3000/health
```

## Tahap pengerjaan
1. Fondasi dan arsitektur  (selesai)
2. Smart contract + test + deploy Sepolia  (selesai)
3. Backend: auth, event, order
4. Midtrans sandbox + webhook
5. Webhook -> mint token
6. Resale + check-in QR
7. Frontend, dokumentasi, demo
