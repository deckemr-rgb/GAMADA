/**
 * ForecastChart — standalone (pure props, reusable by the product page mini): 30 days sold + 14-day forecast with
 * its band (demandForecast), marker on today. Data simulasi.
 */
import { AreaChart } from '../../demo-kit/viz'

export interface ForecastChartProps {
  title: string
  unit: string
  /** demo day 'YYYY-MM-DD' (x labels) */
  day: string
  history30: number[]
  forecast14: number[]
  lo: number[]
  hi: number[]
  labels: { sold: string; forecast: string; today: string }
  seed?: number
  height?: number
}

export default function ForecastChart({ title, unit, day, history30, forecast14, lo, hi, labels, seed, height = 220 }: ForecastChartProps) {
  const d0 = Date.parse(`${day}T00:00:00Z`)
  const x = Array.from({ length: history30.length + forecast14.length }, (_, i) => new Date(d0 + (i - history30.length) * 86_400_000))
  return (
    <div data-tour="forecast-chart" className="dk-ta-chart">
      <AreaChart
        title={title}
        unit={unit}
        seed={seed}
        x={x}
        series={[{ id: 'sold', label: labels.sold, values: history30 }]}
        forecast={{ values: forecast14, lo, hi, label: labels.forecast }}
        marker={{ index: history30.length, label: labels.today }}
        height={height}
        format={(v) => (Math.round(v * 10) / 10).toLocaleString('id-ID')}
      />
    </div>
  )
}
