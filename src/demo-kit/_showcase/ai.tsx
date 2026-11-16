/**
 * /lab/_kit showcase section for the "ai" module — owned by the ai builder.
 * Left: a chat panel on the fixture scenario (thinking dots, streamed answer, agent steps, structured chips that
 * drop in with a 60 ms stagger, follow-up chips, sim/live pill). Right: a matcher inspector (top-3 intents with
 * confidence bars against the threshold) and the trace of the last answer (timing, steps, fixture world).
 * ?static=1 renders a finished conversation without streaming.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { gsap } from 'gsap'
import { DEMO, isEnabled, prefersReducedMotion } from '../../lib/motion'
import { useI18n } from '../../lib/i18n'
import '../ui/tokens.css'
import './ai.css'
import {
  checkHealth,
  streamSchedule,
  DEFAULT_SYNONYMS,
  getMatcher,
  getScenario,
  isLiveConfigured,
  LIVE_FALLBACK_NOTICE,
  onLiveFallback,
  registerScenario,
  staticConversation,
  unregisterScenario,
  useAiChat,
  type ChatMessage,
  type Lang,
  type Scenario,
  type Structured,
} from '../ai'
import { applyFixtureEmits, createFixtureWorld, SAMPLE_PROMPTS, sampleScenario, type FixtureWorld } from '../ai/__fixtures__/sample-scenario'

/* ------------------------------------------------------------------ copy */

const C = {
  id: {
    lead: 'Mesin hybrid: simulasi bawaan (pencocok intent TF-IDF + n-gram karakter + sinonim ID/EN/Jawa, jawaban dialirkan 25–45 token/detik) dan mode Live lewat proxy dengan fallback otomatis. Panel ini memakai skenario uji',
    account: 'Sapa Warga · skenario uji',
    sub: '8 intent · ID, EN, Basa Jawa',
    sim: 'Simulasi',
    live: 'Live',
    modeLabel: 'Mode AI',
    liveOff: 'Live belum tersedia: proxy AI tidak dikonfigurasi (VITE_AI_PROXY_URL) atau tidak menjawab cek kesehatan. Demo tetap berjalan dengan Simulasi.',
    liveChecking: 'Memeriksa proxy AI…',
    reset: 'Mulai ulang percakapan',
    empty: 'Ketik pertanyaan warga, atau pilih salah satu saran di bawah.',
    thinking: 'AI sedang menyusun jawaban',
    placeholder: 'Tulis pesan… (ID, EN, atau Basa Jawa)',
    inputLabel: 'Pesan untuk asisten',
    send: 'Kirim',
    stop: 'Hentikan jawaban',
    detected: 'Hasil terstruktur',
    steps: 'Langkah agent',
    suggestions: 'Saran pertanyaan',
    translation: 'Terjemahan',
    fellBack: 'beralih ke simulasi',
    stopped: 'dihentikan',
    inspector: 'Inspektur pencocok intent',
    inspectorSub: (t: number) => `ambang ${fmt(t, 'id')}`,
    inspectorLabel: 'Teks untuk dicocokkan',
    toChat: 'Kirim ke chat',
    threshold: 'ambang keyakinan',
    verdictHit: 'Jawaban dari intent',
    verdictMiss: 'Di bawah ambang → jawaban fallback + chip saran',
    slots: 'slot',
    features: 'Fitur setelah normalisasi (sinonim, imbuhan dipangkas):',
    trace: 'Jejak jawaban terakhir',
    traceSub: 'diukur di browser',
    noTrace: 'Belum ada jawaban.',
    st: { mode: 'Mode', intent: 'Intent', conf: 'Keyakinan', first: 'Token pertama', rate: 'Laju (tanpa jeda)', tokens: 'Token' },
    fallbackIntent: 'fallback',
    world: 'Dunia uji',
    complaints: 'aduan hari ini',
    tickets: 'tiket',
    lastTicket: 'tiket terbaru',
    presetsLabel: 'Contoh',
  },
  en: {
    lead: 'Hybrid engine: built-in simulation (TF-IDF + character n-gram intent matcher with ID/EN/Javanese synonyms, answers streamed at 25–45 tokens/s) and a Live mode through the proxy with automatic fallback. This panel runs the test scenario',
    account: 'Sapa Warga · test scenario',
    sub: '8 intents · ID, EN, Javanese',
    sim: 'Simulation',
    live: 'Live',
    modeLabel: 'AI mode',
    liveOff: 'Live is unavailable: the AI proxy is not configured (VITE_AI_PROXY_URL) or failed its health check. The demo keeps running on Simulation.',
    liveChecking: 'Checking the AI proxy…',
    reset: 'Restart the conversation',
    empty: 'Type a citizen question, or pick a suggestion below.',
    thinking: 'AI is drafting a reply',
    placeholder: 'Write a message… (ID, EN or Javanese)',
    inputLabel: 'Message to the assistant',
    send: 'Send',
    stop: 'Stop the answer',
    detected: 'Structured result',
    steps: 'Agent steps',
    suggestions: 'Suggested questions',
    translation: 'Translation',
    fellBack: 'fell back to simulation',
    stopped: 'stopped',
    inspector: 'Intent matcher inspector',
    inspectorSub: (t: number) => `threshold ${fmt(t, 'en')}`,
    inspectorLabel: 'Text to match',
    toChat: 'Send to chat',
    threshold: 'confidence threshold',
    verdictHit: 'Answered by intent',
    verdictMiss: 'Below threshold → fallback answer + suggestion chips',
    slots: 'slots',
    features: 'Features after normalisation (synonyms, affixes stripped):',
    trace: 'Last answer trace',
    traceSub: 'measured in the browser',
    noTrace: 'No answer yet.',
    st: { mode: 'Mode', intent: 'Intent', conf: 'Confidence', first: 'First token', rate: 'Rate (excl. pauses)', tokens: 'Tokens' },
    fallbackIntent: 'fallback',
    world: 'Test world',
    complaints: 'complaints today',
    tickets: 'tickets',
    lastTicket: 'latest ticket',
    presetsLabel: 'Examples',
  },
}

const INTENT_NAME: Record<string, { id: string; en: string }> = {
  'lapor-banjir': { id: 'Lapor banjir', en: 'Flood report' },
  'lapor-jalan-rusak': { id: 'Lapor jalan rusak', en: 'Damaged road report' },
  'lampu-pju-mati': { id: 'Lampu jalan mati', en: 'Streetlight out' },
  'sampah-jawa': { id: 'Sampah (Basa Jawa)', en: 'Waste (Javanese)' },
  'syarat-ktp': { id: 'Syarat KTP', en: 'ID card requirements' },
  'cek-status': { id: 'Cek status tiket', en: 'Ticket status' },
  'jam-layanan': { id: 'Jam layanan', en: 'Opening hours' },
  'teruskan-petugas': { id: 'Teruskan ke petugas', en: 'Hand off to an officer' },
}

const KIND_NAME: Record<string, { id: string; en: string }> = {
  ticket: { id: 'Tiket', en: 'Ticket' },
  'ticket-status': { id: 'Status tiket', en: 'Ticket status' },
  info: { id: 'Informasi', en: 'Information' },
  handoff: { id: 'Dialihkan', en: 'Handed off' },
}

const FIELD_NAME: Record<string, { id: string; en: string }> = {
  id: { id: 'No.', en: 'No.' },
  category: { id: 'Kategori', en: 'Category' },
  opd: { id: 'OPD', en: 'Agency' },
  urgency: { id: 'Urgensi', en: 'Urgency' },
  kecamatan: { id: 'Kecamatan', en: 'District' },
  sla: { id: 'SLA', en: 'SLA' },
  status: { id: 'Status', en: 'Status' },
  service: { id: 'Layanan', en: 'Service' },
  place: { id: 'Tempat', en: 'Place' },
  cost: { id: 'Biaya', en: 'Cost' },
  hours: { id: 'Jam', en: 'Hours' },
  queue: { id: 'Antrean', en: 'Queue' },
  position: { id: 'Posisi', en: 'Position' },
}

const PRESETS: { tag: string; text: string }[] = [
  { tag: 'ID', text: 'Lampu PJU depan masjid mati sudah 3 hari' },
  { tag: 'EN', text: 'there are potholes near the market in Kapas' },
  { tag: 'JW', text: 'uwuhe numpuk neng pasar, durung dijupuk' },
  { tag: '?', text: 'resep nasi goreng yang enak' },
]

function fmt(n: number, lang: Lang, digits = 2): string {
  return n.toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}
const intentName = (id: string | undefined, lang: Lang) => (id ? (INTENT_NAME[id]?.[lang] ?? id) : '—')

type MotionMode = 'static' | 'reduced' | 'full'
function useMotionMode(): MotionMode {
  const [params] = useSearchParams()
  if (params.get('static') === '1') return 'static'
  return isEnabled('demoAnimations') && !prefersReducedMotion() ? 'full' : 'reduced'
}

/* ------------------------------------------------------------------ section */

export default function Section() {
  const { lang } = useI18n()
  const c = C[lang]
  const mode = useMotionMode()

  // Register the fixture while mounted (restoring whatever was registered before).
  useState(() => {
    if (getScenario('sapa-warga') !== (sampleScenario as Scenario<unknown>)) registerScenario(sampleScenario)
    return true
  })
  useEffect(() => {
    const prev = getScenario('sapa-warga')
    registerScenario(sampleScenario)
    return () => {
      if (prev && prev !== (sampleScenario as Scenario<unknown>)) registerScenario(prev)
      else unregisterScenario('sapa-warga')
    }
  }, [])

  const [world, setWorld] = useState<FixtureWorld>(createFixtureWorld)
  const worldRef = useRef(world)
  worldRef.current = world

  const [aiMode, setAiMode] = useState<'sim' | 'live'>('sim')
  const [live, setLive] = useState<'checking' | 'ok' | 'off'>(isLiveConfigured() ? 'checking' : 'off')
  useEffect(() => {
    if (!isLiveConfigured()) return
    let alive = true
    void checkHealth().then((h) => alive && setLive(h.live ? 'ok' : 'off'))
    return () => {
      alive = false
    }
  }, [])

  const initial = useMemo(
    () => (mode === 'static' ? staticConversation('sapa-warga', [SAMPLE_PROMPTS[lang][0]!, SAMPLE_PROMPTS[lang][2]!], { lang, world: createFixtureWorld() }) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const chat = useAiChat('sapa-warga', {
    lang,
    mode: aiMode,
    getContext: () => worldRef.current,
    onEmits: (emits) => setWorld((w) => applyFixtureEmits(w, emits)),
    ...(initial ? { initial } : {}),
  })

  /* live → sim fallback notice (spec §8.5) */
  const [notice, setNotice] = useState(false)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined
    const off = onLiveFallback((i) => {
      if (i.product !== 'sapa-warga') return
      setNotice(true)
      clearTimeout(t)
      t = setTimeout(() => setNotice(false), DEMO.toastMs)
    })
    return () => {
      off()
      clearTimeout(t)
    }
  }, [])

  /* auto-demo: send the Javanese sample once when the panel is first seen */
  const rootRef = useRef<HTMLDivElement>(null)
  const sentRef = useRef(false)
  const send = chat.send
  useEffect(() => {
    if (mode === 'static' || sentRef.current || !rootRef.current) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[entries.length - 1]?.isIntersecting && !sentRef.current) {
          sentRef.current = true
          io.disconnect()
          void send(SAMPLE_PROMPTS[lang][0]!)
        }
      },
      { threshold: 0.3 },
    )
    io.observe(rootRef.current)
    return () => io.disconnect()
  }, [mode, lang, send])

  return (
    <div ref={rootRef} className={`dk-root dk-ai${mode !== 'full' ? ' is-still' : ''}`} data-eco="satu-daerah">
      <p className="dk-ai-lead">
        {c.lead} <code>ai/__fixtures__/sample-scenario.ts</code>.
      </p>
      <div className="dk-ai-grid">
        <ChatPanel
          chat={chat}
          lang={lang}
          motion={mode}
          aiMode={aiMode}
          setAiMode={setAiMode}
          live={live}
          notice={notice}
          onReset={() => {
            chat.reset()
            setWorld(createFixtureWorld())
          }}
        />
        <div className="dk-ai-side">
          <Inspector lang={lang} onSend={(t) => void chat.send(t)} busy={chat.busy} />
          <Trace lang={lang} last={chat.last} world={world} />
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ chat panel */

interface ChatPanelProps {
  chat: ReturnType<typeof useAiChat>
  lang: Lang
  motion: MotionMode
  aiMode: 'sim' | 'live'
  setAiMode: (m: 'sim' | 'live') => void
  live: 'checking' | 'ok' | 'off'
  notice: boolean
  onReset: () => void
}

function ChatPanel({ chat, lang, motion, aiMode, setAiMode, live, notice, onReset }: ChatPanelProps) {
  const c = C[lang]
  const [draft, setDraft] = useState('')
  const [tipOpen, setTipOpen] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)
  const last = chat.messages[chat.messages.length - 1]
  const lastLen = last?.content.length ?? 0
  const lastStruct = last?.structured?.length ?? 0
  const lastSteps = last?.toolCalls?.length ?? 0

  // keep the log scrolled to the newest content (inside the panel only, never the page)
  useLayoutEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chat.messages.length, lastLen, lastStruct, lastSteps, chat.followUps.length])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (chat.busy) {
      chat.stop()
      return
    }
    const t = draft.trim()
    if (!t) return
    setDraft('')
    void chat.send(t)
  }

  const liveUsable = live === 'ok'
  const suggestions = chat.messages.length === 0 ? SAMPLE_PROMPTS[lang] : chat.followUps

  return (
    <section className="dk-ai-chat" aria-label={c.account}>
      <header className="dk-ai-head">
        <span className="dk-ai-avatar" aria-hidden="true">
          SW
        </span>
        <span className="dk-ai-who">
          <b>{c.account}</b>
          <small>{c.sub}</small>
        </span>
        <div className="dk-ai-mode" role="group" aria-label={c.modeLabel}>
          <button type="button" aria-pressed={aiMode === 'sim'} onClick={() => setAiMode('sim')}>
            <i aria-hidden="true" />
            {c.sim}
          </button>
          <button
            type="button"
            className="is-live"
            aria-pressed={aiMode === 'live'}
            aria-disabled={!liveUsable}
            aria-describedby={liveUsable ? undefined : 'dk-ai-live-tip'}
            onClick={() => (liveUsable ? setAiMode('live') : setTipOpen((o) => !o))}
            onBlur={() => setTipOpen(false)}
          >
            <i aria-hidden="true" />
            {c.live}
          </button>
          {!liveUsable && (
            <span id="dk-ai-live-tip" role="tooltip" className={`dk-ai-tip${tipOpen ? ' is-open' : ''}`}>
              {live === 'checking' ? c.liveChecking : c.liveOff}
            </span>
          )}
        </div>
        <button type="button" className="dk-ai-iconbtn" aria-label={c.reset} title={c.reset} onClick={onReset}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3.5 10a6.5 6.5 0 1 0 2-4.7" />
            <path d="M3.5 3.5v3.3h3.3" />
          </svg>
        </button>
      </header>

      {notice && (
        <p className="dk-ai-notice" role="status">
          {LIVE_FALLBACK_NOTICE[lang]}
        </p>
      )}

      <div className="dk-ai-log" ref={logRef} role="log" aria-live="polite" aria-relevant="additions">
        {chat.messages.length === 0 && <p className="dk-ai-empty">{c.empty}</p>}
        {chat.messages.map((m) => (m.role === 'user' ? <UserMsg key={m.id} m={m} /> : <AiMsg key={m.id} m={m} lang={lang} motion={motion} />))}
      </div>

      {suggestions.length > 0 && !chat.busy && (
        <div className="dk-ai-follow" role="group" aria-label={c.suggestions}>
          {suggestions.map((s) => (
            <button key={s} type="button" className="dk-ai-fchip" onClick={() => void chat.send(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <form className="dk-ai-composer" onSubmit={submit}>
        <label className="dk-ai-sr" htmlFor="dk-ai-input">
          {c.inputLabel}
        </label>
        <input id="dk-ai-input" className="dk-ai-input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={c.placeholder} autoComplete="off" maxLength={400} />
        <button type="submit" className={`dk-ai-send${chat.busy ? ' is-stop' : ''}`} aria-label={chat.busy ? c.stop : c.send}>
          {chat.busy ? (
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <rect x="3.5" y="3.5" width="9" height="9" rx="1.5" fill="currentColor" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3.5 10h12M11 5l4.5 5-4.5 5" />
            </svg>
          )}
        </button>
      </form>
    </section>
  )
}

function UserMsg({ m }: { m: ChatMessage }) {
  return (
    <div className="dk-ai-msg dk-ai-msg--user">
      <p>{m.content}</p>
    </div>
  )
}

function AiMsg({ m, lang, motion }: { m: ChatMessage; lang: Lang; motion: MotionMode }) {
  const c = C[lang]
  if (m.status === 'thinking') {
    return (
      <div className="dk-ai-typing" role="status">
        <i aria-hidden="true" />
        <i aria-hidden="true" />
        <i aria-hidden="true" />
        <span className="dk-ai-sr">{c.thinking}</span>
      </div>
    )
  }
  const streaming = m.status === 'streaming'
  return (
    <>
      <div className={`dk-ai-msg dk-ai-msg--ai${m.status === 'error' ? ' is-error' : ''}`}>
        {/* screen readers get the answer once, when complete */}
        <p aria-hidden={streaming || undefined}>
          {m.content}
          {streaming && <span className="dk-ai-caret" aria-hidden="true" />}
        </p>
        {m.translation && (
          <p className="dk-ai-trans" lang={lang}>
            <span className="dk-ai-sr">{c.translation}: </span>
            {m.translation}
          </p>
        )}
        {!!m.toolCalls?.length && (
          <div className="dk-ai-steps" aria-label={c.steps}>
            {m.toolCalls.map((t) => (
              <span key={t.id} className="dk-ai-step">
                <b>{t.name}</b>
                <span className="dk-ai-num">{t.ms ?? 0} ms</span>
              </span>
            ))}
          </div>
        )}
        {(m.status === 'done' || m.status === 'stopped') && (
          <div className="dk-ai-meta">
            <span>{m.mode === 'live' ? c.live : c.sim}</span>
            {m.intentId && <span>· {intentName(m.intentId, lang)}</span>}
            {m.confidence !== undefined && <span className="dk-ai-num">· {Math.round(m.confidence * 100)}%</span>}
            {m.fellBack && <span className="is-fell">· {c.fellBack}</span>}
            {m.status === 'stopped' && <span>· {c.stopped}</span>}
          </div>
        )}
      </div>
      {!!m.structured?.length && <StructuredChips items={m.structured} lang={lang} motion={motion} />}
    </>
  )
}

/** Structured results as chips that drop into place (60 ms stagger; fade ≤ 150 ms when reduced). */
function StructuredChips({ items, lang, motion }: { items: Structured[]; lang: Lang; motion: MotionMode }) {
  const c = C[lang]
  const ref = useRef<HTMLDivElement>(null)
  const count = items.reduce((n, s) => n + Object.keys(s.data).length, 0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || motion === 'static') return
    const chips = el.querySelectorAll('.dk-ai-chip')
    const ctx = gsap.context(() => {
      if (motion === 'full') {
        gsap.fromTo(chips, { opacity: 0, y: -14, rotation: -3 }, { opacity: 1, y: 0, rotation: 0, duration: 0.42, stagger: DEMO.chipStagger, ease: 'back.out(2.2)' })
      } else {
        gsap.fromTo(chips, { opacity: 0 }, { opacity: 1, duration: DEMO.reducedFade })
      }
    }, el)
    return () => ctx.revert()
  }, [count, motion])
  return (
    <div className="dk-ai-struct" ref={ref}>
      {items.map((s, i) => (
        <div key={`${s.kind}-${i}`}>
          <p className="dk-ai-struct-h">
            {c.detected} · {KIND_NAME[s.kind]?.[lang] ?? s.kind}
          </p>
          <div className="dk-ai-chips">
            {Object.entries(s.data).map(([k, v]) => (
              <span key={k} className={`dk-ai-chip${k === 'urgency' && /tinggi|high/i.test(String(v)) ? ' is-warn' : ''}`}>
                <span>{FIELD_NAME[k]?.[lang] ?? k}</span>
                {String(v)}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ matcher inspector */

function Inspector({ lang, onSend, busy }: { lang: Lang; onSend: (t: string) => void; busy: boolean }) {
  const c = C[lang]
  const matcher = useMemo(() => getMatcher(sampleScenario), [])
  const [text, setText] = useState(PRESETS[2]!.text)
  const r = useMemo(() => matcher.match(text, lang), [matcher, text, lang])
  const feats = useMemo(() => matcher.features(text), [matcher, text])
  const thr = matcher.threshold
  const rows = r.candidates.length ? r.candidates : matcher.intentIds.slice(0, 3).map((id) => ({ intentId: id, confidence: 0 }))
  const slotText = Object.entries(r.slots)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ')

  return (
    <section className="dk-ai-card" aria-labelledby="dk-ai-insp-h">
      <div className="dk-ai-card-h">
        <h3 id="dk-ai-insp-h">{c.inspector}</h3>
        <small className="dk-ai-num">{c.inspectorSub(thr)}</small>
      </div>
      <div className="dk-ai-insp-row">
        <label className="dk-ai-sr" htmlFor="dk-ai-insp">
          {c.inspectorLabel}
        </label>
        <input id="dk-ai-insp" className="dk-ai-input" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" maxLength={300} />
        <button type="button" className="dk-ai-btn" disabled={!text.trim() || busy} onClick={() => onSend(text)}>
          {c.toChat}
        </button>
      </div>
      <div className="dk-ai-presets" role="group" aria-label={c.presetsLabel}>
        {PRESETS.map((p) => (
          <button key={p.text} type="button" className="dk-ai-preset" aria-pressed={text === p.text} onClick={() => setText(p.text)}>
            <b>{p.tag}</b>
            {p.text}
          </button>
        ))}
      </div>

      <ol className="dk-ai-bars" aria-live="polite">
        {rows.map((cand, i) => {
          const top = i === 0 && cand.confidence >= thr
          return (
            <li key={cand.intentId} className={top ? 'is-top' : i === 0 ? 'is-under' : ''}>
              <div className="dk-ai-bar-top">
                <b>{intentName(cand.intentId, lang)}</b>
                <span className="dk-ai-num">{fmt(cand.confidence, lang)}</span>
              </div>
              <div className="dk-ai-track" aria-hidden="true">
                <span className="dk-ai-fill" style={{ transform: `scaleX(${Math.min(1, cand.confidence)})` }} />
                <span className="dk-ai-thr" style={{ left: `${thr * 100}%` }} />
              </div>
            </li>
          )
        })}
      </ol>
      <div className="dk-ai-legend" aria-hidden="true">
        <span>
          <i />
          {c.threshold} {fmt(thr, lang)}
        </span>
      </div>
      <p className={`dk-ai-verdict${r.intentId ? '' : ' is-fallback'}`}>
        {r.intentId ? (
          <>
            {c.verdictHit} <b>{intentName(r.intentId, lang)}</b>
            {slotText && (
              <>
                {' '}
                · {c.slots}: <b>{slotText}</b>
              </>
            )}
          </>
        ) : (
          <b>{c.verdictMiss}</b>
        )}
      </p>
      {feats.length > 0 && (
        <>
          <p className="dk-ai-verdict">{c.features}</p>
          <div className="dk-ai-feats">
            {feats.map((f, i) => (
              <span key={`${f}-${i}`} className={`dk-ai-feat${f.includes('_') || SYN_CANON.has(f) ? ' is-canon' : ''}`}>
                {f}
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

const SYN_CANON = new Set(Object.keys(DEFAULT_SYNONYMS).map((k) => k.replace(/\s+/g, '_')))

/* ------------------------------------------------------------------ trace */

function Trace({ lang, last, world }: { lang: Lang; last: ChatMessage | null; world: FixtureWorld }) {
  const c = C[lang]
  const done = last && (last.status === 'done' || last.status === 'stopped') ? last : null
  const t = done?.timing
  // net rate: the punctuation pauses of this exact text are subtracted (same deterministic schedule)
  const pauseMs = done ? (() => { const s = streamSchedule(done.content); return s.totalMs - s.genMs })() : 0
  const rate = t && t.streamMs - pauseMs > 0 ? (t.tokens - 1) / ((t.streamMs - pauseMs) / 1000) : null
  const latest = world.ticketIds[0] ? world.tickets[world.ticketIds[0]] : undefined
  return (
    <section className="dk-ai-card" aria-labelledby="dk-ai-trace-h">
      <div className="dk-ai-card-h">
        <h3 id="dk-ai-trace-h">{c.trace}</h3>
        <small>{c.traceSub}</small>
      </div>
      <dl className="dk-ai-stats">
        <div>
          <dt>{c.st.intent}</dt>
          <dd title={done ? intentName(done.intentId, lang) : undefined}>{done ? (done.intentId ? intentName(done.intentId, lang) : c.fallbackIntent) : '—'}</dd>
        </div>
        <div>
          <dt>{c.st.conf}</dt>
          <dd className="dk-ai-num">{done?.confidence !== undefined ? `${Math.round(done.confidence * 100)}%` : '—'}</dd>
        </div>
        <div>
          <dt>{c.st.first}</dt>
          <dd className="dk-ai-num">
            {t ? t.firstTokenMs : '—'} {t && <small>ms</small>}
          </dd>
        </div>
        <div>
          <dt>{c.st.rate}</dt>
          <dd className="dk-ai-num">
            {rate ? fmt(rate, lang, 1) : '—'} {rate && <small>tok/s</small>}
          </dd>
        </div>
      </dl>
      {done ? (
        <ol className="dk-ai-tline">
          <li>
            <span className="dk-ai-num">{t ? `${t.firstTokenMs} ms` : '—'}</span>
            <span>
              {c.st.mode}: <b>{done.mode === 'live' ? c.live : c.sim}</b>
              {done.fellBack ? ` (${c.fellBack})` : ''} · {c.st.tokens}: <span className="dk-ai-num">{t?.tokens ?? '—'}</span>
            </span>
          </li>
          {(done.toolCalls ?? []).map((s) => (
            <li key={s.id}>
              <span className="dk-ai-num">{s.ms ?? 0} ms</span>
              <span>
                <code>{s.name}</code> <code style={{ color: 'var(--ai-faint)' }}>{JSON.stringify(s.input).slice(0, 48)}</code>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="dk-ai-verdict">{c.noTrace}</p>
      )}
      <div className="dk-ai-world">
        <span>{c.world}:</span>
        <span>
          <b className="dk-ai-num">{world.complaintsToday}</b> {c.complaints}
        </span>
        <span>
          <b className="dk-ai-num">{world.ticketIds.length}</b> {c.tickets}
        </span>
        {latest && (
          <span>
            {c.lastTicket}: <b>{latest.id}</b> · {latest.category[lang]}
          </span>
        )}
      </div>
    </section>
  )
}
