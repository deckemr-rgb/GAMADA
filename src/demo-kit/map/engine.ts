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
import { buildFloodModel, desaShares, paintFlood, type FloodModel } from './flood'
import { bboxOfPolys, centroidOf, outerRings, polysOf, type BBox, type Poly, type Ring } from './geo'
import { HEAT_RAMP, labelInk, MAPC, TONE_BADGE } from './palette'
import { defaultRainField } from './rain'
import { RainLayer } from './rainLayer'
import { fmt, ms } from './strings'
import type { ChoroplethLayer, LngLat, MapLayer, MapTone, MarkerItem, RainCellInput } from './types'

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
  /** below this container width labels show names only (value for the selected one) */
  compactWidth: 640,
  /** label collision padding (px) */
  labelPad: 4,
  /** rain repaint cap per tier (fps); high = every ticker frame */
  rainFps: { high: 0, mid: DEMO.rainFpsMid, low: 20 },
  /** flood raster/desa states are recomputed when the hour moves by this much */
  floodStep: 0.03,
  desaStateStep: 0.25,
  /** a desa lights up once this share of it is under water (feature-state fl = share) */
  desaLit: 0.25,
  /** marker badge diameter (css px) */
  badge: { md: 24, sm: 18 },
} as const

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
  w: number
  h: number
  shown: boolean
}

const anim = () => isEnabled('demoAnimations')

/* ------------------------------------------------------------------ helpers */

function ringArea(r: Ring): number {
  let a = 0
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j]![0] - r[i]![0]) * (r[j]![1] + r[i]![1])
  return a / 2
}

function fc(features: Feature[]): FeatureCollection {
  return { type: 'FeatureCollection', features }
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
  private flood: { model: FloodModel; canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; img: ImageData; lastH: number; lastDesaKey: number; layerId: string } | null = null
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
        'AttributionControl.ToggleAttribution': ms('sources', L),
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
    this.geo = geo
    this.kec = geo.kecamatan.features.map((f) => {
      const id = String(f.properties?.id ?? f.id)
      const pk = pack.kecamatan.find((k) => k.id === id)
      const polys = polysOf(f.geometry)
      return { id, name: pk?.name ?? String(f.properties?.name ?? id), centroid: pk?.centroid ?? centroidOf(polys), polys, bbox: bboxOfPolys(polys), population: pk?.population ?? 0 }
    })
    this.kecById = new Map(this.kec.map((k) => [k.id, k]))
    const packDesa = new Map(pack.kecamatan.flatMap((k) => k.desa.map((d) => [d.id, d] as const)))
    this.desa = (geo.desa?.features ?? []).map((f) => {
      const id = String(f.properties?.id ?? f.id)
      const pd = packDesa.get(id)
      return { id, name: pd?.name ?? String(f.properties?.name ?? id), kecamatanId: String(f.properties?.kecamatanId ?? ''), centroid: pd?.centroid ?? centroidOf(polysOf(f.geometry)) }
    })
    this.flood = null
    this.installRegionLayers()
    this.buildLabels()
    this.applySpecs()
    this.fitRegion(had && animate ? ENGINE.regionInDur : 0)
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

    const withId = (f: Feature) => ({ ...f, properties: { ...(f.properties ?? {}), id: String(f.properties?.id ?? f.id) } }) as Feature
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
    }
    this.updateLoop()
    this.refreshLabelText()
    this.scheduleLabels()
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
    const img = (m: MarkerItem) => `dk-ic-${m.icon}-${m.tone ?? 'neutral'}-${size}`
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
    const data = fc(items.map((m) => ({ type: 'Feature', id: m.id, properties: { id: m.id, img: img(m), pr: m.tone === 'danger' ? 3 : m.tone === 'warn' ? 2 : 1 }, geometry: { type: 'Point', coordinates: m.coord } })))
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
      const model = buildFloodModel(this.pack!, this.geo!, 1)
      const canvas = document.createElement('canvas')
      canvas.width = model.grid.w
      canvas.height = model.grid.h
      const ctx = canvas.getContext('2d')!
      const img = ctx.createImageData(model.grid.w, model.grid.h)
      const [W, S, E, N] = model.grid.bbox
      const src = `dk-flood-src-${id}`
      const lid = `dk-flood-${id}`
      this.flood = { model, canvas, ctx, img, lastH: -1, lastDesaKey: -1, layerId: lid }
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
    this.updateDesaFlood(true)
  }

  private paintFloodNow(force = false): void {
    const f = this.flood
    if (!f) return
    if (!force && Math.abs(f.lastH - this.hour) < ENGINE.floodStep) return
    f.lastH = this.hour
    paintFlood(f.model, this.hour, f.img.data)
    f.ctx.putImageData(f.img, 0, 0)
    const src = this.map.getSource(`dk-flood-src-${[...this.dynamic].find(([, d]) => d.kind === 'flood')?.[0] ?? ''}`) as CanvasSource | undefined
    if (src) {
      // CanvasSource.pause() uploads the texture once while _playing is set: one upload per change, no loop
      src.play()
      src.pause()
    }
  }

  private updateDesaFlood(force = false): void {
    const f = this.flood
    if (!f || !this.map.getSource(IDS.desa)) return
    const key = Math.floor(this.hour / ENGINE.desaStateStep)
    if (!force && key === f.lastDesaKey) return
    f.lastDesaKey = key
    const shares = desaShares(f.model, this.hour)
    f.model.desa.forEach((d, i) => {
      const s = shares[i]!
      this.map.setFeatureState({ source: IDS.desa, id: d.id }, { fl: s })
    })
  }

  private clearDesaFlood(): void {
    if (!this.flood || !this.map.getSource(IDS.desa)) return
    for (const d of this.flood.model.desa) this.map.setFeatureState({ source: IDS.desa, id: d.id }, { fl: 0 })
    this.flood.lastDesaKey = -1
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
    const fl = [...this.dynamic.entries()].find(([, d]) => d.kind === 'flood')
    if (this.flood && fl && this.isVisibleId(fl[0])) {
      this.paintFloodNow()
      this.updateDesaFlood()
    }
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

  /** fit padding that keeps the region clear of the corner controls (right) and the Sumber / attribution row (bottom) */
  private padding(extra = 0): { top: number; bottom: number; left: number; right: number } {
    const w = this.o.container.clientWidth
    const p = Math.round(Math.max(12, Math.min(56, w * 0.05))) + extra
    const ctrl = this.o.interactive ? (w < ENGINE.compactWidth ? 56 : 48) : 0
    return { top: p, left: p, right: p + ctrl, bottom: p + (w < ENGINE.compactWidth ? 28 : 12) }
  }

  fitRegion(durationS: number = ENGINE.flyDur): void {
    if (!this.pack) return
    const [W, S, E, N] = this.pack.bbox
    this.map.fitBounds([[W, S], [E, N]], { padding: this.padding(), duration: anim() ? durationS * 1000 : 0, essential: true })
  }

  fitKecamatan(id: string): void {
    const k = this.kecById.get(id)
    if (!k) return
    const [W, S, E, N] = k.bbox
    this.setSelected(id)
    this.map.fitBounds([[W, S], [E, N]], { padding: this.padding(24), maxZoom: ENGINE.kecMaxZoom, duration: anim() ? ENGINE.flyDur * 1000 : 0, essential: true })
  }

  flyTo(center: LngLat, zoom?: number): void {
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
    if (hit?.marker) this.o.callbacks.onMarker?.(hit.marker.layer, hit.marker.id)
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
      const m = this.markerItems.get(marker.layer)?.get(marker.id)
      if (m) lines.push([m.label, m.detail])
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

  private makeLabel(id: string, name: string, at: LngLat, cls: string): Label {
    const e = el('div', `dk-map-lbl ${cls}`, this.o.labelsEl)
    e.setAttribute('aria-hidden', 'true')
    const n = el('span', 'dk-map-lbl-n', e)
    n.textContent = name
    const v = el('span', 'dk-map-lbl-v', e)
    return { id, el: e, name: n, val: v, at, w: 0, h: 0, shown: false }
  }

  private buildLabels(): void {
    for (const l of [...this.kecLabels.values(), ...this.desaLabels.values()]) l.el.remove()
    this.kecLabels.clear()
    this.desaLabels.clear()
    for (const k of this.kec) this.kecLabels.set(k.id, this.makeLabel(k.id, k.name, k.centroid, 'is-kec'))
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
      const ink = labelInk(cls !== undefined ? c!.r.colors[cls]! : null)
      l.el.style.setProperty('--lbl-ink', ink.color)
      l.el.style.setProperty('--lbl-halo', ink.halo)
      l.el.classList.toggle('is-sel', id === this.selected)
      l.w = 0
    }
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
