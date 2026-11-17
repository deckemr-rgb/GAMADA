/**
 * demos/meja-pimpinan/scenario.ts — the Simulasi scenario of "Tanya data" (spec §9.2, P2): 17 intents over the
 * live world — trend, compare, rank, cause, simple forecast, plus overview, briefing and instruction drafting.
 * Examples in Indonesian, English and Basa Jawa. Every number in an answer is computed from the world at the
 * moment of the question; charts come from the same `query` spec the Live tool `query_world` uses (query.ts).
 * Registered when the chat chunk loads (AskData.tsx), never with the page.
 */
import type { Intent, Scenario, SimContext, SimResponse, Lang } from '../../demo-kit/ai/chat'
import { CATEGORY_LABEL, DAY_MIN, clock, negativeIssues, overdueActions, rows, world, type ComplaintCategory, type Minutes, type WorldState } from '../../demo-kit/world'
import { briefingItems, complaintsByKecamatan, kpiStrip, opdLeaderboard } from '../../demo-kit/world/satu-daerah'
import { devOf, kecName, opdShort, opdsInText } from './data'
import type { AskContext } from './ideas'
import { categoryOf, forecastOf, runQuery, type QueryResult, type QuerySpec } from './query'
import { topicLabel } from './strings'

/* ------------------------------------------------------------------ helpers */

function ws(ctx: SimContext): { s: WorldState; now: Minutes } {
  const c = ctx.world as AskContext | null
  return { s: c?.state ?? world.get(), now: c?.now ?? clock.get().minutes }
}
const nf = (lang: Lang, n: number, d = 0) => n.toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB', { maximumFractionDigits: d, minimumFractionDigits: 0 })
const pct = (lang: Lang, a: number, b: number) => (b > 0 ? `${a >= b ? '+' : '−'}${nf(lang, Math.abs(((a - b) / b) * 100))}%` : a > 0 ? (lang === 'id' ? 'baru muncul' : 'new') : '0%')
const norm = (x: string) => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

/** kecamatan named in the question (the region's own name does not count unless "kecamatan" / "district" is said) */
function kecInText(s: WorldState, text: string): string[] {
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
const chips = (lang: Lang, ...k: (keyof (typeof F)['id'])[]) => k.map((x) => F[lang][x])
const catName = (c: ComplaintCategory, lang: Lang) => CATEGORY_LABEL[c][lang].toLowerCase()

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
      const id = `Per pukul ${hh(now)}: ${k.complaints.today} aduan masuk hari ini (${k.complaints.delta >= 0 ? '+' : ''}${k.complaints.delta} dibanding kemarin pada jam yang sama)${top && top.count ? `, terbanyak di Kec. ${top.name} (${top.count})` : ''}. SLA tepat waktu ${k.slaPct}%, ${k.alerts ? `${k.alerts} peringatan aktif` : 'belum ada peringatan banjir aktif'}, ${k.negativeIssues} topik isu negatif dalam 24 jam, dan ${late.length} tindak lanjut lewat tenggat. Indeks layanan ${k.serviceIndex}/100.`
      const en = `As of ${hh(now)}: ${k.complaints.today} complaints today (${k.complaints.delta >= 0 ? '+' : ''}${k.complaints.delta} vs yesterday at the same time)${top && top.count ? `, most in ${top.name} (${top.count})` : ''}. SLA on time ${k.slaPct}%, ${k.alerts ? `${k.alerts} active alerts` : 'no active flood alert yet'}, ${k.negativeIssues} negative issue topics in 24 h, and ${late.length} follow-ups past due. Service index ${k.serviceIndex}/100.`
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
      const cat = categoryOf(ctx.text) ?? 'jalan-rusak'
      const spec: QuerySpec = { metric: 'complaints', groupBy: 'kecamatan', range: '7d', filter: { category: cat }, chart: 'bar' }
      const r = runQuery(s, now, spec, ctx.lang)
      const cur = r.rows.reduce((a, x) => a + x.value, 0)
      const prev = r.rows.reduce((a, x) => a + (x.prev ?? 0), 0)
      const top = r.rows[0]
      // data-driven possible causes
      const flood7 = new Set(rows(s.complaints).filter((c) => c.category === 'banjir' && c.at > now - 7 * DAY_MIN && c.at <= now).map((c) => c.kecamatanId))
      const inFlood = rows(s.complaints).filter((c) => c.category === cat && c.at > now - 7 * DAY_MIN && c.at <= now && flood7.has(c.kecamatanId)).length
      const river = rows(s.gauges).find((g) => g.kind === 'sungai')
      const rising = river ? river.level - (river.history[0] ?? river.level) : 0
      const L = ctx.lang
      const name = catName(cat, L)
      const head =
        cur > prev
          ? L === 'id' ? `Aduan ${name} 7 hari terakhir ${cur}, naik dari ${prev} pada pekan sebelumnya (${pct(L, cur, prev)}).` : `${CATEGORY_LABEL[cat].en} complaints in the last 7 days: ${cur}, up from ${prev} the week before (${pct(L, cur, prev)}).`
          : L === 'id' ? `Aduan ${name} 7 hari terakhir ${cur}, tidak naik dibanding pekan sebelumnya (${prev}).` : `${CATEGORY_LABEL[cat].en} complaints in the last 7 days: ${cur}, not up on the week before (${prev}).`
      const where = top ? (L === 'id' ? ` Terbanyak di Kec. ${top.label} (${top.value}).` : ` Most in ${top.label} (${top.value}).`) : ''
      const causes: string[] = []
      if (inFlood && cat !== 'banjir') causes.push(L === 'id' ? `${inFlood} dari ${cur} aduan berada di kecamatan yang pekan ini juga melaporkan banjir; genangan kemungkinan mempercepat kerusakan` : `${inFlood} of ${cur} come from districts that also reported flooding this week; standing water probably speeds up the damage`)
      if (rising > 0.5) causes.push(L === 'id' ? `muka air ${river!.name} naik ${nf(L, rising, 1)} m dalam 24 jam (data simulasi), menandakan hujan lebat di hulu` : `the ${river!.name} rose ${nf(L, rising, 1)} m in 24 h (simulated data), a sign of heavy rain upstream`)
      if (cat === 'jalan-rusak') causes.push(L === 'id' ? 'diduga juga lalu lintas truk musim panen di ruas kabupaten' : 'harvest-season truck traffic on district roads is another likely factor')
      if (cat === 'sampah') causes.push(L === 'id' ? 'diduga jadwal angkut terganggu di sekitar pasar' : 'collection schedules near markets were probably disrupted')
      const why = causes.length ? (L === 'id' ? ` Kemungkinan penyebab: ${causes.join('; ')}.` : ` Likely causes: ${causes.join('; ')}.`) : ''
      return { text: head + where + why, structured: query(spec), toolCalls: [step(spec, r)], followUps: [L === 'id' ? `Instruksikan ${opdShort(s, s.region.categoryOpd[cat])} menangani ${name} di ${top?.label ?? s.region.shortName}` : `Instruct ${opdShort(s, s.region.categoryOpd[cat])} to handle ${CATEGORY_LABEL[cat].en.toLowerCase()} in ${top?.label ?? s.region.shortName}`, ...chips(L, 'forecast', 'slow')] }
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
      const spec: QuerySpec = { metric: 'complaints', groupBy: 'kecamatan', range: '7d', chart: 'bar', ...(cat ? { filter: { category: cat } } : {}) }
      const r = runQuery(s, now, spec, ctx.lang)
      const top3 = r.rows.slice(0, 3).map((x) => `${x.label} (${x.value})`).join(', ')
      const L = ctx.lang
      const text = r.rows.length
        ? L === 'id' ? `Tiga kecamatan dengan aduan${cat ? ` ${catName(cat, L)}` : ''} terbanyak dalam 7 hari: ${top3}. Total ${r.total} aduan di ${r.rows.length} kecamatan. Peta saya arahkan ke ${r.rows[0]!.label}.` : `Top three districts by${cat ? ` ${CATEGORY_LABEL[cat].en.toLowerCase()}` : ''} complaints in 7 days: ${top3}. ${r.total} complaints across ${r.rows.length} districts. The map now shows ${r.rows[0]!.label}.`
        : L === 'id' ? 'Belum ada aduan dalam 7 hari terakhir untuk kriteria itu.' : 'No complaints in the last 7 days for that criterion.'
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
      const lb = opdLeaderboard(s, now)
      const backlog = [...lb].sort((a, b) => b.openTickets - a.openTickets)[0]
      const L = ctx.lang
      const text = worst
        ? L === 'id' ? `SLA tepat waktu terendah 30 hari terakhir: ${r.rows.slice(0, 3).map((x) => `${x.label} ${x.value}%`).join(', ')}. ${backlog ? `Antrean tiket terbuka terbesar ada di ${backlog.short} (${backlog.openTickets} tiket).` : ''} Klik OPD di papan peringkat untuk scorecard 30 hari.` : `Lowest on-time SLA over 30 days: ${r.rows.slice(0, 3).map((x) => `${x.label} ${x.value}%`).join(', ')}. ${backlog ? `The largest open backlog is at ${backlog.short} (${backlog.openTickets} tickets).` : ''} Click an agency on the leaderboard for its 30-day scorecard.`
        : L === 'id' ? 'Belum cukup tiket selesai untuk menghitung SLA per OPD.' : 'Not enough closed tickets yet to compute SLA per agency.'
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
        ? `Rata-rata SLA tepat waktu 15 hari terakhir ${nf(L, b)}%, ${b >= a ? 'membaik' : 'menurun'} dari ${nf(L, a)}% pada 15 hari sebelumnya. Angka hari ini ${kpiStrip(s, now).slaPct}% (gabungan 30 hari).`
        : `Average on-time SLA over the last 15 days: ${nf(L, b)}%, ${b >= a ? 'up' : 'down'} from ${nf(L, a)}% in the 15 days before. Today's figure is ${kpiStrip(s, now).slaPct}% (30-day aggregate).`
      return { text, structured: query(spec), toolCalls: [step(spec, r)], followUps: chips(L, 'slow', 'index', 'overdue') }
    },
  },
  {
    id: 'prediksi-aduan',
    examples: [
      'Perkiraan jumlah aduan tiga hari ke depan', 'Prediksi aduan besok', 'Berapa aduan yang akan masuk besok?', 'Proyeksi aduan minggu ini',
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
      "What's the flood situation?", 'Are there active flood warnings?', 'How high is the river now?',
      'Banyu kali munggah ora?', 'Piye kahanan banjir saiki?', 'Omah kebanjiran akeh ora?',
    ],
    respond: (ctx) => {
      const { s, now } = ws(ctx)
      const L = ctx.lang
      const river = rows(s.gauges).find((g) => g.kind === 'sungai')
      const al = rows(s.alerts).filter((a) => a.status === 'aktif' && a.kind === 'banjir')
      const spec: QuerySpec = al.length ? { metric: 'alerts', groupBy: 'kecamatan', range: 'today', chart: 'bar' } : { metric: 'complaints', groupBy: 'kecamatan', range: '7d', filter: { category: 'banjir' }, chart: 'bar' }
      const r = runQuery(s, now, spec, L)
      const today = rows(s.complaints).filter((c) => c.category === 'banjir' && c.at >= Math.floor(now / DAY_MIN) * DAY_MIN && c.at <= now).length
      const cl = rows(s.clusters).filter((c) => c.category === 'banjir')
      const g = river ? (L === 'id' ? `Muka air ${river.name} ${nf(L, river.level, 1)} m (siaga ${nf(L, river.siaga, 1)} m, data simulasi). ` : `${river.name} at ${nf(L, river.level, 1)} m (alert level ${nf(L, river.siaga, 1)} m, simulated data). `) : ''
      const a = al.length
        ? L === 'id' ? `${al.length} peringatan banjir aktif, level tertinggi ${Math.max(...al.map((x) => x.level))}: ${al.flatMap((x) => x.kecamatanIds).map((k) => kecName(s, k)).join(', ')}. ` : `${al.length} active flood alerts, highest level ${Math.max(...al.map((x) => x.level))}: ${al.flatMap((x) => x.kecamatanIds).map((k) => kecName(s, k)).join(', ')}. `
        : L === 'id' ? 'Belum ada peringatan banjir aktif dari Siaga Wilayah. ' : 'No active flood alert from Siaga Wilayah yet. '
      const c = L === 'id' ? `${today} aduan banjir hari ini${cl.length ? `, ${cl.length} klaster terbentuk` : ', belum membentuk klaster'}.` : `${today} flood reports today${cl.length ? `, ${cl.length} clusters formed` : ', no cluster yet'}.`
      return { text: g + a + c, structured: query(spec), toolCalls: [step(spec, r)], followUps: [L === 'id' ? 'Instruksikan BPBD siagakan posko banjir' : 'Instruct the BPBD to put flood posts on standby', ...chips(L, 'forecast', 'issues')] }
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
      const ps = rows(s.procurements).filter((p) => p.status !== 'selesai').sort((a, b) => (b.riskScore ?? devOf(b)) - (a.riskScore ?? devOf(a)))
      const p = ps[0]
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
      'Which food prices are rising?', 'How are market prices this week?', 'How much did chilli prices go up?',
      'Rega lombok munggah pira?', 'Regane beras piye saiki?',
    ],
    respond: (ctx) => {
      const { s, now } = ws(ctx)
      const L = ctx.lang
      const t = norm(ctx.text)
      const com = s.region.commodities.find((c) => t.includes(norm(c.name.id).split(' ')[0]!) || t.includes(norm(c.name.en).split(' ').slice(-1)[0]!) || (/lombok|chilli|chili/.test(t) && c.id.startsWith('cabai')))
      const spec: QuerySpec = com ? { metric: 'prices', groupBy: 'market', range: '7d', filter: { commodity: com.id }, chart: 'bar' } : { metric: 'prices', groupBy: 'commodity', range: '7d', chart: 'bar' }
      const r = runQuery(s, now, spec, L)
      const top = r.rows[0]
      const pts = rows(s.prices).filter((p) => !com || p.commodityId === com.id)
      const avgP = pts.length ? pts.reduce((a, p) => a + p.price, 0) / pts.length : 0
      const op = rows(s.marketOps).find((m) => m.stage === 'recommended')
      const text = top
        ? L === 'id'
          ? `${com ? `Harga ${com.name.id.toLowerCase()} rata-rata Rp ${nf(L, Math.round(avgP / 50) * 50)}/${com.unit} (simulasi). Kenaikan sepekan tertinggi di ${top.label} (${top.value >= 0 ? '+' : ''}${nf(L, top.value, 1)}%).` : `Kenaikan harga sepekan tertinggi: ${r.rows.slice(0, 3).map((x) => `${x.label} ${x.value >= 0 ? '+' : ''}${nf(L, x.value, 1)}%`).join(', ')} (rata-rata semua pasar, simulasi).`}${op ? ' Sinyal Pasar sudah merekomendasikan operasi pasar; Anda bisa menyetujuinya lewat "Beri instruksi".' : ''}`
          : `${com ? `${com.name.en} averages Rp ${nf(L, Math.round(avgP / 50) * 50)}/${com.unit} (simulated). The largest weekly rise is at ${top.label} (${top.value >= 0 ? '+' : ''}${nf(L, top.value, 1)}%).` : `Largest weekly price rises: ${r.rows.slice(0, 3).map((x) => `${x.label} ${x.value >= 0 ? '+' : ''}${nf(L, x.value, 1)}%`).join(', ')} (average of all markets, simulated).`}${op ? ' Sinyal Pasar has recommended a market operation; you can approve it via "Issue instruction".' : ''}`
        : L === 'id' ? 'Belum ada data harga.' : 'No price data yet.'
      return { text, structured: query(spec), toolCalls: [step(spec, r)], followUps: [L === 'id' ? 'Instruksikan Disperindag pantau pasokan cabai' : 'Instruct the trade office to monitor chilli supply', ...chips(L, 'issues', 'flood')] }
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
      const k = kpiStrip(s, now)
      const open = rows(s.actionItems).filter((a) => a.status !== 'selesai')
      const late = open.filter((a) => a.dueAt < now).length
      const ratings = rows(s.tickets).filter((t) => t.rating !== null)
      const rating = ratings.length ? ratings.reduce((a, t) => a + (t.rating ?? 0), 0) / ratings.length : 0
      const disc = open.length ? Math.round((1 - late / open.length) * 100) : 100
      const text = L === 'id'
        ? `Indeks layanan ${k.serviceIndex}/100 = 40% SLA tepat waktu (${k.slaPct}%) + 30% kepuasan warga (${nf(L, rating, 1)}/5) + 30% disiplin tindak lanjut (${disc}%, ${late} dari ${open.length} terlambat). Pengungkit tercepat: menuntaskan tindak lanjut yang terlambat dan menaikkan SLA OPD dengan antrean terbesar.`
        : `Service index ${k.serviceIndex}/100 = 40% on-time SLA (${k.slaPct}%) + 30% citizen satisfaction (${nf(L, rating, 1)}/5) + 30% follow-up discipline (${disc}%, ${late} of ${open.length} late). Fastest levers: close the overdue follow-ups and lift the SLA of the agency with the largest backlog.`
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
      const items = briefingItems(s, now)
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
        structured: { kind: 'instruction', data: { to, instruction, deadline: L === 'id' ? 'Besok 16.00 WIB' : 'Tomorrow 16:00 WIB', priority: /segera|darurat|urgent|now|sekarang/i.test(ctx.text) ? 'segera' : 'tinggi' } },
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
      const spec: QuerySpec = { metric: 'complaints', groupBy: 'category', range: 'today', chart: 'bar' }
      const r = runQuery(s, now, spec, L)
      const k = kpiStrip(s, now).complaints
      const text = L === 'id'
        ? `${k.today} aduan masuk hari ini sampai pukul ${hh(now)} (kemarin pada jam yang sama ${k.yesterday}). Terbanyak: ${r.rows.slice(0, 3).map((x) => `${x.label.toLowerCase()} ${x.value}`).join(', ') || '-'}.`
        : `${k.today} complaints today up to ${hh(now)} (yesterday at the same time: ${k.yesterday}). Most: ${r.rows.slice(0, 3).map((x) => `${x.label.toLowerCase()} ${x.value}`).join(', ') || '-'}.`
      return { text, structured: query(spec), toolCalls: [step(spec, r)], followUps: chips(L, 'rank', 'cause', 'forecast') }
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

function avg(v: number[]): number {
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0
}
function hh(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}.${String(m % 60).padStart(2, '0')}`
}

/** "Instruksikan BPBD kerahkan pompa ke Kanor" → a clear, measurable instruction: what, where, when to report */
function draftInstruction(s: WorldState, text: string, L: Lang, kec: string | undefined): string {
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
            : null
  const body = text.replace(/^\s*(tolong\s+)?(instruksikan|perintahkan|minta|tugaskan|kongkon|prentahna|instruct|tell|order|ask)\s+/i, '').trim()
  const base = what ?? (body ? body[0]!.toUpperCase() + body.slice(1) : text)
  return /lapor|report/i.test(base) ? base : `${base}${L === 'id' ? '; laporkan perkembangan tiap 2 jam' : '; report progress every 2 hours'}`
}

export const scenario: Scenario = {
  product: 'meja-pimpinan',
  intents,
  threshold: 0.3,
  fallback: (ctx) => ({
    text: ctx.lang === 'id'
      ? 'Maaf, pertanyaan itu belum bisa saya jawab dari data daerah. Saya paling kuat untuk tren, perbandingan, peringkat, penyebab, dan prediksi sederhana. Coba salah satu pertanyaan ini:'
      : "Sorry, I can't answer that from the regional data yet. I'm strongest at trends, comparisons, rankings, causes and simple forecasts. Try one of these:",
    followUps: chips(ctx.lang, 'cause', 'rank', 'slow'),
  }),
}

