/** 04 · Chat — citizen ↔ AI inside an original phone frame, streamed token by token, with a step ledger. */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { gsap } from 'gsap'
import { useI18n } from '../../lib/i18n'
import { EASE } from '../../lib/motion'
import { CHAT } from '../sample'
import { IconCheck, IconReplay, VerifiedTick } from './icons'
import { LDE, fmt, motionMode, observeVisibility, seeded } from './lde'

const C = {
  phone: { id: 'Pratinjau ponsel warga', en: "Citizen's phone preview" },
  account: { id: 'Layanan Kabupaten (resmi)', en: 'Regency Services (official)' },
  verified: { id: 'akun terverifikasi', en: 'verified account' },
  via: { id: 'via WhatsApp', en: 'via WhatsApp' },
  today: { id: 'Hari ini', en: 'Today' },
  thinking: { id: 'AI sedang menyusun jawaban', en: 'AI is composing a reply' },
  composer: { id: 'Balasan otomatis · mode demo', en: 'Automated reply · demo mode' },
  ticket: { id: 'Tiket dibuat otomatis', en: 'Ticket created automatically' },
  replay: { id: 'Putar ulang', en: 'Replay' },
  replayLabel: { id: 'Putar ulang percakapan', en: 'Replay the conversation' },
  ledger: { id: 'Urutan kejadian', en: 'Sequence' },
  tokens: { id: 'Token dialirkan', en: 'Tokens streamed' },
  rate: { id: 'Laju', en: 'Rate' },
  rateV: { id: '25–45 token/dtk', en: '25–45 tokens/s' },
  msgs: { id: 'Isi percakapan', en: 'Conversation' },
  steps: [
    { t: { id: 'Warga menulis', en: 'Citizen writes' }, d: { id: 'Pesan masuk lewat kanal WhatsApp resmi kabupaten.', en: "Message arrives on the regency's official WhatsApp channel." } },
    { t: { id: 'AI memahami', en: 'AI reads' }, d: { id: 'Tiga titik berdenyut selama konteks dibaca.', en: 'Three pulsing dots while context is read.' } },
    { t: { id: 'Jawaban dialirkan', en: 'Answer streams' }, d: { id: 'Per token, jeda singkat di setiap tanda baca.', en: 'Token by token, with short pauses at punctuation.' } },
    { t: { id: 'Data terstruktur', en: 'Structured data' }, d: { id: 'Kategori, wilayah, urgensi dan OPD jatuh ke tempatnya.', en: 'Category, area, urgency and agency drop into place.' } },
  ],
}

/** Rough sub-word tokens: words longer than 7 letters split in two, trailing space kept. */
function tokenize(text: string): string[] {
  const words = text.match(/\S+\s*/g) ?? []
  const out: string[] = []
  for (const w of words) {
    const core = w.trimEnd()
    if (core.length > 7) {
      const cut = Math.ceil(core.length / 2)
      out.push(w.slice(0, cut), w.slice(cut))
    } else out.push(w)
  }
  return out
}

export function PhoneFrame({ clock, label, children }: { clock: string; label: string; children: ReactNode }) {
  return (
    <div className="lde-phone" role="group" aria-label={label}>
      <div className="lde-phone-screen">
        <div className="lde-phone-status" aria-hidden="true">
          <span className="lde-num">{clock}</span>
          <span className="lde-phone-notch" />
          <span className="lde-phone-sys">
            <svg width="16" height="10" viewBox="0 0 16 10">
              <rect x="0" y="7" width="2.6" height="3" rx=".6" fill="currentColor" />
              <rect x="4.4" y="5" width="2.6" height="5" rx=".6" fill="currentColor" />
              <rect x="8.8" y="2.6" width="2.6" height="7.4" rx=".6" fill="currentColor" />
              <rect x="13.2" y="0" width="2.6" height="10" rx=".6" fill="currentColor" opacity=".4" />
            </svg>
            <svg width="22" height="11" viewBox="0 0 22 11">
              <rect x=".6" y=".6" width="18.4" height="9.8" rx="2.6" fill="none" stroke="currentColor" strokeWidth="1.1" opacity=".55" />
              <rect x="2.4" y="2.4" width="12.4" height="6.2" rx="1.3" fill="currentColor" />
              <path d="M20.4 3.8v3.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".55" />
            </svg>
          </span>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function Chat() {
  const { lang } = useI18n()
  const warga = CHAT[0]
  const ai = CHAT[1]
  const aiText = ai?.text[lang] ?? ''
  const chips = ai?.chips ?? []
  const [stage, setStage] = useState(() => (motionMode() === 'full' ? 0 : 4))
  const tokens = useRef(tokenize(aiText)).current
  const root = useRef<HTMLDivElement>(null)
  const replayRef = useRef<() => void>(() => {})

  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    const mode = motionMode()
    const q = <T extends Element = HTMLElement>(s: string) => el.querySelector<T>(s)
    const textEl = q('.lde-stream')
    const countEl = q('.lde-tok-n')
    const citizen = q('.lde-msg-warga')
    const thinking = q('.lde-thinking')
    const aiMsg = q('.lde-msg-ai')
    const meta = q('.lde-msg-meta')
    const chipEls = el.querySelectorAll('.lde-chip-drop')
    const list = q('.lde-msgs')
    const write = (n: number) => {
      if (textEl) textEl.textContent = tokens.slice(0, n).join('')
      if (countEl) countEl.textContent = fmt(lang, n)
    }

    if (mode !== 'full') {
      write(tokens.length)
      let ctx: gsap.Context | null = null
      const show = () => {
        ctx?.revert()
        ctx = gsap.context(() => {
          if (mode === 'reduced' && list) gsap.fromTo(list, { opacity: 0 }, { opacity: 1, duration: LDE.fade })
        })
      }
      replayRef.current = show
      return () => ctx?.revert()
    }

    let visible = false
    let started = false
    const ctx = gsap.context(() => {})
    let tl: gsap.core.Timeline | null = null
    let dots: gsap.core.Tween | null = null
    let dotsOn = false

    const reset = () => {
      write(0)
      gsap.set(citizen, { opacity: 0, y: LDE.slideY })
      gsap.set(thinking, { display: 'none', opacity: 0 })
      gsap.set(aiMsg, { display: 'none', opacity: 0 })
      gsap.set(meta, { opacity: 0 })
      gsap.set(chipEls, { opacity: 0, y: -10 })
      setStage(0)
    }

    ctx.add(() => {
      reset()
      dots = gsap.fromTo(
        el.querySelectorAll('.lde-dot'),
        { opacity: 0.25, y: 0 },
        { opacity: 1, y: -2, duration: 0.42, ease: 'sine.inOut', stagger: { each: 0.14, repeat: -1, yoyo: true }, paused: true },
      )
      const rand = seeded(42)
      tl = gsap.timeline({ paused: true })
      tl.call(() => setStage(1))
      tl.to(citizen, { opacity: 1, y: 0, duration: LDE.panel, ease: EASE.out })
      tl.call(() => setStage(2), undefined, '+=0.35')
      tl.set(thinking, { display: 'flex' })
      tl.to(thinking, { opacity: 1, duration: LDE.press })
      tl.call(() => {
        dotsOn = true
        if (visible) dots?.play()
      })
      tl.to({}, { duration: LDE.thinking })
      tl.call(() => {
        dotsOn = false
        dots?.pause(0)
      })
      tl.set(thinking, { display: 'none', opacity: 0 })
      tl.set(aiMsg, { display: 'block' })
      tl.to(aiMsg, { opacity: 1, duration: LDE.hover })
      tl.call(() => setStage(3))
      tl.addLabel('stream')
      let t = 0
      tokens.forEach((tok, i) => {
        t += 1 / (LDE.tokenRateMin + rand() * (LDE.tokenRateMax - LDE.tokenRateMin))
        tl!.call(write, [i + 1], `stream+=${t.toFixed(3)}`)
        if (/[.!?]\s*$/.test(tok)) t += LDE.pauseStop
        else if (/[,;:]\s*$/.test(tok)) t += LDE.pauseComma
      })
      tl.addLabel('chips', `stream+=${(t + 0.2).toFixed(3)}`)
      tl.call(() => setStage(4), undefined, 'chips')
      tl.to(chipEls, { opacity: 1, y: 0, duration: LDE.panel, ease: EASE.out, stagger: LDE.chipStagger }, 'chips')
      tl.to(meta, { opacity: 1, duration: LDE.press }, `chips+=${0.06 * chipEls.length + 0.1}`)
    })

    const play = () => {
      started = true
      tl?.play()
    }
    replayRef.current = () => {
      ctx.add(() => {
        tl?.pause(0)
        dots?.pause(0)
        dotsOn = false
        reset()
        if (visible) play()
        else started = false
      })
    }

    const stop = observeVisibility(el, (v) => {
      visible = v
      if (v) {
        if (!started) play()
        else if (tl && tl.progress() < 1) tl.resume()
        if (dotsOn) dots?.resume()
      } else {
        tl?.pause()
        dots?.pause()
      }
    })

    return () => {
      stop()
      ctx.revert()
      write(tokens.length)
    }
  }, [lang, tokens])

  const time = (m: number) => `06${lang === 'id' ? '.' : ':'}${m}`

  return (
    <div className="lde-chat" ref={root}>
      <div className="lde-chat-device">
        <PhoneFrame clock={time(48)} label={C.phone[lang]}>
          <div className="lde-wa-head">
            <span className="lde-wa-avatar" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 20h16M5.5 20V10M18.5 20V10M3.5 10L12 4.5 20.5 10" />
                <path d="M9 20v-6h6v6" />
              </svg>
            </span>
            <span className="lde-wa-id">
              <span className="lde-wa-name">
                {C.account[lang]}
                <VerifiedTick />
                <span className="lde-sr">, {C.verified[lang]}</span>
              </span>
              <span className="lde-wa-via">{C.via[lang]}</span>
            </span>
          </div>

          <ol className="lde-msgs" aria-live="polite" aria-busy={stage > 0 && stage < 4} aria-label={C.msgs[lang]}>
            <li className="lde-day" aria-hidden="true">
              <span>{C.today[lang]}</span>
            </li>
            <li className="lde-msg lde-msg-warga">
              <p>{warga?.text[lang]}</p>
              <span className="lde-msg-time lde-num">{time(47)}</span>
            </li>
            <li className="lde-thinking" aria-label={C.thinking[lang]}>
              <span className="lde-dot" />
              <span className="lde-dot" />
              <span className="lde-dot" />
            </li>
            <li className="lde-msg lde-msg-ai">
              <p>
                <span className="lde-stream" />
                {stage === 3 && <span className="lde-caret" aria-hidden="true" />}
              </p>
              <ul className="lde-chips">
                {chips.map((c) => (
                  <li key={c.id} className="lde-chip lde-chip-drop">
                    {c[lang]}
                  </li>
                ))}
              </ul>
              <span className="lde-msg-meta">
                <IconCheck size={13} />
                {C.ticket[lang]} · <span className="lde-num">{time(48)}</span>
              </span>
            </li>
          </ol>
          <div className="lde-wa-compose" aria-hidden="true">
            {C.composer[lang]}
          </div>
        </PhoneFrame>
      </div>

      <div className="lde-chat-notes">
        <h3 className="lde-cap lde-cap-strong">{C.ledger[lang]}</h3>
        <ol className="lde-steps">
          {C.steps.map((s, i) => {
            const n = i + 1
            const state = stage > n || stage === 4 ? 'done' : stage === n ? 'active' : 'todo'
            return (
              <li key={n} className={`lde-step is-${state}`} aria-current={state === 'active' ? 'step' : undefined}>
                <span className="lde-step-n lde-num">{String(n).padStart(2, '0')}</span>
                <span className="lde-step-body">
                  <span className="lde-step-t">{s.t[lang]}</span>
                  <span className="lde-step-d">{s.d[lang]}</span>
                </span>
                <span className="lde-step-mark" aria-hidden="true">
                  {state === 'done' && <IconCheck size={14} />}
                </span>
              </li>
            )
          })}
        </ol>
        <dl className="lde-chat-stats">
          <div>
            <dt className="lde-cap">{C.tokens[lang]}</dt>
            <dd className="lde-num">
              <span className="lde-tok-n">{fmt(lang, tokens.length)}</span>
              <span className="lde-muted"> / {fmt(lang, tokens.length)}</span>
            </dd>
          </div>
          <div>
            <dt className="lde-cap">{C.rate[lang]}</dt>
            <dd className="lde-num">{C.rateV[lang]}</dd>
          </div>
        </dl>
        <button type="button" className="lde-btn" onClick={() => replayRef.current()} aria-label={C.replayLabel[lang]}>
          <IconReplay />
          {C.replay[lang]}
        </button>
      </div>
    </div>
  )
}
