/**
 * QueryChart — draws a QueryResult with the kit charts: categorical rows → horizontal bars (with last period as
 * ghost bars), daily series → line (with a forecast band when asked), "table" → a compact list. Every chart says
 * "Data simulasi" (ChartFrame).
 */
import type { Lang } from '../../lib/i18n'
import { AreaChart, BarChart, LineChart } from '../../demo-kit/viz'
import { useSession } from '../../demo-kit/world'
import type { QueryResult } from './query'


export function QueryChart({ res, lang, height, maxRows = 6 }: { res: QueryResult; lang: Lang; height?: number; maxRows?: number }) {
  const { seed } = useSession()
  const fmt = (v: number) => (res.format === 'pct' ? `${v.toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB', { maximumFractionDigits: 1 })}%` : res.format === 'rp' ? `Rp ${Math.round(v).toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB')}` : v.toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB', { maximumFractionDigits: 1 }))
  if (res.values && res.x) {
    const series = [{ id: 'v', label: res.title, values: res.values }]
    if (res.forecast) {
      const x = [...res.x, ...res.forecast.values.map((_, i) => (lang === 'id' ? `+${i + 1} hr` : `+${i + 1} d`))]
      return <AreaChart seed={seed} title={res.title} unit={res.unit} x={x} series={series} forecast={{ ...res.forecast, label: lang === 'id' ? 'Prakiraan' : 'Forecast' }} format={fmt} height={height ?? 150} marker={{ index: res.x.length - 1, label: lang === 'id' ? 'Hari ini' : 'Today' }} />
    }
    return <LineChart seed={seed} title={res.title} unit={res.unit} x={res.x} series={series} format={fmt} height={height ?? 150} zero={res.format !== 'rp'} />
  }
  const rows = res.rows.slice(0, maxRows)
  if (!rows.length) return <p className="dk-mp-meta">{lang === 'id' ? 'Tidak ada data untuk kriteria ini.' : 'No data for this criterion.'}</p>
  if (res.chart === 'table' || res.chart === 'none')
    return (
      <ul className="dk-mp-qtable" aria-label={res.title}>
        {rows.map((r) => (
          <li key={r.id}>
            <span>{r.label}</span>
            <span className="dk-num">{fmt(r.value)}</span>
          </li>
        ))}
      </ul>
    )
  const hasPrev = rows.some((r) => (r.prev ?? 0) > 0)
  return (
    <BarChart
      seed={seed}
      title={res.title}
      unit={res.unit}
      orientation="horizontal"
      data={rows.map((r) => ({ id: r.id, label: r.label, value: r.value, ...(hasPrev ? { prev: r.prev ?? 0 } : {}) }))}
      format={fmt}
      {...(hasPrev ? { valueLabel: lang === 'id' ? 'Periode ini' : 'This period', prevLabel: lang === 'id' ? 'Sebelumnya' : 'Previous' } : {})}
      height={height}
    />
  )
}
