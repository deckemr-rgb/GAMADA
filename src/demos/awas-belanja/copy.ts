/** awas-belanja — /produk/awas-belanja page copy (Tahap 6 plan §3.1). Sources: spec §11 P6, products.ts. */
import type { ProductCopy } from '../copy-types'

export const copy: ProductCopy = {
  pitch: {
    id: 'HPS dibandingkan dengan harga pasar, peserta tender yang terafiliasi terlihat di graf jaringan, dan memo audit tersusun sebelum kontrak diteken.',
    en: 'The cost estimate is compared with market prices, affiliated bidders show up in a network graph, and an audit memo is drafted before signing.',
  },
  problems: [
    {
      title: { id: 'Pemeriksaan datang setelah kontrak', en: 'Checks come after the contract' },
      body: { id: 'Kemahalan dan pola janggal baru ditemukan saat audit, ketika uang sudah keluar.', en: 'Overpricing and odd patterns are found during the audit, after the money is spent.' },
    },
    {
      title: { id: 'Paket darurat dibuat terburu-buru', en: 'Emergency packages are rushed' },
      body: { id: 'Saat banjir, pengadaan pompa harus cepat, dan pembanding harga sering dilewati.', en: 'During a flood, pump procurement must be fast, and price comparison is often skipped.' },
    },
    {
      title: { id: 'Hubungan antarpeserta tersembunyi', en: 'Links between bidders stay hidden' },
      body: { id: 'Alamat sama, direktur sama, atau pemenang bergiliran sulit dilihat dari tabel peserta.', en: 'Shared addresses, shared directors or rotating winners are hard to spot in a bidder table.' },
    },
  ],
  steps: [
    {
      title: { id: 'Buka paket', en: 'Open the package' },
      body: { id: 'Misalnya "Pengadaan Pompa Air Darurat", yang muncul setelah peringatan banjir.', en: 'For example "Emergency Water Pump Procurement", which appears after the flood warning.' },
    },
    {
      title: { id: 'Jalankan analisis', en: 'Run the analysis' },
      body: { id: 'Detektor memindai satu per satu: HPS vs pasar, penawaran seragam, pemenang berulang, pemecahan paket, jadwal terlalu singkat, spesifikasi mengunci merek.', en: 'Detectors scan one by one: estimate vs market, uniform bids, repeat winners, split packages, short schedules, brand-locked specs.' },
    },
    {
      title: { id: 'Rekomendasi dan memo', en: 'Recommendation and memo' },
      body: { id: 'Setiap temuan punya penjelasan. AI menyusun memo audit dan rekomendasi, termasuk mengundang UMKM lokal lewat Katalog Lokal.', en: 'Every finding comes with an explanation. The AI drafts an audit memo and recommendations, including inviting local SMEs via Katalog Lokal.' },
    },
  ],
  highlights: [
    {
      title: { id: 'HPS vs pasar', en: 'Estimate vs market' },
      body: { id: 'Grafik deviasi menandai item yang jauh di atas median pasar (angka simulasi).', en: 'A deviation chart flags items far above the market median (simulated figures).' },
      frame: 'hps',
    },
    {
      title: { id: 'Temuan yang bisa dijelaskan', en: 'Findings you can explain' },
      body: { id: 'Status Lolos, Waspada, atau Tinggi, dengan alasan yang bisa dibaca pemeriksa dan pejabat.', en: 'Pass, Watch or High, with reasons that auditors and officials can read.' },
      frame: 'flag',
    },
    {
      title: { id: 'Graf jaringan peserta', en: 'Bidder network graph' },
      body: { id: 'Lingkaran peserta terafiliasi terbuka di graf; klik garisnya untuk melihat buktinya.', en: 'The circle of affiliated bidders opens up in the graph; click a link to see the evidence.' },
    },
  ],
  roles: {
    ukpbj: { id: 'Memeriksa kewajaran HPS dan peserta sebelum paket berjalan.', en: 'Checks the cost estimate and bidders before the package moves on.' },
    inspektorat: { id: 'Mendapat temuan yang terdokumentasi dan draf memo audit.', en: 'Gets documented findings and a draft audit memo.' },
  },
  relations: {
    'siaga-wilayah': { id: 'Peringatan banjir membuat paket belanja darurat.', en: 'A flood warning creates the emergency purchase package.' },
    'katalog-lokal': { id: 'Harga UMKM lokal menjadi pembanding, dan UMKM bisa diundang.', en: 'Local SME prices become the benchmark, and SMEs can be invited.' },
    tenderpilot: { id: 'Vendor melihat temuan yang memengaruhi peluangnya.', en: 'Vendors see findings that affect their chances.' },
    'meja-pimpinan': { id: 'Paket berisiko masuk ke briefing pimpinan.', en: "Risky packages go into the head's briefing." },
  },
  dataNote: {
    id: 'OPD mengikuti struktur pemda {region}. Paket, perusahaan, direktur, harga, dan temuan adalah fiktif dan simulasi.',
    en: 'Agencies follow the {region} government structure. Packages, companies, directors, prices and findings are fictional and simulated.',
  },
  faq: [
    {
      q: { id: 'Apakah temuan berarti ada pelanggaran?', en: 'Does a finding mean wrongdoing?' },
      a: { id: 'Tidak. Temuan adalah tanda untuk diperiksa lebih lanjut oleh manusia, lengkap dengan alasannya.', en: 'No. A finding is a signal for people to look into, with its reasons.' },
    },
    {
      q: { id: 'Dari mana harga pasar diambil?', en: 'Where do market prices come from?' },
      a: { id: 'Di demo, dari data simulasi. Sumber pembanding untuk pemasangan dibahas saat konsultasi.', en: 'In the demo, from simulated data. Benchmark sources for an installation are discussed during consultation.' },
    },
    {
      q: { id: 'Bisakah memo audit dicetak?', en: 'Can the audit memo be printed?' },
      a: { id: 'Bisa. Memo tampil sebagai dokumen yang bisa dicetak atau disimpan sebagai PDF, dengan angka yang sama dengan tabel.', en: 'Yes. The memo shows as a document you can print or save as PDF, with the same numbers as the table.' },
    },
    {
      q: { id: 'Apakah tersambung dengan sistem pengadaan yang ada?', en: 'Does it connect to existing procurement systems?' },
      a: { id: 'Integrasi data dapat dirancang. Cakupannya dibahas bersama tim Anda saat konsultasi.', en: 'Data integration can be designed. The scope is discussed with your team during consultation.' },
    },
  ],
  miniCaption: [
    { id: 'Paket pompa air darurat dibuka', en: 'The emergency pump package opens' },
    { id: 'Detektor memindai satu per satu', en: 'Detectors scan one by one' },
    { id: 'HPS dibandingkan dengan pasar', en: 'The estimate is compared with the market' },
    { id: 'Item kemahalan ditandai', en: 'Overpriced items are flagged' },
  ],
}
