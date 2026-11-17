/**
 * "Tanya AI" drawer (lazy): questions about meetings, letters and follow-ups, answered from the world on screen
 * (Simulasi: scenario.ts intents in ID / EN / Basa Jawa; Live: the proxy with the same context). Streams with the
 * kit's thinking dots, shows agent steps and follow-up chips; answers are announced politely.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useI18n } from '../../lib/i18n'
import { Badge, Button, Chip, Drawer, IconButton } from '../../demo-kit/ui'
import { useClock, world } from '../../demo-kit/world'
import { useNaskahAi } from './ai'
import { buildCtx } from './ctx'
import { lettersCtx } from './inbox'
import { SCRIPT, dueText } from './model'
import type { NpNav } from './index'
import { useStr } from './strings'

export default function Assistant({ open, onClose, nav }: { open: boolean; onClose: () => void; nav: NpNav }) {
  const S = useStr()
  const { lang } = useI18n()
  const now = useClock().minutes
  const ai = useNaskahAi()
  const [q, setQ] = useState('')
  const list = useRef<HTMLOListElement>(null)

  useEffect(() => {
    ai.prepare()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = list.current
    if (el) el.scrollTop = el.scrollHeight
  }, [ai.messages])

  const send = (text: string) => {
    const t = text.trim()
    if (!t) return
    setQ('')
    const s = world.get()
    const meeting = s.meetings.ids.map((id) => s.meetings.byId[id]).find((m) => m && m.at >= 0 && m.title.id.includes('Banjir') && m.transcribed)
    void ai.ask(
      t,
      buildCtx(
        s,
        now,
        lang,
        'ask',
        {
          // the inbox as the screen shows it (sample letters' number / sender / subject)
          letters: lettersCtx(s),
          ...(meeting ? { minutes: { decisions: SCRIPT.decisions.map((d) => d.text), actions: SCRIPT.actions.map((a) => ({ task: a.text, pic: a.pic, due: dueText(a.dueAt, lang, s.day) })) } } : {}),
        },
        nav.myOpd,
      ),
    )
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    send(q)
  }
  const chips = ai.followUps.length ? ai.followUps : ai.messages.length ? [] : S.aStarters

  return (
    <Drawer open={open} onClose={onClose} title={S.aTitle} eyebrow={S.askAi} width={440}>
      <div className="dk-np-ask">
        <p className="dk-np-muted">{S.aLead}</p>
        <ol ref={list} className="dk-np-msgs" aria-label={S.aConversation} aria-live="polite">
          {ai.messages.map((m) => (
            <li key={m.id} className={`dk-np-msg is-${m.role}`}>
              <span className="dk-np-msg-who">{m.role === 'user' ? S.aYou : S.aAi}</span>
              {m.role === 'assistant' && m.status === 'thinking' ? (
                <span className="dk-np-dots" aria-label="…">
                  <i />
                  <i />
                  <i />
                </span>
              ) : (
                <p className="dk-np-msg-t">{m.content}</p>
              )}
              {m.translation && <p className="dk-np-msg-tr">{m.translation}</p>}
              {m.role === 'assistant' && !!m.toolCalls?.length && (
                <p className="dk-np-steps" aria-label={S.aSteps}>
                  {m.toolCalls.map((t) => (
                    <code key={t.id}>{t.name}</code>
                  ))}
                </p>
              )}
              {m.role === 'assistant' && m.status === 'done' && <Badge tone={m.mode === 'live' ? 'accent' : 'neutral'}>{S.lAiMode[m.mode ?? 'sim']}</Badge>}
            </li>
          ))}
        </ol>
        {chips.length > 0 && (
          <div className="dk-np-chips" role="group" aria-label={S.aSuggest}>
            {chips.map((c) => (
              <Chip key={c} icon="spark" onToggle={() => send(c)} selected={false}>
                {c}
              </Chip>
            ))}
          </div>
        )}
        <form className="dk-np-askform" onSubmit={submit}>
          <input className="dk-np-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={S.aPlaceholder} aria-label={S.aInput} data-np="ask-input" data-autofocus />
          {ai.busy ? (
            <Button type="button" variant="quiet" onClick={ai.stop}>
              {S.aStop}
            </Button>
          ) : (
            <IconButton type="submit" icon="send" variant="primary" label={S.aSendLabel} disabled={!q.trim()} data-np="ask-send" />
          )}
        </form>
      </div>
    </Drawer>
  )
}
