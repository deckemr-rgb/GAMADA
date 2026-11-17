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
