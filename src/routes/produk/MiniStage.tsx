/**
 * MiniStage — the hero mini-demo of /produk/:slug (plan §2.3 item 1). The mini chunk loads once the box is within
 * ECO_SITE.mini.rootMargin of the viewport (useMini), plays while ≥ ECO_SITE.mini.playThreshold of it is visible,
 * pauses otherwise. Calm mode (reduced motion, ?static=1): final frame until the visitor presses "Putar".
 * The box keeps its aspect ratio before the chunk arrives (placeholder of the same size → no CLS).
 * Also exports MiniStill: a named frame of the same mini as a still (Momen unggulan).
 */
import { useEffect, useRef, useState } from 'react'
import { PRODUCT_BY_SLUG, type Bi, type ProductSlug } from '../../content/products'
import { useEcoI18n } from '../../content/i18n/useEco'
import { useMini } from '../../demos/minis'
import { ECO_SITE, isEnabled, prefersReducedMotion } from '../../lib/motion'
import { getDegradeLevel } from '../../lib/perf'
import { Icon } from '../../demo-kit/ui/icons'
import { fill } from '../EcoParts'

/** = miniCalm() in demos/mini-kit.tsx (not imported: mini-kit carries the mini CSS; demo-kit/ui/motion is in demo-core) */
const calmNow = (): boolean =>
  new URLSearchParams(window.location.search).get('static') === '1' || !isEnabled('demoAnimations') || prefersReducedMotion() || getDegradeLevel() >= 3

function Placeholder({ slug, label }: { slug: ProductSlug; label: string }) {
  const p = PRODUCT_BY_SLUG[slug]
  return (
    <div className="pr-mini-ph" data-box={p.frame === 'phone' ? 'phone' : 'wide'} role="status">
      <span className="sr-only">{label}</span>
    </div>
  )
}

export function MiniStage({ slug }: { slug: ProductSlug }) {
  const { lang, eco: copy } = useEcoI18n()
  const m = copy.mini
  const p = PRODUCT_BY_SLUG[slug]
  const ref = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  const [visible, setVisible] = useState(false)
  const [calm] = useState(calmNow)
  /** calm: the visitor started it; full: the visitor paused it */
  const [toggled, setToggled] = useState(false)
  const [caption, setCaption] = useState<Bi | null>(null)
  const C = useMini(slug, near)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const nearIo = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setNear(true), { rootMargin: ECO_SITE.mini.rootMargin })
    const visIo = new IntersectionObserver(
      (es) => {
        const e = es[es.length - 1]
        if (e) setVisible(e.isIntersecting && e.intersectionRatio >= ECO_SITE.mini.playThreshold)
      },
      { threshold: [0, ECO_SITE.mini.playThreshold, 1] },
    )
    nearIo.observe(el)
    visIo.observe(el)
    return () => {
      nearIo.disconnect()
      visIo.disconnect()
    }
  }, [])

  // a new product (same route component, new slug): start over
  useEffect(() => {
    setToggled(false)
    setCaption(null)
  }, [slug])

  const running = calm ? toggled : !toggled
  const playing = visible && running
  const label = fill(running ? m.pauseLabel : m.playLabel, { name: p.name })

  return (
    <figure className="pr-mini" data-eco={p.eco}>
      <div ref={ref} className="pr-mini-box">
        {C ? <C playing={playing} onCaption={setCaption} /> : <Placeholder slug={slug} label={m.loading} />}
      </div>
      <figcaption className="pr-mini-cap">
        <button type="button" className="pr-mini-btn" aria-label={label} aria-pressed={calm ? toggled : undefined} onClick={() => setToggled((v) => !v)}>
          <Icon name={running ? 'pause' : 'play'} size={18} />
          <span aria-hidden="true">{running ? m.pause : m.play}</span>
        </button>
        <span className="pr-mini-line" aria-hidden="true">
          {caption ? fill(m.caption, { caption: caption[lang] }) : ' '}
        </span>
        <span className="sr-only">{fill(m.summary, { name: p.name, tagline: p.tagline[lang] })}</span>
      </figcaption>
    </figure>
  )
}

/** A named frame of the product's mini as a still (loads the same chunk when near the viewport). */
export function MiniStill({ slug, frame }: { slug: ProductSlug; frame: string }) {
  const { eco: copy } = useEcoI18n()
  const ref = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  const C = useMini(slug, near)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setNear(true), { rootMargin: ECO_SITE.mini.rootMargin })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} className="pr-still">
      {C ? <C playing={false} frame={frame} /> : <Placeholder slug={slug} label={copy.mini.loading} />}
    </div>
  )
}
