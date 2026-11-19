/**
 * demos/indeks-ekonomi/strings.ts — the strings of the always-loaded part (frame, tabs, roles, KPI strip, flood strip)
 * and the number / month formatters every chunk shares. Each lazy tab keeps its own strings in its file.
 */
import { useI18n } from '../../lib/i18n'

export const SLUG = 'indeks-ekonomi'
export type Lang = 'id' | 'en'
export type TabId = 'ringkasan' | 'peta' | 'sektor' | 'harga' | 'dampak' | 'briefing'
export type IeRole = 'bappeda' | 'dinkop' | 'kepala-daerah'

const id = {
  product: 'Indeks Ekonomi Daerah',
  tabsLabel: 'Bagian Indeks Ekonomi Daerah',
  tabs: { ringkasan: 'Ringkasan', peta: 'Peta', sektor: 'Sektor', harga: 'Harga', dampak: 'Dampak', briefing: 'Briefing' } as Record<TabId, string>,
  more: 'Bagian lain',
  askAi: 'Tanya ekonom',
  loading: 'Memuat…',
  notFound: 'Data tidak ditemukan',
  notFoundBody: 'Tautan menunjuk data yang tidak ada di dunia demo ini.',
  sim: 'simulasi',
  kpiLabel: 'Ringkasan ekonomi kabupaten (simulasi)',
  kpiIndex: (m: string) => `Indeks kabupaten ${m}`,
  kpiIndexCap: 'sementara · 100 = rata-rata 12 bulan',
  kpiOmzet: (m: string) => `Omzet UMKM ${m}`,
  kpiHidden: 'Kecamatan disembunyikan',
  kpiHiddenCap: 'anonimitas: < 10 usaha',
  kpiTx: 'Transaksi tercatat hari ini',
  kpiTxRp: (v: string, n: number) => `${v} · ${n} usaha di panel`,
  kpiTxHidden: (n: number) => `Rp disembunyikan: baru ${n} usaha di panel (ambang 10)`,
  vsPrev: 'vs bulan lalu',
  noFlood: 'Belum ada peringatan banjir.',
  playFlood: 'Putar skenario banjir (dari Siaga Wilayah)',
  floodOn: (n: number) => `Peringatan banjir aktif · ${n} kecamatan`,
  floodSee: 'Lihat dampak',
  instructed: (code: string) => `Instruksi ${code} terkirim`,
  instructedBody: 'Diteruskan ke Meja Pimpinan; Naskah Pintar menyiapkan suratnya.',
  openMeja: 'Buka di Meja Pimpinan',
  roleNote: { bappeda: 'Bappeda', dinkop: 'Dinas Koperasi & UMKM', 'kepala-daerah': 'Kepala Daerah' } as Record<IeRole, string>,
}
type Dict = typeof id
const en: Dict = {
  product: 'Regional Economic Index',
  tabsLabel: 'Regional Economic Index sections',
  tabs: { ringkasan: 'Summary', peta: 'Map', sektor: 'Sectors', harga: 'Prices', dampak: 'Impact', briefing: 'Briefing' },
  more: 'More sections',
  askAi: 'Ask the economist',
  loading: 'Loading…',
  notFound: 'Item not found',
  notFoundBody: 'The link points to data that does not exist in this demo world.',
  sim: 'simulated',
  kpiLabel: 'Regency economy at a glance (simulated)',
  kpiIndex: (m) => `Regency index ${m}`,
  kpiIndexCap: 'provisional · 100 = 12-month mean',
  kpiOmzet: (m) => `MSME turnover ${m}`,
  kpiHidden: 'Districts hidden',
  kpiHiddenCap: 'anonymity: < 10 businesses',
  kpiTx: 'Transactions recorded today',
  kpiTxRp: (v, n) => `${v} · ${n} businesses in the panel`,
  kpiTxHidden: (n) => `Rp hidden: only ${n} businesses in the panel (threshold 10)`,
  vsPrev: 'vs last month',
  noFlood: 'No flood warning yet.',
  playFlood: 'Play the flood scenario (from Siaga Wilayah)',
  floodOn: (n) => `Flood warning active · ${n} districts`,
  floodSee: 'See the impact',
  instructed: (code) => `Instruction ${code} sent`,
  instructedBody: 'Forwarded to Meja Pimpinan; Naskah Pintar prepares the letter.',
  openMeja: 'Open in Meja Pimpinan',
  roleNote: { bappeda: 'Bappeda', dinkop: 'Cooperatives & MSME Office', 'kepala-daerah': 'Regional Head' },
}
export const STRINGS: Record<Lang, Dict> = { id, en }

export function useT(): { t: Dict; lang: Lang } {
  const { lang } = useI18n()
  return { t: STRINGS[lang], lang }
}

/** number in the page language (id: 1.234,5 · en: 1,234.5) */
export const nf = (lang: Lang, n: number, digits = 0): string =>
  n.toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits })
/** signed with a real minus sign: +1,2 / −3,4 */
export const sgn = (lang: Lang, n: number, digits = 1): string => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${nf(lang, Math.abs(n), digits)}`
/** Rp in short words: Rp 12,4 M / Rp 850 jt (id) · Rp 12.4 bn / Rp 850 m (en) */
export function rpShort(lang: Lang, n: number): string {
  const a = Math.abs(n)
  if (a >= 1e12) return `Rp ${nf(lang, n / 1e12, 1)} ${lang === 'id' ? 'T' : 'tn'}`
  if (a >= 1e9) return `Rp ${nf(lang, n / 1e9, 1)} ${lang === 'id' ? 'M' : 'bn'}`
  if (a >= 1e6) return `Rp ${nf(lang, n / 1e6, 1)} ${lang === 'id' ? 'jt' : 'm'}`
  return `Rp ${nf(lang, n)}`
}
const mDate = (ym: string) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 15)
/** 'YYYY-MM' → "Juni 2026" / "June 2026" */
export const monthLabel = (lang: Lang, ym: string): string => mDate(ym).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { month: 'long', year: 'numeric' })
/** 'YYYY-MM' → "Jun" */
export const monthShort = (lang: Lang, ym: string): string => mDate(ym).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { month: 'short' }).replace('.', '')
