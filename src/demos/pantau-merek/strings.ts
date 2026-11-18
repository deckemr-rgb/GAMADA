/**
 * demos/pantau-merek/strings.ts — first-screen strings (index, Pantauan, stream, KPI, charts, alert card) in ID and EN.
 * Lazy parts (Ulasan, bulk reply, cluster / announcement, Kompetitor, owner band) keep their strings next to them.
 */
import { useI18n } from '../../lib/i18n'

export type Lang = 'id' | 'en'
/** fill {key} placeholders */
export const fill = (s: string, v: Record<string, string | number>): string => s.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m))

const ID = {
  frame: 'Pantau Merek, monitoring reputasi',
  tabsLabel: 'Bagian Pantau Merek',
  tabPantauan: 'Pantauan',
  tabUlasan: 'Ulasan',
  tabKompetitor: 'Kompetitor',
  loading: 'Memuat…',
  notFound: 'Data tidak ditemukan',
  notFoundBody: 'Tautan menunjuk data yang tidak ada di dunia demo ini.',
  sim: 'simulasi',

  title: 'Reputasi {shop}',
  lead: 'Sebutan di marketplace, medsos, dan ulasan peta (akun fiktif), dibaca per menit dunia demo.',
  play: 'Jalankan pantauan',
  pause: 'Jeda pantauan',
  ahead30: 'Lihat 30 menit ke depan',
  staticHint: 'Jalankan jam untuk melihat sebutan baru masuk.',

  kpiLabel: 'Ringkasan reputasi',
  kpiRep: 'Skor reputasi',
  kpiRepCap: 'indeks 0–100 · 24 jam',
  kpiMentions: 'Sebutan 24 jam',
  kpiMentionsCap: 'tentang toko',
  kpiUnreplied: 'Keluhan belum dibalas',
  kpiUnrepliedCap: '7 hari terakhir',
  kpiMedian: 'Waktu balas median',
  kpiMedianCap: '30 hari terakhir',
  vsYesterday: 'vs kemarin',
  dur: (m: number) => (m >= 60 ? `${Math.floor(m / 60)} j ${m % 60} m` : `${m} m`),

  streamTitle: 'Aliran sebutan',
  streamMeta: 'terbaru di atas',
  streamFilter: 'Saring aliran',
  fAll: 'Semua',
  fShop: 'Toko',
  fNeg: 'Negatif',
  fComp: 'Pesaing',
  more: 'Muat {n} lagi',
  streamEmpty: 'Belum ada sebutan untuk saringan ini.',
  newMention: 'Sebutan baru dari {a}: {s}.',
  competitor: 'pesaing',
  category: 'kategori',
  inReply: 'menanggapi balasan',

  positif: 'Positif',
  netral: 'Netral',
  negatif: 'Negatif',
  stars: '{n} bintang',

  repTitle: 'Reputasi 24 jam',
  repUnit: 'indeks 0–100',
  repShop: 'Toko',
  repCat: 'Kategori',
  repSpike: 'Lonjakan {t}',
  repAnn: 'Pengumuman {t}',
  repSummary: 'Reputasi toko {a} pada {t0}, {b} sekarang; kategori {c}. Terendah {lo} pukul {tl}.',

  topicsTitle: 'Topik 24 jam',
  topicsSummary: 'Topik terbanyak: {t} ({n} sebutan, {d} dari 24 jam sebelumnya).',
  vsPrev: 'vs 24 jam sebelumnya',

  chTitle: 'Sentimen per kanal',
  chUnit: 'sebutan toko · 24 jam',
  chNet: 'net',
  chSummary: 'Paling negatif: {c} (net {n}). Paling positif: {p} (net {q}).',
  chLegend: 'positif · netral · negatif',

  preTitle: 'Sinyal awal',
  preBody: '{n} keluhan pengiriman sejak subuh (hujan semalam) · dipantau',
  preRule: 'Aturan lonjakan: ≥ {r} keluhan pengiriman dalam 2 jam (biasanya {b}).',
  jump: 'Lompat ke lonjakan',
  jumpHot: 'Mulai di sini',
  spark: 'Keluhan pengiriman per jam',

  alertTitle: 'Lonjakan keluhan pengiriman',
  alertMeta: 'terdeteksi {t} · {v} keluhan dalam 2 jam · +{p}% dari biasa',
  handle: 'Kelompokkan & tangani',
  handleHot: 'Tangani lonjakan',
  replyNow: 'Balas keluhan',
  handled: 'Ditangani {t}',
  handledBody: 'Pengumuman terbit ke {n} kanal; keluhan lanjutan berhenti.',
  showAnn: 'Lihat pengumuman',
  collapse: 'Ciutkan kartu',
  expand: 'Buka kartu',

  flood: 'Peringatan banjir level {l} aktif: Kec. {k} (Siaga Wilayah, otomatis)',
  floodLink: 'Lihat di Siaga Wilayah',

  scanned: 'pindai {t} · 5 kanal · {n} sebutan baru dalam 1 jam',
}
export type Strings = typeof ID

const EN: Strings = {
  frame: 'Pantau Merek, reputation monitoring',
  tabsLabel: 'Pantau Merek sections',
  tabPantauan: 'Monitor',
  tabUlasan: 'Reviews',
  tabKompetitor: 'Competitors',
  loading: 'Loading…',
  notFound: 'Item not found',
  notFoundBody: 'The link points to data that does not exist in this demo world.',
  sim: 'simulated',

  title: '{shop} reputation',
  lead: 'Mentions on marketplaces, social media and map reviews (fictional accounts), read every demo-world minute.',
  play: 'Run monitoring',
  pause: 'Pause monitoring',
  ahead30: 'See the next 30 minutes',
  staticHint: 'Run the clock to see new mentions arrive.',

  kpiLabel: 'Reputation summary',
  kpiRep: 'Reputation score',
  kpiRepCap: 'index 0–100 · 24 h',
  kpiMentions: 'Mentions, 24 h',
  kpiMentionsCap: 'about the shop',
  kpiUnreplied: 'Unanswered complaints',
  kpiUnrepliedCap: 'last 7 days',
  kpiMedian: 'Median reply time',
  kpiMedianCap: 'last 30 days',
  vsYesterday: 'vs yesterday',
  dur: (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} m` : `${m} m`),

  streamTitle: 'Mention stream',
  streamMeta: 'newest first',
  streamFilter: 'Filter the stream',
  fAll: 'All',
  fShop: 'Shop',
  fNeg: 'Negative',
  fComp: 'Competitors',
  more: 'Load {n} more',
  streamEmpty: 'No mentions for this filter yet.',
  newMention: 'New mention from {a}: {s}.',
  competitor: 'competitor',
  category: 'category',
  inReply: 'responding to a reply',

  positif: 'Positive',
  netral: 'Neutral',
  negatif: 'Negative',
  stars: '{n} stars',

  repTitle: 'Reputation, 24 h',
  repUnit: 'index 0–100',
  repShop: 'Shop',
  repCat: 'Category',
  repSpike: 'Spike {t}',
  repAnn: 'Notice {t}',
  repSummary: 'Shop reputation {a} at {t0}, {b} now; category {c}. Lowest {lo} at {tl}.',

  topicsTitle: 'Topics, 24 h',
  topicsSummary: 'Top topic: {t} ({n} mentions, {d} vs the previous 24 h).',
  vsPrev: 'vs previous 24 h',

  chTitle: 'Sentiment by channel',
  chUnit: 'shop mentions · 24 h',
  chNet: 'net',
  chSummary: 'Most negative: {c} (net {n}). Most positive: {p} (net {q}).',
  chLegend: 'positive · neutral · negative',

  preTitle: 'Early signal',
  preBody: '{n} delivery complaints since dawn (rain overnight) · watching',
  preRule: 'Spike rule: ≥ {r} delivery complaints within 2 h (usually {b}).',
  jump: 'Jump to the spike',
  jumpHot: 'Start here',
  spark: 'Delivery complaints per hour',

  alertTitle: 'Spike in delivery complaints',
  alertMeta: 'detected {t} · {v} complaints in 2 h · +{p}% over normal',
  handle: 'Group & handle',
  handleHot: 'Handle the spike',
  replyNow: 'Reply to complaints',
  handled: 'Handled {t}',
  handledBody: 'Notice published to {n} channels; follow-up complaints stopped.',
  showAnn: 'View the notice',
  collapse: 'Collapse card',
  expand: 'Expand card',

  flood: 'Flood warning level {l} active: {k} (Siaga Wilayah, automatic)',
  floodLink: 'View in Siaga Wilayah',

  scanned: 'scan {t} · 5 channels · {n} new mentions in 1 h',
}

export const STR: Record<Lang, Strings> = { id: ID, en: EN }

export function useStr(): { t: Strings; lang: Lang } {
  const { lang } = useI18n()
  return { t: STR[lang], lang }
}

/** "07.12" (ID) / "07:12" (EN) */
export const tm = (min: number, lang: Lang): string => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440
  const s = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  return lang === 'id' ? s.replace(':', '.') : s
}
export const nf = (n: number, lang: Lang): string => n.toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB')
export const signed = (n: number, lang: Lang): string => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${nf(Math.abs(n), lang)}`
