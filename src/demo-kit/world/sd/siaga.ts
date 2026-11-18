/**
 * world/sd/siaga.ts — Siaga Wilayah: rain scenario, recipients, zone citizens, facilities, harvest.
 * Part of world/satu-daerah.ts (the barrel products import): one module per domain, so each product's chunk
 * carries only the selectors it uses. Numbers are SIMULATED (seeded world).
 */
import type { Alert, Bi, Citizen, Complaint, EventMap, Facility, Harvest, WorldState } from '../types'
import type { RegionPack } from '../../region/types'
import { createParamSelector } from '../selectors'
import { offsetKm, rows } from '../util'
import { unit } from './base'

/* ================================================================== Siaga Wilayah */


/** rain.forecast payload for the morning scenario: cells entering from the west over the flood kecamatan (deterministic) */
export function rainScenario(s: WorldState, horizonH = 6): EventMap['rain.forecast'] {
  const ks = s.region.floodKecamatanIds.map((id) => s.region.kecamatan.find((k) => k.id === id)).filter((k): k is NonNullable<typeof k> => !!k)
  const anchors = ks.length ? ks : s.region.kecamatan.slice(0, 2)
  const cells = anchors.slice(0, 4).map((k, i) => ({
    center: offsetKm(k.centroid, -14 - 4 * i, (i % 2 ? 1 : -1) * 2.5),
    radiusKm: 6 + (i % 3) * 2,
    intensity: [48, 36, 28, 22][i] ?? 20,
    heading: 80 + i * 6,
    speedKmh: 18 + i * 2,
  }))
  return { cells, horizonH, peakMmH: Math.max(...cells.map((c) => c.intensity)), kecamatanIds: anchors.map((k) => k.id) }
}

export interface Recipient {
  id: string
  /** title only (officials are never named) */
  title: Bi
  kind: 'camat' | 'kades' | 'lurah'
  kecamatanId: string
  desaId: string | null
  /** fictional, masked */
  phone: string
}
/** early-warning recipients per real kecamatan / desa: the camat and every kades / lurah (titles only, fictional numbers) */
export function alertRecipients(s: WorldState, kecamatanIds: string[], opts: { desaIds?: string[]; pack?: RegionPack | null } = {}): Recipient[] {
  const desaSet = opts.desaIds?.length ? new Set(opts.desaIds) : null
  const out: Recipient[] = []
  const phone = (key: string) => `08${12 + Math.floor(unit(key) * 87)}-xxxx-${String(Math.floor(unit(`${key}#`) * 9999)).padStart(4, '0')}`
  for (const kid of kecamatanIds) {
    const k = s.region.kecamatan.find((x) => x.id === kid)
    if (!k) continue
    out.push({ id: `camat:${kid}`, title: { id: `Camat ${k.name}`, en: `Head of ${k.name} district (Camat)` }, kind: 'camat', kecamatanId: kid, desaId: null, phone: phone(`camat:${kid}`) })
    const pk = opts.pack?.kecamatan.find((x) => x.id === kid)
    for (const d of k.desa) {
      if (desaSet && !desaSet.has(d.id)) continue
      const kel = pk?.desa.find((x) => x.id === d.id)?.kind === 'kelurahan'
      out.push({
        id: `${kel ? 'lurah' : 'kades'}:${d.id}`, kind: kel ? 'lurah' : 'kades', kecamatanId: kid, desaId: d.id, phone: phone(`desa:${d.id}`),
        title: kel ? { id: `Lurah ${d.name}`, en: `Head of ${d.name} urban village (Lurah)` } : { id: `Kepala Desa ${d.name}`, en: `Head of ${d.name} village (Kades)` },
      })
    }
  }
  return out
}

/** citizens who would receive a broadcast for these kecamatan (and desa) — the count shown before "Kirim" */
export function zoneCitizens(s: WorldState, kecamatanIds: string[], desaIds?: string[]): Citizen[] {
  const zone = new Set(kecamatanIds)
  const desa = desaIds?.length ? new Set(desaIds) : null
  return rows(s.citizens).filter((c) => zone.has(c.kecamatanId) && (!desa || desa.has(c.desaId)))
}

/** flood complaints that confirm an alert ("Terkonfirmasi warga") — from the alert's confirmations, else today's flood complaints in its zone */
export function confirmedComplaints(s: WorldState, alert: Alert | undefined): Complaint[] {
  if (!alert) return []
  if (alert.confirmedBy?.length) return alert.confirmedBy.map((id) => s.complaints.byId[id]).filter((c): c is Complaint => !!c)
  const zone = new Set(alert.kecamatanIds)
  return rows(s.complaints).filter((c) => c.category === 'banjir' && c.at >= alert.at - 12 * 60 && zone.has(c.kecamatanId))
}

/** facilities of some kinds (all when omitted); shelters carry origin 'simulasi' — label them so */
export const facilitiesOf = /*#__PURE__*/ createParamSelector((s) => [s.facilities], (kinds: string, t): Facility[] => {
  const want = kinds ? new Set(kinds.split(',')) : null
  return rows(t).filter((f) => !want || want.has(f.kind))
})

const harvestSel = /*#__PURE__*/ createParamSelector((s) => [s.harvests], (key: string, t): Record<string, number> => {
  const [metric, crop] = key.split('|') as ['estimate' | 'change' | 'ndvi', string]
  return harvestAgg({ harvests: t } as WorldState, metric, (crop || undefined) as Harvest['crop'] | undefined)
})
/** harvest choropleth values per kecamatan: 'estimate' (ton), 'change' (% vs normal) or 'ndvi' (0..1) for one crop or all. Memoised. */
export function harvestValues(s: WorldState, metric: 'estimate' | 'change' | 'ndvi', crop?: Harvest['crop']): Record<string, number> {
  return harvestSel(s, `${metric}|${crop ?? ''}`)
}
function harvestAgg(s: WorldState, metric: 'estimate' | 'change' | 'ndvi', crop?: Harvest['crop']): Record<string, number> {
  const agg = new Map<string, { base: number; now: number; ndvi: number; n: number }>()
  for (const h of rows(s.harvests)) {
    if (crop && h.crop !== crop) continue
    const a = agg.get(h.kecamatanId) ?? { base: 0, now: 0, ndvi: 0, n: 0 }
    a.base += h.baselineTon
    a.now += h.estimateTon
    a.ndvi += h.ndvi
    a.n++
    agg.set(h.kecamatanId, a)
  }
  const out: Record<string, number> = {}
  for (const [k, a] of agg) out[k] = metric === 'estimate' ? a.now : metric === 'ndvi' ? Math.round((a.ndvi / a.n) * 100) / 100 : a.base ? Math.round(((a.now - a.base) / a.base) * 1000) / 10 : 0
  return out
}
