/**
 * ui/motion.ts — the Demo Kit's shared motion helpers (one copy instead of three, see ARAH-VISUAL §5.1 #12).
 *
 * motionMode(): 'static' (?static=1 → final states, no entrance), 'reduced' (prefers-reduced-motion,
 * ?off=demoAnimations, or perf degrade ≥ 3 → fades ≤ DEMO.reducedFade), 'full'.
 * Every timing comes from DEMO in src/lib/motion.ts. Only transform / opacity are animated.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { gsap } from 'gsap'
import { DEMO, EASE, isEnabled } from '../../lib/motion'
import { getDegradeLevel } from '../../lib/perf'

export type MotionMode = 'static' | 'reduced' | 'full'

/** Perf degrade level from which demo micro-motion falls back to fades. */
const DEGRADE_TO_REDUCED = 3

let staticCache: boolean | null = null
function isStatic(): boolean {
  if (staticCache !== null) return staticCache
  if (typeof window === 'undefined') return true
  staticCache = new URLSearchParams(window.location.search).get('static') === '1'
  return staticCache
}

export function motionMode(): MotionMode {
  if (isStatic()) return 'static'
  if (!isEnabled('demoAnimations')) return 'reduced'
  if (getDegradeLevel() >= DEGRADE_TO_REDUCED) return 'reduced'
  return 'full'
}

/** One gsap.context per component, reverted on unmount. `run(fn)` records the tweens created inside fn. */
export function useGsapContext(): (fn: () => void) => void {
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

/**
 * IntersectionObserver flag, reading only the LAST entry of each batch. `once` (default true) latches
 * at the first intersection — use `once: false` to pause loops while off-screen.
 */
export function useInView(ref: RefObject<Element | null>, opts: { once?: boolean; threshold?: number; rootMargin?: string } = {}): boolean {
  const { once = true, threshold = 0.2, rootMargin } = opts
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        const last = entries[entries.length - 1]
        if (!last) return
        if (last.isIntersecting) {
          setInView(true)
          if (once) io.disconnect()
        } else if (!once) setInView(false)
      },
      { threshold, rootMargin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ref, once, threshold, rootMargin])
  return inView
}

/** True while the document is visible (tab not hidden). */
export function usePageVisible(): boolean {
  const [vis, setVis] = useState(() => (typeof document === 'undefined' ? true : !document.hidden))
  useEffect(() => {
    const on = () => setVis(!document.hidden)
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [])
  return vis
}

export interface CountUpOptions {
  /** formats the running number (default: rounded integer) */
  format?: (n: number) => string
  /** seconds, capped at DEMO.countUp (0.6) */
  duration?: number
  /** start counting only once true (e.g. first in view); before that 0 is shown */
  start?: boolean
}

/**
 * KPI count-up: writes into the returned ref's textContent (no React re-render per frame).
 * First run counts from 0 when `start` turns true; later changes roll from the previous value. ≤ 600 ms.
 */
export function useCountUp<T extends HTMLElement = HTMLSpanElement>(value: number, opts: CountUpOptions = {}): RefObject<T | null> {
  const ref = useRef<T>(null)
  const cur = useRef({ v: 0 })
  const fmtRef = useRef(opts.format)
  fmtRef.current = opts.format
  const start = opts.start ?? true
  const duration = Math.min(opts.duration ?? DEMO.countUp, DEMO.countUp)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const write = () => {
      const f = fmtRef.current
      el.textContent = f ? f(cur.current.v) : String(Math.round(cur.current.v))
    }
    if (motionMode() !== 'full') {
      cur.current.v = value
      write()
      return
    }
    if (!start) {
      write()
      return
    }
    const tw = gsap.to(cur.current, { v: value, duration, ease: 'power2.out', onUpdate: write, onComplete: write })
    return () => {
      tw.kill()
    }
  }, [value, start, duration])
  return ref
}

/**
 * New row / card: slide in from 8 px above + 12 % accent overlay fading over 1.5 s. The element must be
 * `position: relative`; an overlay span (.dk-flash) is created on demand. Returns a kill function.
 */
export function flashNewRow(el: HTMLElement, opts: { slide?: boolean } = {}): () => void {
  const mode = motionMode()
  let fl = el.querySelector<HTMLElement>(':scope > .dk-flash')
  if (!fl) {
    fl = document.createElement('span')
    fl.className = 'dk-flash'
    fl.setAttribute('aria-hidden', 'true')
    el.prepend(fl)
  }
  if (mode === 'static') {
    gsap.set(fl, { opacity: 0 })
    return () => {}
  }
  const tl = gsap.timeline()
  if (mode === 'reduced') {
    tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: DEMO.reducedFade, clearProps: 'opacity' }, 0)
    tl.fromTo(fl, { opacity: 1 }, { opacity: 0, duration: DEMO.reducedFade, delay: DEMO.rowHighlightFade - DEMO.reducedFade }, 0)
  } else {
    if (opts.slide !== false) {
      tl.fromTo(el, { y: -DEMO.rowSlidePx, opacity: 0 }, { y: 0, opacity: 1, duration: DEMO.panel, ease: EASE.out, clearProps: 'transform,opacity' }, 0)
    }
    tl.fromTo(fl, { opacity: 1 }, { opacity: 0, duration: DEMO.rowHighlightFade, ease: 'power1.in' }, 0)
  }
  return () => {
    tl.kill()
    gsap.set(el, { clearProps: 'transform,opacity' })
    if (fl) gsap.set(fl, { opacity: 0 })
  }
}

/**
 * Structured AI result chips "drop" into place, staggered 60 ms. Accepts the chips or their container
 * (its element children are used). Returns a kill function.
 */
export function dropChips(target: Element | Element[] | NodeListOf<Element>): () => void {
  const els = target instanceof Element ? Array.from(target.children) : Array.from(target)
  if (!els.length) return () => {}
  const mode = motionMode()
  if (mode === 'static') {
    gsap.set(els, { clearProps: 'transform,opacity' })
    return () => {}
  }
  const tw =
    mode === 'reduced'
      ? gsap.fromTo(els, { opacity: 0 }, { opacity: 1, duration: DEMO.reducedFade, clearProps: 'opacity' })
      : gsap.fromTo(
          els,
          { y: -10, opacity: 0, scale: 0.96 },
          { y: 0, opacity: 1, scale: 1, duration: DEMO.panel, ease: 'back.out(1.6)', stagger: DEMO.chipStagger, clearProps: 'transform,opacity' },
        )
  return () => {
    tw.kill()
    gsap.set(els, { clearProps: 'transform,opacity' })
  }
}

/** Enter animation for panels / toasts / overlays (fade + small rise; fade only when reduced). */
export function enterPanel(el: Element, from: { x?: number; y?: number } = { y: 8 }, duration: number = DEMO.panel): gsap.core.Tween | null {
  const mode = motionMode()
  if (mode === 'static') return null
  if (mode === 'reduced') return gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: DEMO.reducedFade, clearProps: 'opacity' })
  return gsap.fromTo(el, { opacity: 0, ...from }, { opacity: 1, x: 0, y: 0, duration, ease: EASE.out, clearProps: 'transform,opacity' })
}

/** Exit animation; resolves when done (immediately in static mode). */
export function exitPanel(el: Element, to: { x?: number; y?: number } = { y: 8 }, duration: number = DEMO.press): Promise<void> {
  const mode = motionMode()
  if (mode === 'static') return Promise.resolve()
  return new Promise((resolve) => {
    if (mode === 'reduced') gsap.to(el, { opacity: 0, duration: DEMO.reducedFade, onComplete: resolve })
    else gsap.to(el, { opacity: 0, ...to, duration, ease: 'power1.in', onComplete: resolve })
  })
}

/** Width of an element via ResizeObserver (0 until measured). */
export function useElementWidth(ref: RefObject<Element | null>): number {
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setW(el.getBoundingClientRect().width)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const last = entries[entries.length - 1]
      if (last) setW(last.contentRect.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return w
}

/** matchMedia as state. */
export function useMedia(query: string): boolean {
  const [m, setM] = useState(() => (typeof window === 'undefined' ? false : window.matchMedia(query).matches))
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setM(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return m
}
