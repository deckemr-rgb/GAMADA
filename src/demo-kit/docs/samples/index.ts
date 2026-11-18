/**
 * samples/ — every bundled sample document (data only, no React). Generated CVs are NOT resolved by getSample (that
 * kept the CV generator in every docs first load, e.g. Cek Berkas): build one with `cvDoc(cv)` from `./cv`.
 */
import type { SampleDoc, SampleKind } from '../types'
import { FINANCE } from './finance'
import { HOUSES } from './house'
import { IDENTITY } from './identity'
import { LETTERS } from './letters'
import { PERMITS } from './permits'

export { LETTERS } from './letters'
export { IDENTITY, SITI, BAMBANG, JOKO, KK_NO, type KtpPerson } from './identity'
export { PERMITS, DOMISILI_ISSUED } from './permits'
export { HOUSES } from './house'
export { FINANCE, FICTIONAL_BANK, BUYER, idr } from './finance'
export { generateCvs, cvDoc, CV } from './cv'

/** All fixed samples (CVs are generated on demand). */
export const SAMPLES: SampleDoc[] = [...LETTERS, ...IDENTITY, ...PERMITS, ...HOUSES, ...FINANCE]

const BY_ID = new Map(SAMPLES.map((s) => [s.id, s]))

export function getSample(id: string): SampleDoc | undefined {
  return BY_ID.get(id)
}

export function samplesOf(kind: SampleKind): SampleDoc[] {
  return SAMPLES.filter((s) => s.kind === kind)
}
