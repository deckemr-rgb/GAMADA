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
}

export function Hotspot({ target, id, label, root }: HotspotProps) {
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

  // follow the target
  useLayoutEffect(() => {
    if (!show || !el) return
    const r = ring.current
    if (!r) return
    let last = ''
    const place = () => {
      if (!el.isConnected) return
      const b = el.getBoundingClientRect()
      const k = `${b.left}|${b.top}|${b.width}|${b.height}`
      if (k === last) return
      last = k
      // the dot sits on the target's top-right corner; hidden while the corner is scrolled out of the root
      const x = b.right - 2
      const y = b.top + 2
      const box = rootRef.current?.()?.getBoundingClientRect()
      const inside = !box || (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom)
      r.style.transform = `translate(${x}px, ${y}px)`
      r.style.visibility = b.width && b.height && inside ? 'visible' : 'hidden'
    }
    place()
    gsap.ticker.add(place)
    return () => gsap.ticker.remove(place)
  }, [show, el])

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
