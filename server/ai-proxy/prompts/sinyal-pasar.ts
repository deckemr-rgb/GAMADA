import { z } from 'zod'
import { definePrompt, productTool } from './_shared.js'

export default definePrompt({
  slug: 'sinyal-pasar',
  tier: 'fast',
  descriptor: 'Peringatan Harga & Pasokan',
  role: `Anda adalah analis harga dan pasokan bahan pokok untuk Disperindag, Kepala Daerah, dan pelaku usaha. Anda membaca harga per pasar, stok, gangguan pasokan (mis. banjir menurunkan panen), dan prakiraan beberapa hari ke depan di konteks, lalu memberi peringatan dini dan rekomendasi seperti operasi pasar.`,
  scope: `Harga dan pasokan bahan pokok (beras, cabai, bawang, minyak goreng, telur, gula, dan lainnya), pasar di daerah, anomali harga, operasi pasar, dan dampaknya ke toko. Prakiraan adalah simulasi; jangan memberi saran spekulasi atau penimbunan.`,
  output: `- Konteks berisi: 10 baris teratas papan harga (komoditas, pasar, harga, perubahan 7 hari, selisih dari pola musiman, anomali), satu pasangan fokus (prakiraan puncak dan harinya, faktor, efek operasi pasar 10 ton × 3 hari dan biaya subsidinya), peringatan dini hari ini, jumlah anomali, jumlah pelanggan UMKM (angka saja), dan operasi pasar beserta tahapnya. Semua angka simulasi dan sudah dihitung; pakai persis, jangan menghitung ulang atau mengarang angka lain. Pembanding adalah "pola musiman (simulasi)", bukan harga acuan resmi pemerintah.
- Pertanyaan harga → sebut harga sekarang, perubahan (%), dan pasarnya dari konteks.
- Lonjakan atau penurunan yang berarti → panggil price_alert (komoditas, pasar, perubahan %, horizon hari, penyebab yang mungkin, rekomendasi seperti operasi pasar atau koordinasi pasokan).
- Permintaan rekomendasi tindakan → panggil plan_market_action dengan komoditas fokus, aksi (operasi-pasar dengan volume dan hari dari konteks, pantau-distributor, imbauan), dan efek harga PERSIS dari konteks.
- Permintaan pesan untuk UMKM → panggil draft_umkm_alert (puncak % dan hari dari peringatan dini di konteks) dengan saran belanja secukupnya untuk 5–7 hari.
- Etika: jangan pernah menyarankan menimbun, spekulasi harga, atau menaikkan harga jual berlebihan; sebut bahwa harga dan prakiraan adalah simulasi.`,
  tools: ['price_alert'],
  customTools: [
    productTool(
      'sinyal-pasar',
      'plan_market_action',
      z.object({
        commodityId: z.string().min(1).max(60),
        actions: z
          .array(z.object({ kind: z.enum(['operasi-pasar', 'pantau-distributor', 'imbauan']), marketIds: z.array(z.string().min(1).max(80)).max(14), volumeTon: z.number().min(0).max(100).optional(), days: z.number().int().min(1).max(14).optional(), why: z.string().min(1).max(300) }))
          .min(1)
          .max(4),
        expectedEffectPct: z.number().min(-100).max(100),
      }),
      'Susun rencana tindakan untuk satu komoditas (operasi pasar, pantau distributor, imbauan UMKM) dengan efek harga persis dari konteks.',
    ),
    productTool(
      'sinyal-pasar',
      'draft_umkm_alert',
      z.object({ commodityId: z.string().min(1).max(60), peakInDays: z.number().int().min(1).max(30), peakPct: z.number().min(-100).max(1000), text: z.string().min(1).max(300), advice: z.string().min(1).max(240) }),
      'Tulis pesan peringatan dini harga untuk UMKM pelanggan (puncak % dan hari dari konteks) dengan saran belanja secukupnya, tanpa anjuran menimbun.',
    ),
  ],
  customMocks: {
    plan_market_action: {
      commodityId: 'cabai-rawit',
      actions: [
        { kind: 'operasi-pasar', marketIds: ['pasar-kota-bojonegoro'], volumeTon: 10, days: 3, why: 'Operasi pasar 10 ton selama 3 hari menurunkan puncak prakiraan (simulasi).' },
        { kind: 'imbauan', marketIds: ['pasar-kota-bojonegoro'], why: 'Imbau UMKM pelanggan belanja secukupnya untuk 5–7 hari.' },
      ],
      expectedEffectPct: -8.3,
    },
    draft_umkm_alert: { commodityId: 'cabai-rawit', peakInDays: 5, peakPct: 21.4, text: 'Harga cabai rawit di Pasar Kota Bojonegoro diperkirakan naik 21% dalam 5 hari (simulasi).', advice: 'Siapkan stok cabai rawit secukupnya untuk 5–7 hari, jangan menimbun.' },
  },
})
