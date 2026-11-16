/**
 * shell/Hotspot.tsx — the "click here first" ring (spec §6.3): teal 2 px ring pulsing scale 1 → 1.6,
 * opacity .8 → 0 over the target element; disappears for good (this session) once the target is clicked;
 * at most ONE active per screen (first registered wins, the next one shows when it is gone); static ring in
 * reduced motion. Position follows the target on gsap.ticker only while the ring is shown.
 *
 * CoachMark — a small anchored tip with "next" / "close" (multi-step tips: pass step/total).
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { gsap } from 'gsap'
import { Button, IconButton, Portal, enterPanel, motionMode } from '../ui'
import { useDemoStrings } from '../i18n'
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

/* ------------------------------------------------------------------ CoachMark */

export interface CoachMarkProps {
  /** CSS selector of the anchor */
  target: string
  open: boolean
  title: string
  children?: ReactNode
  /** 1-based step and total (shows "2/4" and a Next button) */
  step?: number
  total?: number
  onNext?: () => void
  onClose: () => void
  side?: 'top' | 'bottom'
}

export function CoachMark({ target, open, title, children, step, total, onNext, onClose, side = 'bottom' }: CoachMarkProps) {
  const t = useDemoStrings()
  const ids = useId()
  const pop = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{
    top: number
    left: number
    side: 'top' | 'bottom'
    arrow: number
  } | null>(null)

  useLayoutEffect(() => {
    if (!open) return
    const measure = () => {
      const a = document.querySelector(target)
      const p = pop.current
      if (!a || !p) return
      const r = a.getBoundingClientRect()
      const pr = p.getBoundingClientRect()
      const vw = window.innerWidth
      let s = side
      if (s === 'bottom' && r.bottom + pr.height + 12 > window.innerHeight && r.top - pr.height - 12 > 0) s = 'top'
      if (s === 'top' && r.top - pr.height - 12 < 0) s = 'bottom'
      const top = s === 'bottom' ? r.bottom + 12 : r.top - pr.height - 12
      const left = Math.max(8, Math.min(vw - pr.width - 8, r.left + r.width / 2 - pr.width / 2))
      const arrow = Math.max(14, Math.min(pr.width - 14, r.left + r.width / 2 - left))
      setPos((cur) => (cur && cur.top === top && cur.left === left && cur.side === s && cur.arrow === arrow ? cur : { top, left, side: s, arrow }))
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, {
      passive: true,
      capture: true,
    })
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, { capture: true })
    }
  }, [open, target, side, step])

  useLayoutEffect(() => {
    if (!open || !pop.current) return
    const tw = enterPanel(pop.current, { y: 6 }, 0.2)
    return () => {
      tw?.kill()
    }
  }, [open, step])

  if (!open) return null
  const last = !total || !step || step >= total
  return (
    <Portal>
      <div
        ref={pop}
        role="dialog"
        aria-labelledby={`${ids}-t`}
        className={`dk-coach is-${pos?.side ?? side}`}
        style={
          pos
            ? {
                top: pos.top,
                left: pos.left,
                ['--dk-coach-arrow' as string]: `${pos.arrow}px`,
              }
            : { visibility: 'hidden', top: 0, left: 0 }
        }
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            onClose()
          }
        }}
      >
        <div className="dk-coach-head">
          <p id={`${ids}-t`} className="dk-coach-title">
            {title}
          </p>
          <IconButton icon="close" size="sm" label={t.coachClose} onClick={onClose} />
        </div>
        {children && <div className="dk-coach-body">{children}</div>}
        <div className="dk-coach-foot">
          {step && total ? <span className="dk-coach-step dk-num">{t.coachStep(step, total)}</span> : <span />}
          <Button size="sm" variant="primary" onClick={last ? onClose : onNext} autoFocus>
            {last ? t.coachDone : t.coachNext}
          </Button>
        </div>
      </div>
    </Portal>
  )
}
