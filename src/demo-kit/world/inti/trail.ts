/**
 * world/inti/trail.ts — the GAMADA Inti data trail: which product wrote an audit row, and the walk from a root entity
 * through the audit log (rows sharing an entity ref, or caused by a collected event) across the products.
 */
import type { ProductSlug } from '../../../content/products'
import { isProductSlug } from '../../../content/productSlugs'
import type { AuditEntry, Bi, EntityRef, EventType, WorldState } from '../types'
import { createParamSelector } from '../selectors'
import { rows } from '../util'

/** the 6 lanes of the trail in spec order (NOT PRODUCTS.inti.related, whose order differs) */
export const TRAIL_SPINE: readonly ProductSlug[] = ['sapa-warga', 'siaga-wilayah', 'meja-pimpinan', 'naskah-pintar', 'awas-belanja', 'katalog-lokal']

/** follow-ups whose source is the producer but whose consumer is another product (= shell EFFECT_TARGET) */
const CONSUMER: Partial<Record<EventType, ProductSlug>> = { 'complaint.clustered': 'meja-pimpinan', 'briefing.generated': 'meja-pimpinan', 'hoax.detected': 'meja-pimpinan' }
/** the product of an audit row: its source when a product; the clock / tour ⇒ its origin; else the consumer; else null ("Sistem") */
export function productOfAudit(a: Pick<AuditEntry, 'source' | 'origin' | 'type'>): ProductSlug | null {
  if (isProductSlug(a.source)) return a.source
  if ((a.source === 'clock' || a.source === 'tour') && a.origin) return a.origin
  return a.type === 'seed' ? null : CONSUMER[a.type] ?? null
}

export interface TrailRow { auditId: string; eventId: string; at: number; product: ProductSlug | null; summary: Bi; refs: EntityRef[]; hop: number }
export interface Trail {
  root: EntityRef
  rows: TrailRow[]
  spine: { product: ProductSlug; auditId: string | null; at: number | null }[]
  branches: { product: ProductSlug; count: number }[]
  complete: boolean
}

/** refs that connect everything (not expanded): other citizens, kecamatan, suppliers, the shop, sales agents, prices */
function isHub(r: EntityRef, s: WorldState, root: EntityRef): boolean {
  if (r === root) return false
  return r.startsWith('citizens:') || r.startsWith('kecamatan:') || r.startsWith('suppliers:') || r.startsWith('agentsSales:') || r.startsWith('outlets:') || r === `businesses:${s.meta.shopId}` || r.startsWith('bizScores:')
}

const trailSel = createParamSelector((s) => [s.auditLog, s.meta.shopId], (key: string, log, shopId): Trail => {
  const [root, maxS] = key.split('|') as [string, string]
  const max = Number(maxS) || 40
  const s = { meta: { shopId } } as WorldState
  const all = rows(log).sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
  const frontier = new Set<EntityRef>([root])
  const events = new Set<string>()
  const hopOf = new Map<string, number>()
  for (let hop = 0; hop <= 6; hop++) {
    let added = 0
    for (const a of all) {
      if (hopOf.has(a.id)) continue
      if (!a.entityRefs.some((r) => frontier.has(r)) && !(a.causeId && events.has(a.causeId))) continue
      hopOf.set(a.id, hop)
      events.add(a.eventId)
      added++
    }
    if (!added) break
    for (const a of all) if (hopOf.get(a.id) === hop) for (const r of a.entityRefs) if (!isHub(r, s, root)) frontier.add(r)
  }
  const picked = all.filter((a) => hopOf.has(a.id))
  const out: TrailRow[] = picked.slice(0, max).map((a) => ({ auditId: a.id, eventId: a.eventId, at: a.at, product: productOfAudit(a), summary: a.summary, refs: a.entityRefs, hop: hopOf.get(a.id)! }))
  const spine = TRAIL_SPINE.map((p) => {
    const r = picked.find((a) => productOfAudit(a) === p)
    return { product: p, auditId: r?.id ?? null, at: r?.at ?? null }
  })
  const counts = new Map<ProductSlug, number>()
  for (const a of picked) {
    const p = productOfAudit(a)
    if (p && !TRAIL_SPINE.includes(p)) counts.set(p, (counts.get(p) ?? 0) + 1)
  }
  return { root, rows: out, spine, branches: [...counts].map(([product, count]) => ({ product, count })).sort((a, b) => b.count - a.count), complete: spine.every((x) => !!x.auditId) }
})
/** the trail of a root entity ('table:id'), oldest first, ≤ maxRows rows, ≤ 6 hops; spine = first row per spine product */
export const dataTrail = (s: WorldState, rootRef: EntityRef, opts: { maxRows?: number } = {}): Trail => trailSel(s, `${rootRef}|${opts.maxRows ?? 40}`)
