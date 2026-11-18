/**
 * world/up/sales.ts — Juara Jualan selectors. Every score is `callScore(criteria)`; the board, the agent view and the
 * roleplay baseline read the same avg14.
 */
import type { Call, Coaching, Criteria, Industry, Roleplay, SalesAgent, WorldState } from '../types'
import { createParamSelector } from '../selectors'
import { DAY_MIN, rows } from '../util'
import { CRITERIA_KEYS } from './call-score'
import { CALL_CLIPS, PRAPESAN_CLIP, clipOf, type ClipDef } from './base'

export { CALL_WEIGHTS, CRITERIA_KEYS, callScore, weakest } from './call-score'
export { CALL_CLIPS, PRAPESAN_CLIP, clipOf, FLAG_OF, IND_SHORT, IND_OF_SHORT, type ClipDef } from './base'

const endOf = (c: Call) => c.at + Math.max(1, Math.ceil(c.durationSec / 60))
const isLive = (c: Call, now: number) => c.channel === 'telepon' && c.score === null && c.at <= now && now < endOf(c)

export interface SalesKpi { today: number; avgScore: number | null; needCoaching: number; breaches: number }
/** today's conversations until `now` (industry): count, average score, agents needing coaching, script breaches */
const kpiSel = createParamSelector((s) => [s.calls, s.agentsSales, s.coachings], (key: string, calls, agents, coachings): SalesKpi => {
  const [nowS, ind] = key.split('|')
  const now = Number(nowS)
  const today = rows(calls).filter((c) => c.industry === ind && c.at >= 0 && c.at <= now)
  const scored = today.filter((c) => c.score !== null)
  const board = boardRows({ calls, agentsSales: agents } as unknown as WorldState, now, ind as Industry)
  const open = new Set(rows(coachings).filter((c) => c.status !== 'selesai').map((c) => c.agentId))
  return {
    today: today.length,
    avgScore: scored.length ? Math.round(scored.reduce((a, c) => a + c.score!, 0) / scored.length) : null,
    needCoaching: board.filter((b) => b.avg14 !== null && b.avg14 < 65 && !open.has(b.agent.id)).length,
    breaches: today.filter((c) => c.flags.includes('janji-berlebihan') || (c.criteria?.kepatuhan ?? 100) < 60).length,
  }
})
export const salesKpi = (s: WorldState, now: number, ind: Industry): SalesKpi => kpiSel(s, `${Math.floor(now)}|${ind}`)

export interface CallRow extends Call { agentName: string; live: boolean }
/** conversations until `now` of an industry ('low' = lowest score first, unscored after; 'new' = newest first) */
export function callList(s: WorldState, now: number, ind: Industry, opts: { agentId?: string; sort?: 'low' | 'new' } = {}): CallRow[] {
  const list = rows(s.calls)
    .filter((c) => c.industry === ind && c.at <= now && (!opts.agentId || c.agentId === opts.agentId))
    .map((c) => ({ ...c, agentName: s.agentsSales.byId[c.agentId]?.name ?? '', live: isLive(c, now) }))
  if (opts.sort === 'new') return list.sort((a, b) => b.at - a.at || b.id.localeCompare(a.id))
  return list.sort((a, b) => (a.score ?? 1000) - (b.score ?? 1000) || b.at - a.at)
}
/** calls in progress at `now` (phone calls started and not ended) */
export const liveCalls = (s: WorldState, now: number, ind: Industry): CallRow[] => callList(s, now, ind, { sort: 'new' }).filter((c) => c.live)

/** one conversation with its agent, clip definition and linked PO / flood alert */
export function callDetail(s: WorldState, id: string): { call: Call; agent: SalesAgent | undefined; clip: ClipDef | undefined; po: WorldState['purchaseOrders']['byId'][string] | undefined; alertId: string | null } | null {
  const call = s.calls.byId[id]
  if (!call) return null
  const alert = call.topic === 'banjir' ? rows(s.alerts).find((a) => a.kind === 'banjir') : undefined
  return { call, agent: s.agentsSales.byId[call.agentId], clip: clipOf(call.transcript), po: call.refId ? s.purchaseOrders.byId[call.refId] : undefined, alertId: alert?.id ?? null }
}

export interface BoardRow { agent: SalesAgent; avg14: number | null; delta7: number; trend: (number | null)[]; radar: Criteria; calls14: number; rank: number }
function boardRows(s: WorldState, now: number, ind: Industry): BoardRow[] {
  const from = now - 14 * DAY_MIN
  const out = rows(s.agentsSales).filter((a) => a.industry === ind).map((agent) => {
    const mine = rows(s.calls).filter((c) => c.agentId === agent.id && c.score !== null && c.at <= now && c.at > from && c.transcript !== PRAPESAN_CLIP)
    const avg = (l: Call[]) => (l.length ? Math.round(l.reduce((a, c) => a + c.score!, 0) / l.length) : null)
    const avg14 = avg(mine)
    const last7 = avg(mine.filter((c) => c.at > now - 7 * DAY_MIN))
    const prev7 = avg(mine.filter((c) => c.at <= now - 7 * DAY_MIN))
    const trend = Array.from({ length: 14 }, (_, i) => {
      const d0 = Math.floor(now / DAY_MIN) - 13 + i
      return avg(mine.filter((c) => Math.floor(c.at / DAY_MIN) === d0))
    })
    const radar = {} as Criteria
    for (const k of CRITERIA_KEYS) radar[k] = mine.length ? Math.round(mine.reduce((a, c) => a + (c.criteria?.[k] ?? 0), 0) / mine.length) : agent.radar[k]
    return { agent, avg14, delta7: last7 !== null && prev7 !== null ? last7 - prev7 : 0, trend, radar, calls14: mine.length, rank: 0 }
  })
  out.sort((a, b) => (b.avg14 ?? -1) - (a.avg14 ?? -1) || a.agent.id.localeCompare(b.agent.id))
  out.forEach((r, i) => (r.rank = i + 1))
  return out
}
/** leaderboard of an industry: avg14, delta7, 14-day trend, radar (criteria averages), rank */
const boardSel = createParamSelector((s) => [s.calls, s.agentsSales], (key: string, calls, agents): BoardRow[] => {
  const [nowS, ind] = key.split('|')
  return boardRows({ calls, agentsSales: agents } as unknown as WorldState, Number(nowS), ind as Industry)
})
export const teamBoard = (s: WorldState, now: number, ind: Industry): BoardRow[] => boardSel(s, `${Math.floor(now)}|${ind}`)
/** team average radar (the RadarChart's second series) */
export function teamRadar(board: BoardRow[]): Criteria {
  const r = {} as Criteria
  for (const k of CRITERIA_KEYS) r[k] = board.length ? Math.round(board.reduce((a, b) => a + b.radar[k], 0) / board.length) : 0
  return r
}

/** one agent: board row (rank "#7 dari 9" counts the whole industry), coachings, roleplays */
export function agentProfile(s: WorldState, now: number, agentId: string): { row: BoardRow; of: number; coachings: Coaching[]; roleplays: Roleplay[] } | null {
  const agent = s.agentsSales.byId[agentId]
  if (!agent) return null
  const board = teamBoard(s, now, agent.industry)
  const row = board.find((r) => r.agent.id === agentId)
  if (!row) return null
  return { row, of: board.length, coachings: coachingsFor(s, agentId), roleplays: rows(s.roleplays).filter((r) => r.agentId === agentId) }
}
export const coachingsFor = (s: WorldState, agentId: string): Coaching[] => rows(s.coachings).filter((c) => c.agentId === agentId).sort((a, b) => b.at - a.at)

/** every clip key of an industry (Juara Jualan must ship a text for each) */
export const clipsOf = (ind: Industry): readonly ClipDef[] => CALL_CLIPS.filter((c) => c.industry === ind)
