/**
 * demos/radar-isu/strings.ts — core bilingual strings of Radar Isu (index, Pantauan Live, hoax card, topic drawer).
 * Lazy screens (Deep, Report, Clarify, Assistant) keep their own strings next to them, so the first screen does not
 * carry them. Every visible string exists in Indonesian and English.
 */
import { useI18n } from '../../lib/i18n'
import type { Bi } from '../../demo-kit/world'

export type Lang = 'id' | 'en'

/** fill {key} placeholders */
export const fill = (s: string, v: Record<string, string | number>): string => s.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m))

const ID = {
  frame: 'Radar Isu, intelijen opini publik',
  tabsLabel: 'Bagian Radar Isu',
  tabLive: 'Pantauan Live',
  tabDeep: 'Analisis Mendalam',
  tabReport: 'Laporan',
  loadingTab: 'Memuat…',

  // header
  liveTitle: 'Isu dan hoaks terbaca sebelum viral',
  liveLead: 'Berita dan media sosial fiktif tentang {r}, dinilai sentimennya dan diperiksa silang dengan data produk lain.',
  clockPaused: 'Jam dunia dijeda',
  clockPlay: 'Jalankan pantauan',
  clockRunning: 'Pantauan berjalan · ×{x}',
  askAi: 'Tanya analis AI',

  // KPIs
  kpiLabel: 'Ringkasan 24 jam terakhir',
  kpiMentions: 'Mention 24 jam',
  kpiSentiment: 'Indeks sentimen',
  kpiSentimentCap: '−100 sangat negatif · +100 sangat positif',
  kpiNegative: 'Isu negatif',
  kpiNegativeCap: 'topik dengan mention negatif',
  kpiReach: 'Perkiraan jangkauan',
  kpiReachCap: 'akun (simulasi)',
  vsPrev: 'vs 24 jam sebelumnya',
  vsPrevShort: 'vs kemarin',

  // stream
  streamTitle: 'Aliran mention',
  streamMeta: 'media & akun fiktif',
  filterLabel: 'Saring aliran',
  fAll: 'Semua',
  fNews: 'Berita',
  fSocial: 'Medsos',
  fNeg: 'Negatif',
  streamEmpty: 'Belum ada mention untuk saringan ini.',
  streamEmptyCta: 'Tampilkan semua',
  kindBerita: 'Berita',
  kindSosmed: 'Medsos',
  kindForum: 'Forum',
  reach: 'jangkauan {n}',
  rumorTag: 'Narasi mencurigakan',
  hoaxTag: 'Hoaks',
  clarTag: 'Terkait klarifikasi',
  assess: 'Nilai dengan AI',
  newMention: 'Mention baru dari {o}, {s}.',
  streamKeys: 'Panah atas/bawah untuk berpindah antar-mention.',

  // sentiment words
  positif: 'Positif',
  netral: 'Netral',
  negatif: 'Negatif',

  // charts
  bubblesTitle: 'Klaster topik 24 jam',
  bubblesUnit: 'ukuran = volume · warna = sentimen',
  bubblesHint: 'Klik gelembung untuk membuka klasternya',
  sentTitle: 'Sentimen 24 jam',
  sentTitle3: 'Sentimen 3 jam terakhir',
  sentRange: 'Rentang grafik sentimen',
  r24: '24 jam',
  r3: '3 jam',
  sentUnit: 'indeks −100…100 · 0 = netral · tertimbang jangkauan',
  sentSeries: 'Indeks sentimen',
  markHoax: 'Hoaks terdeteksi',
  markClar: 'Klarifikasi terbit',
  markNow: 'Sekarang',

  // hoax card
  hoaxTitle: 'Peringatan Hoaks',
  idleTitle: 'Belum ada narasi palsu terdeteksi',
  idleBody: 'Radar memeriksa setiap lonjakan narasi terhadap data Siaga Wilayah dan Sapa Warga.',
  idleAuto: 'Skenario berjalan sendiri pukul 10.00 bila jam dunia diputar.',
  trigger: 'Picu skenario “{dam} jebol”',
  triggerShort: 'Picu hoaks {dam}',
  burstTitle: 'Narasi mencurigakan menyebar',
  burstBody: '{n} unggahan tentang “{dam} jebol” dalam {m} menit. Ambang deteksi: {k} unggahan.',
  burstLive: 'Memeriksa bukti di Siaga Wilayah…',
  detected: 'Hoaks terdeteksi',
  score: 'Kemungkinan hoaks (%)',
  spread: 'Kecepatan sebar',
  spreadUnit: 'jangkauan / jam',
  spreadChart: 'Jangkauan kumulatif narasi',
  accounts: 'Akun penyebar awal',
  accountsNote: 'akun fiktif · bukan untuk dilaporkan, cukup diluruskan',
  evidence: 'Bukti pembanding',
  evidenceSrc: 'Siaga Wilayah · pos pantau {dam}',
  evidenceText: 'Tinggi muka air {dam} {level} m, di bawah batas siaga {siaga} m (data simulasi). Tidak ada laporan kerusakan bendungan.',
  gaugeNow: 'Tinggi muka air',
  gaugeSiaga: 'batas siaga',
  gaugeChart: 'Tinggi muka air 24 jam (m, simulasi)',
  clarify: 'Susun klarifikasi',
  review: 'Tinjau & setujui draf',
  instruct: 'Perintahkan klarifikasi ke Diskominfo',
  instructed: 'Instruksi terkirim ke Diskominfo',
  instructText: 'Terbitkan klarifikasi resmi hoaks “{claim}” hari ini, sertakan data tinggi muka air.',
  clarified: 'Diklarifikasi pukul {t}',
  clarifiedTone: 'Nada {tone} · {ch}',
  recovery: 'Pemulihan sentimen',
  recoveryBody: 'Mention positif masuk bertahap selama 30 menit dunia setelah terbit.',
  recoveryDone: 'Sentimen pulih: {a} → {b}.',
  skip30: 'Lihat 30 menit ke depan',
  hoaxVolume: 'Unggahan hoaks baru sejak klarifikasi: {n}',
  forwardedMp: 'Diteruskan ke Meja Pimpinan',
  openMp: 'Lihat di Meja Pimpinan',
  openSiaga: 'Buka peta banjir di Siaga Wilayah',

  tone_tegas: 'tegas',
  tone_menenangkan: 'menenangkan',
  tone_informatif: 'informatif',

  // executive (kepala daerah)
  execTitle: 'Ringkasan untuk pimpinan',
  execSent: 'Sentimen publik saat ini {v} ({w}).',
  execTop: 'Isu negatif terbesar: {t} ({n} mention negatif).',
  execHoaxOn: 'Hoaks aktif: “{c}”. Perlu klarifikasi resmi.',
  execHoaxDone: 'Hoaks “{c}” sudah diklarifikasi pukul {t}.',
  execHoaxNone: 'Tidak ada hoaks aktif.',
  wBaik: 'cenderung positif',
  wNetral: 'netral',
  wBuruk: 'cenderung negatif',

  // topic drawer
  topicEyebrow: 'Klaster topik',
  topicStats: '{n} mention 24 jam · jangkauan {r} · sentimen {s}',
  topicMentions: 'Mention dalam klaster',
  topicDeep: 'Analisis mendalam topik ini',
  topicAsk: 'Tanya AI tentang topik ini',
  topicBiggest: 'Klaster terbesar hari ini',

  // misc
  simulated: 'Data simulasi',
  simNote: 'Semua media, akun, dan angka di layar ini fiktif (simulasi).',
  liveNews: 'Mention baru',
}

export type Strings = typeof ID

const EN: Strings = {
  frame: 'Radar Isu, public opinion intelligence',
  tabsLabel: 'Radar Isu sections',
  tabLive: 'Live Monitor',
  tabDeep: 'Deep Analysis',
  tabReport: 'Report',
  loadingTab: 'Loading…',

  liveTitle: 'Issues and hoaxes caught before they go viral',
  liveLead: 'Fictional news and social posts about {r}, scored for sentiment and cross-checked against other products’ data.',
  clockPaused: 'World clock paused',
  clockPlay: 'Run the monitor',
  clockRunning: 'Monitor running · ×{x}',
  askAi: 'Ask the AI analyst',

  kpiLabel: 'Last 24 hours',
  kpiMentions: 'Mentions, 24 h',
  kpiSentiment: 'Sentiment index',
  kpiSentimentCap: '−100 very negative · +100 very positive',
  kpiNegative: 'Negative issues',
  kpiNegativeCap: 'topics with negative mentions',
  kpiReach: 'Estimated reach',
  kpiReachCap: 'accounts (simulated)',
  vsPrev: 'vs previous 24 h',
  vsPrevShort: 'vs yesterday',

  streamTitle: 'Mention stream',
  streamMeta: 'fictional outlets & accounts',
  filterLabel: 'Filter the stream',
  fAll: 'All',
  fNews: 'News',
  fSocial: 'Social',
  fNeg: 'Negative',
  streamEmpty: 'No mentions for this filter yet.',
  streamEmptyCta: 'Show all',
  kindBerita: 'News',
  kindSosmed: 'Social',
  kindForum: 'Forum',
  reach: 'reach {n}',
  rumorTag: 'Suspicious narrative',
  hoaxTag: 'Hoax',
  clarTag: 'About the clarification',
  assess: 'Assess with AI',
  newMention: 'New mention from {o}, {s}.',
  streamKeys: 'Arrow up/down moves between mentions.',

  positif: 'Positive',
  netral: 'Neutral',
  negatif: 'Negative',

  bubblesTitle: 'Topic clusters, 24 h',
  bubblesUnit: 'size = volume · colour = sentiment',
  bubblesHint: 'Click a bubble to open its cluster',
  sentTitle: 'Sentiment, 24 h',
  sentTitle3: 'Sentiment, last 3 h',
  sentRange: 'Sentiment chart range',
  r24: '24 h',
  r3: '3 h',
  sentUnit: 'index −100…100 · 0 = neutral · reach-weighted',
  sentSeries: 'Sentiment index',
  markHoax: 'Hoax detected',
  markClar: 'Clarification out',
  markNow: 'Now',

  hoaxTitle: 'Hoax Alert',
  idleTitle: 'No false narrative detected yet',
  idleBody: 'The radar checks every narrative spike against Siaga Wilayah and Sapa Warga data.',
  idleAuto: 'The scenario starts by itself at 10:00 when the world clock runs.',
  trigger: 'Trigger the “{dam} burst” scenario',
  triggerShort: 'Trigger the {dam} hoax',
  burstTitle: 'Suspicious narrative spreading',
  burstBody: '{n} posts about “{dam} burst” within {m} minutes. Detection threshold: {k} posts.',
  burstLive: 'Checking evidence in Siaga Wilayah…',
  detected: 'Hoax detected',
  score: 'Hoax likelihood (%)',
  spread: 'Spread rate',
  spreadUnit: 'reach / hour',
  spreadChart: 'Cumulative reach of the narrative',
  accounts: 'First spreading accounts',
  accountsNote: 'fictional accounts · to be corrected, not reported',
  evidence: 'Counter-evidence',
  evidenceSrc: 'Siaga Wilayah · {dam} gauge',
  evidenceText: '{dam} water level {level} m, below the {siaga} m alert level (simulated data). No dam damage reported.',
  gaugeNow: 'Water level',
  gaugeSiaga: 'alert level',
  gaugeChart: 'Water level, 24 h (m, simulated)',
  clarify: 'Draft a clarification',
  review: 'Review & approve the draft',
  instruct: 'Instruct the Comms Office to clarify',
  instructed: 'Instruction sent to the Comms Office',
  instructText: 'Publish an official clarification of the “{claim}” hoax today, including the water level data.',
  clarified: 'Clarified at {t}',
  clarifiedTone: '{tone} tone · {ch}',
  recovery: 'Sentiment recovery',
  recoveryBody: 'Positive mentions arrive over the 30 world minutes after publishing.',
  recoveryDone: 'Sentiment recovered: {a} → {b}.',
  skip30: 'Jump 30 minutes ahead',
  hoaxVolume: 'New hoax posts since the clarification: {n}',
  forwardedMp: 'Forwarded to Meja Pimpinan',
  openMp: 'View in Meja Pimpinan',
  openSiaga: 'Open the flood map in Siaga Wilayah',

  tone_tegas: 'firm',
  tone_menenangkan: 'reassuring',
  tone_informatif: 'informative',

  execTitle: 'Summary for the Regional Head',
  execSent: 'Public sentiment is {v} right now ({w}).',
  execTop: 'Biggest negative issue: {t} ({n} negative mentions).',
  execHoaxOn: 'Active hoax: “{c}”. An official clarification is needed.',
  execHoaxDone: 'The “{c}” hoax was clarified at {t}.',
  execHoaxNone: 'No active hoax.',
  wBaik: 'leaning positive',
  wNetral: 'neutral',
  wBuruk: 'leaning negative',

  topicEyebrow: 'Topic cluster',
  topicStats: '{n} mentions in 24 h · reach {r} · sentiment {s}',
  topicMentions: 'Mentions in the cluster',
  topicDeep: 'Deep-analyse this topic',
  topicAsk: 'Ask the AI about this topic',
  topicBiggest: 'Biggest cluster today',

  simulated: 'Simulated data',
  simNote: 'Every outlet, account and number on this screen is fictional (simulated).',
  liveNews: 'New mentions',
}

export const STR: Record<Lang, Strings> = { id: ID, en: EN }

export function useStr(): { t: Strings; lang: Lang } {
  const { lang } = useI18n()
  return { t: STR[lang], lang }
}

/** topic keys of the world (MENTION_TEXT, scenario texts) → bilingual names */
export const TOPIC: Record<string, Bi> = {
  layanan: { id: 'Layanan publik', en: 'Public services' },
  jalan: { id: 'Jalan rusak', en: 'Damaged roads' },
  banjir: { id: 'Banjir', en: 'Flooding' },
  harga: { id: 'Harga pangan', en: 'Food prices' },
  umkm: { id: 'UMKM', en: 'Small business' },
  sampah: { id: 'Sampah', en: 'Waste' },
  kesehatan: { id: 'Kesehatan', en: 'Health' },
  pendidikan: { id: 'Pendidikan', en: 'Education' },
  bansos: { id: 'Bansos', en: 'Social aid' },
  'hoaks-bendungan': { id: 'Hoaks bendungan', en: 'Dam hoax' },
}
export const topicName = (topic: string, lang: Lang): string => TOPIC[topic]?.[lang] ?? topic

export const TONES = ['tegas', 'menenangkan', 'informatif'] as const
export type Tone = (typeof TONES)[number]

export const CHANNELS = ['situs-resmi', 'medsos-resmi', 'grup-wa', 'media-massa'] as const
export type Channel = (typeof CHANNELS)[number]
export const CHANNEL_LABEL: Record<Channel, Bi> = {
  'situs-resmi': { id: 'Situs resmi pemda', en: 'Official website' },
  'medsos-resmi': { id: 'Akun medsos resmi', en: 'Official social accounts' },
  'grup-wa': { id: 'Grup WA RT/RW', en: 'Neighbourhood WhatsApp groups' },
  'media-massa': { id: 'Rilis ke media massa', en: 'Press release to media' },
}
