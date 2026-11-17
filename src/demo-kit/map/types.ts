/**
 * map/types.ts — public types of the map module. No runtime code and no MapLibre import, so any demo can
 * describe its layers without pulling the MapLibre chunk.
 */
import type { IconName } from '../ui/icons'

export type LngLat = [number, number]
export type Bi = { id: string; en: string }

/** Semantic tone of a marker / swatch (colours come from the dusk palette; red = danger only). */
export type MapTone = 'accent' | 'neutral' | 'warn' | 'danger' | 'info'

export interface MarkerItem {
  id: string
  coord: LngLat
  /** glyph from ui/icons (drawn white-on-badge into the map sprite) */
  icon: IconName
  /** tooltip / accessible text */
  label: string
  /** second tooltip line */
  detail?: string
  tone?: MapTone
}

export interface HeatPoint {
  coord: LngLat
  /** 0…1 (default 1) */
  weight?: number
}

/** A rain cell as the map draws it (world/types RainCell without id/at is assignable). */
export interface RainCellInput {
  center: LngLat
  radiusKm: number
  /** mm/hour */
  intensity: number
  /** degrees, 0 = north, direction the cell travels to */
  heading: number
  speedKmh: number
}

interface LayerBase {
  /** unique per MapView; used by setLayerVisible() and LayerToggle */
  id: string
  visible?: boolean
}

/** Real kecamatan boundaries (hover/focus highlight, labels with the active choropleth value). */
export interface KecamatanLayer extends LayerBase {
  kind: 'kecamatan'
  /** 'name+value' (default) shows the active choropleth value next to the name */
  labels?: 'none' | 'name' | 'name+value'
}
/** Real desa/kelurahan boundaries (faint lines from zoom ≈ 9.5, labels from zoom 11). */
export interface DesaLayer extends LayerBase {
  kind: 'desa'
}
export interface RiversLayer extends LayerBase {
  kind: 'rivers'
}
export interface RoadsLayer extends LayerBase {
  kind: 'roads'
}
/** Derived flood-risk zones from the pack (hazards.flood). */
export interface HazardLayer extends LayerBase {
  kind: 'hazard'
}
/** Kecamatan choropleth. Only the top-most visible choropleth is drawn. */
export interface ChoroplethLayer extends LayerBase {
  kind: 'choropleth'
  /** value per kecamatan id; null/undefined = no data */
  values: Record<string, number | null | undefined>
  /** kecamatan ids hidden by the anonymity threshold → hatch pattern + tooltip */
  hidden?: string[]
  /** class breaks (ascending, n-1 values for n classes); default: 5 quantile classes */
  breaks?: number[]
  /** value formatter for labels, tooltip and legend */
  format?: (v: number) => string
  title?: Bi
  unit?: Bi
}
export interface HeatLayer extends LayerBase {
  kind: 'heat'
  points: HeatPoint[]
  /** radius in px at zoom 10 (default 22) */
  radius?: number
}
export interface MarkersLayer extends LayerBase {
  kind: 'markers'
  items: MarkerItem[]
  /** smaller badges (e.g. many complaints) */
  size?: 'sm' | 'md'
}
/** Predicted inundation that GROWS with the time scrubber (setTime / `hour`). */
export interface FloodLayer extends LayerBase {
  kind: 'flood'
  /** initial hour (0…6); later changes go through the handle's setTime() to avoid React renders */
  hour?: number
}
/** Rain radar cells moving in from the map edge (flag `mapRain`; static frame when off). */
export interface RainLayer extends LayerBase {
  kind: 'rain'
  /** cells from the world (rain.forecast); default: a deterministic field from the region + seed */
  cells?: RainCellInput[]
  seed?: number
  /** ambient motion while visible (default true; forced off by the mapRain flag / reduced motion) */
  animate?: boolean
}

/** One highlighted zone: kecamatan and/or desa ids painted in a tone (warnings, alert areas, selections). */
export interface Zone {
  kecamatanIds?: string[]
  /** desa ids need the lazy desa polygons: a visible desa zone asks for them (or await handle.loadDesa()) */
  desaIds?: string[]
  tone: MapTone
}
/** Warning / alert zones over the real boundaries (fill 20 % + 2 px outline in the zone's tone). */
export interface ZonesLayer extends LayerBase {
  kind: 'zones'
  zones: Zone[]
}
/**
 * Satellite imagery under the boundaries (Siaga Wilayah "citra satelit"). Tiles are fetched only once the layer is
 * visible. Source and licence: IMAGERY in map/basemap.ts (shown in the Sumber panel while visible).
 */
export interface ImageryLayer extends LayerBase {
  kind: 'imagery'
  /** 0..1, default 0.9 */
  opacity?: number
}

export type MapLayer =
  | KecamatanLayer
  | ZonesLayer
  | ImageryLayer
  | DesaLayer
  | RiversLayer
  | RoadsLayer
  | HazardLayer
  | ChoroplethLayer
  | HeatLayer
  | MarkersLayer
  | FloodLayer
  | RainLayer

export type MapLayerKind = MapLayer['kind']

export interface MapViewHandle {
  /** fly the camera; zoom defaults to the current zoom */
  flyTo(center: LngLat, zoom?: number): void
  /** frame the whole region */
  fitRegion(): void
  /** frame one kecamatan (and select it) */
  fitKecamatan(id: string): void
  setLayerVisible(layerId: string, visible: boolean): void
  /** hover-style highlight of a kecamatan (null clears) — used by KecamatanList focus */
  highlight(kecamatanId: string | null): void
  /** time scrubber position in hours (0…6): grows the flood layer and moves the rain field */
  setTime(hours: number): void
  /** the MapLibre map instance (escape hatch; typed loosely so callers need no MapLibre import) */
  raw(): unknown
  /**
   * Desa polygons are lazy (MapView loads geometry without desa.min.json and fetches it when the desa layer is
   * switched on / zoomed in or the flood is scrubbed past +0 h). Resolves once the current region's desa are in.
   */
  loadDesa(): Promise<void>
  /**
   * Flood impact at `hours` from the same model the map paints (seed 1). null until desa are in — the call
   * starts that download; await loadDesa() and call again (show a short loading state meanwhile).
   */
  floodImpact(hours: number): FloodImpact | null
}

export interface MapViewProps {
  regionId: string
  layers: MapLayer[]
  onReady?: (handle: MapViewHandle) => void
  /** false = static picture (no pan/zoom, no hover) */
  interactive?: boolean
  /** default: fit the region bbox */
  initialView?: { center: LngLat; zoom: number }
  className?: string
  ariaLabel?: string
  /** selected kecamatan (outline + raised fill) */
  selectedId?: string | null
  /** click on a kecamatan (null = click outside) */
  onSelect?: (kecamatanId: string | null) => void
  /** click on a marker */
  onMarker?: (layerId: string, itemId: string) => void
  /** show the full-screen button (default true when interactive and the browser supports it) */
  fullscreenButton?: boolean
}

/** Impact of the flood prediction at one hour. */
export interface FloodImpact {
  hour: number
  /** desa with any inundation, most flooded first */
  desa: { id: string; name: string; kecamatanId: string; share: number; onset: number; people: number }[]
  kecamatanIds: string[]
  people: number
  /** inundated area in km² */
  areaKm2: number
}
