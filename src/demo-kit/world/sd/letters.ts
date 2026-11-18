/**
 * world/sd/letters.ts — Naskah Pintar: letter inbox and the follow-up board.
 * Part of world/satu-daerah.ts (the barrel products import): one module per domain, so each product's chunk
 * carries only the selectors it uses. Numbers are SIMULATED (seeded world).
 */
import type { ActionItem, Letter, Minutes } from '../types'
import { createParamSelector, createSelector } from '../selectors'
import { rows } from '../util'

/* ================================================================== Naskah Pintar */

/** incoming letters (status 'masuk' first, newest first) */
export const letterInbox = /*#__PURE__*/ createSelector((s) => [s.letters], (t): Letter[] => rows(t).sort((a, b) => (a.status === b.status ? b.receivedAt - a.receivedAt : a.status === 'masuk' ? -1 : 1)))

export interface ActionColumn {
  opdId: string
  short: string
  items: (ActionItem & { late: boolean })[]
}
/** Tindak Lanjut kanban: one column per OPD with open items (late ones first), plus every instruction's tasks */
export const actionBoard = /*#__PURE__*/ createParamSelector((s) => [s.actionItems, s.region], (now: Minutes, t, region): ActionColumn[] => {
  const by = new Map<string, ActionColumn>()
  for (const a of rows(t)) {
    let c = by.get(a.opdId)
    if (!c) by.set(a.opdId, (c = { opdId: a.opdId, short: region.opd.find((o) => o.id === a.opdId)?.short ?? a.opdId, items: [] }))
    c.items.push({ ...a, late: a.status !== 'selesai' && a.dueAt < now })
  }
  for (const c of by.values()) c.items.sort((a, b) => Number(b.late) - Number(a.late) || a.dueAt - b.dueAt)
  return [...by.values()].sort((a, b) => b.items.filter((i) => i.late).length - a.items.filter((i) => i.late).length || b.items.length - a.items.length)
})
