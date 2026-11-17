/**
 * Assistant.tsx (lazy) — "Tanya AI" drawer: chat about the open package (sim scenario in scenario.ts, or Live via
 * the proxy with automatic fallback). Answers stream token by token (aria-live), agent steps and structured
 * results (risk, audit-memo) render as chips / cards; an audit-memo answer offers "Buka di tab Laporan".
 */
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Button, Drawer, Icon, Score, dropChips } from '../../demo-kit/ui'
import { useAiChat, type ChatMessage } from '../../demo-kit/ai/chat'
import { useSession, useWorld, world, type WorldState } from '../../demo-kit/world'
import { aiContext, findPump } from './model'
import './scenario'
import { useT, type Strings } from './strings'
import type { RoleKey } from './types'

const codeOf = (id: string | null) => (s: WorldState) => (id ? (s.procurements.byId[id]?.code ?? null) : null)
const pumpOf = (s: WorldState) => findPump(s)?.id ?? null

export default function Assistant({
  open, onClose, procurementId, roleKey, onOpenMemo, onOpenPackage,
}: {
  open: boolean
  onClose: () => void
  procurementId: string | null
  roleKey: RoleKey
  onOpenMemo: () => void
  /** list-level shortcut: open a package from the drawer */
  onOpenPackage: (id: string) => void
}) {
  const { t, lang } = useT()
  const session = useSession()
  const code = useWorld(codeOf(procurementId))
  const pumpId = useWorld(pumpOf)
  const idRef = useRef(procurementId)
  idRef.current = procurementId
  const chat = useAiChat('awas-belanja', { mode: session.aiMode, role: roleKey, getContext: () => aiContext(world.get(), idRef.current, roleKey) })
  const [text, setText] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    chat.prepare()
    inputRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chat.messages])

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (!text.trim() || chat.busy) return
    void chat.send(text)
    setText('')
  }
  const ask = (q: string) => {
    if (chat.busy) return
    void chat.send(q)
  }
  // no package open → list-level suggestions (package questions would only answer "open a package first")
  const chips = chat.messages.length ? chat.followUps : procurementId ? t.chatSuggest : t.chatSuggestList
  const showOpenPump = !procurementId && !!pumpId

  return (
    <Drawer open={open} onClose={onClose} title={t.chatTitle} eyebrow={code ? t.chatEyebrow(code) : t.chatListEyebrow} width={460}>
      <div className="dk-ab-chat">
        <div ref={listRef} className="dk-ab-chat-list" aria-live="polite" aria-relevant="additions text">
          {!chat.messages.length && <p className="dk-ab-muted">{procurementId ? t.chatEmpty : t.chatEmptyList}</p>}
          {chat.messages.map((m) => (
            <Message key={m.id} m={m} t={t} onOpenMemo={procurementId ? onOpenMemo : undefined} lang={lang} />
          ))}
        </div>
        {(chips.length > 0 || showOpenPump) && (
          <div className="dk-ab-chat-chips" role="group" aria-label={lang === 'id' ? 'Saran pertanyaan' : 'Suggested questions'}>
            {showOpenPump && pumpId && (
              <button type="button" className="dk-ab-chip is-act" onClick={() => onOpenPackage(pumpId)}>
                <Icon name="forward" size={14} />
                {t.chatOpenPump}
              </button>
            )}
            {chips.map((c) => (
              <button key={c} type="button" className="dk-ab-chip" onClick={() => ask(c)} disabled={chat.busy}>
                {c}
              </button>
            ))}
          </div>
        )}
        <form className="dk-ab-chat-form" onSubmit={submit}>
          <input
            ref={inputRef}
            className="dk-ab-chat-in"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t.chatPlaceholder}
            aria-label={t.chatPlaceholder}
            onFocus={chat.prepare}
            maxLength={500}
          />
          {chat.busy ? (
            <Button type="button" variant="secondary" icon="pause" onClick={chat.stop}>
              {t.chatStop}
            </Button>
          ) : (
            <Button type="submit" variant="primary" icon="send" disabled={!text.trim()}>
              {t.chatSend}
            </Button>
          )}
        </form>
        <p className="dk-ab-chat-mode">
          <Icon name={session.aiMode === 'live' ? 'live' : 'spark'} size={14} />
          {t.chatMode[session.aiMode]}
          {chat.fellBack && ` · ${t.memoFallback}`}
        </p>
      </div>
    </Drawer>
  )
}

function Message({ m, t, onOpenMemo, lang }: { m: ChatMessage; t: Strings; onOpenMemo: (() => void) | undefined; lang: 'id' | 'en' }) {
  const steps = useRef<HTMLUListElement>(null)
  const nSteps = m.toolCalls?.length ?? 0
  useEffect(() => {
    if (nSteps && steps.current) dropChips(steps.current)
  }, [nSteps])
  if (m.role === 'user')
    return (
      <div className="dk-ab-msg is-user">
        <span className="dk-sr">{t.chatYou}: </span>
        <p>{m.content}</p>
      </div>
    )
  const risk = m.structured?.find((x) => x.kind === 'risk')
  const memo = m.structured?.find((x) => x.kind === 'audit-memo')
  return (
    <div className="dk-ab-msg is-ai">
      <span className="dk-sr">{t.chatAi}: </span>
      {m.status === 'thinking' ? (
        <p className="dk-ab-memo-think">
          <span className="dk-ab-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          {t.chatThinking}
        </p>
      ) : (
        <Rich text={m.content} />
      )}
      {m.translation && <p className="dk-ab-msg-tr">{m.translation}</p>}
      {nSteps > 0 && (
        <ul ref={steps} className="dk-ab-msg-steps" aria-label={t.chatSteps}>
          {m.toolCalls!.map((c) => (
            <li key={c.id} className="dk-ab-step">
              <Icon name="check" size={12} />
              {t.toolLabel[c.name] ?? c.name.replace(/_/g, ' ')}
            </li>
          ))}
        </ul>
      )}
      {risk && <RiskCard data={risk.data} t={t} />}
      {memo && onOpenMemo && (
        <Button size="sm" variant="primary" icon="doc" onClick={onOpenMemo}>
          {t.chatOpenMemo}
        </Button>
      )}
      {m.status === 'done' && m.mode && <p className="dk-ab-msg-mode">{lang === 'id' ? `Mode ${t.chatMode[m.mode]}` : `${t.chatMode[m.mode]} mode`}</p>}
    </div>
  )
}

function RiskCard({ data, t }: { data: Record<string, unknown>; t: Strings }) {
  const score = typeof data.riskScore === 'number' ? data.riskScore : null
  const flags = Array.isArray(data.flags) ? (data.flags as { detector?: string; severity?: string; note?: string }[]) : []
  if (score == null) return null
  return (
    <div className="dk-ab-msg-risk">
      <Score value={score} label={t.chatRisk} higherIsBetter={false} warn={35} danger={60} size={48} />
      <ul>
        {flags.slice(0, 4).map((f, i) => (
          <li key={i} className={`is-${f.severity ?? 'rendah'}`}>
            {f.note}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** minimal rich text: paragraphs, "- " bullets, **bold** (no HTML injection: React text nodes only) */
function Rich({ text }: { text: string }) {
  const lines = text.split('\n')
  const out: ReactNode[] = []
  let list: string[] = []
  const flush = () => {
    if (list.length) out.push(<ul key={`u${out.length}`}>{list.map((l, i) => <li key={i}>{bold(l)}</li>)}</ul>)
    list = []
  }
  lines.forEach((l) => {
    if (/^\s*-\s+/.test(l)) list.push(l.replace(/^\s*-\s+/, ''))
    else {
      flush()
      if (l.trim()) out.push(<p key={`p${out.length}`}>{bold(l)}</p>)
    }
  })
  flush()
  return <div className="dk-ab-rich">{out}</div>
}
function bold(s: string) {
  const parts = s.split(/\*\*(.+?)\*\*/g)
  return parts.map((p, i) => (i % 2 ? <b key={i}>{p}</b> : p))
}
