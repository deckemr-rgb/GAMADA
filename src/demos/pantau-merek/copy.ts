/** pantau-merek — /produk/pantau-merek page copy (Tahap 6 plan §3.1). Sources: spec §11 P12, products.ts. */
import type { ProductCopy } from '../copy-types'

export const copy: ProductCopy = {
  pitch: {
    id: 'Lonjakan keluhan terbaca sebagai pola, akarnya dikaitkan dengan kejadian di daerah, dan setiap ulasan mendapat draf balasan yang tetap personal.',
    en: 'A spike in complaints reads as a pattern, its root cause is linked to local events, and every review gets a draft reply that stays personal.',
  },
  problems: [
    {
      title: { id: 'Ulasan tersebar di banyak kanal', en: 'Reviews are spread over many channels' },
      body: { id: 'Marketplace, media sosial, dan pesan pelanggan dibuka satu per satu.', en: 'Marketplaces, social media and customer messages are opened one by one.' },
    },
    {
      title: { id: 'Keluhan dibaca satu per satu', en: 'Complaints read one at a time' },
      body: { id: 'Tim melihat banyak keluhan "pengiriman lambat" tetapi tidak tahu penyebab bersamanya.', en: 'The team sees many "slow delivery" complaints but not their shared cause.' },
    },
    {
      title: { id: 'Balasan yang terasa kaku', en: 'Replies that feel stiff' },
      body: { id: 'Balasan templat yang sama untuk semua orang membuat pelanggan makin kesal.', en: 'The same template for everyone makes customers more annoyed.' },
    },
  ],
  steps: [
    {
      title: { id: 'Semua mention di satu layar', en: 'Every mention on one screen' },
      body: { id: 'Ulasan dan mention dari kanal fiktif, dengan sentimen per kanal dan topik keluhan.', en: 'Reviews and mentions from fictional channels, with sentiment per channel and complaint topics.' },
    },
    {
      title: { id: 'Lonjakan terdeteksi', en: 'Spikes are detected' },
      body: { id: 'Peringatan muncul saat keluhan negatif naik, lengkap dengan akar masalahnya, misalnya jalan tergenang setelah banjir.', en: 'An alert appears when negative complaints rise, with the root cause, such as flooded roads after the rain.' },
    },
    {
      title: { id: 'Balas massal, tetap personal', en: 'Bulk replies, still personal' },
      body: { id: 'Pilih nada, lalu setiap ulasan mendapat draf balasan yang menyebut keluhannya sendiri.', en: 'Pick a tone and every review gets a draft reply that mentions its own complaint.' },
    },
  ],
  highlights: [
    {
      title: { id: 'Akar masalah dari peristiwa daerah', en: 'Root causes from local events' },
      body: { id: 'Keluhan "pengiriman lambat" dikaitkan dengan peringatan banjir di hari yang sama.', en: '"Slow delivery" complaints are linked to the flood warning on the same day.' },
      frame: 'kelompok',
    },
    {
      title: { id: 'Perbandingan dengan kompetitor', en: 'Comparison with competitors' },
      body: { id: 'Sentimen merek Anda dibandingkan dengan dua kompetitor fiktif.', en: 'Your brand sentiment compared with two fictional competitors.' },
    },
  ],
  roles: {
    'brand-manager': { id: 'Melihat reputasi lintas kanal dan menangani lonjakan sebelum membesar.', en: 'Sees reputation across channels and handles spikes before they grow.' },
    'pemilik-toko': { id: 'Membalas ulasan pelanggan dengan cepat tanpa terdengar seperti robot.', en: 'Answers customer reviews fast without sounding like a robot.' },
  },
  relations: {
    'radar-isu': { id: 'Memakai mesin analisis yang sama dengan Radar Isu.', en: 'Uses the same analysis engine as Radar Isu.' },
    'toko-autopilot': { id: 'Keluhan stok dan pengiriman kembali ke operasional toko.', en: 'Stock and delivery complaints go back to shop operations.' },
  },
  dataNote: {
    id: 'Semua merek, marketplace, akun, ulasan, dan angka sentimen adalah fiktif.',
    en: 'All brands, marketplaces, accounts, reviews and sentiment figures are fictional.',
  },
  faq: [
    {
      q: { id: 'Apakah balasan dikirim otomatis?', en: 'Are replies sent automatically?' },
      a: { id: 'Tidak. AI menyiapkan draf; Anda yang meninjau dan mengirim.', en: 'No. The AI prepares drafts; you review and send.' },
    },
    {
      q: { id: 'Kanal apa saja yang dipantau?', en: 'Which channels are monitored?' },
      a: { id: 'Di demo, semua kanal fiktif. Kanal nyata untuk pemasangan dibahas saat konsultasi.', en: 'In the demo every channel is fictional. Real channels for an installation are discussed during consultation.' },
    },
    {
      q: { id: 'Apa bedanya dengan Radar Isu?', en: 'How is it different from Radar Isu?' },
      a: { id: 'Mesinnya sama. Radar Isu untuk opini publik pemda; Pantau Merek untuk reputasi usaha.', en: 'Same engine. Radar Isu is for public opinion in government; Pantau Merek is for business reputation.' },
    },
    {
      q: { id: 'Bisakah memilih nada balasan?', en: 'Can I choose the reply tone?' },
      a: { id: 'Bisa. Pilih nada sebelum draf disusun, lalu ubah per ulasan bila perlu.', en: 'Yes. Pick a tone before drafting, then edit per review if needed.' },
    },
  ],
  miniCaption: [
    { id: 'Mention mengalir', en: 'Mentions stream in' },
    { id: 'Lonjakan keluhan', en: 'A spike in complaints' },
    { id: 'Draf balasan sesuai nada', en: 'Draft replies in the chosen tone' },
    { id: 'Sentimen membaik', en: 'Sentiment improves' },
  ],
}
