# Jurnal Pengerjaan per Tahap

Isi singkat setelah tiap tahap selesai, pakai bahasa sendiri. Bagian bertanda `___` diisi tim.

## Tahap 1: Fondasi dan arsitektur

- **Tanggal:** ___
- **Dikerjakan oleh:** ___
- **Tujuan:** Struktur repo, skema database, diagram arsitektur dan ERD, user stories.
- **File utama:** README.md, backend/db/schema.sql, backend/src/*, docs/*
- **Cara cek berhasil:** npm run db:init lalu buka /health, harus muncul status ok
- **Hasil:** ___ (berhasil / sebagian / belum)
- **Kendala dan cara mengatasinya:** ___
- **Yang kami pelajari:** ___
- **Bagian yang dibantu AI dan cara kami memeriksanya:** ___
- **Commit terkait:** ___

---

## Tahap 2: Smart contract

- **Tanggal:** ___
- **Dikerjakan oleh:** ___
- **Tujuan:** Contract ERC-721 TiketAman, unit test, deploy ke Sepolia.
- **File utama:** contracts/contracts/TiketAman.sol, contracts/test/*, contracts/scripts/deploy.js
- **Cara cek berhasil:** npx hardhat test, lalu cek alamat contract di Sepolia Etherscan
- **Hasil:** ___ (berhasil / sebagian / belum)
- **Kendala dan cara mengatasinya:** ___
- **Yang kami pelajari:** ___
- **Bagian yang dibantu AI dan cara kami memeriksanya:** ___
- **Commit terkait:** ___

---

## Tahap 3: Backend: auth, event, order

- **Tanggal:** ___
- **Dikerjakan oleh:** ___
- **Tujuan:** Registrasi/login, kelola event, buat order.
- **File utama:** backend/src/routes/*, backend/src/middleware/*
- **Cara cek berhasil:** tes endpoint pakai Postman/Thunder Client
- **Hasil:** ___ (berhasil / sebagian / belum)
- **Kendala dan cara mengatasinya:** ___
- **Yang kami pelajari:** ___
- **Bagian yang dibantu AI dan cara kami memeriksanya:** ___
- **Commit terkait:** ___

---

## Tahap 4: Midtrans sandbox dan webhook

- **Tanggal:** ___
- **Dikerjakan oleh:** ___
- **Tujuan:** Checkout Snap, verifikasi signature, idempotency.
- **File utama:** backend/src/routes/payments.js, backend/src/services/midtrans.js
- **Cara cek berhasil:** bayar di sandbox: sukses, gagal, kedaluwarsa
- **Hasil:** ___ (berhasil / sebagian / belum)
- **Kendala dan cara mengatasinya:** ___
- **Yang kami pelajari:** ___
- **Bagian yang dibantu AI dan cara kami memeriksanya:** ___
- **Commit terkait:** ___

---

## Tahap 5: Integrasi bayar ke blockchain

- **Tanggal:** ___
- **Dikerjakan oleh:** ___
- **Tujuan:** Webhook sukses memicu mint token ke wallet pembeli.
- **File utama:** backend/src/services/blockchain.js, backend/src/services/wallet.js
- **Cara cek berhasil:** bayar di sandbox, cek token muncul di Etherscan
- **Hasil:** ___ (berhasil / sebagian / belum)
- **Kendala dan cara mengatasinya:** ___
- **Yang kami pelajari:** ___
- **Bagian yang dibantu AI dan cara kami memeriksanya:** ___
- **Commit terkait:** ___

---

## Tahap 6: Resale dan check-in

- **Tanggal:** ___
- **Dikerjakan oleh:** ___
- **Tujuan:** Listing resale berbatas harga, QR berputar, check-in.
- **File utama:** backend/src/routes/resale.js, backend/src/routes/checkin.js
- **Cara cek berhasil:** coba resale di atas 110% (harus ditolak), check-in dua kali (kedua ditolak)
- **Hasil:** ___ (berhasil / sebagian / belum)
- **Kendala dan cara mengatasinya:** ___
- **Yang kami pelajari:** ___
- **Bagian yang dibantu AI dan cara kami memeriksanya:** ___
- **Commit terkait:** ___

---

## Tahap 7: Frontend dan persiapan demo

- **Tanggal:** ___
- **Dikerjakan oleh:** ___
- **Tujuan:** UI, skenario demo, video, slide.
- **File utama:** frontend/*, docs/*
- **Cara cek berhasil:** jalankan skenario demo dari awal sampai akhir
- **Hasil:** ___ (berhasil / sebagian / belum)
- **Kendala dan cara mengatasinya:** ___
- **Yang kami pelajari:** ___
- **Bagian yang dibantu AI dan cara kami memeriksanya:** ___
- **Commit terkait:** ___

---
