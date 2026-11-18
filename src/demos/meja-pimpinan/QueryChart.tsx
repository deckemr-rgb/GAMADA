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
  // the visible caption says "Data simulasi" only (the seed is a developer detail)
  const source = lang === 'id' ? 'Data simulasi' : 'Simulated data'
  const fmt = (v: number) => (res.format === 'pct' ? `${v.toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB', { maximumFractionDigits: 1 })}%` : res.format === 'rp' ? `Rp ${Math.round(v).toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB')}` : v.toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB', { maximumFractionDigits: 1 }))
  if (res.values && res.x) {
    const series = [{ id: 'v', label: res.title, values: res.values }]
    if (res.forecast) {
      const x = [...res.x, ...res.forecast.values.map((_, i) => (lang === 'id' ? `+${i + 1} hr` : `+${i + 1} d`))]
      return <AreaChart seed={seed} source={source} title={res.title} unit={res.unit} x={x} series={series} forecast={{ ...res.forecast, label: lang === 'id' ? 'Prakiraan' : 'Forecast' }} format={fmt} height={height ?? 150} marker={{ index: res.x.length - 1, label: lang === 'id' ? 'Hari ini' : 'Today' }} />
    }
    return <LineChart seed={seed} source={source} title={res.title} unit={res.unit} x={res.x} series={series} format={fmt} height={height ?? 150} zero={res.format !== 'rp'} />
  }
  // rows beyond the chart's room fold into one muted "Lainnya" bar, so the bars add up to the total in the answer
  // text; it counts only the rows that have a value now ("Lainnya · 7 kec.") and never wins "highest"
  // (percentages are not summed: a cut list of rates just says how many are shown)
  const cut = res.rows.length > maxRows
  const restRows = cut && res.format === 'num' ? res.rows.slice(maxRows - 1).filter((r) => r.value > 0 || (r.prev ?? 0) > 0) : []
  const byKec = res.spec.groupBy === 'kecamatan'
  const restN = restRows.filter((r) => r.value > 0).length
  const restLabel = lang === 'id' ? `Lainnya · ${restN} ${byKec ? 'kec.' : 'lain'}` : `Other · ${restN} ${byKec ? (restN === 1 ? 'district' : 'districts') : 'more'}`
  const named = cut && res.format === 'num' ? res.rows.slice(0, maxRows - 1) : res.rows.slice(0, maxRows)
  const rest = restRows.length ? restRows.reduce((a, r) => ({ ...a, value: a.value + r.value, prev: (a.prev ?? 0) + (r.prev ?? 0) }), { id: '__rest', label: restLabel, value: 0, prev: 0 } as QueryResult['rows'][number]) : null
  // the rest is a line under the chart, not a bar: one "Lainnya 45" bar would dwarf the named districts
  const rows = named
  const shownNote = cut && res.format !== 'num' ? (lang === 'id' ? ` · ${maxRows} dari ${res.rows.length} ditampilkan` : ` · ${maxRows} of ${res.rows.length} shown`) : ''
  const hasPrev = rows.some((r) => (r.prev ?? 0) > 0)
  const prevWord = lang === 'id' ? 'sebelumnya' : 'previous'
  // screen-reader summary: highest / lowest among the NAMED rows; a total only for counts
  const hiR = named.length ? named.reduce((a, r) => (r.value > a.value ? r : a), named[0]!) : null
  const loR = named.length ? named.reduce((a, r) => (r.value < a.value ? r : a), named[0]!) : null
  const summary = hiR && loR
    ? lang === 'id'
      ? `${res.title}: ${named.map((r) => `${r.label} ${fmt(r.value)}${hasPrev ? ` (${prevWord} ${fmt(r.prev ?? 0)})` : ''}`).join(', ')}${rest ? `; ${rest.label} ${fmt(rest.value)}` : ''}${shownNote}. Tertinggi: ${hiR.label}; terendah: ${loR.label}.${res.format === 'num' ? ` Total ${fmt(res.total)}.` : ''}`
      : `${res.title}: ${named.map((r) => `${r.label} ${fmt(r.value)}${hasPrev ? ` (${prevWord} ${fmt(r.prev ?? 0)})` : ''}`).join(', ')}${rest ? `; ${rest.label} ${fmt(rest.value)}` : ''}${shownNote}. Highest: ${hiR.label}; lowest: ${loR.label}.${res.format === 'num' ? ` Total ${fmt(res.total)}.` : ''}`
    : undefined
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
  // the previous period is written next to each name ("Sekar · sblm 1"): a ghost bar behind a longer current bar
  // could not be seen, a number always can
  const short = lang === 'id' ? 'sblm' : 'prev'
  const restLine = rest ? (
    <p className="dk-mp-qrest dk-num">
      {rest.label}: {fmt(rest.value)}
      {hasPrev ? ` · ${short} ${fmt(rest.prev ?? 0)}` : ''}
    </p>
  ) : null
  return (
    <>
    <BarChart
      seed={seed}
      title={res.title}
      unit={`${res.unit}${shownNote}${hasPrev ? (lang === 'id' ? ' · (angka) = periode sebelumnya' : ' · (number) = previous period') : ''}`}
      source={source}
      {...(summary ? { summary } : {})}
      className="dk-mp-qbar"
      orientation="horizontal"
      data={rows.map((r) => ({ id: r.id, label: hasPrev ? `${r.label} (${fmt(r.prev ?? 0)})` : r.label, value: r.value }))}
      format={fmt}
      height={height}
    />
    {restLine}
    </>
  )
}
