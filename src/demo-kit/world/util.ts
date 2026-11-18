/**
 * world/util.ts — small pure helpers shared by the generator, reducers, reactions and selectors.
 * No React, no DOM, no GSAP: everything here runs under `npx tsx` for the self-tests.
 */
import type { LngLat, Minutes, Table, TableKey } from './types'

/* ------------------------------------------------------------------ constants */
export const WORLD = {
  /** bump when the generated shape changes → persisted worlds are regenerated */
  version: 5,
  /** max entities per table (oldest dropped) */
  maxPerTable: 5000,
  /** max reaction chain depth (0 = emitted directly) */
  maxDepth: 4,
  /** default demo day (Tuesday in the rainy season) — see report: confirm with the project owner */
  day: '2026-11-17',
  /** clock start (07:00 — the seeded morning has activity up to then) */
  clockStart: 7 * 60,
  /** today's flood coordination meeting (the Naskah Pintar sample recording): 06.30–07.00, before the clock starts */
  floodMeetingAt: 6 * 60 + 30,
  floodMeetingMin: 30,
  /** complaint cluster rule (spec P1 step 6) */
  clusterMin: 5,
  clusterRadiusKm: 1,
  /** flood demand surge on sandbags / pumps / tarps (spec P8: +340 %) */
  floodDemandFactor: 4.4,
  /** debounce for IndexedDB saves */
  persistDebounceMs: 800,
  /** hoax burst rule (Radar Isu): this many mentions of one rumor within `hoaxWindowMin` ⇒ hoax.detected */
  hoaxBurstMin: 6,
  hoaxWindowMin: 90,
  /** the false narrative fires at 10:00 when natural events run (spec P4 step 2) */
  hoaxAt: 10 * 60,
  /** scenario key of that narrative (Mention.rumor / HoaxAlert.rumor) */
  hoaxRumor: 'waduk-jebol',
  /** post-flood harvest drop on flooded kecamatan (Siaga Wilayah "Pertanian", spec P5 step 5) */
  harvestFloodDropPct: 28,
} as const

export const DAY_MIN = 1440

/* ------------------------------------------------------------------ tables */
export const emptyTable = <T extends { id: string }>(): Table<T> => ({ byId: {}, ids: [] })

/** Build a table from rows; rows are sorted newest first by `at` when `sortKey` is given. */
export function tableFrom<T extends { id: string }>(rows: T[], sortKey?: (r: T) => number): Table<T> {
  const list = sortKey ? [...rows].sort((a, b) => sortKey(b) - sortKey(a)) : rows
  const byId: Record<string, T> = {}
  const ids: string[] = []
  for (const r of list) {
    if (byId[r.id]) continue
    byId[r.id] = r
    ids.push(r.id)
  }
  return { byId, ids }
}

/*
 * Copy-on-write within one engine batch: tables created during the batch are not visible to anyone yet, so
 * the engine lets later events of the SAME batch write into them in place (beginBatch/endBatch). Outside a
 * batch every write copies. Inputs handed to processEvents are never mutated.
 */
let owned: WeakSet<object> | null = null
export function beginBatch(): void {
  owned = new WeakSet()
}
export function endBatch(): void {
  owned = null
}
function own<T extends object>(o: T): T {
  owned?.add(o)
  return o
}
const isOwned = (o: object) => !!owned && owned.has(o)

/** Insert (newest first) or replace. Caps the table at WORLD.maxPerTable (drops the oldest). */
export function upsert<T extends { id: string }>(t: Table<T>, row: T): Table<T> {
  const byId = isOwned(t.byId) ? t.byId : own({ ...t.byId })
  const existed = row.id in byId
  byId[row.id] = row
  if (existed) return { byId, ids: t.ids }
  const ids = isOwned(t.ids) ? t.ids : own([...t.ids])
  ids.unshift(row.id)
  if (ids.length > WORLD.maxPerTable) for (const d of ids.splice(WORLD.maxPerTable)) delete byId[d]
  return { byId, ids }
}

/** Patch an existing row (no-op when missing). Keeps the row's position. */
export function patch<T extends { id: string }>(t: Table<T>, id: string, fn: (row: T) => T): Table<T> {
  const row = t.byId[id]
  if (!row) return t
  const next = fn(row)
  if (next === row) return t
  const byId = isOwned(t.byId) ? t.byId : own({ ...t.byId })
  byId[id] = next
  return { byId, ids: t.ids }
}

/** Patch many rows at once (single copy of byId). */
export function patchMany<T extends { id: string }>(t: Table<T>, ids: string[], fn: (row: T) => T): Table<T> {
  let byId: Record<string, T> | null = null
  for (const id of ids) {
    const row = (byId ?? t.byId)[id]
    if (!row) continue
    const next = fn(row)
    if (next === row) continue
    byId ??= isOwned(t.byId) ? t.byId : own({ ...t.byId })
    byId[id] = next
  }
  return byId ? { byId, ids: t.ids } : t
}

export const rows = <T extends { id: string }>(t: Table<T>): T[] => t.ids.map((id) => t.byId[id]!).filter(Boolean)
export const get = <T extends { id: string }>(t: Table<T>, id: string | null | undefined): T | undefined => (id ? t.byId[id] : undefined)

export const TABLE_KEYS: TableKey[] = [
  'citizens', 'complaints', 'tickets', 'clusters', 'bookings', 'briefings', 'instructions', 'letters', 'meetings', 'actionItems',
  'mentions', 'hoaxAlerts', 'alerts', 'rainCells', 'programs', 'messages', 'facilities', 'harvests', 'supplySignals', 'gauges', 'procurements', 'bidders', 'documents', 'verifications',
  'businesses', 'outlets', 'products', 'sales', 'salesDaily', 'stock', 'purchaseOrders', 'suppliers', 'ledger', 'taxItems',
  'calls', 'chats', 'agentsSales', 'coachings', 'candidates', 'brandMentions', 'tenders', 'bids',
  'staff', 'shifts', 'promos', 'cashShifts', 'posNotices', 'bankImports', 'roleplays', 'verificationRequests', 'brandAlerts', 'brandAnnouncements',
  'catalogNeeds', 'matches',
  'orders', 'bizScores', 'loanApps', 'econIndex', 'prices', 'markets', 'marketOps', 'auditLog',
]

export const ref = (table: TableKey, id: string): string => `${table}:${id}`

/* ------------------------------------------------------------------ numbers & geo */
export const round = (n: number, d = 0): number => {
  const f = 10 ** d
  return Math.round(n * f) / f
}
export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))
export const roundCoord = (c: LngLat): LngLat => [round(c[0], 5), round(c[1], 5)]

/** great-circle distance in km */
export function distanceKm(a: LngLat, b: LngLat): number {
  const R = 6371
  const toRad = Math.PI / 180
  const dLat = (b[1] - a[1]) * toRad
  const dLng = (b[0] - a[0]) * toRad
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * toRad) * Math.cos(b[1] * toRad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}

/** offset a coordinate by (dxKm east, dyKm north) */
export function offsetKm(c: LngLat, dxKm: number, dyKm: number): LngLat {
  const lat = c[1] + dyKm / 110.574
  const lng = c[0] + dxKm / (111.32 * Math.cos((c[1] * Math.PI) / 180))
  return roundCoord([lng, lat])
}

export function centroid(points: LngLat[]): LngLat {
  if (!points.length) return [0, 0]
  let x = 0
  let y = 0
  for (const p of points) {
    x += p[0]
    y += p[1]
  }
  return roundCoord([x / points.length, y / points.length])
}

/* ------------------------------------------------------------------ time */
export const dayOf = (at: Minutes): number => Math.floor(at / DAY_MIN)
export const isToday = (at: Minutes): boolean => at >= 0 && at < DAY_MIN
export const pad = (n: number, w = 2): string => String(n).padStart(w, '0')
/** the person in charge (PIC) of an agency by title: BPBD is led by a Kalaksa, a kecamatan by a Camat */
export function picOf(opd: { id: string; short?: string } | undefined, opdId = opd?.id ?? ''): string {
  if (opdId === 'bpbd') return 'Kalaksa BPBD'
  if (opdId === 'kecamatan') return 'Camat'
  return `Kepala ${opd?.short ?? opdId}`
}

/** "HH:MM" for minutes within a day (wraps for negative / multi-day values) */
export function hhmm(min: Minutes): string {
  const m = ((Math.floor(min) % DAY_MIN) + DAY_MIN) % DAY_MIN
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
}

/** ISO date (YYYY-MM-DD) for a day offset from the demo day */
export function isoDay(day: string, offsetDays: number): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}
/** YYYY-MM of the demo day shifted by n months */
export function monthOf(day: string, offsetMonths = 0): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + offsetMonths)
  return d.toISOString().slice(0, 7)
}
export const yearOf = (day: string): string => day.slice(0, 4)

/** minutes of the demo day → absolute Date (WIB, UTC+7) — for display only */
export function worldDate(day: string, at: Minutes): Date {
  return new Date(Date.parse(`${day}T00:00:00+07:00`) + at * 60000)
}

/* ------------------------------------------------------------------ misc */
export function fmtRp(n: number): string {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID')
}
/** shallow equality for arrays / plain objects (useWorld isEqual helper) */
export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false
    return true
  }
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  for (const k of ka) if (!Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false
  return true
}


/**
 * Activity rhythm per hour of day (relative weights): busy 07–11 and 13–15, a lull at lunch,
 * quiet nights. Shared by the generator (seeded history) and natural.ts (live events).
 */
export const HOUR_RHYTHM: readonly number[] = [
  0.08, 0.04, 0.03, 0.03, 0.08, 0.3, 0.65, 1.0, 1.2, 1.25, 1.15, 1.0, 0.7, 1.0, 1.1, 1.0, 0.75, 0.6, 0.5, 0.45, 0.38, 0.28, 0.18, 0.12,
]
