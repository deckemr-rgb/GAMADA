/**
 * About — "Sekilas tentang GAMADA": who we are, how we work (lead + one paragraph), three compact
 * facts, and a panel of three mock dashboards (POS, 20-device farm, automation queue) in browser
 * windows. On entering the viewport the windows rise as a stacked pile and fan out into their
 * layout (transform/opacity + a clip wipe of each screen); afterwards they float with a small mouse
 * parallax (flag pointerParallax, off on touch / reduced motion). The running-job bar and the busy
 * device dots loop only while the panel is on screen.
 */
import { useRef } from 'react'
import { gsap } from 'gsap'
import { useI18n } from '../lib/i18n'
import { useReveal } from '../lib/reveal'
import { EASE, SITE_REVEAL as R, isEnabled, isTouchDevice } from '../lib/motion'
import { SITE } from '../content/site'
import Section from '../components/ui/Section'
import SectionHeader from '../components/ui/SectionHeader'
import { DeviceFrame } from '../components/ui/DeviceFrame'
import { FarmMock, PosMock, QueueMock } from './about/Mocks'
import '../styles/sections/about.css'

/* ---- section constants (candidates for motion.ts) */
const ABOUT_MOTION = {
  /** Pile → fan reveal. Pile: all windows near the stage centre, slightly rotated / scaled. */
  pileScale: 0.82,
  pileJitter: [
    { x: -14, y: 10, r: -3 },
    { x: 12, y: -6, r: 4 },
    { x: 0, y: 16, r: -1 },
  ],
  pileFadeIn: 0.4,
  fanDelay: 0.45,
  fanDur: 1.05,
  fanStagger: 0.12,
  /** Pointer parallax amplitude per window (px, x; y uses 70 %) and follow time (s). */
  parallax: [8, 14, 20],
  parallaxFollow: 0.9,
  /** Running-job progress loop (s) and busy-dot pulse (s). */
  progressLoop: 2.6,
  pulse: 0.9,
} as const

const FactIcons = [
  // cursor on a window: "try it first"
  <svg key="0" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="4" width="18" height="13" rx="2.5" />
    <path d="M3 8h18" />
    <path d="m12.5 11.5 6 2.3-2.6 1 -1 2.6z" />
  </svg>,
  // map pin
  <svg key="1" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
    <circle cx="12" cy="10" r="2.4" />
  </svg>,
  // clock
  <svg key="2" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>,
]

export default function About() {
  const { t } = useI18n()
  const c = t.home.about
  const ref = useRef<HTMLDivElement>(null)

  useReveal(ref, (kit, root) => {
    kit.eyebrow(root.querySelector('[data-rv="eyebrow"]'))
    kit.heading(root.querySelector('[data-rv="heading"]'))
    kit.fadeUp(root.querySelectorAll('[data-rv="lead"], [data-rv="body"]'), { stagger: 0.1 })
    kit.cards(root.querySelectorAll('[data-rv="card"]'))

    const stage = root.querySelector<HTMLElement>('.ab-stage')
    if (!stage) return
    const fans = Array.from(stage.querySelectorAll<HTMLElement>('.ab-fan'))
    const pars = Array.from(stage.querySelectorAll<HTMLElement>('.ab-par'))

    if (kit.reduced) {
      kit.fadeUp(fans, { stagger: 0.08 })
      return
    }

    // ---- pile → fan (offsets use offsetLeft/Top on the un-transformed .ab-win: transform-proof)
    const M = ABOUT_MOTION
    const tl = gsap.timeline({ scrollTrigger: { trigger: stage, start: R.start, once: true, invalidateOnRefresh: true } })
    fans.forEach((fan, i) => {
      const win = fan.parentElement as HTMLElement
      const j = M.pileJitter[i] ?? { x: 0, y: 0, r: 0 }
      const winRot = Number(win.dataset.rot ?? 0)
      const dx = () => stage.clientWidth / 2 - (win.offsetLeft + win.offsetWidth / 2) + j.x
      const dy = () => stage.clientHeight / 2 - (win.offsetTop + win.offsetHeight / 2) + j.y
      const pile = { x: dx, y: dy, rotation: -winRot + j.r, scale: M.pileScale }
      // the pile appears first (opacity only), then each window fans out after its own fade ended
      tl.fromTo(fan, { ...pile, autoAlpha: 0 }, { ...pile, autoAlpha: 1, duration: M.pileFadeIn, ease: 'power2.out' }, i * 0.06)
      tl.to(fan, { x: 0, y: 0, rotation: 0, scale: 1, duration: M.fanDur, ease: EASE.reveal }, M.fanDelay + i * M.fanStagger)
      const screen = fan.querySelector<HTMLElement>('.device-screen')
      const inner = screen?.firstElementChild
      if (screen)
        tl.fromTo(
          screen,
          { clipPath: 'inset(100% 0% 0% 0%)' },
          { clipPath: 'inset(0% 0% 0% 0%)', duration: R.imageDur, ease: EASE.reveal, clearProps: 'clipPath' },
          M.fanDelay + 0.15 + i * M.fanStagger,
        )
      if (inner)
        tl.fromTo(
          inner,
          { scale: R.imageScale },
          { scale: 1, duration: R.imageDur * 1.2, ease: EASE.out, clearProps: 'transform' },
          M.fanDelay + 0.15 + i * M.fanStagger,
        )
    })

    // ---- small live loop (progress bar + busy dots), only while visible
    const fill = stage.querySelector('.mk-prog-fill')
    const dots = stage.querySelectorAll('[data-pulse]')
    const loop = gsap.timeline({ paused: true, repeat: -1 })
    if (fill) loop.fromTo(fill, { scaleX: 0.08 }, { scaleX: 1, duration: M.progressLoop, ease: 'power1.inOut', transformOrigin: '0% 50%' }, 0)
    if (dots.length)
      loop.to(dots, { opacity: 0.25, duration: M.pulse, ease: 'sine.inOut', yoyo: true, repeat: 1, stagger: 0.3 }, 0)
    const io = new IntersectionObserver((entries) => {
      const e = entries[entries.length - 1]
      if (e?.isIntersecting) loop.play()
      else loop.pause()
    })
    io.observe(stage)

    // ---- pointer parallax (mouse only)
    let off = () => {}
    if (isEnabled('pointerParallax') && !isTouchDevice()) {
      const qx = pars.map((p) => gsap.quickTo(p, 'x', { duration: M.parallaxFollow, ease: EASE.pointer }))
      const qy = pars.map((p) => gsap.quickTo(p, 'y', { duration: M.parallaxFollow, ease: EASE.pointer }))
      let rect: DOMRect | null = null
      const move = (e: PointerEvent) => {
        if (e.pointerType !== 'mouse') return
        const r = rect ?? (rect = stage.getBoundingClientRect())
        const nx = gsap.utils.clamp(-1, 1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2 + 200))
        const ny = gsap.utils.clamp(-1, 1, (e.clientY - (r.top + r.height / 2)) / (r.height / 2 + 200))
        pars.forEach((_, i) => {
          const a = M.parallax[i] ?? 10
          qx[i]?.(nx * a)
          qy[i]?.(ny * a * 0.7)
        })
      }
      const leave = () => {
        rect = null
        qx.forEach((q) => q(0))
        qy.forEach((q) => q(0))
      }
      const invalidate = () => {
        rect = null
      }
      root.addEventListener('pointermove', move)
      root.addEventListener('pointerleave', leave)
      window.addEventListener('scroll', invalidate, { passive: true })
      window.addEventListener('resize', invalidate)
      off = () => {
        root.removeEventListener('pointermove', move)
        root.removeEventListener('pointerleave', leave)
        window.removeEventListener('scroll', invalidate)
        window.removeEventListener('resize', invalidate)
      }
    }

    return () => {
      io.disconnect()
      off()
    }
  })

  const windows = [
    { key: 'pos', url: c.mock.pos.url, rot: -3, node: <PosMock c={c.mock.pos} /> },
    { key: 'farm', url: c.mock.farm.url, rot: 2.5, node: <FarmMock c={c.mock.farm} /> },
    { key: 'queue', url: c.mock.queue.url, rot: -1, node: <QueueMock c={c.mock.queue} /> },
  ]

  return (
    <div ref={ref} className="about">
      <Section id="tentang" tone="ink" labelledBy="tentang-title" ambient>
        <div className="ab-grid">
          <div className="ab-copy">
            <SectionHeader eyebrow={c.eyebrow} title={c.title} titleId="tentang-title" lead={c.lead} />
            <p className="ab-body" data-rv="body">
              {c.body}
            </p>
          </div>

          <figure className="ab-figure">
            <div className="ab-stage" role="img" aria-label={c.figureLabel}>
              {windows.map((w) => (
                <div key={w.key} className={`ab-win ab-win--${w.key}`} data-rot={w.rot} style={{ transform: `rotate(${w.rot}deg)` }} aria-hidden="true">
                  <div className="ab-fan">
                    <div className="ab-par">
                      <DeviceFrame url={w.url}>{w.node}</DeviceFrame>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <figcaption className="ab-caption">{c.caption}</figcaption>
          </figure>
        </div>

        <ul className="ab-facts">
          {c.facts.map((f, i) => (
            <li key={f.title} className="ab-fact" data-rv="card">
              <span className="ab-fact-ic">{FactIcons[i]}</span>
              <span className="ab-fact-t">{f.title.replace('{h}', String(SITE.stats.responseHours))}</span>
              <span className="ab-fact-d">{f.text}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}
