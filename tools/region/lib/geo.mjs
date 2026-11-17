/**
 * geo.mjs — small, dependency-free geometry helpers for the region-pack builder.
 *
 *  - Topology-aware simplification: rings of several polygon layers are cut into shared ARCS at junction
 *    points (TopoJSON-style), every arc is simplified ONCE with Douglas-Peucker and re-used by every ring
 *    that contains it, so neighbouring kecamatan keep an identical border (no slivers, no gaps).
 *  - Douglas-Peucker for lines (rivers, roads), on a local equirectangular projection (metres).
 *  - Rounding to N decimals, ring area, centroid, point-in-polygon, distance point→segment (metres).
 */

const R = 6371008.8
const DEG = Math.PI / 180

/** Local equirectangular projector around latitude lat0 → metres. */
export function projector(lat0) {
  const kx = Math.cos(lat0 * DEG) * DEG * R
  const ky = DEG * R
  return { x: (p) => p[0] * kx, y: (p) => p[1] * ky, kx, ky }
}

/** Douglas-Peucker (iterative) on an open polyline; keeps both endpoints. tol in metres. */
export function douglasPeucker(pts, tol, lat0) {
  if (pts.length <= 2) return pts.slice()
  const { kx, ky } = projector(lat0)
  const keep = new Uint8Array(pts.length)
  keep[0] = 1
  keep[pts.length - 1] = 1
  const stack = [[0, pts.length - 1]]
  const tol2 = tol * tol
  while (stack.length) {
    const [a, b] = stack.pop()
    const ax = pts[a][0] * kx, ay = pts[a][1] * ky
    const bx = pts[b][0] * kx, by = pts[b][1] * ky
    const dx = bx - ax, dy = by - ay
    const len2 = dx * dx + dy * dy
    let max = -1, idx = -1
    for (let i = a + 1; i < b; i++) {
      const px = pts[i][0] * kx, py = pts[i][1] * ky
      let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0
      t = t < 0 ? 0 : t > 1 ? 1 : t
      const ex = ax + t * dx - px, ey = ay + t * dy - py
      const d2 = ex * ex + ey * ey
      if (d2 > max) { max = d2; idx = i }
    }
    if (max > tol2 && idx > 0) {
      keep[idx] = 1
      stack.push([a, idx], [idx, b])
    }
  }
  return pts.filter((_, i) => keep[i])
}

export const round = (v, d = 5) => {
  const f = 10 ** d
  return Math.round(v * f) / f
}
export const roundPt = (p, d = 5) => [round(p[0], d), round(p[1], d)]

/** Round + drop consecutive duplicates. */
export function roundLine(pts, d = 5) {
  const out = []
  for (const p of pts) {
    const q = roundPt(p, d)
    const last = out[out.length - 1]
    if (!last || last[0] !== q[0] || last[1] !== q[1]) out.push(q)
  }
  return out
}

/** Signed planar area (deg², lon/lat) — sign gives orientation. */
export function ringArea(ring) {
  let s = 0
  for (let i = 0, n = ring.length; i < n; i++) {
    const a = ring[i], b = ring[(i + 1) % n]
    s += a[0] * b[1] - b[0] * a[1]
  }
  return s / 2
}

/** Area in km² of a (Multi)Polygon geometry (equirectangular approximation, fine at kabupaten scale). */
export function areaKm2(geom) {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates
  let lat0 = 0, n = 0
  for (const p of polys) for (const q of p[0]) { lat0 += q[1]; n++ }
  lat0 /= n || 1
  const { kx, ky } = projector(lat0)
  let a = 0
  for (const p of polys) p.forEach((ring, i) => {
    const v = Math.abs(ringArea(ring)) * kx * ky
    a += i === 0 ? v : -v
  })
  return a / 1e6
}

/** Area-weighted centroid of the largest polygon (good label point for convex-ish shapes). */
export function centroid(geom) {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates
  let best = null, bestA = -1
  for (const p of polys) {
    const a = Math.abs(ringArea(p[0]))
    if (a > bestA) { bestA = a; best = p[0] }
  }
  let cx = 0, cy = 0, A = 0
  for (let i = 0, n = best.length; i < n; i++) {
    const a = best[i], b = best[(i + 1) % n]
    const f = a[0] * b[1] - b[0] * a[1]
    cx += (a[0] + b[0]) * f
    cy += (a[1] + b[1]) * f
    A += f
  }
  A /= 2
  const c = [cx / (6 * A), cy / (6 * A)]
  // fall back to an interior point when the centroid falls outside (concave shapes)
  if (!pointInGeom(c, geom)) return interiorPoint(geom)
  return c
}

/** Cheap interior point: scan the horizontal line through the bbox middle, take the widest inside span. */
export function interiorPoint(geom) {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates
  let minY = Infinity, maxY = -Infinity
  for (const p of polys) for (const q of p[0]) { minY = Math.min(minY, q[1]); maxY = Math.max(maxY, q[1]) }
  let best = null, bestW = -1
  for (let k = 1; k < 10; k++) {
    const y = minY + ((maxY - minY) * k) / 10
    const xs = []
    for (const p of polys) for (const ring of p) for (let i = 0, n = ring.length; i < n; i++) {
      const a = ring[i], b = ring[(i + 1) % n]
      if ((a[1] > y) !== (b[1] > y)) xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]))
    }
    xs.sort((m, n) => m - n)
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const w = xs[i + 1] - xs[i]
      if (w > bestW) { bestW = w; best = [(xs[i] + xs[i + 1]) / 2, y] }
    }
  }
  return best
}

export function pointInRing(p, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j]
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside
  }
  return inside
}

export function pointInGeom(p, geom) {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates
  for (const poly of polys) {
    if (!pointInRing(p, poly[0])) continue
    let hole = false
    for (let i = 1; i < poly.length; i++) if (pointInRing(p, poly[i])) { hole = true; break }
    if (!hole) return true
  }
  return false
}

/** Shortest distance (m) from point p to a polyline. */
export function distToLine(p, line, lat0) {
  const { kx, ky } = projector(lat0)
  const px = p[0] * kx, py = p[1] * ky
  let best = Infinity
  for (let i = 0; i + 1 < line.length; i++) {
    const ax = line[i][0] * kx, ay = line[i][1] * ky
    const bx = line[i + 1][0] * kx, by = line[i + 1][1] * ky
    const dx = bx - ax, dy = by - ay
    const l2 = dx * dx + dy * dy
    let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0
    t = t < 0 ? 0 : t > 1 ? 1 : t
    const ex = ax + t * dx - px, ey = ay + t * dy - py
    best = Math.min(best, Math.hypot(ex, ey))
  }
  return best
}

export function bboxOf(coordsList) {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity
  for (const p of coordsList) {
    if (p[0] < w) w = p[0]
    if (p[0] > e) e = p[0]
    if (p[1] < s) s = p[1]
    if (p[1] > n) n = p[1]
  }
  return [w, s, e, n]
}

/* --------------------------------------------------------------------- topology-aware simplification */

const key = (p) => `${p[0].toFixed(7)},${p[1].toFixed(7)}`

/** Strip the closing point, drop consecutive duplicates (by key). */
function openRing(ring) {
  const out = []
  for (const p of ring) {
    const k = key(p)
    if (out.length && key(out[out.length - 1]) === k) continue
    out.push(p)
  }
  if (out.length > 1 && key(out[0]) === key(out[out.length - 1])) out.pop()
  return out
}

/**
 * Simplify several polygon layers together so that shared borders stay identical.
 * @param layers  { [name]: Feature[] } with Polygon/MultiPolygon geometries
 * @param opts    { tol: { [name]: metres } , lat0, decimals, minAreaKm2 }
 * @returns       { [name]: Feature[] } with simplified, rounded geometry; plus stats
 *
 * An arc shared by two layers is simplified with the SMALLER tolerance of the layers using it, so a
 * kecamatan border that is also a desa border looks the same in both layers.
 */
export function simplifyTopology(layers, { tol, lat0, decimals = 5, minAreaKm2 = 0.01 }) {
  // 1. collect rings
  const rings = [] // { layer, fi, pi, ri, pts }
  for (const [layer, feats] of Object.entries(layers)) {
    feats.forEach((f, fi) => {
      const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
      polys.forEach((poly, pi) => poly.forEach((ring, ri) => {
        const pts = openRing(ring)
        if (pts.length >= 3) rings.push({ layer, fi, pi, ri, pts })
      }))
    })
  }
  // 2. junctions: points whose set of neighbours has != 2 members
  const neigh = new Map()
  const addN = (k, n) => {
    let s = neigh.get(k)
    if (!s) neigh.set(k, (s = new Set()))
    s.add(n)
  }
  for (const r of rings) {
    const n = r.pts.length
    for (let i = 0; i < n; i++) {
      const k = key(r.pts[i])
      addN(k, key(r.pts[(i - 1 + n) % n]))
      addN(k, key(r.pts[(i + 1) % n]))
    }
  }
  const isJunction = (k) => neigh.get(k).size > 2
  // 3. cut rings into arcs, dedupe arcs
  const arcs = [] // { pts, tol, simple }
  const arcIndex = new Map() // canonical key → arc idx
  for (const r of rings) {
    const n = r.pts.length
    let start = r.pts.findIndex((p) => isJunction(key(p)))
    const t = tol[r.layer]
    if (start < 0) {
      // ring with no junctions: one closed arc; canonicalise by min key + direction
      const ks = r.pts.map(key)
      let m = 0
      for (let i = 1; i < n; i++) if (ks[i] < ks[m]) m = i
      const fwd = [...r.pts.slice(m), ...r.pts.slice(0, m), r.pts[m]]
      const ck = 'C' + fwd.map(key).join(';')
      const rev = fwd.slice().reverse()
      const rk = 'C' + rev.map(key).join(';')
      let idx = arcIndex.get(ck) ?? arcIndex.get(rk)
      let sign = arcIndex.has(rk) && !arcIndex.has(ck) ? -1 : 1
      if (idx === undefined) {
        idx = arcs.length
        arcs.push({ pts: fwd, tol: t, closed: true })
        arcIndex.set(ck, idx)
        sign = 1
      } else arcs[idx].tol = Math.min(arcs[idx].tol, t)
      r.arcs = [[idx, sign]]
      continue
    }
    const seq = [...r.pts.slice(start), ...r.pts.slice(0, start), r.pts[start]]
    r.arcs = []
    let cur = [seq[0]]
    for (let i = 1; i < seq.length; i++) {
      cur.push(seq[i])
      if (isJunction(key(seq[i]))) {
        const ks = cur.map(key)
        const fk = ks.join(';')
        const rk = ks.slice().reverse().join(';')
        let idx = arcIndex.get(fk)
        let sign = 1
        if (idx === undefined && arcIndex.has(rk)) { idx = arcIndex.get(rk); sign = -1 }
        if (idx === undefined) {
          idx = arcs.length
          arcs.push({ pts: cur, tol: t })
          arcIndex.set(fk, idx)
        } else arcs[idx].tol = Math.min(arcs[idx].tol, t)
        r.arcs.push([idx, sign])
        cur = [seq[i]]
      }
    }
  }
  // 4. simplify each arc once (closed arcs: split in two halves so DP keeps a real shape)
  for (const a of arcs) {
    let s
    if (a.closed && a.pts.length > 4) {
      const mid = Math.floor(a.pts.length / 2)
      const h1 = douglasPeucker(a.pts.slice(0, mid + 1), a.tol, lat0)
      const h2 = douglasPeucker(a.pts.slice(mid), a.tol, lat0)
      s = [...h1, ...h2.slice(1)]
    } else s = douglasPeucker(a.pts, a.tol, lat0)
    a.simple = roundLine(s, decimals)
  }
  // 5. rebuild rings
  const outLayers = {}
  const stats = { arcs: arcs.length, junctions: [...neigh.keys()].filter(isJunction).length, ringsDropped: 0 }
  for (const [layer, feats] of Object.entries(layers)) {
    outLayers[layer] = feats.map((f) => ({ ...f, geometry: { type: 'MultiPolygon', coordinates: [] } }))
  }
  const polyMap = new Map() // `${layer}|${fi}|${pi}` → rings[]
  for (const r of rings) {
    let pts = []
    for (const [idx, sign] of r.arcs) {
      const seg = sign > 0 ? arcs[idx].simple : arcs[idx].simple.slice().reverse()
      pts = pts.length ? pts.concat(seg.slice(1)) : seg.slice()
    }
    // close + clean
    const clean = roundLine(pts, decimals)
    if (clean.length && (clean[0][0] !== clean[clean.length - 1][0] || clean[0][1] !== clean[clean.length - 1][1])) clean.push(clean[0])
    const { kx, ky } = projector(lat0)
    const area = (Math.abs(ringArea(clean)) * kx * ky) / 1e6
    if (clean.length < 4 || (r.ri > 0 && area < minAreaKm2) || (r.ri === 0 && area < minAreaKm2 / 10)) {
      stats.ringsDropped++
      if (r.ri === 0) polyMap.set(`${r.layer}|${r.fi}|${r.pi}`, null)
      continue
    }
    const k = `${r.layer}|${r.fi}|${r.pi}`
    if (polyMap.get(k) === null) continue
    if (!polyMap.has(k)) polyMap.set(k, [])
    polyMap.get(k)[r.ri === 0 ? 'unshift' : 'push']({ outer: r.ri === 0, ring: clean })
  }
  for (const [k, rs] of polyMap) {
    if (!rs || !rs.length || !rs[0].outer) continue
    const [layer, fi] = k.split('|')
    // GeoJSON RFC 7946: outer CCW, holes CW
    const ringsOut = rs.map(({ outer, ring }) => {
      const ccw = ringArea(ring) > 0
      return outer === ccw ? ring : ring.slice().reverse()
    })
    outLayers[layer][Number(fi)].geometry.coordinates.push(ringsOut)
  }
  for (const feats of Object.values(outLayers)) for (const f of feats) {
    if (f.geometry.coordinates.length === 1) f.geometry = { type: 'Polygon', coordinates: f.geometry.coordinates[0] }
  }
  return { layers: outLayers, stats }
}

/* --------------------------------------------------------------------- quantisation (shipping precision) */

/**
 * Round every coordinate of a GeoJSON geometry to `d` decimals (4 ≈ 11 m) and clean up afterwards.
 * Rounding is a pure function of the input vertex, so a border shared by two features (same vertices after
 * simplifyTopology) stays identical in both: the result is still gap-free. Consecutive duplicates are dropped;
 * lines with < 2 points and rings with < 4 points (or zero area) are removed, then empty parts.
 */
export function quantizeGeom(geom, d = 4) {
  const line = (pts) => roundLine(pts, d)
  const ring = (pts) => {
    const r = roundLine(pts, d)
    if (r.length && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1])) r.push(r[0])
    return r.length >= 4 && ringArea(r) !== 0 ? r : null
  }
  const poly = (rings) => {
    const outer = ring(rings[0])
    if (!outer) return null
    return [outer, ...rings.slice(1).map(ring).filter(Boolean)]
  }
  switch (geom.type) {
    case 'Point': return { type: 'Point', coordinates: roundPt(geom.coordinates, d) }
    case 'MultiPoint': return { type: 'MultiPoint', coordinates: geom.coordinates.map((p) => roundPt(p, d)) }
    case 'LineString': return { type: 'LineString', coordinates: line(geom.coordinates) }
    case 'MultiLineString': return { type: 'MultiLineString', coordinates: geom.coordinates.map(line).filter((l) => l.length > 1) }
    case 'Polygon': return { type: 'Polygon', coordinates: poly(geom.coordinates) ?? [] }
    case 'MultiPolygon': {
      const ps = geom.coordinates.map(poly).filter(Boolean)
      return ps.length === 1 ? { type: 'Polygon', coordinates: ps[0] } : { type: 'MultiPolygon', coordinates: ps }
    }
    default: return geom
  }
}

/** Quantise every feature of a FeatureCollection; features whose geometry became empty are dropped. */
export function quantizeFC(fc, d = 4) {
  const features = fc.features
    .map((f) => ({ ...f, geometry: quantizeGeom(f.geometry, d) }))
    .filter((f) => f.geometry.coordinates.length > 0)
  return { ...fc, features }
}
