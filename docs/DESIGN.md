# DESIGN.md: sistem desain TiketAman

Berkas ini menjelaskan tampilan TiketAman supaya konsisten di Stitch, Figma, dan kode (`frontend/src/styles.css`).
Arah visual mengikuti referensi "Air Ticket Booking": kertas krem, ungu, huruf serif, garis bingkai tebal,
kartu lengkung gelap, bilah pencari berbentuk pil, dan garis putus-putus seperti sobekan tiket.

## Produk dan pengguna
TiketAman adalah marketplace tiket event kampus. Tiap tiket adalah token di blockchain, harga jual ulang dibatasi 110%,
satu akun maksimal 4 tiket, dan tiket hanya bisa dipakai sekali. Pengguna: mahasiswa pembeli, mahasiswa pemilik tiket
yang ingin menjual ulang, panitia event (BEM, UKM, promotor lokal), dan petugas pintu masuk.
Bahasa antarmuka: Indonesia, kalimat biasa (sentence case), kata kerja langsung seperti "Beli tiket", "Terbitkan", "Pindai tiket".

## Warna
| Nama | Hex | Pemakaian |
|---|---|---|
| Kertas | #FFFCF0 | Latar halaman |
| Kartu | #FFFEF9 | Permukaan kartu, bilah pencari, panel |
| Tinta | #262626 | Teks, garis bingkai, border formulir |
| Tinta lembut | #5C584D | Teks pendukung |
| Arang | #303030 | Kartu lengkung gelap, bulatan sobekan |
| Ungu | #8C6AE6 | Judul besar dan hiasan (hanya untuk teks besar) |
| Ungu dalam | #6F4FCB | Tombol, tautan, harga, teks kecil berwarna |
| Ungu pucat | #C2AEFA | Angka dan penanda di atas latar arang |
| Hijau | #2F7D5B | Sukses, tiket sah |
| Merah | #B3402F | Galat, tiket ditolak |
| Kuning tua | #8A5D0F | Menunggu |
Teks kecil berwarna selalu memakai Ungu dalam atau warna status, bukan Ungu terang (kontras kurang).

## Huruf
- Judul dan angka: **Fraunces** (serif kontras tinggi), bobot 400, judul hero ukuran sangat besar berwarna ungu.
- Teks bacaan: **Newsreader** (serif), ukuran 17px, tinggi baris 1,65.
- Semua huruf serif, termasuk navigasi dan tombol. Tidak memakai huruf kapital semua untuk label.
- Harga selalu memakai format rupiah Indonesia, contoh Rp75.000.

## Bentuk dan struktur
- **Bingkai halaman:** garis vertikal tebal (3px) di kiri dan garis horizontal di bawah navigasi, membentuk kerangka seperti referensi.
  Di sisi kiri ada tautan luar yang ditulis tegak, dibaca dari bawah ke atas.
- **Navigasi:** logo bintang empat sudut dalam kotak bergaris, nama "TiketAman", tautan halaman, dan tombol Masuk di dalam
  tanda kurung berbentuk jajar genjang (garis atas, miring ke kiri bawah, garis bawah).
- **Hero:** deretan jam, tanggal, dan jaringan ("Sepolia") dengan angka besar dan keterangan kecil. Di bawahnya
  "Tiket event kampus" berukuran besar dan kata "Anti-calo" sangat besar berwarna ungu.
- **Bilah pencari pil:** tiga bagian dipisah garis tegak tebal: Event, Jumlah, dan tautan ungu bergaris bawah "Beli sekarang".
  Sudut sangat membulat, bayangan lembut keunguan.
- **Bulatan dan kartu lengkung:** lingkaran bergambar langit senja bergradasi biru hijau ke oranye dengan siluet tiket,
  dikelilingi teks melengkung "Tiket asli, harga wajar, tanpa calo". Di bawahnya kartu arang berbentuk lengkung
  (sudut atas bulat penuh, kiri bawah bulat, kanan bawah siku) berjudul "Segera berlangsung" dengan daftar event:
  harga ungu pucat dan nama event, dipisah garis tipis di kiri.
- **Pemisah sobekan tiket:** garis putus-putus tebal selebar halaman dengan bulatan arang separuh di tepi kanan.
- **Kartu tiket:** persegi panjang membulat dengan takik setengah lingkaran di atas dan bawah garis sobekan.
  Kiri: tanggal (angka ungu dalam) atau nomor token. Tengah: nama event, lokasi, aturan. Kanan: harga, sisa tiket, tombol.
- **Tombol:** pil penuh ungu dalam dengan teks putih untuk aksi utama; tautan teks ungu bergaris bawah untuk aksi kedua.
- **Label status (chip):** pil kecil dengan border dan latar muda: Valid (hijau), Sedang dicetak (kuning), Dijual (ungu), Sudah dipakai (abu).
- **Pemberitahuan:** kotak membulat berborder 2px dengan warna sesuai nada (info ungu, sukses hijau, galat merah).
- **Formulir:** kolom putih dengan border tinta 2px, sudut 12px, label tebal di atas, teks bantu kecil di bawah.
- **Pelacak pembayaran:** kotak berborder putus-putus ungu berlatar ungu sangat muda.
- **Hasil pindai:** blok besar hijau ("Tiket sah, silakan masuk") atau merah ("Tiket ditolak") dengan sudut kanan bawah siku.

## Layar
Beranda, detail event dan pembelian, masuk dan daftar, tiket saya (dengan QR berputar dan form jual ulang),
resale (pasar tiket bekas), pesanan saya, panitia (buat dan terbitkan event), pindai tiket (petugas pintu masuk).

## Sebaiknya dan sebaiknya tidak
- Pertahankan satu elemen yang paling mencolok per layar (judul ungu di hero, kartu lengkung gelap di detail event).
- Jangan memakai gradasi sebagai hiasan di luar bulatan hero, jangan memakai bayangan berbeda-beda, jangan menyeragamkan semua sudut.
- Jangan menambah huruf kapital semua, nomor urut hiasan, atau tanda panah di tombol.
- Teks status harus jelas: sebut apa yang terjadi dan apa langkah berikutnya, galat tidak meminta maaf dan tidak samar.
- Responsif sampai lebar ponsel: bingkai dan tautan tegak di kiri disembunyikan, menu menjadi tombol "Menu".
