/**
 * demos/meja-pimpinan/data.ts — product-local derivations over the shared world (pure, memoised where called from
 * useWorld). Everything reads the simulated world; nothing here invents numbers of its own except the simulated
 * project locations, which say so.
 */
import { useSyncExternalStore } from 'react'
import { PRODUCT_BY_SLUG, isProductSlug, type ProductSlug } from '../../content/products'
import type { IconName } from '../../demo-kit/ui'
import {
  CATEGORY_LABEL, DAY_MIN, clock, createParamSelector, createSelector, rows,
  type AuditEntry, type Bi, type ComplaintCategory, type EntityRef, type EventType, type Minutes, type WorldState,
} from '../../demo-kit/world'
import { briefingItems, gaugeLevelAt, gaugeName, gaugeOutlook, weekChangeOf, type BriefingItem } from '../../demo-kit/world/satu-daerah'

/* ------------------------------------------------------------------ constants (module-local) */
export const MP = {
  /** days in the KPI sparkline */
  sparkDays: 7,
  /** days in the SLA sparkline */
  slaDays: 14,
  /** timeline rows */
  timelineRows: 40,
  /** suggestions in the instruction dialog */
  ideas: 6,
  /** briefing "assembling" tick per source product (s) */
  assembleTick: 0.17,
  /** briefing card stagger (s) */
  cardStagger: 0.09,
  /** meeting mode panel rotation (ms, spec P2 step 6) */
  rotateMs: 15000,
  /** width (px) from which the wall screen keeps its 16:9 body */
  wallMinW: 1180,
} as const

/* ------------------------------------------------------------------ small helpers */
export const kecName = (s: WorldState, id: string): string => s.region.kecamatan.find((k) => k.id === id)?.name ?? id
export const desaName = (s: WorldState, kec: string, desa: string): string => s.region.kecamatan.find((k) => k.id === kec)?.desa.find((d) => d.id === desa)?.name ?? desa
export const opdShort = (s: WorldState, id: string): string => s.region.opd.find((o) => o.id === id)?.short ?? id
export const refId = (r: EntityRef | undefined): string | null => (r ? (r.split(':').slice(1).join(':') || null) : null)

/** keep ?controls=all on cross-product links while the products are not DEMO_READY (dev / controls builds only) */
export function withControls(href: string): string {
  if (typeof window === 'undefined') return href
  return new URLSearchParams(window.location.search).get('controls') === 'all' ? `${href}${href.includes('?') ? '&' : '?'}controls=all` : href
}

/* ------------------------------------------------------------------ KPI micro series */

/** complaints per day for the last `MP.sparkDays` days (today = partial up to now), oldest → newest */
export const complaintDays = createParamSelector((s) => [s.complaints], (now: Minutes, t): number[] => {
  const today = Math.floor(now / DAY_MIN)
  const out = Array.from({ length: MP.sparkDays }, () => 0)
  for (const c of rows(t)) {
    if (c.at > now) continue
    const i = Math.floor(c.at / DAY_MIN) - (today - MP.sparkDays + 1)
    if (i >= 0 && i < out.length) out[i]!++
  }
  return out
})

/** % of tickets closed on time per day, last `MP.slaDays` days (days without closures carry the previous value) */
export const slaDays = createParamSelector((s) => [s.tickets], (day: number, t): number[] => {
  const n = MP.slaDays
  const done = Array.from({ length: n }, () => 0)
  const ok = Array.from({ length: n }, () => 0)
  for (const x of rows(t)) {
    if (x.closedAt === null) continue
    const i = Math.floor(x.closedAt / DAY_MIN) - (day - n + 1)
    if (i < 0 || i >= n) continue
    done[i]!++
    if (x.closedAt <= x.slaDueAt) ok[i]!++
  }
  let last = 80
  return done.map((d, i) => (d ? (last = Math.round((ok[i]! / d) * 100)) : last))
})

/** negative mentions per hour, last 12 h */
export const negativeHours = createParamSelector((s) => [s.mentions], (now: Minutes, t): number[] => {
  const out = Array.from({ length: 12 }, () => 0)
  for (const m of rows(t)) {
    if (m.sentiment !== 'negatif' || m.at > now || m.at <= now - 12 * 60) continue
    const i = 11 - Math.floor((now - m.at) / 60)
    if (i >= 0 && i < 12) out[i]!++
  }
  return out
})

/** the complaint category that rose most this week vs last week (the first "Tanya data" example asks about it) */
export const risingCategory = createParamSelector((s) => [s.complaints], (now: Minutes, t): ComplaintCategory => {
  const d = new Map<ComplaintCategory, number>()
  for (const c of rows(t)) {
    if (c.at > now - 7 * DAY_MIN && c.at <= now) d.set(c.category, (d.get(c.category) ?? 0) + 1)
    else if (c.at > now - 14 * DAY_MIN && c.at <= now - 7 * DAY_MIN) d.set(c.category, (d.get(c.category) ?? 0) - 1)
  }
  const top = [...d.entries()].filter(([k]) => k !== 'lainnya').sort((a, b) => b[1] - a[1])[0]
  return top && top[1] > 0 ? top[0] : 'jalan-rusak'
})
/** a label mid-sentence: lower case, but acronyms stay ("PJU mati", not "pju mati") */
export const lcLabel = (t: string): string => (/^[A-Z]{2}/.test(t) ? t : t.toLowerCase())
export const causeQuestion = (c: ComplaintCategory): Bi => ({
  id: `Kenapa aduan ${lcLabel(CATEGORY_LABEL[c].id)} naik minggu ini?`,
  en: `Why are ${lcLabel(CATEGORY_LABEL[c].en)} complaints up this week?`,
})

/** % the cost estimate (HPS) sits above the market price, item by item (the same formula as the kit's briefing) */
export function devOf(p: { items: { qty: number; marketPrice: number; hpsPrice: number }[] }): number {
  const market = p.items.reduce((a, i) => a + i.qty * i.marketPrice, 0)
  const hps = p.items.reduce((a, i) => a + i.qty * i.hpsPrice, 0)
  return market > 0 ? ((hps - market) / market) * 100 : 0
}
/** change vs 7 days ago; `history` holds daily closes EXCLUDING today, so 7 days ago is the 7th from the end */
export const weekChange = (price: number, history: number[]): number => weekChangeOf(price, history)
/* ------------------------------------------------------------------ agency scores (one rule everywhere in Meja Pimpinan) */

/** an agency needs this many tickets in the 30-day window (closed + open past SLA) before it gets an SLA, a score
 *  and a rank; below it the leaderboard, the scorecard, the agency KPIs and "Tanya data" all say "data belum cukup" */
export const OPD_MIN_SAMPLE = 3

export interface MpOpdRow {
  opdId: string
  name: string
  short: string
  openTickets: number
  /** open tickets already past their SLA deadline (they count against the SLA) */
  lateTickets: number
  closed30: number
  onTime30: number
  /** on time ÷ (closed in 30 days + open past SLA); null below OPD_MIN_SAMPLE */
  slaPct: number | null
  rating: number | null
  actionsOpen: number
  /** follow-ups past their deadline and not done */
  actionsLate: number
  /** composite 0–100 (SLA 50 %, follow-up discipline 30 %, satisfaction 20 %); null below OPD_MIN_SAMPLE */
  score: number | null
  /** 1-based rank among agencies with enough data; null otherwise */
  rank: number | null
}

/**
 * The agency leaderboard as Meja Pimpinan shows it. Differences from the kit's opdLeaderboard (reported to the kit):
 * open tickets past their SLA count against the SLA (not only closed ones), follow-up discipline counts only items
 * already due (a new instruction cannot raise it), and agencies with too little data get no score or rank.
 */
export const mpLeaderboard = createParamSelector((s) => [s.tickets, s.actionItems, s.region], (now: Minutes, tickets, actions, region): MpOpdRow[] => {
  type Acc = MpOpdRow & { rSum: number; rN: number; due: number }
  const by = new Map<string, Acc>()
  const row = (opdId: string): Acc => {
    let r = by.get(opdId)
    if (!r) {
      const o = region.opd.find((x) => x.id === opdId)
      r = { opdId, name: o?.name ?? opdId, short: o?.short ?? opdId, openTickets: 0, lateTickets: 0, closed30: 0, onTime30: 0, slaPct: null, rating: null, actionsOpen: 0, actionsLate: 0, score: null, rank: null, rSum: 0, rN: 0, due: 0 }
      by.set(opdId, r)
    }
    return r
  }
  for (const t of rows(tickets)) {
    if (t.createdAt > now) continue
    const r = row(t.opdId)
    if (t.status !== 'selesai' || t.closedAt === null || t.closedAt > now) {
      r.openTickets++
      if (t.slaDueAt < now) r.lateTickets++
    } else if (t.closedAt > now - 30 * DAY_MIN) {
      r.closed30++
      if (t.closedAt <= t.slaDueAt) r.onTime30++
    }
    if (t.rating !== null) {
      r.rSum += t.rating
      r.rN++
    }
  }
  for (const a of rows(actions)) {
    const r = row(a.opdId)
    if (a.status !== 'selesai') r.actionsOpen++
    if (a.dueAt < now) {
      r.due++
      if (a.status !== 'selesai') r.actionsLate++
    }
  }
  const out: MpOpdRow[] = []
  for (const r of by.values()) {
    const n = r.closed30 + r.lateTickets
    const sla = n >= OPD_MIN_SAMPLE ? Math.round((r.onTime30 / n) * 100) : null
    const rating = r.rN ? Math.round((r.rSum / r.rN) * 10) / 10 : null
    const discipline = r.due ? 1 - r.actionsLate / r.due : 1
    const score = sla === null ? null : Math.round(0.5 * sla + 30 * discipline + 20 * ((rating ?? 3.5) / 5))
    const { rSum: _a, rN: _b, due: _c, ...rest } = r
    out.push({ ...rest, slaPct: sla, rating, score })
  }
  out.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.short.localeCompare(b.short))
  let k = 0
  for (const r of out) if (r.score !== null) r.rank = ++k
  return out
})
/** agencies with a rank (enough data) */
export const rankedCount = (lb: MpOpdRow[]): number => lb.filter((r) => r.rank !== null).length

/**
 * Service index 0–100 = 40 % on-time SLA + 30 % citizen satisfaction + 30 % follow-up discipline, where discipline
 * counts only follow-ups already due (done ÷ due). Sending an instruction (a task due tomorrow) does not move it.
 * The SLA is the leaderboard's rule for the whole region: closed on time in 30 days ÷ (closed in 30 days + open
 * tickets already past their SLA), so the KPI, the agencies and "Tanya data" never disagree.
 */
export const mpServiceIndex = createParamSelector((s) => [s.tickets, s.actionItems], (now: Minutes, tickets, actions): { index: number; sla: number; rating: number; discipline: number; due: number; late: number; pastSla: number } => {
  let done = 0
  let onTime = 0
  let n = 0
  let sum = 0
  let pastSla = 0
  for (const t of rows(tickets)) {
    if (t.createdAt > now) continue
    if (t.rating !== null) {
      n++
      sum += t.rating
    }
    if (t.status !== 'selesai' || t.closedAt === null || t.closedAt > now) {
      if (t.slaDueAt < now) pastSla++
      continue
    }
    if (t.closedAt <= now - 30 * DAY_MIN) continue
    done++
    if (t.closedAt <= t.slaDueAt) onTime++
  }
  const sla = done + pastSla ? Math.round((onTime / (done + pastSla)) * 100) : 100
  const rating = n ? Math.round((sum / n) * 10) / 10 : 0
  let due = 0
  let late = 0
  for (const a of rows(actions)) {
    if (a.dueAt >= now) continue
    due++
    if (a.status !== 'selesai') late++
  }
  const discipline = due ? 1 - late / due : 1
  return { index: Math.round(0.4 * sla + 0.3 * (rating / 5) * 100 + 0.3 * discipline * 100), sla, rating, discipline: Math.round(discipline * 100), due, late, pastSla }
})

/** part of the (world) day for greetings and the briefing title: pagi < 11, siang < 15, sore < 18.30, else malam */
export type DayPart = 'pagi' | 'siang' | 'sore' | 'malam'
export const dayPart = (m: Minutes): DayPart => {
  const t = ((m % DAY_MIN) + DAY_MIN) % DAY_MIN
  return t < 11 * 60 ? 'pagi' : t < 15 * 60 ? 'siang' : t < 18 * 60 + 30 ? 'sore' : 'malam'
}

/* ------------------------------------------------------------------ the briefing as Meja Pimpinan shows it */


/**
 * The briefing as Meja Pimpinan shows it: the kit's briefingItems, which now carries the corrections first made here
 * (true 7-day price change via weekChangeOf, EN topic labels, distinct record per item, Indeks Ekonomi item).
 */
export function mpBriefingItems(s: WorldState, now: Minutes): BriefingItem[] {
  return briefingItems(s, now).map((it) => {
    const r0 = it.refs[0] ?? ''
    // 3 · the river: ONE reading (the kit's clock-driven curve) with its status, the same as "Tanya data" and Siaga Wilayah
    if (it.source === 'siaga-wilayah' && r0.startsWith('gauges:')) {
      const r = riverNow(s, now)
      if (r) return { ...it, title: riverTitle(r), detail: riverDetail(r, now) }
    }
    // 4 · a hoax the leader already ordered a clarification for: say so (the banner switches to "handled" too)
    if (it.source === 'radar-isu' && r0.startsWith('hoaxAlerts:')) {
      const ins = clarificationFor(s, refId(r0) ?? '')
      if (ins) return { ...it, detail: { id: `Klarifikasi diinstruksikan pukul ${hhmm(ins.at)} (${ins.opdIds.map((o) => opdShort(s, o)).join(', ')}), menunggu rilis`, en: `Clarification ordered at ${hhmm(ins.at)} (${ins.opdIds.map((o) => opdShort(s, o)).join(', ')}), awaiting release` } }
    }
    // 5 · EN: HPS is the owner's cost estimate
    if (it.source === 'awas-belanja' && /^HPS /.test(it.detail.en)) return { ...it, detail: { ...it.detail, en: it.detail.en.replace(/^HPS /, "Owner's estimate (HPS) ") } }
    return it
  })
}

export const hhmm = (m: Minutes): string => {
  const t = ((m % DAY_MIN) + DAY_MIN) % DAY_MIN
  return `${String(Math.floor(t / 60)).padStart(2, '0')}.${String(t % 60).padStart(2, '0')}`
}

/* ------------------------------------------------------------------ the river (one reading everywhere) */

export interface RiverNow {
  id: string
  name: Bi
  /** level now, m (the kit's clock-driven curve: the number Siaga Wilayah shows) */
  level: number
  /** change over the last 24 h, m */
  rise24: number
  siaga: number
  awas: number
  state: 'normal' | 'siaga' | 'awas'
  /** m over the last hour */
  trend: number
  peak: { level: number; at: Minutes }
  /** active flood alerts right now */
  alerts: number
}
/** the main river gauge at a world minute: level, 24 h rise, status and the active flood alerts (SIMULATED readings) */
export function riverNow(s: WorldState, now: Minutes): RiverNow | null {
  const g = rows(s.gauges).find((x) => x.kind === 'sungai')
  if (!g) return null
  const o = gaugeOutlook(g, now)
  const alerts = rows(s.alerts).filter((a) => a.status === 'aktif' && a.kind === 'banjir').length
  return { id: g.id, name: gaugeName(g), level: gaugeLevelAt(g, now), rise24: gaugeLevelAt(g, now) - gaugeLevelAt(g, now - DAY_MIN), siaga: g.siaga, awas: g.awas, state: o.state, trend: o.trend, peak: o.peak, alerts }
}
const n1 = (v: number, l: 'id' | 'en') => v.toLocaleString(l === 'id' ? 'id-ID' : 'en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
/** the status word: AWAS / SIAGA in Indonesian; in English the level name with the Indonesian term */
export const riverState = (st: RiverNow['state']): Bi =>
  st === 'awas' ? { id: 'AWAS', en: 'danger level AWAS' } : st === 'siaga' ? { id: 'SIAGA', en: 'alert level SIAGA' } : { id: 'normal', en: 'normal' }
export function riverTitle(r: RiverNow): Bi {
  const st = riverState(r.state)
  if (r.state === 'normal') return { id: `Muka air ${r.name.id} ${n1(r.level, 'id')} m, ${r.rise24 >= 0 ? 'naik' : 'turun'} ${n1(Math.abs(r.rise24), 'id')} m dalam 24 jam`, en: `${r.name.en} at ${n1(r.level, 'en')} m, ${r.rise24 >= 0 ? 'up' : 'down'} ${n1(Math.abs(r.rise24), 'en')} m in 24 h` }
  const lim = r.state === 'awas' ? r.awas : r.siaga
  return {
    id: `${r.name.id} status ${st.id}: ${n1(r.level, 'id')} m (batas ${st.id.toLowerCase()} ${n1(lim, 'id')} m)`,
    en: `${r.name.en} at ${st.en}: ${n1(r.level, 'en')} m (threshold ${n1(lim, 'en')} m)`,
  }
}
export function riverDetail(r: RiverNow, now: Minutes): Bi {
  const rise = { id: `${r.rise24 >= 0 ? 'Naik' : 'Turun'} ${n1(Math.abs(r.rise24), 'id')} m dalam 24 jam`, en: `${r.rise24 >= 0 ? 'Up' : 'Down'} ${n1(Math.abs(r.rise24), 'en')} m in 24 h` }
  const next: Bi = r.peak.level > r.level + 0.05
    ? { id: `puncak ±${n1(r.peak.level, 'id')} m sekitar pukul ${hhmm(r.peak.at)}`, en: `crest ≈ ${n1(r.peak.level, 'en')} m around ${hhmm(r.peak.at)}` }
    : r.trend < -0.02 ? { id: 'mulai surut', en: 'starting to recede' } : { id: 'bertahan', en: 'holding' }
  if (r.state === 'normal') {
    const rain: Bi = now < 11 * 60 ? { id: ' Hujan lebat diprakirakan siang ini.', en: ' Heavy rain expected this afternoon.' } : { id: '', en: '' }
    return { id: `Batas siaga ${n1(r.siaga, 'id')} m; ${next.id} (data simulasi).${rain.id}`, en: `Alert level ${n1(r.siaga, 'en')} m; ${next.en} (simulated data).${rain.en}` }
  }
  return r.alerts
    ? { id: `${rise.id}; ${next.id}. ${r.alerts} peringatan banjir aktif (data simulasi).`, en: `${rise.en}; ${next.en}. ${r.alerts} flood warning(s) active (simulated data).` }
    : { id: `${rise.id}; ${next.id}. Belum ada peringatan banjir resmi: BPBD mengirimnya dari Siaga Wilayah (data simulasi).`, en: `${rise.en}; ${next.en}. No official flood warning yet: the BPBD sends it from Siaga Wilayah (simulated data).` }
}

/** the clarification instruction already issued for a hoax (refs it), latest first */
export function clarificationFor(s: WorldState, hoaxId: string): { at: Minutes; opdIds: string[]; letterId: string | null } | null {
  if (!hoaxId) return null
  const key = `hoaxAlerts:${hoaxId}`
  let best: { at: Minutes; opdIds: string[]; letterId: string | null } | null = null
  for (const i of rows(s.instructions)) if (i.refs.includes(key as EntityRef) && (!best || i.at > best.at)) best = { at: i.at, opdIds: i.opdIds, letterId: i.letterId }
  return best
}
/** same items (titles, details, links) => same value, so a panel does not re-render for unrelated world changes */
export const sameItems = (a: BriefingItem[], b: BriefingItem[]): boolean =>
  a.length === b.length && a.every((x, i) => x.title.id === b[i]!.title.id && x.detail.id === b[i]!.detail.id && x.refs[0] === b[i]!.refs[0])

/* ------------------------------------------------------------------ clock at a coarse step */

/**
 * The world minute rounded down to `step` minutes. A component re-renders only when that value changes, so panels
 * that need the time of day at 5- or 60-minute resolution do not re-render every world minute (the canvas root does
 * not subscribe to the clock at all).
 */
export function useNow(step = 1): Minutes {
  const get = () => Math.floor(clock.get().minutes / step) * step
  return useSyncExternalStore(clock.subscribe, get, get)
}

/* ------------------------------------------------------------------ map: simulated project locations */

/** active procurement packages placed at a kecamatan centroid (LOCATION SIMULATED: packages carry no address) */
export const projectPoints = createSelector((s) => [s.procurements, s.region], (t, region) =>
  rows(t)
    .filter((p) => p.status !== 'selesai')
    .map((p) => {
      let h = 0
      for (let i = 0; i < p.id.length; i++) h = (h * 31 + p.id.charCodeAt(i)) >>> 0
      const pool = p.emergency && region.floodKecamatanIds.length ? region.kecamatan.filter((k) => region.floodKecamatanIds.includes(k.id)) : region.kecamatan
      const k = pool[h % Math.max(1, pool.length)] ?? region.kecamatan[0]!
      const jitter = ((h >>> 8) % 100) / 100 - 0.5
      return { p, kecamatanId: k.id, coord: [k.centroid[0] + jitter * 0.03, k.centroid[1] + (((h >>> 16) % 100) / 100 - 0.5) * 0.03] as [number, number] }
    }),
)

/* ------------------------------------------------------------------ timeline (today's events) */

const SHOWN: Partial<Record<EventType, IconName>> = {
  'complaint.created': 'chat', 'complaint.clustered': 'pin', 'ticket.statusChanged': 'checkCircle', 'service.booked': 'calendar',
  'briefing.generated': 'doc', 'instruction.issued': 'send', 'meeting.transcribed': 'mic', 'letter.dispositioned': 'stamp',
  'actionItem.reminded': 'bell', 'actionItem.statusChanged': 'kanban', 'hoax.detected': 'alert', 'clarification.published': 'shield',
  'rain.forecast': 'rain', 'flood.alert': 'water', 'alert.broadcast': 'bell', 'flood.confirmed': 'checkCircle',
  'procurement.created': 'package', 'procurement.flagged': 'flag', 'procurement.recommended': 'doc', 'eligibility.opened': 'users',
  'harvest.updated': 'sun', 'econ.updated': 'chart', 'price.anomaly': 'trendUp', 'market.operation': 'cart', 'supply.signal': 'truck',
}
const TONE: Partial<Record<EventType, 'accent' | 'warn' | 'danger' | 'done'>> = {
  'hoax.detected': 'danger', 'flood.alert': 'danger', 'complaint.clustered': 'warn', 'procurement.flagged': 'warn', 'price.anomaly': 'warn',
  'econ.updated': 'warn', 'instruction.issued': 'accent', 'briefing.generated': 'accent', 'clarification.published': 'done', 'flood.confirmed': 'warn', 'ticket.statusChanged': 'done',
}

export interface EventRow {
  id: string
  at: Minutes
  title: Bi
  icon: IconName
  tone: 'neutral' | 'accent' | 'warn' | 'danger' | 'done'
  product: ProductSlug | null
}

/** today's audit rows worth a leader's attention, newest first */
/** the seeded audit lines name the channel by its code ("masuk dari VOICE"); a leader reads words */
const CHANNEL_WORDS: Record<string, Bi> = {
  WA: { id: 'WhatsApp', en: 'WhatsApp' },
  WEB: { id: 'situs web', en: 'the website' },
  TELEPON: { id: 'telepon', en: 'phone' },
  VOICE: { id: 'pesan suara', en: 'voice note' },
}
const channelWords = (t: Bi): Bi => ({
  id: t.id.replace(/masuk dari (WA|WEB|TELEPON|VOICE)$/, (_, c: string) => `masuk lewat ${CHANNEL_WORDS[c]?.id ?? c}`),
  en: t.en.replace(/received via (WA|WEB|TELEPON|VOICE)$/, (_, c: string) => `received via ${CHANNEL_WORDS[c]?.en ?? c}`),
})

/** the briefing's name follows the time of day it was composed ("Briefing Siang" at 13.00, as the panel title) */
const BRIEF_NAME: Record<DayPart, Bi> = {
  pagi: { id: 'Briefing pagi', en: 'Morning briefing' },
  siang: { id: 'Briefing siang', en: 'Midday briefing' },
  sore: { id: 'Briefing sore', en: 'Afternoon briefing' },
  malam: { id: 'Briefing malam', en: 'Evening briefing' },
}
const briefingWords = (t: Bi, at: Minutes): Bi => {
  const n = BRIEF_NAME[dayPart(at)]
  return { id: t.id.replace(/^Briefing pagi/i, n.id), en: t.en.replace(/^Morning briefing/i, n.en) }
}

export const todayEvents = createSelector((s) => [s.auditLog], (t): EventRow[] => {
  const out: EventRow[] = []
  for (const id of t.ids) {
    const a: AuditEntry | undefined = t.byId[id]
    if (!a || a.at < 0) continue
    const icon = a.type === 'seed' ? undefined : SHOWN[a.type]
    if (!icon) continue
    const product = isProductSlug(a.source) ? a.source : a.origin ?? null
    let title = a.type === 'complaint.created' ? channelWords(a.summary) : a.type === 'briefing.generated' ? briefingWords(a.summary, a.at) : a.summary
    // an illegal-levy complaint is an integrity signal, not just another ticket
    const integrity = a.type === 'complaint.created' && /\((Pungli|Illegal levy)\)/i.test(`${a.summary.id} ${a.summary.en}`)
    if (integrity) title = { id: `${title.id} · sinyal integritas`, en: `${title.en} · integrity signal` }
    out.push({ id: a.id, at: a.at, title, icon: integrity ? 'shield' : icon, tone: integrity ? 'warn' : (a.type !== 'seed' && TONE[a.type]) || 'neutral', product })
  }
  // world time, newest first (a jump replays events out of insertion order)
  return out.sort((a, b) => b.at - a.at).slice(0, MP.timelineRows)
})

export const productName = (slug: ProductSlug | null): string => (slug ? PRODUCT_BY_SLUG[slug].name : '')
