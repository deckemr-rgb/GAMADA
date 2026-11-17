/**
 * docs/nik.ts — the ONE specimen NIK / No. KK generator (owner-approved format, 2026-11-17). Used by the document
 * samples (docs/samples) and by the world seed (world/seed.ts), so every NIK in the demo follows the same rule:
 *   PP KK CC  DDMMYY  SSSS
 *   35 22 cc  (Kemendagri kecamatan code, e.g. Kalitidu 35.22.16)  birth date (women: DD + 40)  serial ≥ 9001 (specimen range)
 * The first six NIK digits are the Kemendagri / Dukcapil area code (Permendagri 72/2019), NOT the BPS code. The BPS
 * code (3522200 for Kalitidu) is only used for statistics. Region digits come from, in order:
 *   1. the region pack's `kecamatan[].kemendagri` ('35.22.16'),
 *   2. the built-in Bojonegoro table below (packs built before that field existed),
 *   3. the pack's BPS `code` (legacy fallback; ambiguous for codes that do not end in 0).
 */

export const NIK = {
  province: '35',
  regency: '22',
  /** specimen serial range */
  serialMin: 9001,
} as const

/**
 * Kemendagri kecamatan codes of Kabupaten Bojonegoro (35.22), keyed by region-pack kecamatan id. Public reference
 * data (Permendagri 72/2019, as listed in the cached wiki table tools/region/.cache/bojonegoro/wiki-bojonegoro.txt).
 */
export const BOJONEGORO_KEMENDAGRI: Record<string, { name: string; code: string }> = {
  ngraho: { name: 'Ngraho', code: '01' },
  tambakrejo: { name: 'Tambakrejo', code: '02' },
  ngambon: { name: 'Ngambon', code: '03' },
  ngasem: { name: 'Ngasem', code: '04' },
  bubulan: { name: 'Bubulan', code: '05' },
  dander: { name: 'Dander', code: '06' },
  sugihwaras: { name: 'Sugihwaras', code: '07' },
  kedungadem: { name: 'Kedungadem', code: '08' },
  kepohbaru: { name: 'Kepohbaru', code: '09' },
  baureno: { name: 'Baureno', code: '10' },
  kanor: { name: 'Kanor', code: '11' },
  sumberrejo: { name: 'Sumberrejo', code: '12' },
  balen: { name: 'Balen', code: '13' },
  kapas: { name: 'Kapas', code: '14' },
  bojonegoro: { name: 'Bojonegoro', code: '15' },
  kalitidu: { name: 'Kalitidu', code: '16' },
  malo: { name: 'Malo', code: '17' },
  purwosari: { name: 'Purwosari', code: '18' },
  padangan: { name: 'Padangan', code: '19' },
  kasiman: { name: 'Kasiman', code: '20' },
  temayang: { name: 'Temayang', code: '21' },
  margomulyo: { name: 'Margomulyo', code: '22' },
  trucuk: { name: 'Trucuk', code: '23' },
  sukosewu: { name: 'Sukosewu', code: '24' },
  kedewan: { name: 'Kedewan', code: '25' },
  gondang: { name: 'Gondang', code: '26' },
  sekar: { name: 'Sekar', code: '27' },
  gayam: { name: 'Gayam', code: '28' },
}

/**
 * Kecamatan used by the document specimens (docs/samples). `code` = Kemendagri kecamatan digits (NIK digits 5–6),
 * `bps` = BPS code (statistics only).
 */
export const SPECIMEN_KEC: Record<string, { name: string; code: string; bps: string }> = {
  kalitidu: { name: 'Kalitidu', code: '16', bps: '3522200' },
  trucuk: { name: 'Trucuk', code: '23', bps: '3522170' },
  kanor: { name: 'Kanor', code: '11', bps: '3522110' },
  bojonegoro: { name: 'Bojonegoro', code: '15', bps: '3522160' },
  balen: { name: 'Balen', code: '13', bps: '3522130' },
  sumberrejo: { name: 'Sumberrejo', code: '12', bps: '3522120' },
  dander: { name: 'Dander', code: '06', bps: '3522180' },
  kapas: { name: 'Kapas', code: '14', bps: '3522150' },
}

/** the part of a region-pack kecamatan the NIK generator needs */
export interface NikKecamatan {
  id: string
  /** BPS code (legacy fallback only) */
  code?: string | null
  /** Kemendagri code, '35.22.16' */
  kemendagri?: string | null
}

const digits = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '')

/** 6-digit NIK region prefix (province + regency + kecamatan, Kemendagri) for a kecamatan or a Bojonegoro kecamatan id. */
export function nikRegion(kec: string | NikKecamatan): string {
  const k: NikKecamatan = typeof kec === 'string' ? { id: kec } : kec
  const kmd = digits(k.kemendagri)
  if (kmd.length === 6) return kmd
  const bps = digits(k.code)
  const table = BOJONEGORO_KEMENDAGRI[k.id]
  if (table && (!bps || bps.startsWith(NIK.province + NIK.regency))) return `${NIK.province}${NIK.regency}${table.code}`
  if (bps.length >= 6) return bps.slice(0, 6)
  throw new Error(`no NIK region code for kecamatan ${k.id}`)
}

/** every valid NIK region prefix of a pack's kecamatan list */
export function nikRegions(kecamatan: readonly NikKecamatan[]): Set<string> {
  return new Set(kecamatan.map((k) => nikRegion(k)))
}

/** default for parseNik: every kecamatan of Kabupaten Bojonegoro */
export const BOJONEGORO_NIK_REGIONS: ReadonlySet<string> = new Set(Object.keys(BOJONEGORO_KEMENDAGRI).map((id) => nikRegion(id)))

/** "35.22.16 (Kalitidu)" style label for a NIK's region digits (Bojonegoro table; null when unknown) */
export function nikRegionName(nik: string): string | null {
  const s = digits(nik)
  if (s.slice(0, 4) !== NIK.province + NIK.regency) return null
  return Object.values(BOJONEGORO_KEMENDAGRI).find((k) => k.code === s.slice(4, 6))?.name ?? null
}

const two = (n: number) => String(n).padStart(2, '0')

/**
 * Build a specimen NIK. `kec` is a Bojonegoro kecamatan id or a region-pack kecamatan; `birth` is an ISO date
 * (YYYY-MM-DD).
 */
export function makeNik(kec: string | NikKecamatan, birth: string, gender: 'L' | 'P', serial: number): string {
  if (serial < NIK.serialMin || serial > 9999) throw new Error('specimen serial must be 9001..9999')
  const [y, m, d] = birth.split('-').map(Number) as [number, number, number]
  const dd = gender === 'P' ? d + 40 : d
  return `${nikRegion(kec)}${two(dd)}${two(m)}${two(y % 100)}${String(serial).padStart(4, '0')}`
}

/** No. KK: region (6) + issue date DDMMYY + serial ≥ 9001. */
export function makeNoKk(kec: string | NikKecamatan, issued: string, serial: number): string {
  const [y, m, d] = issued.split('-').map(Number) as [number, number, number]
  return `${nikRegion(kec)}${two(d)}${two(m)}${two(y % 100)}${String(serial).padStart(4, '0')}`
}

export interface NikParts {
  ok: boolean
  /** why it is not ok */
  problem?: 'length' | 'digits' | 'region' | 'date' | 'serial'
  region: string
  gender: 'L' | 'P' | null
  day: number
  month: number
  yy: number
  serial: number
}

/**
 * Format check (16 digits, known region code, plausible date, serial). `regions` = the valid 6-digit prefixes;
 * default: every Bojonegoro kecamatan. For another pack pass `nikRegions(pack.kecamatan)`.
 */
export function parseNik(nik: string, regions: ReadonlySet<string> = BOJONEGORO_NIK_REGIONS): NikParts {
  const s = nik.replace(/\s/g, '')
  const base: NikParts = { ok: false, region: s.slice(0, 6), gender: null, day: 0, month: 0, yy: 0, serial: 0 }
  if (!/^\d+$/.test(s)) return { ...base, problem: 'digits' }
  if (s.length !== 16) return { ...base, problem: 'length' }
  const d = Number(s.slice(6, 8))
  const month = Number(s.slice(8, 10))
  const yy = Number(s.slice(10, 12))
  const serial = Number(s.slice(12))
  const gender = d > 40 ? 'P' : 'L'
  const day = d > 40 ? d - 40 : d
  const parts = { ...base, gender, day, month, yy, serial } as NikParts
  if (!regions.has(s.slice(0, 6))) return { ...parts, problem: 'region' }
  if (month < 1 || month > 12 || day < 1 || day > 31) return { ...parts, problem: 'date' }
  if (serial < 1) return { ...parts, problem: 'serial' }
  return { ...parts, ok: true }
}

/** Does the NIK's date segment match a birth date (ISO) and gender? */
export function nikMatchesBirth(nik: string, birth: string, gender: 'L' | 'P', regions?: ReadonlySet<string>): boolean {
  const p = parseNik(nik, regions)
  if (!p.ok) return false
  const [y, m, d] = birth.split('-').map(Number) as [number, number, number]
  return p.day === d && p.month === m && p.yy === y % 100 && p.gender === gender
}

/** "17-11-2026" style used on the cards */
export function dmy(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}

const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
/** "17 November 2026" */
export function longDate(iso: string, lang: 'id' | 'en' = 'id'): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  const months = lang === 'id' ? MONTHS_ID : MONTHS_EN
  return `${d} ${months[m - 1] ?? ''} ${y}`
}
