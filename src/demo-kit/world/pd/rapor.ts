/**
 * world/pd/rapor.ts — Rapor Usaha selectors (scores, loans and consents are SIMULATED; "bukan keputusan kredit").
 * Score = `computeScore` = `bizScores` (the badge everywhere); the waterfall sums exactly from the peer median to it.
 * Loan maths (§6 P2): plafon = floor to Rp 5 jt of the Sep–Oct average net profit × band multiplier, capped per band
 * (LOAN.cap: Baik 100 jt, Sangat baik 150 jt); flat rate per band;
 * installment = ceil to Rp 1.000 of (amount / tenor + amount × rate).
 */
import type { Bi, Business, Consent, LoanApp, ScoreFactor, WorldState } from '../types'
import type { ProductSlug } from '../../../content/products'
import { SCORE_WEIGHTS, computeScore, pendingReviews, scoreOf } from '../score'
import { monthOf, rows } from '../util'
import { pnlMonthly } from '../up/books'
import { LOAN } from './config'
import { badgesOf, type Badges } from './katalog'
import { installment } from './loan-math'

export const SCORE_BANDS: readonly { min: number; label: Bi; tone: 'danger' | 'warn' | 'info' | 'ok' | 'accent' }[] = [
  { min: 0, label: { id: 'Perlu perhatian', en: 'Needs attention' }, tone: 'danger' },
  { min: 550, label: { id: 'Cukup', en: 'Fair' }, tone: 'warn' },
  { min: 650, label: { id: 'Baik', en: 'Good' }, tone: 'info' },
  { min: 750, label: { id: 'Sangat baik', en: 'Very good' }, tone: 'ok' },
  { min: 850, label: { id: 'Prima', en: 'Excellent' }, tone: 'accent' },
]
/** band index (0..4) of a score */
export function bandOf(score: number): number {
  let i = 0
  for (let k = 0; k < SCORE_BANDS.length; k++) if (score >= SCORE_BANDS[k]!.min) i = k
  return i
}

const FACTORS: ScoreFactor[] = ['omzet', 'margin', 'pajak', 'supplier', 'kyb', 'pertumbuhan']
const SOURCE: Record<ScoreFactor, ProductSlug> = { omzet: 'toko-autopilot', margin: 'pajak-beres', pajak: 'pajak-beres', supplier: 'toko-autopilot', kyb: 'kenal-mitra', pertumbuhan: 'toko-autopilot' }
const median = (a: number[]) => {
  const x = [...a].sort((p, q) => p - q)
  return x.length ? (x.length % 2 ? x[(x.length - 1) / 2]! : (x[x.length / 2 - 1]! + x[x.length / 2]!) / 2) : 0
}
const pct = (v: number) => `${Math.round(v * 100)}%`
const rp = (n: number) => `Rp ${(n / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`
const rpEn = (n: number) => `Rp ${(n / 1_000_000).toLocaleString('en-GB', { maximumFractionDigits: 1 })} M`

/** last-30-day sales of the business's outlets (salesDaily) */
function sales30(s: WorldState, bizId: string): { revenue: number; cost: number } {
  const outlets = new Set(rows(s.outlets).filter((o) => o.businessId === bizId).map((o) => o.id))
  let revenue = 0
  let cost = 0
  for (const id of s.salesDaily.ids) {
    const d = s.salesDaily.byId[id]!
    if (outlets.has(d.outletId) && d.day < 0 && d.day >= -30) {
      revenue += d.revenue
      cost += d.cost
    }
  }
  return { revenue, cost }
}

export interface RaporFactor { key: ScoreFactor; value: number; weight: number; contribution: number; live: boolean; source: ProductSlug; evidence: Bi; focus: string | null }
export interface Rapor {
  score: number
  band: number
  deltaMonth: number
  history12: { month: string; score: number }[]
  peerScore: number
  peerLabel: Bi
  factors: RaporFactor[]
  recalcAt: number
}

/** the score card: score, band, Δ vs last month, 12 months, peer median and the 6 factors summing to the score */
export function raporOf(s: WorldState, bizId: string): Rapor | null {
  const b = s.businesses.byId[bizId]
  const row = s.bizScores.byId[bizId]
  const c = computeScore(s, bizId)
  if (!b || !row || !c) return null
  const peers = rows(s.businesses).filter((x) => x.kind === b.kind && x.id !== bizId && s.bizScores.byId[x.id])
  const pool = peers.length >= 3 ? peers : rows(s.businesses).filter((x) => x.id !== bizId && s.bizScores.byId[x.id])
  const peerF = Object.fromEntries(FACTORS.map((k) => [k, median(pool.map((x) => computeScore(s, x.id)?.factors[k] ?? 0))])) as Record<ScoreFactor, number>
  const peerScore = scoreOf(peerF)
  // contributions: weight × (value − peer) × 1000, rounded by largest remainder so peer + Σ = score exactly
  const raw = FACTORS.map((k) => SCORE_WEIGHTS[k] * (c.factors[k] - peerF[k]) * 1000)
  const out = raw.map(Math.floor)
  let rest = c.score - peerScore - out.reduce((a, x) => a + x, 0)
  const order = raw.map((v, i) => ({ i, f: v - Math.floor(v) })).sort((a, b) => b.f - a.f || a.i - b.i)
  for (let k = 0; rest !== 0 && k < 24; k++) {
    const o = order[k % order.length]!
    out[o.i]! += rest > 0 ? 1 : -1
    rest += rest > 0 ? -1 : 1
  }
  const sl = sales30(s, bizId)
  const reviews = pendingReviews(s, bizId)
  const toCount = rows(s.taxItems).filter((t) => t.businessId === bizId && t.status === 'perlu-hitung')
  const ev: Record<ScoreFactor, [Bi, string | null]> = {
    omzet: [{ id: `Omzet 30 hari ${rp(sl.revenue)}, stabil ${pct(c.factors.omzet)} (simulasi)`, en: `30-day turnover ${rpEn(sl.revenue)}, ${pct(c.factors.omzet)} stable (simulated)` }, null],
    margin: [{ id: `Margin kotor 30 hari ${sl.revenue ? pct((sl.revenue - sl.cost) / sl.revenue) : '–'} (simulasi)`, en: `30-day gross margin ${sl.revenue ? pct((sl.revenue - sl.cost) / sl.revenue) : '–'} (simulated)` }, null],
    pajak: [
      reviews || toCount.length
        ? { id: `${reviews} jurnal perlu ditinjau · ${toCount.length} pajak belum dihitung`, en: `${reviews} journal entries need review · ${toCount.length} taxes not computed yet` }
        : { id: 'Jurnal rapi, pajak siap dilaporkan', en: 'Journals tidy, tax ready to file' },
      toCount[0]?.id ?? null,
    ],
    supplier: [{ id: `${pct(c.factors.supplier)} tagihan pemasok dibayar tepat waktu (simulasi)`, en: `${pct(c.factors.supplier)} of supplier invoices paid on time (simulated)` }, null],
    kyb: [b.verified ? { id: 'Lolos verifikasi KYB Kenal Mitra', en: 'Passed Kenal Mitra KYB verification' } : { id: 'Belum diverifikasi KYB', en: 'KYB not verified yet' }, bizId],
    pertumbuhan: [{ id: `Omzet tumbuh ${Math.round((c.factors.pertumbuhan - 0.5) * 40)}% dibanding tahun lalu (simulasi)`, en: `Turnover ${Math.round((c.factors.pertumbuhan - 0.5) * 40)}% vs last year (simulated)` }, null],
  }
  const history = [...row.history]
  history[history.length - 1] = c.score
  return {
    score: c.score, band: bandOf(c.score), deltaMonth: c.score - (row.history[row.history.length - 2] ?? c.score),
    history12: history.slice(-12).map((v, i, a) => ({ month: monthOf(s.day, i - (a.length - 1)), score: v })), peerScore,
    peerLabel: { id: `Median ${b.kind.replace('-', ' ')} ${s.region.shortName} (simulasi)`, en: `${s.region.shortName} ${b.kind.replace('-', ' ')} median (simulated)` },
    factors: FACTORS.map((k, i) => ({ key: k, value: c.factors[k], weight: SCORE_WEIGHTS[k], contribution: out[i]!, live: k === 'pajak' || k === 'kyb', source: SOURCE[k], evidence: ev[k][0], focus: ev[k][1] })),
    recalcAt: row.updatedAt,
  }
}

export type ActionKey = 'rapikan-jurnal' | 'pajak-siap' | 'kyb' | 'stok-aman' | 'bayar-supplier'
export interface ScoreAction { key: ActionKey; gain: number; kind: 'langsung' | 'tutup-buku'; label: Bi; target: string | null }
const scoreWith = (s: WorldState, bizId: string, patchFn: (st: WorldState) => WorldState) => computeScore(patchFn(s), bizId)?.score ?? 0

/** exactly 3 ways to raise the score (gain = the score on a patched copy − now); done ones drop out, the list refills */
export function scoreActions(s: WorldState, bizId: string): ScoreAction[] {
  const now = computeScore(s, bizId)?.score ?? 0
  const b = s.businesses.byId[bizId]
  if (!b) return []
  const out: ScoreAction[] = []
  const reviews = rows(s.ledger).filter((j) => j.businessId === bizId && j.needsReview)
  if (reviews.length) {
    const ids = new Set(reviews.map((j) => j.id))
    const gain = scoreWith(s, bizId, (st) => ({ ...st, ledger: { ids: st.ledger.ids, byId: Object.fromEntries(Object.entries(st.ledger.byId).map(([k, j]) => [k, ids.has(k) ? { ...j, needsReview: false } : j])) } })) - now
    out.push({ key: 'rapikan-jurnal', gain, kind: 'langsung', label: { id: `Rapikan ${reviews.length} jurnal`, en: `Tidy ${reviews.length} journal entries` }, target: null })
  }
  const toCount = rows(s.taxItems).filter((t) => t.businessId === bizId && t.status === 'perlu-hitung')
  if (toCount.length || !b.taxTidy) {
    const set = new Set(toCount.map((t) => t.id))
    const gain = scoreWith(s, bizId, (st) => ({
      ...st,
      businesses: { ids: st.businesses.ids, byId: { ...st.businesses.byId, [bizId]: { ...b, taxTidy: true } } },
      taxItems: { ids: st.taxItems.ids, byId: Object.fromEntries(Object.entries(st.taxItems.byId).map(([k, t]) => [k, set.has(k) ? { ...t, status: 'siap' as const } : t])) },
    })) - now
    const month = monthOf(s.day)
    const first = toCount.find((t) => t.period === month) ?? toCount[0]
    out.push({ key: 'pajak-siap', gain, kind: 'langsung', label: { id: 'Siapkan pajak bulan ini', en: 'Get this month’s tax ready' }, target: `/demo/pajak-beres?tab=ekspor${first ? `&focus=${first.id}` : ''}` })
  }
  if (!b.verified) {
    const gain = scoreWith(s, bizId, (st) => ({ ...st, businesses: { ids: st.businesses.ids, byId: { ...st.businesses.byId, [bizId]: { ...b, verified: true } } } })) - now
    out.push({ key: 'kyb', gain, kind: 'langsung', label: { id: 'Lengkapi verifikasi KYB', en: 'Complete the KYB verification' }, target: `/demo/kenal-mitra?focus=${bizId}` })
  }
  const f = s.bizScores.byId[bizId]?.factors.supplier ?? 1
  if (bizId === s.meta.shopId) {
    const draft = rows(s.purchaseOrders).find((p) => p.businessId === bizId && p.status === 'draf')
    out.push({ key: 'stok-aman', gain: Math.round(Math.min(0.05, 1 - f) * SCORE_WEIGHTS.supplier * 1000), kind: 'tutup-buku', label: { id: 'Jaga stok aman dengan PO tepat waktu', en: 'Keep stock safe with on-time POs' }, target: `/demo/toko-autopilot?tab=po${draft ? `&focus=${draft.id}` : ''}` })
  }
  if (f < 0.95) out.push({ key: 'bayar-supplier', gain: Math.round(Math.min(0.05, 1 - f) * SCORE_WEIGHTS.supplier * 1000), kind: 'tutup-buku', label: { id: 'Bayar pemasok sebelum jatuh tempo', en: 'Pay suppliers before the due date' }, target: '/demo/pajak-beres?tab=jurnal' })
  return out.slice(0, 3)
}

export { installment } from './loan-math'

/** average monthly net profit of Sep–Oct (the shop: its books; others: a simulated share of their turnover) */
export function netProfitAvg(s: WorldState, bizId: string): number {
  if (bizId === s.meta.shopId) {
    const pnl = pnlMonthly(s, bizId)
    const months = [monthOf(s.day, -2), monthOf(s.day, -1)]
    const nets = months.map((m) => pnl.find((p) => p.month === m)?.net ?? 0)
    return Math.round(nets.reduce((a, x) => a + x, 0) / nets.length)
  }
  const b = s.businesses.byId[bizId]
  return Math.round((b?.monthlyRevenue ?? 0) * (0.08 + 0.1 * (s.bizScores.byId[bizId]?.factors.margin ?? 0.5)))
}

export interface LoanOffer {
  plafon: number
  ratePct: number
  tenors: readonly number[]
  installment(amount: number, tenor: number): number
  /** installment of the plafon over 12 months / average monthly net profit */
  dsr: number
  netProfit: number
  eligible: boolean
  reason?: Bi
  nextBand: { min: number; plafon: number; label: Bi } | null
}
/** the working-capital offer of a business now (simulasi) */
export function loanOffer(s: WorldState, bizId: string, now: number): LoanOffer {
  void now
  const score = computeScore(s, bizId)?.score ?? 0
  const band = bandOf(score)
  const net = netProfitAvg(s, bizId)
  const plafonAt = (bi: number) => Math.min(LOAN.cap[bi] ?? 0, Math.floor((net * (LOAN.multiplier[bi] ?? 0)) / LOAN.step) * LOAN.step)
  const plafon = plafonAt(band)
  const ratePct = LOAN.ratePct[band] ?? 0
  const eligible = band >= 1 && plafon > 0
  const nb = SCORE_BANDS[band + 1]
  return {
    plafon, ratePct, tenors: LOAN.tenors, installment: (amount, tenor) => installment(amount, ratePct, tenor), netProfit: net,
    dsr: net > 0 ? Math.round((installment(plafon, ratePct, 12) / net) * 1000) / 1000 : 0, eligible,
    ...(eligible ? {} : { reason: band < 1 ? { id: 'Skor di bawah 550: belum bisa mengajukan', en: 'Score below 550: not eligible yet' } : { id: 'Laba bersih belum cukup untuk plafon', en: 'Net profit too low for a limit' } }),
    nextBand: nb ? { min: nb.min, plafon: plafonAt(band + 1), label: nb.label } : null,
  }
}

export interface LoanAdvice { rec: 'setujui' | 'setujui-bersyarat' | 'tinjau-manual'; reasons: Bi[]; maxAmount: number; scoreNow: number }
/** the analyst's recommendation (≥ 750 setujui, 650–749 bersyarat, else / unverified tinjau manual) — decision stays with the cooperative */
export function loanAdvice(s: WorldState, loanId: string): LoanAdvice | null {
  const l = s.loanApps.byId[loanId]
  const b = l ? s.businesses.byId[l.businessId] : undefined
  if (!l || !b) return null
  const score = computeScore(s, b.id)?.score ?? l.score
  const offer = loanOffer(s, b.id, 0)
  const rec: LoanAdvice['rec'] = !b.verified ? 'tinjau-manual' : score >= 750 ? 'setujui' : score >= 650 ? 'setujui-bersyarat' : 'tinjau-manual'
  const reasons: Bi[] = [
    { id: `Skor sekarang ${score} (${SCORE_BANDS[bandOf(score)]!.label.id})`, en: `Score now ${score} (${SCORE_BANDS[bandOf(score)]!.label.en})` },
    b.verified ? { id: 'Usaha lolos verifikasi KYB', en: 'Business passed KYB verification' } : { id: 'Usaha belum lolos KYB: minta verifikasi dulu', en: 'Business has not passed KYB: request a verification first' },
    { id: `Plafon simulasi ${rp(offer.plafon)} · cicilan 12 bln ${rp(offer.installment(Math.min(l.amount, offer.plafon || l.amount), 12))}`, en: `Simulated limit ${rpEn(offer.plafon)} · 12-month instalment ${rpEn(offer.installment(Math.min(l.amount, offer.plafon || l.amount), 12))}` },
  ]
  return { rec, reasons, maxAmount: Math.min(l.amount, Math.max(offer.plafon, 0) || l.amount), scoreNow: score }
}

export interface QueueRow { loan: LoanApp; business: Business; scoreNow: number; scoreThen: number; badges: Badges; advice: LoanAdvice | null; consent: Consent | null }
/** a lender's queue: 'menunggu' (diajukan) or 'diputus' (disetujui / ditolak), newest first */
export function lenderQueue(s: WorldState, lender: string, status: 'menunggu' | 'diputus'): QueueRow[] {
  return rows(s.loanApps)
    .filter((l) => l.lender === lender && (status === 'menunggu' ? l.status === 'diajukan' : l.status !== 'diajukan'))
    .sort((a, b) => (b.decidedAt ?? b.at) - (a.decidedAt ?? a.at) || b.id.localeCompare(a.id))
    .flatMap((l) => {
      const b = s.businesses.byId[l.businessId]
      if (!b) return []
      return [{ loan: l, business: b, scoreNow: computeScore(s, b.id)?.score ?? l.score, scoreThen: l.score, badges: badgesOf(s, b.id), advice: loanAdvice(s, l.id), consent: l.consentId ? s.consents.byId[l.consentId] ?? null : null }]
    })
}

/** the business's consents, newest first */
export const consentsOf = (s: WorldState, bizId: string): Consent[] => rows(s.consents).filter((c) => c.businessId === bizId).sort((a, b) => b.at - a.at || b.id.localeCompare(a.id))
/** the consent in force for a lender now (not revoked, not expired) */
export const activeConsent = (s: WorldState, bizId: string, lender: string, now: number): Consent | null =>
  consentsOf(s, bizId).find((c) => c.lender === lender && c.revokedAt === null && c.until > now) ?? null

export interface FeedRow { id: string; at: number; kind: 'penjualan' | 'jurnal' | 'pajak' | 'kyb'; text: Bi; ref: string }
/** "Data masuk hari ini": today's sales / journal / tax / KYB rows of the business until `now` (newest first) + the sales total */
export function dataFeed(s: WorldState, bizId: string, now: number): { rows: FeedRow[]; tx: number; revenue: number } {
  const out: FeedRow[] = []
  let tx = 0
  let revenue = 0
  for (const id of s.sales.ids) {
    const x = s.sales.byId[id]!
    if (x.businessId !== bizId || x.at < 0 || x.at > now) continue
    tx++
    revenue += x.total
    if (out.length < 40) out.push({ id: x.id, at: x.at, kind: 'penjualan', text: { id: `Penjualan ${x.code}`, en: `Sale ${x.code}` }, ref: `sales:${x.id}` })
  }
  for (const id of s.ledger.ids) {
    const j = s.ledger.byId[id]!
    if (j.businessId !== bizId || j.at < 0 || j.at > now || j.source === 'sale') continue
    out.push({ id: j.id, at: j.at, kind: 'jurnal', text: j.memo, ref: `ledger:${j.id}` })
  }
  for (const id of s.verifications.ids) {
    const v = s.verifications.byId[id]!
    if (v.subjectId === bizId && v.at >= 0 && v.at <= now) out.push({ id: v.id, at: v.at, kind: 'kyb', text: { id: `Verifikasi ${v.kind.toUpperCase()}: ${v.result}`, en: `${v.kind.toUpperCase()} verification: ${v.result}` }, ref: `verifications:${v.id}` })
  }
  out.sort((a, b) => b.at - a.at || b.id.localeCompare(a.id))
  return { rows: out, tx, revenue }
}
