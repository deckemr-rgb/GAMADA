/**
 * world/eco.ts — ecosystem world modules loaded on intent (in the world barrel; tiny: every demo carries it).
 *
 * Neither the Usaha Pintar nor the Pasar Daerah world is part of the Satu Daerah boot path. They come as lazy modules
 * (`WorldModule`, each registers world/ext.ts extensions when loaded):
 *  - 'usaha-pintar/data'   (world/up/data)   the UP seed extension only (`meta.ext['usaha-pintar']`), no handlers;
 *  - 'usaha-pintar'        (world/up/boot)   the UP live handlers + natural events (imports the data module first);
 *  - 'usaha-pintar/chains' (world/up/chains) chains C15–C29 + user-action types;
 *  - 'pasar-daerah'        (world/pd/boot)   PD data patch (`meta.ext['pasar-daerah']`), reducers, boot audit texts,
 *                                             natural events (UP-free);
 *  - 'pasar-daerah/chains' (world/pd/chains) chains C30–C38 + the remaining audit texts.
 * Invariants: UP live handlers registered ⇒ UP data present. A world with UP data but no UP live handlers is valid.
 *
 * Who loads them: DemoShell calls `preloadWorldFor(slug, role, eco)` next to the region load (eco-load.ts
 * `worldModulesFor`: exactly
 * what the landing needs) and `preloadEcosystemChains(eco)` on the first pointerdown / keydown; the store gate holds
 * events (in order) until the modules that handle them are in (a Satu Daerah flood loads UP + PD AFTER the action).
 * `?e2e=1` exposes `__gamada.ensure(eco)` (every module of the ecosystem). Products never call the loaders directly:
 * they render a skeleton until `useEcosystemReady(eco)` (UP products) / `useWorldReady(mods)` (PD + Inti products).
 */
import { useSyncExternalStore } from 'react'
import type { EventType, WorldEvent } from './types'
import { _setEventGate, world } from './store'

export type WorldEco = 'usaha-pintar' | 'pasar-daerah'
export type WorldModule = 'usaha-pintar/data' | 'usaha-pintar' | 'usaha-pintar/chains' | 'pasar-daerah' | 'pasar-daerah/chains'

const set = (s: string) => new Set(s.split(' ') as EventType[])
/** event types that need an ecosystem's modules before they are processed */
const ECO_TRIGGERS: Record<WorldEco, ReadonlySet<EventType>> = {
  'usaha-pintar': set(
    'po.drafted po.received price.changed promo.created shift.updated shift.closed pos.noticeSet nota.received ledger.reviewed bank.imported tax.computed period.locked call.created roleplay.completed verification.requested brand.mentioned brand.replied brand.announced tender.created procurement.bidReceived flood.alert need.created procurement.created price.anomaly po.sent supplier.replied stock.forecastChanged partner.verified bid.submitted call.scored coaching.assigned tax.ready brand.alert tender.matched',
  ),
  'pasar-daerah': set('flood.alert procurement.recommended market.operation need.created order.paid loan.approved price.shock price.warning price.alertSent'),
}
/** UP: the live module handles these alone (PD: its other types are emitted on PD pages, whose boot module is preloaded) */
const UP_BOOT = set('call.created call.scored verification.requested brand.mentioned tender.created tender.matched coaching.assigned tax.ready')

type Ev = Pick<WorldEvent, 'type' | 'source' | 'origin' | 'payload'>
/** what an event needs from an ecosystem: 0 nothing, 1 its boot (live) module, 2 boot + chains */
export function ecoNeeds(eco: WorldEco, e: Ev): 0 | 1 | 2 {
  // every event a Pasar Daerah / Inti product emits: its reducer may live in the PD chains module
  if (eco === 'pasar-daerah' && /^(katalog-lokal|rapor-usaha|indeks-ekonomi|sinyal-pasar|inti)$/.test(e.source)) return 2
  if (!ECO_TRIGGERS[eco].has(e.type)) return 0
  const p = e.payload as { emergency?: boolean; stage?: string }
  const clock = e.source === 'clock'
  // a natural (clock) non-emergency need is a Pasar Daerah background event: C21 / C26 do nothing for it
  if (eco === 'usaha-pintar' && e.type === 'need.created' && clock && !p.emergency) return 0
  if (eco === 'usaha-pintar' ? UP_BOOT.has(e.type) : clock && (e.type === 'need.created' || e.type === 'order.paid')) return 1
  // only a running operation has PD reactions (C34); the other stages are reduced by the core
  if (e.type === 'market.operation') return p.stage === 'running' ? 2 : 0
  return 2
}

/** the loaders + landing table live in world/eco-load.ts (own chunk, fetched when a module is needed) */
const loader = () => import('./eco-load')
const _ecoLoaded = new Set<WorldModule>()
const subs = new Set<() => void>()
const ping = () => {
  for (const fn of [...subs]) fn()
}
const load = (m: WorldModule): Promise<void> => (_ecoLoaded.has(m) ? Promise.resolve() : loader().then((x) => x.load(m)).then(ping))
/** @internal world/eco-load.ts + world/ready.ts: the registered modules, load, the readiness subscription */
export const _eco = { loaded: _ecoLoaded, load, use: (get: () => boolean): boolean => useLoaded(get) }

/** load + register every world module of an ecosystem (tests, `__gamada.ensure`) */
export const ensureEcosystem = (eco: WorldEco): Promise<void> => load(`${eco}/chains`)
const preload = (mod: WorldModule): void => void load(mod).catch(() => {})
/** the modules of a landing (DemoShell, next to the region load; nothing for a Satu Daerah product) */
export function preloadWorldFor(slug: string, role?: string | null, eco?: string): void {
  if (eco === 'satu-daerah') return
  loader()
    .then((x) => Promise.all(x.worldModulesFor(slug, role).map(load)))
    .catch(() => {})
}
const live = (eco: string | null | undefined): WorldModule | null => (eco === 'usaha-pintar' ? 'usaha-pintar' : eco === 'pasar-daerah' || eco === 'inti' ? 'pasar-daerah' : null)
/** the visitor is about to act on an ecosystem (or Inti) page: fetch its chains too */
export function preloadEcosystemChains(eco: string | null | undefined): void {
  const m = live(eco)
  if (m) preload(`${m}/chains` as WorldModule)
}

function useLoaded(get: () => boolean): boolean {
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
/** UP products: true once the UP live module is registered AND the current world carries its data (PD + Inti
 *  products: `useWorldReady` from world/ready.ts) */
export const useEcosystemReady = (eco: WorldEco): boolean =>
  useLoaded(() => world.status() === 'ready' && _ecoLoaded.has(eco) && !!world.get().meta.ext?.[eco])

_setEventGate((events) => {
  const want = new Set<WorldModule>()
  for (const e of events)
    for (const eco of ['usaha-pintar', 'pasar-daerah'] as const) {
      const n = ecoNeeds(eco, e)
      if (n) want.add(n === 2 ? `${eco}/chains` : eco)
    }
  for (const m of want) if (_ecoLoaded.has(m)) want.delete(m)
  return want.size ? Promise.all([...want].map(load)).then(() => undefined) : null
})
