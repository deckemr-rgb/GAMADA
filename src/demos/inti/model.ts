/**
 * demos/inti/model.ts — product-local helpers of GAMADA Inti: tabs, links (READY targets only), the trail roots,
 * the ?focus= router, the scoped pulse and the ecosystem of a role.
 */
import { DEMO_READY } from '../registry'
import { PRODUCTS, PRODUCT_BY_SLUG, type EcoOrInti, type ProductSlug, type RoleId } from '../../content/products'
import { DAY_MIN, TABLE_KEYS, rows, type WorldState } from '../../demo-kit/world'
import { auditQuery, platformPulse, type Actor, type Scope } from '../../demo-kit/world/inti'

export const SLUG = 'inti' as const
export type TabId = 'data' | 'id' | 'agen' | 'kanal' | 'audit'
export const TABS: readonly TabId[] = ['data', 'id', 'agen', 'kanal', 'audit']

/** the 17 products of the access matrix (Inti itself is the platform, not a row) */
export const PRODUCTS17 = PRODUCTS.filter((p) => p.slug !== 'inti')
export const productName = (slug: ProductSlug | null | undefined): string => (slug ? PRODUCT_BY_SLUG[slug]?.name ?? slug : 'Sistem')
export const ecoOf = (slug: ProductSlug | null | undefined): EcoOrInti | null => (slug ? PRODUCT_BY_SLUG[slug]?.eco ?? null : null)

/* ------------------------------------------------------------------ links */

const controlsAll = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('controls') === 'all'
/** a demo can be linked when it is READY (or on the dev / controls build with ?controls=all) */
export const canLink = (slug: ProductSlug | null | undefined): slug is ProductSlug => !!slug && (!!DEMO_READY[slug] || controlsAll())
/** /demo/<slug>?k=v… keeping ?controls=all on the dev build */
export function hrefTo(slug: ProductSlug, q: Record<string, string | null | undefined> = {}): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(q)) if (v) p.set(k, v)
  if (controlsAll()) p.set('controls', 'all')
  const s = p.toString()
  return `/demo/${slug}${s ? `?${s}` : ''}`
}

/* ------------------------------------------------------------------ trail roots */

export const day0 = (now: number) => Math.floor(now / DAY_MIN) * DAY_MIN
export type RootKey = 'siti' | 'flood' | 'pump' | 'tender' | 'shop'
export const ROOT_KEYS: readonly RootKey[] = ['siti', 'flood', 'pump', 'tender', 'shop']

/** the entity behind each root chip (null while it does not exist) — same rules as world/story (no story import here) */
export function rootsOf(s: WorldState, now: number): Record<RootKey, string | null> {
  const siti = rows(s.complaints).find((c) => c.citizenId === s.meta.personas.siti && c.category === 'banjir' && c.at >= day0(now))
  const flood = rows(s.alerts).find((a) => a.kind === 'banjir' && a.status === 'aktif')
  const pump = rows(s.procurements).find((p) => p.key === 'pompa-darurat')
  const tender = rows(s.tenders).find((t) => t.key === 'karung-terpal-darurat')
  const shop = s.businesses.byId[s.meta.shopId]
  return {
    siti: siti ? `complaints:${siti.id}` : null,
    flood: flood ? `alerts:${flood.id}` : null,
    pump: pump ? `procurements:${pump.id}` : null,
    tender: tender ? `tenders:${tender.id}` : null,
    shop: shop ? `businesses:${shop.id}` : null,
  }
}

/** does a 'table:id' ref exist in the world */
export function refExists(s: WorldState, r: string): boolean {
  const i = r.indexOf(':')
  if (i < 1) return false
  const t = r.slice(0, i)
  const tab = (s as unknown as Record<string, { byId: Record<string, unknown> } | undefined>)[t]
  return !!tab?.byId?.[r.slice(i + 1)]
}

/** ?focus= → where it lands: AU- ⇒ Audit (that row); an entity ('table:id' or a bare id) ⇒ Data with that root */
export function routeFocus(s: WorldState, raw: string): { tab: 'audit'; q: string } | { tab: 'data'; root: string } | null {
  const v = raw.trim()
  const bare = v.startsWith('auditLog:') ? v.slice(9) : v
  if (/^AU-/.test(bare) && s.auditLog.byId[bare]) return { tab: 'audit', q: bare }
  if (v.includes(':') && refExists(s, v)) return { tab: 'data', root: v }
  for (const t of TABLE_KEYS) {
    if (t === 'auditLog') continue
    const tab = (s as unknown as Record<string, { byId: Record<string, unknown> } | undefined>)[t]
    if (tab?.byId?.[v]) return { tab: 'data', root: `${t}:${v}` }
  }
  return null
}

/* ------------------------------------------------------------------ pulse + roles */

/** the pulse in a scope: 'semua' = platformPulse; 'usaha' = the shop's rows of the Audit Log (same filter as Audit) */
export function pulseOf(s: WorldState, now: number, scope: Scope): ReturnType<typeof platformPulse> {
  if (scope === 'semua') return platformPulse(s, now)
  const perProduct: ReturnType<typeof platformPulse>['perProduct'] = {}
  const list = auditQuery(s, { scope, from: day0(now), to: now })
  for (const a of list) {
    if (!a.product) continue
    const x = (perProduct[a.product] ??= { count: 0, lastAt: -Infinity })
    x.count++
    if (a.at > x.lastAt) x.lastAt = a.at
  }
  return { todayCount: list.length, perProduct }
}

/** the ecosystem a role works in first (its first product in registry order) */
export function ecoOfRole(role: RoleId): EcoOrInti | null {
  return PRODUCTS17.find((p) => p.roles.includes(role))?.eco ?? null
}

/** one helper for every download (CSV / JSON): a real blob + an <a download> click */
export function download(name: string, text: string, type: string): void {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

/* ------------------------------------------------------------------ filters kept across role switches */

export interface AuditUiFilter { product: ProductSlug | ''; eco: EcoOrInti | ''; type: string; actor: Actor | ''; q: string; when: 'hari' | 'semua' }
export const AUDIT0: AuditUiFilter = { product: '', eco: '', type: '', actor: '', q: '', when: 'hari' }
export interface KanalFilter { channel: 'semua' | 'wa' | 'web' | 'telepon'; eco: 'semua' | EcoOrInti; unread: boolean }
