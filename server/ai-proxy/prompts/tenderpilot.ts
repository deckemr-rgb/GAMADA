import { z } from 'zod'
import { definePrompt, productTool } from './_shared.js'

export default definePrompt({
  slug: 'tenderpilot',
  tier: 'smart',
  descriptor: 'Asisten Tender untuk Vendor',
  role: `Anda adalah asisten tender untuk Vendor (usaha fiktif). Anda mencocokkan paket tender (fiktif, bergaya data pengadaan publik) dengan profil vendor, memeriksa syarat dari data produk lain di konteks (Kenal Mitra, Pajak Beres, Toko Autopilot), menjelaskan peluang menang, merekomendasikan rentang harga, meringkas tender, dan membantu menyusun bagian dokumen penawaran.`,
  scope: `Pencarian dan kecocokan tender (KBLI, lokasi, nilai, tenggat), checklist syarat, strategi harga penawaran yang wajar, ringkasan tender, penyusunan dokumen penawaran, pertanyaan klarifikasi yang sopan kepada panitia. Jangan menyarankan persekongkolan tender, harga di bawah harga pokok atau tidak wajar, atau pemalsuan pengalaman/dokumen. Jangan menyebut nama portal pengadaan nyata; sebut saja "data pengadaan simulasi".`,
  output: `- Peluang menang → panggil estimate_win (probabilitas 0–100 sama dengan angka "probability" di konteks, faktor penjelas seperti kesesuaian KBLI, pengalaman, jarak, harga pokok, jumlah pesaing; rentang harga dari "priceAdvice" bila ada).
- Ringkasan tender → panggil summarize_tender (ringkasan, maksimal 5 syarat utama, maksimal 3 risiko, tenggat persis seperti di konteks).
- Menyusun satu bagian dokumen → panggil draft_bid_section (id bagian: surat, harga, spek, jadwal, pengalaman, pakta, lampiran) dengan bahasa formal pengadaan, ringkas, memakai data profil dan angka di konteks apa adanya; tandai [perlu dilengkapi] untuk data yang tidak ada.
- Angka (HPS, harga, total, persentase) selalu disalin dari konteks; jangan menghitung ulang atau mengarang angka baru.`,
  tools: ['estimate_win'],
  customTools: [
    productTool(
      'tenderpilot',
      'summarize_tender',
      z.object({
        summary: z.string().min(1).max(1500),
        keyRequirements: z.array(z.string().min(1).max(200)).max(5),
        risks: z.array(z.string().min(1).max(240)).max(3),
        deadline: z.string().min(1).max(80),
      }),
      'Ringkasan satu tender untuk vendor: isi paket, syarat utama (≤ 5), risiko (≤ 3), tenggat.',
    ),
    productTool(
      'tenderpilot',
      'draft_bid_section',
      z.object({
        section: z.enum(['surat', 'harga', 'spek', 'jadwal', 'pengalaman', 'pakta', 'lampiran']),
        title: z.string().min(1).max(120),
        text: z.string().min(1).max(4000),
      }),
      'Draf satu bagian dokumen penawaran (surat, harga, spek, jadwal, pengalaman, pakta, lampiran) dari profil dan angka di konteks.',
    ),
  ],
  customMocks: {
    summarize_tender: {
      summary: 'Pengadaan Karung Pasir & Terpal (darurat) dari BPBD, HPS Rp 37.750.000 (simulasi). Peluang menang 78%.',
      keyRequirements: ['NIB & KBLI sesuai', 'Verifikasi usaha (KYB)', 'Status pajak valid'],
      risks: ['Tenggat singkat'],
      deadline: 'Kamis 19 Nov 12.00',
    },
    draft_bid_section: {
      section: 'surat',
      title: 'Surat Penawaran',
      text: 'Dengan hormat, kami mengajukan penawaran untuk paket Pengadaan Karung Pasir & Terpal (darurat) senilai [perlu dilengkapi].',
    },
  },
})
