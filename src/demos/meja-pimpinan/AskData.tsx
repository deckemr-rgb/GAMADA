/**
 * AskData (lazy) — "Tanya data" chat (spec P2 step 3). Simulasi: the registered scenario answers from the world;
 * Live: the proxy with tools query_world / issue_instruction / compose_briefing (automatic fallback to Simulasi).
 * Structured results render the same in both modes: `query` → mini chart computed on screen + "Lihat kecamatan"
 * (and the map flies to the top district), `instruction` → a draft card that opens the instruction dialog,
 * `briefing` → the composed list.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useI18n, type Lang } from '../../lib/i18n'
import { PRODUCT_BY_SLUG, isProductSlug } from '../../content/products'
import { registerScenario, useAiChat, type ChatMessage, type Structured } from '../../demo-kit/ai/chat'
import { Button, Icon, IconButton, Input, dropChips } from '../../demo-kit/ui'
import { useShell } from '../../demo-kit/shell'
import { clock, emit, useClock, useSession, useWorld, world, type EventMap } from '../../demo-kit/world'
import { briefingItems } from '../../demo-kit/world/satu-daerah'
import { causeQuestion, opdsInText, risingCategory } from './data'
import { askContext } from './ideas'
import { parseSpec, runQuery } from './query'
import { QueryChart } from './QueryChart'
import { scenario } from './scenario'
import type { AskProps } from './AskBox'

registerScenario(scenario)

const A = {
  title: { id: 'Tanya data', en: 'Ask the data' },
  sim: { id: 'Simulasi', en: 'Simulation' },
  live: { id: 'Live', en: 'Live' },
  fell: { id: 'AI Live sibuk, dijawab Simulasi', en: 'Live AI busy, answered by Simulation' },
  reset: { id: 'Mulai ulang percakapan', en: 'Restart the conversation' },
  shrink: { id: 'Perkecil panel jawaban', en: 'Shrink the answer panel' },
  grow: { id: 'Perbesar panel jawaban', en: 'Enlarge the answer panel' },
  thinking: { id: 'Asisten sedang menghitung', en: 'The assistant is computing' },
  steps: { id: 'Langkah agent', en: 'Agent steps' },
  stop: { id: 'Hentikan jawaban', en: 'Stop the answer' },
  showKec: { id: 'Lihat Kec. {k} di peta', en: 'Show {k} on the map' },
  draft: { id: 'Draf instruksi', en: 'Draft instruction' },
  to: { id: 'Kepada', en: 'To' },
  due: { id: 'Tenggat', en: 'Due' },
  prio: { id: 'Prioritas', en: 'Priority' },
  review: { id: 'Tinjau & kirim', en: 'Review & send' },
  briefing: { id: 'Briefing tersusun', en: 'Briefing composed' },
  ph: { id: 'Tanya dalam bahasa sehari-hari…', en: 'Ask in plain language…' },
  label: { id: 'Pertanyaan data untuk asisten pimpinan', en: 'Data question for the leadership assistant' },
  send: { id: 'Tanya', en: 'Ask' },
  hint: { id: 'Jawaban berupa teks, grafik, dan peta yang terbang ke kecamatan terkait.', en: 'Answers come as text, a chart, and the map flying to the district concerned.' },
  q: {
    id: ['Kenapa aduan jalan naik minggu ini?', 'Kecamatan mana paling banyak aduan?', 'OPD mana yang paling lambat?', 'Perkiraan aduan 3 hari ke depan'],
    en: ['Why are road complaints up this week?', 'Which district has the most complaints?', 'Which agency is the slowest?', 'Forecast complaints for the next 3 days'],
  },
  suggestions: { id: 'Saran pertanyaan', en: 'Suggested questions' },
  you: { id: 'Anda', en: 'You' },
  ai: { id: 'Asisten', en: 'Assistant' },
}

export default function AskData({ onFly, onInstruct, onAnswered, leader, draft, pending, onPendingTaken, autoFocus }: AskProps & { draft: string; pending: string | null; onPendingTaken: () => void; autoFocus?: boolean }) {
  const { lang } = useI18n()
  const session = useSession()
  const now = useClock().minutes
  const [text, setText] = useState(draft)
  const formRef = useRef<HTMLFormElement>(null)
  useLayoutEffect(() => {
    // taking over from the stub while the viewer was typing: keep the focus and put the caret after the text
    if (!autoFocus) return
    const input = formRef.current?.querySelector('input')
    if (!input) return
    input.focus()
    input.setSelectionRange(input.value.length, input.value.length)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const rising = useWorld((s) => risingCategory(s, now))
  const flown = useRef(new Set<string>())
  const cb = useRef({ onFly, onAnswered })
  cb.current = { onFly, onAnswered }
  const chat = useAiChat('meja-pimpinan', {
    mode: session.aiMode,
    role: session.role,
    getContext: () => askContext(world.get(), clock.get().minutes, lang, leader),
    onEmits: (emits) => {
      for (const e of emits) if (e.type === 'briefing.generated') emit('briefing.generated', e.payload as EventMap['briefing.generated'], 'meja-pimpinan')
    },
    onDone: (m) => {
      if (m.status === 'done' && (m.content || m.structured?.length)) cb.current.onAnswered()
      // Live compose_briefing: the world briefing is assembled from the world itself (refs to real entities)
      if (m.mode === 'live' && m.structured?.some((x) => x.kind === 'briefing')) {
        const items = briefingItems(world.get(), clock.get().minutes)
        emit('briefing.generated', { items: items.map(({ title, source, refs }) => ({ title, source, refs })) }, 'meja-pimpinan')
      }
      // the map flies to the district the answer is about (once per answer)
      for (const st of m.structured ?? []) {
        if (st.kind !== 'query' || flown.current.has(m.id)) continue
        const spec = parseSpec(st.data)
        const kec = spec ? runQuery(world.get(), clock.get().minutes, spec, lang).kecamatanId : undefined
        if (kec) {
          flown.current.add(m.id)
          cb.current.onFly(kec)
        }
      }
    },
  })
  const { send, prepare } = chat
  useEffect(() => {
    // the question asked before the chat chunk arrived; deferred one task so a StrictMode remount (dev) cannot
    // abort it, and cleared on unmount so it is sent exactly once
    if (!pending) return
    const q = pending
    const id = window.setTimeout(() => {
      onPendingTaken()
      setText('')
      void send(q)
    }, 0)
    return () => window.clearTimeout(id)
  }, [pending, send, onPendingTaken])

  const logRef = useRef<HTMLDivElement>(null)
  const count = chat.messages.length
  useLayoutEffect(() => {
    // a new question scrolls to the top of that question, so its answer (text + chart) reads from the start
    const el = logRef.current
    const q = el?.querySelectorAll<HTMLElement>('.dk-mp-q')
    const last = q?.[q.length - 1]
    if (el && last) el.scrollTop = Math.max(0, last.offsetTop - el.offsetTop - 6)
  }, [count])
  const [expanded, setExpanded] = useState(true)
  const sm = useShell().size === 'sm'

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const q = text.trim()
    if (!q || chat.busy) return
    setText('')
    void send(q)
  }
  const ask = (q: string) => {
    if (chat.busy) return
    void send(q)
  }

  return (
    <section className={`dk-mp-panel dk-mp-ask${count && expanded ? ' is-active' : ''}`} aria-labelledby="dk-mp-ask-h">
      <header className="dk-mp-ph">
        <h3 id="dk-mp-ask-h">
          <Icon name="spark" size={16} />
          {A.title[lang]}
          <span className={`dk-mp-mode${session.aiMode === 'live' ? ' is-live' : ''}`}>{session.aiMode === 'live' ? A.live[lang] : A.sim[lang]}</span>
        </h3>
        {count > 0 && (
          <span className="dk-mp-ph-act">
            {!sm && <IconButton icon={expanded ? 'chevronDown' : 'chevronUp'} size="sm" label={expanded ? A.shrink[lang] : A.grow[lang]} aria-expanded={expanded} onClick={() => setExpanded((x) => !x)} />}
            <IconButton icon="refresh" size="sm" label={A.reset[lang]} onClick={chat.reset} />
          </span>
        )}
      </header>
      <div ref={logRef} className="dk-mp-pb dk-mp-log" aria-live="polite" aria-relevant="additions text">
        {chat.messages.length === 0 ? (
          <>
            <p className="dk-mp-meta">{A.hint[lang]}</p>
            <div className="dk-mp-chips" role="group" aria-label={A.suggestions[lang]}>
              {[causeQuestion(rising)[lang], ...A.q[lang].slice(1)].map((q) => (
                <button key={q} type="button" className="dk-mp-qchip" onClick={() => ask(q)}>
                  {q}
                </button>
              ))}
            </div>
          </>
        ) : (
          chat.messages.filter((m) => !(m.status === 'stopped' && !m.content)).map((m) => (m.role === 'user' ? <p key={m.id} className="dk-mp-q"><span className="dk-sr">{A.you[lang]}: </span>{m.content}</p> : <Answer key={m.id} m={m} lang={lang} now={now} onFly={onFly} onInstruct={onInstruct} onAsk={ask} busy={chat.busy} />))
        )}
      </div>
      <form ref={formRef} className="dk-mp-askform" onSubmit={submit}>
        <Input value={text} onChange={(e) => setText(e.target.value)} onFocus={prepare} placeholder={A.ph[lang]} aria-label={A.label[lang]} />
        {chat.busy ? (
          <IconButton icon="close" variant="quiet" label={A.stop[lang]} onClick={chat.stop} />
        ) : (
          <Button type="submit" variant="primary" size="sm" icon="send" disabled={!text.trim()}>
            {A.send[lang]}
          </Button>
        )}
      </form>
    </section>
  )
}

function Answer({ m, lang, now, onFly, onInstruct, onAsk, busy }: { m: ChatMessage; lang: Lang; now: number; onFly: AskProps['onFly']; onInstruct: AskProps['onInstruct']; onAsk: (q: string) => void; busy: boolean }) {
  const chipsRef = useRef<HTMLDivElement>(null)
  const done = m.status === 'done' || m.status === 'stopped'
  useLayoutEffect(() => {
    if (done && chipsRef.current) return dropChips(chipsRef.current)
  }, [done])
  return (
    <article className="dk-mp-a" aria-busy={!done}>
      <span className="dk-sr">{A.ai[lang]}: </span>
      {m.status === 'thinking' ? (
        <p className="dk-mp-dots" role="status">
          <span className="dk-sr">{A.thinking[lang]}</span>
          <i />
          <i />
          <i />
        </p>
      ) : (
        <p className="dk-mp-a-t">{m.content}</p>
      )}
      {!!m.toolCalls?.length && (
        <ul className="dk-mp-steps" aria-label={A.steps[lang]}>
          {m.toolCalls.map((c) => (
            <li key={c.id}>
              <Icon name="zap" size={12} />
              <code>{c.name}</code>
              {typeof c.input.metric === 'string' && <span>{[c.input.metric, c.input.groupBy, c.input.range].filter(Boolean).join(' · ')}</span>}
            </li>
          ))}
        </ul>
      )}
      {done && (m.structured ?? []).map((st, i) => <StructuredView key={i} st={st} lang={lang} now={now} onFly={onFly} onInstruct={onInstruct} />)}
      {m.fellBack && <p className="dk-mp-fell">{A.fell[lang]}</p>}
      {done && !!m.followUps?.length && (
        <div ref={chipsRef} className="dk-mp-chips">
          {m.followUps.map((q) => (
            <button key={q} type="button" className="dk-mp-qchip" onClick={() => onAsk(q)} disabled={busy}>
              {q}
            </button>
          ))}
        </div>
      )}
    </article>
  )
}

function StructuredView({ st, lang, now, onFly, onInstruct }: { st: Structured; lang: Lang; now: number; onFly: AskProps['onFly']; onInstruct: AskProps['onInstruct'] }) {
  // numbers are computed once, when the answer lands (later world changes do not rewrite an answer)
  const [at] = useState(now)
  const res = useMemo(() => {
    if (st.kind !== 'query') return null
    const spec = parseSpec(st.data)
    return spec ? runQuery(world.get(), at, spec, lang) : null
  }, [st, at, lang])
  if (st.kind === 'query' && res) {
    const kec = res.kecamatanId
    return (
      <div className="dk-mp-qres">
        <QueryChart res={res} lang={lang} />
        {kec && (
          <Button size="sm" variant="ghost" icon="pin" onClick={() => onFly(kec, true)}>
            {A.showKec[lang].replace('{k}', world.get().region.kecamatan.find((k) => k.id === kec)?.name ?? kec)}
          </Button>
        )}
      </div>
    )
  }
  if (st.kind === 'instruction') {
    const d = st.data as { to?: string; instruction?: string; deadline?: string; priority?: string }
    const open = () => {
      const s = world.get()
      const t = d.instruction ?? ''
      onInstruct({ text: { id: t, en: t }, opdIds: opdsInText(s, `${d.to ?? ''} ${t}`) })
    }
    return (
      <div className="dk-mp-draft">
        <p className="dk-mp-draft-h">
          <Icon name="send" size={14} />
          {A.draft[lang]}
        </p>
        <dl>
          <dt>{A.to[lang]}</dt>
          <dd>{d.to}</dd>
          <dt>{A.due[lang]}</dt>
          <dd>{d.deadline ?? '–'}</dd>
          <dt>{A.prio[lang]}</dt>
          <dd>{d.priority}</dd>
        </dl>
        <p className="dk-mp-draft-t">{d.instruction}</p>
        <Button size="sm" variant="primary" icon="send" onClick={open}>
          {A.review[lang]}
        </Button>
      </div>
    )
  }
  if (st.kind === 'briefing') {
    const items = (st.data.items ?? []) as { title: string; source: string }[]
    return (
      <div className="dk-mp-draft">
        <p className="dk-mp-draft-h">
          <Icon name="doc" size={14} />
          {A.briefing[lang]}
        </p>
        <ol className="dk-mp-blist">
          {items.map((it, i) => (
            <li key={i}>
              {it.title} <span className="dk-mp-meta">· {isProductSlug(it.source) ? PRODUCT_BY_SLUG[it.source].name : it.source}</span>
            </li>
          ))}
        </ol>
      </div>
    )
  }
  return null
}
