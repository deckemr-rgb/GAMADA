/**
 * world/up/labels.ts — Usaha Pintar labels { id, en } shared by the six products (one wording everywhere).
 */
import type { AnnounceChannel, Bi, BrandMention, BrandTopic, CriterionKey, PayMethod, PurchaseOrder, ReqKey, StaffJob, TaxItem, Tender, VerificationRequest } from '../types'

export const ACCOUNT: Record<string, Bi> = {
  Kas: { id: 'Kas', en: 'Cash' },
  Bank: { id: 'Bank', en: 'Bank' },
  Persediaan: { id: 'Persediaan', en: 'Inventory' },
  'Utang Usaha': { id: 'Utang Usaha', en: 'Accounts payable' },
  'Modal Pemilik': { id: 'Modal Pemilik', en: "Owner's equity" },
  Prive: { id: 'Prive', en: "Owner's drawings" },
  'Pendapatan Penjualan': { id: 'Pendapatan Penjualan', en: 'Sales revenue' },
  'Pendapatan Lain-lain': { id: 'Pendapatan Lain-lain', en: 'Other income' },
  'Pendapatan Bunga': { id: 'Pendapatan Bunga', en: 'Interest income' },
  HPP: { id: 'HPP', en: 'Cost of goods sold' },
  'Beban Gaji': { id: 'Beban Gaji', en: 'Wages expense' },
  'Beban Listrik & Air': { id: 'Beban Listrik & Air', en: 'Electricity & water' },
  'Beban Sewa': { id: 'Beban Sewa', en: 'Rent expense' },
  'Beban Lain-lain': { id: 'Beban Lain-lain', en: 'Other expenses' },
  'Beban Bahan Bakar': { id: 'Beban Bahan Bakar', en: 'Fuel expense' },
  'Beban Admin Bank': { id: 'Beban Admin Bank', en: 'Bank charges' },
  'Beban Pajak': { id: 'Beban Pajak', en: 'Tax expense' },
  'Utang PPh 21': { id: 'Utang PPh 21', en: 'PPh 21 payable' },
  'Utang PPh Final': { id: 'Utang PPh Final', en: 'Final income tax payable' },
  'Utang Pinjaman': { id: 'Utang Pinjaman', en: 'Loan payable' },
}
export const PAYMENT: Record<PayMethod, Bi> = { tunai: { id: 'Tunai', en: 'Cash' }, qris: { id: 'QRIS', en: 'QRIS' }, transfer: { id: 'Transfer', en: 'Transfer' } }
export const PO_STATUS: Record<PurchaseOrder['status'], Bi> = {
  draf: { id: 'Draf', en: 'Draft' }, terkirim: { id: 'Terkirim', en: 'Sent' }, dibalas: { id: 'Dibalas', en: 'Replied' }, diterima: { id: 'Diterima', en: 'Received' },
}
export const TAX_KIND: Record<TaxItem['kind'], Bi> = {
  'pph-final-umkm': { id: 'PPh Final UMKM', en: 'Final income tax (MSME)' }, pph21: { id: 'PPh 21 karyawan', en: 'Employee income tax (PPh 21)' },
  pbb: { id: 'PBB', en: 'Land & building tax' }, 'pajak-reklame': { id: 'Pajak reklame', en: 'Billboard tax' },
}
export const TAX_STATUS: Record<TaxItem['status'], Bi> = {
  'perlu-hitung': { id: 'Perlu dihitung', en: 'To compute' }, siap: { id: 'Siap lapor', en: 'Ready to file' }, dibayar: { id: 'Dibayar', en: 'Paid' }, dilaporkan: { id: 'Dilaporkan', en: 'Filed' },
}
export const CALL_CRITERIA: Record<CriterionKey, Bi> = {
  salam: { id: 'Salam & identifikasi', en: 'Greeting & identification' }, gali: { id: 'Gali kebutuhan', en: 'Needs discovery' },
  keberatan: { id: 'Tangani keberatan', en: 'Objection handling' }, penawaran: { id: 'Penawaran', en: 'Offer' },
  closing: { id: 'Closing', en: 'Closing' }, kepatuhan: { id: 'Kepatuhan skrip', en: 'Script compliance' },
}
export const CALL_FLAG: Record<string, Bi> = {
  'keberatan-tidak-dijawab': { id: 'Keberatan tidak dijawab', en: 'Objection not answered' },
  'lupa-salam': { id: 'Lupa salam & identifikasi', en: 'No greeting / identification' },
  'janji-berlebihan': { id: 'Janji berlebihan', en: 'Over-promising' },
  'tidak-closing': { id: 'Tidak ada closing', en: 'No closing' },
  'tidak-gali-kebutuhan': { id: 'Kebutuhan tidak digali', en: 'Needs not explored' },
  'penawaran-tidak-jelas': { id: 'Penawaran tidak jelas', en: 'Unclear offer' },
}
/** generic channel labels (owner decision §6 P2: no real platform names) */
export const BRAND_CHANNEL: Record<BrandMention['channel'], Bi> = {
  marketplace: { id: 'Marketplace', en: 'Marketplace' }, instagram: { id: 'Medsos foto', en: 'Photo social' }, x: { id: 'Medsos singkat', en: 'Short-post social' },
  tiktok: { id: 'Video pendek', en: 'Short video' }, 'ulasan-peta': { id: 'Ulasan peta', en: 'Map reviews' },
}
export const ANNOUNCE_CHANNEL: Record<AnnounceChannel, Bi> = {
  marketplace: { id: 'Marketplace', en: 'Marketplace' }, sosmed: { id: 'Media sosial', en: 'Social media' }, 'ulasan-peta': { id: 'Ulasan peta', en: 'Map reviews' },
  'wa-status': { id: 'Status WA', en: 'WA status' }, struk: { id: 'Struk kasir', en: 'Receipts (POS)' },
}
export const BRAND_TOPIC: Record<BrandTopic, Bi> = {
  pengiriman: { id: 'Pengiriman', en: 'Delivery' }, kualitas: { id: 'Kualitas', en: 'Quality' }, harga: { id: 'Harga', en: 'Price' }, layanan: { id: 'Layanan', en: 'Service' }, stok: { id: 'Stok', en: 'Stock' },
}
export const TENDER_STATUS: Record<Tender['status'], Bi> = { dibuka: { id: 'Dibuka', en: 'Open' }, evaluasi: { id: 'Evaluasi', en: 'Evaluation' }, selesai: { id: 'Selesai', en: 'Closed' } }
export const REQ: Record<ReqKey, Bi> = {
  'nib-kbli': { id: 'NIB & KBLI sesuai', en: 'NIB & matching KBLI' }, akta: { id: 'Akta pendirian', en: 'Deed of establishment' }, npwp: { id: 'NPWP aktif', en: 'Active tax ID (NPWP)' },
  kyb: { id: 'Verifikasi usaha (KYB)', en: 'Business verification (KYB)' }, pajak: { id: 'Status pajak valid', en: 'Valid tax status' },
  pengalaman: { id: 'Pengalaman pekerjaan sejenis', en: 'Similar work experience' }, kapasitas: { id: 'Kapasitas stok & pengiriman', en: 'Stock & delivery capacity' },
  pakta: { id: 'Pakta integritas', en: 'Integrity pact' },
}
export const KYC_STATUS: Record<VerificationRequest['status'], Bi> = { antri: { id: 'Antri', en: 'Queued' }, diproses: { id: 'Diproses', en: 'In progress' }, selesai: { id: 'Selesai', en: 'Done' } }
export const STAFF_JOB: Record<StaffJob, Bi> = {
  'kepala-toko': { id: 'Kepala toko', en: 'Store manager' }, admin: { id: 'Admin penjualan & keuangan', en: 'Sales & finance admin' }, kasir: { id: 'Kasir', en: 'Cashier' },
  gudang: { id: 'Staf gudang', en: 'Warehouse staff' }, sopir: { id: 'Sopir pengiriman', en: 'Delivery driver' }, barista: { id: 'Barista', en: 'Barista' },
  pramusaji: { id: 'Pramusaji', en: 'Server' }, 'juru-masak': { id: 'Juru masak', en: 'Cook' },
}
