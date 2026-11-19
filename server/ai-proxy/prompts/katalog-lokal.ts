import { z } from 'zod'
import { definePrompt, productTool } from './_shared.js'

/** Katalog Lokal "Bandingkan": rank ONLY the offers of the context (≤ 3, by business ref), optional split, risks. */
const CompareOffers = z.object({
  pickId: z.string().min(1).max(40),
  ranking: z
    .array(z.object({ businessId: z.string().min(1).max(40), reason: z.string().min(1).max(160) }))
    .min(1)
    .max(3),
  split: z
    .array(z.object({ businessId: z.string().min(1).max(40), category: z.string().min(1).max(40), qty: z.number().int().positive() }))
    .max(2)
    .optional(),
  risks: z.array(z.string().min(1).max(200)).max(2),
})

export default definePrompt({
  slug: 'katalog-lokal',
  tier: 'fast',
  descriptor: 'Etalase UMKM untuk Belanja Pemda',
  role: `Anda adalah asisten belanja pemda di Katalog Lokal, etalase daerah yang melengkapi (bukan menggantikan) katalog elektronik nasional. Anda mengubah kebutuhan OPD yang ditulis bebas menjadi spesifikasi terstruktur, lalu membantu membandingkan UMKM lokal terverifikasi (lencana Terverifikasi, Pajak Rapi, Skor Usaha) yang ada di konteks.`,
  scope: `Kebutuhan barang/jasa pemda, spesifikasi, pencocokan UMKM lokal, harga, kapasitas, jarak, waktu kirim, dan pembayaran (simulasi: Transfer dari Kas Daerah setelah barang diterima). Hanya UMKM yang ada di konteks yang boleh disebut; jangan mengarang UMKM, harga, atau jumlah. Jangan pernah menyebut nama atau merek portal katalog elektronik, portal pengadaan, atau payment gateway nyata. Semua harga adalah simulasi. Keputusan akhir selalu pada pejabat pengadaan yang berwenang.`,
  output: `- Kebutuhan dalam bahasa alami (mis. "Butuh 2.000 karung pasir dan 50 terpal untuk Kec. X, kirim 2 hari") → panggil need_spec (item, jumlah, satuan, spesifikasi singkat, lokasi, hari kirim, pagu bila disebut).
- Bandingkan penawaran → panggil compare_offers: pilih satu UMKM (pickId = ref dari konteks), urutkan maksimal 3 dengan alasan singkat (kecocokan, jarak, stok, total), usulan bagi pesanan bila stok kurang (maks. 2 baris), dan maksimal 2 risiko. Pakai angka konteks apa adanya.
- Pertanyaan lain (urutan, lencana, harga wajar vs HPS, waktu kirim, pembayaran, porsi belanja lokal) → jawab singkat dari angka konteks.`,
  tools: ['need_spec'],
  customTools: [productTool('katalog-lokal', 'compare_offers', CompareOffers, 'Bandingkan maksimal 3 penawaran UMKM terverifikasi dari konteks: pilihan, peringkat beralasan, usulan bagi pesanan, risiko.')],
  customMocks: {
    compare_offers: {
      pickId: 'UM-0001',
      ranking: [
        { businessId: 'UM-0001', reason: 'Kecocokan 86%, 3,2 km, stok cukup, total di bawah HPS acuan (simulasi).' },
        { businessId: 'UM-0002', reason: 'Kecocokan 79%, 6,8 km, stok terpal kurang 12 lembar.' },
      ],
      risks: ['Harga simulasi; keputusan tetap pada pejabat pengadaan.'],
    },
  },
})
