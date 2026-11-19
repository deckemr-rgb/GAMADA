/**
 * region/anchor.ts — Tahap 7: the places the flood story names, read from ANY pack (no region hard-coded), so the
 * meeting clip (media meetingBanjirFor) and the products (Naskah Pintar, Siaga Wilayah, Meja Pimpinan …) name the same
 * river, kecamatan, desa and market as the world seed (seed.ts uses the same kecamatan rule inline).
 *   kecamatan = scenario.meetingKecamatanId → else the first flood kecamatan → else the first kecamatan
 *   desa      = scenario.embankmentDesaId (inside that kecamatan) → else its first desa/kelurahan
 * Its own tiny module (not in the demo-core / demo-gen groups): only the products that call it load it.
 */
import type { RegionPack } from './types'

type Desa = { id: string; name: string; kind?: string }
type Kec = { id: string; name: string; desa: readonly Desa[] }
/** the parts of a RegionPack (or the world's RegionRef + scenario) the anchor needs */
export interface AnchorSource {
  shortName: string
  kecamatan: readonly Kec[]
  rivers?: readonly { id: string; name: string }[]
  markets?: readonly { id: string; name: string }[]
  scenario: Pick<RegionPack['scenario'], 'floodKecamatanIds'> & Partial<Pick<RegionPack['scenario'], 'floodRiverId' | 'shopMarketId' | 'meetingKecamatanId' | 'embankmentDesaId'>>
}

export interface FloodAnchor {
  /** the flood river's name ("Bengawan Solo"); '' when the pack lists no river */
  river: string
  /** the kecamatan of the meeting's camat + the embankment */
  kecamatanId: string
  kecamatan: string
  /** the desa / kelurahan of the seeping embankment (+ the evacuation point at its hall) */
  desaId: string
  desa: string
  /** 'desa' | 'kelurahan' (a kota has only kelurahan: "Kelurahan X", not "Desa X") */
  desaKind: 'desa' | 'kelurahan'
  /** names of all flood kecamatan, in scenario order */
  floodKecamatan: string[]
  /** the scenario market's name ('' when absent) */
  market: string
}

export function floodAnchor(p: AnchorSource): FloodAnchor {
  const sc = p.scenario
  const byId = new Map(p.kecamatan.map((k) => [k.id, k]))
  const kec = (sc.meetingKecamatanId && byId.get(sc.meetingKecamatanId)) || byId.get(sc.floodKecamatanIds[0] ?? '') || p.kecamatan[0]
  const desa = (kec && sc.embankmentDesaId && kec.desa.find((d) => d.id === sc.embankmentDesaId)) || kec?.desa[0]
  const river = (p.rivers ?? []).find((r) => r.id === sc.floodRiverId) ?? p.rivers?.[0]
  return {
    river: river?.name ?? '',
    kecamatanId: kec?.id ?? '',
    kecamatan: kec?.name ?? p.shortName,
    desaId: desa?.id ?? '',
    desa: desa?.name ?? kec?.name ?? p.shortName,
    desaKind: desa?.kind === 'kelurahan' ? 'kelurahan' : 'desa',
    floodKecamatan: sc.floodKecamatanIds.map((id) => byId.get(id)?.name).filter((n): n is string => !!n),
    market: (p.markets ?? []).find((m) => m.id === sc.shopMarketId)?.name ?? '',
  }
}
