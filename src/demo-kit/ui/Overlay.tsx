/**
 * Overlays: Portal (a .dk-root container on <body> that inherits the caller's data-eco), Modal and Drawer.
 * Modal / Drawer: focus moves in (first focusable, or [data-autofocus]), Tab is trapped, Esc closes only the
 * top-most overlay, focus returns to the opener, everything else on the page is `inert`, Lenis is paused.
 * Motion: scrim fade + panel rise / slide (320 ms); fades only in reduced motion; nothing in static mode.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { getLenis } from '../../lib/smoothScroll'
import { IconButton } from './Button'
import { enterPanel, exitPanel } from './motion'
import { useUiStrings } from './strings'
import './tokens.css'
import './ui.css'

/* ------------------------------------------------------------------ Portal */

/** Renders children into a body-level `.dk-root` div that copies data-eco from the nearest ancestor of `anchor`. */
export function Portal({ children, anchor, className }: { children: ReactNode; anchor?: RefObject<Element | null>; className?: string }) {
  // created during the first render so the portal content mounts in the same commit (focus works in effects)
  const [host] = useState<HTMLDivElement | null>(() => (typeof document === 'undefined' ? null : document.createElement('div')))
  const ownAnchor = useRef<HTMLSpanElement>(null)
  const alive = useRef(false)
  useLayoutEffect(() => {
    if (!host) return
    alive.current = true
    if (!host.isConnected) document.body.appendChild(host)
    return () => {
      // deferred: a StrictMode / dependency re-run must not detach the host (that would blur focus inside it)
      alive.current = false
      queueMicrotask(() => {
        if (!alive.current) host.remove()
      })
    }
  }, [host])
  useLayoutEffect(() => {
    if (!host) return
    host.className = `dk-root dk-portal${className ? ` ${className}` : ''}`
    const a = anchor?.current ?? ownAnchor.current
    const eco = a?.closest('[data-eco]')?.getAttribute('data-eco')
    if (eco) host.setAttribute('data-eco', eco)
    else host.removeAttribute('data-eco')
  })
  return (
    <>
      <span ref={ownAnchor} hidden />
      {host && createPortal(children, host)}
    </>
  )
}

/* ------------------------------------------------------------------ overlay stack (Esc + inert) */

interface Layer {
  id: string
  host: () => HTMLElement | null
  close: () => void
}
const stack: Layer[] = []
const savedInert = new Map<Element, boolean>()

/* how many Modals / Drawers are open (the toast stack keeps clear of them on phones) */
const ovSubs = new Set<() => void>()
const emitOverlays = () => ovSubs.forEach((fn) => fn())
export function subscribeOverlays(fn: () => void): () => void {
  ovSubs.add(fn)
  return () => {
    ovSubs.delete(fn)
  }
}
export const overlayOpen = (): boolean => stack.length > 0

/* Closing: the inert restore is batched into the next frame, so closing (or swapping) overlays inside a click never
   forces a style recalculation of the whole page there and then (INP). applyInert() reads the stack as it is then. */
let inertRaf = 0
function scheduleInert() {
  if (inertRaf) return
  inertRaf = requestAnimationFrame(() => {
    inertRaf = 0
    applyInert()
  })
}

function applyInert() {
  const top = stack[stack.length - 1]
  const topHost = top?.host()?.closest('.dk-portal') ?? null
  for (const child of Array.from(document.body.children)) {
    if (!(child instanceof HTMLElement)) continue
    if (top && child !== topHost && !child.classList.contains('dk-toast-host')) {
      if (!savedInert.has(child)) savedInert.set(child, child.inert)
      child.inert = true
    } else if (savedInert.has(child)) {
      child.inert = savedInert.get(child) ?? false
      savedInert.delete(child)
    }
  }
  if (!top) {
    savedInert.forEach((v, el) => {
      ;(el as HTMLElement).inert = v
    })
    savedInert.clear()
  }
}

function onDocKey(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  const top = stack[stack.length - 1]
  if (!top) return
  e.stopPropagation()
  top.close()
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Shared behaviour of Modal and Drawer. */
/** where focus returns on close when it is not the opener (e.g. the opener unmounts on close) */
export type ReturnFocus = RefObject<HTMLElement | null> | (() => HTMLElement | null | undefined)

function useOverlay(open: boolean, onClose: () => void, panel: RefObject<HTMLElement | null>, returnFocus?: ReturnFocus) {
  const id = useId()
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    stack.push({ id, host: () => panel.current, close: () => closeRef.current() })
    if (stack.length === 1) document.addEventListener('keydown', onDocKey, true)
    applyInert()
    // lenis.stop() reads the scroll position (a forced layout): run it after the open paint, not inside the
    // interaction (INP). html overflow:hidden below already blocks native scrolling in the meantime.
    const lenis = getLenis()
    let stopped = false
    let tm = 0
    const raf = lenis
      ? requestAnimationFrame(() => {
          tm = window.setTimeout(() => {
            stopped = true
            lenis.stop()
          }, 0)
        })
      : 0
    const html = document.documentElement
    const prevOverflow = html.style.overflow
    html.style.overflow = 'hidden'
    const p = panel.current
    const first = p?.querySelector<HTMLElement>('[data-autofocus]') ?? p?.querySelector<HTMLElement>(FOCUSABLE) ?? p
    first?.focus({ preventScroll: true })
    emitOverlays()
    // where focus goes back if the opener unmounts meanwhile: its nearest ancestor still on the page
    const chain: HTMLElement[] = []
    for (let a = opener?.parentElement ?? null; a && a !== document.body && a !== html; a = a.parentElement) chain.push(a)
    return () => {
      const i = stack.findIndex((l) => l.id === id)
      if (i >= 0) stack.splice(i, 1)
      if (!stack.length) document.removeEventListener('keydown', onDocKey, true)
      emitOverlays()
      cancelAnimationFrame(raf)
      clearTimeout(tm)
      if (!stack.length) html.style.overflow = prevOverflow
      const last = !stack.length
      // inert restore, Lenis restart and the focus return run in the next frame, not inside the closing click (INP)
      scheduleInert()
      requestAnimationFrame(() => {
        if (last && stopped && !stack.length) lenis?.start()
        const act = document.activeElement
        // focus moved on by itself (another overlay opened, the product focused something): leave it there
        if (act && act !== document.body && !(p?.contains(act) ?? false)) return
        const explicit = typeof returnFocus === 'function' ? returnFocus() : returnFocus?.current
        const back =
          (explicit?.isConnected ? explicit : null) ??
          (opener?.isConnected ? opener : null) ??
          (() => {
            const anc = chain.find((a) => a.isConnected)
            if (!anc) return null
            return anc.matches(FOCUSABLE) ? anc : anc.querySelector<HTMLElement>(FOCUSABLE)
          })()
        back?.focus({ preventScroll: true })
      })
    }
  }, [open, id, panel])

  /* Tab trap */
  const onKeyDown = (e: ReactKeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Tab') return
    const p = panel.current
    if (!p) return
    const els = Array.from(p.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement)
    if (!els.length) {
      e.preventDefault()
      return
    }
    const first = els[0]
    const last = els[els.length - 1]
    if (e.shiftKey && (document.activeElement === first || document.activeElement === p)) {
      e.preventDefault()
      last?.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first?.focus()
    }
  }
  return onKeyDown
}

/** Keeps an overlay mounted while its exit animation runs. */
function usePresence(open: boolean, scrim: RefObject<HTMLElement | null>, panel: RefObject<HTMLElement | null>, from: { x?: number; y?: number }) {
  const [mounted, setMounted] = useState(open)
  useEffect(() => {
    if (open) setMounted(true)
    else if (mounted) {
      const p = panel.current
      const s = scrim.current
      Promise.all([p ? exitPanel(p, from) : Promise.resolve(), s ? exitPanel(s, {}) : Promise.resolve()]).then(() => setMounted(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  useLayoutEffect(() => {
    if (!open || !mounted) return
    const tws = [scrim.current && enterPanel(scrim.current, {}), panel.current && enterPanel(panel.current, from)]
    return () => {
      for (const t of tws) t?.kill()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mounted])
  return mounted
}

/* ------------------------------------------------------------------ Modal */

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children?: ReactNode
  /** action buttons (right aligned) */
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** close when the scrim is clicked (default true) */
  dismissable?: boolean
  /** focus target on close when not the opener (default: the opener, else its nearest ancestor still on the page) */
  returnFocus?: ReturnFocus
}

export function Modal({ open, onClose, title, description, children, footer, size = 'md', dismissable = true, returnFocus }: ModalProps) {
  const t = useUiStrings()
  const scrim = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const ids = useId()
  const mounted = usePresence(open, scrim, panel, { y: 12 })
  const onKeyDown = useOverlay(open && mounted, onClose, panel, returnFocus)
  if (!mounted) return null
  return (
    <Portal>
      <div className="dk-ov">
        <div ref={scrim} className="dk-ov-scrim" aria-hidden="true" onClick={dismissable ? onClose : undefined} />
        <div ref={panel} className={`dk-modal dk-modal--${size}`} role="dialog" aria-modal="true" aria-labelledby={`${ids}-t`} aria-describedby={description ? `${ids}-d` : undefined} tabIndex={-1} onKeyDown={onKeyDown}>
          <header className="dk-ov-head">
            <div>
              <h2 id={`${ids}-t`} className="dk-ov-title">
                {title}
              </h2>
              {description && (
                <p id={`${ids}-d`} className="dk-ov-desc">
                  {description}
                </p>
              )}
            </div>
            <IconButton icon="close" label={t.close} onClick={onClose} variant="ghost" />
          </header>
          {children && <div className="dk-ov-body">{children}</div>}
          {footer && <footer className="dk-ov-foot">{footer}</footer>}
        </div>
      </div>
    </Portal>
  )
}

/* ------------------------------------------------------------------ Drawer */

export interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  /** small line above the title (id, breadcrumb) */
  eyebrow?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  /** px, default 420 (full width below 480 px) */
  width?: number
  /** extra class on the overlay root (.dk-ov), for product-scoped styling */
  className?: string
  /**
   * 'dim' (default) darkens the page behind; 'none' keeps the page undimmed (side-by-side demos) while the drawer
   * stays modal (a click outside still closes it).
   */
  scrim?: 'dim' | 'none'
  /** focus target on close when not the opener (default: the opener, else its nearest ancestor still on the page) */
  returnFocus?: ReturnFocus
}

export function Drawer({ open, onClose, title, eyebrow, children, footer, width = 420, className, scrim: scrimMode = 'dim', returnFocus }: DrawerProps) {
  const t = useUiStrings()
  const scrim = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const ids = useId()
  const mounted = usePresence(open, scrim, panel, { x: 24 })
  const onKeyDown = useOverlay(open && mounted, onClose, panel, returnFocus)
  if (!mounted) return null
  return (
    <Portal>
      <div className={`dk-ov dk-ov--drawer${scrimMode === 'none' ? ' dk-ov--clear' : ''}${className ? ` ${className}` : ''}`}>
        <div ref={scrim} className="dk-ov-scrim" aria-hidden="true" onClick={onClose} />
        <div ref={panel} className="dk-drawer" style={{ width: `min(${width}px, 100vw)` }} role="dialog" aria-modal="true" aria-labelledby={`${ids}-t`} tabIndex={-1} onKeyDown={onKeyDown}>
          <header className="dk-ov-head">
            <div>
              {eyebrow && <p className="dk-ov-eyebrow">{eyebrow}</p>}
              <h2 id={`${ids}-t`} className="dk-ov-title">
                {title}
              </h2>
            </div>
            <IconButton icon="close" label={t.close} onClick={onClose} variant="ghost" />
          </header>
          <div className="dk-ov-body dk-drawer-body">{children}</div>
          {footer && <footer className="dk-ov-foot">{footer}</footer>}
        </div>
      </div>
    </Portal>
  )
}
