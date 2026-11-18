/**
 * naskah-pintar/ai.ts — the product's AI calls (minutes extraction, letter classification + disposition draft,
 * WhatsApp reminder, questions). One hook over the kit's light chat entry; the simulation scenario is imported
 * the first time an AI call is prepared or sent, so the page itself never carries it.
 *
 * Both modes return the same structured kinds (shared proxy schemas): 'minutes', 'classification', 'disposition',
 * 'reminder'. Live answers that miss a kind fall back to the simulated values in the UI.
 */
import { useCallback, useRef } from 'react'
import { useAiChat, getScenario, registerScenario, type ChatMessage } from '../../demo-kit/ai/chat'
import { useSession } from '../../demo-kit/world'
import type { Bi } from '../../demo-kit/world'
import { npRole } from './model'

let scenarioLoad: Promise<void> | null = null
/** register the simulation scenario once (lazy chunk) */
export function ensureScenario(): Promise<void> {
  scenarioLoad ??= import('./scenario').then(
    (m) => {
      if (!getScenario('naskah-pintar')) registerScenario(m.default)
    },
    (e: unknown) => {
      scenarioLoad = null
      throw e
    },
  )
  return scenarioLoad
}

/* ------------------------------------------------------------------ context sent with each call */

export interface CtxItem {
  id: string
  title: Bi
  opd: string
  pic: string
  due: string
  late: boolean
  status: string
  source: string
}
export interface NaskahCtx {
  task: 'minutes' | 'letter' | 'reminder' | 'ask'
  now: string
  day: string
  region: string
  lang: 'id' | 'en'
  meeting?: { title: string; transcript: string; sample: boolean }
  letter?: {
    number: string
    from: string
    subject: Bi
    cls: string
    sifat: string
    due: string | null
    summary: Bi[]
    suggested: { to: string[]; instruction: Bi; note: Bi }
  }
  /** `from` signs the message (Sekretariat Daerah, or the agency head reminding its own staff) */
  item?: CtxItem & { dueAt: number; nowAt: number; from?: string }
  board?: { open: number; late: number; dueToday: number; done: number; byOpd: { opd: string; open: number; late: number }[]; lateItems: CtxItem[]; todayItems: CtxItem[] }
  letters?: { pending: number; total: number; pendingList: { subject: Bi; from: string; sifat: string; due?: string | null; to?: string[] }[] }
  meetings?: { title: Bi; at: string; transcribed: boolean; actions: number }[]
  instructions?: { at: string; text: Bi; opds: string[] }[]
  minutes?: { decisions: Bi[]; actions: { task: Bi; pic: string; due: string; status?: string }[] }
}

/* ------------------------------------------------------------------ structured readers */

export interface MinutesOut {
  decisions: string[]
  actionItems: { task: string; owner: string; due?: string }[]
}
export interface ClassOut {
  letterClass: string
  nature: string
  summary: string[]
  sender?: string
  deadline?: string
}
export interface DispoOut {
  to: string[]
  instruction: string
  note?: string
  deadline?: string
}
export interface ReminderOut {
  to: string
  message: string
  dueText?: string
}

export function structuredOf<T>(m: ChatMessage | null | undefined, kind: string): T | null {
  const hit = m?.structured?.find((x) => x.kind === kind)
  return hit ? (hit.data as unknown as T) : null
}

/* ------------------------------------------------------------------ hook */

export interface NaskahAi {
  ask: (text: string, context: NaskahCtx) => Promise<void>
  prepare: () => void
  stop: () => void
  /** finish the answer being streamed at once (the full text appears) */
  flush: () => void
  reset: () => void
  messages: ChatMessage[]
  last: ChatMessage | null
  busy: boolean
  followUps: string[]
}

export function useNaskahAi(opts: { onDone?: (m: ChatMessage) => void } = {}): NaskahAi {
  const { aiMode, role } = useSession()
  const ctx = useRef<NaskahCtx | null>(null)
  const chat = useAiChat('naskah-pintar', { mode: aiMode, role: npRole(role), getContext: () => ctx.current, ...(opts.onDone ? { onDone: opts.onDone } : {}) })
  const send = chat.send
  const ask = useCallback(
    async (text: string, context: NaskahCtx) => {
      await ensureScenario().catch(() => undefined)
      ctx.current = context
      await send(text)
    },
    [send],
  )
  const prep = chat.prepare
  const prepare = useCallback(() => {
    void ensureScenario().catch(() => undefined)
    prep()
  }, [prep])
  return { ask, prepare, stop: chat.stop, flush: chat.flush, reset: chat.reset, messages: chat.messages, last: chat.last, busy: chat.busy, followUps: chat.followUps }
}
