# Rencana induk Tahap 9–16

Disusun 20 Nov 2026 dari spesifikasi `docs/PROMPT-VSCODE-TAHAP9-16.md` (versi otoritatif) dan 6 scout baca-saja atas kode di HEAD `4dfcea1`. Tahap 8 masih berjalan di working tree (56 entri belum di-commit), jadi semua nomor baris di bawah perlu dicek ulang setelah commit Tahap 8.

Isi dokumen:
- A. Ringkasan
- B. Tabel per tahap (9–16)
- C. Lini waktu
- D. Pertanyaan untuk pemilik, sebaiknya dijawab SEKARANG
- E. Tabel keputusan sumber Radar Isu Live (draf)
- F. Daftar pendek penyedia suara (TTS)
- G. Hasil cek pointer spesifikasi
- H. Yang terlewat di spesifikasi
- I. Disk
- J. Konflik aturan dan ukuran workflow

---

## A. Ringkasan

| | Angka |
|---|---|
| Jam agen murni (termasuk gerbang), tanpa tunggu pemilik | 97–131 jam, titik tengah ±112 jam (±4,7 hari nonstop) |
| Kalender, skenario dasar | mulai Jum 20 Nov 17.00, selesai Jum 27 Nov ±16.00 |
| Kalender, skenario lambat | Rab 2 – Jum 4 Des |
| Disk C: kosong sekarang | ±490 MB (berfluktuasi 470–640 MB) |
| Disk minimum untuk mulai | 3 GB; spesifikasi meminta ≥ 10 GB |
| Penghambat mulai Tahap 9 | (1) disk, (2) commit Tahap 8, (3) ukuran workflow |

---

## B. Tabel per tahap

Catatan umum:
- Jam gerbang mencakup build, batas ukuran, perf, e2e, a11y dan screenshot.
- Satu e2e penuh: ±677 tes, 45–60 menit dengan 2 worker. Setelah T14 jumlahnya naik menjadi ±800–900 tes, 60–75 menit.
- Jam agen sudah memperhitungkan agen paralel serta verifikasi adversarial dan kritik kelengkapan per tahap, sesuai §11.

### Tahap 9: Audit holistik (baca dan ukur saja)
| Item | Isi |
|---|---|
| Isi | Audit konsultan dengan 9 lensa, 18 produk + situs + tur, panel 4 persona, verifikasi 2 skeptis, kritik kelengkapan. Hasilnya `docs/build/tahap9-audit.md`. Rinciannya ada di `docs/build/tahap9-plan.md`. |
| Sub-bagian | WF0 persiapan (0,3 j). WF1 pengukuran dan pustaka screenshot (1 agen, serial). WF2 finder (9 agen). WF3 verifikasi dan persona (9 agen). WF4 celah dan penulisan (3–4 agen). |
| Jam agen | 4,3–6,3 j |
| Jam gerbang | 2–2,5 j: build, preview 4173, perf ×3, INP, batas ukuran ID/EN, axe, LCP/CLS, ±180 screenshot. Tidak perlu e2e penuh. |
| Total | 6,5–9 j (tengah 8 j) |
| Tunggu pemilik | Sebelum mulai: disk, commit T8, ukuran workflow. Di akhir: persetujuan backlog dan urutan tahap ("lanjut tahap 10"). |
| Disk | Puncak 0,4–0,6 GB. Repo bertambah ±30–35 MB screenshot. |
| Risiko utama | Skor persona seragam karena semua persona dijalankan model yang sama. Angka perf/INP tercemar bila Chrome lain jalan bersamaan. Port 4173 bisa masih dipakai preview T8. Disk penuh di tengah jalan. |

### Tahap 10: Hapus Karya, rapikan IA, bersihkan nama lama
| Item | Isi |
|---|---|
| Isi | §5. Hapus 3 rute, `work.ts`, `docs/products/*.md` (15 file) dan `_placeholder` (dimajukan dari T13). Siapkan 9 redirect, Navbar/Footer, kunci i18n ID+EN, copy home (Why, Services, Portfolio, testimoni), Lab, isi `/faq`, `/proses`. Perbarui tes dan tambah tes redirect serta crawl DOM nama lama. |
| Sub-bagian | Lajur A rute/nav/footer/sitemap/hapus file (1 j). Lajur B i18n/copy/FAQ pengganti/home/Lab (1,5 j). Lajur C tes dan skrip gerbang (1 j). `/faq` 0,5 j. `/proses` 0,2 j (dikeluarkan) atau 1 j (diisi). |
| Jam agen | 3,5–4,5 j, termasuk verifikasi dan kritik 1 j serta perbaikan 0,5 j |
| Jam gerbang | 1,5–2 j: typecheck, build, batas ukuran 0,4 j; e2e terarah ±120 tes 0,4 j; e2e penuh 0,75–1 j; perf ×3 0,2 j |
| Total | 5–7,5 j (tengah 6 j) |
| Tunggu pemilik | Tidak ada yang memblokir bila pertanyaan T10 di §D dijawab lebih dulu. Default dipakai bila belum dijawab. |
| Disk | Bersih negatif (−0,25 MB). Puncak 0,3–0,5 GB. |
| Risiko utama | Gerbang grep peka huruf besar-kecil sehingga bisa lolos palsu ("Sedang dibangun", "Now part of", "Kini bagian dari"). `copy.check.ts` mewajibkan 4–6 FAQ, jadi FAQ nama lama harus diganti, bukan dihapus. `en.ts`/`eco.ts` bertipe `typeof id`, jadi hapus kunci ID dan EN bersamaan. Grid footer berubah dari 5 ke 4 kolom. |

### Tahap 11: Radar Isu, model data dan tampilan detail
| Item | Isi |
|---|---|
| Isi | §6. Mention diperluas (field opsional, diturunkan di modul khusus radar), Story, HoaxAlert.sourcePosts/factChecks, SourceStatus. Panel baru: tabel sumber, kartu pratinjau, rincian platform, linimasa, cek fakta, choropleth, kesehatan sumber. Tab Analisis per platform, ekspor dengan URL. Skema AI diubah serempak di 4 tempat. Pantau Merek ikut memakai komponen sumber. |
| Sub-bagian | Tipe dan lapisan sim plus generator Story (2,5 j). Panel UI dalam 3 lajur (3 j). Deep/Report/ekspor (1,5 j). Skema serempak (1 j). Pantau Merek (1 j). ID/EN dan e2e (1,5 j). Sebagian tumpang tindih. |
| Jam agen | 7–8 j, ditambah verifikasi dan kritik 1,5 j |
| Jam gerbang | ±3 j: build dan batas ukuran dua kali (iterasi pemecahan lazy), e2e radar, e2e penuh sekali |
| Total | 11–13 j (tengah 12 j) |
| Tunggu pemilik | Tidak ada di tengah tahap. Di akhir: "lanjut tahap 12". |
| Disk | Puncak 1–1,5 GB. Repo +20–30 MB screenshot. |
| Risiko utama | Batas ukuran: radar 165,1/166,7 KB, sisa ±8 KB ke target 175. Tab Live dimuat statis, jadi panel baru wajib dimuat saat interaksi. Inti world dipakai semua demo, dan Meja Pimpinan tinggal 1,8 KB dari 180. WORLD.version harus dinaikkan ke 7. |

### Tahap 12: Radar Isu Live
| Item | Isi |
|---|---|
| Isi | §7. Collector di `server/ai-proxy/src/collect/` (khusus Node/Docker) dengan `node:sqlite` bawaan, dedupe URL+simhash, retensi 30 hari, batas biaya per sumber. 12 adapter. Pengayaan AI per Story. SSE `/api/radar/*`. Badge Live/Simulasi, mode presenter, fallback ke Simulasi, hash handle warga, bagian Keamanan & Data (UU PDP). |
| Sub-bagian | Cek ulang tabel sumber (1 j). Inti collector (3 j). 12 adapter paralel (3 j). Pengayaan AI (3 j). Rute/SSE/presenter (2 j). Klien: store, badge, fallback (3,5 j). Etika dan dokumen (1 j). |
| Jam agen | 10–12 j, ditambah verifikasi dan kritik 2 j |
| Jam gerbang | 2,5–3 j: selftest proxy dan `ai:test`, build, batas ukuran, e2e dengan proxy mock, e2e penuh |
| Total | 15–17 j (tengah 16 j) |
| Tunggu pemilik | Persetujuan sumber dan batas biaya harian (jam). Key YouTube/Fact Check/Brave/Anthropic (menit, setelah pemilik bertindak). Review aplikasi Meta dan Reddit (hari sampai minggu); adapter tetap dikirim dengan status "belum live". Tidak memblokir penyelesaian tahap. |
| Disk | Puncak 1–1,5 GB. Fixture < 5 MB. SQLite lokal < 50 MB. |
| Risiko utama | Ketentuan Google News RSS non-komersial. Jalur resmi TikTok/Facebook tertutup untuk komersial. `node:sqlite` masih eksperimental. Long-lived SSE tidak cocok untuk serverless. Biaya token pengayaan. |

### Tahap 13: Semua demo realistis, Mode Cerita, backlog motion
| Item | Isi |
|---|---|
| Isi | §8. Kit Mode Cerita (runner ramping di atas `exec.ts`, lazy; ±0,3 KB tombol eager), 18 `story.ts` ID+EN. Sapa Warga §8.1 (WA-look, rantai tiket, foto) dengan efek berantai ke Siaga/Meja/Radar (perlu ref foto di world). Pipeline foto `sharp` (sudah terpasang) ke AVIF/WebP dengan watermark tertanam. Realisme per produk sesuai audit. Backlog motion. |
| Sub-bagian | 13A kit Mode Cerita (4–6 j). 13B Sapa Warga dan rantai (6–8 j). 13C aset dan foto (3–4 j). 13D per produk ×17 (8–12 j wall dengan 4–6 agen). 13E sisa `_placeholder` bila belum di T10. 13F motion (4–6 j; 10–12 j bila semua 284 timing CSS ditokenkan). 13G rubrik persona dan laporan (2 j). |
| Jam agen | 16–22 j wall, termasuk verifikasi dan kritik ±5 j |
| Jam gerbang | 6–8 j: batas ukuran 18 demo × 4 region, e2e penuh dua kali (satu ronde perbaikan), 18 spec cerita baru, screenshot rubrik |
| Total | 22–30 j (tengah 26 j) |
| Tunggu pemilik | Keputusan sumber foto (ditanyakan sekarang; memblokir foto, bukan kit). Persetujuan akhir dengan gerbang persona rata-rata ≥ 8 dan tidak ada produk < 7. |
| Disk | Puncak 0,6–0,8 GB plus e2e, ±1,5 GB. Repo +12–18 MB aset dan ±40 MB screenshot. Unduhan mentah 50–150 MB sementara. |
| Risiko utama | Batas ukuran Meja Pimpinan. Skrip cerita rapuh terhadap perubahan hook. Lisensi stok (wajah, logo, "bad light"). Foto banjir AI paling mirip deepfake, jadi watermark harus di dalam piksel. Lingkup per produk baru pasti setelah audit T9. |

### Tahap 14: Region pack Provinsi DIY
| Item | Isi |
|---|---|
| Isi | §9. Skema `provinsi`, `kabupaten[]`, `kabupatenId`, kapanewon/kemantren/kalurahan, landmark gunung/bandara/pantai, lapisan lahar. Pipeline HDX/OSM (5 kab/kota, 78 kapanewon/kemantren, ±438 kalurahan/kelurahan). Helper Pemkab/Pemkot/Pemda DIY dan istilah wilayah (±106 file UI). Meja Pimpinan provinsi dengan drill-down (lazy). Lahar di Siaga. Tur DIY dengan pemilih region. Matriks 18 × 4 region. |
| Sub-bagian | A skema/validate/loader (2–3 j). B pipeline dan konten (4–6 j, fetch HDX berjalan di latar). C hardcode dan istilah (2,5 j wall). D UX provinsi (4 j wall). E skenario dan tur (3 j wall). F tes (2–3 j). |
| Jam agen | 9–12 j wall (22–33 jam-agen) |
| Jam gerbang | 4,5–6 j: batas ukuran default dan DIY, verifikasi dan kritik plus perbaikan, matriks region ±150 tes, 2 run tur DIY, e2e penuh ±720 tes, satu siklus perbaikan |
| Total | 14–18 j (tengah 16 j) |
| Tunggu pemilik | ±0 bila pertanyaan T14 dijawab sekarang. Bila belum, penghambat 0,5–1 hari soal batas ukuran pack dan lingkup lahar. |
| Disk | Repo +1–1,5 MB. Cache 15–25 MB (gitignore). Puncak ±0,5 GB plus e2e. |
| Risiko utama | Batas ukuran pack (gzip 16,5/16/24 KB) hampir pasti terlampaui. Id kecamatan bertabrakan ("Jetis" di Bantul dan Kota Yogya). `validate.mjs:86` menolak kode multi-kabupaten. Aturan orang nyata lebih ketat karena Gubernur DIY adalah Sultan. Overpass sering 502. |

### Tahap 15: Dubbing bahasa Indonesia
| Item | Isi |
|---|---|
| Isi | §10. Naskah lisan: tur 2 region × 20, 18 Mode Cerita, Briefing Pagi kanonik, 13 panggilan Juara Jualan. Linter aturan §10.2, leksikon pelafalan, pipeline render per kalimat (cue tepat tanpa alignment), loudnorm −16 LUFS, Opus 48k plus AAC m4a. Sampel 3 suara × 2–3 penyedia. Integrasi: `await:'voice'` di engine, subtitle berwaktu, kontrol, Notes, mode `audio` di `playback.ts`, bus audio (ducking), label "Suara AI". |
| Sub-bagian | 15a naskah, linter, leksikon (3,5–4,5 j). 15b pipeline dan sampel (2,5–3 j). 15c produksi massal dan QA (1,5–2,5 j). 15d integrasi (5–7 j). 15e tes drift, loudness, fallback (1,5–2 j). Verifikasi dan kritik 2,5–3,5 j. |
| Jam agen | 14–19 j |
| Jam gerbang | 2,5–3,5 j |
| Total | 17–22,5 j (tengah ±20 j) |
| Tunggu pemilik | Key penyedia (0–2 hari; minta sekarang). Review sampel oleh pemilik dan 2 penutur asli (1–3 hari). Spot-listen produksi (0,5 hari). |
| Disk | Audio 35–80 MB di `public/` plus salinan di dist. WAV sementara < 200 MB. Puncak 1–1,5 GB dengan build dan e2e. |
| Risiko utama | Briefing dan panggilan dibangkitkan saat runtime (slot seed/region), jadi audio hanya cocok untuk keadaan kanonik. Chromium Playwright tidak bisa memutar AAC. Perubahan bab setelah render berarti render ulang. Model TTS OpenAI berhenti 6 Jan 2027. |

### Tahap 16: QA akhir
| Item | Isi |
|---|---|
| Isi | §12. Gerbang penuh, audit ulang ringkas per ID backlog T9 (berdasarkan simbol, bukan baris), sapuan fitur baru (Live, Cerita, dubbing, DIY), panel persona dengan rubrik dan anchor yang sama, `docs/build/LAPORAN-TAHAP16.md` dengan tabel delta T9 → T16. |
| Sub-bagian | WF1 gerbang (1 agen, 3–3,5 j). WF2 audit ulang dan panel (≤ 9 agen, 2,5–3 j). WF3 putaran perbaikan bersyarat (3,5–6 j). |
| Jam agen | 3–3,5 j |
| Jam gerbang | 3–3,5 j: e2e penuh ±800–900 tes 60–75 menit, LUFS dan drift sampel, grep gerbang §5.2 |
| Total | 6,5–8 j; 10–14 j bila ada satu putaran perbaikan |
| Tunggu pemilik | Persetujuan akhir. Keputusan bila masih ada produk < 7. |
| Disk | Puncak 1–1,5 GB. Repo +±40 MB screenshot. |
| Risiko utama | Gerbang persona bisa mustahil dicapai bila persona non-sasaran ikut dihitung. Di T7, Bupati memberi Toko Autopilot 6,8 dan pemilik toko memberi Meja Pimpinan 6,4. |

---

## C. Lini waktu

Asumsi:
- Tahap 8 sudah di-commit, di-push dan ter-deploy ke GitHub Pages pada Jum 20 Nov ±17.00 WIB.
- Disk sudah dikosongkan sebelum T9.
- Agen bekerja terus 24 jam dan berhenti di akhir tiap tahap.
- Jeda balasan pemilik: ±2 jam bila tahap selesai antara 08.00 dan 21.00 WIB. Bila selesai di luar jam itu, dibalas 08.00 pagi berikutnya, akhir pekan juga.
- Persetujuan T13 butuh +4 jam review.
- Review sampel suara T15 butuh 1 hari.
- Tidak ada putaran perbaikan di T16.

| Tahap | Mulai | Jam agen (tengah) | Agen selesai | Balasan pemilik (asumsi) |
|---|---|---|---|---|
| 9 | Jum 20 Nov 17.00 | 8 | Sab 21 Nov 01.00 | Sab 21 Nov 08.00 |
| 10 | Sab 21 Nov 08.00 | 6 | Sab 21 Nov 14.00 | Sab 21 Nov 16.00 |
| 11 | Sab 21 Nov 16.00 | 12 | Min 22 Nov 04.00 | Min 22 Nov 08.00 |
| 12 | Min 22 Nov 08.00 | 16 | Sen 23 Nov 00.00 | Sen 23 Nov 08.00 |
| 13 | Sen 23 Nov 08.00 | 26 | Sel 24 Nov 10.00 | Sel 24 Nov 14.00 (review 4 j) |
| 14 | Sel 24 Nov 14.00 | 16 | Rab 25 Nov 06.00 | Rab 25 Nov 08.00 |
| 15 | Rab 25 Nov 08.00 | 6 sampel, lalu 7 integrasi sambil menunggu review, lalu 7 produksi | Sampel Rab 14.00; review sampai Kam 26 Nov 14.00; selesai Kam 26 Nov 21.00 | Jum 27 Nov 08.00 |
| 16 | Jum 27 Nov 08.00 | 8 | Jum 27 Nov 16.00 | Persetujuan akhir Jum 27 Nov ±18.00 |

Total jam agen murni ±112 jam (rentang 97–131). Kalender dasar ±7 hari.

| Skenario | Selesai | Syarat |
|---|---|---|
| Cepat | Kam 26 Nov | Sampel suara dibuat dan direview selama T13/T14 (key siap paling lambat Min 22 Nov), balasan cepat, estimasi bawah |
| Dasar | Jum 27 Nov | Asumsi di atas |
| Lambat | Rab 2 – Jum 4 Des | Estimasi atas, balasan pemilik ±24 jam per tahap, review sampel 3 hari, satu putaran perbaikan di T13 dan T16 |

### Yang boleh tumpang tindih saat menunggu pemilik

Pekerjaan ini tanpa ubah kode produk dan perlu izin pemilik karena §11 meminta agen berhenti di akhir tahap.

| Saat menunggu | Pekerjaan persiapan | Hemat |
|---|---|---|
| Akhir T9 | Tulis `tahap10-plan.md` (baca saja). T10 hampir tidak bergantung pada audit karena §5 sudah final, jadi bisa langsung dimulai bila pemilik mengizinkan T9 → T10 tanpa jeda. | 2–7 j |
| T10–T11 | Riset ulang tabel sumber T12 (harga, ketentuan), draf `tahap12-plan.md`. | ±1 j di T12 |
| T11–T12 | Fetch HDX/OSM DIY di latar ke `tools/region/.cache/diy` (gitignore, 15–25 MB, ±1 j jaringan). Kurasi atau pembuatan foto T13 setelah sumber foto diputuskan. | 1–3 j |
| T12–T14 | Sampel suara T15: naskah bab 6 Bojonegoro (teks sudah ada) dan draf bab 6 DIY dari §9.3, render 12–18 klip, halaman pembanding privat. Pemilik dan penutur asli mereview selama T13/T14. Butuh key penyedia. | 1–3 hari kalender |
| T13 | Persetujuan pemilik bisa dilakukan sambil T14 dimulai bila pemilik setuju. | ±4 j |

---

## D. Pertanyaan untuk pemilik, sebaiknya dijawab SEKARANG

Setiap butir menyebut default yang dipakai agen bila belum dijawab, alasannya, dan tahap yang terblokir.

### Sebelum Tahap 9 (memblokir mulai)
| # | Pertanyaan | Default yang diusulkan | Memblokir |
|---|---|---|---|
| 1 | Kosongkan disk C: ke ≥ 10 GB (minimum 3 GB)? Bolehkah agen menghapus `.shots/` (277 MB, gitignore) setelah `.shots/t7-int/budget.mjs` disalin ke `tools/budget.mjs`? | Ya, hapus `.shots/` setelah menyalin. Pemilik tetap mengosongkan sisanya. | T9 (490 MB tidak cukup) dan semua tahap |
| 2 | Commit Tahap 8 oleh pemilik, atau agen boleh meng-commit sebagai "Tahap 8" tanpa `reports/` dan `research_notes/`? | Sudah di-commit, di-push dan di-deploy oleh workflow T8 sebelum T9 dimulai. | T9 |
| 3 | Ukuran workflow: naikkan "Dynamic workflow size" ke large? | Tetap medium (< 10 agen per workflow); T9 dipecah menjadi 4 workflow (lihat §J). | Kecepatan T9, T13, T16 |
| 4 | Bolehkah T9 menambah file alat saja (`tools/budget.mjs`, `tools/lcp.mjs`) walau tahap ini "tanpa ubah kode"? | Ya; kode produk tidak disentuh. | T9 (gerbang batas ukuran dan LCP) |
| 5 | Screenshot di git: ±180 WebP @ ±150 KB (±30 MB per tahap audit)? `docs/shots` sudah 137 MB. | Ya, WebP q80. | T9, T16 |
| 6 | File spesifikasi otoritatif `TAHAP9-16.md`; yang lama `TAHAP9-AUDIT-RADAR-DIY.md` dibiarkan tidak di-commit atau dihapus? | Yang baru otoritatif; yang lama dibiarkan dan tidak di-commit. | Tidak ada |

### Gerbang kelulusan (T13, T16)
| # | Pertanyaan | Default | Alasan |
|---|---|---|---|
| 7 | "Rata-rata ≥ 8, tidak ada produk < 7": dihitung dari semua 4 persona, atau hanya persona sasaran produk? | Persona sasaran menentukan lulus per produk. Rata-rata keseluruhan dari semua persona. Persona non-sasaran dilaporkan tapi tidak menggagalkan. | Tanpa ini gerbang bisa mustahil dicapai. Contoh: Bupati menilai toko online. |
| 8 | Bila masih ada produk < 7, berapa putaran perbaikan dan re-skor? | 1 putaran, lalu pemilik memutuskan. | Mencegah loop tanpa akhir, sesuai preferensi "secukupnya" |

### Tahap 10
| # | Pertanyaan | Default |
|---|---|---|
| 9 | `/proses`: diisi (+1 j) atau dikeluarkan dari navigasi? | Dikeluarkan dari nav dan sitemap, redirect ke `/faq` |
| 10 | Sistem Automasi: dilebur ke Pantau Merek atau dihapus? | Dihapus (T10 menghapusnya dari Karya dalam kedua kasus) |
| 11 | Pantau Merek: cukup perbaiki copy, atau tab Analisis sungguhan? | Copy saja |
| 12 | `docs/products/*.md` (15 file): hapus atau arsip? | Hapus; tetap ada di riwayat git |
| 13 | "Juga: website & aplikasi custom" dan link GitHub di footer: masih ditawarkan? | Tetap; tautan ke konsultasi WA, GitHub pindah ke baris bawah footer |
| 14 | Angka Why kedua (webDemos/mobileApps/caseStudies) diganti angka ekosistem (19 bab tur, 3–4 wilayah, jumlah peran)? Label testimoni dibingkai ulang? | Ya |
| 15 | `/panel/phonefarm` diarahkan ke `/ekosistem` atau 404? | `/ekosistem` |
| 16 | `<title>` "GAMADA — Taman Alam" dan meta "Studio software…" ditulis ulang ke posisi ekosistem? | Ya |
| 17 | Data kontak `site.ts` yang masih TODO (nomor WA, email, badan usaha, domain gamada.id)? | Placeholder tetap dan dicatat; wajib terisi paling lambat T16 |

### Tahap 12 (Radar Isu Live)
| # | Pertanyaan | Default |
|---|---|---|
| 18 | Lokasi collector: `server/ai-proxy/src/collect/` khusus Node/Docker dengan `node:sqlite` (tanpa npm install). Mode Live mati di deploy serverless. | Ya |
| 19 | Google News RSS walau ketentuannya non-komersial? | Mati; pakai GDELT dan RSS penerbit, link-out saja |
| 20 | Buat key Google Cloud gratis (YouTube Data API v3 dan Fact Check Tools)? | Diminta; tanpa key, adapter "belum live" |
| 21 | Pencarian web berbayar: Brave ($5 per 1.000 request, kredit $5/bulan gratis) atau SerpApi ($25–75/bulan)? | Brave, batas $10/bulan |
| 22 | Mulai review aplikasi Meta (Threads `threads_keyword_search`, Instagram Business yang tertaut ke Page) dan pengajuan Reddit Data API sekarang? Butuh hari sampai minggu. | Ya, ajukan sekarang |
| 23 | X pay-per-use (±$0,005 per post dibaca) dengan batas bulanan? | Tidak dulu |
| 24 | Penyedia pihak ketiga (Apify TikTok ±$3 per 1.000 hasil plus paket $19–29)? | Tidak; butuh persetujuan tertulis atas risiko ToS |
| 25 | Batas biaya harian: total Radar, per sumber, dan batas token Claude untuk pengayaan? | $2/hari total; 500 ribu token/hari terpisah dari `AI_DAILY_TOKEN_BUDGET` |
| 26 | Hosting collector (VPS/Docker + Caddy?) dan penerima token presenter? | Tetap lokal/Docker; token hanya untuk pemilik |
| 27 | `ANTHROPIC_API_KEY` tersedia untuk uji pengayaan Live? | Mode mock saja |

### Tahap 13
| # | Pertanyaan | Default |
|---|---|---|
| 28 | Sumber foto: stok (Unsplash/Pexels), AI berlabel, milik sendiri, atau campuran? | Campuran: AI berlabel "ilustrasi AI" untuk bukti banjir/warga (cocok region), stok untuk pasar/toko. Semua dengan watermark SIMULASI di dalam gambar, tanpa wajah dan tanpa logo. |
| 29 | Bila AI: generator mana? Konektor Canva tersedia di lingkungan ini. Pastikan ketentuan komersial paket pemilik. | Canva |
| 30 | Kedalaman sapuan motion: tokenkan semua 284 timing CSS (+6 j) atau kit dan demo yang disentuh saja? | Kit dan demo yang disentuh |
| 31 | Mode Cerita: ditawarkan otomatis pada kunjungan pertama, atau tombol saja? Cerita mereset sandbox atau melanjutkan? | Tombol plus `?cerita=1`; cerita mulai dari snapshot bersih dan memulihkan keadaan pengunjung saat selesai |
| 32 | Dokumen spesimen tetap vektor dengan tampilan pindaian (kotak ekstraksi AI tetap presisi)? | Ya |
| 33 | Briefing dan panggilan sampai T15: slot senyap plus transkrip, atau speechSynthesis sementara? | speechSynthesis sementara |
| 34 | Boleh memangkas atau mengurutkan item per produk berdasarkan matriks dampak × usaha audit? | Ya |

### Tahap 14 (DIY)
| # | Pertanyaan | Default |
|---|---|---|
| 35 | Lahar dingin sebagai jenis bahaya baru di seluruh world (+4–6 j), atau varian banjir dengan lapisan peta sendiri? | Varian banjir dengan lapisan sendiri |
| 36 | Batas ukuran pack provinsi (hampir pasti melebihi 16,5/16/24 KB gzip): geometri lazy per kabupaten, naikkan batas khusus provinsi, atau simplifikasi kasar? Apakah batas 180 KB per demo tetap berlaku untuk DIY? | Naikkan batas file pack khusus provinsi; 180 KB per demo tetap, dengan geometri kabupaten lazy bila perlu |
| 37 | Pengganti peran "Bupati" di surat, persetujuan dan briefing DIY, karena tidak boleh ada apa pun atas nama Gubernur? | Sekda DIY / Kepala OPD; ringkasan "dikirim ke meja Gubernur" tanpa sapaan personal |
| 38 | Layanan: OPD Pemda DIY ditambah Disdukcapil/DPMPTSP tiap kab/kota (realistis), atau OPD provinsi saja? | Realistis (adminduk adalah urusan kab/kota) |
| 39 | Istilah: kapanewon/kalurahan di 4 kabupaten, kemantren/kelurahan di Kota Yogyakarta? | Ya |
| 40 | Ada penutur asli Jogja untuk mereview contoh ngoko/krama? | Tidak; berlabel "contoh" |
| 41 | Skenario gempa/tsunami? DIY jadi default di halaman tertentu? | Tidak; kartu tur DIY terpisah di situs |

### Tahap 15 (Dubbing)
| # | Pertanyaan | Default |
|---|---|---|
| 42 | Penyedia untuk sampel dan pembuatan akun/key sekarang: Google Chirp 3 HD, Azure Speech (southeastasia), ElevenLabs Starter? Batas biaya? | Ketiganya; batas $30 |
| 43 | Siapa 2 penutur asli pereview, dan kapan tersedia (1–3 hari)? | Perlu nama |
| 44 | Lingkup suara: Bojonegoro dan DIY saja dengan seed 2026 terkunci; Bandung/Padang subtitle saja? | Ya |
| 45 | EN: audio ID dengan subtitle EN, atau audio mati? | Audio mati, subtitle EN |
| 46 | Briefing Pagi: suara hanya untuk keadaan kanonik, mode teks di keadaan lain? | Ya |
| 47 | Juara Jualan: 4 suara, dengan nama/produk/harga dikunci per region agar audio cocok dengan transkrip? | Ya |
| 48 | Ikut di-dubbing: rapat Naskah Pintar (bab 5 tur), "Dengarkan" Sapa Warga, voice note ID? | Rapat Naskah ya; lainnya teks |
| 49 | Voice note Jawa: rekaman manusia, TTS Azure jv-ID berlabel, atau transkrip plus waveform? | Transkrip plus waveform |
| 50 | Label "Suara AI" di UI? | Ya (wajib secara etis) |
| 51 | Bila tidak ada sampel AI yang lolos: biaya pengisi suara manusia ±Rp 15–37 juta untuk ±45 menit? | Ditanyakan saat itu |
| 52 | Audio 35–80 MB di-commit ke repo (perlu untuk GitHub Pages), atau di-host terpisah/LFS? | Commit Opus dan m4a ke `public/audio` |

### Key dan akun yang bisa disiapkan sekarang
- Google Cloud dengan billing aktif: YouTube Data API v3, Fact Check Tools API, Text-to-Speech (Chirp 3 HD).
- Azure Speech resource (region southeastasia).
- ElevenLabs Starter ($6/bulan, ada lisensi komersial).
- Brave Search API (kartu kredit; kredit $5/bulan gratis).
- Meta Developer app, Threads API dan Instagram Business yang tertaut ke Facebook Page, lalu ajukan app review.
- Reddit Data API application.
- `ANTHROPIC_API_KEY` untuk uji Live (opsional).
- Akun Canva atau generator gambar pilihan pemilik (T13).

---

## E. Tabel keputusan sumber Radar Isu Live (draf)

Volume wajar yang diasumsikan: 1 region, ±20 kata kunci, berita tiap 5 menit, sosmed tiap 15 menit. Harga dicek 20 Nov 2026 dan dicek ulang saat T12.

| Sumber | Biaya/bulan | Latensi | Cakupan ID | Risiko ToS | Syarat | Status usulan T12 |
|---|---|---|---|---|---|---|
| GDELT DOC 2.0 | $0 | ±15 menit | baik (internasional plus media besar lokal) | rendah | tanpa key; 1 request per 5 detik | hidup |
| RSS penerbit (Antara, Detik, Kompas, portal lokal) | $0 | 5 menit | baik | rendah–sedang (link-out saja) | tanpa key | hidup |
| Google News RSS | $0 | 5–15 menit | baik | sedang (ketentuan non-komersial, tanpa redisplay) | tanpa key | mati sampai pemilik setuju |
| turnbackhoax.id RSS (`/feed`) | $0 | menit sampai jam | cek fakta ID | rendah | tanpa key; item tanpa pubDate | hidup |
| Google Fact Check Tools API (`claims:search`) | $0 | menit sampai jam | baik | rendah | key Google gratis | hidup bila ada key |
| cekfakta.com | — | — | — | — | tidak punya API/RSS | tidak bisa; pakai Fact Check API |
| YouTube Data API v3 | $0 (100 search/hari plus 10 ribu unit) | 15–60 menit | baik | rendah | key Google gratis | hidup bila ada key |
| Brave Search API (web) | ±$5–30 | on-demand | baik | rendah; menyimpan hasil butuh paket Enterprise | key berbayar | cache pendek saja |
| SerpApi (alternatif) | $25–75 (1–5 ribu pencarian) | on-demand | Google plus News | rendah–sedang | key berbayar | alternatif |
| Google Custom Search JSON API | — | — | — | — | tertutup bagi pelanggan baru, berhenti 1 Jan 2027 | tidak bisa |
| Bing Web Search API | — | — | — | — | dipensiunkan 11 Agu 2025 | tidak bisa |
| Reddit Data API | $0 non-komersial atau kontrak | 15 menit | konten ID tipis | sedang | approval (minggu) | adapter dibuat, belum live |
| Threads keyword search | $0 (±500 query per 7 hari) | 15 menit | sedang | rendah setelah review | Meta app review (minggu) | adapter dibuat, belum live |
| Instagram hashtag search | $0 (30 hashtag per 7 hari) | 15 menit | sangat tipis | rendah | akun Business plus review | adapter dibuat, belum live |
| X API pay-per-use | ±$15–75 (3–15 ribu post) | hampir real-time | sedang | rendah | key berbayar | mati sampai disetujui |
| TikTok Research API | — | — | — | — | khusus akademik/non-profit | tidak memenuhi syarat |
| Apify (TikTok dsb.) | ±$3 per 1.000 hasil plus $19–29 | menit | baik | TINGGI | persetujuan tertulis | mati bawaan |
| Facebook (Meta Content Library / Page Public Content) | — | — | — | — | MCL akademik saja; PPCA app review, Pages saja | belum live |

Keputusan collector yang diusulkan: `server/ai-proxy/src/collect/`, dipasang hanya oleh adapter Node (Docker/VPS). Collector memakai ulang Hono, zod, klien Claude, batas biaya, rate limit dan CORS. Penyimpanan memakai `node:sqlite` bawaan Node 22 (eksperimental, memunculkan warning). Alternatifnya `better-sqlite3`, yang butuh izin npm install, atau pin Node 24. Deploy Vercel/Netlify/Worker menjawab `radar:false`, sehingga klien tetap di Simulasi. `docker-compose.yml` saat ini `read_only` dengan tmpfs saja, jadi perlu named volume untuk SQLite.

---

## F. Daftar pendek penyedia suara (TTS)

Volume naskah: ±45 menit inti (rentang 40–80 menit), ±38 ribu karakter; ±150 ribu karakter termasuk sampel dan 3× pengambilan ulang. Biaya TTS < $15 di penyedia mana pun, masuk kuota gratis.

| Penyedia | Harga | Suara id-ID | Kontrol | Catatan |
|---|---|---|---|---|
| Google Chirp 3 HD | $30 per 1 juta karakter (1 juta gratis/bulan) | 30 (14 P, 16 L) | SSML dan `<phoneme>` hanya di request sinkron; IPA kustom; `[pause]`; OGG_OPUS | Kandidat utama |
| Azure Neural / DragonHD | ±$15 / ±$22 per 1 juta (0,5 juta gratis/bulan) | Ardi (L), Gadis (P); juga jv-ID Siti dan Dimas (Jawa) | Neural: SSML penuh dan word-boundary. DragonHD: tanpa `<prosody>`, real-time saja. | Satu-satunya yang punya suara Jawa. Code of conduct melarang meniru suara pejabat. |
| ElevenLabs Multilingual v2 | $80 per 1 juta (API); paket Starter $6, Creator $22 | multibahasa (ID terkonfirmasi di v2/Flash) | tanpa SSML/phoneme terdokumentasi; pakai alias | Paket Free tidak boleh untuk komersial |
| OpenAI TTS | — | dioptimalkan untuk EN | tanpa SSML | Tidak dipakai: model berhenti 6 Jan 2027 |
| Amazon Polly | — | tidak ada suara Indonesia | — | Tidak dipakai |
| Prosa.ai (lokal) | tidak publik | ±40 suara | — | Hubungi sales bila ingin vendor lokal |
| Pengisi suara manusia | ±$20–50 per menit jadi (Rp 15–37 juta untuk ±45 menit) | — | — | Ada biaya rekam ulang tiap naskah berubah |

Alat lokal sudah tersedia: ffmpeg 8.1.1 (libopus, aac, loudnorm, ebur128, rubberband). Opus hanya didukung penuh di iOS Safari 18.4+, jadi m4a AAC tetap dibuat sebagai cadangan.

---

## G. Hasil cek pointer spesifikasi

Semua pointer berikut COCOK di HEAD 4dfcea1: `loader.ts:25`, `region/types.ts:62`, `world/types.ts:177/:195`, `schemas.ts:353`, `ctx.ts:112`, `model.ts:419`, `RootLayout.tsx:51`, `shell.css:526`, `motion.ts:684`, `Opener.tsx:29-32`, `pajak-beres index.tsx:224`, `juara-jualan strings.ts:88`, `registry.ts:34/:105`, `router.tsx:49`, `routeLoaders.ts:33`, `id.ts:107`, `eco.ts:108/112/113/301/305`, `radar-isu/copy.ts:49/:77-78`, `faq.ts:28/:70`, `Ekosistem.tsx:175`, `pantau-merek/copy.ts:53`, `nik.ts:27/:102`, `session.ts:24`, `world/texts.ts:281`, `scenario-texts.ts:37`, `regions.spec.ts:29`, `tour/types.ts:50/:62`, `meja-pimpinan/strings.ts:171/:175`, `radar-isu.spec ~61`, `sitemap.xml:29`, `site.ts backends`.

Yang SALAH, BERGESER atau KURANG:
| Pointer spesifikasi | Kenyataan |
|---|---|
| `id.ts:63` "menu Layanan PhoneFarm, Sistem Automasi" | Ini `nav.workMenu[2]` di dropdown Karya, bukan menu Layanan. EN di `en.ts:61`. |
| `eco.css:769-810` `.karya-merged*` | Bloknya 768–824, ditambah `:864` (media query) dan komentar `:726`. Juga `site.css:1046-1063` `.karya-merged-card`. |
| Pengecualian `line-through` di `awas-belanja/Detail.tsx` dan TextDiff | Keduanya memakai `<s>`/`<del>` dan tidak mengandung string itu. Kena gerbang yang belum tercatat: `sapa-warga.css:891` (sah) dan `calendar.css:96`. |
| JSON-LD `/karya` | Tidak ada. Yang ada hanya deskripsi "Studio software…" di `index.html:11`, `Produk.tsx:82`. |
| Aset `public/` milik Karya | Tidak ada (public = favicon, sitemap, scenes). |
| `Deep.tsx:2-5` | Hanya `:2`. |
| Bahasa tahap internal `eco.ts:24/74/123/136` | Belum lengkap. Ada juga 124, 164–167, 217–218, 267, 316–317, 329, 359–360, `en.ts:105`. |
| Lab `eco.ts:150/157/168` | Ada juga 164–167, 170–180, EN 343–371. `Lab.tsx:164` memakai `copy.karya.mergedInto`. |
| `routeLoaders.ts:33` | Juga baris 11, 12, 21, 30, 37, 46. |
| "Medsos foto" Pantau Merek | Ada di `src/demo-kit/world/up/labels.ts:54-58` (kit bersama), bukan di folder pantau-merek. |
| tenderpilot "0 helper motion" | Sebagian salah: memakai guard `motionMode()`, tanpa DEMO/EASE, dengan `ease-out` keras di `tenderpilot.css` (6 tempat) dan `setTimeout`. |
| `registry.ts:34/:105` `_placeholder` | Juga `routes/Demo.tsx:15/:39/:48` (interim), prop `interim` di TopBar, `polish.spec.ts`, `shell.selftest.mjs:27`, `CONTRACTS.md:53`, `engine.ts degraded()`. |
| `schemas.ts:353` quotes | Cermin klien di `ai/live.ts:313`, fixture `mock.ts:96-102`, `prompts/radar-isu.ts`, selftest parity. |
| `RootLayout.tsx` ~51 | `bare` ada di :51; gerbang sebenarnya di `:124` `{bare ? null : <PageCurtain/>}`. |
| `shell.css:526` "340 px" | Nilai diisi dari `SHELL.guideW` di `DemoShell.tsx:572`; lompatan px harus diukur. |
| juara-jualan `strings.ts:88` | EN di `:183`. |
| `nik.ts` | Juga `:116`, fallback nama Bojonegoro. |
| `scenario-texts.ts:37` | Juga `:40`; `@info.darurat.jatim` ada di `:20`. |
| §1 "suara hanya `tts.ts`" | Pemakai sebenarnya `playback.ts`, `PhoneBriefing.tsx:67`, `Meeting.tsx:79`, `Speak.tsx`, `VoiceRecorder.tsx:126`. |
| §7.2 Google Programmable Search | Tertutup bagi pelanggan baru dan berhenti 1 Jan 2027. Bing dipensiunkan 11 Agu 2025. cekfakta.com tanpa API/RSS. |
| §9.1 "kalurahan (kelurahan di kota)" | Kota Yogyakarta memakai kemantren + kelurahan; 4 kabupaten memakai kapanewon + kalurahan. Pergub 25/2019 diubah oleh 30/2021, dan menurut BPK diganti Pergub 48/2025 (teks resmi belum diverifikasi). |

Banyak file yang dirujuk sedang diubah T8 (tour/*, Overlay.tsx, shell/controls.tsx, tenderpilot, pantau-merek, sapa-warga Phone/Thread, meja-pimpinan/strings.ts, regions.spec.ts, `cek-berkas/regional.ts` yang baru). Prompt finder harus merujuk simbol, bukan nomor baris.

---

## H. Yang terlewat di spesifikasi

**Lintas tahap**
- Alat batas ukuran `.shots/t7-int/budget.mjs` ada di folder gitignore. Pindahkan ke `tools/budget.mjs` di awal T9, sebelum `.shots/` dibersihkan.
- Alat ini mengukur tab default setelah networkidle + 3 detik, jadi menjadikan tab bawaan "lazy" tidak menurunkan angka. Panel harus dimuat saat interaksi.
- Tidak ada alat LCP (Lighthouse tidak terpasang). Perlu skrip CDP PerformanceObserver.
- `playwright.config.ts` selalu membangun `.e2e/dist` sendiri di port 4190. Pengukuran pada server 4173 butuh config sementara.
- Baseline persona T7 tidak sebanding (8 kriteria, persona berbeda, dinilai sendiri oleh integrator). T9 menjadi baseline pertama, dan T16 wajib memakai file rubrik dan anchor yang identik.
- Laporan per tahap (§11) dan `tahapN-plan.md` tidak tercantum di §4.3.

**T10**
- Gerbang grep peka huruf besar-kecil. Variannya: "Sedang dibangun", "Hadir di tahap", "Being built", "arrives in stage", "Now part of", "Kini bagian dari", "portofolio lama", "earlier portfolio", "menyusul", "segera hadir".
- `_placeholder` (mengandung "sedang dibangun") harus dihapus di T10, atau gerbang tidak pernah kosong.
- Grep tidak menangkap string yang disusun saat runtime, jadi perlu crawl DOM ID+EN dengan menu terbuka.
- `copy.check.ts` mewajibkan 4–6 FAQ. radar-isu dan toko-autopilot masing-masing tepat 4.
- Kunci `pages.phonefarm`, link GitHub di kolom Portofolio, grid footer di 4 breakpoint, filter Lab "Portofolio" dan "Sedang dibangun" (selalu 0 hasil), `lab.spec` 20 → 18 kartu.
- Copy tahap mati: `DEMO_STAGE`, `demoPlan`, `PageShell pages.building`.
- Statistik Why kedua adalah angka Karya. `pantau-merek/mini.tsx:44` memakai "Kopi Senja". Tur posterOnly "Demo penuh menyusul" (`tour/strings.ts:20`).
- Tidak ada 301 di server (SPA), perlu dicatat untuk deploy.

**T11**
- `Mention.kecamatanId` untuk choropleth.
- `WORLD.version` 6 → 7 (`util.ts:11`) agar world tersimpan di IndexedDB direset.
- Proxy `/api/radar` di `vite.config.ts:171`.
- `?focus=` menerima id Story.
- Hook tur bab 6 dan `inp.spec` harus tetap jalan.

**T12**
- Google Fact Check Tools API adalah pencocok cek fakta yang lebih baik.
- Brave melarang menyimpan hasil tanpa paket Enterprise.
- Volume SQLite di docker-compose, `mem_limit` 256m.
- Health flag `radar:false` di adapter serverless.

**T13**
- `Complaint.photo` hanya boolean, jadi efek berantai butuh ref foto di world, CONTRACTS dan self-test.
- Engine tur adalah singleton yang terikat ke `/tur` (46 referensi). Mode Cerita butuh runner sendiri.
- Sapa Warga tidak memakai `Chat.tsx`.
- "Semua konstanta motion ke motion.ts" berarti 284 timing di 50 file CSS dan butuh jembatan token CSS.
- Perlu e2e per cerita (18) dan tes fallback SimPhoto. Mini-preview juga perlu tampilan realistis. Foto harus tersedia offline (fallback SVG).

**T14**
- `validate.mjs:86` menolak kode multi-kabupaten. `wire.ts`/`topo.ts` harus membawa field baru.
- Id "Jetis" ganda. Nama kecamatan sama dengan nama kab/kota.
- Ejaan HDX berbeda ("Gunung Kidul", "Gedang Sari", "Sapto Sari", "Gedong Tengen").
- LandmarkKind belum punya gunung/bandara/pantai. Alert belum punya `lahar`.
- "Pemkab" sudah salah untuk Bandung dan Padang (kota).
- Regionalisasi spesimen baru ada di Cek Berkas. Kenal Mitra, Naskah Pintar dan Pajak Beres juga perlu. POST map belum punya `'34'→'55'`.
- `media/samples.ts:26`, `docs/extract.ts:34`.
- AI `groupBy` belum punya 'kabupaten'.
- Tes `region-lang.spec`, `final.spec`, `pajak-beres.spec`.
- Link tur di situs hanya untuk Bojonegoro.
- Pembagian layanan: adminduk urusan kab/kota.

**T15**
- Rapat Naskah Pintar (bab 5 tur), "Dengarkan" Sapa Warga, VoiceRecorder dan `PhoneBriefing.tsx:67` masih memakai speechSynthesis.
- Briefing dan panggilan dibangkitkan saat runtime.
- Bus audio (dua suara bisa tumpang tindih di bab 3/4/5/12).
- `awaitOf()` mengembalikan true untuk kunci tak dikenal, jadi `'voice'` harus ditangani di engine.
- Linter naskah dan pemeriksa loudness belum ada.
- Label "Suara AI" dan credits.
- Chromium Playwright tidak bisa memutar AAC.

---

## I. Disk

| Tahap | Puncak sementara | Pertumbuhan repo |
|---|---|---|
| 9 | 0,4–0,6 GB | +30–35 MB (screenshot) |
| 10 | 0,3–0,5 GB | −0,25 MB |
| 11 | 1–1,5 GB | +20–30 MB |
| 12 | 1–1,5 GB | +5 MB, ditambah screenshot 20–30 MB |
| 13 | ±1,5 GB (unduhan mentah 50–150 MB) | +12–18 MB aset, +±40 MB screenshot |
| 14 | ±0,5 GB plus e2e | +1–1,5 MB (cache 15–25 MB, gitignore) |
| 15 | 1–1,5 GB | +35–80 MB audio |
| 16 | 1–1,5 GB | +±40 MB |
| Total | puncak ±1,5 GB per waktu | ±200–290 MB |

- Sekarang ±490 MB kosong di C: (`df`, 20 Nov), jadi T9 tidak bisa dimulai dengan aman.
- Minimum yang aman: 3 GB. Spesifikasi §0 meminta ≥ 10 GB. **Pemilik wajib mengosongkan disk C: sebelum T9.**
- Menghapus `.shots/` membebaskan 277 MB, tapi hanya setelah `budget.mjs` disalin.
- Agen mengecek `df` sebelum setiap langkah berat dan berhenti bila sisa < 300 MB.

---

## J. Konflik aturan dan ukuran workflow

**Deploy.** §11 melarang push dan deploy, sedangkan pemilik sebelumnya memerintahkan deploy GitHub Pages untuk T8.
- Keputusan: selama T9–T16, GitHub Pages tetap di versi Tahap 8.
- Commit lokal per bagian tetap dibuat (§11).
- Push/redeploy hanya atas perintah pemilik, misalnya di akhir T10 atau T16.

**Kecepatan.** Preferensi pemilik "cepat, secukupnya" (lewati review dan re-skor) bertentangan dengan spesifikasi ini, yang mewajibkan verifikasi adversarial dan kritik kelengkapan per tahap.
- Rencana ini mengikuti spesifikasi.
- Bentuk verifikasinya: 2 skeptis plus 1 kritik per tahap, tanpa loop wow tambahan, dan paling banyak 1 putaran perbaikan.

**Ukuran workflow.** Pedoman sesi adalah "medium" (< 10 agen per workflow). §4.2 meminta satu workflow ultracode.

| Mode | Bentuk T9 | Waktu T9 |
|---|---|---|
| Medium (default) | 4 workflow berurutan. WF1 ukur (1 agen). WF2 finder (9: 4 lensa dan 5 produk). WF3 verifikasi (4 skeptis, 4 persona, 1 kritik). WF4 celah dan penulisan (4). Total ±23 agen. | 6,5–9 j |
| Large (pemilik menaikkan "Dynamic workflow size") | 1 workflow. ±18 finder paralel (satu per lensa dan per kelompok produk lebih kecil), 4 persona, 4 skeptis, kritik. Tetap dibatasi 3 Chrome hidup dan pengukuran serial. | 30–60 menit lebih cepat; hemat ±1–2 j di T13 dan T16 |

Kesimpulan: menaikkan ukuran workflow menghemat ±3–4 jam untuk seluruh T9–T16 (±3%). Penghambat utama tetap disk dan jeda balasan pemilik, bukan ukuran workflow.
