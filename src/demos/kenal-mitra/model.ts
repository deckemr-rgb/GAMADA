/**
 * demos/kenal-mitra/model.ts — shared, tiny helpers of the product (first load): tabs, roles, focus routing, the case
 * lists per lane, the lender of the bank role and the "Tanya alasan" context store the lazy tabs fill.
 */
import type { VerificationRequest, WorldState } from '../../demo-kit/world'

export const SLUG = 'kenal-mitra' as const
export type KmTab = 'antrian' | 'kyc' | 'kyb' | 'cv' | 'minta' | 'hasil'
export type KmRole = 'analis' | 'bank'
export type Lane = VerificationRequest['kind']
export const kmRole = (r: string): KmRole => (r === 'bank-mitra' ? 'bank' : 'analis')
export const ANALYST_TABS: KmTab[] = ['antrian', 'kyc', 'kyb', 'cv']
export const BANK_TABS: KmTab[] = ['minta', 'hasil']
export const defaultTab = (role: KmRole): KmTab => (role === 'bank' ? 'minta' : 'antrian')

/** ?tab= on arrival (tour hooks: ?tab=kyb&focus=<request>) */
export function readTab(role: KmRole): KmTab {
  if (typeof window === 'undefined') return defaultTab(role)
  const v = new URLSearchParams(window.location.search).get('tab') as KmTab | null
  const ok = role === 'bank' ? BANK_TABS : ANALYST_TABS
  return v && ok.includes(v) ? v : defaultTab(role)
}

/** the lender of the bank role: the requester of the KYC requests (Koperasi Mitra Usaha Sejahtera on every pack) */
export function lenderOf(s: WorldState): string {
  for (const id of s.verificationRequests.ids) {
    const r = s.verificationRequests.byId[id]
    if (r?.kind === 'kyc') return r.requestedBy
  }
  return 'Koperasi Mitra Usaha Sejahtera'
}

/** the open requests of a lane (arrived by `now`) + the ones closed today, newest closed last */
export function casesOf(s: WorldState, kind: Lane, now: number): VerificationRequest[] {
  const out: VerificationRequest[] = []
  for (const id of s.verificationRequests.ids) {
    const r = s.verificationRequests.byId[id]
    if (!r || r.kind !== kind || r.at > now) continue
    if (r.status !== 'selesai') out.push(r)
    else if (r.verificationId && (s.verifications.byId[r.verificationId]?.at ?? -1) >= 0) out.push(r)
  }
  return out.sort((a, b) => Number(a.status === 'selesai') - Number(b.status === 'selesai') || Number(b.priority) - Number(a.priority) || a.at - b.at)
}

export interface FocusHit {
  tab: KmTab
  caseId: string | null
  /** bank role: open the certificate of this verification */
  certId?: string
}
const bare = (raw: string) => (raw.includes(':') ? raw.slice(raw.indexOf(':') + 1) : raw)
const tabOf = (k: Lane): KmTab => (k === 'kyc' ? 'kyc' : k === 'kyb' ? 'kyb' : 'cv')

/** ?focus=<id>: a request, a verification, a business, a KTP document or a candidate → tab + case; null = unknown */
export function resolveFocus(s: WorldState, raw: string, role: KmRole): FocusHit | null {
  const id = bare(raw)
  const reqs = s.verificationRequests
  const req = reqs.byId[id]
  if (req) return role === 'bank' ? { tab: 'minta', caseId: req.id } : { tab: tabOf(req.kind), caseId: req.id }
  const v = s.verifications.byId[id]
  if (v) {
    const r = reqs.ids.map((x) => reqs.byId[x]).find((x) => x?.verificationId === id) ?? null
    if (role === 'bank') return { tab: 'hasil', caseId: r?.id ?? null, certId: id }
    const k: Lane = v.kind === 'kyb' ? 'kyb' : v.kind === 'cv' ? 'cv' : 'kyc'
    return { tab: tabOf(k), caseId: r?.id ?? null }
  }
  const latestOf = (subjectId: string) =>
    reqs.ids
      .map((x) => reqs.byId[x])
      .filter((x): x is VerificationRequest => !!x && x.subjectId === subjectId)
      .sort((a, b) => Number(a.status === 'selesai') - Number(b.status === 'selesai') || b.at - a.at)[0] ?? null
  if (s.businesses.byId[id]) {
    const r = latestOf(id)
    return role === 'bank' ? { tab: r?.status === 'selesai' ? 'hasil' : 'minta', caseId: r?.id ?? null } : { tab: 'kyb', caseId: r?.id ?? null }
  }
  const d = s.documents.byId[id]
  if (d && d.program === 'kyc') {
    const r = latestOf(id)
    return role === 'bank' ? { tab: 'minta', caseId: r?.id ?? null } : { tab: 'kyc', caseId: r?.id ?? null }
  }
  if (s.candidates.byId[id]) return role === 'bank' ? null : { tab: 'cv', caseId: null }
  return null
}

/** minutes waited, as a short label */
export function waitLabel(min: number, lang: 'id' | 'en'): string {
  if (min < 60) return lang === 'id' ? `${min} mnt` : `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return lang === 'id' ? `${h} j ${m} mnt` : `${h} h ${m} min`
}

/* ------------------------------------------------------------------ "Tanya alasan" context (filled by the open case) */

export interface ReasonCheck {
  label: { id: string; en: string }
  ok: boolean
  note?: { id: string; en: string }
}
export interface ReasonCtx {
  kind: Lane | null
  /** request code + subject on screen */
  code?: string
  subject?: string
  checks?: ReasonCheck[]
  /** KYC risk 0–100 / KYB score 0–100 */
  score?: number
  /** setujui | tinjau | tolak (KYC) · lolos | cek-manual (KYB) */
  decision?: string
  decided?: boolean
  distanceKm?: number
  liveness?: boolean
  /** CV: criteria lines, top refs (anonymised) with fit + reason, funnel */
  criteria?: string[]
  top?: { ref: string; fit: number; reason: { id: string; en: string } }[]
  funnel?: number[]
  blind?: boolean
  /** anonymised pre-filtered candidates for the Live tool (≤ 30) */
  pool?: { ref: string; years: number; education: string; major: string; skills: string[] }[]
}
let ctx: ReasonCtx = { kind: null }
export const reasonCtx = {
  get: (): ReasonCtx => ctx,
  set: (c: ReasonCtx) => {
    ctx = c
  },
}

/** world minutes as a clock: "07.05" (ID) / "07:05" (EN) */
export function clockText(min: number, lang: 'id' | 'en'): string {
  const m = ((Math.floor(min) % 1440) + 1440) % 1440
  const s = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  return lang === 'id' ? s.replace(':', '.') : s
}

/** run `fn` after the next paint: the pressed control answers in this frame, the heavy work follows (INP) */
export const afterPaint = (fn: () => void): void => {
  requestAnimationFrame(() => setTimeout(fn, 0))
}
