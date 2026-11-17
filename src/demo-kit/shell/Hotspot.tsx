/**
 * shell/Hotspot.tsx — the "click here first" ring (spec §6.3): teal 2 px ring pulsing scale 1 → 1.6,
 * opacity .8 → 0 over the target element; disappears for good (this session) once the target is clicked;
 * at most ONE active per screen (first registered wins, the next one shows when it is gone); static ring in
 * reduced motion. Position follows the target on gsap.ticker only while the ring is shown.
 *
 * Loaded lazily by DemoShell (only demos that pass `hotspot` fetch it).
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { gsap } from 'gsap'
import { Portal, motionMode } from '../ui'
import { SHELL } from './constants'

/* ------------------------------------------------------------------ registry: max one active */
const active: string[] = []
const subs = new Set<() => void>()
const emitReg = () => subs.forEach((fn) => fn())
const firstActive = () => active[0] ?? null

const dismissedKey = (id: string) => `${SHELL.storage}hotspot:${id}`
function isDismissed(id: string): boolean {
  try {
    return window.sessionStorage.getItem(dismissedKey(id)) === '1'
  } catch {
    return false
  }
}
function setDismissed(id: string) {
  try {
    window.sessionStorage.setItem(dismissedKey(id), '1')
  } catch {
    /* ignore */
  }
}

export interface HotspotProps {
  /** CSS selector of the element to ring (first match inside `root`, else the document) */
  target: string
  /** stable id (dismissal is remembered per browser tab session) */
  id?: string
  /** optional short visible hint under the dot (e.g. t.hotspotHint "Mulai dari sini"); the dot alone by default */
  label?: string
  /** search root for the selector */
  root?: () => Element | null
  /**
   * where the label hangs: 'below' = under the target's bottom edge, 'above' = above the dot (the target's
   * top-right corner), 'auto' (default) = below when there is room in the viewport, else above. The label never
   * covers the target itself and is clamped inside the viewport.
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
  const [gone, setGone] = useState(() => isDismissed(key))
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

  // dismiss when the target is clicked
  useEffect(() => {
    if (!el || gone) return
    const onDown = (e: Event) => {
      if (el.contains(e.target as Node)) {
        setDismissed(key)
        setGone(true)
      }
    }
    document.addEventListener('click', onDown, true)
    return () => document.removeEventListener('click', onDown, true)
  }, [el, gone, key])

  const show = !gone && !!el && first === key

  // follow the target (re-queried when it remounts, e.g. a persona switch)
  useLayoutEffect(() => {
    if (!show || !el) return
    const r = ring.current
    if (!r) return
    const lab = r.querySelector<HTMLElement>('.dk-hotspot-label')
    let cur: Element = el
    let last = ''
    let tick = 0
    let seen = true
    const place = () => {
      if (!cur.isConnected) {
        const scope = rootRef.current?.() ?? document
        const again = scope.querySelector(target)
        if (!again) {
          r.style.visibility = 'hidden'
          return
        }
        cur = again
        last = ''
      }
      const b = cur.getBoundingClientRect()
      const k = `${b.left}|${b.top}|${b.width}|${b.height}`
      // geometry unchanged: only re-check coverage (a sheet opening over the target) about 4× a second
      if (k === last && ++tick % 15 !== 0) return
      last = k
      // the dot sits on the target's top-right corner; hidden while that corner is clipped or covered
      const x = b.right - 2
      const y = b.top + 2
      const box = rootRef.current?.()?.getBoundingClientRect()
      const inside = !box || (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom)
      seen = !!b.width && !!b.height && inside && visibleAt(cur, Math.max(0, b.right - 6), Math.max(0, b.top + 6))
      r.style.transform = `translate(${x}px, ${y}px)`
      r.style.visibility = seen ? 'visible' : 'hidden'
      if (!lab || !seen) return
      const lw = lab.offsetWidth
      const lh = lab.offsetHeight
      const roomBelow = window.innerHeight - b.bottom
      const below = placement === 'below' || (placement === 'auto' && roomBelow > lh + 16)
      // vertical: under the target's bottom edge, or above the dot
      const top = below ? b.bottom - y + 6 : -(lh + 16)
      // horizontal: right-aligned to the dot, clamped inside the viewport (8 px margin)
      let left = 6 - lw
      if (x + left < 8) left = 8 - x
      if (x + left + lw > window.innerWidth - 8) left = window.innerWidth - 8 - lw - x
      lab.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`
    }
    place()
    gsap.ticker.add(place)
    return () => gsap.ticker.remove(place)
  }, [show, el, placement, target])

  if (!show) return null
  const still = motionMode() !== 'full'
  return (
    <Portal className="dk-hotspot-host">
      <div ref={ring} className={`dk-hotspot${still ? ' is-still' : ''}`} aria-hidden="true">
        {!still && <span className="dk-hotspot-pulse" />}
        <span className="dk-hotspot-ring" />
        {label && <span className="dk-hotspot-label">{label}</span>}
      </div>
    </Portal>
  )
}

// CoachMark lives in ./CoachMark.tsx (import it from there).
