# Prompt VS Code: 13 produk GAMADA end-to-end (Opus 5.5 · High · Ultracode)

## Persiapan (dikerjakan oleh Anda)

1. **Tunggu Fase 2 selesai.** Jangan jalankan prompt ini selama agent lain masih mengedit folder `gamada`.
2. **Jadikan folder ini repo git.** Ultracode memakai git worktree, dan git juga menjadi cadangan kalau ada yang rusak. Jalankan ketiga perintah ini berurutan:
   ```bash
   git init
   ```
   ```bash
   git add -A
   ```
   ```bash
   git commit -m "baseline sebelum produk E2E"
   ```
3. **Siapkan alat dan akun** (agent akan menanyakannya ketika dibutuhkan):
   - Docker Desktop
   - Node 22
   - Python 3.12
   - Android SDK (adb)
   - akun Expo
   - key sandbox Midtrans
   - SMTP (boleh Mailpit lokal)
   - akun Instagram Business/Creator + Meta App
   - HP Android untuk PhoneFarm
4. **Atur Claude Code di VS Code:**
   - model **Opus 5.5**, effort **High**;
   - naikkan opsi "Dynamic workflow size" di config, karena satu tahap bisa memakai lebih dari 10 agent.
5. **Kirim prompt bertahap.** Kirim prompt di bawah garis sekali. Setelah agent melapor, balas `lanjut tahap N` untuk tiap tahap berikutnya.

Spesifikasi detail tiap produk sudah tersedia di [docs/products/](products/), satu file per produk. Isinya:
- persona;
- journey;
- tabel klaim → yang harus ada → acceptance test;
- fitur MVP;
- peran;
- model data;
- integrasi;
- edge case;
- skenario E2E;
- celah yang ditemukan critic.

Spesifikasi itu dihasilkan dengan menganalisis setiap produk dari sudut pandang penggunanya.

---

ultracode

## Konteks

Ini proyek pribadi saya untuk testing dan portofolio. Semua produk dipakai sendiri. Repo ini adalah **GAMADA**, website studio digital (Vite 8, React 19, TS strict, GSAP, Lenis, OGL, react-router 7). Website ini menampilkan 13 produk di `src/content/work.ts` serta hub `/tools`, `/tools/scrappulse`, dan `/panel/phonefarm`. Saat ini semuanya masih demo dengan data dummy.

## Tujuan

Bangun ke-13 produk dan hub tools **end-to-end sampai menjadi produk jadi yang benar-benar bisa dipakai**: backend, database, login dan peran, pembayaran (sandbox), notifikasi, job worker, test, seed data, Docker, dokumentasi, dan halaman di website GAMADA yang membuka produk aslinya.

Ukuran keberhasilannya satu: **setiap fitur yang diiklankan benar-benar berfungsi** saat dipakai pengguna.

## Sumber kebenaran

- `docs/products/<slug>.md`: spesifikasi lengkap per produk. Baca seluruh file sebelum mengerjakan produk itu. Tabel **Klaim → Acceptance test** adalah kontrak yang harus lulus, dan bagian **Celah dari critic** wajib ditutup.
- `docs/products/_LINTAS-PRODUK.md`: aturan yang berlaku untuk semua produk:
  - setiap produk punya dua adapter data, `live` (API) dan `demo` (berjalan di browser dengan seed + IndexedDB + MSW), lengkap dengan tombol simulasi pembayaran;
  - reset demo per browser, dan reset server pukul 03.00 WIB.
- Website dan konten yang sudah ada: `src/`, `src/content/`, `docs/CONTRACTS.md`, `docs/PERF.md`.

Daftar produk (slug sama dengan nama file spesifikasi):

| Kelompok | Produk |
|---|---|
| Web | `kasirku`, `gokantin`, `tiketin`, `lensa`, `smartcast`, `kopi-senja` |
| Mobile (Expo) | `jajanin`, `gymkuy`, `fokusin`, `racunin` |
| Alat & proyek | `scrappulse`, `sistem-automasi`, `phonefarm`, `tools-hub` |

## Cara berpikir: jadilah penggunanya

Untuk setiap produk:
1. **Sebelum membangun:** baca persona dan journey di spesifikasinya. Bayangkan kamu adalah setiap persona itu, lalu perbarui spesifikasi kalau menemukan kebutuhan nyata yang belum tertulis. Simpan hasilnya sebagai `products/<slug>/PRODUCT.md`.
2. **Sesudah membangun:** lakukan **Persona QA**. Satu agent per persona memakai produk lewat Playwright di browser asli sesuai journey-nya. Agent ini sengaja mencoba merusak produk: input aneh, offline, dobel klik bayar, sesi kadaluarsa, layar 360px, HP lambat (CPU 4×). Setiap bug dilaporkan dengan langkah reproduksi.
3. Produk baru selesai jika semua acceptance test lulus dan tidak tersisa bug kritis atau mayor.

## Arsitektur (seragam untuk semua produk)

Buat npm workspaces monorepo **tanpa memindahkan website**. Website tetap di root.

```
/                       website GAMADA (tetap, jangan rusak)
packages/
  ui/                   design system bersama (token palet GAMADA, komponen aksesibel)
  auth/                 Better Auth (email+password, magic link, Google opsional), RBAC, multi-tenant, SSO antarproduk
  db/                   Drizzle + Postgres 17, satu schema per produk, helper migrasi
  payments/             Midtrans sandbox (Snap + QRIS + VA), verifikasi signature webhook, idempotency, ledger
  notify/               email (SMTP/Mailpit), WhatsApp (adapter), push (Expo / Web Push)
  storage/              MinIO/S3, presigned upload multipart, validasi tipe/ukuran
  data-adapter/         interface live|demo + MSW + seed IndexedDB (lihat _LINTAS-PRODUK.md)
  config/               eslint, tsconfig, schema env dengan zod
products/<slug>/
  PRODUCT.md  CLAIMS.md  README.md
  api/                  Hono (Node 22) + zod + OpenAPI   | FastAPI untuk scrappulse & sistem-automasi
  web/                  Vite + React 19 + TanStack Query/Router (PWA bila perlu offline)
  mobile/               Expo + expo-router + expo-sqlite (khusus 4 aplikasi mobile; local-first; web export; APK via EAS)
  worker/               BullMQ (Node) | Celery (Python)
  e2e/                  Playwright per persona
  evidence/             screenshot dan output test sebagai bukti klaim
  docker-compose.yml
infra/
  docker-compose.yml    Postgres, Redis, MinIO, Mailpit, Caddy (HTTPS)
  deploy/               runbook VPS: SSH key-only, UFW 22/80/443, Caddy auto-SSL, backup pg_dump harian + uji restore
```

Standar bersama:
- **Data:** uang dalam integer rupiah, waktu dalam UTC dan ditampilkan dalam WIB.
- **Validasi & keamanan:**
  - semua input divalidasi;
  - otorisasi per peran dan per tenant diuji (tidak boleh ada IDOR);
  - rate limit dan CSRF;
  - cookie aman;
  - audit log untuk aksi uang dan admin;
  - data identitas (KTP/NIK) dienkripsi;
  - secret hanya di `.env`; `.env.example` di-commit.
- **Pembayaran & konkurensi:**
  - status pembayaran ditentukan oleh webhook, dan webhook harus idempotent;
  - kuota, stok, dan jadwal sewa memakai transaksi atau lock, serta diuji dengan beban paralel.
- **Offline:** wajib untuk kasir KasirKu, gate scanner Tiket.in, dan keempat aplikasi mobile.
- **Kualitas:**
  - typecheck dan lint lulus;
  - Vitest/pytest untuk logika bisnis;
  - Playwright untuk setiap journey;
  - axe tanpa pelanggaran serius;
  - Lighthouse mobile ≥85 untuk halaman publik.
- **Tampilan:**
  - setiap produk boleh punya brand sendiri, tetapi memakai komponen `packages/ui`;
  - mobile-first dan berbahasa Indonesia;
  - empty, loading, dan error state yang ramah.

Pilihan implementasi yang sudah diputuskan:
- **Instagram (Sistem Automasi):**
  - pakai Instagram Graph API dengan OAuth akun Business/Creator;
  - publikasi Reels lewat Content Publishing API, termasuk penjadwalan;
  - komentar dan mention pada media milik akun yang terhubung dibaca lewat webhook + polling, lalu dibalas;
  - balasan dibuat LLM dalam 3 nada dengan mode "tinjau dulu" atau "otomatis".
- **Auto Edit Video:** sumber dari link (yt-dlp) atau unggahan file; hook 3 baris dibuat LLM (provider diatur lewat env); render ffmpeg 1080×1920.
- **PhoneFarm:** agent lokal Node (adb + scrcpy), stream H.264 ke browser (WebCodecs), dan macro/script runner per perangkat dan per aplikasi (record & replay, langkah skrip, aksi batch untuk 20 perangkat).
- **ScrapPulse:** sumber Google Trends dipasang dengan fallback otomatis kalau sumbernya tidak merespons; status per sumber ditampilkan di UI.
- **Peta (Racunin):** MapLibre dengan tile dari API key yang saya isi di `.env`.

## Integrasi ke website GAMADA

- `/karya/:slug` tetap memakai gaya dan animasi GAMADA, ditambah:
  - tombol **Buka produk** (URL dari `src/content/site.ts`);
  - tombol **Coba demo** yang memakai adapter demo, berjalan penuh di browser tanpa backend;
  - untuk aplikasi mobile: Expo web di dalam frame ponsel + tombol unduh APK;
  - status layanan live.
- Angka statistik di beranda dihitung dari `work.ts` dan status produk.
- Copy website diselaraskan dengan kemampuan produk yang sebenarnya, termasuk label "Tersedia" / "Coming Soon" di `/tools` yang diambil dari feature flag dan health check.

## Tahapan

Setiap tahap dijalankan sebagai satu workflow ultracode. Setelah tiap tahap, berhenti dan laporkan.

| Tahap | Isi |
|---|---|
| 0 | **Audit & rencana.** Baca repo, `docs/`, dan semua `docs/products/*.md`. Satu agent per produk menjalankan persona walkthrough dan menulis `products/<slug>/PRODUCT.md`. Lalu tulis `docs/PRODUCTS-ROADMAP.md`: urutan kerja, risiko, kebutuhan akun/key, dan estimasi. **Belum menulis kode produk.** |
| 1 | **Fondasi:** monorepo, `packages/*`, `infra/`, auth + RBAC + multi-tenant + SSO, payments + webhook, notify, storage, data-adapter live/demo, reset demo, `npm run check` (semua test), dan template produk. |
| 2 | KasirKu |
| 3 | GoKantin |
| 4 | Tiket.in |
| 5 | LENSA |
| 6 | SmartCast |
| 7 | Kopi Senja |
| 8 | Fokusin · Jajan.in · GymKuy · Racunin (satu workflow per aplikasi, boleh paralel dalam worktree terpisah) |
| 9 | ScrapPulse |
| 10 | Sistem Automasi |
| 11 | PhoneFarm |
| 12 | Hub `/tools` + integrasi semua produk ke website GAMADA |
| 13 | **Hardening & rilis:** security review per produk (OWASP ASVS L1), uji beban k6 (KasirKu checkout, Tiket.in war tiket), backup/restore teruji, runbook deploy, Lighthouse, dan laporan akhir. |

## Bentuk workflow per produk (tahap 2–12)

1. **Spec:** baca `docs/products/<slug>.md`, perbarui `PRODUCT.md`, lalu tulis kontrak OpenAPI, skema DB, dan daftar layar.
2. **Build paralel:** api / web / mobile / worker / adapter demo. Setiap agent hanya memegang foldernya sendiri.
3. **Integrasi:** `docker compose up` + seed; journey bisa dijalankan di mode live maupun demo.
4. **Persona QA:** satu agent per persona memakai produk lewat Playwright dan mencoba merusaknya. Tambahkan satu agent yang menguji akses lintas tenant dan peran. Setiap temuan diverifikasi ulang oleh agent lain sebelum diperbaiki.
5. **Fix**, lalu ulangi langkah 4 sampai tidak ada temuan kritis atau mayor.
6. **Bukti:** tulis `products/<slug>/CLAIMS.md` berisi tabel *klaim → test → hasil → bukti* (path di `evidence/` atau output test). Setiap baris acceptance test di spesifikasi harus muncul di tabel ini dengan status lulus.

## Definition of Done (per produk)

- [ ] Semua acceptance test di `docs/products/<slug>.md` lulus, dengan bukti di CLAIMS.md.
- [ ] Journey semua persona lulus di Playwright (1440px dan 390px), di mode live dan demo.
- [ ] Unit, integrasi, dan konkurensi test lulus; tidak ada error console; axe bersih.
- [ ] `docker compose up` dari clean clone langsung berjalan; seed, mode demo, dan reset berfungsi.
- [ ] README produk: cara menjalankan, env, peran, akun demo.
- [ ] Commit kecil per langkah dengan pesan jelas. Tidak ada push atau deploy tanpa perintah saya.

## Aturan kerja

- Pembayaran memakai mode sandbox, dan seed data fiktif.
- Kalau butuh keputusan dari saya (harga paket, kebijakan refund, kota COD) atau key/akun, kumpulkan pertanyaannya di akhir tahap. Selama menunggu, pakai default yang wajar dan tandai `TODO(owner)`.
- Website GAMADA di root harus tetap lolos `npm run build` dan `npm run perf` di akhir setiap tahap.
- Laporan akhir tiap tahap memuat:
  - apa yang selesai;
  - link ke CLAIMS.md dan evidence;
  - apa yang belum;
  - pertanyaan untuk saya;
  - rencana tahap berikutnya.
