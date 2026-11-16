/** 04 · Citizen chat inside an original PhoneFrame: bubble → thinking dots → token stream → chips drop. */
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { gsap } from 'gsap'
import { useI18n } from '../../lib/i18n'
import { EASE } from '../../lib/motion'
import { CHAT } from '../sample'
import { Icon, VerifiedBadge } from './icons'
import { SJ, clock, motionMode, seeded, useEnter, useGsapContext, useOnScreen } from './shared'

const C = {
  id: {
    frame: 'Simulasi layar HP warga',
    account: 'Layanan Kabupaten (resmi)',
    verified: 'Akun terverifikasi',
    via: 'via WhatsApp',
    today: 'Hari ini',
    assistant: 'Asisten AI',
    thinking: 'Asisten sedang menulis…',
    chips: 'Hasil klasifikasi otomatis',
    foot: 'Dijawab asisten AI · diawasi petugas',
    replay: 'Putar ulang',
    replayLabel: 'Putar ulang percakapan',
    note: 'Skrip simulasi · 25–45 token/dtk',
    you: 'Bu Siti',
  },
  en: {
    frame: 'Simulated citizen phone screen',
    account: 'Layanan Kabupaten (resmi)',
    verified: 'Verified account',
    via: 'via WhatsApp',
    today: 'Today',
    assistant: 'AI assistant',
    thinking: 'The assistant is typing…',
    chips: 'Automatic classification',
    foot: 'Answered by AI · supervised by staff',
    replay: 'Replay',
    replayLabel: 'Replay the conversation',
    note: 'Simulated script · 25–45 tokens/s',
    you: 'Mrs Siti',
  },
} as const

type Phase = 'idle' | 'warga' | 'thinking' | 'stream' | 'chips' | 'done'
const ORDER: Phase[] = ['idle', 'warga', 'thinking', 'stream', 'chips', 'done']
const at = (p: Phase, q: Phase) => ORDER.indexOf(p) >= ORDER.indexOf(q)

const WARGA = CHAT.find((m) => m.from === 'warga')
const AI = CHAT.find((m) => m.from === 'ai')
const CHIP_TONES = ['teal', 'lav', 'peach', 'cyan'] as const

/** Split into ~4-char "tokens"; each gets an absolute time (25–45 tok/s, pauses at punctuation). */
function schedule(text: string): { end: number; t: number }[] {
  const rnd = seeded(42)
  const out: { end: number; t: number }[] = []
  const re = /\s*\S+/g
  let t = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const word = m[0]
    let i = 0
    while (i < word.length) {
      const lead = i === 0 ? word.length - word.trimStart().length : 0
      const step = lead + 3 + Math.floor(rnd() * 3)
      i = Math.min(word.length, word.length - i - step <= 1 ? word.length : i + step)
      t += 1 / (SJ.tokenRateMin + rnd() * (SJ.tokenRateMax - SJ.tokenRateMin))
      out.push({ end: m.index + i, t })
      const last = word[i - 1] ?? ''
      if (i === word.length && /[.!?]/.test(last)) t += 0.22 + rnd() * 0.1
      else if (i === word.length && /[,;:]/.test(last)) t += 0.09 + rnd() * 0.06
    }
  }
  return out
}

interface Props {
  sourceRef: RefObject<HTMLDivElement | null>
  screenRef: RefObject<HTMLDivElement | null>
  onTicket: () => void
  onReset: () => void
}

export default function Phone({ sourceRef, screenRef, onTicket, onReset }: Props) {
  const { lang } = useI18n()
  const c = C[lang]
  const mode = motionMode()
  const [phase, setPhase] = useState<Phase>(mode === 'full' ? 'idle' : 'done')
  const [chars, setChars] = useState(mode === 'full' ? 0 : Infinity)
  const ref = useRef<HTMLDivElement>(null)
  const tiltRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLOListElement>(null)
  const ctx = useGsapContext(ref)
  const script = useRef<gsap.core.Timeline | null>(null)
  const dots = useRef<gsap.core.Timeline | null>(null)
  const visible = useRef(false)
  const onTicketRef = useRef(onTicket)
  useLayoutEffect(() => {
    onTicketRef.current = onTicket
  })

  const aiText = AI?.text[lang] ?? ''
  const tokens = useMemo(() => schedule(aiText), [aiText])

  const play = useCallback(() => {
    script.current?.kill()
    if (mode !== 'full') {
      setPhase('done')
      setChars(Infinity)
      ctx.current?.add(() => {
        if (listRef.current) gsap.fromTo(listRef.current, { opacity: 0 }, { opacity: 1, duration: SJ.fade })
      })
      onTicketRef.current()
      return
    }
    setPhase('idle')
    setChars(0)
    ctx.current?.add(() => {
      const tl = gsap.timeline({ paused: !visible.current })
      tl.call(() => setPhase('warga'), [], 0.2)
      tl.call(() => setPhase('thinking'), [], 1.0)
      const start = 2.1
      tl.call(() => setPhase('stream'), [], start)
      for (const tok of tokens) tl.call(() => setChars(tok.end), [], start + tok.t)
      const end = start + (tokens[tokens.length - 1]?.t ?? 0) + 0.3
      tl.call(() => setPhase('chips'), [], end)
      tl.call(() => setPhase('done'), [], end + 0.5)
      tl.call(() => onTicketRef.current(), [], end + 0.75)
      script.current = tl
    })
  }, [ctx, mode, tokens])

  const replay = () => {
    onReset()
    play()
  }

  useEnter(ref, play, '0px 0px -25% 0px')
  useOnScreen(ref, (v) => {
    visible.current = v
    if (v) {
      script.current?.resume()
      dots.current?.resume()
    } else {
      script.current?.pause()
      dots.current?.pause()
    }
  })

  // Phase-driven entrances.
  useLayoutEffect(() => {
    if (mode !== 'full') return
    ctx.current?.add(() => {
      const list = listRef.current
      if (!list) return
      if (phase === 'warga') {
        gsap.from(list.querySelector('.lds-msg.is-warga'), { y: 10, opacity: 0, duration: SJ.panel, ease: EASE.out })
      } else if (phase === 'thinking') {
        gsap.from(list.querySelector('.lds-msg.is-ai'), { y: 8, opacity: 0, duration: SJ.panel, ease: EASE.out })
        dots.current?.kill()
        dots.current = gsap
          .timeline({ repeat: -1, paused: !visible.current })
          .to(list.querySelectorAll('.lds-dot'), { opacity: 1, y: -2, duration: 0.3, stagger: 0.14, ease: 'sine.inOut' })
          .to(list.querySelectorAll('.lds-dot'), { opacity: 0.35, y: 0, duration: 0.3, stagger: 0.14, ease: 'sine.inOut' }, 0.3)
      } else if (phase === 'stream') {
        dots.current?.kill()
        dots.current = null
      } else if (phase === 'chips') {
        gsap.from(list.querySelectorAll('.lds-chip'), {
          y: -16,
          opacity: 0,
          scale: 0.9,
          duration: SJ.panel,
          stagger: SJ.chipStagger,
          ease: 'back.out(2.2)',
        })
      }
    })
  }, [phase, ctx, mode])

  // PhoneFrame tilt (≤ 6°) following a fine pointer; never in reduced / static.
  useLayoutEffect(() => {
    const el = tiltRef.current
    if (!el || mode !== 'full' || !window.matchMedia('(pointer: fine)').matches) return
    let rx: gsap.QuickToFunc | null = null
    let ry: gsap.QuickToFunc | null = null
    ctx.current?.add(() => {
      rx = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3.out' })
      ry = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3.out' })
    })
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      const nx = (e.clientX - r.left) / r.width - 0.5
      const ny = (e.clientY - r.top) / r.height - 0.5
      ry?.(nx * 10)
      rx?.(-ny * 8)
    }
    const leave = () => {
      ry?.(0)
      rx?.(0)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    return () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
    }
  }, [ctx, mode])

  const shown = Number.isFinite(chars) ? aiText.slice(0, chars) : aiText
  const streaming = phase === 'stream'

  return (
    <div className="lds-phone-col" ref={ref}>
      <div className="lds-phone-stage">
        <div className="lds-phone" ref={tiltRef} role="group" aria-label={c.frame}>
          <div className="lds-phone-screen" ref={screenRef}>
            <div className="lds-phone-status" aria-hidden="true">
              <span className="lds-phone-time">{clock(lang, '07:42')}</span>
              <span className="lds-phone-notch" />
              <span className="lds-phone-sys">
                <svg width="16" height="10" viewBox="0 0 16 10">
                  <rect x="0" y="7" width="2.6" height="3" rx=".6" fill="currentColor" />
                  <rect x="4.4" y="5" width="2.6" height="5" rx=".6" fill="currentColor" />
                  <rect x="8.8" y="2.6" width="2.6" height="7.4" rx=".6" fill="currentColor" />
                  <rect x="13.2" y="0" width="2.6" height="10" rx=".6" fill="currentColor" opacity=".45" />
                </svg>
                <svg width="22" height="11" viewBox="0 0 22 11">
                  <rect x=".6" y=".6" width="18" height="9.8" rx="2.6" fill="none" stroke="currentColor" strokeOpacity=".6" />
                  <rect x="2.4" y="2.4" width="12.4" height="6.2" rx="1.4" fill="currentColor" />
                  <path d="M20.4 3.8v3.4" stroke="currentColor" strokeOpacity=".6" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </span>
            </div>
            <header className="lds-chat-head">
              <span className="lds-chat-avatar" aria-hidden="true">
                <Icon name="building" size={18} />
              </span>
              <span className="lds-chat-id">
                <span className="lds-chat-name">
                  {c.account}
                  <VerifiedBadge label={c.verified} />
                </span>
                <span className="lds-chat-via">
                  <Icon name="chat" size={12} />
                  {c.via}
                </span>
              </span>
            </header>
            <ol className="lds-chat-list" ref={listRef} aria-live="polite">
              <li className="lds-chat-day" aria-hidden="true">
                {c.today}
              </li>
              {at(phase, 'warga') && WARGA && (
                <li className="lds-msg is-warga">
                  <span className="lds-sr">{c.you}: </span>
                  <p>{WARGA.text[lang]}</p>
                  <span className="lds-msg-time">{clock(lang, '07:40')}</span>
                </li>
              )}
              {at(phase, 'thinking') && AI && (
                <li className="lds-msg is-ai">
                  <span className="lds-msg-who">
                    <Icon name="sparkle" size={12} />
                    {c.assistant}
                  </span>
                  {phase === 'thinking' ? (
                    <span className="lds-dots">
                      <span className="lds-dot" />
                      <span className="lds-dot" />
                      <span className="lds-dot" />
                      <span className="lds-sr">{c.thinking}</span>
                    </span>
                  ) : (
                    <>
                      <p aria-hidden="true">
                        {shown}
                        {streaming && <span className="lds-caret" />}
                      </p>
                      {!streaming && <span className="lds-sr">{aiText}</span>}
                    </>
                  )}
                  {at(phase, 'chips') && <span className="lds-msg-time">{clock(lang, '07:41')}</span>}
                </li>
              )}
              {at(phase, 'chips') && AI?.chips && (
                <li className="lds-chips-row">
                  <div className="lds-chips" ref={sourceRef} role="group" aria-label={c.chips}>
                    {AI.chips.map((chip, i) => (
                      <span key={chip.en} className={`lds-chip is-${CHIP_TONES[i % CHIP_TONES.length]}`}>
                        {chip[lang]}
                      </span>
                    ))}
                  </div>
                </li>
              )}
            </ol>
            <footer className="lds-chat-foot">
              <Icon name="lock" size={12} />
              {c.foot}
            </footer>
          </div>
        </div>
      </div>
      <div className="lds-phone-ctl">
        <button type="button" className="lds-btn is-ghost" onClick={replay} aria-label={c.replayLabel}>
          <Icon name="replay" size={16} />
          {c.replay}
        </button>
        <span className="lds-phone-note">{c.note}</span>
      </div>
    </div>
  )
}
