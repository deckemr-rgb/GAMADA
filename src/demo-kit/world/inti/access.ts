/**
 * world/inti/access.ts — Inti ID access matrix (THE role definitions of PRODUCTS[].roles), role scopes, the Audit Log
 * query + exports, the platform pulse and the activity feed rows.
 */
import { PRODUCTS, type EcoOrInti, type ProductSlug, type RoleId } from '../../../content/products'
import type { AuditEntry, Bi, EntityRef, EventType, WorldState } from '../types'
import { DAY_MIN, hhmm, rows } from '../util'
import { productOfAudit } from './trail'
import type { Scope } from './inbox'

/** role × product from PRODUCTS[].roles / defaultRole */
export function accessMatrix(): { roles: RoleId[]; products: ProductSlug[]; allowed(role: RoleId, slug: ProductSlug): boolean; isDefault(role: RoleId, slug: ProductSlug): boolean } {
  const roles = [...new Set(PRODUCTS.flatMap((p) => p.roles))]
  const by = new Map(PRODUCTS.map((p) => [p.slug, p]))
  return {
    roles, products: PRODUCTS.map((p) => p.slug),
    allowed: (role, slug) => !!by.get(slug)?.roles.includes(role),
    isDefault: (role, slug) => by.get(slug)?.defaultRole === role,
  }
}

/** what a role sees in Inti: 'usaha' (pemilik-toko = the shop's rows only) or 'semua' */
export function scopeOf(role: RoleId): { scope: Scope; allows(refs: EntityRef[], s: WorldState): boolean } {
  if (role !== 'pemilik-toko') return { scope: 'semua', allows: () => true }
  return {
    scope: 'usaha',
    allows(refs, s) {
      const shop = s.meta.shopId
      return refs.some((r) => {
        const [t, id] = r.split(':') as [string, string]
        if (t === 'businesses' || t === 'bizScores') return id === shop
        const row = (s as unknown as Record<string, { byId: Record<string, { businessId?: string }> } | undefined>)[t]?.byId[id]
        return row?.businessId === shop
      })
    },
  }
}

const ECO_OF = new Map<ProductSlug, EcoOrInti>(PRODUCTS.map((p) => [p.slug, p.eco]))
export type Actor = 'user' | 'clock' | 'tour' | 'reaction'
export const actorOf = (a: AuditEntry): Actor => (a.source === 'clock' ? 'clock' : a.source === 'tour' ? 'tour' : a.depth > 0 ? 'reaction' : 'user')

export interface AuditRow { id: string; eventId: string; at: number; product: ProductSlug | null; eco: EcoOrInti | null; actor: Actor; type: EventType | 'seed'; summary: Bi; refs: EntityRef[]; causeId: string | null }
export interface AuditFilter { product?: ProductSlug; eco?: EcoOrInti; type?: EventType; actor?: Actor; q?: string; from?: number; to?: number; scope: Scope }
/** the Audit Log, newest first, filtered (text search over ID + EN summary and refs) */
export function auditQuery(s: WorldState, f: AuditFilter): AuditRow[] {
  const sc = f.scope === 'usaha' ? scopeOf('pemilik-toko') : null
  const q = f.q?.trim().toLowerCase()
  const out: AuditRow[] = []
  for (const a of rows(s.auditLog)) {
    if ((f.from != null && a.at < f.from) || (f.to != null && a.at > f.to)) continue
    const product = productOfAudit(a)
    const eco = product ? ECO_OF.get(product) ?? null : null
    const actor = actorOf(a)
    if ((f.product && product !== f.product) || (f.eco && eco !== f.eco) || (f.type && a.type !== f.type) || (f.actor && actor !== f.actor)) continue
    if (q && !`${a.summary.id} ${a.summary.en} ${a.entityRefs.join(' ')} ${a.id}`.toLowerCase().includes(q)) continue
    if (sc && !sc.allows(a.entityRefs, s)) continue
    out.push({ id: a.id, eventId: a.eventId, at: a.at, product, eco, actor, type: a.type, summary: a.summary, refs: a.entityRefs, causeId: a.causeId })
  }
  return out.sort((a, b) => b.at - a.at || b.id.localeCompare(a.id))
}

const csvCell = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
const ACTOR: Record<Actor, Bi> = { user: { id: 'pengguna', en: 'user' }, clock: { id: 'jam dunia', en: 'world clock' }, tour: { id: 'tur', en: 'tour' }, reaction: { id: 'reaksi', en: 'reaction' } }
/** CSV of the visible rows: id, waktu, produk, aktor, jenis, ringkasan, entitas, sebab (headers per language) */
export function auditCsv(list: AuditRow[], lang: 'id' | 'en'): string {
  const head = lang === 'id' ? ['id', 'waktu', 'produk', 'aktor', 'jenis', 'ringkasan', 'entitas', 'sebab'] : ['id', 'time', 'product', 'actor', 'type', 'summary', 'entities', 'cause']
  const lines = list.map((r) => [r.id, hhmm(r.at), r.product ?? (lang === 'id' ? 'sistem' : 'system'), ACTOR[r.actor][lang], r.type, r.summary[lang], r.refs.join(' '), r.causeId ?? ''].map(csvCell).join(','))
  return [head.join(','), ...lines].join('\n')
}
/** JSON export of the visible rows */
export const auditJson = (list: AuditRow[]): string => JSON.stringify(list.map((r) => ({ ...r, time: hhmm(r.at) })), null, 2)

/** today's events in total and per product (count + last minute) — the Inti pulse */
export function platformPulse(s: WorldState, now: number): { todayCount: number; perProduct: Partial<Record<ProductSlug, { count: number; lastAt: number }>> } {
  const d0 = Math.floor(now / DAY_MIN) * DAY_MIN
  const perProduct: Partial<Record<ProductSlug, { count: number; lastAt: number }>> = {}
  let todayCount = 0
  for (const id of s.auditLog.ids) {
    const a = s.auditLog.byId[id]!
    if (a.at < d0 || a.at > now) continue
    todayCount++
    const p = productOfAudit(a)
    if (!p) continue
    const x = (perProduct[p] ??= { count: 0, lastAt: -Infinity })
    x.count++
    if (a.at > x.lastAt) x.lastAt = a.at
  }
  return { todayCount, perProduct }
}

export type Tone = 'neutral' | 'info' | 'ok' | 'warn' | 'danger'
const TONE: Partial<Record<EventType, Tone>> = {
  'flood.alert': 'danger', 'price.anomaly': 'warn', 'price.warning': 'warn', 'econ.updated': 'info', 'order.paid': 'ok', 'loan.approved': 'ok', 'score.updated': 'info',
  'hoax.detected': 'danger', 'procurement.flagged': 'warn', 'complaint.clustered': 'warn', 'need.created': 'info',
}
/** rows for the kit ActivityFeed (newest first) */
export function activityRows(s: WorldState, now: number, f: { eco?: EcoOrInti; product?: ProductSlug; max: number }): { id: string; at: number; product: ProductSlug | null; text: Bi; href?: string; tone: Tone }[] {
  const out: ReturnType<typeof activityRows> = []
  const d0 = Math.floor(now / DAY_MIN) * DAY_MIN
  for (const id of s.auditLog.ids) {
    if (out.length >= f.max) break
    const a = s.auditLog.byId[id]!
    if (a.at < d0 || a.at > now) continue
    const p = productOfAudit(a)
    if ((f.product && p !== f.product) || (f.eco && (!p || ECO_OF.get(p) !== f.eco))) continue
    const first = a.entityRefs[0]?.split(':').slice(1).join(':')
    out.push({ id: a.id, at: a.at, product: p, text: a.summary, tone: TONE[a.type as EventType] ?? 'neutral', ...(p && first ? { href: `/demo/${p}?focus=${first}` } : {}) })
  }
  return out.sort((a, b) => b.at - a.at || b.id.localeCompare(a.id))
}
