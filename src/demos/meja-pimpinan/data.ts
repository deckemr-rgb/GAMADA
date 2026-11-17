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
  type AuditEntry, type Bi, type ComplaintCategory, type EntityRef, type EventType, type Minutes, type PricePoint, type Procurement, type WorldState,
} from '../../demo-kit/world'
import { briefingItems, weekChangeOf, type BriefingItem } from '../../demo-kit/world/satu-daerah'

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

/** OPD id by a hint (id or short name contains it), as the kit's instructionIdeas does */
export function findOpd(s: WorldState, hint: string): string | undefined {
  const h = hint.toLowerCase()
  return s.region.opd.find((o) => o.id === h)?.id ?? s.region.opd.find((o) => `${o.id} ${o.short} ${o.name}`.toLowerCase().includes(h))?.id
}

/** OPD ids named in free text ("BPBD dan Dinas PUPR", "the public works office") */
export function opdsInText(s: WorldState, text: string): string[] {
  const t = ` ${text.toLowerCase()} `
  const alias: Record<string, string[]> = {
    bpbd: ['bpbd', 'bencana', 'disaster'],
    pupr: ['pupr', 'pekerjaan umum', 'public works', 'bina marga'],
    diskominfo: ['kominfo', 'diskominfo', 'humas', 'communication'],
    disperindag: ['disperindag', 'perdagangan', 'trade'],
    inspektorat: ['inspektorat', 'inspectorate', 'audit'],
    dinsos: ['dinsos', 'sosial', 'social'],
    dinkes: ['dinkes', 'kesehatan', 'health'],
    dlh: ['dlh', 'lingkungan hidup', 'environment', 'sampah', 'waste'],
    dishub: ['dishub', 'perhubungan', 'transport'],
    distan: ['distan', 'pertanian', 'agricultur'],
    satpolpp: ['satpol', 'public order'],
    ukpbj: ['pbj', 'ukpbj', 'pengadaan', 'procurement'],
    disdukcapil: ['dukcapil', 'civil registry'],
  }
  const out = new Set<string>()
  for (const o of s.region.opd) {
    const keys = [o.short.toLowerCase(), o.id, ...(alias[o.id] ?? [])]
    if (keys.some((k) => k.length > 2 && t.includes(k))) out.add(o.id)
  }
  return [...out]
}

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
/** the single market x commodity with the largest 7-day rise (briefing, map, suggestions and chat all name this one) */
export function topRiser(s: WorldState): { p: PricePoint; d: number } | null {
  let best: { p: PricePoint; d: number } | null = null
  for (const p of rows(s.prices)) {
    const d = weekChange(p.price, p.history)
    if (!best || d > best.d) best = { p, d }
  }
  return best
}
/** the riskiest active package, in the kit briefing's order: flagged by risk score, else an emergency one, else the
 *  highest mark-up over market. Briefing, suggestions and chat name the same package. */
export function riskiestProcurement(s: WorldState): Procurement | null {
  const procs = rows(s.procurements).filter((p) => p.status !== 'selesai')
  return procs.filter((p) => p.flagged).sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0))[0] ?? procs.find((p) => p.emergency) ?? [...procs].sort((a, b) => devOf(b) - devOf(a))[0] ?? null
}
/** sort key for a package list that starts with riskiestProcurement's choice */
export function riskRank(p: Procurement): number {
  return p.flagged ? 2000 + (p.riskScore ?? 0) : p.emergency ? 1000 : devOf(p)
}

/* ------------------------------------------------------------------ the briefing as Meja Pimpinan shows it */


/**
 * The briefing as Meja Pimpinan shows it: the kit's briefingItems, which now carries the corrections first made here
 * (true 7-day price change via weekChangeOf, EN topic labels, distinct record per item, Indeks Ekonomi item).
 */
export function mpBriefingItems(s: WorldState, now: Minutes): BriefingItem[] {
  return briefingItems(s, now)
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

export const todayEvents = createSelector((s) => [s.auditLog], (t): EventRow[] => {
  const out: EventRow[] = []
  for (const id of t.ids) {
    const a: AuditEntry | undefined = t.byId[id]
    if (!a || a.at < 0) continue
    const icon = a.type === 'seed' ? undefined : SHOWN[a.type]
    if (!icon) continue
    const product = isProductSlug(a.source) ? a.source : a.origin ?? null
    out.push({ id: a.id, at: a.at, title: a.type === 'complaint.created' ? channelWords(a.summary) : a.summary, icon, tone: (a.type !== 'seed' && TONE[a.type]) || 'neutral', product })
    if (out.length >= MP.timelineRows) break
  }
  return out
})

export const productName = (slug: ProductSlug | null): string => (slug ? PRODUCT_BY_SLUG[slug].name : '')
