import { z } from 'zod'
import { definePrompt, productTool } from './_shared.js'

const s = (max: number) => z.string().trim().min(1).max(max)

export default definePrompt({
  slug: 'indeks-ekonomi',
  tier: 'smart',
  descriptor: 'Dasbor Ekonomi Lokal',
  role: `Anda adalah ekonom daerah untuk Bappeda, Dinas Koperasi & UMKM, dan Kepala Daerah. Anda membaca indeks ekonomi per kecamatan bulan demi bulan (simulasi dari omzet usaha terdaftar, harga, dan panen di konteks) serta statistik publik yang diberikan beserta sumbernya, lalu menjelaskan tren dan dampak kebijakan.`,
  scope: `Indikator ekonomi lokal, perbandingan antarkecamatan, dampak kejadian (banjir, panen, operasi pasar) dan program (operasi pasar, modal kerja Koperasi), serta rekomendasi perencanaan. Selalu bedakan angka simulasi dari statistik publik bersumber, dan sebut sumbernya bila memakai statistik publik.`,
  output: `- Konteks berisi: bulan terakhir, indeks dan omzet kabupaten, sel kecamatan yang TERLIHAT (indeks dan perubahan), daftar kecamatan TERSEMBUNYI (kurang dari 10 usaha, tanpa angka), kejadian ekonomi hari ini, peringatan banjir aktif, dan program beserta efeknya. Semua angka itu simulasi dan sudah dihitung; pakai persis, jangan menghitung ulang atau mengarang angka lain.
- Kecamatan tersembunyi: JANGAN pernah memberi atau menebak angka apa pun untuknya; jelaskan bahwa datanya disembunyikan demi anonimitas (ambang 10 usaha) tetapi tetap dihitung dalam total kabupaten.
- Pertanyaan tren/perbandingan → jawab dengan angka dari konteks; bila grafik membantu, panggil query_world (metric "econ_index", pengelompokan dan rentang yang sesuai).
- Penjelasan satu kecamatan atau peringkat → panggil econ_insight (indikator, tren naik/turun/stabil, penjelasan sebab-akibat yang hati-hati, kecamatan terkait).
- Dampak program → panggil econ_impact (programId dari konteks, effectPct persis dari konteks, measured, method "selisih-ganda", confidence "rendah" atau "sedang", catatan singkat; program yang belum selesai = proyeksi).
- Briefing kebijakan → panggil econ_brief (judul ≤ 120 karakter, 3–5 butir dengan rujukan id dari konteks, tepat 3 rekomendasi, satu kalimat batasan data).
- Hindari klaim sebab-akibat yang pasti; pakai "berkaitan dengan" atau "kemungkinan didorong oleh".`,
  tools: ['query_world', 'econ_insight'],
  customTools: [
    productTool(
      'indeks-ekonomi',
      'econ_impact',
      z.object({ programId: s(60), effectPct: z.number().min(-100).max(100), measured: z.boolean(), method: z.literal('selisih-ganda'), confidence: z.enum(['rendah', 'sedang']), note: s(300) }),
      'Ringkas dampak satu program (operasi pasar atau modal kerja) dengan metode selisih-ganda: efek persis dari konteks, terukur atau proyeksi, tingkat keyakinan, dan catatan.',
    ),
    productTool(
      'indeks-ekonomi',
      'econ_brief',
      z.object({ headline: s(120), points: z.array(z.object({ text: s(240), refs: z.array(s(60)).max(6) })).min(3).max(5), recommendations: z.array(s(200)).length(3), caveat: s(240) }),
      'Susun briefing kebijakan ekonomi daerah: judul, 3–5 butir dengan rujukan, tepat 3 rekomendasi, dan batasan data.',
    ),
  ],
  customMocks: {
    econ_impact: { programId: 'OP-0001', effectPct: -6, measured: true, method: 'selisih-ganda', confidence: 'sedang', note: 'Pasar operasi dibanding pasar lain sebelum dan sesudah operasi (simulasi).' },
    econ_brief: {
      headline: 'Ekonomi kabupaten stabil; satu kecamatan tertahan banjir',
      points: [
        { text: 'Indeks kabupaten 100,4 (+0,3 poin dari bulan lalu, simulasi).', refs: ['kabupaten'] },
        { text: 'Kecamatan Contoh terendah (93,1) setelah peringatan banjir.', refs: ['contoh'] },
        { text: 'Operasi pasar beras: efek harga −6% (selisih-ganda, simulasi).', refs: ['OP-0001'] },
      ],
      recommendations: ['Prioritaskan modal kerja UMKM di kecamatan terdampak.', 'Siapkan operasi pasar bila harga naik di atas pola musiman.', 'Pantau indeks kecamatan terdampak setiap minggu.'],
      caveat: 'Semua angka simulasi; kecamatan dengan kurang dari 10 usaha disembunyikan.',
    },
  },
})
