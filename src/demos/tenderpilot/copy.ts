/** tenderpilot — /produk/tenderpilot page copy (Tahap 6 plan §3.1). Sources: spec §11 P13, products.ts, tour ch. 10. */
import type { ProductCopy } from '../copy-types'

export const copy: ProductCopy = {
  pitch: {
    id: 'Tender yang cocok datang sebagai notifikasi dengan skor peluang, syarat tercentang dari produk lain, dan dokumen penawaran tersusun bagian demi bagian.',
    en: 'Matching tenders arrive as alerts with a win score, requirements ticked from other products, and the bid document assembled section by section.',
  },
  problems: [
    {
      title: { id: 'Tender yang cocok terlewat', en: 'Matching tenders are missed' },
      body: { id: 'UMKM tidak sempat memantau pengumuman pengadaan setiap hari.', en: 'SMEs have no time to watch procurement notices every day.' },
    },
    {
      title: { id: 'Syarat yang panjang', en: 'Long requirement lists' },
      body: { id: 'Dokumen administrasi dikumpulkan dari banyak tempat, dan satu yang tertinggal menggugurkan penawaran.', en: 'Paperwork is gathered from many places, and one missing item disqualifies the bid.' },
    },
    {
      title: { id: 'Menyusun penawaran memakan hari', en: 'Writing a bid takes days' },
      body: { id: 'Dokumen puluhan halaman ditulis ulang untuk setiap tender.', en: 'Documents of dozens of pages are rewritten for every tender.' },
    },
  ],
  steps: [
    {
      title: { id: 'Umpan tender dengan skor peluang', en: 'A tender feed with win scores' },
      body: { id: 'Paket fiktif disaring menurut KBLI, lokasi, nilai, dan tenggat, dengan faktor penjelas skor.', en: 'Fictional packages filtered by business code, location, value and deadline, with the factors behind each score.' },
    },
    {
      title: { id: 'Syarat tercentang otomatis', en: 'Requirements ticked automatically' },
      body: { id: 'Checklist terisi dari profil usaha, verifikasi Kenal Mitra, dan status Pajak Beres.', en: 'The checklist fills from the business profile, Kenal Mitra verification and Pajak Beres status.' },
    },
    {
      title: { id: 'Dokumen penawaran tersusun', en: 'The bid document is assembled' },
      body: { id: 'Editor bagian demi bagian yang terisi dari profil, dengan perbandingan sebelum dan sesudah AI, lalu ekspor PDF.', en: 'A section-by-section editor filled from the profile, with a before/after AI diff, then PDF export.' },
    },
  ],
  highlights: [
    {
      title: { id: 'Checklist dari produk lain', en: 'A checklist fed by other products' },
      body: { id: 'Status Terverifikasi dan pajak siap langsung mencentang syarat tender.', en: 'Verified status and a ready tax status tick tender requirements at once.' },
      frame: 'syarat',
    },
    {
      title: { id: 'Skor peluang yang bisa dijelaskan', en: 'A win score you can explain' },
      body: { id: 'Kesesuaian KBLI, pengalaman, jarak, harga historis, dan jumlah pesaing (skor simulasi).', en: 'Business-code fit, experience, distance, past prices and number of competitors (simulated score).' },
      frame: 'skor',
    },
  ],
  roles: {
    vendor: { id: 'Menemukan tender yang cocok dan mengirim penawaran lengkap tanpa begadang.', en: 'Finds matching tenders and submits complete bids without late nights.' },
  },
  relations: {
    'katalog-lokal': { id: 'Kebutuhan pemda di etalase menjadi peluang tender.', en: 'Government needs in the storefront become tender opportunities.' },
    'awas-belanja': { id: 'Temuan pengadaan memengaruhi peluang dan harga penawaran.', en: 'Procurement findings affect chances and bid prices.' },
    'kenal-mitra': { id: 'Verifikasi KYB mencentang syarat administrasi.', en: 'KYB verification ticks the paperwork requirement.' },
    'pajak-beres': { id: 'Status pajak siap menjadi syarat yang terpenuhi.', en: 'A ready tax status becomes a met requirement.' },
  },
  dataNote: {
    id: 'Paket tender, instansi pembeli, pesaing, dan skor peluang adalah fiktif dan simulasi, bergaya data pengadaan publik.',
    en: 'Tender packages, buying agencies, competitors and win scores are fictional and simulated, styled after public procurement data.',
  },
  faq: [
    {
      q: { id: 'Apakah TenderPilot mengirim penawaran untuk saya?', en: 'Does TenderPilot submit the bid for me?' },
      a: { id: 'Tidak. Ia menyusun dokumen dan checklist; pengirimannya tetap oleh vendor.', en: 'No. It prepares the document and checklist; the vendor still submits.' },
    },
    {
      q: { id: 'Dari mana data tendernya?', en: 'Where does the tender data come from?' },
      a: { id: 'Di demo, paket tender adalah fiktif. Sumber data untuk pemasangan dibahas saat konsultasi.', en: 'In the demo, tender packages are fictional. Data sources for an installation are discussed during consultation.' },
    },
    {
      q: { id: 'Apakah skor peluang menjamin menang?', en: 'Does the win score guarantee a win?' },
      a: { id: 'Tidak. Skor membantu memilih tender yang layak dikejar, dengan faktor yang bisa Anda periksa.', en: 'No. It helps you pick tenders worth pursuing, with factors you can check.' },
    },
    {
      q: { id: 'Bisakah dokumen diedit sebelum diekspor?', en: 'Can the document be edited before export?' },
      a: { id: 'Bisa. Setiap bagian bisa diubah, dan perbedaannya dengan versi AI terlihat.', en: 'Yes. Every section can be edited, and the difference from the AI version is shown.' },
    },
  ],
  miniCaption: [
    { id: 'Tender cocok ditemukan', en: 'A matching tender is found' },
    { id: 'Checklist dokumen', en: 'Document checklist' },
    { id: 'Skor peluang', en: 'Win score' },
    { id: 'Penawaran siap dikirim', en: 'Bid ready to submit' },
  ],
}
