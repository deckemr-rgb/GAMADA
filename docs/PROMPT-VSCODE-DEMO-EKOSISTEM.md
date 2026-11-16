# Prompt VS Code: Demo Interaktif Ekosistem GAMADA (17 produk + GAMADA Inti)

> Model: **Opus 5.5 · effort High · ultracode**.
> Bacaan wajib sebelum mulai: `README.md`, `docs/CONTRACTS.md`, `docs/PERF.md`, `src/content/`, `src/components/ui/`, `src/sections/Ecosystem.tsx`.

## Bagian 0 · Cara pakai (untuk pemilik proyek, bukan untuk agent)

1. **Commit dulu.** Pastikan pekerjaan Fase 2 sudah ter-commit (repo sudah berupa git).
2. **Isi nama daerah.** Ganti ketiga placeholder di bawah dengan 2–3 daerah nyata. Pilih yang beragam supaya demo terasa luas, misalnya satu kabupaten agraris, satu kota, dan satu daerah pesisir/rawan bencana:
   - `[DAERAH_1]` = …………… (region pack utama, dipakai di tur)
   - `[DAERAH_2]` = ……………
   - `[DAERAH_3]` = ……………
3. **Siapkan key opsional** (boleh menyusul; tanpa key demo tetap jalan dalam mode simulasi):
   - `ANTHROPIC_API_KEY`, untuk mode AI Live;
   - API key penyedia tile peta (vektor + satelit).
4. **Atur Claude Code.** Pilih model Opus 5.5 dengan effort High, lalu naikkan opsi "Dynamic workflow size" di config.
5. **Kirim prompt bertahap.** Salin semua isi di bawah garis ke chat. Setelah agent melapor, balas `lanjut tahap N`.

---

ultracode

# PROMPT

## 1 · Konteks

Kamu bekerja di repo **GAMADA**, website studio digital:
- Vite 8, React 19, TypeScript strict, react-router 7 (data router, lazy route);
- GSAP 3.15 (ScrollTrigger, SplitText, CustomEase), Lenis, OGL, Tailwind 4;
- Fraunces + Manrope;
- toggle bahasa ID/EN.

Situs ini berisi tiga scene ilustrasi senja yang sinematik, transisi seam, WebGL (air terjun, partikel, tirai), burung boids, god rays, kursor kustom, tirai antarhalaman, dan beranda dengan sembilan section. Semuanya punya sistem performa: tier, `?degrade`, `?off=`, `?debug=fps`, `npm run perf`. Patuhi `docs/CONTRACTS.md` dan `docs/PERF.md`.

GAMADA sekarang menawarkan **ekosistem produk AI untuk pemerintah daerah dan bisnis di Indonesia**: satu fondasi (**GAMADA Inti**), tiga ekosistem, dan 17 produk. Tugasmu adalah membangun **demo interaktif untuk seluruh produk itu di dalam website GAMADA**. Pengunjung (calon klien: kepala daerah, kepala dinas, direktur bank, pemilik usaha) harus bisa **mencoba sendiri secara end-to-end**, dan setiap demo harus memberi **efek "wow"**.

## 2 · Keputusan yang sudah final

Jangan dibahas ulang:

1. **Ekosistem menjadi tawaran utama.**
   - KasirKu dilebur menjadi modul *Kasir* di **Toko Autopilot**.
   - ScrapPulse menjadi mesin analisis **Radar Isu** dan **Pantau Merek**.
   - Produk lain dari fase sebelumnya (GoKantin, Kopi Senja, Tiket.in, LENSA, SmartCast, Jajan.in, GymKuy, Fokusin, Racunin, PhoneFarm, Sistem Automasi) tetap di `/karya` sebagai portofolio. Prompt ini tidak membangun ulang produk-produk tersebut.
2. **AI hybrid.** Bawaannya **mode Simulasi**: berskenario, deterministik, gratis, selalu jalan, tanpa server. Jika server proxy AI aktif dan punya key, pengunjung bisa menyalakan **mode Live** untuk bertanya bebas ke Claude. Kalau Live gagal atau lambat, demo otomatis kembali ke Simulasi tanpa merusak alur.
3. **Daerah nyata lewat "region pack".** Peta, batas wilayah, nama kecamatan/desa, sungai, pasar, landmark, dan statistik publik diambil dari sumber nyata. Catatan transaksional (aduan, surat, tender, transaksi toko, berita) adalah **data simulasi** yang dibangkitkan dari seed.
   - Ada 2–3 region pack: `[DAERAH_1]` (utama, dipakai tur), `[DAERAH_2]`, `[DAERAH_3]`.
   - Region pack bisa diganti dari demo mana pun.
4. **Format: tur + sandbox.** Ada satu tur sinematik berpemandu, **"Satu Hari di [DAERAH_1]"**, yang menunjukkan ke-17 produk saling terhubung. Selain itu setiap produk punya **sandbox bebas** yang bisa diklik sepuasnya.
5. **Dua bahasa (ID + EN)** mengikuti toggle yang sudah ada. Konten bahasa daerah per region pack dipakai untuk fitur yang memerlukannya.
6. **Proxy AI portabel.** Satu kode server berjalan di Node/Docker (VPS), Vercel, Netlify, dan Cloudflare Workers lewat adapter tipis. Hosting belum diputuskan.
7. **Kualitas visual kelas internasional, setara dengan website GAMADA sendiri.** Demo bukan mockup statis: tidak boleh ada tombol mati.

## 3 · Peta produk (sumber kebenaran nama dan slug)

| Kode | Nama lengkap | Slug | Ekosistem | Aksen |
|---|---|---|---|---|
| P0 | GAMADA Inti: Platform AI Terpadu | `inti` | Fondasi | lavender-putih |
| P1 | Sapa Warga: Asisten Layanan Publik AI | `sapa-warga` | Satu Daerah | teal |
| P2 | Meja Pimpinan: Command Center Kepala Daerah | `meja-pimpinan` | Satu Daerah | teal |
| P3 | Naskah Pintar: Notulen & Disposisi AI | `naskah-pintar` | Satu Daerah | teal |
| P4 | Radar Isu: Intelijen Opini Publik | `radar-isu` | Satu Daerah | teal |
| P5 | Siaga Wilayah: Geo-AI Peringatan Dini | `siaga-wilayah` | Satu Daerah | teal |
| P6 | Awas Belanja: Pengawas Pengadaan AI | `awas-belanja` | Satu Daerah | teal |
| P7 | Cek Berkas: Verifikasi Dokumen Otomatis | `cek-berkas` | Satu Daerah | teal |
| P8 | Toko Autopilot: Operasional Retail & F&B | `toko-autopilot` | Usaha Pintar | peach |
| P9 | Pajak Beres: Copilot Pembukuan & Pajak | `pajak-beres` | Usaha Pintar | peach |
| P10 | Juara Jualan: QA & Coaching Tim Penjualan | `juara-jualan` | Usaha Pintar | peach |
| P11 | Kenal Mitra: Verifikasi Pelanggan, Mitra & Kandidat | `kenal-mitra` | Usaha Pintar | peach |
| P12 | Pantau Merek: Monitoring Reputasi Brand | `pantau-merek` | Usaha Pintar | peach |
| P13 | TenderPilot: Asisten Tender untuk Vendor | `tenderpilot` | Usaha Pintar | peach |
| P14 | Katalog Lokal: Etalase UMKM untuk Belanja Pemda | `katalog-lokal` | Pasar Daerah | plum-lavender |
| P15 | Rapor Usaha: Skor Kesehatan Bisnis | `rapor-usaha` | Pasar Daerah | plum-lavender |
| P16 | Indeks Ekonomi Daerah: Dasbor Ekonomi Lokal | `indeks-ekonomi` | Pasar Daerah | plum-lavender |
| P17 | Sinyal Pasar: Peringatan Harga & Pasokan | `sinyal-pasar` | Pasar Daerah | plum-lavender |

Nama ekosistem:
- **GAMADA Satu Daerah** (slug `satu-daerah`), untuk Pemda;
- **GAMADA Usaha Pintar** (`usaha-pintar`), untuk bisnis;
- **GAMADA Pasar Daerah** (`pasar-daerah`), jembatan Pemda ↔ UMKM.

## 4 · Arsitektur informasi & rute

Tambahkan rute berikut ke `src/router.tsx`. Semua rute baru dimuat lazy, dan loader didaftarkan di `src/routeLoaders.ts`.

| Rute | Isi |
|---|---|
| `/ekosistem` | Hub ekosistem: konstelasi interaktif 17 produk dalam 3 gugus + Inti di pusat, CTA utama "Mulai tur" dan "Jelajahi produk" |
| `/ekosistem/:eco` | Halaman ekosistem (`satu-daerah`, `usaha-pintar`, `pasar-daerah`, `inti`): cerita, alur antarproduk, daftar produk, CTA tur bab terkait |
| `/produk/:slug` | Halaman produk: cerita + mini-demo live yang diputar otomatis + tombol "Coba demo penuh" |
| `/demo/:slug` | Sandbox penuh layar di dalam DemoShell |
| `/tur` | Tur "Satu Hari di [Daerah]": pemutar bab, mode presenter, ringkasan akhir |
| `/tur/:bab` | Deep link ke bab tertentu (untuk presentasi) |
| `/lab` | Pengganti `/tools`: grid semua demo + alat portofolio. `/tools` di-redirect ke `/lab` |

Redirect produk lama:
- `/karya/kasirku` → `/produk/toko-autopilot#kasir`
- `/tools/scrappulse` → `/demo/radar-isu?tab=analisis`

Kartu KasirKu dan ScrapPulse di `/karya` diganti kartu "Kini bagian dari Toko Autopilot / Radar Isu".

Query string yang berlaku di semua rute demo:
- `?region=<id>`
- `?role=<id>`
- `?t=<HH:MM>` (jam dunia demo)
- `?ai=sim|live`
- `?lang=id|en`
- `?present=1` (mode presenter)
- `?seed=<n>`

State bisa dibagikan lewat URL.

Integrasi ke situs yang sudah ada:
- **Navbar:** item baru **"Ekosistem"** sebelum "Karya". Dropdown berisi Satu Daerah, Usaha Pintar, Pasar Daerah, GAMADA Inti, garis pemisah, dan "Tur: Satu Hari di [Daerah]". Mobile menu ikut diperbarui.
- **Beranda:**
  - section *Layanan* menjadi tiga kartu ekosistem;
  - section *Ekosistem* (`src/sections/Ecosystem.tsx`) diubah menjadi teaser yang mengarah ke `/ekosistem`, dengan node = 3 ekosistem + Inti;
  - CTA hero kedua menjadi "Lihat demo ekosistem →";
  - section *Portofolio* menampilkan 3 demo unggulan: Sapa Warga, Siaga Wilayah, Toko Autopilot.
- **Footer:** kolom baru "Ekosistem".
- **Statistik beranda:** angka dihitung dari registry produk, tidak diketik manual.

## 5 · Struktur kode

```
src/
  demo-kit/                      fondasi demo (dipakai semua produk)
    shell/                       DemoShell, TopBar, RoleSwitcher, RegionSwitcher, ClockControl, AiModeToggle,
                                 ResetButton, GuidePanel, Hotspot, CoachMark, EventToast, ModeBadge, FullscreenButton
    frames/                      BrowserFrame, PhoneFrame, TabletFrame, WallScreenFrame, PaperFrame (dokumen/surat)
    world/                       store.ts (state dunia), events.ts (event bus bertipe), clock.ts (jam dunia),
                                 seed.ts (PRNG + generator data), persist.ts (IndexedDB per browser), selectors.ts
    region/                      types.ts (skema RegionPack), loader.ts, packs/<regionId>/... (data + geojson)
    ai/                          provider.ts (interface), scripted/ (mesin skenario), live.ts (klien proxy SSE),
                                 intents.ts (pencocok intent ringan), stream.ts (efek mengetik + latensi realistis)
    viz/                         chart primitives (Line, Area+band, Bar, Donut, Gauge, Radar, Sankey-lite, Network,
                                 Sparkline, Heat), skala (d3-scale/d3-shape), format angka Rupiah/persen/tanggal WIB
    map/                         MapView (MapLibre, lazy), layer helpers, choropleth, heat, animasi hujan/genangan
    docs/                        DocViewer (gambar dokumen + bounding box OCR), ExtractPanel, TamperHeatmap
    media/                       VoiceRecorder (Web Speech API), Waveform, AudioPlayer, TTS (speechSynthesis)
    tour/                        engine.ts (DSL bab), Player, PresenterView, ChapterList, Summary, Narration
    ui/                          komponen produk bersama (Table, Kanban, Inbox, Timeline, KPI, Badge, Chip, Tabs,
                                 Drawer, Modal, Toast, Skeleton, EmptyState, Stepper, Score, Avatar, Kbd)
    i18n/                        kunci teks demo (id.ts, en.ts) + helper bahasa daerah dari region pack
  demos/<slug>/                  satu folder per produk: index.tsx (sandbox), screens/, scenario.ts (skenario AI simulasi),
                                 data.ts (generator khusus), events.ts (emit/consume), mini.tsx (mini-demo autoplay
                                 untuk /produk), copy.ts (teks halaman produk), test.spec.ts (Playwright)
  routes/  Ekosistem.tsx, EkosistemDetail.tsx, Produk.tsx, Demo.tsx, Tur.tsx, Lab.tsx
  content/products.ts            registry 17 produk + 3 ekosistem + Inti (nama, slug, tagline ID/EN, aksen, ikon, relasi)
server/ai-proxy/                 proxy AI portabel (lihat §10)
```

Aturan kode:
- TS strict, sesuai konvensi di `docs/CONTRACTS.md`.
- Satu loop RAF lewat `gsap.ticker`.
- Bersihkan semua listener, ticker, dan konteks WebGL saat unmount.
- Setiap folder `demos/<slug>` menjadi chunk sendiri, dan MapLibre menjadi chunk sendiri yang hanya dimuat demo berpeta.
- Dependensi baru diperbolehkan, cukup yang benar-benar perlu:

  | Paket | Kegunaan |
  |---|---|
  | `maplibre-gl` | peta |
  | `d3-scale`, `d3-shape`, `d3-array` | grafik |
  | `idb-keyval` | penyimpanan IndexedDB |
  | `zod` | validasi |
  | `@tanstack/react-table` | tabel |
  | `hono` | server proxy |

  Dependensi lain harus dilaporkan beserta alasannya. Jangan memakai library UI siap pakai (MUI, AntD, shadcn utuh); komponen dibuat sendiri agar sesuai identitas GAMADA.

## 6 · Fondasi Demo Kit (detail)

### 6.1 Dunia demo (world store)

Semua produk berbagi **satu dunia simulasi** di browser. Inilah yang membuat demo terasa sebagai ekosistem: aksi di satu produk benar-benar muncul di produk lain.

- **State dunia** (TypeScript, dinormalisasi per entitas):
  `region`, `clock` (jam dunia, kecepatan ×1/×10/×60, pause), `roles`, `citizens`, `complaints`, `tickets`, `letters`, `meetings`, `actionItems`, `mentions`, `hoaxAlerts`, `alerts` (bencana), `rainCells`, `procurements`, `bidders`, `documents`, `verifications`, `businesses` (UMKM), `outlets`, `products`, `sales`, `stock`, `purchaseOrders`, `suppliers`, `ledger`, `taxItems`, `calls`, `chats`, `agentsSales`, `candidates`, `brandMentions`, `tenders`, `bids`, `catalogNeeds`, `matches`, `bizScores`, `loanApps`, `econIndex`, `prices`, `markets`, `auditLog`.
- **Event bus bertipe** (`events.ts`) dengan union `WorldEvent`. Setiap event punya `id`, `at` (jam dunia), `source` (slug produk), dan `payload`. Contoh:
  - `complaint.created`, `complaint.clustered`, `ticket.statusChanged`
  - `briefing.generated`, `instruction.issued`
  - `meeting.transcribed`, `actionItem.created`, `letter.dispositioned`
  - `hoax.detected`, `clarification.published`
  - `rain.forecast`, `flood.alert`, `alert.broadcast`
  - `procurement.flagged`, `document.verified`
  - `stock.forecastChanged`, `po.sent`, `supplier.replied`
  - `ledger.posted`, `tax.ready`
  - `call.scored`, `coaching.assigned`
  - `partner.verified`, `brand.alert`
  - `tender.matched`, `bid.submitted`
  - `need.created`, `match.made`
  - `score.updated`, `loan.applied`
  - `econ.updated`, `price.anomaly`, `market.operation`

  Setiap event otomatis menulis satu baris ke `auditLog`, yang ditampilkan di GAMADA Inti.
- **Reaksi lintas produk** didefinisikan di satu tempat (`world/reactions.ts`), sebagai fungsi murni `event → perubahan state + event lanjutan`. Contoh:
  - `flood.alert` menaikkan permintaan karung pasir/pompa di Toko Autopilot dan memicu kebutuhan di Katalog Lokal.
  - `price.anomaly` memicu rekomendasi `market.operation` di Meja Pimpinan.
- **Seed deterministik:** PRNG mulberry32 dengan `seed` dan `regionId`. Generator memakai nama Indonesia yang beragam (Jawa, Sunda, Batak, Minang, Bugis, Tionghoa-Indonesia, dll., sesuai region), alamat diambil dari kelurahan nyata di region pack, dan angka realistis.
- **Persistensi per browser** lewat IndexedDB (namespace per region + seed). Tombol **Reset** mengembalikan dunia ke seed, dengan konfirmasi kecil dan animasi "putar balik jam". Dunia juga bisa diekspor/impor sebagai JSON (opsi tersembunyi untuk presenter).
- **Performa:** selector ter-memo; event diproses di luar render (microtask); maksimal 5.000 entitas per jenis; list panjang divirtualisasi.

### 6.2 Jam dunia

- `ClockControl` di TopBar: jam digital (Fraunces, angka tabular), tombol play/pause, kecepatan ×1/×10/×60, dan "Lompat ke…" (06:00, 07:00, 10:00, 13:00, 16:00, 17:00).
- Saat jam berjalan, generator memunculkan kejadian alami: aduan baru, transaksi toko, mention berita, perubahan harga. Ritme mengikuti jam (ramai pagi dan siang, sepi malam). Bisa dimatikan agar demo tenang saat presentasi.

### 6.3 DemoShell (bingkai semua sandbox)

**TopBar** setinggi 56px, latar `--c-ink` solid dengan garis bawah 1px lavender 12%. Isinya dari kiri ke kanan:
1. Logo GAMADA kecil dan breadcrumb (`Ekosistem / Satu Daerah / Sapa Warga`).
2. Nama produk dengan titik aksen ekosistem.
3. RegionSwitcher: dropdown berisi bendera wilayah generik dan nama daerah.
4. RoleSwitcher: avatar, nama peran, dan dropdown peran yang relevan untuk produk itu.
5. ClockControl.
6. AiModeToggle: pill "Simulasi" / "Live". Pill Live diberi titik teal berdenyut saat aktif, dan disabled dengan tooltip bila proxy tidak tersedia.
7. ModeBadge: chip kecil "Mode Demo".
8. Tombol bahasa, Reset, Fullscreen, dan "← Kembali ke produk".

Bagian lain shell:
- **Kanvas:** area demo. Ukuran dan bingkainya ditentukan per produk (BrowserFrame, PhoneFrame, atau kombinasi split).
- **GuidePanel**, laci kanan yang bisa disembunyikan (tombol `?`): judul "Coba ini", berisi 3–6 langkah misi per produk dengan checklist yang tercentang otomatis saat langkahnya dilakukan. Misi selesai memunculkan konfeti halus (partikel lavender/peach, ≤1 detik) dan kartu "Lanjut ke produk terkait →".
- **Hotspot:** titik berdenyut (ring teal 2px, scale 1→1.6, opacity 0.8→0) di elemen yang disarankan untuk diklik pertama. Hotspot hilang setelah elemennya diklik. Maksimal 1 hotspot aktif per layar.
- **EventToast:** saat produk ini memicu efek di produk lain, muncul toast di kiri bawah, misalnya "Aduan #SW-0142 diteruskan ke Meja Pimpinan ↗". Toast bisa diklik untuk berpindah ke produk itu dengan state terkait sudah terbuka. Maksimal 3 toast bertumpuk.
- **Command palette** (`Ctrl/Cmd + K`): lompat ke produk, peran, jam, atau region mana pun.
- **Mobile (<768px):**
  - TopBar menyusut menjadi nama produk + menu `⋯`;
  - frame split ditumpuk vertikal dengan tab di atas ("HP Warga" | "Konsol Petugas");
  - semua demo tetap bisa dipakai dengan jempol, dengan target sentuh ≥44px.

### 6.4 Frame perangkat

Semua frame **orisinal**, bukan tiruan piksel merek tertentu.

| Frame | Spesifikasi |
|---|---|
| `BrowserFrame` | Bilah atas 36px, tiga titik netral, address bar berisi URL fiktif produk (mis. `sapawarga.[daerah].go.id` tidak boleh; pakai `demo.gamada.id/sapa-warga`), sudut 14px, bayangan glow lavender halus |
| `PhoneFrame` | Rasio 9:19.5, bezel 10px, notch kapsul, status bar dengan jam dunia; bisa diputar miring 3D sedikit mengikuti pointer (≤6°, nonaktif saat reduced motion) |
| `TabletFrame` | Untuk kasir (Toko Autopilot) |
| `WallScreenFrame` | Untuk Meja Pimpinan mode ruang rapat; perspektif ringan, bezel tipis, pantulan gradien statis |
| `PaperFrame` | Kertas dokumen dengan bayangan, untuk surat/notulen/laporan, siap dicetak |

### 6.5 Peran (RoleSwitcher global)

Peran yang tersedia:
- Warga
- Petugas Layanan
- Kepala Daerah
- Sekretariat/ASN
- Humas/Diskominfo
- BPBD
- Dinas Pertanian
- UKPBJ/Inspektorat
- Loket Perizinan/Dinsos
- Pemilik Toko
- Kasir
- Konsultan Pajak
- Supervisor Sales
- Agen Sales
- Analis KYC/HR
- Brand Manager
- Vendor
- Bank/Koperasi Mitra
- Bappeda
- Disperindag

Setiap produk menentukan peran yang relevan dan peran bawaannya. Pergantian peran mengubah tampilan, misalnya menu yang terlihat dan data milik siapa yang tampil. Ini sekaligus mendemonstrasikan **Inti ID**: satu akun, banyak peran.

## 7 · Region pack (detail)

Skema `RegionPack` (zod + TS), satu folder per daerah di `src/demo-kit/region/packs/<id>/`:

```ts
{
  id, name, type: 'kabupaten'|'kota', province, slogan?: null,
  center: [lng, lat], zoom, bbox,
  boundaries: { kecamatan: GeoJSON, desa?: GeoJSON },          // sumber publik; atribusi dicantumkan di peta
  rivers: GeoJSON, roads?: GeoJSON, landmarks: [{ name, kind: 'pasar'|'mpp'|'kantor'|'bendungan'|'rs'|'sekolah'|'pelabuhan', coord }],
  markets: [{ name, coord }],                                    // pasar tradisional nyata
  stats: { population, households, area_km2, year, source },     // statistik publik + tahun + sumber
  kecamatan: [{ id, name, population, riskFlood: 0..1, riskLandslide: 0..1, mainSector }],
  economy: { sectors: [{ name, share }], commodities: ['beras','cabai rawit','bawang merah',…], umkmCount?: number },
  opd: [{ id, name, short }],                                     // nama dinas sesuai nomenklatur umum
  services: [{ id, name, requirements: [], slaDays, channel }],   // layanan perizinan & adminduk
  languages: { primary: 'id', regional: ['jv'|'su'|'min'|'bug'|…], samples: { greetings, complaintTemplates } },
  hazards: { flood: GeoJSON, landslide?: GeoJSON, drought?: GeoJSON },
  weather: { bmkgAreaCode?: string },                             // untuk data live opsional
  branding: { emblem: 'generic', primaryHue }
}
```

Aturan data:
- **Data geografis dan statistik publik dipakai apa adanya**, dengan atribusi di pojok peta atau tooltip "Sumber". Agent mencari sumber publik terbaik untuk tiap region (batas administrasi, OSM untuk sungai, pasar, dan landmark, BPS untuk statistik, data rawan bencana publik). Kalau sumber/lisensi untuk suatu lapisan tidak jelas, **tanyakan pemilik proyek**.
- **Tokoh, perusahaan, vendor, media, akun media sosial, warga, dan ASN di data simulasi semuanya fiktif.** Pejabat cukup disebut jabatannya ("Bupati", "Kepala Dinas PUPR") tanpa nama orang sungguhan. Lambang daerah diganti emblem generik GAMADA. Nama pasar, sungai, kecamatan, dan landmark tetap nyata.
- Template aduan dan voice note memakai bahasa daerah region tersebut, plus terjemahan ID dan EN. Minimal 12 template per region.
- `[DAERAH_1]` dibuat lengkap duluan (tahap 1). `[DAERAH_2]` dan `[DAERAH_3]` menyusul di tahap 7.
- Region pack bisa diganti tanpa reload penuh. Dunia demo di-reset ke seed region baru, dengan transisi peta "terbang" ke wilayah baru.

## 8 · Bahasa visual demo (kelas internasional)

### 8.1 Dua lapis estetika
1. **Lapis GAMADA** untuk `/ekosistem`, `/produk`, `/tur`, dan `/lab`:
   - estetika sinematik senja yang sama dengan beranda: Fraunces besar, gradien senja, partikel/kunang-kunang tier rendah, reveal SplitText, tirai antarhalaman;
   - patuhi aturan performa.
2. **Lapis aplikasi** untuk isi sandbox: UI produk SaaS modern yang tenang, presisi, dan padat informasi, setara produk SaaS kelas dunia dalam hal kerapian. **Jangan meniru** desain produk lain.
   - Tema gelap senja: permukaan `--c-ink` → `--c-ink-2` → `--c-indigo`.
   - Teks `--c-text` / `--c-muted`.
   - Aksen per ekosistem: teal `--c-teal` dan cyan `--c-cyan` (Satu Daerah); peach `--c-peach` dan gold `--c-gold` (Usaha Pintar); plum `--c-plum` dan lavender `--c-lavender` (Pasar Daerah); lavender-putih untuk Inti. Merah `--c-red` hanya untuk status bahaya.
   - Tersedia **tema terang** untuk dokumen dan layar cetak (PaperFrame, laporan PDF).

### 8.2 Token aplikasi

Token ini ditambahkan di `src/demo-kit/ui/tokens.css`, diturunkan dari `src/styles/tokens.css`:

| Kelompok | Nilai |
|---|---|
| Spasi | grid 4px: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 |
| Radius | 6 (chip), 10 (input), 14 (kartu), 20 (panel besar) |
| Garis | 1px `rgba(185,178,255,.12)`; garis aktif 1px aksen 60% |
| Elevasi | 3 level bayangan + inner highlight 1px atas `rgba(255,255,255,.04)`. **Tanpa** `backdrop-filter` dan **tanpa** blur yang dianimasikan |
| Tipografi aplikasi | Manrope 12/13/14/16/20/24/32; angka `font-variant-numeric: tabular-nums`; judul halaman demo boleh Fraunces 28–40 |
| Kepadatan | baris tabel 40px (nyaman) / 32px (padat, toggle) |
| Ikon | satu set garis 1.5px, 20px, dibuat sendiri di `demo-kit/ui/icons.tsx`, gaya sama dengan `sections/ecosystem/icons.tsx` |

### 8.3 Gerak & mikro-interaksi

**Durasi dan easing:**
- Durasi 120ms (hover), 200ms (press/toggle), 320ms (panel/drawer), 600ms (perpindahan layar), 900–1400ms (momen wow).
- Easing memakai `CustomEase` yang sudah ada di `src/lib/motion.ts`. Konstanta durasi baru dimasukkan ke `motion.ts` (grup `DEMO`).

**Pola wajib:**
- Angka KPI bergulir saat berubah (count-up dengan tabular-nums, ≤600ms).
- Baris baru masuk ke tabel/inbox dengan slide-in dari atas 8px + highlight latar aksen 12% yang memudar dalam 1,5 detik.
- Status berpindah kolom kanban dengan GSAP Flip.
- AI "berpikir" ditampilkan sebagai 3 titik berdenyut, lalu jawaban di-stream per token dengan kecepatan realistis 25–45 token/detik dan jeda kecil di tanda baca.
- Hasil AI terstruktur (kategori, OPD tujuan, skor) muncul sebagai chip yang "jatuh" ke tempatnya dengan stagger 60ms.
- Skeleton loading dengan shimmer opacity (bukan gradien bergerak lebar), dan maksimal 400ms di mode simulasi.
- Hover baris/kartu: latar naik 1 level dan garis aksen kiri 2px.
- Fokus keyboard: ring 2px lavender + offset 2px, selalu terlihat.

**Feedback suara** (opsional, ikut toggle suara situs, mati bawaan): klik lembut, notifikasi, dan sukses, masing-masing ≤150ms, dibuat dengan Web Audio di `src/lib/audio.ts`.

`prefers-reduced-motion` mengganti semua gerak dengan fade ≤150ms.

### 8.4 Visualisasi data

- Satu sistem grafik di `demo-kit/viz`. Palet kategori berasal dari token (maksimal 6 warna per grafik) dan diuji kontrasnya di tema gelap.
- Garis 2px; area dengan isi 16%; pita prediksi berupa area 10% + garis putus-putus.
- Tooltip mengikuti pointer, crosshair vertikal, dan angka Rupiah diformat `Rp 1,2 jt` / `Rp 1.250.000` sesuai ruang.
- Grafik tergambar saat pertama terlihat (stroke-dashoffset ≤800ms). Pembaruan data dianimasikan dengan interpolasi, bukan redraw kasar.
- Setiap grafik punya judul, satuan, sumber ("Data simulasi · seed 42"), dan ringkasan teks untuk pembaca layar.

### 8.5 Status kosong, error, dan batas

- Setiap list punya empty state berilustrasi garis kecil bertema senja dengan satu CTA.
- Error di mode Live menampilkan toast "AI Live sedang sibuk, beralih ke Simulasi", lalu alur tetap berlanjut.
- **Tidak boleh ada tombol mati.** Setiap kontrol yang terlihat harus benar-benar melakukan sesuatu di dunia demo. Kalau sebuah fitur sengaja di luar lingkup demo, **jangan tampilkan kontrolnya**.

## 9 · Mesin AI hybrid

### 9.1 Interface

```ts
interface AiProvider {
  mode: 'sim' | 'live'
  chat(req: { product: Slug; role: RoleId; messages: Msg[]; context: unknown; tools?: ToolSpec[] }): AsyncIterable<AiChunk>
  extract(req: { product: Slug; kind: 'document'|'invoice'|'cv'|'ktp-specimen'; image?: Blob; text?: string }): Promise<Extracted>
}
```

`AiChunk` bisa berupa `text`, `tool_call`, `structured`, atau `done`. Komponen UI tidak tahu sedang memakai mode yang mana.

### 9.2 Mode Simulasi (bawaan)

- **Skenario** per produk ada di `demos/<slug>/scenario.ts` dan memakai DSL berikut:
  - `intents`: daftar `{ id, examples: string[] (ID, EN, bahasa daerah), slots?, respond: (ctx, slots) => SimResponse }`;
  - `SimResponse`: teks (bisa bergantung pada state dunia), `structured` (mis. tiket), `toolCalls` yang divisualisasikan sebagai langkah agent, dan `followUps` (chip saran).
- **Pencocok intent:** TF-IDF + n-gram karakter + sinonim ID/daerah, berjalan di browser dengan ambang keyakinan.
  - Di bawah ambang: jawaban fallback yang sopan + chip pertanyaan yang didukung + opsi "teruskan ke petugas".
  - Minimal **25 intent** untuk Sapa Warga dan minimal **10 intent** untuk produk ber-chat lainnya.
- Jawaban simulasi **mengambil angka dari state dunia**, misalnya jumlah aduan hari ini atau stok sekarang, sehingga terasa hidup dan konsisten antarproduk.
- Jalur tur selalu memakai simulasi supaya deterministik.

### 9.3 Mode Live

- Klien `live.ts` memanggil `POST {AI_PROXY_URL}/api/ai/chat` (SSE) dan `/api/ai/extract`.
- `GET /api/ai/health` dicek saat DemoShell dibuka. Hasilnya menentukan apakah toggle Live bisa dipakai.
- Konteks yang dikirim adalah **ringkasan state dunia yang relevan** (maks ±6 KB JSON) + data region pack, sehingga jawaban Live tetap konsisten dengan apa yang terlihat di layar.
- Keluaran terstruktur (tiket, kategori, disposisi, skor) diminta lewat **tool use** dengan schema yang sama seperti `SimResponse.structured`, lalu divalidasi zod di klien. Kalau tidak valid, demo jatuh ke simulasi.
- **Timeout:** 10 detik tanpa token pertama berarti fallback ke simulasi. Fallback juga terjadi saat 429/5xx.

## 10 · Server proxy AI (`server/ai-proxy/`)

Dibangun dengan Hono dan TypeScript. Satu `app.ts` dengan adapter:
- `node.ts` (Docker + Caddy di VPS);
- `vercel.ts` (`api/[...route].ts`);
- `netlify.ts`;
- `worker.ts` (Cloudflare).

Kelengkapan server:
- `Dockerfile`
- `docker-compose.yml`
- `.env.example`
- README dengan cara deploy ke empat target

**Endpoint:**
- `GET /api/ai/health`: mengembalikan `{ ok, models, live: boolean }`.
- `POST /api/ai/chat`: `{ product, role, messages, context }`. Respons SSE stream dengan event `text`, `tool_call`, `done`, `error`.
- `POST /api/ai/extract`: multipart gambar ≤8 MB atau teks. Memakai kemampuan vision model; mengembalikan JSON terstruktur sesuai `kind`.

**Konfigurasi env:**
- `ANTHROPIC_API_KEY`
- `AI_MODEL_FAST` (bawaan `claude-haiku-5-5`, untuk chat cepat)
- `AI_MODEL_SMART` (bawaan `claude-sonnet-5-5`, untuk briefing, notulen, analisis)
- `AI_MAX_OUTPUT_TOKENS`
- `AI_DAILY_TOKEN_BUDGET`
- `RATE_LIMIT_PER_IP` (bawaan 20 permintaan / 10 menit)
- `ALLOWED_ORIGINS`
- `REDIS_URL` (opsional; tanpa Redis rate limit memakai memori)

Gunakan skill `claude-api` untuk detail SDK, streaming, tool use, dan prompt caching. Pakai prompt caching untuk system prompt dan konteks region yang besar.

**System prompt per produk** disimpan di server (`prompts/<slug>.ts`), bukan di klien. Isinya:
- peran AI di produk itu;
- gaya bahasa (sopan, ringkas, Bahasa Indonesia baku-ramah; ikut bahasa pengguna termasuk bahasa daerah; EN bila pengguna memakai EN);
- format keluaran terstruktur;
- batas topik produk.

Hanya slug produk yang terdaftar yang diterima.

**Keamanan:**
- validasi zod;
- batas ukuran input;
- CORS allowlist;
- header keamanan;
- isi dokumen yang diunggah tidak di-log (log hanya metadata dan jumlah token);
- anggaran token harian berhenti dengan rapi, dan klien jatuh ke simulasi.

## 11 · Spesifikasi per produk (mikro)

Format setiap produk:
- **Frame & tata letak**
- **Peran**
- **Layar**
- **Alur demo langkah demi langkah** (semua harus berfungsi)
- **Momen wow**
- **AI**
- **Event** (emit/consume)
- **Misi GuidePanel**
- **Cek lulus**

Angka di spesifikasi adalah target bawaan simulasi dan boleh menyesuaikan data region.

### P1 · Sapa Warga: Asisten Layanan Publik AI

- **Frame:** split 40/60, dengan `PhoneFrame` "HP Warga" di kiri dan `BrowserFrame` "Konsol Petugas" di kanan. Di mobile keduanya menjadi tab.
- **Peran:** Warga (kiri), Petugas Layanan (kanan), Kepala Daerah (melihat ringkasan).

**Layar HP Warga:** UI chat messenger generik dengan label kanal "via WhatsApp" dan nama akun "Layanan [Daerah] (resmi)" berikut centang verifikasi generik. Elemennya:
- gelembung chat;
- tombol tahan-untuk-rekam voice note dengan gelombang suara live;
- lampiran foto (galeri sampel + kamera bila diizinkan) dan bagikan lokasi (pin di peta mini);
- chip pertanyaan cepat;
- kartu interaktif dari AI: checklist syarat, tombol "Ambil antrean", tombol "Lacak tiket".

**Layar Konsol Petugas:**
- Inbox omnichannel (WA/web/telepon) dengan filter kanal, kategori, dan status.
- Kanban tiket: Baru → Diverifikasi → Diteruskan ke OPD → Diproses → Selesai, dengan timer SLA berwarna.
- Detail tiket: ringkasan AI, transkrip voice note (bahasa asli + terjemahan), foto, lokasi di peta mini, OPD tujuan, riwayat, tombol balas cepat dengan draf AI, dan tombol "Gabungkan duplikat".
- Panel "Klaster aduan": peta panas kecil dan daftar klaster.

**Alur:**
1. Pilih persona warga lewat 3 kartu: *Ibu Siti* (bahasa daerah, aduan banjir), *Raka* (pemuda, urus NIB usaha), *Pak Darmo* (lansia, KTP-el rusak).
2. Tanya layanan: "Syarat bikin NIB apa?". AI menjawab dengan kartu checklist (dari `region.services`), estimasi waktu, dan tombol "Isi formulir". Formulir terisi otomatis dari obrolan → pratinjau PDF → "Ambil antrean MPP" (pilih slot 30 menit) → tiket antrean + QR (data fiktif).
3. Voice note:
   - tahan tombol rekam (Web Speech API `id-ID`, atau kode bahasa daerah bila didukung browser), atau pilih "Voice note contoh";
   - gelombang suara diputar, transkrip muncul kata demi kata dengan badge bahasa "Basa Jawa → Indonesia";
   - AI membalas dalam bahasa pengguna + terjemahan kecil; tombol "Dengarkan" membacakan balasan dengan TTS.
4. Aduan: kirim foto contoh genangan + lokasi. AI mengekstrak kategori (Banjir/Genangan), lokasi (kelurahan nyata dari region pack), dan urgensi, lalu membuat tiket `SW-[YYYY]-[####]` dan membalas warga dengan nomor tiket + estimasi SLA. Di Konsol, kartu tiket **masuk secara live** dengan animasi.
5. Petugas memverifikasi lalu "Teruskan ke Dinas PUPR". Status di HP warga diperbarui seketika dengan notifikasi in-chat.
6. Saat ≥5 aduan serupa dalam radius 1 km, klaster terbentuk, muncul EventToast "Klaster banjir Kel. X: 12 aduan → Meja Pimpinan & Siaga Wilayah", dan titik muncul di peta.
7. Petugas menandai Selesai dengan foto "sesudah". Warga diminta rating 1–5, dan skor kepuasan layanan diperbarui.

- **Momen wow:**
  - voice note bahasa daerah yang dipahami dan dibalas dengan suara;
  - dua perangkat sinkron real-time;
  - aduan menjadi klaster di peta;
  - tiket "terbang" dari HP ke Konsol (animasi jalur melengkung ≤900ms, di-skip saat reduced motion).
- **AI:**
  - ≥25 intent: syarat KTP-el, KK, akta lahir, akta kematian, pindah datang, NIB/OSS, PBG, izin usaha mikro, PBB, BPJS daerah, bansos/status penerima, jadwal MPP, lokasi kantor, pengaduan jalan rusak, banjir, sampah, PJU mati, air bersih, pohon tumbang, pungli, layanan kesehatan, sekolah, perizinan reklame, keramaian, dan fallback "teruskan ke petugas".
  - Live: tool `create_ticket`, `lookup_service`, `book_queue`, `ticket_status`.
- **Event:** emit `complaint.created`, `complaint.clustered`, `service.booked`; consume `ticket.statusChanged`, `alert.broadcast` (warga di zona risiko menerima pesan peringatan di HP-nya).
- **Misi:**
  1. Tanya syarat NIB.
  2. Kirim voice note.
  3. Laporkan banjir.
  4. Teruskan tiket ke OPD (sebagai petugas).
  5. Selesaikan tiket dan beri rating.
- **Cek lulus (Playwright):**
  - voice note contoh → tiket muncul di Konsol ≤2 detik;
  - ubah status di Konsol → HP warga diperbarui ≤1 detik;
  - 5 aduan serupa → toast klaster + titik di peta.

### P2 · Meja Pimpinan: Command Center Kepala Daerah

- **Frame:** `WallScreenFrame` lebar (desktop) dengan tombol "Lihat di HP" yang membuka `PhoneFrame` berisi briefing format chat.
- **Peran:** Kepala Daerah (bawaan), Sekda, Kepala OPD.
- **Layar utama (grid 12 kolom):**
  - **Strip KPI atas** (6 kartu): Aduan hari ini (Δ vs kemarin), SLA tepat waktu %, Peringatan aktif, Isu negatif, Tindak lanjut terlambat, Indeks layanan (komposit).
  - **Peta tengah** (region nyata) dengan layer toggle: aduan (heat), risiko bencana, peringatan aktif, harga pasar, proyek.
  - **Panel kanan "Briefing Pagi":** kartu bernomor yang terisi otomatis.
  - **Bawah:** papan peringkat OPD (SLA, tindak lanjut, kepuasan), timeline kejadian hari ini, dan kotak "Tanya data".
- **Alur:**
  1. Jam 07:00, tombol "Susun briefing" (atau otomatis di tur). Briefing **dirakit langsung dari dunia demo**: aduan terbanyak, klaster banjir, prakiraan hujan (Siaga Wilayah), isu viral (Radar Isu), paket pengadaan berisiko (Awas Belanja), anomali harga (Sinyal Pasar), dan tindak lanjut terlambat (Naskah Pintar). Setiap butir muncul berurutan dengan stagger dan berisi tautan ke produk sumbernya.
  2. "Dengarkan briefing (±2 menit)": TTS dengan suara Indonesia; butir yang sedang dibacakan disorot.
  3. Tanya data, misalnya "Kenapa aduan jalan naik minggu ini?". AI menjawab dengan teks + grafik mini + tombol "Lihat kecamatan", dan peta terbang ke kecamatan teratas.
  4. Klik OPD di papan peringkat untuk membuka scorecard (tren 30 hari, tiket terbuka, tindak lanjut).
  5. "Beri instruksi": ketik instruksi atau pilih dari saran AI, misalnya "Kerahkan pompa ke Kel. X". Instruksi menjadi disposisi di Naskah Pintar (event) dan tugas di OPD terkait.
  6. "Mode rapat": layar penuh, huruf besar, dan auto-rotate panel tiap 15 detik.
- **Momen wow:**
  - briefing tersusun sendiri dari 6 produk lain;
  - pertanyaan bahasa alami langsung menjadi grafik + peta;
  - instruksi pimpinan langsung menjadi tugas lintas OPD.
- **AI:** intent tanya data (tren, perbandingan, peringkat, penyebab, prediksi sederhana) yang dijawab dari selector dunia. Live: tool `query_world` (filter dan agregat yang di-whitelist).
- **Event:** emit `briefing.generated`, `instruction.issued`; consume hampir semua event Satu Daerah + `price.anomaly`, `econ.updated`.
- **Misi:**
  1. Susun briefing.
  2. Dengarkan 1 butir.
  3. Ajukan 1 pertanyaan data.
  4. Beri 1 instruksi.
  5. Buka mode rapat.
- **Cek lulus:**
  - briefing berisi ≥6 butir yang masing-masing tertaut ke data dunia yang benar;
  - instruksi muncul di Naskah Pintar ≤1 detik.

### P3 · Naskah Pintar: Notulen & Disposisi AI

- **Frame:** `BrowserFrame` dengan tiga tab: **Rapat**, **Surat Masuk**, **Tindak Lanjut**. Dokumen dibuka di `PaperFrame`.
- **Peran:** Sekretariat/ASN (bawaan), Kepala Daerah (penyetuju disposisi), Kepala OPD.
- **Tab Rapat:**
  - Tombol "Rekam rapat" (Web Speech, transkrip live) atau "Pakai rekaman contoh: Rapat Koordinasi Penanganan Banjir" (audio + transkrip berlabel pembicara).
  - Kiri: transkrip mengalir, pembicara diberi warna (Sekda, Kadis PUPR, Kalaksa BPBD, Kadinsos, Camat), dan bisa diklik untuk loncat ke detik audio.
  - Kanan: **notulen yang menulis dirinya sendiri** selama transkrip berjalan, dengan bagian Peserta, Agenda, Pokok Bahasan, Keputusan, dan Tindak Lanjut (tabel PIC, tenggat, status).
  - Tombol "Format tata naskah dinas" menampilkan pratinjau notulen resmi di PaperFrame (kop generik, nomor, tanggal, tanda tangan elektronik dummy) dengan aksi Cetak/Simpan PDF (print stylesheet).
- **Tab Surat Masuk:**
  - Inbox surat (gambar surat fiktif, beberapa terlihat seperti hasil scan miring).
  - Klik surat untuk melihat ringkasan AI 3 baris, klasifikasi (undangan/permohonan/laporan/edaran), sifat (Segera/Biasa/Rahasia), tenggat, **draf disposisi** (kepada, instruksi, catatan), serta tombol Setujui/Ubah.
  - Setelah disetujui, cap disposisi digital muncul dengan animasi stempel.
- **Tab Tindak Lanjut:**
  - Kanban per OPD dan daftar tenggat. Item lewat tenggat diberi denyut merah halus.
  - Tombol "Kirim pengingat" menampilkan pratinjau pesan WA ke PIC, dan statusnya terkirim.
- **Momen wow:**
  - notulen dan tindak lanjut tersusun live sambil rapat berjalan;
  - kartu tindak lanjut "terbang" ke kolom OPD masing-masing;
  - surat scan berantakan menjadi disposisi rapi dalam 3 detik.
- **AI:** ekstraksi keputusan dan tindak lanjut dari transkrip; ringkasan dan klasifikasi surat; draf disposisi. Live memakai `AI_MODEL_SMART`.
- **Event:** emit `meeting.transcribed`, `actionItem.created`, `letter.dispositioned`; consume `instruction.issued`.
- **Misi:**
  1. Putar rapat contoh.
  2. Ekspor notulen resmi.
  3. Disposisikan 1 surat.
  4. Kirim 1 pengingat.
- **Cek lulus:**
  - rapat contoh menghasilkan ≥5 tindak lanjut dengan PIC dan tenggat;
  - instruksi dari Meja Pimpinan muncul sebagai disposisi.

### P4 · Radar Isu: Intelijen Opini Publik

Mesin analisis ini juga dipakai Pantau Merek. Isi ScrapPulse lama dilebur ke sini.

- **Frame:** `BrowserFrame` dengan tab **Pantauan Live**, **Analisis Mendalam**, dan **Laporan**.
- **Peran:** Humas/Diskominfo (bawaan), Kepala Daerah.
- **Pantauan Live:**
  - Kolom kiri: stream mention berita dan media sosial **fiktif** (nama media dan akun fiktif) yang bergulir live mengikuti jam dunia, dengan badge sentimen.
  - Tengah: bubble chart klaster topik (ukuran = volume, warna = sentimen) dan grafik sentimen 24 jam.
  - Kanan: kartu **Peringatan Hoaks**.
- **Analisis Mendalam (eks-ScrapPulse):**
  - Input hingga 4 kata kunci, periode 7/14/30 hari, bahasa ID/EN.
  - Proses bertahap dengan status per sumber.
  - Hasil: volume & momentum, sentimen bilingual, topik & kecenderungan media, kutipan kunci, dan rekomendasi pertanyaan survei.
  - Ekspor XLSX/JSON dari data simulasi.
- **Laporan:** laporan harian otomatis di PaperFrame (cetak/PDF).
- **Alur:**
  1. Pantauan berjalan normal.
  2. Jam 10:00 (atau tombol "Picu skenario"): narasi palsu "Bendungan [nama nyata] jebol" menyebar. Kartu Peringatan Hoaks muncul dengan skor kemungkinan hoaks, kecepatan sebar (grafik eksponensial kecil), akun penyebar awal (fiktif), dan bukti pembanding (data Siaga Wilayah: tinggi muka air normal).
  3. "Susun klarifikasi": pilih nada (tegas/menenangkan/informatif). AI menyusun rilis pers, caption media sosial, dan teks infografis singkat.
  4. "Terbitkan" (simulasi): kurva sentimen berbalik naik dalam 30 menit dunia, dan volume hoaks turun.
- **Momen wow:**
  - hoaks terdeteksi beserta buktinya dari produk lain;
  - klarifikasi siap terbit dalam beberapa detik;
  - grafik pemulihan sentimen.
- **Event:** emit `hoax.detected`, `clarification.published`; consume `flood.alert`, `complaint.clustered` (lonjakan aduan menjadi topik).
- **Misi:**
  1. Buka klaster topik terbesar.
  2. Tangani hoaks bendungan.
  3. Jalankan Analisis Mendalam untuk 2 kata kunci.
  4. Ekspor laporan.
- **Cek lulus:**
  - hoaks memicu toast ke Meja Pimpinan;
  - klarifikasi mengubah grafik sentimen;
  - ekspor XLSX dan JSON terunduh dengan isi yang valid.

### P5 · Siaga Wilayah: Geo-AI Peringatan Dini

- **Frame:** peta penuh (MapLibre) di `BrowserFrame` lebar, panel kiri bisa diciutkan, dan timeline scrubber di bawah.
- **Peran:** BPBD (bawaan), Dinas Pertanian, Kepala Daerah.
- **Layer peta** (toggle di panel):
  - batas kecamatan/desa nyata;
  - sungai;
  - zona risiko banjir/longsor;
  - curah hujan (sel radar animasi);
  - titik aduan dari Sapa Warga;
  - genangan prediksi;
  - fasilitas penting (RS, sekolah, pengungsian);
  - citra satelit (toggle);
  - lahan pertanian.
- **Tab panel:**
  - **Peringatan:** daftar peringatan aktif, level 1–4.
  - **Prediksi:** 6/24/72 jam, dengan desa terdampak dan jumlah penduduk dari region pack.
  - **Pertanian:** estimasi panen per kecamatan (choropleth) dan indeks kesehatan vegetasi simulasi.
  - **Lingkungan:** deteksi alih fungsi lahan dengan slider sebelum/sesudah.
- **Alur:**
  1. Jam 06:00: sel hujan bergerak masuk dari tepi peta (animasi WebGL custom layer atau canvas; maks 30fps di tier `mid`).
  2. Model memprediksi genangan. Poligon genangan **tumbuh** mengikuti scrubber waktu (+1 sampai +6 jam), dan desa terdampak menyala.
  3. "Kirim peringatan dini": pilih level dan wilayah. Pratinjau pesan WA ke camat dan kepala desa (daftar penerima fiktif per desa nyata). Kirim → centang terkirim/terbaca bergulir, dan warga di zona itu menerima pesan di Sapa Warga.
  4. Aduan banjir dari Sapa Warga muncul sebagai titik yang mengonfirmasi prediksi (badge "Terkonfirmasi warga").
  5. Tab Pertanian: geser ke "pasca-banjir"; estimasi panen di kecamatan terdampak turun, memicu `econ.updated` dan sinyal pasokan beras/cabai di Sinyal Pasar.
- **Momen wow:**
  - hujan dan genangan yang bergerak di peta daerah nyata;
  - peringatan massal dengan efek berantai ke produk lain;
  - slider sebelum/sesudah.
- **Data live opsional:** prakiraan cuaca publik BMKG untuk kode wilayah region (bila tersedia dan CORS memungkinkan lewat proxy) ditampilkan sebagai kartu "Cuaca nyata hari ini". Skenario banjir tetap simulasi.
- **Event:** emit `rain.forecast`, `flood.alert`, `alert.broadcast`; consume `complaint.created` (kategori banjir).
- **Misi:**
  1. Jalankan scrubber +6 jam.
  2. Kirim peringatan ke 1 kecamatan.
  3. Buka citra satelit.
  4. Lihat dampak pertanian.
- **Cek lulus:**
  - peringatan menghasilkan pesan di HP warga Sapa Warga;
  - FPS peta ≥50 di desktop tier `high` selama animasi hujan.

### P6 · Awas Belanja: Pengawas Pengadaan AI

- **Frame:** `BrowserFrame` berisi daftar paket dan detail paket.
- **Peran:** UKPBJ (bawaan), Inspektorat.
- **Layar:**
  - **Daftar paket pengadaan fiktif:** nama paket, OPD, nilai HPS, metode, status, skor risiko (badge).
  - **Detail paket**, dengan tab:
    - **HPS vs Pasar:** tabel item (harga HPS, median pasar, deviasi %), grafik batang deviasi, dan baris mencolok berwarna.
    - **Peserta:** graf jaringan peserta tender (node perusahaan fiktif; edge = alamat sama, direktur sama, IP pendaftaran sama, riwayat menang bergiliran) dengan tata letak force yang dianimasikan.
    - **Pola:** daftar detektor (harga penawaran seragam, pemenang berulang, pemecahan paket di bawah ambang, jadwal tender terlalu singkat, spesifikasi mengunci merek), masing-masing dengan status Lolos/Waspada/Tinggi dan penjelasan.
    - **Laporan:** draf memo audit di PaperFrame (cetak/PDF).
- **Alur:**
  1. Buka "Pengadaan Pompa Air Darurat" (muncul setelah `flood.alert`).
  2. "Jalankan analisis": animasi pemindaian per detektor (progress berurutan).
  3. Tiga temuan muncul.
  4. Klik edge di graf untuk melihat bukti.
  5. "Rekomendasikan": AI menyusun memo + rekomendasi (koreksi HPS, undang UMKM lokal lewat Katalog Lokal).
- **Momen wow:** graf jaringan yang "membuka" lingkaran peserta terafiliasi; HPS yang terkoreksi otomatis.
- **Event:** emit `procurement.flagged`; consume `flood.alert` (paket darurat dibuat), `match.made` (pembanding harga UMKM lokal).
- **Misi:**
  1. Analisis paket pompa.
  2. Temukan peserta terafiliasi.
  3. Buat memo audit.
- **Cek lulus:** semua detektor menghasilkan penjelasan; memo memuat angka yang sama dengan tabel.

### P7 · Cek Berkas: Verifikasi Dokumen Otomatis

- **Frame:** `BrowserFrame` dengan mode **Satu Berkas** dan **Massal**.
- **Peran:** Loket Perizinan (bawaan), Dinsos.
- **Satu Berkas:**
  - Zona unggah dan galeri dokumen contoh. Semua dokumen adalah **spesimen fiktif** bertanda air "SPESIMEN": KTP, KK, NIB, surat keterangan domisili, dan foto rumah untuk bansos.
  - Penampil dokumen dengan bounding box OCR yang muncul berurutan, panel ekstraksi field dengan tingkat keyakinan per field, dan daftar cek konsistensi (format NIK, tanggal lahir di NIK vs field, nama di KK vs KTP, masa berlaku, tanda tangan ada).
  - **Peta panas indikasi edit**, dengan toggle opacity.
  - Badge hasil: Lengkap / Kurang / Perlu Cek Manual.
- **Massal:** "Proses 50 berkas pendaftar bansos banjir". Grid kartu kecil terisi status satu per satu dengan stagger cepat. Ringkasan: lolos, kurang, NIK ganda (garis penghubung antarkartu duplikat), dan alamat di luar zona terdampak (dicek terhadap Siaga Wilayah). Ekspor CSV.
- **Alur:**
  1. Pilih spesimen KTP → ekstraksi.
  2. Pilih spesimen yang sengaja diedit → peta panas menyala → status "Perlu Cek Manual" dengan alasan.
  3. Jalankan massal → duplikat ditemukan.
  4. Unggah dokumen sendiri (hanya di mode Live, setelah konfirmasi "Proses dokumen saya"); diproses vision lewat proxy dan tidak disimpan.
- **Momen wow:** 50 berkas selesai ±8 detik; NIK ganda saling terhubung; validasi silang dengan peta bencana.
- **Event:** emit `document.verified`; consume `flood.alert` (kuota pendaftar bansos dibuka).
- **Misi:**
  1. Verifikasi 1 KTP spesimen.
  2. Temukan dokumen yang diedit.
  3. Jalankan verifikasi massal.
- **Cek lulus:** semua field spesimen terekstrak benar; jumlah duplikat sama dengan data seed.

### P8 · Toko Autopilot: Operasional Retail & F&B (termasuk modul Kasir eks-KasirKu)

- **Frame:** `TabletFrame` untuk tab Kasir; `BrowserFrame` untuk tab lainnya.
- **Peran:** Pemilik Toko (bawaan), Kasir, Supplier (melihat chat PO).
- **Usaha contoh:** "Toko Bangunan [nama fiktif]" di pasar nyata region + 2 outlet F&B (toggle outlet). Seed: 3 outlet, ±400 SKU, 90 hari transaksi.
- **Tab:**
  - **Kasir:** grid produk, pencarian, scan barcode (kamera opsional / input), keranjang, diskon, split bayar, QRIS (QR dummy + tombol "Simulasikan pembayaran"), struk, tutup shift.
  - **Prediksi Stok:**
    - daftar SKU dengan "habis dalam X hari";
    - grafik permintaan 30 hari + prediksi 14 hari dengan pita keyakinan;
    - faktor penjelas: musim, hari gajian, **kejadian banjir dari Siaga Wilayah**, promo.
  - **PO Otomatis:**
    - draf PO yang dikelompokkan per supplier;
    - pemilik menyetujui → pratinjau chat WA ke supplier (gelembung terkirim) → balasan supplier muncul setelah jeda ("Siap, kirim besok pagi") → status PO berubah.
  - **Harga & Promo:** saran harga (elastisitas sederhana), simulasi dampak margin, dan bundling.
  - **Jadwal Shift:** kalender minggu yang dibuat otomatis dari pola keramaian per jam, bisa diatur dengan drag-drop.
  - **Dasbor:** KPI multi-outlet, top produk, margin, dan perbandingan outlet.
- **Alur:**
  1. Lakukan 1 transaksi di Kasir.
  2. Setelah `flood.alert`, prediksi karung pasir, pompa, dan terpal **melonjak** (grafik bergerak) → banner "Permintaan diperkirakan naik 340% karena peringatan banjir".
  3. Setujui PO → chat supplier → balasan.
  4. Terapkan saran harga.
  5. Lihat jadwal shift yang menambah kasir di jam sibuk.
- **Momen wow:** prediksi yang bereaksi terhadap peristiwa nyata di daerah; PO yang benar-benar "terkirim" dan dibalas supplier.
- **Event:** emit `sale.created`, `stock.forecastChanged`, `po.sent`, `supplier.replied`; consume `flood.alert`, `price.anomaly`, `need.created`.
- **Misi:**
  1. Transaksi QRIS.
  2. Lihat dampak banjir pada prediksi.
  3. Kirim PO.
  4. Terapkan 1 saran harga.
- **Cek lulus:**
  - transaksi mengurangi stok dan memperbarui dasbor;
  - prediksi berubah ≤1 detik setelah `flood.alert`;
  - PO menghasilkan balasan supplier.

### P9 · Pajak Beres: Copilot Pembukuan & Pajak

- **Frame:** `BrowserFrame`.
- **Peran:** Pemilik Usaha (bawaan), Konsultan Pajak.
- **Layar:**
  - **Kotak Dokumen:** unggah atau pilih contoh (foto nota belanja miring/kusut, struk, faktur, CSV mutasi rekening fiktif).
  - **Jurnal:** entri otomatis dengan akun, debit/kredit, keyakinan, dan "Perlu tinjauan". Bisa diedit inline.
  - **Buku Besar & Laporan:** laba-rugi bulanan, neraca sederhana, arus kas.
  - **Kalender Pajak:** tenggat bulan ini dengan pengingat.
  - **PPh 21 Karyawan:** kalkulator per karyawan dengan metode yang berlaku.
  - **Ekspor:** pratinjau berkas siap unggah ke sistem pajak (format diambil dari spesifikasi resmi terbaru).
  - **Tanya Pajak:** chat bahasa awam.
- **Aturan akurasi:** semua tarif, ambang, dan format pajak disimpan di `demos/pajak-beres/rules.ts` dengan **sumber resmi dan tahun berlaku** di komentar. **Jangan mengarang angka.** Cari sumber resminya; kalau ragu, **tanyakan pemilik proyek** sebelum mengisi.
- **Alur:**
  1. Pilih foto nota contoh. Gambar diluruskan (animasi koreksi perspektif), bounding box teks muncul, field terekstrak, lalu **entri jurnal "terbang" ke buku jurnal**.
  2. Impor CSV mutasi bank → 40 transaksi terkategori otomatis, 3 ditandai "Perlu tinjauan" → setujui.
  3. Buka laba-rugi (grafik bulanan).
  4. Hitung PPh 21 untuk 5 karyawan → ringkasan.
  5. Ekspor.
  6. Tanya: "Kenapa pajak bulan ini naik?" → jawaban dengan rincian.
- **Momen wow:** nota kusut menjadi jurnal rapi dalam 2 detik; satu tombol untuk laporan bulanan.
- **Event:** emit `ledger.posted`, `tax.ready`; consume `sale.created` (penjualan Toko Autopilot otomatis menjadi jurnal); hasilnya memengaruhi skor di Rapor Usaha.
- **Misi:**
  1. Proses 1 nota.
  2. Impor mutasi.
  3. Hitung PPh 21.
  4. Ekspor berkas pajak.
- **Cek lulus:** jurnal seimbang (total debit = kredit); laporan cocok dengan entri; nilai tarif sama dengan `rules.ts`.

### P10 · Juara Jualan: QA & Coaching Tim Penjualan

- **Frame:** `BrowserFrame`.
- **Peran:** Supervisor Sales (bawaan), Agen Sales.
- **Industri bisa dipilih:** Multifinance, Asuransi, atau Toko Bangunan (terhubung dengan cerita).
- **Layar:**
  - **Percakapan:** daftar rekaman telepon (audio sintetis + transkrip) dan chat WA, dengan skor dan durasi.
  - **Detail:** gelombang audio dengan penanda momen (salam, gali kebutuhan, keberatan, penawaran, closing, pelanggaran skrip); transkrip tersinkron; skor per kriteria; kutipan bukti; saran perbaikan.
  - **Tim:** papan peringkat, radar kompetensi per agen, dan tren.
  - **Coaching:** kartu coaching mingguan per agen (3 fokus + contoh kalimat).
  - **Latihan:** roleplay dengan "pelanggan AI" (persona: ragu harga, buru-buru, banyak tanya). Di akhir latihan agen mendapat skor dan umpan balik.
- **Alur:**
  1. Buka panggilan dengan skor rendah.
  2. Klik penanda "keberatan tidak dijawab" → audio loncat ke momen itu.
  3. Lihat saran.
  4. "Tugaskan coaching" → kartu muncul di akun agen (ganti peran).
  5. Agen latihan roleplay → skor naik dari baseline.
- **Momen wow:** loncat ke detik masalah di rekaman; roleplay dengan pelanggan AI (paling hidup di mode Live).
- **Event:** emit `call.scored`, `coaching.assigned`; consume `po.sent` (chat penjualan toko bangunan ikut dinilai).
- **Misi:**
  1. Temukan momen masalah.
  2. Tugaskan coaching.
  3. Selesaikan 1 roleplay.
- **Cek lulus:** penanda sinkron dengan audio (±0,3 detik); roleplay simulasi berjalan ≥6 giliran dengan skor akhir.

### P11 · Kenal Mitra: Verifikasi Pelanggan, Mitra & Kandidat

- **Frame:** `BrowserFrame` dengan tiga pipeline: **Nasabah (KYC)**, **Mitra/Supplier (KYB)**, **Kandidat (CV)**. Mesin dokumennya sama dengan Cek Berkas.
- **Peran:** Analis KYC/HR (bawaan), Bank/Koperasi Mitra.
- **KYC:** formulir onboarding → dokumen spesimen → swafoto (kamera opsional; atau foto contoh) dengan simulasi uji liveness (instruksi "kedipkan mata/menoleh" + indikator) → skor risiko dan keputusan.
- **KYB:** verifikasi usaha UMKM: NIB, NPWP, akta, foto lokasi. Konsistensi nama/alamat dan alamat dicek di peta region nyata. Status "Terverifikasi" menjadi lencana di Katalog Lokal.
- **Kandidat:** unggah 200 CV contoh → ranking shortlist dengan alasan per kandidat, filter kriteria, dan toggle "sembunyikan nama/foto" (penilaian buta).
- **Momen wow:** UMKM terverifikasi langsung tampil berlencana di etalase pemda; 200 CV menjadi 10 terbaik dengan alasan dalam beberapa detik.
- **Event:** emit `partner.verified`; consume `need.created` (vendor baru perlu verifikasi).
- **Misi:**
  1. Onboard 1 nasabah.
  2. Verifikasi 1 UMKM.
  3. Saring 200 CV.
- **Cek lulus:** UMKM terverifikasi muncul dengan lencana di Katalog Lokal ≤1 detik.

### P12 · Pantau Merek: Monitoring Reputasi Brand

- **Frame:** `BrowserFrame` (mesin Radar Isu, tema peach).
- **Peran:** Brand Manager / Pemilik Usaha.
- **Layar:**
  - mention dan ulasan dari marketplace/media sosial **fiktif**;
  - sentimen per kanal;
  - topik keluhan (pengiriman, kualitas, harga);
  - peringatan lonjakan negatif;
  - draf balasan per ulasan dengan nada pilihan;
  - perbandingan dengan 2 kompetitor fiktif.
- **Alur:**
  1. Lonjakan keluhan "pengiriman lambat" setelah banjir.
  2. Peringatan muncul.
  3. AI mengelompokkan keluhan dan menyarankan pengumuman.
  4. Balas 5 ulasan sekaligus dengan draf yang dipersonalisasi.
  5. Grafik reputasi pulih.
- **Momen wow:** balas massal yang tetap terasa personal; akar masalah terhubung ke peristiwa daerah.
- **Event:** emit `brand.alert`; consume `flood.alert`.
- **Misi:**
  1. Tangani lonjakan.
  2. Balas 5 ulasan.
  3. Bandingkan dengan kompetitor.
- **Cek lulus:** balasan terpasang di ulasan; skor sentimen diperbarui.

### P13 · TenderPilot: Asisten Tender untuk Vendor

- **Frame:** `BrowserFrame`.
- **Peran:** Vendor (bawaan; profil UMKM toko bangunan dari cerita).
- **Layar:**
  - **Umpan tender:** paket fiktif bergaya data pengadaan publik, filter KBLI/lokasi/nilai/tenggat, dan **skor peluang menang** (gauge) dengan faktor penjelas (kesesuaian KBLI, pengalaman, jarak, harga historis, jumlah pesaing).
  - **Detail tender:** ringkasan AI, checklist syarat (otomatis tercentang dari profil + Kenal Mitra + Pajak Beres), kalender tenggat, dan rekomendasi harga penawaran (rentang + posisi terhadap riwayat).
  - **Penyusun dokumen:** editor bagian demi bagian yang terisi otomatis dari profil, dengan diff "sebelum/sesudah AI" dan ekspor PDF.
  - **Riwayat:** riwayat penawaran dan hasilnya.
- **Alur:**
  1. Notifikasi "Tender baru cocok: Pengadaan Karung Pasir & Terpal (darurat)".
  2. Skor peluang 78%.
  3. Checklist hampir lengkap; 1 kurang (memicu tautan ke Pajak Beres).
  4. Susun dokumen dengan AI.
  5. "Kirim penawaran" (simulasi) → `bid.submitted` muncul di sisi pemda (Katalog Lokal/Awas Belanja).
- **Momen wow:** dokumen penawaran puluhan halaman tersusun dalam beberapa detik; checklist yang terisi dari produk lain.
- **Event:** emit `tender.matched`, `bid.submitted`; consume `need.created`, `procurement.flagged`, `partner.verified`, `tax.ready`.
- **Misi:**
  1. Buka tender cocok.
  2. Lengkapi syarat.
  3. Susun dan kirim penawaran.
- **Cek lulus:** checklist mencerminkan state produk lain; penawaran muncul di sisi pemda.

### P14 · Katalog Lokal: Etalase UMKM untuk Belanja Pemda

- **Frame:** split dua sisi dengan toggle besar **"Sisi Pemda" ↔ "Sisi UMKM"** (animasi balik kartu).
- **Peran:** UKPBJ/OPD (sisi Pemda), Pemilik Toko (sisi UMKM).
- **Sisi Pemda:**
  - "Buat kebutuhan" dengan bahasa alami, misalnya "Butuh 2.000 karung pasir dan 50 terpal untuk Kec. X, kirim 2 hari". AI mengubahnya menjadi spesifikasi terstruktur.
  - **Animasi pencocokan:** garis-garis dari kebutuhan ke kartu UMKM lokal, sebagian menyala.
  - Shortlist dengan lencana **Terverifikasi** (Kenal Mitra), **Pajak Rapi** (Pajak Beres), **Skor Usaha** (Rapor Usaha), jarak di peta, harga, dan kapasitas.
  - Bandingkan → pilih → pesanan.
- **Sisi UMKM:** etalase, pesanan masuk (notifikasi), konfirmasi kapasitas, status kirim, dan pembayaran (simulasi).
- **Momen wow:** kebutuhan pemda dicocokkan ke UMKM lokal yang terverifikasi dalam sekejap; satu klik berpindah sisi.
- **Event:** emit `need.created`, `match.made`, `order.created`; consume `partner.verified`, `tax.ready`, `score.updated`, `bid.submitted`, `procurement.flagged`.
- **Misi:**
  1. Buat kebutuhan.
  2. Pilih UMKM.
  3. Konfirmasi dari sisi UMKM.
- **Cek lulus:** hanya UMKM berlencana yang muncul di shortlist teratas; pesanan muncul di sisi UMKM ≤1 detik.

### P15 · Rapor Usaha: Skor Kesehatan Bisnis

- **Frame:** `BrowserFrame` (sisi UMKM) + panel "Sisi Bank/Koperasi".
- **Peran:** Pemilik Usaha (bawaan), Bank/Koperasi Mitra (nama fiktif).
- **Layar:**
  - dial skor 0–1000 dengan animasi isi;
  - rincian faktor (stabilitas omzet, margin, kepatuhan pajak, ketepatan bayar supplier, verifikasi KYB, pertumbuhan) dengan kontribusi ±;
  - tren 12 bulan;
  - "Cara menaikkan skor" (3 aksi);
  - layar **persetujuan berbagi data** yang jelas (pilih data apa, ke siapa, berapa lama);
  - simulasi pengajuan modal: plafon perkiraan, tenor, cicilan, dan timeline persetujuan;
  - sisi bank: antrian pengajuan dengan skor dan rekomendasi.
- **Alur:**
  1. Skor tersusun dari data Toko Autopilot + Pajak Beres + Kenal Mitra.
  2. Ikuti saran "rapikan 3 jurnal" → skor naik (animasi).
  3. Bagikan ke Koperasi Mitra → ajukan modal → ganti peran ke bank → setujui.
- **Momen wow:** skor yang naik seketika saat data diperbaiki; pengajuan modal tanpa tumpukan berkas.
- **Event:** emit `score.updated`, `loan.applied`; consume `ledger.posted`, `tax.ready`, `partner.verified`, `sale.created`.
- **Misi:**
  1. Lihat faktor skor.
  2. Naikkan skor.
  3. Ajukan dan setujui modal.
- **Cek lulus:** skor dihitung ulang deterministik dari state; persetujuan muncul di kedua sisi.

### P16 · Indeks Ekonomi Daerah: Dasbor Ekonomi Lokal

- **Frame:** `BrowserFrame` dengan peta choropleth kecamatan nyata.
- **Peran:** Bappeda (bawaan), Dinas Koperasi & UMKM, Kepala Daerah.
- **Layar:**
  - indeks omzet UMKM per kecamatan (choropleth) dengan **slider time-lapse 12 bulan** (play);
  - rincian sektor;
  - tren harga bahan pokok;
  - analisis dampak program (sebelum/sesudah operasi pasar atau bantuan modal);
  - ekspor briefing kebijakan (PaperFrame).
- **Ambang anonimitas:** sel dengan <10 usaha disembunyikan dan diberi pola arsir + tooltip "Data agregat disembunyikan untuk menjaga anonimitas". Ini fitur produk.
- **Alur:**
  1. Putar time-lapse; kecamatan menyala dan meredup.
  2. Setelah banjir: penurunan di kecamatan terdampak.
  3. Pilih program "Operasi Pasar" (dari Sinyal Pasar) → grafik dampak.
  4. Ekspor briefing.
- **Momen wow:** ekonomi daerah "bernapas" di peta; dampak kebijakan terukur.
- **Event:** emit `econ.updated`; consume `sale.created` (agregat), `flood.alert`, `market.operation`.
- **Misi:**
  1. Putar time-lapse.
  2. Ukur dampak operasi pasar.
  3. Ekspor briefing.
- **Cek lulus:** agregat konsisten dengan data penjualan dunia; ambang anonimitas berlaku.

### P17 · Sinyal Pasar: Peringatan Harga & Pasokan

- **Frame:** `BrowserFrame` dengan ticker harga di atas.
- **Peran:** Disperindag (bawaan), Pemilik Toko (sisi UMKM).
- **Layar:**
  - ticker harga komoditas per **pasar nyata** region (harga simulasi);
  - tabel komoditas × pasar dengan sparkline;
  - deteksi anomali (kenaikan di atas pola musiman);
  - prediksi 14 hari dengan pita;
  - peta pasar;
  - rekomendasi aksi (operasi pasar, pantau distributor);
  - langganan peringatan untuk UMKM.
- **Alur:**
  1. Setelah banjir, harga cabai dan beras mulai naik.
  2. Peringatan dini 5 hari sebelum puncak prediksi.
  3. "Rekomendasikan operasi pasar" → masuk ke Meja Pimpinan.
  4. Simulasi operasi pasar → prediksi melandai.
  5. Sisi UMKM: peringatan "stok beras lebih awal" → Toko Autopilot.
- **Momen wow:** peringatan dini sebelum harga melonjak; satu sinyal menggerakkan pemda dan UMKM sekaligus.
- **Event:** emit `price.anomaly`, `market.operation`; consume `flood.alert`, `econ.updated`.
- **Misi:**
  1. Temukan anomali.
  2. Rekomendasikan operasi pasar.
  3. Lihat efeknya.
- **Cek lulus:** anomali terpicu dari skenario banjir; efeknya sampai ke Meja Pimpinan dan Toko Autopilot.

### P0 · GAMADA Inti: Platform AI Terpadu

- **Rute:** `/ekosistem/inti` (halaman cerita) dan `/demo/inti` (sandbox).
- **Sandbox:**
  - **Inti ID:** daftar peran, satu akun berpindah peran, dan matriks hak akses per produk (centang yang beranimasi saat peran berganti).
  - **Inti Agen:** "jejak berpikir" agent untuk permintaan terakhir di produk mana pun, ditampilkan sebagai timeline langkah: intent → tool → data → jawaban, dengan durasi tiap langkah.
  - **Inti Kanal:** kotak masuk gabungan WA/web/telepon dari semua produk.
  - **Inti Data:** **graf jejak data**. Pilih satu entitas, misalnya aduan SW-0142, lalu lihat perjalanannya melintasi produk (Sapa Warga → Siaga Wilayah → Meja Pimpinan → Naskah Pintar → Awas Belanja → Katalog Lokal), dengan garis yang menyala berurutan.
  - **Audit Log:** setiap event dunia (bisa difilter, diekspor).
- **Momen wow:** "Lihat jejak data" yang menelusuri satu kejadian melintasi 6 produk.
- **Cek lulus:** jejak data cocok dengan audit log; matriks hak akses sesuai definisi peran.

## 12 · Tur "Satu Hari di [DAERAH_1]"

### 12.1 Pengalaman

- **Rute `/tur`.**
  - **Pembuka sinematik:** layar senja ala beranda, judul Fraunces besar "Satu Hari di [Daerah]", peta region muncul dari kabut, dan jam berputar ke 06:00.
  - Tombol "Mulai tur (±8 menit)" dan "Pilih bab".
- **Tata letak bab (desktop):**
  - kiri 38%: panel **Narasi** dengan nomor bab, jam dunia besar, judul, paragraf narasi ≤60 kata, dan "Yang terjadi" (bullet hasil);
  - kanan 62%: **kanvas demo live**, yaitu produk yang sebenarnya, digerakkan oleh skrip.
  - Di mobile, narasi tampil sebagai lembar bawah yang bisa ditarik.
- **Kontrol:**
  - Play/Pause, ←/→ antarbab;
  - kecepatan (0,75× / 1× / 1,5×);
  - daftar bab (laci);
  - "Ambil alih": lompat ke sandbox produk itu **dengan state saat ini**, lalu tombol "Kembali ke tur" melanjutkan dari bab yang sama.
- **Mode presenter (`?present=1` atau tombol P):**
  - layar penuh;
  - kursor tersembunyi saat diam;
  - catatan presenter di jendela kedua (BroadcastChannel, opsional);
  - shortcut: spasi, ←/→, F, B (layar hitam), R (reset bab).
- **Peta konstelasi kecil** di pojok: 17 titik produk yang menyala ketika produknya muncul di tur. Di akhir tur semua titik menyala.
- **Transisi antarbab:**
  - peta terbang ke lokasi kejadian, atau
  - frame produk berganti dengan tirai kabut (`PageCurtain`), atau
  - jam berputar.
- **Ringkasan akhir:**
  - "Hari ini di [Daerah]": aduan tertangani, peringatan terkirim, hoaks dipatahkan, potensi penghematan anggaran, UMKM lokal yang mendapat pesanan, harga yang distabilkan;
  - angka count-up;
  - tombol **"Bawa pulang ringkasan (PDF)"** berupa laporan 2 halaman bertema terang dengan logo GAMADA, region, dan daftar produk yang dilihat;
  - **"Jadwalkan demo personal"** membuka WhatsApp dengan pesan terisi (region + produk yang paling lama dilihat);
  - grid "Coba sendiri".

### 12.2 Skrip bab

Ditulis di `src/demo-kit/tour/chapters.ts` dengan DSL `{ id, time, product, eco, title, narration{id,en}, steps: Step[] }`.

`Step` bisa berupa:
- `setClock`
- `emit`
- `navigate`
- `focus` (sorot elemen + redup sisanya)
- `type` (mengetik teks di input dengan kecepatan manusia)
- `click`
- `aiRespond` (skenario)
- `mapFly`
- `wait`
- `toast`
- `caption`

| # | Jam | Produk | Isi bab |
|---|---|---|---|
| 1 | 06:00 | Siaga Wilayah | Sel hujan masuk; prediksi genangan +6 jam; 4 desa nyata terancam |
| 2 | 06:20 | Siaga Wilayah → Sapa Warga | Peringatan dini terkirim ke camat/kades; warga di zona menerima pesan |
| 3 | 07:00 | Meja Pimpinan | Briefing pagi tersusun sendiri dan dibacakan; pimpinan bertanya "Desa mana paling berisiko?" |
| 4 | 08:15 | Sapa Warga | Ibu Siti mengirim voice note berbahasa daerah; tiket terbentuk; klaster aduan banjir |
| 5 | 09:00 | Naskah Pintar | Rapat koordinasi; notulen dan 6 tindak lanjut tersusun live; disposisi ke OPD |
| 6 | 10:00 | Radar Isu | Hoaks "bendungan jebol" terdeteksi; klarifikasi terbit; sentimen pulih |
| 7 | 11:00 | Awas Belanja | Paket darurat pompa air dianalisis; HPS kemahalan + peserta terafiliasi; rekomendasi UMKM lokal |
| 8 | 11:40 | Katalog Lokal | Kebutuhan karung pasir & terpal dicocokkan ke UMKM lokal berlencana |
| 9 | 12:00 | Kenal Mitra | UMKM baru diverifikasi KYB, lalu lencana muncul |
| 10 | 12:30 | TenderPilot | Toko bangunan menerima notifikasi, skor peluang 78%, dokumen tersusun, penawaran terkirim |
| 11 | 13:00 | Toko Autopilot | Prediksi permintaan melonjak; PO otomatis ke supplier; supplier membalas |
| 12 | 13:30 | Juara Jualan | Chat penjualan dinilai; coaching untuk kasir baru |
| 13 | 14:00 | Pajak Beres | Nota pembelian stok menjadi jurnal; status pajak "siap" |
| 14 | 14:30 | Rapor Usaha | Skor naik → koperasi mitra menyetujui modal kerja |
| 15 | 15:00 | Pantau Merek | Keluhan "pengiriman lambat" ditangani dengan balasan massal |
| 16 | 15:30 | Cek Berkas | 50 pendaftar bansos banjir diverifikasi; 3 NIK ganda ditemukan |
| 17 | 16:00 | Sinyal Pasar | Harga cabai/beras mulai naik → rekomendasi operasi pasar |
| 18 | 16:30 | Indeks Ekonomi Daerah | Dampak banjir & operasi pasar pada ekonomi kecamatan |
| 19 | 17:00 | Meja Pimpinan + GAMADA Inti | Penutupan hari; "Lihat jejak data" aduan Ibu Siti melintasi 6 produk |
| 20 | — | Ringkasan | Angka hari ini, PDF bawa pulang, CTA |

Aturan skrip:
- Setiap bab **menjalankan produk yang sebenarnya** (bukan video), sehingga "Ambil alih" selalu bisa dilakukan.
- Tur deterministik (seed tetap, AI simulasi).
- Durasi total tur 7–9 menit pada 1×.

## 13 · Halaman `/ekosistem`, `/ekosistem/:eco`, `/produk/:slug`, `/lab`

### `/ekosistem`
- **Hero:** langit malam senja dengan **konstelasi**: 17 bintang produk dalam 3 gugus warna (teal/peach/plum) mengelilingi bintang Inti. Garis antarbintang tergambar saat masuk.
  - Hover bintang: kartu mini (nama, tagline, ikon) + garis relasinya menyala.
  - Klik: transisi zoom ke `/produk/:slug`.
  - Implementasi: SVG + GSAP; boleh canvas/OGL untuk partikel latar dengan tier rendah.
- **Di bawah hero:**
  - tiga panel ekosistem (cerita singkat, 3 manfaat, daftar produk, CTA);
  - alur "Bagaimana semuanya terhubung" (diagram scroll-driven dengan contoh aduan banjir mengalir antarproduk);
  - CTA tur;
  - FAQ ekosistem (pengadaan, keamanan data, server dalam negeri, integrasi sistem yang ada);
  - CTA WhatsApp.

### `/ekosistem/:eco`
Cerita ekosistem, diagram alur antarproduk khusus ekosistem itu, kartu produk, "Mulai tur dari bab X", dan manfaat per jenis pembeli.

### `/produk/:slug`
Template sama untuk 17 produk, konten dari `demos/<slug>/copy.ts`:
1. **Hero:** nama lengkap (Fraunces), tagline, badge ekosistem, dan **mini-demo live** (`mini.tsx`) di frame perangkat yang memutar momen wow secara loop tanpa suara. Mini-demo adalah komponen sungguhan dengan skrip pendek, bukan video, dan berhenti saat tidak terlihat.
2. **Masalah:** 3 kartu masalah nyata calon pembeli.
3. **Cara kerja:** 3 langkah beranimasi.
4. **Momen unggulan:** 2–3 fitur dengan visual komponen asli.
5. **Terhubung dengan:** graf mini produk terkait (klik → produk itu).
6. **Untuk siapa:** peran dan manfaat.
7. **Keamanan & data:** hak akses per peran, audit log, opsi server dalam negeri.
8. **FAQ produk:** 4–6 butir.
9. **CTA:** "Coba demo penuh" (→ `/demo/:slug`), "Lihat di tur" (→ bab terkait), dan WhatsApp.

### `/lab`
Grid 17 demo + alat portofolio lama, dengan filter per ekosistem, status, dan durasi coba (2/5/10 menit). Setiap kartu menampilkan pratinjau mini-demo saat hover.

## 14 · Mobile, aksesibilitas, performa

- **Mobile (360–430px):**
  - semua demo bisa dipakai;
  - frame split menjadi tab;
  - peta dengan gesture standar;
  - tabel lebar berubah menjadi kartu;
  - tur memakai lembar bawah.
- **Aksesibilitas:**
  - navigasi keyboard penuh di semua demo (tab order logis, `Esc` menutup drawer/modal, panah di grid/kanban);
  - `aria-live="polite"` untuk event baru dan jawaban AI;
  - label pada ikon;
  - kontras AA;
  - axe tanpa pelanggaran serius;
  - setiap grafik punya ringkasan teks.
- **Performa:**
  - JS awal beranda **tidak boleh naik** (demo dan MapLibre di chunk terpisah);
  - per demo ≤180 KB gzip (di luar MapLibre);
  - LCP `/produk/:slug` ≤2,5 detik (mobile, 4G lambat);
  - interaksi INP ≤200 ms;
  - animasi 60fps di desktop tier `high`, ≥45fps di `mid`;
  - `npm run perf` untuk beranda tidak boleh memburuk;
  - tambahkan target perf untuk `/tur` dan `/demo/siaga-wilayah`.
- **Aturan grafis:**
  - tanpa `backdrop-filter`, tanpa blur yang dianimasikan, tanpa `mix-blend-mode` di elemen besar;
  - satu loop RAF;
  - animasi berhenti saat tidak terlihat;
  - hormati `?off=`, `?degrade`, dan `prefers-reduced-motion`.
  - Tambahkan flag `demoAnimations`, `tourCinematics`, `mapRain`, `constellation` di `motion.ts`.

## 15 · Pengujian & bukti

- **Playwright:**
  1. Tur autoplay selesai ke-20 bab tanpa error console (1440×900 dan 390×844).
  2. Setiap sandbox: misi GuidePanel bisa diselesaikan oleh skrip test.
  3. Uji reaksi lintas produk, minimal 10 rantai event.
  4. **Crawler "tidak ada tombol mati"**: di setiap demo, klik setiap elemen interaktif yang terlihat lalu pastikan ada perubahan DOM/state yang bermakna atau dialog yang relevan, tanpa error.
  5. Pergantian region dan bahasa di setiap demo.
  6. Mode Live dengan proxy mock (SSE palsu), termasuk fallback timeout.
- **Visual:** screenshot setiap demo di 1440 dan 390 untuk peran bawaan dan satu peran alternatif, disimpan di `docs/shots/demo/<tahap>/`. Perbandingan visual dengan baseline di tahap berikutnya.
- **"Wow audit":** di akhir tahap 2–7, jalankan 4 agent penilai yang berperan sebagai calon klien skeptis: Bupati, Kepala Diskominfo, Direktur Koperasi/Bank Daerah, dan Pemilik toko 3 cabang. Masing-masing memakai demo lewat browser dan menilai 1–10 untuk:
  - kejelasan manfaat dalam 30 detik;
  - kesan visual;
  - rasa "hidup";
  - kelancaran;
  - keterhubungan antarproduk;
  - kepercayaan;
  - kemudahan dipakai di HP;
  - keinginan untuk menjadwalkan demo lanjutan.

  **Target: setiap demo ≥8 di semua kriteria.** Yang di bawah target diperbaiki lalu dinilai ulang.

## 16 · Tahapan kerja

Setiap tahap adalah satu workflow ultracode. **Berhenti dan laporkan setelah tiap tahap.**

| Tahap | Isi | Pola workflow |
|---|---|---|
| 0 | **Audit & pertanyaan.** Baca repo dan dokumen. Kumpulkan pertanyaan wajib (§17). Usulkan **3 arah visual** untuk lapis aplikasi (moodboard/komponen contoh: KPI, tabel, chat, peta, dokumen) sebagai halaman `/lab/_design` sementara. | Panel juri: 3 agent desain dengan sudut berbeda (presisi editorial, sinematik senja, data-dense tenang), dinilai 3 juri, lalu sintesis. **Tunggu pilihan saya.** |
| 1 | **Demo Kit:** shell, frame, world store + event bus + reactions + seed + persist, jam dunia, region pack `[DAERAH_1]` lengkap, AI provider (simulasi) + proxy server + klien Live, viz, map, docs viewer, media, i18n, registry produk, rute dan redirect. | Build paralel per subfolder (worktree), review kontrak, integrasi |
| 2 | **Satu Daerah:** P1–P7 | Pipeline per produk: build → review 4 lensa (visual, interaksi/tombol mati, data/lintas produk, perf/a11y) → fix → wow audit |
| 3 | **Usaha Pintar:** P8–P13 (termasuk peleburan KasirKu) | sama |
| 4 | **Pasar Daerah:** P14–P17 + P0 Inti | sama |
| 5 | **Tur** "Satu Hari di [DAERAH_1]": 20 bab, presenter, ringkasan + PDF | build → putar ulang otomatis → wow audit |
| 6 | **Halaman situs:** `/ekosistem`, `/ekosistem/:eco`, `/produk/:slug` ×17, `/lab`, integrasi Navbar/beranda/footer, peleburan `/karya` & redirect | build → review visual vs beranda GAMADA → fix |
| 7 | **Region pack** `[DAERAH_2]` dan `[DAERAH_3]`, polish menyeluruh, uji lengkap (§15), laporan akhir | loop sampai tidak ada temuan baru (2 putaran bersih berturut-turut) |

Aturan setiap tahap:
- `npm run typecheck` dan `npm run build` lulus;
- `npm run perf` beranda tidak memburuk;
- tidak ada error console;
- screenshot tersimpan;
- commit kecil dengan pesan jelas;
- tidak push/deploy tanpa perintah saya.

**Laporan tahap** memuat:
- apa yang selesai, dengan link ke screenshot;
- skor wow audit per demo;
- apa yang belum;
- pertanyaan untuk saya;
- rencana tahap berikutnya.

## 17 · Wajib bertanya kepada saya

Jangan menebak untuk hal-hal di bawah ini. Kumpulkan pertanyaannya di laporan tahap 0 atau di tahap ketika dibutuhkan; selama menunggu, kerjakan bagian lain.

1. Nama pasti `[DAERAH_1]`, `[DAERAH_2]`, `[DAERAH_3]` bila placeholder belum diganti, dan bahasa daerah utama masing-masing.
2. Sumber dan lisensi data geografis/satelit bila ada keraguan; penyedia tile peta dan API key-nya.
3. Tarif, ambang, dan format pajak terbaru untuk Pajak Beres. Tunjukkan sumber yang ditemukan, lalu minta konfirmasi.
4. `ANTHROPIC_API_KEY` dan batas anggaran harian untuk mode Live; target hosting proxy bila sudah diputuskan.
5. Arah visual pilihan dari tahap 0.
6. Apakah halaman produk menampilkan harga/paket atau cukup "Hubungi kami".
7. Data kontak di `src/content/site.ts` yang masih `TODO` (WhatsApp, email, nama badan usaha, domain).
8. Nama fiktif bank/koperasi mitra dan supplier yang boleh dipakai, bila saya punya preferensi.
9. Hal lain yang memengaruhi apa yang dibangun dan tidak bisa diputuskan dengan default yang wajar.

Untuk hal kecil yang tidak mengubah hasil secara berarti, ambil keputusan sendiri dengan default yang masuk akal, lalu catat di laporan sebagai "keputusan agent".
