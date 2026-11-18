/**
 * demos/toko-autopilot/strings.ts — the strings of the always-loaded part (frame, tabs, roles, Dasbor, Kasir). Each
 * lazy tab keeps its own strings in its file. Templated strings are functions so the numbers stay in one place.
 */
import { useI18n } from '../../lib/i18n'
import { hhmm } from '../../demo-kit/world'

export const SLUG = 'toko-autopilot'
export type Lang = 'id' | 'en'
export type TabId = 'dasbor' | 'kasir' | 'prediksi' | 'po' | 'harga' | 'shift'
export type OutKey = 'semua' | 'toko' | 'kopi' | 'warung'

const id = {
  product: 'Toko Autopilot',
  tabsLabel: 'Bagian Toko Autopilot',
  tabs: { dasbor: 'Dasbor', kasir: 'Kasir', prediksi: 'Prediksi', po: 'PO', harga: 'Harga & Promo', shift: 'Jadwal Shift' } as Record<TabId, string>,
  outletLabel: 'Pilih outlet',
  outlets: { semua: 'Semua', toko: 'Toko', kopi: 'Kedai Kopi', warung: 'Warung' } as Record<OutKey, string>,
  sim: 'Data simulasi',
  askAi: 'Tanya AI',
  loading: 'Memuat…',
  notFound: 'Data tidak ditemukan',
  notFoundBody: 'Tautan menunjuk data yang tidak ada di dunia demo ini.',
  arrived: 'Dibuka dari notifikasi produk lain',
  // KPI
  kpiLabel: 'Ringkasan penjualan hari ini (simulasi)',
  kpiOmzet: 'Omzet hari ini',
  kpiTx: 'Transaksi',
  kpiAvg: 'Rata-rata struk',
  kpiMargin: 'Margin kotor',
  vsYday: 'vs kemarin jam ini',
  monthCap: (v: string) => `Bulan ini ${v} · simulasi`,
  sparkLabel: 'Omzet per jam hari ini',
  // feed
  feedTitle: 'Transaksi masuk',
  feedEmpty: 'Belum ada transaksi pada outlet ini hari ini.',
  feedRow: (code: string, n: number) => `${code} · ${n} barang`,
  feedNew: (code: string, total: string) => `Transaksi baru ${code}, ${total}`,
  pay: { tunai: 'Tunai', qris: 'QRIS', transfer: 'Transfer' } as Record<string, string>,
  // attention
  attnTitle: 'Perlu perhatian',
  attnLow: (n: number) => `${n} barang di bawah titik pesan ulang`,
  attnDraft: (n: number) => `${n} draf PO menunggu persetujuan`,
  attnPeak: (h: string, n: number) => `Jam sibuk berikutnya ${h} (±${n} pembeli, simulasi)`,
  attnNoPeak: 'Tidak ada jam sibuk lagi hari ini',
  // region
  regionTitle: 'Kejadian di daerah',
  noFlood: 'Belum ada peringatan banjir.',
  playFlood: 'Putar skenario banjir (dari Siaga Wilayah)',
  floodWait: (title: string) => `${title} · prediksi permintaan sedang dihitung ulang…`,
  toForecast: 'Lihat di Prediksi',
  oppTitle: (qty: string, item: string, kec: string, stock: string) => `Kebutuhan Pemda: ${qty} ${item} · Kec. ${kec} · stok Anda ${stock}`,
  oppSoon: 'Katalog Lokal (demo tahap 4)',
  oppOpen: 'Buka di Katalog Lokal',
  brandChip: (pct: number) => `Keluhan pengiriman +${pct}%`,
  brandSoon: '(Pantau Merek, demo tahap 3)',
  // receipt drawer
  receiptTitle: (code: string) => `Struk ${code}`,
  // roles
  kasirShift: (d: string, a: string, b: string) => `Shift Anda: ${d} ${a}–${b} (hanya baca)`,
  supplierTitle: 'Pesanan masuk',
  days: ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'],
}
type Strings = typeof id

const en: Strings = {
  product: 'Toko Autopilot',
  tabsLabel: 'Toko Autopilot sections',
  tabs: { dasbor: 'Dashboard', kasir: 'Checkout', prediksi: 'Forecast', po: 'POs', harga: 'Prices & Promos', shift: 'Shift Schedule' },
  outletLabel: 'Choose outlet',
  outlets: { semua: 'All', toko: 'Shop', kopi: 'Coffee bar', warung: 'Eatery' },
  sim: 'Simulated data',
  askAi: 'Ask AI',
  loading: 'Loading…',
  notFound: 'Item not found',
  notFoundBody: 'The link points to data that does not exist in this demo world.',
  arrived: 'Opened from another product’s notification',
  kpiLabel: 'Today’s sales summary (simulated)',
  kpiOmzet: 'Revenue today',
  kpiTx: 'Transactions',
  kpiAvg: 'Average ticket',
  kpiMargin: 'Gross margin',
  vsYday: 'vs this time yesterday',
  monthCap: (v) => `This month ${v} · simulated`,
  sparkLabel: 'Revenue per hour today',
  feedTitle: 'Incoming transactions',
  feedEmpty: 'No transactions at this outlet today yet.',
  feedRow: (code, n) => `${code} · ${n} items`,
  feedNew: (code, total) => `New transaction ${code}, ${total}`,
  pay: { tunai: 'Cash', qris: 'QRIS', transfer: 'Transfer' },
  attnTitle: 'Needs attention',
  attnLow: (n) => `${n} items below the reorder point`,
  attnDraft: (n) => `${n} draft POs awaiting approval`,
  attnPeak: (h, n) => `Next peak hour ${h} (±${n} customers, simulated)`,
  attnNoPeak: 'No more peak hours today',
  regionTitle: 'Events in the region',
  noFlood: 'No flood warning yet.',
  playFlood: 'Play the flood scenario (from Siaga Wilayah)',
  floodWait: (title) => `${title} · demand forecast is being recalculated…`,
  toForecast: 'See in Forecast',
  oppTitle: (qty, item, kec, stock) => `Government need: ${qty} ${item} · ${kec} district · your stock ${stock}`,
  oppSoon: 'Katalog Lokal (stage 4 demo)',
  oppOpen: 'Open in Katalog Lokal',
  brandChip: (pct) => `Delivery complaints +${pct}%`,
  brandSoon: '(Pantau Merek, stage 3 demo)',
  receiptTitle: (code) => `Receipt ${code}`,
  kasirShift: (d, a, b) => `Your shift: ${d} ${a}–${b} (read-only)`,
  supplierTitle: 'Incoming orders',
  days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
}

export const STRINGS: Record<Lang, Strings> = { id, en }
export type { Strings }

export function useT(): { t: Strings; lang: Lang } {
  const { lang } = useI18n()
  return { t: STRINGS[lang], lang }
}

/** "07.05" in Indonesian, "07:05" in English */
export const tm = (hhmm: string, lang: Lang) => (lang === 'id' ? hhmm.replace(':', '.') : hhmm)
export const nf = (n: number, lang: Lang) => n.toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB')
export const rp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')
export const pct = (r: number, d = 0, lang: Lang = 'id') => `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r * 100).toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB', { maximumFractionDigits: d, minimumFractionDigits: d })}%`
/** world minutes → "07.05" (ID) / "07:05" (EN) */
export const hhmmL = (m: number, lang: Lang) => tm(hhmm(m), lang)
/** a past world minute with its day: "07.05", "kemarin 12.37", "3 hari lalu 08.02" */
export const whenL = (m: number, lang: Lang) => {
  const d = Math.floor(m / 1440)
  const day = d >= 0 ? '' : d === -1 ? (lang === 'id' ? 'kemarin ' : 'yesterday ') : lang === 'id' ? `${-d} hari lalu ` : `${-d} days ago `
  return day + hhmmL(m, lang)
}
