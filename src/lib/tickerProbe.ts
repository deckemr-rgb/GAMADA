/**
 * tickerProbe — `?debug=fps` only: wraps gsap.ticker callbacks to record slow ones (> 8 ms) with a
 * short source excerpt, exposed as window.__tickSlow for tools/perf.mjs.
 */
import { gsap } from 'gsap'

const SLOW_MS = 8

export function instrumentTicker(): void {
  if (new URLSearchParams(window.location.search).get('debug') !== 'fps') return
  const slow: Array<{ ms: number; at: number; src: string }> = []
  ;(window as unknown as { __tickSlow: typeof slow }).__tickSlow = slow
  const wrapped = new WeakMap<object, (...a: unknown[]) => void>()
  const add = gsap.ticker.add.bind(gsap.ticker)
  const remove = gsap.ticker.remove.bind(gsap.ticker)
  type Cb = (time: number, deltaTime: number, frame: number) => void
  gsap.ticker.add = ((fn: Cb, once?: boolean, prioritize?: boolean) => {
    const src = fn.toString().replace(/\s+/g, ' ').slice(0, 90)
    const w = (time: number, dt: number, frame: number) => {
      const t0 = performance.now()
      fn(time, dt, frame)
      const ms = performance.now() - t0
      if (ms > SLOW_MS) slow.push({ ms: +ms.toFixed(1), at: Math.round(t0), src })
    }
    wrapped.set(fn, w as (...a: unknown[]) => void)
    return add(w as Cb, once, prioritize)
  }) as typeof gsap.ticker.add
  gsap.ticker.remove = ((fn: Cb) => remove((wrapped.get(fn) as Cb | undefined) ?? fn)) as typeof gsap.ticker.remove
}
