/**
 * map/labelPoint.ts — label anchors for kecamatan polygons. Engine-only (it lives in the lazy engine chunk, not
 * in the map barrel's chunk).
 */
import { bboxOfPolys, centroidOf, pointInPolys, type Poly, type Ring } from './geo'
import type { LngLat } from './types'

function ringArea(r: Ring): number {
  let a = 0
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j]![0] - r[i]![0]) * (r[j]![1] + r[i]![1])
  return a / 2
}

/** Every n-th vertex so a ring has at most `max` points (closed rings stay closed enough for distance work). */
function thin(r: Ring, max: number): Ring {
  if (r.length <= max) return r
  const n = Math.ceil(r.length / max)
  const out: Ring = []
  for (let i = 0; i < r.length; i += n) out.push(r[i]!)
  out.push(r[r.length - 1]!)
  return out
}

/** Squared distance from (x, y) to segment a-b, x scaled by kx (equirectangular, good at kecamatan scale). */
function segDist2(x: number, y: number, a: LngLat, b: LngLat, kx: number): number {
  const ax = a[0] * kx
  const ay = a[1]
  const dx = b[0] * kx - ax
  const dy = b[1] - ay
  const l = dx * dx + dy * dy
  const t = l ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l)) : 0
  const ex = x - ax - t * dx
  const ey = y - ay - t * dy
  return ex * ex + ey * ey
}

/**
 * Label anchor: an approximate pole of inaccessibility of the largest polygon (the inside point farthest from
 * its edges), found by a coarse grid search refined three times. Unlike the centroid it stays well inside
 * thin, bent or C-shaped kecamatan, so a label centred on it does not spill onto the neighbour or the basemap.
 */
export function labelPoint(polys: Poly[]): LngLat {
  let best: Poly | null = null
  let bestA = 0
  for (const p of polys) {
    const a = p[0] ? Math.abs(ringArea(p[0])) : 0
    if (a > bestA) {
      bestA = a
      best = p
    }
  }
  if (!best) return centroidOf(polys)
  const rings = best.map((r) => thin(r, 160))
  const [w, s, e, n] = bboxOfPolys([best])
  const kx = Math.cos((((s + n) / 2) * Math.PI) / 180)
  const score = (x: number, y: number): number => {
    if (!pointInPolys([x, y], [best])) return -1
    let d = Infinity
    for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) d = Math.min(d, segDist2(x * kx, y, r[j]!, r[i]!, kx))
    return d
  }
  const G = 14
  let cx = (w + e) / 2
  let cy = (s + n) / 2
  let hw = (e - w) / 2
  let hh = (n - s) / 2
  let top = -1
  for (let it = 0; it < 4; it++) {
    let bx = cx
    let by = cy
    for (let i = 0; i <= G; i++)
      for (let j = 0; j <= G; j++) {
        const x = cx - hw + (2 * hw * i) / G
        const y = cy - hh + (2 * hh * j) / G
        const d = score(x, y)
        if (d > top) {
          top = d
          bx = x
          by = y
        }
      }
    cx = bx
    cy = by
    hw = (2 * hw) / G
    hh = (2 * hh) / G
  }
  return top > 0 ? [cx, cy] : centroidOf(polys)
}
