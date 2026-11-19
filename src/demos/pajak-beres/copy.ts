/** pajak-beres — /produk/pajak-beres page copy (Tahap 6 plan §3.1). Sources: spec §11 P9, products.ts. No tax rates here. */
import type { ProductCopy } from '../copy-types'

export const copy: ProductCopy = {
  pitch: {
    id: 'Foto nota yang miring dan kusut menjadi baris jurnal yang rapi, dan laporan bulanan tinggal satu tombol.',
    en: 'A crooked, crumpled receipt photo becomes tidy journal rows, and the monthly report is one button away.',
  },
  problems: [
    {
      title: { id: 'Nota menumpuk di laci', en: 'Receipts pile up in a drawer' },
      body: { id: 'Pembukuan dikerjakan di akhir bulan, dari nota yang sebagian sudah pudar.', en: 'The books are done at month end, from receipts that have partly faded.' },
    },
    {
      title: { id: 'Tenggat pajak terlewat', en: 'Tax deadlines are missed' },
      body: { id: 'Pemilik usaha tidak sempat mengikuti kalender pajak di tengah urusan toko.', en: 'Owners cannot keep up with the tax calendar while running the shop.' },
    },
    {
      title: { id: 'Istilah yang membingungkan', en: 'Confusing terms' },
      body: { id: 'Pertanyaan sederhana soal pajak sulit dijawab tanpa konsultan.', en: 'Simple tax questions are hard to answer without a consultant.' },
    },
  ],
  steps: [
    {
      title: { id: 'Masukkan dokumen', en: 'Add documents' },
      body: { id: 'Foto nota, struk, faktur, atau CSV mutasi rekening di Kotak Dokumen.', en: 'Receipt photos, slips, invoices or a bank statement CSV in the Document Box.' },
    },
    {
      title: { id: 'Jurnal terisi otomatis', en: 'The journal fills itself' },
      body: { id: 'Setiap baris punya akun, debit atau kredit, dan tingkat keyakinan. Yang ragu diberi tanda "Perlu tinjauan".', en: 'Each row has an account, debit or credit and a confidence level. Uncertain rows are marked "Needs review".' },
    },
    {
      title: { id: 'Laporan dan kalender pajak', en: 'Reports and tax calendar' },
      body: { id: 'Laba-rugi, neraca sederhana, dan arus kas tersusun; tenggat bulan ini tampil dengan pengingat.', en: 'Profit and loss, a simple balance sheet and cash flow are built; this month’s deadlines show with reminders.' },
    },
  ],
  highlights: [
    {
      title: { id: 'Nota menjadi jurnal', en: 'Receipt to journal' },
      body: { id: 'Nota pembelian stok dari Toko Autopilot dibaca dan menjadi jurnal dalam beberapa detik.', en: 'A stock purchase receipt from Toko Autopilot is read and becomes a journal entry in seconds.' },
      frame: 'jurnal',
    },
    {
      title: { id: 'Status "rapi"', en: 'Status "tidy"' },
      body: { id: 'Begitu jurnal bulan ini lengkap, status pajak berubah menjadi siap, dan lencana Pajak Rapi tampil di Katalog Lokal.', en: "Once this month's journal is complete the tax status turns ready, and the Tidy Tax badge shows in Katalog Lokal." },
      frame: 'laporan',
    },
    {
      title: { id: 'Tanya Pajak', en: 'Ask about tax' },
      body: { id: 'Chat dengan bahasa awam untuk pertanyaan sehari-hari, dengan sumber aturan yang ditunjukkan.', en: 'Chat in plain language for everyday questions, with the rule sources shown.' },
    },
  ],
  roles: {
    'pemilik-toko': { id: 'Memotret nota, lalu melihat pembukuan dan status pajak tanpa begadang.', en: 'Snaps receipts, then sees the books and tax status without late nights.' },
    'konsultan-pajak': { id: 'Meninjau baris yang ditandai dan menyiapkan laporan untuk banyak klien.', en: 'Reviews flagged rows and prepares reports for many clients.' },
  },
  relations: {
    'toko-autopilot': { id: 'Penjualan kasir otomatis masuk ke jurnal.', en: 'Till sales go straight into the journal.' },
    'rapor-usaha': { id: 'Kepatuhan pajak menaikkan skor kesehatan usaha.', en: 'Tax compliance raises the business health score.' },
    tenderpilot: { id: 'Status pajak siap mencentang syarat tender.', en: 'A ready tax status ticks a tender requirement.' },
    'katalog-lokal': { id: 'Lencana Pajak Rapi tampil di etalase UMKM.', en: 'The Tidy Tax badge shows in the SME storefront.' },
  },
  dataNote: {
    id: 'Usaha, nota, transaksi, dan mutasi rekening adalah simulasi. Aturan pajak di demo dicatat bersama sumber resmi dan tahun berlakunya.',
    en: 'Businesses, receipts, transactions and bank statements are simulated. Tax rules in the demo are recorded with their official source and year.',
  },
  faq: [
    {
      q: { id: 'Apakah Pajak Beres menggantikan konsultan pajak?', en: 'Does Pajak Beres replace a tax consultant?' },
      a: { id: 'Tidak. Ia merapikan pembukuan dan menandai yang perlu ditinjau; konsultan tetap punya peran sendiri di demo.', en: 'No. It tidies the books and flags what needs review; consultants have their own role in the demo.' },
    },
    {
      q: { id: 'Bisakah langsung lapor ke sistem pajak?', en: 'Can it file directly with the tax system?' },
      a: { id: 'Demo menampilkan pratinjau berkas ekspor. Pelaporannya tetap dilakukan oleh wajib pajak.', en: 'The demo shows an export file preview. Filing is still done by the taxpayer.' },
    },
    {
      q: { id: 'Bagaimana jika nota tidak terbaca?', en: 'What if a receipt cannot be read?' },
      a: { id: 'Baris dengan keyakinan rendah diberi tanda "Perlu tinjauan" dan bisa diedit langsung.', en: 'Low-confidence rows are marked "Needs review" and can be edited inline.' },
    },
    {
      q: { id: 'Apakah data keuangan saya aman?', en: 'Is my financial data safe?' },
      a: { id: 'Akses diatur per peran dan tercatat di Inti Audit. Lokasi server dibahas saat konsultasi.', en: 'Access is set per role and recorded in Inti Audit. Server location is discussed during consultation.' },
    },
  ],
  miniCaption: [
    { id: 'Foto nota yang kusut', en: 'A crumpled receipt photo' },
    { id: 'Isi nota dibaca', en: 'The receipt is read' },
    { id: 'Baris jurnal tersusun', en: 'Journal rows take shape' },
    { id: 'Status pajak: rapi', en: 'Tax status: tidy' },
  ],
}
