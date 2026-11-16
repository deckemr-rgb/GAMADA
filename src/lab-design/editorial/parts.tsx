/** Shared building blocks for direction A: the section shell (rule that draws) and the rule toggle. */
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { gsap } from 'gsap'
import { EASE } from '../../lib/motion'
import { LDE, motionMode, observeOnce } from './lde'

export function Section({
  n,
  id,
  kicker,
  title,
  dek,
  children,
}: {
  n: string
  id: string
  kicker: string
  title: string
  dek: ReactNode
  children: ReactNode
}) {
  const ref = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    const mode = motionMode()
    if (!el || mode === 'static') return
    const ctx = gsap.context(() => {
      const rule = el.querySelector('.lde-sec-rule')
      const head = el.querySelectorAll('.lde-sec-head > :not(.lde-sec-rule)')
      if (mode === 'reduced') gsap.set(head, { opacity: 0 })
      else {
        gsap.set(rule, { scaleX: 0 })
        gsap.set(head, { opacity: 0, y: 6 })
      }
    }, el)
    const stop = observeOnce(
      el,
      () =>
        ctx.add(() => {
          const rule = el.querySelector('.lde-sec-rule')
          const head = el.querySelectorAll('.lde-sec-head > :not(.lde-sec-rule)')
          if (mode === 'reduced') {
            gsap.to(head, { opacity: 1, duration: LDE.fade })
            return
          }
          gsap.to(rule, { scaleX: 1, duration: LDE.screen, ease: EASE.reveal })
          gsap.to(head, { opacity: 1, y: 0, duration: LDE.panel, ease: EASE.out, stagger: 0.05, delay: 0.12 })
        }),
      0.08,
    )
    return () => {
      stop()
      ctx.revert()
    }
  }, [])

  return (
    <section ref={ref} id={`lde-${id}`} className="lde-sec" aria-labelledby={`lde-h-${id}`}>
      <header className="lde-sec-head">
        <span className="lde-sec-rule" aria-hidden="true" />
        <p className="lde-folio">
          <span className="lde-folio-n">{n}</span>
          <span className="lde-cap">{kicker}</span>
        </p>
        <h2 id={`lde-h-${id}`} className="lde-sec-title">
          {title}
        </h2>
        <div className="lde-sec-dek">{dek}</div>
      </header>
      {children}
    </section>
  )
}

/**
 * Rule toggle: text options with a 2 px rule underneath that slides to the chosen one.
 * Buttons with aria-pressed (a toggle group), each a real control.
 */
export function RuleToggle<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string; icon?: ReactNode }[]
  onChange: (v: T) => void
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLSpanElement>(null)
  const placed = useRef(false)

  useLayoutEffect(() => {
    const w = wrap.current
    const b = bar.current
    if (!w || !b) return
    const place = (animate: boolean) => {
      const btn = w.querySelector<HTMLElement>('[aria-pressed="true"]')
      if (!btn) return
      const to = { x: btn.offsetLeft, scaleX: btn.offsetWidth }
      if (animate && motionMode() === 'full') gsap.to(b, { ...to, duration: LDE.press, ease: EASE.out, overwrite: true })
      else gsap.set(b, to)
    }
    place(placed.current)
    placed.current = true
    const ro = new ResizeObserver(() => place(false))
    ro.observe(w)
    return () => {
      ro.disconnect()
      gsap.killTweensOf(b)
    }
  }, [value])

  return (
    <div className="lde-toggle" role="group" aria-label={label} ref={wrap}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="lde-toggle-btn"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
      <span className="lde-toggle-bar" ref={bar} aria-hidden="true" />
    </div>
  )
}
