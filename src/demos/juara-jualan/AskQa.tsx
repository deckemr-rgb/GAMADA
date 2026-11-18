/**
 * demos/juara-jualan/AskQa.tsx — "Tanya QA" (lazy; registers scenario.ts): a chat over the hybrid engine (Simulasi, or
 * Live through the proxy with score_call / draft_coaching). Cards: 'score' (criteria 0–5 with evidence) and
 * 'juara-jualan/draft_coaching' ("Buka dialog coaching" opens the assign dialog prefilled). New answers are announced.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button, Input } from '../../demo-kit/ui'
import { useAiChat, type Structured } from '../../demo-kit/ai/chat'
import { clock, useSession, world, type CriterionKey, type Industry } from '../../demo-kit/world'
import { CALL_CRITERIA, CRITERIA_KEYS } from '../../demo-kit/world/usaha-pintar'
import { qaCtx } from './scenario'
import { useT } from './strings'

const S = {
  id: {
    title: 'Tanya QA',
    input: 'Pertanyaan untuk asisten QA',
    ph: 'Mis. “Siapa paling perlu coaching?”',
    send: 'Kirim',
    starters: ['Skor terendah hari ini?', 'Siapa paling perlu coaching?', 'Kenapa skor percakapan ini rendah?', 'Keberatan tersering 14 hari?', 'Contoh jawab keberatan harga', 'Buat kartu coaching'],
    thinking: 'Menganalisis…',
    you: 'Anda',
    ai: 'Asisten QA',
    card: 'Draf kartu coaching',
    open: 'Buka dialog coaching',
    score: 'Penilaian per kriteria',
    total: 'Total',
    practice: 'Buka tab Latihan',
    fellBack: 'AI Live sibuk, dijawab Simulasi',
    mode: { sim: 'Simulasi', live: 'Live' },
  },
  en: {
    title: 'Ask QA',
    input: 'Question for the QA assistant',
    ph: 'E.g. “Who needs coaching most?”',
    send: 'Send',
    starters: ['Lowest score today?', 'Who needs coaching most?', 'Why is this call scored low?', 'Most common objection in 14 days?', 'How to answer a price objection', 'Draft a coaching card'],
    thinking: 'Analysing…',
    you: 'You',
    ai: 'QA assistant',
    card: 'Coaching card draft',
    open: 'Open the coaching dialog',
    score: 'Score per criterion',
    total: 'Total',
    practice: 'Open the Practice tab',
    fellBack: 'AI Live busy, answered by Simulation',
    mode: { sim: 'Simulation', live: 'Live' },
  },
}
const KEY_OF: Record<string, CriterionKey> = { 'gali-kebutuhan': 'gali', 'kepatuhan-skrip': 'kepatuhan' }

export interface AskQaProps {
  industry: Industry
  openCall: string | null
  onAssign: (agentId: string, callId: string | null, keys: CriterionKey[]) => void
  onPractice: () => void
}

export default function AskQa({ industry, openCall, onAssign, onPractice }: AskQaProps) {
  const { lang } = useT()
  const L = S[lang]
  const session = useSession()
  const ctx = useRef({ industry, openCall })
  ctx.current = { industry, openCall }
  const chat = useAiChat('juara-jualan', { mode: session.aiMode, role: session.role, lang, getContext: () => qaCtx(world.get(), clock.get().minutes, ctx.current.industry, ctx.current.openCall) })
  const [text, setText] = useState('')
  const [said, setSaid] = useState('')
  const { messages, send, prepare } = chat
  useEffect(() => prepare(), [prepare])
  const last = messages[messages.length - 1]
  useEffect(() => {
    if (last?.role === 'assistant' && last.status === 'done') setSaid(last.content.slice(0, 200))
  }, [last?.id, last?.status]) // eslint-disable-line react-hooks/exhaustive-deps
  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    const q = text.trim()
    if (!q) return
    setText('')
    void send(q)
  }
  const card = (v: Structured, key: string) => {
    const d = v.data as Record<string, unknown>
    if (v.kind === 'juara-jualan/draft_coaching') {
      const focus = (d.focus as { key: CriterionKey; title: string; example: string; titleEn?: string; exampleEn?: string }[]) ?? []
      const agentId = typeof d.agentId === 'string' ? d.agentId : (openCall ? world.get().calls.byId[openCall]?.agentId : undefined)
      return (
        <div key={key} className="dk-jj-qcard">
          <p className="dk-jj-h4">{L.card}</p>
          <ol className="dk-jj-focus">
            {focus.map((f, i) => (
              <li key={i}>
                <b>{lang === 'en' && f.titleEn ? f.titleEn : f.title}</b>
                <span className="dk-jj-muted">{lang === 'en' && f.exampleEn ? f.exampleEn : f.example}</span>
              </li>
            ))}
          </ol>
          {agentId && (
            <Button size="sm" variant="primary" icon="users" onClick={() => onAssign(agentId, openCall, focus.map((f) => f.key))}>
              {L.open}
            </Button>
          )}
        </div>
      )
    }
    if (v.kind === 'score') {
      const cr = (d.criteria as { id: string; score: number; evidence?: string }[]) ?? []
      return (
        <div key={key} className="dk-jj-qcard">
          <p className="dk-jj-h4">{L.score}</p>
          <ul className="dk-jj-qscore">
            {cr.map((c) => {
              const k = (KEY_OF[c.id] ?? c.id) as CriterionKey
              return (
                <li key={c.id}>
                  <span>{CRITERIA_KEYS.includes(k) ? CALL_CRITERIA[k][lang] : c.id}</span>
                  <b className="dk-num">{c.score}/5</b>
                </li>
              )
            })}
          </ul>
          <p>
            {L.total} <b className="dk-num">{String(d.total ?? '')}</b>/100
          </p>
        </div>
      )
    }
    return null
  }
  return (
    <section className="dk-jj-qa" aria-label={L.title}>
      <p className="dk-sr" role="status" aria-live="polite">
        {said}
      </p>
      <div className="dk-jj-qstarters">
        {L.starters.map((q) => (
          <button key={q} type="button" className="dk-jj-qchip" onClick={() => void send(q)}>
            {q}
          </button>
        ))}
      </div>
      <ol className="dk-jj-qlog">
        {messages.map((m) => (
          <li key={m.id} className={`dk-jj-qmsg is-${m.role}`}>
            <span className="dk-jj-faint">
              {m.role === 'user' ? L.you : `${L.ai} · ${L.mode[m.mode ?? 'sim']}`}
              {m.fellBack ? ` · ${L.fellBack}` : ''}
            </span>
            <p>{m.status === 'thinking' ? L.thinking : m.content}</p>
            {m.structured?.map((v, i) => card(v, `${m.id}-${i}`))}
            {m.intentId === 'mulai-latihan' && m.status === 'done' && (
              <Button size="sm" variant="secondary" icon="mic" onClick={onPractice}>
                {L.practice}
              </Button>
            )}
          </li>
        ))}
      </ol>
      <form className="dk-jj-qform" onSubmit={submit}>
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={L.ph} aria-label={L.input} onFocus={prepare} />
        <Button type="submit" variant="primary" icon="send" disabled={!text.trim()} aria-label={L.send}>
          {L.send}
        </Button>
      </form>
    </section>
  )
}
