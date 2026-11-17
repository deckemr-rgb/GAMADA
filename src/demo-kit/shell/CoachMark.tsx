/**
 * shell/CoachMark.tsx — a small anchored tip with "next" / "close" (multi-step tips: pass step/total).
 * Split from Hotspot.tsx so products can import it from the barrel while the Hotspot ring stays a lazy chunk.
 */
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Button, IconButton, Portal, enterPanel } from '../ui'
import { useDemoStrings } from '../i18n'

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
