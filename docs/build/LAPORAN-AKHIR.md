# Laporan akhir · Demo Ekosistem GAMADA (Tahap 2–7)

Ditulis 2026-11-20 oleh integrator Tahap 7 (Wave C). Semua angka di bawah diukur pada build produksi yang sama
(`npm run build` → `dist/`, disajikan `vite preview` di port 4173), kecuali disebut lain. Belum di-commit, belum di-push,
belum di-deploy.

---

## 1 · Apa yang sudah ada

| Bagian | Isi | Bukti |
|---|---|---|
| 17 produk + GAMADA Inti | `/demo/<slug>`: Satu Daerah (Sapa Warga, Meja Pimpinan, Naskah Pintar, Radar Isu, Siaga Wilayah, Awas Belanja, Cek Berkas), Usaha Pintar (Toko Autopilot, Pajak Beres, Juara Jualan, Kenal Mitra, Pantau Merek, TenderPilot), Pasar Daerah (Katalog Lokal, Rapor Usaha, Indeks Ekonomi, Sinyal Pasar), Inti. Satu dunia simulasi bersama, ≥ 10 rantai kejadian lintas produk, peran per produk, ID + EN. | [screenshot Tahap 7](../shots/demo/tahap-7/INDEX.md) |
| Tur | `/tur` "Satu Hari di Bojonegoro": 20 bab, presenter, ringkasan + PDF, Ambil alih → demo, jendela catatan presenter (`?notes=1`). | `tur-*.png` |
| Situs | beranda, `/ekosistem` + 4 halaman eko, 17 `/produk/:slug`, `/lab`, `/karya`, sitemap + JSON-LD. | `home-*`, `ekosistem-*`, `produk-*` |
| 3 wilayah | **Kab. Bojonegoro** (utama, tur), **Kota Bandung**, **Kota Padang**. Pemilih wilayah di TopBar semua demo; ganti tanpa muat ulang, dunia direset ke seed wilayah baru, peta terbang ke bbox baru. Bahasa daerah: Jawa, Sunda, Minang (teks "contoh", dengan terjemahan ID + EN). | `region-*.png` |

Situs dan tur tetap Bojonegoro (keputusan pemilik Q5). `/tur?region=bandung|padang` tetap bisa diputar tanpa error.

## 2 · Hasil uji

**e2e penuh** (`npx playwright test`, build `.e2e/dist` dengan `VITE_AI_PROXY_URL=''`, 3 worker, 30,4 menit):
**666 lulus, 10 gagal, 1 dilewati** dari 677.

| Folder | Tes | Hasil |
|---|---:|---|
| `tests/e2e/*.spec.ts` (chains, demo, polish, routes) | 107 | semua lulus |
| `tahap2/` (7 produk SD, chains-ui, live, no-dead-controls, **region-lang 54**) | 108 | semua lulus |
| `tahap3/` | 70 | semua lulus |
| `tahap4/` | 57 | semua lulus |
| `tahap5/` (tur) | 20 | semua lulus |
| `tahap6/` (situs) | 87 | semua lulus |
| `tahap7/` (a11y, targets, inp, **regions 57**, **final 3**) | 228 | 218 lulus; 9 gagal = INP > 200 ms (soft assert) saat 3 worker berbagi CPU; 1 gagal = `final` Bandung 390 (bug di tes: `locator.innerText` menunggu kolom narasi yang tidak ada di ponsel). Tes diperbaiki, lalu `final.spec` dijalankan ulang: **3/3 lulus**. INP diukur ulang dengan 2 worker (lihat §3). |

- **Rantai lintas produk**: chains (root) + `tahap2/chains-ui` + `tahap3/chains` + `tahap4/chains`: semua lulus (≥ 10 rantai).
- **Crawler tombol mati** (`tahap2/no-dead-controls`, 18 demo): lulus.
- **Matriks wilayah × bahasa** (baru): `tahap2/region-lang.spec.ts` = 18 demo × 3 wilayah, buka ID → EN → ID (teks kanvas benar-benar berubah, label pemilih wilayah ikut), plus peran alternatif EN di Bojonegoro: **54/54 lulus**. `tahap7/regions.spec.ts` = 18 demo × 3 wilayah: dunia benar-benar wilayah itu (`regionId`), nama dari pack tampil di kanvas dalam 10 dtk, ganti wilayah dari pemilih tanpa muat ulang (penanda `window` bertahan) dan jam kembali ke 07.00; plus peta Siaga Wilayah berpusat di bbox Bandung lalu terbang ke Padang, dan voice note contoh Sapa Warga dalam Sunda / Minang dengan terjemahan: **57/57 lulus**. Pengecualian yang tertulis di tes: Awas Belanja, Toko Autopilot, Juara Jualan, Inti (layar pertamanya tidak menyebut tempat) dan Cek Berkas (galeri spesimen masih Bojonegoro, cacat di §6) hanya dicek lewat `regionId` + TopBar.
- **Live mode**: mock SSE + fallback batas waktu 10 dtk (`tahap2/live.spec.ts`): lulus. `npm run ai:test`: 70 lulus, 0 gagal (+ matcher/stream/fallback/parity/proxy).
- **Tur autoplay 20 bab**: Bojonegoro 1440 + 390 (`tahap5`), Bandung 1440 + 390 dan Padang 1440 (`tahap7/final`): semua bab `done`, 0 fallback, 0 placeholder bocor, 0 gulir horizontal, **0 error konsol**.
- **Self-test**: `tsc -b` bersih; `region:validate` 3 pack lulus; `world.selftest` per pack (Bojonegoro 2392, Bandung 2374, Padang 2374 lulus, 0 gagal); region/tour/up/pd selftest exit 0; ui selftest lulus; viz force 42, format 97, monotone 3673 cek lulus; shell selftest lulus setelah perbaikan fit TopBar (sebelumnya 1 gagal: Toko Autopilot 1280 meluap 1 px).
- **Grep byte kontrol** (`src server/ai-proxy/src server/ai-proxy/prompts tests tools`): kosong. `git status`: tidak ada berkas terhapus.

## 3 · Angka

### Ukuran muatan awal (gzip -9, JS + JSON di luar beranda, MapLibre tidak dihitung; batas 180 KB, target internal 175)
Skrip: `.shots/t7-int/budget.mjs`. Kolom "T7 awal" = ID/EN Tahap 6 (`.shots/t6-int/budget.log`).

| Demo | ID | EN | Bandung ID | Padang EN | T7 awal ID / EN |
|---|---:|---:|---:|---:|---:|
| sapa-warga | 153,6 | 155,1 | 171,0 | 152,4 | 151,7 / 153,3 |
| meja-pimpinan | 176,6 | **178,2** | 171,3 | 168,1 | 175,3 / 176,9 |
| naskah-pintar | 147,2 | 148,8 | 146,3 | 146,1 | 145,4 / 147,0 |
| radar-isu | 165,1 | 166,7 | 164,2 | 164,0 | 160,0 / 165,6 |
| siaga-wilayah | 163,1 | 164,7 | 157,8 | 154,7 | 161,4 / 163,0 |
| awas-belanja | 152,0 | 153,5 | 151,0 | 150,8 | 150,9 / 152,5 |
| cek-berkas | 161,1 | 162,6 | 160,1 | 159,9 | 160,0 / 161,6 |
| toko-autopilot | 167,0 | 168,6 | 166,1 | 165,9 | 165,9 / 167,5 |
| pajak-beres | 165,9 | 167,4 | 164,9 | 164,7 | 164,8 / 166,3 |
| juara-jualan | 161,7 | 163,2 | 160,7 | 160,5 | 160,6 / 162,2 |
| kenal-mitra | 152,3 | 153,8 | 151,3 | 151,1 | 151,2 / 152,8 |
| pantau-merek | 159,8 | 161,4 | 158,9 | 158,7 | 158,7 / 160,2 |
| tenderpilot | 154,4 | 155,9 | 153,4 | 153,2 | 153,2 / 154,8 |
| katalog-lokal | 155,7 | 157,2 | 154,7 | 154,5 | 154,6 / 156,2 |
| rapor-usaha | 168,9 | 170,5 | 168,0 | 167,8 | 167,9 / 169,4 |
| indeks-ekonomi | 162,6 | 164,1 | 157,3 | 154,1 | 161,5 / 163,0 |
| sinyal-pasar | 144,5 | 146,1 | 143,6 | 143,4 | 143,5 / 145,1 |
| inti | 154,1 | 155,6 | 153,1 | 152,9 | 153,0 / 154,6 |
| `/tur` · `/tur/7` | 83,9 · 86,9 | 91,9 · 95,0 | | | 82,9 · 85,9 / 90,9 · 94,0 |

Peran alternatif (ID / EN) semuanya ≤ 173,8 (tertinggi: sinyal-pasar pemilik-toko 172,3 / 173,8). Situs: `/ekosistem` 30,9 (EN 41,0), halaman eko 31,5, `/produk/*` 30,7–32,0, `/lab` 25,2, `/karya` 16,5.

- **Semua demo ≤ 180 KB** di ID, EN, Bandung dan Padang.
- **Tidak terpenuhi:** (a) target internal ≤ 175: Meja Pimpinan ID 176,6 / EN 178,2; (b) "tidak lebih tinggi dari awal Tahap 7": hampir semua demo naik ≈ +1,0–1,6 KB (pemilih wilayah 3 pack + kit netral-wilayah di `demo-core`/`demo-gen` ≈ +0,75 KB, lalu konten per produk); Radar Isu ID +5,1 KB (set klarifikasi Sunda/Minang + varian hoaks tanpa bendungan). Sapa Warga Bandung 171,0 (+17 KB vs ID) karena salam/voice note Sunda memuat modul suara di awal; masih di bawah 180.
- **Beranda JS awal: 253,09 KB** (≤ 253,6).
- **Perf beranda** (`tools/perf.mjs`, CPU 1×, 1440×900 @1,25, RTX 4060, layar 144 Hz): p95 7,8 / 8,2 / 8,6 / 9,3 / 8,2 ms di 5 skenario, frame > 50 ms total 8; Tahap 6 (layar 60 Hz): p95 16,8 / 17,9 / 17,7 / 17,5 / 17,5, frame > 50 ms total 8; Tahap 1 (`docs/perf/tahap1-ab.txt`, CPU 1×) p95 7,3 / 12,3 / 13,7 / 12,7 / 12,8. **Tidak memburuk.** (`.shots/t7-int/perf.txt`)
- **LCP `/produk/:slug`**: tidak diukur ulang dengan Lighthouse di Tahap 7 (ditunda, §6).

### INP (×4 CPU, `tests/e2e/tahap7/inp.spec.ts`, build produksi, 390 = 3 run, 1440 = 1 run, angka terburuk; 2 worker)
114 interaksi diukur, **11 di atas 200 ms** (awal Wave B: 33). Hasil lengkap: `docs/build/tahap7-inp.json`.

| Skenario | terburuk 390 | terburuk 1440 |
|---|---|---|
| Siaga Wilayah · Kirim peringatan + layer | **296** (selesai), 264 (prakiraan +6 jam), 216 (citra satelit) | **352** (selesai) |
| Toko Autopilot · Bayar | **264** (buka keranjang) | 104 |
| Sapa Warga · Kirim aduan | **256** (foto banjir) | 152 |
| TenderPilot · Susun dokumen | **232** (ke Dokumen) | 184 |
| Ganti wilayah (Siaga Wilayah, peta terbang) | 168 | **232** |
| Cek Berkas · Verifikasi 50 berkas | **216** (mode Massal) | 160 |
| Meja Pimpinan · Susun briefing | **216** | 72 |
| Pantau Merek · Kirim 5 balasan | 136 | **208** |
| Katalog Lokal 184 · Indeks Ekonomi 192 · Awas Belanja 176 · Radar Isu 168 · Sinyal Pasar 168 · Rapor Usaha 160 · Kenal Mitra 160 · `/ekosistem` bintang 144 (1440: 160) · Inti 136 · Juara Jualan 128 · `/tur` 128 · Naskah Pintar 120 · ganti bahasa 104 · Pajak Beres 72 | ≤ 200 | ≤ 200 |

Tidak tercapai oleh skrip: "buka anomali" Sinyal Pasar (opsional, 15 dtk). Sisa di atas 200 ms sebagian besar render/layout (modal tutup + peta, tata letak kanvas), bukan skrip di klik itu; handler-nya sudah menunda kerja berat ke frame berikut (Wave B).

### Aksesibilitas
axe (`wcag2a/aa, wcag21aa`) pada 18 demo × 1440 + 390, `/tur` (pembuka, bab 7, ringkasan), situs dan satu demo EN per eko: **serious/critical = 0, moderate = 0** (total 0 temuan). Target sentuh 44 px (`targets.spec.ts`): **0 pelanggaran**. Hasil: `docs/build/tahap7-a11y.json`.

## 4 · Data dan lisensi

| Lapisan | Bojonegoro | Bandung | Padang | Lisensi |
|---|---|---|---|---|
| Batas kecamatan + desa/kelurahan | HDX COD-AB adm3/adm4 (28 kec, 430 desa) | HDX, ADM2 ID3273 (30 kec, 151 kel) | HDX, ADM2 ID1371 (11 kec, 104 kel) | CC BY-IGO (BPS / OCHA ROAP) |
| Kode Kemendagri kecamatan | id.wikipedia (Permendagri 72/2019) `35.22.xx` | `32.73.xx` | `13.71.xx` | CC BY-SA (fakta) |
| Sungai, jalan, pasar, landmark | OpenStreetMap (Overpass) | OSM | OSM | ODbL 1.0, © kontributor OpenStreetMap |
| Penduduk, KK, luas, ketinggian, sektor, harga dasar | **simulasi** (`tools/region/data/sim-<id>.mjs`) | simulasi | simulasi | simulasi GAMADA, berlabel *simulasi* |
| Zona banjir / longsor, `riskFlood/riskLandslide` | **turunan simulasi** (jarak ke Bengawan Solo × dataran rendah) | turunan (Cikapundung + cileuncang) | turunan (Batang Kuranji, Batang Kandis) | bukan peta resmi BNPB |
| OPD, layanan, sampel bahasa daerah | editorial GAMADA (Basa Jawa) | editorial (Basa Sunda, "contoh") | editorial (Baso Minang, "contoh") | konten GAMADA |
| Peta dasar / citra | OpenFreeMap; EOX Sentinel-2 cloudless 2016 | sama | sama | ODbL / CC BY 4.0 |

Tidak dipakai: InaRISK BNPB, RBI BIG, portal data pemkot, tabel BPS. **Padang tanpa lapisan tsunami** (Q2). Orang, perusahaan, media, akun dan vendor fiktif; pejabat hanya disebut jabatannya. Rincian per sumber: `src/demo-kit/region/packs/README.md`.

## 5 · Wow audit (satu putaran, tidak dinilai ulang)

Putaran tunggal sesuai Q4. **Catatan jujur tentang metode:** di sesi integrator tidak ada alat untuk menjalankan agen
penilai terpisah, jadi penilaian dilakukan oleh integrator sendiri dengan memerankan 4 persona, berdasarkan 111
screenshot akhir, hasil e2e/INP di atas, dan pemakaian demo lewat skrip Playwright. Skor 1–10, rata-rata 8 kriteria
spek (manfaat 30 dtk, visual, hidup, kelancaran, keterhubungan, kepercayaan, HP, ingin demo lanjutan). Skor Tahap 2/3
tidak tercatat di repo (audit Tahap 3–6 ditunda pemilik), jadi tidak ada angka pembanding; semua baris berstatus
**"tidak dinilai ulang"**.

| Demo | Bupati | Kadis Kominfo | Dir. Bank Daerah | Pemilik toko 3 cabang | Kriteria terendah |
|---|---:|---:|---:|---:|---|
| Tur "Satu Hari di Bojonegoro" | 8,4 | 8,1 | 7,6 | 7,4 | kelancaran 7 (panggung tergulir, kepala produk terpotong di bab 7; toast produk menimpa kolom narasi) |
| Sapa Warga | 8,6 | 8,4 | 7,3 | 7,2 | kelancaran 7 (tombol "foto banjir" 256 ms di HP) |
| Siaga Wilayah | 8,5 | 8,2 | 7,0 | 6,8 | kelancaran 6 ("selesai" kirim peringatan 296–352 ms) |
| Meja Pimpinan | 8,7 | 8,0 | 7,2 | 6,4 | HP 7 (padat), relevansi untuk toko |
| Toko Autopilot | 6,8 | 7,2 | 7,8 | 8,4 | kelancaran 7 ("buka keranjang" 264 ms) |
| Katalog Lokal | 7,9 | 7,6 | 7,4 | 8,0 | kepercayaan 7 (usulan bagi pesanan tanpa terpal, cacat Tahap 4) |
| Sinyal Pasar | 8,0 | 7,6 | 7,8 | 8,1 | kelancaran 7 (momen anomali butuh > 15 dtk setelah banjir) |

Target spek "≥ 8 di semua kriteria" **belum tercapai** untuk persona di luar sasaran utama tiap demo; tidak ada putaran
perbaikan lanjutan (Q4).

## 6 · Yang belum selesai

**Cacat terbuka (diketahui, tidak diperbaiki di Tahap 7):**
- INP > 200 ms di 11 interaksi (tabel §3), terburuk Siaga Wilayah "selesai" 352 ms.
- Meja Pimpinan di atas target internal 175 KB (EN 178,2; batas 180 terpenuhi); semua demo ≈ +1 KB dibanding awal Tahap 7.
- Cek Berkas: galeri spesimen KTP/KK/surat masih dokumen Bojonegoro (Provinsi Jawa Timur) di wilayah Bandung/Padang.
- Naskah Pintar: petunjuk misi "Setujui sebagai Bupati" masih statis (judul, penanda tangan dan catatan peran sudah "Wali Kota"/"Mayor" di kota sejak Wave C).
- Situs (`sapa-warga/copy.ts`, 5 `mini.tsx`) tetap Bojonegoro (disengaja, Q5).
- Cacat tur Tahap 5 (10c) sebagian: panggung tergulir sehingga kepala produk terpotong, toast produk di kiri bawah.
- Item 11 "kelancaran" hanya lewat penundaan INP; tidak ada pass terpisah untuk long task autoplay / layout shift baris baru.
- `/ekosistem` bintang: lulus di build ini (144/160 ms), tetapi biaya frame dasar halaman eko tinggi (ticker GSAP); bisa melewati 200 ms di mesin lebih lambat.
- Lighthouse LCP `/produk/:slug`, perf `/tur` dan Siaga Wilayah dengan pack Bandung (plan §3.3) tidak dijalankan ulang.
- `docs/shots/demo/baseline/` tidak dibuat: baseline = folder tahap-2…tahap-6 (disk C: hampir penuh).

**Sengaja tidak dikerjakan (plan §8):** redesign `/karya`; pemilih wilayah di halaman situs dan narasi tur Bandung/Padang; putaran ulang wow; partikel OGL konstelasi (Could 18); refaktor ukuran kit (item 15); statistik resmi, peta BNPB, zona tsunami, cuaca BMKG langsung, pemeriksaan penutur asli Sunda/Minang; unggah CSV sendiri di Pajak Beres, layar PKP/PPN, bukti potong.

**Menunggu pemilik:** kunci API + batas anggaran + hosting proxy untuk Live mode; kontak di `src/content/site.ts` (masih TODO) dan domain (sitemap/JSON-LD memakai `https://gamada.id`; `robots.txt` belum ada); perintah commit/push/deploy.

## 7 · Cara menjalankan

```bash
npm install
npm run dev                 # http://127.0.0.1:5173
npm run build               # tsc + region:validate (3 pack) + vite build → dist/
npm run preview             # http://127.0.0.1:4173
npm run region:validate     # zod, anggaran gzip, label simulasi, round-trip .min
npm run test:e2e            # build .e2e/dist + Playwright (677 tes, ±30 mnt, 3 worker)
npm run perf                # A/B scroll beranda (butuh preview di 4173)
npm run ai:test             # proxy AI + matcher/stream/fallback
npm --prefix server/ai-proxy run dev:mock   # Live mode dengan mock (node server/ai-proxy)
node tools/shot-diff.mjs    # pixel diff screenshot tahap-7 vs tahap sebelumnya
REGION=bandung npx tsx src/demo-kit/world/__tests__/world.selftest.ts   # self-test dunia per pack
```

**Menambah wilayah ke-4:** salin `tools/region/{fetch,build}-<id>.mjs`, `data/sim-<id>.mjs`, `content/<id>.mjs` dari
pack terdekat (kota → Bandung/Padang, kabupaten → Bojonegoro), ganti pcode ADM2, bbox, nama dan konten; jalankan
`fetch` lalu `build` (menghasilkan 6 berkas di `src/demo-kit/region/packs/<id>/` dan menjalankan validasi); tambahkan
satu baris ke `REGIONS` di `src/demo-kit/region/loader.ts` (≤ 0,3 KB) dan satu bagian sumber/lisensi di
`packs/README.md`; jalankan `REGION=<id>` world self-test dan `tests/e2e/tahap7/regions.spec.ts`. Langkah rinci:
`src/demo-kit/region/packs/README.md` § "Adding a fourth region".
