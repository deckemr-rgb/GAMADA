/**
 * siaga-wilayah/ui.ts — the sandbox's UI state, shared by the eager parts (map stage, panel, Peringatan tab) and the
 * lazy tabs / dialogs (Prediksi, Pertanian, Lingkungan, Broadcast, Geo-AI). A tiny external store (no context), so a
 * lazy chunk reads the same state without prop drilling, and the map handle lives next to it.
 * World data stays in the world store; this file holds only view state (tab, layers, scrubber hour, impact cache).
 */
import { useSyncExternalStore } from 'react'
import type { FloodImpact, MapViewHandle } from '../../demo-kit/map'
import { motionMode } from '../../demo-kit/ui'
import { world, type Harvest } from '../../demo-kit/world'
import type { ChangeSite } from './sites'

export type TabId = 'alerts' | 'forecast' | 'agri' | 'env'
export type LayerId = 'kec' | 'desa' | 'rivers' | 'hazard' | 'rain' | 'flood' | 'reports' | 'facilities' | 'zones' | 'imagery' | 'harvest' | 'landslide' | 'changes' | 'gauges'
export type Crop = Harvest['crop']
export type AgriMetric = 'estimate' | 'change' | 'ndvi'

export interface UiState {
  tab: TabId
  panelOpen: boolean
  /** scrubber hour, quantised (0…6) */
  hour: number
  /** the prediction has been run (or scrubbed) at least once */
  ran: boolean
  layers: Record<LayerId, boolean>
  crop: Crop | 'all'
  metric: AgriMetric
  /** Lingkungan: selected land-use change site */
  site: string | null
  /** Lingkungan: the simulated change sites (computed once the tab opens) */
  sites: ChangeSite[]
  selectedKec: string | null
  /** clicked map marker (layer + item) */
  picked: { layer: string; id: string } | null
  broadcastOpen: boolean
  aiOpen: boolean
  layersOpen: boolean
  /** desa polygons are in (impact can be computed) */
  desaReady: boolean
  /** impact at the current hour (null while dry / loading) */
  impact: FloodImpact | null
  /** impact at +6 h (alert defaults, forecast tab, AI context) */
  impact6: FloodImpact | null
  /** the water gauge whose 24 h curve the Situation card shows (null = the flood river's) */
  gauge: string | null
  /** id of an entity to highlight in the panel (arrivals via ?focus=, new alert) */
  flash: string | null
  /** the Geo-AI insight card was dismissed */
  insightOff: boolean
  /** an AI-drafted warning waiting to be opened in the broadcast dialog */
  draft: AlertDraft | null
  /** audit trail of the warnings issued here: who set them and on what basis (alert id → basis) */
  basis: Record<string, AlertBasis>
  /** the guided CTA already offered the citizen-confirmation step once */
  confirmTried: boolean
}

export interface AlertBasis {
  /** role id that issued it */
  by: string
  /** the river level at issue time, its state and the model run behind it */
  level: number
  state: 'normal' | 'siaga' | 'awas'
  desa: number
  people: number
  /** world minute the river reaches AWAS (null = not within 6 h / already above) */
  awasAt: number | null
}

export interface AlertDraft {
  level: 1 | 2 | 3 | 4
  message: string
  channels: string[]
  areas: string[]
}

export const INITIAL_LAYERS: Record<LayerId, boolean> = {
  kec: true,
  desa: false,
  rivers: true,
  hazard: false,
  rain: true,
  flood: true,
  reports: true,
  facilities: false,
  zones: true,
  imagery: false,
  harvest: false,
  landslide: false,
  changes: false,
  gauges: true,
}

const initial = (): UiState => ({
  tab: 'alerts',
  panelOpen: true,
  hour: 0,
  ran: false,
  layers: { ...INITIAL_LAYERS },
  crop: 'all',
  metric: 'estimate',
  site: null,
  sites: [],
  selectedKec: null,
  picked: null,
  broadcastOpen: false,
  aiOpen: false,
  layersOpen: false,
  desaReady: false,
  impact: null,
  impact6: null,
  gauge: null,
  flash: null,
  insightOff: false,
  draft: null,
  basis: {},
  confirmTried: false,
})

/*
 * The forecast run (hour, ran) and the warnings' audit trail survive a trip to another product and back, a role
 * switch and a reload in the same tab (sessionStorage; per-viewer convenience, the page works without it).
 */
const KEEP = 'dk-sg-view'
type Kept = Pick<UiState, 'hour' | 'ran' | 'basis'> & { n?: number }
function loadKept(): Partial<Kept> {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEEP) ?? 'null') as Partial<Kept> | null
    if (v && typeof v === 'object') keptAudit = Number(v.n) || 0
    return v && typeof v === 'object' ? { hour: Number(v.hour) || 0, ran: !!v.ran, basis: v.basis && typeof v.basis === 'object' ? v.basis : {} } : {}
  } catch {
    return {}
  }
}
let kept = ''
/** size of the world's audit log when the view was kept: a smaller log later means the world was reset meanwhile */
let keptAudit = 0
function saveKept(): void {
  keptAudit = world.get().auditLog.ids.length
  const v = JSON.stringify({ hour: state.hour, ran: state.ran, basis: state.basis, n: keptAudit } satisfies Kept)
  if (v === kept) return
  kept = v
  try {
    sessionStorage.setItem(KEEP, v)
  } catch {
    /* private mode / blocked storage: the view simply starts fresh next time */
  }
}
/** the kept forecast run + audit trail (for a fresh view of the same world) */
export const keptView = (): Partial<UiState> => (world.get().auditLog.ids.length < keptAudit ? {} : { hour: state.hour, ran: state.ran, basis: state.basis })

let state: UiState = { ...initial(), ...(typeof window !== 'undefined' ? loadKept() : {}) }
const subs = new Set<() => void>()

export const ui = {
  get: (): UiState => state,
  set(patch: Partial<UiState> | ((s: UiState) => Partial<UiState>)): void {
    const p = typeof patch === 'function' ? patch(state) : patch
    let changed = false
    for (const k in p) if ((p as Record<string, unknown>)[k] !== (state as unknown as Record<string, unknown>)[k]) changed = true
    if (!changed) return
    state = { ...state, ...p }
    if ('hour' in p || 'ran' in p || 'basis' in p) saveKept()
    for (const fn of [...subs]) fn()
  },
  layer(id: LayerId, on: boolean): void {
    if (state.layers[id] === on) return
    const layers = { ...state.layers, [id]: on }
    // one choropleth at a time (the map draws only the top-most one)
    // one choropleth at a time (the map draws only the top-most one), and the imagery shows only without one
    if (on && id === 'harvest') layers.landslide = layers.imagery = false
    if (on && id === 'landslide') layers.harvest = layers.imagery = false
    if (on && id === 'imagery') layers.harvest = layers.landslide = false
    ui.set({ layers })
  },
  reset(keep?: Partial<UiState>): void {
    state = { ...initial(), ...keep }
    saveKept()
    for (const fn of [...subs]) fn()
  },
  subscribe(fn: () => void): () => void {
    subs.add(fn)
    return () => void subs.delete(fn)
  },
}

/** React: a slice of the UI state (return primitives or stable references). */
export function useUi<T>(sel: (s: UiState) => T): T {
  return useSyncExternalStore(
    ui.subscribe,
    () => sel(state),
    () => sel(state),
  )
}

/** The one MapView handle of the sandbox (set by MapStage once the map is ready). */
export const mapRef: { current: MapViewHandle | null } = { current: null }

/** Flood impact at `hours` from the map's own model (null until the desa polygons are in). Cached per hour. */
const impactCache = new Map<number, FloodImpact>()
export function impactAt(hours: number): FloodImpact | null {
  const hit = impactCache.get(hours)
  if (hit) return hit
  const raw = mapRef.current?.floodImpact(hours) ?? null
  const v = raw ? spreadPeople(raw) : null
  if (v) impactCache.set(hours, v)
  return v
}

/** seeded 0…1 from an id (FNV-1a) */
function hash01(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return ((h >>> 0) % 10007) / 10007
}
let weightsOf: { region: unknown; w: Map<string, number> } | null = null
/**
 * The kit model spreads a kecamatan's population EVENLY over its desa, so every fully flooded desa of one kecamatan
 * shows the same head-count. Re-spread it with a seeded weight per desa (0.45…1.55, mean 1 within the kecamatan, so
 * the kecamatan total is unchanged) and recompute the total from the rows (HUD, Prediksi and AI read the same object).
 */
function spreadPeople(i: FloodImpact): FloodImpact {
  const region = world.get().region
  if (weightsOf?.region !== region) {
    const w = new Map<string, number>()
    for (const k of region.kecamatan) {
      const raw = k.desa.map((d) => 0.45 + 1.1 * hash01(d.id))
      const mean = raw.reduce((a, b) => a + b, 0) / Math.max(1, raw.length)
      k.desa.forEach((d, j) => w.set(d.id, raw[j]! / (mean || 1)))
    }
    weightsOf = { region, w }
  }
  const w = weightsOf.w
  const desa = i.desa.map((d) => ({ ...d, people: Math.round(d.people * (w.get(d.id) ?? 1)) }))
  return { ...i, desa, people: desa.reduce((n, d) => n + d.people, 0) }
}

/**
 * Phones: the panel sits BELOW the map, so a panel control that acts on the map (fly, pick, layer) would change
 * something off-screen. Bring the map into view first (no-op on wider layouts, where the map is beside the panel).
 */
export function revealMap(): void {
  const el = document.querySelector<HTMLElement>('.dk-sg.is-sm .dk-sg-map')
  if (!el) return
  const r = el.getBoundingClientRect()
  if (r.top >= -8 && r.top < window.innerHeight * 0.25) return
  el.scrollIntoView({ block: 'start', behavior: motionMode() === 'full' ? 'smooth' : 'auto' })
}
export function clearImpactCache(): void {
  impactCache.clear()
}

/** Ask the map for the desa polygons once; resolves true when the impact can be computed (false when the map is not
 *  ready yet: callers that must not give up use ensureDesaWhenMap). */
let desaPromise: Promise<boolean> | null = null
export function ensureDesa(): Promise<boolean> {
  if (state.desaReady) return Promise.resolve(true)
  const h = mapRef.current
  if (!h) return Promise.resolve(false)
  desaPromise ??= h.loadDesa().then(
    () => {
      ui.set({ desaReady: true, impact6: impactAt(6) })
      return true
    },
    () => {
      desaPromise = null
      return false
    },
  )
  return desaPromise
}
/** ensureDesa for a click that can come before the map is ready (a quick first click): waits for the map, up to
 *  MAP_WAIT_MS, instead of resolving false at once */
const MAP_WAIT_MS = 15_000
export function ensureDesaWhenMap(): Promise<boolean> {
  if (state.desaReady || mapRef.current) return ensureDesa()
  return new Promise((res) => {
    const t = setTimeout(() => res(false), MAP_WAIT_MS)
    withMap(() => {
      clearTimeout(t)
      void ensureDesa().then(res)
    })
  })
}
export function forgetDesa(): void {
  desaPromise = null
  clearImpactCache()
}

/** run `fn` with the map handle now, or once MapStage reports the map ready (arrivals via ?focus=) */
const pending: ((h: MapViewHandle) => void)[] = []
export function withMap(fn: (h: MapViewHandle) => void): void {
  if (mapRef.current) fn(mapRef.current)
  else pending.push(fn)
}
/** time of the last camera move this product asked for (fly / fit): MapStage's phone framing never overrides it */
export const camMoved = { at: 0 }
function tracked(h: MapViewHandle): MapViewHandle {
  return {
    ...h,
    flyTo: (c, z) => {
      camMoved.at = performance.now()
      h.flyTo(c, z)
    },
    fitKecamatan: (id) => {
      camMoved.at = performance.now()
      h.fitKecamatan(id)
    },
  }
}
export function mapReady(raw: MapViewHandle): void {
  const h = tracked(raw)
  mapRef.current = h
  for (const fn of pending.splice(0)) fn(h)
}
