# Tangkapan layar tahap 3 · Usaha Pintar

Diambil dari build produksi (`vite preview` di 4173, `dist/` dari integrator), Bojonegoro, seed default. Jam dunia dijeda pukul 07.00. Pantau Merek dan TenderPilot tetap menampilkan ikon jeda (jam berjalan) karena keduanya punya autoplay sendiri. Desktop 1440×900 menampilkan panduan "Coba ini" terbuka; ponsel 390×844 (DPR 2) dengan panduan dilipat. Keadaan "wow" diambil di 1440 ID dengan panduan ditutup. Skrip: `.shots/t3-int/shots.mjs`. Saat pengambilan tidak ada error konsol atau error halaman.

## Toko Autopilot
- `toko-autopilot-1440-id-pemilik-toko.png`: Dasbor, peran Pemilik Toko. Cacat: label "Mulai di sini: 1 transaksi QRIS" menimpa tepi atas kartu KPI, dan titik hotspot menempel di bawah baris tab.
- `toko-autopilot-390-id-pemilik-toko.png`: ponsel. Cacat: titik hotspot menutupi teks URL ("id/toko"), label "Mulai di sini" menutupi pemilih outlet "Semua", teks delta KPI terpotong ("vs kemarin ja…"), dan tab "Jadwal Shift" tidak terlihat (tab bisa digulir).
- `toko-autopilot-1440-en-pemilik-toko.png`: English, Dasbor. Rapi. Cacat kecil: "1 items" (bentuk jamak tidak tepat).
- `toko-autopilot-1440-id-kasir.png`: peran Kasir (Lestari Rahayu), kasir di bingkai tablet. Area kosong besar di bawah bingkai, dan grid barang terpotong di dalam tablet (digulir di dalam).
- `toko-autopilot-wow-qris-struk.png`: struk QRIS setelah membayar, ditambah toast C14 "diteruskan ke Pajak Beres". **Cacat data:** total struk Rp 24.000, tetapi toast menulis "Jurnal: Penjualan TR-0212 (Rp 43.600)". Selain itu nama toko tercetak dua kali di kepala struk, dan baris "2 × Rp 12.000" terpecah ke dua baris.
- `toko-autopilot-wow-banjir.png`: setelah "Putar skenario banjir", kartu daerah menampilkan "+340%" dan kebutuhan pemda 2.000 karung pasir. Draf PO naik menjadi 4. Rapi.

## Pajak Beres
- `pajak-beres-1440-id-pemilik-toko.png`: Dokumen, nota kusut, dan jurnal hari ini. Cacat: teks tombol "Proses nota" kontrasnya rendah di atas peach, titik hotspot menempel di tepi panel, tombol "Tanya Pajak" tampak seperti tab yang terpotong di tepi bingkai, dan nama jurnal terpecah di kolom sempit ("Penjualan TR-/0209").
- `pajak-beres-390-id-pemilik-toko.png`: ponsel. KPI ditampilkan sebagai strip geser (kartu ketiga terpotong di kanan) dan tab terpotong ("PPh 2…"). Bingkai tombol "Tanya" menumpuk dengan tepi bilah URL.
- `pajak-beres-1440-en-pemilik-toko.png`: English. Cacat sama dengan versi ID: kontras rendah "Process receipt" dan tombol "Ask Tax" terpotong.
- `pajak-beres-1440-id-konsultan-pajak.png`: peran Konsultan Pajak, tab Jurnal, 3 saran AI "Perlu tinjauan", plus tombol "Klien" dan "Kunci periode Oktober". Rapi.
- `pajak-beres-wow-nota-jurnal.png`: nota diproses. Kotak OCR bernomor 1–11 tampil, langkah "Meluruskan foto…Menjurnal" tercentang, dan jurnal Nota PO-0009 Rp 876.600 muncul di atas daftar. Rapi.

## Juara Jualan
- `juara-jualan-1440-id-supervisor-sales.png`: Percakapan, detail skor 46, dan gelombang rekaman. Cacat: cincin hotspot menimpa sudut tombol "Tugaskan coaching", dan label hotspot menutupi tombol "Putar suara".
- `juara-jualan-390-id-supervisor-sales.png`: ponsel. Cacat: label "Ketuk untuk membuka momen merah" menutupi skor dan nama pelanggan di kartu teratas, dan tab terpotong (Latihan hanya tampil ikonnya).
- `juara-jualan-1440-en-supervisor-sales.png`: English. Label hotspot menutupi "Play voice" dan teks di sebelahnya. Transkrip ID dan terjemahan EN ditampilkan bertumpuk (disengaja).
- `juara-jualan-1440-id-agen-sales.png`: peran Agen Sales (Lestari, #3 dari 3). Keadaan kosong "Belum ada kartu coaching" sudah benar sebelum supervisor menugaskan, tetapi separuh bawah layar kosong.
- `juara-jualan-wow-momen.png`: setelah klik penanda merah, rekaman meloncat ke 00:16 dan bagian yang sudah diputar diwarnai. Rapi.

## Kenal Mitra
- `kenal-mitra-1440-id-analis-kyc.png`: Antrian (KYC 2, KYB 5, CV 1) dan pratinjau etalase Katalog Lokal. Rapi.
- `kenal-mitra-390-id-analis-kyc.png`: ponsel, tab KYC/KYB/CV dipendekkan, chip filter. Rapi.
- `kenal-mitra-1440-en-analis-kyc.png`: English. Rapi.
- `kenal-mitra-1440-id-bank-mitra.png`: peran Bank/Koperasi Mitra, "Minta KYC nasabah baru" dan "Permintaan saya". Rapi. Tombol nonaktif "Minta KYC" diberi alasan "Sudah ada permintaan terbuka".
- `kenal-mitra-wow-kyc-ekstraksi.png`: KYC Joko Prasetyo pukul 07.01. HP nasabah menampilkan "Tuntas 5/5", KTP SPESIMEN dengan 17 kotak, dan hasil ekstraksi dengan tingkat keyakinan. Cacat: nomor penanda 13–15 menggantung di bawah kartu KTP sampai ke tepi panel.
- `kenal-mitra-wow-kyc-keputusan.png`: daftar pemeriksaan, skor risiko 18 "Setujui", Saran AI: Setujui, dan "Kirim keputusan". Cacat: kolom kiri kosong lebar saat digulir. Teks "10 dasar + 8 isian beda" membingungkan. Cek "Alamat formulir = KTP" gagal (RT/RW 002/004 vs 001/004), tetapi saran tetap Setujui. Ini mungkin disengaja, tetapi tidak dijelaskan.

## Pantau Merek
- `pantau-merek-1440-id-brand-manager.png`: Pantauan, skor 53/100, grafik 24 jam, dan Sinyal awal. Cacat kecil: titik hotspot menimpa teks "(biasanya 0,5)".
- `pantau-merek-390-id-brand-manager.png`: ponsel. Titik hotspot menimpa teks aturan lonjakan, dan label "Mulai di sini" duduk di garis tepi kartu.
- `pantau-merek-1440-en-brand-manager.png`: English. Cacat kecil: "Short-post s…" dan "Map reviews" terpotong di bawah lipatan.
- `pantau-merek-1440-id-pemilik-toko.png`: peran Pemilik Toko, ringkasan "Masalah utama hari ini" dan "Belum ada pesanan yang terdampak banjir". Rapi.
- `pantau-merek-wow-lonjakan.png`: lonjakan pukul 07.12 dengan 6 keluhan dikelompokkan menjadi 3 pola. Ada tautan "Lihat PO di Toko Autopilot" (+340%) dan "Sarankan pengumuman". Catatan: satu kutipan berbahasa Inggris ada di tampilan ID (sebutan asli @proyek.34, disengaja). Kelompok "Telat 1–3 hari ke Kec. Bojonegoro/Trucuk" memuat kutipan tentang Pacul dan Banjarsari.

## TenderPilot (satu peran: Vendor)
- `tenderpilot-1440-id-vendor.png`: Umpan, Detail T486 53%, dan Syarat 6/7. Cacat: hotspot "Mulai di sini" (pukul 07.00 banner darurat belum ada) melayang di sela kolom, dan labelnya menutupi "peluang 45%" pada kartu T566.
- `tenderpilot-390-id-vendor.png`: ponsel, tab Umpan. Cacat sama: label "Mulai di sini" menutupi "peluang 45%", dan titik hotspot menempel di tepi kanan layar.
- `tenderpilot-1440-en-vendor.png`: English. Cacat sama, label "Start here" menutupi "45% chance".
- `tenderpilot-390-en-vendor.png`: ponsel English, pengganti peran alternatif karena produk ini hanya punya peran Vendor. Cacat sama dengan 390 ID.
- `tenderpilot-wow-tender-darurat.png`: pukul 07.08 banjir memunculkan banner "Tender baru cocok: Karung Pasir & Terpal (darurat) · peluang 78%". KPI naik (+3) dan T766 Baru/Darurat tampil di urutan teratas. Rapi.
- `tenderpilot-wow-dokumen.png`: dokumen penawaran 34/34 halaman, 7 bagian, dan Surat Penawaran AI Rp 35.800.000 dengan terbilang. Rapi.
