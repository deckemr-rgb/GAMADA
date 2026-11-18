/**
 * demos/meja-pimpinan/scenario.ts — the Simulasi scenario of "Tanya data" (spec §9.2, P2): 17 intents over the
 * live world — trend, compare, rank, cause, simple forecast, plus overview, briefing and instruction drafting.
 * Examples in Indonesian, English and Basa Jawa. Every number in an answer is computed from the world at the
 * moment of the question; charts come from the same `query` spec the Live tool `query_world` uses (query.ts).
 * Registered when the chat chunk loads (AskData.tsx), never with the page.
 */
import type { Intent, Scenario, SimContext, SimResponse, Lang } from '../../demo-kit/ai/chat'
import { CATEGORY_LABEL, DAY_MIN, clock, negativeIssues, overdueActions, rows, world, type Bi, type ComplaintCategory, type Minutes, type WorldState } from '../../demo-kit/world'
import { complaintsByKecamatan, kpiStrip } from '../../demo-kit/world/satu-daerah'
import { OPD_MIN_SAMPLE, causeQuestion, devOf, kecName, mpBriefingItems, mpLeaderboard, mpServiceIndex, opdShort, riverNow, riverState, type RiverNow } from './data'
import { opdsInText, riskRank, riskiestProcurement, topRiser } from './data-ext'
import type { AskContext } from './ideas'
import { categoryOf, forecastOf, runQuery, type QueryResult, type QuerySpec, type Range } from './query'
import { regionLabel, topicLabel } from './strings'

/* ------------------------------------------------------------------ helpers */

function ws(ctx: SimContext): { s: WorldState; now: Minutes } {
  const c = ctx.world as AskContext | null
  return { s: c?.state ?? world.get(), now: c?.now ?? clock.get().minutes }
}
const nf = (lang: Lang, n: number, d = 0) => n.toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB', { maximumFractionDigits: d, minimumFractionDigits: 0 })
/** one decimal, always shown (16,0 m like the briefing, not 16 m) */
const nf1 = (lang: Lang, n: number) => n.toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
/** the river sentence every flood answer starts with: the briefing's reading, status and thresholds */
function riverFacts(r: RiverNow, L: Lang): string {
  const st = riverState(r.state)
  return L === 'id'
    ? `Muka air ${r.name.id} ${nf1(L, r.level)} m, ${r.rise24 >= 0 ? 'naik' : 'turun'} ${nf1(L, Math.abs(r.rise24))} m dalam 24 jam; status ${st.id}. Batas siaga ${nf1(L, r.siaga)} m, awas ${nf1(L, r.awas)} m (data simulasi).`
    : `${r.name.en} at ${nf1(L, r.level)} m, ${r.rise24 >= 0 ? 'up' : 'down'} ${nf1(L, Math.abs(r.rise24))} m in 24 h; status ${st.en}. Thresholds: alert ${nf1(L, r.siaga)} m, danger ${nf1(L, r.awas)} m (simulated data).`
}
const pct = (lang: Lang, a: number, b: number) => (b > 0 ? `${a >= b ? '+' : '−'}${nf(lang, Math.abs(((a - b) / b) * 100))}%` : a > 0 ? (lang === 'id' ? 'baru muncul' : 'new') : '0%')
const norm = (x: string) => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

/** the period named in the question; null when none ("bulan ini" → 30 days, "minggu ini" → 7 days, "hari ini" → today) */
export function rangeInText(text: string): Range | null {
  const t = ` ${norm(text)} `
  if (/ (hari ini|today|dina iki|saiki) /.test(t)) return 'today'
  if (/ (bulan ini|sebulan|30 hari|this month|30 days|past month|last month|sasi iki|wulan iki) /.test(t)) return '30d'
  if (/ (minggu ini|pekan ini|seminggu|sepekan|7 hari|this week|7 days|past week|minggu iki) /.test(t)) return '7d'
  return null
}
const RANGE_WORDS: Record<Range, Bi> = {
  today: { id: 'hari ini', en: 'today' },
  '7d': { id: '7 hari terakhir', en: 'in the last 7 days' },
  '30d': { id: '30 hari terakhir', en: 'in the last 30 days' },
  '90d': { id: '90 hari terakhir', en: 'in the last 90 days' },
}
const PREV_WORDS: Record<Range, Bi> = {
  today: { id: 'kemarin pada jam yang sama', en: 'yesterday at the same time' },
  '7d': { id: 'pekan sebelumnya', en: 'the week before' },
  '30d': { id: '30 hari sebelumnya', en: 'the 30 days before' },
  '90d': { id: '90 hari sebelumnya', en: 'the 90 days before' },
}
/** complaints in the window of `range` up to now, and in the window before it */
function countWindow(s: WorldState, now: Minutes, range: Range, keep: (c: WorldState['complaints']['byId'][string]) => boolean): { cur: number; prev: number } {
  const from = range === 'today' ? Math.floor(now / DAY_MIN) * DAY_MIN : now - ({ '7d': 7, '30d': 30, '90d': 90 } as const)[range] * DAY_MIN
  const span = now - from
  let cur = 0
  let prev = 0
  for (const c of rows(s.complaints)) {
    if (!keep(c)) continue
    if (c.at > from && c.at <= now) cur++
    else if (range === 'today' ? c.at > from - DAY_MIN && c.at <= now - DAY_MIN : c.at > from - span && c.at <= from) prev++
  }
  return { cur, prev }
}
/** the complaint category that rose most over `range` (null when none rose) */
function topRiserCat(s: WorldState, now: Minutes, range: Range, not?: ComplaintCategory): { cat: ComplaintCategory; cur: number; prev: number } | null {
  let best: { cat: ComplaintCategory; cur: number; prev: number } | null = null
  for (const cat of Object.keys(CATEGORY_LABEL) as ComplaintCategory[]) {
    if (cat === 'lainnya' || cat === not) continue
    const w = countWindow(s, now, range, (c) => c.category === cat)
    if (w.cur > w.prev && (!best || w.cur - w.prev > best.cur - best.prev)) best = { cat, ...w }
  }
  return best
}

/** kecamatan named in the question (the region's own name does not count unless "kecamatan" / "district" is said) */
export function kecInText(s: WorldState, text: string): string[] {
  const t = ` ${norm(text)} `
  const explicit = /\b(kec|kecamatan|district|distrik)\b/i.test(text)
  return s.region.kecamatan
    .filter((k) => t.includes(` ${norm(k.name)} `) && (explicit || norm(k.name) !== norm(s.region.shortName)))
    .sort((a, b) => t.indexOf(` ${norm(a.name)} `) - t.indexOf(` ${norm(b.name)} `))
    .map((k) => k.id)
}

/** one "agent step" chip for the query, with the row count as output */
function step(spec: QuerySpec, r: QueryResult): NonNullable<SimResponse['toolCalls']>[number] {
  return { name: 'query_world', input: { ...spec }, output: { rows: r.rows.length || r.values?.length || 0, total: r.total }, ms: 180 + ((r.rows.length * 37) % 220) }
}
const query = (spec: QuerySpec) => ({ kind: 'query', data: { ...spec } as Record<string, unknown> })

const F = {
  id: {
    cause: 'Kenapa aduan jalan naik minggu ini?',
    rank: 'Kecamatan mana paling banyak aduan?',
    slow: 'OPD mana yang paling lambat?',
    forecast: 'Perkiraan aduan 3 hari ke depan',
    flood: 'Bagaimana status banjir?',
    issues: 'Isu apa yang sedang ramai?',
    prices: 'Harga apa yang naik minggu ini?',
    overdue: 'Tindak lanjut apa yang terlambat?',
    briefing: 'Susun briefing pagi',
    procurement: 'Paket pengadaan mana yang berisiko?',
    sla: 'Bagaimana tren SLA 30 hari?',
    index: 'Kenapa indeks layanan segini?',
  },
  en: {
    cause: 'Why are road complaints up this week?',
    rank: 'Which district has the most complaints?',
    slow: 'Which agency is the slowest?',
    forecast: 'Forecast complaints for the next 3 days',
    flood: "What's the flood situation?",
    issues: 'What issues are trending?',
    prices: 'Which prices rose this week?',
    overdue: 'Which follow-ups are overdue?',
    briefing: 'Compose the morning briefing',
    procurement: 'Which procurement packages are risky?',
    sla: 'How is the 30-day SLA trend?',
    index: 'Why is the service index at this level?',
  },
}
/** example chips; "cause" asks about the category that REALLY rose this week (never one that did not), or is left out */
const chips = (lang: Lang, ...k: (keyof (typeof F)['id'])[]) =>
  k.flatMap((x) => {
    if (x !== 'cause') return [F[lang][x]]
    const r = topRiserCat(world.get(), clock.get().minutes, '7d')
    return r ? [causeQuestion(r.cat)[lang]] : []
  })
/** a label mid-sentence: lower case, but acronyms stay ("PJU mati", not "pju mati") */
const lc = (t: string) => (/^[A-Z]{2}/.test(t) ? t : t.toLowerCase())
const catName = (c: ComplaintCategory, lang: Lang) => lc(CATEGORY_LABEL[c][lang])

/* ------------------------------------------------------------------ intents */

const intents: Intent[] = [
  {
    id: 'ringkasan-hari-ini',
    examples: [
      'Bagaimana kondisi daerah pagi ini?', 'Ringkas situasi hari ini', 'Apa yang perlu saya tahu hari ini?', 'Gambaran umum daerah sekarang',
      "Give me today's overview", 'How is the region doing this morning?', 'What should I know today?', 'Summarise the situation',
      'Piye kahanan daerah esuk iki?', 'Ringkesan kahanan dina iki',
    ],
    respond: (ctx) => {
      const { s, now } = ws(ctx)
      const k = kpiStrip(s, now)
      const top = complaintsByKecamatan(s, now, 1)[0]
      const late = overdueActions(s, now)
      const svc = mpServiceIndex(s, now)
      const si = svc.index
      const id = `Per pukul ${hh(now)}: ${k.complaints.today} aduan masuk hari ini (${k.complaints.delta >= 0 ? '+' : ''}${k.complaints.delta} dibanding kemarin pada jam yang sama)${top && top.count ? `, terbanyak di Kec. ${top.name} (${top.count})` : ''}. SLA tepat waktu ${svc.sla}%, ${k.alerts ? `${k.alerts} peringatan aktif` : 'belum ada peringatan banjir aktif'}, ${k.negativeIssues} topik isu negatif dalam 24 jam, dan ${late.length} tindak lanjut lewat tenggat. Indeks layanan ${si}/100.`
      const en = `As of ${hh(now)}: ${k.complaints.today} complaints today (${k.complaints.delta >= 0 ? '+' : ''}${k.complaints.delta} vs yesterday at the same time)${top && top.count ? `, most in ${top.name} (${top.count})` : ''}. SLA on time ${svc.sla}%, ${k.alerts ? `${k.alerts} active alerts` : 'no active flood alert yet'}, ${k.negativeIssues} negative issue topics in 24 h, and ${late.length} follow-ups past due. Service index ${si}/100.`
      const spec: QuerySpec = { metric: 'complaints', groupBy: 'category', range: 'today', chart: 'bar' }
      const r = runQuery(s, now, spec, ctx.lang)
      return { text: ctx.lang === 'id' ? id : en, structured: query(spec), toolCalls: [step(spec, r)], followUps: chips(ctx.lang, 'briefing', 'cause', 'flood') }
    },
  },
  {
    id: 'penyebab-kenaikan',
    examples: [
      'Kenapa aduan jalan naik minggu ini?', 'Mengapa aduan sampah meningkat?', 'Apa penyebab kenaikan aduan banjir?', 'Kenapa keluhan jalan rusak bertambah?', 'Aduan PJU kok naik terus?',
      'Why are road complaints up this week?', 'What is driving the rise in complaints?', 'Why did waste complaints increase?', 'What caused more flood reports?',
      'Kenging punapa aduan dalan mundhak minggu iki?', 'Kok aduan dalan rusak akeh saiki?',
    ],
    respond: (ctx) => {
      const { s, now } = ws(ctx)
      const L = ctx.lang
      const cat = categoryOf(ctx.text) ?? 'jalan-rusak'
      const range: Range = rangeInText(ctx.text) === '30d' ? '30d' : '7d'
      const kec = kecInText(s, ctx.text)
      const spec: QuerySpec = { metric: 'complaints', groupBy: 'kecamatan', range, filter: { category: cat, ...(kec.length ? { kecamatan: kec.join(',') } : {}) }, chart: 'bar' }
      const r = runQuery(s, now, spec, L)
      const { cur, prev } = countWindow(s, now, range, (c) => c.category === cat && (!kec.length || kec.includes(c.kecamatanId)))
      const top = r.rows[0]
      const name = catName(cat, L)
      const per = RANGE_WORDS[range][L]
      const before = PREV_WORDS[range][L]
      const place = kec.length ? (L === 'id' ? ` di ${kec.map((k) => `Kec. ${kecName(s, k)}`).join(', ')}` : ` in ${kec.map((k) => kecName(s, k)).join(', ')}`) : ''
      const instruct = L === 'id' ? `Instruksikan ${opdShort(s, s.region.categoryOpd[cat])} menangani ${name} di ${top?.label ?? s.region.shortName}` : `Instruct ${opdShort(s, s.region.categoryOpd[cat])} to handle ${lc(CATEGORY_LABEL[cat].en)} in ${top?.label ?? s.region.shortName}`
      if (cur <= prev) {
        // the premise is wrong: say so, give the numbers, and point at what DID rise (never explain a rise that did not happen)
        const other = topRiserCat(s, now, range, cat)
        const head = L === 'id'
          ? `Aduan ${name}${place} tidak naik: ${per} ada ${cur}, ${cur === prev ? 'sama dengan' : 'turun dari'} ${prev} pada ${before}${cur < prev ? ` (${pct(L, cur, prev)})` : ''}.`
          : `${CATEGORY_LABEL[cat].en} complaints${place} are not up: ${cur} ${per}, ${cur === prev ? 'the same as' : 'down from'} ${prev} ${before}${cur < prev ? ` (${pct(L, cur, prev)})` : ''}.`
        const tail = other
          ? L === 'id' ? ` Yang justru naik adalah aduan ${catName(other.cat, L)}: ${other.cur}, dari ${other.prev} (${pct(L, other.cur, other.prev)}).` : ` What did rise is ${lc(CATEGORY_LABEL[other.cat].en)}: ${other.cur}, from ${other.prev} (${pct(L, other.cur, other.prev)}).`
          : L === 'id' ? ' Tidak ada kategori aduan yang naik dalam periode ini.' : ' No complaint category rose in this period.'
        return { text: head + tail, structured: query(spec), toolCalls: [step(spec, r)], followUps: [...(other ? [causeQuestion(other.cat)[L]] : []), ...chips(L, 'rank', 'forecast')] }
      }
      // data-driven possible causes, each with its own number
      const winFrom = now - (range === '30d' ? 30 : 7) * DAY_MIN
      const floodK = new Set(rows(s.complaints).filter((c) => c.category === 'banjir' && c.at > winFrom && c.at <= now).map((c) => c.kecamatanId))
      const inFlood = rows(s.complaints).filter((c) => c.category === cat && c.at > winFrom && c.at <= now && floodK.has(c.kecamatanId) && (!kec.length || kec.includes(c.kecamatanId))).length
      const river = riverNow(s, now)
      const rising = river ? river.rise24 : 0
      const head = L === 'id'
        ? `Aduan ${name}${place} ${per}: ${cur}, naik dari ${prev} pada ${before} (${pct(L, cur, prev)}).`
        : `${CATEGORY_LABEL[cat].en} complaints${place} ${per}: ${cur}, up from ${prev} ${before} (${pct(L, cur, prev)}).`
      const where = top && !kec.length ? (L === 'id' ? ` Terbanyak di Kec. ${top.label} (${top.value}).` : ` Most in ${top.label} (${top.value}).`) : ''
      const causes: string[] = []
      if (inFlood && cat !== 'banjir') causes.push(L === 'id' ? `${inFlood} dari ${cur} aduan berada di kecamatan yang juga melaporkan banjir pada periode ini; genangan kemungkinan mempercepat kerusakan` : `${inFlood} of ${cur} come from districts that also reported flooding in this period; standing water probably speeds up the damage`)
      if (rising > 0.5 && (cat === 'banjir' || cat === 'air-bersih')) causes.push(L === 'id' ? `muka air ${river!.name.id} naik ${nf1(L, rising)} m dalam 24 jam, kini ${nf1(L, river!.level)} m (status ${riverState(river!.state).id}, data simulasi), menandakan hujan lebat di hulu` : `the ${river!.name.en} rose ${nf1(L, rising)} m in 24 h, now ${nf1(L, river!.level)} m (${riverState(river!.state).en}; simulated data), a sign of heavy rain upstream`)
      const why = causes.length ? (L === 'id' ? ` Kemungkinan penyebab (dari data): ${causes.join('; ')}.` : ` Likely causes (from the data): ${causes.join('; ')}.`) : L === 'id' ? ' Data belum menunjukkan penyebab yang jelas; periksa sebaran per kecamatan di grafik.' : ' The data shows no clear cause yet; check the spread by district in the chart.'
      return { text: head + where + why, structured: query(spec), toolCalls: [step(spec, r)], followUps: [instruct, ...chips(L, 'forecast', 'slow')] }
    },
  },
  {
    id: 'peringkat-kecamatan',
    examples: [
      'Kecamatan mana yang paling banyak aduan?', 'Peringkat kecamatan menurut jumlah aduan', 'Daerah mana paling banyak keluhan minggu ini?', 'Lima kecamatan dengan aduan terbanyak',
      'Which district has the most complaints?', 'Rank districts by complaints', 'Top districts by number of reports',
      'Kecamatan endi sing aduane paling akeh?', 'Wilayah endi sing paling akeh keluhan?',
    ],
    respond: (ctx) => {
      const { s, now } = ws(ctx)
      const cat = categoryOf(ctx.text)
      const range = rangeInText(ctx.text) ?? '7d'
      const spec: QuerySpec = { metric: 'complaints', groupBy: 'kecamatan', range, chart: 'bar', ...(cat ? { filter: { category: cat } } : {}) }
      const r = runQuery(s, now, spec, ctx.lang)
      const top3 = r.rows.filter((x) => x.value > 0).slice(0, 3).map((x) => `${x.label} (${x.value})`).join(', ')
      const L = ctx.lang
      const per = RANGE_WORDS[range][L]
      const text = r.total
        ? L === 'id' ? `Kecamatan dengan aduan${cat ? ` ${catName(cat, L)}` : ''} terbanyak ${per}: ${top3}. Total ${r.total} aduan di ${r.rows.filter((x) => x.value > 0).length} kecamatan. Peta saya arahkan ke ${r.rows[0]!.label}.` : `Districts with the most${cat ? ` ${lc(CATEGORY_LABEL[cat].en)}` : ''} complaints ${per}: ${top3}. ${r.total} complaints across ${r.rows.filter((x) => x.value > 0).length} districts. The map now shows ${r.rows[0]!.label}.`
        : L === 'id' ? `Belum ada aduan ${per} untuk kriteria itu.` : `No complaints ${per} for that criterion.`
      return { text, structured: query(spec), toolCalls: [step(spec, r)], followUps: chips(L, 'cause', 'forecast', 'slow') }
    },
  },
  {
    id: 'opd-paling-lambat',
    examples: [
      'OPD mana yang paling lambat?', 'Dinas mana SLA-nya paling rendah?', 'Siapa yang paling sering terlambat menyelesaikan tiket?', 'Peringkat OPD dari yang terburuk',
      'Which agency is the slowest?', 'Which office misses the SLA most?', 'Rank agencies by on-time resolution',
      'Dinas endi sing paling alon?', 'OPD endi sing paling kerep telat?',
    ],
    respond: (ctx) => {
      const { s, now } = ws(ctx)
      const spec: QuerySpec = { metric: 'sla_on_time', groupBy: 'opd', range: '30d', chart: 'bar' }
      const r = runQuery(s, now, spec, ctx.lang)
      const worst = r.rows[0]
      // the same rows and the same minimum-sample rule as the leaderboard on screen
      const lb = mpLeaderboard(s, now)
      const backlog = [...lb].sort((a, b) => b.lateTickets - a.lateTickets || b.openTickets - a.openTickets)[0]
      const thin = lb.filter((x) => x.slaPct === null).map((x) => x.short)
      const L = ctx.lang
      const text = worst
        ? L === 'id' ? `SLA tepat waktu terendah 30 hari terakhir: ${r.rows.slice(0, 3).map((x) => `${x.label} ${x.value}%`).join(', ')} (tiket terbuka yang lewat SLA ikut dihitung). ${backlog && backlog.lateTickets ? `Tiket lewat SLA terbanyak ada di ${backlog.short} (${backlog.lateTickets} dari ${backlog.openTickets} tiket terbuka).` : ''}${thin.length ? ` ${thin.length} OPD belum dinilai karena kurang dari ${OPD_MIN_SAMPLE} tiket (mis. ${thin.slice(0, 3).join(', ')}).` : ''} Klik OPD di papan peringkat untuk scorecard 30 hari.` : `Lowest on-time SLA over 30 days: ${r.rows.slice(0, 3).map((x) => `${x.label} ${x.value}%`).join(', ')} (open tickets past their SLA count too). ${backlog && backlog.lateTickets ? `Most tickets past SLA: ${backlog.short} (${backlog.lateTickets} of ${backlog.openTickets} open).` : ''}${thin.length ? ` ${thin.length} agencies are not rated, fewer than ${OPD_MIN_SAMPLE} tickets (e.g. ${thin.slice(0, 3).join(', ')}).` : ''} Click an agency on the leaderboard for its 30-day scorecard.`
        : L === 'id' ? 'Belum cukup tiket untuk menghitung SLA per OPD.' : 'Not enough tickets yet to compute SLA per agency.'
      return { text, structured: query(spec), toolCalls: [step(spec, r)], followUps: chips(L, 'overdue', 'sla', 'index') }
    },
  },
  {
    id: 'bandingkan-kecamatan',
    examples: [
      'Bandingkan Kalitidu dan Dander', 'Bandingkan aduan Trucuk dengan Kanor', 'Kalitidu versus Baureno', 'Perbandingan dua kecamatan',
      'Compare Kalitidu and Dander', 'How does Trucuk compare with Kanor?', 'Compare two districts',
      'Bandingna Kalitidu karo Dander', 'Luwih akeh endi aduane Trucuk karo Kanor?',
    ],
    respond: (ctx) => {
      const { s, now } = ws(ctx)
      const L = ctx.lang
      let ids = kecInText(s, ctx.text).slice(0, 4)
      if (ids.length < 2) ids = complaintsByKecamatan(s, now, 7).slice(0, 2).map((k) => k.kecamatanId)
      const spec: QuerySpec = { metric: 'complaints', groupBy: 'kecamatan', range: '7d', filter: { kecamatan: ids.join(',') }, chart: 'bar' }
      const r = runQuery(s, now, spec, L)
      const line = ids.map((id) => {
        const row = r.rows.find((x) => x.id === id)
        return `${kecName(s, id)} ${row?.value ?? 0}${L === 'id' ? ' aduan' : ''} (${L === 'id' ? 'pekan lalu' : 'last week'} ${row?.prev ?? 0})`
      })
      const cat = (id: string) => {
        const by = new Map<string, number>()
        for (const c of rows(s.complaints)) if (c.kecamatanId === id && c.at > now - 7 * DAY_MIN && c.at <= now) by.set(c.category, (by.get(c.category) ?? 0) + 1)
        const t = [...by.entries()].sort((a, b) => b[1] - a[1])[0]
        return t ? catName(t[0] as ComplaintCategory, L) : L === 'id' ? 'tidak ada' : 'none'
      }
      const text = L === 'id'
        ? `Perbandingan 7 hari: ${line.join(' vs ')}. Kategori dominan: ${ids.map((id) => `${kecName(s, id)} ${cat(id)}`).join(', ')}.${kecInText(s, ctx.text).length < 2 ? ' (Sebutkan dua nama kecamatan untuk perbandingan lain.)' : ''}`
        : `7-day comparison: ${line.join(' vs ')}. Main category: ${ids.map((id) => `${kecName(s, id)} ${cat(id)}`).join(', ')}.${kecInText(s, ctx.text).length < 2 ? ' (Name two districts for another comparison.)' : ''}`
      return { text, structured: query(spec), toolCalls: [step(spec, r)], followUps: chips(L, 'rank', 'cause', 'forecast') }
    },
  },
  {
    id: 'bandingkan-minggu',
    examples: [
      'Bandingkan aduan minggu ini dengan minggu lalu', 'Aduan minggu ini dibanding minggu lalu', 'Apakah aduan naik dibanding pekan lalu?', 'Perbandingan aduan pekan ini dan pekan lalu',
      'Compare complaints this week with last week', 'Are complaints up versus last week?', 'Week over week complaints', 'This week vs last week',
      'Aduan minggu iki dibandhing minggu wingi', 'Aduane mundhak ora tinimbang minggu wingi?',
    ],
    respond: (ctx) => {
      const { s, now } = ws(ctx)
      const L = ctx.lang
      const spec: QuerySpec = { metric: 'complaints', groupBy: 'category', range: '7d', chart: 'bar' }
      const r = runQuery(s, now, spec, L)
      const cur = r.rows.reduce((a, x) => a + x.value, 0)
      const prev = r.rows.reduce((a, x) => a + (x.prev ?? 0), 0)
      const moves = [...r.rows].map((x) => ({ x, d: x.value - (x.prev ?? 0) })).sort((a, b) => b.d - a.d)
      const up = moves.filter((m) => m.d > 0).slice(0, 2)
      const down = moves.filter((m) => m.d < 0).slice(-2).reverse()
      const list = (ms: typeof up) => ms.map((m) => `${lc(m.x.label)} ${m.d > 0 ? '+' : '−'}${Math.abs(m.d)}`).join(', ')
      const text = L === 'id'
        ? `7 hari terakhir ${cur} aduan, pekan sebelumnya ${prev} (${pct(L, cur, prev)}).${up.length ? ` Naik paling banyak: ${list(up)}.` : ''}${down.length ? ` Turun: ${list(down)}.` : ''} Batang tipis di grafik = pekan lalu.`
        : `Last 7 days: ${cur} complaints, the week before: ${prev} (${pct(L, cur, prev)}).${up.length ? ` Biggest rises: ${list(up)}.` : ''}${down.length ? ` Falls: ${list(down)}.` : ''} The thin bars in the chart are last week.`
      return { text, structured: query(spec), toolCalls: [step(spec, r)], followUps: chips(L, 'cause', 'rank', 'forecast') }
    },
  },
  {
    id: 'tren-sla',
    examples: [
      'Bagaimana tren SLA 30 hari terakhir?', 'Apakah ketepatan waktu layanan membaik?', 'Tren penyelesaian tiket tepat waktu', 'Grafik SLA sebulan',
      'How is the SLA trend over 30 days?', 'Is on-time resolution improving?', 'Show the SLA trend',
      'Piye tren SLA sewulan iki?', 'Layanan saya cepet ora?',
    ],
    respond: (ctx) => {
      const { s, now } = ws(ctx)
      const spec: QuerySpec = { metric: 'sla_on_time', groupBy: 'day', range: '30d', chart: 'line' }
      const r = runQuery(s, now, spec, ctx.lang)
      const v = r.values ?? []
      const a = avg(v.slice(0, 15))
      const b = avg(v.slice(-15))
      const L = ctx.lang
      const text = L === 'id'
        ? `Rata-rata SLA tepat waktu 15 hari terakhir ${nf(L, b)}%, ${b >= a ? 'membaik' : 'menurun'} dari ${nf(L, a)}% pada 15 hari sebelumnya. Angka di papan KPI ${mpServiceIndex(s, now).sla}% (30 hari, tiket terbuka yang lewat SLA ikut dihitung).`
        : `Average on-time SLA over the last 15 days: ${nf(L, b)}%, ${b >= a ? 'up' : 'down'} from ${nf(L, a)}% in the 15 days before. The KPI board shows ${mpServiceIndex(s, now).sla}% (30 days, open tickets past SLA included).`
      return { text, structured: query(spec), toolCalls: [step(spec, r)], followUps: chips(L, 'slow', 'index', 'overdue') }
    },
  },
  {
    id: 'prediksi-aduan',
    examples: [
      'Perkiraan jumlah aduan tiga hari ke depan', 'Prediksi aduan besok', 'Berapa aduan yang akan masuk besok?', 'Proyeksi aduan beberapa hari ke depan',
      'Forecast complaints for the next three days', 'How many complaints should we expect tomorrow?', 'Predict tomorrow complaints',
      'Sesuk kira-kira aduan pira?', 'Ramalan aduan telung dina ngarep',
    ],
    respond: (ctx) => {
      const { s, now } = ws(ctx)
      const spec: QuerySpec = { metric: 'complaints', groupBy: 'day', range: '7d', chart: 'line', forecast: true }
      const r = runQuery(s, now, { ...spec, range: '30d' }, ctx.lang)
      const fc = forecastOf((r.values ?? []).slice(0, -1), s)
      const L = ctx.lang
      const lo = Math.floor(fc.lo[0] ?? 0)
      const hi = Math.ceil(fc.hi[0] ?? 0)
      const wet = rows(s.alerts).some((a) => a.status === 'aktif')
      const text = L === 'id'
        ? `Prediksi sederhana (rata-rata 7 hari × faktor cuaca): besok sekitar ${lo}–${hi} aduan, cenderung ${(fc.values[2] ?? 0) >= (fc.values[0] ?? 0) ? 'naik tipis' : 'stabil'} dalam 3 hari. ${wet ? 'Ada peringatan banjir aktif, jadi rentang atas lebih mungkin.' : 'Bila hujan lebat siang ini terjadi, rentang atas lebih mungkin.'} Ini perkiraan arah, bukan angka pasti.`
        : `Simple forecast (7-day mean × weather factor): about ${lo}–${hi} complaints tomorrow, ${(fc.values[2] ?? 0) >= (fc.values[0] ?? 0) ? 'edging up' : 'flat'} over 3 days. ${wet ? 'A flood alert is active, so the upper end is more likely.' : 'If the heavy rain expected this afternoon comes, the upper end is more likely.'} This is a direction, not an exact figure.`
      return { text, structured: query({ ...spec, range: '30d' }), toolCalls: [step(spec, r)], followUps: chips(L, 'flood', 'rank', 'cause') }
    },
  },
  {
    id: 'status-banjir',
    examples: [
      'Bagaimana status banjir dan muka air sungai?', 'Ada peringatan banjir aktif?', 'Kondisi muka air sungai sekarang', 'Berapa aduan banjir hari ini?',
      'Kenapa peringatan aktif nol padahal sungai sudah tinggi?', 'Status Bengawan Solo sekarang siaga atau awas?', 'Perlu kirim peringatan banjir?',
      "What's the flood situation?", 'Are there active flood warnings?', 'How high is the river now?', 'Why are there no warnings while the river is high?',
      'Banyu kali munggah ora?', 'Piye kahanan banjir saiki?', 'Omah kebanjiran akeh ora?',
    ],
    respond: (ctx) => {
      const { s, now } = ws(ctx)
      const L = ctx.lang
      const river = riverNow(s, now)
      const al = rows(s.alerts).filter((a) => a.status === 'aktif' && a.kind === 'banjir')
      const spec: QuerySpec = al.length ? { metric: 'alerts', groupBy: 'kecamatan', range: 'today', chart: 'bar' } : { metric: 'complaints', groupBy: 'kecamatan', range: '7d', filter: { category: 'banjir' }, chart: 'bar' }
      const r = runQuery(s, now, spec, L)
      const today = rows(s.complaints).filter((c) => c.category === 'banjir' && c.at >= Math.floor(now / DAY_MIN) * DAY_MIN && c.at <= now).length
      const cl = rows(s.clusters).filter((c) => c.category === 'banjir')
      const g = river ? riverFacts(river, L) + ' ' : ''
      const a = al.length
        ? L === 'id' ? `${al.length} peringatan banjir aktif, level tertinggi ${Math.max(...al.map((x) => x.level))}: ${al.flatMap((x) => x.kecamatanIds).map((k) => kecName(s, k)).join(', ')}. ` : `${al.length} active flood alerts, highest level ${Math.max(...al.map((x) => x.level))}: ${al.flatMap((x) => x.kecamatanIds).map((k) => kecName(s, k)).join(', ')}. `
        : river && river.state !== 'normal'
          ? L === 'id'
            ? `Peringatan aktif masih 0 karena peringatan dini resmi belum dikirim: di ekosistem ini BPBD mengirimnya dari Siaga Wilayah setelah memeriksa prediksi genangan, tidak otomatis dari angka muka air. Dengan status ${riverState(river.state).id}, langkah berikutnya adalah menginstruksikan BPBD mengirim peringatan. `
            : `Active alerts are still 0 because no official early warning has been sent: in this ecosystem the BPBD sends it from Siaga Wilayah after checking the flood forecast; it is not automatic from the gauge reading. At ${riverState(river.state).en}, the next step is to instruct the BPBD to send the warning. `
          : L === 'id' ? 'Belum ada peringatan banjir aktif dari Siaga Wilayah. ' : 'No active flood alert from Siaga Wilayah yet. '
      const c = L === 'id' ? `${today} aduan banjir hari ini${cl.length ? `, ${cl.length} klaster terbentuk` : ', belum membentuk klaster'}.` : `${today} flood reports today${cl.length ? `, ${cl.length} clusters formed` : ', no cluster yet'}.`
      const act = river && river.state !== 'normal' && !al.length
        ? L === 'id' ? 'Instruksikan BPBD kirim peringatan dini banjir hari ini' : 'Instruct the BPBD to send the flood early warning today'
        : L === 'id' ? 'Instruksikan BPBD siagakan posko banjir' : 'Instruct the BPBD to put flood posts on standby'
      return { text: g + a + c, structured: query(spec), toolCalls: [step(spec, r)], followUps: [act, ...chips(L, 'forecast', 'issues')] }
    },
  },
  {
    id: 'isu-publik',
    examples: [
      'Isu apa yang sedang ramai di media sosial?', 'Apa isu negatif terbesar?', 'Ada hoaks yang beredar?', 'Sentimen publik hari ini bagaimana?',
      'What issues are trending online?', 'Is there a hoax spreading?', 'What is public sentiment today?',
      'Isu apa sing lagi rame?', 'Ana hoaks ora?',
    ],
    respond: (ctx) => {
      const { s, now } = ws(ctx)
      const L = ctx.lang
      const neg = negativeIssues(s, now)
      const hoax = rows(s.hoaxAlerts).find((h) => h.status === 'aktif')
      const spec: QuerySpec = { metric: 'mentions_negative', groupBy: 'category', range: 'today', chart: 'bar' }
      const r = runQuery(s, now, { ...spec, range: '7d' }, L)
      const top = neg.slice(0, 3).map((n) => `${topicLabel(n.topic, L)} (${n.count})`).join(', ')
      const text = (hoax
        ? L === 'id' ? `Perhatian: Radar Isu mendeteksi hoaks "${hoax.claim.id}" dengan skor ${Math.round(hoax.score * 100)}% dan ${hoax.accounts.length} akun penyebar. ` : `Attention: Radar Isu detected the hoax "${hoax.claim.en}" with a ${Math.round(hoax.score * 100)}% score and ${hoax.accounts.length} spreading accounts. `
        : '') + (neg.length ? (L === 'id' ? `Isu negatif 24 jam terakhir: ${top}.` : `Negative issues in the last 24 h: ${top}.`) : L === 'id' ? 'Tidak ada isu negatif menonjol dalam 24 jam.' : 'No notable negative issue in the last 24 h.')
      return { text, structured: query({ ...spec, range: '7d' }), toolCalls: [step(spec, r)], followUps: [...(hoax ? [L === 'id' ? 'Instruksikan Diskominfo terbitkan klarifikasi' : 'Instruct the communications office to publish a clarification'] : []), ...chips(L, 'flood', 'overdue')] }
    },
  },
  {
    id: 'pengadaan-berisiko',
    examples: [
      'Paket pengadaan mana yang berisiko?', 'Ada pengadaan yang kemahalan?', 'Tender mana yang perlu diawasi?', 'Paket dengan HPS di atas harga pasar',
      'Which procurement packages are risky?', 'Any overpriced tenders?', 'Which tenders need scrutiny?',
      'Pengadaan endi sing rawan?', 'Ana tender sing kemahalan ora?',
    ],
    respond: (ctx) => {
      const { s, now } = ws(ctx)
      const L = ctx.lang
      const spec: QuerySpec = { metric: 'procurement_risk', groupBy: 'none', range: '30d', chart: 'bar' }
      const r = runQuery(s, now, spec, L)
      const ps = rows(s.procurements).filter((p) => p.status !== 'selesai').sort((a, b) => riskRank(b) - riskRank(a))
      const p = riskiestProcurement(s)
      const text = p
        ? L === 'id' ? `Paling berisiko: ${p.name.id} (${p.code}), ${p.flagged ? `skor risiko ${p.riskScore} dari Awas Belanja` : `HPS ${nf(L, devOf(p))}% di atas harga pasar dan belum dianalisis`}. ${ps.filter((x) => devOf(x) > 20).length} paket punya HPS > 20% di atas pasar. Saran: minta reviu Inspektorat sebelum kontrak.` : `Highest risk: ${p.name.en} (${p.code}), ${p.flagged ? `risk score ${p.riskScore} from Awas Belanja` : `cost estimate ${nf(L, devOf(p))}% above market, not analysed yet`}. ${ps.filter((x) => devOf(x) > 20).length} packages have estimates > 20% above market. Suggestion: ask the Inspectorate to review before signing.`
        : L === 'id' ? 'Tidak ada paket pengadaan aktif.' : 'No active procurement packages.'
      return { text, structured: query(spec), toolCalls: [step(spec, r)], followUps: [L === 'id' ? 'Instruksikan Inspektorat reviu HPS paket itu' : 'Instruct the Inspectorate to review that estimate', ...chips(L, 'prices', 'overdue')] }
    },
  },
  {
    id: 'harga-pangan',
    examples: [
      'Harga bahan pokok apa yang naik minggu ini?', 'Harga cabai naik berapa persen?', 'Bagaimana harga beras di pasar?', 'Komoditas yang harganya melonjak',
      'Which food prices are rising?', 'How are market prices this week?', 'How much did chilli prices go up?', 'Which price rose most this week?', 'What got more expensive this week?', 'Forecast chilli prices for next week',
      'Ramalkan harga cabai minggu depan', 'Perkiraan harga beras ke depan',
      'Rega lombok munggah pira?', 'Regane beras piye saiki?',
    ],
    respond: (ctx) => {
      const { s, now } = ws(ctx)
      const L = ctx.lang
      const t = norm(ctx.text)
      // whole words only ("price" must not read as "rice")
      const tw = ` ${t} `
      const has = (w: string | undefined) => !!w && tw.includes(` ${w} `)
      const com = s.region.commodities.find((c) => has(norm(c.name.id).split(' ')[0]) || has(norm(c.name.en).split(' ').slice(-1)[0]) || (/\b(lombok|chilli|chili|chillies)\b/.test(t) && c.id.startsWith('cabai')))
      const spec: QuerySpec = com ? { metric: 'prices', groupBy: 'market', range: '7d', filter: { commodity: com.id }, chart: 'bar' } : { metric: 'prices', groupBy: 'commodity', range: '7d', chart: 'bar' }
      const r = runQuery(s, now, spec, L)
      const top = r.rows[0]
      const pts = rows(s.prices).filter((p) => !com || p.commodityId === com.id)
      const avgP = pts.length ? pts.reduce((a, p) => a + p.price, 0) / pts.length : 0
      const op = rows(s.marketOps).find((m) => m.stage === 'recommended')
      const tr0 = topRiser(s)
      const trName = tr0 ? (s.region.commodities.find((c) => c.id === tr0.p.commodityId)?.name ?? { id: tr0.p.commodityId, en: tr0.p.commodityId }) : null
      const single = !com && tr0 && trName
        ? L === 'id'
          ? ` Kenaikan tertinggi di satu pasar: ${trName.id.toLowerCase()} di ${s.markets.byId[tr0.p.marketId]?.name ?? tr0.p.marketId} ${tr0.d >= 0 ? '+' : ''}${nf(L, tr0.d * 100, 1)}% (yang disebut di briefing).`
          : ` Largest rise at a single market: ${trName.en.toLowerCase()} at ${s.markets.byId[tr0.p.marketId]?.name ?? tr0.p.marketId} ${tr0.d >= 0 ? '+' : ''}${nf(L, tr0.d * 100, 1)}% (the one in the briefing).`
        : ''
      const fc = /ramal|prediksi|perkira|proyeksi|forecast|predict|projection/.test(t)
        ? L === 'id' ? 'Saya belum meramal harga; yang ada adalah pergerakan sepekan terakhir. ' : "I don't forecast prices yet; here is the movement over the last week. "
        : ''
      const text = fc + (top
        ? L === 'id'
          ? `${com ? `Harga ${com.name.id.toLowerCase()} rata-rata Rp ${nf(L, Math.round(avgP / 50) * 50)}/${com.unit} (simulasi). Kenaikan sepekan tertinggi di ${top.label} (${top.value >= 0 ? '+' : ''}${nf(L, top.value, 1)}%).` : `Kenaikan harga sepekan tertinggi: ${r.rows.slice(0, 3).map((x) => `${x.label} ${x.value >= 0 ? '+' : ''}${nf(L, x.value, 1)}%`).join(', ')} (rata-rata semua pasar, simulasi).${single}`}${op ? ' Sinyal Pasar sudah merekomendasikan operasi pasar; Anda bisa menyetujuinya lewat "Beri instruksi".' : ''}`
          : `${com ? `${com.name.en} averages Rp ${nf(L, Math.round(avgP / 50) * 50)}/${com.unit} (simulated). The largest weekly rise is at ${top.label} (${top.value >= 0 ? '+' : ''}${nf(L, top.value, 1)}%).` : `Largest weekly price rises: ${r.rows.slice(0, 3).map((x) => `${x.label} ${x.value >= 0 ? '+' : ''}${nf(L, x.value, 1)}%`).join(', ')} (average of all markets, simulated).${single}`}${op ? ' Sinyal Pasar has recommended a market operation; you can approve it via "Issue instruction".' : ''}`
        : L === 'id' ? 'Belum ada data harga.' : 'No price data yet.')
      const watch = com?.name ?? trName ?? { id: 'bahan pokok', en: 'staples' }
      return { text, structured: query(spec), toolCalls: [step(spec, r)], followUps: [L === 'id' ? `Instruksikan Disperindag pantau pasokan ${watch.id.toLowerCase()}` : `Instruct the trade office to monitor ${watch.en.toLowerCase()} supply`, ...chips(L, 'issues', 'flood')] }
    },
  },
  {
    id: 'tindak-lanjut-terlambat',
    examples: [
      'Tindak lanjut rapat apa yang terlambat?', 'OPD mana yang menunggak tindak lanjut?', 'Daftar tugas yang lewat tenggat', 'Hasil rapat yang belum dikerjakan',
      'Which follow-ups are overdue?', 'Which agencies have late action items?', 'List the overdue tasks',
      'Tugas endi sing telat?', 'Tindak lanjut sing durung rampung apa wae?',
    ],
    respond: (ctx) => {
      const { s, now } = ws(ctx)
      const L = ctx.lang
      const late = overdueActions(s, now)
      const spec: QuerySpec = { metric: 'action_items_overdue', groupBy: 'opd', range: '30d', chart: 'bar' }
      const r = runQuery(s, now, spec, L)
      const list = late.slice(0, 3).map((a) => `"${a.title[L]}" (${opdShort(s, a.opdId)}, ${L === 'id' ? 'lewat' : 'late by'} ${Math.max(1, Math.round((now - a.dueAt) / DAY_MIN))} ${L === 'id' ? 'hari' : 'd'})`).join('; ')
      const text = late.length
        ? L === 'id' ? `${late.length} tindak lanjut lewat tenggat. Paling lama: ${list}. Naskah Pintar bisa mengirim pengingat WA ke PIC-nya.` : `${late.length} follow-ups are past due. Oldest: ${list}. Naskah Pintar can send the owners a WhatsApp reminder.`
        : L === 'id' ? 'Tidak ada tindak lanjut yang terlambat.' : 'No follow-up is overdue.'
      return { text, structured: query(spec), toolCalls: [step(spec, r)], followUps: [L === 'id' ? 'Instruksikan OPD menuntaskan tindak lanjut besok' : 'Instruct the agencies to close the follow-ups tomorrow', ...chips(L, 'slow', 'index')] }
    },
  },
  {
    id: 'indeks-layanan',
    examples: [
      'Kenapa indeks layanan segini?', 'Bagaimana indeks layanan dihitung?', 'Apa yang membuat indeks layanan turun?', 'Cara menaikkan indeks layanan',
      'Explain the service index', 'How is the service index calculated?', 'What would raise the service index?',
      'Indeks layanan iku saka ngendi?', 'Piye carane indeks layanan munggah?',
    ],
    respond: (ctx) => {
      const { s, now } = ws(ctx)
      const L = ctx.lang
      const x = mpServiceIndex(s, now)
      const text = L === 'id'
        ? `Indeks layanan ${x.index}/100 = 40% SLA tepat waktu (${x.sla}%) + 30% kepuasan warga (${nf(L, x.rating, 1)}/5) + 30% disiplin tindak lanjut (${x.discipline}%: ${x.due - x.late} dari ${x.due} butir yang sudah jatuh tempo selesai, ${x.late} terlambat). Tugas yang belum jatuh tempo, termasuk instruksi baru, tidak dihitung, jadi indeks hanya naik bila pekerjaan benar-benar selesai. Pengungkit tercepat: menuntaskan tindak lanjut yang terlambat dan menaikkan SLA OPD dengan antrean terbesar.`
        : `Service index ${x.index}/100 = 40% on-time SLA (${x.sla}%) + 30% citizen satisfaction (${nf(L, x.rating, 1)}/5) + 30% follow-up discipline (${x.discipline}%: ${x.due - x.late} of ${x.due} items already due are done, ${x.late} late). Tasks not yet due, new instructions included, do not count, so the index only rises when work is actually finished. Fastest levers: close the overdue follow-ups and lift the SLA of the agency with the largest backlog.`
      const spec: QuerySpec = { metric: 'ticket_backlog', groupBy: 'opd', range: '30d', chart: 'bar' }
      const r = runQuery(s, now, spec, L)
      return { text, structured: query(spec), toolCalls: [step(spec, r)], followUps: chips(L, 'overdue', 'slow', 'sla') }
    },
  },
  {
    id: 'susun-briefing',
    examples: [
      'Susun briefing pagi', 'Buatkan ringkasan briefing untuk rapat', 'Siapkan briefing hari ini', 'Rangkum briefing untuk pimpinan',
      'Compose the morning briefing', "Prepare today's briefing", 'Draft a briefing for the leader',
      'Gawekna briefing esuk', 'Susunke briefing dina iki',
    ],
    respond: (ctx) => {
      const { s, now } = ws(ctx)
      const L = ctx.lang
      const items = mpBriefingItems(s, now)
      const text = L === 'id'
        ? `Briefing pukul ${hh(now)} tersusun: ${items.length} butir dari ${new Set(items.map((i) => i.source)).size} produk. Butir teratas: ${items[0]?.title.id ?? '-'}. Briefing juga tampil di panel Briefing Pagi.`
        : `Briefing at ${hh(now)} composed: ${items.length} items from ${new Set(items.map((i) => i.source)).size} products. Top item: ${items[0]?.title.en ?? '-'}. It also shows in the Morning Briefing panel.`
      return {
        text,
        structured: { kind: 'briefing', data: { items: items.map((i) => ({ title: i.title[L], source: i.source, detail: i.detail[L] })) } },
        toolCalls: [{ name: 'compose_briefing', input: { at: hh(now) }, output: { items: items.length }, ms: 320 }],
        emits: [{ type: 'briefing.generated', payload: { items: items.map(({ title, source, refs }) => ({ title, source, refs })) } }],
        followUps: chips(L, 'cause', 'flood', 'overdue'),
      }
    },
  },
  {
    // officials are never named (titles only): a "who is the head of …" question gets the agency's numbers instead
    id: 'siapa-pejabat',
    examples: [
      'Siapa kepala dinas PUPR?', 'Siapa kepala BPBD sekarang?', 'Siapa pejabat yang memimpin Diskominfo?', 'Nama kepala dinas kesehatan',
      'Who is the head of the public works office?', 'Who runs the BPBD?', 'Who leads the health office?', 'Name of the agency head',
      'Sapa kepala dinas PU?', 'Sing mimpin BPBD sapa?',
    ],
    respond: (ctx) => {
      const { s, now } = ws(ctx)
      const L = ctx.lang
      const id = opdsInText(s, ctx.text)[0]
      const lb = mpLeaderboard(s, now)
      const r = id ? lb.find((x) => x.opdId === id) : undefined
      const ranked = lb.filter((x) => x.rank !== null).length
      const head = L === 'id'
        ? 'Demo ini tidak memuat nama pejabat: pejabat disebut menurut jabatannya saja (mis. "Kepala Dinas PUPR").'
        : 'This demo holds no names of officials: they are referred to by title only (e.g. "Head of Dinas PUPR").'
      const tail = r
        ? L === 'id'
          ? ` Kinerja ${r.short}: ${r.rank === null ? 'data belum cukup untuk peringkat' : `peringkat ${r.rank} dari ${ranked}, skor ${r.score}, SLA tepat waktu ${r.slaPct}%`}, ${r.openTickets} tiket terbuka (${r.lateTickets} lewat SLA), ${r.actionsLate} tindak lanjut terlambat.`
          : ` ${r.short} performance: ${r.rank === null ? 'not enough data for a rank' : `rank ${r.rank} of ${ranked}, score ${r.score}, on-time SLA ${r.slaPct}%`}, ${r.openTickets} open tickets (${r.lateTickets} past SLA), ${r.actionsLate} overdue follow-ups.`
        : ''
      return { text: head + tail, followUps: chips(L, 'slow', 'overdue', 'sla') }
    },
  },
  {
    id: 'beri-instruksi',
    examples: [
      'Instruksikan BPBD kerahkan pompa ke Kanor', 'Perintahkan Dinas PUPR memperbaiki jalan di Ngasem', 'Minta Diskominfo terbitkan klarifikasi', 'Tugaskan Disperindag pantau harga cabai',
      'Instruct the BPBD to deploy pumps', 'Tell the public works office to fix the roads', 'Order the communications office to publish a clarification',
      'Kongkon BPBD ngirim pompa', 'Prentahna Dinas PUPR ndandani dalan',
    ],
    respond: (ctx) => {
      const { s } = ws(ctx)
      const L = ctx.lang
      const opds = opdsInText(s, ctx.text)
      const kec = kecInText(s, ctx.text)[0]
      const instruction = draftInstruction(s, ctx.text, L, kec)
      const to = opds.length ? opds.map((o) => opdShort(s, o)).join(', ') : L === 'id' ? 'OPD terkait' : 'the relevant agency'
      const text = L === 'id'
        ? `Draf instruksi siap untuk ${to}${kec ? `, lokasi Kec. ${kecName(s, kec)}` : ''}. Periksa lalu tekan "Tinjau & kirim": instruksi menjadi disposisi di Naskah Pintar dan tugas di setiap OPD.`
        : `Draft instruction ready for ${to}${kec ? `, location ${kecName(s, kec)}` : ''}. Check it and press "Review & send": it becomes a disposition in Naskah Pintar and a task at each agency.`
      return {
        text,
        structured: { kind: 'instruction', data: { to, instruction, deadline: URGENT.test(`${ctx.text} ${instruction}`) ? (L === 'id' ? 'Hari ini 16.00 WIB' : 'Today 16:00 WIB') : L === 'id' ? 'Besok 16.00 WIB' : 'Tomorrow 16:00 WIB', priority: URGENT.test(`${ctx.text} ${instruction}`) ? 'segera' : 'tinggi' } },
        toolCalls: [{ name: 'issue_instruction', input: { to }, output: { draft: true }, ms: 210 }],
        followUps: chips(L, 'overdue', 'rank'),
      }
    },
  },
  {
    id: 'aduan-hari-ini',
    examples: [
      'Berapa aduan hari ini?', 'Aduan hari ini apa saja kategorinya?', 'Jumlah laporan warga hari ini', 'Aduan per kategori hari ini',
      'How many complaints today?', "What are today's complaints about?", 'Complaints by category today',
      'Aduan dina iki pira?', 'Laporan warga dina iki apa wae?',
    ],
    respond: (ctx) => {
      const { s, now } = ws(ctx)
      const L = ctx.lang
      // "Berapa aduan banjir di Kanor hari ini?": a named category or district is a count question, not the overview
      if (categoryOf(ctx.text) || kecInText(s, ctx.text).length) return countAnswer(ctx)
      const spec: QuerySpec = { metric: 'complaints', groupBy: 'category', range: 'today', chart: 'bar' }
      const r = runQuery(s, now, spec, L)
      const k = kpiStrip(s, now).complaints
      const text = L === 'id'
        ? `${k.today} aduan masuk hari ini sampai pukul ${hh(now)} (kemarin pada jam yang sama ${k.yesterday}). Terbanyak: ${r.rows.slice(0, 3).map((x) => `${lc(x.label)} ${x.value}`).join(', ') || '-'}.`
        : `${k.today} complaints today up to ${hh(now)} (yesterday at the same time: ${k.yesterday}). Most: ${r.rows.slice(0, 3).map((x) => `${lc(x.label)} ${x.value}`).join(', ') || '-'}.`
      return { text, structured: query(spec), toolCalls: [step(spec, r)], followUps: chips(L, 'rank', 'cause', 'forecast') }
    },
  },
  {
    // a count with the entities the question names: category, district(s) and period ("bulan ini" = 30 days)
    id: 'jumlah-aduan',
    examples: [
      'Berapa aduan jalan rusak di Dander bulan ini?', 'Berapa aduan sampah minggu ini?', 'Jumlah aduan banjir di Kanor 30 hari terakhir', 'Ada berapa laporan PJU mati di Kalitidu?', 'Berapa keluhan air bersih bulan ini?',
      'How many road complaints in Dander this month?', 'How many waste complaints this week?', 'Number of flood reports in Kanor in the last 30 days',
      'Pira aduan dalan rusak ing Dander sasi iki?', 'Aduan sampah minggu iki pira?',
    ],
    // "Kenapa aduan air bersih naik?" shares words with a count question: a "why" always goes to the cause answer
    respond: (ctx, slots) => (WHY.test(ctx.text) ? intents.find((i) => i.id === 'penyebab-kenaikan')!.respond(ctx, slots) : countAnswer(ctx)),
  },
  {
    // a safety decision the data on this screen cannot make: say so, give the facts there are, point to Siaga Wilayah
    id: 'evakuasi',
    examples: [
      'Kecamatan mana yang harus dievakuasi dulu?', 'Siapa yang harus dievakuasi?', 'Prioritas evakuasi banjir', 'Desa mana yang perlu mengungsi?', 'Di mana titik pengungsian?', 'Perlu evakuasi warga tidak?',
      'Which district should be evacuated first?', 'Who should we evacuate?', 'Evacuation priority', 'Where are the evacuation shelters?',
      'Desa endi sing kudu ngungsi?', 'Sapa sing kudu dievakuasi?',
    ],
    respond: (ctx) => {
      const { s } = ws(ctx)
      const L = ctx.lang
      const river = riverNow(s, ws(ctx).now)
      const al = rows(s.alerts).filter((a) => a.status === 'aktif')
      const facts = L === 'id'
        ? `${river ? `${riverFacts(river, L)} ` : ''}${al.length ? `Peringatan aktif di ${al.flatMap((a) => a.kecamatanIds).map((k) => kecName(s, k)).join(', ')}.` : 'Belum ada peringatan banjir resmi yang dikirim.'}`
        : `${river ? `${riverFacts(river, L)} ` : ''}${al.length ? `Active alerts in ${al.flatMap((a) => a.kecamatanIds).map((k) => kecName(s, k)).join(', ')}.` : 'No official flood warning has been sent yet.'}`
      const text = L === 'id'
        ? `Simulasi ini belum bisa menilai prioritas evakuasi: keputusan itu butuh prediksi genangan, jumlah warga rentan, dan kapasitas posko, yang dihitung di Siaga Wilayah, bukan dari angka aduan. Yang ada di layar ini: ${facts} Untuk prediksi 6 jam dan daftar penerima peringatan, buka Siaga Wilayah.`
        : `This simulation cannot rank evacuation priorities: that decision needs a flood-extent forecast, the number of vulnerable residents and shelter capacity, which Siaga Wilayah computes, not complaint counts. What this screen has: ${facts} For the 6-hour forecast and the alert recipients, open Siaga Wilayah.`
      return { text, structured: { kind: 'link', data: { product: 'siaga-wilayah' } }, followUps: [...(river && river.state !== 'normal' && !al.length ? [L === 'id' ? 'Instruksikan BPBD kirim peringatan dini banjir hari ini' : 'Instruct the BPBD to send the flood early warning today'] : al.length || (river && river.level >= river.siaga * 0.95) ? [L === 'id' ? 'Instruksikan BPBD siagakan posko banjir' : 'Instruct the BPBD to put flood posts on standby'] : []), ...chips(L, 'flood', 'forecast')] }
    },
  },
  {
    id: 'bantuan',
    examples: [
      'Apa saja yang bisa kamu jawab?', 'Bantuan', 'Contoh pertanyaan', 'Kamu bisa apa?',
      'What can you do?', 'Help', 'Example questions',
      'Iso takon apa wae?', 'Pitulung',
    ],
    respond: (ctx) => ({
      text: ctx.lang === 'id'
        ? 'Saya menjawab dari data daerah yang sama dengan layar ini: tren (aduan, SLA), perbandingan kecamatan, peringkat OPD, kemungkinan penyebab, dan prediksi sederhana. Saya juga bisa menyusun briefing dan menyiapkan draf instruksi. Setiap jawaban menampilkan grafik, dan peta ikut bergerak ke kecamatan terkait.'
        : 'I answer from the same regional data as this screen: trends (complaints, SLA), district comparisons, agency rankings, likely causes and simple forecasts. I can also compose the briefing and draft instructions. Every answer shows a chart, and the map moves to the district concerned.',
      followUps: chips(ctx.lang, 'cause', 'rank', 'forecast'),
    }),
  },
]

/* every intent answers through the routing guards first (out-of-scope, river questions, one-district compares) */
const ORIGINAL = new Map<string, Intent['respond']>()
for (const it of intents) {
  const orig = it.respond
  ORIGINAL.set(it.id, orig)
  it.respond = (ctx, slots) => route(ctx, it.id) ?? orig(ctx, slots)
}

/* ------------------------------------------------------------------ routing guards (before any template) */

/** an honest "outside this data" answer, with chips that use what the question named (a district, an agency) */
function outOfScope(ctx: SimContext): SimResponse {
  const { s } = ws(ctx)
  const L = ctx.lang
  const kec = kecInText(s, ctx.text)[0]
  const opd = opdsInText(s, ctx.text)[0]
  const k = kec ? kecName(s, kec) : null
  const named = [
    ...(k ? [L === 'id' ? `Berapa aduan di Kec. ${k} minggu ini?` : `How many complaints in ${k} this week?`] : []),
    ...(opd ? [L === 'id' ? `Bagaimana kinerja ${opdShort(s, opd)}?` : `How is ${opdShort(s, opd)} performing?`] : []),
  ]
  return {
    text: L === 'id'
      ? `Pertanyaan ini di luar data simulasi Meja Pimpinan. Yang bisa saya jawab: aduan warga (jumlah, tren, penyebab, per kecamatan), kinerja dan SLA OPD, briefing, tindak lanjut rapat, pengadaan berisiko, harga pangan, isu publik, serta status banjir dan muka air.${named.length ? ' Misalnya:' : ' Coba salah satu ini:'}`
      : `That question is outside the simulated data of Meja Pimpinan. I can answer about citizen complaints (counts, trends, causes, by district), agency performance and SLA, the briefing, meeting follow-ups, risky procurement, food prices, public issues, and the flood and river status.${named.length ? ' For example:' : ' Try one of these:'}`,
    followUps: [...named, ...chips(L, 'flood', 'cause', 'rank')].slice(0, 3),
  }
}

/** who-questions about people this demo never names (camat, lurah, kades, the regent…) unless an agency is named */
const WHO = /\b(siapa|sapa|sopo|who)\b/i
const PERSON = /\b(camat|lurah|kades|kepala|bupati|wali ?kota|wakil|sekda|dprd|ketua|nama|name|mayor|regent|head|chief|leader)\b/i
/** river / warning words: the flood status answer, not a complaint count or a cause template */
const RIVER = /\b(peringatan|warning|warnings|alert|alerts|muka air|sungai|river|bengawan|siaga|awas|gauge|tma)\b/i
const EVAC = /\b(evakuasi|dievakuasi|mengungsi|ngungsi|pengungsian|evacuat\w*|shelter)\b/i

function route(ctx: SimContext, id: string): SimResponse | null {
  const { s } = ws(ctx)
  const t = ctx.text
  if (WHO.test(t) && PERSON.test(t) && !opdsInText(s, t).length) return outOfScope(ctx)
  if (RIVER.test(t) && !EVAC.test(t) && !/^\s*(tolong\s+)?(instruksikan|perintahkan|minta|tugaskan|instruct|order|tell|kongkon|prentahna)\b/i.test(t) && !/\b(berapa|jumlah|how many|pira)\b/i.test(t) && id !== 'status-banjir' && id !== 'beri-instruksi') return ORIGINAL.get('status-banjir')?.(ctx, {}) ?? null
  if (id === 'bandingkan-kecamatan') {
    const n = kecInText(s, t).length
    if (n === 1) return countAnswer(ctx)
    if (n === 0 && !/\b(bandingkan|banding|perbandingan|compare|versus|vs|bandingna)\b/i.test(t)) return outOfScope(ctx)
  }
  return null
}

/** a "why" question */
const WHY = /\b(kenapa|mengapa|knp|kok|penyebab|sebab|why|cause|caused|kenging|ngapa)\b/i

/** urgent wording => the draft's deadline is today */
const URGENT = /segera|darurat|hari ini|urgent|today|now|sekarang|klarifikasi|clarif|hoaks|hoax/i

/** "Berapa aduan jalan rusak di Dander bulan ini?" -- counts with the category, district(s) and period the question names */
function countAnswer(ctx: SimContext): SimResponse {
  const { s, now } = ws(ctx)
  const L = ctx.lang
  const cat = categoryOf(ctx.text)
  const kec = kecInText(s, ctx.text)
  const range = rangeInText(ctx.text) ?? '7d'
  const { cur, prev } = countWindow(s, now, range, (c) => (!cat || c.category === cat) && (!kec.length || kec.includes(c.kecamatanId)))
  const spec: QuerySpec = kec.length && cat
    ? { metric: 'complaints', groupBy: 'kecamatan', range, filter: { category: cat, kecamatan: kec.join(',') }, chart: 'bar' }
    : kec.length
      ? { metric: 'complaints', groupBy: 'category', range, filter: { kecamatan: kec.join(',') }, chart: 'bar' }
      : { metric: 'complaints', groupBy: 'kecamatan', range, chart: 'bar', ...(cat ? { filter: { category: cat } } : {}) }
  const r = runQuery(s, now, spec, L)
  const what = cat ? (L === 'id' ? `aduan ${catName(cat, L)}` : `${lc(CATEGORY_LABEL[cat].en)} complaints`) : L === 'id' ? 'aduan' : 'complaints'
  const where = kec.length ? (L === 'id' ? ` di ${kec.map((k) => `Kec. ${kecName(s, k)}`).join(', ')}` : ` in ${kec.map((k) => kecName(s, k)).join(', ')}`) : L === 'id' ? ` di ${s.region.name}` : ` in ${regionLabel(s.region.name, 'en')}`
  const top = r.rows.find((x) => x.value > 0)
  const text = L === 'id'
    ? `${what[0]!.toUpperCase()}${what.slice(1)}${where}, ${RANGE_WORDS[range].id}: ${cur} (${PREV_WORDS[range].id}: ${prev}, ${cur > prev ? 'naik' : cur < prev ? 'turun' : 'sama'}).${top && !(kec.length && cat) ? ` Terbanyak: ${top.label} (${top.value}).` : ''} Data simulasi dari aduan Sapa Warga.`
    : `${what[0]!.toUpperCase()}${what.slice(1)}${where}, ${RANGE_WORDS[range].en}: ${cur} (${PREV_WORDS[range].en}: ${prev}, ${cur > prev ? 'up' : cur < prev ? 'down' : 'unchanged'}).${top && !(kec.length && cat) ? ` Most: ${top.label} (${top.value}).` : ''} Simulated data from Sapa Warga complaints.`
  return { text, structured: query(spec), toolCalls: [step(spec, r)], followUps: [...(cat && cur > prev && range === '7d' ? [causeQuestion(cat)[L]] : []), ...chips(L, 'rank', 'forecast')] }
}

function avg(v: number[]): number {
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0
}
function hh(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}.${String(m % 60).padStart(2, '0')}`
}

/** "Instruksikan BPBD kerahkan pompa ke Kanor" → a clear, measurable instruction: what, where, when to report */
export function draftInstruction(s: WorldState, text: string, L: Lang, kec: string | undefined): string {
  const t = text.toLowerCase()
  const where = kec ? (L === 'id' ? `di Kec. ${kecName(s, kec)}` : `in ${kecName(s, kec)}`) : ''
  const at = (id: string, en: string) => (L === 'id' ? `${id}${where ? ` ${where}` : ''}` : `${en}${where ? ` ${where}` : ''}`)
  const what = /pompa|pump/.test(t)
    ? at('Kerahkan pompa portabel ke titik genangan', 'Deploy portable pumps to the waterlogged spots')
    : /jalan|dalan|road|pothole/.test(t)
      ? at('Perbaiki jalan rusak yang diadukan warga', 'Repair the damaged roads residents reported')
      : /klarifikasi|clarif|hoaks|hoax/.test(t)
        ? L === 'id' ? 'Terbitkan klarifikasi resmi atas isu yang beredar hari ini juga' : 'Publish an official clarification of the circulating claim today'
        : /harga|cabai|beras|price|chilli|rice/.test(t)
          ? at('Pantau harga dan pasokan bahan pokok, siapkan opsi operasi pasar', 'Monitor staple prices and supply, prepare a market-operation option')
          : /sampah|uwuh|waste|trash/.test(t)
            ? at('Angkut sampah yang menumpuk dan perbaiki jadwal angkut', 'Clear the piled-up waste and fix the collection schedule')
            : /peringatan dini|early warning/.test(t)
              ? L === 'id' ? 'Kirim peringatan dini banjir dari Siaga Wilayah ke kecamatan bantaran sungai dan siagakan posko' : 'Send the flood early warning from Siaga Wilayah to the riverside districts and put the flood posts on standby'
              : /air bersih|air minum|clean water|water supply/.test(t)
                ? at('Tangani aduan air bersih dan pastikan pasokan air warga', 'Resolve the clean-water complaints and secure residents\' water supply')
                : null
  let body = text.replace(/^\s*(tolong\s+)?(instruksikan|perintahkan|minta|tugaskan|kongkon|prentahna)\s+/i, '').trim()
  // English: "Instruct the BPBD to put flood posts on standby" → "put flood posts on standby"
  body = body.replace(/^\s*(instruct|tell|order|ask)\s+(.{1,60}?)\s+to\s+/i, '').trim()
  // Indonesian: the agency is the addressee, not part of the task ("BPBD siagakan posko" → "siagakan posko")
  for (const o of [...s.region.opd].sort((a, b) => b.short.length - a.short.length)) {
    if (body.toLowerCase().startsWith(`${o.short.toLowerCase()} `)) {
      body = body.slice(o.short.length).trim()
      break
    }
  }
  // Indonesian "me-" verbs read as a report, not an order: "menangani X" → "Tangani X"
  const IMP: [RegExp, string][] = [[/^menangani\b/i, 'tangani'], [/^memperbaiki\b/i, 'perbaiki'], [/^memantau\b/i, 'pantau'], [/^mengecek\b/i, 'cek'], [/^memeriksa\b/i, 'periksa'], [/^mengirim(kan)?\b/i, 'kirim'], [/^menyiapkan\b/i, 'siapkan'], [/^menuntaskan\b/i, 'tuntaskan']]
  for (const [re, v] of IMP) if (re.test(body)) body = body.replace(re, v)
  const base = what ?? (body ? body[0]!.toUpperCase() + body.slice(1) : text)
  return /lapor|report/i.test(base) ? base : `${base}${L === 'id' ? '; laporkan perkembangan tiap 2 jam' : '; report progress every 2 hours'}`
}

export const scenario: Scenario = {
  product: 'meja-pimpinan',
  intents,
  threshold: 0.3,
  fallback: (ctx) => outOfScope(ctx),
}

