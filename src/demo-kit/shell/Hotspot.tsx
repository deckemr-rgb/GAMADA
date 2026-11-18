/**
 * shell/Hotspot.tsx — the "click here first" ring (spec §6.3): teal 2 px ring pulsing scale 1 → 1.6,
 * opacity .8 → 0 just OUTSIDE the target's top-right corner (it never covers the target's text); disappears for
 * good (this session) once the target is clicked or `dismissHotspot(id)` is called; at most ONE active per screen
 * (first registered wins, the next one shows when it is gone); static ring in reduced motion.
 *
 * Cost: the target is measured only when something can have moved it — a ResizeObserver on the target and the
 * root, capture-phase scroll / window resize — plus a slow poll (POLL_MS) for layout shifts no event reports and
 * for coverage (a sheet opening over the target). No getBoundingClientRect on every frame.
 * The ring hides while the target is disconnected or no longer matches `target` (it is re-queried: persona
 * remounts, a data-hotspot attribute that moved), has an empty box, is
 * clipped by a scroller / outside the root, or is covered.
 *
 * Loaded lazily by DemoShell (only demos that pass `hotspot` fetch it).
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { gsap } from 'gsap'
import { Portal, motionMode } from '../ui'
import { dismissHotspot, isHotspotDismissed, onHotspotDismiss } from './hotspot-store'

/* ------------------------------------------------------------------ registry: max one active */
const active: string[] = []
const subs = new Set<() => void>()
const emitReg = () => subs.forEach((fn) => fn())
const firstActive = () => active[0] ?? null

/** re-measure at least this often while nothing reported a change (layout shifts, coverage, a lost target) */
const POLL_MS = 250
/** the ring's centre sits this far outside the target's top-right corner on both axes (ring radius 11 px): the
 *  ring keeps a gap from the corner and never sits on the target (a CTA's text or its rounded edge) */
const RING_OUT = 12
/** the ring's centre keeps this far from the canvas / viewport edge: the pulse (radius 11 × 1.6 ≈ 18 px) is never
 *  clipped at 360–390 px */
const RING_EDGE = 19
/** gap between the ring and the target's top edge when the ring moves above a target that spans to the edge */
const RING_GAP = 8

export interface HotspotProps {
  /** CSS selector of the element to ring (first match inside `root`, else the document) */
  target: string
  /** stable id (dismissal is remembered per browser tab session; `dismissHotspot(id)` retires it) */
  id?: string
  /** optional short visible hint (e.g. t.hotspotHint "Mulai di sini"); the dot alone by default. A target may carry its
   *  own text in `data-hotspot-label` (e.g. "Lanjut: susun klarifikasi" after the first step), which wins. */
  label?: string
  /** search root for the selector */
  root?: () => Element | null
  /**
   * where the label hangs: 'below' = under the target's bottom edge, 'above' = above the ring (over the target's
   * top-right corner), 'auto' (default) = below when there is room in the viewport, else above. The label never
   * covers the target itself and is clamped inside the viewport (flipping when the chosen side has no room).
   */
  placement?: 'auto' | 'below' | 'above'
}

/** true when the point is painted by `el` (or a descendant): not clipped by a scroller and not covered by a sheet */
function visibleAt(el: Element, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return false
  const hit = document.elementFromPoint(x, y)
  if (!hit) return false
  // our own ring never takes hits (pointer-events: none)
  return el === hit || el.contains(hit) || hit.contains(el)
}

export function Hotspot({ target, id, label, root, placement = 'auto' }: HotspotProps) {
  const auto = useId()
  const key = id ?? `${auto}:${target}`
  const [gone, setGone] = useState(() => isHotspotDismissed(key))
  const first = useSyncExternalStore(
    (fn) => {
      subs.add(fn)
      return () => subs.delete(fn)
    },
    firstActive,
    () => null,
  )
  const ring = useRef<HTMLDivElement>(null)
  const [el, setEl] = useState<Element | null>(null)
  /** the element currently ringed (re-queried after a remount; the click test uses it) */
  const curRef = useRef<Element | null>(null)
  const rootRef = useRef(root)
  rootRef.current = root

  // register while not dismissed
  useEffect(() => {
    if (gone) return
    active.push(key)
    emitReg()
    return () => {
      const i = active.indexOf(key)
      if (i >= 0) active.splice(i, 1)
      emitReg()
    }
  }, [key, gone])

  // dismissHotspot(id) from a product
  useEffect(() => (gone ? undefined : onHotspotDismiss(key, () => setGone(true))), [key, gone])

  // find the target (it may mount after us)
  useEffect(() => {
    if (gone) return
    let tries = 0
    let call: gsap.core.Tween | null = null
    const find = () => {
      const scope = rootRef.current?.() ?? document
      const found = scope.querySelector(target)
      if (found) setEl(found)
      else if (++tries < 40) call = gsap.delayedCall(0.25, find)
    }
    find()
    return () => {
      call?.kill()
    }
  }, [target, gone])

  // dismiss when the target (as it is now, after any remount) is clicked
  useEffect(() => {
    if (!el || gone) return
    const onDown = (e: Event) => {
      const t = e.target as Node
      const cur = curRef.current
      if ((cur?.isConnected && cur.contains(t)) || el.contains(t)) dismissHotspot(key)
    }
    document.addEventListener('click', onDown, true)
    return () => document.removeEventListener('click', onDown, true)
  }, [el, gone, key])

  const show = !gone && !!el && first === key

  // follow the target: measured only when something can have moved it (see the header)
  useLayoutEffect(() => {
    if (!show || !el) return
    const r = ring.current
    if (!r) return
    const lab = r.querySelector<HTMLElement>('.dk-hotspot-label')
    let cur: Element = el
    curRef.current = el
    let dirty = true
    let lastAt = -Infinity
    let lastKey = ''
    const mark = () => {
      dirty = true
    }
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(mark) : null
    ro?.observe(cur)
    const rootEl = rootRef.current?.()
    if (rootEl) ro?.observe(rootEl)
    window.addEventListener('scroll', mark, { capture: true, passive: true })
    window.addEventListener('resize', mark)
    const hide = () => {
      r.style.visibility = 'hidden'
      lastKey = ''
    }
    const place = () => {
      const now = performance.now()
      if (!dirty && now - lastAt < POLL_MS) return
      dirty = false
      lastAt = now
      // remounted, or no longer the target (its data-hotspot moved to another element): look it up again
      if (!cur.isConnected || !cur.matches(target)) {
        const scope = rootRef.current?.() ?? document
        const again = scope.querySelector(target)
        if (!again) return hide()
        ro?.unobserve(cur)
        cur = again
        curRef.current = again
        ro?.observe(cur)
      }
      const b = cur.getBoundingClientRect()
      if (!b.width || !b.height) return hide()
      // visibility is tested at a point just inside the target's corner (the ring itself sits outside it)
      const px = Math.max(0, b.right - 6)
      const py = Math.max(0, b.top + 6)
      const box = rootRef.current?.()?.getBoundingClientRect()
      const inside = !box || (px >= box.left && px <= box.right && py >= box.top && py <= box.bottom)
      if (!inside || !visibleAt(cur, px, py)) return hide()
      // the ring (radius 11, pulse up to ×1.6) stays inside the canvas and the viewport: a target at the right or top
      // edge gets its ring just inside its corner instead of a clipped half ring
      const edgeR = Math.min(window.innerWidth, box ? box.right : Infinity) - RING_EDGE
      const edgeT = Math.max(0, box ? box.top : 0) + RING_EDGE
      const x = Math.min(b.right + RING_OUT, edgeR)
      // a target that reaches the right edge (a full-width CTA on a phone): the ring moves ABOVE it, clear of its
      // top edge, instead of sitting on its corner; only without room above does it fall back to the corner
      const clampedX = b.right + RING_OUT > edgeR
      const above = b.top - 11 - RING_GAP
      const y = clampedX ? (above >= edgeT ? above : Math.max(b.top + 11 + 4, edgeT)) : Math.max(b.top - RING_OUT, edgeT)
      const own = cur.getAttribute('data-hotspot-label')
      const text = own ?? label ?? ''
      if (lab && lab.textContent !== text) {
        lab.textContent = text
        lab.hidden = !text
        lastKey = ''
      }
      const k = `${x}|${y}|${b.bottom}|${window.innerWidth}|${window.innerHeight}`
      r.style.visibility = 'visible'
      if (k === lastKey) return
      lastKey = k
      r.style.transform = `translate(${x}px, ${y}px)`
      if (!lab) return
      const lw = lab.offsetWidth
      const lh = lab.offsetHeight
      const vh = window.innerHeight
      const belowTop = b.bottom + 6
      const aboveTop = y - lh - 16
      const fitsBelow = belowTop + lh <= vh - 8
      const fitsAbove = aboveTop >= 8
      const below = placement === 'below' ? fitsBelow || !fitsAbove : placement === 'above' ? !fitsAbove && fitsBelow : fitsBelow || !fitsAbove
      // vertical: under the target's bottom edge, or above the ring — never over the target
      const top = (below ? belowTop : aboveTop) - y
      // horizontal: right-aligned to the ring, clamped inside the viewport (8 px margin)
      let left = 6 - lw
      if (x + left < 8) left = 8 - x
      if (x + left + lw > window.innerWidth - 8) left = window.innerWidth - 8 - lw - x
      lab.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`
    }
    place()
    gsap.ticker.add(place)
    return () => {
      gsap.ticker.remove(place)
      ro?.disconnect()
      window.removeEventListener('scroll', mark, { capture: true })
      window.removeEventListener('resize', mark)
    }
  }, [show, el, placement, target, label])

  if (!show) return null
  const still = motionMode() !== 'full'
  return (
    <Portal className="dk-hotspot-host">
      <div ref={ring} className={`dk-hotspot${still ? ' is-still' : ''}`} aria-hidden="true" style={{ visibility: 'hidden' }}>
        {!still && <span className="dk-hotspot-pulse" />}
        <span className="dk-hotspot-ring" />
        {/* text set while placing: the target's data-hotspot-label, else `label` */}
        <span className="dk-hotspot-label" hidden />
      </div>
    </Portal>
  )
}

// CoachMark lives in ./CoachMark.tsx (import it from there).
