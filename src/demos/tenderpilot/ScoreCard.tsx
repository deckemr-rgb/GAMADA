/**
 * ScoreCard.tsx — standalone (pure props; the Tahap 6 mini demo reuses it): the win-chance gauge 0–100 % and the 5
 * factor bars (value, one sentence, raises / lowers). The number is `tender.matches[shop]` = winScore().probability.
 * The gauge is a small local SVG arc (the kit Gauge brings ChartFrame + d3-shape, ≈ 11 KB, into the first load):
 * 240° track, value arc by stroke-dasharray (pathLength 100), CSS transition (none under reduced motion).
 */
import { Icon } from '../../demo-kit/ui'
import type { WinFactor } from '../../demo-kit/world/usaha-pintar'
import type { Lang } from './model'
import { STRINGS } from './strings'

export interface ScoreCardProps {
  probability: number
  factors: readonly WinFactor[]
  lang: Lang
  /** gauge size in px (phones 160) */
  size?: number
}

export default function ScoreCard({ probability, factors, lang, size = 180 }: ScoreCardProps) {
  const t = STRINGS[lang]
  const p = Math.round(probability * 100)
  return (
    <section className="dk-tp-score" aria-label={t.scoreTitle} data-tp="score" data-prob={p}>
      <div className="dk-tp-gauge">
        <ArcGauge value={p} size={size} label={`${t.scoreTitle}: ${t.scoreCaption(p)}`} caption={t.scoreUnit} />
      </div>
      <ul className="dk-tp-factors">
        {factors.map((f) => (
          <li key={f.key} className={`dk-tp-factor is-${f.impact}`}>
            <div className="dk-tp-factor-h">
              <span className="dk-tp-factor-name">{t.factors[f.key]}</span>
              <span className="dk-tp-factor-imp">
                <Icon name={f.impact === 'naik' ? 'trendUp' : f.impact === 'turun' ? 'trendDown' : 'minus'} size={14} />
                {t.impact[f.impact]}
              </span>
            </div>
            <span className="dk-tp-bar" aria-hidden="true">
              <i style={{ transform: `scaleX(${Math.max(0.02, f.value)})` }} />
            </span>
            <p className="dk-tp-factor-note">{f.note[lang]}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** 240° arc from 150° to 390° (clockwise), radius 40 in a 100 × 100 box */
const ARC = (() => {
  const r = 40
  const pt = (deg: number) => {
    const a = (deg * Math.PI) / 180
    return `${(50 + r * Math.cos(a)).toFixed(2)} ${(50 + r * Math.sin(a)).toFixed(2)}`
  }
  return `M ${pt(150)} A ${r} ${r} 0 1 1 ${pt(390)}`
})()

export function ArcGauge({ value, size, label, caption }: { value: number; size: number; label: string; caption: string }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <figure className="dk-tp-arc" style={{ width: size }} role="img" aria-label={label}>
      <svg viewBox="0 0 100 86" aria-hidden="true">
        <path d={ARC} pathLength={100} className="dk-tp-arc-track" />
        <path d={ARC} pathLength={100} className="dk-tp-arc-val" style={{ strokeDasharray: `${v} 100` }} />
      </svg>
      <span className="dk-tp-arc-n dk-num" aria-hidden="true">
        {Math.round(v)}%
      </span>
      <figcaption className="dk-tp-arc-c" aria-hidden="true">
        {caption}
      </figcaption>
    </figure>
  )
}
