/**
 * Device frames (spec §6.4) — all original, no brand look-alikes.
 * BrowserFrame · PhoneFrame · TabletFrame · WallScreenFrame · PaperFrame (+ printPaper).
 * The dusk graft (1 px gradient top edge + one static dusk glow) lives ONLY on BrowserFrame / WallScreenFrame,
 * the outermost frames, never on inner panels.
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { gsap } from 'gsap'
import { Icon } from '../ui/icons'
import { motionMode } from '../ui/motion'
import '../ui/tokens.css'
import './frames.css'

/** Frame constants. */
export const FRAMES = {
  /** max pointer tilt of PhoneFrame (deg) */
  tiltMaxDeg: 6,
  /** quickTo follow duration (s) */
  tiltFollow: 0.6,
  /** demo URL host */
  host: 'demo.gamada.id',
} as const

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

/* ------------------------------------------------------------------ BrowserFrame */

export interface BrowserFrameProps {
  /** product slug → URL demo.gamada.id/<slug> */
  slug?: string
  /** full override of the path after the host ("sapa-warga/tiket/SW-2026-0142") */
  path?: string
  /** accessible name of the framed region */
  label: string
  children: ReactNode
  /** right side of the bar (real controls only) */
  actions?: ReactNode
  /** dusk glow + gradient edge (default true) */
  dusk?: boolean
  className?: string
}

export function BrowserFrame({ slug, path, label, children, actions, dusk = true, className }: BrowserFrameProps) {
  const p = path ?? slug ?? ''
  return (
    <section className={cx('dk-bframe', dusk && 'has-dusk', className)} aria-label={label}>
      <div className="dk-bframe-bar">
        <span className="dk-bframe-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="dk-bframe-url">
          <Icon name="lock" size={12} strokeWidth={1.7} />
          <span>
            <span className="dk-bframe-host">{FRAMES.host}</span>
            {p && <span className="dk-bframe-path">/{p}</span>}
          </span>
        </span>
        <span className="dk-bframe-act">{actions}</span>
      </div>
      <div className="dk-bframe-body">{children}</div>
    </section>
  )
}

/* ------------------------------------------------------------------ PhoneFrame */

export interface PhoneFrameProps {
  children: ReactNode
  /** accessible name ("Simulasi layar HP warga") */
  label: string
  /** status-bar clock — pass the world clock (formatTime(clock.minutes)) */
  time?: string
  /** pointer tilt ≤ 6°, fine pointers only, off in reduced motion / static (default true) */
  tilt?: boolean
  /** CSS width (px number or any length), default 300 */
  width?: number | string
  className?: string
}

export function PhoneFrame({ children, label, time = '08.00', tilt = true, width = 300, className }: PhoneFrameProps) {
  const stage = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const st = stage.current
    const el = body.current
    if (!tilt || !st || !el) return
    if (motionMode() !== 'full') return
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)')
    if (!fine.matches) return
    const rx = gsap.quickTo(el, 'rotationX', { duration: FRAMES.tiltFollow, ease: 'power3.out' })
    const ry = gsap.quickTo(el, 'rotationY', { duration: FRAMES.tiltFollow, ease: 'power3.out' })
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const r = el.getBoundingClientRect()
      const nx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1))
      const ny = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1))
      ry(nx * FRAMES.tiltMaxDeg)
      rx(-ny * FRAMES.tiltMaxDeg)
    }
    const leave = () => {
      rx(0)
      ry(0)
    }
    st.addEventListener('pointermove', move)
    st.addEventListener('pointerleave', leave)
    return () => {
      st.removeEventListener('pointermove', move)
      st.removeEventListener('pointerleave', leave)
      gsap.killTweensOf(el)
      gsap.set(el, { clearProps: 'transform' })
    }
  }, [tilt])
  return (
    <div ref={stage} className={cx('dk-phone-stage', className)} style={{ width }}>
      <section ref={body} className="dk-phone" aria-label={label}>
        <div className="dk-phone-screen">
          <div className="dk-phone-status">
            <span className="dk-phone-time dk-num">{time}</span>
            <span className="dk-phone-notch" aria-hidden="true" />
            <span className="dk-phone-sys" aria-hidden="true">
              <Icon name="signal" size={14} strokeWidth={1.8} />
              <Icon name="wifi" size={14} strokeWidth={1.6} />
              <Icon name="battery" size={16} strokeWidth={1.4} />
            </span>
          </div>
          <div className="dk-phone-body">{children}</div>
          <span className="dk-phone-home" aria-hidden="true" />
        </div>
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------ TabletFrame */

export interface TabletFrameProps {
  children: ReactNode
  label: string
  time?: string
  orientation?: 'landscape' | 'portrait'
  className?: string
}

export function TabletFrame({ children, label, time, orientation = 'landscape', className }: TabletFrameProps) {
  return (
    <section className={cx('dk-tablet', `is-${orientation}`, className)} aria-label={label}>
      <span className="dk-tablet-cam" aria-hidden="true" />
      <div className="dk-tablet-screen">
        {time && (
          <div className="dk-tablet-status" aria-hidden="true">
            <span className="dk-num">{time}</span>
            <span className="dk-tablet-sys">
              <Icon name="wifi" size={13} strokeWidth={1.6} />
              <Icon name="battery" size={15} strokeWidth={1.4} />
            </span>
          </div>
        )}
        <div className="dk-tablet-body">{children}</div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ WallScreenFrame */

export interface WallScreenFrameProps {
  children: ReactNode
  label: string
  /** small caption under the screen ("Ruang rapat pimpinan · layar 86 inci") */
  caption?: string
  className?: string
}

export function WallScreenFrame({ children, label, caption, className }: WallScreenFrameProps) {
  return (
    <figure className={cx('dk-wall', className)}>
      <div className="dk-wall-tilt">
        <section className="dk-wall-screen" aria-label={label}>
          <div className="dk-wall-body">{children}</div>
          <span className="dk-wall-glare" aria-hidden="true" />
        </section>
        <span className="dk-wall-led" aria-hidden="true" />
      </div>
      <span className="dk-wall-stand" aria-hidden="true" />
      {caption && <figcaption className="dk-wall-cap">{caption}</figcaption>}
    </figure>
  )
}

/* ------------------------------------------------------------------ PaperFrame */

export interface PaperFrameProps {
  children: ReactNode
  /** accessible name ("Surat masuk 005/123/2026") */
  label: string
  /** 'a4' keeps the 210:297 proportion (content may grow); 'auto' fits content */
  size?: 'a4' | 'auto'
  /** fold corner + subtle scan grain for "scanned" letters */
  scanned?: boolean
  className?: string
  id?: string
}

export function PaperFrame({ children, label, size = 'a4', scanned, className, id }: PaperFrameProps) {
  return (
    <article id={id} className={cx('dk-root', 'dk-paper', `is-${size}`, scanned && 'is-scanned', className)} data-theme="paper" aria-label={label}>
      <div className="dk-paper-sheet">{children}</div>
    </article>
  )
}

/**
 * Prints only `paper` (a PaperFrame element or any element inside one). Without a call (Ctrl/Cmd+P),
 * the print stylesheet prints every PaperFrame on the page and nothing else.
 */
export function printPaper(paper: Element): void {
  const el = paper.closest('.dk-paper') ?? paper
  const html = document.documentElement
  el.classList.add('is-print-target')
  html.classList.add('dk-printing')
  const done = () => {
    el.classList.remove('is-print-target')
    html.classList.remove('dk-printing')
    window.removeEventListener('afterprint', done)
  }
  window.addEventListener('afterprint', done)
  window.print()
}
