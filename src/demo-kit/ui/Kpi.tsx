/**
 * Kpi + KpiStrip. Count-up ≤ 600 ms with tabular numbers (first time in view, then on every change);
 * delta coloured by MEANING (goodWhen), a fixed "+n" change tag beside the number (never floating over
 * the label), an optional sparkline slot (viz/Sparkline) and an optional value-vs-target bar.
 * One `hero` KPI per screen may use the Fraunces display numeral.
 */
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { gsap } from 'gsap'
import { DEMO, EASE } from '../../lib/motion'
import { useI18n } from '../../lib/i18n'
import { Icon } from './icons'
import { motionMode, useCountUp, useGsapContext, useInView } from './motion'
import { fmtNum, useUiStrings } from './strings'
import './tokens.css'
import './ui.css'

export interface KpiProps {
  label: string
  value: number
  /** decimals for the default formatter */
  decimals?: number
  /** custom formatter for the running number (e.g. rupiah) */
  format?: (n: number) => string
  /** small unit after the number ("%", "/100", "jt") */
  unit?: string
  /** change vs the comparison period */
  delta?: number
  deltaFormat?: (n: number) => string
  /** which direction is good; decides the delta colour */
  goodWhen?: 'up' | 'down'
  /** default "vs kemarin" / "vs yesterday" */
  deltaLabel?: string
  /** Fraunces display numeral — at most one per screen */
  hero?: boolean
  /** sparkline (or any micro visual) slot */
  spark?: ReactNode
  /** draws a value / target bar */
  target?: number
  /** extra line under the value */
  caption?: string
  className?: string
}

export type DeltaMeaning = 'good' | 'bad' | 'flat'

export function deltaMeaning(delta: number, goodWhen: 'up' | 'down' = 'up'): DeltaMeaning {
  if (!delta) return 'flat'
  return (delta > 0) === (goodWhen === 'up') ? 'good' : 'bad'
}

export function Kpi({ label, value, decimals = 0, format, unit, delta, deltaFormat, goodWhen = 'up', deltaLabel, hero, spark, target, caption, className }: KpiProps) {
  const { lang } = useI18n()
  const t = useUiStrings()
  const root = useRef<HTMLDivElement>(null)
  const inView = useInView(root, { threshold: 0.4 })
  const fmt = format ?? ((n: number) => fmtNum(lang, n, decimals))
  const numRef = useCountUp<HTMLSpanElement>(value, { format: fmt, start: inView })
  const tagRef = useRef<HTMLSpanElement>(null)
  const flashRef = useRef<HTMLSpanElement>(null)
  const barRef = useRef<HTMLSpanElement>(null)
  const prev = useRef(value)
  const run = useGsapContext()
  const meaning = delta === undefined ? 'flat' : deltaMeaning(delta, goodWhen)

  /* change tag "+n" beside the number + soft accent flash of the cell */
  useEffect(() => {
    const before = prev.current
    prev.current = value
    if (before === value || !inView) return
    const tag = tagRef.current
    const fl = flashRef.current
    if (!tag || !fl) return
    const diff = value - before
    tag.textContent = `${diff > 0 ? '+' : '−'}${fmt(Math.abs(diff))}`
    const mode = motionMode()
    if (mode === 'static') return
    run(() => {
      const tl = gsap.timeline()
      const f = mode === 'reduced' ? DEMO.reducedFade : DEMO.press
      tl.fromTo(fl, { opacity: 1 }, { opacity: 0, duration: mode === 'reduced' ? DEMO.reducedFade : DEMO.rowHighlightFade, delay: mode === 'reduced' ? DEMO.rowHighlightFade - DEMO.reducedFade : 0, ease: 'power1.in' }, 0)
      tl.fromTo(tag, { opacity: 0, y: mode === 'reduced' ? 0 : 4 }, { opacity: 1, y: 0, duration: f, ease: EASE.out }, 0)
      tl.to(tag, { opacity: 0, duration: DEMO.panel }, DEMO.rowHighlightFade)
    })
    // fmt's identity changes per render; the diff text depends on the values only
  }, [value, inView, run])

  /* target bar */
  const frac = target ? Math.max(0, Math.min(1, value / target)) : null
  useLayoutEffect(() => {
    const el = barRef.current
    if (!el || frac === null) return
    if (motionMode() !== 'full') {
      gsap.set(el, { scaleX: frac })
      return
    }
    if (!inView) {
      gsap.set(el, { scaleX: 0 })
      return
    }
    const tw = gsap.to(el, { scaleX: frac, duration: DEMO.countUp, ease: EASE.out })
    return () => {
      tw.kill()
    }
  }, [frac, inView])

  const deltaText = delta === undefined ? '' : `${delta > 0 ? '+' : delta < 0 ? '−' : '±'}${(deltaFormat ?? ((n: number) => fmtNum(lang, n, decimals)))(Math.abs(delta))}`
  const srText = `${label}: ${fmt(value)}${unit ? ` ${unit}` : ''}${delta !== undefined ? `, ${deltaText} ${deltaLabel ?? t.vsYesterday}` : ''}${target ? `, ${t.target} ${fmt(target)}` : ''}`

  return (
    <div ref={root} className={`dk-kpi${hero ? ' is-hero' : ''}${className ? ` ${className}` : ''}`} role="group" aria-label={srText}>
      <span className="dk-kpi-flash" ref={flashRef} aria-hidden="true" />
      <span className="dk-kpi-label" aria-hidden="true">
        {label}
      </span>
      <div className="dk-kpi-row" aria-hidden="true">
        <span className="dk-kpi-val">
          <span ref={numRef} className="dk-num" />
          {unit && <small>{unit}</small>}
          <span className="dk-kpi-tag dk-num" ref={tagRef} />
        </span>
        {spark && <span className="dk-kpi-spark">{spark}</span>}
      </div>
      {frac !== null && (
        <span className="dk-kpi-target" aria-hidden="true">
          <span className="dk-kpi-target-bar">
            <span ref={barRef} />
          </span>
          <span className="dk-kpi-target-l dk-num">
            {t.target} {fmt(target ?? 0)}
            {unit ?? ''}
          </span>
        </span>
      )}
      {caption && (
        <span className="dk-kpi-cap" aria-hidden="true">
          {caption}
        </span>
      )}
      {delta !== undefined && (
        <span className={`dk-kpi-delta is-${meaning}`} aria-hidden="true">
          {meaning !== 'flat' && <Icon name={delta > 0 ? 'trendUp' : 'trendDown'} size={14} />}
          <span className="dk-num">{deltaText}</span>
          <span className="dk-kpi-vs">{deltaLabel ?? t.vsYesterday}</span>
        </span>
      )}
    </div>
  )
}

/** Continuous strip of KPIs separated by 1 px lines; wraps to 2 / 1 columns on narrow containers. */
export function KpiStrip({ children, label, className }: { children: ReactNode; label?: string; className?: string }) {
  return (
    <div className={`dk-kpis${className ? ` ${className}` : ''}`} role="group" aria-label={label}>
      {children}
    </div>
  )
}
