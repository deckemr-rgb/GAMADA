/**
 * demos/radar-isu/deep-model.ts — "Analisis Mendalam" (ex-ScrapPulse): a deterministic, SIMULATED crawl for up to 4
 * keywords over 7/14/30 days. The last 7 days lean on the running world (its mentions and Sapa Warga complaints of
 * the matching topic), earlier days are generated from seed + keyword, so the same keyword always gives the same
 * curve in a given world. Every outlet and account is fictional (world/texts). Loaded with the Deep / Report tabs.
 */
import { hashString, isoDay, makeRng, rows } from '../../demo-kit/world'
import type { Bi, ComplaintCategory, Mention, Sentiment, WorldState } from '../../demo-kit/world'
import { MEDIA_OUTLETS, SOCIAL_HANDLES } from '../../demo-kit/world/texts'

export type Period = 7 | 14 | 30
export type SourceLang = 'all' | 'id' | 'en'

export interface DeepInput {
  keywords: string[]
  days: Period
  lang: SourceLang
}

export interface Split {
  pos: number
  neu: number
  neg: number
}

export interface DeepKeyword {
  keyword: string
  /** matched world topic (null = generic) */
  topic: string | null
  total: number
  /** posts per day, oldest first (length = days) */
  daily: number[]
  /** % change of the last 3 days vs the 3 days before */
  momentum: number
  sentiment: Split
  byLang: { id: Split; en: Split }
  reach: number
}

export interface DeepSource {
  id: 'berita' | 'sosmed' | 'forum' | 'aduan'
  label: Bi
  count: number
}

export interface DeepResult {
  input: DeepInput
  /** world minute the analysis ran */
  at: number
  day: string
  seed: number
  region: string
  dates: string[]
  keywords: DeepKeyword[]
  sources: DeepSource[]
  topics: { keyword: string; label: Bi; share: number }[]
  media: {
    outlet: string
    kind: Mention['kind']
    count: number
    lean: number
  }[]
  quotes: {
    keyword: string
    text: Bi
    outlet: string
    sentiment: Sentiment
    reach: number
  }[]
  survey: Bi[]
  insight: Bi
}

/* ------------------------------------------------------------------ topic matching */

const TOPIC_WORDS: [string, RegExp][] = [
  ['hoaks-bendungan', /bendungan|waduk|\bdam\b|jebol|hoaks|hoax/i],
  ['banjir', /banjir|flood|genang|luapan|bengawan|sungai|river/i],
  ['jalan', /jalan|road|aspal|lubang|pothole/i],
  ['harga', /harga|price|cabai|chil+i|beras|rice|bawang|sembako|inflasi/i],
  ['layanan', /layanan|service|ktp|antre|antri|queue|mpp|adminduk|kk\b/i],
  ['sampah', /sampah|waste|rubbish|trash|tpa/i],
  ['umkm', /umkm|usaha|sme|business|pameran/i],
  ['bansos', /bansos|bantuan|social aid|subsid/i],
  ['kesehatan', /sehat|health|puskesmas|rumah sakit|hospital|dbd/i],
  ['pendidikan', /sekolah|school|pendidikan|education|guru/i],
]
const TOPIC_PRIOR: Record<string, number> = {
  'hoaks-bendungan': -0.55,
  banjir: -0.3,
  jalan: -0.35,
  harga: -0.25,
  layanan: 0.05,
  sampah: -0.3,
  umkm: 0.45,
  bansos: -0.15,
  kesehatan: 0.2,
  pendidikan: 0.35,
}
const TOPIC_CATEGORY: Partial<Record<string, ComplaintCategory[]>> = {
  banjir: ['banjir'],
  jalan: ['jalan-rusak'],
  sampah: ['sampah'],
  layanan: ['adminduk'],
  bansos: ['bansos'],
  kesehatan: ['kesehatan'],
  pendidikan: ['sekolah'],
}
const SUBTOPICS: Record<string, Bi[]> = {
  'hoaks-bendungan': [
    { id: 'Klaim bendungan jebol', en: 'Dam-burst claim' },
    { id: 'Permintaan info resmi', en: 'Requests for official info' },
    { id: 'Data tinggi muka air', en: 'Water-level data' },
    { id: 'Ajakan berhenti menyebar', en: 'Calls to stop sharing' },
  ],
  banjir: [
    { id: 'Tinggi muka air sungai', en: 'River water level' },
    { id: 'Pengungsian & posko', en: 'Evacuation & shelters' },
    { id: 'Bantuan logistik', en: 'Relief supplies' },
    { id: 'Jalan tergenang', en: 'Flooded roads' },
  ],
  jalan: [
    { id: 'Lubang & kerusakan', en: 'Potholes & damage' },
    { id: 'Jadwal perbaikan', en: 'Repair schedule' },
    { id: 'Keselamatan pengendara', en: 'Road safety' },
    { id: 'Anggaran infrastruktur', en: 'Infrastructure budget' },
  ],
  harga: [
    { id: 'Harga cabai & bawang', en: 'Chilli & shallot prices' },
    { id: 'Stok beras', en: 'Rice stocks' },
    { id: 'Operasi pasar', en: 'Market operations' },
    { id: 'Daya beli warga', en: 'Purchasing power' },
  ],
  layanan: [
    { id: 'Antrean & waktu tunggu', en: 'Queues & waiting time' },
    { id: 'Layanan daring', en: 'Online services' },
    { id: 'Sikap petugas', en: 'Staff attitude' },
    { id: 'Persyaratan dokumen', en: 'Document requirements' },
  ],
}
const GENERIC_SUB: Bi[] = [
  { id: 'Keluhan warga', en: 'Citizen complaints' },
  { id: 'Respons pemda', en: 'Government response' },
  { id: 'Informasi resmi', en: 'Official information' },
  { id: 'Opini & ajakan', en: 'Opinion & calls to act' },
]
const SURVEY: Record<string, Bi[]> = {
  'hoaks-bendungan': [
    {
      id: 'Dari mana Anda pertama kali mendengar kabar “bendungan jebol”?',
      en: 'Where did you first hear the “dam burst” story?',
    },
    {
      id: 'Seberapa yakin Anda dapat membedakan informasi resmi dan hoaks? (1–5)',
      en: 'How confident are you in telling official information from hoaxes? (1–5)',
    },
    {
      id: 'Kanal mana yang paling Anda percaya untuk info bencana?',
      en: 'Which channel do you trust most for disaster information?',
    },
  ],
  banjir: [
    {
      id: 'Apakah peringatan dini banjir sampai ke Anda tepat waktu?',
      en: 'Did the early flood warning reach you in time?',
    },
    {
      id: 'Bantuan apa yang paling dibutuhkan keluarga Anda saat banjir?',
      en: 'What help does your family need most during a flood?',
    },
    {
      id: 'Seberapa puas Anda dengan penanganan banjir minggu ini? (1–5)',
      en: 'How satisfied are you with this week’s flood response? (1–5)',
    },
  ],
  harga: [
    {
      id: 'Bahan pokok apa yang harganya paling memberatkan bulan ini?',
      en: 'Which staple is hardest to afford this month?',
    },
    {
      id: 'Apakah Anda pernah membeli di operasi pasar pemda?',
      en: 'Have you ever bought at a government market operation?',
    },
  ],
  jalan: [
    {
      id: 'Ruas jalan mana yang paling mendesak diperbaiki di sekitar Anda?',
      en: 'Which road near you most urgently needs repair?',
    },
    {
      id: 'Apakah Anda tahu kanal resmi untuk melapor jalan rusak?',
      en: 'Do you know the official channel to report damaged roads?',
    },
  ],
  layanan: [
    {
      id: 'Berapa lama Anda menunggu saat terakhir mengurus dokumen?',
      en: 'How long did you wait the last time you applied for a document?',
    },
    {
      id: 'Apakah Anda lebih memilih layanan daring daripada datang langsung?',
      en: 'Would you rather use an online service than come in person?',
    },
  ],
}

export function matchTopic(keyword: string): string | null {
  for (const [t, re] of TOPIC_WORDS) if (re.test(keyword)) return t
  return null
}

/* ------------------------------------------------------------------ helpers */

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
function split(mean: number, wobble: number): Split {
  const pos = clamp(0.3 + mean * 0.42 + wobble, 0.04, 0.9)
  const neg = clamp(0.3 - mean * 0.42 - wobble * 0.6, 0.04, 0.9)
  const neu = Math.max(0.04, 1 - pos - neg)
  const t = pos + neg + neu
  const r = (x: number) => Math.round((x / t) * 1000) / 1000
  const p = r(pos)
  const n = r(neg)
  return { pos: p, neg: n, neu: Math.round((1 - p - n) * 1000) / 1000 }
}
const sentimentOf = (score: number): Sentiment => (score < -0.2 ? 'negatif' : score > 0.2 ? 'positif' : 'netral')
const matchesMention = (m: Mention, kw: string, topic: string | null) =>
  (topic !== null && m.topic === topic) || m.text.id.toLowerCase().includes(kw.toLowerCase()) || m.text.en.toLowerCase().includes(kw.toLowerCase())

/* ------------------------------------------------------------------ the analysis */

export function analyze(s: WorldState, now: number, input: DeepInput): DeepResult {
  const days = input.days
  const dates = Array.from({ length: days }, (_, i) => isoDay(s.day, -(days - 1 - i)))
  const ments = rows(s.mentions).filter((m) => m.at <= now)
  const complaints = rows(s.complaints)
  const langShare = input.lang === 'all' ? 1 : input.lang === 'id' ? 0.88 : 0.12

  const keywords: DeepKeyword[] = input.keywords.map((raw) => {
    const keyword = raw.trim()
    const topic = matchTopic(keyword)
    const r = makeRng(hashString(`${s.seed}|${s.regionId}|${keyword.toLowerCase()}`))
    const base = topic ? r.int(70, 160) : r.int(18, 60)
    const world = ments.filter((m) => matchesMention(m, keyword, topic))
    const daily = dates.map((_, i) => {
      const dayOffset = i - (days - 1)
      const wave = 1 + 0.28 * Math.sin((i + r.float(0, 6)) / 2.3)
      const fromWorld = world.filter((m) => Math.floor(m.at / 1440) === dayOffset).length
      // today's events (a burst, a flood alert) show as a spike: each world post stands for ~14 crawled posts
      return Math.max(0, Math.round((base * wave + r.normal(0, base * 0.12) + fromWorld * 14) * langShare))
    })
    const last3 = daily.slice(-3).reduce((a, b) => a + b, 0)
    const prev3 = daily.slice(-6, -3).reduce((a, b) => a + b, 0)
    const momentum = prev3 ? Math.round(((last3 - prev3) / prev3) * 100) : 0
    const worldMean = world.length ? world.reduce((a, m) => a + m.score, 0) / world.length : null
    const prior = topic ? (TOPIC_PRIOR[topic] ?? 0) : r.float(-0.2, 0.2)
    const mean = worldMean === null ? prior : prior * 0.4 + worldMean * 0.6
    const total = daily.reduce((a, b) => a + b, 0)
    return {
      keyword,
      topic,
      total,
      daily,
      momentum,
      sentiment: split(mean, r.normal(0, 0.03)),
      byLang: {
        id: split(mean, r.normal(0, 0.04)),
        en: split(mean * 0.7, r.normal(0, 0.05)),
      },
      reach: Math.round(total * r.float(180, 420)),
    }
  })

  const grand = keywords.reduce((a, k) => a + k.total, 0)
  const complaintCount = keywords.reduce((n, k) => {
    const cats = k.topic ? TOPIC_CATEGORY[k.topic] : undefined
    return n + (cats ? complaints.filter((c) => cats.includes(c.category) && c.at > now - days * 1440 && c.at <= now).length : 0)
  }, 0)
  const sources: DeepSource[] = [
    {
      id: 'berita',
      label: { id: 'Portal berita daring', en: 'Online news portals' },
      count: Math.round(grand * 0.34),
    },
    {
      id: 'sosmed',
      label: { id: 'Media sosial publik', en: 'Public social media' },
      count: Math.round(grand * 0.55),
    },
    {
      id: 'forum',
      label: { id: 'Forum & grup terbuka', en: 'Open forums & groups' },
      count: Math.round(grand * 0.11),
    },
    {
      id: 'aduan',
      label: {
        id: 'Kanal aduan Sapa Warga',
        en: 'Sapa Warga complaint channel',
      },
      count: complaintCount,
    },
  ]

  const topics = keywords.flatMap((k) => {
    const r = makeRng(hashString(`sub|${s.seed}|${k.keyword.toLowerCase()}`))
    const subs = (k.topic && SUBTOPICS[k.topic]) || GENERIC_SUB
    const w = subs.map(() => r.float(0.4, 1.6))
    const tot = w.reduce((a, b) => a + b, 0)
    return subs
      .map((label, i) => ({
        keyword: k.keyword,
        label,
        share: Math.round(((w[i] ?? 0) / tot) * 1000) / 1000,
      }))
      .sort((a, b) => b.share - a.share)
  })

  const outlets = new Map<string, { kind: Mention['kind']; n: number; sum: number }>()
  for (const k of keywords) {
    for (const m of ments.filter((x) => matchesMention(x, k.keyword, k.topic))) {
      const g = outlets.get(m.outlet) ?? { kind: m.kind, n: 0, sum: 0 }
      g.n++
      g.sum += m.score
      outlets.set(m.outlet, g)
    }
  }
  const r0 = makeRng(hashString(`media|${s.seed}|${input.keywords.join('|').toLowerCase()}`))
  for (const o of r0.sample([...MEDIA_OUTLETS, ...SOCIAL_HANDLES.slice(0, 4)], 6)) {
    if (outlets.has(o)) continue
    outlets.set(o, {
      kind: o.startsWith('@') ? 'sosmed' : 'berita',
      n: r0.int(2, 9),
      sum: r0.float(-3, 2),
    })
  }
  const media = [...outlets.entries()]
    .map(([outlet, g]) => ({
      outlet,
      kind: g.kind,
      count: g.n * 9 + Math.round(grand / 80),
      lean: Math.round((g.sum / g.n) * 100) / 100,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  const quotes = keywords
    .flatMap((k) => {
      const own = ments
        .filter((m) => matchesMention(m, k.keyword, k.topic))
        .sort((a, b) => b.reach - a.reach)
        .slice(0, 2)
        .map((m) => ({
          keyword: k.keyword,
          text: m.text,
          outlet: m.outlet,
          sentiment: m.sentiment,
          reach: m.reach,
        }))
      if (own.length) return own
      const r = makeRng(hashString(`q|${s.seed}|${k.keyword.toLowerCase()}`))
      const score = (k.sentiment.pos - k.sentiment.neg) * 0.9
      return [
        {
          keyword: k.keyword,
          text: {
            id: `Warga ${s.region.shortName} ramai membahas “${k.keyword}” di grup percakapan minggu ini.`,
            en: `${s.region.shortName} residents are talking about “${k.keyword}” in chat groups this week.`,
          },
          outlet: r.pick(SOCIAL_HANDLES),
          sentiment: sentimentOf(score),
          reach: r.int(800, 6000),
        },
      ]
    })
    .slice(0, 5)

  const survey = keywords
    .flatMap(
      (k) =>
        (k.topic && SURVEY[k.topic]) || [
          {
            id: `Seberapa penting isu “${k.keyword}” bagi keluarga Anda? (1–5)`,
            en: `How important is the “${k.keyword}” issue for your family? (1–5)`,
          },
          {
            id: `Dari mana Anda mendapat informasi tentang “${k.keyword}”?`,
            en: `Where do you get information about “${k.keyword}”?`,
          },
        ],
    )
    .slice(0, 5)

  const lead = [...keywords].sort((a, b) => b.total - a.total)[0]
  const pct = (x: number) => Math.round(x * 100)
  const insight: Bi = lead
    ? {
        id: `“${lead.keyword}” paling ramai (${lead.total.toLocaleString('id-ID')} unggahan, momentum ${lead.momentum >= 0 ? '+' : ''}${lead.momentum}% dalam 3 hari) dengan ${pct(lead.sentiment.neg)}% bernada negatif. ${lead.sentiment.neg > 0.4 ? 'Siapkan informasi resmi yang menjawab keluhan utama dan pantau ulang 24 jam lagi.' : 'Percakapan relatif terkendali; manfaatkan untuk menyebarkan informasi layanan.'}`,
        en: `“${lead.keyword}” is the loudest (${lead.total.toLocaleString('en-GB')} posts, ${lead.momentum >= 0 ? '+' : ''}${lead.momentum}% momentum over 3 days) with ${pct(lead.sentiment.neg)}% negative. ${lead.sentiment.neg > 0.4 ? 'Prepare official information that answers the main complaint and re-check in 24 hours.' : 'The conversation is under control; use it to share service information.'}`,
      }
    : { id: '', en: '' }

  return {
    input,
    at: now,
    day: s.day,
    seed: s.seed,
    region: s.region.name,
    dates,
    keywords,
    sources,
    topics,
    media,
    quotes,
    survey,
    insight,
  }
}
