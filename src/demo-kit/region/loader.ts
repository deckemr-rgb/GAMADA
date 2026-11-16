/**
 * region/loader.ts — lazy, validated, cached access to region packs (spec §7).
 *
 * Each pack lives in packs/<id>/{pack.json, geo.json}; both are loaded with import.meta.glob so Vite emits
 * one chunk per file: a demo without a map never downloads geometry. Every file is zod-parsed exactly once
 * and the resulting promise is cached (a failed load is evicted so a retry can succeed).
 * Packs are BUILT by tools/region/*.mjs from public sources — do not hand-edit the JSON.
 */
import type { Lang } from '../../lib/i18n'
import { RegionGeo, RegionPack, type ComplaintCategory } from './types'

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

type JsonModule = { default: unknown }
const PACK_FILES = import.meta.glob<JsonModule>('./packs/*/pack.json')
const GEO_FILES = import.meta.glob<JsonModule>('./packs/*/geo.json')

const packCache = new Map<string, Promise<RegionPack>>()
const geoCache = new Map<string, Promise<RegionGeo>>()

function cachedLoad<T>(cache: Map<string, Promise<T>>, files: Record<string, () => Promise<JsonModule>>, id: string, file: string, parse: (v: unknown) => T): Promise<T> {
  const hit = cache.get(id)
  if (hit) return hit
  const importer = files[`./packs/${id}/${file}`]
  if (!importer) return Promise.reject(new Error(`region pack "${id}" not found (known: ${REGIONS.map((r) => r.id).join(', ')})`))
  const p = importer()
    .then((m) => parse(m.default))
    .catch((e: unknown) => {
      cache.delete(id)
      throw e instanceof Error ? e : new Error(String(e))
    })
  cache.set(id, p)
  return p
}

/** Load + validate a region pack (names, stats, kecamatan, services, language samples …). */
export function loadRegion(id: string = DEFAULT_REGION_ID): Promise<RegionPack> {
  return cachedLoad(packCache, PACK_FILES, id, 'pack.json', (v) => RegionPack.parse(v))
}

/** Load + validate the region's geometry (separate chunk, map demos only). */
export function loadRegionGeo(id: string = DEFAULT_REGION_ID): Promise<RegionGeo> {
  return cachedLoad(geoCache, GEO_FILES, id, 'geo.json', (v) => RegionGeo.parse(v))
}

/** Start downloading both files (e.g. on hover of a region switcher) without awaiting them. */
export function preloadRegion(id: string = DEFAULT_REGION_ID, withGeo = false): void {
  loadRegion(id).catch(() => {})
  if (withGeo) loadRegionGeo(id).catch(() => {})
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
