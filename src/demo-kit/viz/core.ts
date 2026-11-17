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

/* ------------------------------------------------------------------ reveal (DOM-driven, no per-frame React) */

/**
 * Reveal kinds a chart puts on its final-geometry nodes (data-r). useReveal animates them on the DOM nodes
 * (one gsap.ticker listener, writes only) when the plot first scrolls into view; React renders once.
 *  sy / sx / s  scaleY / scaleX / scale from 0 around data-o = "svg:x y" (user space; HTML: CSS origin)
 *  draw         stroke-dashoffset 1 → 0 (the node carries pathLength={1})
 *  fade         opacity 0 → 1
 *  attr         from the attribute values in data-ra (JSON), e.g. a needle's rotate()
 * data-rd = delay and data-rl = length, both as a fraction of VIZ.drawIn.
 */
export type RevealKind = 'sy' | 'sx' | 's' | 'draw' | 'fade' | 'attr'

/** Props for one revealed node. `i` of `n` with `spread` reproduces the old stagger(p, i, n, spread). */
export function rv(kind: RevealKind, opts: { i?: number; n?: number; spread?: number; delay?: number; len?: number; origin?: string; from?: Record<string, string | number> } = {}): Record<string, string> {
  const { i = 0, n = 1, spread = 0 } = opts
  const d = opts.delay ?? (n > 1 ? (i / (n - 1)) * spread : 0)
  const l = opts.len ?? (spread ? 1 - spread : 1 - d)
  const out: Record<string, string> = { 'data-r': kind }
  if (d) out['data-rd'] = d.toFixed(3)
  if (l !== 1) out['data-rl'] = Math.max(0.05, l).toFixed(3)
  if (opts.origin) out['data-o'] = opts.origin
  if (opts.from) out['data-ra'] = JSON.stringify(opts.from)
  return out
}

/** Numbers of `to` interpolated from `from` (same skeleton, see sameShape); `to` when they do not match. */
function lerpStr(from: string, to: string, k: number): string {
  const a = from.match(NUM_RE)
  if (!a || !sameShape(from, to)) return to
  let i = 0
  return to.replace(NUM_RE, (m) => {
    const f = Number(a[i++] ?? m)
    const t = Number(m)
    return String(Math.round((f + (t - f) * k) * 1000) / 1000)
  })
}

interface RevealItem {
  el: HTMLElement | SVGElement
  kind: RevealKind
  delay: number
  dur: number
  ox: number
  oy: number
  attrs: [string, string, string][] | null
}

/**
 * attr reveals still in flight, by node: a data update that lands during the draw-in RETARGETS the reveal
 * (useAttrTween → retargetReveal) instead of racing it; otherwise the reveal's per-frame writes (and its
 * final write) would put the stale geometry back over React's new value.
 */
const liveAttrReveals = new WeakMap<Element, RevealItem>()

/**
 * If `el` is mid attr-reveal, point the reveal at the value React just committed for each attribute it
 * animates, put the on-screen value back for this frame (`was`) and return the attributes it now owns.
 */
function retargetReveal(el: Element, was: Record<string, string | null>): Set<string> | null {
  const it = liveAttrReveals.get(el)
  if (!it?.attrs) return null
  const owned = new Set<string>()
  for (const rec of it.attrs) {
    const a = rec[0]
    const dom = el.getAttribute(a)
    const prev = was[a] ?? null
    if (dom !== null && dom !== prev) {
      rec[2] = dom // the reveal now lands on the new value
      if (prev !== null) el.setAttribute(a, prev) // keep the mid-reveal frame; the next tick moves on from here
    }
    owned.add(a)
  }
  return owned
}

/**
 * Play the draw-in on every [data-r] node under root, as ONE gsap.ticker listener that only WRITES (no style
 * or layout reads, so it never forces a recalc mid-frame): SVG scales go to the transform attribute around the
 * user-space origin in data-o ("svg:x y"), fades to style.opacity, draws to style.stroke-dashoffset.
 * The first state is written synchronously (no flash). Returns a kill function that lands the final state.
 */
export function playReveal(root: Element): () => void {
  const D = VIZ.drawIn
  const items: RevealItem[] = []
  root.querySelectorAll<HTMLElement | SVGElement>('[data-r]').forEach((el) => {
    const ds = el.dataset
    const kind = ds.r as RevealKind
    const rd = Number(ds.rd ?? 0)
    const o = (ds.o ?? '').replace(/^svg:/, '').split(/[ ,]+/).map(Number)
    let attrs: [string, string, string][] | null = null
    if (kind === 'attr') {
      try {
        const from = JSON.parse(ds.ra ?? '{}') as Record<string, string | number>
        attrs = Object.entries(from).map(([a, f]) => [a, String(f), el.getAttribute(a) ?? String(f)])
      } catch {
        return
      }
    }
    if (kind === 'draw') {
      el.style.strokeDasharray = '1'
    }
    const item: RevealItem = { el, kind, delay: rd * D, dur: Math.max(0.01, Number(ds.rl ?? 1 - rd) * D), ox: o[0] || 0, oy: o[1] || 0, attrs }
    items.push(item)
    if (attrs) liveAttrReveals.set(el, item)
  })
  if (!items.length) return () => {}
  const easeOut = gsap.parseEase('power2.out')
  const easeInOut = gsap.parseEase('power2.inOut')
  const fadeEase = gsap.parseEase('power1.out')
  const write = (it: RevealItem, raw: number) => {
    const done = raw >= 1
    const { el } = it
    switch (it.kind) {
      case 'sy':
      case 'sx':
      case 's': {
        const k = done ? 1 : easeOut(raw)
        const sx = it.kind === 'sy' ? 1 : k
        const sy = it.kind === 'sx' ? 1 : k
        if (el instanceof SVGElement) {
          if (done) el.removeAttribute('transform')
          else el.setAttribute('transform', `matrix(${sx},0,0,${sy},${it.ox - sx * it.ox},${it.oy - sy * it.oy})`)
        } else el.style.transform = done ? '' : `scale(${sx},${sy})`
        break
      }
      case 'draw':
        if (done) {
          el.style.strokeDasharray = ''
          el.style.strokeDashoffset = ''
        } else el.style.strokeDashoffset = String(1 - easeInOut(raw))
        break
      case 'fade':
        el.style.opacity = done ? '' : String(fadeEase(raw))
        break
      case 'attr':
        for (const [a, f, t] of it.attrs ?? []) el.setAttribute(a, done ? t : lerpStr(f, t, easeOut(raw)))
        if (done && liveAttrReveals.get(el) === it) liveAttrReveals.delete(el)
        break
    }
  }
  const t0 = gsap.ticker.time
  let left = items.length
  const state = new Array<boolean>(items.length).fill(false)
  const tick = () => {
    const now = gsap.ticker.time - t0
    for (let i = 0; i < items.length; i++) {
      if (state[i]) continue
      const it = items[i]!
      const raw = Math.max(0, Math.min(1, (now - it.delay) / it.dur))
      write(it, raw)
      if (raw >= 1) {
        state[i] = true
        left--
      }
    }
    if (!left) gsap.ticker.remove(tick)
  }
  tick()
  // appended last: runs after every other ticker listener's layout reads (e.g. reading progress) in a frame
  if (left) gsap.ticker.add(tick)
  return () => {
    gsap.ticker.remove(tick)
    items.forEach((it, i) => {
      if (!state[i]) write(it, 1)
    })
  }
}

/**
 * 0 until the plot is first seen (≥ revealThreshold visible), then 1 — set ONCE, never per frame.
 * Charts render their final geometry from the start (the svg carries dk-viz-pre = opacity 0 until then); in
 * full mode the draw-in runs on the DOM nodes marked with rv() (transform / opacity / stroke-dashoffset).
 * `onPlay` runs at the same moment (e.g. a count-up that writes a text node). static: 1 at once;
 * reduced: 1 when visible, the frame fades via CSS.
 */
export function useReveal(ref: RefObject<Element | null>, onPlay?: (root: Element) => (() => void) | void): number {
  const mode = vizMode()
  const [p, setP] = useState(mode === 'static' ? 1 : 0)
  const playRef = useRef(onPlay)
  playRef.current = onPlay
  useEffect(() => {
    if (mode === 'static') return
    const el = ref.current
    if (!el) return
    let stopReveal: (() => void) | null = null
    let stop: (() => void) | void
    const start = () => {
      if (mode === 'full') {
        stopReveal = playReveal(el)
        stop = playRef.current?.(el)
      }
      setP(1)
    }
    const kill = () => {
      stopReveal?.()
      stop?.()
    }
    if (typeof IntersectionObserver === 'undefined') {
      start()
      return kill
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
      kill()
    }
  }, [ref, mode])
  return p
}

/**
 * The reveal without any React state: the plot root carries data-viz-pre (CSS hides its .dk-viz-fade layers)
 * until it is first seen, then the attribute goes, the draw-in plays on the DOM nodes and onPlay runs.
 * No re-render of the chart at reveal time (a chart render costs tens of ms on a throttled CPU).
 * Returns a ref that is true once revealed (static: true at once).
 */
export function useRevealDom(ref: RefObject<Element | null>, onPlay?: (root: Element) => (() => void) | void): RefObject<boolean> {
  const mode = vizMode()
  const shown = useRef(mode === 'static')
  const playRef = useRef(onPlay)
  playRef.current = onPlay
  useLayoutEffect(() => {
    if (mode === 'static') return
    const el = ref.current
    if (!el) return
    if (!shown.current) el.setAttribute('data-viz-pre', '')
    let stopReveal: (() => void) | null = null
    let stop: (() => void) | void
    const start = () => {
      shown.current = true
      el.removeAttribute('data-viz-pre')
      if (mode === 'full') {
        stopReveal = playReveal(el)
        stop = playRef.current?.(el)
      }
    }
    const kill = () => {
      stopReveal?.()
      stop?.()
    }
    if (shown.current) return
    if (typeof IntersectionObserver === 'undefined') {
      start()
      return kill
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
      kill()
    }
  }, [ref, mode])
  return shown
}

/* ------------------------------------------------------------------ data updates (attribute tweens) */

type AttrSnap = Map<Element, Record<string, string | null>>

const NUM_RE = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi
/** Same skeleton once numbers are masked (path commands, arc flags in place) → safe to interpolate. */
function sameShape(a: string, b: string): boolean {
  return a.replace(NUM_RE, '#') === b.replace(NUM_RE, '#')
}

function readAttrs(root: Element): AttrSnap {
  const m: AttrSnap = new Map()
  root.querySelectorAll('[data-tw]').forEach((el) => {
    const rec: Record<string, string | null> = {}
    for (const a of (el.getAttribute('data-tw') ?? '').split(' ')) if (a) rec[a] = el.getAttribute(a)
    m.set(el, rec)
  })
  return m
}

/**
 * Data-update interpolation without per-frame React renders. Nodes list the attributes that glide in
 * data-tw (e.g. data-tw="x y width height"). When `key` (the data) changes, the values on screen are read in
 * render (attribute reads only, no layout), React commits the final geometry once, and GSAP tweens each
 * attribute from the old to the new value on the node itself (VIZ.update, power2.inOut). Strings with a
 * different structure (path commands, arc flags) and non-full modes jump. `live` = the chart was revealed.
 */
export function useAttrTween(ref: RefObject<Element | null>, key: unknown, live: boolean | RefObject<boolean>): void {
  const mode = vizMode()
  const committed = useRef<unknown>(key)
  const before = useRef<AttrSnap | null>(null)
  const running = useRef(new Map<Element, { tw: gsap.core.Tween; end: Record<string, string> }>())
  // render phase: remember what is on screen right now (mid-tween values included)
  if (mode === 'full' && ref.current && (key !== committed.current || running.current.size)) before.current = readAttrs(ref.current)

  useLayoutEffect(() => {
    const keyChanged = key !== committed.current
    committed.current = key
    const prev = before.current
    before.current = null
    const root = ref.current
    if (!root || !prev || mode !== 'full') return
    root.querySelectorAll('[data-tw]').forEach((el) => {
      const old = prev.get(el)
      const run = running.current.get(el)
      if (!old) return
      // still drawing in: the reveal takes the new value as its end point, the tween leaves those attributes alone
      const owned = retargetReveal(el, old)
      const from: Record<string, string> = {}
      const to: Record<string, string> = {}
      let differs = false
      let rewritten = false
      for (const a of Object.keys(old)) {
        if (owned?.has(a)) continue
        const was = old[a] ?? null
        const dom = el.getAttribute(a)
        if (dom !== was) rewritten = true
        // React only writes attributes whose prop changed; an untouched one may still hold a mid-tween value
        const want = dom !== was ? dom : (run?.end[a] ?? dom)
        if (want === null || was === null) continue
        to[a] = want
        from[a] = was
        if (want !== was) differs = true
      }
      if (!keyChanged) {
        // an unrelated re-render (hover, resize) rewrote a gliding attribute: land on the new values at once
        if (run && rewritten) {
          run.tw.kill()
          running.current.delete(el)
          for (const a of Object.keys(to)) el.setAttribute(a, to[a]!)
        }
        return
      }
      run?.tw.kill()
      running.current.delete(el)
      if (!(typeof live === 'boolean' ? live : live.current) || !differs) {
        for (const a of Object.keys(to)) el.setAttribute(a, to[a]!)
        return
      }
      const f: Record<string, string> = {}
      const t: Record<string, string> = {}
      for (const a of Object.keys(to)) {
        if (from[a] !== to[a] && sameShape(from[a]!, to[a]!)) {
          f[a] = from[a]!
          t[a] = to[a]!
        } else el.setAttribute(a, to[a]!)
      }
      if (!Object.keys(t).length) return
      const tw = gsap.fromTo(el, { attr: f }, { attr: t, duration: VIZ.update, ease: 'power2.inOut', onComplete: () => void running.current.delete(el) })
      running.current.set(el, { tw, end: to })
    })
  })

  useEffect(() => {
    const map = running.current
    return () => {
      map.forEach((r) => r.tw.kill())
      map.clear()
    }
  }, [])
}

/**
 * Count-up / roll for a text node without React re-renders: writes the formatted value into the element's
 * existing text child (React keeps owning that node; the final string equals what React rendered). Driven by a
 * gsap.ticker listener appended after the others, so the write never forces a layout read elsewhere.
 * Returns play(): call it at reveal (useRevealDom onPlay) to count from `from`; later value changes roll from
 * the previous value once revealed.
 */
export function useCountText(ref: RefObject<Element | null>, value: number, fmt: (v: number) => string, shown: RefObject<boolean>, from = 0): () => () => void {
  const mode = vizMode()
  const last = useRef<number | null>(null)
  const fmtRef = useRef(fmt)
  fmtRef.current = fmt
  const valRef = useRef(value)
  valRef.current = value
  /** value on screen right now (mid-roll included) and the roll in flight: a new value takes over from there */
  const onScreen = useRef<number | null>(null)
  const active = useRef<(() => void) | null>(null)
  const run = useCallback(
    (start: number, to: number): (() => void) => {
      const node = ref.current?.firstChild
      last.current = to
      active.current?.() // a value that changes mid-roll (e.g. during the draw-in) retargets, never races
      active.current = null
      onScreen.current = start
      if (mode !== 'full' || start === to || !node || node.nodeType !== 3) {
        onScreen.current = to
        return () => {}
      }
      const ease = gsap.parseEase('power2.out')
      const t0 = gsap.ticker.time
      const tick = () => {
        const k = Math.min(1, (gsap.ticker.time - t0) / VIZ.drawIn)
        const v = start + (to - start) * ease(k)
        onScreen.current = v
        node.nodeValue = fmtRef.current(v)
        if (k >= 1) stopTick()
      }
      const stopTick = () => {
        gsap.ticker.remove(tick)
        if (active.current === stopTick) active.current = null
      }
      tick()
      gsap.ticker.add(tick)
      active.current = stopTick
      return () => {
        if (active.current !== stopTick) return // superseded: the newer roll owns the node
        stopTick()
        onScreen.current = to
        node.nodeValue = fmtRef.current(to)
      }
    },
    [ref, mode],
  )
  useLayoutEffect(() => {
    if (!shown.current || last.current === null) return
    // no cleanup per value: the next value picks the roll up from the number on screen (run() stops the old one)
    run(onScreen.current ?? last.current, value)
  }, [value, run, shown])
  useEffect(() => () => active.current?.(), [])
  return useCallback(() => run(from, valRef.current), [run, from])
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
 * @deprecated kit charts use useAttrTween (no per-frame React render); kept for consumers.
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
