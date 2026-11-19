/**
 * world/up/mitra.ts — Kenal Mitra selectors and rules (SIMULATED scores): the queue, KPI, the KYB case of a business
 * (documents × fields matrix, GPS check, score), the KYC risk formula, the Katalog Lokal preview ranking, the blind CV
 * shortlist. Inputs never include name, gender, age or the kecamatan NAME.
 */
import type { Bi, Business, CatalogNeed, LngLat, Verification, VerificationRequest, WorldState } from '../types'
import type { CvRecord } from '../../docs/types'
import { createParamSelector, verifiedBusinesses } from '../selectors'
import { rankVerified } from '../pd/match'
import { distanceKm, offsetKm, rows } from '../util'
import { cvFit, type CvCriteria } from '../../docs/samples/cv-data'
import { desaName, kecName } from './base'
import { vendorProfile } from './shop'

export { cvFit, type CvCriteria }

export interface QueueRow { req: VerificationRequest; subject: string; waitingMin: number; needCode: string | null }
/** open requests: priority first, then the oldest */
export function verificationQueue(s: WorldState, now: number): QueueRow[] {
  return rows(s.verificationRequests)
    .filter((r) => r.status !== 'selesai' && r.at <= now)
    .sort((a, b) => Number(b.priority) - Number(a.priority) || a.at - b.at || a.id.localeCompare(b.id))
    .map((req) => ({ req, subject: subjectName(s, req), waitingMin: Math.max(0, now - req.at), needCode: req.needId ? (s.catalogNeeds.byId[req.needId]?.code ?? null) : null }))
}
export function subjectName(s: WorldState, r: Pick<VerificationRequest, 'subjectKind' | 'subjectId' | 'kind'>): string {
  if (r.subjectKind === 'business') return s.businesses.byId[r.subjectId]?.name ?? r.subjectId
  if (r.subjectKind === 'document') return s.documents.byId[r.subjectId]?.ownerName ?? r.subjectId
  if (r.kind === 'cv') return `${s.meta.facts.up?.kenalMitra.cvCount ?? 200} CV`
  return s.candidates.byId[r.subjectId]?.name ?? r.subjectId
}

/** KPI: queue size, done today, median minutes (SIMULATED, from today's closed requests; 4 before any), verified businesses */
export const verificationKpi = createParamSelector((s) => [s.verificationRequests, s.verifications, s.businesses], (now: number, reqs, verifs, businesses) => {
  const done = rows(reqs).filter((r) => r.status === 'selesai' && r.verificationId && (verifs.byId[r.verificationId]?.at ?? -1) >= 0)
  const mins = done.map((r) => (verifs.byId[r.verificationId!]?.at ?? r.at) - r.at).filter((m) => m >= 0).sort((a, b) => a - b)
  const median = mins.length ? mins[Math.floor(mins.length / 2)]! : 4
  return {
    queue: rows(reqs).filter((r) => r.status !== 'selesai' && r.at <= now).length,
    doneToday: done.length,
    medianMin: Math.max(1, Math.min(median, 30)),
    verified: verifiedBusinesses({ businesses } as WorldState).length,
  }
})

/** the latest verification of a subject */
export function verificationOf(s: WorldState, subjectId: string): Verification | null {
  return rows(s.verifications).filter((v) => v.subjectId === subjectId).sort((a, b) => b.at - a.at)[0] ?? null
}

/* ------------------------------------------------------------------ KYB */

export type KybField = 'nama' | 'pemilik' | 'alamat' | 'kbli'
export interface KybCase {
  businessId: string
  docs: { kind: 'nib' | 'npwp' | 'akta' | 'lokasi'; documentId: string | null; sampleId: string }[]
  matrix: { field: KybField; label: Bi; values: Partial<Record<'nib' | 'npwp' | 'akta' | 'lokasi', string>>; ok: boolean }[]
  owner: { name: string; kycDone: boolean; verificationId: string | null }
  gps: { nib: LngLat; photo: LngLat; photoKecamatanId: string }
  distanceKm: number
  score: number
  result: 'lolos' | 'cek-manual'
  /** the specimen mismatch the docs kit should draw (kybSpecimens(biz, { mismatch })) */
  mismatch: 'alamat' | 'nama' | null
}
const FIELD: Record<KybField, Bi> = { nama: { id: 'Nama usaha', en: 'Business name' }, pemilik: { id: 'Pemilik / direktur', en: 'Owner / director' }, alamat: { id: 'Alamat', en: 'Address' }, kbli: { id: 'KBLI', en: 'KBLI' } }
/** penalties: up to 20 points for the distance between the NIB address and the photo GPS (45 per km), 8 per field mismatch */
export const KYB_RULE = { kmPoints: 45, kmCap: 20, perMismatch: 8, pass: 80, manualKm: 5 }

/** the KYB case of a business (hero: 0,2 km, all ✓, 91 → lolos; the mismatch: ≈ 9 km + NPWP name ≠ → cek-manual) */
export const kybCase = createParamSelector((s) => [s.businesses, s.documents, s.verifications, s.region, s.meta.facts.up, s.staff], (bizId: string, businesses, documents, verifications, region, up, staff): KybCase | null => {
  const b = businesses.byId[bizId]
  if (!b) return null
  const st = { businesses, documents, verifications, region, staff, meta: { shopId: '' } } as unknown as WorldState
  const prof = vendorProfile(st, bizId)
  const mm = up?.kenalMitra.mismatchBusinessId === bizId
  const docOf = (kind: string) => rows(documents).find((d) => d.program === 'kyb' && d.sampleId === `${kind}-${bizId}`)?.id ?? null
  const kinds = (['nib', 'npwp', ...(b.legal === 'CV' || b.legal === 'PT' ? (['akta'] as const) : []), 'lokasi'] as const)
  // GPS of the location photo: the hero 0,2 km from the NIB address; the mismatch in the next kecamatan (≈ 9 km)
  let photo: LngLat = offsetKm(b.coord, 0.2, 0)
  let photoKec = b.kecamatanId
  if (mm) {
    const other = region.kecamatan.filter((k) => k.id !== b.kecamatanId).flatMap((k) => k.desa.map((d) => ({ k, d })))
    const best = other.sort((x, y) => Math.abs(distanceKm(b.coord, x.d.centroid) - 9) - Math.abs(distanceKm(b.coord, y.d.centroid) - 9))[0]
    if (best) {
      photo = best.d.centroid
      photoKec = best.k.id
    }
  } else if (bizId !== up?.kenalMitra.heroBusinessId) {
    const h = (b.id.charCodeAt(b.id.length - 1) % 7) / 10
    photo = offsetKm(b.coord, 0.1 + h * 0.5, 0.05)
  }
  const km = Math.round(distanceKm(b.coord, photo) * 10) / 10
  const addr = `Desa ${desaName(st, b.kecamatanId, b.desaId)}, Kec. ${kecName(st, b.kecamatanId)}`
  const photoAddr = mm ? `Kec. ${kecName(st, photoKec)} (GPS foto)` : addr
  const npwpName = mm ? b.name.replace(/\s+\S+$/, '').toUpperCase() : b.name.toUpperCase()
  const kb = prof?.kbli.map((k) => k.code).join(', ') ?? ''
  const matrix: KybCase['matrix'] = [
    { field: 'nama', label: FIELD.nama, values: { nib: b.name, npwp: npwpName, ...(kinds.includes('akta' as never) ? { akta: b.name } : {}) }, ok: !mm },
    { field: 'pemilik', label: FIELD.pemilik, values: { nib: b.ownerName, npwp: b.ownerName, ...(kinds.includes('akta' as never) ? { akta: b.ownerName } : {}) }, ok: true },
    { field: 'alamat', label: FIELD.alamat, values: { nib: addr, npwp: addr, lokasi: photoAddr }, ok: km <= KYB_RULE.manualKm },
    { field: 'kbli', label: FIELD.kbli, values: { nib: kb }, ok: true },
  ]
  const mismatches = matrix.filter((m) => !m.ok).length
  const score = Math.max(0, 100 - Math.min(KYB_RULE.kmCap, Math.round(km * KYB_RULE.kmPoints)) - KYB_RULE.perMismatch * mismatches)
  // the owner's KYC: done once a KYC verification of a document of that owner passed
  const kycDoc = rows(documents).find((d) => d.program === 'kyc' && d.ownerName === b.ownerName)
  const kyc = kycDoc ? rows(verifications).find((v) => v.subjectId === kycDoc.id && v.kind === 'kyc' && v.result === 'lolos') : undefined
  return {
    businessId: bizId, docs: kinds.map((kind) => ({ kind, documentId: docOf(kind), sampleId: `${kind}-${bizId}` })), matrix,
    owner: { name: b.ownerName, kycDone: !!kyc, verificationId: kyc?.id ?? null }, gps: { nib: b.coord, photo, photoKecamatanId: photoKec }, distanceKm: km, score,
    result: score >= KYB_RULE.pass && !mismatches ? 'lolos' : 'cek-manual', mismatch: mm ? 'nama' : null,
  }
})

/* ------------------------------------------------------------------ KYC */

export interface KycInput { tampered: boolean; fieldMismatches: number; livenessFail: boolean; addressKm: number }
/** risk 0–100 = 10 + 45 tamper + 8 per field mismatch + 30 liveness fail + 15 if the address is > 5 km away; < 30 setujui,
 *  30–69 tinjau, ≥ 70 tolak (Joko 18 setujui, the edited KTP 63 tinjau) */
export function kycRisk(i: KycInput): { score: number; decision: 'setujui' | 'tinjau' | 'tolak' } {
  const score = Math.max(0, Math.min(100, 10 + (i.tampered ? 45 : 0) + 8 * i.fieldMismatches + (i.livenessFail ? 30 : 0) + (i.addressKm > 5 ? 15 : 0)))
  return { score, decision: score < 30 ? 'setujui' : score < 70 ? 'tinjau' : 'tolak' }
}
/** the seeded KYC subjects' inputs (form vs KTP: the RT/RW is written differently on the form = 1 field mismatch) */
export function kycInputOf(s: WorldState, documentId: string): KycInput {
  const d = s.documents.byId[documentId]
  return { tampered: !!d?.tampered, fieldMismatches: 1, livenessFail: false, addressKm: 0 }
}

/* ------------------------------------------------------------------ Katalog Lokal preview */

export interface CatalogCard { business: Business; distanceKm: number; badges: { verified: boolean; taxTidy: boolean; score: number | null } }
/** open needs + the suppliers Katalog Lokal will rank (verified first, then distance): the "Pratinjau etalase" card */
const catalogSel = createParamSelector((s) => [s.catalogNeeds, s.businesses, s.bizScores, s.region, s.stock, s], (_key: string, needs, businesses, scores, region, _stock, st): { needs: CatalogNeed[]; suppliers: CatalogCard[] } => {
  const open = rows(needs).filter((n) => n.status === 'baru' || n.status === 'dicocokkan').sort((a, b) => b.at - a.at)
  const n0 = open[0]
  const cats = new Set(n0 ? n0.items.map((i) => i.category) : ['karung-pasir', 'terpal'])
  const kec = region.kecamatan.find((k) => k.id === n0?.kecamatanId) ?? region.kecamatan[0]
  const cards = rows(businesses)
    .filter((b) => b.supplies.some((x) => cats.has(x)))
    .map((b) => ({ business: b, distanceKm: kec ? Math.round(distanceKm(b.coord, kec.centroid) * 10) / 10 : 0, badges: { verified: b.verified, taxTidy: b.taxTidy, score: scores.byId[b.id]?.score ?? null } }))
    .sort((a, b) => Number(b.badges.verified) - Number(a.badges.verified) || a.distanceKm - b.distanceKm || a.business.id.localeCompare(b.business.id))
  // tahap 4: the verified ones in Katalog Lokal's order (matchScore desc, id asc = catalogShortlist().top) for the newest open need
  if (n0) {
    const rank = new Map(rankVerified(st as WorldState, n0.id).map((r, i) => [r.business.id, i]))
    cards.sort((a, b) => Number(b.badges.verified) - Number(a.badges.verified) || (a.badges.verified ? (rank.get(a.business.id) ?? 999) - (rank.get(b.business.id) ?? 999) : 0) || a.distanceKm - b.distanceKm || a.business.id.localeCompare(b.business.id))
  }
  return { needs: open, suppliers: cards }
})
/** `bizId` (optional) is the business the caller highlights; the ranking is the same for everyone */
export const catalogPreview = (s: WorldState, bizId?: string): { needs: CatalogNeed[]; suppliers: CatalogCard[] } => {
  void bizId
  return catalogSel(s, '*')
}

/* ------------------------------------------------------------------ CV shortlist */

export interface ShortlistRow { cv: CvRecord; fit: number; reason: Bi; label: string }
/** funnel + top 10 (fit desc, ties by id); `blind` only changes the label, never the ranking */
export function cvShortlist(cvs: CvRecord[], criteria: CvCriteria, blind: boolean, size = 10): { funnel: { total: number; education: number; years: number; skills: number; distance: number }; top: ShortlistRow[] } {
  const steps = { total: cvs.length, education: 0, years: 0, skills: 0, distance: 0 }
  const pass: { cv: CvRecord; fit: number; reason: Bi }[] = []
  for (const cv of cvs) {
    const e = cvFit(cv, { education: criteria.education })
    if (!e.pass) continue
    steps.education++
    if (!cvFit(cv, { minYears: criteria.minYears }).pass) continue
    steps.years++
    if (!cvFit(cv, { skills: criteria.skills }).pass) continue
    steps.skills++
    const f = cvFit(cv, criteria)
    if (!f.pass) continue
    steps.distance++
    pass.push({ cv, fit: f.fit, reason: f.reasons[0] ?? { id: '', en: '' } })
  }
  pass.sort((a, b) => b.fit - a.fit || a.cv.id.localeCompare(b.cv.id))
  return { funnel: steps, top: pass.slice(0, size).map((x) => ({ ...x, label: blind ? `Kandidat K-${x.cv.id.slice(-4)}` : x.cv.name })) }
}
/** the shop-distance function for the CV criteria (km from the shop to a kecamatan centroid) */
export function shopDistance(s: WorldState): (kecamatanId: string) => number {
  const shop = s.businesses.byId[s.meta.shopId]
  return (k) => {
    const kec = s.region.kecamatan.find((x) => x.id === k)
    return shop && kec ? distanceKm(shop.coord, kec.centroid) : 99
  }
}
