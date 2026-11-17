/**
 * map/strings.ts — shared formatting for the map module. The bilingual UI strings live in each file that shows
 * them (engine, MapView, MapLegend, …) so a demo pays only for the parts it renders (shared demo strings live in
 * demo-kit/i18n, owner: shell).
 */
import type { Lang } from '../../lib/i18n'

/** Plain-text basemap attribution (the HTML version with links is in basemap.ts). */
export const BASEMAP_ATTRIBUTION_TEXT = 'OpenFreeMap © OpenMapTiles Data from OpenStreetMap'

/** Number formatting per UI language (id: "1.234,5", en: "1,234.5"). */
const NF = new Map<string, Intl.NumberFormat>()
export function fmt(n: number, lang: Lang, digits = 0): string {
  // Intl.NumberFormat construction is slow — cache one per (lang, digits); fmt runs per frame in TimeScrubber
  const k = `${lang}|${digits}`
  let f = NF.get(k)
  if (!f) {
    f = new Intl.NumberFormat(lang === 'id' ? 'id-ID' : 'en-GB', { maximumFractionDigits: digits, minimumFractionDigits: digits })
    NF.set(k, f)
  }
  return f.format(n)
}

/**
 * Satellite imagery for the `imagery` layer: Sentinel-2 cloudless 2016 by EOX IT Services GmbH (contains modified
 * Copernicus Sentinel data 2016), CC BY 4.0, free, no API key. The 2016 mosaic is the CC BY edition (later years are
 * CC BY-NC-SA). Owner confirmation pending (docs/build/tahap2-plan.md, owner questions). Lives here (not basemap.ts)
 * so MapView can list it in the Sumber panel without pulling the engine-side basemap code.
 */
export const IMAGERY = {
  tiles: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg',
  maxzoom: 14,
  name: 'Sentinel-2 cloudless 2016 · EOX IT Services GmbH (contains modified Copernicus Sentinel data 2016)',
  url: 'https://s2maps.eu',
  license: 'CC BY 4.0',
  attribution: '<a href="https://s2maps.eu" target="_blank" rel="noopener">Sentinel-2 cloudless 2016</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016)',
} as const
