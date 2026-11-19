/**
 * world/reducers-katalog.ts — reducer + audit text of `need.created` and `match.made`, shared by the full pipeline
 * (reducers.ts / audit.ts) and the Pasar Daerah boot module (world/pd/boot.ts registers the SAME functions, so the
 * small core pipeline can run the 07:01 natural need + its matches without downloading engine.ts; world/ext.ts
 * accepts a duplicate reducer when it is the same function).
 */
import type { AnyWorldEvent, Bi, EntityRef, WorldEvent, WorldState } from './types'
import { patch, ref, upsert } from './util'
// (local copies of audit-core helpers: this module must not share a chunk boundary with the core pipeline)
const bizName = (s: WorldState, id: string) => s.businesses.byId[id]?.name ?? id

const must = <T>(v: T | undefined | null, what: string): T => {
  if (v === undefined || v === null) throw new Error(`reducer: missing ${what}`)
  return v
}

export function reduceNeed(s: WorldState, e: WorldEvent<'need.created'>): WorldState {
  const p = e.payload
  const id = must(p.id, 'need id')
  return {
    ...s,
    catalogNeeds: upsert(s.catalogNeeds, {
      id, code: p.code ?? id, at: e.at, title: p.title, items: p.items, kecamatanId: p.kecamatanId, deadlineDays: p.deadlineDays, emergency: p.emergency ?? false, status: 'baru',
      cause: p.cause ?? null, ...(p.by ? { by: p.by } : {}), ...(p.budget ? { budget: p.budget } : {}),
    }),
  }
}

export function reduceMatch(s: WorldState, e: WorldEvent<'match.made'>): WorldState {
  return {
    ...s,
    matches: upsert(s.matches, { id: must(e.payload.id, 'match id'), needId: e.payload.needId, businessId: e.payload.businessId, score: e.payload.score, at: e.at, status: 'kandidat' }),
    catalogNeeds: patch(s.catalogNeeds, e.payload.needId, (n) => (n.status === 'baru' ? { ...n, status: 'dicocokkan' } : n)),
  }
}

/** audit text of the two types (null for any other) */
export function describeKatalog(e: AnyWorldEvent, s: WorldState): { summary: Bi; refs: EntityRef[] } | null {
  // (texts unchanged from tahap 2/3; match rows also reference the business for the Inti data trail)
  if (e.type === 'need.created')
    return { summary: { id: `Kebutuhan pemda: ${e.payload.title.id}`, en: `Government need: ${e.payload.title.en}` }, refs: [ref('catalogNeeds', e.payload.id ?? ''), ...(e.payload.cause ? [e.payload.cause] : [])] }
  if (e.type === 'match.made') {
    const pct = Math.round(e.payload.score * 100)
    return { summary: { id: `Kebutuhan dicocokkan ke ${bizName(s, e.payload.businessId)} (${pct}%)`, en: `Need matched to ${bizName(s, e.payload.businessId)} (${pct}%)` }, refs: [ref('matches', e.payload.id ?? ''), ref('catalogNeeds', e.payload.needId), ref('businesses', e.payload.businessId)] }
  }
  return null
}
