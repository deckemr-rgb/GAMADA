# Prompt VS Code: Tahap 9–16 · Audit Konsultan, Bersih Karya, Radar Isu Live, Demo Realistis, Provinsi DIY, Dubbing

Model: Opus 5.5 · effort High · ultracode. Diterima dari pemilik 20 Nov 2026; dijalankan setelah Tahap 8 selesai, di-commit dan di-push.

## Bagian 0 · Cara pakai (untuk pemilik proyek, bukan untuk agent)

- Amankan pekerjaan Tahap 8 (commit dulu, atau izinkan agent meng-commit-nya di awal Tahap 9). Folder `reports/` dan `research_notes/` bukan bagian situs; jangan ikut di-commit kecuali pemilik mau.
- Kosongkan disk C. Sediakan minimal 10 GB (build e2e, foto, audio dubbing).
- Siapkan key (boleh menyusul): Radar Isu Live (agent mengajukan daftar sumber + biaya di Tahap 12; RSS berita dan GDELT jalan tanpa key); dubbing (key penyedia suara pilihan pemilik dari sampel Tahap 15); `ANTHROPIC_API_KEY` untuk analisis AI mode Live.
- Atur Claude Code: Opus 5.5 effort High; naikkan "Dynamic workflow size" di config.
- Kirim bertahap. Agent berhenti di akhir tiap tahap; pemilik membalas "lanjut tahap N".
- Tahap 9 hanya audit. Urutan tahap berikutnya boleh diubah sesuai temuan audit.

---

## 1 · Konteks

Bacaan wajib sebelum mulai: `README.md`, `docs/CONTRACTS.md`, `docs/PERF.md`, `src/demo-kit/CONTRACTS.md`; `docs/PROMPT-VSCODE-DEMO-EKOSISTEM.md` (spesifikasi induk; sebagian keputusannya diubah oleh §2); `docs/build/LAPORAN-AKHIR.md`, `docs/build/tahap7-plan.md`; `src/demo-kit/region/packs/README.md`; `server/ai-proxy/`. Di awal setiap tahap, baca ulang §1–3, §11, §13, dan bagian tahap itu.

Repo GAMADA: Vite 8, React 19, TypeScript strict, react-router 7, GSAP 3.15, Lenis, OGL, Tailwind 4, Fraunces + Manrope, toggle ID/EN.

Apa yang dijual: ekosistem produk AI untuk pemerintah daerah dan bisnis: GAMADA Inti dan 17 produk dalam 3 ekosistem (Satu Daerah, Usaha Pintar, Pasar Daerah). Setiap produk punya `/produk/:slug`, sandbox `/demo/:slug`, dan peran di tur `/tur` "Satu Hari di Bojonegoro" (19 bab + ringkasan).

Kondisi sekarang (cek ulang sebelum dipakai):
- Data demo semua simulasi; tidak ada kode pengumpul data internet. `server/ai-proxy` (Hono) hanya punya `/api/ai/health|chat|extract`. `server/ai-proxy/src/kv.ts` hanya counter (in-memory, atau Upstash bila `REDIS_URL` diisi).
- Region pack: bojonegoro (default dan tur), bandung, padang. Registry `src/demo-kit/region/loader.ts:25`. Skema hanya mengenal `kabupaten | kota`.
- Narasi tur hanya teks (`src/demo-kit/tour/narration.*.ts`). Suara hanya `speechSynthesis` browser (`src/demo-kit/media/tts.ts`). Tidak ada file audio.
- Foto semua ilustrasi SVG (mis. `src/demos/sapa-warga/photos.tsx`).
- `/karya` hanya daftar nama dan "sedang dibangun"; nama lama dicoret dan ditandai "dulu X" di banyak tempat.
- Budget ketat: radar-isu 165,1 KB (EN 166,7), meja-pimpinan 176,6 KB (EN 178,2), batas 180 KB gzip.

## 2 · Keputusan baru (menggantikan spesifikasi induk; jangan dibahas ulang)

| # | Keputusan lama | Keputusan baru |
|---|---|---|
| 1 | Produk lama tetap di /karya sebagai portofolio (induk §2.1) | /karya dan seluruh isinya dihapus. Yang relevan dilebur ke Ekosistem, sisanya (GymKuy dsb.) dihapus. §5. |
| 2 | Teks "dulu ScrapPulse", "dulu KasirKu", nama lama dicoret | Semua penyebutan nama lama dihapus dari UI. Pengunjung hanya melihat nama sekarang ("Analisis Mendalam", "Modul Kasir"). URL lama tetap di-redirect tanpa penjelasan. |
| 3 | Sumber Radar Isu fiktif (§11 P4) | Radar Isu punya mode Live yang benar-benar mengumpulkan opini dan pemberitaan publik dari web/Google, berita, YouTube, Instagram, TikTok, Threads, dan platform lain secara real-time, sejauh batas API dan izin memungkinkan. Mode Simulasi tetap ada untuk tur, presentasi offline, dan fallback. §6–7. |
| 4 | Tur dan situs hanya Bojonegoro | Tambah region pack Provinsi Daerah Istimewa Yogyakarta (tingkat provinsi) dengan simulasi holistik penuh dan tur "Satu Hari di DIY". Bojonegoro tetap default. §9. |
| 5 | Narasi tur berupa teks | Dubbing bahasa Indonesia untuk tur dan panduan setiap produk: natural, sopan, rapi, tidak formal, tidak terdengar seperti AI. §10. |
| 6 | Foto berupa ilustrasi SVG | Demo memakai foto realistis (berlisensi jelas, berlabel, ber-watermark simulasi) untuk momen yang butuh bukti visual. §8. |

Tetap berlaku dari induk: Simulasi mode bawaan (Live gagal → kembali ke Simulasi); semua teks ID dan EN; tidak ada tombol mati; pejabat hanya jabatan; data transaksional fiktif berlabel simulasi; semua kontrak di `docs/CONTRACTS.md`, `docs/PERF.md`, `src/demo-kit/CONTRACTS.md`; proxy AI portabel (collector Radar Isu boleh khusus Node/Docker bila jadwal/penyimpanan tidak cocok serverless; catat alasannya).

## 3 · Peran dan standar kerja

Dua peran: partner konsultan senior (setara Big Four, praktik digital sektor publik) yang menilai situs sebagai alat jual ke kepala daerah, kepala dinas, direktur bank/BPR, pemilik usaha menengah; dan lead engineer yang mengeksekusi perbaikannya.

Standar bukti: setiap temuan wajib berbukti (screenshot, file:baris, angka terukur, langkah reproduksi); opini tanpa bukti dibuang. Pisahkan fakta, penilaian, rekomendasi. Ukur sebelum dan sesudah (fps, ms, KB, skor rubrik). Laporkan hal penting di luar permintaan (risiko hukum/data).

## 4 · Tahap 9 · Audit holistik (membaca dan mengukur, tanpa mengubah kode)

Tujuan: kajian membangun yang komprehensif tentang apa yang masih kurang, terutama produk dan demonya, dan cara membuat setiap demo lebih memukau saat dipresentasikan.

### 4.1 Lensa audit (satu tim finder per lensa)
1. **Kesan pertama dan narasi jual.** Dalam 10 dan 60 detik: paham apa yang dijual, untuk siapa, kenapa percaya? Alur Home → Ekosistem → Produk → Demo → Hubungi.
2. **Motion dan micro-interaction.** Animasi kaku, transisi terpotong, elemen hilang tanpa animasi keluar, lompatan layout, easing linear, ritme beda antarproduk. Hipotesis (verifikasi di browser):
   - Masuk/keluar `/demo/:slug` dan `/tur` terpotong: `src/components/PageCurtain.tsx` tidak dirender pada rute tanpa chrome (`src/routes/RootLayout.tsx`, bare ~baris 51).
   - Pindah tab Radar Isu tanpa transisi (`src/demos/radar-isu/index.tsx`).
   - Toast, GuidePanel, Popover hanya animasi masuk; GuidePanel ditutup → kanvas melompat 340 px (`src/demo-kit/shell/shell.css:526`, `--dk-guide-w`).
   - Hero /produk tanpa koreografi masuk; skeleton → konten melompat (`.pr-skel-card`).
   - Loop mini-preview reset sekaligus; `ECO_SITE.mini.crossfade` (`src/lib/motion.ts:684`) tidak dipakai.
   - Teks narasi tur berganti mendadak; `Opener.tsx` memakai angka keras di luar `motion.ts`.
   - tenderpilot tidak memakai helper motion kit sama sekali.
3. **Arsitektur informasi dan copy.** Stub (`/proses`, `/faq`, `/panel/phonefarm`); bahasa internal ("hadir di tahap N", "sedang dibangun"); nama lama; TODO di `src/content/site.ts`; statistik tidak cocok; menu ganda ("Layanan & Produk" vs "Ekosistem"). Nilai setiap item Karya (relevan untuk Ekosistem atau tidak, dengan alasan) untuk Tahap 10.
4. **Kesiapan demo per produk (18).** Status: *Siap demo* / *Perlu poles* / *Belum layak*. Per produk: skenario demo 3 menit ideal, apa yang kurang, 3 perbaikan berdampak terbesar. Temuan diketahui: pajak-beres `onReview` no-op (`index.tsx:224`); juara-jualan "demo segera hadir" (`strings.ts:88`); `src/demos/_placeholder` masih di-import di `registry.ts:34` dan `:105`; klaim palsu Pantau Merek memakai mesin Analisis Radar Isu (`src/demos/pantau-merek/copy.ts:53`, `src/content/i18n/eco.ts:113`, `src/demos/radar-isu/copy.ts:78`).
5. **Realisme dan kredibilitas data.** Foto kartun, sumber tanpa tautan, angka tampak dikarang, suara robotik, alur yang harus digerakkan sendiri tanpa cerita otomatis.
6. **Mobile dan aksesibilitas.** 375 px dan 768 px, axe, fokus keyboard, kontras, prefers-reduced-motion.
7. **Performa.** `npm run perf`, budget per demo, INP, LCP /produk, lonjakan GPU raster di home.
8. **Kepercayaan, hukum, kepatuhan.** Label simulasi dan UU PDP; klaim yang bisa disangka data nyata; nama instansi/merek nyata; gambar yang bisa di-screenshot dan disebar seolah asli.
9. **Konsistensi lintas produk.** Pola UI, istilah, peran, gaya bicara AI.

### 4.2 Metode (satu workflow ultracode)
- Satu server untuk audit: orkestrator menjalankan satu `npm run build` dan `npm run preview` (port 4173) di awal, dimatikan di akhir. Finder hanya membuka URL itu (`tools/shot.mjs` atau browser). Dev server pemilik di 5173 tidak disentuh. E2E berurutan.
- Finder: satu per lensa, plus satu per produk untuk lensa 4.
- Panel 4 persona pembeli skeptis (Bupati/Wali Kota, Kadis Kominfo/Humas, Direktur BPR, pemilik usaha menengah), rubrik tertulis (kejelasan nilai, kredibilitas data, momen wow, kelancaran, kepercayaan; 1–10 dengan definisi per angka), per produk dan keseluruhan situs.
- Verifikasi adversarial: setiap temuan dicek 2 skeptis; dibantah mayoritas → dibuang.
- Kritik kelengkapan di akhir ("apa yang belum diperiksa?"), lalu celahnya diaudit.

### 4.3 Hasil
`docs/build/tahap9-audit.md`; screenshot `docs/shots/demo/tahap-9/`. Format konsultan: ringkasan eksekutif 1 halaman (5 temuan terpenting + rekomendasi); scorecard (per lensa, per produk, skor rubrik persona); temuan per lensa (bukti, dampak bisnis, keparahan, usaha S/M/L); kesiapan demo per produk; penilaian item Karya; backlog berprioritas (matriks dampak × usaha → Tahap 10–16); quick wins (< 1 jam).

## 5 · Tahap 10 · Hapus Karya, rapikan IA, bersihkan nama lama

### 5.1 Nasib item Karya
| Item | Keputusan |
|---|---|
| KasirKu | Sudah modul Kasir di Toko Autopilot. Anchor `#kasir` berjudul "Modul Kasir", tanpa nama lama. |
| ScrapPulse | Sudah tab Analisis di Radar Isu. Anchor `#analisis` berjudul "Analisis Mendalam", tanpa nama lama. |
| Sistem Automasi (balas komentar, jadwal Reels IG) | Usulan: dilebur sebagai "Balas & Jadwal Otomatis" di Pantau Merek. Keputusan pemilik (§13). Sampai ada keputusan: hapus dari Karya, jangan dibangun. |
| PhoneFarm | Hapus, termasuk `/panel/phonefarm` dan `PhoneFarmPanel.tsx`. |
| GymKuy, Fokusin, Racunin, Jajan.in, SmartCast, GoKantin, Kopi Senja, Tiket.in, LENSA | Hapus. Ide berguna (mis. checkout QRIS) boleh diserap ke Toko Autopilot tanpa menyebut nama lama. |

### 5.2 Daftar periksa penghapusan (cek ulang setiap lokasi)
- **Rute dan file:** hapus `src/routes/Karya.tsx`, `src/routes/KaryaDetail.tsx`, `src/content/work.ts` + entri LOADERS (`src/routeLoaders.ts`); hapus semua gambar/thumbnail/aset `public/` milik item yang dihapus.
- **Redirect:** `/karya` dan `/karya/*` → `/ekosistem`; `/karya/kasirku` → `/produk/toko-autopilot#kasir` (tetap); `/karya/scrappulse` → `/demo/radar-isu?tab=analisis` (ubah dari `router.tsx:49`; `routeLoaders.ts:33` ke `LOADERS.demo`); `/tools/scrappulse` → `/demo/radar-isu?tab=analisis` (tetap). Tidak ada halaman yang menjelaskan nama lama.
- **Navigasi:** `Navbar.tsx` hapus dropdown "Karya" + link mobile; `Footer.tsx` hapus kolom Portofolio (termasuk "ScrapPulse → Radar Isu"); hapus teks menu Layanan "PhoneFarm, Sistem Automasi" (`src/content/i18n/id.ts:63` + EN); hapus kunci i18n `nav.work`, `workMenu`, `workAll`, `footer.portfolioTitle`, `allWork`, `nowPartOf`, `pages.karya`, `pages.detail`.
- **Home:** section Portfolio tanpa item Karya (ganti etalase 3 ekosistem atau hapus); link `Services.tsx` → `/ekosistem`; statistik Why diganti angka ekosistem yang benar; testimoni dan label layanan ke framing ekosistem.
- **Lab:** hapus grup "Portofolio" + kartu PhoneFarm dan ScrapPulse + kunci `TRY_MINUTES` terkait; hapus string Lab di `eco.ts:150`, `:157`, `:168` (+ EN) termasuk "alat dari portofolio lama".
- **Copy dan komentar:** `radar-isu/copy.ts:49` "dulu ScrapPulse"; FAQ "Ke mana ScrapPulse?" (`copy.ts:77-78`); "dulu/formerly KasirKu/ScrapPulse" di `eco.ts:108`, `:112`, `:301`, `:305`; `<s className="karya-merged-old">` dan CSS `.karya-merged*` (`src/styles/eco.css:769-810`); komentar "ex-ScrapPulse", "ex-KasirKu", "ScrapPulse → Radar Isu" di `radar-isu/index.tsx:4-5`, `Deep.tsx:2-5`, `deep-model.ts:2`, `Lab.tsx:3`, `Produk.tsx:8`, header toko-autopilot; `faq.ts:28` dan `:70` "…di halaman Karya"; bahasa tahap internal ("hadir di tahap N", "sedang dibangun") di `eco.ts:24`, `:74`, `:123`, `:136`, `id.ts:107` + EN. Penting: `Ekosistem.tsx:175` memakai `copy.karya.see`; pindahkan kunci itu sebelum blok karya dihapus.
- **Lain-lain:** hapus `/karya` dari `public/sitemap.xml` dan JSON-LD; hapus `backends.scrappulse` dan `backends.phonefarm` di `site.ts`; hapus `docs/products/*.md` milik produk yang dihapus (arsip hanya bila pemilik minta).
- **Klaim palsu Pantau Merek:** perbaiki copy (bawaan). Tab Analisis baru hanya bila pemilik setuju (§13).
- **Stub:** isi `/faq` dari `src/content/faq.ts`; `/proses` diisi atau dikeluarkan dari navigasi sesuai keputusan pemilik (§13).
- **Tes:** perbarui `tests/e2e/routes.spec.ts`, `tests/e2e/tahap2/radar-isu.spec.ts` (kasus `/tools/scrappulse` ~baris 61), `tahap6/links.spec.ts`, `tahap6/site.spec.ts`, `tahap6/copy.check.ts`. Jangan melemahkan; ganti ekspektasi dengan perilaku baru dan tambahkan tes untuk setiap redirect.
- **Gerbang wajib kosong:**
  - `grep -rnE "ScrapPulse|KasirKu|GymKuy|Fokusin|Racunin|Jajan\.in|SmartCast|GoKantin|Kopi Senja|Tiket\.in|\bLENSA\b|PhoneFarm|Sistem Automasi|karya-merged|nowPartOf|sedang dibangun|hadir di tahap|formerly|now part of|dulu bernama|line-through" src public server/ai-proxy/prompts index.html tests`
  - `find src public -iregex ".*\(gymkuy\|fokusin\|racunin\|jajanin\|smartcast\|gokantin\|kopi-senja\|tiketin\|lensa\|phonefarm\|kasirku\|scrappulse\|karya\).*"`
  - Pengecualian hanya: path redirect di `router.tsx`, `routeLoaders.ts`, tes redirect; `line-through` yang sah (coretan harga `awas-belanja/Detail.tsx`, `calendar.css`, TextDiff). Catat di laporan.

## 6 · Tahap 11 · Radar Isu: model data diperluas dan tampilan jauh lebih detail (data simulasi diperkaya, UI siap untuk live)

### 6.1 Model data (perluas, jangan rusak simulasi) di `src/demo-kit/world/types.ts`
- **Mention** (~baris 177) tambah: `url`; `platform: 'web'|'news'|'youtube'|'tiktok'|'instagram'|'threads'|'x'|'facebook'|'forum'` (field `kind` lama tetap, diturunkan dari platform); `title`, `thumbnail`, `lang`; `engagement: {likes, comments, shares, views}`; `publishedAt` (ISO nyata) dan `collectedAt`; `origin: 'sim'|'live'`; `matchedKeyword`, `storyId`. Field `outlet` dipakai sebagai penerbit.
- **Story** (baru): `claim`, `sources[]`, `firstSeen`, `platformBreakdown`, timeline sebaran per platform, `kecamatanIds`.
- **HoaxAlert** (~baris 195) tambah: `sourcePosts[]: {url, platform, at, reach}`; `factChecks[]: {publisher, url, verdict}`; `evidenceTrail[]`; `reviewStatus: 'perlu-verifikasi'|'ditinjau-humas'`.
- **SourceStatus** (baru) untuk panel kesehatan sumber.
- **Waktu:** simulasi menit dunia, Live waktu nyata; lapisan pemetaan atau store paralel supaya tidak bertabrakan.
- **Skema AI:** perluas `TopicAnalysisSchema.quotes` (`server/ai-proxy/src/schemas.ts:353`) jadi `{text, url, platform, publisher}`; masukkan `url` dan `platform` ke `radarCtx()` (`radar-isu/ctx.ts:112`).

### 6.2 Tampilan
- "Siapa yang memberitakan": tabel sumber di setiap Cerita dan peringatan hoaks (ikon platform, penerbit/akun, judul/cuplikan, waktu, engagement, jangkauan; tombol Buka sumber; badge Unggahan pertama; filter platform; urutan terbaru/terbesar).
- Kartu pratinjau unggahan (thumbnail sesuai §7.3, durasi video TikTok/YouTube, teks, metrik).
- Rincian per platform (bar/donut volume dan sentimen) di tab Live dan Analisis.
- Linimasa sebaran: klaim → sebaran per platform per jam → bukti pembanding → cek fakta → klarifikasi → pemulihan sentimen.
- Panel cek fakta (tautan + vonis lembaga cek fakta).
- Sebaran wilayah: peta/choropleth volume isu per kecamatan dari region pack.
- Panel kesehatan sumber (status, latensi, jumlah, terakhir diperbarui), menggantikan angka palsu "dipindai N unggahan" (`scannedToday()`, `radar-isu/model.ts:419`).
- Tab Analisis Mendalam: kutipan dan kecenderungan media bertautan; sumber dipecah per platform (bukan 3 ember rasio); kutipan "template" karangan dihapus.
- Laporan dan ekspor (PDF, XLSX, JSON) memuat daftar sumber + URL.
- Simulasi realistis tapi tidak menipu: nama platform nyata sebagai jenis kanal, akun dan media fiktif; tautan membuka halaman pratinjau di dalam demo (domain fiktif, watermark SIMULASI). Jangan pernah membuat berita palsu atas nama media/akun nyata.
- Budget: tab Live, Analisis, Laporan, dan ekspor XLSX berupa chunk lazy; first-load radar-isu ≤ 175 KB gzip.
- Pantau Merek mendapat komponen sumber dan platform yang sama, menggantikan label generik ("Medsos foto").

## 7 · Tahap 12 · Radar Isu Live: pengumpul opini publik real-time

### 7.1 Arsitektur
- Lokasi: `server/ai-proxy/src/collect/` atau layanan terpisah `server/collector/` (Node/Docker) bila jadwal/penyimpanan tidak cocok serverless. Putuskan dan catat alasannya.
- Adapter: satu antarmuka `search(query, window) → NormalizedPost[]` dan `status() → {ok, latencyMs, count, error?, quotaLeft?}`; satu sumber = satu adapter; nyala/mati lewat env.
- Target latensi (diukur per sumber): web dan berita ≤ 5 menit; media sosial ≤ 15 menit atau sebatas kuota; pencarian on-demand hasil pertama ≤ 60 detik lewat SSE. Polling berkala; stream/webhook bila ada.
- Penyimpanan: store baru (Postgres atau SQLite); `kv.ts` hanya counter/cache; retensi bawaan 30 hari; dedupe kanonisasi URL + simhash teks.
- Pengayaan AI (batch lewat proxy Claude): ekstraksi klaim; pengelompokan Cerita; sentimen dan sikap; skor kemungkinan hoaks + alasan; pencocokan cek fakta (turnbackhoax.id, cekfakta.com, laman klarifikasi hoaks resmi pemerintah); deteksi bahasa (ID, Jawa, Sunda, Minang, EN).
- Endpoint: `POST /api/radar/search {keywords, region, since, platforms[]} → jobId`; `GET /api/radar/stream?jobId=` (SSE post/story/source_status/done); `GET /api/radar/stories/:id`; `GET /api/radar/sources/health`.
- Query builder per region: kata kunci + nama tempat, OPD, landmark, sungai dari region pack aktif.
- Akses dan biaya: pencarian Live hanya di mode presenter (token/allowlist dari pemilik); pengunjung umum hanya hasil cache yang lolos §7.3, atau Simulasi; batas harian per sumber dan total (pola `AI_DAILY_TOKEN_BUDGET`), rate limit, cache; kuota habis dilaporkan jujur via `source_status`; semua key hanya di server.

### 7.2 Sumber (cek dokumentasi, harga, ketentuan terbaru saat implementasi; jangan dari ingatan: mis. Bing Web Search API sudah dipensiunkan, akses Google Custom Search JSON API untuk pelanggan baru dilaporkan dibatasi)
| Platform | Jalur diutamakan | Catatan |
|---|---|---|
| Berita | Google News RSS (ID/EN), GDELT DOC 2.0, RSS portal berita lokal | Gratis tanpa key. Wajib hidup di Tahap 12. |
| Forum | Reddit API, RSS forum lokal | — |
| Web / Google | Google Programmable Search atau penyedia SERP berlisensi | cek ketersediaan pelanggan baru |
| YouTube | YouTube Data API v3 (search, videos, commentThreads) | key gratis dengan kuota |
| Threads | Threads API (cek pencarian kata kunci) | — |
| Instagram | Graph API (hashtag search terbatas, akun bisnis) | jalur resmi sangat terbatas |
| TikTok | TikTok Research API hanya untuk peneliti | jalur resmi kemungkinan tidak tersedia |
| X | X API (berbayar) | — |
| Facebook | Meta Content Library (terbatas), Page Public Content | — |
| Cek fakta | turnbackhoax.id, cekfakta.com, klarifikasi hoaks resmi | — |

Penyedia data pihak ketiga (mis. actor Apify) untuk platform yang jalur resminya tertutup: mati bawaan; baru dinyalakan setelah persetujuan tertulis pemilik atas risiko ToS dan biaya (§13). Susun tabel keputusan sumber (biaya/bulan pada volume wajar, latensi, cakupan, risiko ToS, syarat akses); laporkan platform yang belum bisa Live, alasannya, dan alternatifnya.

### 7.3 Aturan etika dan hukum (wajib)
- Hanya konten publik; tidak login akun pribadi; tidak menembus paywall/captcha/pembatasan teknis; hormati ToS dan robots.txt.
- Pantau isu dan narasi, bukan profil individu. Handle warga biasa di-hash/disamarkan sejak dikumpulkan (`@wa***88`). Media, akun resmi instansi, akun publik terverifikasi boleh utuh.
- Thumbnail/media pihak ketiga hanya lewat embed atau URL resmi platform, tidak diunduh ulang.
- Simpan seminimal mungkin, patuhi UU PDP; retensi, penghapusan, dasar pemrosesan ditulis di bagian Keamanan & Data produk.
- AI tidak pernah memvonis "hoaks". Label "hoaks" hanya bila cocok dengan cek fakta atau data resmi pembanding dan sudah ditinjau manusia (`reviewStatus`); selain itu "perlu verifikasi" dengan skor dan alasan.
- Badge di setiap layar: "Data live · diperbarui 2 menit lalu" atau "Data simulasi".

### 7.4 Tes dan kriteria selesai
- Tes kontrak per adapter dengan fixture rekaman (CI tidak memanggil API sungguhan); collector punya mode `--mock`; tes fallback (satu sumber gagal → status jujur, UI jalan; semua gagal → kembali ke Simulasi + pemberitahuan).
- Selesai bila: sumber tanpa key (RSS berita, GDELT) menampilkan data nyata; setiap platform yang diminta (web/Google, berita, YouTube, Instagram, TikTok, Threads) punya adapter, hidup bila key/izin ada, bila belum tercatat di tabel keputusan beserta alasan dan alternatif.

## 8 · Tahap 13 · Semua demo lebih detail dan realistis

Prinsip: setiap demo bisa bercerita sendiri. Selain sandbox, setiap produk punya **Mode Cerita**: tombol "Putar cerita" menjalankan skenario end-to-end otomatis lewat Tour DSL; pengunjung bisa ambil alih kapan saja. Suara menyusul di Tahap 15; sekarang teks, transkrip, waveform, dan slot audio.

### 8.1 Standar realisme: laporan banjir warga di Sapa Warga
- Warga benar-benar mengirim foto banjir lewat WhatsApp. Tampilan pesan meyakinkan: wallpaper, header kontak instansi, centang terkirim/dibaca, jam per gelembung, indikator mengetik, balasan cepat; pakai `src/demo-kit/ui/Chat.tsx` atau satukan dengan `Thread.tsx`; jangan salin logo WhatsApp (cukup kesan aplikasi pesan, label "via WhatsApp").
- Kiriman warga: foto banjir realistis dengan chip waktu dan lokasi ala EXIF (watermark SIMULASI); share lokasi berupa pin di peta nyata region pack; voice note berbahasa daerah + transkrip + terjemahan; teks singkat.
- Balasan sistem: nomor tiket; klasifikasi AI (banjir, tingkat, kecamatan/desa); diteruskan ke BPBD/PUPR; tampilan petugas lapangan (ETA, rute); pembaruan status ke warga; foto "sesudah ditangani" dan permintaan rating.
- Efek berantai: laporan masuk ke Siaga Wilayah sebagai bukti foto, ke Meja Pimpinan, dan menjadi bukti pembanding di Radar Isu.

### 8.2 Foto dan aset realistis
- Foto berlisensi jelas atau milik sendiri sesuai keputusan pemilik (§13); atribusi di `docs/assets/credits.md`. Label kecil "ilustrasi" atau "ilustrasi AI". Watermark SIMULASI ditanam di gambar bukti (foto banjir, dokumen, KTP spesimen).
- Dokumen spesimen: NIK tidak valid; wajah bukan orang nyata; tanpa lambang daerah atau stempel instansi asli.
- Budget aset: AVIF/WebP beberapa ukuran, `loading="lazy"`; dimuat setelah aksi pengguna (0 KB first-load, ≤ 400 KB per cerita); budget JS 180 KB per demo tidak jebol; catat total ukuran aset dan pantau disk.
- Cocok dengan region: sungai, rumah, vegetasi masuk akal untuk Bojonegoro dan DIY.

### 8.3 Realisme per produk (sumber utama: audit Tahap 9; minimal)
| Produk | Yang ditambahkan |
|---|---|
| Siaga Wilayah | foto/CCTV sungai simulasi, laporan warga berfoto, ETA tim |
| Meja Pimpinan | drill-down sampai bukti foto; slot suara Briefing Pagi (Tahap 15) |
| Naskah Pintar | surat masuk berupa pindaian meyakinkan, tanda tangan dan stempel spesimen generik |
| Awas Belanja | dokumen tender dan harga pasar beserta sumbernya |
| Cek Berkas | contoh dokumen lebih bervariasi |
| Toko Autopilot / Pajak Beres | foto nota dan struk; perbaiki `onReview` no-op |
| Juara Jualan | hapus "demo segera hadir"; slot rekaman panggilan bersuara |
| Kenal Mitra / Rapor Usaha | foto KTP spesimen, foto tempat usaha |
| Pantau Merek | platform nyata, ulasan berfoto |
| TenderPilot | motion pass (saat ini 0 helper motion) |
| Indeks Ekonomi | demo paling tipis; tambahkan cerita yang jelas |
| Lainnya | sesuai audit |

Tambahan: hapus `src/demos/_placeholder` setelah dipastikan tidak terjangkau dan bersihkan import di `registry.ts`; backlog motion dari audit (transisi masuk/keluar rute tanpa chrome; crossfade tab; animasi keluar overlay; GuidePanel tanpa lompatan kanvas; skeleton dengan tinggi cocok; transisi teks narasi tur; semua konstanta motion ke `src/lib/motion.ts`).

## 9 · Tahap 14 · Region pack Provinsi Daerah Istimewa Yogyakarta

Tujuan: simulasi holistik seperti Bojonegoro di tingkat Provinsi DIY; ke-18 demo dan tur berjalan di DIY.

### 9.1 Skema
- `type: 'provinsi'` di zod `src/demo-kit/region/types.ts` (enum ~baris 62); tingkat kabupaten/kota di atas kecamatan (`kabupaten[]` atau `kabupatenId` per kecamatan); perbarui `validate.mjs`, loader, dan UI yang menganggap satu pack = satu kabupaten/kota; pack lama tetap valid tanpa perubahan.
- Istilah wilayah per kabupaten/kota: kapanewon (Sleman, Bantul, Kulon Progo, Gunungkidul) dan kemantren (Kota Yogyakarta); kalurahan (kelurahan di kota); panewu/mantri pamong praja, lurah. Tampilkan sesuai data.
- Pimpinan: "Gubernur DIY" dan "Pemda DIY", bupati/wali kota di bawahnya; perluas `leaderTitle()` dan `regionLabel()` di `src/demos/meja-pimpinan/strings.ts`. Gubernur DIY orang nyata: jangan pernah membuat kutipan, pernyataan, atau keputusan atas namanya; cukup "dikirim ke meja Gubernur". Meja Pimpinan versi provinsi menggabungkan 5 kabupaten/kota dengan drill-down.

### 9.2 Data (nyata hanya bila berlisensi terbuka; selebihnya simulasi berlabel)
- Batas: HDX COD-AB Kulon Progo (ID3401), Bantul (ID3402), Gunungkidul (ID3403), Sleman (ID3404), Kota Yogyakarta (ID3471); kode Kemendagri 34.01–34.04, 34.71.
- Geografi: sungai Code, Opak, Progo, Gajah Wong, Winongo, Oyo, Boyong, Gendol; Waduk Sermo; pasar Beringharjo, Kranggan, Bantul, Argosari Wonosari, Wates, Sleman; landmark Kepatihan, Malioboro, RSUP Dr. Sardjito, Bandara YIA, pantai selatan.
- Bahaya: jenis landmark gunung (Merapi); lapisan lahar dingin Gendol, Boyong, Code; banjir Kali Code; kekeringan Gunungkidul (`hazards.drought` sudah ada); gempa/tsunami hanya bila pemilik minta (§13).
- Bahasa: `jv`, contoh aduan ngoko dan krama ala Mataraman + terjemahan ID/EN di `tools/region/content/diy.mjs`; data simulasi `tools/region/data/sim-diy.mjs` berlabel "simulasi".
- Pipeline: `tools/region/fetch-diy.mjs` dan `build-diy.mjs` (mencontoh `fetch-bojonegoro.mjs`; `ADM2_PCODE` tunggal → daftar 5 kode); `encode-geo.mjs` → `validate.mjs diy` → entri REGIONS; ikuti `packs/README.md` ("Adding a fourth region") disesuaikan untuk provinsi.

### 9.3 Skenario dan tur "Satu Hari di DIY" (semua simulasi)
Hujan lebat lereng Merapi → peringatan lahar dingin Gendol/Code → warga bantaran Code kirim foto lewat WA (§8.1) → hoaks ("Waduk Sermo jebol" / "Merapi erupsi besar, segera mengungsi") → dibantah dengan data sensor dan status simulasi → Humas menerbitkan klarifikasi → dampak ke pasar Beringharjo dan UMKM → ringkasan dikirim ke meja Gubernur. Instansi nyata hanya disebut sebagai unit (mis. BPBD DIY); tanpa kutipan/data palsu atas nama instansi nyata; kartu dan pratinjau hoaks simulasi ber-watermark SIMULASI.
- Tur: `/tur?region=diy`, pemilih region di opener; bab mengikuti struktur yang ada dengan teks/fakta pack DIY; Bojonegoro tetap default.
- Hapus hardcode Bojonegoro: `src/demo-kit/docs/nik.ts` (`BOJONEGORO_KEMENDAGRI` :27, `BOJONEGORO_NIK_REGIONS` :102); `src/demo-kit/docs/samples/{identity,letters,finance,house,cv-data,permits}.ts`; `src/demos/cek-berkas/regional.ts`; `src/demo-kit/world/session.ts:24`; "Pemkab" di `world/texts.ts:281` dan `scenario-texts.ts:37`; akun `@info.darurat.jatim`.
- Tes: `diy` ke `REGION_IDS` (`tests/e2e/tahap7/regions.spec.ts:29`) → matriks 18 demo × 4 region; world self-test dengan `REGION=diy`.

## 10 · Tahap 15 · Dubbing bahasa Indonesia

### 10.1 Cakupan
Tur Bojonegoro dan DIY (19 bab + ringkasan per region); Mode Cerita setiap produk (panduan 60–120 detik); Briefing Pagi Meja Pimpinan dan rekaman panggilan Juara Jualan (menggantikan speechSynthesis); voice note warga berbahasa Jawa: suara manusia bila pemilik menyediakan, atau tetap transkrip + waveform.

### 10.2 Pedoman naskah
Tulis ulang menjadi naskah lisan; jangan menyuarakan teks laporan.
- Irama: kalimat 4–18 kata, fragmen pendek boleh ("Jam sepuluh pagi."); satu ide per kalimat; jangan ditutup kalimat ringkasan/moral.
- Sapaan: "Bapak dan Ibu" paling banyak sekali per bab; jangan "teman-teman"; "kita" inklusif.
- Penanda lisan: boleh "nah" maks 1×/bab, "ya"/"kan" maks 1×/bab, "coba perhatikan", "sekarang kita lihat"; dilarang "sih", "lho", "dong".
- Larangan: "Selamat datang di demo interaktif", "Mari kita jelajahi", "Bayangkan…", "Pernahkah Anda…", "Inilah…"; "Tentu saja", "Dengan demikian", "Selain itu", "Hal ini", "yang mana"; "memungkinkan", "memastikan", "solusi", "inovatif", "terintegrasi", "canggih", "revolusioner", "mulus", "di era digital", "dalam hitungan detik saja!"; "tidak hanya… tetapi juga…", tiga kata sifat berderet, tanda seru beruntun.
- Contoh: ❌ "Sistem Radar Isu secara otomatis mendeteksi hoaks dengan tingkat akurasi tinggi dan menyajikan klarifikasi yang komprehensif." ✅ "Jam sepuluh pagi. Mulai beredar kabar bendungan jebol. Radar Isu menangkapnya di unggahan-unggahan pertama. Di sini kelihatan akun dan kanal mana yang pertama memuatnya. Padahal tinggi muka airnya normal."
- Angka dan singkatan ditulis seperti diucapkan ("jam sepuluh", "sembilan puluh satu persen", "be-pe-be-de", "o-pe-de", "u-em-ka-em", "de-i-ye"). Naskah tidak bergantung angka yang berubah per seed: kunci seed dan region tur, atau audio per region.
- Durasi: naskah dipaskan ke panjang audio terukur; jeda 300–600 ms (SSML) setelah momen penting; audio tidak lebih panjang dari babnya.

### 10.3 Suara
- Pre-rendered, TTS neural Indonesia yang natural atau pengisi suara manusia. Bukan speechSynthesis. Tidak meng-clone suara orang nyata.
- Leksikon pelafalan (SSML/phoneme): Bojonegoro, Beringharjo, Gendol, Kulon Progo, Gunungkidul, kapanewon, kalurahan, Sermo, BPBD, OPD, UMKM, DIY, AI, Kominfo.
- Sebelum produksi massal: 3 sampel suara (mis. 1 laki-laki, 1 perempuan, 1 alternatif) dari 2–3 penyedia; teliti harga dan lisensi komersial; setiap sampel membacakan bab 6 versi Bojonegoro dan DIY; uji dengan audio jadi; pemilik + minimal 2 penutur asli menandai bagian kaku/salah ucap; bila tidak ada yang lolos, ajukan opsi pengisi suara manusia + biaya (§13). Produksi massal setelah disetujui pemilik.
- File: Opus atau AAC 48–64 kbps mono; −16 ±1 LUFS; tanpa musik di bawah suara (musik opsional trek terpisah). Tur `public/audio/tour/<region>/id/ch-XX.(opus|m4a)`; demo `public/audio/demo/<slug>/id/*`; setiap file punya cue JSON subtitle per kalimat; catat total ukuran dan pastikan disk cukup.

### 10.4 Integrasi
- `'voice'` ke `AwaitKey` di `src/demo-kit/tour/types.ts` (~baris 50 dan 62); trek voice opsional per bab dan langkah `{k:'await', until:'voice'}` memakai mekanisme busy `engine.ts`; drift maks 300 ms.
- Subtitle berwaktu dari cue menggantikan caption statis; teks narasi tetap tampil untuk aksesibilitas.
- Kontrol: suara on/off (default on setelah klik "Mulai tur"); volume; subtitle on/off; sinkron dengan jeda, lompat bab, dan jendela Notes presenter.
- Kecepatan 0,75× dan 1,5×: utamakan `playbackRate` dengan pitch dipertahankan; alternatif suara mati di luar 1× + pemberitahuan; pilih yang terdengar lebih baik, catat alasannya.
- Pemuatan: audio malas setelah aksi pengguna (di luar budget first-load); hormati `?off=` dan flag baru di `motion.ts`/`audio.ts`; ambience tetap mati bawaan; audio gagal → tur tetap jalan dengan subtitle + pemberitahuan halus.
- EN cukup subtitle, kecuali pemilik minta dubbing EN.

## 11 · Aturan kerja setiap tahap
- **Mulai tahap:** `git status`; jangan me-revert pekerjaan Tahap 8; bila belum di-commit, minta izin pemilik meng-commit-nya sebagai "Tahap 8" tanpa `reports/` dan `research_notes/`. Baca ulang bagian prompt sesuai §1. Tulis `docs/build/tahapN-plan.md`. Satu workflow ultracode per tahap: finder → implementasi → verifikasi adversarial → kritik kelengkapan.
- **Bila tertahan:** di dalam tahap kerjakan bagian lain yang tidak terblokir; di akhir tahap berhenti sampai pemilik membalas "lanjut tahap N".
- **Wajib lulus:** `npm run typecheck` dan `npm run build` (termasuk validate.mjs); e2e relevan berurutan; 0 error console; budget per demo ≤ 180 KB gzip (target ≤ 175); JS home ≤ 253,6 KB; INP ≤ 200 ms; perf home tidak turun (median 3 run `tools/perf.mjs`, toleransi ≤ 5% vs commit sebelumnya).
- **Kontrak kode:** timing dan easing hanya dari `src/lib/motion.ts`; satu RAF lewat `gsap.ticker`; animasikan transform dan opacity saja; tanpa backdrop-filter dan blur animasi; jangan ubah atribut `<html>` saat runtime; bersihkan saat unmount; TS strict; jangan edit `src/index.css` dan `src-art/`; tanpa library UI; tidak ada tombol mati; semua teks ID dan EN.
- **Server dan rilis:** jangan sentuh dev server pemilik di 5173; server preview/tes sendiri dimatikan di akhir; jangan `npm install` tanpa izin; jangan push atau deploy.
- **Disk:** jangan build penuh atau e2e paralel; bersihkan `.e2e/` dan output sementara; cek ruang sebelum membuat aset besar.
- **Gerbang byte kontrol** harus kosong: `grep -rlP '[\x00-\x08\x0B\x0C\x0E-\x1F]' src server/ai-proxy/src server/ai-proxy/prompts tests tools`
- Commit kecil per bagian, pesan berbahasa Indonesia.
- **Laporan tahap:** yang selesai (link screenshot `docs/shots/demo/tahap-N/`); angka sebelum/sesudah; skor rubrik persona; yang belum selesai; pertanyaan untuk pemilik; rencana tahap berikutnya.

## 12 · Tahapan kerja
| Tahap | Isi | Selesai bila |
|---|---|---|
| 9 | Audit holistik konsultan (§4); hanya membaca dan mengukur | `docs/build/tahap9-audit.md` lengkap, temuan terverifikasi, backlog dipetakan |
| 10 | Hapus Karya, rapikan IA, bersihkan nama lama, isi/keluarkan stub (§5) | kedua gerbang kosong (selain pengecualian tercatat); redirect teruji; tes diperbarui tanpa dilemahkan |
| 11 | Radar Isu: model data + tampilan detail dengan simulasi kaya (§6) | setiap cerita dan hoaks punya daftar sumber bertautan, rincian platform, linimasa, cek fakta; first-load ≤ 175 KB |
| 12 | Radar Isu Live: collector, adapter, pengayaan AI, SSE, badge Live/Simulasi, mode presenter (§7) | kriteria §7.4; fallback teruji; tabel keputusan sumber dilaporkan |
| 13 | Realisme semua demo, Mode Cerita, backlog motion (§8) | Sapa Warga memenuhi §8.1; rubrik persona rata-rata ≥ 8 dan tidak ada produk < 7; pemilik menyetujui |
| 14 | Region pack Provinsi DIY, tur "Satu Hari di DIY", hapus hardcode Bojonegoro (§9) | 18 demo × 4 region lulus e2e; tur DIY berjalan dari awal sampai akhir |
| 15 | Dubbing: naskah, sampel suara, produksi, integrasi (§10) | sampel disetujui pemilik; tur 2 region dan 18 Mode Cerita bersuara; drift ≤ 300 ms; −16 ±1 LUFS |
| 16 | QA akhir: audit ulang ringkas (lensa §4), wow audit persona, laporan akhir | rubrik persona rata-rata ≥ 8 dan tidak ada produk < 7; pemilik menyetujui; `docs/build/LAPORAN-TAHAP16.md` |

Urutan boleh disesuaikan dengan prioritas pemilik setelah Tahap 9.

## 13 · Wajib bertanya kepada pemilik (kumpulkan di laporan tahap; sambil menunggu kerjakan yang tidak terblokir)
- Sumber Radar Isu Live: tabel keputusan sumber; sumber dan key yang disetujui; penyedia data pihak ketiga (persetujuan tertulis); batas anggaran harian; lokasi hosting collector; penerima token mode presenter.
- Dubbing: pilihan dari 3 sampel; lisensi komersial dan biaya; opsi pengisi suara manusia; suara manusia untuk voice note Jawa; perlu dubbing EN atau tidak.
- Foto: stok berlisensi (Unsplash/Pexels) dan/atau gambar AI berlabel, atau foto milik sendiri?
- Sistem Automasi: dilebur ke Pantau Merek ("Balas & Jadwal Otomatis") atau dihapus?
- Pantau Merek: cukup perbaiki copy, atau tab Analisis sungguhan?
- `/proses`: diisi atau dihapus dari navigasi?
- DIY: perlu skenario gempa/tsunami? Perlu jadi default di halaman tertentu?
- Data kontak `src/content/site.ts` yang masih TODO (WhatsApp, email, nama badan usaha, domain).
- Hal lain yang mengubah apa yang dibangun dan tidak bisa diputuskan dengan default wajar. Hal kecil: putuskan sendiri, catat sebagai "keputusan agent".
