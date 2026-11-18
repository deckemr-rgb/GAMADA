/**
 * demos/pajak-beres/rules.ts — EVERY tax rate, threshold, date and format Pajak Beres uses, each with its source
 * (owner-approved table, plan §6 P1, researched 18 Nov 2026). No other file of the product holds one of these
 * numbers: screens, exports and the AI answers read them from here. Simulation: not tax advice.
 *
 * Profile: the shop owner is an individual (orang pribadi), not VAT-registered (non-PKP), turnover below the
 * Rp 4,8 M line; 5 toko employees are on the monthly PPh 21 (TER) payroll.
 */
import { PPH_FINAL as KIT_PPH_FINAL } from '../../demo-kit/world/usaha-pintar'
import type { Bi, Ptkp } from '../../demo-kit/world'

export interface Source { ref: string; url: string; since: string }
export interface Rule { key: string; label: Bi; value: Bi; source: Source }

/** PPh Final UMKM, owned by the kit (the seed uses it); asserted equal below */
export const PPH_FINAL = KIT_PPH_FINAL
const PPH_FINAL_LOCAL = { rate: 0.005, exemptOmzetOP: 500_000_000, ceiling: 4_800_000_000, ref: 'PP 55/2022 jo. PP 20/2026' }
for (const k of Object.keys(PPH_FINAL_LOCAL) as (keyof typeof PPH_FINAL_LOCAL)[])
  if (PPH_FINAL_LOCAL[k] !== PPH_FINAL[k]) throw new Error(`pajak-beres rules.ts: PPH_FINAL.${k} differs from the kit`)

/** warning meter on the Rp 4,8 M line (80 %) */
export const CEILING_WARN = 0.8
/** PPh masa: pay by the 15th of the next month (holiday ⇒ next working day) — PMK 81/2024 */
export const SETOR_DAY = 15
/** SPT Masa PPh 21: file by the 20th of the next month — PMK 81/2024 */
export const LAPOR_DAY = 20
/** SPT Tahunan orang pribadi: 31 March of the next year */
export const SPT_OP_DUE = { month: 3, day: 31 }
/** "Ingatkan saya": the reminder fires 3 world days before a deadline */
export const REMIND_DAYS = 3
/** PTKP (Rp / year): TK/0 + per marriage + per dependant (max 3) — PMK 101/2016 */
export const PTKP = { base: 54_000_000, married: 4_500_000, perDependant: 4_500_000, maxDependants: 3 }
/** VAT, only for the "if you become PKP" answer: 12 % × DPP 11/12 (effectively 11 %) — PMK 131/2024 */
export const PPN = { rate: 0.12, dppNum: 11, dppDen: 12 }

const SRC = {
  pphFinal: { ref: 'PP 55/2022 jo. PP 20/2026', url: 'https://peraturan.bpk.go.id/Details/233488', since: '2022-12-20' },
  exempt: { ref: 'PP 55/2022 Ps. 60 ayat (2)', url: 'https://www.pajak.go.id/en/node/119950', since: '2022-12-20' },
  ceiling: { ref: 'PP 20/2026 · PMK 81/2024 Ps. 62', url: 'https://www.pajak.go.id/id/siaran-pers/batasan-omzet-pengusaha-kecil-wajib-ppn-dinaikkan', since: '2026-04-22' },
  who: { ref: 'PP 20/2026', url: 'https://peraturan.bpk.go.id/Details/349415/pp-no-20-tahun-2026', since: '2026-04-22' },
  setor: { ref: 'PMK 81/2024', url: 'https://peraturan.bpk.go.id/Details/306614', since: '2025-01-01' },
  lapor: { ref: 'PMK 81/2024', url: 'https://www.pajak.go.id/index.php/en/node/119382', since: '2025-01-01' },
  ter: { ref: 'PP 58/2023 · PMK 168/2023', url: 'https://www.pajak.go.id/en/node/105641', since: '2024-01-01' },
  ptkp: { ref: 'PMK 101/2016', url: 'https://pajak.go.id/id/node/110746', since: '2016-01-01' },
  ppn: { ref: 'PMK 131/2024', url: 'https://www.pajak.go.id/id/artikel/pmk-1312024-tarif-ppn-sebelas-dua-belas', since: '2025-01-01' },
  coretax: { ref: 'Template XML Coretax DJP', url: 'https://www.pajak.go.id/reformdjp/coretax/template-xml-dan-converter-excel-ke-xml', since: '2025-01-01' },
} satisfies Record<string, Source>
export { SRC as SOURCES }

/* ------------------------------------------------------------------ PPh 21 TER (monthly effective rates) */

export type TerCategory = 'A' | 'B' | 'C'
/** TER category by PTKP status (PP 58/2023 Ps. 2) */
export const TER_CATEGORY: Record<Ptkp, TerCategory> = { 'TK/0': 'A', 'TK/1': 'A', 'K/0': 'A', 'K/1': 'B', 'K/2': 'B', 'K/3': 'C' }
export interface TerRow { id: string; category: TerCategory; from: number; to: number; rate: number }
/** only the rows the 5 toko employees use (+ the next row of each band), copied from the PP 58/2023 annex */
export const TER_ROWS: readonly TerRow[] = [
  { id: 'A1', category: 'A', from: 0, to: 5_400_000, rate: 0 },
  { id: 'A2', category: 'A', from: 5_400_001, to: 5_650_000, rate: 0.0025 },
  { id: 'A3', category: 'A', from: 5_650_001, to: 5_950_000, rate: 0.005 },
  { id: 'B1', category: 'B', from: 0, to: 6_200_000, rate: 0 },
  { id: 'B2', category: 'B', from: 6_200_001, to: 6_500_000, rate: 0.0025 },
  { id: 'B3', category: 'B', from: 6_500_001, to: 6_850_000, rate: 0.005 },
  { id: 'C1', category: 'C', from: 0, to: 6_600_000, rate: 0 },
]
export const terRowOf = (category: TerCategory, gross: number): TerRow | null => TER_ROWS.find((r) => r.category === category && gross >= r.from && gross <= r.to) ?? null

/* ------------------------------------------------------------------ PPh Final helpers (the rule itself is the kit's) */

/** the part of a month's turnover above the yearly exempt line (individuals) */
export const taxableOmzet = (omzet: number, cumulativeBefore: number): number => Math.max(0, cumulativeBefore + omzet - Math.max(cumulativeBefore, PPH_FINAL.exemptOmzetOP))
/** first month of the year in which cumulative turnover crossed the exempt line ('YYYY-MM' or null) */
export function exemptCrossedIn(omzetByMonth: Record<string, number>, year: string): string | null {
  let cum = 0
  for (const m of Object.keys(omzetByMonth).filter((x) => x.startsWith(year)).sort()) {
    cum += omzetByMonth[m] ?? 0
    if (cum > PPH_FINAL.exemptOmzetOP) return m
  }
  return null
}
export const pctText = (rate: number, lang: 'id' | 'en'): string => `${(rate * 100).toLocaleString(lang === 'id' ? 'id-ID' : 'en-US', { maximumFractionDigits: 2 })}%`
