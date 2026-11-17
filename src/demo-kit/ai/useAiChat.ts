/**
 * ai/useAiChat.ts — React hook over AiProvider for any chat surface (spec §9).
 *
 * The hook never imports the world store: callers pass `getContext()` (sim answers read it as ctx.world; live
 * requests send summarize(getContext()) ≤ 6 KB). World events a simulated answer wants (`SimResponse.emits`)
 * are handed to `onEmits` after the answer finished streaming.
 *
 * The hook does not import the engine either: provider.ts (scripted engine, intent matcher, streaming) is loaded
 * with import() on the first send(), or earlier with prepare() (e.g. when the chat input gets focus), so a page
 * whose chat is never used never downloads it. staticConversation (sync, needs the engine) lives in static.ts.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PRODUCT_BY_SLUG, type ProductSlug, type RoleId } from '../../content/products'
import { useI18n } from '../../lib/i18n'
import type { AiChunk, ChatRequest, Lang, Msg, SimResponse, Structured, ToolCall } from './types'

/** the engine half (provider + scripted engine + matcher + streaming), loaded once on first use */
let engine: Promise<typeof import('./provider')> | null = null
export function loadAiEngine(): Promise<typeof import('./provider')> {
  engine ??= import('./provider').catch((e: unknown) => {
    engine = null
    throw e
  })
  return engine
}

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
  /** start loading the AI engine now (e.g. on input focus) so the first answer starts without a fetch */
  prepare: () => void
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
        const { getAi, takeSimExtras } = await loadAiEngine()
        const chunks: AsyncIterable<AiChunk> | AiChunk[] = ctrl.signal.aborted ? [] : getAi(mode).chat(req)
        for await (const c of chunks) {
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
  const prepare = useCallback(() => void loadAiEngine().catch(() => {}), [])
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
      prepare,
      busy: last?.status === 'thinking' || last?.status === 'streaming',
      thinking: last?.status === 'thinking',
      streaming: last?.status === 'streaming',
      followUps: last?.status === 'done' ? (last.followUps ?? []) : [],
      structured: last?.structured ?? [],
      last,
      fellBack: !!last?.fellBack,
    }
  }, [messages, send, stop, reset, prepare])
}
