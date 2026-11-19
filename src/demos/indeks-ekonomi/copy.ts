/** indeks-ekonomi — /produk/indeks-ekonomi page copy (Tahap 6 plan §3.1). Sources: spec §11 P16, products.ts. */
import type { ProductCopy } from '../copy-types'

export const copy: ProductCopy = {
  pitch: {
    id: 'Peta kecamatan yang "bernapas" bulan demi bulan, dan dampak operasi pasar atau bantuan modal yang bisa diukur sebelum dan sesudahnya.',
    en: 'A district map that "breathes" month by month, and the impact of market operations or capital aid measurable before and after.',
  },
  problems: [
    {
      title: { id: 'Data ekonomi datang terlambat', en: 'Economic data arrives late' },
      body: { id: 'Angka resmi terbit per tahun atau per triwulan, sedangkan keputusan perlu dibuat bulan ini.', en: 'Official figures come out yearly or quarterly, while decisions are needed this month.' },
    },
    {
      title: { id: 'Gambaran per kecamatan kabur', en: 'District-level picture is blurry' },
      body: { id: 'Rata-rata kabupaten menyembunyikan kecamatan yang sedang tertekan.', en: 'The regency average hides districts that are under pressure.' },
    },
    {
      title: { id: 'Dampak program sulit dibuktikan', en: 'Programme impact is hard to prove' },
      body: { id: 'Setelah operasi pasar atau bantuan, tidak ada pembanding sebelum dan sesudah yang jelas.', en: 'After a market operation or aid, there is no clear before-and-after comparison.' },
    },
  ],
  steps: [
    {
      title: { id: 'Indeks per kecamatan', en: 'An index per district' },
      body: { id: 'Indeks omzet UMKM digambar sebagai peta kecamatan, dengan time-lapse 12 bulan.', en: 'The SME revenue index is drawn as a district map, with a 12-month time-lapse.' },
    },
    {
      title: { id: 'Sektor dan harga pokok', en: 'Sectors and staple prices' },
      body: { id: 'Rincian sektor dan tren harga bahan pokok di samping peta.', en: 'Sector breakdown and staple price trends next to the map.' },
    },
    {
      title: { id: 'Ukur dampak dan buat briefing', en: 'Measure impact and brief' },
      body: { id: 'Bandingkan sebelum dan sesudah sebuah program, lalu ekspor briefing kebijakan sebagai dokumen.', en: 'Compare before and after a programme, then export a policy briefing as a document.' },
    },
  ],
  highlights: [
    {
      title: { id: 'Ekonomi yang bernapas di peta', en: 'An economy breathing on the map' },
      body: { id: 'Putar time-lapse dan lihat kecamatan terdampak banjir meredup lalu pulih.', en: 'Play the time-lapse and watch flooded districts dim, then recover.' },
      frame: 'banjir',
    },
    {
      title: { id: 'Anonimitas sebagai fitur', en: 'Anonymity as a feature' },
      body: { id: 'Sel dengan kurang dari 10 usaha disembunyikan dengan arsiran, supaya tidak ada usaha yang bisa dikenali.', en: 'Cells with fewer than 10 businesses are hidden with hatching, so no business can be identified.' },
    },
  ],
  roles: {
    bappeda: { id: 'Membaca ekonomi setiap kecamatan dan menyiapkan briefing kebijakan berbasis data.', en: 'Reads every district economy and prepares data-based policy briefings.' },
    dinkop: { id: 'Melihat sektor UMKM mana yang tumbuh atau tertekan.', en: 'Sees which SME sectors are growing or under pressure.' },
    'kepala-daerah': { id: 'Mengukur dampak program yang sudah dijalankan.', en: 'Measures the impact of programmes already run.' },
  },
  relations: {
    'sinyal-pasar': { id: 'Operasi pasar dan harga pokok tercermin di indeks.', en: 'Market operations and staple prices show in the index.' },
    'siaga-wilayah': { id: 'Dampak banjir pada ekonomi kecamatan terbaca.', en: 'Flood impact on district economies becomes readable.' },
    'toko-autopilot': { id: 'Agregat penjualan toko menjadi bahan indeks.', en: 'Aggregated shop sales feed the index.' },
    'meja-pimpinan': { id: 'Ringkasan ekonomi masuk ke meja pimpinan.', en: "The economic summary reaches the head's desk." },
  },
  dataNote: {
    id: 'Batas kecamatan memakai peta {region} yang sebenarnya. Indeks, omzet, sektor, dan harga adalah simulasi.',
    en: 'District boundaries use the real map of {region}. Indexes, revenue, sectors and prices are simulated.',
  },
  faq: [
    {
      q: { id: 'Dari mana datanya berasal?', en: 'Where does the data come from?' },
      a: { id: 'Di demo, dari agregat transaksi simulasi produk GAMADA lain. Sumber data untuk pemasangan dibahas saat konsultasi.', en: 'In the demo, from simulated transaction aggregates of other GAMADA products. Data sources for an installation are discussed during consultation.' },
    },
    {
      q: { id: 'Apakah data usaha perorangan terlihat?', en: 'Is individual business data visible?' },
      a: { id: 'Tidak. Hanya agregat yang tampil, dan sel dengan kurang dari 10 usaha disembunyikan.', en: 'No. Only aggregates are shown, and cells with fewer than 10 businesses are hidden.' },
    },
    {
      q: { id: 'Apakah ini menggantikan statistik resmi?', en: 'Does it replace official statistics?' },
      a: { id: 'Tidak. Ini pelengkap untuk keputusan cepat, berdampingan dengan statistik resmi.', en: 'No. It complements them for faster decisions, alongside official statistics.' },
    },
    {
      q: { id: 'Bisakah briefing dicetak?', en: 'Can the briefing be printed?' },
      a: { id: 'Bisa. Briefing kebijakan tampil sebagai dokumen yang bisa dicetak atau disimpan sebagai PDF.', en: 'Yes. The policy briefing shows as a document you can print or save as PDF.' },
    },
  ],
  miniCaption: [
    { id: 'Indikator ekonomi daerah', en: 'Regional economic indicators' },
    { id: 'Peta panas kecamatan', en: 'District heat map' },
    { id: 'Time-lapse 12 bulan', en: '12-month time-lapse' },
    { id: 'Dampak program terukur', en: 'Programme impact measured' },
  ],
}
