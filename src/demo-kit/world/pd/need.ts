/**
 * world/pd/need.ts — the natural need + match payloads (UP-free: the boot module's natural events use them).
 */
import type { EventMap, WorldState } from '../types'
import { hashString } from '../prng'
import { DAY_MIN, rows } from '../util'
import { CATEGORY_REF } from './config'
import { newMatchesFor } from './match'
import { NATURAL_NEEDS, fill } from './texts'

/** the next natural (non-emergency) need: a template whose category ≥ 3 verified businesses supply, least recently used today */
export function naturalNeedPayload(s: WorldState, now: number): EventMap['need.created'] | null {
  const day0 = Math.floor(now / DAY_MIN) * DAY_MIN
  const today = rows(s.catalogNeeds).filter((n) => n.by === 'natural' && n.at >= day0)
  const verified = rows(s.businesses).filter((b) => b.verified)
  const pool = NATURAL_NEEDS.filter((t) => verified.filter((b) => b.supplies.includes(t.cat)).length >= 3)
  if (!pool.length) return null
  const lastUse = (key: string) => today.filter((n) => n.items[0]?.category === NATURAL_NEEDS.find((x) => x.key === key)?.cat).reduce((a, n) => Math.max(a, n.at), -Infinity)
  const h = hashString(`${s.seed}|${s.regionId}|need|${now}`)
  const tpl = [...pool].sort((a, b) => lastUse(a.key) - lastUse(b.key) || ((hashString(a.key) ^ h) >>> 0) - ((hashString(b.key) ^ h) >>> 0))[0]!
  const usedKec = new Set(today.map((n) => n.kecamatanId))
  const kecs = s.region.kecamatan.filter((k) => !usedKec.has(k.id))
  const kec = (kecs.length ? kecs : s.region.kecamatan)[h % Math.max(1, (kecs.length ? kecs : s.region.kecamatan).length)]!
  const qty = tpl.q[0] + (h % (tpl.q[1] - tpl.q[0] + 1))
  const ref0 = CATEGORY_REF[tpl.cat]
  return {
    title: fill(tpl.t, { kec: kec.name, qty }), items: [{ name: tpl.item, category: tpl.cat, qty, unit: ref0?.unit ?? tpl.unit }], kecamatanId: kec.id,
    deadlineDays: 3 + (h % 5), emergency: false, cause: null, by: 'natural',
  }
}

/** the need's matches (≤ n verified, matchScore ≥ PD.matchMin, best first) as match.made payloads */
export const matchPayloads = (s: WorldState, needId: string, n = 6): EventMap['match.made'][] => newMatchesFor(s, needId, n).map((m) => ({ needId, businessId: m.businessId, score: m.score }))

