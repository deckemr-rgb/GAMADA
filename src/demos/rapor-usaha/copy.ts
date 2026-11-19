/** rapor-usaha — /produk/rapor-usaha page copy (Tahap 6 plan §3.1). Sources: spec §11 P15, products.ts. No loan amounts. */
import type { ProductCopy } from '../copy-types'

export const copy: ProductCopy = {
  pitch: {
    id: 'Skor kesehatan usaha 0–1000 dari data penjualan, pembukuan, dan verifikasi, dengan pengajuan modal kerja yang tidak butuh tumpukan berkas.',
    en: 'A 0–1000 business health score from sales, books and verification data, with a working-capital application that needs no paper stack.',
  },
  problems: [
    {
      title: { id: 'UMKM sulit membuktikan kesehatannya', en: 'SMEs struggle to prove their health' },
      body: { id: 'Usaha yang ramai belum tentu punya laporan yang bisa dibaca bank.', en: 'A busy business does not always have reports a bank can read.' },
    },
    {
      title: { id: 'Pengajuan modal penuh berkas', en: 'Loan applications drown in paper' },
      body: { id: 'Fotokopi, legalisir, dan survei membuat modal kerja datang terlambat.', en: 'Copies, stamps and site visits make working capital arrive late.' },
    },
    {
      title: { id: 'Tidak tahu cara memperbaiki', en: 'No idea how to improve' },
      body: { id: 'Saat ditolak, pemilik usaha jarang tahu faktor mana yang perlu diperbaiki.', en: 'When rejected, owners rarely know which factor to fix.' },
    },
  ],
  steps: [
    {
      title: { id: 'Skor dari data nyata usaha', en: 'A score from real business data' },
      body: { id: 'Stabilitas omzet, margin, kepatuhan pajak, ketepatan bayar supplier, verifikasi KYB, dan pertumbuhan.', en: 'Revenue stability, margin, tax compliance, paying suppliers on time, KYB verification and growth.' },
    },
    {
      title: { id: 'Cara menaikkan skor', en: 'How to raise the score' },
      body: { id: 'Tiga aksi yang paling berpengaruh, dan skor naik seketika saat data diperbaiki.', en: 'The three actions that matter most, and the score rises as soon as the data is fixed.' },
    },
    {
      title: { id: 'Berbagi data dengan izin', en: 'Share data with consent' },
      body: { id: 'Pilih data apa, ke siapa, dan berapa lama. Bank atau koperasi mitra melihat skor dan rekomendasi di antreannya.', en: 'Choose which data, to whom and for how long. The partner bank or cooperative sees the score and a recommendation in its queue.' },
    },
  ],
  highlights: [
    {
      title: { id: 'Dial yang bergerak', en: 'A dial that moves' },
      body: { id: 'Begitu pembukuan dirapikan di Pajak Beres, skor naik di depan mata (angka simulasi).', en: 'As soon as the books are tidied in Pajak Beres, the score climbs in front of you (simulated figures).' },
      frame: 'naik',
    },
    {
      title: { id: 'Persetujuan yang jelas', en: 'Clear consent' },
      body: { id: 'Layar persetujuan berbagi data yang mudah dibaca, bukan paragraf kecil di bawah formulir.', en: 'A data-sharing consent screen that is easy to read, not small print under a form.' },
    },
  ],
  roles: {
    'pemilik-toko': { id: 'Tahu posisi usahanya dan langkah konkret untuk naik kelas.', en: 'Knows where the business stands and the concrete steps to grow.' },
    'bank-mitra': { id: 'Menilai pengajuan dari data yang sudah dibagikan dengan izin, bukan tumpukan fotokopi.', en: 'Assesses applications from data shared with consent, not piles of copies.' },
  },
  relations: {
    'toko-autopilot': { id: 'Data penjualan kasir menjadi dasar stabilitas omzet.', en: 'Till sales underpin revenue stability.' },
    'pajak-beres': { id: 'Pembukuan rapi dan kepatuhan pajak menaikkan skor.', en: 'Tidy books and tax compliance raise the score.' },
    'kenal-mitra': { id: 'Verifikasi KYB menjadi salah satu faktor skor.', en: 'KYB verification is one of the score factors.' },
    'katalog-lokal': { id: 'Skor Usaha tampil sebagai lencana di etalase.', en: 'The Business Score shows as a badge in the storefront.' },
  },
  dataNote: {
    id: 'Usaha, bank, koperasi, skor, plafon, dan cicilan di demo adalah fiktif dan simulasi; tidak ada penawaran pinjaman sungguhan.',
    en: 'Businesses, banks, cooperatives, scores, limits and instalments in the demo are fictional and simulated; there is no real loan offer.',
  },
  faq: [
    {
      q: { id: 'Apakah skor ini sama dengan skor kredit resmi?', en: 'Is this the same as an official credit score?' },
      a: { id: 'Tidak. Ini skor kesehatan usaha dari data operasional, untuk dibahas bersama mitra keuangan.', en: 'No. It is a business health score from operating data, to be discussed with financial partners.' },
    },
    {
      q: { id: 'Siapa yang bisa melihat skor saya?', en: 'Who can see my score?' },
      a: { id: 'Hanya pihak yang Anda beri izin, untuk data dan jangka waktu yang Anda pilih.', en: 'Only parties you grant consent to, for the data and period you choose.' },
    },
    {
      q: { id: 'Apakah GAMADA memberi pinjaman?', en: 'Does GAMADA lend money?' },
      a: { id: 'Tidak. Simulasi pengajuan modal di demo hanya menunjukkan alurnya dengan bank atau koperasi fiktif.', en: 'No. The loan simulation in the demo only shows the flow with a fictional bank or cooperative.' },
    },
    {
      q: { id: 'Bagaimana cara menaikkan skor?', en: 'How do I raise my score?' },
      a: { id: 'Rapor Usaha menunjukkan tiga aksi yang paling berpengaruh untuk usaha Anda.', en: 'Rapor Usaha shows the three actions that matter most for your business.' },
    },
  ],
  miniCaption: [
    { id: 'Dial skor mulai dari nol', en: 'The score dial starts at zero' },
    { id: 'Faktor skor terbaca', en: 'Score factors read in' },
    { id: 'Skor naik setelah data rapi', en: 'The score rises after tidy data' },
    { id: 'Penawaran modal kerja (simulasi)', en: 'Working-capital offer (simulated)' },
  ],
}
