# Melanjutkan GAMADA — Tahap 3 (Usaha Pintar P8–P13)

Dihentikan oleh pemilik pada 2026-11-18 pukul 17.30. Semua proses (workflow, server dev/preview, tes) sudah dimatikan.

## Posisi saat berhenti

| | Status |
|---|---|
| Tahap 1–2 (kit dasar, Satu Daerah P1–P7) | Selesai, commit `dc96760` |
| Rencana Tahap 3 | Selesai, commit `e72561e` (`docs/build/tahap3-plan.md`, §6 sudah disetujui "oke semua") |
| Kit Tahap 3 | ±85%, disimpan di commit WIP "Tahap 3 WIP: kit …" (tepat setelah `e72561e`) |
| 6 produk P8–P13 | Belum mulai (folder `src/demos/<slug>/` masih stub) |
| Integrasi, gerbang, screenshot Tahap 3 | Belum mulai |
| Progres keseluruhan program | ±36% |

Isi kit yang sudah ada di commit WIP:
- `world/eco.ts` (modul ekonomi Usaha Pintar) + `world/__tests__/up.selftest.ts`
- `docs/diff.ts`, `docs/TextDiff.tsx`, contoh `kyb.ts`, `cv-data.ts`
- `i18n/terbilang.ts`, `media/camera.ts`
- `ui/Chat.tsx`, `ui/MoneyInput.tsx`, `ui/MonthCalendar.tsx`, `ui/fly.ts`
- perubahan engine/reducers/events/types/registry (loader saja, DEMO_READY belum di-flip)

Cek saat berhenti: `tsc -b` lolos, world selftest 2050/0, tidak ada file terhapus, tidak ada byte kontrol.

Yang belum dikerjakan kit:
- `src/demo-kit/CONTRACTS.md` belum diperbarui
- `npm run ai:test` belum selesai
- cek batas ukuran (7 demo Satu Daerah tidak boleh naik >1 KB, home JS ≤ 253,6 KB) belum selesai
- e2e Tahap 2: 44 lolos, 1 gagal ("chains 3–6" Siaga Wilayah ⇒ Awas Belanja …, mungkin flaky) — dihentikan sebelum selesai

## Langkah menjalankan lagi

1. **Cek repo**
   ```bash
   cd C:/Users/LENOVO/gamada
   git log --oneline -4     # paling atas: commit WIP kit Tahap 3
   git status --short       # harus bersih
   ```
2. **Nyalakan server** (dua terminal / background):
   ```bash
   npx vite --port 5173 --host 127.0.0.1 --strictPort
   npm run build && npx vite preview --port 4173 --host 127.0.0.1 --strictPort
   ```
3. **Cek cepat** sebelum lanjut:
   ```bash
   npx tsc -b
   npx tsx src/demo-kit/world/__tests__/world.selftest.ts
   npx tsx src/demo-kit/world/__tests__/up.selftest.ts
   ```
4. **Jalankan workflow Tahap 3** dari skrip di repo:
   `docs/build/workflows/tahap3-build.js` (sudah berisi catatan resume untuk agen kit: lanjutkan, jangan bangun ulang).
   Di Claude Code cukup bilang: *"lanjutkan Tahap 3 dari docs/build/RESUME-TAHAP3.md"*.
   Urutan di dalamnya:
   1. **Kit** — lengkapi yang kurang, CONTRACTS.md, ai:test, cek ukuran, perbaiki e2e "chains 3–6" (±30–45 menit)
   2. **6 produk paralel** — toko-autopilot, pajak-beres, juara-jualan, kenal-mitra, pantau-merek, tenderpilot; masing-masing ≤175 KB, e2e sendiri (±3 jam)
   3. **Integrasi + gerbang** — flip DEMO_READY, rantai C14–C29, tsc, validate, selftest, ai:test, build, e2e penuh, batas ukuran 13 demo, performa home (±1,5 jam)
   4. **Screenshot** — `docs/shots/demo/tahap-3/` + INDEX.md (±20 menit)
5. **Setelah workflow selesai** (dikerjakan Claude):
   - verifikasi: tsc, selftest, grep byte kontrol, tidak ada file terhapus, jumlah tes tidak turun
   - gabungkan commit WIP + hasil menjadi commit Tahap 3
   - laporan singkat (progres %, tabel waktu, batas ukuran per demo, yang belum)
6. **Berikutnya**: Tahap 4 (Pasar Daerah P14–P17 + Inti), Tahap 5 (tur), Tahap 6 (halaman situs + /karya), Tahap 7 (paket Bandung/Padang + polish yang ditunda: skor wow, INP, screenshot ulang Tahap 2).

Estimasi total sisa Tahap 3 setelah dijalankan lagi: **±5,5 jam**.

## Aturan yang tetap berlaku

- Jangan push/deploy tanpa perintah pemilik; commit kecil; typecheck + build lolos.
- Batas ukuran ≤180 KB muat pertama per demo (target internal ≤175), home JS ≤253,6 KB.
- Jangan ubah `src-art/`. Orang/perusahaan/media fiktif; pejabat hanya jabatan.
- Kerja cepat dan "secukupnya": tanpa putaran review/skor wow; polish ditunda ke Tahap 7.
- `.shots/` (±1,7 GB) hanya dihapus jika pemilik bilang "hapus shots".
