/**
 * shell/url.ts — the demo query string (spec §4): ?region ?role ?t ?ai ?lang ?present ?seed ?focus, and (Tahap 5)
 * ?world=tour (the tour's world) + ?from=tur-<n> (the chapter a taken-over sandbox came from).
 * Reading validates every value; writing uses history.replaceState (keeps the router's state object, no
 * scroll, no navigation) and preserves unrelated params (?tab, ?only …).
 */
import { PRODUCT_BY_SLUG, ROLES, type ProductSlug, type RoleId } from '../../content/products'
import type { Lang } from '../../lib/i18n'
import { isRegionId } from '../region/loader'
import { DEFAULT_SEED, formatTime, parseTime, type DemoSession } from '../world'

export interface DemoQuery {
  region?: string
  role?: RoleId
  /** world minutes */
  t?: number
  ai?: 'sim' | 'live'
  lang?: Lang
  present?: boolean
  seed?: number
  focus?: string
  /** ?world=tour: open the tour's world (Tahap 5 "Ambil alih" / "Coba sendiri"); absent = the visitor's own world */
  world?: 'tour'
  /** ?from=tur-<n> (n 1–20), only together with ?world=tour: "Kembali ke tur" goes back to chapter n */
  from?: string
}

const isRole = (r: string | null): r is RoleId => !!r && r in ROLES

/** Parse + validate the demo params. Roles not used by `product` are ignored. */
export function readDemoQuery(search: string, product?: ProductSlug): DemoQuery {
  const p = new URLSearchParams(search)
  const q: DemoQuery = {}
  const region = p.get('region')
  if (region && isRegionId(region)) q.region = region
  const role = p.get('role')
  if (isRole(role) && (!product || PRODUCT_BY_SLUG[product].roles.includes(role))) q.role = role
  const t = p.get('t')
  if (t) {
    try {
      q.t = parseTime(t)
    } catch {
      /* ignore a malformed time */
    }
  }
  const ai = p.get('ai')
  if (ai === 'sim' || ai === 'live') q.ai = ai
  const lang = p.get('lang')
  if (lang === 'id' || lang === 'en') q.lang = lang
  const present = p.get('present')
  if (present === '1' || present === 'true') q.present = true
  const seed = p.get('seed')
  if (seed && /^\d{1,9}$/.test(seed)) q.seed = Number(seed)
  const focus = p.get('focus')
  if (focus && focus.length <= 120) q.focus = focus
  if (p.get('world') === 'tour') {
    q.world = 'tour'
    const from = p.get('from')
    if (from && /^tur-\d\d?$/.test(from)) q.from = from
  }
  return q
}

/** The params the shell writes for a session + clock (defaults are left out to keep links short). */
export function sessionParams(s: DemoSession, minutes: number): Record<string, string | null> {
  return {
    region: s.regionId,
    role: s.role,
    t: formatTime(minutes),
    lang: s.lang,
    seed: s.seed !== DEFAULT_SEED ? String(s.seed) : null,
    ai: s.aiMode === 'live' ? 'live' : null,
    present: s.present ? '1' : null,
    world: s.scope === 'tour' ? 'tour' : null,
    from: s.from,
  }
}

/** Merge params into the current URL with replaceState. Returns true when the URL changed. */
export function replaceQuery(patch: Record<string, string | null | undefined>): boolean {
  if (typeof window === 'undefined') return false
  const url = new URL(window.location.href)
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue
    if (v === null || v === '') url.searchParams.delete(k)
    else url.searchParams.set(k, v)
  }
  const next = url.pathname + url.search + url.hash
  const cur = window.location.pathname + window.location.search + window.location.hash
  if (next === cur) return false
  // keep react-router's history state ({ usr, key, idx }) so its index bookkeeping stays valid
  window.history.replaceState(window.history.state, '', next)
  return true
}

/**
 * Link to another product's sandbox, carrying region / seed / language / Live AI (and an optional focus entity).
 * In the tour's world (session scope 'tour') it also carries ?world=tour (+ ?from=tur-<n>), so a cross-product hop
 * inside a taken-over sandbox stays in the tour's day and "Kembali ke tur" still knows the chapter.
 */
export function demoHref(
  slug: ProductSlug,
  s: Pick<DemoSession, 'regionId' | 'seed' | 'lang' | 'present'> & Partial<Pick<DemoSession, 'aiMode' | 'scope' | 'from'>>,
  focus?: string | null,
): string {
  const p = new URLSearchParams()
  p.set('region', s.regionId)
  if (s.seed !== DEFAULT_SEED) p.set('seed', String(s.seed))
  p.set('lang', s.lang)
  if (s.aiMode === 'live') p.set('ai', 'live')
  if (s.present) p.set('present', '1')
  if (focus) p.set('focus', focus)
  // `from` is set only in the tour's world (DemoShell)
  if (s.scope === 'tour') p.set('world', 'tour')
  if (s.from) p.set('from', s.from)
  return `/demo/${slug}?${p.toString()}`
}
