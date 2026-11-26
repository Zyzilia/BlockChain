# Desain di Google Stitch lalu Figma

## Yang perlu diunggah ke Stitch
Stitch menerima **teks (prompt) dan gambar** (screenshot, sketsa, wireframe), bukan berkas kode. Jadi dari proyek ini yang dipakai:

| Bahan | Dari mana | Dipakai untuk |
|---|---|---|
| Screenshot referensi "Air Ticket Booking" | Gambar yang kamu pilih | Diunggah sebagai gambar acuan gaya |
| `docs/DESIGN.md` | Repo | Palet, huruf, bentuk. Bila Stitch punya tempat mengimpor DESIGN.md, pakai itu. Bila tidak, salin isinya ke kolom prompt |
| Prompt per layar di bawah | Dokumen ini | Satu prompt untuk satu layar |
| Screenshot halaman yang sedang berjalan | `npm run dev` di folder `frontend` | Opsional: unggah sebagai gambar agar Stitch merapikan tampilan yang sudah jadi |

Kode di `frontend/src` tidak perlu diunggah. Jika ingin menyamakan, cukup minta Stitch mengikuti warna dan huruf di `DESIGN.md`.

## Langkah
1. Buka stitch.withgoogle.com dan masuk dengan akun Google. Pilih mode desain web (desktop).
2. Unggah screenshot referensi, lalu tempel **prompt dasar** di bawah dan buat layar pertama (Beranda).
3. Buat layar lain satu per satu dengan prompt masing-masing. Perbaiki lewat chat (misalnya "buat bayangan lebih lembut").
4. Pilih semua layar, lalu ekspor. Menurut pengumuman resmi Stitch ada opsi **paste ke Figma** dan ekspor kode front-end; versi lain menampilkan ekspor HTML dan Tailwind atau arsip. Pakai yang tersedia di versimu.
5. Di Figma, rapikan dan simpan. Simpan juga hasil ekspor gambar atau PDF ke `docs/design/` di repo dan tulis tautan Figma di `docs/06-jurnal-tahap.md`.
6. Kalau opsi paste ke Figma tidak ada, tempel screenshot hasil Stitch ke Figma sebagai referensi dan susun ulang di sana.

Tampilan Stitch bisa berubah, jadi nama tombol bisa berbeda. Hasilnya adalah bahan dokumentasi desain. Aplikasi yang berjalan memakai kode di `frontend/`.

## Prompt dasar (tempel lebih dulu)
```
Design a responsive web app called "TiketAman", an anti-scalper event ticket marketplace for university students in Indonesia.
Follow the uploaded reference image closely: warm cream paper background (#FFFCF0), a huge violet display word (#8C6AE6),
high-contrast serif typography (Fraunces for headings and numbers, Newsreader for body text), thick 3px dark frame lines
on the left and under the navigation, a pill-shaped search bar with thick vertical dividers, a dark charcoal (#303030) arch-shaped
card under a circular illustration with curved text around it, and a thick dashed ticket-perforation divider with a half dark circle
on the right edge. Buttons are solid deep violet (#6F4FCB) pills with white text. All UI text is in Indonesian, sentence case.
Prices use Indonesian format (Rp75.000). Tone: clear, plain, trustworthy. Keep it responsive down to mobile.
```

## Prompt per layar
**1. Beranda**
```
Home page. Top navigation: a square logo with a four-point star, wordmark "TiketAman", links "Beranda", "Resale", "Tiket saya",
and a "Masuk" button inside a parallelogram bracket. Left rail with vertical links "GitHub", "Etherscan", "Midtrans".
Hero: three small clock-style stats (time "07:17" with caption "Waktu sekarang", day "25" with caption "11.2026", "Sepolia" with caption "Jaringan uji"),
then "Tiket event kampus" in large black serif and "Anti-calo" in a huge violet serif word, a short paragraph explaining
110% resale cap, 4 tickets per account, single-use tickets, then the pill search bar with "Event", "Jumlah", and "Beli sekarang".
Right side: circular sunset illustration with a ticket silhouette, curved text "Tiket asli, harga wajar, tanpa calo", and a dark arch card
"Segera berlangsung" listing two events with violet prices. Below: dashed perforation divider and the section "Event yang sedang dijual"
with ticket-shaped cards (date stub, event name, venue, resale cap, price, "Tersisa 42", "Beli tiket" button).
```
**2. Detail event dan pembelian**
```
Event detail page. Back link "Kembali ke daftar event", large event title "Konser Kampus Brawijaya", date line in violet,
venue and organizer. A white rounded panel "Beli tiket" with a quantity stepper, price summary
("2 x tiket Rp75.000", "Biaya layanan Rp10.000", "Total bayar Rp160.000"), a solid violet button "Beli dan bayar", and a small note about Midtrans sandbox.
On the right a tall dark charcoal arch card "Aturan anti-calo" with three rules: "Rp82.500" highest resale price, "4 tiket" per account limit,
"1 kali" single-use ticket, plus a link "Lihat buktinya di Etherscan".
Below the panel show a payment tracker box with dashed violet border: "Pesanan nomor 27", chip "Menunggu pembayaran", link "Buka halaman pembayaran".
```
**3. Masuk dan daftar**
```
Two small centered forms in a rounded white panel on the cream page. "Masuk": email kampus, password, button "Masuk", link "Daftar di sini".
"Daftar": nama lengkap, email kampus (helper "Harus email kampus berakhiran .ac.id"), NIM (helper "Hanya disimpan dalam bentuk hash"),
password, select "Daftar sebagai" (Pembeli, Penyelenggara untuk demo), button "Daftar".
```
**4. Tiket saya**
```
"Tiket saya" page with ticket-shaped cards. Each card: stub with token number "#17", event name, date, status chip
(Valid green, Sedang dicetak amber, Dijual violet, Sudah dipakai gray), link "Bukti pencetakan di Etherscan", and actions:
solid button "Tampilkan QR", text links "Jual ulang", "Verifikasi di blockchain". One card expanded with the resale form:
price input, helper "Batas tertinggi Rp82.500, dikunci di smart contract", breakdown ("Komisi platform 5% -Rp4.125",
"Bagian penyelenggara -Rp3.750", "Kamu menerima Rp74.625"), button "Pasang untuk dijual".
Also a modal: QR code in a bordered white square, text "QR berganti dalam 42 detik", warning not to share, buttons "Salin kode QR" and "Tutup".
```
**5. Resale**
```
"Resale" page with intro "Tiket dari pemilik yang berhalangan hadir. Harganya tidak bisa melebihi batas yang dikunci di smart contract."
Ticket-shaped cards with a token stub "#17", event name, date, small text with nominal price, resale cap and service fee,
violet price "Rp82.500", "Total Rp87.500", and button "Beli tiket". Include an empty state: "Belum ada tiket yang dijual ulang."
```
**6. Panitia**
```
Organizer dashboard "Panitia" with intro about locking price, quota and resale cap in the smart contract when published.
Two columns: left a white form "Event baru" (nama, lokasi, tanggal dan jam, harga tiket, jumlah tiket, maksimal tiket per akun, batas harga jual ulang dalam persen,
button "Simpan sebagai draft"); right list "Event saya" with rows: event name, date, price, "12 dari 100 terjual", chip (Terbit green, Draft amber),
button "Terbitkan" or link "Lihat halaman", link "Bukti di Etherscan".
```
**7. Pindai tiket**
```
Gate scanner page for event staff, "Pindai tiket". A white panel with a camera preview area, button "Buka kamera", and a textarea "Kode QR" with button "Periksa tiket".
Two result states shown as large blocks with the bottom-right corner square: green "Tiket sah, silakan masuk" with holder name, event, "token #17",
"Gerbang menjawab dalam 4 ms"; red "Tiket ditolak" with message "Tiket sudah dipakai".
```
**8. Pesanan saya**
```
"Pesanan saya" list rows separated by dashed lines: event name, "2 tiket, pesanan nomor 27", price in serif, status chip
(Menunggu pembayaran, Dibayar, Gagal, Kedaluwarsa), and text link "Lanjut bayar" for open orders.
```
