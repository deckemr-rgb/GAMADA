/**
 * map/engine.ts — everything that touches MapLibre. Imported ONLY through a dynamic import() in MapView, so
 * maplibre-gl (and its worker + CSS) live in their own lazy chunk that the home page and non-map demos never
 * load.
 *
 * Rendering rules: no own RAF (MapLibre renders on demand; the rain animation asks for repaints from
 * gsap.ticker, capped per perf tier and stopped when hidden / off-screen / flag off). Labels are HTML (Manrope,
 * halo, collision-culled) so they work without the glyph server; markers are icon-only symbols from badge
 * images drawn from ui/icons glyphs.
 */
import { AttributionControl, Map as MLMap, setWorkerUrl, type CanvasSource, type GeoJSONSource, type MapMouseEvent, type StyleSpecification, type ExpressionSpecification } from 'maplibre-gl'
import type { Feature, FeatureCollection } from 'geojson'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { gsap } from 'gsap'
import { DEMO, isEnabled } from '../../lib/motion'
import { getPerfTier } from '../../lib/perf'
import type { Lang } from '../../lib/i18n'
import type { RegionGeo, RegionPack } from '../region/types'
import { BASEMAP, BASEMAP_SOURCE, fallbackStyle, loadBasemapStyle } from './basemap'
import { resolveChoropleth, type ResolvedChoropleth } from './choro'
import { buildFloodModel, desaShares, FLOOD, floodImpact, paintFlood, type FloodModel } from './flood'
import { bboxOfPolys, centroidOf, makeGrid, outerRings, pointInPolys, polysOf, type BBox, type Poly, type Ring } from './geo'
import { labelPoint } from './labelPoint'
import { HEAT_RAMP, labelInk, MAPC, TONE_BADGE } from './palette'
import { defaultRainField } from './rain'
import { RainLayer } from './rainLayer'
import { fmt } from './strings'
import type { ChoroplethLayer, FloodImpact, LngLat, MapLayer, MapTone, MarkerItem, RainCellInput } from './types'

/** this file's bilingual strings (kept per file so a demo loads only the strings of the parts it uses) */
const S = {
  mapOf: { id: 'Peta', en: 'Map of' },
  attribution: { id: 'Atribusi peta dasar', en: 'Basemap attribution' },
  coopTouch: { id: 'Gunakan dua jari untuk menggeser peta', en: 'Use two fingers to move the map' },
  coopWheel: { id: 'Tahan Ctrl sambil menggulir untuk memperbesar peta', en: 'Hold Ctrl while scrolling to zoom the map' },
  coopWheelMac: { id: 'Tahan ⌘ sambil menggulir untuk memperbesar peta', en: 'Hold ⌘ while scrolling to zoom the map' },
  hidden: { id: 'Data agregat disembunyikan untuk menjaga anonimitas', en: 'Aggregate hidden to protect anonymity' },
  noData: { id: 'Tidak ada data', en: 'No data' },
  kecamatan: { id: 'Kecamatan', en: 'District' },
  desa: { id: 'Desa', en: 'Village' },
  flooded: { id: 'tergenang', en: 'flooded' },
  markersHere: { id: 'titik berdekatan', en: 'places close together' },
  clusterClick: { id: 'Klik untuk memperbesar', en: 'Click to zoom in' },
  clusterTap: { id: 'Ketuk untuk memperbesar', en: 'Tap to zoom in' },
} as const
const ms = (k: keyof typeof S, lang: Lang): string => S[k][lang]

setWorkerUrl(workerUrl)

/* ------------------------------------------------------------------ constants (module-local) */
export const ENGINE = {
  /** flights (s) */
  flyDur: 1.2,
  regionOutDur: 0.7,
  regionInDur: 1.3,
  /** max zoom when framing one kecamatan */
  kecMaxZoom: 11.6,
  /** desa labels replace kecamatan labels from this zoom */
  desaLabelZoom: 11.2,
  /** desa geometry is lazy: with the desa layer on it is fetched once the zoom reaches desaLabelZoom − this
   * (desa lines are near-invisible below ≈ 9.5, so a regency-scale map never downloads desa.min.json) */
  desaPrefetchZoom: 1.5,
  /** below this container width labels show names only (value for the selected one) */
  compactWidth: 640,
  /** label collision padding (px) */
  labelPad: 4,
  /** clearance kept between a label and a marker badge (px) */
  labelMarkerPad: 3,
  /** rain repaint cap per tier (fps); high = every ticker frame */
  rainFps: { high: 0, mid: DEMO.rainFpsMid, low: 20 },
  /** flood raster/desa states are recomputed when the hour moves by this much */
  floodStep: 0.03,
  desaStateStep: 0.25,
  /** a desa lights up once this share of it is under water (feature-state fl = share) */
  desaLit: 0.25,
  /** marker badge diameter (css px) */
  badge: { md: 24, sm: 18 },
  /** badges closer than this × their drawn diameter merge into one count badge (screen space, per zoom bucket) */
  clusterGap: 0.95,
  /** from this zoom every marker is drawn on its own */
  clusterMaxZoom: 12.5,
  /** cluster badge canvas = this × the single badge (back badge + count pill fit inside) */
  clusterScale: 1.6,
} as const

/** drawn badge scale at zoom z — same ramp as the marker symbol layer's icon-size (8 → 0.8, 11 → 1) */
const badgeScale = (z: number): number => 0.8 + 0.2 * Math.max(0, Math.min(1, (z - 8) / 3))

interface MarkerGroup {
  coord: LngLat
  items: MarkerItem[]
}

const IDS = {
  kec: 'dk-kec',
  desa: 'dk-desa',
  rivers: 'dk-rivers',
  roads: 'dk-roads',
  hazard: 'dk-hazard',
  mask: 'dk-mask',
  outline: 'dk-outline',
  flood: 'dk-flood',
} as const

type FixedKind = 'kecamatan' | 'desa' | 'rivers' | 'roads' | 'hazard'
const FIXED_LAYERS: Record<FixedKind | 'choropleth', string[]> = {
  kecamatan: ['dk-kec-fill', 'dk-kec-casing', 'dk-kec-line', 'dk-outline-line'],
  desa: ['dk-desa-fill', 'dk-desa-line'],
  rivers: ['dk-rivers-area', 'dk-rivers-line'],
  roads: ['dk-roads-line'],
  hazard: ['dk-hazard-fill', 'dk-hazard-line'],
  choropleth: ['dk-choro-fill', 'dk-choro-hatch'],
}

export interface EngineCallbacks {
  onSelect?: (id: string | null) => void
  onMarker?: (layerId: string, itemId: string) => void
  onNotice?: (kind: 'noTiles' | null) => void
  onFps?: (fps: number) => void
  /** the map now needs the desa polygons of the current region (asked once per region until setDesa) */
  onNeedDesa?: (regionId: string) => void
}

export interface EngineOptions {
  container: HTMLElement
  labelsEl: HTMLElement
  tipEl: HTMLElement
  lang: Lang
  interactive: boolean
  cooperative: boolean
  /** ?maptiles=off — simulate an unreachable basemap */
  forceFallback: boolean
  debugFps: boolean
  /** svg markup per icon name (rendered by MapView from ui/icons) */
  iconSvgs: Record<string, string>
  callbacks: EngineCallbacks
}

interface KecInfo {
  id: string
  name: string
  centroid: LngLat
  polys: Poly[]
  bbox: BBox
  population: number
}
interface DesaInfo {
  id: string
  name: string
  kecamatanId: string
  centroid: LngLat
}
interface Label {
  id: string
  el: HTMLDivElement
  name: HTMLSpanElement
  val: HTMLSpanElement
  at: LngLat
  /** kecamatan polygons: the label must sit inside them (desa labels: none) */
  polys?: Poly[]
  w: number
  h: number
  shown: boolean
  /** cached placement for one zoom bucket: offset of the label centre from its anchor, and whether it spills */
  fit?: { z: number; dx: number; dy: number; out: boolean; blocked: boolean }
}

/** Candidate label-centre offsets (in label heights / widths) tried in order when the anchor is blocked. */
const LABEL_TRIES: [number, number][] = [
  [0, 0],
  [0, -1],
  [0, 1],
  [-0.35, 0],
  [0.35, 0],
  [0, -2],
  [0, 2],
]

const anim = () => isEnabled('demoAnimations')

/* ------------------------------------------------------------------ helpers */

function ringArea(r: Ring): number {
  let a = 0
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j]![0] - r[i]![0]) * (r[j]![1] + r[i]![1])
  return a / 2
}

/** map image name of a single marker badge */
const badgeName = (m: MarkerItem, size: 'sm' | 'md'): string => `dk-ic-${m.icon}-${m.tone ?? 'neutral'}-${size}`

function fc(features: Feature[]): FeatureCollection {
  return { type: 'FeatureCollection', features }
}

/** features with a string `id` property (promoteId) */
const withId = (f: Feature) => ({ ...f, properties: { ...(f.properties ?? {}), id: String(f.properties?.id ?? f.id) } }) as Feature

type DesaFC = NonNullable<RegionGeo['desa']>
/** base geo (no desa) + desa → one stable composed object, so the flood model (cached per geo object) is
 * built once per region even across region switches */
const composed = new WeakMap<RegionGeo, { desa: DesaFC; geo: RegionGeo }>()
function geoWithDesa(base: RegionGeo, desa: DesaFC): RegionGeo {
  const hit = composed.get(base)
  if (hit && hit.desa === desa) return hit.geo
  const geo = { ...base, desa }
  composed.set(base, { desa, geo })
  return geo
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  e.className = cls
  parent?.appendChild(e)
  return e
}

/* ------------------------------------------------------------------ engine */

export class MapEngine {
  readonly map: MLMap
  private o: EngineOptions
  private lang: Lang
  private pack: RegionPack | null = null
  private geo: RegionGeo | null = null
  private kec: KecInfo[] = []
  private kecById = new Map<string, KecInfo>()
  private desa: DesaInfo[] = []
  private specs: MapLayer[] = []
  private visibleOverride = new Map<string, boolean>()
  private choro: { spec: ChoroplethLayer; r: ResolvedChoropleth } | null = null
  private selected: string | null = null
  private hovered: string | null = null
  private hoverDesa: string | null = null
  private highlighted: string | null = null
  private kecLabels = new Map<string, Label>()
  private desaLabels = new Map<string, Label>()
  private dynamic = new Map<string, { kind: MapLayer['kind']; layers: string[]; source?: string; data?: unknown }>()
  private markerItems = new Map<string, Map<string, MarkerItem>>()
  /** model: null until the first paint with hour > 0 (hour 0 is fully dry) and again after desa arrives */
  private flood: { model: FloodModel | null; canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; img: ImageData; lastH: number; lastDesaKey: number; layerId: string } | null = null
  /** desa polygons that arrived for a region not (yet) installed — applied by setRegion */
  private pendingDesa: { regionId: string; fc: DesaFC } | null = null
  /** onNeedDesa already fired for the current region */
  private desaAsked = false
  /** desa layer state at the last applySpecs (null = no region applied yet); off → on counts as a user toggle */
  private desaWasOn: boolean | null = null
  private desaToggledOn = false
  private rain: RainLayer | null = null
  private rainAnimate = false
  private hour = 0
  private ambient = 0
  private lastRainPaint = 0
  private ticking = false
  private inView = true
  private styleReady: Promise<void>
  private noticeShown = false
  private destroyed = false
  private regionToken = 0
  private tipSticky = 0
  private fpsCount = 0
  private fpsTimer = 0
  private labelRaf = 0
  private iconLoads = new Map<string, Promise<void>>()
  /** rendered badge canvases (device px) by image name — cluster badges are composed from them */
  private badgeCv = new Map<string, HTMLCanvasElement>()
  /** declutter state per markers layer: groups drawn at zoom bucket zb */
  private markerGroups = new Map<string, { zb: number; size: 'sm' | 'md'; groups: MarkerGroup[] }>()
  /** the camera still shows the fitted region (no user move / flight since) → refit on resize */
  private autoFit = true

  static async create(o: EngineOptions): Promise<MapEngine> {
    let style: StyleSpecification
    let ok = true
    if (o.forceFallback) {
      style = fallbackStyle()
      ok = false
    } else {
      try {
        style = await loadBasemapStyle()
      } catch {
        style = fallbackStyle()
        ok = false
      }
    }
    return new MapEngine(o, style, ok)
  }

  private constructor(o: EngineOptions, style: StyleSpecification, basemapOk: boolean) {
    this.o = o
    this.lang = o.lang
    const L = o.lang
    this.map = new MLMap({
      container: o.container,
      style,
      center: [111.81, -7.26],
      zoom: 8,
      interactive: o.interactive,
      attributionControl: false,
      maplibreLogo: false,
      cooperativeGestures: o.interactive && o.cooperative,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      maxPitch: 0,
      renderWorldCopies: false,
      fadeDuration: 150,
      pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      validateStyle: false,
      reduceMotion: !anim(),
      locale: {
        'Map.Title': ms('mapOf', L),
        'CooperativeGesturesHandler.WindowsHelpText': ms('coopWheel', L),
        'CooperativeGesturesHandler.MacHelpText': ms('coopWheelMac', L),
        'CooperativeGesturesHandler.MobileHelpText': ms('coopTouch', L),
        // distinct from the kit's own "Sumber" popover button (two controls must not share one name)
        'AttributionControl.ToggleAttribution': ms('attribution', L),
      },
    })
    this.map.touchZoomRotate.disableRotation()
    this.map.keyboard.disableRotation()
    this.map.addControl(new AttributionControl({ compact: true, customAttribution: basemapOk ? undefined : BASEMAP.attribution }), 'bottom-right')
    // start the compact attribution collapsed (the Sumber popover carries the full list)
    this.map.once('load', () => o.container.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'))
    this.styleReady = new Promise((res) => {
      if (this.map.isStyleLoaded()) res()
      else this.map.once('load', () => res())
    })
    this.map.on('error', (ev) => {
      const e = ev as unknown as { error?: Error; sourceId?: string }
      const msg = e.error?.message ?? ''
      const basemap = e.sourceId === BASEMAP_SOURCE || /openfreemap|openmaptiles|glyph|fonts\//i.test(msg)
      if (basemap) this.basemapFailed()
      // every other error is ours: surface it in dev, stay quiet in production
      else if (import.meta.env.DEV) console.warn('[map]', msg)
    })
    if (!basemapOk) queueMicrotask(() => this.basemapFailed())
    this.map.on('move', this.scheduleLabels)
    this.map.on('resize', this.scheduleLabels)
    this.map.on('zoom', this.checkDesa)
    this.map.on('zoom', this.regroupMarkers)
    // a user gesture ends the "still showing the fitted region" state (programmatic flights have no originalEvent)
    this.map.on('movestart', (e: { originalEvent?: unknown }) => {
      if (e.originalEvent) this.autoFit = false
    })
    if (o.interactive) {
      this.map.on('mousemove', this.onMove)
      this.map.on('mouseout', this.onOut)
      this.map.on('click', this.onClick)
    }
    if (o.debugFps) {
      this.map.on('render', () => this.fpsCount++)
      this.fpsTimer = window.setInterval(() => {
        o.callbacks.onFps?.(this.fpsCount)
        this.fpsCount = 0
      }, 1000)
    }
    document.addEventListener('visibilitychange', this.updateLoop)
  }

  private basemapFailed(): void {
    if (this.noticeShown) return
    this.noticeShown = true
    this.o.callbacks.onNotice?.('noTiles')
  }

  /* ---------------------------------------------------------------- region */

  async setRegion(pack: RegionPack, geo: RegionGeo, animate: boolean): Promise<void> {
    const token = ++this.regionToken
    await this.styleReady
    if (this.destroyed || token !== this.regionToken) return
    const had = !!this.pack
    if (had && animate && anim()) {
      // fly OUT of the old region first
      await new Promise<void>((res) => {
        this.map.once('moveend', () => res())
        this.map.flyTo({ zoom: Math.max(5, this.map.getZoom() - 2.4), duration: ENGINE.regionOutDur * 1000, essential: true })
      })
      if (this.destroyed || token !== this.regionToken) return
    }
    this.pack = pack
    // desa that arrived while this region was still loading / flying out
    const pend = this.pendingDesa
    this.pendingDesa = null
    this.geo = !geo.desa && pend?.regionId === pack.id ? geoWithDesa(geo, pend.fc) : geo
    this.desaAsked = false
    this.kec = geo.kecamatan.features.map((f) => {
      const id = String(f.properties?.id ?? f.id)
      const pk = pack.kecamatan.find((k) => k.id === id)
      const polys = polysOf(f.geometry)
      return { id, name: pk?.name ?? String(f.properties?.name ?? id), centroid: pk?.centroid ?? centroidOf(polys), polys, bbox: bboxOfPolys(polys), population: pk?.population ?? 0 }
    })
    this.kecById = new Map(this.kec.map((k) => [k.id, k]))
    this.desa = this.desaInfo()
    this.hoverDesa = null
    this.flood = null
    this.installRegionLayers()
    this.buildLabels()
    this.applySpecs()
    this.fitRegion(had && animate ? ENGINE.regionInDur : 0)
  }

  private desaInfo(): DesaInfo[] {
    const pack = this.pack
    const feats = this.geo?.desa?.features
    if (!pack || !feats) return []
    const packDesa = new Map(pack.kecamatan.flatMap((k) => k.desa.map((d) => [d.id, d] as const)))
    return feats.map((f) => {
      const id = String(f.properties?.id ?? f.id)
      const pd = packDesa.get(id)
      return { id, name: pd?.name ?? String(f.properties?.name ?? id), kecamatanId: String(f.properties?.kecamatanId ?? ''), centroid: pd?.centroid ?? centroidOf(polysOf(f.geometry)) }
    })
  }

  /* ---------------------------------------------------------------- desa (lazy) */

  /** true once the current region's desa polygons are in (MapView loads geometry without them first) */
  get hasDesa(): boolean {
    return !!this.geo?.desa
  }

  /** id of the region currently installed (null before the first setRegion) */
  get regionId(): string | null {
    return this.pack?.id ?? null
  }

  /**
   * Desa polygons for `regionId` (fetched lazily by MapView after onNeedDesa). Updates the desa source, desa
   * labels, hover info and the flood model (cached per geo object: the model is rebuilt from the composed geo, so
   * flood desa shares / lighting and floodImpact() switch from the kecamatan fallback to real desa).
   * Desa for a region that is not installed yet are kept and applied by setRegion.
   */
  setDesa(desa: DesaFC, regionId: string): void {
    if (this.destroyed) return
    if (!this.pack || !this.geo || this.pack.id !== regionId) {
      this.pendingDesa = { regionId, fc: desa }
      return
    }
    if (this.geo.desa === desa) return
    this.geo = geoWithDesa(this.geo, desa)
    this.desa = this.desaInfo()
    this.setHoverDesa(null)
    ;(this.map.getSource(IDS.desa) as GeoJSONSource | undefined)?.setData(fc(desa.features.map((f) => withId(f as Feature))))
    for (const l of this.desaLabels.values()) l.el.remove()
    this.desaLabels.clear()
    const f = this.flood
    if (f) {
      f.model = null
      f.lastH = -1
      f.lastDesaKey = -1
      const fl = this.floodEntry()
      if (fl && this.isVisibleId(fl[0])) {
        this.paintFloodNow(true)
        this.updateDesaFlood(true)
      }
    }
    this.scheduleLabels()
  }

  /** Ask MapView (once per region) for desa when something on screen needs them. */
  private checkDesa = (): void => {
    if (this.desaAsked || this.destroyed || !this.pack || this.hasDesa) return
    const desaOn = this.specs.some((s) => s.kind === 'desa' && this.isVisible(s))
    const fl = this.floodEntry()
    const floodWet = !!fl && this.isVisibleId(fl[0]) && this.hour > 0
    const zoomed = this.map.getZoom() >= ENGINE.desaLabelZoom - ENGINE.desaPrefetchZoom
    if (floodWet || (desaOn && (zoomed || this.desaToggledOn))) this.requestDesa()
  }

  /** Fire onNeedDesa for the current region (no-op once asked or when desa are already in). */
  requestDesa(): void {
    if (this.desaAsked || !this.pack || this.hasDesa) return
    this.desaAsked = true
    this.o.callbacks.onNeedDesa?.(this.pack.id)
  }

  /** onNeedDesa failed (offline …): allow a later trigger to ask again */
  desaFailed(regionId: string): void {
    if (this.pack?.id === regionId) this.desaAsked = false
  }

  /**
   * Flood impact (affected desa, people, area) at `hour` from the same model the map paints. null until the
   * desa polygons are in (the call asks for them) — callers show a short loading state meanwhile.
   */
  floodImpact(hour: number): FloodImpact | null {
    if (!this.pack || !this.geo) return null
    if (!this.hasDesa) {
      this.requestDesa()
      return null
    }
    return floodImpact(buildFloodModel(this.pack, this.geo, 1), hour)
  }

  private installRegionLayers(): void {
    const { map } = this
    const geo = this.geo!
    // drop everything ours from a previous region
    for (const l of map.getStyle().layers ?? []) if (l.id.startsWith('dk-')) map.removeLayer(l.id)
    for (const s of Object.keys(map.getStyle().sources ?? {})) if (s.startsWith('dk-')) map.removeSource(s)
    this.dynamic.clear()
    this.rain = null
    this.updateLoop()

    map.addSource(IDS.kec, { type: 'geojson', data: fc(geo.kecamatan.features.map((f) => withId(f as Feature))), promoteId: 'id' })
    map.addSource(IDS.desa, { type: 'geojson', data: fc((geo.desa?.features ?? []).map((f) => withId(f as Feature))), promoteId: 'id' })
    map.addSource(IDS.rivers, { type: 'geojson', data: fc(geo.rivers.features as Feature[]) })
    map.addSource(IDS.roads, { type: 'geojson', data: fc((geo.roads?.features ?? []) as Feature[]) })
    map.addSource(IDS.hazard, { type: 'geojson', data: fc(geo.hazards.flood.features as Feature[]) })

    // region outline + "spotlight" mask (outside dimmed). Rings come from shared kecamatan edges.
    const rings = outerRings(this.kec.flatMap((k) => k.polys)).filter((r) => Math.abs(ringArea(r)) > 1e-4)
    const [W, S, E, N] = this.pack!.bbox
    const world: Ring = [
      [W - 25, S - 25],
      [E + 25, S - 25],
      [E + 25, N + 25],
      [W - 25, N + 25],
      [W - 25, S - 25],
    ]
    const sign = Math.sign(ringArea(world))
    const holes = rings.map((r) => (Math.sign(ringArea(r)) === sign ? [...r].reverse() : r))
    map.addSource(IDS.mask, { type: 'geojson', data: fc(rings.length ? [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [world, ...holes] } }] : []) })
    map.addSource(IDS.outline, { type: 'geojson', data: fc(rings.map((r) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: r } }))) })

    const st = (k: string, d: unknown = false): ExpressionSpecification => ['coalesce', ['feature-state', k], d] as ExpressionSpecification
    map.addLayer({ id: 'dk-mask-fill', type: 'fill', source: IDS.mask, paint: { 'fill-color': MAPC.mask, 'fill-opacity': 0.55 } })
    map.addLayer({
      id: 'dk-choro-fill',
      type: 'fill',
      source: IDS.kec,
      // strong at regency scale, lighter when zoomed in so the basemap context shows through
      paint: { 'fill-color': 'rgba(0,0,0,0)', 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 10, ['case', ['>=', st('c', -9), -2], 0.8, 0], 12.5, ['case', ['>=', st('c', -9), -2], 0.45, 0]] as ExpressionSpecification },
      layout: { visibility: 'none' },
    })
    map.addLayer({
      id: 'dk-choro-hatch',
      type: 'fill',
      source: IDS.kec,
      paint: { 'fill-pattern': 'dk-hatch', 'fill-opacity': ['case', st('hid'), 1, 0] as ExpressionSpecification },
      layout: { visibility: 'none' },
    })
    this.ensureHatch()
    map.addLayer({
      id: 'dk-hazard-fill',
      type: 'fill',
      source: IDS.hazard,
      paint: { 'fill-color': ['match', ['get', 'level'], 'tinggi', MAPC.hazardHigh, MAPC.hazardMid], 'fill-opacity': ['match', ['get', 'level'], 'tinggi', 0.16, 0.08] },
      layout: { visibility: 'none' },
    })
    map.addLayer({
      id: 'dk-hazard-line',
      type: 'line',
      source: IDS.hazard,
      paint: { 'line-color': MAPC.hazardHigh, 'line-opacity': 0.45, 'line-width': 1, 'line-dasharray': [2, 2] },
      layout: { visibility: 'none' },
    })
    map.addLayer({
      id: 'dk-rivers-area',
      type: 'fill',
      source: IDS.rivers,
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: { 'fill-color': MAPC.river, 'fill-opacity': 0.32 },
      layout: { visibility: 'none' },
    })
    map.addLayer({
      id: 'dk-rivers-line',
      type: 'line',
      source: IDS.rivers,
      filter: ['==', ['geometry-type'], 'LineString'],
      paint: {
        'line-color': MAPC.river,
        'line-opacity': ['match', ['get', 'kind'], 'stream', 0.3, 0.75],
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, ['match', ['get', 'kind'], 'stream', 0.4, ['case', ['==', ['get', 'main'], true], 1.6, 0.9]], 12, ['match', ['get', 'kind'], 'stream', 1, ['case', ['==', ['get', 'main'], true], 3.4, 1.8]]],
      },
      layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
    })
    map.addLayer({
      id: 'dk-roads-line',
      type: 'line',
      source: IDS.roads,
      paint: { 'line-color': '#6a62b0', 'line-opacity': 0.55, 'line-width': ['match', ['get', 'class'], 'trunk', 1.6, 'primary', 1.2, 0.8] },
      layout: { visibility: 'none', 'line-cap': 'round' },
    })
    map.addLayer({
      id: 'dk-desa-fill',
      type: 'fill',
      source: IDS.desa,
      paint: { 'fill-color': MAPC.hover, 'fill-opacity': ['case', st('hover'), 0.12, 0] as ExpressionSpecification },
      layout: { visibility: 'none' },
    })
    map.addLayer({
      id: 'dk-desa-line',
      type: 'line',
      source: IDS.desa,
      paint: {
        'line-color': MAPC.desaLine,
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.08, 10.5, 0.22, 12.5, 0.4],
        'line-width': 0.6,
      },
      layout: { visibility: 'none' },
    })
    map.addLayer({
      id: 'dk-kec-fill',
      type: 'fill',
      source: IDS.kec,
      paint: { 'fill-color': MAPC.hover, 'fill-opacity': ['case', st('sel'), 0.12, st('hover'), 0.1, 0] as ExpressionSpecification },
      layout: { visibility: 'none' },
    })
    map.addLayer({
      id: 'dk-kec-casing',
      type: 'line',
      source: IDS.kec,
      paint: { 'line-color': MAPC.mask, 'line-opacity': ['case', st('sel'), 0.75, 0] as ExpressionSpecification, 'line-width': 5.5 },
      layout: { visibility: 'none', 'line-join': 'round' },
    })
    map.addLayer({
      id: 'dk-kec-line',
      type: 'line',
      source: IDS.kec,
      paint: {
        'line-color': ['case', st('sel'), MAPC.outline, st('hover'), MAPC.hover, MAPC.kecLine] as ExpressionSpecification,
        'line-opacity': ['case', st('sel'), 1, st('hover'), 0.95, 0.34] as ExpressionSpecification,
        'line-width': ['case', st('sel'), 2.6, st('hover'), 2, 0.9] as ExpressionSpecification,
      },
      layout: { visibility: 'none', 'line-join': 'round' },
    })
    map.addLayer({
      id: 'dk-outline-line',
      type: 'line',
      source: IDS.outline,
      paint: { 'line-color': MAPC.outline, 'line-opacity': 0.75, 'line-width': 1.6 },
      layout: { visibility: 'none', 'line-join': 'round' },
    })
  }

  private ensureHatch(): void {
    if (this.map.hasImage('dk-hatch')) return
    const s = 16
    const data = new Uint8ClampedArray(s * s * 4)
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++) {
        const i = (y * s + x) * 4
        const onLine = (x + y) % 8 < 2
        // dusk base + lavender diagonal lines
        data[i] = onLine ? 185 : 38
        data[i + 1] = onLine ? 178 : 33
        data[i + 2] = onLine ? 255 : 76
        data[i + 3] = onLine ? 150 : 200
      }
    this.map.addImage('dk-hatch', { width: s, height: s, data }, { pixelRatio: 2 })
  }

  /* ---------------------------------------------------------------- layer specs */

  setLayers(specs: MapLayer[]): void {
    this.specs = specs
    if (this.pack) this.applySpecs()
  }

  private isVisible(spec: MapLayer): boolean {
    return this.visibleOverride.get(spec.id) ?? spec.visible !== false
  }

  private setVis(layerIds: string[], on: boolean): void {
    for (const id of layerIds) if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
  }

  private applySpecs(): void {
    if (!this.pack) return
    const fixedOn: Record<string, boolean> = { kecamatan: false, desa: false, rivers: false, roads: false, hazard: false }
    let choro: ChoroplethLayer | null = null
    const seen = new Set<string>()
    for (const s of this.specs) {
      const on = this.isVisible(s)
      switch (s.kind) {
        case 'kecamatan':
        case 'desa':
        case 'rivers':
        case 'roads':
        case 'hazard':
          fixedOn[s.kind] = fixedOn[s.kind] || on
          break
        case 'choropleth':
          if (on) choro = s
          break
        case 'heat':
          seen.add(s.id)
          this.applyHeat(s.id, s.points, s.radius ?? 22, on)
          break
        case 'markers':
          seen.add(s.id)
          void this.applyMarkers(s.id, s.items, s.size ?? 'md', on)
          break
        case 'flood':
          seen.add(s.id)
          this.applyFlood(s.id, on, s.hour)
          break
        case 'rain':
          seen.add(s.id)
          this.applyRain(s.id, s.cells ?? defaultRainField(this.pack, s.seed ?? 1), on, s.animate !== false)
          break
      }
    }
    // a desa layer switched on by the user (not one that is on from the start) wants desa right away
    if (this.desaWasOn === false && fixedOn.desa) this.desaToggledOn = true
    if (!fixedOn.desa) this.desaToggledOn = false
    this.desaWasOn = fixedOn.desa!
    for (const k of Object.keys(fixedOn) as FixedKind[]) this.setVis(FIXED_LAYERS[k], fixedOn[k]!)
    // the spotlight mask follows the kecamatan layer
    this.setVis(['dk-mask-fill'], fixedOn.kecamatan!)
    this.applyChoropleth(choro)
    // dynamic layers whose spec disappeared
    for (const [id, d] of [...this.dynamic]) {
      if (seen.has(id)) continue
      for (const l of d.layers) if (this.map.getLayer(l)) this.map.removeLayer(l)
      if (d.source && this.map.getSource(d.source)) this.map.removeSource(d.source)
      if (d.kind === 'rain') this.rain = null
      if (d.kind === 'flood') this.flood = null
      this.dynamic.delete(id)
      this.markerItems.delete(id)
      this.markerGroups.delete(id)
    }
    this.updateLoop()
    this.refreshLabelText()
    this.scheduleLabels()
    this.checkDesa()
  }

  private applyChoropleth(spec: ChoroplethLayer | null): void {
    const prev = this.choro
    this.choro = spec ? { spec, r: resolveChoropleth(spec, this.lang) } : null
    this.setVis(FIXED_LAYERS.choropleth, !!spec)
    if (!spec || !this.choro) {
      if (prev) for (const k of this.kec) this.map.setFeatureState({ source: IDS.kec, id: k.id }, { c: -9, hid: false })
      return
    }
    const r = this.choro.r
    const match: unknown[] = ['match', ['coalesce', ['feature-state', 'c'], -9], -2, '#2a2552']
    r.colors.forEach((c, i) => match.push(i, c))
    match.push('rgba(0,0,0,0)')
    this.map.setPaintProperty('dk-choro-fill', 'fill-color', match as ExpressionSpecification)
    for (const k of this.kec) {
      const hid = r.hidden.has(k.id)
      const c = hid ? -2 : (r.classOf[k.id] ?? -9)
      this.map.setFeatureState({ source: IDS.kec, id: k.id }, { c, hid })
    }
  }

  private addDynamicLayer(id: string, layer: Parameters<MLMap['addLayer']>[0]): void {
    // dynamic layers sit above the boundaries; markers stay on top
    const before = layer.type === 'symbol' ? undefined : [...this.dynamic.values()].flatMap((d) => (d.kind === 'markers' ? d.layers : [])).find((l) => this.map.getLayer(l))
    this.map.addLayer(layer, before)
    void id
  }

  private applyHeat(id: string, points: { coord: LngLat; weight?: number }[], radius: number, on: boolean): void {
    const src = `dk-heat-src-${id}`
    const lid = `dk-heat-${id}`
    const d = this.dynamic.get(id)
    if (!d) {
      this.map.addSource(src, { type: 'geojson', data: fc([]) })
      this.addDynamicLayer(id, {
        id: lid,
        type: 'heatmap',
        source: src,
        paint: {
          'heatmap-weight': ['coalesce', ['get', 'w'], 1],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 8, 0.9, 12, 2.2],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 8, radius * 0.7, 10, radius, 12, radius * 2.2],
          'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], ...HEAT_RAMP.flat()] as ExpressionSpecification,
          'heatmap-opacity': 0.85,
        },
      })
      this.dynamic.set(id, { kind: 'heat', layers: [lid], source: src })
    }
    const dd = this.dynamic.get(id)!
    if (dd.data !== points) {
      dd.data = points
      ;(this.map.getSource(src) as GeoJSONSource).setData(fc(points.map((p) => ({ type: 'Feature', properties: { w: p.weight ?? 1 }, geometry: { type: 'Point', coordinates: p.coord } }))))
    }
    this.setVis([lid], on)
  }

  private async applyMarkers(id: string, items: MarkerItem[], size: 'sm' | 'md', on: boolean): Promise<void> {
    const src = `dk-mk-src-${id}`
    const lid = `dk-mk-${id}`
    if (!this.dynamic.has(id)) this.dynamic.set(id, { kind: 'markers', layers: [lid], source: src })
    const d = this.dynamic.get(id)!
    if (d.data === items) {
      this.setVis([lid], on)
      return
    }
    d.data = items
    this.markerItems.set(id, new Map(items.map((m) => [m.id, m])))
    await Promise.all([...new Set(items.map((m) => `${m.icon}|${m.tone ?? 'neutral'}`))].map((k) => this.ensureBadge(k.split('|')[0]!, k.split('|')[1] as MapTone, size)))
    if (this.destroyed || this.dynamic.get(id) !== d || d.data !== items) return
    const data = this.markerData(id, size)
    const source = this.map.getSource(src) as GeoJSONSource | undefined
    if (source) source.setData(data)
    else {
      this.map.addSource(src, { type: 'geojson', data })
      this.addDynamicLayer(id, {
        id: lid,
        type: 'symbol',
        source: src,
        layout: {
          'icon-image': ['get', 'img'],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'symbol-sort-key': ['get', 'pr'],
          'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.8, 11, 1],
        },
      })
    }
    // the visibility flag may have changed while badges loaded
    const spec = this.specs.find((s) => s.id === id)
    this.setVis([lid], spec ? this.isVisible(spec) : on)
  }

  /**
   * Declutter: badges that would overlap at this zoom merge into one count badge (greedy, highest tone first,
   * screen space). Pan-invariant (no rotation / pitch), so it is redone only when the zoom bucket changes.
   * Below clusterMaxZoom only; the hit test / tooltip / click (zoom in) read the same groups.
   */
  private markerData(id: string, size: 'sm' | 'md'): FeatureCollection {
    const z = this.map.getZoom()
    const zb = Math.round(z * 4)
    const items = [...(this.markerItems.get(id)?.values() ?? [])]
    const pr = (m: MarkerItem) => (m.tone === 'danger' ? 3 : m.tone === 'warn' ? 2 : 1)
    const R = z >= ENGINE.clusterMaxZoom ? 0 : ENGINE.badge[size] * badgeScale(z) * ENGINE.clusterGap
    const groups: (MarkerGroup & { x: number; y: number })[] = []
    for (const m of [...items].sort((a, b) => pr(b) - pr(a))) {
      const p = this.map.project(m.coord)
      const g = R > 0 ? groups.find((q) => Math.hypot(q.x - p.x, q.y - p.y) < R * (q.items.length > 1 ? 1.25 : 1)) : undefined
      if (g) g.items.push(m)
      else groups.push({ x: p.x, y: p.y, coord: m.coord, items: [m] })
    }
    for (const g of groups) {
      if (g.items.length < 2) continue
      g.coord = [g.items.reduce((s, m) => s + m.coord[0], 0) / g.items.length, g.items.reduce((s, m) => s + m.coord[1], 0) / g.items.length]
    }
    this.markerGroups.set(id, { zb, size, groups })
    return fc(
      groups.map((g, i) => {
        const m = g.items[0]!
        const one = g.items.length === 1
        const img = one ? badgeName(m, size) : this.clusterImage(badgeName(m, size), g.items.length)
        return { type: 'Feature', properties: { id: one ? m.id : `#${i}`, img, pr: pr(m) + (one ? 0 : 0.5) }, geometry: { type: 'Point', coordinates: g.coord } }
      }),
    )
  }

  private regroupMarkers = (): void => {
    const zb = Math.round(this.map.getZoom() * 4)
    let changed = false
    for (const [id, st] of this.markerGroups) {
      if (st.zb === zb) continue
      const src = this.map.getSource(`dk-mk-src-${id}`) as GeoJSONSource | undefined
      if (!src) continue
      const n = st.groups.length
      src.setData(this.markerData(id, st.size))
      changed ||= this.markerGroups.get(id)!.groups.length !== n
    }
    if (changed) for (const l of [...this.kecLabels.values(), ...this.desaLabels.values()]) l.fit = undefined
  }

  /** Count badge: the group's top badge over a faded copy + a count pill, composed from the cached badge canvas. */
  private clusterImage(base: string, n: number): string {
    const name = `${base}-n${n}`
    if (this.map.hasImage(name)) return name
    const b = this.badgeCv.get(base)
    if (!b) return base
    const D = b.width
    const S = Math.round(D * ENGINE.clusterScale)
    const cv = document.createElement('canvas')
    cv.width = S
    cv.height = S
    const ctx = cv.getContext('2d')!
    const c = S / 2
    const off = D * 0.14
    ctx.globalAlpha = 0.6
    ctx.drawImage(b, c - D / 2 + off, c - D / 2 - off)
    ctx.globalAlpha = 1
    ctx.drawImage(b, c - D / 2 - off * 0.5, c - D / 2 + off * 0.5)
    const txt = n > 99 ? '99+' : String(n)
    const r = D * 0.34
    ctx.font = `800 ${Math.round(r * 1.35)}px Manrope, system-ui, sans-serif`
    const w = Math.max(r * 2, ctx.measureText(txt).width + r)
    const px = Math.min(S - w / 2 - 2, c + D * 0.36)
    const py = Math.max(r + 2, c - D * 0.36)
    ctx.beginPath()
    ctx.roundRect(px - w / 2, py - r, w, r * 2, r)
    ctx.fillStyle = '#f3f0ff'
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = MAPC.land
    ctx.stroke()
    ctx.fillStyle = MAPC.land
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(txt, px, py + r * 0.06)
    this.map.addImage(name, ctx.getImageData(0, 0, S, S), { pixelRatio: 2 })
    return name
  }

  /** Badge image (tone circle + ui/icons glyph) → map.addImage. */
  private ensureBadge(icon: string, tone: MapTone, size: 'sm' | 'md'): Promise<void> {
    const name = `dk-ic-${icon}-${tone}-${size}`
    if (this.map.hasImage(name)) return Promise.resolve()
    const hit = this.iconLoads.get(name)
    if (hit) return hit
    const p = (async () => {
      const [fill, ink] = TONE_BADGE[tone]
      const pr = 2
      const D = ENGINE.badge[size] * pr
      const cv = document.createElement('canvas')
      cv.width = D
      cv.height = D
      const ctx = cv.getContext('2d')!
      ctx.beginPath()
      ctx.arc(D / 2, D / 2, D / 2 - pr, 0, Math.PI * 2)
      ctx.fillStyle = fill
      ctx.fill()
      ctx.lineWidth = 1.5 * pr
      ctx.strokeStyle = MAPC.land
      ctx.stroke()
      const svg = this.o.iconSvgs[icon] ?? this.o.iconSvgs.dot
      if (svg) {
        const src = svg.replace(/currentColor/g, ink).replace(/stroke-width="[\d.]+"/, 'stroke-width="2"')
        const im = new Image()
        im.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(src)}`
        try {
          await im.decode()
          const g = D * 0.62
          ctx.drawImage(im, (D - g) / 2, (D - g) / 2, g, g)
        } catch {
          /* glyph failed: plain badge */
        }
      }
      if (this.destroyed || this.map.hasImage(name)) return
      this.badgeCv.set(name, cv)
      this.map.addImage(name, ctx.getImageData(0, 0, D, D), { pixelRatio: pr })
    })()
    this.iconLoads.set(name, p)
    return p
  }

  private applyFlood(id: string, on: boolean, hour?: number): void {
    if (hour !== undefined && !this.dynamic.has(id)) this.hour = hour
    if (!on) {
      const d = this.dynamic.get(id)
      if (d) this.setVis(d.layers, false)
      if (this.flood) this.clearDesaFlood()
      return
    }
    if (!this.dynamic.has(id)) {
      // the grid depends on the bbox only (same as the model's); the model itself is built on the first wet hour
      const grid = makeGrid(this.pack!.bbox, FLOOD.gridW)
      const canvas = document.createElement('canvas')
      canvas.width = grid.w
      canvas.height = grid.h
      const ctx = canvas.getContext('2d')!
      const img = ctx.createImageData(grid.w, grid.h)
      const [W, S, E, N] = grid.bbox
      const src = `dk-flood-src-${id}`
      const lid = `dk-flood-${id}`
      this.flood = { model: null, canvas, ctx, img, lastH: -1, lastDesaKey: -1, layerId: lid }
      this.paintFloodNow(true)
      this.map.addSource(src, { type: 'canvas', canvas, animate: false, coordinates: [[W, N], [E, N], [E, S], [W, S]] })
      // under the boundaries so lines stay crisp on top of the water
      this.map.addLayer({ id: lid, type: 'raster', source: src, paint: { 'raster-opacity': 1, 'raster-resampling': 'linear', 'raster-fade-duration': 0 } }, 'dk-rivers-area')
      // affected desa 'light up' (share ≥ FLOOD_DESA_LIT): faint gold fill + outline, independent of the desa toggle
      const lit: ExpressionSpecification = ['>=', ['coalesce', ['feature-state', 'fl'], 0], ENGINE.desaLit]
      this.map.addLayer({ id: `${lid}-desa`, type: 'fill', source: IDS.desa, paint: { 'fill-color': MAPC.affected, 'fill-opacity': ['case', lit, 0.1, 0] } }, 'dk-rivers-area')
      this.map.addLayer({ id: `${lid}-desa-line`, type: 'line', source: IDS.desa, paint: { 'line-color': MAPC.affected, 'line-opacity': ['interpolate', ['linear'], ['zoom'], 9.5, ['case', lit, 0.22, 0], 11, ['case', lit, 0.65, 0]], 'line-width': ['interpolate', ['linear'], ['zoom'], 9.5, 0.6, 11, 1.2] } }, 'dk-rivers-area')
      this.dynamic.set(id, { kind: 'flood', layers: [lid, `${lid}-desa`, `${lid}-desa-line`], source: src })
    }
    this.setVis(this.dynamic.get(id)!.layers, true)
    // the hour may have moved while the layer was hidden (setTime only repaints a visible flood)
    this.paintFloodNow()
    this.updateDesaFlood(true)
  }

  private floodEntry() {
    return [...this.dynamic.entries()].find(([, d]) => d.kind === 'flood')
  }

  /** The flood model for the current geo: real desa once loaded, kecamatan polygons as the fallback before. */
  private floodModel(): FloodModel | null {
    const f = this.flood
    if (!f || !this.pack || !this.geo) return null
    return (f.model ??= buildFloodModel(this.pack, this.geo, 1))
  }

  private paintFloodNow(force = false): void {
    const f = this.flood
    if (!f) return
    if (!force && Math.abs(f.lastH - this.hour) < ENGINE.floodStep) return
    // hour 0 is dry everywhere (first water at FLOOD.startHour): no model needed, clear the canvas
    const wet = this.hour > 0
    if (!wet && f.lastH === 0) return
    f.lastH = this.hour
    if (wet) paintFlood(this.floodModel()!, this.hour, f.img.data)
    else f.img.data.fill(0)
    f.ctx.putImageData(f.img, 0, 0)
    const src = this.map.getSource(`dk-flood-src-${this.floodEntry()?.[0] ?? ''}`) as CanvasSource | undefined
    if (src) {
      // CanvasSource.pause() uploads the texture once while _playing is set: one upload per change, no loop
      src.play()
      src.pause()
    }
  }

  /** desa 'light up' by wet share — only with real desa (the kecamatan fallback has no desa features) */
  private updateDesaFlood(force = false): void {
    const f = this.flood
    if (!f || !this.hasDesa || !this.map.getSource(IDS.desa)) return
    const key = Math.floor(this.hour / ENGINE.desaStateStep)
    if (!force && key === f.lastDesaKey) return
    f.lastDesaKey = key
    if (this.hour <= 0 && !f.model) return // nothing wet yet and no state to clear
    const model = this.floodModel()!
    const shares = desaShares(model, this.hour)
    model.desa.forEach((d, i) => {
      const s = shares[i]!
      this.map.setFeatureState({ source: IDS.desa, id: d.id }, { fl: s })
    })
  }

  private clearDesaFlood(): void {
    const f = this.flood
    if (!f || !f.model || !this.hasDesa || !this.map.getSource(IDS.desa)) return
    for (const d of f.model.desa) this.map.setFeatureState({ source: IDS.desa, id: d.id }, { fl: 0 })
    f.lastDesaKey = -1
  }

  private applyRain(id: string, cells: RainCellInput[], on: boolean, animate: boolean): void {
    if (!this.dynamic.has(id)) {
      const layer = new RainLayer(`dk-rain-${id}`, cells, this.pack!.bbox)
      layer.hour = this.hour
      this.addDynamicLayer(id, layer as unknown as Parameters<MLMap['addLayer']>[0])
      this.dynamic.set(id, { kind: 'rain', layers: [layer.id] })
      this.rain = layer
    }
    const r = this.rain!
    r.cells = cells
    r.visible = on
    this.rainAnimate = animate && isEnabled('mapRain')
    this.map.triggerRepaint()
  }

  /* ---------------------------------------------------------------- time + animation loop */

  setTime(hours: number): void {
    this.hour = Math.max(0, Math.min(6, hours))
    if (this.rain) {
      this.rain.hour = this.hour
      if (!this.ticking) this.map.triggerRepaint()
    }
    const fl = this.floodEntry()
    if (this.flood && fl && this.isVisibleId(fl[0])) {
      this.paintFloodNow()
      this.updateDesaFlood()
    }
    this.checkDesa()
  }

  private isVisibleId(id: string): boolean {
    const s = this.specs.find((x) => x.id === id)
    return s ? this.isVisible(s) : false
  }

  setInView(v: boolean): void {
    this.inView = v
    this.updateLoop()
  }

  private updateLoop = (): void => {
    const want = !!this.rain && this.rain.visible && this.rainAnimate && this.inView && document.visibilityState === 'visible' && !this.destroyed
    if (want && !this.ticking) {
      this.ticking = true
      gsap.ticker.add(this.tick)
    } else if (!want && this.ticking) {
      this.ticking = false
      gsap.ticker.remove(this.tick)
    }
  }

  private tick = (_t: number, dt: number): void => {
    if (!this.rain) return
    // gsap deltaTime is ms; clamp so a long frame (tab switch) does not teleport cells
    this.ambient += Math.min(dt, 100) / 1000
    const cap = ENGINE.rainFps[getPerfTier()]
    const now = performance.now()
    if (cap > 0 && now - this.lastRainPaint < 1000 / cap - 1) return
    this.lastRainPaint = now
    this.rain.ambientSec = this.ambient
    this.map.triggerRepaint()
  }

  /* ---------------------------------------------------------------- camera */

  /**
   * fit padding that keeps the region clear of the corner control column (right; measured once it is rendered)
   * and the Sumber / attribution row (bottom)
   */
  private padding(extra = 0): { top: number; bottom: number; left: number; right: number } {
    const w = this.o.container.clientWidth
    const narrow = w < ENGINE.compactWidth
    const p = Math.round(Math.max(12, Math.min(56, w * 0.05))) + extra
    let ctrl = 0
    if (this.o.interactive) {
      const el = this.o.container.parentElement?.querySelector<HTMLElement>('.dk-map-ctrl')
      // column left edge → right edge of the frame, plus a gap; before it renders: 44 px buttons (narrow) / 32 px
      ctrl = (el && el.offsetWidth ? w - el.offsetLeft : narrow ? 62 : 50) + 14
    }
    return { top: p, left: p, right: Math.max(p, ctrl + extra), bottom: p + (narrow ? 28 : 12) }
  }

  fitRegion(durationS: number = ENGINE.flyDur): void {
    if (!this.pack) return
    const [W, S, E, N] = this.pack.bbox
    this.autoFit = true
    this.map.fitBounds([[W, S], [E, N]], { padding: this.padding(), duration: anim() ? durationS * 1000 : 0, essential: true })
  }

  fitKecamatan(id: string): void {
    const k = this.kecById.get(id)
    if (!k) return
    const [W, S, E, N] = k.bbox
    this.setSelected(id)
    this.autoFit = false
    this.map.fitBounds([[W, S], [E, N]], { padding: this.padding(24), maxZoom: ENGINE.kecMaxZoom, duration: anim() ? ENGINE.flyDur * 1000 : 0, essential: true })
  }

  flyTo(center: LngLat, zoom?: number): void {
    this.autoFit = false
    this.map.flyTo({ center, zoom: zoom ?? this.map.getZoom(), duration: anim() ? ENGINE.flyDur * 1000 : 0, essential: true })
  }

  setLayerVisible(layerId: string, visible: boolean): void {
    this.visibleOverride.set(layerId, visible)
    this.applySpecs()
  }

  setSelected(id: string | null): void {
    if (id === this.selected) return
    if (this.selected && this.map.getSource(IDS.kec)) this.map.setFeatureState({ source: IDS.kec, id: this.selected }, { sel: false })
    this.selected = id
    if (id && this.map.getSource(IDS.kec)) this.map.setFeatureState({ source: IDS.kec, id }, { sel: true })
    this.refreshLabelText()
    this.scheduleLabels()
  }

  highlight(id: string | null): void {
    this.highlighted = id
    this.setHover(id)
  }

  private setHover(id: string | null): void {
    if (id === this.hovered) return
    if (this.hovered && this.map.getSource(IDS.kec)) this.map.setFeatureState({ source: IDS.kec, id: this.hovered }, { hover: false })
    this.hovered = id
    if (id && this.map.getSource(IDS.kec)) this.map.setFeatureState({ source: IDS.kec, id }, { hover: true })
    for (const [kid, l] of this.kecLabels) l.el.classList.toggle('is-hover', kid === id)
    this.scheduleLabels()
  }

  private setHoverDesa(id: string | null): void {
    if (id === this.hoverDesa) return
    if (this.hoverDesa && this.map.getSource(IDS.desa)) this.map.setFeatureState({ source: IDS.desa, id: this.hoverDesa }, { hover: false })
    this.hoverDesa = id
    if (id && this.map.getSource(IDS.desa)) this.map.setFeatureState({ source: IDS.desa, id }, { hover: true })
  }

  setLang(lang: Lang): void {
    this.lang = lang
    if (this.choro) this.choro = { spec: this.choro.spec, r: resolveChoropleth(this.choro.spec, lang) }
    // the locale option is read once at construction — keep the attribution toggle's name in the UI language
    const tg = this.o.container.querySelector('.maplibregl-ctrl-attrib-button')
    if (tg) {
      tg.setAttribute('aria-label', ms('attribution', lang))
      tg.setAttribute('title', ms('attribution', lang))
    }
    this.refreshLabelText()
    this.scheduleLabels()
  }

  setCooperative(on: boolean): void {
    if (!this.o.interactive) return
    if (on) this.map.cooperativeGestures.enable()
    else this.map.cooperativeGestures.disable()
  }

  resize(): void {
    this.map.resize()
    // the frame changed size (layout settling, rotation, full screen): keep the whole region framed until the user moves
    if (this.autoFit && this.pack) this.fitRegion(0)
  }

  /* ---------------------------------------------------------------- pointer */

  private interactiveLayers(): string[] {
    const ids: string[] = []
    for (const [id, d] of this.dynamic) if (d.kind === 'markers' && this.isVisibleId(id)) ids.push(...d.layers)
    for (const l of ['dk-desa-fill', 'dk-kec-fill']) if (this.map.getLayer(l) && this.map.getLayoutProperty(l, 'visibility') !== 'none') ids.push(l)
    return ids.filter((l) => this.map.getLayer(l))
  }

  private onMove = (e: MapMouseEvent): void => {
    if (performance.now() < this.tipSticky) return
    this.pointAt(e, false)
  }

  private onOut = (): void => {
    this.setHover(this.highlighted)
    this.setHoverDesa(null)
    this.hideTip()
    this.map.getCanvas().style.cursor = ''
  }

  private onClick = (e: MapMouseEvent): void => {
    const hit = this.pointAt(e, true)
    const group = hit?.marker && this.groupOf(hit.marker.layer, hit.marker.id)
    if (group) this.zoomToGroup(group)
    else if (hit?.marker) this.o.callbacks.onMarker?.(hit.marker.layer, hit.marker.id)
    else this.o.callbacks.onSelect?.(hit?.kec ?? null)
    // touch: keep the tooltip readable for a moment
    this.tipSticky = performance.now() + 2500
  }

  private pointAt(e: MapMouseEvent, click: boolean): { kec?: string; marker?: { layer: string; id: string } } | null {
    const layers = this.interactiveLayers()
    if (!layers.length) return null
    const feats = this.map.queryRenderedFeatures(e.point, { layers })
    let kec: string | undefined
    let desa: string | undefined
    let marker: { layer: string; id: string } | undefined
    for (const f of feats) {
      const lid = f.layer.id
      const id = String(f.properties?.id ?? f.id ?? '')
      if (lid.startsWith('dk-mk-') && !marker) marker = { layer: lid.slice('dk-mk-'.length), id }
      else if (lid === 'dk-desa-fill' && !desa) desa = id
      else if (lid === 'dk-kec-fill' && !kec) kec = id
    }
    if (!kec && desa) kec = this.desa.find((d) => d.id === desa)?.kecamatanId
    this.setHover(kec ?? this.highlighted)
    this.setHoverDesa(desa ?? null)
    this.map.getCanvas().style.cursor = marker || kec ? 'pointer' : ''
    const lines: [string, string?][] = []
    if (marker) {
      const g = this.groupOf(marker.layer, marker.id)
      const m = this.markerItems.get(marker.layer)?.get(marker.id)
      if (g) {
        const names = g.items.slice(0, 3).map((x) => x.label)
        lines.push([`${fmt(g.items.length, this.lang)} ${ms('markersHere', this.lang)}`, `${names.join(', ')}${g.items.length > 3 ? ', …' : ''}`])
        lines.push([ms(this.o.cooperative ? 'clusterTap' : 'clusterClick', this.lang)])
      } else if (m) lines.push([m.label, m.detail])
    } else if (kec) {
      const k = this.kecById.get(kec)!
      lines.push([`${ms('kecamatan', this.lang)} ${k.name}`, this.valueText(kec, true)])
      if (desa) {
        const d = this.desa.find((x) => x.id === desa)
        if (d) {
          const fs = this.flood && this.map.getFeatureState({ source: IDS.desa, id: d.id }).fl
          lines.push([`${ms('desa', this.lang)} ${d.name}`, typeof fs === 'number' && fs > 0.005 ? `${fmt(fs * 100, this.lang)} % ${ms('flooded', this.lang)}` : undefined])
        }
      }
    }
    if (lines.length) this.showTip(e.point.x, e.point.y, lines)
    else this.hideTip()
    void click
    return { kec, marker }
  }

  /** the merged group behind a count badge ('#<index>' ids), else null */
  private groupOf(layer: string, id: string): MarkerGroup | null {
    if (!id.startsWith('#')) return null
    return this.markerGroups.get(layer)?.groups[Number(id.slice(1))] ?? null
  }

  /** click on a count badge: zoom in just far enough for its closest pair to separate, centred on the group */
  private zoomToGroup(g: MarkerGroup): void {
    const z0 = this.map.getZoom()
    const pts = g.items.map((m) => this.map.project(m.coord))
    let dmin = Infinity
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) dmin = Math.min(dmin, Math.hypot(pts[i]!.x - pts[j]!.x, pts[i]!.y - pts[j]!.y))
    const need = ENGINE.badge.md * 1.3
    const dz = dmin > 0 ? Math.log2(need / dmin) : Infinity
    const z = Math.min(ENGINE.clusterMaxZoom, Math.max(z0 + 1, z0 + dz))
    this.autoFit = false
    this.hideTip()
    this.map.easeTo({ center: g.coord, zoom: z, duration: anim() ? ENGINE.flyDur * 700 : 0, essential: true })
  }

  private valueText(kecId: string, long: boolean): string | undefined {
    const c = this.choro
    if (!c) return undefined
    if (c.r.hidden.has(kecId)) return long ? ms('hidden', this.lang) : '—'
    const v = c.spec.values[kecId]
    if (typeof v !== 'number') return long ? ms('noData', this.lang) : undefined
    const unit = long && c.spec.unit ? ` ${c.spec.unit[this.lang]}` : ''
    return `${c.r.format(v)}${unit}`
  }

  private showTip(x: number, y: number, lines: [string, string?][]): void {
    const tip = this.o.tipEl
    tip.replaceChildren(
      ...lines.flatMap(([a, b]) => {
        const out: HTMLElement[] = []
        const t = document.createElement('strong')
        t.textContent = a
        out.push(t)
        if (b) {
          const s = document.createElement('span')
          s.textContent = b
          out.push(s)
        }
        return out
      }),
    )
    tip.hidden = false
    const W = this.o.container.clientWidth
    const H = this.o.container.clientHeight
    const tw = tip.offsetWidth
    const th = tip.offsetHeight
    const tx = Math.max(8, Math.min(W - tw - 8, x + 14))
    const ty = y + 16 + th > H - 8 ? y - th - 12 : y + 16
    tip.style.transform = `translate3d(${tx}px, ${Math.max(8, ty)}px, 0)`
  }

  private hideTip(): void {
    this.o.tipEl.hidden = true
  }

  /* ---------------------------------------------------------------- HTML labels */

  private makeLabel(id: string, name: string, at: LngLat, cls: string, polys?: Poly[]): Label {
    const e = el('div', `dk-map-lbl ${cls}`, this.o.labelsEl)
    e.setAttribute('aria-hidden', 'true')
    const n = el('span', 'dk-map-lbl-n', e)
    n.textContent = name
    const v = el('span', 'dk-map-lbl-v', e)
    return { id, el: e, name: n, val: v, at, polys, w: 0, h: 0, shown: false }
  }

  private buildLabels(): void {
    for (const l of [...this.kecLabels.values(), ...this.desaLabels.values()]) l.el.remove()
    this.kecLabels.clear()
    this.desaLabels.clear()
    // anchor at the pole of inaccessibility, not the centroid: thin / bent kecamatan keep their label inside
    for (const k of this.kec) this.kecLabels.set(k.id, this.makeLabel(k.id, k.name, labelPoint(k.polys), 'is-kec', k.polys))
    this.refreshLabelText()
  }

  private kecSpec() {
    return this.specs.find((s): s is Extract<MapLayer, { kind: 'kecamatan' }> => s.kind === 'kecamatan' && this.isVisible(s))
  }

  private refreshLabelText(): void {
    const compact = this.o.container.clientWidth < ENGINE.compactWidth
    const mode = this.kecSpec()?.labels ?? 'name+value'
    for (const [id, l] of this.kecLabels) {
      const showVal = mode === 'name+value' && (!compact || id === this.selected)
      const v = showVal ? this.valueText(id, false) : undefined
      l.val.textContent = v ?? ''
      l.val.hidden = !v
      // ink follows the fill under the label (dark text on light classes)
      const c = this.choro
      const cls = c && !c.r.hidden.has(id) ? c.r.classOf[id] : undefined
      // the selected label sits on its own dark pill, so it always takes the light ink
      const ink = labelInk(cls !== undefined && id !== this.selected ? c!.r.colors[cls]! : null)
      l.el.style.setProperty('--lbl-ink', ink.color)
      l.el.style.setProperty('--lbl-halo', ink.halo)
      l.el.classList.toggle('is-sel', id === this.selected)
      l.w = 0
      l.fit = undefined
    }
    // marker layers may have changed: desa placements are re-checked too
    for (const l of this.desaLabels.values()) l.fit = undefined
  }

  /** Visible marker badges as screen circles [x, y, r] (labels keep clear of them). */
  private markerObstacles(z: number): [number, number, number][] {
    const out: [number, number, number][] = []
    const k = badgeScale(z)
    for (const s of this.specs) {
      if (s.kind !== 'markers' || !this.isVisible(s)) continue
      const r = (ENGINE.badge[s.size ?? 'md'] / 2) * k
      // the drawn groups (a count badge is wider); before the first grouping, every item
      const groups = this.markerGroups.get(s.id)?.groups ?? s.items.map((m) => ({ coord: m.coord, items: [m] }))
      for (const g of groups) {
        const p = this.map.project(g.coord)
        out.push([p.x, p.y, (g.items.length > 1 ? r * 1.35 : r) + ENGINE.labelMarkerPad])
      }
    }
    return out
  }

  /**
   * Where a label goes at this zoom: the first candidate offset that keeps it clear of marker badges and (for
   * kecamatan) fully inside its own polygon; failing that, the first one clear of badges; failing that, the
   * anchor, flagged `blocked` (shown only when selected / hovered). Pan-invariant (no rotation / pitch), so it is cached per zoom bucket and only redone on zoom.
   */
  private fitLabel(l: Label, ax: number, ay: number, z: number, obst: () => [number, number, number][]): NonNullable<Label['fit']> {
    const zb = Math.round(z * 20)
    if (l.fit && l.fit.z === zb) return l.fit
    const { w, h } = l
    const inset = 2
    const inside = (cx: number, cy: number): boolean => {
      if (!l.polys) return true
      const xs = [cx - w / 2 + inset, cx, cx + w / 2 - inset]
      const ys = [cy - h / 2 + inset, cy + h / 2 - inset]
      for (const x of xs) for (const y of ys) if (!pointInPolys(this.map.unproject([x, y]).toArray() as LngLat, l.polys)) return false
      return true
    }
    const clear = (cx: number, cy: number): boolean => {
      for (const [mx, my, r] of obst()) {
        const nx = Math.max(cx - w / 2, Math.min(mx, cx + w / 2)) - mx
        const ny = Math.max(cy - h / 2, Math.min(my, cy + h / 2)) - my
        if (nx * nx + ny * ny < r * r) return false
      }
      return true
    }
    type Fit = { dx: number; dy: number; out: boolean; blocked: boolean }
    let pick: Fit | null = null
    let clearOnly: Fit | null = null
    for (const [fx, fy] of LABEL_TRIES) {
      const dx = Math.round(fx * w)
      const dy = Math.round(fy * (h + 2))
      if (!clear(ax + dx, ay + dy)) continue
      const inn = inside(ax + dx, ay + dy)
      if (inn) {
        pick = { dx, dy, out: false, blocked: false }
        break
      }
      clearOnly ??= { dx, dy, out: true, blocked: false }
    }
    const fit = { z: zb, ...(pick ?? clearOnly ?? { dx: 0, dy: 0, out: !inside(ax, ay), blocked: true }) }
    l.fit = fit
    return fit
  }

  private scheduleLabels = (): void => {
    if (this.labelRaf) return
    this.labelRaf = requestAnimationFrame(() => {
      this.labelRaf = 0
      this.placeLabels()
    })
  }

  private placeLabels(): void {
    if (this.destroyed || !this.pack) return
    const z = this.map.getZoom()
    const kecSpec = this.kecSpec()
    const desaOn = this.specs.some((s) => s.kind === 'desa' && this.isVisible(s))
    const showKec = !!kecSpec && kecSpec.labels !== 'none' && z < ENGINE.desaLabelZoom
    const showDesa = desaOn && z >= ENGINE.desaLabelZoom
    const W = this.o.container.clientWidth
    const H = this.o.container.clientHeight
    const cands: { l: Label; x: number; y: number; prio: number }[] = []
    let obstacles: [number, number, number][] | null = null
    const obst = () => (obstacles ??= this.markerObstacles(z))
    const consider = (l: Label, prio: number) => {
      const p = this.map.project(l.at)
      if (p.x < -60 || p.y < -20 || p.x > W + 60 || p.y > H + 20) return
      cands.push({ l, x: p.x, y: p.y, prio })
    }
    if (showKec)
      for (const [id, l] of this.kecLabels) {
        const k = this.kecById.get(id)!
        const v = this.choro?.spec.values[id]
        consider(l, (id === this.selected ? 1e12 : 0) + (id === this.hovered ? 1e11 : 0) + (typeof v === 'number' ? v * 1e6 : 0) + k.population)
      }
    if (showDesa) {
      const b = this.map.getBounds()
      for (const d of this.desa) {
        if (!b.contains(d.centroid)) continue
        let l = this.desaLabels.get(d.id)
        if (!l) {
          l = this.makeLabel(d.id, d.name, d.centroid, 'is-desa')
          this.desaLabels.set(d.id, l)
        }
        consider(l, (d.kecamatanId === this.selected ? 1e6 : 0) + (d.id === this.hoverDesa ? 1e9 : 0) - d.name.length)
      }
    }
    // measure new / changed labels once (batched read)
    for (const c of cands) if (!c.l.w) {
      c.l.el.style.visibility = 'hidden'
      c.l.el.style.display = ''
    }
    for (const c of cands) if (!c.l.w) {
      c.l.w = c.l.el.offsetWidth
      c.l.h = c.l.el.offsetHeight
      c.l.fit = undefined
    }
    // move each label off marker badges / back inside its polygon (cached per zoom bucket)
    // a label with no spot clear of the badges is dropped (the list / tooltip still name it) unless it is the
    // selected or hovered one
    for (let i = cands.length - 1; i >= 0; i--) {
      const c = cands[i]!
      const f = this.fitLabel(c.l, c.x, c.y, z, obst)
      if (f.blocked && c.l.id !== this.selected && c.l.id !== this.hovered && c.l.id !== this.hoverDesa) {
        cands.splice(i, 1)
        continue
      }
      c.x += f.dx
      c.y += f.dy
      c.l.el.classList.toggle('is-out', f.out)
    }
    cands.sort((a, b) => b.prio - a.prio)
    const placed: [number, number, number, number][] = []
    const pad = ENGINE.labelPad
    const shown = new Set<Label>()
    for (const c of cands) {
      const x0 = c.x - c.l.w / 2 - pad
      const y0 = c.y - c.l.h / 2 - pad
      const x1 = c.x + c.l.w / 2 + pad
      const y1 = c.y + c.l.h / 2 + pad
      // a label cut by the frame edge is unreadable: drop it until it is fully in view
      if (x0 + pad < 0 || y0 + pad < 0 || x1 - pad > W || y1 - pad > H) continue
      if (placed.some((p) => x0 < p[2] && x1 > p[0] && y0 < p[3] && y1 > p[1])) continue
      placed.push([x0, y0, x1, y1])
      shown.add(c.l)
      c.l.el.style.transform = `translate3d(${Math.round(c.x - c.l.w / 2)}px, ${Math.round(c.y - c.l.h / 2)}px, 0)`
    }
    for (const l of [...this.kecLabels.values(), ...this.desaLabels.values()]) {
      const on = shown.has(l)
      if (on !== l.shown || l.el.style.visibility === 'hidden') {
        l.el.style.visibility = on ? 'visible' : 'hidden'
        l.shown = on
      }
    }
  }

  /* ---------------------------------------------------------------- teardown */

  destroy(): void {
    this.destroyed = true
    if (this.ticking) gsap.ticker.remove(this.tick)
    this.ticking = false
    document.removeEventListener('visibilitychange', this.updateLoop)
    if (this.labelRaf) cancelAnimationFrame(this.labelRaf)
    window.clearInterval(this.fpsTimer)
    for (const l of [...this.kecLabels.values(), ...this.desaLabels.values()]) l.el.remove()
    this.map.remove()
  }
}
