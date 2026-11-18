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
  /**
   * what the numbers stand on: 'topic' = a world topic (world posts + its history), 'free' = a plausible civic term
   * outside the world topics (generic simulated crawl, quotes marked as templates), 'none' = not a known term and not
   * word-shaped ("qwzx kplm"): only a handful of posts, too few to analyse, said so
   */
  basis: 'topic' | 'free' | 'none'
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
  /** not a public post (Sapa Warga complaints): shown beside the sources, never added to "Total posts" */
  excluded?: boolean
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
    /** a simulated quote built around the keyword (no matching post in the monitored world) */
    template?: boolean
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
    { id: 'Harga di pasar tradisional', en: 'Traditional-market prices' },
    { id: 'Pasokan dari petani', en: 'Supply from farmers' },
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
/** a free keyword (no world topic): subtopics, quotes and survey questions built around the keyword itself */
const genericSub = (kw: string): Bi[] => [
  { id: `Keluhan soal ${kw}`, en: `Complaints about ${kw}` },
  { id: 'Lokasi yang paling sering disebut', en: 'Places mentioned most' },
  { id: `Respons pemda atas ${kw}`, en: `Government response to ${kw}` },
  { id: 'Usulan solusi dari warga', en: 'Solutions residents suggest' },
]
const GENERIC_QUOTES: { s: number; t: (kw: string, k: string, r: string) => Bi }[] = [
  {
    s: -0.5,
    t: (kw, k) => ({
      id: `Soal ${kw} di Kec. ${k}, warga minta petugas turun langsung, bukan cuma imbauan.`,
      en: `On ${kw} in ${k}, residents want officers on the ground, not just appeals.`,
    }),
  },
  {
    s: 0.4,
    t: (kw, k) => ({
      id: `Akhirnya ada penertiban ${kw} di sekitar pasar Kec. ${k}. Semoga konsisten.`,
      en: `Finally some action on ${kw} around the ${k} market. Hope it lasts.`,
    }),
  },
  {
    s: -0.35,
    t: (kw) => ({
      id: `Sudah lapor soal ${kw} lewat kanal pemda minggu lalu, belum ada kabar.`,
      en: `Reported ${kw} through the government channel last week; no news yet.`,
    }),
  },
  {
    s: 0.05,
    t: (kw, _k, r) => ({
      id: `Grup RT kami di ${r} sedang membahas ${kw}; ada usul dibuat jadwal ronda dan papan info.`,
      en: `Our neighbourhood group in ${r} is discussing ${kw}; someone proposed a rota and a notice board.`,
    }),
  },
]
/** words too generic to tell two keywords of one topic apart ("harga cabai" vs a rice-stock post) */
const STOP = new Set(['harga', 'price', 'prices', 'isu', 'issue', 'warga', 'layanan', 'service', 'the', 'dan', 'and'])
const tokensOf = (kw: string) =>
  kw
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 4 && !STOP.has(w))
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

/** plausible local civic terms outside the world topics (a free keyword from this list gets a generic simulated
 *  crawl); anything else that does not look like words gets the honest "too few posts" answer */
const CIVIC =
  /parkir|pkl|pedagang|kaki lima|pasar|terminal|angkot|ojek|ojol|macet|kemacetan|lalu lintas|traffic|parking|pdam|air bersih|listrik|pln|padam|sinyal|internet|wifi|wisata|tourism|pajak|retribusi|tax|stunting|gizi|posyandu|imunisasi|narkoba|judi|kriminal|begal|curanmor|maling|pencurian|keamanan|lampu|pju|penerangan|tambang|migas|minyak|polusi|asap|kebakaran|longsor|kekeringan|kemarau|gempa|puting beliung|angin|pupuk|petani|nelayan|ternak|sapi|padi|panen|jagung|tembakau|elpiji|lpg|gas|bbm|solar|pertalite|lowongan|pengangguran|kerja|upah|umr|umk|pilkada|pemilu|dprd|apbd|anggaran|korupsi|pungli|izin|perizinan|pbb|sertifikat|tanah|rumah|perumahan|rusun|kumuh|sanitasi|jamban|sungai|irigasi|bendung|embung|jembatan|trotoar|drainase|selokan|gorong|pohon|taman|ruang terbuka|stadion|olahraga|budaya|seni|batik|kuliner|haji|masjid|ibadah|toleransi|desa|kelurahan|kecamatan|rt|rw|kependudukan|akta|nikah|perceraian|kdrt|anak|perempuan|disabilitas|lansia|difabel|guru|siswa|beasiswa|kip|bpjs|jkn|obat|dokter|bidan|ambulans|vaksin|covid|dbd|demam|diare|rabies|banjir|harga|inflasi/i
/** looks like words: every token has a vowel, no long consonant run, not a keyboard mash */
const wordLike = (kw: string) =>
  kw
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .filter(Boolean)
    .every((w) => /[aiueo]/.test(w) && !/[^aiueo\s]{4,}/.test(w) && (w.match(/[aiueo]/g)?.length ?? 0) / w.length >= 0.25)

export function matchTopic(keyword: string): string | null {
  for (const [t, re] of TOPIC_WORDS) if (re.test(keyword)) return t
  return null
}

/* ------------------------------------------------------------------ helpers */

/** share of Indonesian-language posts among the crawled sources */
const LANG_SHARE_ID = 0.88

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
  const langShare = input.lang === 'all' ? 1 : input.lang === 'id' ? LANG_SHARE_ID : 1 - LANG_SHARE_ID

  const keywords: DeepKeyword[] = input.keywords.map((raw) => {
    const keyword = raw.trim()
    const topic = matchTopic(keyword)
    const r = makeRng(hashString(`${s.seed}|${s.regionId}|${keyword.toLowerCase()}`))
    const world = ments.filter((m) => matchesMention(m, keyword, topic))
    const basis: DeepKeyword['basis'] = topic ? 'topic' : world.length || (CIVIC.test(keyword) && wordLike(keyword)) ? 'free' : 'none'
    // 'none': a handful of stray posts at most (a typo or a mash finds almost nothing, and the result says so)
    const base = basis === 'topic' ? r.int(70, 160) : basis === 'free' ? r.int(18, 60) : 0
    const daily = dates.map((_, i) => {
      const dayOffset = i - (days - 1)
      const wave = 1 + 0.28 * Math.sin((i + r.float(0, 6)) / 2.3)
      const fromWorld = world.filter((m) => Math.floor(m.at / 1440) === dayOffset).length
      if (basis === 'none') return r.chance(0.25) ? 1 : 0
      // today's events (a burst, citizen flood reports) show as a spike: each world post stands for ~14 crawled posts,
      // each Sapa Warga report of the topic for ~6 (people post about what they report)
      const cats = topic ? TOPIC_CATEGORY[topic] : undefined
      const fromSapa = cats && dayOffset === 0 ? complaints.filter((c) => cats.includes(c.category) && c.at >= 0 && c.at <= now).length : 0
      return Math.max(0, Math.round((base * wave + r.normal(0, base * 0.12) + fromWorld * 14 + fromSapa * 6) * langShare))
    })
    const last3 = daily.slice(-3).reduce((a, b) => a + b, 0)
    const prev3 = daily.slice(-6, -3).reduce((a, b) => a + b, 0)
    const momentum = prev3 ? Math.round(((last3 - prev3) / prev3) * 100) : 0
    const worldMean = world.length ? world.reduce((a, m) => a + m.score, 0) / world.length : null
    const prior = topic ? (TOPIC_PRIOR[topic] ?? 0) : r.float(-0.2, 0.2)
    const mean = worldMean === null ? prior : prior * 0.4 + worldMean * 0.6
    const total = daily.reduce((a, b) => a + b, 0)
    if (basis === 'none') {
      const flat: Split = { pos: 0, neu: 1, neg: 0 }
      return { keyword, topic, basis, total, daily, momentum: 0, sentiment: flat, byLang: { id: flat, en: flat }, reach: total * r.int(40, 400) }
    }
    const byLang = {
      id: split(mean, r.normal(0, 0.04)),
      en: split(mean * 0.7, r.normal(0, 0.05)),
    }
    // the total IS the volume-weighted mix of the two source languages (it always lies between them)
    const wId = input.lang === 'all' ? LANG_SHARE_ID : input.lang === 'id' ? 1 : 0
    const mix = (k: keyof Split) => byLang.id[k] * wId + byLang.en[k] * (1 - wId)
    const pos = Math.round(mix('pos') * 1000) / 1000
    const neg = Math.round(mix('neg') * 1000) / 1000
    return {
      keyword,
      topic,
      basis,
      total,
      daily,
      momentum,
      sentiment: { pos, neg, neu: Math.round((1 - pos - neg) * 1000) / 1000 },
      byLang,
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
      count: grand - Math.round(grand * 0.34) - Math.round(grand * 0.55),
    },
    {
      id: 'aduan',
      label: {
        id: 'Kanal aduan Sapa Warga',
        en: 'Sapa Warga complaint channel',
      },
      count: complaintCount,
      excluded: true,
    },
  ]

  // every keyword keeps its share of the lists (no keyword silently drops out of topics, quotes or survey)
  const perKw = keywords.length <= 2 ? 4 : 2
  const topics = keywords.flatMap((k) => {
    if (k.basis === 'none') return []
    const r = makeRng(hashString(`sub|${s.seed}|${k.keyword.toLowerCase()}`))
    const subs = (k.topic && SUBTOPICS[k.topic]) || genericSub(k.keyword)
    const w = subs.map(() => r.float(0.4, 1.6))
    const tot = w.reduce((a, b) => a + b, 0)
    return subs
      .map((label, i) => ({
        keyword: k.keyword,
        label,
        share: Math.round(((w[i] ?? 0) / tot) * 1000) / 1000,
      }))
      .sort((a, b) => b.share - a.share)
      .slice(0, perKw)
  })

  const outlets = new Map<string, { kind: Mention['kind']; n: number; sum: number }>()
  const known = keywords.filter((k) => k.basis !== 'none')
  for (const k of known) {
    for (const m of ments.filter((x) => matchesMention(x, k.keyword, k.topic))) {
      const g = outlets.get(m.outlet) ?? { kind: m.kind, n: 0, sum: 0 }
      g.n++
      g.sum += m.score
      outlets.set(m.outlet, g)
    }
  }
  const r0 = makeRng(hashString(`media|${s.seed}|${input.keywords.join('|').toLowerCase()}`))
  for (const o of known.length ? r0.sample([...MEDIA_OUTLETS, ...SOCIAL_HANDLES.slice(0, 4)], 6) : []) {
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
      // per-outlet jitter: two outlets with the same sample size never print the same total
      count: g.n * 9 + Math.round(grand / 80) + (hashString(`${outlet}|${s.seed}|${input.keywords.join('|')}`) % 13) - 6,
      lean: Math.round((g.sum / g.n) * 100) / 100,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  const qPer = keywords.length <= 2 ? 2 : 1
  const quotes = known
    .flatMap((k) => {
      // a post of the same topic only quotes for this keyword when it names the keyword's own words
      // ("harga cabai" never quotes a rice-stock post)
      const toks = tokensOf(k.keyword)
      const strict = k.topic === 'harga'
      const own = ments
        .filter((m) => matchesMention(m, k.keyword, k.topic))
        .filter((m) => !strict || !toks.length || toks.some((w) => m.text.id.toLowerCase().includes(w) || m.text.en.toLowerCase().includes(w)))
        .sort((a, b) => b.reach - a.reach)
        .slice(0, qPer)
        .map((m) => ({
          keyword: k.keyword,
          text: m.text,
          outlet: m.outlet,
          sentiment: m.sentiment,
          reach: m.reach,
        }))
      if (own.length) return own
      // no matching post in the monitored world: simulated quotes built around the keyword, varied by seed
      const r = makeRng(hashString(`q|${s.seed}|${k.keyword.toLowerCase()}`))
      const kw = k.keyword.toLowerCase()
      return r.sample(GENERIC_QUOTES, qPer).map((q) => {
        const kec = s.region.kecamatan.length ? r.pick(s.region.kecamatan).name : s.region.shortName
        const sc = q.s + (k.sentiment.pos - k.sentiment.neg) * 0.3
        const social = r.chance(0.6)
        return {
          keyword: k.keyword,
          text: q.t(kw, kec, s.region.shortName),
          outlet: social ? r.pick(SOCIAL_HANDLES) : r.pick(MEDIA_OUTLETS),
          sentiment: sentimentOf(sc),
          reach: r.int(800, 6000),
          template: true,
        }
      })
    })
    .slice(0, 6)

  const surveyOf = (k: DeepKeyword): Bi[] =>
    (k.topic && SURVEY[k.topic]) || [
      {
        id: `Seberapa sering Anda mengalami masalah “${k.keyword}” dalam sebulan terakhir?`,
        en: `How often did you run into “${k.keyword}” problems in the past month?`,
      },
      {
        id: `Menurut Anda, siapa yang paling tepat menangani “${k.keyword}”: kelurahan/desa, dinas, atau warga sendiri?`,
        en: `Who should handle “${k.keyword}” first: the village office, the agency, or residents themselves?`,
      },
    ]
  // round-robin: every keyword gets a question before any keyword gets a second one
  const lists = known.map(surveyOf)
  const survey: Bi[] = []
  for (let i = 0; survey.length < 5 && lists.some((l) => l[i]); i++) for (const l of lists) if (l[i] && survey.length < 5) survey.push(l[i]!)

  const lead = [...known].sort((a, b) => b.total - a.total)[0]
  const pct = (x: number) => Math.round(x * 100)
  const none = keywords.filter((k) => k.basis === 'none')
  const noneNote: Bi = none.length
    ? {
        id: ` ${none.map((k) => `“${k.keyword}”`).join(', ')} hampir tidak muncul (${none.reduce((a, k) => a + k.total, 0)} unggahan): terlalu sedikit untuk dianalisis; periksa ejaannya.`,
        en: ` ${none.map((k) => `“${k.keyword}”`).join(', ')} barely appear${none.length === 1 ? 's' : ''} (${none.reduce((a, k) => a + k.total, 0)} posts): too few to analyse; check the spelling.`,
      }
    : { id: '', en: '' }
  // a live situation today (an active / recent hoax, citizen evacuation or flood reports) is never "under control"
  const today0 = Math.floor(now / 1440) * 1440
  const hoaxToday = rows(s.hoaxAlerts).some((h) => h.at >= today0 && h.at <= now)
  const floodToday = complaints.filter((c) => c.category === 'banjir' && c.at >= today0 && c.at <= now).length
  const live = lead && (lead.topic === 'banjir' || lead.topic === 'hoaks-bendungan') && (hoaxToday || floodToday > 0)
  const advice = (l: DeepKeyword): Bi =>
    live
      ? {
          id: `Hari ini ada ${[hoaxToday ? 'hoaks bendungan' : '', floodToday ? `${floodToday} laporan banjir warga di Sapa Warga` : ''].filter(Boolean).join(' dan ')}: pantau per jam, bukan harian.`,
          en: `Today there ${[hoaxToday ? 'is a dam hoax' : '', floodToday ? `are ${floodToday} citizen flood reports in Sapa Warga` : ''].filter(Boolean).join(' and ')}: monitor hourly, not daily.`,
        }
      : l.sentiment.neg > 0.4
        ? { id: 'Siapkan informasi resmi yang menjawab keluhan utama dan pantau ulang 24 jam lagi.', en: 'Prepare official information that answers the main complaint and re-check in 24 hours.' }
        : { id: 'Percakapan relatif terkendali; manfaatkan untuk menyebarkan informasi layanan.', en: 'The conversation is under control; use it to share service information.' }
  const insight: Bi = lead
    ? {
        id: `“${lead.keyword}” paling ramai (${lead.total.toLocaleString('id-ID')} unggahan, momentum ${lead.momentum >= 0 ? '+' : ''}${lead.momentum}% dalam 3 hari) dengan ${pct(lead.sentiment.neg)}% bernada negatif. ${advice(lead).id}${noneNote.id}`,
        en: `“${lead.keyword}” is the loudest (${lead.total.toLocaleString('en-GB')} posts, ${lead.momentum >= 0 ? '+' : ''}${lead.momentum}% momentum over 3 days) with ${pct(lead.sentiment.neg)}% negative. ${advice(lead).en}${noneNote.en}`,
      }
    : none.length
      ? { id: noneNote.id.trim(), en: noneNote.en.trim() }
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
