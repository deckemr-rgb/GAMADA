/** consent helpers shared by Modal kerja and Berbagi data (small, no UI) */
import { emit, type ConsentScope, type WorldState } from '../../demo-kit/world'
import { activeConsent, consentsOf } from '../../demo-kit/world/pasar-daerah'
import { LENDER, SLUG, type Lang } from './model'

/** the shop's consent state for the partner cooperative */
export function consentState(s: WorldState, now: number) {
  const shop = s.meta.shopId
  const active = activeConsent(s, shop, LENDER, now)
  const latest = consentsOf(s, shop).find((c) => c.lender === LENDER) ?? null
  return { active, revoked: !active && !!latest && latest.revokedAt !== null }
}
/** "17 Feb 2027" for a world minute */
export function dateOf(day: string, at: number, lang: Lang): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + Math.floor(at / 1440))
  return d.toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}
/** emit a consent for the partner cooperative (Modal + Berbagi) */
export function grant(scopes: ConsentScope[], days: 30 | 90 | 180, shop: string) {
  emit('consent.granted', { businessId: shop, lender: LENDER, scopes, days }, SLUG)
}

