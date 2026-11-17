/**
 * demos/radar-isu/scenario.ts — the simulated AI analyst (spec §9.2): 14 intents with Indonesian, English and Basa
 * Jawa examples. Every answer reads the live world summary (ctx.ts → RadarCtx), so numbers match the screen.
 * Structured kinds are the shared ones the Live proxy also returns: 'clarification' (draft_clarification),
 * 'sentiment' (assess_mention) and 'analysis' (analyze_topic). Registered when a chat surface loads.
 */
import { registerScenario, type Intent, type Scenario, type SimContext, type SimResponse } from '../../demo-kit/ai/chat'
import type { RadarCtx } from './ctx'
import { CLARIFY_TEXT, clarification, toneFromText } from './clarify-text'
import { TOPIC } from './strings'

type L = 'id' | 'en'
type Ctx = SimContext<RadarCtx>

const nf = (n: number, lang: L, d = 0) =>
  n.toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB', {
    maximumFractionDigits: d,
    minimumFractionDigits: d,
  })
const tm = (hhmm: string, lang: L) => (lang === 'id' ? hhmm.replace(':', '.') : hhmm)
const word = (v: number, lang: L) =>
  v <= -20
    ? lang === 'id'
      ? 'cenderung negatif'
      : 'leaning negative'
    : v >= 20
      ? lang === 'id'
        ? 'cenderung positif'
        : 'leaning positive'
      : lang === 'id'
        ? 'netral'
        : 'neutral'
const signed = (v: number, lang: L) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${nf(Math.abs(v), lang)}`
/** Basa Jawa input? answer gets a short Javanese opener + translation line */
const JV = /\b(opo|apa wae|piye|pripun|sing|ora|mboten|iki|niki|kae|wae|dina|saiki|nggawe|gawekna|tulung|nyuwun|wonten|ana|kabare|isu ne|endi)\b/i
const isJv = (t: string) => JV.test(t)

function w(ctx: Ctx): RadarCtx | null {
  const x = ctx.world as RadarCtx | null
  return x && x.product === 'radar-isu' ? x : null
}

const noData = (lang: L): SimResponse => ({
  text: lang === 'id' ? 'Data pantauan belum termuat. Coba lagi sebentar lagi.' : 'Monitoring data has not loaded yet. Please try again in a moment.',
})

function top(x: RadarCtx) {
  return [...x.topics].sort((a, b) => a.score - b.score).find((t) => t.score < -0.2) ?? null
}

/** Basa Jawa question → a short Javanese opener (krama where it addresses the user) + its translation line */
function jvWrap(ctx: Ctx, r: SimResponse, jv: [jv: string, id: string, en: string]): SimResponse {
  if (!isJv(ctx.text)) return r
  return {
    ...r,
    text: `${jv[0]}

${r.text}`,
    translation: ctx.lang === 'id' ? `Terjemahan: ${jv[1]}` : `Translation: ${jv[2]}`,
  }
}

function hoaxLine(x: RadarCtx, lang: L): string {
  if (x.hoax?.status === 'aktif')
    return lang === 'id'
      ? `Ada hoaks aktif: “${x.hoax.claim.id}” (skor ${Math.round(x.hoax.score * 100)}%, ${x.hoax.posts} unggahan, terdeteksi ${tm(x.hoax.detectedAt, lang)}). Belum diklarifikasi.`
      : `There is an active hoax: “${x.hoax.claim.en}” (score ${Math.round(x.hoax.score * 100)}%, ${x.hoax.posts} posts, detected at ${x.hoax.detectedAt}). Not clarified yet.`
  if (x.hoax?.status === 'diklarifikasi' && x.hoax.clarification)
    return lang === 'id'
      ? `Hoaks “${x.hoax.claim.id}” sudah diklarifikasi pukul ${tm(x.hoax.clarification.at, lang)}.`
      : `The “${x.hoax.claim.en}” hoax was clarified at ${x.hoax.clarification.at}.`
  if (x.burst)
    return lang === 'id'
      ? `Ada narasi mencurigakan yang mulai menyebar (${x.burst.posts}/${x.burst.threshold} unggahan menuju ambang deteksi).`
      : `A suspicious narrative is starting to spread (${x.burst.posts}/${x.burst.threshold} posts towards the detection threshold).`
  return lang === 'id' ? 'Tidak ada hoaks aktif saat ini.' : 'No active hoax right now.'
}

/* ------------------------------------------------------------------ assessment of a pasted post (assess_mention) */

const HOAX_CUES = /(jebol|breaking|sebarkan|teruskan|viral|katanya|kabarnya|grup|pass it on|share|they say|burst|!!!|air bah|evakuasi sekarang|pemerintah diam)/gi
const NEG_CUES =
  /(rusak|keluh|macet|banjir|naik|mahal|lambat|antre|mengular|parah|bahaya|jebol|panik|mengungsi|air bah|complain|broken|flood|slow|queue|expensive|danger|burst|evacuate)/gi
const POS_CUES = /(aman|cepat|bagus|terima kasih|juara|berhasil|ramai pesanan|tenang|safe|fast|great|thanks|wins|calm)/gi

export function assess(text: string, x: RadarCtx | null, lang: L) {
  const body = text.replace(/^[^:«“"]*[:«“"]\s*/, '').replace(/[»”"]\s*$/, '')
  const hoaxHits = body.match(HOAX_CUES)?.length ?? 0
  const neg = body.match(NEG_CUES)?.length ?? 0
  const pos = body.match(POS_CUES)?.length ?? 0
  const dam = /bendungan|waduk|\bdam\b/i.test(body)
  const caps = (body.match(/[A-Z]{4,}/g)?.length ?? 0) > 0
  let likelihood = Math.min(0.97, 0.06 + hoaxHits * 0.16 + (dam && /jebol|burst/i.test(body) ? 0.35 : 0) + (caps ? 0.08 : 0))
  if (x?.hoax && dam) likelihood = Math.max(likelihood, x.hoax.score)
  const sentiment = neg > pos ? 'negatif' : pos > neg ? 'positif' : 'netral'
  const key = dam
    ? 'hoaks-bendungan'
    : /banjir|flood|sungai|river/i.test(body)
      ? 'banjir'
      : /jalan|road/i.test(body)
        ? 'jalan'
        : /harga|cabai|beras|price/i.test(body)
          ? 'harga'
          : /antre|ktp|layanan|queue|service/i.test(body)
            ? 'layanan'
            : 'umum'
  const topic = TOPIC[key]?.[lang] ?? (lang === 'id' ? 'umum' : 'general')
  const reasons: string[] = []
  if (lang === 'id') {
    if (hoaxHits) reasons.push(`Ada ${hoaxHits} ciri pesan berantai (ajakan menyebar, klaim tanpa sumber, huruf kapital).`)
    if (dam && x?.dam)
      reasons.push(`Data Siaga Wilayah: tinggi muka air ${x.dam.name} ${nf(x.dam.level, lang, 1)} m, di bawah batas siaga ${nf(x.dam.siaga, lang, 1)} m (simulasi).`)
    if (!hoaxHits) reasons.push('Tidak ada ciri pesan berantai; isi berupa keluhan atau informasi biasa.')
    reasons.push(`Sentimen ${sentiment} dari ${neg} kata bernada negatif dan ${pos} kata bernada positif.`)
  } else {
    if (hoaxHits) reasons.push(`${hoaxHits} chain-message signs (calls to share, unsourced claim, capitals).`)
    if (dam && x?.dam)
      reasons.push(`Siaga Wilayah data: ${x.dam.name} water level ${nf(x.dam.level, lang, 1)} m, below the ${nf(x.dam.siaga, lang, 1)} m alert level (simulated).`)
    if (!hoaxHits) reasons.push('No chain-message signs; it reads as an ordinary complaint or report.')
    reasons.push(
      `${sentiment === 'negatif' ? 'Negative' : sentiment === 'positif' ? 'Positive' : 'Neutral'} sentiment from ${neg} negative and ${pos} positive cue words.`,
    )
  }
  const evidenceNeeded =
    likelihood > 0.5
      ? lang === 'id'
        ? ['Konfirmasi petugas lapangan di lokasi yang disebut', 'Sumber asli foto/video bila ada']
        : ['Confirmation from field officers at the place named', 'Original source of any photo/video']
      : []
  return {
    sentiment,
    topic,
    hoaxLikelihood: Math.round(likelihood * 100) / 100,
    reasons: reasons.slice(0, 4),
    evidenceNeeded,
  }
}

/* ------------------------------------------------------------------ keyword + forced routing */

const KW_RE =
  /(?:kata kunci|keyword|analisis(?: mendalam)?|analisa(?: topik)?|analy[sz]e(?: the keyword)?|deep analysis of|analysis of|trend for|tren percakapan|babagan|tembung)\s+["“]?([\p{L} ]{3,30}?)["”]?(?:\s+\d+\s*(?:hari|days))?\s*[?.!]*$/iu
const cleanKw = (k: string | undefined) => k?.replace(/^(kata kunci|the keyword|keyword)\s+/i, '').trim() || undefined
const kwOf = (text: string): string | undefined => cleanKw(KW_RE.exec(text)?.[1])

/**
 * Explicit commands win over word overlap: the UI sends "Nilai unggahan ini: «…»" (the quoted post would otherwise
 * pull the match towards its own topic), "Analisis kata kunci banjir" (not the flood intent) and "Susun klarifikasi …".
 */
const FORCE: [RegExp, string][] = [
  [/«[^»]{4,}»/, 'nilai-unggahan'],
  [/(kata kunci|keyword|tembung)/i, 'analisis-kata-kunci'],
  [/(susun|buat|buatkan|draft|write|gawe|gawekna|tulis|damelaken).*(klarifikasi|clarification|bantahan|press release|rilis pers)/i, 'klarifikasi'],
]

/* ------------------------------------------------------------------ intents */

const intents: Intent<RadarCtx>[] = [
  {
    id: 'ringkasan',
    examples: [
      'ringkas isu hari ini',
      'apa saja isu hari ini',
      'rangkuman pantauan pagi ini',
      'kondisi opini publik sekarang',
      "what's trending today",
      "summarise today's issues",
      'give me the public opinion summary',
      'isu apa wae dina iki',
      'piye kahanane isu saiki',
    ],
    respond: (ctx) => {
      const x = w(ctx)
      const lang = ctx.lang
      if (!x) return noData(lang)
      const t = x.topics[0]
      const n = top(x)
      const lines =
        lang === 'id'
          ? [
              `Pukul ${tm(x.now, lang)}: ${nf(x.kpis.mentions24h, lang)} mention dalam 24 jam (sebelumnya ${nf(x.kpis.prev24h, lang)}), indeks sentimen ${signed(x.kpis.sentimentIndex, lang)} (${word(x.kpis.sentimentIndex, lang)}).`,
              t ? `- Topik terbesar: ${t.label.id} (${t.count} mention).` : '',
              n ? `- Isu negatif terbesar: ${n.label.id} (${n.count} mention, skor ${nf(n.score, lang, 2)}).` : '',
              `- ${hoaxLine(x, lang)}`,
            ]
          : [
              `At ${x.now}: ${nf(x.kpis.mentions24h, lang)} mentions in 24 h (previously ${nf(x.kpis.prev24h, lang)}), sentiment index ${signed(x.kpis.sentimentIndex, lang)} (${word(x.kpis.sentimentIndex, lang)}).`,
              t ? `- Biggest topic: ${t.label.en} (${t.count} mentions).` : '',
              n ? `- Biggest negative issue: ${n.label.en} (${n.count} mentions, score ${nf(n.score, lang, 2)}).` : '',
              `- ${hoaxLine(x, lang)}`,
            ]
      return jvWrap(
        ctx,
        {
          text: lines.filter(Boolean).join('\n'),
          toolCalls: [
            {
              name: 'baca_pantauan',
              input: { jam: x.now, jendela: '24 jam' },
              output: { mention: x.kpis.mentions24h, topik: x.topics.length },
            },
          ],
          followUps:
            lang === 'id'
              ? ['Isu negatif terbesar apa?', 'Ada hoaks?', 'Tren sentimen 24 jam']
              : ['What is the top negative issue?', 'Is there a hoax?', 'Sentiment trend, 24 h'],
        },
        ['Isu dina iki wis tak rangkum, Bapak/Ibu.', 'Isu hari ini sudah saya rangkum, Bapak/Ibu.', 'I have summarised today’s issues.'],
      )
    },
  },
  {
    id: 'isu-negatif',
    examples: [
      'isu negatif terbesar',
      'topik apa yang paling banyak dikeluhkan',
      'keluhan paling ramai',
      'isu paling buruk hari ini',
      'top negative issue',
      'what are people complaining about most',
      'worst issue today',
      'isu sing paling elek',
      'warga paling akeh sambat babagan opo',
    ],
    respond: (ctx) => {
      const x = w(ctx)
      const lang = ctx.lang
      if (!x) return noData(lang)
      const n = top(x)
      if (!n)
        return {
          text: lang === 'id' ? 'Tidak ada topik yang rata-ratanya negatif dalam 24 jam terakhir.' : 'No topic averages negative in the last 24 hours.',
          followUps: lang === 'id' ? ['Ringkas isu hari ini'] : ["Summarise today's issues"],
        }
      return jvWrap(
        ctx,
        {
          text:
            lang === 'id'
              ? `Isu negatif terbesar adalah **${n.label.id}**: ${n.count} mention, jangkauan ±${nf(n.reach, lang)} akun, skor sentimen ${nf(n.score, lang, 2)}. Saran: siapkan informasi resmi yang menjawab keluhan ini dan pantau ulang dalam 3 jam.`
              : `The biggest negative issue is **${n.label.en}**: ${n.count} mentions, reach ≈ ${nf(n.reach, lang)} accounts, sentiment score ${nf(n.score, lang, 2)}. Suggestion: prepare official information that answers it and re-check in 3 hours.`,
          toolCalls: [
            {
              name: 'klaster_topik',
              input: { urut: 'sentimen' },
              output: { topik: n.topic, mention: n.count },
            },
          ],
          followUps:
            lang === 'id'
              ? [`Analisis kata kunci ${n.label.id.toLowerCase()}`, 'Pertanyaan survei untuk isu ini']
              : [`Analyse the keyword ${n.label.en.toLowerCase()}`, 'Survey questions for this issue'],
        },
        [`Sing paling akeh disambat yaiku ${n.label.id}.`, `Yang paling banyak dikeluhkan adalah ${n.label.id}.`, `The most complained-about issue is ${n.label.en}.`],
      )
    },
  },
  {
    id: 'status-hoaks',
    examples: [
      'ada hoaks',
      'apakah ada hoaks hari ini',
      'status peringatan hoaks',
      'ada berita bohong yang menyebar',
      'is there a hoax',
      'any fake news spreading',
      'hoax status',
      'ana hoaks ora',
      'wonten kabar hoaks mboten',
    ],
    respond: (ctx) => {
      const x = w(ctx)
      const lang = ctx.lang
      if (!x) return noData(lang)
      return jvWrap(
        ctx,
        {
          text:
            hoaxLine(x, lang) +
            (x.hoax?.status === 'aktif' ? (lang === 'id' ? ' Saya bisa langsung menyusun klarifikasinya.' : ' I can draft the clarification right away.') : ''),
          toolCalls: [
            {
              name: 'cek_hoaks',
              input: { narasi: 'semua' },
              output: { aktif: x.hoax?.status === 'aktif' },
            },
          ],
          followUps:
            x.hoax?.status === 'aktif'
              ? lang === 'id'
                ? ['Apa buktinya bendungan aman?', 'Susun klarifikasi nada tegas']
                : ['What is the evidence the dam is safe?', 'Draft a firm clarification']
              : lang === 'id'
                ? ['Ringkas isu hari ini']
                : ["Summarise today's issues"],
        },
        x.hoax?.status === 'aktif'
          ? ['Wonten hoaks ingkang nyebar, Bapak/Ibu.', 'Ada hoaks yang menyebar, Bapak/Ibu.', 'A hoax is spreading.']
          : ['Dereng wonten hoaks ingkang aktif.', 'Belum ada hoaks yang aktif.', 'No active hoax yet.'],
      )
    },
  },
  {
    id: 'bukti-hoaks',
    examples: [
      'apa buktinya bendungan aman',
      'bukti bahwa kabar bendungan jebol itu hoaks',
      'data tinggi muka air bendungan',
      'cek fakta bendungan jebol',
      'what is the evidence the dam is safe',
      'prove the dam did not burst',
      'dam water level data',
      'buktine bendungan aman apa',
      'tenan ora bendungan jebol',
    ],
    respond: (ctx) => {
      const x = w(ctx)
      const lang = ctx.lang
      if (!x) return noData(lang)
      const d = x.dam
      if (!d)
        return {
          text: lang === 'id' ? 'Data pos pantau bendungan tidak tersedia.' : 'No dam gauge data available.',
        }
      return jvWrap(
        ctx,
        {
          text:
            lang === 'id'
              ? `Bukti pembanding dari Siaga Wilayah (pos pantau ${d.name}, pukul ${tm(d.updatedAt, lang)}, data simulasi): tinggi muka air ${nf(d.level, lang, 2)} m, normal ${nf(d.normal, lang, 1)} m, batas siaga ${nf(d.siaga, lang, 1)} m, batas awas ${nf(d.awas, lang, 1)} m. Tidak ada laporan kerusakan bendungan dan tidak ada klaster aduan di sekitarnya. Kesimpulan: klaim jebol tidak didukung data.`
              : `Counter-evidence from Siaga Wilayah (${d.name} gauge, ${d.updatedAt}, simulated data): water level ${nf(d.level, lang, 2)} m, normal ${nf(d.normal, lang, 1)} m, alert ${nf(d.siaga, lang, 1)} m, danger ${nf(d.awas, lang, 1)} m. No dam damage reported and no complaint cluster nearby. Conclusion: the burst claim is not supported by the data.`,
          toolCalls: [
            {
              name: 'siaga_wilayah.tinggi_muka_air',
              input: { pos: d.name },
              output: { level: d.level, siaga: d.siaga },
            },
          ],
          followUps:
            lang === 'id' ? ['Susun klarifikasi nada menenangkan', 'Siapa akun penyebar awal?'] : ['Draft a reassuring clarification', 'Who were the first spreaders?'],
        },
        [
          'Bendungan aman, Bapak/Ibu: banyune isih ngisor batas siaga.',
          'Bendungan aman, Bapak/Ibu: airnya masih di bawah batas siaga.',
          'The dam is safe: the water is still below the alert level.',
        ],
      )
    },
  },
  {
    id: 'klarifikasi',
    examples: [
      'susun klarifikasi',
      'buat klarifikasi nada tegas',
      'susun klarifikasi nada menenangkan untuk hoaks bendungan',
      'buatkan rilis pers bantahan hoaks',
      'klarifikasi informatif',
      'draft a clarification',
      'write a firm clarification for the hoax',
      'draft a reassuring press release',
      'informative clarification',
      'gawekna klarifikasi',
      'tulung gawe bantahan hoaks bendungan',
    ],
    slots: {
      tone: ['tegas', 'menenangkan', 'informatif', 'firm', 'reassuring', 'calm', 'informative', 'tenang', 'keras'],
    },
    respond: (ctx, slots) => {
      const x = w(ctx)
      const lang = ctx.lang
      if (!x) return noData(lang)
      if (!x.hoax)
        return {
          text:
            lang === 'id'
              ? 'Belum ada hoaks yang terdeteksi untuk diklarifikasi. Picu skenario “bendungan jebol” atau tunggu pukul 10.00.'
              : 'No hoax has been detected to clarify yet. Trigger the “dam burst” scenario or wait for 10:00.',
          followUps: lang === 'id' ? ['Ada hoaks?'] : ['Is there a hoax?'],
        }
      const tone = toneFromText(slots.tone ?? ctx.text)
      const c = clarification(x, tone, lang)
      const T = CLARIFY_TEXT[lang]
      return jvWrap(
        ctx,
        {
          text: fill(T.answer, {
            tone: T.tone[tone],
            level: nf(x.dam?.level ?? 0, lang, 1),
            siaga: nf(x.dam?.siaga ?? 0, lang, 1),
          }),
          toolCalls: [
            {
              name: 'siaga_wilayah.tinggi_muka_air',
              input: { pos: x.dam?.name ?? '' },
              output: { level: x.dam?.level, siaga: x.dam?.siaga },
              ms: 380,
            },
            {
              name: 'susun_klarifikasi',
              input: { nada: tone, kanal: 'rilis, caption, infografis' },
              ms: 620,
            },
          ],
          structured: { kind: 'clarification', data: { ...c } },
          followUps: lang === 'id' ? ['Kapan sebaiknya diterbitkan?', 'Siapa akun penyebar awal?'] : ['When should it go out?', 'Who were the first spreaders?'],
        },
        ['Klarifikasi sampun kula damelaken.', 'Klarifikasi sudah saya buatkan.', 'I have drafted the clarification.'],
      )
    },
  },
  {
    id: 'nilai-unggahan',
    examples: [
      'nilai unggahan ini',
      'apakah unggahan ini hoaks',
      'cek unggahan ini',
      'nilai sentimen kalimat ini',
      'assess this post',
      'is this post a hoax',
      'check this message',
      'please assess this post',
      'rate this social media post',
      'evaluate this mention',
      'tulung dinilai unggahan iki',
      'tulung dicek unggahan iki',
    ],
    respond: (ctx) => {
      const x = w(ctx)
      const lang = ctx.lang
      const a = assess(ctx.text, x, lang)
      const pct = Math.round(a.hoaxLikelihood * 100)
      return jvWrap(
        ctx,
        {
          text:
            lang === 'id'
              ? `Penilaian: sentimen ${a.sentiment}, topik ${a.topic}, kemungkinan hoaks ${pct}%. ${pct >= 60 ? 'Perlakukan sebagai belum terverifikasi dan siapkan klarifikasi bila menyebar.' : 'Tidak ada tanda kuat hoaks; tetap pantau.'}`
              : `Assessment: ${a.sentiment === 'negatif' ? 'negative' : a.sentiment === 'positif' ? 'positive' : 'neutral'} sentiment, topic ${a.topic}, hoax likelihood ${pct}%. ${pct >= 60 ? 'Treat it as unverified and prepare a clarification if it spreads.' : 'No strong hoax signs; keep monitoring.'}`,
          toolCalls: [
            {
              name: 'nilai_mention',
              input: { panjang: ctx.text.length },
              output: { sentimen: a.sentiment, hoaks: a.hoaxLikelihood },
            },
          ],
          structured: { kind: 'sentiment', data: a },
          followUps: lang === 'id' ? ['Apa buktinya bendungan aman?', 'Ringkas isu hari ini'] : ['What is the evidence the dam is safe?', "Summarise today's issues"],
        },
        ['Unggahan iki wis tak nilai.', 'Unggahan ini sudah saya nilai.', 'I have assessed this post.'],
      )
    },
  },
  {
    id: 'tren-sentimen',
    examples: [
      'bagaimana tren sentimen 24 jam',
      'sentimen naik atau turun',
      'grafik sentimen hari ini',
      'apakah sentimen sudah pulih',
      'sentiment trend',
      'is sentiment improving',
      'how did sentiment change today',
      'sentimen piye saiki',
      'sentimen mundhak opo mudhun',
    ],
    respond: (ctx) => {
      const x = w(ctx)
      const lang = ctx.lang
      if (!x) return noData(lang)
      const tr = x.sentimentTrend
      const first = tr[0]?.value ?? 0
      const last = tr[tr.length - 1]?.value ?? 0
      const low = tr.reduce((m, p) => (p.value < m.value ? p : m), tr[0] ?? { at: x.now, value: 0 })
      return jvWrap(
        ctx,
        {
          text:
            lang === 'id'
              ? `Indeks sentimen bergerak dari ${signed(first, lang)} ke ${signed(last, lang)} dalam 24 jam; titik terendah ${signed(low.value, lang)} pukul ${tm(low.at, lang)}. ${x.hoax?.status === 'diklarifikasi' ? 'Setelah klarifikasi terbit, kurva berbalik naik.' : x.hoax ? 'Penurunan tajam terjadi saat hoaks menyebar.' : ''}`
              : `The sentiment index moved from ${signed(first, lang)} to ${signed(last, lang)} over 24 h; the low was ${signed(low.value, lang)} at ${low.at}. ${x.hoax?.status === 'diklarifikasi' ? 'After the clarification went out, the curve turned up.' : x.hoax ? 'The sharp drop came when the hoax spread.' : ''}`,
          toolCalls: [
            {
              name: 'deret_sentimen',
              input: { jam: 24 },
              output: { awal: first, akhir: last },
            },
          ],
          followUps: lang === 'id' ? ['Isu negatif terbesar apa?'] : ['What is the top negative issue?'],
        },
        [
          `Sentimen saiki ${last <= -20 ? 'condhong elek' : last >= 20 ? 'condhong apik' : 'biasa wae'}.`,
          `Sentimen sekarang ${word(last, 'id')}.`,
          `Sentiment is ${word(last, 'en')} now.`,
        ],
      )
    },
  },
  {
    id: 'analisis-kata-kunci',
    examples: [
      'analisis kata kunci banjir',
      'analisis mendalam harga cabai',
      'tren percakapan jalan rusak 7 hari',
      'analisa topik layanan ktp',
      'analyse the keyword',
      'keyword analysis of roads',
      'deep analysis of chilli prices',
      'conversation trend for damaged roads',
      'analisa tembung banjir',
      'piye omongane wong babagan rega cabe',
    ],
    slots: { keyword: KW_RE },
    respond: (ctx, slots) => {
      const x = w(ctx)
      const lang = ctx.lang
      if (!x) return noData(lang)
      const kw = (cleanKw(slots.keyword) ?? kwOf(ctx.text) ?? x.topics[0]?.label[lang] ?? 'banjir').trim().toLowerCase()
      const t = x.topics.find((p) => p.label.id.toLowerCase().includes(kw) || p.label.en.toLowerCase().includes(kw) || p.topic.includes(kw))
      const score = t?.score ?? -0.1
      const neg = Math.max(0.05, Math.min(0.85, 0.33 - score * 0.45))
      const pos = Math.max(0.05, Math.min(0.85, 0.3 + score * 0.42))
      const neu = Math.max(0, 1 - neg - pos)
      const data = {
        keywords: [kw],
        periodDays: 7,
        volumeTrend: (t && t.count >= 4 ? 'naik' : 'stabil') as 'naik' | 'stabil',
        sentiment: {
          negatif: Math.round(neg * 100) / 100,
          netral: Math.round(neu * 100) / 100,
          positif: Math.round(pos * 100) / 100,
        },
        topics: [
          { label: t ? t.label[lang] : kw, share: 0.6 },
          {
            label: lang === 'id' ? 'Respons pemda' : 'Government response',
            share: 0.4,
          },
        ],
        quotes: x.latest
          .filter((m) => !t || m.topic === t.topic)
          .slice(0, 2)
          .map((m) => m.text[lang]),
        surveyQuestions: [lang === 'id' ? `Seberapa penting isu “${kw}” bagi keluarga Anda? (1–5)` : `How important is the “${kw}” issue for your family? (1–5)`],
      }
      return jvWrap(
        ctx,
        {
          text:
            lang === 'id'
              ? `Ringkasan cepat “${kw}” (7 hari, simulasi): ${t ? `${t.count} mention 24 jam terakhir, skor ${nf(score, lang, 2)}` : 'belum ada mention di 24 jam terakhir'}; ${Math.round(neg * 100)}% negatif. Untuk volume per hari, momentum, kutipan, dan ekspor XLSX, buka tab Analisis Mendalam.`
              : `Quick read of “${kw}” (7 days, simulated): ${t ? `${t.count} mentions in the last 24 h, score ${nf(score, lang, 2)}` : 'no mentions in the last 24 h'}; ${Math.round(neg * 100)}% negative. For daily volume, momentum, quotes and the XLSX export, open the Deep Analysis tab.`,
          toolCalls: [{ name: 'analisis_topik', input: { kata_kunci: kw, hari: 7 } }],
          structured: { kind: 'analysis', data },
          followUps: lang === 'id' ? ['Pertanyaan survei untuk isu ini'] : ['Survey questions for this issue'],
        },
        [`Omongan babagan “${kw}” wis tak analisa.`, `Percakapan tentang “${kw}” sudah saya analisis.`, `I have analysed the talk about “${kw}”.`],
      )
    },
  },
  {
    id: 'banjir',
    examples: [
      'isu banjir bagaimana',
      'percakapan soal banjir',
      'warga membicarakan banjir',
      'dampak banjir di media',
      'how is the flood conversation',
      'what are people saying about the flood',
      'flood topic',
      'kabar banjir piye',
      'wong-wong ngomongke banjir',
    ],
    respond: (ctx) => {
      const x = w(ctx)
      const lang = ctx.lang
      if (!x) return noData(lang)
      const b = x.topics.find((t) => t.topic === 'banjir')
      const al = x.floodAlert
      return jvWrap(
        ctx,
        {
          text:
            lang === 'id'
              ? `Topik banjir: ${b ? `${b.count} mention 24 jam, skor ${nf(b.score, lang, 2)}` : 'belum ramai dalam 24 jam'}. ${al ? `Siaga Wilayah mengeluarkan peringatan level ${al.level} untuk ${al.kecamatan.join(', ')}.` : 'Belum ada peringatan banjir aktif dari Siaga Wilayah.'} ${x.complaintClusters ? `Sapa Warga mencatat ${x.complaintClusters} klaster aduan banjir.` : ''}`
              : `Flood topic: ${b ? `${b.count} mentions in 24 h, score ${nf(b.score, lang, 2)}` : 'quiet over the last 24 h'}. ${al ? `Siaga Wilayah issued a level ${al.level} warning for ${al.kecamatan.join(', ')}.` : 'No active flood warning from Siaga Wilayah yet.'} ${x.complaintClusters ? `Sapa Warga recorded ${x.complaintClusters} flood complaint clusters.` : ''}`,
          toolCalls: [
            {
              name: 'gabung_sumber',
              input: { produk: ['siaga-wilayah', 'sapa-warga'] },
            },
          ],
          followUps: lang === 'id' ? ['Analisis kata kunci banjir'] : ['Analyse the keyword flood'],
        },
        al
          ? ['Wonten peringatan banjir, Bapak/Ibu.', 'Ada peringatan banjir, Bapak/Ibu.', 'There is a flood warning.']
          : ['Dereng wonten peringatan banjir.', 'Belum ada peringatan banjir.', 'No flood warning yet.'],
      )
    },
  },
  {
    id: 'waktu-respons',
    examples: [
      'kapan sebaiknya klarifikasi diterbitkan',
      'seberapa cepat harus merespons',
      'kapan waktu terbaik menerbitkan',
      'perlu segera dijawab tidak',
      'when should it go out',
      'when should we respond',
      'how fast must we respond',
      'kapan kudu dijawab',
      'enggal dijawab napa mboten',
    ],
    respond: (ctx) => {
      const x = w(ctx)
      const lang = ctx.lang
      if (!x) return noData(lang)
      const urgent = x.hoax?.status === 'aktif'
      return jvWrap(
        ctx,
        {
          text: urgent
            ? lang === 'id'
              ? `Segera, dalam 30 menit. Narasi ini menyebar ±${nf(x.hoax!.spreadPerHour, lang)} jangkauan per jam; setiap jam penundaan menambah orang yang percaya. Terbitkan dulu di kanal resmi, lalu teruskan ke grup WA RT/RW agar menyusul jalur penyebarannya.`
              : `Now, within 30 minutes. The narrative spreads at ≈ ${nf(x.hoax!.spreadPerHour, lang)} reach per hour; every hour of delay adds believers. Publish on the official channels first, then push to neighbourhood WhatsApp groups so it follows the rumour’s path.`
            : lang === 'id'
              ? 'Tidak ada isu yang perlu dijawab mendesak. Untuk isu rutin, jawab dalam 1×24 jam pada jam ramai (07.00–09.00 atau 19.00–21.00).'
              : 'Nothing needs an urgent answer. For routine issues, respond within 24 hours at peak times (07:00–09:00 or 19:00–21:00).',
          followUps: urgent ? (lang === 'id' ? ['Susun klarifikasi nada tegas'] : ['Draft a firm clarification']) : [],
        },
        urgent
          ? ['Kedah enggal, Bapak/Ibu.', 'Harus segera, Bapak/Ibu.', 'It must be soon.']
          : ['Mboten kedah enggal-enggalan.', 'Tidak perlu terburu-buru.', 'No need to rush.'],
      )
    },
  },
  {
    id: 'survei',
    examples: [
      'pertanyaan survei',
      'rekomendasi pertanyaan survei untuk isu ini',
      'buat kuesioner singkat',
      'apa yang perlu ditanyakan ke warga',
      'survey questions',
      'suggest survey questions for this issue',
      'write a short questionnaire',
      'pitakonan survei',
      'takon opo marang warga',
    ],
    respond: (ctx) => {
      const x = w(ctx)
      const lang = ctx.lang
      if (!x) return noData(lang)
      const n = top(x)
      const label = n ? n.label[lang].toLowerCase() : lang === 'id' ? 'layanan publik' : 'public services'
      const qs =
        lang === 'id'
          ? [
              `Seberapa puas Anda dengan penanganan ${label} bulan ini? (1–5)`,
              `Dari mana Anda biasa mendapat informasi tentang ${label}?`,
              `Apa satu perbaikan ${label} yang paling Anda harapkan?`,
            ]
          : [
              `How satisfied are you with how ${label} is handled this month? (1–5)`,
              `Where do you usually get information about ${label}?`,
              `What one improvement on ${label} do you want most?`,
            ]
      return jvWrap(
        ctx,
        {
          text: (lang === 'id' ? `Tiga pertanyaan survei untuk isu ${label}:\n` : `Three survey questions on ${label}:\n`) + qs.map((q) => `- ${q}`).join('\n'),
          followUps: lang === 'id' ? ['Ringkas isu hari ini'] : ["Summarise today's issues"],
        },
        ['Pitakonan survei sampun cumepak.', 'Pertanyaan survei sudah siap.', 'The survey questions are ready.'],
      )
    },
  },
  {
    id: 'penyebar',
    examples: [
      'siapa akun penyebar awal',
      'akun mana yang pertama menyebarkan',
      'dari mana hoaks ini berasal',
      'sumber awal narasi',
      'who were the first spreaders',
      'which accounts started it',
      'where did the hoax start',
      'sing nyebar sopo',
      'akun endi sing pisanan nyebar',
    ],
    respond: (ctx) => {
      const x = w(ctx)
      const lang = ctx.lang
      if (!x) return noData(lang)
      if (!x.hoax) return { text: hoaxLine(x, lang) }
      return jvWrap(
        ctx,
        {
          text:
            lang === 'id'
              ? `Unggahan pertama tercatat pukul ${tm(x.hoax.firstPostAt ?? x.hoax.detectedAt, lang)}, lalu menyebar lewat ${x.hoax.accounts.join(', ')} (akun fiktif). Saran: jangan menyerang atau melaporkan akun, cukup luruskan informasinya di kanal yang sama dengan bahasa yang mudah dibagikan.`
              : `The first post was logged at ${x.hoax.firstPostAt ?? x.hoax.detectedAt}, then spread via ${x.hoax.accounts.join(', ')} (fictional accounts). Advice: do not attack or report the accounts; correct the information on the same channels in easy-to-share language.`,
          followUps: lang === 'id' ? ['Susun klarifikasi nada informatif'] : ['Draft an informative clarification'],
        },
        ['Akun-akun punika fiktif, Bapak/Ibu.', 'Akun-akun itu fiktif, Bapak/Ibu.', 'Those accounts are fictional.'],
      )
    },
  },
  {
    id: 'media',
    examples: [
      'media mana yang paling banyak memberitakan',
      'sumber mention terbanyak',
      'outlet paling aktif',
      'akun yang paling sering muncul',
      'which outlets cover us most',
      'most active sources',
      'top outlets today',
      'media endi sing paling akeh',
      'sumber kabar sing paling rame',
    ],
    respond: (ctx) => {
      const x = w(ctx)
      const lang = ctx.lang
      if (!x) return noData(lang)
      const list = x.outlets.map((o) => `${o.outlet} (${o.count})`).join(', ')
      return jvWrap(
        ctx,
        {
          text: lang === 'id' ? `Sumber paling aktif 24 jam terakhir (fiktif): ${list}.` : `Most active sources in the last 24 h (fictional): ${list}.`,
          followUps: lang === 'id' ? ['Ringkas isu hari ini'] : ["Summarise today's issues"],
        },
        ['Iki sumber sing paling rame.', 'Ini sumber yang paling ramai.', 'These are the busiest sources.'],
      )
    },
  },
  {
    id: 'laporan',
    examples: [
      'buat laporan harian',
      'siapkan laporan untuk pimpinan',
      'ekspor laporan',
      'unduh data pantauan',
      'daily report',
      'prepare a report for the regional head',
      'export the data',
      'gawekna laporan',
      'laporan kanggo pimpinan',
    ],
    respond: (ctx) => {
      const x = w(ctx)
      const lang = ctx.lang
      if (!x) return noData(lang)
      return jvWrap(
        ctx,
        {
          text:
            lang === 'id'
              ? `Laporan harian sudah tersusun otomatis di tab Laporan: ${nf(x.kpis.mentions24h, lang)} mention, indeks sentimen ${signed(x.kpis.sentimentIndex, lang)}, ${x.topics.length} topik, status hoaks, dan rekomendasi. Cetak/PDF, XLSX, dan JSON tersedia di sana.`
              : `The daily report is already assembled in the Report tab: ${nf(x.kpis.mentions24h, lang)} mentions, sentiment index ${signed(x.kpis.sentimentIndex, lang)}, ${x.topics.length} topics, hoax status and recommendations. Print/PDF, XLSX and JSON are there.`,
        },
        ['Laporan sampun cumepak.', 'Laporan sudah siap.', 'The report is ready.'],
      )
    },
  },
]

function fill(s: string, v: Record<string, string>): string {
  return s.replace(/\{(\w+)\}/g, (m, k: string) => v[k] ?? m)
}

const byId = new Map(intents.map((i) => [i.id, i]))
const forcedIntent = (text: string) => {
  for (const [re, id] of FORCE) if (re.test(text)) return byId.get(id)
  return undefined
}
const routed: Intent<RadarCtx>[] = intents.map((it) => ({
  ...it,
  respond: (ctx, slots) => {
    const f = forcedIntent(ctx.text)
    return f && f.id !== it.id ? f.respond(ctx, {}) : it.respond(ctx, slots)
  },
}))

export const SCENARIO: Scenario<RadarCtx> = {
  product: 'radar-isu',
  intents: routed,
  fallback: (ctx) =>
    forcedIntent(ctx.text)?.respond(ctx, {}) ?? {
      text:
        ctx.lang === 'id'
          ? 'Maaf, saya belum memahami pertanyaan itu. Saya bisa meringkas isu hari ini, memeriksa hoaks dan buktinya, menilai sebuah unggahan, menyusun klarifikasi, atau menganalisis kata kunci.'
          : 'Sorry, I did not catch that. I can summarise today’s issues, check a hoax and its evidence, assess a post, draft a clarification or analyse a keyword.',
      followUps:
        ctx.lang === 'id'
          ? ['Ringkas isu hari ini', 'Ada hoaks?', 'Analisis kata kunci banjir']
          : ["Summarise today's issues", 'Is there a hoax?', 'Analyse the keyword flood'],
    },
}

registerScenario(SCENARIO)
