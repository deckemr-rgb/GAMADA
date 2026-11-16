/**
 * map/flood.ts — deterministic flood-growth model (pure: no DOM, no MapLibre; runs under `npx tsx`).
 *
 * A lng/lat grid over the region gets, per cell, the hour at which water arrives ("onset"):
 *   - distance (km) to the scenario river (pack.scenario.floodRiverId: its lines + river-area polygon),
 *   - the pack's DERIVED hazard zones (hazards.flood: tinggi / sedang),
 *   - the kecamatan riskFlood (lower risk ⇒ slower spread),
 *   - smooth value noise (seeded) so the edge looks organic.
 * At scrubber hour h a cell is wet when onset ≤ h — the inundation grows outward from the river from +1 h to
 * +6 h. Same pack + seed ⇒ same picture and the same list of affected desa. Simulation, not a hydrological
 * model (the UI says so).
 */
import type { RegionGeo, RegionPack } from '../region/types'
import { distanceField, fillPoly, linesOf, makeGrid, polysOf, strokeLine, valueNoise, type Grid } from './geo'
import type { FloodImpact } from './types'

/* ------------------------------------------------------------------ constants (module-local) */
export const FLOOD = {
  /** grid width in cells (height follows the bbox aspect; ≈ 125 m per cell for Bojonegoro) */
  gridW: 640,
  /** scrubber range (hours) */
  maxHour: 6,
  /** noise lattice size in cells and its weight (hours) */
  noiseCells: 22,
  /** onset = base + distanceKm × perKm × (riskBias − risk) + noise × noiseH — per hazard level */
  zone: {
    tinggi: { base: 0.5, perKm: 1.5, noiseH: 2.2 },
    sedang: { base: 2.4, perKm: 1.6, noiseH: 2.6 },
    /** outside the derived zones only a thin strip along the river floods late */
    none: { base: 4.2, perKm: 5, noiseH: 1.6, maxKm: 0.45 },
  },
  riskBias: 1.6,
  /** kecamatan outside pack.scenario.floodKecamatanIds spread this much slower */
  offScenarioSlow: 1.8,
  /** share of the region that is wet at +6 h, first water at `startHour`, curve exponent (>1 = accelerating) */
  wetShareAt6: 0.11,
  startHour: 0.35,
  growthPow: 1.25,
  /** cells needing this much water time (h) to be fully opaque — gives a soft growing edge */
  edgeH: 0.35,
  /** time resolution of the per-desa lookup table (h) */
  binH: 0.05,
  /** share of a desa that must be wet before it counts as affected */
  desaMinShare: 0.06,
} as const

export interface FloodDesa {
  id: string
  name: string
  kecamatanId: string
  cells: number
  /** population estimate: kecamatan population spread evenly over its desa (pack has no desa population) */
  people: number
}

export interface FloodModel {
  grid: Grid
  /** hours until water arrives; Infinity = stays dry within the scenario */
  onset: Float32Array
  /** desa index + 1 per cell (0 = outside the region) */
  desaIdx: Int16Array
  desa: FloodDesa[]
  cellKm2: number
  /** per desa: cumulative wet cells at hour b × FLOOD.binH (b = 0 … bins), so lookups at any hour are O(desa) */
  wetCum: Uint32Array
  bins: number
  onsetMin: Float32Array
}

const cache = new WeakMap<RegionGeo, Map<number, FloodModel>>()

export function buildFloodModel(pack: RegionPack, geo: RegionGeo, seed = 1): FloodModel {
  const hit = cache.get(geo)?.get(seed)
  if (hit) return hit
  const grid = makeGrid(pack.bbox, FLOOD.gridW)
  const { w, h } = grid
  const n = w * h
  const [W, S, E, N] = pack.bbox
  const cellKm = ((E - W) * 111.32 * Math.cos((((S + N) / 2) * Math.PI) / 180)) / w
  const cellKm2 = cellKm * (((N - S) * 110.57) / h)

  // desa raster (falls back to kecamatan polygons if the pack has no desa geometry)
  const desaIdx = new Int16Array(n)
  const desa: FloodDesa[] = []
  const kecPop = new Map(pack.kecamatan.map((k) => [k.id, { pop: k.population, n: Math.max(1, k.desa.length) }]))
  const desaFeatures = geo.desa?.features.length ? geo.desa.features : geo.kecamatan.features
  for (const f of desaFeatures) {
    const p = f.properties ?? {}
    const id = String(p.id ?? f.id ?? '')
    const kecamatanId = String(p.kecamatanId ?? p.id ?? '')
    const kp = kecPop.get(kecamatanId)
    desa.push({ id, name: String(p.name ?? id), kecamatanId, cells: 0, people: kp ? kp.pop / kp.n : 0 })
    for (const poly of polysOf(f.geometry)) fillPoly(desaIdx, grid, poly, desa.length)
  }
  for (let i = 0; i < n; i++) {
    const d = desaIdx[i]!
    if (d) desa[d - 1]!.cells++
  }

  // hazard raster: 2 = tinggi, 1 = sedang
  const hz = new Uint8Array(n)
  const zones = [...geo.hazards.flood.features].sort((a, b) => (a.properties?.level === 'tinggi' ? 1 : 0) - (b.properties?.level === 'tinggi' ? 1 : 0))
  for (const f of zones) {
    const v = f.properties?.level === 'tinggi' ? 2 : 1
    for (const poly of polysOf(f.geometry)) fillPoly(hz, grid, poly, v)
  }

  // river seeds → distance field (km)
  const riverId = pack.scenario.floodRiverId
  const seedR = new Uint8Array(n)
  for (const f of geo.rivers.features) {
    const p = f.properties ?? {}
    if (p.id !== riverId && p.riverId !== riverId) continue
    if (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') for (const poly of polysOf(f.geometry)) fillPoly(seedR, grid, poly, 1)
    for (const line of linesOf(f.geometry)) strokeLine(seedR, grid, line, 1)
  }
  const dist = distanceField(seedR, w, h)

  const risk = new Map(pack.kecamatan.map((k) => [k.id, k.riskFlood]))
  const scen = new Set(pack.scenario.floodKecamatanIds)
  const slowOf = new Float32Array(desa.length)
  desa.forEach((dd, k) => (slowOf[k] = (FLOOD.riskBias - (risk.get(dd.kecamatanId) ?? 0.3)) * (scen.has(dd.kecamatanId) ? 1 : FLOOD.offScenarioSlow)))
  // noise on its coarse lattice, bilinear per row (valueNoise per cell is the hot spot otherwise)
  const nx = Math.ceil(w / FLOOD.noiseCells) + 2
  const ny = Math.ceil(h / FLOOD.noiseCells) + 2
  const lattice = new Float32Array(nx * ny)
  for (let j = 0; j < ny; j++) for (let k = 0; k < nx; k++) lattice[j * nx + k] = valueNoise(k + 0.5, j + 0.5, seed)
  const onset = new Float32Array(n)
  const Z = FLOOD.zone
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const d = desaIdx[i]!
      if (!d) {
        onset[i] = Infinity
        continue
      }
      const km = dist[i]! * cellKm
      const slow = slowOf[d - 1]!
      const fx = x / FLOOD.noiseCells
      const fy = y / FLOOD.noiseCells
      const lx = Math.floor(fx)
      const ly = Math.floor(fy)
      const tx = fx - lx
      const ty = fy - ly
      const sx = tx * tx * (3 - 2 * tx)
      const sy = ty * ty * (3 - 2 * ty)
      const a0 = lattice[ly * nx + lx]!
      const a1 = lattice[ly * nx + lx + 1]!
      const b0 = lattice[(ly + 1) * nx + lx]!
      const b1 = lattice[(ly + 1) * nx + lx + 1]!
      const nz = a0 + (a1 - a0) * sx + (b0 + (b1 - b0) * sx - a0 - (a1 - a0) * sx) * sy
      const z = hz[i]!
      if (z === 2) onset[i] = Z.tinggi.base + km * Z.tinggi.perKm * slow + nz * Z.tinggi.noiseH
      else if (z === 1) onset[i] = Z.sedang.base + km * Z.sedang.perKm * slow + nz * Z.sedang.noiseH
      else onset[i] = km > Z.none.maxKm ? Infinity : Z.none.base + km * Z.none.perKm + nz * Z.none.noiseH
    }

  // The raw score sets the ORDER in which cells get wet; remap it (histogram quantiles, O(n)) so the wet
  // area follows a steady curve: A(h) = A6 · ((h − start) / (6 − start))^growthPow, A6 = wetShareAt6 of the region.
  let regionCells = 0
  let lo = Infinity
  let hi = -Infinity
  for (let i = 0; i < n; i++) {
    if (desaIdx[i]) regionCells++
    const o = onset[i]!
    if (o === Infinity) continue
    if (o < lo) lo = o
    if (o > hi) hi = o
  }
  if (hi > lo) {
    const BINS = 4096
    const hist = new Uint32Array(BINS)
    const bin = (o: number) => Math.min(BINS - 1, Math.floor(((o - lo) / (hi - lo)) * BINS))
    for (let i = 0; i < n; i++) if (onset[i]! !== Infinity) hist[bin(onset[i]!)]!++
    const cum = new Float64Array(BINS + 1)
    for (let b = 0; b < BINS; b++) cum[b + 1] = cum[b]! + hist[b]!
    const target = Math.max(1, regionCells * FLOOD.wetShareAt6)
    const span = FLOOD.maxHour - FLOOD.startHour
    for (let i = 0; i < n; i++) {
      const o = onset[i]!
      if (o === Infinity) continue
      const b = bin(o)
      const within = hist[b] ? ((o - lo) / (hi - lo)) * BINS - b : 0
      const rank = cum[b]! + within * hist[b]!
      onset[i] = FLOOD.startHour + span * Math.pow(rank / target, 1 / FLOOD.growthPow)
    }
  }

  const bins = Math.round(FLOOD.maxHour / FLOOD.binH)
  const stride = bins + 1
  const wetCum = new Uint32Array(desa.length * stride)
  const onsetMin = new Float32Array(desa.length).fill(Infinity)
  for (let i = 0; i < n; i++) {
    const d = desaIdx[i]!
    if (!d) continue
    const o = onset[i]!
    if (o < onsetMin[d - 1]!) onsetMin[d - 1] = o
    if (o <= FLOOD.maxHour) wetCum[(d - 1) * stride + Math.max(0, Math.ceil(o / FLOOD.binH - 1e-9))]!++
  }
  for (let d = 0; d < desa.length; d++) for (let b = 1; b <= bins; b++) wetCum[d * stride + b]! += wetCum[d * stride + b - 1]!
  const model: FloodModel = { grid, onset, desaIdx, desa, cellKm2, wetCum, bins, onsetMin }
  const m = cache.get(geo) ?? new Map<number, FloodModel>()
  m.set(seed, model)
  cache.set(geo, m)
  return model
}

/** Wet cells per desa at `hour` from the lookup table (hour snapped down to FLOOD.binH). */
function wetAt(model: FloodModel, hour: number): (d: number) => number {
  const b = Math.max(0, Math.min(model.bins, Math.floor(hour / FLOOD.binH + 1e-9)))
  const stride = model.bins + 1
  return (d) => (hour <= 0 ? 0 : model.wetCum[d * stride + b]!)
}

/** Affected desa, kecamatan, people and area at `hour`. */
export function floodImpact(model: FloodModel, hour: number): FloodImpact {
  const wet = wetAt(model, hour)
  let cells = 0
  const list: FloodImpact['desa'] = []
  model.desa.forEach((d, i) => {
    const w = wet(i)
    cells += w
    const share = d.cells ? w / d.cells : 0
    if (share >= FLOOD.desaMinShare) list.push({ id: d.id, name: d.name, kecamatanId: d.kecamatanId, share, onset: model.onsetMin[i]!, people: Math.round(d.people * share) })
  })
  list.sort((a, b) => b.share - a.share || a.onset - b.onset)
  const kec = [...new Set(list.map((d) => d.kecamatanId))]
  return { hour, desa: list, kecamatanIds: kec, people: list.reduce((a, d) => a + d.people, 0), areaKm2: cells * model.cellKm2 }
}

/** Per-desa wet share at `hour` (for desa highlighting), indexed like model.desa. */
export function desaShares(model: FloodModel, hour: number): Float32Array {
  const wet = wetAt(model, hour)
  const out = new Float32Array(model.desa.length)
  model.desa.forEach((d, i) => (out[i] = d.cells ? wet(i) / d.cells : 0))
  return out
}

/* ------------------------------------------------------------------ painting */

/** Colours of the inundation (dusk palette: cyan water, pale rim on the advancing edge). */
const WATER = { fresh: [79, 209, 255], deep: [92, 132, 255], rim: [205, 244, 255] } as const

/** Writes RGBA (straight alpha) for `hour` into `px` (length w × h × 4). */
export function paintFlood(model: FloodModel, hour: number, px: Uint8ClampedArray): void {
  const { onset } = model
  const edge = FLOOD.edgeH
  for (let i = 0, j = 0; i < onset.length; i++, j += 4) {
    const t = hour - onset[i]!
    if (!(t > 0)) {
      px[j + 3] = 0
      continue
    }
    const a = t >= edge ? 1 : t / edge
    const depth = Math.min(1, t / 3)
    const rim = t < 0.22 ? 1 - t / 0.22 : 0
    const r = WATER.fresh[0] + (WATER.deep[0] - WATER.fresh[0]) * depth
    const g = WATER.fresh[1] + (WATER.deep[1] - WATER.fresh[1]) * depth
    const b = WATER.fresh[2] + (WATER.deep[2] - WATER.fresh[2]) * depth
    px[j] = r + (WATER.rim[0] - r) * rim
    px[j + 1] = g + (WATER.rim[1] - g) * rim
    px[j + 2] = b + (WATER.rim[2] - b) * rim
    px[j + 3] = 255 * a * (0.55 + 0.25 * depth + 0.15 * rim)
  }
}
