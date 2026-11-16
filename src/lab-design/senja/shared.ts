/**
 * Direction B "Sinematik senja" — shared helpers (motion mode, visibility hooks, number format).
 * New timing constants live in ONE block (SJ) so the integrator can move them into motion.ts (DEMO).
 */
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { gsap } from 'gsap'
import { prefersReducedMotion } from '../../lib/motion'
import type { Lang } from '../../lib/i18n'

/** Durations in seconds (spec 8.3) + a few direction-specific counts. */
export const SJ = {
  hover: 0.12,
  press: 0.2,
  panel: 0.32,
  screen: 0.6,
  /** The two "wow" moments: ticket flight, flood wash. */
  wow: 1.2,
  countUp: 0.6,
  chartDraw: 0.8,
  flash: 1.5,
  /** Reduced-motion replacement fade (≤ 150 ms). */
  fade: 0.15,
  chipStagger: 0.06,
  ocrStagger: 0.22,
  washStagger: 0.13,
  tokenRateMin: 25,
  tokenRateMax: 45,
} as const

export interface Bi {
  readonly id: string
  readonly en: string
}

export type MotionMode = 'static' | 'reduced' | 'full'
let modeCache: MotionMode | null = null
/** static (?static=1: final state, no motion) · reduced (fades ≤150 ms) · full. */
export function motionMode(): MotionMode {
  if (modeCache) return modeCache
  if (typeof window === 'undefined') return 'static'
  const q = new URLSearchParams(window.location.search)
  modeCache = q.get('static') === '1' ? 'static' : prefersReducedMotion() ? 'reduced' : 'full'
  return modeCache
}

/** One gsap.context per component, reverted on unmount. Add tweens with ctx.current?.add(fn). */
export function useGsapContext(scope: RefObject<Element | null>) {
  const ctx = useRef<gsap.Context | null>(null)
  useLayoutEffect(() => {
    const c = gsap.context(() => {}, scope.current ?? undefined)
    ctx.current = c
    return () => {
      c.revert()
      ctx.current = null
    }
  }, [scope])
  return ctx
}

/** Fires `cb` once when the element first becomes visible (uses the LAST IO entry). Never in static mode. */
export function useEnter(ref: RefObject<Element | null>, cb: () => void, rootMargin = '0px 0px -16% 0px') {
  const cbRef = useRef(cb)
  useEffect(() => {
    cbRef.current = cb
  })
  useEffect(() => {
    const el = ref.current
    if (!el || motionMode() === 'static') return
    const io = new IntersectionObserver(
      (entries) => {
        const last = entries[entries.length - 1]
        if (!last?.isIntersecting) return
        io.disconnect()
        cbRef.current()
      },
      { rootMargin, threshold: 0 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ref, rootMargin])
}

/** Reports on/off-screen changes (LAST IO entry) so loops can pause. */
export function useOnScreen(ref: RefObject<Element | null>, cb: (visible: boolean) => void) {
  const cbRef = useRef(cb)
  useEffect(() => {
    cbRef.current = cb
  })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      const last = entries[entries.length - 1]
      if (last) cbRef.current(last.isIntersecting)
    })
    io.observe(el)
    return () => io.disconnect()
  }, [ref])
}

export function fmtNum(n: number, lang: Lang, digits = 0): string {
  return n.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

/** Deterministic PRNG (mulberry32) so the simulated stream is the same every run. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** "07.42" in Indonesian, "07:42" in English. */
export const clock = (lang: Lang, hhmm: string): string => (lang === 'id' ? hhmm.replace(':', '.') : hhmm)

export const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))
