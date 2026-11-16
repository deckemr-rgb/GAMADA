/**
 * TamperHeatmap — edit-likelihood overlay (cells in % of the page, from Extracted.tamper) + TamperToggle, the
 * on/off + opacity control. The overlay is one SVG; only its opacity changes.
 */
import { useId } from 'react'
import type { Extracted } from '../ai/types'
import { useI18n } from '../../lib/i18n'
import { Icon } from '../ui/icons'
import './docs.css'

export type TamperCell = NonNullable<Extracted['tamper']>[number]

export const HEAT = {
  /** colour stops: attention (gold) → danger (red) */
  warn: '#f2b64a',
  danger: '#e0463a',
  /** score from which a cell turns red */
  dangerFrom: 0.55,
} as const

export interface TamperHeatmapProps {
  cells: TamperCell[]
  /** 0..1 layer opacity (0 hides it) */
  opacity: number
  className?: string
}

export function TamperHeatmap({ cells, opacity, className }: TamperHeatmapProps) {
  return (
    <svg className={`dk-heat${className ? ` ${className}` : ''}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" style={{ opacity }}>
      {cells.map((c, i) => (
        <rect key={i} x={c.x} y={c.y} width={c.w} height={c.h} fill={c.score >= HEAT.dangerFrom ? HEAT.danger : HEAT.warn} opacity={Math.min(0.85, 0.12 + c.score * 0.8)} />
      ))}
    </svg>
  )
}

export interface TamperToggleProps {
  /** 0 = off */
  opacity: number
  onChange: (opacity: number) => void
  /** highest cell score — shown as "skor tertinggi" */
  maxScore?: number
  className?: string
}

const S = {
  id: { heat: 'Peta panas indikasi edit', opacity: 'Opasitas peta panas', on: 'Tampilkan', off: 'Sembunyikan', top: 'skor tertinggi' },
  en: { heat: 'Edit-likelihood heatmap', opacity: 'Heatmap opacity', on: 'Show', off: 'Hide', top: 'top score' },
}

/** On/off switch + opacity slider for the heatmap. */
export function TamperToggle({ opacity, onChange, maxScore, className }: TamperToggleProps) {
  const { lang } = useI18n()
  const s = S[lang]
  const rid = useId()
  const on = opacity > 0
  return (
    <div className={`dk-heat-ctl${className ? ` ${className}` : ''}`}>
      <button type="button" className={`dk-heat-switch${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => onChange(on ? 0 : 0.7)}>
        <span className="dk-heat-knob" aria-hidden="true" />
        <Icon name="layers" size={16} />
        <span>{s.heat}</span>
      </button>
      {on && (
        <label className="dk-heat-range" htmlFor={rid}>
          <span className="dk-sr">{s.opacity}</span>
          <input id={rid} type="range" min={10} max={100} step={5} value={Math.round(opacity * 100)} onChange={(e) => onChange(Number(e.currentTarget.value) / 100)} />
          <span className="dk-num" aria-hidden="true">
            {Math.round(opacity * 100)}%
          </span>
        </label>
      )}
      {maxScore !== undefined && (
        <span className={`dk-heat-score${maxScore >= HEAT.dangerFrom ? ' is-danger' : ''}`}>
          {s.top} <b className="dk-num">{Math.round(maxScore * 100)}%</b>
        </span>
      )}
    </div>
  )
}
