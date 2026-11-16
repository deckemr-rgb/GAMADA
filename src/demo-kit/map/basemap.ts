/**
 * map/basemap.ts — OpenFreeMap vector basemap ("dark" style, no API key) RE-STYLED in code to the dusk palette
 * of direction C: ink land, slightly lighter indigo water, muted roads, subtle labels. Layers that add noise at
 * regency scale (aeroways, rail dashes, one-way arrows, road names) are dropped. If the style cannot be fetched
 * (offline / blocked) a plain ink style is returned and the caller shows a notice — the region boundaries are
 * drawn by the engine either way, so the map is never blank.
 */
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl'
import { MAPC } from './palette'

export const BASEMAP = {
  styleUrl: 'https://tiles.openfreemap.org/styles/dark',
  /** give up on the style JSON after this long (ms) */
  timeoutMs: 6000,
  attribution:
    '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">© OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
  /** label font available on the OpenFreeMap glyph server */
  font: ['Noto Sans Regular'],
} as const

/** Basemap source id inside the restyled style (used to detect tile errors). */
export const BASEMAP_SOURCE = 'openmaptiles'

// place_* labels are dropped: our HTML kecamatan / desa labels own every zoom (no duplicate names)
const DROP = /^(aeroway|road_area_pier|road_pier|road_oneway|railway|highway_name|landcover_ice|landcover_glacier|place_|boundary_country_z0)/

type Paint = Record<string, unknown>

function restyleLayer(l: LayerSpecification): LayerSpecification | null {
  if (DROP.test(l.id)) return null
  const id = l.id
  const paint: Paint = {}
  const layout: Paint = { ...((l as { layout?: Paint }).layout ?? {}) }
  switch (true) {
    case id === 'background':
      paint['background-color'] = MAPC.land
      break
    case id === 'water':
      paint['fill-color'] = MAPC.water
      paint['fill-antialias'] = false
      break
    case id === 'waterway':
      paint['line-color'] = MAPC.waterLine
      paint['line-opacity'] = 0.8
      break
    case id === 'water_name':
      paint['text-color'] = '#7d76b8'
      paint['text-halo-color'] = MAPC.labelHalo
      paint['text-halo-width'] = 1
      break
    case id.startsWith('landuse_residential'):
      paint['fill-color'] = MAPC.landAlt
      paint['fill-opacity'] = 0.7
      break
    case id.startsWith('landcover_wood') || id.startsWith('landuse_park'):
      paint['fill-color'] = MAPC.wood
      paint['fill-opacity'] = 0.6
      break
    case id === 'building':
      paint['fill-color'] = MAPC.building
      paint['fill-outline-color'] = MAPC.roadMinor
      break
    case id === 'highway_path':
      paint['line-color'] = MAPC.roadMinor
      paint['line-dasharray'] = [1.5, 1.5]
      paint['line-opacity'] = 0.7
      break
    case id === 'highway_minor':
      paint['line-color'] = MAPC.roadMinor
      paint['line-opacity'] = 0.85
      paint['line-width'] = ['interpolate', ['exponential', 1.55], ['zoom'], 11, 0.6, 14, 1.8, 20, 16]
      break
    case id === 'highway_major_casing' || id === 'highway_motorway_casing':
      return null
    case id === 'highway_major_inner' || id === 'highway_major_subtle':
      paint['line-color'] = MAPC.roadMajor
      paint['line-width'] = ['interpolate', ['exponential', 1.3], ['zoom'], 6, 0.4, 10, 1.2, 14, 3, 20, 18]
      break
    case id === 'highway_motorway_inner' || id === 'highway_motorway_subtle':
      paint['line-color'] = MAPC.roadTrunk
      paint['line-width'] = ['interpolate', ['exponential', 1.4], ['zoom'], 5, 0.5, 10, 1.6, 14, 4, 20, 22]
      break
    case id.startsWith('boundary'):
      paint['line-color'] = MAPC.boundary
      paint['line-opacity'] = 0.6
      paint['line-dasharray'] = [3, 2]
      paint['line-width'] = 1
      break
    case id.startsWith('place_'):
      paint['text-color'] = MAPC.label
      paint['text-halo-color'] = MAPC.labelHalo
      paint['text-halo-width'] = 1.2
      paint['text-halo-blur'] = 0
      // icons (city dots) off: our own markers carry the meaning
      delete layout['icon-image']
      break
    default:
      // anything new in the upstream style: keep geometry, mute it
      if (l.type === 'line') paint['line-color'] = MAPC.roadMinor
      else if (l.type === 'fill') paint['fill-color'] = MAPC.landAlt
      else if (l.type === 'symbol') return null
      else if (l.type !== 'background') return null
  }
  if ('text-font' in layout) layout['text-font'] = [...BASEMAP.font]
  const base = l as unknown as Record<string, unknown>
  const out: Record<string, unknown> = { ...base, paint: { ...((base.paint as Paint) ?? {}), ...paint } }
  // fill-pattern (wood) needs the upstream sprite we do not load
  if (out.paint && typeof out.paint === 'object') delete (out.paint as Paint)['fill-pattern']
  if (Object.keys(layout).length) out.layout = layout
  return out as unknown as LayerSpecification
}

/** Fetch + restyle the OpenFreeMap style. Rejects on network / timeout so the caller can fall back. */
export async function loadBasemapStyle(signal?: AbortSignal): Promise<StyleSpecification> {
  const ctl = new AbortController()
  const timer = window.setTimeout(() => ctl.abort(), BASEMAP.timeoutMs)
  const onAbort = () => ctl.abort()
  signal?.addEventListener('abort', onAbort)
  try {
    const res = await fetch(BASEMAP.styleUrl, { signal: ctl.signal })
    if (!res.ok) throw new Error(`basemap style HTTP ${res.status}`)
    const style = (await res.json()) as StyleSpecification
    const layers = style.layers.map(restyleLayer).filter((l): l is LayerSpecification => !!l)
    const sources = { ...style.sources }
    const src = sources[BASEMAP_SOURCE]
    if (src && 'url' in src) sources[BASEMAP_SOURCE] = { ...src, attribution: BASEMAP.attribution } as typeof src
    // the raster natural-earth relief does not fit the dusk palette
    for (const k of Object.keys(sources)) if (k !== BASEMAP_SOURCE) delete sources[k]
    const used = new Set(layers.map((l) => ('source' in l ? l.source : undefined)))
    const kept = layers.filter((l) => !('source' in l) || used.has(l.source))
    // no sprite: place icons are removed and our marker badges are added with addImage()
    const { sprite: _sprite, ...rest } = style
    return { ...rest, sources, layers: kept }
  } finally {
    window.clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

/** Plain ink style used when the basemap is unavailable (boundaries still drawn on top). */
export function fallbackStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [{ id: 'background', type: 'background', paint: { 'background-color': MAPC.land } }],
  }
}

/** Ids of basemap layers that draw road / waterway lines — our boundary fills go beneath them. */
export function firstLineLayerId(style: StyleSpecification): string | undefined {
  return style.layers.find((l) => l.type === 'line' || l.type === 'symbol')?.id
}
