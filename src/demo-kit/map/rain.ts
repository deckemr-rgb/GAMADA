/**
 * map/rain.ts — deterministic rain-cell field and its motion (pure; the WebGL drawing is in rainLayer.ts).
 *
 * A cell's forecast `center` is where it sits at +RAIN.peakHour; before that it is upstream along its heading,
 * so at +0 the field waits at the map edge and moves in as the scrubber advances. While the layer animates, an
 * ambient drift is added; cells that leave the extended box re-enter on the opposite side outside the visible
 * region (faded), so the loop never jumps on screen.
 */
import { KM_PER_DEG_LAT, kmPerDegLng, type BBox } from './geo'
import type { LngLat, RainCellInput } from './types'
import type { RegionPack } from '../region/types'

export const RAIN = {
  /** scrubber hour at which cells sit on their forecast centre */
  peakHour: 3,
  /** ambient drift while animating, in km per real second */
  ambientKmPerSec: 1.6,
  /** the wrap box extends the region bbox by this many km on every side */
  marginKm: 45,
  /** cells fade in/out over this many km near the wrap box edge */
  fadeKm: 18,
  /** default field: number of cells and prevailing heading (deg, 0 = north; Nov monsoon: from the west) */
  count: 8,
  heading: 78,
} as const

/** Small seeded PRNG (same algorithm as world/seed mulberry32; local so this file stays dependency-free). */
function mulberry32(a: number): () => number {
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A deterministic default field around the scenario kecamatan (used when the world has no rain.forecast). */
export function defaultRainField(pack: RegionPack, seed = 1): RainCellInput[] {
  const rng = mulberry32((seed ^ 0x5eed) >>> 0)
  const focus = pack.kecamatan.filter((k) => pack.scenario.floodKecamatanIds.includes(k.id))
  const anchors = focus.length ? focus.map((k) => k.centroid) : [pack.center]
  const [W, S, E, N] = pack.bbox
  const cells: RainCellInput[] = []
  for (let i = 0; i < RAIN.count; i++) {
    const a = anchors[i % anchors.length]!
    // half the cells cluster over the flood kecamatan, the rest anywhere in the region
    const near = i < Math.ceil(RAIN.count / 2)
    const center: LngLat = near ? [a[0] + (rng() - 0.5) * 0.16, a[1] + (rng() - 0.5) * 0.12] : [W + rng() * (E - W), S + rng() * (N - S)]
    cells.push({
      center,
      radiusKm: near ? 7 + rng() * 6 : 4 + rng() * 5,
      intensity: near ? 30 + rng() * 35 : 6 + rng() * 22,
      heading: RAIN.heading + (rng() - 0.5) * 16,
      speedKmh: 18 + rng() * 10,
    })
  }
  return cells
}

export interface RainSprite {
  lng: number
  lat: number
  radiusKm: number
  /** 0…1 normalised intensity (60 mm/h ≈ 1) */
  power: number
  /** 0…1 fade near the wrap box edges */
  alpha: number
  seed: number
}

/** Positions of every cell at scrubber hour `hour` plus `ambientSec` seconds of drift. */
export function rainSprites(cells: RainCellInput[], bbox: BBox, hour: number, ambientSec: number, out: RainSprite[] = []): RainSprite[] {
  const [W, S, E, N] = bbox
  const midLat = (S + N) / 2
  const kx = kmPerDegLng(midLat)
  const ky = KM_PER_DEG_LAT
  const m = RAIN.marginKm
  // wrap box in km relative to the bbox south-west corner
  const x0 = -m
  const y0 = -m
  const bw = (E - W) * kx + 2 * m
  const bh = (N - S) * ky + 2 * m
  out.length = cells.length
  cells.forEach((c, i) => {
    const rad = (c.heading * Math.PI) / 180
    const dx = Math.sin(rad)
    const dy = Math.cos(rad)
    const travel = c.speedKmh * (hour - RAIN.peakHour) + RAIN.ambientKmPerSec * ambientSec * (c.speedKmh / 24)
    let x = (c.center[0] - W) * kx + dx * travel
    let y = (c.center[1] - S) * ky + dy * travel
    x = x0 + ((((x - x0) % bw) + bw) % bw)
    y = y0 + ((((y - y0) % bh) + bh) % bh)
    const edge = Math.min(x - x0, x0 + bw - x, y - y0, y0 + bh - y)
    const alpha = Math.max(0, Math.min(1, edge / RAIN.fadeKm))
    const s = out[i] ?? { lng: 0, lat: 0, radiusKm: 0, power: 0, alpha: 0, seed: 0 }
    s.lng = W + x / kx
    s.lat = S + y / ky
    s.radiusKm = c.radiusKm
    s.power = Math.max(0.1, Math.min(1, c.intensity / 60))
    s.alpha = alpha
    s.seed = (i * 0.618034) % 1
    out[i] = s
  })
  return out
}
