/**
 * world/eco.ts — ecosystem world modules loaded on intent (in the world barrel; tiny).
 *
 * The Usaha Pintar world is NOT part of the Satu Daerah boot path. It comes in two lazy chunks:
 *  - `world/up/boot` (`ensureEcosystem('usaha-pintar')`): the seed extension (`extendUsahaPintar`, deterministic), the
 *    natural UP events and their handlers. Registering it patches the installed world. Invariant: UP handlers
 *    registered ⇔ UP data present (the store patches every world it installs while the extension is registered).
 *  - `world/up/chains` (`preloadEcosystemChains`): the cross-product chains C15–C29 and the user-action types; fetched on
 *    the visitor's first pointerdown / keydown on a UP page, and always before an event they handle is processed.
 *
 * Who loads it: DemoShell calls `preloadEcosystem(product.eco)` next to the region load and `preloadEcosystemChains` on
 * the first interaction; the store waits (events stay queued, in order) before processing an event of
 * `ECO_TRIGGERS` / the chain triggers (a Satu Daerah flood alert therefore loads both AFTER the action); `?e2e=1`
 * exposes `__gamada.ensure(eco)` (both chunks). Products never call these: they render a skeleton until
 * `useEcosystemReady(eco)`.
 */
import { useSyncExternalStore } from 'react'
import type { EventType } from './types'
import { _setEventGate, world } from './store'

export type WorldEco = 'usaha-pintar'

/** event types that need the ecosystem's boot module before they are processed */
export const ECO_TRIGGERS: Record<WorldEco, ReadonlySet<EventType>> = {
  'usaha-pintar': new Set<EventType>([
    // its own events
    'po.drafted', 'po.received', 'price.changed', 'promo.created', 'shift.updated', 'shift.closed', 'pos.noticeSet', 'nota.received',
    'ledger.reviewed', 'bank.imported', 'tax.computed', 'period.locked', 'call.created', 'roleplay.completed', 'verification.requested',
    'brand.mentioned', 'brand.replied', 'brand.announced', 'tender.created', 'procurement.bidReceived',
    // existing types it reacts on or extends
    'flood.alert', 'need.created', 'procurement.created', 'price.anomaly', 'po.sent', 'supplier.replied', 'stock.forecastChanged',
    'partner.verified', 'bid.submitted', 'call.scored', 'coaching.assigned', 'tax.ready', 'brand.alert', 'tender.matched',
  ]),
}
/** the boot module handles these alone; every other trigger also needs the chains module */
const BOOT_ONLY = new Set<EventType>(['call.created', 'call.scored', 'verification.requested', 'brand.mentioned', 'tender.created', 'tender.matched', 'coaching.assigned', 'tax.ready'])

type Mod = { boot(): void }
const LOADERS: Record<string, () => Promise<Mod>> = {
  'usaha-pintar': () => import('./up/boot'),
  'usaha-pintar/chains': () => import('./up/chains'),
}

const loaded = new Set<string>()
const pending = new Map<string, Promise<void>>()
const subs = new Set<() => void>()
const ping = () => {
  for (const fn of [...subs]) fn()
}
function load(key: string): Promise<void> {
  if (loaded.has(key)) return Promise.resolve()
  let p = pending.get(key)
  if (!p) {
    p = LOADERS[key]!().then(
      (m) => {
        m.boot()
        loaded.add(key)
        ping()
      },
      (err: unknown) => {
        pending.delete(key)
        throw err
      },
    )
    pending.set(key, p)
  }
  return p
}

/** load + register the ecosystem's world modules (boot, then chains); the installed world is patched by the boot one */
export function ensureEcosystem(eco: WorldEco): Promise<void> {
  return load(eco).then(() => load(`${eco}/chains`))
}
/** start the boot module download without awaiting (no-op for an ecosystem without a world module, e.g. 'satu-daerah') */
export function preloadEcosystem(eco: string | null | undefined): void {
  if (eco && eco in ECO_TRIGGERS) load(eco).catch(() => {})
}
/** the visitor is about to act on a UP page: fetch the chains too */
export function preloadEcosystemChains(eco: string | null | undefined): void {
  if (eco && eco in ECO_TRIGGERS) load(eco).then(() => load(`${eco}/chains`)).catch(() => {})
}
export const ecosystemLoaded = (eco: WorldEco): boolean => loaded.has(eco)

/** true once the boot module is registered AND the current world carries its data (render the product then) */
export function useEcosystemReady(eco: WorldEco): boolean {
  const get = () => loaded.has(eco) && world.status() === 'ready' && !!world.get().meta.ext?.[eco]
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn)
      const off = world.subscribe(fn)
      return () => {
        subs.delete(fn)
        off()
      }
    },
    get,
    get,
  )
}

_setEventGate((types) => {
  for (const eco of Object.keys(ECO_TRIGGERS) as WorldEco[]) {
    const chains = `${eco}/chains`
    if (loaded.has(eco) && loaded.has(chains)) continue
    let boot = false
    let all = false
    for (const t of types) {
      if (!ECO_TRIGGERS[eco].has(t as EventType)) continue
      boot = true
      if (!BOOT_ONLY.has(t as EventType)) all = true
    }
    if (all && !loaded.has(chains)) return ensureEcosystem(eco)
    if (boot && !loaded.has(eco)) return load(eco)
  }
  return null
})
