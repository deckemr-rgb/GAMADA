# Prompt VS Code: GAMADA dengan semua fitur GATRA

Cara pakai: buka folder `gamada` di VS Code, lalu salin seluruh isi di bawah garis ke chat agent (Copilot Agent / Claude / Cursor). Kerjakan **satu fase per pesan**. Setelah setiap fase, cek di `http://127.0.0.1:5173/` sebelum lanjut ke fase berikutnya.

---

## Peran & tujuan

Kamu adalah senior creative developer. Proyek ini adalah **GAMADA** (Vite 8, React 19, TypeScript strict, GSAP 3.15 dengan ScrollTrigger/SplitText/CustomEase, Lenis, OGL, Tailwind 4, Fraunces + Manrope). Saat ini isinya satu landing page scrollytelling 3 scene ilustrasi (Jelajah, Ketenangan, Biodiversitas) dengan parallax berlapis, transisi seam, WebGL (air terjun, partikel, tirai), burung/kelelawar boids, god rays, preloader, kursor kustom, progress rail, dan suara ambient.

Tujuannya: jadikan GAMADA **website studio digital yang utuh**, dengan semua fitur, halaman, dan alur seperti **https://gatraglobal.id/**, tetapi tetap memakai **bahasa animasi dan palet GAMADA**. Hasilnya harus holistik, komprehensif, informatif, dan indah, sehingga orang terkesan sejak detik pertama tapi tetap mudah menemukan informasi.

Prinsip:
1. **Fitur dan struktur meniru GATRA; tampilan dan animasi milik GAMADA.** Copy ditulis ulang atas nama GAMADA, tidak menyalin teks GATRA kata per kata.
2. **Jangan rusak sistem yang ada.** Tiga scene ilustrasi tetap menjadi pembuka di beranda. Konten baru ditambahkan di bawahnya dan di halaman baru.
3. **Performa tetap prioritas.** Semua aturan di `docs/PERF.md` dan `README.md` (tier, `?degrade`, `?off=`, `?debug=fps`) berlaku untuk bagian baru. Target: p95 frame di bawah 20 ms, tanpa frame di atas 50 ms.
4. Semua data yang belum saya berikan (nomor WhatsApp, email, angka statistik, nama klien) diambil dari **satu file konfigurasi** `src/content/site.ts` dan ditandai `TODO`. Jangan mengarang data asli. Testimoni diberi label "ilustrasi".

## Palet (pakai token yang sudah ada di `src/styles/tokens.css`)

Ini pemetaan peran warna GATRA ke token GAMADA:

| Peran | GATRA | GAMADA |
|---|---|---|
| Latar utama | putih | `--c-ink` #1a1638 |
| Latar section selang-seling | `--soft`/`--tint` | `--c-ink-2` #231b48 dan `--c-indigo` #2b2152 |
| Section "fajar" yang terang (dipakai hemat, mis. Layanan & FAQ) | `alt-light` | gradien `--c-lavender-soft` → `--c-peach-soft`, teks `--c-ink` |
| Primary / CTA | #5B4DE0 | `--c-peach` #f59a62 (hover `--c-gold`) |
| Aksen sekunder | lavender | `--c-lavender` #b9b2ff, `--c-plum` |
| Aksen "tech/live" (badge Live Demo, status online) | — | `--c-teal` / `--c-cyan` |
| Bahaya / sold out | — | `--c-red` |
| Teks | #232933 / #5A6472 | `--c-text` / `--c-muted` |
| WhatsApp | #25D366 | tetap hijau WA, dengan ring `--c-peach` |

Tambahkan token untuk radius (14px), shadow (versi gelap dengan glow lavender tipis), dan skala spasi. Kontras teks minimal WCAG AA.

## Peta situs (wajib semua ada)

Pakai `react-router` (data router, lazy route per halaman, `scrollRestoration`). Konfigurasikan Vite agar fallback SPA berfungsi.

```
/                      Beranda
/karya                 Portofolio (anchor #web, #apk, #proyek)
/karya/:slug           13 halaman demo / studi kasus
/proses                4 langkah kerja
/faq                   FAQ lengkap
/tools                 hub alat (versi IG Tools / automasi)
/tools/scrappulse      alat riset kata kunci (UI demo)
/panel/phonefarm       panel kendali (UI demo)
*                      404 bertema (scene malam + tombol pulang)
```

## Komponen global

- **Navbar sticky:** logo GAMADA, "Layanan & Produk" (#layanan), dropdown **Karya** (4 Demo Aplikasi Mobile → /karya#apk, 6 Demo Web Live → /karya#web, Proyek Asli ML & Otomasi → /karya#proyek), Proses, FAQ, **toggle bahasa ID/EN yang benar-benar berfungsi** (GATRA hanya menampilkan label statis), dan tombol CTA "Konsultasi Gratis".
  - Dropdown terbuka saat hover atau klik, dan tertutup oleh Esc, klik di luar, atau focus-out. Lengkapi `aria-expanded`.
  - Setelah scroll lebih dari 4px, navbar mendapat bayangan dan latar semi-opaque solid (jangan `backdrop-filter`).
  - Di ≤960px: menu hamburger fullscreen dengan animasi tirai (pakai gaya CurtainGL atau clip-path), tertutup saat klik link, resize, atau klik di luar.
- **Tombol WhatsApp melayang** di kanan bawah: pulse halus, tooltip "Chat kami", dan tetap di atas progress rail.
- **Footer 4 kolom:**
  - Brand blurb;
  - Layanan (4 link);
  - Portofolio (Semua Karya, 3 studi kasus, GitHub);
  - Kontak (email, WhatsApp, "Indonesia — remote friendly").
  
  Di bawahnya: copyright dan baris "bagian dari ekosistem …" (bisa dikonfigurasi). Latar footer adalah scene malam mini: siluet bukit SVG ringan dengan beberapa kunang-kunang (pakai Particles tier rendah).
- **Transisi antar-halaman:** tirai cahaya/kabut (pakai shader CurtainGL atau fallback CSS clip-path). Durasi ≤700ms, dan bisa di-skip dengan `prefers-reduced-motion`.
- **Kursor kustom, progress rail, dan tombol suara** tetap ada di beranda. Di halaman lain, progress rail berubah menjadi bar progres baca di atas.

## Beranda: urutan section

Pembuka tetap memakai 3 scene ilustrasi. Copy-nya diselaraskan menjadi cerita studio: *Jelajah* = ide, *Ketenangan* = proses yang tenang dan transparan, *Biodiversitas* = ekosistem produk. Setelah scene terakhir, kamera "mendarat", lalu section konten mengikuti dengan scroll normal (bukan pinned):

1. **Hero copy** (di dalam scene 1)
   - Isi: badge "Studio software & otomasi untuk bisnis Indonesia", headline besar dengan reveal SplitText per karakter, subjudul, CTA "Konsultasi via WhatsApp" (tombol magnetik), dan CTA "Pelajari ekosistem GAMADA ↓". Di bawahnya label "Demo interaktif · coba langsung di browser".
   - **4 stat counter** (Halaman & Demo, Aplikasi Mobile, Proyek Enterprise, Respons 24 Jam) yang menghitung naik saat terlihat.
2. **Sekilas tentang GAMADA**
   - Panel 3 screenshot dashboard dalam frame perangkat yang melayang dengan parallax kecil mengikuti pointer.
   - Saat masuk viewport, panel terbuka dari tumpukan (stagger).
3. **Layanan (#layanan)**
   - 4 kartu: Website & Web App, Aplikasi Mobile, Machine Learning & AI, POS & Sistem Bisnis. Masing-masing berisi deskripsi, jumlah demo, dan link ke demonya.
   - Kartu memakai tilt 3D halus + spotlight radial yang mengikuti kursor. Ikon kartu beranimasi (garis SVG tergambar saat hover).
4. **Portofolio unggulan**
   - 3 kartu: PhoneFarm, Sistem Automasi, 4 Demo Aplikasi Mobile. Masing-masing punya tag (Proyek Asli, Otomasi, AI, Live Demo, Mobile).
   - Gambar zoom saat hover, tag muncul ber-stagger, dan ada link "Lihat semua karya →".
5. **Ekosistem (#integrasi)**
   - Diagram interaktif "satu panel — semua perangkat & layanan": node Website, App, Otomasi, AI, Infrastruktur, Dashboard yang terhubung garis.
   - Garis tergambar mengikuti scroll (SVG stroke-dashoffset). Hover sebuah node akan menyorot koneksinya dan menampilkan penjelasan.
6. **Security & Governance (#keamanan)**
   - 4 kartu: SSH key-only, firewall (port 22/80/443), SSL auto-renew, hardening production.
   - Animasi: gembok yang "terkunci", serta terminal mini yang mengetik perintah (mis. `ufw status`) saat terlihat.
7. **Kenapa GAMADA (#fondasi)**
   - 6 fitur: ekosistem terintegrasi, keamanan & compliance, operasional efisien, insight berbasis data, scalable, berbasis lokal.
   - Layout bento grid dengan reveal bertahap.
   - **Strip 4 stat kedua:** 6 Demo Website, 4 Demo Aplikasi, 3 Studi Kasus, Balas 24 Jam.
8. **Testimoni (#testimoni)**
   - 3 kartu berlabel "ilustrasi, bukan ulasan klien asli" dalam carousel drag/swipe dengan inersia (GSAP Draggable + Inertia, atau implementasi sendiri). Ada autoplay yang berhenti saat hover.
9. **FAQ ringkas (#faq)**
   - 4 pertanyaan dalam accordion (tinggi animasi halus, ikon ▾ berputar) dan link ke /faq.
10. **CTA penutup + Kontak (#kontak)**
    - Panel besar bergaya scene senja: "Punya ide? Ngobrol dulu, gratis."
    - Isinya tombol WhatsApp, email, dan **form kontak** (nama, kebutuhan, pesan) yang membuka WhatsApp dengan teks terisi otomatis (tanpa backend).
    - Validasi ramah, plus pesan sukses yang beranimasi.

## /karya

- Hero "Semua karya. Semua beneran jalan." dengan tab filter **Demo Web / Demo Aplikasi / Proyek Asli**.
  - Tab bekerja sebagai filter beranimasi (GSAP Flip) **dan** tetap sinkron dengan anchor `#web`, `#apk`, `#proyek` di URL.
- **#web:** 9 kartu.
  - 6 demo: KasirKu (POS), SmartCast (podcast), GoKantin (kantin), Kopi Senja (company profile), Tiket.in (festival), LENSA (sewa kamera).
  - 3 web app production: PhoneFarm panel, Sistem Automasi, ScrapPulse.
- **#apk:** 4 demo dalam frame ponsel 3D (sedikit berputar mengikuti pointer): Jajan.in, GymKuy, Fokusin, Racunin.
- **#proyek:** 3 studi kasus: PhoneFarm, Sistem Automasi, ScrapPulse.
- Setiap kartu punya tag teknologi, badge "Live Demo" (warna teal, berkedip pelan), efek hover lift dan zoom, serta link ke `/karya/:slug`.

## /karya/:slug: 13 halaman yang harus berfungsi di browser

Semua data dummy diletakkan di `src/content/demos/*.ts`. State disimpan di memori/`localStorage` dan bisa di-reset. Setiap halaman demo punya bar atas "← Kembali ke Karya · Demo oleh GAMADA". Gaya visual demo boleh berbeda dari GAMADA (masing-masing brand fiktif), tapi bingkainya tetap GAMADA.

**Demo web (6)**
1. **KasirKu (POS):**
   - Tab Dashboard / Transaksi / Produk / Stok / Laporan / Pengaturan, semuanya berisi konten.
   - KPI cards dengan delta harian, grafik 7 hari (SVG, animasi tergambar), top 5 produk, dan tabel transaksi (QRIS/Tunai/Debit).
   - Kasir sederhana: tambah item, total, bayar, lalu transaksi baru muncul di tabel dan stok berkurang.
2. **SmartCast (podcast):** hero dan statistik, player audio kustom (play/pause, seek, waveform beranimasi dari Web Audio), 3 episode trending, fitur "Kenapa SmartCast", dan CTA kreator.
3. **GoKantin:** menu 6 item, tombol "+ Keranjang" dengan counter melompat, drawer keranjang (ubah qty, total), checkout QRIS dummy (QR SVG + countdown), dan 3 langkah "Cara Order".
4. **Kopi Senja:** company profile (hero, menu signature, cerita brand, jam buka, lokasi/peta statis, Instagram block) dengan nuansa hangat.
5. **Tiket.in:**
   - Hero video dengan tombol pause dan **countdown live** (hari/jam/menit/detik) ke tanggal acara.
   - Lineup 3 hari dan 3 tier harga (Presale SOLD OUT, Regular, VIP) dengan modal pembelian dummy.
   - Info gate.
6. **LENSA (sewa kamera):** katalog 6 unit dengan badge ketersediaan, filter, dan "Sewa" yang membuka form tanggal (hitung harga × hari + deposit). Unit yang sedang disewa di-disable. Sertakan 3 langkah sewa.

**Demo aplikasi mobile (4)**, dalam frame ponsel, masing-masing dengan 4 tab bawah yang semuanya berfungsi:

7. **Jajan.in:**
   - Beranda: saldo bulanan, chip tambah cepat (Kopi/Makan/Ojol/Snack), grafik 7 hari, daftar hari ini.
   - Statistik: per kategori dan insight.
   - Target: tombol 2 jt / 2,5 jt / 3 jt yang meng-update progress.
   - Profil: toggle pengaturan dan Reset demo.
8. **GymKuy:**
   - Mulai: checklist latihan, counter, dan streak.
   - Jadwal: 6 hari, tap untuk tandai selesai.
   - Progres: grafik kalori dan personal record.
   - Badge: 6 badge, 2 terbuka, dengan animasi unlock.
9. **Fokusin:**
   - Fokus: timer Pomodoro (25/50/15 menit, mulai/jeda/reset), progres berupa ring SVG.
   - Tugas: tambah tugas dan coret yang selesai.
   - Statistik: grafik menit fokus.
   - Setelan: toggle pengaturan.
10. **Racunin:**
    - Beranda: chip kategori dengan empty state; tap kartu untuk favorit (animasi hati).
    - Peta: peta stylized dengan pin yang memunculkan popup.
    - Favorit: daftar favorit dan Reset.
    - Profil: toggle pengaturan.

**Studi kasus (3)**, dengan template sama:
- hero dan 4 stat;
- diagram alur yang tergambar saat scroll;
- galeri screenshot (lightbox);
- kartu fitur;
- callout keamanan;
- chip tech stack;
- slot video (tampilkan poster rapi, **bukan** catatan developer, jika video belum ada).

Isi masing-masing:
11. **PhoneFarm:** 20 slot HP, alur scrcpy → FFmpeg → WebSocket → browser → ADB.
12. **Sistem Automasi:** 3 engine (Auto Komen ber-AI dengan 3 tone, Auto Edit Video 9:16, Auto Upload) dan alur antrian Celery/Redis.
13. **ScrapPulse:** 5 sumber publik, sentimen ID+EN, 3 output, pipeline NLP.

## /tools, /tools/scrappulse, /panel/phonefarm

Ketiganya versi **UI demo** (tanpa backend). Data diambil dari fixture, dan tombol aksi menampilkan simulasi progres. Jika backend asli tersedia, URL bisa diatur di `site.ts`.
- **/tools:** kartu Auto Komen & Like (Tersedia), Auto Edit Video (Tersedia), Auto Upload (Coming Soon), dan Pipeline Edit→Upload→Komen (Coming Soon). Ada counter live "pengguna online / bot berjalan" (simulasi), panduan "Cara Pakai", dan disclaimer.
- **/tools/scrappulse:** input hingga 4 kata kunci, chip periode 7/14/30 hari, chip bahasa ID/EN, dan tombol "Analisis". Setelah ditekan: progres bertahap (mengumpulkan → membaca artikel → NLP → laporan), lalu dashboard hasil (volume, sentimen, topik, kutipan) dari fixture. Sertakan modal "Tentang mesin ini" dan tombol unduh JSON/CSV dari data fixture.
- **/panel/phonefarm:** grid 20 slot perangkat (status online/offline, layar placeholder beranimasi) dan panel kendali (tap/swipe/ketik disimulasikan).

## /proses dan /faq

- **/proses:** hero "Dari ide sampai live, tanpa drama" dan 4 langkah:
  1. Konsultasi gratis (balas ≤24 jam);
  2. Rancang & validasi;
  3. Bangun & update rutin;
  4. Launch & garansi.
  
  Tampilkan sebagai **timeline vertikal pinned**: jalur sungai/setapak SVG tergambar mengikuti scroll, dan tiap langkah menyala saat dicapai. Di bawahnya strip 4 stat dan CTA.
- **/faq:** 5 pertanyaan:
  1. Bedanya dengan agensi lain?
  2. Berapa biaya & berapa lama?
  3. Aku nggak ngerti teknis, gimana?
  4. Setelah launching masih dibantuin?
  5. Data & akses aman nggak?
  
  Tambahkan pencarian FAQ (filter langsung, menyorot kata yang cocok), accordion yang bisa di-deep-link (`/faq#biaya`), dan CTA WhatsApp di bawah.

## Bahasa animasi (konsisten di semua section baru)

Gunakan util bersama di `src/lib/reveal.ts`. Jangan menulis ulang animasi di tiap komponen.

| Elemen | Animasi |
|---|---|
| Judul section | SplitText per baris, mask dari bawah, stagger 0.08, ease `CustomEase` yang sudah ada |
| Eyebrow / badge | fade + garis tipis yang memanjang |
| Kartu | muncul dari bawah 24px + opacity, stagger 0.06, `ScrollTrigger.batch` |
| Angka statistik | count-up saat 60% terlihat, sekali saja |
| Gambar / screenshot | clip-path reveal + scale 1.08 → 1 |
| Diagram / garis | stroke-dashoffset di-scrub oleh scroll |
| Hover kartu | tilt maksimal 6°, spotlight radial mengikuti kursor, shadow glow lavender |
| CTA utama | tombol magnetik (komponen yang sudah ada) |
| Latar section | partikel/kunang-kunang tier rendah dan gradien senja yang bergeser pelan; tanpa blur yang dianimasikan |
| Pergantian halaman | tirai kabut |

Aturan performa animasi:
- Animasikan hanya `transform` dan `opacity`.
- Tidak boleh ada `backdrop-filter`, `filter: blur()` yang dianimasikan, atau `mix-blend-mode` di elemen besar.
- Satu loop RAF (`gsap.ticker`).
- Efek WebGL dan partikel hanya berjalan saat section-nya terlihat (IntersectionObserver).
- Semua animasi patuh `prefers-reduced-motion` (fallback: fade sederhana) dan flag `?off=`.
- Tambahkan flag baru di `src/lib/motion.ts`: `cardTilt`, `statCounter`, `pageCurtain`, `sectionParticles`.

## SEO, aksesibilitas, kualitas

- Title dan meta description per route; Open Graph dan Twitter card dengan gambar OG dari scene hero; JSON-LD (`Organization`, `WebSite`, `FAQPage` untuk /faq, `CreativeWork` untuk studi kasus); `sitemap.xml`; `robots.txt`; canonical; `lang` yang mengikuti toggle bahasa.
- Teks i18n diletakkan di `src/content/i18n/{id,en}.ts`. Semua copy dibuat dalam dua bahasa.
- Aksesibilitas: navigasi keyboard penuh, focus ring, skip link, `aria` untuk dropdown/accordion/tabs/modal, alt text, kontras AA, dan konten tetap terbaca tanpa JS (minimal pada heading dan teks).
- Responsif: 360, 390, 768, 1024, 1440, dan 1920px. Tidak boleh ada scroll horizontal.
- Lighthouse (mobile): Performance ≥85, Accessibility ≥95, Best Practices ≥95, SEO 100.

## Struktur kode

```
src/
  routes/            Home, Karya, KaryaDetail, Proses, Faq, Tools, ScrapPulse, PhoneFarmPanel, NotFound
  sections/          Hero, About, Services, Portfolio, Ecosystem, Security, Why, Stats, Testimonials, FaqPreview, Contact
  demos/             kasirku/, smartcast/, gokantin/, kopisenja/, tiketin/, lensa/, jajanin/, gymkuy/, fokusin/, racunin/
  components/ui/     Button, Card, Tag, StatCounter, Accordion, Tabs, Modal, Drawer, PhoneFrame, DeviceFrame, Lightbox
  content/           site.ts (kontak, angka, URL — TODO), i18n/, demos/, cases/
  lib/reveal.ts      util animasi bersama
```

## Fase kerja (berhenti dan laporkan setelah tiap fase)

1. **Fondasi:** router, layout global (navbar + dropdown + mobile menu + toggle ID/EN + WA float + footer), token warna, `site.ts`, i18n, transisi halaman. Beranda: 3 scene tetap utuh.
2. **Beranda lengkap:** section 1–10 beserta animasinya.
3. **/karya + 6 demo web.**
4. **4 demo aplikasi mobile.**
5. **3 studi kasus + /tools + ScrapPulse + panel PhoneFarm.**
6. **/proses, /faq, 404.**
7. **SEO, aksesibilitas, responsif, performa:** jalankan `npm run build`, `npm run perf`, dan Lighthouse. Perbaiki sampai semua target tercapai, lalu tulis ringkasan di `docs/PERF.md`.

Setiap fase harus lolos `npm run typecheck` dan `npm run build`, tanpa error console, dan disertai screenshot `node tools/shot.mjs` di 1440×900 dan 390×844 yang disimpan ke `docs/shots/<fase>/`. Jangan mengubah file seni di `src-art/` kecuali diminta.
