/**
 * viz/core.ts — shared plumbing for every chart: motion mode, responsive size, first-view draw-in,
 * GSAP-tweened data updates, live visibility and keyboard index navigation.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { gsap } from 'gsap'
import { DEMO, isEnabled } from '../../lib/motion'

/**
 * Module constants (seconds unless named ms). Integrator may move them into motion.ts → DEMO.
 * drawIn reuses DEMO.chartDraw (≤ 800 ms, spec §8.4).
 */
export const VIZ = {
  /** First-view draw-in duration. */
  drawIn: DEMO.chartDraw,
  /** Data update interpolation. */
  update: 0.6,
  /** Fraction of the chart that must be visible before it draws. */
  revealThreshold: 0.25,
  /** Reduced motion: fade instead of draw. */
  reducedFade: DEMO.reducedFade,
} as const

export type VizMode = 'static' | 'reduced' | 'full'

let modeCache: VizMode | null = null
/** ?static=1 → final states; demoAnimations off / reduced motion → fades ≤ 150 ms; else full. */
export function vizMode(): VizMode {
  if (modeCache) return modeCache
  if (typeof window === 'undefined') return 'static'
  const q = new URLSearchParams(window.location.search)
  modeCache = q.get('static') === '1' ? 'static' : isEnabled('demoAnimations') ? 'full' : 'reduced'
  return modeCache
}

/** Width (and height) of an element, tracked with ResizeObserver (last entry wins). */
export function useSize(ref: RefObject<Element | null>, fallback = 640): { w: number; h: number } {
  const [size, setSize] = useState({ w: fallback, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    if (r.width) setSize({ w: Math.round(r.width), h: Math.round(r.height) })
    const ro = new ResizeObserver((entries) => {
      const last = entries[entries.length - 1]
      if (!last) return
      const w = Math.round(last.contentRect.width)
      const h = Math.round(last.contentRect.height)
      setSize((s) => (s.w === w && s.h === h ? s : { w, h }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return size
}

/**
 * Draw progress 0 → 1, started the first time the element is visible (≤ 800 ms, eased).
 * static: 1 at once. reduced: 1 when visible (the frame fades via CSS).
 */
export function useReveal(ref: RefObject<Element | null>): number {
  const mode = vizMode()
  const [p, setP] = useState(mode === 'static' ? 1 : 0)
  useEffect(() => {
    if (mode === 'static') return
    const el = ref.current
    if (!el) return
    let tween: gsap.core.Tween | null = null
    const start = () => {
      if (mode === 'reduced') {
        setP(1)
        return
      }
      const o = { v: 0 }
      tween = gsap.to(o, { v: 1, duration: VIZ.drawIn, ease: 'power2.inOut', onUpdate: () => setP(o.v) })
    }
    if (typeof IntersectionObserver === 'undefined') {
      start()
      return () => void tween?.kill()
    }
    const io = new IntersectionObserver(
      (entries) => {
        const last = entries[entries.length - 1]
        if (last?.isIntersecting) {
          io.disconnect()
          start()
        }
      },
      { threshold: VIZ.revealThreshold },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      tween?.kill()
    }
  }, [ref, mode])
  return p
}

/** Live visibility (for pausing loops off-screen). */
export function useVisible(ref: RefObject<Element | null>): boolean {
  const [vis, setVis] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setVis(true)
      return
    }
    const io = new IntersectionObserver((entries) => {
      const last = entries[entries.length - 1]
      if (last) setVis(last.isIntersecting)
    })
    io.observe(el)
    return () => io.disconnect()
  }, [ref])
  return vis
}

const sameNums = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((v, i) => v === b[i])

/**
 * Interpolated copy of `target`: when the numbers change, GSAP tweens from the values on screen to the new
 * ones (VIZ.update, power2.inOut) and re-renders each frame. New indices start from `enterFrom(i)` (default:
 * the target itself). In static / reduced mode the new values apply at once.
 */
export function useTweened(target: readonly number[], enterFrom?: (i: number, to: number) => number): number[] {
  const mode = vizMode()
  const [cur, setCur] = useState<number[]>(() => [...target])
  const curRef = useRef<number[]>(cur)
  const lastTarget = useRef<readonly number[]>(target)
  const tweenRef = useRef<gsap.core.Tween | null>(null)
  const enterRef = useRef(enterFrom)
  enterRef.current = enterFrom

  useEffect(() => {
    if (sameNums(lastTarget.current, target)) return
    lastTarget.current = [...target]
    tweenRef.current?.kill()
    const to = [...target]
    if (mode !== 'full') {
      curRef.current = to
      setCur(to)
      return
    }
    const from = to.map((v, i) => {
      const c = curRef.current[i]
      return c === undefined || !Number.isFinite(c) ? (enterRef.current ? enterRef.current(i, v) : v) : c
    })
    const o = { t: 0 }
    tweenRef.current = gsap.to(o, {
      t: 1,
      duration: VIZ.update,
      ease: 'power2.inOut',
      onUpdate: () => {
        const next = to.map((v, i) => (from[i] ?? v) + (v - (from[i] ?? v)) * o.t)
        curRef.current = next
        setCur(next)
      },
    })
  })

  useEffect(() => () => void tweenRef.current?.kill(), [])
  return cur.length === target.length ? cur : [...target]
}

/** Flatten / unflatten helpers for tweening ragged arrays. */
export function flatten(rows: readonly (readonly number[])[]): number[] {
  const out: number[] = []
  for (const r of rows) for (const v of r) out.push(v)
  return out
}
export function unflatten(flat: readonly number[], shape: readonly (readonly unknown[])[]): number[][] {
  const out: number[][] = []
  let k = 0
  for (const r of shape) {
    const row: number[] = []
    for (let i = 0; i < r.length; i++) row.push(flat[k++] ?? 0)
    out.push(row)
  }
  return out
}

/**
 * Active-index state for charts: pointer sets it, arrow keys move it, Escape clears it.
 * `kbd` tells the frame to announce the readout through its aria-live region.
 */
export function useIndexNav(count: number, opts: { start?: number; step?: number; cols?: number } = {}) {
  const [active, setActive] = useState<number | null>(null)
  const [kbd, setKbd] = useState(false)
  const { start = count - 1, cols = 0 } = opts
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!count) return
      const cur = active ?? start
      let n: number | null = null
      const right = e.key === 'ArrowRight'
      const left = e.key === 'ArrowLeft'
      if (cols > 0 && e.key === 'ArrowDown') n = Math.min(count - 1, cur + cols)
      else if (cols > 0 && e.key === 'ArrowUp') n = Math.max(0, cur - cols)
      else if (right || (cols === 0 && e.key === 'ArrowDown')) n = (cur + 1) % count
      else if (left || (cols === 0 && e.key === 'ArrowUp')) n = (cur - 1 + count) % count
      else if (e.key === 'Home') n = 0
      else if (e.key === 'End') n = count - 1
      else if (e.key === 'Escape') {
        setActive(null)
        return
      }
      if (n !== null) {
        e.preventDefault()
        setKbd(true)
        setActive(n)
      }
    },
    [active, count, start, cols],
  )
  const point = useCallback((i: number | null) => {
    setKbd(false)
    setActive(i)
  }, [])
  const onBlur = useCallback(() => {
    if (kbd) setActive(null)
  }, [kbd])
  return { active: active !== null && active < count ? active : null, kbd, onKeyDown, point, onBlur, setActive }
}

/** Easing helper for staggered reveal pieces: progress of item i of n within an overall p. */
export function stagger(p: number, i: number, n: number, spread = 0.5): number {
  if (p >= 1) return 1
  const start = n > 1 ? (i / (n - 1)) * spread : 0
  return Math.max(0, Math.min(1, (p - start) / (1 - spread)))
}

/** Pointer position relative to an element, in its CSS pixels. */
export function localPoint(e: { clientX: number; clientY: number }, el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top }
}

let uid = 0
/** Stable unique id for aria references (useId output contains ':' which is fine for ids but not url(#)). */
export function useUid(prefix: string): string {
  const ref = useRef<string | null>(null)
  if (!ref.current) ref.current = `${prefix}-${++uid}`
  return ref.current
}
