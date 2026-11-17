/**
 * siaga-wilayah/imagery.ts — "Citra satelit (simulasi)": a PROCEDURAL satellite-like rendering of the real region
 * (owner decision: no real satellite provider). Loaded lazily, the first time the imagery layer or the Lingkungan
 * comparator is used.
 *
 * Land cover comes from the real kecamatan polygons (pack flood / landslide risk steer rice paddies vs teak forest),
 * seeded value noise and a rotated paddy-parcel grid; the real rivers, reservoirs and roads are stroked on top and
 * village settlements (roofs + home gardens) are scattered around the real desa centroids. The "after" variant
 * applies the SIMULATED land-use changes of sites.ts. Every view that shows it says "simulasi".
 *
 * The region picture is painted in row slices (no long task) into a canvas that the map shows as a MapLibre canvas
 * source under the boundaries (layer id `sw-img`, added through MapViewHandle.raw()).
 */
import type { RegionGeo, RegionPack } from '../../demo-kit/region/types'
import type { ChangeSite, LngLat } from './sites'

export type Variant = 'before' | 'after'

/* ------------------------------------------------------------------ constants (module-local) */
const IMG = {
  /** region canvas width (px) on fine pointers / coarse pointers */
  width: 1600,
  widthCoarse: 1100,
  /** kecamatan lookup raster width (px) */
  lookupW: 900,
  /** rows painted per slice before yielding */
  rowsPerSlice: 90,
  /** raster opacity of the map layer */
  opacity: 0.94,
} as const

/* ------------------------------------------------------------------ noise */
function h2(x: number, y: number, s: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}
function vnoise(x: number, y: number, s: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const a = h2(xi, yi, s)
  const b = h2(xi + 1, yi, s)
  const c = h2(xi, yi + 1, s)
  const d = h2(xi + 1, yi + 1, s)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
const fbm = (x: number, y: number, s: number) => vnoise(x, y, s) * 0.62 + vnoise(x * 2.3, y * 2.3, s + 17) * 0.38
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ------------------------------------------------------------------ painter context */
type Ring = LngLat[]
interface KecAttr {
  rf: number
  rl: number
  ang: number
  town: boolean
}
interface Ctx {
  bbox: [number, number, number, number]
  kx: number
  ky: number
  polys: { k: number; rings: Ring[] }[]
  attrs: KecAttr[]
  lookup: Uint8Array
  lw: number
  lh: number
  rivers: { w: number; line: LngLat[] }[]
  lakes: Ring[][]
  roads: { w: number; line: LngLat[] }[]
  villages: { c: LngLat; town: boolean; seed: number }[]
  sites: ChangeSite[]
}

function polysOf(geom: { type: string; coordinates: unknown }): Ring[][] {
  if (geom.type === 'Polygon') return [geom.coordinates as Ring[]]
  if (geom.type === 'MultiPolygon') return geom.coordinates as Ring[][]
  return []
}
function linesOf(geom: { type: string; coordinates: unknown }): LngLat[][] {
  if (geom.type === 'LineString') return [geom.coordinates as LngLat[]]
  if (geom.type === 'MultiLineString') return geom.coordinates as LngLat[][]
  return []
}

const ctxCache = new WeakMap<RegionGeo, Ctx>()

/** Build (once per geo) the painter context: lookup raster, attributes, vector features, villages. */
export function painterContext(pack: RegionPack, geo: RegionGeo, desa: { kecamatanId: string; centroid: LngLat }[], sites: ChangeSite[]): Ctx {
  const hit = ctxCache.get(geo)
  if (hit) {
    hit.sites = sites
    return hit
  }
  const bbox = pack.bbox as [number, number, number, number]
  const [W, S, E, N] = bbox
  const lat0 = (S + N) / 2
  const kx = 111.32 * Math.cos((lat0 * Math.PI) / 180)
  const ky = 110.57
  const capital = [...pack.kecamatan].sort((a, b) => b.population - a.population)[0]?.id
  const attrs: KecAttr[] = [{ rf: 0.35, rl: 0.15, ang: 0.2, town: false }]
  const index = new Map<string, number>()
  pack.kecamatan.forEach((k, i) => {
    index.set(k.id, i + 1)
    attrs.push({ rf: k.riskFlood, rl: k.riskLandslide, ang: (h2(i, 7, 3) - 0.5) * 1.1, town: k.id === capital })
  })
  const polys = geo.kecamatan.features.map((f) => ({ k: index.get(String((f.properties as { id?: string })?.id)) ?? 0, rings: polysOf(f.geometry as { type: string; coordinates: unknown }).flat() }))

  // kecamatan lookup raster (R channel = index, edges dropped by the alpha test)
  const lw = IMG.lookupW
  const lh = Math.max(1, Math.round((lw * ((N - S) * ky)) / ((E - W) * kx)))
  const lookup = new Uint8Array(lw * lh)
  const cv = document.createElement('canvas')
  cv.width = lw
  cv.height = lh
  const g = cv.getContext('2d', { willReadFrequently: true })
  if (g) {
    for (const p of polys) {
      if (!p.k) continue
      g.fillStyle = `rgb(${p.k},0,0)`
      g.beginPath()
      for (const r of p.rings) r.forEach((c, i) => (i ? g.lineTo : g.moveTo).call(g, ((c[0] - W) / (E - W)) * lw, ((N - c[1]) / (N - S)) * lh))
      g.fill('evenodd')
    }
    const d = g.getImageData(0, 0, lw, lh).data
    for (let i = 0; i < lw * lh; i++) lookup[i] = d[i * 4 + 3]! > 200 ? d[i * 4]! : 0
  }

  const rivers: Ctx['rivers'] = []
  const lakes: Ctx['lakes'] = []
  for (const f of geo.rivers.features) {
    const p = (f.properties ?? {}) as { main?: boolean; kind?: string }
    const gm = f.geometry as { type: string; coordinates: unknown }
    if (gm.type === 'Polygon' || gm.type === 'MultiPolygon') lakes.push(...polysOf(gm))
    const w = p.main ? 0.16 : p.kind === 'stream' ? 0.012 : 0.04
    for (const l of linesOf(gm)) rivers.push({ w, line: l })
  }
  const roads: Ctx['roads'] = []
  for (const f of geo.roads?.features ?? []) {
    const c = (f.properties as { class?: string })?.class
    const w = c === 'trunk' ? 0.026 : c === 'primary' ? 0.02 : 0.013
    for (const l of linesOf(f.geometry as { type: string; coordinates: unknown })) roads.push({ w, line: l })
  }
  const villages = desa.map((d, i) => ({ c: d.centroid, town: d.kecamatanId === capital, seed: i * 7919 + 13 }))
  const ctx: Ctx = { bbox, kx, ky, polys, attrs, lookup, lw, lh, rivers, lakes, roads, villages, sites }
  ctxCache.set(geo, ctx)
  return ctx
}

/* ------------------------------------------------------------------ land cover (per pixel) */
type RGB = [number, number, number]
const out: RGB = [0, 0, 0]
function set(r: number, g: number, b: number): RGB {
  out[0] = r
  out[1] = g
  out[2] = b
  return out
}

/** colour of one ground point (X, Y in km from the bbox SW corner) */
function ground(c: Ctx, X: number, Y: number, lon: number, lat: number, variant: Variant): RGB {
  const [W, S, E, N] = c.bbox
  // the district lookup is sampled with a noisy offset (±≈ 0.7 km) so class borders along district lines look organic
  const jx = (vnoise(X / 0.9, Y / 0.9, 5) - 0.5) * 1.4
  const jy = (vnoise(X / 0.9, Y / 0.9, 9) - 0.5) * 1.4
  const li = Math.min(c.lw - 1, Math.max(0, Math.floor(((lon + jx / c.kx - W) / (E - W)) * c.lw)))
  const lj = Math.min(c.lh - 1, Math.max(0, Math.floor(((N - lat - jy / c.ky) / (N - S)) * c.lh)))
  const k = c.lookup[lj * c.lw + li] ?? 0
  const a = c.attrs[k] ?? c.attrs[0]!
  const n1 = fbm(X / 7, Y / 7, 11)
  const n2 = vnoise(X / 1.1, Y / 1.1, 23)
  const n3 = vnoise(X / 0.085, Y / 0.085, 31)

  // forced class inside a change site (before = original use, after = the change)
  let forced: 'paddy' | 'forest' | 'dry' | 'bank' | null = null
  for (const s of c.sites) {
    const dx = (lon - s.center[0]) * c.kx
    const dy = (lat - s.center[1]) * c.ky
    const d = Math.sqrt(dx * dx + dy * dy)
    const r = s.radiusKm * (0.8 + 0.4 * vnoise(X / 0.35, Y / 0.35, 41))
    if (d > r) continue
    if (variant === 'after') return changed(s, X, Y, n2, n3, d / r)
    forced = s.kind === 'permukiman' ? 'paddy' : s.kind === 'hutan' ? 'forest' : s.kind === 'industri' ? 'dry' : 'bank'
    break
  }

  const forestW = a.rl * 1.7 + (n1 - 0.5) * 1.1 + (1 - a.rf) * 0.35 - 0.42
  const paddyW = a.rf * 1.15 + (0.5 - n1) * 0.7 + (a.town ? -0.1 : 0.08)
  const dryW = 0.34 + (n2 - 0.5) * 0.5
  const cls = forced ?? (forestW > paddyW && forestW > dryW ? 'forest' : paddyW > dryW ? 'paddy' : 'dry')

  if (cls === 'forest' || cls === 'bank') {
    const t = 0.78 + 0.42 * n3 + 0.12 * (n2 - 0.5)
    return cls === 'bank' ? set(52 * t, 78 * t, 46 * t) : set(30 * t, 54 * t, 31 * t)
  }
  // rotated parcel grid (rice: small parcels; dry fields: bigger)
  const u = X * Math.cos(a.ang) + Y * Math.sin(a.ang)
  const v = -X * Math.sin(a.ang) + Y * Math.cos(a.ang)
  if (cls === 'paddy') {
    const pu = 0.11
    const pv = 0.072
    const cu = Math.floor(u / pu)
    const cv = Math.floor(v / pv)
    const st = h2(cu >> 1, cv, k + 7) * 0.7 + n2 * 0.3
    const fu = u / pu - cu
    const fv = v / pv - cv
    const bund = fu < 0.06 || fv < 0.08 ? 0.82 : 1
    const j = 0.92 + 0.16 * n3
    const m = bund * j
    if (st < 0.34) return set(56 * m, 82 * m, 78 * m) // flooded, newly planted (rainy season)
    if (st < 0.66) return set(78 * m, 118 * m, 50 * m)
    if (st < 0.86) return set(112 * m, 134 * m, 56 * m)
    return set(118 * m, 102 * m, 70 * m) // harvested
  }
  const pu = 0.24
  const cu = Math.floor(u / pu)
  const cv = Math.floor(v / (pu * 0.7))
  const st = h2(cu, cv, k + 19)
  const m = 0.9 + 0.2 * n3
  if (st < 0.25) return set(134 * m, 112 * m, 82 * m)
  if (st < 0.6) return set(110 * m, 110 * m, 66 * m)
  return set(86 * m, 104 * m, 56 * m)
}

/** the SIMULATED "after" land cover inside a change site */
function changed(s: ChangeSite, X: number, Y: number, n2: number, n3: number, rel: number): RGB {
  const m = 0.9 + 0.2 * n3
  switch (s.kind) {
    case 'tambang': {
      const pit = vnoise(X / 0.07, Y / 0.07, 53)
      if (pit > 0.6 && rel < 0.9) return set(58, 92, 94)
      return pit > 0.45 ? set(150 * m, 134 * m, 98 * m) : set(190 * m, 174 * m, 132 * m)
    }
    case 'hutan':
      return n3 > 0.82 ? set(34, 58, 33) : set(148 * m, 106 * m, 74 * m)
    case 'permukiman': {
      const lu = 0.012
      const lv = 0.018
      const cu = Math.floor(X / lu)
      const cv = Math.floor(Y / lv)
      if (cu % 9 === 0 || cv % 7 === 0) return set(196, 190, 178) // streets
      const r = h2(cu, cv, 61)
      const fu = X / lu - cu
      if (fu > 0.86) return set(92, 112, 70) // yards
      return r < 0.55 ? set(172 * m, 84 * m, 58 * m) : r < 0.8 ? set(150 * m, 74 * m, 54 * m) : set(160 * m, 156 * m, 150 * m)
    }
    case 'industri': {
      const cu = Math.floor(X / 0.06)
      const cv = Math.floor(Y / 0.04)
      const r = h2(cu, cv, 71)
      if (r < 0.42) return set(208 * m, 208 * m, 202 * m)
      if (r < 0.62) return set(172 * m, 178 * m, 184 * m)
      return n2 > 0.5 ? set(116, 112, 104) : set(178, 166, 142)
    }
  }
}

/* ------------------------------------------------------------------ painting */
export interface View {
  /** [west, south, east, north] */
  bbox: [number, number, number, number]
  w: number
  h: number
}

const yieldFrame = () => new Promise<void>((r) => setTimeout(r, 0))

/** Paint a view (region or crop) into a canvas; yields between row slices. */
export async function paint(c: Ctx, view: View, variant: Variant, signal?: { cancelled: boolean }): Promise<HTMLCanvasElement | null> {
  const { w, h } = view
  const [W, S, E, N] = view.bbox
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const g = cv.getContext('2d')
  if (!g) return null
  const img = g.createImageData(w, h)
  const px = img.data
  const [RW, RS] = c.bbox
  for (let y0 = 0; y0 < h; y0 += IMG.rowsPerSlice) {
    const y1 = Math.min(h, y0 + IMG.rowsPerSlice)
    for (let y = y0; y < y1; y++) {
      const lat = N - ((y + 0.5) / h) * (N - S)
      const Y = (lat - RS) * c.ky
      for (let x = 0; x < w; x++) {
        const lon = W + ((x + 0.5) / w) * (E - W)
        const col = ground(c, (lon - RW) * c.kx, Y, lon, lat, variant)
        const i = (y * w + x) * 4
        px[i] = col[0]
        px[i + 1] = col[1]
        px[i + 2] = col[2]
        px[i + 3] = 255
      }
    }
    if (h > IMG.rowsPerSlice) {
      await yieldFrame()
      if (signal?.cancelled) return null
    }
  }
  g.putImageData(img, 0, 0)

  // vectors: lon/lat → px
  const sx = w / (E - W)
  const sy = h / (N - S)
  const kmPx = w / ((E - W) * c.kx)
  const P = (p: LngLat): [number, number] => [(p[0] - W) * sx, (N - p[1]) * sy]
  const inView = (p: LngLat, padKm: number) => p[0] > W - padKm / c.kx && p[0] < E + padKm / c.kx && p[1] > S - padKm / c.ky && p[1] < N + padKm / c.ky

  // villages: home-garden trees, then roofs (both deterministic per desa)
  for (const v of c.villages) {
    const spread = v.town ? 0.55 : 0.2
    if (!inView(v.c, spread * 4)) continue
    const r = rng(v.seed)
    const n = v.town ? 260 : 70
    const gauss = () => (r() + r() + r() - 1.5) * spread * 1.4
    const pts: [number, number][] = []
    for (let i = 0; i < n; i++) pts.push([v.c[0] + gauss() / c.kx, v.c[1] + gauss() / c.ky])
    g.globalAlpha = 0.8
    g.fillStyle = 'rgb(34,60,34)'
    for (const p of pts) {
      if (variant === 'after' && inSite(c, p)) continue
      const [x, y] = P(p)
      const rad = Math.max(0.5, 0.012 * kmPx)
      g.beginPath()
      g.arc(x + 0.009 * kmPx, y + 0.006 * kmPx, rad, 0, Math.PI * 2)
      g.fill()
    }
    g.globalAlpha = 0.9
    for (const p of pts) {
      if (variant === 'after' && inSite(c, p)) continue
      const [x, y] = P(p)
      const t = r()
      g.fillStyle = t < 0.55 ? 'rgb(164,82,58)' : t < 0.8 ? 'rgb(142,72,52)' : 'rgb(150,146,140)'
      const s = Math.max(0.6, 0.011 * kmPx)
      g.fillRect(x - s / 2, y - s / 2, s, s * 1.3)
    }
  }
  g.globalAlpha = 1

  // roads, rivers, reservoirs
  const stroke = (line: LngLat[], wKm: number, color: string, alpha: number, min: number) => {
    g.globalAlpha = alpha
    g.strokeStyle = color
    g.lineWidth = Math.max(min, wKm * kmPx)
    g.beginPath()
    line.forEach((p, i) => {
      const [x, y] = P(p)
      if (i) g.lineTo(x, y)
      else g.moveTo(x, y)
    })
    g.stroke()
  }
  g.lineJoin = 'round'
  g.lineCap = 'round'
  for (const r of c.roads) stroke(r.line, r.w, 'rgb(186,178,158)', 0.62, 0.7)
  for (const r of c.rivers) stroke(r.line, r.w, r.w > 0.1 ? 'rgb(74,90,74)' : 'rgb(46,70,62)', r.w > 0.1 ? 1 : 0.8, r.w > 0.1 ? 1.6 : 0.6)
  g.globalAlpha = 1
  g.fillStyle = 'rgb(34,56,64)'
  for (const poly of c.lakes) {
    g.beginPath()
    for (const ring of poly) ring.forEach((p, i) => (i ? g.lineTo : g.moveTo).call(g, ...P(p)))
    g.fill('evenodd')
  }

  // clip to the region outline (outside stays transparent: the map's own mask dims it)
  g.globalCompositeOperation = 'destination-in'
  g.fillStyle = '#000'
  g.beginPath()
  for (const p of c.polys) for (const ring of p.rings) ring.forEach((q, i) => (i ? g.lineTo : g.moveTo).call(g, ...P(q)))
  g.fill('nonzero')
  g.globalCompositeOperation = 'source-over'
  return cv
}

function inSite(c: Ctx, p: LngLat): boolean {
  for (const s of c.sites) {
    const dx = (p[0] - s.center[0]) * c.kx
    const dy = (p[1] - s.center[1]) * c.ky
    if (dx * dx + dy * dy < s.radiusKm * s.radiusKm * 1.1) return true
  }
  return false
}

/** View of the whole region bbox at the imagery resolution. */
export function regionView(c: Ctx, coarse: boolean): View {
  const [W, S, E, N] = c.bbox
  const w = coarse ? IMG.widthCoarse : IMG.width
  return { bbox: c.bbox, w, h: Math.round((w * ((N - S) * c.ky)) / ((E - W) * c.kx)) }
}

/** View of a crop around `center`, `kmW` wide, at `w` × `h` px. */
export function cropView(c: Ctx, center: LngLat, kmW: number, w: number, h: number): View {
  const kmH = (kmW * h) / w
  const dLon = kmW / 2 / c.kx
  const dLat = kmH / 2 / c.ky
  return { bbox: [center[0] - dLon, center[1] - dLat, center[0] + dLon, center[1] + dLat], w, h }
}

/* ------------------------------------------------------------------ map layer */
interface MapLike {
  getLayer(id: string): unknown
  getSource(id: string): unknown
  addSource(id: string, src: unknown): void
  addLayer(layer: unknown, before?: string): void
  removeLayer(id: string): void
  removeSource(id: string): void
  setLayoutProperty(id: string, k: string, v: unknown): void
}
const LAYER = 'sw-img'
const SOURCE = 'sw-img-src'
let installedFor: RegionGeo | null = null
let painting: { geo: RegionGeo; job: Promise<HTMLCanvasElement | null>; signal: { cancelled: boolean } } | null = null

/** Show / hide the procedural imagery on the map (paints once per region; later toggles only flip visibility). */
export async function setImagery(raw: unknown, c: Ctx, geo: RegionGeo, on: boolean, coarse: boolean): Promise<void> {
  const map = raw as MapLike | null
  if (!map) return
  if (!on) {
    if (map.getLayer(LAYER)) map.setLayoutProperty(LAYER, 'visibility', 'none')
    return
  }
  if (installedFor === geo && map.getLayer(LAYER)) {
    map.setLayoutProperty(LAYER, 'visibility', 'visible')
    return
  }
  if (painting?.geo !== geo) {
    if (painting) painting.signal.cancelled = true
    const signal = { cancelled: false }
    painting = { geo, signal, job: paint(c, regionView(c, coarse), 'after', signal) }
  }
  const cv = await painting.job
  if (!cv || painting?.geo !== geo) return
  if (map.getLayer(LAYER)) map.removeLayer(LAYER)
  if (map.getSource(SOURCE)) map.removeSource(SOURCE)
  const [W, S, E, N] = c.bbox
  map.addSource(SOURCE, { type: 'canvas', canvas: cv, animate: false, coordinates: [[W, N], [E, N], [E, S], [W, S]] })
  map.addLayer({ id: LAYER, type: 'raster', source: SOURCE, paint: { 'raster-opacity': IMG.opacity, 'raster-fade-duration': 0, 'raster-resampling': 'linear' } }, map.getLayer('dk-mask-fill') ? 'dk-mask-fill' : undefined)
  installedFor = geo
}

/** forget the installed layer (map unmounted) */
export function resetImagery(): void {
  installedFor = null
  if (painting) painting.signal.cancelled = true
  painting = null
}
