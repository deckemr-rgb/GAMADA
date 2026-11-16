/**
 * Section — content-section frame for the home and inner pages.
 *  tone: 'ink' (base) · 'ink2' / 'indigo' (alternating) · 'dawn' (light lavender→peach, ink text; use sparingly)
 *  ambient: slow dusk-gradient drift layer (transform only, paused off-screen)
 *  fireflies: low-tier particles behind the content (flag sectionParticles)
 * The section is the anchor target (id) and is labelled by its heading (labelledBy).
 */
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { SITE_REVEAL } from '../../lib/motion'
import Fireflies from '../Fireflies'
import '../../styles/ui-kit.css'

export type SectionTone = 'ink' | 'ink2' | 'indigo' | 'dawn'

interface Props {
  id?: string
  tone?: SectionTone
  labelledBy?: string
  ambient?: boolean
  fireflies?: boolean | number
  className?: string
  /** Inner width: 'content' (1200) or 'wide' (1440) or 'full'. */
  width?: 'content' | 'wide' | 'full'
  children: ReactNode
}

export default function Section({ id, tone = 'ink', labelledBy, ambient, fireflies, className = '', width = 'content', children }: Props) {
  const ref = useRef<HTMLElement>(null)

  // data-active = on screen: the ambient drift and the live-tag blink run only then
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      const e = entries[entries.length - 1]
      el.dataset.active = String(!!e?.isIntersecting)
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <section
      ref={ref}
      id={id}
      className={`sec sec--${tone} ${className}`}
      aria-labelledby={labelledBy}
      data-active="false"
      style={{ '--ambient-loop': `${SITE_REVEAL.ambientLoop}s` } as CSSProperties}
    >
      {ambient ? <div className="sec-ambient" aria-hidden="true" /> : null}
      {fireflies ? <Fireflies seed={(id ?? 'x').length * 7} density={typeof fireflies === 'number' ? fireflies : 0.6} /> : null}
      <div className={`sec-inner sec-inner--${width}`}>{children}</div>
    </section>
  )
}
