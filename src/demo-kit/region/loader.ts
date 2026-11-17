/**
 * region/loader.ts — lazy, cached access to region packs (spec §7).
 *
 * Each pack lives in packs/<id>/: pack.json (canonical, for tools/tests) + pack.min.json (same content, compact
 * desa columns, see wire.ts), geo.json (kecamatan, rivers, roads, hazards) and desa.json (desa polygons, the
 * heaviest layer), each geometry file with a compact twin geo.min.json / desa.min.json (shared-arc topology,
 * see topo.ts; decodes to exactly the canonical GeoJSON). The browser FETCHES only the compact files, as static
 * assets (import.meta.glob '?url' → hashed files in dist/assets), so no geometry is ever parsed as JavaScript and
 * every file is downloaded only when asked for: a demo without a map never downloads geometry, and MapView loads
 * geo.min.json alone ({ desa: false }), fetching desa.min.json (loadRegionDesa) only when the map needs desa
 * (desa layer on / zoomed in, flood past +0 h, a caller).
 * Packs are validated at build time (tools/region/validate.mjs). In dev every file is zod-parsed once more on
 * load; production skips that, so zod is not part of any demo route through this module (type imports only).
 * The resulting promise is cached (a failed load is evicted so a retry can succeed).
 * Packs are BUILT by tools/region/*.mjs from public sources — do not hand-edit the JSON.
 */
import type { Lang } from '../../lib/i18n'
import type { ComplaintCategory, FeatureCollection, RegionGeo, RegionPack } from './types'
import { expandPack } from './wire'
import { decodeTopo } from './topo'

export type { RegionPack, RegionGeo } from './types'

/** Static registry so region pickers render without loading any pack. */
export const REGIONS = [{ id: 'bojonegoro', name: 'Kabupaten Bojonegoro', shortName: 'Bojonegoro', type: 'kabupaten' }] as const satisfies readonly {
  id: string
  name: string
  shortName: string
  type: 'kabupaten' | 'kota'
}[]

export type KnownRegionId = (typeof REGIONS)[number]['id']
export const DEFAULT_REGION_ID: KnownRegionId = 'bojonegoro'

export function isRegionId(id: string): id is KnownRegionId {
  return REGIONS.some((r) => r.id === id)
}

/* Only the URL strings are bundled (a few bytes each); the JSON is fetched on demand. */
const PACK_URLS = import.meta.glob<string>('./packs/*/pack.min.json', { query: '?url', import: 'default', eager: true })
const GEO_URLS = import.meta.glob<string>('./packs/*/geo.min.json', { query: '?url', import: 'default', eager: true })
const DESA_URLS = import.meta.glob<string>('./packs/*/desa.min.json', { query: '?url', import: 'default', eager: true })

type BaseGeo = Omit<RegionGeo, 'desa'>
const packCache = new Map<string, Promise<RegionPack>>()
const baseGeoCache = new Map<string, Promise<BaseGeo>>()
const desaCache = new Map<string, Promise<FeatureCollection>>()
const geoCache = new Map<string, Promise<RegionGeo>>()

function cached<T>(cache: Map<string, Promise<T>>, key: string, make: () => Promise<T>): Promise<T> {
  const hit = cache.get(key)
  if (hit) return hit
  const p = make().catch((e: unknown) => {
    cache.delete(key)
    throw e instanceof Error ? e : new Error(String(e))
  })
  cache.set(key, p)
  return p
}

async function fetchJson(urls: Record<string, string>, id: string, file: string): Promise<unknown> {
  const url = urls[`./packs/${id}/${file}`]
  if (!url) throw new Error(`region pack "${id}" has no ${file} (known: ${REGIONS.map((r) => r.id).join(', ')})`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`region pack "${id}": ${file} → HTTP ${res.status}`)
  return res.json()
}

/** Dev-only schema check (the dynamic import and zod are dropped from production builds). */
async function devCheck(kind: 'pack' | 'geo' | 'desa', v: unknown): Promise<void> {
  if (!import.meta.env.DEV) return
  const t = await import('./types')
  if (kind === 'pack') t.RegionPack.parse(v)
  else if (kind === 'geo') t.RegionGeo.parse(v)
  else t.FeatureCollection.parse(v)
}

/** Load a region pack (names, stats, kecamatan, services, language samples …). */
export function loadRegion(id: string = DEFAULT_REGION_ID): Promise<RegionPack> {
  return cached(packCache, id, async () => {
    const pack = expandPack(await fetchJson(PACK_URLS, id, 'pack.min.json'))
    await devCheck('pack', pack)
    return pack
  })
}

function loadBaseGeo(id: string): Promise<BaseGeo> {
  return cached(baseGeoCache, id, async () => {
    const geo = decodeTopo<BaseGeo>(await fetchJson(GEO_URLS, id, 'geo.min.json'))
    await devCheck('geo', geo)
    return geo
  })
}

/** Load only the desa/kelurahan polygons (the heaviest layer), e.g. when the desa layer is switched on. */
export function loadRegionDesa(id: string = DEFAULT_REGION_ID): Promise<FeatureCollection> {
  return cached(desaCache, id, async () => {
    const fc = decodeTopo<FeatureCollection>(await fetchJson(DESA_URLS, id, 'desa.min.json'))
    await devCheck('desa', fc)
    return fc
  })
}

export type LoadGeoOptions = {
  /** include desa polygons (default true, as before). Pass false when the map does not draw desa: saves ~22 KB gzip. */
  desa?: boolean
}

/**
 * Load the region's geometry (map demos only). Same object for the same (id, desa) pair, so callers can key
 * caches on it. `{ desa: false }` returns geometry without `desa`; fetch it later with loadRegionDesa(id).
 */
export function loadRegionGeo(id: string = DEFAULT_REGION_ID, opts: LoadGeoOptions = {}): Promise<RegionGeo> {
  const withDesa = opts.desa ?? true
  if (!withDesa) return loadBaseGeo(id)
  return cached(geoCache, id, async () => {
    const [geo, desa] = await Promise.all([loadBaseGeo(id), loadRegionDesa(id)])
    return { ...geo, desa }
  })
}

/** Start downloading (e.g. on hover of a region switcher) without awaiting. */
export function preloadRegion(id: string = DEFAULT_REGION_ID, withGeo = false, opts: LoadGeoOptions = {}): void {
  loadRegion(id).catch(() => {})
  if (withGeo) loadRegionGeo(id, opts).catch(() => {})
}

/* ------------------------------------------------------------------ text helpers */

type Bi = { id: string; en: string }
type Template = RegionPack['languages']['samples']['complaintTemplates'][number]

const TYPE_LABEL: Record<RegionPack['type'], Bi> = {
  kabupaten: { id: 'Kabupaten', en: 'Regency' },
  kota: { id: 'Kota', en: 'City' },
}

const CATEGORY_LABEL: Record<ComplaintCategory, Bi> = {
  banjir: { id: 'Banjir', en: 'Flood' },
  'jalan-rusak': { id: 'Jalan rusak', en: 'Damaged road' },
  sampah: { id: 'Sampah', en: 'Rubbish' },
  pju: { id: 'Lampu jalan', en: 'Street light' },
  'air-bersih': { id: 'Air bersih', en: 'Clean water' },
  'pohon-tumbang': { id: 'Pohon tumbang', en: 'Fallen tree' },
  pungli: { id: 'Pungli', en: 'Illegal levy' },
  kesehatan: { id: 'Kesehatan', en: 'Health' },
  sekolah: { id: 'Sekolah', en: 'School' },
  adminduk: { id: 'Adminduk', en: 'Civil registry' },
  bansos: { id: 'Bansos', en: 'Social aid' },
  lainnya: { id: 'Lainnya', en: 'Other' },
}

const LANG_NAME: Record<string, Bi> = {
  jv: { id: 'Basa Jawa', en: 'Javanese' },
  su: { id: 'Basa Sunda', en: 'Sundanese' },
  min: { id: 'Baso Minang', en: 'Minangkabau' },
  bug: { id: 'Basa Ugi', en: 'Buginese' },
  bjn: { id: 'Bahasa Banjar', en: 'Banjarese' },
  mad: { id: 'Bhasa Madhura', en: 'Madurese' },
  bal: { id: 'Basa Bali', en: 'Balinese' },
  bat: { id: 'Bahasa Batak', en: 'Batak' },
  other: { id: 'Bahasa daerah', en: 'Regional language' },
}

const PROVINCE_EN: Record<string, string> = {
  'Jawa Timur': 'East Java',
  'Jawa Tengah': 'Central Java',
  'Jawa Barat': 'West Java',
  'Sumatera Barat': 'West Sumatra',
  'Sumatera Utara': 'North Sumatra',
  'Sulawesi Selatan': 'South Sulawesi',
  'Kalimantan Selatan': 'South Kalimantan',
}

export const pick = (b: Bi, lang: Lang): string => b[lang]

/**
 * Language-aware labels for one pack. `name` is localised ("Bojonegoro Regency" in EN), numbers use the
 * locale's separators, and template text can be read in the regional language or a translation.
 */
export function regionText(pack: RegionPack, lang: Lang) {
  const nf = new Intl.NumberFormat(lang === 'id' ? 'id-ID' : 'en-GB')
  const nf1 = new Intl.NumberFormat(lang === 'id' ? 'id-ID' : 'en-GB', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
  const type = TYPE_LABEL[pack.type][lang]
  const desaCount = pack.kecamatan.reduce((a, k) => a + k.desa.length, 0)
  return {
    /** "Kabupaten Bojonegoro" / "Bojonegoro Regency" */
    name: lang === 'id' ? pack.name : `${pack.shortName} ${type}`,
    shortName: pack.shortName,
    typeLabel: type,
    /** "Bojonegoro, Jawa Timur" / "Bojonegoro, East Java" */
    place: `${pack.shortName}, ${lang === 'en' ? (PROVINCE_EN[pack.province] ?? pack.province) : pack.province}`,
    num: (n: number) => nf.format(n),
    /** "1,4 juta" / "1.4 million" */
    millions: (n: number) => `${nf1.format(n / 1e6)} ${lang === 'id' ? 'juta' : 'million'}`,
    /** "1,4 juta jiwa · 28 kecamatan · 430 desa/kelurahan · 2.307 km²" */
    summary: `${nf1.format(pack.stats.population / 1e6)} ${lang === 'id' ? 'juta jiwa' : 'million people'} · ${pack.kecamatan.length} ${lang === 'id' ? 'kecamatan' : 'districts'} · ${nf.format(desaCount)} ${lang === 'id' ? 'desa/kelurahan' : 'villages'} · ${nf.format(Math.round(pack.stats.area_km2))} km²`,
    statsSource: `${lang === 'id' ? 'Sumber' : 'Source'}: ${pack.stats.source}`,
    languageName: (code: string) => (LANG_NAME[code] ?? LANG_NAME.other!)[lang],
    category: (c: ComplaintCategory) => CATEGORY_LABEL[c][lang],
    /** template text in the regional language ('regional') or translated to the UI language */
    template: (t: Template, mode: 'regional' | 'translation' = 'translation') => (mode === 'regional' ? t.text : t.translation[lang]),
    kecamatanName: (id: string) => pack.kecamatan.find((k) => k.id === id)?.name ?? id,
    /** short attribution line for a map corner: every distinct licence, de-duplicated */
    attribution: [...new Set(pack.sources.filter((s) => /ODbL|CC BY|BPS/.test(s.license)).map((s) => (/ODbL/.test(s.license) ? '© OpenStreetMap contributors' : s.license.startsWith('CC BY') ? `HDX COD-AB (${s.license})` : 'BPS')))].join(' · '),
  }
}
export type RegionText = ReturnType<typeof regionText>
