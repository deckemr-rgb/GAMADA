/**
 * demos/meja-pimpinan/query.ts — "Tanya data" query engine. Both AI modes end here: the simulation returns a
 * structured `query` spec, and Live calls the whitelisted tool `query_world` with the same shape
 * (server/ai-proxy QueryWorldSchema). The SCREEN computes the numbers from the world, so text, chart and map
 * always agree. Loaded with the chat (lazy).
 */
import type { Lang } from '../../lib/i18n'
import { CATEGORY_LABEL, DAY_MIN, rows, type Bi, type ComplaintCategory, type Minutes, type WorldState } from '../../demo-kit/world'
import { devOf, kecName, mpLeaderboard, opdShort, weekChange } from './data'
import { riskRank } from './data-ext'
import { topicLabel } from './strings'

export type Metric = 'complaints' | 'sla_on_time' | 'ticket_backlog' | 'alerts' | 'mentions_negative' | 'procurement_risk' | 'sales' | 'prices' | 'econ_index' | 'action_items_overdue'
export type GroupBy = 'none' | 'kecamatan' | 'opd' | 'category' | 'day' | 'commodity' | 'market'
export type Range = 'today' | '7d' | '30d' | '90d'
export interface QuerySpec {
  metric: Metric
  groupBy: GroupBy
  range: Range
  filter?: { kecamatan?: string; category?: string; opd?: string; commodity?: string }
  chart: 'bar' | 'line' | 'table' | 'none'
  /** simulation only: add a simple forecast band to a daily line */
  forecast?: boolean
}

export interface QueryRow {
  id: string
  label: string
  value: number
  prev?: number
}
export interface QueryResult {
  spec: QuerySpec
  title: string
  unit: string
  chart: 'bar' | 'line' | 'table' | 'none'
  rows: QueryRow[]
  /** daily line */
  x?: string[]
  values?: number[]
  forecast?: { values: number[]; lo: number[]; hi: number[] }
  /** kecamatan to fly the map to (top row of a kecamatan grouping, or the filter) */
  kecamatanId?: string
  total: number
  /** "%", "Rp" … for formatting */
  format: 'num' | 'pct' | 'rp'
}

const METRICS = new Set<Metric>(['complaints', 'sla_on_time', 'ticket_backlog', 'alerts', 'mentions_negative', 'procurement_risk', 'sales', 'prices', 'econ_index', 'action_items_overdue'])
const GROUPS = new Set<GroupBy>(['none', 'kecamatan', 'opd', 'category', 'day', 'commodity', 'market'])

/** Accept a structured `query` payload from either mode; null when it is not one we can draw. */
export function parseSpec(data: Record<string, unknown>): QuerySpec | null {
  const metric = data.metric as Metric
  if (!METRICS.has(metric)) return null
  const groupBy = GROUPS.has(data.groupBy as GroupBy) ? (data.groupBy as GroupBy) : 'none'
  const range = (['today', '7d', '30d', '90d'] as const).includes(data.range as Range) ? (data.range as Range) : '7d'
  const chart = (['bar', 'line', 'table', 'none'] as const).includes(data.chart as QuerySpec['chart']) ? (data.chart as QuerySpec['chart']) : 'bar'
  const f = (data.filter ?? {}) as Record<string, unknown>
  const filter: QuerySpec['filter'] = {}
  for (const k of ['kecamatan', 'category', 'opd', 'commodity'] as const) if (typeof f[k] === 'string' && f[k]) filter[k] = f[k] as string
  return { metric, groupBy, range, chart, ...(Object.keys(filter).length ? { filter } : {}), ...(data.forecast === true ? { forecast: true } : {}) }
}

const DAYS: Record<Range, number> = { today: 1, '7d': 7, '30d': 30, '90d': 90 }
const norm = (x: string) => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

/** kecamatan ids from a filter string (id, name, comma-separated list) */
export function kecIds(s: WorldState, f: string | undefined): string[] {
  if (!f) return []
  const parts = f.split(/[,;/]| dan | and /i).map(norm).filter(Boolean)
  return s.region.kecamatan.filter((k) => parts.some((p) => p === k.id || p === norm(k.name) || norm(k.name).includes(p))).map((k) => k.id)
}
/** complaint category from a filter string ("jalan rusak", "roads", "banjir") */
export function categoryOf(f: string | undefined): ComplaintCategory | undefined {
  if (!f) return undefined
  const n = norm(f)
  const w = ` ${n} `
  const hit = (Object.keys(CATEGORY_LABEL) as ComplaintCategory[]).find((c) => c !== 'lainnya' && (n === c.replace('-', ' ') || w.includes(` ${c.replace('-', ' ')} `) || norm(CATEGORY_LABEL[c].id) === n || norm(CATEGORY_LABEL[c].en) === n))
  if (hit) return hit
  const has = (...ws: string[]) => ws.some((x) => w.includes(` ${x} `))
  if (has('jalan', 'jalane', 'road', 'roads', 'dalan', 'dalane', 'aspal', 'pothole', 'potholes', 'berlubang')) return 'jalan-rusak'
  if (has('banjir', 'banjire', 'kebanjiran', 'flood', 'floods', 'flooding', 'flooded', 'genangan', 'banyu munggah')) return 'banjir'
  if (has('sampah', 'sampahe', 'waste', 'uwuh', 'uwuhe', 'trash', 'garbage')) return 'sampah'
  if (has('lampu', 'lampune', 'pju', 'streetlight', 'streetlights', 'light', 'lights')) return 'pju'
  if (has('pdam', 'air bersih', 'clean water', 'tap water')) return 'air-bersih'
  if (has('pungli', 'levy', 'bribe')) return 'pungli'
  if (has('kesehatan', 'puskesmas', 'health')) return 'kesehatan'
  if (has('ktp', 'kk', 'adminduk', 'akta', 'civil registry')) return 'adminduk'
  if (has('bansos', 'social aid')) return 'bansos'
  if (has('pohon', 'tree', 'trees')) return 'pohon-tumbang'
  if (has('sekolah', 'school', 'schools')) return 'sekolah'
  return undefined
}
function opdOf(s: WorldState, f: string | undefined): string | undefined {
  if (!f) return undefined
  const n = norm(f)
  return s.region.opd.find((o) => o.id === n || norm(o.short) === n || norm(o.short).includes(n) || norm(o.name).includes(n))?.id
}

const L = (lang: Lang, b: Bi) => b[lang]
const dayLabel = (s: WorldState, d: number, lang: Lang) => {
  const base = new Date(`${s.day}T00:00:00`)
  base.setDate(base.getDate() + d)
  return base.toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { day: 'numeric', month: 'short' })
}

/** Run a spec against the world at `now`. */
export function runQuery(s: WorldState, now: Minutes, spec: QuerySpec, lang: Lang): QueryResult {
  const days = Math.min(DAYS[spec.range], 30)
  const from = spec.range === 'today' ? Math.floor(now / DAY_MIN) * DAY_MIN : now - days * DAY_MIN
  const span = now - from
  const kecF = kecIds(s, spec.filter?.kecamatan)
  const catF = categoryOf(spec.filter?.category)
  const opdF = opdOf(s, spec.filter?.opd)
  const today = Math.floor(now / DAY_MIN)
  const groupLabel = (g: GroupBy, key: string): string =>
    g === 'kecamatan' ? kecName(s, key) : g === 'opd' ? opdShort(s, key) : g === 'category' ? (CATEGORY_LABEL[key as ComplaintCategory]?.[lang] ?? key) : key
  const res = (r: Partial<QueryResult> & Pick<QueryResult, 'title' | 'unit' | 'rows'>): QueryResult => ({
    spec, chart: spec.chart, total: r.rows.reduce((a, x) => a + x.value, 0), format: 'num', ...r,
  })
  const bucket = <T,>(items: T[], key: (x: T) => string, inNow: (x: T) => boolean, inPrev: (x: T) => boolean): QueryRow[] => {
    const by = new Map<string, QueryRow>()
    for (const x of items) {
      const k = key(x)
      const r = by.get(k) ?? { id: k, label: groupLabel(spec.groupBy, k), value: 0, prev: 0 }
      if (inNow(x)) r.value++
      else if (inPrev(x)) r.prev = (r.prev ?? 0) + 1
      by.set(k, r)
    }
    return [...by.values()].filter((r) => r.value || r.prev).sort((a, b) => b.value - a.value || (b.prev ?? 0) - (a.prev ?? 0))
  }
  const perDay = <T,>(items: T[], at: (x: T) => number, val: (x: T) => number = () => 1): { x: string[]; values: number[] } => {
    const n = Math.max(2, days)
    const v = Array.from({ length: n }, () => 0)
    for (const it of items) {
      const i = Math.floor(at(it) / DAY_MIN) - (today - n + 1)
      if (i >= 0 && i < n && at(it) <= now) v[i]! += val(it)
    }
    return { x: v.map((_, i) => dayLabel(s, today - n + 1 + i, lang)), values: v }
  }

  switch (spec.metric) {
    case 'complaints': {
      const list = rows(s.complaints).filter((c) => (!catF || c.category === catF) && (!kecF.length || kecF.includes(c.kecamatanId)) && (!opdF || s.tickets.byId[c.ticketId]?.opdId === opdF))
      const what = catF ? (/^[A-Z]{2}/.test(L(lang, CATEGORY_LABEL[catF])) ? L(lang, CATEGORY_LABEL[catF]) : L(lang, CATEGORY_LABEL[catF]).toLowerCase()) : ''
      const title = lang === 'id' ? `Aduan${what ? ` ${what}` : ''}${spec.groupBy === 'kecamatan' ? ' per kecamatan' : spec.groupBy === 'category' ? ' per kategori' : spec.groupBy === 'opd' ? ' per OPD' : spec.groupBy === 'day' ? ' per hari' : ''}` : `${what ? `${what[0]!.toUpperCase()}${what.slice(1)} complaints` : 'Complaints'}${spec.groupBy === 'kecamatan' ? ' by district' : spec.groupBy === 'category' ? ' by category' : spec.groupBy === 'opd' ? ' by agency' : spec.groupBy === 'day' ? ' per day' : ''}`
      const unit = lang === 'id' ? `aduan, ${rangeText(spec.range, lang)} vs periode sebelumnya` : `complaints, ${rangeText(spec.range, lang)} vs the previous period`
      if (spec.groupBy === 'day') {
        const d = perDay(list, (c) => c.at)
        const out = res({ title, unit: lang === 'id' ? 'aduan / hari' : 'complaints / day', rows: [], x: d.x, values: d.values, chart: spec.chart === 'bar' ? 'line' : spec.chart })
        out.total = d.values.reduce((a, b) => a + b, 0)
        if (spec.forecast) out.forecast = forecastOf(d.values, s)
        return out
      }
      const key = (c: (typeof list)[number]) => (spec.groupBy === 'kecamatan' ? c.kecamatanId : spec.groupBy === 'category' ? c.category : spec.groupBy === 'opd' ? (s.tickets.byId[c.ticketId]?.opdId ?? '-') : 'all')
      const r = bucket(list, key, (c) => c.at > from && c.at <= now, (c) => c.at > from - span && c.at <= from)
      if (spec.groupBy === 'none') r.forEach((x) => (x.label = title))
      return res({ title, unit, rows: r, ...(spec.groupBy === 'kecamatan' && r[0] ? { kecamatanId: r[0].id } : kecF[0] ? { kecamatanId: kecF[0] } : {}) })
    }
    case 'sla_on_time': {
      const list = rows(s.tickets).filter((t) => t.closedAt !== null && t.closedAt > now - 30 * DAY_MIN && t.closedAt <= now && (!opdF || t.opdId === opdF))
      const title = lang === 'id' ? `SLA tepat waktu${spec.groupBy === 'opd' ? ' per OPD' : spec.groupBy === 'day' ? ' per hari' : ''}` : `SLA on time${spec.groupBy === 'opd' ? ' by agency' : spec.groupBy === 'day' ? ' per day' : ''}`
      if (spec.groupBy === 'day') {
        const n = Math.max(7, days)
        const ok = Array.from({ length: n }, () => 0)
        const all = Array.from({ length: n }, () => 0)
        for (const t of list) {
          const i = Math.floor(t.closedAt! / DAY_MIN) - (today - n + 1)
          if (i < 0 || i >= n) continue
          all[i]!++
          if (t.closedAt! <= t.slaDueAt) ok[i]!++
        }
        let last = 0
        const values = all.map((a, i) => (a ? (last = Math.round((ok[i]! / a) * 100)) : last))
        return { ...res({ title, unit: '%', rows: [] }), chart: 'line', x: values.map((_, i) => dayLabel(s, today - n + 1 + i, lang)), values, total: values[values.length - 1] ?? 0, format: 'pct' }
      }
      if (spec.groupBy === 'opd') {
        // the leaderboard's own rows and rule (open tickets past SLA count, agencies below the minimum sample left out)
        const r = mpLeaderboard(s, now).filter((x) => x.slaPct !== null && (!opdF || x.opdId === opdF)).map((x) => ({ id: x.opdId, label: x.short, value: x.slaPct! })).sort((a, b) => a.value - b.value)
        return { ...res({ title, unit: lang === 'id' ? '% tepat waktu, 30 hari (tiket terbuka lewat SLA ikut dihitung; terendah dulu)' : '% on time, 30 days (open tickets past SLA count; lowest first)', rows: r }), format: 'pct' }
      }
      const by = new Map<string, { ok: number; all: number }>()
      for (const t of list) {
        const c = s.complaints.byId[t.complaintId]
        const k = spec.groupBy === 'kecamatan' ? (c?.kecamatanId ?? '-') : spec.groupBy === 'category' ? (c?.category ?? '-') : spec.groupBy === 'none' ? 'all' : t.opdId
        const r = by.get(k) ?? { ok: 0, all: 0 }
        r.all++
        if (t.closedAt! <= t.slaDueAt) r.ok++
        by.set(k, r)
      }
      const r = [...by.entries()].filter(([, v]) => v.all >= 2).map(([k, v]) => ({ id: k, label: k === 'all' ? title : groupLabel(spec.groupBy, k), value: Math.round((v.ok / v.all) * 100) })).sort((a, b) => a.value - b.value)
      return { ...res({ title, unit: lang === 'id' ? '% tiket selesai tepat waktu, 30 hari (terendah dulu)' : '% of tickets closed on time, 30 days (lowest first)', rows: r }), format: 'pct' }
    }
    case 'ticket_backlog': {
      const list = rows(s.tickets).filter((t) => t.status !== 'selesai' && t.createdAt <= now && (!opdF || t.opdId === opdF))
      const g = spec.groupBy === 'none' || spec.groupBy === 'day' ? 'opd' : spec.groupBy
      const key = (t: (typeof list)[number]) => (g === 'kecamatan' ? (s.complaints.byId[t.complaintId]?.kecamatanId ?? '-') : g === 'category' ? (s.complaints.byId[t.complaintId]?.category ?? '-') : t.opdId)
      const by = new Map<string, QueryRow>()
      for (const t of list) {
        const k = key(t)
        const r = by.get(k) ?? { id: k, label: groupLabel(g, k), value: 0 }
        r.value++
        by.set(k, r)
      }
      const r = [...by.values()].sort((a, b) => b.value - a.value)
      return res({ title: lang === 'id' ? 'Tiket terbuka' : 'Open tickets', unit: lang === 'id' ? 'tiket belum selesai' : 'unresolved tickets', rows: r, ...(g === 'kecamatan' && r[0] ? { kecamatanId: r[0].id } : {}) })
    }
    case 'alerts': {
      const act = rows(s.alerts).filter((a) => a.status === 'aktif')
      const r: QueryRow[] = []
      for (const a of act) for (const k of a.kecamatanIds) r.push({ id: k, label: kecName(s, k), value: a.level })
      return res({ title: lang === 'id' ? 'Peringatan aktif per kecamatan' : 'Active alerts by district', unit: lang === 'id' ? 'level peringatan (1–4)' : 'alert level (1–4)', rows: r.sort((a, b) => b.value - a.value), ...(r[0] ? { kecamatanId: r[0].id } : {}) })
    }
    case 'mentions_negative': {
      const list = rows(s.mentions).filter((m) => m.sentiment === 'negatif' && m.at <= now)
      if (spec.groupBy === 'day') {
        const d = perDay(list, (m) => m.at)
        return { ...res({ title: lang === 'id' ? 'Mention negatif per hari' : 'Negative mentions per day', unit: lang === 'id' ? 'mention' : 'mentions', rows: [] }), chart: 'line', x: d.x, values: d.values, total: d.values.reduce((a, b) => a + b, 0) }
      }
      const by = new Map<string, QueryRow>()
      for (const m of list) {
        const cur = m.at > from
        const prev = !cur && m.at > from - span
        if (!cur && !prev) continue
        const r = by.get(m.topic) ?? { id: m.topic, label: topicLabel(m.topic, lang), value: 0, prev: 0 }
        if (cur) r.value++
        else r.prev = (r.prev ?? 0) + 1
        by.set(m.topic, r)
      }
      return res({ title: lang === 'id' ? 'Isu negatif per topik' : 'Negative issues by topic', unit: lang === 'id' ? `mention negatif, ${rangeText(spec.range, lang)}` : `negative mentions, ${rangeText(spec.range, lang)}`, rows: [...by.values()].sort((a, b) => b.value - a.value) })
    }
    case 'procurement_risk': {
      const list = rows(s.procurements).filter((p) => p.status !== 'selesai' && (!opdF || p.opdId === opdF))
      // the riskiest first in the same order as the briefing (flagged by score, then emergency, then mark-up)
      // ONE metric per chart: % the cost estimate sits above the market (the risk score, when there is one, is in the label)
      const r = [...list].sort((a, b) => riskRank(b) - riskRank(a)).map((p) => ({ id: p.id, label: `${p.code} · ${p.name[lang]}${p.riskScore != null ? ` · ${lang === 'id' ? 'skor' : 'score'} ${p.riskScore}` : ''}`, value: Math.round(devOf(p) * 10) / 10 })).slice(0, 8)
      return { ...res({ title: lang === 'id' ? 'Paket pengadaan: HPS di atas harga pasar' : "Procurement packages: owner's estimate (HPS) above market", unit: lang === 'id' ? '% HPS di atas harga pasar, paket paling berisiko dulu (simulasi)' : '% above market price, riskiest package first (simulated)', rows: r }), format: 'pct' as const }
    }
    case 'prices': {
      const com = spec.filter?.commodity ? s.region.commodities.find((c) => norm(c.id).includes(norm(spec.filter!.commodity!)) || norm(c.name.id).includes(norm(spec.filter!.commodity!)) || norm(c.name.en).includes(norm(spec.filter!.commodity!)))?.id : undefined
      const pts = rows(s.prices).filter((p) => !com || p.commodityId === com)
      if (spec.groupBy === 'day' && com) {
        const n = Math.max(7, days)
        const values = Array.from({ length: n }, (_, i) => {
          const back = n - 1 - i
          const xs = pts.map((p) => (back === 0 ? p.price : (p.history[p.history.length - back] ?? p.price)))
          return Math.round(xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length))
        })
        return { ...res({ title: lang === 'id' ? `Harga rata-rata ${s.region.commodities.find((c) => c.id === com)?.name.id ?? com}` : `Average price of ${s.region.commodities.find((c) => c.id === com)?.name.en ?? com}`, unit: lang === 'id' ? `Rp per ${s.region.commodities.find((c) => c.id === com)?.unit ?? 'satuan'} (simulasi)` : `Rp per ${s.region.commodities.find((c) => c.id === com)?.unit ?? 'unit'} (simulated)`, rows: [] }), chart: 'line', x: values.map((_, i) => dayLabel(s, today - n + 1 + i, lang)), values, total: values[values.length - 1] ?? 0, format: 'rp' }
      }
      const g = spec.groupBy === 'market' ? 'market' : 'commodity'
      const by = new Map<string, number[]>()
      for (const p of pts) {
        const k = g === 'market' ? p.marketId : p.commodityId
        by.set(k, [...(by.get(k) ?? []), weekChange(p.price, p.history)])
      }
      const r = [...by.entries()].map(([k, v]) => ({ id: k, label: g === 'market' ? (s.markets.byId[k]?.name ?? k) : (s.region.commodities.find((c) => c.id === k)?.name[lang] ?? k), value: Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 1000) / 10 })).sort((a, b) => b.value - a.value).slice(0, 8)
      return { ...res({ title: lang === 'id' ? `Perubahan harga sepekan per ${g === 'market' ? 'pasar' : 'komoditas'}` : `Weekly price change by ${g === 'market' ? 'market' : 'commodity'}`, unit: lang === 'id' ? '% vs 7 hari lalu (simulasi)' : '% vs 7 days ago (simulated)', rows: r }), format: 'pct' }
    }
    case 'econ_index': {
      const latest = new Map<string, { month: string; index: number }>()
      for (const e of rows(s.econIndex)) {
        const cur = latest.get(e.kecamatanId)
        if (!cur || e.month > cur.month) latest.set(e.kecamatanId, { month: e.month, index: e.index })
      }
      const r = [...latest.entries()].map(([k, v]) => ({ id: k, label: kecName(s, k), value: Math.round(v.index) })).sort((a, b) => b.value - a.value)
      return res({ title: lang === 'id' ? 'Indeks ekonomi per kecamatan' : 'Economic index by district', unit: lang === 'id' ? '100 = rata-rata 12 bulan (simulasi)' : '100 = 12-month average (simulated)', rows: r, ...(r[0] ? { kecamatanId: r[0].id } : {}) })
    }
    case 'action_items_overdue': {
      const list = rows(s.actionItems).filter((a) => a.status !== 'selesai' && a.dueAt < now && (!opdF || a.opdId === opdF))
      const by = new Map<string, QueryRow>()
      for (const a of list) {
        const r = by.get(a.opdId) ?? { id: a.opdId, label: opdShort(s, a.opdId), value: 0 }
        r.value++
        by.set(a.opdId, r)
      }
      return res({ title: lang === 'id' ? 'Tindak lanjut terlambat per OPD' : 'Overdue follow-ups by agency', unit: lang === 'id' ? 'butir lewat tenggat' : 'items past due', rows: [...by.values()].sort((a, b) => b.value - a.value) })
    }
    case 'sales': {
      const d = perDay(rows(s.sales), (x) => x.at, (x) => x.total)
      return { ...res({ title: lang === 'id' ? 'Penjualan toko mitra per hari' : 'Partner shop sales per day', unit: lang === 'id' ? 'Rp (simulasi)' : 'Rp (simulated)', rows: [] }), chart: 'line', x: d.x, values: d.values, total: d.values.reduce((a, b) => a + b, 0), format: 'rp' }
    }
  }
}

/** simple forecast: 7-day mean × rain/flood factor, band ± 1 sd (next 3 days) */
export function forecastOf(values: number[], s: WorldState): { values: number[]; lo: number[]; hi: number[] } {
  const last = values.slice(-7)
  const mean = last.reduce((a, b) => a + b, 0) / Math.max(1, last.length)
  const sd = Math.sqrt(last.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, last.length))
  const river = rows(s.gauges).find((g) => g.kind === 'sungai')
  const wet = rows(s.alerts).some((a) => a.status === 'aktif') ? 1.35 : river && river.level >= river.normal + (river.siaga - river.normal) * 0.6 ? 1.15 : 1
  const v = [1, 2, 3].map((i) => Math.round(mean * wet * (1 + 0.03 * i) * 10) / 10)
  return { values: v, lo: v.map((x) => Math.max(0, Math.round((x - sd) * 10) / 10)), hi: v.map((x) => Math.round((x + sd) * 10) / 10) }
}

export function rangeText(r: Range, lang: Lang): string {
  return lang === 'id' ? { today: 'hari ini', '7d': '7 hari', '30d': '30 hari', '90d': '90 hari' }[r] : { today: 'today', '7d': '7 days', '30d': '30 days', '90d': '90 days' }[r]
}
