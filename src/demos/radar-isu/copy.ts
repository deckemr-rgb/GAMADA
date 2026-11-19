/** radar-isu — /produk/radar-isu page copy (Tahap 6 plan §3.1). Sources: spec §11 P4, products.ts, docs/products/scrappulse.md (#analisis). */
import type { ProductCopy } from '../copy-types'

export const copy: ProductCopy = {
  pitch: {
    id: 'Hoaks "bendungan jebol" tertangkap saat baru mulai menyebar, lengkap dengan bukti dari data sungai, dan draf klarifikasi siap dalam hitungan detik.',
    en: 'A "dam burst" hoax is caught as it starts to spread, with evidence from river data, and a draft clarification is ready in seconds.',
  },
  problems: [
    {
      title: { id: 'Hoaks lebih cepat dari klarifikasi', en: 'Hoaxes outrun clarifications' },
      body: { id: 'Saat Humas tahu, pesan palsu sudah beredar di banyak grup. Klarifikasi datang ketika warga sudah panik.', en: 'By the time Public Relations knows, the fake message is in many groups. The clarification arrives after people panic.' },
    },
    {
      title: { id: 'Pemantauan manual', en: 'Manual monitoring' },
      body: { id: 'Staf membuka media sosial dan portal berita satu per satu, tanpa gambaran volume dan sentimen.', en: 'Staff open social media and news sites one by one, with no picture of volume or sentiment.' },
    },
    {
      title: { id: 'Bukti tersebar di dinas lain', en: 'Evidence sits in other agencies' },
      body: { id: 'Data tinggi muka air yang membantah hoaks ada di sistem lain, dan butuh waktu untuk dimintakan.', en: 'The water-level data that disproves the hoax lives in another system and takes time to request.' },
    },
  ],
  steps: [
    {
      title: { id: 'Pantauan live', en: 'Live monitoring' },
      body: { id: 'Mention berita dan media sosial bergulir dengan badge sentimen; topik dikelompokkan menjadi klaster.', en: 'News and social mentions scroll by with sentiment badges; topics are grouped into clusters.' },
    },
    {
      title: { id: 'Peringatan hoaks', en: 'Hoax alert' },
      body: { id: 'Kartu peringatan menunjukkan skor kemungkinan hoaks, kecepatan sebar, akun penyebar awal, dan bukti pembanding dari Siaga Wilayah.', en: 'The alert card shows a hoax likelihood score, spread speed, first spreaders and counter-evidence from Siaga Wilayah.' },
    },
    {
      title: { id: 'Susun klarifikasi', en: 'Draft the clarification' },
      body: { id: 'Pilih nada, lalu AI menyusun rilis pers, caption media sosial, dan teks infografis. Setelah terbit, kurva sentimen terpantau pulih.', en: 'Pick a tone and the AI drafts a press release, a social caption and infographic text. After publishing, sentiment is tracked as it recovers.' },
    },
  ],
  highlights: [
    {
      title: { id: 'Hoaks dengan buktinya', en: 'A hoax with its evidence' },
      body: { id: 'Narasi bendungan jebol dibandingkan dengan tinggi muka air normal dari Siaga Wilayah, di kartu yang sama.', en: 'The dam-burst story is set against normal water levels from Siaga Wilayah, on the same card.' },
      frame: 'hoaks',
    },
    {
      title: { id: 'Klarifikasi dalam hitungan detik', en: 'A clarification in seconds' },
      body: { id: 'Tiga format sekaligus, siap ditinjau Humas sebelum terbit.', en: 'Three formats at once, ready for Public Relations to review before publishing.' },
      frame: 'klarifikasi',
    },
    {
      title: { id: 'Analisis mendalam, dulu ScrapPulse', en: 'Deep analysis, formerly ScrapPulse' },
      body: { id: 'Hingga 4 kata kunci: volume, sentimen, topik, kutipan kunci, dan saran pertanyaan survei, dengan ekspor XLSX dan JSON.', en: 'Up to 4 keywords: volume, sentiment, topics, key quotes and suggested survey questions, with XLSX and JSON export.' },
    },
  ],
  roles: {
    humas: { id: 'Tahu lebih dulu, punya bukti, dan menerbitkan klarifikasi sebelum isu membesar.', en: 'Knows first, has evidence, and publishes a clarification before the issue grows.' },
    'kepala-daerah': { id: 'Menerima peringatan isu penting langsung di Meja Pimpinan.', en: 'Receives important issue alerts directly in Meja Pimpinan.' },
  },
  relations: {
    'siaga-wilayah': { id: 'Data tinggi muka air menjadi bukti pembanding.', en: 'Water-level data becomes the counter-evidence.' },
    'sapa-warga': { id: 'Lonjakan aduan warga menjadi topik yang dipantau.', en: 'Spikes in citizen complaints become monitored topics.' },
    'meja-pimpinan': { id: 'Hoaks yang terdeteksi masuk ke briefing pimpinan.', en: "Detected hoaxes go into the head's briefing." },
    'pantau-merek': { id: 'Mesin analisis yang sama dipakai untuk reputasi merek.', en: 'The same analysis engine powers brand reputation.' },
  },
  dataNote: {
    id: 'Nama bendungan dan wilayah memakai geografi {region} yang sebenarnya. Semua media, akun, unggahan, dan angka sentimen adalah fiktif.',
    en: 'Dam and area names follow the real geography of {region}. All media outlets, accounts, posts and sentiment figures are fictional.',
  },
  faq: [
    {
      q: { id: 'Sumber apa saja yang dipantau?', en: 'Which sources are monitored?' },
      a: { id: 'Di demo, semua sumber adalah fiktif. Sumber nyata untuk pemasangan dibahas saat konsultasi.', en: 'In the demo every source is fictional. Real sources for an installation are discussed during consultation.' },
    },
    {
      q: { id: 'Apakah klarifikasi terbit otomatis?', en: 'Is the clarification published automatically?' },
      a: { id: 'Tidak. AI menyiapkan draf; Humas yang meninjau dan memutuskan untuk menerbitkan.', en: 'No. The AI prepares drafts; Public Relations reviews and decides to publish.' },
    },
    {
      q: { id: 'Ke mana ScrapPulse?', en: 'Where did ScrapPulse go?' },
      a: { id: 'ScrapPulse kini menjadi tab Analisis di Radar Isu, dan mesinnya juga dipakai Pantau Merek.', en: 'ScrapPulse is now the Analysis tab of Radar Isu, and its engine also powers Pantau Merek.' },
    },
    {
      q: { id: 'Bisakah membuat laporan harian?', en: 'Can it make a daily report?' },
      a: { id: 'Bisa. Tab Laporan menyusun laporan harian yang bisa dicetak atau disimpan sebagai PDF.', en: 'Yes. The Report tab builds a daily report you can print or save as PDF.' },
    },
  ],
  miniCaption: [
    { id: 'Pantauan berjalan normal', en: 'Monitoring runs as usual' },
    { id: 'Volume tiba-tiba melonjak', en: 'Volume suddenly spikes' },
    { id: 'Peringatan hoaks dengan bukti', en: 'Hoax alert with evidence' },
    { id: 'Draf klarifikasi siap', en: 'Draft clarification ready' },
    { id: 'Sentimen pulih setelah terbit', en: 'Sentiment recovers after publishing' },
  ],
}
