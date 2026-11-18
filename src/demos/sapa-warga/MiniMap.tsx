/**
 * demos/sapa-warga/MiniMap.tsx — the real region map for the ticket detail (one pin + nearby duplicates) and the
 * cluster panel (heat of today's flood reports + cluster points). Lazy; MapLibre itself loads inside MapView.
 */
import { useEffect, useMemo, useRef } from 'react'
import { MapView } from '../../demo-kit/map/MapView'
import type { HeatPoint, MapLayer, MapViewHandle, MarkerItem } from '../../demo-kit/map/types'
import type { LngLat } from '../../demo-kit/world'

export default function MiniMap({ regionId, center, zoom = 12.5, markers, heat, label, onMarker, onReady, className }: {
  /** the real map has drawn its region (the static sketch above it can fade out) */
  onReady?: () => void
  regionId: string
  center: LngLat
  zoom?: number
  markers: MarkerItem[]
  heat?: HeatPoint[]
  label: string
  onMarker?: (id: string) => void
  className?: string
}) {
  const ref = useRef<MapViewHandle>(null)
  const layers = useMemo<MapLayer[]>(
    () => [
      { id: 'kec', kind: 'kecamatan', labels: 'name' },
      { id: 'rivers', kind: 'rivers' },
      ...(heat?.length ? [{ id: 'heat', kind: 'heat' as const, points: heat, radius: 26 }] : []),
      { id: 'pts', kind: 'markers', items: markers, size: 'sm' },
    ],
    [markers, heat],
  )
  const first = useRef(center)
  useEffect(() => {
    if (first.current[0] === center[0] && first.current[1] === center[1]) return
    first.current = center
    ref.current?.flyTo(center, zoom)
  }, [center, zoom])
  return (
    <MapView
      ref={ref}
      regionId={regionId}
      layers={layers}
      initialView={{ center, zoom }}
      ariaLabel={label}
      className={className}
      fullscreenButton={false}
      minHeight={0}
      onReady={onReady ? () => onReady() : undefined}
      onMarker={onMarker ? (_l, id) => onMarker(id) : undefined}
    />
  )
}
