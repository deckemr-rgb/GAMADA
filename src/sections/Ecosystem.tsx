/**
 * Ecosystem — home teaser of the GAMADA ecosystem (Tahap 6, spec §4): GAMADA Inti in the middle, the three
 * ecosystems (Satu Daerah, Usaha Pintar, Pasar Daerah) around it; CTA "Jelajahi ekosistem" → /ekosistem.
 * Names, audience lines and links come from content/ecoNav.ts (home never imports products.ts).
 *  - connection lines draw with scroll (kit.stroke, scrubbed stroke-dashoffset)
 *  - every node is a <button>: hover / focus previews it, click pins it (aria-pressed); the other
 *    links and nodes dim (opacity) and the side panel (aria-live) explains the node
 *  - small data pulses travel along the straight lines (gsap x/y), only while the diagram is on
 *    screen and fully drawn; none under reduced motion
 * Layout: SVG lines in a viewBox with the container's exact aspect ratio + HTML buttons positioned
 * in % on top, so labels keep their real font size. Narrow screens (≤ 640 px) switch to a taller
 * coordinate set.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useI18n } from '../lib/i18n'
import { useReveal } from '../lib/reveal'
import { prefersReducedMotion } from '../lib/motion'
import Section from '../components/ui/Section'
import SectionHeader from '../components/ui/SectionHeader'
import { ButtonLink } from '../components/ui/Button'
import { ECO_NAV } from '../content/ecoNav'
import { ECO_ICONS, type EcoNodeId } from './ecosystem/icons'
import '../styles/sections/ecosystem.css'

gsap.registerPlugin(ScrollTrigger)

/* ---------------- ECOSYSTEM (tuning) — diagram geometry + pulse timing */
const ECO = {
  /** Below this width the diagram uses the tall coordinate set. */
  narrowQuery: '(max-width: 640px)',
  layouts: {
    wide: {
      w: 1000,
      h: 600,
      rings: [120, 210],
      pos: { hub: [500, 300], 'satu-daerah': [180, 120], 'usaha-pintar': [820, 120], 'pasar-daerah': [500, 525] },
    },
    narrow: {
      w: 360,
      h: 500,
      rings: [78],
      pos: { hub: [180, 235], 'satu-daerah': [76, 70], 'usaha-pintar': [284, 70], 'pasar-daerah': [180, 420] },
    },
  },
  /** Data pulse: travel time (s), random pause between trips (s), offset between links (s). */
  pulseDur: 1.8,
  pulseGap: [0.5, 2.4] as [number, number],
  pulseOffset: 0.45,
  /** Pulses start once the diagram centre passes this viewport line (lines are drawn by then). */
  pulseStart: 'center 55%',
  /** Line drawing range (ScrollTrigger start / end on the diagram). */
  strokeStart: 'top 85%',
  strokeEnd: 'center 55%',
  /** Node fade-in start, measured on the hub button (first node), so the orbs land with the lines. */
  nodesStart: 'top bottom',
  /** Detail panel content swap (s) and lift (px). */
  swapDur: 0.35,
  swapY: 8,
} as const

type Sat = Exclude<EcoNodeId, 'hub'>
const SATS: readonly Sat[] = ['satu-daerah', 'usaha-pintar', 'pasar-daerah']
const NODES: readonly EcoNodeId[] = ['hub', ...SATS]
/** Direction of the data pulse: true = ecosystem → Inti. */
const INBOUND: Record<Sat, boolean> = { 'satu-daerah': true, 'usaha-pintar': false, 'pasar-daerah': true }
/** ecoNav entry of a node (hub = GAMADA Inti) */
const navOf = (id: EcoNodeId) => ECO_NAV.find((e) => e.id === (id === 'hub' ? 'inti' : id)) ?? ECO_NAV[0]!
const fill = (s: string, name: string) => s.replace('{name}', name)

function useMedia(query: string): boolean {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const sync = () => setMatch(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [query])
  return match
}

export default function Ecosystem() {
  const { t, lang } = useI18n()
  const c = t.home.ecosystem
  const ref = useRef<HTMLDivElement>(null)
  const detailRef = useRef<HTMLDivElement>(null)
  const narrow = useMedia(ECO.narrowQuery)
  const L = narrow ? ECO.layouts.narrow : ECO.layouts.wide
  const [hx, hy] = L.pos.hub

  const [pinned, setPinned] = useState<EcoNodeId>('hub')
  const [preview, setPreview] = useState<EcoNodeId | null>(null)
  const shown = preview ?? pinned
  const node = c.nodes[shown]
  const nav = navOf(shown)
  /** small label of a node: Inti's own kicker, else the ecosystem's audience line (ecoNav) */
  const kicker = (id: EcoNodeId) => (id === 'hub' ? c.hubKicker : navOf(id).audience[lang])

  useReveal(
    ref,
    (kit, root) => {
      kit.eyebrow(root.querySelector('[data-rv="eyebrow"]'))
      kit.heading(root.querySelector('[data-rv="heading"]'))
      kit.fadeUp(root.querySelectorAll('[data-rv="lead"], .eco-hint'))
      const stage = root.querySelector<HTMLElement>('.eco-stage')
      kit.stroke(root.querySelectorAll('.eco-path'), stage, { start: ECO.strokeStart, end: ECO.strokeEnd })
      // the hub button is the trigger: 'top bottom' lands the orbs as the lines start drawing
      kit.fadeUp(root.querySelectorAll('.eco-node-btn'), { stagger: 0.07, start: ECO.nodesStart })
      kit.fadeUp(root.querySelectorAll('.eco-panel, .eco-more'))
      if (kit.reduced || !stage) return

      // data pulses: one repeating trip per link, all under one master that plays only while visible + drawn
      const master = gsap.timeline({ paused: true })
      root.querySelectorAll<SVGCircleElement>('.eco-dot').forEach((dot, i) => {
        const id = dot.dataset.node as Sat
        const [nx, ny] = L.pos[id]
        const inbound = INBOUND[id]
        const from = inbound ? [nx, ny] : [hx, hy]
        const to = inbound ? [hx, hy] : [nx, ny]
        const d = ECO.pulseDur
        const trip = gsap.timeline({ repeat: -1, repeatDelay: gsap.utils.random(ECO.pulseGap[0], ECO.pulseGap[1]) })
        trip
          .fromTo(dot, { x: from[0], y: from[1] }, { x: to[0], y: to[1], duration: d, ease: 'power1.inOut' }, 0)
          .fromTo(dot, { opacity: 0 }, { opacity: 1, duration: d * 0.2, ease: 'none' }, 0)
          .to(dot, { opacity: 0, duration: d * 0.25, ease: 'none' }, d * 0.75)
        master.add(trip, i * ECO.pulseOffset)
      })

      let visible = false
      let drawn = false
      const sync = () => (visible && drawn ? master.play() : master.pause())
      ScrollTrigger.create({
        trigger: stage,
        start: ECO.pulseStart,
        onEnter: () => {
          drawn = true
          sync()
        },
        onLeaveBack: () => {
          drawn = false
          sync()
        },
      })
      const io = new IntersectionObserver((entries) => {
        // several entries can queue up between callbacks: the last one is the current state
        visible = !!entries[entries.length - 1]?.isIntersecting
        sync()
      })
      io.observe(stage)
      return () => io.disconnect()
    },
    [narrow],
  )

  // detail panel: soft swap when the shown node changes (skip the first paint: the reveal owns it)
  const first = useRef(true)
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const el = detailRef.current
    if (!el || prefersReducedMotion()) return
    const tw = gsap.fromTo(el, { opacity: 0, y: ECO.swapY }, { opacity: 1, y: 0, duration: ECO.swapDur, ease: 'power2.out', clearProps: 'transform,opacity' })
    return () => {
      tw.kill()
    }
  }, [shown])

  const pct = (v: number, of: number) => `${(v / of) * 100}%`
  const state = (id: EcoNodeId) => (shown === 'hub' || id === 'hub' || id === shown ? 'on' : 'dim')

  return (
    <div ref={ref}>
      <Section id="integrasi" tone="indigo" labelledBy="integrasi-title" fireflies={0.5} ambient>
        <SectionHeader eyebrow={c.eyebrow} title={c.title} titleId="integrasi-title" lead={c.lead} />

        <div className="eco-grid" data-shown={shown}>
          <figure className="eco-figure">
            <div
              className="eco-stage"
              data-layout={narrow ? 'narrow' : 'wide'}
              style={{ aspectRatio: `${L.w} / ${L.h}` } as CSSProperties}
            >
              <svg className="eco-svg" viewBox={`0 0 ${L.w} ${L.h}`} aria-hidden="true" focusable="false">
                {L.rings.map((r) => (
                  <circle key={r} className="eco-path eco-ring" cx={hx} cy={hy} r={r} />
                ))}
                {SATS.map((id) => {
                  const [nx, ny] = L.pos[id]
                  const d = `M${hx} ${hy} L${nx} ${ny}`
                  return (
                    <g key={id} className={`eco-link eco-link--${id} is-${state(id)}`} data-hot={shown === id ? 'true' : 'false'}>
                      <path className="eco-path eco-glow" d={d} />
                      <path className="eco-path eco-line" d={d} />
                      <circle className="eco-dot" data-node={id} cx={0} cy={0} r={narrow ? 4.5 : 5} />
                    </g>
                  )
                })}
              </svg>

              <ul className="eco-nodes" aria-label={c.diagramLabel}>
                {NODES.map((id) => {
                  const [x, y] = L.pos[id]
                  const e = navOf(id)
                  const Icon = ECO_ICONS[id]
                  return (
                    <li
                      key={id}
                      className={`eco-node eco-node--${id} is-${state(id)}`}
                      data-current={shown === id ? 'true' : 'false'}
                      style={{ left: pct(x, L.w), top: pct(y, L.h) }}
                    >
                      <button
                        type="button"
                        className="eco-node-btn"
                        aria-pressed={pinned === id}
                        aria-controls="eco-detail"
                        aria-describedby={`eco-desc-${id}`}
                        onClick={() => setPinned(id)}
                        onPointerEnter={(e) => {
                          if (e.pointerType === 'mouse') setPreview(id)
                        }}
                        onPointerLeave={(e) => {
                          if (e.pointerType === 'mouse') setPreview(null)
                        }}
                        onFocus={() => setPreview(id)}
                        onBlur={() => setPreview(null)}
                      >
                        <span className="eco-node-orb" aria-hidden="true">
                          <span className="eco-node-ring" />
                          <Icon />
                        </span>
                        <span className="eco-node-label">
                          {id === 'hub' ? e.name : e.short}
                          <span className="eco-node-sub">{kicker(id)}</span>
                        </span>
                      </button>
                      {/* static per-node description (the live panel below carries the full text) */}
                      <span id={`eco-desc-${id}`} hidden>
                        {kicker(id)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
            <figcaption className="eco-hint">
              <span className="eco-hint-dot" aria-hidden="true" />
              <span>{c.hint}</span>
            </figcaption>
          </figure>

          <aside className="eco-panel" aria-labelledby="eco-detail-title">
            <div id="eco-detail" ref={detailRef} className="eco-detail">
              <p className="eco-kicker">
                <span className="eco-kicker-icon" aria-hidden="true">
                  {ECO_ICONS[shown]()}
                </span>
                {kicker(shown)}
              </p>
              <h3 id="eco-detail-title" className="eco-detail-title">
                {node.title}
              </h3>
              <p className="eco-detail-body">{node.body}</p>
            </div>
            {/* announce only a chosen (pinned) node, not every hover / focus preview */}
            <p className="sr-only" aria-live="polite" aria-atomic="true">
              {`${navOf(pinned).name}: ${c.nodes[pinned].title}`}
            </p>
            <ButtonLink to={nav.to} variant="text" className="eco-cta">
              {fill(c.nodeCta, nav.name)}
            </ButtonLink>
          </aside>
        </div>
        <div className="eco-more">
          <ButtonLink to="/ekosistem" variant="ghost">
            {c.cta}
            <span aria-hidden="true">→</span>
          </ButtonLink>
        </div>
      </Section>
    </div>
  )
}
