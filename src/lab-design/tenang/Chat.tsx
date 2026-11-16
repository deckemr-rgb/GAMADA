/**
 * 04 · Chat inside an original PhoneFrame: citizen bubble → AI thinking (3 dots) → answer streamed
 * per token (25–45 tok/s, pauses at punctuation) → structured chips drop in (60 ms stagger).
 * Beside it, a quiet pipeline log shows what the console sees, in sync with the script.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { EASE } from '../../lib/motion'
import { useI18n } from '../../lib/i18n'
import { CHAT, NEW_TICKET, STATUS_LABEL } from '../sample'
import { Icon, SectionHead, TT, fmt, motionMode, useFirstView, useVisible } from './shared'

const C = {
  id: {
    title: 'Percakapan warga ↔ AI',
    lead: 'Jawaban dialirkan per token dengan jeda di tanda baca, lalu hasil terstruktur jatuh ke tempatnya.',
    account: 'Layanan Kabupaten (resmi)',
    verified: 'Akun terverifikasi',
    via: 'via WhatsApp',
    today: 'Hari ini',
    thinking: 'AI sedang menyusun jawaban',
    detected: 'Terdeteksi',
    log: 'Log alur',
    replay: 'Putar ulang',
    running: 'Berjalan',
    ready: 'Selesai',
    waiting: 'Menunggu terlihat',
    ev: {
      inbound: 'Pesan warga masuk',
      thinking: 'AI membaca & mengklasifikasi',
      stream: 'Jawaban mulai dialirkan',
      streamed: (n: number, r: string) => `${n} token · ${r} tok/dtk`,
      chips: (n: number) => `${n} label terstruktur`,
      ticket: `Tiket ${NEW_TICKET.id} → ${NEW_TICKET.opd}`,
    },
    phone: 'Pratinjau ponsel warga',
    m: { ttft: 'Token pertama', tokens: 'Token', rate: 'Laju', total: 'Total' },
    ticket: 'Tiket yang terbentuk',
    waitTicket: 'menunggu AI',
    created: 'dibuat otomatis',
    fields: { cat: 'Kategori', kec: 'Kecamatan', opd: 'OPD', status: 'Status', sla: 'SLA' },
  },
  en: {
    title: 'Citizen ↔ AI conversation',
    lead: 'The answer streams token by token with pauses at punctuation, then the structured result drops into place.',
    account: 'Layanan Kabupaten (resmi)',
    verified: 'Verified account',
    via: 'via WhatsApp',
    today: 'Today',
    thinking: 'AI is drafting a reply',
    detected: 'Detected',
    log: 'Pipeline log',
    replay: 'Replay',
    running: 'Running',
    ready: 'Done',
    waiting: 'Waiting to be seen',
    ev: {
      inbound: 'Citizen message received',
      thinking: 'AI reads & classifies',
      stream: 'Reply starts streaming',
      streamed: (n: number, r: string) => `${n} tokens · ${r} tok/s`,
      chips: (n: number) => `${n} structured labels`,
      ticket: `Ticket ${NEW_TICKET.id} → ${NEW_TICKET.opd}`,
    },
    phone: 'Citizen phone preview',
    m: { ttft: 'First token', tokens: 'Tokens', rate: 'Rate', total: 'Total' },
    ticket: 'Ticket created',
    waitTicket: 'waiting for AI',
    created: 'created automatically',
    fields: { cat: 'Category', kec: 'District', opd: 'Agency', status: 'Status', sla: 'SLA' },
  },
}

const USER = CHAT[0]!
const AI = CHAT[1]!

function tokenize(text: string): string[] {
  const out: string[] = []
  for (const w of text.match(/\S+\s*/g) ?? []) {
    const core = w.trimEnd()
    if (core.length > 6) {
      // sub-word pieces of ~4 chars, like a real tokenizer
      let i = 0
      while (w.length - i > 6) {
        out.push(w.slice(i, i + 4))
        i += 4
      }
      out.push(w.slice(i))
    } else out.push(w)
  }
  return out
}

/** Deterministic token schedule (seed 42): returns start offset of each token, and the end. */
function schedule(tokens: string[]): { at: number[]; end: number; gen: number } {
  let s = 42
  const rnd = () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
  const at: number[] = []
  let t = 0
  let gen = 0
  for (const tok of tokens) {
    at.push(t)
    const dt = 1 / (25 + rnd() * 20)
    t += dt
    gen += dt
    const core = tok.trimEnd()
    if (/[.!?]$/.test(core)) t += 0.18
    else if (/[,;:]$/.test(core)) t += 0.09
  }
  return { at, end: t, gen }
}

const T_USER = 0.25
const T_THINK = 0.95
const THINK_FOR = 1.5

export default function Chat() {
  const { lang } = useI18n()
  const c = C[lang]
  const mode = motionMode()
  const rootRef = useRef<HTMLDivElement>(null)
  const userRef = useRef<HTMLDivElement>(null)
  const typingRef = useRef<HTMLDivElement>(null)
  const aiRef = useRef<HTMLDivElement>(null)
  const chipsRef = useRef<HTMLDivElement>(null)
  const tlRef = useRef<gsap.core.Timeline | null>(null)
  const ctxRef = useRef<gsap.Context | null>(null)

  const tokens = useMemo(() => tokenize(AI.text[lang]), [lang])
  const sched = useMemo(() => schedule(tokens), [tokens])
  const tStream = T_THINK + THINK_FOR
  const tEnd = tStream + sched.end
  const tChips = tEnd + 0.25
  const rate = tokens.length / sched.gen

  const events = useMemo(
    () => [
      { t: T_USER, label: c.ev.inbound, tone: 'in' },
      { t: T_THINK, label: c.ev.thinking, tone: 'ai' },
      { t: tStream, label: c.ev.stream, tone: 'ai' },
      { t: tEnd, label: c.ev.streamed(tokens.length, fmt(lang, rate, 0)), tone: 'ai' },
      { t: tChips, label: c.ev.chips(AI.chips?.length ?? 0), tone: 'ok' },
      { t: tChips + 0.45, label: c.ev.ticket, tone: 'ok' },
    ],
    [c, lang, tStream, tEnd, tChips, tokens.length, rate],
  )

  const finalState = mode !== 'full'
  const [count, setCount] = useState(finalState ? tokens.length : 0)
  const [logN, setLogN] = useState(finalState ? events.length : 0)
  const [state, setState] = useState<'idle' | 'run' | 'done'>(finalState ? 'done' : 'idle')
  const visible = useVisible(rootRef)

  useLayoutEffect(() => {
    ctxRef.current = gsap.context(() => {}, rootRef)
    if (mode === 'full') {
      gsap.set(userRef.current, { opacity: 0, y: 8 })
      gsap.set([typingRef.current, aiRef.current], { opacity: 0 })
      gsap.set(chipsRef.current?.children ?? [], { opacity: 0, y: -14 })
      gsap.set(rootRef.current?.querySelector('.ldt-chips-label') ?? null, { opacity: 0 })
    }
    return () => {
      ctxRef.current?.revert()
      ctxRef.current = null
    }
  }, [mode])

  const play = () => {
    const ctx = ctxRef.current
    if (!ctx) return
    tlRef.current?.kill()
    setCount(0)
    setLogN(0)
    setState('run')
    ctx.add(() => {
      const chips = chipsRef.current?.children ?? []
      const dots = typingRef.current?.querySelectorAll('i') ?? []
      gsap.set(userRef.current, { opacity: 0, y: 8 })
      gsap.set([typingRef.current, aiRef.current], { opacity: 0 })
      const label = rootRef.current?.querySelector('.ldt-chips-label') ?? null
      gsap.set(chips, { opacity: 0, y: -14, rotation: 0 })
      gsap.set(label, { opacity: 0 })
      const tl = gsap.timeline()
      tl.to(userRef.current, { opacity: 1, y: 0, duration: TT.panel, ease: EASE.out }, T_USER)
      tl.to(typingRef.current, { opacity: 1, duration: TT.press }, T_THINK)
      tl.fromTo(dots, { opacity: 0.25, y: 0 }, { opacity: 1, y: -2, duration: 0.36, stagger: 0.14, repeat: 3, yoyo: true, ease: 'sine.inOut' }, T_THINK)
      tl.to(typingRef.current, { opacity: 0, duration: TT.hover }, tStream - TT.hover)
      tl.set(aiRef.current, { opacity: 1 }, tStream)
      sched.at.forEach((t, i) => tl.call(() => setCount(i + 1), undefined, tStream + t))
      tl.to(label, { opacity: 1, duration: TT.press }, tChips - 0.08)
      tl.fromTo(chips, { opacity: 0, y: -14, rotation: -3 }, { opacity: 1, y: 0, rotation: 0, duration: 0.42, stagger: TT.chipStagger, ease: 'back.out(2.2)' }, tChips)
      events.forEach((e, i) => tl.call(() => setLogN(i + 1), undefined, e.t))
      tl.call(() => setState('done'), undefined, tChips + 0.6)
      tlRef.current = tl
    })
  }

  useFirstView(
    rootRef,
    () => {
      if (mode === 'full') play()
      else if (mode === 'reduced') {
        ctxRef.current?.add(() => gsap.fromTo(rootRef.current?.querySelectorAll('.ldt-fade') ?? [], { opacity: 0 }, { opacity: 1, duration: TT.reduced }))
      }
    },
    0.35,
  )

  /* Pause the script while off-screen. */
  useEffect(() => {
    const tl = tlRef.current
    if (!tl || tl.progress() === 1) return
    tl.paused(!visible)
  }, [visible])

  const replay = () => {
    if (mode === 'full') play()
    else {
      setCount(tokens.length)
      setLogN(events.length)
      setState('done')
      ctxRef.current?.add(() => gsap.fromTo(rootRef.current?.querySelectorAll('.ldt-fade') ?? [], { opacity: 0 }, { opacity: 1, duration: TT.reduced }))
    }
  }

  const streamed = tokens.slice(0, count).join('')
  const streaming = count > 0 && count < tokens.length

  return (
    <section className="ldt-block" aria-labelledby="ldt-h-chat" ref={rootRef}>
      <SectionHead num="04" id="ldt-h-chat" title={c.title} lead={c.lead} />
      <div className="ldt-chat">
        <div className="ldt-phone-col">
          <div className="ldt-phone" role="group" aria-label={c.phone}>
            <div className="ldt-phone-screen">
              <div className="ldt-phone-status" aria-hidden="true">
                <span className="ldt-num">07:12</span>
                <span className="ldt-phone-notch" />
                <span className="ldt-phone-icons">
                  <svg width="16" height="10" viewBox="0 0 16 10">
                    <rect x="0" y="7" width="3" height="3" rx=".6" fill="currentColor" />
                    <rect x="4.3" y="5" width="3" height="5" rx=".6" fill="currentColor" />
                    <rect x="8.6" y="2.6" width="3" height="7.4" rx=".6" fill="currentColor" />
                    <rect x="12.9" y="0" width="3" height="10" rx=".6" fill="currentColor" opacity=".4" />
                  </svg>
                  <svg width="22" height="11" viewBox="0 0 22 11">
                    <rect x=".5" y=".5" width="18" height="10" rx="2.6" fill="none" stroke="currentColor" opacity=".5" />
                    <rect x="2.2" y="2.2" width="12" height="6.6" rx="1.4" fill="currentColor" />
                    <path d="M20.3 3.8v3.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity=".5" />
                  </svg>
                </span>
              </div>
              <div className="ldt-chat-head">
                <span className="ldt-avatar" aria-hidden="true">
                  LK
                </span>
                <span className="ldt-chat-who">
                  <b>
                    {c.account}
                    <svg className="ldt-verified" width="14" height="14" viewBox="0 0 14 14" role="img" aria-label={c.verified}>
                      <path d="M7 .8 8.6 2l2-.1.6 1.9 1.6 1.2-.6 1.9.6 1.9-1.6 1.2-.6 1.9-2-.1L7 13.2 5.4 12l-2 .1-.6-1.9L1.2 9l.6-1.9-.6-1.9 1.6-1.2.6-1.9 2 .1Z" fill="currentColor" />
                      <path d="m4.6 7.1 1.7 1.6 3.2-3.4" fill="none" stroke="var(--c-ink)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </b>
                  <small>{c.via}</small>
                </span>
              </div>
              <div className="ldt-chat-list" role="log" aria-live="polite">
                <p className="ldt-chat-day">
                  <span>{c.today}</span>
                </p>
                <div className="ldt-msg ldt-msg--out ldt-fade" ref={userRef}>
                  <p>{USER.text[lang]}</p>
                  <span className="ldt-msg-meta ldt-num">07:12</span>
                </div>
                <div className="ldt-msg-slot">
                  <div className="ldt-typing" ref={typingRef} aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <span className="ldt-sr">{c.thinking}</span>
                  </div>
                  <div className="ldt-msg ldt-msg--in ldt-fade" ref={aiRef}>
                    <p aria-hidden={state !== 'done'}>
                      {streamed}
                      {streaming && <span className="ldt-caret" />}
                    </p>
                    {state === 'done' && <span className="ldt-sr">{AI.text[lang]}</span>}
                    <span className="ldt-msg-meta">
                      {Icon.spark()}
                      <span className="ldt-num">07:13</span>
                    </span>
                  </div>
                  <div className="ldt-chips" aria-label={c.detected}>
                    <span className="ldt-chips-label ldt-fade">{c.detected}</span>
                    <div ref={chipsRef} className="ldt-chips-row">
                      {AI.chips?.map((ch) => (
                        <span key={ch.id} className={`ldt-chip ldt-fade${ch.id.startsWith('Urgensi') ? ' ldt-chip--warn' : ''}`}>
                          {ch[lang]}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <span className="ldt-phone-home" aria-hidden="true" />
            </div>
          </div>
        </div>

        <div className="ldt-chat-side">
          <dl className="ldt-card ldt-metrics">
            <div>
              <dt>{c.m.ttft}</dt>
              <dd className="ldt-num">{logN >= 3 ? `${fmt(lang, tStream - T_USER, 2)} s` : '—'}</dd>
            </div>
            <div>
              <dt>{c.m.tokens}</dt>
              <dd className="ldt-num">{logN >= 4 ? tokens.length : count || '—'}</dd>
            </div>
            <div>
              <dt>{c.m.rate}</dt>
              <dd className="ldt-num">
                {logN >= 4 ? fmt(lang, rate, 0) : '—'} <small>tok/s</small>
              </dd>
            </div>
            <div>
              <dt>{c.m.total}</dt>
              <dd className="ldt-num">{logN >= 4 ? `${fmt(lang, tEnd - T_USER, 2)} s` : '—'}</dd>
            </div>
          </dl>
        <div className="ldt-card ldt-log">
            <div className="ldt-card-h">
              <span className="ldt-card-h-l">
                {Icon.pulse()}
                {c.log}
              </span>
              <span className={`ldt-runstate is-${state}`}>
                <i aria-hidden="true" />
                {state === 'run' ? c.running : state === 'done' ? c.ready : c.waiting}
              </span>
            </div>
            <ol className="ldt-log-list">
              {events.slice(0, logN).map((e) => (
                <LogItem key={e.label} t={`+${fmt(lang, e.t, 2)} s`} label={e.label} tone={e.tone} />
              ))}
              {events.slice(logN).map((e) => (
                <li key={`p-${e.label}`} className="ldt-log-item is-pending" aria-hidden="true">
                  <span className="ldt-log-t ldt-num">—</span>
                  <i />
                  <span className="ldt-log-ph" />
                </li>
              ))}
            </ol>
            <div className="ldt-log-foot">
              <span className="ldt-faint">
                {tokens.length} token · 25–45 tok/s · seed 42
              </span>
              <button type="button" className="ldt-btn ldt-btn--ghost" onClick={replay}>
                {Icon.replay()}
                <span>{c.replay}</span>
              </button>
            </div>
          </div>
          <div className={`ldt-card ldt-tdraft${logN >= events.length ? ' is-ready' : ''}`}>
            <div className="ldt-card-h">
              <span className="ldt-card-h-l">
                {Icon.inbox()}
                {c.ticket}
              </span>
              <span className="ldt-faint">{logN >= events.length ? c.created : c.waitTicket}</span>
            </div>
            <dl className="ldt-tdraft-grid">
              <div>
                <dt>ID</dt>
                <dd className="ldt-num">{NEW_TICKET.id}</dd>
              </div>
              <div>
                <dt>{c.fields.cat}</dt>
                <dd>{NEW_TICKET.category[lang]}</dd>
              </div>
              <div>
                <dt>{c.fields.kec}</dt>
                <dd>{NEW_TICKET.kecamatan}</dd>
              </div>
              <div>
                <dt>{c.fields.opd}</dt>
                <dd>{NEW_TICKET.opd}</dd>
              </div>
              <div>
                <dt>{c.fields.status}</dt>
                <dd>
                  <span className="ldt-status ldt-status--baru">
                    <i aria-hidden="true" />
                    {STATUS_LABEL[NEW_TICKET.status][lang]}
                  </span>
                </dd>
              </div>
              <div>
                <dt>{c.fields.sla}</dt>
                <dd className="ldt-num">{NEW_TICKET.slaHours}:00:00</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </section>
  )
}

function LogItem({ t, label, tone }: { t: string; label: string; tone: string }) {
  const ref = useRef<HTMLLIElement>(null)
  useLayoutEffect(() => {
    if (motionMode() !== 'full' || !ref.current) return
    const tw = gsap.fromTo(ref.current, { opacity: 0, x: -6 }, { opacity: 1, x: 0, duration: TT.press, ease: EASE.out })
    return () => {
      tw.kill()
    }
  }, [])
  return (
    <li className={`ldt-log-item is-${tone}`} ref={ref}>
      <span className="ldt-log-t ldt-num">{t}</span>
      <i aria-hidden="true" />
      <span>{label}</span>
    </li>
  )
}
