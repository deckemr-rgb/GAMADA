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

function computeMode(): MotionMode {
  if (isStatic()) return 'static'
  if (!isEnabled('demoAnimations')) return 'reduced'
  if (getDegradeLevel() >= DEGRADE_TO_REDUCED) return 'reduced'
  return 'full'
}

/**
 * Mirrors 'not full' onto html[data-dk-calm] so the kit CSS safety net (tokens.css) covers every kit root,
 * portals included — not only DemoShell's .is-calm. Written ONCE, at module load (before the first style
 * pass, so it costs nothing): ?static=1, ?off=demoAnimations, a forced / start-up degrade level.
 * A degrade step at RUNTIME does not touch it: an attribute on <html> invalidates the style of the whole
 * document (measured: one 530–590 ms style recalc of ~2,000 elements at 4x CPU, landing inside whatever
 * interaction called motionMode() first — the INP outlier of PERF-4). Runtime degrade still switches every
 * JS-driven kit motion to 'reduced' through motionMode(); CSS transitions keep their (short) durations.
 */
function syncCalmOnce() {
  if (typeof document === 'undefined') return
  if (computeMode() !== 'full') document.documentElement.setAttribute('data-dk-calm', '')
}

export function motionMode(): MotionMode {
  return computeMode()
}
if (typeof window !== 'undefined') syncCalmOnce()

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
    // a gsap.ticker listener appended after the others (not a root-timeline tween): the text write lands after
    // any layout read other listeners make in the same frame, so it never forces a synchronous layout
    const ease = gsap.parseEase('power2.out')
    const from = cur.current.v
    const t0 = gsap.ticker.time
    const tick = () => {
      const k = Math.min(1, (gsap.ticker.time - t0) / duration)
      cur.current.v = from + (value - from) * ease(k)
      write()
      if (k >= 1) gsap.ticker.remove(tick)
    }
    gsap.ticker.add(tick)
    return () => {
      gsap.ticker.remove(tick)
    }
  }, [value, start, duration])
  // a new formatter (language switch, unit change) rewrites the current value at once: the text never keeps the
  // old locale ("3,8" in an English session)
  useLayoutEffect(() => {
    const el = ref.current
    const f = opts.format
    if (!el || !f) return
    el.textContent = f(cur.current.v)
  }, [opts.format])
  return ref
}

/* ------------------------------------------------------------------ write-only pose tweens */

/** transform (translate + scale) and opacity — the only properties the kit animates. */
export interface Pose {
  x?: number
  y?: number
  scale?: number
  opacity?: number
}

/** Handle of a running pose tween: kill() stops it and lands the final state. */
export interface PoseTween {
  kill: () => void
}

interface PoseOpts {
  duration: number
  ease?: string
  delay?: number
  stagger?: number
  /** remove the inline transform / opacity when done (default true) */
  clear?: boolean
  onComplete?: () => void
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k

function writePose(el: HTMLElement | SVGElement, from: Pose, to: Pose, k: number) {
  const s = el.style
  if (from.x !== undefined || from.y !== undefined || from.scale !== undefined || to.x !== undefined || to.y !== undefined || to.scale !== undefined) {
    const x = lerp(from.x ?? 0, to.x ?? 0, k)
    const y = lerp(from.y ?? 0, to.y ?? 0, k)
    const sc = lerp(from.scale ?? 1, to.scale ?? 1, k)
    s.transform = `translate(${x.toFixed(2)}px,${y.toFixed(2)}px)${sc !== 1 ? ` scale(${sc.toFixed(4)})` : ''}`
  }
  if (from.opacity !== undefined || to.opacity !== undefined) s.opacity = String(lerp(from.opacity ?? 1, to.opacity ?? 1, k))
}

/**
 * Animate inline transform / opacity from → to on one gsap.ticker listener that only WRITES. Unlike a gsap
 * tween it never reads computed style at start (gsap's CSSPlugin init does, and right after a React commit
 * that read forces a full style recalc — the main cost of the old "new row" / drawer interactions).
 * The `from` pose is written synchronously, so there is no flash before the first tick.
 */
export function animatePose(target: Element | Element[], from: Pose, to: Pose, opts: PoseOpts): PoseTween {
  const els = (Array.isArray(target) ? target : [target]) as (HTMLElement | SVGElement)[]
  const ease = gsap.parseEase(opts.ease ?? 'none')
  const { duration, delay = 0, stagger = 0, clear = true } = opts
  const t0 = gsap.ticker.time
  let alive = true
  const finish = () => {
    alive = false
    gsap.ticker.remove(tick)
    for (const el of els) {
      if (clear) {
        el.style.transform = ''
        el.style.opacity = ''
      } else writePose(el, from, to, 1)
    }
  }
  const tick = () => {
    const now = gsap.ticker.time - t0
    let done = true
    els.forEach((el, i) => {
      const raw = Math.max(0, Math.min(1, (now - delay - i * stagger) / Math.max(0.001, duration)))
      if (raw < 1) done = false
      writePose(el, from, to, ease(raw))
    })
    if (done) {
      finish()
      opts.onComplete?.()
    }
  }
  for (const el of els) writePose(el, from, to, 0)
  gsap.ticker.add(tick)
  return {
    kill: () => {
      if (alive) finish()
    },
  }
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
  const flash = fl
  if (mode === 'static') {
    flash.style.opacity = '0'
    return () => {}
  }
  const tws: PoseTween[] = []
  if (mode === 'reduced') {
    tws.push(animatePose(el, { opacity: 0 }, { opacity: 1 }, { duration: DEMO.reducedFade }))
    tws.push(animatePose(flash, { opacity: 1 }, { opacity: 0 }, { duration: DEMO.reducedFade, delay: DEMO.rowHighlightFade - DEMO.reducedFade, clear: false }))
  } else {
    if (opts.slide !== false) tws.push(animatePose(el, { y: -DEMO.rowSlidePx, opacity: 0 }, { y: 0, opacity: 1 }, { duration: DEMO.panel, ease: EASE.out }))
    tws.push(animatePose(flash, { opacity: 1 }, { opacity: 0 }, { duration: DEMO.rowHighlightFade, ease: 'power1.in', clear: false }))
  }
  return () => {
    for (const t of tws) t.kill()
    el.style.transform = ''
    el.style.opacity = ''
    flash.style.opacity = '0'
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
  const clearAll = () => {
    for (const el of els as HTMLElement[]) {
      el.style.transform = ''
      el.style.opacity = ''
    }
  }
  if (mode === 'static') {
    clearAll()
    return () => {}
  }
  const tw =
    mode === 'reduced'
      ? animatePose(els, { opacity: 0 }, { opacity: 1 }, { duration: DEMO.reducedFade })
      : animatePose(els, { y: -10, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1 }, { duration: DEMO.panel, ease: 'back.out(1.6)', stagger: DEMO.chipStagger })
  return () => {
    tw.kill()
    clearAll()
  }
}

/** Enter animation for panels / toasts / overlays (fade + small rise; fade only when reduced). Write-only. */
export function enterPanel(el: Element, from: { x?: number; y?: number } = { y: 8 }, duration: number = DEMO.panel): PoseTween | null {
  const mode = motionMode()
  if (mode === 'static') return null
  if (mode === 'reduced') return animatePose(el, { opacity: 0 }, { opacity: 1 }, { duration: DEMO.reducedFade })
  return animatePose(el, { opacity: 0, ...from }, { opacity: 1, x: 0, y: 0 }, { duration, ease: EASE.out })
}

/** Exit animation; resolves when done (immediately in static mode). Write-only. */
export function exitPanel(el: Element, to: { x?: number; y?: number } = { y: 8 }, duration: number = DEMO.press): Promise<void> {
  const mode = motionMode()
  if (mode === 'static') return Promise.resolve()
  return new Promise((resolve) => {
    if (mode === 'reduced') animatePose(el, { opacity: 1 }, { opacity: 0 }, { duration: DEMO.reducedFade, clear: false, onComplete: resolve })
    else animatePose(el, { opacity: 1, x: 0, y: 0 }, { opacity: 0, ...to }, { duration, ease: 'power1.in', clear: false, onComplete: resolve })
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
