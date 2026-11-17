/**
 * map/ — barrel. Importing it never loads MapLibre: MapView pulls maplibre-gl (+ worker + CSS) with a dynamic
 * import() on mount, in its own chunk. Everything else here is plain React / pure data helpers.
 * ./package.json marks only the CSS files as side effects, so importing one part (say MapView) through this barrel
 * does not pull the other components or their CSS (legend.css, layer-toggle.css, time-scrubber.css, kecamatan-list.css).
 */
export { MapView } from './MapView'
export { MapLegend, type MapLegendProps, type LegendItem } from './MapLegend'
export { LayerToggle, type LayerToggleProps, type LayerToggleItem } from './LayerToggle'
export { TimeScrubber, SCRUB, type TimeScrubberProps } from './TimeScrubber'
export { KecamatanList, type KecamatanListProps } from './KecamatanList'
export { LANDMARK_STYLE, landmarkMarkers, marketMarkers, pointMarkers, heatPoints, countByKecamatan, perThousandKK, belowThreshold, choropleth, facilityMarkers, alertZones } from './layers'
export { resolveChoropleth, type ResolvedChoropleth } from './choro'
export { buildFloodModel, floodImpact, desaShares, FLOOD, type FloodModel } from './flood'
export { defaultRainField, rainSprites, RAIN } from './rain'
export { MAPC, RAMP, HEAT_RAMP, TONE_BADGE, toneColor } from './palette'
export type * from './types'
