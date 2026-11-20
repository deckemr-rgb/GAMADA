# Tahap 9: Rencana audit holistik (siap dijalankan)

Acuan:
- Spesifikasi: §4, §11 dan §12 baris 9 di `docs/PROMPT-VSCODE-TAHAP9-16.md`.
- Rencana induk: `docs/build/tahap9-16-rencana.md`.

Sifat tahap: hanya membaca dan mengukur. Kode produk (`src/`, `server/`, `tests/`) tidak diubah. File yang ditulis hanya:
- dokumen di `docs/build/`;
- screenshot di `docs/shots/demo/tahap-9/`;
- alat di `tools/budget.mjs` dan `tools/lcp.mjs`, bila pemilik mengizinkan (pertanyaan #4). Bila tidak diizinkan, keduanya ditaruh di `.shots/t9/` (gitignore).

## 0. Prasyarat (WF0, orkestrator, ±0,3 jam)

| # | Cek | Bila gagal |
|---|---|---|
| 1 | `git status`: Tahap 8 sudah di-commit (pesan "Tahap 8", tanpa `reports/` dan `research_notes/`) | Berhenti dan minta izin commit (§11). Jangan revert apa pun. |
| 2 | `df -h /c` ≥ 1 GB kosong (disarankan 2 GB) | Berhenti. Opsi: hapus `.shots/` (277 MB) setelah langkah 3, bila pemilik setuju. |
| 3 | Salin `.shots/t7-int/budget.mjs` ke `tools/budget.mjs` | — |
| 4 | Port 4173 bebas: `netstat -ano \| findstr :4173` | Preview T8 masih hidup: matikan hanya bila PID-nya milik sesi agen, bukan milik pemilik. Port 5173 tidak pernah disentuh. |
| 5 | Re-baseline pointer: jalankan ulang `grep` untuk setiap simbol §4.1 dan §5.2 setelah commit T8, lalu tulis tabel simbol → file:baris ke `.shots/t9/pointers.json` | — |
| 6 | Tulis `docs/build/rubrik-persona.md` dari §4 dokumen ini, tanpa perubahan. T13 dan T16 memakai file yang sama persis. | — |
| 7 | Sebarkan prompt finder yang merujuk **simbol**, bukan nomor baris | — |

## 1. Aturan server dan pengukuran

- Ada satu server saja. Orkestrator menjalankan:
  ```
  VITE_AI_PROXY_URL= npm run build
  npx vite preview --port 4173 --strictPort --host 127.0.0.1
  ```
  Preview dijalankan di latar belakang dan PID-nya dicatat. `VITE_AI_PROXY_URL` dikosongkan agar AI berperilaku seperti di e2e (Simulasi).
- Semua agen hanya membuka `http://127.0.0.1:4173`. Port 5173 tidak disentuh. Tidak ada `npm run dev`, tidak ada `npm install`.
- Spec repo tidak boleh dijalankan dengan `playwright.config.ts`, karena config itu membangun `.e2e/dist` sendiri di port 4190. Pakai config sementara `.shots/t9/pw.audit.config.ts` (gitignore, di dalam repo agar `@playwright/test` ter-resolve). Isinya: `testDir: '../../tests/e2e'`, `use.baseURL: 'http://127.0.0.1:4173'`, `channel: 'chrome'`, tanpa `webServer`, `workers: 1`, `trace: 'off'`, `outputDir: '.shots/t9/test-results'`.
- Paling banyak 3 Chrome hidup bersamaan. `tools/shot.mjs` sudah menghapus profil sementaranya.
- Pengukuran perf dan INP harus eksklusif, tanpa Chrome lain, dan selesai sebelum finder mulai.
- Di akhir tahap: matikan preview (`taskkill /PID <pid> /T /F`), hapus `.shots/t9/test-results`, cek `df`.
- Cek `df` sebelum setiap langkah berat. Bila sisa < 300 MB, berhenti dan laporkan.

## 2. WF1: Pengukuran dan pustaka screenshot (1 agen, serial, ±2–2,5 jam)

Urutan wajib:

| Langkah | Perintah / cara | Keluaran |
|---|---|---|
| a1 | `node tools/perf.mjs` dijalankan 3× (median), tanpa Chrome lain | `.shots/t9/perf.json`, dibandingkan dengan angka LAPORAN-AKHIR |
| a2 | `npx playwright test -c .shots/t9/pw.audit.config.ts tahap7/inp.spec.ts` | INP per interaksi (≤ 200 ms) |
| b | `node tools/budget.mjs 4173 dist` untuk 18 demo dan `/tur`, ID dan EN. Bila skrip belum mengukur EN, tambahkan `?lang=en`. | Tabel batas ukuran: KB per demo vs 180/175, home JS vs 253,6 KB |
| c | `tahap7/a11y.spec.ts` lewat config sementara, ditambah satu pass axe di 375 dan 768 untuk home, `/ekosistem`, 3 `/produk`, 3 `/demo` | Jumlah pelanggaran per halaman dan lebar |
| d | Skrip baru `tools/lcp.mjs`: CDP, CPU ×4, PerformanceObserver `largest-contentful-paint` dan `layout-shift` | LCP dan CLS untuk home, `/ekosistem`, 3 `/produk/:slug` (median 3 run) |
| e | Pustaka screenshot (lihat §6). Dari langkah ini boleh 2–3 Chrome paralel. | ±160 shot dan `facts.json` |

`facts.json` mencatat untuk setiap URL dan lebar: error console, `scrollWidth > clientWidth` (scroll horizontal), CLS, waktu siap, dan path shot.

Sinyal selesai WF1: tulis `.shots/t9/wf1-done.json` berisi ringkasan angka. Isinya menjadi input semua finder.

## 3. WF2: Finder (9 agen paralel, ±1,5–2,5 jam)

Finder bekerja terutama dari pustaka shot, `facts.json` dan kode. Repro di browser lewat `tools/shot.mjs` atau Playwright ke 4173, dengan batas 3 Chrome hidup (koordinasi lewat file kunci `.shots/t9/chrome-N.lock`).

| Agen | Lensa / produk | Fokus wajib |
|---|---|---|
| L1 | Lensa 1 dan 3 (kesan pertama, IA, copy), agregator lensa 9 | Uji 10 detik dan 60 detik di home. Alur Home → Ekosistem → Produk → Demo → Hubungi. Stub `/proses`, `/faq`, `/panel/phonefarm`. 8 TODO di `site.ts` (WA, email, badan usaha, domain). Menu "Layanan & Produk" vs "Ekosistem". Bahasa tahap internal. Statistik. **Vonis per item Karya** (relevan untuk Ekosistem atau tidak, plus alasan) untuk T10. Gabungkan checklist konsistensi dari P1–P5. |
| L2 | Lensa 2: motion | Verifikasi 7 hipotesis §4.1 di browser dengan frame burst (screenshot CDP tiap 50 ms) atau screencast, plus entri `layout-shift`. Ukur lompatan px GuidePanel (`SHELL.guideW`). Curtain di rute bare (`RootLayout` `bare`). Tab Radar Isu. Animasi keluar Toast/Popover/GuidePanel. `.pr-skel-card`. `ECO_SITE.mini.crossfade`. `Opener`. tenderpilot. Tanpa bukti frame, temuan motion akan dibantah. |
| L3 | Lensa 5 dan 8: realisme dan hukum | Foto kartun, sumber tanpa tautan, angka bulat karangan, suara robotik. Label simulasi yang hilang saat di-screenshot. Nama instansi, merek atau media nyata. Kutipan pejabat. UU PDP. Gambar yang bisa disebar seolah asli. |
| L4 | Lensa 6 dan 7: mobile, a11y, perf | Tafsir angka WF1. 375 dan 768. Navigasi keyboard saja di 1 alur per ekosistem. Kontras. `prefers-reduced-motion`. `?static=1`. Lonjakan GPU raster home. LCP `/produk`. |
| P1 | Lensa 4: sapa-warga, meja-pimpinan, naskah-pintar, radar-isu | Dosir per produk (lihat bawah) |
| P2 | siaga-wilayah, awas-belanja, cek-berkas, ditambah `/tur` (19 bab dan ringkasan, `?notes=1`) | Dosir per produk; tur dinilai sebagai "produk" ke-19 |
| P3 | toko-autopilot, pajak-beres (`onReview`), juara-jualan ("demo segera hadir" ID+EN) | Dosir |
| P4 | kenal-mitra, pantau-merek (klaim palsu mesin Analisis: `copy.ts` relasi dan FAQ, `eco.ts`, radar FAQ), tenderpilot | Dosir |
| P5 | katalog-lokal, rapor-usaha, indeks-ekonomi, sinyal-pasar, inti, ditambah `/lab` | Dosir |

**Dosir per produk** berisi:
- status *Siap demo* / *Perlu poles* / *Belum layak*;
- skenario demo 3 menit ideal sebagai storyboard 6–8 shot (path shot);
- apa yang kurang;
- 3 perbaikan berdampak terbesar;
- 5–10 temuan;
- checklist konsistensi: pola UI, istilah, peran, gaya bicara AI.

Satu demo per produk dibuka di region Bandung atau Padang dan dalam EN, sekadar sampel.

**Skema temuan (JSON, satu objek per temuan):**
```json
{ "id": "L2-03", "lens": 2, "product": "radar-isu|situs|tur|-",
  "claim": "satu kalimat fakta",
  "evidence": [{"type": "file", "ref": "src/...:123"}, {"type": "shot", "ref": "docs/shots/demo/tahap-9/..."},
               {"type": "metric", "ref": "CLS 0,18 /produk/x 375"}, {"type": "repro", "ref": "1. buka … 2. klik …"}],
  "impact": "dampak bisnis untuk persona mana",
  "severity": "Kritis|Tinggi|Sedang|Rendah", "effort": "S|M|L", "target": "T10..T16", "quickWin": true }
```
- `evidence` wajib berisi minimal 1 item. Skrip pra-filter membuang temuan tanpa bukti.
- Batas 10 temuan utama per agen. Sisanya masuk "daftar minor": tidak diverifikasi dan diberi label begitu.
- Setiap agen juga mengembalikan `covered[]` = {rute, lebar, bahasa, region, keadaan}. Isinya dipakai kritik kelengkapan.
- Keparahan:
  - Kritis: demo macet atau memalukan di depan klien, atau risiko hukum.
  - Tinggi: merusak kepercayaan atau momen utama.
  - Sedang: mengganggu tapi demo tetap jalan.
  - Rendah: polesan.
- Usaha: S < 1 jam, M 1–4 jam, L > 4 jam.

## 4. Rubrik persona (disalin ke `docs/build/rubrik-persona.md`)

**Persona.** Masing-masing menilai secara buta terhadap persona lain.
1. Bupati/Wali Kota: waktu 10 menit, peduli citra, risiko politik, hasil nyata ke warga.
2. Kadis Kominfo/Humas: teknis menengah, peduli integrasi, keamanan data, hoaks, beban staf.
3. Direktur BPR: peduli risiko kredit, kepatuhan OJK/PDP, angka yang bisa dipertanggungjawabkan.
4. Pemilik usaha menengah (3 cabang): peduli waktu, uang, kemudahan, bukti hemat.

**Sasaran per produk** (dipakai untuk gerbang T13/T16 bila pemilik menyetujui default #7):

| Ekosistem | Persona sasaran |
|---|---|
| Satu Daerah | Bupati, Kominfo |
| Usaha Pintar | Pemilik usaha; Direktur BPR untuk kenal-mitra dan tenderpilot |
| Pasar Daerah dan Inti | Bupati, Direktur BPR |
| Situs dan tur | Semua persona |

**Skala 1–10, definisi per angka:**

| Skor | Kejelasan nilai | Kredibilitas data | Momen wow | Kelancaran | Kepercayaan |
|---|---|---|---|---|---|
| 1 | Tidak bisa menebak fungsi produk | Kosong, NaN, lorem, jelas salah | Tidak ada | Error/crash, demo terhenti | Tampak data pribadi nyata atau kutipan pejabat nyata |
| 2 | Fungsi tertebak, untuk siapa tidak | Angka bertentangan antar layar | Efek tanpa makna | Tombol mati/layar kosong di alur utama | Klaim fitur yang tidak ada |
| 3 | Jelas setelah > 60 detik membaca | Angka bulat karangan, nama generik ("Desa A") | Fitur bagus tapi harus dicari | Perlu presenter menjelaskan agar bisa lanjut | Tanpa label simulasi di layar yang bisa di-screenshot |
| 4 | Jelas ≤ 60 detik, manfaat abstrak ("efisiensi") | Masuk akal, tanpa waktu/satuan/sumber | Ada momen, lambat atau datar | Jalan, tapi lag > 500 ms atau lompatan layout | Label ada tapi mudah terlewat; kontak TODO |
| 5 | Jelas ≤ 60 detik, manfaat umum tanpa contoh | Konsisten, tempat nyata region, tanpa sumber | Satu momen jelas, biasa saja | Jalan dengan beberapa kekakuan (transisi terpotong) | Label jelas; tanpa penjelasan data/PDP |
| 6 | Jelas ≤ 60 detik dengan contoh kasus | Ada waktu dan satuan; foto kartun atau sumber tanpa tautan | Satu momen kuat dalam 3 menit | Lancar di desktop, cacat di 375/768 | Ada bagian Keamanan & Data umum |
| 7 | Jelas ≤ 30 detik, contoh mengenai masalah persona | Sumber/asal tertulis, angka cocok lintas produk | Dua momen; satu membuat persona berhenti dan melihat | Lancar desktop dan ponsel, tanpa penjelasan | Jelas siapa yang memutuskan (manusia); AI tidak memvonis |
| 8 | Paham dalam 10 detik, manfaat terukur (jam/rupiah/risiko) | Ditambah bukti visual realistis berlabel simulasi | Momen menyelesaikan masalah nyata persona di depan mata | Ditambah transisi halus, tanpa lompatan, mudah diambil alih | Jejak audit dan persetujuan manusia terlihat di alur |
| 9 | Persona bisa menjelaskan ke atasan dalam 1 kalimat | Persona tidak menemukan celah saat menggali 3 klik | Persona ingin menunjukkan ke orang lain | Bisa dipresentasikan tanpa latihan; cerita/tur jalan sendiri | Persona akan meloloskannya ke uji coba |
| 10 | Persona langsung menyebut di mana dipakai di instansinya | Persona mengira data nyata sampai melihat label (yang tetap terlihat) | Persona minta jadwal demo untuk timnya saat itu | Terasa seperti produk kelas dunia yang sudah jadi | Persona merasa lebih aman dari vendor sekarang |

Aturan skor:
- Skor produk per persona adalah rata-rata 5 kriteria. Skor produk adalah rata-rata persona (sasaran dan semua dilaporkan terpisah). Skor situs dan tur dinilai terpisah.
- Setiap skor wajib mengutip 1 shot atau langkah sebagai bukti. Tiap persona boleh melakukan paling banyak ±5 cek live sendiri.
- **Kalibrasi** sebelum menilai: keempat persona menilai 2 anchor bersama.
  - Anchor buruk: `/faq` (stub) di 1440.
  - Anchor baik: `/demo/radar-isu` tab Live di 1440 setelah 30 detik.
  - Bila selisih antarpersona > 2 poin di satu kriteria, orkestrator menjelaskan definisi rubrik satu kali, lalu persona menilai ulang anchor itu. Skor anchor dicatat untuk T16.

## 5. WF3: Verifikasi dan panel (9 agen, ±1,5–2 jam)

- **Dedupe dengan skrip** sebelum verifikasi (kunci: produk, simbol/file dan klaim yang dinormalisasi). Perkiraan 150–250 temuan mentah menjadi ±100–150.
- **Skeptis adversarial:** S1 dan S2 memegang temuan lensa (L1–L4), S3 dan S4 temuan produk (P1–P5). Setiap temuan dicek 2 skeptis secara independen, dengan reproduksi sendiri.
  - Vonis: CONFIRMED, REFUTED atau UNSURE, plus bukti.
  - Dibantah kedua skeptis (mayoritas dari 2) berarti dibuang.
  - Satu membantah, satu mengonfirmasi: status PLAUSIBLE, keparahan maksimal Sedang, kecuali repro orkestrator memutus.
  - UNSURE tidak dihitung sebagai bantahan.
  - Skeptis juga mengecek acak 10% skor persona (apakah bukti mendukung skornya).
- **Panel persona** (4 agen): menilai 18 produk, situs dan tur memakai storyboard dosir, pustaka shot dan maksimal ±5 cek live. Keluarannya tabel skor dan 1–3 kutipan "keberatan pembeli" per produk.
- **Kritik kelengkapan** (C1, 1 agen): membaca matriks `covered[]` dan bertanya "apa yang belum diperiksa?". Lubang yang hampir pasti ada:
  - EN; Bandung/Padang; 768 px; reduced motion; keyboard saja;
  - ekspor PDF/print/XLSX; jendela `?notes=1`; 404/error;
  - fallback AI Live; `/lab`; OG/JSON-LD/sitemap/robots.txt;
  - teks share WhatsApp; tombol WA mengambang dengan nomor TODO.

## 6. Folder screenshot

Folder `docs/shots/demo/tahap-9/` berisi WebP q80 (PNG dari `tools/shot.mjs` dikonversi dengan `sharp` yang sudah terpasang), ±150 KB per file.

| Subfolder | Isi | Jumlah |
|---|---|---|
| `site/` | `/`, `/ekosistem`, `/ekosistem/{satu-daerah,usaha-pintar,pasar-daerah,inti}`, `/lab`, `/karya`, 1 `/karya/:slug`, `/proses`, `/faq`, `/panel/phonefarm`, 404, masing-masing di 1440/768/375 ID; plus home dan ekosistem EN 1440 | ±41 |
| `produk/` | 17 `/produk/:slug` × {1440, 390} ID, ditambah 3 EN | ±37 |
| `demo/` | 18 `/demo/:slug` × {1440, 390} ID; 6 demo EN × 2 lebar; sapa-warga, meja-pimpinan dan siaga-wilayah × Bandung/Padang 1440 | ±54 |
| `tur/` | Opener, `/tur/1`…`/tur/19` dan ringkasan di 1440; 4 bab berjalan (3, 6, 12, 19) di 390 | ±25 |
| `temuan/` | Shot repro dan frame burst dari finder dan skeptis | ±20–40 |

- Nama file: `<rute-dengan-tanda-hubung>__<lebar>__<id|en>[__<region>][__<keadaan>].webp`, misalnya `demo/radar-isu__390__id.webp`.
- `docs/shots/demo/tahap-9/facts.json` memetakan setiap file ke URL, waktu dan fakta WF1.
- Total ±180–200 file, ±30–35 MB.

## 7. WF4: Celah dan penulisan (3–4 agen, ±1–1,5 jam)

- G1 dan G2 mengaudit daftar lubang dari C1 dengan skema temuan yang sama.
- SK (1 skeptis) memverifikasi temuan celah dengan aturan yang sama dengan §5.
- W (penulis) menyusun `docs/build/tahap9-audit.md`.

### Format `docs/build/tahap9-audit.md`
1. **Ringkasan eksekutif** (1 halaman): 5 temuan terpenting dengan bukti, rekomendasi, kesiapan keseluruhan, dan skor persona rata-rata.
2. **Scorecard**:
   - per lensa (1–10, alasan 1 baris);
   - per produk (status, skor per persona, sasaran vs semua);
   - situs dan tur;
   - tabel anchor kalibrasi.
3. **Angka terukur**: perf median, INP, batas ukuran per demo ID/EN, home JS, LCP/CLS, axe. Bandingkan dengan LAPORAN-AKHIR.
4. **Temuan per lensa**: tabel id, klaim, bukti, dampak bisnis, keparahan, usaha, target tahap, status verifikasi (CONFIRMED atau PLAUSIBLE).
5. **Kesiapan demo per produk** (18 dan tur): status, skenario 3 menit (storyboard bertautan shot), yang kurang, 3 perbaikan teratas.
6. **Penilaian item Karya**: 13 item dengan vonis dan alasan, dicocokkan dengan §5.1.
7. **Backlog berprioritas**: matriks dampak × usaha, dipetakan ke T10–T16 dengan ID stabil (T16 mengaudit ulang per ID dan simbol). Ditambah usulan urutan tahap bila temuan menuntutnya.
8. **Quick wins** (< 1 jam).
9. **Daftar minor** (tidak diverifikasi, berlabel).
10. **Laporan tahap (§11)**:
    - yang selesai;
    - tautan screenshot;
    - yang belum diperiksa beserta alasannya;
    - pertanyaan untuk pemilik (§13 dan §D rencana induk yang belum dijawab);
    - rencana Tahap 10;
    - tabel progres % dan jam per tahap dalam bahasa Indonesia.

Commit (pesan bahasa Indonesia, tanpa push/deploy):
- `docs/build/tahap9-plan.md`, `docs/build/rubrik-persona.md`, `docs/build/tahap9-audit.md`, `docs/build/tahap9-16-rencana.md`;
- `docs/shots/demo/tahap-9/`;
- `tools/budget.mjs` dan `tools/lcp.mjs` (bila diizinkan).

## 8. Waktu (mulai Jum 20 Nov 17.00 WIB)

| Bagian | Agen | Jam | Perkiraan selesai | Progres tahap |
|---|---|---|---|---|
| WF0 persiapan | orkestrator | 0,3 | 17.20 | 5% |
| WF1 ukur dan pustaka shot | 1 | 2–2,5 | ±19.35 | 30% |
| WF2 finder | 9 | 1,5–2,5 | ±21.35 | 60% |
| WF3 verifikasi, persona, kritik | 9 | 1,5–2 | ±23.20 | 85% |
| WF4 celah dan penulisan | 3–4 | 1–1,5 | ±00.35 | 100% |
| Cadangan dan commit | — | 0,4 | Sab 21 Nov ±01.00 | — |
| **Total** | ±23 agen | **6,5–9 (tengah 8)** | | |

- Bila pemilik menaikkan ukuran workflow ke large, WF2 dan WF3 menjadi satu workflow dan WF2 boleh mulai membaca kode saat WF1 langkah (e). Hemat 30–60 menit.
- Laporkan progres % dan tabel jam di setiap batas WF (kebiasaan pemilik).
- Di akhir tahap: **berhenti** sampai pemilik membalas "lanjut tahap 10".

## 9. Larangan tahap ini

- Tidak mengubah `src/`, `server/`, `tests/` dan `src-art/`.
- Tidak menjalankan e2e penuh (tidak diperlukan).
- Tidak ada dev server, `npm install`, push atau deploy. GitHub Pages tetap di versi Tahap 8.
- Gerbang byte kontrol tetap dicek untuk file baru di `tools/`.
