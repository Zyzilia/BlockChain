# Dokumentasi API

Base URL lokal: `http://localhost:3000`. Body dan respons berformat JSON. Endpoint bertanda (auth) butuh header `Authorization: Bearer <token>`.
Format error: `{ "error": "pesan" }`. Dokumen ini ditambah di setiap tahap.

## Auth
| Method | Path | Akses | Fungsi |
|---|---|---|---|
| POST | /api/auth/register | publik | Daftar akun, wallet custodial dibuat otomatis |
| POST | /api/auth/login | publik | Login, mengembalikan token (berlaku 7 hari) |
| GET | /api/auth/me | auth | Data akun dan alamat wallet |

**Register** body: `name`, `email` (harus berakhiran `ALLOWED_EMAIL_SUFFIX`), `nim` (8-20 digit), `password` (min. 8), `role` (`buyer` atau `organizer`, default `buyer`).
Respons 201: `{ token, user: { id, name, email, role, walletAddress, createdAt } }`.
Kode: 400 input tidak valid, 409 email atau NIM sudah terdaftar, 429 terlalu banyak percobaan (30/menit per IP).
NIM disimpan sebagai HMAC-SHA256, password sebagai hash bcrypt, private key wallet terenkripsi AES-256-GCM.

## Event
| Method | Path | Akses | Fungsi |
|---|---|---|---|
| GET | /api/events | publik | Daftar event terbit, dengan sisa tiket (`available`) |
| GET | /api/events/:id | publik | Detail event terbit |
| GET | /api/events/mine | organizer | Semua event milik penyelenggara (termasuk draft) |
| POST | /api/events | organizer | Buat event (status draft) |
| POST | /api/events/:id/publish | organizer | Terbitkan: konfigurasi dikunci di smart contract |

**Buat event** body: `name`, `venue` (opsional), `eventDate` (ISO, masa depan), `faceValueIdr`, `capacity`, `maxPerUser` (default 4, 1-10), `maxResaleBps` (default 11000 = 110%, 10000-20000).
**Publish** memanggil `createEvent` di contract dan mengembalikan `onchainEventId`, `createTxHash`, `createTxUrl`. Kode: 409 sudah terbit, 502 transaksi blockchain gagal, 503 blockchain belum dikonfigurasi.

## Order
| Method | Path | Akses | Fungsi |
|---|---|---|---|
| POST | /api/orders | buyer | Buat order (status pending) |
| GET | /api/orders | auth | Riwayat order milik sendiri |
| GET | /api/orders/:id | auth | Detail satu order milik sendiri |

**Buat order** body: `{ eventId, quantity }`. Biaya layanan Rp5.000 per tiket (nominal sampai Rp100.000) atau 5% di atas itu.
Contoh: 2 tiket Rp75.000 -> `faceTotalIdr` 150000, `serviceFeeIdr` 10000, `totalIdr` 160000.
Order pending menahan kuota selama 30 menit (`expiresAt`). Kode: 409 melebihi batas per akun atau tiket tidak cukup, 429 lebih dari 10 order per menit.
Pembayaran Midtrans ditambahkan di Tahap 4.

## Lainnya
| Method | Path | Fungsi |
|---|---|---|
| GET | /health | Cek server dan jumlah tabel database |
