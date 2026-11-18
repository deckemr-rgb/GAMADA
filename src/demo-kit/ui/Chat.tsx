/**
 * ChatThread + ChatComposer — the shared chat (Toko Autopilot PO chat + supplier phone, Pajak Beres "Tanya Pajak",
 * Juara Jualan roleplay / WA transcripts, Pantau Merek reply threads).
 *  - `messages`: { id, side: 'me' | 'them' | 'system', text, at? (world minutes), status?, author? }
 *  - the log is `aria-live="polite"`; a NEW bubble slides 8 px + fades (transform / opacity, one ticker tween), only
 *    opacity under reduced motion, nothing under ?static=1; the list keeps the newest bubble in view
 *  - `typing` shows the three-dot bubble ("… sedang mengetik"); `quickReplies` render 44 px chips
 *  - ChatComposer: 44 px input + send, Enter sends, Shift+Enter is a newline; keyboard-safe bottom padding
 */
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useI18n } from '../../lib/i18n'
import { DEMO, EASE } from '../../lib/motion'
import { Icon } from './icons'
import { animatePose, motionMode, type PoseTween } from './motion'
import './chat.css'

type Bi = { id: string; en: string }
export interface ChatMessage {
  id: string
  side: 'me' | 'them' | 'system'
  text: Bi | string
  /** world minutes (shown as HH.MM / HH:MM) */
  at?: number
  status?: 'sent' | 'delivered' | 'read'
  author?: string
}
export interface ChatThreadProps {
  messages: readonly ChatMessage[]
  /** true or the typer's name */
  typing?: boolean | string
  quickReplies?: readonly { id: string; label: Bi }[]
  onQuick?: (id: string) => void
  /** a quick reply that is not possible yet: the chips render disabled with this reason */
  quickDisabled?: Bi
  highlightId?: string
  label: Bi
  className?: string
}

const S = {
  id: { typing: 'sedang mengetik', you: 'Anda', sent: 'terkirim', delivered: 'tersampaikan', read: 'dibaca', quick: 'Balasan cepat' },
  en: { typing: 'is typing', you: 'You', sent: 'sent', delivered: 'delivered', read: 'read', quick: 'Quick replies' },
}
const hm = (m: number, lang: 'id' | 'en') => {
  const x = ((Math.floor(m) % 1440) + 1440) % 1440
  const s = `${String(Math.floor(x / 60)).padStart(2, '0')}${lang === 'id' ? '.' : ':'}${String(x % 60).padStart(2, '0')}`
  return s
}

export function ChatThread({ messages, typing, quickReplies, onQuick, quickDisabled, highlightId, label, className }: ChatThreadProps) {
  const { lang } = useI18n()
  const t = S[lang]
  const list = useRef<HTMLOListElement>(null)
  const known = useRef<Set<string> | null>(null)
  const tweens = useRef<PoseTween[]>([])

  // new bubbles: slide + fade (the first render shows everything as is)
  useLayoutEffect(() => {
    const el = list.current
    if (!el) return
    const ids = new Set(messages.map((m) => m.id))
    const prev = known.current
    known.current = ids
    if (prev) {
      const mode = motionMode()
      for (const m of messages) {
        if (prev.has(m.id) || mode === 'static') continue
        const node = el.querySelector<HTMLElement>(`[data-msg="${CSS.escape(m.id)}"]`)
        if (!node) continue
        tweens.current.push(mode === 'reduced' ? animatePose(node, { opacity: 0 }, { opacity: 1 }, { duration: DEMO.reducedFade }) : animatePose(node, { y: 8, opacity: 0 }, { y: 0, opacity: 1 }, { duration: DEMO.panel, ease: EASE.out }))
      }
    }
    el.scrollTop = el.scrollHeight
  }, [messages, typing])
  useEffect(() => () => {
    for (const tw of tweens.current) tw.kill()
  }, [])
  useEffect(() => {
    if (!highlightId) return
    list.current?.querySelector(`[data-msg="${CSS.escape(highlightId)}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [highlightId])

  const txt = (x: Bi | string) => (typeof x === 'string' ? x : x[lang])
  return (
    <section className={`dk-chat${className ? ` ${className}` : ''}`} aria-label={label[lang]}>
      <ol ref={list} className="dk-chat-list" role="log" aria-live="polite" aria-relevant="additions" tabIndex={0}>
        {messages.map((m) => (
          <li key={m.id} data-msg={m.id} className={`dk-chat-msg is-${m.side}${m.id === highlightId ? ' is-hl' : ''}`}>
            {m.side !== 'system' && m.author && <span className="dk-chat-author">{m.author}</span>}
            <span className="dk-chat-text">{txt(m.text)}</span>
            {(m.at !== undefined || m.status) && (
              <span className="dk-chat-meta">
                {m.at !== undefined && <time>{hm(m.at, lang)}</time>}
                {m.status && (
                  <span className={`dk-chat-tick is-${m.status}`}>
                    <span aria-hidden="true">{m.status === 'sent' ? '✓' : '✓✓'}</span>
                    <span className="dk-sr">{t[m.status]}</span>
                  </span>
                )}
              </span>
            )}
          </li>
        ))}
        {typing && (
          <li className="dk-chat-msg is-them is-typing" aria-label={`${typeof typing === 'string' ? typing : ''} ${t.typing}`.trim()}>
            <span className="dk-chat-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </li>
        )}
      </ol>
      {quickReplies && quickReplies.length > 0 && (
        <div className="dk-chat-quick" role="group" aria-label={t.quick}>
          {quickReplies.map((q) => (
            <button key={q.id} type="button" className="dk-chat-chip" disabled={!!quickDisabled} title={quickDisabled?.[lang]} onClick={() => onQuick?.(q.id)}>
              {q.label[lang]}
            </button>
          ))}
          {quickDisabled && <p className="dk-chat-why">{quickDisabled[lang]}</p>}
        </div>
      )}
    </section>
  )
}

export interface ChatComposerProps {
  onSend: (text: string) => void
  placeholder: Bi
  label: Bi
  sendLabel?: Bi
  /** blocked composer: rendered disabled WITH this visible reason */
  disabledReason?: Bi
  /** prefill (e.g. a suggestion chip); the composer keeps its own state after that */
  value?: string
  onFocus?: () => void
  className?: string
}
export function ChatComposer({ onSend, placeholder, label, sendLabel, disabledReason, value, onFocus, className }: ChatComposerProps) {
  const { lang } = useI18n()
  const [text, setText] = useState(value ?? '')
  useEffect(() => {
    if (value !== undefined) setText(value)
  }, [value])
  const off = !!disabledReason
  const send = (e?: FormEvent) => {
    e?.preventDefault()
    const v = text.trim()
    if (!v || off) return
    onSend(v)
    setText('')
  }
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) send(e)
  }
  return (
    <form className={`dk-chat-compose${className ? ` ${className}` : ''}`} onSubmit={send}>
      <textarea
        rows={1}
        value={text}
        aria-label={label[lang]}
        placeholder={placeholder[lang]}
        disabled={off}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKey}
        onFocus={onFocus}
      />
      <button type="submit" className="dk-chat-send" disabled={off || !text.trim()} aria-label={(sendLabel ?? { id: 'Kirim', en: 'Send' })[lang]}>
        <Icon name="send" size={18} />
      </button>
      {off && <p className="dk-chat-why">{disabledReason[lang]}</p>}
    </form>
  )
}
