/**
 * Peta (lazy, preloaded on the Daftar | Peta intent): the need's kecamatan centroid, the shortlisted UMKM (lit =
 * matched) and the unverified ones, with 5 / 10 / 20 km rings around the need. Text summary under the map.
 */
import { useCallback, useMemo } from 'react'
import { MapView, type MapLayer, type MapViewHandle } from '../../demo-kit/map'
import type { LngLat, WorldState } from '../../demo-kit/world'
import type { Card } from '../../demo-kit/world/pasar-daerah'
import { kecName, nf, type Lang } from './model'

type RawMap = {
  getSource(id: string): unknown
  addSource(id: string, src: unknown): void
  getLayer(id: string): unknown
  addLayer(layer: unknown): void
}
const RINGS = [5, 10, 20]
function ring(c: LngLat, km: number): LngLat[] {
  const out: LngLat[] = []
  const dLat = km / 111
  const dLng = km / (111 * Math.cos((c[1] * Math.PI) / 180))
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2
    out.push([c[0] + dLng * Math.cos(a), c[1] + dLat * Math.sin(a)])
  }
  return out
}

export default function NeedMap({ s, needId, cards, waiting, matched, lang }: { s: WorldState; needId: string; cards: Card[]; waiting: Card[]; matched: ReadonlySet<string>; lang: Lang }) {
  const n = s.catalogNeeds.byId[needId]
  const kec = s.region.kecamatan.find((k) => k.id === n?.kecamatanId)
  const center: LngLat = kec?.centroid ?? s.region.kecamatan[0]!.centroid
  const L = lang === 'id'
  const layers = useMemo<MapLayer[]>(
    () => [
      {
        id: 'kl-pins',
        kind: 'markers',
        items: [
          { id: 'need', coord: center, icon: 'pin', label: n ? `${n.code} · ${n.title[lang]}` : '', detail: kec?.name, tone: 'accent' },
          ...cards.map((c) => ({ id: c.business.id, coord: c.business.coord, icon: 'building' as const, label: c.business.name, detail: `${nf(lang, c.km, 1)} km · ${Math.round(c.score * 100)}%`, tone: matched.has(c.business.id) ? ('info' as const) : ('neutral' as const) })),
          ...waiting.map((c) => ({ id: c.business.id, coord: c.business.coord, icon: 'building' as const, label: c.business.name, detail: L ? 'Belum terverifikasi' : 'Not verified yet', tone: 'warn' as const })),
        ],
      },
    ],
    [center, cards, waiting, matched, n, kec, lang, L],
  )
  const onLayersReady = useCallback(
    (h: MapViewHandle) => {
      const m = h.raw() as RawMap | null
      if (!m) return
      try {
        if (!m.getSource('kl-rings'))
          m.addSource('kl-rings', { type: 'geojson', data: { type: 'FeatureCollection', features: RINGS.map((km) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: ring(center, km) } })) } })
        if (!m.getLayer('kl-rings')) m.addLayer({ id: 'kl-rings', type: 'line', source: 'kl-rings', paint: { 'line-color': '#c08ad0', 'line-width': 1.5, 'line-dasharray': [2, 2] } })
      } catch {
        /* style not ready: the pins and the summary still tell the story */
      }
    },
    [center],
  )
  return (
    <figure className="dk-kl-map" data-kl="map">
      <MapView regionId={s.regionId} layers={layers} initialView={{ center, zoom: 10.4 }} minHeight={320} ariaLabel={L ? 'Peta UMKM untuk kebutuhan ini' : 'Map of SMEs for this need'} onLayersReady={onLayersReady} fullscreenButton={false} notice={{ placement: 'bottom' }} />
      <figcaption className="dk-kl-muted">
        {L ? `Kebutuhan di Kec. ${kecName(s, n?.kecamatanId ?? '')}; cincin 5, 10, 20 km. ` : `Need in ${kecName(s, n?.kecamatanId ?? '')}; rings at 5, 10, 20 km. `}
        {cards.map((c) => `${c.business.name} ${nf(lang, c.km, 1)} km`).join(' · ')}
      </figcaption>
    </figure>
  )
}
