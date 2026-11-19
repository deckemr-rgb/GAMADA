# Tangkapan layar tahap 4 · Pasar Daerah + GAMADA Inti

Semua gambar diambil dari build produksi (`vite preview` di port 4173, `dist/` dari integrator) untuk Bojonegoro dengan seed default. Jam dunia dijeda pukul 07.00. Di desktop (1440×900) panduan "Coba ini" dibiarkan terbuka. Di ponsel (390×844, DPR 2) panduan dilipat. Semua keadaan "wow" diambil di 1440 ID dengan panduan ditutup, sehingga isi melebar. Gambar disimpan sebagai PNG palet (sharp, maksimal 115 KB). Skrip: `.shots/t4-int/shots.mjs`. Selama pengambilan tidak ada error konsol maupun error halaman.

## Katalog Lokal
- `katalog-lokal-1440-id-ukpbj.png`: Sisi Pemda, berisi composer dan tiga contoh, serta HP UMKM di tengah. Cacat: label "Mulai di sini" menutupi teks contoh kedua, padahal panduan menyebut contoh pertama. Panel kanan kosong ("Belum ada kebutuhan terbuka"). Jam "07:00" di HP menempel ke notch.
- `katalog-lokal-390-id-ukpbj.png`: di ponsel, empat KPI disusun vertikal dan memenuhi satu layar penuh. Label "Mulai di sini" menimpa tepi kotak teks.
- `katalog-lokal-1440-en-ukpbj.png`: versi English. Cacatnya sama dengan versi ID: label "Start here" menutupi contoh kedua.
- `katalog-lokal-1440-id-pemilik-toko.png`: Sisi UMKM, menampilkan etalase toko contoh, lencana Terverifikasi / Pajak Rapi: Belum / Skor 710, dan HP berisi pesanan masuk kosong. Rapi.
- `katalog-lokal-wow-pencocokan.png`: contoh darurat sudah diterbitkan (KB-0005), HPS acuan Rp 37.750.000, dan papan pencocokan "4 dari 5 UMKM terverifikasi cocok". Angka toast C21/C26 ("HPS Rp 37.750.000 · Kec. Trucuk") sama dengan angka di layar. Toast menutupi bagian bawah composer, dan muncul pita "Jam dunia berhenti" karena jam dijeda.
- `katalog-lokal-wow-bandingkan.png`: drawer pembanding dua penawaran (710 vs 832). Totalnya cocok dengan hitungan manual: 14.699×2.000 + 128.026×50 = Rp 35.799.300, dan 14.600×2.000 + 117.100×50 = Rp 35.055.000. Cacat kecil: "Usulan bagi pesanan" hanya menyebut karung pasir, sementara terpal (stok Santoso 37 < 50) tidak disebut.

## Rapor Usaha
- `rapor-usaha-1440-id-pemilik-toko.png`: dial 710 "Baik", −40 vs Okt, "Data masuk hari ini" 14 transaksi Rp 448.000, dan waterfall faktor. Hotspot `ru-fix` ada di bawah lipatan, jadi tidak terlihat di layar pertama.
- `rapor-usaha-390-id-pemilik-toko.png`: di ponsel, tombol "Tanya skor" hanya tampil sebagai ikon di bilah URL. Chip transaksi terpotong ("06.5…") karena strip bisa digeser.
- `rapor-usaha-1440-en-pemilik-toko.png`: versi English. Cacat: bahasa bercampur pada "Bojonegoro toko bangunan median".
- `rapor-usaha-1440-id-bank-mitra.png`: peran Bank/Koperasi Mitra, antrian 3 pengajuan (692 / 551 / 843) dengan rekomendasi. Separuh bawah layar kosong.
- `rapor-usaha-wow-skor-naik.png`: setelah "Rapikan 3 jurnal", skor naik ke 740 (−10 vs Okt) dan faktor pajak berubah dari −78 ke −48 poin (+30). Cacat kecil: keterangan "Skor sekarang 740 (+10)" hanya menunjukkan langkah terakhir, bukan total +30.
- `rapor-usaha-wow-pinjaman-disetujui.png`: drawer koperasi menampilkan Rp 100.000.000, 12 bulan, 1%/bln, cicilan Rp 9.334.000, dan cap DISETUJUI. Toast C38 "Jurnal: Pencairan … (Rp 100.000.000)" sama dengan angka di layar. Plafonnya 100 jt, bukan 150 jt, karena `tax.ready` tidak dipicu dalam skrip ini.

## Indeks Ekonomi Daerah
- `indeks-ekonomi-1440-id-bappeda.png`: tab Peta menampilkan indeks 100,2 dan peringkat kecamatan. **Cacat:** peta masih "Memuat peta…" setelah 3,5 dtk, sehingga yang tampil hanya bentuk SVG tanpa basemap dan label.
- `indeks-ekonomi-390-id-bappeda.png`: di ponsel, KPI tampil 2×2 dan tab muat. Peta masih "Memuat citra peta…". Hotspot `ie-play` di bawah lipatan.
- `indeks-ekonomi-1440-en-bappeda.png`: versi English, dan di sini peta sudah termuat lengkap dengan label dan arsiran kecamatan tersembunyi. Cacat: "only 1 businesses" (bentuk jamak salah).
- `indeks-ekonomi-1440-id-kepala-daerah.png`: tab Ringkasan berisi penurunan terbesar Sukosewu −4,4, kenaikan terbesar Gayam +5,7, dan efek program −6,0%. Peta juga masih "Memuat peta…".
- `indeks-ekonomi-wow-banjir.png`: setelah time-lapse 12 bulan dan skenario banjir, ada 4 kecamatan merah, dan chip delta di daftar sama dengan baris "Kejadian ekonomi" (Bojonegoro 84,1 −7,2; Kalitidu 76,7 −6,7; Kanor 90,7 −6,9; Trucuk 91,7 −8,2). **Cacat data:** label scrubber tetap "November 2026, indeks 100,2", padahal KPI kabupaten setelah banjir menjadi 99,2 (lihat gambar dampak).
- `indeks-ekonomi-wow-dampak.png`: tab Dampak untuk operasi pasar beras Banjarejo: efek −6%, selisih-ganda −4,5%, dan kurva "Pasar operasi vs Pasar lain". Angkanya sama dengan Ringkasan Kepala Daerah. Cacat kecil: format "−6%" di sini berbeda dengan "−6,0%" di Ringkasan, dan jarak label sumbu X tidak rata.

## Sinyal Pasar
- `sinyal-pasar-1440-id-disperindag.png`: ticker, KPI (9 komoditas, 14 pasar), papan harga, dan kartu kejadian/peringatan/anomali dalam keadaan kosong. Cacat: titik hotspot menutupi kata "(simulasi)". Item pertama ticker terpotong di kiri (marquee).
- `sinyal-pasar-390-id-disperindag.png`: di ponsel, cacatnya sama: titik hotspot menutupi "(simulasi)".
- `sinyal-pasar-1440-en-disperindag.png`: versi English. Titik hotspot menutupi "(simulated)".
- `sinyal-pasar-1440-id-pemilik-toko.png`: HP "Sinyal Pasar untuk UMKM" dan daftar "Bahan yang Anda pakai". **Cacat data:** tokonya Toko Bangunan Mulyo Agung Sentosa, tetapi daftar bahannya sembako (gula, daging sapi, telur, cabai), dengan judul "Stok bahan warung".
- `sinyal-pasar-wow-anomali.png`: 5 menit setelah banjir ada 2 anomali dan 2 peringatan dini. Baris cabai rawit Pasar Kota Bojonegoro berlabel "Anomali". Toast peringatan beras +10,4% sama dengan kartu. **Cacat data:** toast anomali cabai menulis "+8,2% di atas pola", sedangkan baris yang sama di layar menunjukkan +20,0% (toast dibuat saat anomali muncul dan tidak diperbarui). Toast juga menutupi kolom kiri papan harga.
- `sinyal-pasar-wow-prediksi.png`: drawer detail menampilkan Rp 66.000, +20,0% vs pola (Rp 55.000, cocok), +23,4% 7 hari (sama dengan papan), dan prakiraan 14 hari dengan puncak +19,1%. Cacat kecil: chip penyebab "Pola musiman +0,2%" dan "Banjir +18,5%" berjumlah 18,7, bukan 20,0. "Indeks omzet Kec. Bojonegoro −7,2%" ditulis sebagai persen, padahal di Indeks Ekonomi angka itu poin indeks.

## GAMADA Inti
- `inti-1440-id-kepala-daerah.png`: Inti Data menampilkan pulse 36/14/0 = 50 kejadian (sama dengan KPI) dan jejak data "0 dari 6". Cacat: label "Mulai di sini: putar jejak data" menutupi teks keterangan di bawah tombol.
- `inti-390-id-kepala-daerah.png`: di ponsel, pulse berupa tiga lingkaran. Tab "Inti Kanal" terpotong (bisa digeser).
- `inti-1440-en-kepala-daerah.png`: versi English. Cacatnya sama: label "Start here" menutupi teks.
- `inti-1440-id-pemilik-toko.png`: cakupan pemilik toko menampilkan 14 kejadian dan 4 pesan, 5 jalur "tidak tampil", serta banner pembatasan akses. Cacat: panduan langkah 1 tetap menyuruh memutar jejak Ibu Siti, padahal jejak itu tersembunyi untuk peran ini.
- `inti-wow-jejak-data.png`: jejak lengkap 6 dari 6 (SW-2026-0142 → peringatan → instruksi → ND-SR-0025/2026 → paket pompa → kebutuhan Katalog Lokal) dengan cabang ke produk lain. KPI menunjukkan 116 kejadian = 51+48+17 (sama). Beberapa teks jalur dipotong dengan elipsis.
- `inti-wow-agen.png`: jejak berpikir "Tangani banjir Kec. Trucuk": intent rencana_banjir 86%, 5 alat dengan durasi, data, dan jawaban Sim. **Cacat:** riwayat permintaan memakai jam dinding ("17.38"), bukan jam dunia 07.00. Bagian DATA hanya berisi "plan", dan teks jawaban berada di bawah lipatan.
