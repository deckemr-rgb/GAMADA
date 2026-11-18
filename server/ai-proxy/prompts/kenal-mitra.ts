import { z } from 'zod'
import { definePrompt, productTool } from './_shared.js'

/** Kenal Mitra "Saring CV": rank ONLY the anonymised, pre-filtered candidates of the context (refs like K-0147). */
const RankCandidates = z.object({
  ranked: z
    .array(z.object({ ref: z.string().min(1).max(24), fit: z.number().int().min(0).max(100), reason: z.string().min(1).max(200) }))
    .min(1)
    .max(10),
  criteriaUsed: z.array(z.string().min(1).max(80)).min(1).max(6),
})

export default definePrompt({
  slug: 'kenal-mitra',
  tier: 'fast',
  descriptor: 'Verifikasi Pelanggan, Mitra & Kandidat',
  role: `Anda adalah asisten verifikasi untuk Analis KYC/HR: verifikasi pelanggan dan mitra usaha (dokumen spesimen fiktif, uji liveness simulasi, kecocokan data, lokasi usaha) dan penyaringan kandidat dari CV contoh.`,
  scope: `KYC/KYB, uji tuntas mitra, skor risiko, dan penyaringan kandidat berdasarkan kriteria pekerjaan. Kandidat dinilai hanya dari kompetensi dan pengalaman yang relevan; jangan pernah memakai nama, foto, usia, jenis kelamin, agama, suku, status perkawinan, atau asal daerah sebagai faktor. Semua data adalah spesimen fiktif. Konteks KYC/KYB hanya berisi hasil pemeriksaan (lolos/gagal), tidak pernah gambar dokumen atau wajah; jangan meminta gambar.`,
  output: `- Verifikasi → panggil kyc_decision (skor risiko 0–100, keputusan setujui/tinjau/tolak, alasan berbasis temuan di konteks). Pakai skor dan keputusan yang sudah dihitung di konteks bila ada; jangan mengarang angka lain. Bila bukti kurang, pilih "tinjau", bukan "tolak".
- Kandidat → panggil rank_candidates: urutkan maksimal 10 kandidat dari daftar di konteks saja (sebut dengan kode ref, misalnya K-0147, bukan nama), skor kecocokan 0–100, satu alasan per kandidat berbasis kriteria, dan kriteria yang dipakai (maks. 6). Kode yang tidak ada di konteks tidak boleh muncul.`,
  tools: ['kyc_decision'],
  customTools: [
    productTool('kenal-mitra', 'rank_candidates', RankCandidates, 'Urutkan kandidat yang sudah disaring (anonim, kode ref) berdasarkan kecocokan kriteria, dengan satu alasan per kandidat.'),
  ],
  customMocks: {
    rank_candidates: {
      ranked: [
        { ref: 'K-0093', fit: 93, reason: 'D3 Akuntansi, 4 tahun pengalaman administrasi, menguasai spreadsheet dan pembukuan.' },
        { ref: 'K-0157', fit: 92, reason: 'S1 Manajemen dengan 5 tahun di bagian keuangan; keahlian spreadsheet terpenuhi.' },
      ],
      criteriaUsed: ['Pendidikan minimal D3', 'Pengalaman ≥ 2 tahun', 'Keahlian wajib: Spreadsheet', 'Domisili ≤ 30 km dari toko'],
    },
  },
})
