/**
 * map/layers.ts — pure helpers that turn region-pack / world data into MapView layer specs (no MapLibre).
 * Boundaries, rivers and hazards come from loadRegionGeo() inside MapView itself; these helpers build the
 * data layers on top: choropleth values, heat points and marker sets with ui/icons glyphs.
 */
import type { Lang } from '../../lib/i18n'
import type { RegionPack } from '../region/types'
import type { LandmarkKind } from '../region/types'
import type { IconName } from '../ui/icons'
import type { Bi, ChoroplethLayer, HeatPoint, LngLat, MarkerItem, MapTone } from './types'

/** Glyph + label per landmark kind (badge glyphs from ui/icons). */
export const LANDMARK_STYLE: Record<LandmarkKind, { icon: IconName; label: Bi; tone: MapTone }> = {
  pasar: { icon: 'cart', label: { id: 'Pasar', en: 'Market' }, tone: 'accent' },
  kantor: { icon: 'building', label: { id: 'Kantor pemerintahan', en: 'Government office' }, tone: 'neutral' },
  rs: { icon: 'plus', label: { id: 'Rumah sakit', en: 'Hospital' }, tone: 'info' },
  puskesmas: { icon: 'plus', label: { id: 'Puskesmas', en: 'Health centre' }, tone: 'neutral' },
  sekolah: { icon: 'flag', label: { id: 'Sekolah', en: 'School' }, tone: 'neutral' },
  bendungan: { icon: 'water', label: { id: 'Bendungan', en: 'Dam' }, tone: 'info' },
  mpp: { icon: 'building', label: { id: 'Mal Pelayanan Publik', en: 'Public service mall' }, tone: 'neutral' },
  pelabuhan: { icon: 'truck', label: { id: 'Pelabuhan', en: 'Port' }, tone: 'neutral' },
  pengungsian: { icon: 'home', label: { id: 'Titik pengungsian', en: 'Evacuation point' }, tone: 'warn' },
}

/** Real landmarks of the pack as markers (optionally filtered by kind). */
export function landmarkMarkers(pack: RegionPack, lang: Lang, kinds?: LandmarkKind[]): MarkerItem[] {
  return pack.landmarks
    .filter((l) => !kinds || kinds.includes(l.kind))
    .map((l) => {
      const st = LANDMARK_STYLE[l.kind]
      const kec = l.kecamatanId ? pack.kecamatan.find((k) => k.id === l.kecamatanId)?.name : undefined
      return { id: l.id, coord: l.coord, icon: st.icon, label: l.name, detail: kec ? `${st.label[lang]} · ${kec}` : st.label[lang], tone: st.tone }
    })
}

/** Real traditional markets of the pack (`highlightId` gets the warn tone, e.g. a price anomaly). */
export function marketMarkers(pack: RegionPack, lang: Lang, opts: { highlightIds?: string[]; detail?: (id: string) => string | undefined } = {}): MarkerItem[] {
  return pack.markets.map((m) => {
    const kec = m.kecamatanId ? pack.kecamatan.find((k) => k.id === m.kecamatanId)?.name : undefined
    return {
      id: m.id,
      coord: m.coord,
      icon: 'cart',
      label: m.name,
      detail: opts.detail?.(m.id) ?? (kec ? `${LANDMARK_STYLE.pasar.label[lang]} · ${kec}` : LANDMARK_STYLE.pasar.label[lang]),
      tone: opts.highlightIds?.includes(m.id) ? 'warn' : 'accent',
    }
  })
}

interface Located {
  id: string
  coord: LngLat
  kecamatanId: string
}

/** Heat points from located items (complaints, sales …), optional weight per item. */
export function heatPoints<T extends { coord: LngLat }>(items: T[], weight?: (x: T) => number): HeatPoint[] {
  return items.map((x) => ({ coord: x.coord, weight: weight ? weight(x) : 1 }))
}

/** Count items per kecamatan id. */
export function countByKecamatan(items: { kecamatanId: string }[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const x of items) out[x.kecamatanId] = (out[x.kecamatanId] ?? 0) + 1
  return out
}

/**
 * Rate per 1 000 households (KK) by kecamatan. The pack has households for the whole region only, so each
 * kecamatan gets households ∝ its population (stated in the legend note).
 */
export function perThousandKK(pack: RegionPack, counts: Record<string, number>): Record<string, number> {
  const ratio = pack.stats.households / Math.max(1, pack.stats.population)
  const out: Record<string, number> = {}
  for (const k of pack.kecamatan) {
    const kk = k.population * ratio
    out[k.id] = kk > 0 ? ((counts[k.id] ?? 0) / kk) * 1000 : 0
  }
  return out
}

/** Kecamatan ids whose underlying count is below the anonymity threshold (rendered as hatch). */
export function belowThreshold(pack: RegionPack, counts: Record<string, number>, min: number): string[] {
  return pack.kecamatan.filter((k) => (counts[k.id] ?? 0) < min).map((k) => k.id)
}

/** Convenience builder for a choropleth spec. */
export function choropleth(id: string, values: Record<string, number>, opts: Omit<ChoroplethLayer, 'id' | 'kind' | 'values'> = {}): ChoroplethLayer {
  return { id, kind: 'choropleth', values, ...opts }
}

/** Marker items for located world entities (e.g. complaints: tone by urgency). */
export function pointMarkers<T extends Located>(items: T[], f: (x: T) => { label: string; detail?: string; icon?: IconName; tone?: MapTone }): MarkerItem[] {
  return items.map((x) => {
    const m = f(x)
    return { id: x.id, coord: x.coord, icon: m.icon ?? 'pin', label: m.label, detail: m.detail, tone: m.tone ?? 'neutral' }
  })
}
