/**
 * Toast primitive + ToastRegion + useToastQueue. The cross-product EventToast stack (max 3, bottom-left,
 * click → jump to product) is built by the shell on top of these.
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
  return (
    <Portal className="dk-toast-host">
      <section className={`dk-toasts dk-toasts--${placement}`} aria-label={label ?? t.notifications} aria-live="polite" aria-relevant="additions">
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
  const dismiss = useCallback((id: string) => {
    timers.current.get(id)?.kill()
    timers.current.delete(id)
    setToasts((ts) => ts.filter((x) => x.id !== id))
  }, [])
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
      timers.current.set(
        id,
        gsap.delayedCall(ttlMs / 1000, () => dismiss(id)),
      )
      return id
    },
    [max, ttlMs, dismiss],
  )
  useEffect(() => {
    const map = timers.current
    return () => {
      map.forEach((tw) => tw.kill())
      map.clear()
    }
  }, [])
  return { toasts, push, dismiss }
}
