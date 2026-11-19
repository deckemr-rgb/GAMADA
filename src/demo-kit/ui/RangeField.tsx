/**
 * RangeField — a labelled native range (Sinyal Pasar op simulator, Rapor Usaha loan plafon): 44 px thumb, arrows /
 * PageUp / PageDown (10 steps) / Home / End, `aria-valuetext` from `format(v, lang)`, the value printed beside the
 * label (+ optional unit).
 */
import { useId, type KeyboardEvent } from 'react'
import { useI18n, type Lang } from '../../lib/i18n'
import './pd.css'

export interface RangeFieldProps {
  label: { id: string; en: string }
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
  format?: (v: number, lang: Lang) => string
  unit?: { id: string; en: string }
  disabled?: boolean
  className?: string
  /** forwarded data attribute hook (e.g. data-sp="volume") */
  hook?: string
}

export function RangeField({ label, min, max, step, value, onChange, format, unit, disabled, className, hook }: RangeFieldProps) {
  const { lang } = useI18n()
  const id = useId()
  const fmt = (v: number) => (format ? format(v, lang) : v.toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB'))
  const clamp = (v: number) => Math.max(min, Math.min(max, Math.round(v / step) * step))
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    const big = step * Math.max(1, Math.round((max - min) / step / 10))
    const next = e.key === 'PageUp' ? value + big : e.key === 'PageDown' ? value - big : e.key === 'Home' ? min : e.key === 'End' ? max : null
    if (next === null) return
    e.preventDefault()
    onChange(clamp(next))
  }
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0
  return (
    <div className={`dk-rangefield${disabled ? ' is-disabled' : ''}${className ? ` ${className}` : ''}`}>
      <div className="dk-rangefield-h">
        <label htmlFor={id}>{label[lang]}</label>
        <output htmlFor={id} className="dk-num">
          {fmt(value)}
          {unit ? ` ${unit[lang]}` : ''}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-valuetext={`${fmt(value)}${unit ? ` ${unit[lang]}` : ''}`}
        style={{ ['--p' as string]: `${pct}%` }}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        onKeyDown={onKey}
        {...(hook ? { 'data-hook': hook } : {})}
      />
    </div>
  )
}
