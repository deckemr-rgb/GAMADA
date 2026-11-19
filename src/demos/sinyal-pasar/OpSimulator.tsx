/**
 * OpSimulator — pure-props market-operation simulator: volume / days RangeFields, "Simulasikan" draws the "sesudah
 * operasi" curve over "tanpa operasi" (both from `opSimulate`, passed in by the caller). Works before approval.
 */
import { Button, RangeField } from '../../demo-kit/ui'
import { TrendChart } from '../../demo-kit/viz'

export interface OpSimulatorProps {
  title: string
  volume: number
  days: number
  onVolume: (v: number) => void
  onDays: (v: number) => void
  labels: { volume: { id: string; en: string }; ton: { id: string; en: string }; days: { id: string; en: string }; dayUnit: { id: string; en: string } }
  baseline: number[]
  after: number[] | null
  onSimulate: () => void
  simulateLabel: string
  baseLabel: string
  afterLabel: string
  dayLabel: (d: number) => string
  source: string
  result: string | null
  stale: boolean
  staleText: string
}

export function OpSimulator(p: OpSimulatorProps) {
  const x = p.baseline.map((_, i) => i + 1)
  return (
    <section className="dk-sp-sim-box" data-tour="sp-simulate" aria-label={p.title}>
      <TrendChart
        title={p.title}
        unit="Rp"
        source={p.source}
        x={x}
        xFormat={(v) => p.dayLabel(Number(v))}
        series={[{ id: 'base', label: p.baseLabel, values: p.baseline, dashed: true, color: 'var(--dk-muted)' }, ...(p.after ? [{ id: 'after', label: p.afterLabel, values: p.after }] : [])]}
        format={(v) => 'Rp ' + Math.round(v).toLocaleString('id-ID')}
        height={200}
      />
      <div className="dk-sp-sim-ctl">
        <RangeField label={p.labels.volume} min={2} max={20} step={1} value={p.volume} onChange={p.onVolume} unit={p.labels.ton} hook="sp-sim-volume" />
        <RangeField label={p.labels.days} min={1} max={7} step={1} value={p.days} onChange={p.onDays} unit={p.labels.dayUnit} hook="sp-sim-days" />
        <Button variant="primary" icon="play" onClick={p.onSimulate} data-sp="simulate">
          {p.simulateLabel}
        </Button>
      </div>
      {p.result && (
        <p className="dk-sp-effect dk-num" aria-live="polite" data-sp="sim-result">
          {p.result}
          {p.stale && <span className="dk-sp-muted"> · {p.staleText}</span>}
        </p>
      )}
    </section>
  )
}
