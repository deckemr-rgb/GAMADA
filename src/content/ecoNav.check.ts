/**
 * ecoNav.check.ts — drift guard for the eager-safe literals in ecoNav.ts (NOT imported by any page; run by
 * tests/e2e/tahap6/contracts.spec.ts). Returns a list of problems; empty = in sync.
 */
import { ECOSYSTEMS, ECOSYSTEM_STATS, PRODUCT_BY_SLUG, productsOf } from './products'
import { TOUR } from './tour'
import { DEMO_READY } from '../demos/registry'
import { DEMO_COUNT, ECO_NAV, SITE_COUNTS, TOUR_NAV } from './ecoNav'

export function ecoNavDrift(): string[] {
  const out: string[] = []
  const ids = ECO_NAV.map((e) => e.id).join(',')
  if (ids !== 'satu-daerah,usaha-pintar,pasar-daerah,inti') out.push(`ECO_NAV order/ids: ${ids}`)
  for (const e of ECO_NAV) {
    const d = ECOSYSTEMS[e.id]
    if (e.name !== d.name) out.push(`${e.id}: name "${e.name}" ≠ "${d.name}"`)
    if (e.audience.id !== d.audience.id || e.audience.en !== d.audience.en) out.push(`${e.id}: audience differs`)
    if (e.accent !== d.accent) out.push(`${e.id}: accent ${e.accent} ≠ ${d.accent}`)
    if (e.to !== `/ekosistem/${e.id}`) out.push(`${e.id}: to ${e.to}`)
    const n = e.id === 'inti' ? ECOSYSTEM_STATS.products : productsOf(e.id).length
    if (e.count !== n) out.push(`${e.id}: count ${e.count} ≠ ${n}`)
    for (const x of e.examples) {
      const p = PRODUCT_BY_SLUG[x.slug]
      if (!p) out.push(`${e.id}: example ${x.slug} unknown`)
      else {
        if (p.name !== x.name) out.push(`${e.id}: example ${x.slug} name "${x.name}" ≠ "${p.name}"`)
        if (p.eco !== e.id) out.push(`${e.id}: example ${x.slug} belongs to ${p.eco}`)
      }
    }
  }
  if (TOUR_NAV.regionName !== TOUR.regionName) out.push(`TOUR_NAV.regionName ≠ ${TOUR.regionName}`)
  if (TOUR_NAV.to !== '/tur') out.push('TOUR_NAV.to')
  if (SITE_COUNTS.products !== ECOSYSTEM_STATS.products) out.push(`SITE_COUNTS.products ≠ ${ECOSYSTEM_STATS.products}`)
  if (SITE_COUNTS.ecosystems !== ECOSYSTEM_STATS.ecosystems) out.push(`SITE_COUNTS.ecosystems ≠ ${ECOSYSTEM_STATS.ecosystems}`)
  const ready = Object.values(DEMO_READY).filter(Boolean).length
  if (DEMO_COUNT !== ready) out.push(`DEMO_COUNT ${DEMO_COUNT} ≠ DEMO_READY count ${ready}`)
  return out
}
