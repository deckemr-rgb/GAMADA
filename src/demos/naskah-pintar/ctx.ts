/**
 * naskah-pintar/ctx.ts — compact world summary for an AI call (≤ ~6 KB when sent Live): the follow-up board,
 * the letters waiting for a disposition, today's meetings and the latest instructions, plus the task's subject.
 */
import type { ActionItem, Instruction, Letter, Meeting, Minutes, WorldState } from '../../demo-kit/world'
import { DAY_MIN, hhmm } from '../../demo-kit/world/util'
import type { CtxItem, NaskahCtx } from './ai'
import { dueText, opdName } from './model'

type Lang = 'id' | 'en'

export function ctxItem(s: WorldState, a: ActionItem, now: Minutes, lang: Lang): CtxItem {
  return {
    id: a.id,
    title: a.title,
    opd: opdName(s, a.opdId, lang),
    pic: a.pic,
    due: dueText(a.dueAt, lang, s.day),
    late: a.status !== 'selesai' && a.dueAt < now,
    status: a.status,
    source: a.source.kind,
  }
}

export function buildCtx(s: WorldState, now: Minutes, lang: Lang, task: NaskahCtx['task'], extra: Partial<NaskahCtx> = {}, opdFilter?: string | null): NaskahCtx {
  const items = s.actionItems.ids.map((id) => s.actionItems.byId[id]).filter((a): a is ActionItem => !!a && (!opdFilter || a.opdId === opdFilter))
  const open = items.filter((a) => a.status !== 'selesai')
  const late = open.filter((a) => a.dueAt < now).sort((a, b) => a.dueAt - b.dueAt)
  const today = open.filter((a) => a.dueAt >= now && a.dueAt < DAY_MIN).sort((a, b) => a.dueAt - b.dueAt)
  const byOpd = new Map<string, { opd: string; open: number; late: number }>()
  for (const a of open) {
    const r = byOpd.get(a.opdId) ?? { opd: opdName(s, a.opdId, lang), open: 0, late: 0 }
    r.open++
    if (a.dueAt < now) r.late++
    byOpd.set(a.opdId, r)
  }
  const letters = s.letters.ids.map((id) => s.letters.byId[id]).filter((l): l is Letter => !!l)
  const pending = letters.filter((l) => l.status === 'masuk')
  const meetings = s.meetings.ids
    .map((id) => s.meetings.byId[id])
    .filter((m): m is Meeting => !!m && m.at >= 0 && m.at < DAY_MIN)
    .sort((a, b) => a.at - b.at)
  const instructions = s.instructions.ids.slice(0, 3).map((id) => s.instructions.byId[id]).filter((i): i is Instruction => !!i)
  return {
    task,
    now: hhmm(now),
    day: s.day,
    region: s.region.name,
    lang,
    board: {
      open: open.length,
      late: late.length,
      dueToday: today.length,
      done: items.length - open.length,
      byOpd: [...byOpd.values()].sort((a, b) => b.late - a.late || b.open - a.open).slice(0, 8),
      lateItems: late.slice(0, 6).map((a) => ctxItem(s, a, now, lang)),
      todayItems: today.slice(0, 6).map((a) => ctxItem(s, a, now, lang)),
    },
    letters: { pending: pending.length, total: letters.length, pendingList: pending.slice(0, 6).map((l) => ({ subject: l.subject, from: l.from, sifat: l.sifat })) },
    meetings: meetings.map((m) => ({ title: m.title, at: hhmm(m.at), transcribed: m.transcribed, actions: m.actionItemIds.length })),
    instructions: instructions.map((i) => ({ at: hhmm(i.at), text: i.text, opds: i.opdIds.map((o) => opdName(s, o, lang)) })),
    ...extra,
  }
}
