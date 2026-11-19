import { z } from 'zod'
import { definePrompt, productTool } from './_shared.js'

const Bi = z.object({ id: z.string().min(1).max(200), en: z.string().min(1).max(200) })
/** Bank side "Ringkas pengajuan": 3 strengths, 3 risks, the recommendation and a maximum from context.brief. The
 *  site recomputes the card from its own numbers; the tool only carries wording. */
const BriefLoan = z.object({
  loanId: z.string().regex(/^LN-\d{4}$/),
  rec: z.enum(['setujui', 'setujui-bersyarat', 'tinjau-manual']),
  strengths: z.array(Bi).length(3),
  risks: z.array(Bi).length(3),
  maxAmount: z.number().min(0),
})

export default definePrompt({
  slug: 'rapor-usaha',
  tier: 'smart',
  descriptor: 'Skor Kesehatan Bisnis',
  role: `Anda adalah analis kesehatan usaha untuk Pemilik Usaha dan analis kredit Koperasi Mitra Usaha Sejahtera (koperasi mitra fiktif). Skor 0–1000 disusun dari data Toko Autopilot, Pajak Beres, dan Kenal Mitra di konteks. Anda menjelaskan skor dengan jujur dan mudah dipahami, serta memberi langkah konkret untuk menaikkannya.`,
  scope: `Skor kesehatan usaha, faktor pendorongnya (kestabilan omzet, margin, kepatuhan pajak, bayar pemasok, verifikasi usaha, pertumbuhan), plafon dan cicilan modal kerja simulasi, persetujuan berbagi data, dan ringkasan pengajuan di sisi koperasi. Ini bukan keputusan kredit; keputusan tetap di koperasi. Jangan menjanjikan pinjaman akan disetujui.`,
  output: `- Pakai HANYA angka di konteks: context.score, context.factors (poin tiap faktor dibanding median), context.actions (gain tiap aksi), context.offer (plafon, ratePct, inst12, dsr, net, next), context.consent, context.loan, context.brief. Jangan menghitung ulang plafon atau cicilan.
- Skor, plafon, bunga, dan cicilan adalah SIMULASI; sebutkan itu.
- Penjelasan skor → panggil explain_score (skor = context.score, pendorong naik/turun dari context.factors, tepat 3 aksi dari context.actions).
- Sisi koperasi "Ringkas pengajuan" → panggil brief_loan dengan loanId, rec, strengths, risks, maxAmount persis dari context.brief; lalu jelaskan dalam 2–3 kalimat.
- Bahasa adil dan tidak diskriminatif: nilai hanya dari data usaha, tidak pernah dari identitas, agama, suku, jenis kelamin, atau usia pemilik.
- Tutup dengan: "Skor dan angka ini simulasi, bukan keputusan kredit." (atau padanannya dalam bahasa pengguna).`,
  tools: ['explain_score'],
  customTools: [productTool('rapor-usaha', 'brief_loan', BriefLoan, 'Ringkasan satu pengajuan modal kerja untuk analis koperasi: 3 kekuatan, 3 risiko (ID dan EN), rekomendasi, dan jumlah maksimal dari context.brief.')],
  customMocks: {
    brief_loan: {
      loanId: 'LN-0013',
      rec: 'tinjau-manual',
      strengths: [
        { id: 'Omzet stabil (78%)', en: 'Stable turnover (78%)' },
        { id: 'Bayar pemasok tepat waktu 83%', en: 'Pays suppliers on time 83%' },
        { id: 'Skor dihitung dari data 12 bulan terakhir', en: 'Score built from the last 12 months of data' },
      ],
      risks: [
        { id: 'Belum lolos KYB: minta verifikasi sebelum memutus', en: 'No KYB yet: request the check before deciding' },
        { id: 'Pajak belum rapi', en: 'Tax not in order yet' },
        { id: 'Data yang tidak dibagikan tidak ikut dinilai', en: 'Data not shared is not part of the assessment' },
      ],
      maxAmount: 100000000,
    },
  },
})
