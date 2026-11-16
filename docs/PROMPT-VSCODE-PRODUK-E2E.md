# Prompt VS Code: 13 produk GAMADA dibangun end-to-end

## Sebelum menjalankan (dikerjakan oleh Anda, bukan agent)

1. **Selesaikan dulu Fase 2 (beranda).** Jangan jalankan prompt ini saat agent lain masih mengedit folder `gamada`, karena dua agent yang menulis di file yang sama akan saling menimpa.
2. **Jadikan folder ini repo git.** Folder `gamada` belum berupa repo git. Ultracode memakai git worktree, dan git juga menjadi jaring pengaman kalau ada yang rusak.
   ```bash
   git init
   ```
   ```bash
   git add -A
   ```
   ```bash
   git commit -m "baseline sebelum produk E2E"
   ```
3. **Siapkan alat dan akun berikut** (agent akan menanyakannya ketika dibutuhkan):
   - Docker Desktop, Node 22, Python 3.12, dan Android Studio/SDK (untuk adb);
   - akun Expo, untuk build APK;
   - key **sandbox** Midtrans, untuk QRIS/VA/kartu;
   - SMTP; boleh diganti Mailpit lokal dulu;
   - akun Instagram **Business/Creator** dan Meta App, untuk Graph API;
   - beberapa HP Android dengan USB debugging aktif, untuk PhoneFarm.
4. **Atur Claude Code di VS Code:** model **Opus 5.5**, effort **high**. Sertakan kata `ultracode` di pesan (sudah ada di prompt di bawah).
5. **Naikkan batas workflow.** Bawaan Claude Code menyarankan workflow di bawah 10 agent. Prompt ini meminta satu workflow per produk dengan maksimal 12 agent, jadi naikkan opsi "Dynamic workflow size" di config Claude Code. Kalau tidak dinaikkan, setiap produk tetap jalan, hanya lebih lambat.
6. **Jalankan satu tahap per pesan.** Kirim prompt di bawah garis sekali. Setelah agent melaporkan Tahap 0, balas `lanjut tahap 1`, lalu seterusnya per tahap.

---

ultracode

## Peran

Kamu adalah tim produk lengkap dalam satu orang: product manager, UX researcher, staff engineer full-stack (web, mobile, backend, data), QA, dan security engineer. Repo ini adalah **GAMADA**, website studio digital (Vite 8, React 19, TS strict, GSAP, Lenis, OGL, react-router 7). Website ini mengiklankan **13 produk** di `src/content/work.ts`, ditambah hub `/tools`, `/tools/scrappulse`, dan `/panel/phonefarm`. Saat ini semuanya baru berupa demo dengan data dummy.

**Tujuan:** bangun ke-13 produk itu **end-to-end menjadi produk jadi yang benar-benar bisa dipakai orang**. Setiap produk harus punya backend, database, autentikasi, peran, pembayaran (jika diiklankan), notifikasi, test, seed data, Docker, dokumentasi, dan halaman di website GAMADA yang membuka produk aslinya. Ukuran sukses: **setiap klaim iklan terbukti benar** saat dipakai oleh pengguna nyata.

## Cara berpikir wajib: jadilah penggunanya

Sebelum menulis kode untuk sebuah produk, jalankan **Persona Walkthrough**:

1. Tulis 3 persona realistis Indonesia untuk produk itu, termasuk satu yang gaptek dan satu power user. Untuk tiap persona: tujuan, konteks (HP murah, sinyal jelek, sibuk), dan rasa frustrasinya.
2. Untuk setiap persona, tulis **perjalanan dari nol**: tahu produk dari GAMADA → daftar → tugas pertama → tugas rutin harian → kondisi error (offline, pembayaran gagal, salah input, stok habis) → berhenti atau kembali.
3. Ambil **setiap klaim iklan** dari tabel di bawah dan dari copy website. Ubah tiap klaim menjadi **acceptance test yang bisa dibuktikan**, misalnya "tutup buku 5 menit" menjadi "kasir menyelesaikan wizard tutup shift berisi 120 transaksi dalam ≤5 menit di Playwright dengan CPU throttle 4×".
4. Catat **celah**: hal yang dibutuhkan persona tapi tidak disebut iklan, seperti reset password, ekspor data, undo, atau struk. Celah yang wajar untuk produk sejenis masuk ke MVP.
5. Simpan semuanya di `products/<slug>/PRODUCT.md`: persona, journey, klaim → acceptance test, celah, ruang lingkup MVP, dan hal di luar lingkup.

Setelah produk dibangun, jalankan **Persona QA**. Agent terpisah berperan sebagai tiap persona dan memakai produk lewat Playwright di browser asli, sesuai journey-nya. Agent ini mencoba merusak produk, lalu melaporkan bug dengan langkah reproduksi. Produk belum selesai sebelum semua bug kritis dan mayor diperbaiki.

## Arsitektur (seragam supaya 13 produk tetap terawat)

Ubah repo menjadi **npm workspaces monorepo tanpa memindahkan website**. Website tetap di root.

```
/                         website GAMADA (tetap; jangan rusak)
packages/
  ui/                     design system bersama (token palet GAMADA, komponen aksesibel)
  auth/                   Better Auth (email+password, magic link, Google OAuth opsional), RBAC, multi-tenant
  db/                     Drizzle ORM + helper migrasi Postgres, tipe bersama
  payments/               adapter Midtrans (Snap + Core API QRIS/VA), webhook verify signature, idempotency, ledger
  notify/                 email (SMTP/Mailpit), WhatsApp (adapter: dev-console | provider resmi), push (Expo/Web Push)
  storage/                S3-compatible (MinIO lokal), signed URL, validasi tipe/ukuran
  config/                 eslint, tsconfig, zod env schema
products/<slug>/
  PRODUCT.md              hasil Persona Walkthrough
  api/                    Hono (Node 22) + zod + OpenAPI; ATAU FastAPI untuk produk Python
  web/                    Vite + React 19 + TanStack Query/Router (web/PWA)
  mobile/                 Expo (SDK terbaru) + expo-router + expo-sqlite (khusus 4 aplikasi mobile)
  worker/                 BullMQ (Node) atau Celery (Python) untuk job
  e2e/                    Playwright journey tests per persona
  docker-compose.yml      bisa dijalankan sendiri
infra/
  docker-compose.yml      Postgres 17, Redis, MinIO, Mailpit, Caddy (reverse proxy + HTTPS)
  deploy/                 runbook VPS: SSH key-only, UFW 22/80/443, Caddy auto-SSL, backup pg_dump harian, update
```

Aturan bersama:
- **Database:** satu Postgres dengan **schema terpisah per produk**. Uang disimpan sebagai integer rupiah, waktu dalam UTC dan ditampilkan dalam WIB.
- **Keamanan:**
  - setiap endpoint divalidasi dengan zod/pydantic;
  - otorisasi per peran diuji;
  - rate limit dan CSRF;
  - cookie `Secure`, `HttpOnly`, `SameSite`;
  - audit log untuk aksi uang dan admin;
  - secret hanya di `.env`; `.env.example` di-commit, `.env` tidak.
- **Data pribadi (UU PDP No. 27/2022):** minimalkan data yang dikumpulkan. Data sensitif seperti KTP/NIK disimpan terenkripsi atau sebagai hash, punya masa simpan, dan pemiliknya bisa menghapus akunnya.
- **Pembayaran:** **sandbox saja** sampai saya memberikan key produksi secara eksplisit. Webhook wajib verifikasi signature dan idempotent. Status pembayaran bersumber dari webhook, bukan dari redirect.
- **Offline:** offline wajib bila diiklankan atau jelas dibutuhkan persona (kasir, gate scanner, 4 aplikasi mobile).
- **Mode demo:**
  - setiap produk punya tenant demo publik yang di-reset otomatis tiap jam, lengkap dengan seed realistis;
  - tombol "Masuk sebagai demo" untuk tiap peran;
  - tidak ada email atau pembayaran sungguhan dari mode demo.
- **Kualitas:**
  - lolos typecheck dan lint;
  - unit test (Vitest/pytest) untuk logika bisnis, termasuk test konkurensi bila ada kuota atau stok;
  - Playwright untuk setiap journey;
  - a11y (axe) tanpa pelanggaran serius;
  - Lighthouse mobile ≥85 untuk halaman publik.
- **Desain:** setiap produk boleh punya brand sendiri (fiktif), tetapi komponen diambil dari `packages/ui`. Wajib mobile-first, berbahasa Indonesia, dan punya empty, loading, dan error state yang ramah.

## Analisis produk satu per satu

Kolom "Klaim iklan" berasal dari website. Semua klaim wajib terbukti di acceptance test.

### Web

| Produk | Klaim iklan | Yang harus benar-benar ada agar klaim jujur |
|---|---|---|
| **KasirKu**: POS warung & kafe | POS untuk 40+ toko, kasir cepat, stok sync, laporan harian otomatis, tutup buku 5 menit; QRIS/Tunai/Debit; dashboard omzet & top produk | <ul><li>Multi-outlet dan multi-tenant dengan peran owner/manager/kasir.</li><li>Layar kasir PWA yang **tetap jalan offline** (IndexedDB + antrian sinkron, konflik stok ditangani).</li><li>Scan barcode lewat kamera atau scanner USB, varian dan modifier, diskon, split payment, QRIS dinamis via Midtrans.</li><li>Struk PDF atau thermal (ESC/POS via WebUSB/Bluetooth bila didukung).</li><li>Stok per outlet, transfer stok, stok opname, alert stok menipis.</li><li>Shift: buka kas, wizard tutup shift (hitung uang fisik, selisih), lalu laporan harian otomatis via email/WA pukul 22.00.</li><li>Dashboard KPI, ekspor CSV/XLSX.</li><li>**Test:** 40 outlet × 3 kasir di seed; 120 transaksi lalu tutup shift ≤5 menit; dua kasir menjual stok terakhir bersamaan tanpa oversell.</li></ul> |
| **SmartCast**: platform podcast | Player custom + waveform, rekomendasi episode, tanpa iklan (pre-roll singkat), download offline, tip kreator 90% | <ul><li>Akun pendengar dan kreator.</li><li>Upload audio → worker ffmpeg (normalisasi loudness, AAC/HLS) + puncak waveform.</li><li>RSS feed valid (Apple/Spotify compatible).</li><li>Player: speed, sleep timer, resume posisi, antrian.</li><li>Rekomendasi content-based (kategori, tag, riwayat).</li><li>Pre-roll sponsor opsional ≤10 detik dan bisa di-skip.</li><li>Download offline via PWA cache.</li><li>Tip via Midtrans dengan **ledger 90/10**, laporan payout kreator (payout manual oleh admin).</li><li>Moderasi konten dan laporan penyalahgunaan.</li></ul> |
| **GoKantin**: kantin kampus | Menu harian, keranjang, bayar QRIS, siap ±10 menit, ambil di rak, 12 kantin 40+ tenant | <ul><li>Marketplace multi-tenant: kantin → tenant → menu dengan stok harian dan jam buka.</li><li>Keranjang lintas item dari satu tenant per order.</li><li>QRIS dinamis + kadaluarsa.</li><li>**Kitchen Display** untuk tenant (antrian, ubah status), status order realtime (SSE/WebSocket) + notifikasi.</li><li>Kode rak/locker saat siap.</li><li>Estimasi waktu dihitung dari antrian nyata, bukan angka tetap.</li><li>Rating, refund/batal sebelum diproses, laporan penjualan tenant.</li></ul> |
| **Kopi Senja**: company profile kopi | Cerita brand, menu signature, lokasi outlet, jam buka, live akustik, delivery via ojol, reservasi | <ul><li>Situs publik yang sangat cepat (SSG/prerender) dengan **CMS admin**: menu, harga, outlet, jam, event, galeri.</li><li>Form reservasi dengan kapasitas per slot + konfirmasi email/WA.</li><li>Halaman event.</li><li>Tombol deep link GoFood/GrabFood/ShopeeFood yang bisa diatur.</li><li>JSON-LD `CafeOrCoffeeShop` per outlet, peta, SEO lokal.</li><li>Bisa dipakai sebagai **template** untuk klien F&B lain.</li></ul> |
| **Tiket.in**: ticketing festival | Countdown, lineup, tier harga (presale sold out), e-QR discan di gate, 1 tiket 1 orang, 17+ dengan KTP | <ul><li>Admin event: tier, kuota, jadwal penjualan, lineup.</li><li>Checkout dengan **hold kuota 15 menit** dan pembayaran Midtrans; kuota dilepas jika tidak dibayar.</li><li>**Tidak boleh oversell** (row lock/transaksi serializable, diuji dengan 500 pembeli paralel).</li><li>E-ticket email + PDF dengan QR bertanda tangan (Ed25519) yang bisa diverifikasi **offline**.</li><li>**Gate scanner PWA** (kamera) yang mencegah scan ganda dan sinkron saat online.</li><li>Nama pemegang + hash NIK untuk aturan 1 tiket 1 orang; flag verifikasi umur manual di gate.</li><li>Transfer tiket terbatas, dashboard penjualan dan check-in realtime.</li></ul> |
| **LENSA**: sewa kamera | Katalog + ketersediaan, harga/hari, deposit, konfirmasi admin ≤15 menit, COD Jabodetabek, skor kondisi 95%+, klaim 24 jam | <ul><li>Unit fisik per produk (serial).</li><li>Kalender ketersediaan; **anti-bentrok** via exclusion constraint `tstzrange`.</li><li>Kalkulator harga (hari, akhir pekan, paket) + deposit.</li><li>Verifikasi penyewa (unggah KTP terenkripsi, akses admin saja, auto-hapus 90 hari setelah sewa).</li><li>Antrian konfirmasi admin dengan timer SLA 15 menit + eskalasi.</li><li>Opsi COD/kurir dengan ongkir per zona.</li><li>Checklist serah-terima + foto; skor kondisi dihitung dari checklist pengembalian.</li><li>Alur klaim kerusakan ≤24 jam, refund deposit.</li></ul> |

### Aplikasi mobile

Untuk keempat aplikasi berlaku:
- dibangun dengan Expo, **local-first** dengan SQLite (berfungsi penuh tanpa akun dan tanpa internet), dengan backup dan sinkron cloud opsional lewat login;
- build APK lewat EAS;
- versi web (Expo web) di-embed di frame ponsel pada halaman `/karya/<slug>`.

| Produk | Klaim iklan | Yang harus benar-benar ada |
|---|---|---|
| **Jajan.in**: pencatat jajan | Saldo bulanan, tambah cepat (Kopi/Makan/Ojol/Snack), grafik 7 hari, statistik kategori, insight, target bulanan, notifikasi harian, laporan mingguan, mode hemat malam | <ul><li>Chip tambah cepat yang bisa diatur, input kurang dari 3 detik.</li><li>Kategori kustom, transaksi berulang, edit/hapus dengan undo.</li><li>Target dengan progres dan peringatan 80%/100%.</li><li>Insight dihitung dari data nyata (mis. "kopi naik 30% dari minggu lalu").</li><li>Notifikasi lokal harian dan ringkasan mingguan.</li><li>Mode hemat malam: konfirmasi ekstra untuk jajan setelah jam yang diatur.</li><li>Ekspor CSV, kunci PIN/biometrik.</li></ul> |
| **GymKuy**: teman latihan | Sesi hari ini dengan checklist, streak, kalori, jadwal mingguan, progres, PR, 6 badge | <ul><li>Program (Push/Pull/Legs, Full Body, buat sendiri).</li><li>Log set × rep × beban, rest timer dengan notifikasi.</li><li>**PR terdeteksi otomatis** (estimasi 1RM).</li><li>Streak dengan aturan hari istirahat.</li><li>Rules engine badge, kalori dengan rumus MET × berat badan × durasi.</li><li>Grafik volume, riwayat, rencana makan 7 hari sederhana.</li><li>Pengingat jadwal.</li></ul> |
| **Fokusin**: Pomodoro | Timer 25/50/15, mulai/jeda/reset, tugas, statistik, suara selesai, auto-start, getar 5 menit terakhir | <ul><li>Timer berbasis timestamp sehingga **tetap akurat saat app di background atau HP terkunci**; notifikasi lokal saat selesai.</li><li>Siklus fokus/istirahat pendek/panjang yang bisa diatur.</li><li>Tugas dengan estimasi pomodoro, dikaitkan ke sesi.</li><li>Statistik harian/mingguan dan rekor.</li><li>Suara, auto-start, getar sesuai klaim.</li><li>Widget/ongoing notification bila platform mendukung.</li></ul> |
| **Racunin**: rekomendasi kuliner | Kategori Pedes/Manis/Gurih/Minum, rating & harga, peta dengan pin, favorit, notifikasi makanan baru, mode ekstra pedas | <ul><li>Data **user-generated**: tambah tempat/menu dengan foto, harga, kategori, lokasi.</li><li>Rating dan ulasan, moderasi dan laporan.</li><li>Peta MapLibre (tile dari penyedia dengan API key yang saya isi, sesuai kebijakan tile), filter jarak.</li><li>Favorit (offline).</li><li>Notifikasi "racun baru" di sekitar (opt-in lokasi).</li><li>"Ekstra pedas" sebagai filter/preferensi.</li><li>Seed hanya data fiktif yang ditandai jelas.</li></ul> |

### Proyek asli dan alat

| Produk | Klaim iklan | Yang harus benar-benar ada |
|---|---|---|
| **ScrapPulse** + `/tools/scrappulse` | 1–4 kata kunci, periode 7/14/30, ID/EN, 5 sumber publik, teks penuh 12 artikel, sentimen ID+EN, topik & bias media, kutipan, rekomendasi desain survei, output dashboard + XLSX + JSON, Top Search 8 negara | <ul><li>FastAPI + Celery. Sumber: Google News RSS (ID/EN), Bing News RSS, Hacker News API, Wikipedia Pageviews API, Google Trends (via pustaka tidak resmi; tandai "opsional, bisa gagal" dan tampilkan status per sumber).</li><li>newspaper4k untuk teks penuh; hormati robots.txt dan rate limit; cache.</li><li>Sentimen: leksikon ID (negasi/intensifier) + VADER EN, divalidasi pada sampel berlabel kecil (tulis akurasinya).</li><li>Topik (TF-IDF/keyword clustering), kutipan, rekomendasi pertanyaan survei.</li><li>Progres job live, riwayat laporan, ekspor XLSX/JSON, halaman Top Search dan Changelog.</li><li>Disclaimer: bukan pengganti survei lapangan.</li></ul> |
| **Sistem Automasi** + `/tools` | Auto Komen ber-AI (3 nada), Auto Edit Video 9:16 dengan hook 3 baris + intro/outro, Auto Upload, antrian job, maks 300 MB | <ul><li>FastAPI + Celery + Redis.</li><li>**Auto Edit Video:** input berupa file unggahan atau URL konten **milik pengguna**; ffmpeg render 1080×1920 single-pass, overlay hook, intro/outro, subtitle opsional; hook dibuat LLM (provider bisa diatur via env); preview sebelum render.</li><li>**Auto Upload:** lewat **Instagram Graph API (Content Publishing, Reels)** untuk akun Business/Creator, dengan penjadwalan.</li><li>**Auto Komen:** asisten balas komentar **di postingan akun milik pengguna** via Graph API: AI menyusun draf dalam 3 nada, lalu pengguna menyetujui satu per satu atau memakai aturan auto-approve yang ketat.</li><li>Dashboard job, kuota per akun, counter "bot berjalan" dari data nyata.</li><li>**Dilarang:** login dengan password IG lewat browser automation, bypass CAPTCHA, komentar massal di akun orang lain, dan mengunduh konten pihak lain tanpa hak. Tulis alasannya (ToS Meta dan hak cipta) di PRODUCT.md.</li></ul> |
| **PhoneFarm** + `/panel/phonefarm` | 20 slot HP, auto-scan 5 detik, live H.264, kontrol ADB (tap/swipe/ketik), server 127.0.0.1, password panel, ADB key tidak dikirim ke browser | <ul><li>Agent lokal (Node) di komputer host dengan adb + scrcpy server.</li><li>Stream H.264 ke browser (WebCodecs, fallback MSE) dengan resolusi/FPS per perangkat.</li><li>Input tap/swipe/ketik/tombol, auto-scan perangkat tiap 5 detik.</li><li>**Aksi batch**: install APK, buka URL/app, screenshot, rekam layar singkat, jalankan skrip langkah.</li><li>Kesehatan perangkat (baterai, suhu, storage).</li><li>Default bind 127.0.0.1 + password + cek origin; remote hanya lewat tunnel yang dikonfigurasi pengguna.</li><li>Diposisikan sebagai **device lab untuk QA/testing aplikasi**, bukan untuk farming akun media sosial.</li></ul> |
| **Hub `/tools`** | Daftar alat, status Tersedia/Coming Soon, counter pengguna online & bot berjalan | <ul><li>Satu akun GAMADA (SSO lewat `packages/auth`) untuk semua alat.</li><li>Kuota/paket, riwayat job, counter dari data nyata (bukan simulasi), halaman status layanan.</li></ul> |

## Integrasi dengan website GAMADA

- `/karya/:slug` tetap berupa halaman cerita bergaya GAMADA (animasi sesuai prompt sebelumnya), ditambah:
  - tombol **"Buka produk"** ke URL produk (dari `src/content/site.ts`, mis. `kasirku.<domain>`);
  - tombol **"Coba demo"** yang login otomatis ke tenant demo;
  - untuk aplikasi mobile: Expo web di frame ponsel + tombol unduh APK;
  - status layanan live.
- Angka statistik di beranda (jumlah demo, aplikasi, studi kasus) dihitung dari `work.ts` dan status produk, bukan diketik manual.
- Klaim di copy website yang tidak benar-benar dipenuhi produk **wajib diubah** agar jujur. Laporkan setiap perubahan copy.

## Urutan kerja

Setiap tahap adalah satu workflow ultracode. Berhenti dan laporkan setelah tiap tahap.

| Tahap | Isi |
|---|---|
| 0 | **Audit & rencana.** Baca seluruh repo, `docs/`, dan `src/content/`. Jalankan Persona Walkthrough untuk **ke-13 produk + hub** secara paralel (satu agent per produk), lalu tulis `products/<slug>/PRODUCT.md` dan ringkasan `docs/PRODUCTS-ROADMAP.md`: urutan, risiko, kebutuhan akun/key dari saya, dan estimasi. **Belum menulis kode produk.** |
| 1 | **Fondasi platform:** monorepo, `packages/*`, `infra/docker-compose.yml`, auth + RBAC + multi-tenant, payments sandbox + webhook, notify, storage, mode demo dan reset, CI lokal (`npm run check`), template produk. |
| 2 | KasirKu |
| 3 | GoKantin (memakai ulang order + payments) |
| 4 | Tiket.in |
| 5 | LENSA |
| 6 | SmartCast |
| 7 | Kopi Senja (+ jadikan template F&B) |
| 8 | Fokusin, Jajan.in, GymKuy, Racunin (satu workflow per aplikasi; boleh paralel karena tidak berbagi file) |
| 9 | ScrapPulse |
| 10 | Sistem Automasi |
| 11 | PhoneFarm |
| 12 | Hub `/tools` + integrasi semua produk ke website GAMADA |
| 13 | **Hardening & rilis:** security review per produk (OWASP ASVS L1), uji beban (k6) untuk KasirKu dan Tiket.in, backup/restore teruji, runbook deploy VPS (`infra/deploy/`), Lighthouse, dan laporan akhir. |

## Bentuk workflow per produk (tahap 2–12)

1. **Spec**: perbarui PRODUCT.md, kontrak API (OpenAPI), skema DB, dan daftar layar.
2. **Build paralel**: api / web / mobile / worker. Setiap agent hanya memegang foldernya sendiri dan tidak menyentuh file agent lain.
3. **Integrasi**: `docker compose up` dan seed. Semua journey harus bisa dijalankan.
4. **Persona QA**: 3 agent persona memakai produk lewat Playwright dan mencoba merusaknya (input aneh, offline, dobel klik bayar, sesi kadaluarsa, HP layar kecil), satu agent security mencoba IDOR/akses lintas tenant, dan setiap temuan diverifikasi ulang secara adversarial sebelum diperbaiki.
5. **Fix**, lalu ulangi langkah 4 sampai tidak ada bug kritis atau mayor.
6. **Bukti klaim**: buat `products/<slug>/CLAIMS.md` berisi tabel *klaim → test → hasil → bukti* (path screenshot di `products/<slug>/evidence/` atau output test). Klaim yang tidak lolos tidak boleh ditandai selesai.

## Definition of Done (per produk)

- [ ] Semua klaim iklan di CLAIMS.md lolos dengan bukti.
- [ ] Journey ketiga persona lolos di Playwright (desktop 1440 dan mobile 390).
- [ ] Unit, integrasi, dan konkurensi test lulus; tidak ada error console; axe tanpa pelanggaran serius.
- [ ] Otorisasi per peran dan per tenant diuji (tidak ada IDOR).
- [ ] `docker compose up` dari clean clone berjalan; seed dan mode demo + reset berfungsi.
- [ ] README produk: cara menjalankan, env, peran, akun demo, batasan yang diketahui.
- [ ] Commit kecil-kecil dengan pesan jelas per langkah. Jangan push dan jangan deploy tanpa izin saya.

## Aturan keras

- Jangan pernah memakai data atau uang asli. Pembayaran hanya sandbox, dan semua data seed fiktif.
- Jangan menambahkan fitur yang melanggar ToS platform pihak ketiga atau hukum. Jika sebuah klaim iklan hanya bisa dipenuhi dengan cara itu, **ubah klaimnya** dan laporkan.
- Kalau butuh keputusan bisnis (harga paket, kebijakan refund, kota COD) atau key/akun dari saya, kumpulkan pertanyaannya dan ajukan di akhir tahap. Selama menunggu, pakai default yang wajar dan tandai `TODO(owner)`.
- Website GAMADA di root harus tetap lolos `npm run build` dan `npm run perf` setiap akhir tahap.
- Laporan akhir tiap tahap harus memuat:
  - apa yang selesai;
  - bukti (link file CLAIMS/evidence);
  - apa yang belum;
  - pertanyaan untuk saya;
  - perkiraan tahap berikutnya.
