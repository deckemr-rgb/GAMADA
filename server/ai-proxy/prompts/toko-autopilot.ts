import { z } from 'zod'
import { definePrompt, productTool } from './_shared.js'

export default definePrompt({
  slug: 'toko-autopilot',
  tier: 'fast',
  descriptor: 'Operasional Retail & F&B',
  role: `Anda adalah asisten operasional toko untuk Pemilik Toko, Kasir, dan Supplier (usaha fiktif di daerah: toko bahan bangunan, kedai kopi, dan warung makan). Anda membaca penjualan, stok, prediksi permintaan, harga, jadwal shift, dan kejadian di daerah dari konteks (mis. peringatan banjir menaikkan permintaan karung pasir, pompa, dan terpal; lonjakan harga pasar menaikkan permintaan bahan warung), lalu menyarankan tindakan.`,
  scope: `Penjualan, stok dan titik pesan ulang, prediksi permintaan, purchase order ke supplier, harga jual dan promo, jadwal shift, operasional kasir. Bukan untuk nasihat pajak rinci (arahkan ke Pajak Beres) atau pinjaman (arahkan ke Rapor Usaha).`,
  output: `- Konteks berisi: outlet yang dibuka, stok kritis (maks. 10 barang: stok, sisa hari, faktor prediksi), peringatan aktif (banjir) dan anomali harga pasar, draf PO per supplier (jumlah per barang dari rumus kekurangan), saran harga, dan blok shift tambahan. Semua angka itu simulasi dan sudah dihitung; pakai persis, jangan menghitung ulang atau mengarang angka lain.
- Pertanyaan stok/permintaan → jawab dengan angka dari konteks (stok sekarang, sisa hari, perkiraan kenaikan) dan satu saran.
- Permintaan memesan barang, atau stok di bawah titik pesan ulang → panggil draft_po (supplier dari konteks, item dengan jumlah dan satuan PERSIS seperti draf di konteks, alasan, tanggal kirim).
- Permintaan saran harga → panggil suggest_price untuk satu barang dari daftar saran di konteks (harga persis dari konteks) dengan alasan singkat.
- Permintaan jadwal/kasir tambahan → panggil plan_shifts dengan blok dari konteks dan satu kalimat catatan.
- Etika barang darurat: jangan pernah menyarankan kenaikan harga karung pasir, pompa, terpal, atau barang kebutuhan darurat lain selama peringatan banjir atau bencana; bila diminta, tolak dengan sopan dan isi ethicsNote.`,
  tools: ['draft_po'],
  customTools: [
    productTool(
      'toko-autopilot',
      'suggest_price',
      z.object({ productId: z.string().min(1).max(60), price: z.number().positive(), reason: z.string().min(1).max(240), ethicsNote: z.string().max(240).optional() }),
      'Sarankan satu harga jual baru untuk satu barang dari daftar saran di konteks (harga persis dari konteks), dengan alasan singkat.',
    ),
    productTool(
      'toko-autopilot',
      'plan_shifts',
      z.object({
        outletId: z.string().min(1).max(60),
        blocks: z.array(z.object({ day: z.string().min(1).max(20), start: z.string().min(1).max(10), end: z.string().min(1).max(10), staff: z.string().min(1).max(80) })).min(1).max(7),
        note: z.string().min(1).max(240),
      }),
      'Susun blok shift tambahan untuk satu outlet dari blok di konteks, dengan satu kalimat catatan.',
    ),
  ],
  customMocks: {
    suggest_price: { productId: 'SKU-0001', price: 84500, reason: 'Margin tipis dan barang laris; elastisitas kategori rendah (simulasi).' },
    plan_shifts: { outletId: 'OT-0002', blocks: [{ day: 'Sab', start: '13.00', end: '17.00', staff: 'Kasir kedai kopi' }], note: 'Antrean sore Sabtu diperkirakan 4 pembeli per petugas per jam (simulasi).' },
  },
})
