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

### Pembayaran (Tahap 4)
| Method | Path | Akses | Fungsi |
|---|---|---|---|
| POST | /api/orders/:id/pay | auth | Buat transaksi Snap di Midtrans sandbox, mengembalikan `{ payment: { token, redirectUrl } }`. Dipanggil ulang akan mengembalikan token yang sama |
| POST | /api/orders/:id/sync | auth | Cadangan bila webhook tidak sampai: tanya status ke Midtrans lalu perbarui order |
| POST | /api/payments/notification | publik (signature) | Webhook Midtrans |
| GET | /api/tickets | auth | Tiket milik sendiri. `status`: `pending_mint` (menunggu dicetak), `valid` (token sudah ada), `listed`, `used` |
| GET | /api/tickets/:id/onchain | auth | Baca token langsung dari blockchain: `onchainOwner`, `ownerMatches` (sama dengan wallet pembeli), `used`, `nftUrl` |

Kode `/pay`: 409 order bukan pending atau sudah kedaluwarsa, 502 Midtrans menolak, 503 key Midtrans belum diisi.

**Webhook** (`/api/payments/notification`)
- Signature diverifikasi: `SHA512(order_id + status_code + gross_amount + SignatureSecretKey)`. Sejak 28 Okt 2026 kuncinya adalah Signature Secret Key (`MIDTRANS_SIGNATURE_SECRET_KEY`), terpisah dari Server Key. Bila tidak diisi, Server Key dipakai (akun lama). `MIDTRANS_SIGNATURE_SECRET_KEY_OLD` boleh diisi sementara saat rotasi kunci. Salah -> 403 dan dicatat untuk audit.
- Idempotency: kunci `(order_id, transaction_status)`, notifikasi yang sama diproses sekali (`result: "duplicate"`).
- Nominal `gross_amount` harus sama dengan total order, jika tidak -> `amount_mismatch` dan order tidak berubah.
- Status order hanya berubah dari `pending`, jadi notifikasi terlambat tidak merusak order yang sudah `paid`.

| transaction_status dari Midtrans | Status order |
|---|---|
| settlement, atau capture dengan fraud_status accept (status_code 200) | `paid`, tiket dibuat |
| pending | tetap `pending` (metode bayar dicatat) |
| expire | `expired` |
| deny, cancel, failure | `failed` |
| refund, partial_refund, chargeback (dari `paid`) | `refunded` |

**Pencetakan token (Tahap 5).** Saat order menjadi `paid`, webhook langsung dibalas 200 dan pencetakan berjalan di latar belakang (10-30 detik per tiket):
1. Baris tiket dibuat dengan status `pending_mint`.
2. Server memanggil `mintTicket(eventId, walletPembeli)` di smart contract. Semua transaksi platform masuk antrean serial supaya nonce tidak bentrok.
3. Hasilnya `tokenId` dan `mintTxHash` disimpan, status tiket menjadi `valid`.
- Hash transaksi disimpan sebelum menunggu konfirmasi. Bila server mati di tengah jalan, penyapu (tiap 20 detik) memeriksa transaksi itu dulu (`mined`, `pending`, atau `hilang`) sehingga tiket tidak tercetak dua kali.
- Gagal (RPC bermasalah, saldo gas habis) dicoba ulang dengan jeda bertambah (maksimal 5 menit), tiket tetap `pending_mint`.

Order `failed` dan `expired` tidak lagi menahan kuota 4 tiket per akun maupun kapasitas event.

## Lainnya
| Method | Path | Fungsi |
|---|---|---|
| GET | /health | Cek server dan jumlah tabel database |
