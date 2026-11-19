/**
 * demos/sinyal-pasar/strings.ts — strings of the Disperindag desk (frame, tabs, ticker, KPI, board, region cards) and
 * the number helpers every chunk shares. Lazy chunks (drawer, Operasi, Peta, Langganan, UMKM side, AI) keep their own
 * strings. All prices and effects are SIMULATED; there is no official reference price (§6 P3).
 */
import { useI18n } from '../../lib/i18n'
import type { Bi } from '../../demo-kit/world'

export const SLUG = 'sinyal-pasar'
export type Lang = 'id' | 'en'

/** "+3,4%" / "−2.1%" */
export const pct = (v: number, lang: Lang, d = 1): string => {
  const n = Math.abs(v).toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB', { minimumFractionDigits: d, maximumFractionDigits: d })
  return `${v > 0 ? '+' : v < 0 ? '−' : '±'}${n}%`
}
export const rp = (n: number): string => 'Rp ' + Math.round(n).toLocaleString('id-ID')
export const num = (n: number, lang: Lang, d = 0): string => n.toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB', { maximumFractionDigits: d })
/** world time as people read it: "07.06" (id) / "07:06" (en) */
export const tm = (hhmm: string, lang: Lang): string => (lang === 'id' ? hhmm.replace(':', '.') : hhmm)
export const bi = (b: Bi | undefined, lang: Lang): string => (b ? b[lang] : '')

const id = {
  product: 'Sinyal Pasar',
  frameLabel: 'Sinyal Pasar · Disperindag',
  tabsLabel: 'Bagian Sinyal Pasar',
  tabs: { ringkasan: 'Ringkasan', peta: 'Peta', operasi: 'Operasi Pasar', langganan: 'Langganan' },
  askAi: 'Tanya Sinyal Pasar',
  loading: 'Memuat…',
  sim: 'Data simulasi',
  // ticker
  tickerLabel: 'Harga pasar berjalan (simulasi)',
  tickerPause: 'Jeda harga berjalan',
  tickerPlay: 'Jalankan harga berjalan',
  weekShort: '7 hr',
  lastTick: 'Pembaruan',
  lastTickText: (time: string, market: string, item: string, price: string, w: string) => `${time} · ${item} di ${market} ${price} (${w} 7 hari)`,
  // KPI
  kpiLabel: 'Ringkasan pemantauan harga (simulasi)',
  kpi: { commodities: 'Komoditas dipantau', markets: 'Pasar', anomalies: 'Anomali aktif', warnings: 'Peringatan dini', subscribers: 'Pelanggan UMKM' },
  kpiCap: { anomalies: 'di luar pola musiman', warnings: 'hari ini', subscribers: 'jumlah saja, tanpa nama' },
  // board
  boardTitle: 'Papan harga',
  boardLead: 'Diurutkan menurut selisih dari pola musiman (bukan harga acuan resmi).',
  allCommodities: 'Semua',
  commodityPick: 'Pilih komoditas',
  marketPick: 'Pilih pasar',
  allMarkets: 'Semua pasar',
  cols: { item: 'Komoditas · pasar', price: 'Harga', week: '7 hari', delta: 'vs musiman', trend: 'Tren 14 hari', status: 'Status' },
  anomaly: 'Anomali',
  warning: 'Peringatan',
  normal: 'Normal',
  showAll: (n: number) => `Tampilkan semua (${n})`,
  showLess: 'Tampilkan 12 teratas',
  rowOpen: (item: string, market: string) => `Buka detail ${item} di ${market}`,
  sparkLabel: (item: string) => `Harga ${item} 14 hari`,
  emptyBoard: 'Tidak ada harga untuk pilihan ini.',
  perUnit: (u: string) => `/${u}`,
  // region card
  regionTitle: 'Kejadian di daerah',
  noFlood: 'Belum ada peringatan banjir.',
  playFlood: 'Putar skenario banjir (dari Siaga Wilayah)',
  autoFlood: (t: string) => `Skenario banjir berjalan sendiri pukul ${t} (simulasi).`,
  floodOn: (title: string, t: string) => `${title} · sejak ${t}`,
  floodMarkets: (n: number, list: string) => `Pasokan ${n} pasar terganggu: ${list}.`,
  openSiaga: 'Lihat di Siaga Wilayah',
  // warning card
  warnTitle: 'Peringatan dini',
  warnText: (item: string, p: string, days: number, market: string) => `${item}: puncak diperkirakan ${p} dalam ${days} hari (${market})`,
  warnMeta: (t: string, n: number) => `Dibuat ${t} · ${n} pasar terdampak · proyeksi`,
  warnNone: 'Belum ada peringatan dini hari ini.',
  openDetail: 'Buka detail',
  // anomaly card
  anomTitle: 'Anomali harga',
  anomText: (item: string, market: string, p: string) => `${item} di ${market} ${p} di atas pola musiman`,
  anomMeta: (price: string, t: string) => `${price} · tercatat ${t} · simulasi`,
  anomNone: 'Belum ada anomali. Harga masih di dalam pola musiman.',
  hotspot: 'Mulai di sini: buka anomali harga',
  hotFlood: 'Mulai di sini: putar skenario banjir',
  hotWarn: 'Lanjut: buka peringatan dini',
  // toasts
  toastAnom: (item: string, market: string, p: string) => `Harga ${item} di ${market} ${p} di atas pola saat terdeteksi`,
  toastAnomBody: 'Buka detail untuk prakiraan 14 hari dan tindakan.',
  toastWarn: (item: string, p: string, d: number) => `Peringatan dini: ${item} diperkirakan ${p} dalam ${d} hari`,
  toastApproved: (item: string) => `Operasi pasar ${item} disetujui (simulasi)`,
  toastApprovedBody: 'Mulai operasi di tab Operasi Pasar.',
  toOperasi: 'Buka Operasi Pasar',
  notFound: 'Data tidak ditemukan',
  notFoundBody: 'Tautan menunjuk data yang tidak ada di dunia demo ini.',
}
export type Strings = typeof id

const en: Strings = {
  product: 'Sinyal Pasar',
  frameLabel: 'Sinyal Pasar · Trade Office',
  tabsLabel: 'Sinyal Pasar sections',
  tabs: { ringkasan: 'Overview', peta: 'Map', operasi: 'Market operations', langganan: 'Subscriptions' },
  askAi: 'Ask Sinyal Pasar',
  loading: 'Loading…',
  sim: 'Simulated data',
  tickerLabel: 'Running market prices (simulated)',
  tickerPause: 'Pause the running prices',
  tickerPlay: 'Run the running prices',
  weekShort: '7 d',
  lastTick: 'Update',
  lastTickText: (time, market, item, price, w) => `${time} · ${item} at ${market} ${price} (${w} over 7 days)`,
  kpiLabel: 'Price monitoring summary (simulated)',
  kpi: { commodities: 'Commodities watched', markets: 'Markets', anomalies: 'Active anomalies', warnings: 'Early warnings', subscribers: 'UMKM subscribers' },
  kpiCap: { anomalies: 'outside the seasonal pattern', warnings: 'today', subscribers: 'count only, no names' },
  boardTitle: 'Price board',
  boardLead: 'Sorted by the gap to the seasonal pattern (not an official reference price).',
  allCommodities: 'All',
  commodityPick: 'Choose a commodity',
  marketPick: 'Choose a market',
  allMarkets: 'All markets',
  cols: { item: 'Commodity · market', price: 'Price', week: '7 days', delta: 'vs seasonal', trend: '14-day trend', status: 'Status' },
  anomaly: 'Anomaly',
  warning: 'Warning',
  normal: 'Normal',
  showAll: (n) => `Show all (${n})`,
  showLess: 'Show the top 12',
  rowOpen: (item, market) => `Open details of ${item} at ${market}`,
  sparkLabel: (item) => `${item} price, 14 days`,
  emptyBoard: 'No prices for this choice.',
  perUnit: (u) => `/${u}`,
  regionTitle: 'Events in the region',
  noFlood: 'No flood warning yet.',
  playFlood: 'Play the flood scenario (from Siaga Wilayah)',
  autoFlood: (t) => `The flood scenario starts by itself at ${t} (simulated).`,
  floodOn: (title, t) => `${title} · since ${t}`,
  floodMarkets: (n, list) => `Supply disrupted at ${n} markets: ${list}.`,
  openSiaga: 'View in Siaga Wilayah',
  warnTitle: 'Early warning',
  warnText: (item, p, days, market) => `${item}: peak expected ${p} within ${days} days (${market})`,
  warnMeta: (t, n) => `Issued ${t} · ${n} markets affected · projection`,
  warnNone: 'No early warning today yet.',
  openDetail: 'Open details',
  anomTitle: 'Price anomaly',
  anomText: (item, market, p) => `${item} at ${market} ${p} above the seasonal pattern`,
  anomMeta: (price, t) => `${price} · recorded ${t} · simulated`,
  anomNone: 'No anomaly yet. Prices are inside their seasonal pattern.',
  hotspot: 'Start here: open the price anomaly',
  hotFlood: 'Start here: play the flood scenario',
  hotWarn: 'Next: open the early warning',
  toastAnom: (item, market, p) => `${item} at ${market} ${p} above its pattern when detected`,
  toastAnomBody: 'Open the details for the 14-day forecast and actions.',
  toastWarn: (item, p, d) => `Early warning: ${item} expected ${p} within ${d} days`,
  toastApproved: (item) => `${item} market operation approved (simulated)`,
  toastApprovedBody: 'Start the operation in the Market operations tab.',
  toOperasi: 'Open Market operations',
  notFound: 'Item not found',
  notFoundBody: 'The link points to data that does not exist in this demo world.',
}

export const STRINGS = { id, en }
export function useT(): { t: Strings; lang: Lang } {
  const { lang } = useI18n()
  return { t: STRINGS[lang], lang }
}
