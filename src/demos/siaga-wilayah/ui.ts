/**
 * siaga-wilayah/ui.ts — the sandbox's UI state, shared by the eager parts (map stage, panel, Peringatan tab) and the
 * lazy tabs / dialogs (Prediksi, Pertanian, Lingkungan, Broadcast, Geo-AI). A tiny external store (no context), so a
 * lazy chunk reads the same state without prop drilling, and the map handle lives next to it.
 * World data stays in the world store; this file holds only view state (tab, layers, scrubber hour, impact cache).
 */
import { useSyncExternalStore } from 'react'
import type { FloodImpact, MapViewHandle } from '../../demo-kit/map'
import type { Harvest } from '../../demo-kit/world'
import type { ChangeSite } from './sites'

export type TabId = 'alerts' | 'forecast' | 'agri' | 'env'
export type LayerId = 'kec' | 'desa' | 'rivers' | 'hazard' | 'rain' | 'flood' | 'reports' | 'facilities' | 'zones' | 'imagery' | 'harvest' | 'landslide' | 'changes'
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
  /** procedural imagery is being rendered */
  imageryBusy: boolean
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
  /** id of an entity to highlight in the panel (arrivals via ?focus=, new alert) */
  flash: string | null
  /** the Geo-AI insight card was dismissed */
  insightOff: boolean
  /** an AI-drafted warning waiting to be opened in the broadcast dialog */
  draft: AlertDraft | null
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
  imageryBusy: false,
  selectedKec: null,
  picked: null,
  broadcastOpen: false,
  aiOpen: false,
  layersOpen: false,
  desaReady: false,
  impact: null,
  impact6: null,
  flash: null,
  insightOff: false,
  draft: null,
})

let state: UiState = initial()
const subs = new Set<() => void>()

export const ui = {
  get: (): UiState => state,
  set(patch: Partial<UiState> | ((s: UiState) => Partial<UiState>)): void {
    const p = typeof patch === 'function' ? patch(state) : patch
    let changed = false
    for (const k in p) if ((p as Record<string, unknown>)[k] !== (state as unknown as Record<string, unknown>)[k]) changed = true
    if (!changed) return
    state = { ...state, ...p }
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
  const v = mapRef.current?.floodImpact(hours) ?? null
  if (v) impactCache.set(hours, v)
  return v
}
export function clearImpactCache(): void {
  impactCache.clear()
}

/** Ask the map for the desa polygons once; resolves true when the impact can be computed. */
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
export function mapReady(h: MapViewHandle): void {
  mapRef.current = h
  for (const fn of pending.splice(0)) fn(h)
}
