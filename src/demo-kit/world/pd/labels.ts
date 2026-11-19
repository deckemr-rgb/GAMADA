/**
 * world/pd/labels.ts — Pasar Daerah labels {id, en} (one source for every product of the ecosystem).
 */
import type { Bi, ConsentScope, LoanApp, MarketOperation, Order, ScoreFactor } from '../types'

export const BADGE: Record<'verified' | 'taxTidy' | 'score' | 'none', Bi> = {
  verified: { id: 'Terverifikasi', en: 'Verified' },
  taxTidy: { id: 'Pajak Rapi', en: 'Tax in order' },
  score: { id: 'Skor', en: 'Score' },
  none: { id: 'Belum', en: 'Not yet' },
}
export const ORDER_STATUS: Record<Order['status'], Bi> = {
  dipesan: { id: 'Dipesan', en: 'Ordered' },
  dikonfirmasi: { id: 'Dikonfirmasi', en: 'Confirmed' },
  dikirim: { id: 'Dikirim', en: 'Shipped' },
  dibayar: { id: 'Dibayar', en: 'Paid' },
}
export const CONSENT_SCOPE: Record<ConsentScope, Bi> = {
  omzet: { id: 'Omzet bulanan', en: 'Monthly turnover' },
  laporan: { id: 'Laporan keuangan', en: 'Financial statements' },
  pajak: { id: 'Status pajak', en: 'Tax status' },
  kyb: { id: 'Verifikasi usaha (KYB)', en: 'Business verification (KYB)' },
  mutasi: { id: 'Mutasi rekening', en: 'Bank statement' },
  supplier: { id: 'Riwayat pemasok', en: 'Supplier history' },
}
export const LOAN_STATUS: Record<LoanApp['status'], Bi> = {
  diajukan: { id: 'Diajukan', en: 'Submitted' },
  disetujui: { id: 'Disetujui', en: 'Approved' },
  ditolak: { id: 'Ditolak', en: 'Declined' },
}
export const OP_STAGE: Record<MarketOperation['stage'], Bi> = {
  recommended: { id: 'Diusulkan', en: 'Recommended' },
  approved: { id: 'Disetujui', en: 'Approved' },
  running: { id: 'Berjalan', en: 'Running' },
  done: { id: 'Selesai', en: 'Completed' },
  dismissed: { id: 'Ditolak', en: 'Dismissed' },
}
/** sector keys of the econ / Dinkop views (pack sector strings map onto these by keyword) */
export const SECTOR: Record<string, Bi> = {
  perdagangan: { id: 'Perdagangan', en: 'Trade' },
  makan: { id: 'Makan & minum', en: 'Food & drink' },
  industri: { id: 'Industri pengolahan', en: 'Manufacturing' },
  pertanian: { id: 'Pertanian', en: 'Agriculture' },
  jasa: { id: 'Jasa', en: 'Services' },
  lainnya: { id: 'Lainnya (digabung)', en: 'Other (merged)' },
}
export const PROGRAM_KIND: Record<'operasi-pasar' | 'modal', Bi> = {
  'operasi-pasar': { id: 'Operasi pasar', en: 'Market operation' },
  modal: { id: 'Modal kerja Koperasi', en: 'Cooperative working capital' },
}
/** score factor names + one plain-words line each (Rapor Usaha) */
export const SCORE_FACTOR: Record<ScoreFactor, { label: Bi; explain: Bi }> = {
  omzet: { label: { id: 'Kestabilan omzet', en: 'Turnover stability' }, explain: { id: 'Seberapa rata penjualan dari bulan ke bulan.', en: 'How even sales are month to month.' } },
  margin: { label: { id: 'Margin', en: 'Margin' }, explain: { id: 'Sisa untung dari setiap penjualan.', en: 'Profit left from each sale.' } },
  pajak: { label: { id: 'Kepatuhan pajak', en: 'Tax compliance' }, explain: { id: 'Jurnal rapi dan pajak siap dilaporkan.', en: 'Tidy journals and tax ready to file.' } },
  supplier: { label: { id: 'Bayar pemasok tepat waktu', en: 'Pays suppliers on time' }, explain: { id: 'Tagihan pemasok dibayar sebelum jatuh tempo.', en: 'Supplier invoices paid before they are due.' } },
  kyb: { label: { id: 'Verifikasi usaha', en: 'Business verification' }, explain: { id: 'Dokumen usaha sudah dicek Kenal Mitra.', en: 'Business documents checked by Kenal Mitra.' } },
  pertumbuhan: { label: { id: 'Pertumbuhan', en: 'Growth' }, explain: { id: 'Omzet tahun ini dibanding tahun lalu.', en: 'This year’s turnover vs last year.' } },
}
