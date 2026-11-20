/**
 * ChartFrame — the card every chart sits in: title, unit, optional legend + actions, the plot, a source line
 * ("Data simulasi · seed 42"), an sr-only summary generated from the data and an aria-live readout for
 * keyboard exploration. `bare` drops the card chrome but keeps the accessible parts.
 */
import type { CSSProperties, ReactNode } from 'react'
import { useVizLang } from './lang'
import { useUid } from './core'
import './viz.css'

export interface LegendItem {
  label: string
  color: string
  kind?: 'line' | 'dash' | 'area' | 'dot' | 'bar'
}

export interface FrameProps {
  /** Chart title (also the accessible name). */
  title: string
  /** Unit line under the title, e.g. "aduan / hari", "Rp". */
  unit?: string
  /** Source line; default "Data simulasi · seed {seed}". */
  source?: string
  /** Seed shown in the default source line (default 42). */
  seed?: number
  /** Override the generated screen-reader summary. */
  summary?: string
  /** Render without card chrome (embedded in a KPI tile or a custom panel). */
  bare?: boolean
  /** Extra controls in the header (must do something real). */
  actions?: ReactNode
  /** Side panel (stats) on wide frames; stacks below under 640px. */
  aside?: ReactNode
  className?: string
  style?: CSSProperties
}

export interface ChartFrameProps extends FrameProps {
  /** Generated summary (used when `summary` is not given). */
  autoSummary?: string
  legend?: LegendItem[]
  /** Keyboard readout announced politely. */
  announce?: string
  /** Keyboard hint in the source line (shown on fine pointers only); false hides it. */
  hint?: string | false
  children: ReactNode
}

export { useVizLang } from './lang'

export function Legend({ items }: { items: LegendItem[] }) {
  if (!items.length) return null
  return (
    <ul className="dk-viz-legend" aria-hidden="true">
      {items.map((it) => (
        <li key={it.label}>
          <i className={`dk-viz-key is-${it.kind ?? 'line'}`} style={{ '--k': it.color } as CSSProperties} />
          {it.label}
        </li>
      ))}
    </ul>
  )
}

export function ChartFrame(props: ChartFrameProps) {
  const { title, unit, source, seed = 42, summary, autoSummary, bare, actions, aside, legend, announce, hint, className, style, children } = props
  const { s } = useVizLang()
  const sumId = useUid('dk-viz-sum')
  const titleId = useUid('dk-viz-title')
  return (
    <figure
      className={`dk-viz${bare ? ' is-bare' : ''}${aside ? ' has-aside' : ''}${className ? ` ${className}` : ''}`}
      style={style}
      aria-labelledby={titleId}
      aria-describedby={sumId}
    >
      <div className="dk-viz-main">
        <header className={`dk-viz-head${bare ? ' dk-viz-sr' : ''}`}>
          <div className="dk-viz-titles">
            <h3 className="dk-viz-title" id={titleId}>
              {title}
            </h3>
            {unit && <p className="dk-viz-unit">{unit}</p>}
          </div>
          {(legend?.length || actions) && (
            <div className="dk-viz-headr">
              {legend && <Legend items={legend} />}
              {actions}
            </div>
          )}
        </header>
        <div className="dk-viz-body">{children}</div>
        {!bare && (
          <figcaption className="dk-viz-src">
            <span>{source ?? s.source(seed)}</span>
            {hint && <span className="dk-viz-hint">{hint}</span>}
          </figcaption>
        )}
        <p id={sumId} className="dk-viz-sr">
          {summary ?? autoSummary ?? ''}
        </p>
        <p className="dk-viz-sr" aria-live="polite">
          {announce ?? ''}
        </p>
      </div>
      {aside && <div className="dk-viz-aside">{aside}</div>}
    </figure>
  )
}

/** Pointer tooltip, positioned in the plot's CSS pixels. Flips left near the right edge, below near the top. */
export function ChartTip({ x, y, width, children, below }: { x: number; y: number; width: number; children: ReactNode; below?: boolean }) {
  const right = x > width - 150
  const left = x < 90
  const cls = `dk-viz-tip${right ? ' is-r' : left ? ' is-l' : ''}${below || y < 64 ? ' is-below' : ''}`
  return (
    <div className={cls} style={{ left: x, top: y }} aria-hidden="true">
      {children}
    </div>
  )
}

export function TipRow({ color, label, value, dashed }: { color?: string; label: string; value: string; dashed?: boolean }) {
  return (
    <span className="dk-viz-tiprow">
      {color && <i className={`dk-viz-key ${dashed ? 'is-dash' : 'is-dot'}`} style={{ '--k': color } as CSSProperties} />}
      <span className="dk-viz-tipk">{label}</span>
      <b className="dk-viz-num">{value}</b>
    </span>
  )
}
