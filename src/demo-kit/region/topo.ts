/**
 * region/topo.ts — DECODER of the compact geometry wire form (packs/<id>/geo.min.json, desa.min.json), zod-free.
 *
 * The canonical geo.json / desa.json are plain GeoJSON (tools, tests, the lab). The browser fetches the .min form:
 * shared borders stored once as arcs (TopoJSON style), integer coordinates on a 1/q° grid, delta + zig-zag coded
 * 5 bits per character, properties as columns. Decoding gives back EXACTLY the canonical GeoJSON
 * (tools/region/validate.mjs deep-compares them) at well under half the gzip size. The encoder (build time only)
 * is tools/region/lib/topo.mjs, which documents the format.
 */

/** Same slug as region/wire.ts and the builders (inlined: this module is also run by plain node in validate.mjs). */
const slug = (s: string): string =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

type Pt = [number, number]
type Props = Record<string, unknown>
interface TopoFc {
  n: number
  id?: 'p' | (string | number)[]
  c?: Record<string, unknown[]>
  r?: Props[]
  d?: 1
  g: (string | { G: unknown })[]
}

export interface TopoWire {
  topo: 1
  q: number
  arcs: string[]
  data: unknown
}

export function isTopoWire(v: unknown): v is TopoWire {
  return typeof v === 'object' && v !== null && (v as { topo?: unknown }).topo === 1
}

const DIGIT = new Int8Array(128).fill(-1)
'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'.split('').forEach((c, i) => (DIGIT[c.charCodeAt(0)] = i))

/** zig-zag varints of one string */
function varints(s: string): number[] {
  const out: number[] = []
  let val = 0
  let mul = 1
  for (let i = 0; i < s.length; i++) {
    const d = DIGIT[s.charCodeAt(i)] ?? -1
    if (d < 0) throw new Error('topo: bad character')
    val += (d & 31) * mul
    if (d & 32) {
      mul *= 32
      continue
    }
    out.push(val % 2 ? -(val + 1) / 2 : val / 2)
    val = 0
    mul = 1
  }
  return out
}

/** Wire → the canonical JSON (FeatureCollections restored). Any other value passes through untouched. */
export function decodeTopo<T = unknown>(v: unknown): T {
  if (!isTopoWire(v)) return v as T
  const { q } = v
  // arcs: integer deltas, the cursor runs on across arcs
  let x = 0
  let y = 0
  const arcs: Pt[][] = v.arcs.map((s) => {
    const n = varints(s)
    const pts: Pt[] = []
    for (let i = 0; i < n.length; i += 2) pts.push([(x += n[i]!), (y += n[i + 1]!)])
    return pts
  })
  const pt = (p: Pt): Pt => [p[0] / q, p[1] / q]
  let next = 0
  const lineArc = (): Pt[] => arcs[next++]!.map(pt)

  const geom = (s: string): unknown => {
    const n = varints(s)
    let i = 0
    const ring = (): Pt[] => {
      const rot = n[i++]!
      const open: Pt[] = []
      for (let k = n[i++]!; k > 0; k--) {
        const r = n[i++]!
        const a = r === 0 ? next++ : r > 0 ? r - 1 : r
        const src = a < 0 ? arcs[~a]!.slice().reverse() : arcs[a]!
        for (let j = open.length ? 1 : 0; j < src.length; j++) open.push(src[j]!)
      }
      open.pop() // the closing vertex, re-added after the rotation
      const out: Pt[] = []
      for (let j = 0; j <= open.length; j++) out.push(pt(open[(j + rot) % open.length]!))
      return out
    }
    const poly = (): Pt[][] => {
      const out: Pt[][] = []
      for (let k = n[i++]!; k > 0; k--) out.push(ring())
      return out
    }
    const kind = n[i++]
    if (kind === 0) return { type: 'Polygon', coordinates: poly() }
    if (kind === 1) {
      const coordinates: Pt[][][] = []
      for (let k = n[i++]!; k > 0; k--) coordinates.push(poly())
      return { type: 'MultiPolygon', coordinates }
    }
    if (kind === 2) return { type: 'LineString', coordinates: lineArc() }
    const coordinates: Pt[][] = []
    for (let k = n[i++]!; k > 0; k--) coordinates.push(lineArc())
    return { type: 'MultiLineString', coordinates }
  }

  const fc = (t: TopoFc, rest: Props): unknown => {
    const features: unknown[] = []
    for (let f = 0; f < t.n; f++) {
      let properties: Props
      if (t.c) {
        properties = {}
        for (const k in t.c) properties[k] = t.c[k]![f]
        if (t.d && properties.id === null) {
          const name = String(properties.name)
          properties.id = properties.kecamatanId ? `${String(properties.kecamatanId)}-${slug(name)}` : slug(name)
        }
      } else properties = t.r![f]!
      const g = t.g[f]!
      const feature: Props = { type: 'Feature' }
      if (t.id) feature.id = t.id === 'p' ? properties.id : t.id[f]
      feature.properties = properties
      feature.geometry = typeof g === 'string' ? geom(g) : g.G
      features.push(feature)
    }
    return { type: 'FeatureCollection', features, ...rest }
  }
  const walk = (o: unknown): unknown => {
    if (!o || typeof o !== 'object') return o
    if (Array.isArray(o)) return o.map(walk)
    const { $fc, ...rest } = o as Props
    if ($fc) return fc($fc as TopoFc, rest)
    const out: Props = {}
    for (const k in rest) out[k] = walk(rest[k])
    return out
  }
  return walk(v.data) as T
}
