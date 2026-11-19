/** sinyal-pasar — /produk/sinyal-pasar page copy (Tahap 6 plan §3.1). Sources: spec §11 P17, products.ts, tour ch. 17. */
import type { ProductCopy } from '../copy-types'

export const copy: ProductCopy = {
  pitch: {
    id: 'Kenaikan harga cabai dan beras terdeteksi sebelum melonjak, lalu satu sinyal menggerakkan operasi pasar pemda dan stok UMKM sekaligus.',
    en: 'Rising chilli and rice prices are detected before they spike, and one signal moves the government market operation and SME stock at once.',
  },
  problems: [
    {
      title: { id: 'Lonjakan harga baru terlihat saat sudah tinggi', en: 'Price spikes are seen only once they peak' },
      body: { id: 'Survei harga manual memberi angka kemarin, ketika warga sudah merasakan kenaikannya.', en: "Manual price surveys give yesterday's numbers, after people already feel the rise." },
    },
    {
      title: { id: 'Sinyal pasokan terputus', en: 'Supply signals are disconnected' },
      body: { id: 'Gagal panen karena banjir tidak langsung terhubung ke pemantauan harga pasar.', en: 'Harvest loss from flooding is not linked straight to market price monitoring.' },
    },
    {
      title: { id: 'Pedagang kecil tahu paling akhir', en: 'Small traders find out last' },
      body: { id: 'UMKM membeli stok di harga tinggi karena tidak punya peringatan dini.', en: 'SMEs restock at high prices because they have no early warning.' },
    },
  ],
  steps: [
    {
      title: { id: 'Harga di setiap pasar', en: 'Prices at every market' },
      body: { id: 'Ticker dan tabel komoditas per pasar dengan sparkline, di pasar-pasar {region}.', en: 'A ticker and a commodity table per market with sparklines, across the markets of {region}.' },
    },
    {
      title: { id: 'Anomali terdeteksi', en: 'Anomalies are detected' },
      body: { id: 'Kenaikan di atas pola musiman ditandai, dengan prediksi 14 hari dan pita keyakinannya.', en: 'Rises above the seasonal pattern are flagged, with a 14-day forecast and its confidence band.' },
    },
    {
      title: { id: 'Aksi untuk pemda dan UMKM', en: 'Action for government and SMEs' },
      body: { id: 'Rekomendasi operasi pasar atau pantau distributor; UMKM yang berlangganan menerima peringatan.', en: 'A market operation or distributor check is recommended; subscribed SMEs get an alert.' },
    },
  ],
  highlights: [
    {
      title: { id: 'Operasi pasar meredam garis', en: 'A market operation flattens the line' },
      body: { id: 'Setelah operasi pasar dijalankan, kurva prediksi terlihat melandai (simulasi).', en: 'After the market operation runs, the forecast curve visibly flattens (simulated).' },
      frame: 'simulasi',
    },
    {
      title: { id: 'Satu sinyal, dua sisi', en: 'One signal, two sides' },
      body: { id: 'Disperindag mendapat rekomendasi, toko mendapat peringatan stok, di saat yang sama.', en: 'The trade office gets a recommendation and shops get a stock alert, at the same time.' },
    },
  ],
  roles: {
    disperindag: { id: 'Melihat anomali harga lebih awal dan menyiapkan operasi pasar dengan data.', en: 'Sees price anomalies early and plans market operations with data.' },
    'pemilik-toko': { id: 'Menerima peringatan sebelum belanja stok di harga tinggi.', en: 'Gets an alert before restocking at high prices.' },
  },
  relations: {
    'meja-pimpinan': { id: 'Anomali harga masuk ke briefing pimpinan.', en: "Price anomalies go into the head's briefing." },
    'toko-autopilot': { id: 'Peringatan harga menggerakkan harga jual dan stok toko.', en: 'Price alerts move shop prices and stock.' },
    'indeks-ekonomi': { id: 'Dampak operasi pasar terukur di indeks kecamatan.', en: 'Market operation impact is measured in the district index.' },
    'siaga-wilayah': { id: 'Panen yang terdampak banjir memicu sinyal pasokan.', en: 'Flood-hit harvests trigger supply signals.' },
  },
  dataNote: {
    id: 'Nama pasar mengikuti {region} yang sebenarnya. Semua harga, anomali, dan prediksi adalah simulasi.',
    en: 'Market names follow the real {region}. All prices, anomalies and forecasts are simulated.',
  },
  faq: [
    {
      q: { id: 'Apakah harga di demo adalah harga nyata?', en: 'Are the prices in the demo real?' },
      a: { id: 'Tidak. Nama pasarnya nyata, harganya simulasi. Sumber data untuk pemasangan dibahas saat konsultasi.', en: 'No. The market names are real, the prices are simulated. Data sources for an installation are discussed during consultation.' },
    },
    {
      q: { id: 'Komoditas apa saja yang dipantau?', en: 'Which commodities are tracked?' },
      a: { id: 'Demo memuat bahan pokok seperti beras dan cabai. Daftar komoditas disesuaikan dengan daerah Anda.', en: 'The demo holds staples such as rice and chilli. The list is fitted to your region.' },
    },
    {
      q: { id: 'Bagaimana UMKM menerima peringatan?', en: 'How do SMEs receive alerts?' },
      a: { id: 'Di demo, lewat langganan peringatan di sisi UMKM. Kanal pengiriman dibahas saat konsultasi.', en: 'In the demo, through an alert subscription on the SME side. Delivery channels are discussed during consultation.' },
    },
    {
      q: { id: 'Apakah keputusan operasi pasar otomatis?', en: 'Is the market operation decided automatically?' },
      a: { id: 'Tidak. Sinyal Pasar memberi rekomendasi; keputusan tetap di Disperindag dan pimpinan.', en: 'No. Sinyal Pasar recommends; the decision stays with the trade office and leadership.' },
    },
  ],
  miniCaption: [
    { id: 'Harga mulai naik', en: 'Prices start to rise' },
    { id: 'Peringatan anomali', en: 'Anomaly alert' },
    { id: 'Operasi pasar direkomendasikan', en: 'Market operation recommended' },
    { id: 'Garis harga melandai', en: 'The price line flattens' },
  ],
}
