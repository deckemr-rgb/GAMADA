/**
 * docs/nik.ts — specimen NIK / No. KK (owner-approved format, 2026-11-17):
 *   PP KK CC  DDMMYY  SSSS
 *   35 22 cc  (real Bojonegoro kecamatan digits)  birth date (women: DD + 40)  serial ≥ 9001 (specimen range)
 * Kecamatan digits are taken from the region pack's BPS code (3522130 → "13"). Only kecamatan whose BPS code ends
 * in 0 are used, so the 2-digit code is unambiguous.
 */

export const NIK = {
  province: '35',
  regency: '22',
  /** specimen serial range */
  serialMin: 9001,
} as const

/** Real kecamatan of Kabupaten Bojonegoro (pack: bojonegoro, BPS codes) used by the specimens. */
export const SPECIMEN_KEC: Record<string, { name: string; code: string; bps: string }> = {
  kalitidu: { name: 'Kalitidu', code: '20', bps: '3522200' },
  trucuk: { name: 'Trucuk', code: '17', bps: '3522170' },
  kanor: { name: 'Kanor', code: '11', bps: '3522110' },
  bojonegoro: { name: 'Bojonegoro', code: '16', bps: '3522160' },
  balen: { name: 'Balen', code: '13', bps: '3522130' },
  sumberrejo: { name: 'Sumberrejo', code: '12', bps: '3522120' },
  dander: { name: 'Dander', code: '18', bps: '3522180' },
  kapas: { name: 'Kapas', code: '15', bps: '3522150' },
}
const VALID_KEC = new Set(Object.values(SPECIMEN_KEC).map((k) => k.code))

const two = (n: number) => String(n).padStart(2, '0')

/** Build a specimen NIK. `birth` is an ISO date (YYYY-MM-DD). */
export function makeNik(kecamatanId: string, birth: string, gender: 'L' | 'P', serial: number): string {
  const kec = SPECIMEN_KEC[kecamatanId]
  if (!kec) throw new Error(`no specimen code for kecamatan ${kecamatanId}`)
  if (serial < NIK.serialMin || serial > 9999) throw new Error('specimen serial must be 9001..9999')
  const [y, m, d] = birth.split('-').map(Number) as [number, number, number]
  const dd = gender === 'P' ? d + 40 : d
  return `${NIK.province}${NIK.regency}${kec.code}${two(dd)}${two(m)}${two(y % 100)}${String(serial).padStart(4, '0')}`
}

/** No. KK: region (6) + issue date DDMMYY + serial ≥ 9001. */
export function makeNoKk(kecamatanId: string, issued: string, serial: number): string {
  const kec = SPECIMEN_KEC[kecamatanId]
  if (!kec) throw new Error(`no specimen code for kecamatan ${kecamatanId}`)
  const [y, m, d] = issued.split('-').map(Number) as [number, number, number]
  return `${NIK.province}${NIK.regency}${kec.code}${two(d)}${two(m)}${two(y % 100)}${String(serial).padStart(4, '0')}`
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

/** Format check (16 digits, Bojonegoro region code, plausible date, serial). */
export function parseNik(nik: string): NikParts {
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
  if (s.slice(0, 4) !== NIK.province + NIK.regency || !VALID_KEC.has(s.slice(4, 6))) return { ...parts, problem: 'region' }
  if (month < 1 || month > 12 || day < 1 || day > 31) return { ...parts, problem: 'date' }
  if (serial < 1) return { ...parts, problem: 'serial' }
  return { ...parts, ok: true }
}

/** Does the NIK's date segment match a birth date (ISO) and gender? */
export function nikMatchesBirth(nik: string, birth: string, gender: 'L' | 'P'): boolean {
  const p = parseNik(nik)
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
