# Melanjutkan setelah jeda (Tahap 6)

Dijeda Kamis 19 Nov ±22.45 atas permintaan pemilik.

## Keadaan saat berhenti
- Tahap 4 (`126ccc5`) dan Tahap 5 (`fcbf548`) sudah selesai dan di-commit.
- Tahap 6: langkah 0 dan ketiga pembangun (B1 Ekosistem + Lab, B2 Produk, B3 Situs) sudah selesai. Hasilnya ada di commit WIP setelah `fcbf548`.
- Integrasi Tahap 6 (gerbang uji, tes link, satu putaran pencocokan tampilan) dan screenshot **belum** dikerjakan.
- `tsc -b` lolos saat jeda.

## Langkah melanjutkan
1. Nyalakan server:
   - `npx vite --port 5173 --host 127.0.0.1 --strictPort`
   - `npx vite preview --port 4173 --host 127.0.0.1 --strictPort`
2. Jalankan workflow `docs/build/workflows/tahap6-resume.js`. Skrip ini langsung mulai dari integrasi, lalu screenshot. Hasil langkah 0 dan B1–B3 sudah tertanam di skripnya.
3. Setelah selesai: verifikasi (tsc, world selftest, grep byte kontrol, tidak ada file terhapus), commit Tahap 6, lalu laporan.
4. Jalankan `docs/build/workflows/tahap7-build.js`. Rencana Tahap 7 sudah disetujui. Cacat sisa Tahap 4 dan 5 ada di tahap7-plan §2 baris 10b dan 10c.
