/**
 * Security & Governance — four practices (key-only SSH, firewall 22/80/443, self-renewing SSL,
 * production hardening) next to a "vault": a padlock whose shackle drops shut with a small bounce
 * when it enters, and a mini terminal that types three standard checks once it becomes visible.
 *  - typing: a gsap timeline appends characters to each command; output rows appear line by line
 *  - the terminal is aria-hidden; screen readers get its meaning once (t.home.security.terminalLabel)
 *  - reduced motion: everything is already in its final state (locked, fully typed), no caret blink
 *  - the idle caret blinks only while the terminal is on screen (IntersectionObserver → gsap tween)
 */
import { useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useI18n } from '../lib/i18n'
import { useReveal } from '../lib/reveal'
import { waLink } from '../content/site'
import Section from '../components/ui/Section'
import SectionHeader from '../components/ui/SectionHeader'
import Card from '../components/ui/Card'
import { ButtonLink, WaIcon } from '../components/ui/Button'
import { Padlock, SEC_ICONS } from './security/icons'
import { TERMINAL, TERMINAL_TITLE } from './security/terminal'
import '../styles/sections/security.css'

gsap.registerPlugin(ScrollTrigger)

/* ---------------- SECURITY (tuning) — padlock + terminal typing */
const SEC = {
  /** Shackle lift before locking (SVG units) and the height of its small bounce. */
  shackleLift: 18,
  shackleBounce: 4,
  /** Lock starts this long after the vault enters (s). */
  lockDelay: 0.35,
  lockStart: 'top 78%',
  /** Typing: seconds per character, pause before typing / after a command, gap between output rows. */
  charDur: 0.042,
  thinkPause: 0.35,
  enterPause: 0.32,
  lineGap: 0.075,
  typeStart: 'top 80%',
  /** Idle caret half-period (s). */
  blink: 0.55,
} as const

export default function Security() {
  const { t } = useI18n()
  const c = t.home.security
  const ref = useRef<HTMLDivElement>(null)
  // useReveal rebuilds on a language switch: once played, the lock and the terminal stay in their final state
  const played = useRef({ lock: false, term: false })

  useReveal(ref, (kit, root) => {
    kit.eyebrow(root.querySelector('[data-rv="eyebrow"]'))
    kit.heading(root.querySelector('[data-rv="heading"]'))
    kit.fadeUp(root.querySelector('[data-rv="lead"]'))
    kit.fadeUp(root.querySelector('.secu-vault'))
    kit.cards(root.querySelectorAll('[data-rv="card"]'))
    kit.fadeUp(root.querySelector('.secu-foot'))
    if (kit.reduced) return

    /* ---- padlock: lift the shackle, drop it shut when the vault enters */
    const lockEl = root.querySelector('.secu-lock')
    const shackle = root.querySelector('.lock-shackle')
    const lockBody = root.querySelector('.lock-body')
    const key = root.querySelector('.lock-key')
    const burst = root.querySelector('.lock-burst')
    if (lockEl && shackle && lockBody && key && burst && !played.current.lock) {
      const d = SEC.lockDelay
      gsap.set(shackle, { y: -SEC.shackleLift })
      gsap.set(key, { opacity: 0 })
      const lock = gsap.timeline({ paused: true })
      lock
        .to(shackle, { y: 0, duration: 0.42, ease: 'power3.in' }, d)
        .to(shackle, { y: -SEC.shackleBounce, duration: 0.13, ease: 'power1.out' }, d + 0.42)
        .to(shackle, { y: 0, duration: 0.15, ease: 'power1.in' }, d + 0.55)
        .fromTo(lockBody, { scale: 1 }, { scale: 1.04, duration: 0.09, yoyo: true, repeat: 1, ease: 'power1.out', svgOrigin: '48 70' }, d + 0.42)
        .to(key, { opacity: 1, duration: 0.3, ease: 'power1.out' }, d + 0.46)
        .fromTo(burst, { scale: 0.6, opacity: 0.6, svgOrigin: '48 66' }, { scale: 1.35, opacity: 0, duration: 0.85, ease: 'power2.out' }, d + 0.42)
      ScrollTrigger.create({
        trigger: lockEl,
        start: SEC.lockStart,
        once: true,
        onEnter: () => {
          played.current.lock = true
          lock.play()
        },
      })
    }

    /* ---- terminal: type each command, then reveal its output row by row */
    const term = root.querySelector<HTMLElement>('.term')
    if (!term) return
    const rows = Array.from(term.querySelectorAll<HTMLElement>('.term-row'))
    const typed = Array.from(term.querySelectorAll<HTMLElement>('[data-type]'))
    const fulls = typed.map((el) => el.textContent ?? '')
    const idleCaret = term.querySelector<HTMLElement>('.term-last .term-caret')
    // useReveal calls our cleanup BEFORE ctx.revert(); reverting the typing tweens re-renders them at
    // progress 0, so onUpdate must stop writing once we are torn down (or the restored text is wiped)
    let alive = true

    // the typing script; returns the time at which it ends
    const build = (tl: gsap.core.Timeline) => {
      rows.forEach((row, i) => {
        if (i > 0) gsap.set(row, { opacity: 0 })
      })
      typed.forEach((el) => (el.textContent = ''))
      if (idleCaret) gsap.set(idleCaret, { opacity: 0 })
      const firstCaret = rows[0]?.querySelector('.term-caret')
      if (firstCaret) gsap.set(firstCaret, { opacity: 1 })

      let at = 0
      let k = 0
      for (const row of rows) {
        if (row.classList.contains('term-last')) {
          tl.set(row, { opacity: 1 }, at)
          if (idleCaret) tl.set(idleCaret, { opacity: 1 }, at)
          continue
        }
        if (row.classList.contains('term-cmd')) {
          const el = typed[k]
          const full = fulls[k] ?? ''
          k++
          const caret = row.querySelector('.term-caret')
          tl.set(row, { opacity: 1 }, at)
          if (caret) tl.set(caret, { opacity: 1 }, at)
          at += SEC.thinkPause
          const p = { n: 0 }
          const dur = full.length * SEC.charDur
          tl.to(
            p,
            {
              n: full.length,
              duration: dur,
              ease: 'none',
              onUpdate: () => {
                if (el && alive) el.textContent = full.slice(0, Math.round(p.n))
              },
            },
            at,
          )
          at += dur + SEC.enterPause
          if (caret) tl.set(caret, { opacity: 0 }, at)
          continue
        }
        tl.set(row, { opacity: 1 }, at)
        at += SEC.lineGap
      }
      return at
    }

    // idle caret: blinks only after the script finished and while the terminal is visible
    let done = false
    let visible = false
    const blink = idleCaret ? gsap.to(idleCaret, { opacity: 0, duration: SEC.blink, ease: 'steps(1)', repeat: -1, yoyo: true, paused: true }) : null
    const sync = () => {
      if (!blink) return
      if (done && visible) blink.play()
      else blink.pause()
    }
    if (played.current.term) {
      done = true // already typed before a rebuild (language switch): keep the final state
    } else {
      const tl = gsap.timeline({ paused: true })
      tl.call(() => {
        done = true
        sync()
      }, undefined, build(tl))
      ScrollTrigger.create({
        trigger: term,
        start: SEC.typeStart,
        once: true,
        onEnter: () => {
          played.current.term = true
          tl.play()
        },
      })
    }
    const io = new IntersectionObserver((entries) => {
      // several entries can queue up between callbacks: the last one is the current state
      visible = !!entries[entries.length - 1]?.isIntersecting
      sync()
    })
    io.observe(term)

    return () => {
      alive = false
      io.disconnect()
      typed.forEach((el, i) => (el.textContent = fulls[i] ?? ''))
    }
  })

  return (
    <div ref={ref}>
      <Section id="keamanan" tone="ink" labelledBy="keamanan-title" ambient>
        <SectionHeader eyebrow={c.eyebrow} title={c.title} titleId="keamanan-title" lead={c.lead} />

        <div className="secu-grid">
          <div className="secu-vault">
            <div className="secu-status">
              <div className="secu-lock">
                <Padlock />
              </div>
              <div className="secu-status-text">
                <p className="secu-kicker">{c.vault.kicker}</p>
                <p className="secu-state">
                  <span className="secu-state-dot" aria-hidden="true" />
                  {c.vault.state}
                </p>
                <p className="secu-checks">{c.vault.checks}</p>
              </div>
            </div>

            <p className="sr-only">{c.terminalLabel}</p>
            <div className="term" aria-hidden="true">
              <div className="term-bar">
                <span className="term-dot" />
                <span className="term-dot" />
                <span className="term-dot" />
                <span className="term-title">{TERMINAL_TITLE}</span>
              </div>
              <div className="term-body">
                {TERMINAL.map((line, i) => {
                  if (line.kind === 'gap') return <div key={i} className="term-row term-gap" />
                  if (line.kind === 'cmd')
                    return (
                      <div key={i} className="term-row term-cmd">
                        <span className="term-ps">$</span>
                        <span className="term-txt" data-type="">
                          {line.text}
                        </span>
                        <span className="term-caret" />
                      </div>
                    )
                  return (
                    <div key={i} className={`term-row term-out${line.tone ? ` term-out--${line.tone}` : ''}`}>
                      {line.text}
                    </div>
                  )
                })}
                <div className="term-row term-cmd term-last">
                  <span className="term-ps">$</span>
                  <span className="term-caret" />
                </div>
              </div>
            </div>
            <p className="secu-note">{c.note}</p>
          </div>

          <ul className="secu-cards">
            {c.cards.map((card, i) => {
              const Icon = SEC_ICONS[i]
              return (
                <Card as="li" key={card.spec} className="secu-card">
                  <span className="secu-card-icon" aria-hidden="true">
                    {Icon ? <Icon /> : null}
                  </span>
                  <h3 className="secu-card-title">{card.title}</h3>
                  <p className="secu-card-body">{card.body}</p>
                  <code className="secu-spec">{card.spec}</code>
                </Card>
              )
            })}
          </ul>
        </div>

        <div className="secu-foot">
          <ButtonLink href={waLink(c.waText)} variant="ghost" icon={<WaIcon />}>
            {c.cta}
          </ButtonLink>
        </div>
      </Section>
    </div>
  )
}
