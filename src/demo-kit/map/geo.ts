/**
 * map/geo.ts — small, pure geometry helpers (no MapLibre, no DOM): rings, bbox, centroids, point-in-polygon,
 * the outer boundary of a set of polygons that share edges, and a scanline rasteriser for the flood model.
 */
import type { LngLat } from './types'

export type Ring = LngLat[]
/** one polygon = outer ring + holes */
export type Poly = Ring[]
export type BBox = [number, number, number, number]

interface Geometry {
  type: string
  coordinates: unknown
}

/** Polygons of a (Multi)Polygon geometry; other types → []. */
export function polysOf(g: Geometry): Poly[] {
  if (g.type === 'Polygon') return [g.coordinates as Poly]
  if (g.type === 'MultiPolygon') return g.coordinates as Poly[]
  return []
}

/** Lines of a (Multi)LineString geometry; polygons give their rings. */
export function linesOf(g: Geometry): Ring[] {
  if (g.type === 'LineString') return [g.coordinates as Ring]
  if (g.type === 'MultiLineString') return g.coordinates as Ring[]
  if (g.type === 'Polygon') return g.coordinates as Ring[]
  if (g.type === 'MultiPolygon') return (g.coordinates as Poly[]).flat()
  return []
}

export function bboxOfPolys(polys: Poly[]): BBox {
  let w = Infinity
  let s = Infinity
  let e = -Infinity
  let n = -Infinity
  for (const p of polys)
    for (const [x, y] of p[0] ?? []) {
      if (x < w) w = x
      if (x > e) e = x
      if (y < s) s = y
      if (y > n) n = y
    }
  return [w, s, e, n]
}

function ringArea(r: Ring): number {
  let a = 0
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const p = r[i]!
    const q = r[j]!
    a += (q[0] - p[0]) * (q[1] + p[1])
  }
  return a / 2
}

/** Area-weighted centroid of the largest outer ring (good enough for label anchors of convex-ish shapes). */
export function centroidOf(polys: Poly[]): LngLat {
  let best: Ring | null = null
  let bestA = 0
  for (const p of polys) {
    const r = p[0]
    if (!r) continue
    const a = Math.abs(ringArea(r))
    if (a > bestA) {
      bestA = a
      best = r
    }
  }
  if (!best) return [0, 0]
  let cx = 0
  let cy = 0
  let a2 = 0
  for (let i = 0, j = best.length - 1; i < best.length; j = i++) {
    const p = best[i]!
    const q = best[j]!
    const f = q[0] * p[1] - p[0] * q[1]
    cx += (q[0] + p[0]) * f
    cy += (q[1] + p[1]) * f
    a2 += f
  }
  if (Math.abs(a2) < 1e-12) return best[0] ?? [0, 0]
  const c: LngLat = [cx / (3 * a2), cy / (3 * a2)]
  return pointInPolys(c, polys) ? c : best[Math.floor(best.length / 2)] ?? c
}

export function pointInRing([x, y]: LngLat, r: Ring): boolean {
  let inside = false
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i]!
    const b = r[j]!
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside
  }
  return inside
}

export function pointInPolys(pt: LngLat, polys: Poly[]): boolean {
  for (const p of polys) {
    if (!p[0] || !pointInRing(pt, p[0])) continue
    let hole = false
    for (let k = 1; k < p.length; k++) if (pointInRing(pt, p[k]!)) hole = true
    if (!hole) return true
  }
  return false
}

/**
 * Outer boundary of polygons that share edges exactly (topologically simplified admin boundaries):
 * every edge used twice is interior, the rest is chained into rings. Returns [] if chaining fails.
 */
export function outerRings(polys: Poly[]): Ring[] {
  const key = (p: LngLat) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`
  const count = new Map<string, number>()
  const edges: [LngLat, LngLat][] = []
  for (const poly of polys)
    for (const ring of poly)
      for (let i = 0; i + 1 < ring.length; i++) {
        const a = ring[i]!
        const b = ring[i + 1]!
        const ka = key(a)
        const kb = key(b)
        if (ka === kb) continue
        const k = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`
        count.set(k, (count.get(k) ?? 0) + 1)
        edges.push([a, b])
      }
  const next = new Map<string, LngLat[]>()
  for (const [a, b] of edges) {
    const ka = key(a)
    const kb = key(b)
    const k = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`
    if (count.get(k) !== 1) continue
    const list = next.get(ka) ?? []
    list.push(b)
    next.set(ka, list)
  }
  const rings: Ring[] = []
  let guard = 0
  while (next.size && guard++ < 10000) {
    const startKey = next.keys().next().value as string
    const [sx, sy] = startKey.split(',').map(Number) as [number, number]
    const ring: Ring = [[sx, sy]]
    let cur = startKey
    for (let steps = 0; steps < 200000; steps++) {
      const list = next.get(cur)
      if (!list || !list.length) break
      const nxt = list.pop()!
      if (!list.length) next.delete(cur)
      ring.push(nxt)
      cur = key(nxt)
      if (cur === startKey) break
    }
    if (ring.length > 3 && key(ring[ring.length - 1]!) === startKey) rings.push(ring)
  }
  return rings
}

/* ------------------------------------------------------------------ raster grid (lng/lat-linear) */

export interface Grid {
  w: number
  h: number
  bbox: BBox
  /** grid x of a longitude */
  gx(lng: number): number
  /** grid y (0 = north) of a latitude */
  gy(lat: number): number
}

export function makeGrid(bbox: BBox, w: number): Grid {
  const [W, S, E, N] = bbox
  const kmX = (E - W) * 111.32 * Math.cos((((S + N) / 2) * Math.PI) / 180)
  const kmY = (N - S) * 110.57
  const h = Math.max(8, Math.round((w * kmY) / kmX))
  return { w, h, bbox, gx: (lng) => ((lng - W) / (E - W)) * w, gy: (lat) => ((N - lat) / (N - S)) * h }
}

/** Even-odd scanline fill of one polygon (with holes) into `out` with `value` (pixel centres). */
export function fillPoly(out: { [i: number]: number }, grid: Grid, poly: Poly, value: number): void {
  const pts = poly.map((r) => r.map(([x, y]) => [grid.gx(x), grid.gy(y)] as const))
  let y0 = Infinity
  let y1 = -Infinity
  for (const r of pts)
    for (const p of r) {
      if (p[1] < y0) y0 = p[1]
      if (p[1] > y1) y1 = p[1]
    }
  const ys = Math.max(0, Math.floor(y0))
  const ye = Math.min(grid.h - 1, Math.ceil(y1))
  const xs: number[] = []
  for (let row = ys; row <= ye; row++) {
    const cy = row + 0.5
    xs.length = 0
    for (const r of pts)
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const a = r[i]!
        const b = r[j]!
        if (a[1] > cy !== b[1] > cy) xs.push(a[0] + ((cy - a[1]) * (b[0] - a[0])) / (b[1] - a[1]))
      }
    xs.sort((m, n) => m - n)
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const from = Math.max(0, Math.ceil(xs[k]! - 0.5))
      const to = Math.min(grid.w - 1, Math.floor(xs[k + 1]! - 0.5))
      for (let x = from; x <= to; x++) out[row * grid.w + x] = value
    }
  }
}

/** Marks every grid cell a polyline passes through (sampled at ≤ 0.5 cell steps). */
export function strokeLine(out: { [i: number]: number }, grid: Grid, line: Ring, value: number): void {
  for (let i = 0; i + 1 < line.length; i++) {
    const ax = grid.gx(line[i]![0])
    const ay = grid.gy(line[i]![1])
    const bx = grid.gx(line[i + 1]![0])
    const by = grid.gy(line[i + 1]![1])
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 2))
    for (let s = 0; s <= n; s++) {
      const x = Math.floor(ax + ((bx - ax) * s) / n)
      const y = Math.floor(ay + ((by - ay) * s) / n)
      if (x >= 0 && y >= 0 && x < grid.w && y < grid.h) out[y * grid.w + x] = value
    }
  }
}

/** Two-pass chamfer (3-4) distance transform: distance in cells from the nearest seed (seed cells != 0). */
export function distanceField(seed: Uint8Array, w: number, h: number): Float32Array {
  const INF = 1e9
  const d = new Float32Array(w * h)
  for (let i = 0; i < d.length; i++) d[i] = seed[i] ? 0 : INF
  const A = 1
  const B = Math.SQRT2
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      let v = d[i]!
      if (x > 0) v = Math.min(v, d[i - 1]! + A)
      if (y > 0) {
        v = Math.min(v, d[i - w]! + A)
        if (x > 0) v = Math.min(v, d[i - w - 1]! + B)
        if (x < w - 1) v = Math.min(v, d[i - w + 1]! + B)
      }
      d[i] = v
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x
      let v = d[i]!
      if (x < w - 1) v = Math.min(v, d[i + 1]! + A)
      if (y < h - 1) {
        v = Math.min(v, d[i + w]! + A)
        if (x < w - 1) v = Math.min(v, d[i + w + 1]! + B)
        if (x > 0) v = Math.min(v, d[i + w - 1]! + B)
      }
      d[i] = v
    }
  return d
}

/** Deterministic value noise in [0, 1] (hash on integer lattice, smooth bilinear). */
export function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const fx = x - xi
  const fy = y - yi
  const h = (a: number, b: number) => {
    let n = (a * 374761393 + b * 668265263 + seed * 2246822519) | 0
    n = Math.imul(n ^ (n >>> 13), 1274126177)
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296
  }
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const a = h(xi, yi) + (h(xi + 1, yi) - h(xi, yi)) * sx
  const b = h(xi, yi + 1) + (h(xi + 1, yi + 1) - h(xi, yi + 1)) * sx
  return a + (b - a) * sy
}

export const KM_PER_DEG_LAT = 110.57
export const kmPerDegLng = (lat: number): number => 111.32 * Math.cos((lat * Math.PI) / 180)
