/**
 * Toast primitive + ToastRegion + useToastQueue. The cross-product EventToast stack (max 3, bottom-left,
 * click → jump to product) is built by the shell on top of these.
 *
 * WCAG 2.2.1 (timing adjustable): every queue's auto-dismiss timers PAUSE while the pointer is over a toast
 * region or focus is inside it, and resume (with at least TOAST_RESUME_MIN s left) when both leave. When a
 * toast that holds focus goes away (timer, ✕, or pushed out), focus moves to the next toast, else the
 * previous one, else back to the element that had focus before the region was entered.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { gsap } from 'gsap'
import { DEMO } from '../../lib/motion'
import { Icon, type IconName } from './icons'
import { enterPanel } from './motion'
import { Portal } from './Overlay'
import { useUiStrings } from './strings'
import './tokens.css'
import './ui.css'

export type ToastTone = 'neutral' | 'accent' | 'warn' | 'danger'

export interface ToastData {
  id: string
  title: string
  body?: string
  tone?: ToastTone
  icon?: IconName
  /** the whole toast becomes a button (e.g. "jump to Meja Pimpinan ↗") */
  onActivate?: () => void
  /** a secondary text action */
  action?: { label: string; onClick: () => void }
}

const TONE_ICON: Record<ToastTone, IconName> = { neutral: 'info', accent: 'checkCircle', warn: 'alert', danger: 'alert' }

/** Seconds a paused toast keeps at least after the pointer / focus leaves. */
const TOAST_RESUME_MIN = 2

/* region ↔ queue link without wiring props through the shell: regions pause every live queue */
interface QueueCtl {
  pause: () => void
  resume: () => void
}
const queues = new Set<QueueCtl>()
let pausedBy = 0
/** element that had focus before focus entered a toast region (where it goes back to) */
let returnFocus: HTMLElement | null = null

function setRegionHold(on: boolean) {
  const was = pausedBy > 0
  pausedBy = Math.max(0, pausedBy + (on ? 1 : -1))
  const now = pausedBy > 0
  if (was !== now) queues.forEach((q) => (now ? q.pause() : q.resume()))
}

function focusable(el: Element | null): HTMLElement | null {
  return el?.querySelector<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])') ?? null
}

export function Toast({ data, onDismiss }: { data: ToastData; onDismiss?: (id: string) => void }) {
  const t = useUiStrings()
  const ref = useRef<HTMLDivElement>(null)
  const tone = data.tone ?? 'neutral'
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const tw = enterPanel(el, { y: 12 })
    return () => {
      tw?.kill()
      // leaving while focused: hand focus on before the node is removed (otherwise it drops to <body>)
      if (!el.contains(document.activeElement)) return
      const sib = (n: Element | null, dir: 'next' | 'prev'): Element | null => {
        let c = n && (dir === 'next' ? n.nextElementSibling : n.previousElementSibling)
        while (c && !c.classList.contains('dk-toast')) c = dir === 'next' ? c.nextElementSibling : c.previousElementSibling
        return c
      }
      const target = focusable(sib(el, 'next')) ?? focusable(sib(el, 'prev')) ?? (returnFocus?.isConnected ? returnFocus : null)
      target?.focus({ preventScroll: true })
    }
  }, [])
  const main = (
    <>
      <span className="dk-toast-ic" aria-hidden="true">
        <Icon name={data.icon ?? TONE_ICON[tone]} size={16} />
      </span>
      <span className="dk-toast-text">
        <span className="dk-toast-title">{data.title}</span>
        {data.body && <span className="dk-toast-body">{data.body}</span>}
      </span>
      {data.onActivate && <Icon name="arrowUpRight" size={16} className="dk-toast-go" />}
    </>
  )
  return (
    <div ref={ref} className={`dk-toast dk-toast--${tone}`}>
      {data.onActivate ? (
        <button type="button" className="dk-toast-main" onClick={data.onActivate}>
          {main}
        </button>
      ) : (
        <div className="dk-toast-main">{main}</div>
      )}
      {data.action && (
        <button type="button" className="dk-toast-act" onClick={data.action.onClick}>
          {data.action.label}
        </button>
      )}
      {onDismiss && (
        <button type="button" className="dk-toast-x" aria-label={t.dismiss} onClick={() => onDismiss(data.id)}>
          <Icon name="close" size={14} />
        </button>
      )}
    </div>
  )
}

/** Fixed stack (body-level portal). Newest at the bottom, nearest the corner. */
export function ToastRegion({ children, placement = 'bottom-left', label }: { children: ReactNode; placement?: 'bottom-left' | 'bottom-right' | 'top-right'; label?: string }) {
  const t = useUiStrings()
  const hover = useRef(false)
  const focus = useRef(false)
  const held = useRef(false)
  const secRef = useRef<HTMLElement>(null)
  const sync = useCallback(() => {
    const on = hover.current || focus.current
    if (on !== held.current) {
      held.current = on
      setRegionHold(on)
    }
  }, [])
  useEffect(
    () => () => {
      if (held.current) setRegionHold(false)
      held.current = false
    },
    [],
  )
  // A toast removed while it holds focus (or sits under the pointer) fires no blur / pointerleave on the region:
  // the node is gone, or the focus hand-off runs inside React's commit, where onBlur is not dispatched.
  // After every commit of this region, re-derive both flags from the DOM so the hold can never stick.
  useLayoutEffect(() => {
    const el = secRef.current
    if (!el || !held.current) return
    if (focus.current && !el.contains(document.activeElement)) focus.current = false
    if (hover.current && !el.querySelector('.dk-toast')) hover.current = false
    sync()
  })
  // and focus landing outside the region by any other route (programmatic focus, a removed node) releases it
  useEffect(() => {
    const onIn = (e: FocusEvent) => {
      const el = secRef.current
      if (!el || !focus.current || el.contains(e.target as Node)) return
      focus.current = false
      sync()
    }
    document.addEventListener('focusin', onIn)
    return () => document.removeEventListener('focusin', onIn)
  }, [sync])
  return (
    <Portal className="dk-toast-host">
      <section
        ref={secRef}
        className={`dk-toasts dk-toasts--${placement}`}
        aria-label={label ?? t.notifications}
        aria-live="polite"
        aria-relevant="additions"
        onPointerEnter={() => {
          hover.current = true
          sync()
        }}
        onPointerLeave={() => {
          hover.current = false
          sync()
        }}
        onFocus={(e) => {
          const from = e.relatedTarget as HTMLElement | null
          if (from && !e.currentTarget.contains(from)) returnFocus = from
          focus.current = true
          sync()
        }}
        onBlur={(e) => {
          const to = e.relatedTarget as Node | null
          if (to && e.currentTarget.contains(to)) return
          focus.current = false
          sync()
        }}
      >
        {children}
      </section>
    </Portal>
  )
}

/** Small queue: at most `max` toasts (oldest dropped), each auto-dismissed after `ttlMs` (gsap timer → pauses with the tab). */
export function useToastQueue(max: number = DEMO.toastMax, ttlMs: number = DEMO.toastMs) {
  const [toasts, setToasts] = useState<ToastData[]>([])
  const timers = useRef(new Map<string, gsap.core.Tween>())
  const seq = useRef(0)
  const dismissRef = useRef<(id: string) => void>(() => {})
  const dismiss = useCallback((id: string) => {
    timers.current.get(id)?.kill()
    timers.current.delete(id)
    setToasts((ts) => ts.filter((x) => x.id !== id))
  }, [])
  dismissRef.current = dismiss
  const push = useCallback(
    (data: Omit<ToastData, 'id'> & { id?: string }) => {
      const id = data.id ?? `toast-${++seq.current}`
      setToasts((ts) => {
        const next = [...ts.filter((x) => x.id !== id), { ...data, id }]
        for (const old of next.slice(0, Math.max(0, next.length - max))) {
          timers.current.get(old.id)?.kill()
          timers.current.delete(old.id)
        }
        return next.slice(-max)
      })
      timers.current.get(id)?.kill()
      const tw = gsap.delayedCall(ttlMs / 1000, () => dismiss(id))
      if (pausedBy > 0) tw.pause() // pushed while the reader is in the region: wait for them
      timers.current.set(id, tw)
      return id
    },
    [max, ttlMs, dismiss],
  )
  useEffect(() => {
    const map = timers.current
    const ctl: QueueCtl = {
      pause: () => map.forEach((tw) => tw.pause()),
      resume: () =>
        map.forEach((tw, id) => {
          const left = tw.duration() - tw.time()
          if (left >= TOAST_RESUME_MIN) {
            tw.resume()
            return
          }
          tw.kill()
          map.set(
            id,
            gsap.delayedCall(TOAST_RESUME_MIN, () => dismissRef.current(id)),
          )
        }),
    }
    queues.add(ctl)
    return () => {
      queues.delete(ctl)
      map.forEach((tw) => tw.kill())
      map.clear()
    }
  }, [])
  return { toasts, push, dismiss }
}
