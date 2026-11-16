/**
 * Skeleton (+ useSkeleton ≤ 400 ms), EmptyState (dusk line illustration + exactly one CTA), Confetti
 * (≤ 1 s, lavender / peach, transform + opacity only, nothing in reduced motion).
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { gsap } from 'gsap'
import { DEMO } from '../../lib/motion'
import { Button } from './Button'
import { Icon, type IconName } from './icons'
import { motionMode } from './motion'
import { useUiStrings } from './strings'
import './tokens.css'
import './ui.css'

/* ------------------------------------------------------------------ Skeleton */

export interface SkeletonProps {
  width?: number | string
  height?: number | string
  radius?: number
  /** n text lines (the last one shorter) instead of one block */
  lines?: number
  className?: string
}

export function Skeleton({ width = '100%', height = 12, radius = 6, lines, className }: SkeletonProps) {
  if (lines && lines > 1)
    return (
      <span className={`dk-skel-lines${className ? ` ${className}` : ''}`} aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <span key={i} className="dk-skel" style={{ width: i === lines - 1 ? '62%' : '100%', height, borderRadius: radius }} />
        ))}
      </span>
    )
  return <span className={`dk-skel${className ? ` ${className}` : ''}`} aria-hidden="true" style={{ width, height, borderRadius: radius } as CSSProperties} />
}

/**
 * True for at most DEMO.skeletonMaxMs (400 ms) after mount and after every `key` change; always false in
 * static mode. Use it to show skeletons while simulated data "loads".
 */
export function useSkeleton(key?: unknown, ms: number = DEMO.skeletonMaxMs): boolean {
  const dur = Math.min(ms, DEMO.skeletonMaxMs)
  const [loading, setLoading] = useState(() => motionMode() !== 'static')
  useEffect(() => {
    if (motionMode() === 'static') {
      setLoading(false)
      return
    }
    setLoading(true)
    const call = gsap.delayedCall(dur / 1000, () => setLoading(false))
    return () => {
      call.kill()
    }
  }, [key, dur])
  return loading
}

/* ------------------------------------------------------------------ EmptyState */

export type EmptyArt = 'inbox' | 'search' | 'chart' | 'doc' | 'map'

const ART_ICON: Record<EmptyArt, IconName> = { inbox: 'inbox', search: 'search', chart: 'chart', doc: 'doc', map: 'pin' }

/** Small dusk line illustration: horizon, setting sun, two ridges, two birds and the subject glyph. */
export function DuskArt({ kind = 'inbox' }: { kind?: EmptyArt }) {
  return (
    <svg className="dk-empty-art" viewBox="0 0 160 96" width="160" height="96" aria-hidden="true" focusable="false">
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path className="dk-art-sun" d="M58 70a22 22 0 0 1 44 0" strokeWidth="1.5" />
        <path className="dk-art-ray" d="M80 38v-6M62.6 45.4l-4.2-4.2M97.4 45.4l4.2-4.2" strokeWidth="1.5" />
        <path className="dk-art-ridge" d="M8 74c14-9 26-13 38-9s20 10 34 8 26-12 40-12 22 6 32 13" strokeWidth="1.5" />
        <path className="dk-art-ridge2" d="M20 84c18-5 34-6 50-3s34 4 50 0 20-3 28-1" strokeWidth="1.5" />
        <path className="dk-art-bird" d="M112 28c2-2 4-2 6 0 2-2 4-2 6 0M124 20c1.5-1.5 3-1.5 4.5 0 1.5-1.5 3-1.5 4.5 0" strokeWidth="1.3" />
      </g>
      <g transform="translate(70 52)" className="dk-art-glyph">
        <rect x="-4" y="-4" width="28" height="28" rx="8" />
      </g>
      <Icon name={ART_ICON[kind]} size={20} x={70} y={52} className="dk-art-ic" />
    </svg>
  )
}

export interface EmptyStateProps {
  title: string
  body?: string
  /** exactly one CTA (optional — omit it when there is nothing real to do) */
  action?: { label: string; onClick: () => void; icon?: IconName }
  art?: EmptyArt
  compact?: boolean
  className?: string
}

export function EmptyState({ title, body, action, art = 'inbox', compact, className }: EmptyStateProps) {
  return (
    <div className={`dk-empty${compact ? ' is-compact' : ''}${className ? ` ${className}` : ''}`}>
      <DuskArt kind={art} />
      <p className="dk-empty-title">{title}</p>
      {body && <p className="dk-empty-body">{body}</p>}
      {action && (
        <Button variant="primary" icon={action.icon} onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ Confetti */

const CONFETTI_COLORS = ['var(--c-lavender)', 'var(--c-peach)', 'var(--c-lavender-soft)', 'var(--c-peach-soft)'] as const
const CONFETTI_COUNT = 28

/** Bursts ≤ 1 s of lavender / peach paper from the centre of `anchor`. No-op in reduced / static mode. */
export function fireConfetti(anchor: Element): () => void {
  if (motionMode() !== 'full') return () => {}
  const r = anchor.getBoundingClientRect()
  const host = document.createElement('div')
  host.className = 'dk-confetti'
  host.setAttribute('aria-hidden', 'true')
  host.style.left = `${r.left + r.width / 2}px`
  host.style.top = `${r.top + r.height / 2}px`
  const bits: HTMLSpanElement[] = []
  for (let i = 0; i < CONFETTI_COUNT; i++) {
    const s = document.createElement('span')
    s.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length] ?? 'var(--c-lavender)'
    if (i % 3 === 0) s.style.borderRadius = '50%'
    host.appendChild(s)
    bits.push(s)
  }
  document.body.appendChild(host)
  const total = DEMO.confetti
  const tl = gsap.timeline({ onComplete: () => host.remove() })
  bits.forEach((b, i) => {
    const a = (i / CONFETTI_COUNT) * Math.PI * 2 + gsap.utils.random(-0.3, 0.3)
    const dist = gsap.utils.random(50, 130)
    const x = Math.cos(a) * dist
    const y = Math.sin(a) * dist * 0.7 - 30
    tl.fromTo(b, { x: 0, y: 0, rotation: 0, scale: gsap.utils.random(0.6, 1.1), opacity: 1 }, { x, y, rotation: gsap.utils.random(-260, 260), duration: total * 0.55, ease: 'power3.out' }, 0)
    tl.to(b, { y: y + gsap.utils.random(30, 60), opacity: 0, duration: total * 0.45, ease: 'power1.in' }, total * 0.55)
  })
  return () => {
    tl.kill()
    host.remove()
  }
}

/** Declarative trigger: fires each time `fire` changes to a new truthy value. */
export function Confetti({ fire }: { fire: number | string | null | undefined }) {
  const ref = useRef<HTMLSpanElement>(null)
  const last = useRef(fire)
  useLayoutEffect(() => {
    if (!fire || fire === last.current || !ref.current) {
      last.current = fire
      return
    }
    last.current = fire
    return fireConfetti(ref.current)
  }, [fire])
  return <span ref={ref} className="dk-confetti-anchor" aria-hidden="true" />
}

/** Re-export for screens that want the loading text. */
export function LoadingText({ children }: { children?: ReactNode }) {
  const t = useUiStrings()
  return (
    <span className="dk-loading" role="status">
      {children ?? t.loading}
    </span>
  )
}
