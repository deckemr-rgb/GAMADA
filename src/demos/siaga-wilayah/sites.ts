/**
 * siaga-wilayah/sites.ts — SIMULATED land-use change sites for the Lingkungan tab (and the Geo-AI answers).
 * Places are real kecamatan (and, for the riverbank site, a point on the real scenario river); the changes, areas
 * and confidences are generated for the demo and labelled "simulasi" everywhere they show.
 */
import type { RegionGeo, RegionPack } from '../../demo-kit/region/types'
import type { Bi } from './strings'
import { floodAnchor } from '../../demo-kit/region/anchor'

export type LngLat = [number, number]
export type ChangeKind = 'tambang' | 'hutan' | 'permukiman' | 'industri'

export interface ChangeSite {
  id: string
  kind: ChangeKind
  center: LngLat
  /** blob radius (km) derived from the area */
  radiusKm: number
  kecamatanId: string
  kecamatanName: string
  areaHa: number
  confidence: number
  from: Bi
  to: Bi
}

const KIND: Record<ChangeKind, { prefer: string; areaHa: number; confidence: number; from: Bi; to: Bi }> = {
  tambang: {
    // prefer '' = the flood story's kecamatan (region/anchor), so the mining sits on the flooding river
    prefer: '', areaHa: 38, confidence: 0.91,
    from: { id: 'Bantaran sungai bervegetasi', en: 'Vegetated riverbank' }, to: { id: 'Galian pasir & kolam bekas tambang', en: 'Sand pits & mining ponds' },
  },
  hutan: {
    prefer: 'temayang', areaHa: 124, confidence: 0.88,
    from: { id: 'Hutan jati', en: 'Teak forest' }, to: { id: 'Lahan terbuka (tebangan)', en: 'Cleared land (logging)' },
  },
  permukiman: {
    prefer: 'kapas', areaHa: 46, confidence: 0.94,
    from: { id: 'Sawah irigasi', en: 'Irrigated rice fields' }, to: { id: 'Perumahan baru', en: 'New housing estate' },
  },
  industri: {
    prefer: 'gayam', areaHa: 85, confidence: 0.86,
    from: { id: 'Ladang & tegalan', en: 'Dry fields' }, to: { id: 'Kawasan industri & tapak sumur', en: 'Industrial estate & well pads' },
  },
}
const ORDER: ChangeKind[] = ['tambang', 'hutan', 'permukiman', 'industri']

function lines(geo: RegionGeo, main: boolean): LngLat[][] {
  const out: LngLat[][] = []
  for (const f of geo.rivers.features) {
    const p = (f.properties ?? {}) as { main?: boolean; kind?: string }
    if (main && !p.main) continue
    const g = f.geometry as { type: string; coordinates: unknown }
    if (g.type === 'LineString') out.push(g.coordinates as LngLat[])
    else if (g.type === 'MultiLineString') out.push(...(g.coordinates as LngLat[][]))
  }
  return out
}

/** nearest vertex of the main river to a point (≈ 100 m vertex spacing is plenty for a site marker) */
function nearestOnRiver(geo: RegionGeo, p: LngLat): LngLat | null {
  let best: LngLat | null = null
  let bd = Infinity
  for (const l of lines(geo, true))
    for (const c of l) {
      const d = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2
      if (d < bd) {
        bd = d
        best = c
      }
    }
  return best
}

const cache = new WeakMap<RegionGeo, ChangeSite[]>()

/** The four simulated change sites of a region (stable per pack + geo). */
export function changeSites(pack: RegionPack, geo: RegionGeo, centroids: Record<string, LngLat>): ChangeSite[] {
  const hit = cache.get(geo)
  if (hit) return hit
  const used = new Set<string>()
  const byRisk = (key: 'riskFlood' | 'riskLandslide') => [...pack.kecamatan].sort((a, b) => b[key] - a[key])
  const out: ChangeSite[] = []
  for (const kind of ORDER) {
    const def = KIND[kind]
    const prefer = def.prefer || floodAnchor(pack).kecamatanId
    let k = pack.kecamatan.find((x) => x.id === prefer && !used.has(x.id))
    if (!k) k = (kind === 'hutan' ? byRisk('riskLandslide') : kind === 'tambang' ? byRisk('riskFlood') : [...pack.kecamatan].reverse()).find((x) => !used.has(x.id))
    if (!k) continue
    used.add(k.id)
    const c = centroids[k.id] ?? pack.center
    let center: LngLat = [c[0], c[1]]
    if (kind === 'tambang') center = nearestOnRiver(geo, c) ?? center
    else if (kind === 'hutan') center = [c[0] + 0.012, c[1] - 0.014]
    else if (kind === 'industri') center = [c[0] - 0.008, c[1] + 0.006]
    out.push({
      id: `ALF-${out.length + 1}`, kind, center: [Math.round(center[0] * 1e5) / 1e5, Math.round(center[1] * 1e5) / 1e5],
      radiusKm: Math.sqrt(def.areaHa / 100 / Math.PI), kecamatanId: k.id, kecamatanName: k.name, areaHa: def.areaHa, confidence: def.confidence, from: def.from, to: def.to,
    })
  }
  cache.set(geo, out)
  return out
}

export const KIND_LABEL: Record<ChangeKind, Bi> = {
  tambang: { id: 'Tambang pasir bantaran', en: 'Riverbank sand mining' },
  hutan: { id: 'Pembukaan hutan', en: 'Forest clearing' },
  permukiman: { id: 'Sawah jadi perumahan', en: 'Rice fields to housing' },
  industri: { id: 'Ladang jadi kawasan industri', en: 'Fields to industrial estate' },
}
