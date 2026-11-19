/**
 * OutlookChart — pure-props 30-day history + 14-day forecast band (`priceOutlook`) with "today" and the peak marker.
 * Text summary from the kit chart (TrendChart lists markers). Source line "Data simulasi".
 */
import { TrendChart } from '../../demo-kit/viz'

export interface OutlookChartProps {
  title: string
  history: number[]
  forecast: number[]
  lo: number[]
  hi: number[]
  peakDay: number
  peakLabel: string
  todayLabel: string
  seriesLabel: string
  forecastLabel: string
  dayLabel: (d: number) => string
  source: string
  summary?: string
}

export function OutlookChart({ title, history, forecast, lo, hi, peakDay, peakLabel, todayLabel, seriesLabel, forecastLabel, dayLabel, source, summary }: OutlookChartProps) {
  const n = history.length
  const x = Array.from({ length: n + forecast.length }, (_, i) => i - (n - 1))
  return (
    <div data-tour="sp-outlook">
      <TrendChart
        title={title}
        unit="Rp"
        source={source}
        x={x}
        xFormat={(v) => dayLabel(Number(v))}
        series={[{ id: 'h', label: seriesLabel, values: history }]}
        forecast={{ values: forecast, lo, hi, label: forecastLabel }}
        marker={{ index: n - 1, label: todayLabel }}
        markers={peakDay > 0 ? [{ x: n - 1 + peakDay, label: peakLabel, tone: 'danger' }] : []}
        format={(v) => 'Rp ' + Math.round(v).toLocaleString('id-ID')}
        height={220}
        {...(summary ? { summary } : {})}
      />
    </div>
  )
}
