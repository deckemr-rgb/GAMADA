# Tangkapan layar tahap 1

Diambil 2026-11-17 dari dev server (`http://127.0.0.1:5173`, `?off=preloader`) dengan Playwright (Chrome). Ukuran: desktop 1440×900 (DPR 1) dan mobile 390×844 (emulasi mobile + sentuh, DPR 2). Halaman panjang diambil full-page, dipotong maksimal 3200 px CSS. Peta memakai ubin OpenFreeMap asli (tanpa `?maptiles=off`). PNG dikompresi palet (sharp) supaya total ~7 MB.

| File | Isi |
| --- | --- |
| `kit-ui-1440.png` | `/lab/_kit?only=ui` desktop: KPI, tabel tiket, papan kanban, kotak pesan + log alur, kontrol kecil |
| `kit-ui-390.png` | `/lab/_kit?only=ui` mobile: KPI bertumpuk, tabel berubah jadi kartu |
| `kit-frames-1440.png` | `?only=frames` desktop: bingkai browser, ponsel, tablet POS, layar dinding, surat & laporan kertas |
| `kit-frames-390.png` | `?only=frames` mobile: bingkai yang sama dalam satu kolom |
| `kit-viz-1440.png` | `?only=viz` desktop: grafik garis, batang, divergen, donat, gauge, radar, sankey, heatmap, jaringan, bubble, format angka |
| `kit-viz-390.png` | `?only=viz` mobile: grafik dalam satu kolom |
| `kit-world-1440.png` | `?only=world` desktop: jam dunia, picu kejadian, log audit, efek lintas produk, jumlah entitas |
| `kit-world-390.png` | `?only=world` mobile: panel dunia simulasi bertumpuk |
| `kit-ai-1440.png` | `?only=ai` desktop: chat Sapa Warga (simulasi), inspektur pencocok intent, jejak jawaban |
| `kit-ai-390.png` | `?only=ai` mobile: chat + hasil terstruktur + inspektur |
| `kit-region-1440.png` | `?only=region` desktop: peta 28 kecamatan Bojonegoro, statistik BPS, PDRB, harga dasar, template aduan Basa Jawa |
| `kit-region-390.png` | `?only=region` mobile: region pack satu kolom |
| `kit-map-1440.png` | `?only=map` desktop: MapLibre + choropleth, radar hujan, pasar, panel lapisan, legenda, daftar kecamatan |
| `kit-map-390.png` | `?only=map` mobile: peta, slider waktu prediksi, lapisan, legenda |
| `kit-docs-1440.png` | `?only=docs` desktop: penampil surat miring, KTP spesimen, nota kusut |
| `kit-docs-390.png` | `?only=docs` mobile: tiga penampil dokumen bertumpuk |
| `kit-media-1440.png` | `?only=media` desktop: perekam suara, notulen rapat berwaveform, penanda momen panggilan, TTS |
| `kit-media-390.png` | `?only=media` mobile: modul suara & media satu kolom |
| `kit-shell-1440.png` | `?only=shell` desktop: DemoShell lengkap dalam wadah (TopBar penuh, panduan terbuka otomatis) |
| `kit-shell-390.png` | `?only=shell` mobile: DemoShell dengan TopBar ringkas (nama + ⋯) |
| `kit-shell-guide-open-1440.png` | GuidePanel "Coba ini" terbuka di samping kanvas (desktop) |
| `kit-shell-guide-open-390.png` | GuidePanel terbuka sebagai lembar bawah (mobile, dibuka lewat ⋯ → Coba ini) |
| `kit-shell-more-sheet-390.png` | Lembar ⋯ (Kontrol demo) di shell non-interim: wilayah, peran, jam dunia, mode AI, bahasa |
| `demo-sapa-warga-1440.png` | `/demo/sapa-warga` desktop: shell interim + placeholder "sedang dibangun" |
| `demo-sapa-warga-390.png` | `/demo/sapa-warga` mobile: placeholder satu kolom |
| `demo-sapa-warga-en-1440.png` | `/demo/sapa-warga?lang=en` desktop: placeholder versi Inggris |
| `demo-sapa-warga-en-390.png` | `/demo/sapa-warga?lang=en` mobile: placeholder versi Inggris |
| `demo-sapa-warga-palette-1440.png` | Palet perintah (Ctrl+K) terbuka di atas demo Sapa Warga (desktop) |
| `demo-sapa-warga-palette-390.png` | Palet perintah (Ctrl+K) terbuka di mobile |
| `demo-sapa-warga-more-sheet-390.png` | Lembar ⋯ di demo interim Sapa Warga (tanpa peran/jam) |
| `demo-siaga-wilayah-kepala-daerah-0915-1440.png` | `/demo/siaga-wilayah?role=kepala-daerah&t=09:15` desktop: peran Kepala Daerah tersorot |
| `demo-siaga-wilayah-kepala-daerah-0915-390.png` | URL yang sama di mobile |
| `demo-siaga-wilayah-more-sheet-390.png` | Lembar ⋯ di demo interim Siaga Wilayah |
| `demo-indeks-ekonomi-1440.png` | `/demo/indeks-ekonomi` desktop: nama produk terpanjang di TopBar |
| `demo-indeks-ekonomi-390.png` | `/demo/indeks-ekonomi` mobile: nama terpanjang muat di TopBar ringkas |
| `ekosistem-1440.png` | `/ekosistem` desktop: hero, empat ekosistem, kartu 17 produk |
| `ekosistem-390.png` | `/ekosistem` mobile |
| `ekosistem-en-1440.png` | `/ekosistem?lang=en` desktop |
| `ekosistem-en-390.png` | `/ekosistem?lang=en` mobile |
| `ekosistem-satu-daerah-1440.png` | `/ekosistem/satu-daerah` desktop: 7 produk, alur bab tur, ekosistem lain |
| `ekosistem-satu-daerah-390.png` | `/ekosistem/satu-daerah` mobile |
| `produk-sapa-warga-1440.png` | `/produk/sapa-warga` desktop: untuk siapa, tentang demo, produk terhubung, muncul di tur, CTA |
| `produk-sapa-warga-390.png` | `/produk/sapa-warga` mobile |
| `tur-1440.png` | `/tur` desktop: daftar 20 bab "Satu Hari di Bojonegoro" |
| `tur-390.png` | `/tur` mobile |
| `lab-1440.png` | `/lab` desktop: filter ekosistem/status/waktu + 20 kartu demo |
| `lab-390.png` | `/lab` mobile |
| `karya-1440.png` | `/karya` desktop: portofolio sementara + kartu "KasirKu → Toko Autopilot", "ScrapPulse → Radar Isu" |
| `karya-390.png` | `/karya` mobile |
| `demo-siaga-wilayah-preview-1440.png` | Baru: panel pratinjau interim "Yang akan bisa Anda coba" (`/demo/siaga-wilayah?role=kepala-daerah&t=09:15`), desktop, kanvas penuh |
| `demo-siaga-wilayah-preview-390.png` | Baru: panel pratinjau yang sama di mobile (sentuh, DPR 2) |
| `demo-siaga-wilayah-preview-en-1440.png` | Baru: panel pratinjau versi Inggris "What you will be able to try", desktop |
| `demo-siaga-wilayah-preview-en-390.png` | Baru: panel pratinjau versi Inggris di mobile |

## Status cacat (diambil ulang 2026-11-17, setelah putaran perbaikan tahap 1)

Semua 49 file di atas diambil ulang dengan nama yang sama (skrip `.shots/qa-int/run.mjs`), lalu dilihat satu per satu. 0 error konsol, 0 scroll horizontal. Dua tangkapan mobile yang bergantung pada emulasi sentuh, `kit-docs-390` dan `kit-map-390`, sekarang tangkapan viewport (390×2200 dan 390×1400), bukan full-page, karena screenshot full-page Playwright mematikan emulasi sentuh (`pointer: coarse` jadi `fine`). Tangkapan 390 tahap 1 sebelumnya karenanya menampilkan keadaan desktop.

| # | Cacat | Status | Bukti di tangkapan baru |
| --- | --- | --- | --- |
| 1 | Tombol WhatsApp melayang menutupi isi | **Beres** | Tidak ada lagi di `/lab/_kit` dan `/demo/*` (`kit-ui-1440`, `kit-viz-1440`, `kit-world-1440`, `kit-map-1440`, `kit-docs-390`, `kit-shell-guide-open-390`). Di halaman pemasaran tombol memudar saat footer terlihat (`karya-1440` bawah) dan di ponsel ukurannya 48 px di pojok 12/14 px (`tur-390`). Saat menggulir, tombol masih melayang di tepi kanan kolom teks; itu pola yang disengaja. |
| 2 | Label bubble chart keluar dari gelembung / bertumpuk | **Beres** | `kit-viz-1440`: "Pupuk subsidi" di luar sebelah kiri, "Beasiswa" dan "Lampu jalan" muat di dalam, tidak ada gelembung yang menimpa label. |
| 3 | Label graf jaringan bertabrakan | **Beres** | `kit-viz-1440`: "PT Arta Teknik Mandiri" di kiri simpulnya, "Paket jalan Kalitidu" di bawah kanan; tidak bertumpuk. |
| 4 | Judul chat AI terpotong, JSON jejak terpotong tanpa elipsis | **Beres** | `kit-ai-1440`: "Sapa Warga" + "Skenario uji · 8 intent · ID, EN, Basa Jawa" utuh; baris jejak berakhir "…". `kit-ai-390`: judul membungkus jadi dua baris, tidak terpotong. |
| 5 | Nama POS terpotong dan tertimpa badge | **Beres** | `kit-frames-1440`: "Paku 5 cm (1 kg)" utuh, badge jumlah di samping harga, chip kategori berfungsi. Tablet 16:10, sisa ruang kosong di bawah grid tinggal sedikit. |
| 6 | Dua cincin fokus di palet perintah | **Beres** | `demo-sapa-warga-palette-1440/390`: satu cincin membulat. |
| 7 | Panel ekstraksi "Pilih dokumen…" padahal dokumen tampil; petunjuk Ctrl di ponsel | **Beres** | `kit-docs-390`: "Tekan “Baca surat” untuk mulai membaca.", "Tekan “Verifikasi dokumen”…", petunjuk "Cubit untuk zoom · seret untuk geser". |
| 8 | Peta mobile tergeser di bawah kolom tombol, pasar menumpuk | **Beres** | `kit-map-390` (sentuh): wilayah utuh di kiri kolom tombol (hanya Beranda + Layar penuh di sentuh), pasar berdekatan jadi lencana hitung 4 / 2 / 4. |
| 9 | Panduan mobile menyebut "bilah atas" | **Beres** | `kit-shell-guide-open-390`: langkah 3 "Menu ⋯ di kanan atas → Peran". |
| 10 | Teks tembus di header situs yang tergulir | **Beres** | `kit-shell-guide-open-390`: header pekat, tidak ada teks di belakang logo. |
| 11 | Ruang kosong ~120 px antara subjudul hero dan CTA | **Beres** | `ekosistem-satu-daerah-1440`: CTA langsung di bawah subjudul (±36 px); begitu juga `ekosistem`, `produk-sapa-warga`, `tur`, `lab`, `karya`. |
| 12 | Panah menempel ke teks tautan | **Beres** | "← Semua ekosistem", "Lihat Toko Autopilot →", "Lihat Radar Isu →" berjarak 6 px. |
| 13 | `/karya` "6 Demo Web Live" dengan 5 chip; footer ScrapPulse | **Beres** | `karya-1440/390`: "5 Demo Web Live" + 5 chip, "4 Demo Aplikasi Mobile" + 4 chip; footer "ScrapPulse → Radar Isu". Halaman `/karya` sendiri masih stub fase 1 (di luar lingkup). |
| 14 | KPI dunia "Peringatan aktif 0" vs "Peringatan 1"; header audit | **Beres** | `kit-world-1440`: "Peringatan aktif 0 · dari 1 tercatat", petak "Peringatan (semua) 1", header "50 baris = 50 riwayat seed + 0 event baru sejak seed · 14 terbaru ditampilkan". |
| 15 | `?t=09:15` tidak terlihat di placeholder | **Beres** | `demo-siaga-wilayah-kepala-daerah-0915-*` dan `demo-siaga-wilayah-preview-*`: jam 09:15 WIB + "Tautan ini membuka pukul 09.15". Lembar ⋯ interim (`demo-siaga-wilayah-more-sheet-390`) sengaja hanya berisi kontrol yang bekerja; peran dan jam dijelaskan di panel pratinjau. |
| 16 | Inisial peran Indonesia di `?lang=en` | **Beres** | `demo-sapa-warga-en-1440/390`: CT Citizen, SO Service Officer, RH Regional Head. |
| 17 | Placeholder pencarian tiket terpotong | **Beres** | `kit-ui-1440`: "Cari tiket, kecamatan, OPD…" utuh. |

Catatan kecil baru (bukan regresi): subjudul palet perintah masih "Ketik nama produk, peran, jam, atau wilayah" di demo interim, padahal item peran/jam disembunyikan di sana.
