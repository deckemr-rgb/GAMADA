/**
 * ScoreDial — a 0..1000 score on a 270° arc (Rapor Usaha dial, bank rows, Katalog Lokal compare). Pure SVG, no d3:
 * the value arc is drawn with stroke-dashoffset (pathLength 1) and the number counts on the kit ticker (gsap.ticker,
 * 900 ms, power2.out) from `prev` (default 0); reduced motion / static ⇒ the final value at once. role="meter" with
 * aria-valuetext "710 · Baik"; band ticks under the arc; the band of the value colours it.
 */
import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { useI18n } from '../../lib/i18n'
import { motionMode } from '../ui/motion'
import './viz.css'

export interface ScoreBand { min: number; label: { id: string; en: string }; tone: 'danger' | 'warn' | 'info' | 'ok' | 'accent' }
export interface ScoreDialProps {
  value: number
  /** where the fill starts (e.g. last month's score); default 0 */
  prev?: number
  bands: readonly ScoreBand[]
  label: { id: string; en: string }
  size?: 'sm' | 'md' | 'lg'
  max?: number
  className?: string
}

const PX = { sm: 96, md: 160, lg: 220 }
const SR = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' } as const
// the --dk-viz-* tokens live on `.dk-viz` (ChartFrame); outside one the dial falls back to the --dk-* tokens
const COLOR: Record<ScoreBand['tone'], string> = {
  danger: 'var(--dk-viz-danger, var(--dk-danger, #c8382f))',
  warn: 'var(--dk-viz-warn, var(--dk-warn, #ffd77e))',
  info: 'var(--dk-viz-acc, var(--dk-accent, var(--dk-acc, #3fe0c0)))',
  ok: 'var(--dk-viz-ok, var(--dk-accent, var(--dk-acc, #3fe0c0)))',
  accent: 'var(--dk-viz-pos, var(--dk-pos, #6fe8cf))',
}
const A0 = (-135 * Math.PI) / 180
const SWEEP = (270 * Math.PI) / 180
const pt = (r: number, a: number) => `${(Math.sin(a) * r).toFixed(2)},${(-Math.cos(a) * r).toFixed(2)}`

export function ScoreDial({ value, prev = 0, bands, label, size = 'md', max = 1000, className }: ScoreDialProps) {
  const { lang } = useI18n()
  const px = PX[size]
  const r = px / 2 - (size === 'sm' ? 6 : 10)
  const th = size === 'sm' ? 7 : size === 'md' ? 11 : 14
  const v = Math.max(0, Math.min(max, value))
  const band = [...bands].reverse().find((b) => v >= b.min) ?? bands[0]
  const arcRef = useRef<SVGPathElement>(null)
  const numRef = useRef<SVGTextElement>(null)
  const cur = useRef(prev)
  useLayoutEffect(() => {
    const arc = arcRef.current
    const num = numRef.current
    if (!arc || !num) return
    const write = (x: number) => {
      arc.style.strokeDashoffset = String(1 - Math.max(0.0005, x / max))
      num.textContent = String(Math.round(x))
    }
    if (motionMode() !== 'full') {
      cur.current = v
      write(v)
      return
    }
    const from = cur.current
    const ease = gsap.parseEase('power2.out')
    const t0 = gsap.ticker.time
    const tick = () => {
      const k = Math.min(1, (gsap.ticker.time - t0) / 0.9)
      cur.current = from + (v - from) * ease(k)
      write(cur.current)
      if (k >= 1) gsap.ticker.remove(tick)
    }
    write(from)
    gsap.ticker.add(tick)
    return () => {
      gsap.ticker.remove(tick)
    }
  }, [v, max])
  const path = `M${pt(r, A0)}A${r},${r} 0 1 1 ${pt(r, A0 + SWEEP)}`
  const text = `${Math.round(v)} · ${band?.label[lang] ?? ''}`
  return (
    <div className={`dk-score-dial is-${size}${className ? ` ${className}` : ''}`} role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(v)} aria-valuetext={text} aria-label={label[lang]} style={{ width: px }}>
      <svg width={px} height={px * 0.86} viewBox={`${-px / 2} ${-px / 2} ${px} ${px * 0.86}`} aria-hidden="true">
        <path d={path} fill="none" stroke="var(--dk-viz-line, rgba(185,178,255,.16))" strokeWidth={th} strokeLinecap="round" />
        {bands.slice(1).map((b) => {
          const a = A0 + (b.min / max) * SWEEP
          return <line key={b.min} x1={Math.sin(a) * (r + th / 2 + 2)} y1={-Math.cos(a) * (r + th / 2 + 2)} x2={Math.sin(a) * (r + th / 2 + 6)} y2={-Math.cos(a) * (r + th / 2 + 6)} stroke={COLOR[b.tone]} strokeWidth={2} />
        })}
        <path ref={arcRef} d={path} pathLength={1} fill="none" stroke={band ? COLOR[band.tone] : COLOR.info} strokeWidth={th} strokeLinecap="round" strokeDasharray="1 1" style={{ strokeDashoffset: 1 - Math.max(0.0005, prev / max) }} />
        <text ref={numRef} x={0} y={size === 'sm' ? 6 : 10} textAnchor="middle" className="dk-viz-num" style={{ fontSize: px * (size === 'sm' ? 0.24 : 0.22), fontWeight: 700, fill: 'var(--dk-text, #fff)' }}>
          {Math.round(prev)}
        </text>
        {size !== 'sm' && band && (
          <text x={0} y={10 + px * 0.13} textAnchor="middle" style={{ fontSize: px * 0.075, fill: COLOR[band.tone], fontWeight: 600 }}>
            {band.label[lang]}
          </text>
        )}
      </svg>
      <span style={SR}>{`${label[lang]}: ${text}`}</span>
    </div>
  )
}
