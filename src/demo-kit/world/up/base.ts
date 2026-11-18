/**
 * world/up/base.ts — small helpers of the Usaha Pintar world (names, picks, the shop's outlets, clip keys).
 */
import type { Bi, ClipKey, CriterionKey, Industry, Outlet, Tender, WorldState } from '../types'
import { hashString } from '../prng'

export const kecName = (s: WorldState, id: string): string => s.region.kecamatan.find((k) => k.id === id)?.name ?? id
export const desaName = (s: WorldState, kec: string, desa: string): string => s.region.kecamatan.find((k) => k.id === kec)?.desa.find((d) => d.id === desa)?.name ?? desa

/** deterministic pick from a key (reactions stay pure and reproducible) */
export const pickBy = <T>(arr: readonly T[], key: string): T => arr[hashString(key) % arr.length]!
/** deterministic 0..1 from a key */
export const unitOf = (key: string): number => (hashString(key) % 10_000) / 10_000

/** the pool entry used least recently (`lastUse(i)` = when entry i was last used, -Infinity when never); ties by key */
export function leastRecent<T>(pool: readonly T[], lastUse: (t: T, i: number) => number, key: string): T {
  let best = -1
  let bestAt = Infinity
  const off = hashString(key) % pool.length
  for (let k = 0; k < pool.length; k++) {
    const i = (k + off) % pool.length
    const at = lastUse(pool[i]!, i)
    if (at < bestAt) {
      bestAt = at
      best = i
    }
  }
  return pool[Math.max(0, best)]!
}

/** the scenario shop's outlets: toko (building supplies), kedai kopi, warung makan */
export function shopOutlets(s: WorldState): { toko?: Outlet; kopi?: Outlet; warung?: Outlet; all: Outlet[] } {
  const all = s.outlets.ids.map((id) => s.outlets.byId[id]!).filter((o) => o && o.businessId === s.meta.shopId).reverse()
  return { toko: all.find((o) => o.kind === 'toko'), kopi: all.find((o) => o.kind === 'fnb' && /kopi/i.test(o.name)), warung: all.find((o) => o.kind === 'fnb' && !/kopi/i.test(o.name)), all }
}
export type OutletKey = 'toko' | 'kopi' | 'warung'
/** outlet key ('toko' | 'kopi' | 'warung') of an outlet id */
export function outletKey(s: WorldState, outletId: string): OutletKey | null {
  const o = shopOutlets(s)
  return o.toko?.id === outletId ? 'toko' : o.kopi?.id === outletId ? 'kopi' : o.warung?.id === outletId ? 'warung' : null
}

/* ------------------------------------------------------------------ call clips (Juara Jualan owns the texts) */

export const IND_SHORT: Record<Industry, 'tb' | 'mf' | 'asr'> = { 'toko-bangunan': 'tb', multifinance: 'mf', asuransi: 'asr' }
export const IND_OF_SHORT: Record<'tb' | 'mf' | 'asr', Industry> = { tb: 'toko-bangunan', mf: 'multifinance', asr: 'asuransi' }
export interface ClipDef { key: ClipKey; industry: Industry; channel: 'telepon' | 'wa'; weak: CriterionKey }
const clip = (ind: 'tb' | 'mf' | 'asr', ch: 'wa' | 'tel', weak: CriterionKey): ClipDef => ({ key: `${ind}-${ch}-${weak}`, industry: IND_OF_SHORT[ind], channel: ch === 'wa' ? 'wa' : 'telepon', weak })
/**
 * The transcript keys: per industry 6 clips, one per weak criterion (tb 3 WA + 3 phone; mf / asr 5 phone + 1 WA) plus
 * the WA pre-order chat `tb-wa-prapesan` (C17). `mf-tel-keberatan` is media SALES_CALL (Rina Wulandari).
 */
export const CALL_CLIPS: readonly ClipDef[] = [
  clip('tb', 'wa', 'salam'), clip('tb', 'wa', 'gali'), clip('tb', 'wa', 'penawaran'), clip('tb', 'tel', 'keberatan'), clip('tb', 'tel', 'closing'), clip('tb', 'tel', 'kepatuhan'),
  clip('mf', 'tel', 'salam'), clip('mf', 'tel', 'gali'), clip('mf', 'tel', 'keberatan'), clip('mf', 'tel', 'penawaran'), clip('mf', 'tel', 'closing'), clip('mf', 'wa', 'kepatuhan'),
  clip('asr', 'tel', 'salam'), clip('asr', 'tel', 'gali'), clip('asr', 'tel', 'keberatan'), clip('asr', 'tel', 'penawaran'), clip('asr', 'tel', 'kepatuhan'), clip('asr', 'wa', 'closing'),
  { key: 'tb-wa-prapesan', industry: 'toko-bangunan', channel: 'wa', weak: 'closing' },
]
export const PRAPESAN_CLIP = 'tb-wa-prapesan'
export const clipOf = (key: ClipKey): ClipDef | undefined => CALL_CLIPS.find((c) => c.key === key)
/** the flag a weak criterion raises when it is below 60 */
export const FLAG_OF: Record<CriterionKey, string> = {
  keberatan: 'keberatan-tidak-dijawab', salam: 'lupa-salam', kepatuhan: 'janji-berlebihan', closing: 'tidak-closing', gali: 'tidak-gali-kebutuhan', penawaran: 'penawaran-tidak-jelas',
}

export const bi = (id: string, en: string): Bi => ({ id, en })

/** the Awas Belanja package of a tender (set, or created for it by C23 under the same key) */
export function procurementOfTender(s: WorldState, t: Tender): string | null {
  if (t.procurementId) return t.procurementId
  if (!t.key) return null
  for (const id of s.procurements.ids) if (s.procurements.byId[id]?.key === t.key) return id
  return null
}
