/**
 * demos/radar-isu/Assistant.tsx — "Tanya analis AI": a lazy chat drawer over the hybrid engine (14 simulated intents in
 * ID / EN / Basa Jawa, or Live through the proxy with assess_mention / draft_clarification / analyze_topic).
 * Structured answers render as cards: post assessment ('sentiment'), clarification package ('clarification'),
 * topic analysis ('analysis'). New answers are announced politely.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button, Drawer, Icon, Input } from '../../demo-kit/ui'
import { useAiChat, type ChatMessage, type Structured } from '../../demo-kit/ai/chat'
import { clock, useSession, world } from '../../demo-kit/world'
import { radarCtx } from './ctx'
import { useDeferredOpen } from './model'
import './scenario'

const S = {
  id: {
    title: 'Analis AI Radar Isu',
    eyebrow: 'Tanya dalam Bahasa Indonesia, English, atau Basa Jawa',
    placeholder: 'Mis. “Ada hoaks?” atau “isu apa wae dina iki?”',
    input: 'Pertanyaan untuk analis AI',
    send: 'Kirim',
    stop: 'Hentikan',
    starters: ['Ringkas isu hari ini', 'Ada hoaks?', 'Isu negatif terbesar apa?', 'isu apa wae dina iki?'],
    thinking: 'Menganalisis…',
    assess: 'Penilaian unggahan',
    hoaxLik: 'Kemungkinan hoaks',
    sentiment: 'Sentimen',
    topic: 'Topik',
    reasons: 'Alasan',
    need: 'Bukti yang masih diperlukan',
    clar: 'Paket klarifikasi',
    openClar: 'Buka penyusun klarifikasi',
    analysis: 'Analisis topik',
    trend: { naik: 'naik', turun: 'turun', stabil: 'stabil' } as Record<string, string>,
    neg: 'negatif',
    sent: {
      negatif: 'negatif',
      netral: 'netral',
      positif: 'positif',
    } as Record<string, string>,
    mode: { sim: 'Simulasi', live: 'Live' },
    fellBack: 'AI Live sibuk, dijawab Simulasi',
    you: 'Anda',
    ai: 'Analis AI',
    empty: 'Mulai dengan salah satu pertanyaan di bawah.',
  },
  en: {
    title: 'Radar Isu AI analyst',
    eyebrow: 'Ask in English, Bahasa Indonesia or Basa Jawa',
    placeholder: 'E.g. “Is there a hoax?” or “What’s trending today?”',
    input: 'Question for the AI analyst',
    send: 'Send',
    stop: 'Stop',
    starters: ["Summarise today's issues", 'Is there a hoax?', 'What is the top negative issue?', 'isu apa wae dina iki?'],
    thinking: 'Analysing…',
    assess: 'Post assessment',
    hoaxLik: 'Hoax likelihood',
    sentiment: 'Sentiment',
    topic: 'Topic',
    reasons: 'Reasons',
    need: 'Evidence still needed',
    clar: 'Clarification package',
    openClar: 'Open the clarification drafter',
    analysis: 'Topic analysis',
    trend: { naik: 'rising', turun: 'falling', stabil: 'stable' } as Record<string, string>,
    neg: 'negative',
    sent: {
      negatif: 'negative',
      netral: 'neutral',
      positif: 'positive',
    } as Record<string, string>,
    mode: { sim: 'Simulation', live: 'Live' },
    fellBack: 'AI Live busy, answered by Simulation',
    you: 'You',
    ai: 'AI analyst',
    empty: 'Start with one of the questions below.',
  },
}

type T = (typeof S)['id']

function Card({ v, t, onOpenClarify }: { v: Structured; t: T; onOpenClarify?: (() => void) | undefined }) {
  const d = v.data as Record<string, unknown>
  if (v.kind === 'sentiment') {
    const pct = Math.round(Number(d.hoaxLikelihood ?? 0) * 100)
    const reasons = Array.isArray(d.reasons) ? (d.reasons as string[]) : []
    const need = Array.isArray(d.evidenceNeeded) ? (d.evidenceNeeded as string[]) : []
    return (
      <div className="dk-ri-card">
        <p className="dk-ri-card-h">{t.assess}</p>
        <dl className="dk-ri-dl">
          <dt>{t.hoaxLik}</dt>
          <dd className={`dk-num${pct >= 60 ? ' is-danger' : ''}`}>{pct}%</dd>
          <dt>{t.sentiment}</dt>
          <dd>{t.sent[String(d.sentiment)] ?? String(d.sentiment ?? '')}</dd>
          <dt>{t.topic}</dt>
          <dd>{String(d.topic ?? '')}</dd>
        </dl>
        {!!reasons.length && (
          <>
            <p className="dk-ri-k">{t.reasons}</p>
            <ul className="dk-ri-ul">
              {reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </>
        )}
        {!!need.length && (
          <>
            <p className="dk-ri-k">{t.need}</p>
            <ul className="dk-ri-ul">
              {need.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    )
  }
  if (v.kind === 'clarification') {
    const pts = Array.isArray(d.infographicPoints) ? (d.infographicPoints as string[]) : []
    return (
      <div className="dk-ri-card">
        <p className="dk-ri-card-h">{t.clar}</p>
        <p className="dk-ri-card-b">{String(d.socialCaption ?? '')}</p>
        <ol className="dk-ri-ul">
          {pts.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ol>
        {onOpenClarify && (
          <Button size="sm" variant="primary" icon="spark" onClick={onOpenClarify}>
            {t.openClar}
          </Button>
        )}
      </div>
    )
  }
  if (v.kind === 'analysis') {
    const sent = (d.sentiment ?? {}) as Record<string, number>
    const kws = Array.isArray(d.keywords) ? (d.keywords as string[]) : []
    return (
      <div className="dk-ri-card">
        <p className="dk-ri-card-h">
          {t.analysis}: {kws.join(', ')}
        </p>
        <p className="dk-ri-card-b">
          {t.trend[String(d.volumeTrend)] ?? String(d.volumeTrend ?? '')} · {Math.round((sent.negatif ?? 0) * 100)}% {t.neg}
        </p>
      </div>
    )
  }
  return null
}

function Msg({ m, t, onOpenClarify }: { m: ChatMessage; t: T; onOpenClarify?: (() => void) | undefined }) {
  if (m.role === 'user')
    return (
      <li className="dk-ri-msg is-user">
        <span className="dk-sr">{t.you}: </span>
        {m.content}
      </li>
    )
  return (
    <li className="dk-ri-msg is-ai">
      <span className="dk-sr">{t.ai}: </span>
      {m.status === 'thinking' ? (
        <span className="dk-ri-think">
          <span className="dk-ri-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          {t.thinking}
        </span>
      ) : (
        <div className="dk-ri-msg-b">
          {m.content.split('\n').map((ln, i) => (
            <p key={i}>{ln.replace(/\*\*(.+?)\*\*/g, '$1')}</p>
          ))}
          {m.translation && <p className="dk-ri-note">{m.translation}</p>}
        </div>
      )}
      {!!m.toolCalls?.length && (
        <ol className="dk-ri-steps">
          {m.toolCalls.map((c) => (
            <li key={c.id}>
              <Icon name="check" size={13} /> <code>{c.name}</code>
            </li>
          ))}
        </ol>
      )}
      {m.structured?.map((v, i) => (
        <Card key={i} v={v} t={t} onOpenClarify={onOpenClarify} />
      ))}
      {m.status === 'done' && (
        <p className="dk-ri-mode">
          <span className={`dk-ri-mode-pill is-${m.mode ?? 'sim'}`}>{t.mode[m.mode ?? 'sim']}</span>
          {m.fellBack && <span className="dk-ri-note">{t.fellBack}</span>}
        </p>
      )}
    </li>
  )
}

export default function Assistant({
  open,
  prompt,
  promptKey,
  onClose,
  onOpenClarify,
}: {
  open: boolean
  prompt: string | null
  promptKey: number
  onClose: () => void
  onOpenClarify?: (() => void) | undefined
}) {
  const session = useSession()
  const bodyRef = useRef<HTMLDivElement>(null)
  const shown = useDeferredOpen(open, bodyRef)
  const lang = session.lang
  const t = S[lang]
  const chat = useAiChat('radar-isu', {
    mode: session.aiMode,
    role: session.role,
    lang,
    getContext: () => radarCtx(world.get(), clock.get().minutes),
  })
  const [text, setText] = useState('')
  const { send } = chat
  useEffect(() => {
    if (open && prompt) void send(prompt)
  }, [open, prompt, promptKey, send])

  const log = useRef<HTMLOListElement>(null)
  useEffect(() => {
    const el = log.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chat.messages])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const v = text.trim()
    if (!v) return
    setText('')
    void chat.send(v)
  }
  // an answer aborted before its first word (a newer question replaced it) is dropped together with its question
  const visible = chat.messages.filter((m, i, all) => {
    const dead = (x: ChatMessage | undefined) => !!x && x.role === 'assistant' && x.status === 'stopped' && !x.content
    return !(dead(m) || (m.role === 'user' && dead(all[i + 1])))
  })
  const chips = chat.followUps.length ? chat.followUps : chat.messages.length ? [] : t.starters
  const openClar = onOpenClarify
    ? () => {
        onClose()
        onOpenClarify()
      }
    : undefined

  return (
    <Drawer open={shown} onClose={onClose} title={t.title} eyebrow={t.eyebrow} width={480}>
      <div ref={bodyRef} className="dk-ri-chat">
        {visible.length ? (
          <ol ref={log} className="dk-ri-log" aria-live="polite" aria-relevant="additions text">
            {visible.map((m) => (
              <Msg key={m.id} m={m} t={t} onOpenClarify={openClar} />
            ))}
          </ol>
        ) : (
          <p className="dk-ri-note">{t.empty}</p>
        )}
        {!!chips.length && (
          <div className="dk-ri-chips dk-ri-sugg">
            {chips.map((c) => (
              <Button key={c} size="sm" variant="secondary" onClick={() => void chat.send(c)} disabled={chat.busy}>
                {c}
              </Button>
            ))}
          </div>
        )}
        <form className="dk-ri-ask" onSubmit={submit}>
          <Input value={text} onChange={(e) => setText(e.target.value)} onFocus={chat.prepare} placeholder={t.placeholder} aria-label={t.input} maxLength={600} />
          {chat.busy ? (
            <Button type="button" variant="secondary" icon="pause" onClick={chat.stop}>
              {t.stop}
            </Button>
          ) : (
            <Button type="submit" variant="primary" icon="send" disabled={!text.trim()}>
              {t.send}
            </Button>
          )}
        </form>
      </div>
    </Drawer>
  )
}
