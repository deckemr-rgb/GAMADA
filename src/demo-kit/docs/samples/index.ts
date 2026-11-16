/**
 * samples/ — every bundled sample document (data only, no React). getSample(id) also resolves generated CVs
 * ("cv-0001" … "cv-0200").
 */
import type { SampleDoc, SampleKind } from '../types'
import { cvDoc, generateCvs } from './cv'
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
const cvDocs = new Map<string, SampleDoc>()

export function getSample(id: string): SampleDoc | undefined {
  const hit = BY_ID.get(id)
  if (hit) return hit
  if (/^cv-\d{4}$/.test(id)) {
    const c = cvDocs.get(id)
    if (c) return c
    const cv = generateCvs().find((x) => x.id === id)
    if (!cv) return undefined
    const d = cvDoc(cv)
    cvDocs.set(id, d)
    return d
  }
  return undefined
}

export function samplesOf(kind: SampleKind): SampleDoc[] {
  return SAMPLES.filter((s) => s.kind === kind)
}
