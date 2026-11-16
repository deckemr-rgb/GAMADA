/**
 * world/selectors.ts — memoised selectors shared by many products. Each one caches on the identity of the
 * tables it reads (structural sharing in the reducers keeps untouched tables identical), so calling them from
 * `useWorld` on every store notify is cheap and returns the SAME object while the inputs are unchanged.
 */
import type {
  ActionItem, AuditEntry, BrandMention, Business, Complaint, ComplaintCluster, MarketOperation, Mention, Minutes, StockLevel, TableKey, Ticket,
  TicketStatus, WorldState,
} from './types'
import { DAY_MIN, TABLE_KEYS, rows } from './util'

/* ------------------------------------------------------------------ memo helpers */

/** memoise on the identity of the values returned by `deps` */
export function createSelector<D extends unknown[], R>(deps: (s: WorldState) => [...D], combine: (...d: D) => R): (s: WorldState) => R {
  let last: D | null = null
  let value: R
  return (s) => {
    const d = deps(s)
    if (last && d.length === last.length && d.every((x, i) => Object.is(x, last![i]))) return value
    last = d
    value = combine(...d)
    return value
  }
}

/** memoised selector with one parameter (cache per key, cleared when the inputs change) */
export function createParamSelector<P extends string | number, D extends unknown[], R>(
  deps: (s: WorldState) => [...D], combine: (p: P, ...d: D) => R,
): (s: WorldState, p: P) => R {
  let last: D | null = null
  let cache = new Map<P, R>()
  return (s, p) => {
    const d = deps(s)
    if (!last || d.length !== last.length || !d.every((x, i) => Object.is(x, last![i]))) {
      last = d
      cache = new Map()
    }
    if (cache.has(p)) return cache.get(p) as R
    const v = combine(p, ...d)
    cache.set(p, v)
    return v
  }
}

/* ------------------------------------------------------------------ Satu Daerah */

export const complaintsToday = createSelector((s) => [s.complaints], (t): Complaint[] => rows(t).filter((c) => c.at >= 0 && c.at < DAY_MIN))

/** today's complaints until `now` vs yesterday's until the same time of day */
export const complaintKpi = createParamSelector((s) => [s.complaints], (now: Minutes, t) => {
  let today = 0
  let yesterday = 0
  for (const c of rows(t)) {
    if (c.at >= 0 && c.at <= now) today++
    else if (c.at >= -DAY_MIN && c.at <= now - DAY_MIN) yesterday++
  }
  return { today, yesterday, delta: today - yesterday }
})

export const ticketsByStatus = createSelector((s) => [s.tickets], (t) => {
  const out: Record<TicketStatus, Ticket[]> = { baru: [], diverifikasi: [], diteruskan: [], diproses: [], selesai: [] }
  for (const x of rows(t)) out[x.status].push(x)
  return out
})

/** % of tickets closed in the last 30 days that met their SLA (0–100) */
export const slaOnTimePct = createSelector((s) => [s.tickets], (t) => {
  let done = 0
  let onTime = 0
  for (const x of rows(t)) {
    if (x.status !== 'selesai' || x.closedAt === null || x.closedAt < -30 * DAY_MIN) continue
    done++
    if (x.closedAt <= x.slaDueAt) onTime++
  }
  return done ? Math.round((onTime / done) * 100) : 100
})

export const avgRating = createSelector((s) => [s.tickets], (t) => {
  let n = 0
  let sum = 0
  for (const x of rows(t)) if (x.rating !== null) {
    n++
    sum += x.rating
  }
  return n ? Math.round((sum / n) * 10) / 10 : 0
})

export const openClusters = createSelector((s) => [s.clusters], (t): ComplaintCluster[] => rows(t))

export const activeAlerts = createSelector((s) => [s.alerts], (t) => rows(t).filter((a) => a.status === 'aktif'))

/** negative mentions of the last 24 world hours (before `now`), grouped by topic, biggest first */
export const negativeIssues = createParamSelector((s) => [s.mentions], (now: Minutes, t) => {
  const by = new Map<string, { topic: string; count: number; reach: number; latest: Mention }>()
  for (const m of rows(t)) {
    if (m.sentiment !== 'negatif' || m.at > now || m.at < now - DAY_MIN) continue
    const g = by.get(m.topic)
    if (g) {
      g.count++
      g.reach += m.reach
    } else by.set(m.topic, { topic: m.topic, count: 1, reach: m.reach, latest: m })
  }
  return [...by.values()].sort((a, b) => b.count - a.count || b.reach - a.reach)
})

export const overdueActions = createParamSelector((s) => [s.actionItems], (now: Minutes, t): ActionItem[] =>
  rows(t).filter((a) => a.status !== 'selesai' && a.dueAt < now).sort((a, b) => a.dueAt - b.dueAt),
)

/** composite public-service index 0–100: SLA 40 %, satisfaction 30 %, follow-up discipline 30 % */
export const serviceIndex = createParamSelector((s) => [s.tickets, s.actionItems], (now: Minutes, tickets, actions) => {
  const st = { tickets } as WorldState
  const sla = slaOnTimePct(st)
  const rating = avgRating(st)
  const open = rows(actions).filter((a) => a.status !== 'selesai')
  const late = open.filter((a) => a.dueAt < now).length
  const discipline = open.length ? 1 - late / open.length : 1
  return Math.round(0.4 * sla + 0.3 * (rating / 5) * 100 + 0.3 * discipline * 100)
})

/** recommendations waiting for a leader (market operations proposed by Sinyal Pasar) */
export const instructionSuggestions = createSelector((s) => [s.marketOps], (t): MarketOperation[] => rows(t).filter((m) => m.stage === 'recommended'))

/* ------------------------------------------------------------------ Usaha Pintar · Pasar Daerah */

export const shopBusiness = (s: WorldState): Business | undefined => s.businesses.byId[s.meta.shopId]

export const floodStock = createSelector((s) => [s.stock, s.products], (stock, products): StockLevel[] =>
  rows(stock).filter((st) => products.byId[st.productId]?.tags.some((t) => t === 'sandbag' || t === 'pump' || t === 'tarp')),
)

/** days of stock left at the current (factor-adjusted) daily demand */
export const daysLeft = (st: StockLevel): number => (st.baseDaily * st.factor > 0 ? st.onHand / (st.baseDaily * st.factor) : Infinity)

export const lowStock = createSelector((s) => [s.stock], (t): StockLevel[] => rows(t).filter((st) => st.onHand <= st.reorderPoint * st.factor).sort((a, b) => daysLeft(a) - daysLeft(b)))

export const brandNegatives = createSelector((s) => [s.brandMentions, s.meta.shopId], (t, shop): BrandMention[] => rows(t).filter((m) => m.brand === shop && m.sentiment === 'negatif'))

export const verifiedBusinesses = createSelector((s) => [s.businesses], (t) => rows(t).filter((b) => b.verified))

/* ------------------------------------------------------------------ GAMADA Inti */

/** audit rows that reference an entity (accepts "table:id" or a bare id), oldest first — the data trail */
export const auditFor = createParamSelector((s) => [s.auditLog], (entity: string, t): AuditEntry[] => {
  const bare = !entity.includes(':')
  return rows(t)
    .filter((a) => a.entityRefs.some((r) => (bare ? r.endsWith(`:${entity}`) : r === entity)))
    .reverse()
})

export const latestAudit = createParamSelector((s) => [s.auditLog], (n: number, t): AuditEntry[] => t.ids.slice(0, n).map((id) => t.byId[id]!).filter(Boolean))

/** entity counts per table (lab / Inti) */
export const tableCounts = createSelector(
  (s) => TABLE_KEYS.map((k) => s[k]) as unknown[],
  (...tables) => Object.fromEntries(TABLE_KEYS.map((k, i) => [k, (tables[i] as { ids: string[] }).ids.length])) as Record<TableKey, number>,
)
