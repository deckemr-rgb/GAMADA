/**
 * FactorWaterfall — pure props (reused by the Tahap 6 product page): from the peer median to the score, one row per
 * factor (± points, a waterfall bar from the running total, the evidence sentence, its source product). The bars
 * build factor by factor (60 ms stagger, transform only); nothing animates under reduced motion. Each row is a
 * button (`onOpen`) and carries `data-factor` so a change can be flashed. The rows always sum: peer + Σ = score.
 */
import { memo, type ReactNode } from 'react'
import type { Bi } from '../../demo-kit/world'
import { Icon } from '../../demo-kit/ui'

export interface WaterfallRow {
  key: string
  label: string
  points: number
  evidence: string
  /** right column: source chip / link (rendered outside the row button) */
  source?: ReactNode
  note?: string
}
export interface FactorWaterfallProps {
  peer: { label: string; score: number }
  total: { label: string; score: number }
  rows: WaterfallRow[]
  onOpen?: (key: string) => void
  /** "+12 poin" / "+12 pts" */
  pts: (n: number) => string
  label: string
  animate?: boolean
  lang: keyof Bi
}

export const FactorWaterfall = memo(function FactorWaterfall({ peer, total, rows, onOpen, pts, label, animate = true }: FactorWaterfallProps) {
  let run = peer.score
  const spans = rows.map((r) => {
    const from = run
    run += r.points
    return { from, to: run }
  })
  const all = [peer.score, total.score, ...spans.map((s) => s.to)]
  const lo = Math.min(...all) - 20
  const hi = Math.max(...all) + 20
  const x = (v: number) => ((v - lo) / (hi - lo)) * 100
  return (
    <ol className={`dk-ru-wf${animate ? ' is-anim' : ''}`} aria-label={label}>
      <li className="dk-ru-wf-row is-base">
        <div className="dk-ru-wf-btn is-static">
          <span className="dk-ru-wf-name">{peer.label}</span>
          <span className="dk-ru-wf-bar" aria-hidden="true">
            <i style={{ left: 0, width: `${x(peer.score)}%` }} />
          </span>
          <b className="dk-num">{peer.score}</b>
        </div>
        <span className="dk-ru-wf-src" />
      </li>
      {rows.map((r, i) => {
        const s = spans[i]!
        const left = x(Math.min(s.from, s.to))
        const w = Math.max(0.6, Math.abs(x(s.to) - x(s.from)))
        const up = r.points >= 0
        const body = (
          <>
            <span className="dk-ru-wf-name">
              {r.label}
              <small>{r.evidence}</small>
              {r.note && <small className="dk-ru-wf-note">{r.note}</small>}
            </span>
            <span className="dk-ru-wf-bar" aria-hidden="true">
              <i className={up ? 'is-up' : 'is-down'} style={{ left: `${left}%`, width: `${w}%`, animationDelay: `${i * 60}ms` }} />
            </span>
            <b className={`dk-num ${up ? 'is-up' : 'is-down'}`} data-points={r.points}>
              {up ? <Icon name="trendUp" size={14} /> : <Icon name="trendDown" size={14} />} {pts(r.points)}
            </b>
          </>
        )
        return (
          <li key={r.key} className="dk-ru-wf-row" data-factor={r.key}>
            {onOpen ? (
              <button type="button" className="dk-ru-wf-btn" onClick={() => onOpen(r.key)} data-ru="factor" aria-haspopup="dialog">
                {body}
              </button>
            ) : (
              <div className="dk-ru-wf-btn">{body}</div>
            )}
            <span className="dk-ru-wf-src">{r.source}</span>
          </li>
        )
      })}
      <li className="dk-ru-wf-row is-total">
        <div className="dk-ru-wf-btn is-static">
          <span className="dk-ru-wf-name">{total.label}</span>
          <span className="dk-ru-wf-bar" aria-hidden="true">
            <i style={{ left: 0, width: `${x(total.score)}%` }} />
          </span>
          <b className="dk-num" data-ru="wf-total">
            {total.score}
          </b>
        </div>
        <span className="dk-ru-wf-src" />
      </li>
    </ol>
  )
})
