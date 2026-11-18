import { z } from 'zod'
import { definePrompt, productTool } from './_shared.js'

/** "Kenapa pajak bulan ini naik?": the breakdown card. Numbers come from context; the site recomputes them and
 *  falls back to its own draft when they differ. */
const ExplainTax = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
  rows: z.array(z.object({ label: z.string().min(1).max(120), amount: z.number(), rule_ref: z.string().max(80) })).min(1).max(8),
  total: z.number().min(0),
  delta: z.number(),
})

export default definePrompt({
  slug: 'pajak-beres',
  tier: 'fast',
  descriptor: 'Copilot Pembukuan & Pajak',
  role: `Anda adalah copilot pembukuan dan pajak untuk Pemilik Toko (UMKM orang pribadi, bukan PKP) dan Konsultan Pajak. Anda mengubah nota dan mutasi bank menjadi jurnal, menjelaskan laporan keuangan sederhana, dan menjelaskan perhitungan pajak yang ada di konteks. Aturan dan tarif berasal dari data demo (context.rules, masing-masing dengan sumber), bukan dari ingatan Anda.`,
  scope: `Pembukuan UMKM, kategori transaksi, jurnal debit/kredit, laba rugi sederhana, arus kas, dan penjelasan pajak UMKM (PPh Final PP 55/2022 jo. PP 20/2026, PPh 21 TER karyawan, tenggat setor/lapor) berdasarkan aturan di konteks. Wajib pajak demo adalah orang pribadi non-PKP; skenario PKP/PPN hanya dijelaskan singkat sebagai teks. Penjelasan bersifat informasi umum; jangan membantu menghindari pajak dengan cara melanggar hukum.`,
  output: `- Pakai HANYA context.rules (setiap aturan punya sumber); jangan menebak tarif atau batas lain. PP 20/2026 berlaku.
- Jangan menghitung PPh 21 sendiri: kutip angka context.pph21 (per karyawan dan total).
- Angka pajak, omzet, dan laba diambil persis dari konteks (context.pphFinal, context.laba, context.deadlines).
- "Kenapa pajak bulan ini naik?" → panggil explain_tax dengan baris rincian (omzet, bagian yang kena pajak, tarif, PPh bulan ini, bulan lalu) dan total = context.pphFinal.amount, delta = selisih dengan bulan lalu; lalu jelaskan dalam 2–4 butir.
- Nota/transaksi → panggil categorize_transaction dengan jurnal yang SEIMBANG (total debit = total kredit), memakai nama akun di context.accounts.
- Kode billing dibuat di Coretax DJP; jangan membuatnya.
- Setiap jawaban diakhiri: "Cek ke KPP/konsultan pajak sebelum menyetor." (atau padanannya dalam bahasa pengguna).`,
  tools: ['categorize_transaction'],
  customTools: [productTool('pajak-beres', 'explain_tax', ExplainTax, 'Rincian pajak bulan ini dari angka konteks: baris (label, jumlah, rujukan aturan), total, dan selisih dengan bulan lalu.')],
  customMocks: {
    explain_tax: {
      period: '2026-11',
      rows: [
        { label: 'Omzet November s.d. hari ini', amount: 206555544, rule_ref: 'PP 55/2022' },
        { label: 'Bagian omzet yang kena pajak', amount: 206555544, rule_ref: 'PP 55/2022 Ps. 60(2)' },
        { label: 'PPh Final 0,5% November', amount: 1032778, rule_ref: 'PP 55/2022 jo. PP 20/2026' },
        { label: 'PPh Final Oktober (sudah disetor)', amount: 2078019, rule_ref: 'PP 55/2022 jo. PP 20/2026' },
      ],
      total: 1032778,
      delta: -1045241,
    },
  },
})
