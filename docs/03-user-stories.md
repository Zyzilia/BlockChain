# User Stories dan Kriteria Penerimaan

| ID | Sebagai | Saya ingin | Kriteria penerimaan | Tahap |
|---|---|---|---|---|
| US-01 | Pembeli | mendaftar dengan email kampus dan NIM | Email dan NIM (ter-hash) unik; wallet custodial dibuat otomatis | 3 |
| US-02 | Pembeli | melihat daftar event | Menampilkan nama, tanggal, harga, sisa kuota | 3 |
| US-03 | Pembeli | membeli maksimal 4 tiket per event | Pembelian ke-5 ditolak backend dan kontrak | 3, 5 |
| US-04 | Pembeli | membayar lewat VA, QRIS, atau e-wallet | Snap muncul; status order berubah setelah webhook | 4 |
| US-05 | Pembeli | menerima tiket otomatis setelah bayar | Token ter-mint, tx hash tampil, bisa dicek di explorer | 5 |
| US-06 | Pembeli | menjual ulang tiket | Harga di atas 110% nominal ditolak | 6 |
| US-07 | Pembeli | menampilkan QR berputar | QR berganti tiap 60 detik | 6 |
| US-08 | Panitia | membuat event dengan harga, kuota, batas resale | Konfigurasi terkunci on-chain, tidak bisa diubah | 2, 3 |
| US-09 | Panitia | check-in tiket lewat scan QR | Tiket sah lolos, pemakaian kedua ditolak | 6 |
| US-10 | Panitia | melihat laporan penjualan dan rekonsiliasi | Order, pembayaran, dan token cocok | 7 |
| US-11 | Sistem | menolak webhook palsu atau ganda | Signature salah ditolak; notifikasi ganda diabaikan | 4 |
