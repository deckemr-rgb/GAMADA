/**
 * ai/useAiChat.ts — React hook over AiProvider for any chat surface (spec §9).
 *
 * The hook never imports the world store: callers pass `getContext()` (sim answers read it as ctx.world; live
 * requests send summarize(getContext()) ≤ 6 KB). World events a simulated answer wants (`SimResponse.emits`)
 * are handed to `onEmits` after the answer finished streaming.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PRODUCT_BY_SLUG, type ProductSlug, type RoleId } from '../../content/products'
import { useI18n } from '../../lib/i18n'
import type { ChatRequest, Lang, Msg, SimResponse, Structured, ToolCall } from './types'
import { getAi, getScenario, takeSimExtras } from './provider'
import { simulate } from './scripted/engine'

export type ChatStatus = 'thinking' | 'streaming' | 'done' | 'stopped' | 'error'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  /** assistant only */
  status?: ChatStatus
  toolCalls?: ToolCall[]
  structured?: Structured[]
  followUps?: string[]
  /** small translation under the answer (regional language → ID/EN) */
  translation?: string
  mode?: 'sim' | 'live'
  intentId?: string
  confidence?: number
  fellBack?: boolean
  /** measured timing: request → first token, first → last token, token count */
  timing?: { firstTokenMs: number; streamMs: number; tokens: number }
}

export interface UseAiChatOptions {
  /** world snapshot (or any context) for this turn; read lazily at send time */
  getContext?: () => unknown
  /** default: the site language (useI18n) */
  lang?: Lang
  /** default: the product's defaultRole */
  role?: RoleId
  /** default 'sim' */
  mode?: 'sim' | 'live'
  /** world events from a simulated answer (emit them into the world store) */
  onEmits?: (emits: NonNullable<SimResponse['emits']>, message: ChatMessage) => void
  /** called once per finished assistant message */
  onDone?: (message: ChatMessage) => void
  /** pre-filled conversation (static renders, restored sessions) */
  initial?: ChatMessage[]
}

export interface UseAiChat {
  messages: ChatMessage[]
  send: (text: string) => Promise<void>
  /** abort the answer being generated (keeps what streamed so far) */
  stop: () => void
  /** abort and clear the conversation */
  reset: () => void
  busy: boolean
  thinking: boolean
  streaming: boolean
  /** of the last assistant message */
  followUps: string[]
  structured: Structured[]
  last: ChatMessage | null
  fellBack: boolean
}

let seq = 0
const newId = (p: string) => `${p}-${Date.now().toString(36)}-${(++seq).toString(36)}`

export function useAiChat(product: ProductSlug, opts: UseAiChatOptions = {}): UseAiChat {
  const { lang: siteLang } = useI18n()
  const [messages, setMessages] = useState<ChatMessage[]>(() => opts.initial ?? [])
  const optsRef = useRef(opts)
  optsRef.current = opts
  const msgsRef = useRef(messages)
  msgsRef.current = messages
  const ctrlRef = useRef<AbortController | null>(null)
  const lang = opts.lang ?? siteLang
  const role = opts.role ?? PRODUCT_BY_SLUG[product].defaultRole
  const mode = opts.mode ?? 'sim'

  useEffect(() => () => ctrlRef.current?.abort(), [])

  const patch = useCallback((id: string, fn: (m: ChatMessage) => ChatMessage) => {
    setMessages((list) => list.map((m) => (m.id === id ? fn(m) : m)))
  }, [])

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim()
      if (!text) return
      ctrlRef.current?.abort()
      const ctrl = new AbortController()
      ctrlRef.current = ctrl

      const history: Msg[] = msgsRef.current
        .filter((m) => m.content && (m.role === 'user' || m.status === 'done'))
        .map((m) => ({ role: m.role, content: m.content }))
      const user: ChatMessage = { id: newId('u'), role: 'user', content: text }
      const aid = newId('a')
      const assistant: ChatMessage = { id: aid, role: 'assistant', content: '', status: 'thinking', toolCalls: [], structured: [], followUps: [] }
      setMessages((list) => [...list.map((m) => (m.status === 'thinking' || m.status === 'streaming' ? { ...m, status: 'stopped' as const } : m)), user, assistant])

      const req: ChatRequest = {
        product,
        role,
        lang,
        messages: [...history, { role: 'user', content: text }],
        context: optsRef.current.getContext?.() ?? null,
        signal: ctrl.signal,
      }
      const t0 = performance.now()
      let tFirst = 0
      let tLast = 0
      let tokens = 0
      let final: ChatMessage = assistant
      const upd = (fn: (m: ChatMessage) => ChatMessage) => {
        final = fn(final)
        patch(aid, fn)
      }
      try {
        for await (const c of getAi(mode).chat(req)) {
          if (ctrl.signal.aborted) break
          switch (c.type) {
            case 'text':
              if (!tFirst) tFirst = performance.now()
              tLast = performance.now()
              tokens++
              upd((m) => ({ ...m, status: 'streaming', content: m.content + c.text }))
              break
            case 'tool_call':
              upd((m) => ({ ...m, toolCalls: [...(m.toolCalls ?? []), c.call] }))
              break
            case 'structured':
              upd((m) => ({ ...m, structured: [...(m.structured ?? []), c.value] }))
              break
            case 'followups':
              upd((m) => ({ ...m, followUps: c.chips }))
              break
            case 'done': {
              const x = takeSimExtras(req)
              upd((m) => {
                const n: ChatMessage = { ...m, status: 'done', mode: c.mode }
                if (c.intentId) n.intentId = c.intentId
                if (c.confidence !== undefined) n.confidence = c.confidence
                if (c.fellBack) n.fellBack = true
                if (x?.translation) n.translation = x.translation
                if (tFirst) n.timing = { firstTokenMs: Math.round(tFirst - t0), streamMs: Math.round(tLast - tFirst), tokens }
                return n
              })
              if (x?.emits.length) optsRef.current.onEmits?.(x.emits, final)
              optsRef.current.onDone?.(final)
              break
            }
          }
        }
        if (ctrl.signal.aborted) upd((m) => (m.status === 'done' ? m : { ...m, status: 'stopped' }))
      } catch {
        if (!ctrl.signal.aborted) {
          upd((m) => ({
            ...m,
            status: 'error',
            content: m.content || (lang === 'id' ? 'Maaf, terjadi kesalahan. Silakan coba lagi.' : 'Sorry, something went wrong. Please try again.'),
          }))
        }
      } finally {
        if (ctrlRef.current === ctrl) ctrlRef.current = null
      }
    },
    [product, role, lang, mode, patch],
  )

  const stop = useCallback(() => ctrlRef.current?.abort(), [])
  const reset = useCallback(() => {
    ctrlRef.current?.abort()
    ctrlRef.current = null
    setMessages([])
  }, [])

  return useMemo(() => {
    let last: ChatMessage | null = null
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]!.role === 'assistant') {
        last = messages[i]!
        break
      }
    }
    return {
      messages,
      send,
      stop,
      reset,
      busy: last?.status === 'thinking' || last?.status === 'streaming',
      thinking: last?.status === 'thinking',
      streaming: last?.status === 'streaming',
      followUps: last?.status === 'done' ? (last.followUps ?? []) : [],
      structured: last?.structured ?? [],
      last,
      fellBack: !!last?.fellBack,
    }
  }, [messages, send, stop, reset])
}

/**
 * Build a finished conversation instantly with the simulation (for ?static=1 renders, thumbnails and
 * restored sessions). Each text is answered with the history so far; emits are ignored.
 */
export function staticConversation(
  product: ProductSlug,
  texts: string[],
  opts: { lang: Lang; role?: RoleId; world?: unknown },
): ChatMessage[] {
  const role = opts.role ?? PRODUCT_BY_SLUG[product].defaultRole
  const out: ChatMessage[] = []
  const history: Msg[] = []
  texts.forEach((text, i) => {
    history.push({ role: 'user', content: text })
    const { match, response, fallback } = simulate(getScenario(product), { product, role, lang: opts.lang, messages: [...history], world: opts.world ?? null })
    out.push({ id: `s-u${i}`, role: 'user', content: text })
    const a: ChatMessage = {
      id: `s-a${i}`,
      role: 'assistant',
      content: response.text,
      status: 'done',
      mode: 'sim',
      toolCalls: (response.toolCalls ?? []).map((c, k) => ({ ...c, id: `s-${i}-${k}` })),
      structured: response.structured ? [response.structured] : [],
      followUps: response.followUps ?? [],
      confidence: match.confidence,
    }
    if (!fallback && match.intentId) a.intentId = match.intentId
    if (response.translation) a.translation = response.translation
    out.push(a)
    history.push({ role: 'assistant', content: response.text })
  })
  return out
}
