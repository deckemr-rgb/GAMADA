/**
 * MapLegend — legend for the map overlays. A choropleth spec renders its classes with value ranges (same
 * resolver as the engine, so legend and map always agree) plus the anonymity hatch swatch when cells are
 * hidden; `items` add swatches for markers, heat, flood, rain …
 */
import type { ReactNode } from 'react'
import { useI18n } from '../../lib/i18n'
import { Icon, type IconName } from '../ui/icons'
import { resolveChoropleth } from './choro'
import { toneColor } from './palette'
import { ms } from './strings'
import type { ChoroplethLayer, MapTone } from './types'
import './map.css'

export interface LegendItem {
  id: string
  label: string
  kind: 'fill' | 'line' | 'dash' | 'icon' | 'heat' | 'water' | 'rain'
  color?: string
  icon?: IconName
  tone?: MapTone
}

export interface MapLegendProps {
  title?: string
  choropleth?: ChoroplethLayer | null
  items?: LegendItem[]
  /** small print under the legend (method, source) */
  note?: ReactNode
  className?: string
}

function Swatch({ item }: { item: LegendItem }) {
  const color = item.color ?? (item.tone ? toneColor(item.tone) : 'var(--dk-muted)')
  if (item.kind === 'icon')
    return (
      <span className="dk-mlg-badge" style={{ background: color }} aria-hidden="true">
        <Icon name={item.icon ?? 'dot'} size={12} strokeWidth={2} />
      </span>
    )
  return <span className={`dk-mlg-sw dk-mlg-sw--${item.kind}`} style={{ ['--sw' as string]: color }} aria-hidden="true" />
}

export function MapLegend({ title, choropleth, items, note, className }: MapLegendProps) {
  const { lang } = useI18n()
  const r = choropleth ? resolveChoropleth(choropleth, lang) : null
  const ranges = r
    ? r.colors.map((c, i) => {
        const lo = i === 0 ? null : r.breaks[i - 1]!
        const hi = i === r.colors.length - 1 ? null : r.breaks[i]!
        const text = lo === null && hi !== null ? `< ${r.format(hi)}` : hi === null && lo !== null ? `≥ ${r.format(lo)}` : lo !== null && hi !== null ? `${r.format(lo)} – ${r.format(hi)}` : r.format(r.max)
        return { c, text }
      })
    : []
  return (
    <section className={`dk-mlg${className ? ` ${className}` : ''}`} aria-label={title ?? ms('legend', lang)}>
      {(title || choropleth?.title) && <h3 className="dk-mlg-title">{title ?? choropleth?.title?.[lang]}</h3>}
      {r && (
        <div className="dk-mlg-choro">
          {choropleth?.unit && <p className="dk-mlg-unit">{choropleth.unit[lang]}</p>}
          <ul className="dk-mlg-ramp">
            {ranges.map((x) => (
              <li key={x.c}>
                <span className="dk-mlg-sw dk-mlg-sw--fill" style={{ ['--sw' as string]: x.c }} aria-hidden="true" />
                <span className="dk-num">{x.text}</span>
              </li>
            ))}
            {r.hidden.size > 0 && (
              <li>
                <span className="dk-mlg-sw dk-mlg-sw--hatch" aria-hidden="true" />
                <span title={ms('hidden', lang)}>{ms('hiddenShort', lang)}</span>
              </li>
            )}
          </ul>
        </div>
      )}
      {items && items.length > 0 && (
        <ul className="dk-mlg-items">
          {items.map((it) => (
            <li key={it.id}>
              <Swatch item={it} />
              <span>{it.label}</span>
            </li>
          ))}
        </ul>
      )}
      {note && <p className="dk-mlg-note">{note}</p>}
    </section>
  )
}
