/**
 * world/sd/leaderboard.ts — the OPD leaderboard (Sapa Warga summary, Meja Pimpinan).
 * Part of world/satu-daerah.ts (the barrel products import): one module per domain, so each product's chunk
 * carries only the selectors it uses. Numbers are SIMULATED (seeded world).
 */
import type { Minutes } from '../types'
import { createParamSelector } from '../selectors'
import { DAY_MIN, rows } from '../util'

/** an agency needs this many tickets in the 30-day window (closed + open past SLA) before it gets an SLA %, a score
 *  and a rank */
export const OPD_MIN_SAMPLE = 3
export interface OpdRow {
  opdId: string
  name: string
  short: string
  openTickets: number
  /** open tickets already past their SLA deadline (they count against the SLA) */
  lateTickets: number
  closed30: number
  onTime30: number
  /** on time ÷ (closed in 30 days + open past SLA), as slaOnTimePct; null below OPD_MIN_SAMPLE */
  slaPct: number | null
  /** average rating 1–5 (null when no rating) */
  rating: number | null
  actionsOpen: number
  /** follow-ups past their deadline and not done */
  actionsLate: number
  /** composite 0–100: SLA 50 %, follow-up discipline (items already due) 30 %, satisfaction 20 %; null below OPD_MIN_SAMPLE */
  score: number | null
  /** 1-based rank among agencies with enough data; null otherwise */
  rank: number | null
}
/** OPD leaderboard (Meja Pimpinan "papan peringkat"): ranked agencies best first, then those without enough data */
export const opdLeaderboard = /*#__PURE__*/ createParamSelector((s) => [s.tickets, s.actionItems, s.region], (now: Minutes, tickets, actions, region): OpdRow[] => {
  type Acc = OpdRow & { rSum: number; rN: number; due: number }
  const by = new Map<string, Acc>()
  const row = (opdId: string): Acc => {
    let r = by.get(opdId)
    if (!r) {
      const o = region.opd.find((x) => x.id === opdId)
      r = { opdId, name: o?.name ?? opdId, short: o?.short ?? opdId, openTickets: 0, lateTickets: 0, closed30: 0, onTime30: 0, slaPct: null, rating: null, actionsOpen: 0, actionsLate: 0, score: null, rank: null, rSum: 0, rN: 0, due: 0 }
      by.set(opdId, r)
    }
    return r
  }
  for (const t of rows(tickets)) {
    if (t.createdAt > now) continue
    const r = row(t.opdId)
    if (t.status !== 'selesai' || t.closedAt === null || t.closedAt > now) {
      r.openTickets++
      if (t.slaDueAt < now) r.lateTickets++
    } else if (t.closedAt > now - 30 * DAY_MIN) {
      r.closed30++
      if (t.closedAt <= t.slaDueAt) r.onTime30++
    }
    if (t.rating !== null) {
      r.rSum += t.rating
      r.rN++
    }
  }
  for (const a of rows(actions)) {
    const r = row(a.opdId)
    if (a.status !== 'selesai') r.actionsOpen++
    if (a.dueAt < now) {
      r.due++
      if (a.status !== 'selesai') r.actionsLate++
    }
  }
  const out: OpdRow[] = []
  for (const r of by.values()) {
    const n = r.closed30 + r.lateTickets
    const sla = n >= OPD_MIN_SAMPLE ? Math.round((r.onTime30 / n) * 100) : null
    const rating = r.rN ? Math.round((r.rSum / r.rN) * 10) / 10 : null
    const discipline = r.due ? 1 - r.actionsLate / r.due : 1
    const score = sla === null ? null : Math.round(0.5 * sla + 30 * discipline + 20 * ((rating ?? 3.5) / 5))
    const { rSum: _a, rN: _b, due: _c, ...rest } = r
    out.push({ ...rest, slaPct: sla, rating, score })
  }
  out.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.short.localeCompare(b.short))
  let k = 0
  for (const r of out) if (r.score !== null) r.rank = ++k
  return out
})
