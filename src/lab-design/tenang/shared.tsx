/**
 * Shared helpers for direction C ("tenang"): timing constants, motion mode (static / reduced /
 * full), visibility hooks, number formatting, small UI atoms and the 20 px line icon set.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { gsap } from 'gsap'
import { prefersReducedMotion } from '../../lib/motion'
import type { Lang } from '../../lib/i18n'

/* Timing (seconds). Kept local per CONTRACTS; integrator may move them into motion.ts (DEMO group). */
export const TT = {
  hover: 0.12,
  press: 0.2,
  panel: 0.32,
  screen: 0.6,
  reduced: 0.15,
  countUp: 0.6,
  chartDraw: 0.8,
  rowFlash: 1.5,
  chipStagger: 0.06,
  fieldStagger: 0.22,
} as const

export type L = { id: string; en: string }
export type Mode = 'static' | 'reduced' | 'full'

let modeCache: Mode | null = null
/** ?static=1 → final state, no entrance motion; reduced motion → fades ≤150 ms; else full. */
export function motionMode(): Mode {
  if (modeCache) return modeCache
  if (typeof window === 'undefined') return 'static'
  const q = new URLSearchParams(window.location.search)
  modeCache = q.get('static') === '1' ? 'static' : prefersReducedMotion() ? 'reduced' : 'full'
  return modeCache
}

/** One gsap.context per component, reverted on unmount; returns `run(fn)` that records tweens in it. */
export function useGsap(): (fn: () => void) => void {
  const ctx = useRef<gsap.Context | null>(null)
  useLayoutEffect(() => {
    ctx.current = gsap.context(() => {})
    return () => {
      ctx.current?.revert()
      ctx.current = null
    }
  }, [])
  return useCallback((fn: () => void) => {
    if (ctx.current) ctx.current.add(fn)
    else fn()
  }, [])
}

/** Calls `cb` once, the first time the element is visible (uses the LAST IO entry). */
export function useFirstView(ref: RefObject<Element | null>, cb: () => void, threshold = 0.2) {
  const cbRef = useRef(cb)
  cbRef.current = cb
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        const last = entries[entries.length - 1]
        if (last?.isIntersecting) {
          io.disconnect()
          cbRef.current()
        }
      },
      { threshold },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ref, threshold])
}

/** Live visibility flag, used to pause loops while off-screen. */
export function useVisible(ref: RefObject<Element | null>): boolean {
  const [vis, setVis] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      const last = entries[entries.length - 1]
      if (last) setVis(last.isIntersecting)
    })
    io.observe(el)
    return () => io.disconnect()
  }, [ref])
  return vis
}

const fmtCache = new Map<string, Intl.NumberFormat>()
export function fmt(lang: Lang, v: number, digits = 0): string {
  const key = `${lang}${digits}`
  let f = fmtCache.get(key)
  if (!f) {
    f = new Intl.NumberFormat(lang === 'id' ? 'id-ID' : 'en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    fmtCache.set(key, f)
  }
  return f.format(v)
}

export const tr = (lang: Lang, s: L) => s[lang]

/* ---------------------------------------------------------------- atoms */

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="ldt-kbd">{children}</kbd>
}

export function SectionHead({ num, title, lead, meta, id }: { num: string; title: string; lead?: string; meta?: ReactNode; id?: string }) {
  return (
    <header className="ldt-sh">
      <span className="ldt-sh-num" aria-hidden="true">
        {num}
      </span>
      <div className="ldt-sh-text">
        <h2 className="ldt-sh-title" id={id}>
          {title}
        </h2>
        {lead && <p className="ldt-sh-lead">{lead}</p>}
      </div>
      {meta && <div className="ldt-sh-meta">{meta}</div>}
    </header>
  )
}

/* ---------------------------------------------------------------- icons (20 px, 1.5 stroke) */

const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
}

export const Icon = {
  plus: () => (
    <svg {...base}>
      <path d="M10 4.5v11M4.5 10h11" />
    </svg>
  ),
  replay: () => (
    <svg {...base}>
      <path d="M4.2 8.2A6 6 0 1 1 4 11.5" />
      <path d="M3.6 4.4v3.9h3.9" />
    </svg>
  ),
  reset: () => (
    <svg {...base}>
      <path d="M5 5l10 10M15 5 5 15" />
    </svg>
  ),
  rowsCompact: () => (
    <svg {...base}>
      <path d="M3.5 5h13M3.5 8.3h13M3.5 11.7h13M3.5 15h13" />
    </svg>
  ),
  rowsComfy: () => (
    <svg {...base}>
      <path d="M3.5 6h13M3.5 10h13M3.5 14h13" />
    </svg>
  ),
  arrowRight: () => (
    <svg {...base}>
      <path d="M4 10h11.5M11 5.5 15.5 10 11 14.5" />
    </svg>
  ),
  check: () => (
    <svg {...base}>
      <path d="m4.5 10.4 3.4 3.3 7.6-8" />
    </svg>
  ),
  clock: () => (
    <svg {...base}>
      <circle cx="10" cy="10" r="6.5" />
      <path d="M10 6.5V10l2.4 1.6" />
    </svg>
  ),
  inbox: () => (
    <svg {...base}>
      <path d="M3.5 11.5 5.6 4.8A1.6 1.6 0 0 1 7.1 3.7h5.8a1.6 1.6 0 0 1 1.5 1.1l2.1 6.7" />
      <path d="M3.5 11.5V15a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-3.5h-4l-1 2h-3l-1-2h-4Z" />
    </svg>
  ),
  spark: () => (
    <svg {...base}>
      <path d="M9 3c.5 3.3 1.9 4.7 5.2 5.2C10.9 8.7 9.5 10.1 9 13.4 8.5 10.1 7.1 8.7 3.8 8.2 7.1 7.7 8.5 6.3 9 3Z" />
      <path d="M14.6 12.2c.25 1.6.9 2.25 2.5 2.5-1.6.25-2.25.9-2.5 2.5-.25-1.6-.9-2.25-2.5-2.5 1.6-.25 2.25-.9 2.5-2.5Z" />
    </svg>
  ),
  stamp: () => (
    <svg {...base}>
      <path d="M8 3.5h4a1 1 0 0 1 1 1v1.2c0 1.2-1.5 2-1.5 3.6V10h3a1.5 1.5 0 0 1 1.5 1.5V13h-12v-1.5A1.5 1.5 0 0 1 5.5 10h3v-.7C8.5 7.7 7 6.9 7 5.7V4.5a1 1 0 0 1 1-1Z" />
      <path d="M4.5 16.5h11" />
    </svg>
  ),
  doc: () => (
    <svg {...base}>
      <path d="M5.5 2.8h6l3.5 3.5v10a1 1 0 0 1-1 1h-8.5a1 1 0 0 1-1-1V3.8a1 1 0 0 1 1-1Z" />
      <path d="M11.3 2.8v3.7H15M7.3 10h5.4M7.3 13h4" />
    </svg>
  ),
  map: () => (
    <svg {...base}>
      <path d="m3 5.2 4.6-1.7 4.8 1.7L17 3.8v11l-4.6 1.7-4.8-1.7L3 16.2Z" />
      <path d="M7.6 3.5v11M12.4 5.2v11.3" />
    </svg>
  ),
  chat: () => (
    <svg {...base}>
      <path d="M4 4.5h12a1 1 0 0 1 1 1v7.5a1 1 0 0 1-1 1H9l-3.6 2.8V14H4a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1Z" />
      <path d="M6.5 8.3h7M6.5 11h4.5" />
    </svg>
  ),
  chart: () => (
    <svg {...base}>
      <path d="M3.5 3.5v13h13" />
      <path d="m6.5 12.5 3-3.5 2.5 2 4-5" />
    </svg>
  ),
  grid: () => (
    <svg {...base}>
      <rect x="3.5" y="3.5" width="5.5" height="5.5" rx="1.2" />
      <rect x="11" y="3.5" width="5.5" height="5.5" rx="1.2" />
      <rect x="3.5" y="11" width="5.5" height="5.5" rx="1.2" />
      <rect x="11" y="11" width="5.5" height="5.5" rx="1.2" />
    </svg>
  ),
  pulse: () => (
    <svg {...base}>
      <path d="M2.5 10.5h3l2-5 3.5 9 2-4h4.5" />
    </svg>
  ),
}
