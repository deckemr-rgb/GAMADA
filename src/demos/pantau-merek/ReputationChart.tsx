/**
 * demos/pantau-merek/ReputationChart.tsx — the 24 h reputation line, shop vs category (`reputationSeries`), with
 * markers for the spike and the published notice. Standalone (pure props) for the product page. One SVG scaled to its
 * box (non-scaling strokes), HTML labels; the lines fade in once (opacity, full motion only).
 */
import { memo } from 'react'
import { ChartFrame } from '../../demo-kit/viz'

export interface RepPoint { at: number; value: number }
export interface RepMarker { at: number; label: string; tone: 'danger' | 'accent' }

const H = 40
const y = (v: number) => H - (Math.max(0, Math.min(100, v)) / 100) * H

export const ReputationChart = memo(function ReputationChart(props: {
  shop: RepPoint[]
  cat: RepPoint[]
  markers: RepMarker[]
  title: string
  unit: string
  shopLabel: string
  catLabel: string
  summary: string
  ticks: string[]
  seed: number
  animate: boolean
}) {
  const { shop, cat, markers, title, unit, shopLabel, catLabel, summary, ticks, seed, animate } = props
  const t0 = shop[0]?.at ?? 0
  const t1 = shop[shop.length - 1]?.at ?? 1
  const x = (at: number) => ((at - t0) / Math.max(1, t1 - t0)) * 100
  const pts = (l: RepPoint[]) => l.map((p) => `${x(p.at).toFixed(2)},${y(p.value).toFixed(2)}`).join(' ')
  const last = shop[shop.length - 1]
  return (
    <ChartFrame
      title={title}
      unit={unit}
      seed={seed}
      summary={summary}
      hint={false}
      className="dk-pm-rep"
      legend={[
        { label: shopLabel, color: 'var(--dk-eco-acc)', kind: 'line' },
        { label: catLabel, color: 'var(--dk-muted)', kind: 'dash' },
      ]}
    >
      <div className="dk-pm-rep-plot" data-pm="rep-chart">
        <div className="dk-pm-rep-grid" aria-hidden="true">
          <span style={{ top: `${(y(75) / H) * 100}%` }}>75</span>
          <span style={{ top: `${(y(50) / H) * 100}%` }}>50</span>
          <span style={{ top: `${(y(25) / H) * 100}%` }}>25</span>
        </div>
        <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" aria-hidden="true" className={animate ? 'is-draw' : undefined}>
          <polyline className="dk-pm-rep-cat" points={pts(cat)} fill="none" vectorEffect="non-scaling-stroke" />
          <polyline className="dk-pm-rep-shop" points={pts(shop)} fill="none" vectorEffect="non-scaling-stroke" />
        </svg>
        {markers
          .filter((m) => m.at >= t0 && m.at <= t1)
          .map((m) => (
            <span key={`${m.tone}${m.at}`} className={`dk-pm-rep-mark is-${m.tone}`} style={{ left: `${x(m.at)}%` }} data-pm={m.tone === 'danger' ? 'rep-spike' : 'rep-ann'}>
              <i aria-hidden="true" />
              <b>{m.label}</b>
            </span>
          ))}
        {last && (
          <span className="dk-pm-rep-now dk-num" style={{ top: `${(y(last.value) / H) * 100}%` }} aria-hidden="true">
            {last.value}
          </span>
        )}
      </div>
      <div className="dk-pm-rep-x dk-num" aria-hidden="true">
        {ticks.map((tk, i) => (
          <span key={i}>{tk}</span>
        ))}
      </div>
    </ChartFrame>
  )
})
