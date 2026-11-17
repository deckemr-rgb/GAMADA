/**
 * world/store.ts — the shared world store (spec §6.1). One module-level state, a typed event bus and a
 * React hook with memoised selector slices.
 *
 *   emit(type, payload, source) → queued → microtask: reducer → auditLog row → reactions … → ONE notify
 * The pipeline (engine.ts: reducers, reactions, audit texts) is loaded on the first emit (or preloadWorldEngine()),
 * so viewing a world never downloads it; the first batch is processed as soon as it arrives.
 */
import { useCallback, useRef, useSyncExternalStore } from 'react'
import type { RegionPack } from '../region/types'
import type { EventMap, EventSource, EventType, TableKey, WorldEvent, WorldState } from './types'
import type { ProductSlug } from '../../content/products'
import { createEvent } from './events'
import { clock } from './clock'
import { clearPersisted, flushPersist, loadPersisted, schedulePersist, cancelPersist, type Persisted } from './persist'
import { TABLE_KEYS, WORLD, emptyTable } from './util'
import type { Seq } from './ids'

export type WorldStatus = 'idle' | 'loading' | 'ready'

/** an empty, valid world (before loadWorld resolves) */
export function emptyWorld(): WorldState {
  const tables = Object.fromEntries(TABLE_KEYS.map((k) => [k, emptyTable()])) as Pick<WorldState, TableKey>
  return {
    regionId: '',
    seed: 0,
    day: WORLD.day,
    region: {
      id: '', name: '', shortName: '', opd: [], kecamatan: [], commodities: [], services: [], floodKecamatanIds: [], floodRiverId: '', shopMarketId: '',
      categoryOpd: { banjir: '', 'jalan-rusak': '', sampah: '', pju: '', 'air-bersih': '', 'pohon-tumbang': '', pungli: '', kesehatan: '', sekolah: '', adminduk: '', bansos: '', lainnya: '' },
    },
    meta: { version: WORLD.version, seq: {}, shopId: '', competitors: [], processed: 0 },
    ...tables,
  }
}

let current: WorldState = emptyWorld()
let seq: Seq = {}
let status: WorldStatus = 'idle'
let pack: RegionPack | null = null
let loadToken = 0
let queue: WorldEvent[] = []
let scheduled = false
let idleWaiters: (() => void)[] = []
const subs = new Set<() => void>()
const statusSubs = new Set<() => void>()
type Listener = (e: WorldEvent) => void
const listeners = new Map<EventType | '*', Set<Listener>>()

/* The event pipeline: loaded on the first emit; events queue up meanwhile and are processed in order. */
let pipeline: typeof import('./engine') | null = null
let pipelineLoad: Promise<void> | null = null
function loadPipeline(): Promise<void> {
  pipelineLoad ??= import('./engine').then(
    (m) => {
      pipeline = m
    },
    (e: unknown) => {
      pipelineLoad = null
      throw e
    },
  )
  return pipelineLoad
}
/** Start downloading the event pipeline without awaiting (e.g. when the user is about to act). */
export function preloadWorldEngine(): void {
  loadPipeline().catch(() => {})
}
function scheduleFlush() {
  if (scheduled) return
  scheduled = true
  if (pipeline) queueMicrotask(flush)
  else
    loadPipeline().then(
      () => queueMicrotask(flush),
      (err: unknown) => {
        // keep the queue; the next emit retries the download
        scheduled = false
        console.error('[world] event pipeline failed to load', err)
      },
    )
}

/* The generator (seed.ts + catalog + name lists + NIK rules, the heaviest part of the world) is loaded only when a
   world has to be GENERATED or reset. A page that never loads a world never fetches it. DemoShell preloads it at
   boot (before it knows whether IndexedDB holds a saved world) so a first visit does not wait twice and Reset works
   offline afterwards; the cost is counted in the map-demo floor budget. */
let seedModule: Promise<typeof import('./seed')> | null = null
function loadGenerator(): Promise<typeof import('./seed')> {
  seedModule ??= import('./seed').catch((e: unknown) => {
    seedModule = null
    throw e
  })
  return seedModule
}
/** Start downloading the world generator without awaiting (e.g. while the region pack is still loading). */
export function preloadWorldGenerator(): void {
  loadGenerator().catch(() => {})
}

function notify() {
  for (const fn of [...subs]) {
    try {
      fn()
    } catch (err) {
      console.error('[world] subscriber failed', err)
    }
  }
}
function setStatus(s: WorldStatus) {
  status = s
  for (const fn of [...statusSubs]) fn()
}
function snapshot(): Persisted | null {
  if (status !== 'ready' || !current.regionId) return null
  return { format: 'gamada-world', version: WORLD.version, clock: clock.get().minutes, state: current }
}

function flush() {
  scheduled = false
  const batch = queue
  queue = []
  if (batch.length && pipeline) {
    const r = pipeline.processEvents(current, seq, batch, (err, e) => console.error(`[world] ${e.type} failed`, err))
    if (r.dropped) console.warn(`[world] ${r.dropped} follow-up event(s) dropped (depth > ${WORLD.maxDepth})`)
    current = r.state
    notify()
    for (const e of r.processed) {
      for (const key of [e.type, '*'] as const) {
        const set = listeners.get(key)
        if (!set) continue
        for (const fn of [...set]) {
          try {
            fn(e)
          } catch (err) {
            console.error('[world] onEvent listener failed', err)
          }
        }
      }
    }
    schedulePersist(snapshot)
  }
  if (!queue.length && !scheduled) {
    const w = idleWaiters
    idleWaiters = []
    for (const fn of w) fn()
  }
}

/* ------------------------------------------------------------------ public API */

export const world = {
  get: (): WorldState => current,
  subscribe(fn: () => void): () => void {
    subs.add(fn)
    return () => subs.delete(fn)
  },
  status: (): WorldStatus => status,
  pack: (): RegionPack | null => pack,
}

/**
 * Emit a world event. Ids missing from the payload (complaint id/code, ticket id, …) are assigned synchronously,
 * so the returned event already carries them; the state changes in the next microtask.
 *
 * `source` is REQUIRED (CONTRACTS.md): a product passes its own slug — the shell only announces cross-product
 * effects whose root event came from the current product, and the audit log shows it as the actor. Background
 * events use 'clock' (with `opts.origin` = the product whose domain they belong to), the tour uses 'tour'.
 */
export function emit<K extends EventType>(
  type: K, payload: EventMap[K], source: EventSource, opts: { at?: number; origin?: ProductSlug } = {},
): WorldEvent<K> {
  const e = createEvent(current, seq, type, payload, source, opts.at ?? clock.get().minutes)
  if (opts.origin) e.origin = opts.origin
  queue.push(e as WorldEvent)
  scheduleFlush()
  return e
}

/** resolves after every queued event (and its reactions) has been processed (the first time: after the pipeline loaded) */
export function settled(): Promise<void> {
  if (!queue.length && !scheduled) return Promise.resolve()
  return new Promise((r) => idleWaiters.push(r))
}

/** listen to processed events (toasts, missions, tests). '*' = every event. */
export function onEvent<K extends EventType>(type: K | '*', fn: (e: WorldEvent<K>) => void): () => void {
  let set = listeners.get(type)
  if (!set) listeners.set(type, (set = new Set()))
  set.add(fn as Listener)
  return () => set.delete(fn as Listener)
}

function install(state: WorldState, clockMinutes: number) {
  current = state
  seq = { ...state.meta.seq }
  queue = []
  clock.reset(clockMinutes)
  setStatus('ready')
  notify()
}

/** load the world for a region + seed: from IndexedDB when present, else generated (deterministic). */
export async function loadWorld(p: RegionPack, seed: number): Promise<void> {
  const token = ++loadToken
  pack = p
  setStatus('loading')
  const saved = await loadPersisted(p.id, seed)
  if (token !== loadToken) return
  if (saved) return install(saved.state, saved.clock)
  const { generateWorld } = await loadGenerator()
  if (token !== loadToken) return
  install(generateWorld(p, seed), WORLD.clockStart)
}

/** back to the seed: regenerate, forget the saved copy, clock to the default morning */
export async function resetWorld(): Promise<void> {
  if (!pack) return
  const p = pack
  const seed = current.seed
  const { generateWorld } = await loadGenerator()
  cancelPersist()
  await clearPersisted(p.id, seed)
  loadToken++
  install(generateWorld(p, seed), WORLD.clockStart)
}

export function exportWorld(): string {
  return JSON.stringify({ format: 'gamada-world', version: WORLD.version, clock: clock.get().minutes, state: current } satisfies Persisted)
}

export function importWorld(json: string): void {
  const v = JSON.parse(json) as Partial<Persisted>
  const s = v.state
  if (v.format !== 'gamada-world' || v.version !== WORLD.version || !s || typeof s.regionId !== 'string' || !s.meta) throw new Error('importWorld: not a GAMADA world export (or a different version)')
  for (const k of TABLE_KEYS) {
    const t = s[k] as { byId?: unknown; ids?: unknown } | undefined
    if (!t || typeof t.byId !== 'object' || !Array.isArray(t.ids)) throw new Error(`importWorld: table "${k}" is missing`)
  }
  loadToken++
  install(s, typeof v.clock === 'number' ? v.clock : WORLD.clockStart)
  schedulePersist(snapshot)
  flushPersist()
}

/* ------------------------------------------------------------------ React */

/**
 * Subscribe to a slice of the world. The component re-renders only when the selected value changes
 * (`Object.is` by default, or `isEqual` — e.g. `shallowEqual` for derived arrays/objects).
 */
export function useWorld<T>(selector: (s: WorldState) => T, isEqual: (a: T, b: T) => boolean = Object.is): T {
  const memo = useRef<{ state: WorldState; sel: (s: WorldState) => T; value: T } | null>(null)
  const selRef = useRef(selector)
  const eqRef = useRef(isEqual)
  selRef.current = selector
  eqRef.current = isEqual
  const getSnapshot = useCallback((): T => {
    const s = current
    const sel = selRef.current
    const m = memo.current
    if (m && m.state === s && m.sel === sel) return m.value
    const value = sel(s)
    if (m && eqRef.current(m.value, value)) {
      memo.current = { state: s, sel, value: m.value }
      return m.value
    }
    memo.current = { state: s, sel, value }
    return value
  }, [])
  return useSyncExternalStore(world.subscribe, getSnapshot, getSnapshot)
}

export function useWorldStatus(): WorldStatus {
  return useSyncExternalStore(
    (fn) => {
      statusSubs.add(fn)
      return () => statusSubs.delete(fn)
    },
    () => status,
    () => status,
  )
}
