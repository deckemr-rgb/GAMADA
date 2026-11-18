/**
 * LocationCheck (lazy, after "Cek lokasi") — the NIB address pin and the site photo's GPS pin on the real desa
 * boundaries (MapView + desa layer), a 1 km ring around the NIB address and the distance label (kybCase().distanceKm).
 * The map kit and the desa JSON are fetched only here (after the action).
 */
import { useCallback, useMemo } from 'react'
import { MapView } from '../../demo-kit/map'
import type { LngLat, MapLayer, MapViewHandle } from '../../demo-kit/map'

/** a closed ring of `r` km around `c` (64 points) */
function ring(c: LngLat, r: number): LngLat[] {
  const out: LngLat[] = []
  const kx = 111.32 * Math.cos((c[1] * Math.PI) / 180)
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2
    out.push([c[0] + (r * Math.cos(a)) / kx, c[1] + (r * Math.sin(a)) / 110.57])
  }
  return out
}

interface RawMap {
  getSource(id: string): unknown
  addSource(id: string, src: unknown): void
  addLayer(layer: unknown): void
  getLayer(id: string): unknown
}

export default function LocationCheck({ regionId, nib, photo, distanceKm, far, labels }: {
  regionId: string
  nib: LngLat
  photo: LngLat
  distanceKm: number
  far: boolean
  labels: { title: string; pinNib: string; pinPhoto: string; ring: string; distance: string; verdict: string }
}) {
  const layers = useMemo<MapLayer[]>(
    () => [
      { id: 'km-kec', kind: 'kecamatan', labels: 'name' },
      { id: 'km-desa', kind: 'desa' },
      {
        id: 'km-pins',
        kind: 'markers',
        items: [
          { id: 'nib', coord: nib, icon: 'building', label: labels.pinNib, tone: 'accent' },
          { id: 'foto', coord: photo, icon: 'camera', label: labels.pinPhoto, detail: labels.distance, tone: far ? 'danger' : 'info' },
        ],
      },
    ],
    [nib, photo, far, labels.pinNib, labels.pinPhoto, labels.distance],
  )
  const center: LngLat = [(nib[0] + photo[0]) / 2, (nib[1] + photo[1]) / 2]
  const zoom = distanceKm < 1.5 ? 13.6 : distanceKm < 5 ? 12 : 10.9
  // the 1 km ring: a line layer on the MapLibre map (the kit has no circle layer; escape hatch)
  const onLayersReady = useCallback(
    (h: MapViewHandle) => {
      void h.loadDesa().catch(() => undefined)
      const m = h.raw() as RawMap | null
      if (!m) return
      try {
        if (!m.getSource('km-ring')) m.addSource('km-ring', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: ring(nib, 1) } } })
        if (!m.getLayer('km-ring')) m.addLayer({ id: 'km-ring', type: 'line', source: 'km-ring', paint: { 'line-color': '#e2a35a', 'line-width': 2, 'line-dasharray': [2, 1.5] } })
      } catch {
        /* style not ready: the pins and the distance label still tell the story */
      }
    },
    [nib],
  )
  return (
    <figure className="dk-km-map" data-km="map" aria-label={labels.title}>
      <MapView regionId={regionId} layers={layers} initialView={{ center, zoom }} minHeight={220} ariaLabel={labels.title} onLayersReady={onLayersReady} fullscreenButton={false} notice={{ placement: 'bottom' }} />
      <figcaption className={far ? 'is-far' : 'is-near'}>
        <b className="dk-num" data-km="distance">
          {labels.distance}
        </b>
        <span>{labels.verdict}</span>
        <span className="dk-km-muted">{labels.ring}</span>
      </figcaption>
    </figure>
  )
}
