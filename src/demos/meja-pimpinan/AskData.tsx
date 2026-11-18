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
import { clock, emit, useSession, useWorld, world, type EventMap } from '../../demo-kit/world'
import AppLink from '../../components/AppLink'
import { demoHref } from '../../demo-kit/shell'
import { causeQuestion, mpBriefingItems, opdsInText, risingCategory, useNow, withControls } from './data'
import { askContext } from './ideas'
import { parseSpec, runQuery } from './query'
import { QueryChart } from './QueryChart'
import { draftInstruction, kecInText, scenario } from './scenario'
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
  openSiaga: { id: 'Buka Siaga Wilayah', en: 'Open Siaga Wilayah' },
  draftChip: { id: 'membuka draf instruksi', en: 'opens an instruction draft' },
  suggestions: { id: 'Saran pertanyaan', en: 'Suggested questions' },
  you: { id: 'Anda', en: 'You' },
  ai: { id: 'Asisten', en: 'Assistant' },
}

export default function AskData({ onFly, onInstruct, onAnswered, leader, draft, pending, onPendingTaken, autoFocus }: AskProps & { draft: string; pending: string | null; onPendingTaken: () => void; autoFocus?: { current: boolean } }) {
  const { lang } = useI18n()
  const session = useSession()
  const now = useNow(60)
  const [text, setText] = useState(draft)
  const formRef = useRef<HTMLFormElement>(null)
  useLayoutEffect(() => {
    // taking over from the stub while the viewer was still typing in it (not after they tabbed on): keep the focus and
    // put the caret after the text
    if (!autoFocus?.current) return
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
        const items = mpBriefingItems(world.get(), clock.get().minutes)
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
    // a new question scrolls to the top of that question, so its answer (text + chart) reads from the start; when
    // the log box changes size (the panel takes a larger share, a banner appears, the window resizes) the newest
    // question is put back at the top instead of leaving the view on pieces of older answers
    const el = logRef.current
    if (!el) return
    const anchor = () => {
      const q = el.querySelectorAll<HTMLElement>('.dk-mp-q')
      const last = q[q.length - 1]
      if (last) el.scrollTop = Math.max(0, last.offsetTop - el.offsetTop - 6)
    }
    anchor()
    if (typeof ResizeObserver === 'undefined') return
    // while the answer streams in (text, then chart) the question can only reach the top once there is enough below
    // it: keep re-anchoring as the answer grows, until the viewer scrolls the log themselves
    let pinned = true
    const unpin = () => (pinned = false)
    el.addEventListener('wheel', unpin, { passive: true })
    el.addEventListener('touchmove', unpin, { passive: true })
    let h = el.clientHeight
    const ro = new ResizeObserver(() => {
      if (el.clientHeight !== h) {
        h = el.clientHeight
        anchor()
      } else if (pinned) anchor()
    })
    ro.observe(el)
    const last = el.lastElementChild
    if (last) ro.observe(last)
    return () => {
      ro.disconnect()
      el.removeEventListener('wheel', unpin)
      el.removeEventListener('touchmove', unpin)
    }
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
  // an "Instruksikan …" follow-up is an action, not a question: it opens the instruction dialog pre-filled
  const toDraft = (q: string) => {
    const s = world.get()
    const t = draftInstruction(s, q, lang, kecInText(s, q)[0])
    onInstruct({ text: { id: t, en: t }, opdIds: opdsInText(s, q) })
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
          chat.messages.filter((m) => !(m.status === 'stopped' && !m.content)).map((m) => (m.role === 'user' ? <p key={m.id} className="dk-mp-q"><span className="dk-sr">{A.you[lang]}: </span>{m.content}</p> : <Answer key={m.id} m={m} lang={lang} onFly={onFly} onInstruct={onInstruct} onAsk={ask} onDraft={toDraft} busy={chat.busy} />))
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

/** what an agent step looked at, in words ("Sumber: aduan · per kecamatan · 7 hari"); the tool name stays in the tooltip */
const PV = {
  src: { id: 'Sumber', en: 'Source' },
  metric: {
    complaints: { id: 'aduan', en: 'complaints' }, sla_on_time: { id: 'SLA tepat waktu', en: 'on-time SLA' }, ticket_backlog: { id: 'tiket terbuka', en: 'open tickets' },
    alerts: { id: 'peringatan', en: 'alerts' }, mentions_negative: { id: 'isu negatif', en: 'negative issues' }, procurement_risk: { id: 'paket pengadaan', en: 'procurement packages' },
    sales: { id: 'penjualan UMKM', en: 'small-business sales' }, prices: { id: 'harga pasar', en: 'market prices' }, econ_index: { id: 'indeks ekonomi', en: 'economic index' },
    action_items_overdue: { id: 'tindak lanjut terlambat', en: 'overdue follow-ups' },
  } as Record<string, { id: string; en: string }>,
  group: {
    kecamatan: { id: 'per kecamatan', en: 'by district' }, opd: { id: 'per OPD', en: 'by agency' }, category: { id: 'per kategori', en: 'by category' }, day: { id: 'per hari', en: 'by day' },
    commodity: { id: 'per komoditas', en: 'by commodity' }, market: { id: 'per pasar', en: 'by market' },
  } as Record<string, { id: string; en: string }>,
  range: { today: { id: 'hari ini', en: 'today' }, '7d': { id: '7 hari', en: '7 days' }, '30d': { id: '30 hari', en: '30 days' }, '90d': { id: '90 hari', en: '90 days' } } as Record<string, { id: string; en: string }>,
  tool: { issue_instruction: { id: 'draf instruksi', en: 'instruction draft' }, compose_briefing: { id: 'briefing dari 6 produk', en: 'briefing from 6 products' } } as Record<string, { id: string; en: string }>,
}
function provenance(name: string, input: Record<string, unknown>, lang: Lang): string {
  const w = (x: unknown, m: Record<string, { id: string; en: string }>) => (typeof x === 'string' ? m[x]?.[lang] : undefined)
  const parts = typeof input.metric === 'string' ? [w(input.metric, PV.metric) ?? input.metric, w(input.groupBy, PV.group), w(input.range, PV.range)] : [PV.tool[name]?.[lang] ?? name]
  return `${PV.src[lang]}: ${parts.filter(Boolean).join(' · ')}`
}

/** follow-up chips that give an order rather than ask a question */
const ORDER = /^(instruksikan|perintahkan|tugaskan|minta|instruct|order|tell|ask the)\b/i

function Answer({ m, lang, onFly, onInstruct, onAsk, onDraft, busy }: { m: ChatMessage; lang: Lang; onFly: AskProps['onFly']; onInstruct: AskProps['onInstruct']; onAsk: (q: string) => void; onDraft: (q: string) => void; busy: boolean }) {
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
            <li key={c.id} title={c.name}>
              <Icon name="zap" size={12} />
              {provenance(c.name, c.input, lang)}
            </li>
          ))}
        </ul>
      )}
      {done && (m.structured ?? []).map((st, i) => <StructuredView key={i} st={st} lang={lang} onFly={onFly} onInstruct={onInstruct} />)}
      {m.fellBack && <p className="dk-mp-fell">{A.fell[lang]}</p>}
      {done && !!m.followUps?.length && (
        <div ref={chipsRef} className="dk-mp-chips">
          {m.followUps.map((q) =>
            ORDER.test(q) ? (
              <button key={q} type="button" className="dk-mp-qchip is-order" onClick={() => onDraft(q)} aria-label={`${q} (${A.draftChip[lang]})`}>
                <Icon name="send" size={12} />
                {q}
              </button>
            ) : (
              <button key={q} type="button" className="dk-mp-qchip" onClick={() => onAsk(q)} disabled={busy}>
                {q}
              </button>
            ),
          )}
        </div>
      )}
    </article>
  )
}

function StructuredView({ st, lang, onFly, onInstruct }: { st: Structured; lang: Lang; onFly: AskProps['onFly']; onInstruct: AskProps['onInstruct'] }) {
  // numbers are computed once, at the exact minute the answer lands (later world changes do not rewrite an answer)
  const [at] = useState(() => clock.get().minutes)
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
  if (st.kind === 'link' && typeof st.data.product === 'string' && isProductSlug(st.data.product)) {
    return <LinkOut product={st.data.product} lang={lang} />
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

/** a hand-off to another product (e.g. evacuation questions go to Siaga Wilayah) */
function LinkOut({ product, lang }: { product: Parameters<typeof demoHref>[0]; lang: Lang }) {
  const session = useSession()
  return (
    <AppLink className="dk-mp-linkbtn" to={withControls(demoHref(product, session, null))}>
      <Icon name={PRODUCT_BY_SLUG[product].icon as Parameters<typeof Icon>[0]['name']} size={14} />
      {product === 'siaga-wilayah' ? A.openSiaga[lang] : PRODUCT_BY_SLUG[product].name}
      <Icon name="arrowUpRight" size={12} />
    </AppLink>
  )
}
