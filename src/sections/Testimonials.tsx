/**
 * Testimonials — three ILLUSTRATIVE quotes (role-based attributions, never names; every card carries a
 * visible "illustration" label and the lead says so) in a centred peek carousel.
 *  · drag / swipe with inertia (Draggable + InertiaPlugin), snapping to one card per flick
 *  · prev / next buttons, dots, ← → keys while focus is inside, pause / play toggle
 *  · autoplay (the active dot fills as a progress bar) pauses on hover, focus within, off-screen,
 *    while dragging and is off under reduced motion
 * Only transform / opacity animate. Reveals: lib/reveal.ts.
 */
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { gsap } from 'gsap'
import { Draggable } from 'gsap/Draggable'
import { InertiaPlugin } from 'gsap/InertiaPlugin'
import { useI18n } from '../lib/i18n'
import { useReveal } from '../lib/reveal'
import { EASE, prefersReducedMotion } from '../lib/motion'
import Section from '../components/ui/Section'
import SectionHeader from '../components/ui/SectionHeader'
import Card from '../components/ui/Card'
import Tag from '../components/ui/Tag'
import '../styles/sections/testimonials.css'

gsap.registerPlugin(Draggable, InertiaPlugin)

/* ---- local constants (to be moved into motion.ts by the integrator) */
const TESTI = {
  /** Autoplay interval (s); the active dot fills over this time. */
  autoplay: 5,
  /** Slide change tween (s). */
  slideDur: 0.8,
  /** Neighbour cards: scale / opacity loss at one full step from the centre. */
  peekScale: 0.06,
  peekFade: 0.3,
  /** Rubber band past the first / last card (Draggable edgeResistance). */
  edgeResistance: 0.82,
} as const

const ICONS: Record<string, ReactNode> = {
  cup: (
    <>
      <path d="M5 10h12v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5v-5Z" />
      <path d="M17 11.5h1.5a2.5 2.5 0 0 1 0 5H17" />
      <path d="M9 3.5c-.8 1 .8 2-.1 3.2M13 3.5c-.8 1 .8 2-.1 3.2" />
    </>
  ),
  bag: (
    <>
      <path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8Z" />
      <path d="M9 10V7a3 3 0 0 1 6 0v3" />
    </>
  ),
  phone: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M10.5 18.5h3" />
      <path d="M10 7.5h4M10 10.5h4M10 13.5h2" />
    </>
  ),
}

export default function Testimonials() {
  const { t } = useI18n()
  const c = t.home.testimonials
  const items = c.items
  const total = items.length

  const rootRef = useRef<HTMLDivElement>(null)
  const regionRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const fillRefs = useRef<Array<HTMLSpanElement | null>>([])
  const apiRef = useRef<{ go: (i: number) => void; step: (d: number) => void; setPaused: (p: boolean) => void } | null>(null)

  const [reduced] = useState(() => prefersReducedMotion())
  const [index, setIndex] = useState(0)
  const [userPaused, setUserPaused] = useState(false)
  const [running, setRunning] = useState(false)

  useReveal(rootRef, (kit, root) => {
    kit.eyebrow(root.querySelector('[data-rv="eyebrow"]'))
    kit.heading(root.querySelector('[data-rv="heading"]'))
    kit.fadeUp(root.querySelectorAll('[data-rv="lead"], .tsm'), { stagger: 0.12 })
  })

  // carousel engine: measure, drag, autoplay, visibility / hover / focus pauses
  useEffect(() => {
    const region = regionRef.current
    const vp = viewportRef.current
    const track = trackRef.current
    if (!region || !vp || !track) return
    const slides = Array.from(track.children) as HTMLElement[]
    const fills = fillRefs.current
    const st = { hovered: false, focused: false, visible: false, dragging: false, userPaused: false }
    let positions: number[] = []
    let current = 0
    let startIdx = 0
    let moved = false
    let progress: gsap.core.Tween | null = null

    const clampIdx = (i: number, lo = 0, hi = total - 1) => Math.max(lo, Math.min(hi, i))
    const measure = () => {
      const vw = vp.clientWidth
      positions = slides.map((s) => Math.round((vw - s.offsetWidth) / 2 - s.offsetLeft))
    }
    const stepPx = () => {
      const a = positions[0]
      const b = positions[1]
      return a !== undefined && b !== undefined && a !== b ? Math.abs(a - b) : vp.clientWidth
    }
    const nearest = (x: number) => {
      let best = 0
      let dist = Infinity
      positions.forEach((p, i) => {
        const d = Math.abs(p - x)
        if (d < dist) {
          dist = d
          best = i
        }
      })
      return best
    }
    const paint = () => {
      const x = Number(gsap.getProperty(track, 'x'))
      const mid = vp.clientWidth / 2
      const step = stepPx()
      for (const s of slides) {
        const d = Math.min(1, Math.abs(x + s.offsetLeft + s.offsetWidth / 2 - mid) / step)
        gsap.set(s, { scale: 1 - TESTI.peekScale * d, opacity: 1 - TESTI.peekFade * d })
      }
    }

    const sync = () => {
      const run = !reduced && !st.userPaused && !st.hovered && !st.focused && st.visible && !st.dragging
      if (progress) {
        if (run) progress.play()
        else progress.pause()
      }
      setRunning(run)
    }
    const startProgress = (i: number) => {
      progress?.kill()
      progress = null
      fills.forEach((f, k) => {
        if (f) gsap.set(f, { scaleX: reduced && k === i ? 1 : 0 })
      })
      const f = fills[i]
      if (!reduced && f) {
        progress = gsap.fromTo(
          f,
          { scaleX: 0 },
          { scaleX: 1, duration: TESTI.autoplay, ease: 'none', paused: true, onComplete: () => go(current + 1) },
        )
      }
      sync()
    }
    const settleOn = (i: number) => {
      if (i !== current) {
        current = i
        setIndex(i)
        startProgress(i)
      } else sync()
      paint()
    }
    const glideTo = (n: number) => {
      gsap.to(track, {
        x: positions[n] ?? 0,
        duration: reduced ? 0 : TESTI.slideDur,
        ease: EASE.out,
        overwrite: true,
        onUpdate: paint,
        onComplete: () => {
          paint()
          drag?.update()
        },
      })
    }
    function go(i: number) {
      const n = ((i % total) + total) % total
      current = n
      setIndex(n)
      glideTo(n)
      startProgress(n)
    }

    measure()
    gsap.set(track, { x: positions[0] ?? 0 })

    const drag: Draggable | undefined = Draggable.create(track, {
      type: 'x',
      inertia: !reduced,
      edgeResistance: TESTI.edgeResistance,
      zIndexBoost: false,
      allowContextMenu: true,
      bounds: { minX: positions[total - 1] ?? 0, maxX: positions[0] ?? 0 },
      // one card per flick at most: the throw ends on a neighbour of the card it started from
      snap: { x: (v: number) => positions[clampIdx(nearest(v), startIdx - 1, startIdx + 1)] ?? v },
      onPress: () => {
        moved = false
        gsap.killTweensOf(track)
      },
      // a press that never became a drag (e.g. a click mid-slide) must not leave the track between cards
      onRelease: () => {
        if (!moved) glideTo(current)
      },
      onDragStart: () => {
        moved = true
        st.dragging = true
        startIdx = current
        sync()
      },
      onDrag: paint,
      onThrowUpdate: paint,
      onThrowComplete: () => {
        st.dragging = false
        settleOn(nearest(Number(gsap.getProperty(track, 'x'))))
      },
      onDragEnd: function (this: Draggable) {
        if (!reduced) return // the inertia throw finishes in onThrowComplete
        st.dragging = false
        go(clampIdx(nearest(this.x), startIdx - 1, startIdx + 1))
      },
    })[0]

    const ro = new ResizeObserver(() => {
      measure()
      drag?.applyBounds({ minX: positions[total - 1] ?? 0, maxX: positions[0] ?? 0 })
      gsap.killTweensOf(track)
      gsap.set(track, { x: positions[current] ?? 0 })
      drag?.update()
      paint()
    })
    ro.observe(vp)

    // one callback can batch several entries for the region (e.g. "out" then "in"): the last one wins
    const io = new IntersectionObserver((entries) => {
      st.visible = !!entries[entries.length - 1]?.isIntersecting
      sync()
    })
    io.observe(region)

    const onEnter = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      st.hovered = true
      sync()
    }
    const onLeave = () => {
      st.hovered = false
      sync()
    }
    const onFocusIn = () => {
      st.focused = true
      sync()
    }
    const onFocusOut = (e: FocusEvent) => {
      if (e.relatedTarget instanceof Node && region.contains(e.relatedTarget)) return
      st.focused = false
      sync()
    }
    region.addEventListener('pointerenter', onEnter)
    region.addEventListener('pointerleave', onLeave)
    region.addEventListener('focusin', onFocusIn)
    region.addEventListener('focusout', onFocusOut)

    apiRef.current = {
      go,
      step: (d: number) => go(current + d),
      setPaused: (p: boolean) => {
        st.userPaused = p
        sync()
      },
    }
    paint()
    startProgress(0)

    return () => {
      apiRef.current = null
      ro.disconnect()
      io.disconnect()
      region.removeEventListener('pointerenter', onEnter)
      region.removeEventListener('pointerleave', onLeave)
      region.removeEventListener('focusin', onFocusIn)
      region.removeEventListener('focusout', onFocusOut)
      progress?.kill()
      drag?.kill()
      gsap.killTweensOf(track)
      gsap.set(track, { clearProps: 'transform' })
      gsap.set(slides, { clearProps: 'transform,opacity' })
      const liveFills = fills.filter((f): f is HTMLSpanElement => !!f)
      if (liveFills.length) gsap.set(liveFills, { clearProps: 'transform' })
    }
  }, [reduced, total])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      apiRef.current?.step(e.key === 'ArrowLeft' ? -1 : 1)
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      apiRef.current?.go(e.key === 'Home' ? 0 : total - 1)
    }
  }

  const togglePause = () => {
    const next = !userPaused
    setUserPaused(next)
    apiRef.current?.setPaused(next)
  }

  const active = items[index]

  return (
    <Section id="testimoni" tone="indigo" labelledBy="testimoni-title" ambient>
      <div ref={rootRef}>
        <SectionHeader eyebrow={c.eyebrow} title={c.title} titleId="testimoni-title" lead={c.lead} align="center" />

        <div
          ref={regionRef}
          className="tsm"
          role="region"
          aria-roledescription="carousel"
          aria-label={c.carouselLabel}
          onKeyDown={onKeyDown}
        >
          <div ref={viewportRef} className="tsm-viewport" tabIndex={0} aria-describedby="tsm-hint">
            <div ref={trackRef} className="tsm-track">
              {items.map((it, i) => (
                <div
                  key={i}
                  className="tsm-slide"
                  role="group"
                  aria-roledescription="slide"
                  aria-label={c.slideOf(i + 1, total)}
                  data-active={i === index}
                >
                  <Card as="article" tilt={false} className="tsm-card">
                    <figure className="tsm-fig">
                      <div className="tsm-top">
                        <span className="tsm-icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                            {ICONS[it.icon] ?? ICONS.bag}
                          </svg>
                        </span>
                        <Tag className="tsm-label">
                          <svg className="tsm-label-i" viewBox="0 0 16 16" aria-hidden="true">
                            <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
                            <path d="M8 7.2v4M8 4.8v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                          </svg>
                          {c.label}
                        </Tag>
                      </div>
                      <span className="tsm-mark" aria-hidden="true">
                        &ldquo;
                      </span>
                      <blockquote className="tsm-quote">
                        <p>{it.quote}</p>
                      </blockquote>
                      <figcaption className="tsm-cap">
                        <span className="tsm-who">
                          <span className="tsm-role">{it.role}</span>
                          <span className="tsm-place">{it.place}</span>
                        </span>
                        <span className="tsm-service">{it.service}</span>
                      </figcaption>
                    </figure>
                  </Card>
                </div>
              ))}
            </div>
          </div>

          <div className="tsm-controls">
            <button type="button" className="tsm-btn" onClick={() => apiRef.current?.step(-1)} aria-label={c.prev}>
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M12.5 4.5 7 10l5.5 5.5" />
              </svg>
            </button>
            <div className="tsm-dots">
              {items.map((it, i) => (
                <button
                  key={i}
                  type="button"
                  className="tsm-dot"
                  aria-label={c.goTo(i + 1)}
                  aria-current={i === index ? 'true' : undefined}
                  data-active={i === index}
                  onClick={() => apiRef.current?.go(i)}
                  title={`${it.role} · ${it.place}`}
                >
                  <span className="tsm-dot-track" aria-hidden="true">
                    <span
                      className="tsm-dot-fill"
                      ref={(el) => {
                        fillRefs.current[i] = el
                      }}
                    />
                  </span>
                </button>
              ))}
            </div>
            <button type="button" className="tsm-btn" onClick={() => apiRef.current?.step(1)} aria-label={c.next}>
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M7.5 4.5 13 10l-5.5 5.5" />
              </svg>
            </button>
            {!reduced ? (
              <button type="button" className="tsm-btn tsm-btn--play" onClick={togglePause} aria-label={userPaused ? c.play : c.pause}>
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  {userPaused ? <path className="tsm-fillpath" d="M7 4.8v10.4L15.2 10 7 4.8Z" /> : <path d="M7.5 5v10M12.5 5v10" />}
                </svg>
              </button>
            ) : null}
            <p id="tsm-hint" className="tsm-hint">
              {c.hint}
            </p>
          </div>

          <p className="sr-only" aria-live={running ? 'off' : 'polite'} aria-atomic="true">
            {active ? c.status(index + 1, total, `${active.role}, ${active.place}`) : ''}
          </p>
        </div>
      </div>
    </Section>
  )
}
