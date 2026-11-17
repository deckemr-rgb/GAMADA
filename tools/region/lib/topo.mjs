/**
 * tools/region/lib/topo.mjs — ENCODER of the compact geometry wire form (geo.min.json / desa.min.json).
 * The decoder ships in src/demo-kit/region/topo.ts; tools/region/validate.mjs checks that decoding the .min file
 * gives exactly the canonical geo.json / desa.json (deep equal), so the browser draws byte-for-byte the same
 * geometry as before, only fetched much smaller.
 *
 * Format (`{ topo: 1, q, arcs, data }`):
 *   - every coordinate is an integer on a 1/q° grid (q = 1e4, the shipping precision of the canonical files);
 *   - polygon rings are cut at junctions (points shared by ≥ 3 edges) into ARCS, TopoJSON style: a border
 *     between two kecamatan is stored once and referenced by both (index i, or ~i when walked backwards);
 *   - every line part is one arc;
 *   - arcs are delta coded (the cursor runs on across arcs), zig-zag, 5 bits per character in a JSON-safe base64
 *     alphabet; bit 5 = "more digits follow";
 *   - `data` is the original JSON with each FeatureCollection replaced by `{ $fc: { n, id?, c | r, d?, g }, …rest }`:
 *       n   feature count
 *       id  'p' = every feature id equals properties.id, or the id list (absent: no feature has an id)
 *       c   properties as columns { key: value[] } when every feature has the same keys, else r: properties[]
 *       d   1 = in c.id, null means "the builder's rule": `${kecamatanId}-${slug(name)}` (or slug(name))
 *       g   per feature a string of varints: kind (0 Polygon, 1 MultiPolygon, 2 LineString, 3 MultiLineString),
 *           polygon/part counts, per ring its rotation (restores the original first vertex), ref count and arc
 *           refs: 0 = the next new arc (arcs are numbered in first-use order), r > 0 = arc r − 1, r < 0 = arc ~r
 *           walked backwards; line parts take the next new arc implicitly. Other geometry: { G: geometry } verbatim.
 */

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

/** zig-zag varint, 5 bits per character, bit 5 = more */
function put(out, v) {
  let z = v < 0 ? -2 * v - 1 : 2 * v
  while (z >= 32) {
    out.push(ALPHA[32 | (z & 31)])
    z = Math.floor(z / 32)
  }
  out.push(ALPHA[z])
}

/** same slug as the builders and src/demo-kit/region/wire.ts */
const slug = (s) =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
/** the id rule the builders use; the decoder (region/topo.ts) applies the same rule */
export const derivedId = (p) => (p.kecamatanId ? `${p.kecamatanId}-${slug(p.name)}` : slug(p.name))

/** @param {any} value any JSON value: a FeatureCollection, or an object holding several (RegionGeo) */
export function encodeTopo(value, q = 1e4) {
  const fcs = []
  const collect = (v) => {
    if (!v || typeof v !== 'object') return
    if (Array.isArray(v)) return v.forEach(collect)
    if (v.type === 'FeatureCollection' && Array.isArray(v.features)) return void fcs.push(v)
    for (const x of Object.values(v)) collect(x)
  }
  collect(value)

  const Q = (c) => {
    const x = Math.round(c[0] * q)
    const y = Math.round(c[1] * q)
    if (Math.abs(x / q - c[0]) > 1e-12 || Math.abs(y / q - c[1]) > 1e-12) throw new Error(`topo: coordinate ${c} is not on the 1/${q}° grid`)
    return [x, y]
  }
  const K = (p) => p[0] + ',' + p[1]
  const polys = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [])

  /* 1. every polygon ring (open, integer) → junctions */
  const ringInt = new Map() // ring array (original) → open integer ring
  for (const fc of fcs) for (const f of fc.features) for (const poly of polys(f.geometry)) for (const r of poly) {
    const last = r[r.length - 1]
    if (r.length < 4 || r[0][0] !== last[0] || r[0][1] !== last[1]) throw new Error('topo: ring is not closed')
    ringInt.set(r, r.slice(0, -1).map(Q))
  }
  const neigh = new Map()
  const addN = (k, n) => {
    let s = neigh.get(k)
    if (!s) neigh.set(k, (s = new Set()))
    s.add(n)
  }
  for (const r of ringInt.values()) {
    const n = r.length
    for (let i = 0; i < n; i++) {
      const k = K(r[i])
      addN(k, K(r[(i + n - 1) % n]))
      addN(k, K(r[(i + 1) % n]))
    }
  }
  const isJ = (p) => neigh.get(K(p)).size > 2

  /* 2. arcs (deduplicated forwards/backwards) */
  const arcs = []
  const arcIdx = new Map()
  const ref = (pts) => {
    const fk = pts.map(K).join(';')
    let i = arcIdx.get(fk)
    if (i !== undefined) return i
    i = arcIdx.get(pts.map(K).reverse().join(';'))
    if (i !== undefined) return ~i
    arcIdx.set(fk, arcs.length)
    arcs.push(pts)
    return arcs.length - 1
  }
  const ringRef = (orig) => {
    const r = ringInt.get(orig)
    const n = r.length
    const refs = []
    let s = r.findIndex(isJ)
    if (s < 0) {
      // no junction: one closed arc, canonical start (smallest key) so an identical ring elsewhere is re-used
      let m = 0
      for (let i = 1; i < n; i++) if (K(r[i]) < K(r[m])) m = i
      s = m
      refs.push(ref([...r.slice(s), ...r.slice(0, s), r[s]]))
    } else {
      const seq = [...r.slice(s), ...r.slice(0, s), r[s]]
      let cur = [seq[0]]
      for (let i = 1; i < seq.length; i++) {
        cur.push(seq[i])
        if (isJ(seq[i])) {
          refs.push(ref(cur))
          cur = [seq[i]]
        }
      }
    }
    // rebuild like the decoder does, then find the rotation that restores the original first vertex
    const open = joinArcs(refs).slice(0, -1)
    for (let k = 0; k < n; k++) {
      let ok = true
      for (let i = 0; i < n && ok; i++) ok = open[(i + k) % n][0] === r[i][0] && open[(i + k) % n][1] === r[i][1]
      if (ok) return [k, ...refs]
    }
    throw new Error('topo: ring could not be rebuilt')
  }
  const joinArcs = (refs) => {
    const out = []
    for (const a of refs) {
      const pts = a < 0 ? arcs[~a].slice().reverse() : arcs[a]
      for (let i = out.length ? 1 : 0; i < pts.length; i++) out.push(pts[i])
    }
    return out
  }
  const lineRef = (line) => {
    const pts = line.map(Q)
    arcs.push(pts) // lines are not shared; one arc each
    return arcs.length - 1
  }

  /* geometry → string of varints: kind (0 Polygon, 1 MultiPolygon, 2 LineString, 3 MultiLineString), counts,
     ring rotation and arc refs. A ref of 0 means "the next new arc" (arcs are numbered in first-use order, so most
     refs are 0); otherwise r > 0 → arc r − 1, r < 0 → arc ~r walked backwards. Line arcs are always new: no ref. */
  let next = 0
  const refCode = (a) => {
    if (a === next) {
      next++
      return 0
    }
    if (a > next) throw new Error('topo: arc numbering out of order')
    return a >= 0 ? a + 1 : a
  }
  const ringsOut = (out, rs) => {
    put(out, rs.length)
    for (const r of rs) {
      const [rot, ...refs] = ringRef(r)
      put(out, rot)
      put(out, refs.length)
      for (const a of refs) put(out, refCode(a))
    }
  }
  const geom = (g) => {
    const out = []
    switch (g.type) {
      case 'Polygon':
        put(out, 0)
        ringsOut(out, g.coordinates)
        break
      case 'MultiPolygon':
        put(out, 1)
        put(out, g.coordinates.length)
        for (const p of g.coordinates) ringsOut(out, p)
        break
      case 'LineString':
        put(out, 2)
        lineRef(g.coordinates)
        next++
        break
      case 'MultiLineString':
        put(out, 3)
        put(out, g.coordinates.length)
        for (const l of g.coordinates) {
          lineRef(l)
          next++
        }
        break
      default:
        return { G: g }
    }
    return out.join('')
  }
  /* features: ids, properties (columnar when every feature has the same keys) and geometry strings */
  const fcOut = (features) => {
    for (const f of features) {
      const keys = Object.keys(f).filter((k) => !['type', 'id', 'properties', 'geometry'].includes(k))
      if (f.type !== 'Feature' || keys.length) throw new Error(`topo: unsupported feature keys ${keys}`)
    }
    const o = { n: features.length }
    const withId = features.filter((f) => 'id' in f).length
    if (withId === features.length) o.id = features.every((f) => f.id === f.properties?.id) ? 'p' : features.map((f) => f.id)
    else if (withId) throw new Error('topo: some features have an id, some do not')
    const keySets = new Set(features.map((f) => JSON.stringify(Object.keys(f.properties ?? {}))))
    if (keySets.size === 1 && features.every((f) => f.properties && typeof f.properties === 'object')) {
      const keys = JSON.parse([...keySets][0])
      const cols = {}
      for (const k of keys) cols[k] = features.map((f) => f.properties[k])
      // ids that follow the builder's rule (`${kecamatanId}-${slug(name)}`, or slug(name)) are left out (null)
      if (cols.id && cols.id.every((v) => typeof v === 'string') && cols.name?.every((v) => typeof v === 'string')) {
        cols.id = features.map((f) => (f.properties.id === derivedId(f.properties) ? null : f.properties.id))
        o.d = 1
      }
      o.c = cols
    } else o.r = features.map((f) => f.properties)
    o.g = features.map((f) => geom(f.geometry))
    return o
  }
  const walk = (v) => {
    if (!v || typeof v !== 'object') return v
    if (Array.isArray(v)) return v.map(walk)
    if (v.type === 'FeatureCollection' && Array.isArray(v.features)) {
      const { type: _t, features, ...rest } = v
      return { $fc: fcOut(features), ...rest }
    }
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]))
  }
  const data = walk(value)

  /* 3. arcs → strings */
  let px = 0
  let py = 0
  const arcStr = arcs.map((a) => {
    const out = []
    for (const [x, y] of a) {
      put(out, x - px)
      put(out, y - py)
      px = x
      py = y
    }
    return out.join('')
  })
  return { topo: 1, q, arcs: arcStr, data }
}
