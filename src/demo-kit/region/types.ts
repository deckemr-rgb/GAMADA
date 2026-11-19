/**
 * region/types.ts — RegionPack schema (spec §7), zod-first. Packs are validated at BUILD time
 * (tools/region/validate.mjs) and, in dev only, again at load time; production never loads zod for a pack.
 *
 * A pack is split in two so demos without a map stay light:
 *   - RegionPack  (meta.json-sized: names, stats, kecamatan, services, languages …)  → every demo
 *   - RegionGeo   (GeoJSON: boundaries, rivers, roads, hazards)                      → map demos only
 * Real public data (geography, statistics, place names) is used as-is with a `sources` entry for
 * attribution. People, companies, media and transactions are NEVER in a pack: they are simulated
 * from the seed in world/seed.ts. Officials are referred to by title only.
 */
import { z } from 'zod'

export const LngLat = z.tuple([z.number(), z.number()])
export type LngLat = z.infer<typeof LngLat>

const Bi = z.object({ id: z.string(), en: z.string() })

/** Minimal GeoJSON (we only need what MapLibre and our SVG helpers read). */
export const Geometry = z.object({
  type: z.enum(['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon']),
  coordinates: z.unknown(),
})
export const Feature = z.object({
  type: z.literal('Feature'),
  id: z.union([z.string(), z.number()]).optional(),
  properties: z.record(z.string(), z.unknown()).nullable(),
  geometry: Geometry,
})
export const FeatureCollection = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(Feature),
})
export type FeatureCollection = z.infer<typeof FeatureCollection>

/** Attribution for one layer / dataset (shown in the map corner or a "Sumber" tooltip). */
export const Source = z.object({
  layer: z.string(),
  name: z.string(),
  url: z.string(),
  license: z.string(),
  year: z.union([z.number(), z.string()]).optional(),
  note: z.string().optional(),
})
export type Source = z.infer<typeof Source>

export const LandmarkKind = z.enum(['pasar', 'mpp', 'kantor', 'bendungan', 'rs', 'sekolah', 'pelabuhan', 'pengungsian', 'puskesmas'])
export type LandmarkKind = z.infer<typeof LandmarkKind>

export const RegionalLang = z.enum(['jv', 'su', 'min', 'bug', 'bjn', 'mad', 'bal', 'bat', 'other'])
export type RegionalLang = z.infer<typeof RegionalLang>

export const ComplaintCategory = z.enum([
  'banjir', 'jalan-rusak', 'sampah', 'pju', 'air-bersih', 'pohon-tumbang', 'pungli', 'kesehatan', 'sekolah', 'adminduk', 'bansos', 'lainnya',
])
export type ComplaintCategory = z.infer<typeof ComplaintCategory>

export const RegionPack = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(), // "Kabupaten Bojonegoro"
  shortName: z.string(), // "Bojonegoro"
  type: z.enum(['kabupaten', 'kota']),
  province: z.string(),
  slogan: z.string().nullable().optional(),
  center: LngLat,
  zoom: z.number(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]), // [west, south, east, north]
  stats: z.object({
    population: z.number(),
    households: z.number(),
    area_km2: z.number(),
    year: z.number(),
    source: z.string(),
  }),
  kecamatan: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      /** BPS code when known (statistics only, e.g. "3522200") */
      code: z.string().optional(),
      /** Kemendagri / Dukcapil area code (Permendagri 72/2019), e.g. "35.22.16". NIK and No. KK digits 1-6 use THIS, not `code`. */
      kemendagri: z.string().regex(/^\d{2}\.\d{2}\.\d{2}$/).optional(),
      population: z.number(),
      centroid: LngLat,
      riskFlood: z.number().min(0).max(1),
      riskLandslide: z.number().min(0).max(1),
      mainSector: z.string(),
      /** real desa/kelurahan names in this kecamatan (used for addresses) */
      desa: z.array(z.object({ id: z.string(), name: z.string(), kind: z.enum(['desa', 'kelurahan']), centroid: LngLat.optional() })),
    }),
  ),
  rivers: z.array(z.object({ id: z.string(), name: z.string() })),
  landmarks: z.array(z.object({ id: z.string(), name: z.string(), kind: LandmarkKind, coord: LngLat, kecamatanId: z.string().optional() })),
  /** real traditional markets */
  markets: z.array(z.object({ id: z.string(), name: z.string(), coord: LngLat, kecamatanId: z.string().optional() })),
  economy: z.object({
    sectors: z.array(z.object({ name: Bi, share: z.number() })),
    commodities: z.array(z.object({ id: z.string(), name: Bi, unit: z.string(), basePrice: z.number() })),
    umkmCount: z.number().optional(),
    source: z.string(),
  }),
  /** dinas names following common nomenclature */
  opd: z.array(z.object({ id: z.string(), name: z.string(), short: z.string() })),
  /** licensing & civil-registration services */
  services: z.array(
    z.object({
      id: z.string(),
      name: Bi,
      requirements: z.array(Bi),
      slaDays: z.number(),
      channel: z.enum(['mpp', 'online', 'kecamatan', 'dinas']),
      opdId: z.string(),
      fee: Bi,
    }),
  ),
  languages: z.object({
    primary: z.literal('id'),
    regional: z.array(RegionalLang),
    /** BCP-47 for Web Speech / TTS when the browser supports it, e.g. "jv-ID" */
    speechCodes: z.array(z.string()),
    samples: z.object({
      greetings: z.array(z.object({ lang: RegionalLang, text: z.string(), id: z.string(), en: z.string() })),
      /** ≥ 12, written in the regional language, with ID + EN translations */
      complaintTemplates: z.array(
        z.object({
          id: z.string(),
          lang: RegionalLang,
          category: ComplaintCategory,
          text: z.string(),
          translation: Bi,
          urgency: z.enum(['rendah', 'sedang', 'tinggi']),
        }),
      ),
    }),
  }),
  weather: z.object({ bmkgAreaCode: z.string().optional() }),
  branding: z.object({ emblem: z.literal('generic'), primaryHue: z.number() }),
  /** fictional-but-plausible scenario anchors (e.g. which dam / river the flood story uses) */
  scenario: z.object({
    floodRiverId: z.string(),
    damLandmarkId: z.string().optional(),
    floodKecamatanIds: z.array(z.string()),
    shopMarketId: z.string(),
    /** Tahap 7 (optional): the kecamatan whose camat speaks in the flood meeting + the desa/kelurahan of the seeping
     *  embankment (region/anchor.ts floodAnchor). Absent: the first flood kecamatan and its first desa. */
    meetingKecamatanId: z.string().optional(),
    embankmentDesaId: z.string().optional(),
  }),
  sources: z.array(Source),
})
export type RegionPack = z.infer<typeof RegionPack>

/** Heavy geometry, loaded only by map demos. Feature properties carry `id` matching the pack. */
export const RegionGeo = z.object({
  kecamatan: FeatureCollection,
  desa: FeatureCollection.optional(),
  rivers: FeatureCollection,
  roads: FeatureCollection.optional(),
  hazards: z.object({ flood: FeatureCollection, landslide: FeatureCollection.optional(), drought: FeatureCollection.optional() }),
})
export type RegionGeo = z.infer<typeof RegionGeo>

export type RegionId = string
