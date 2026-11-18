/**
 * History.tsx (lazy: the Riwayat tab) — `bidHistory`: the shop's bids (menang / kalah / evaluasi / terkirim), win rate,
 * value won and a strip plot of bid / HPS.
 */
import { useMemo } from 'react'
import { Kpi, KpiStrip, Table, type TableColumn } from '../../demo-kit/ui'
import { useWorld, type WorldState } from '../../demo-kit/world'
import { bidHistory } from '../../demo-kit/world/usaha-pintar'
import { dateText, rp, rpShort } from './model'
import { useDocT } from './strings-doc'

type Row = ReturnType<typeof bidHistory>['rows'][number]
const whole = (s: WorldState) => s
const pct = (v: number, lang: 'id' | 'en') => `${(Math.round(v * 1000) / 10).toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB')}%`

export default function History() {
  const { d, lang } = useDocT()
  const s = useWorld(whole)
  const h = useMemo(() => bidHistory(s, s.meta.shopId), [s])
  const ratios = h.rows.map((r) => r.ratio).filter((r): r is number => r !== null)
  const lo = Math.min(...ratios, 1)
  const hi = Math.max(...ratios, 0)
  const x = (r: number) => Math.max(0, Math.min(1, (r - 0.8) / 0.2)) * 100
  const cols: TableColumn<Row>[] = [
    { id: 'code', header: d.histCols.code, value: (r) => r.tender?.code ?? r.tenderId, width: 110, card: 'meta' },
    { id: 'title', header: d.histCols.title, value: (r) => r.tender?.title[lang] ?? '', grow: 3, card: 'title' },
    { id: 'date', header: d.histCols.date, value: (r) => r.at, cell: (r) => dateText(s.day, r.at, lang), width: 120 },
    { id: 'price', header: d.histCols.price, value: (r) => r.price, cell: (r) => rp(r.price), numeric: true, align: 'end', width: 150 },
    { id: 'ratio', header: d.histCols.ratio, value: (r) => r.ratio, cell: (r) => (r.ratio !== null ? pct(r.ratio, lang) : '–'), numeric: true, align: 'end', width: 110 },
    { id: 'status', header: d.histCols.status, value: (r) => r.status, cell: (r) => <span className={`dk-tp-st is-${r.status}`}>{d.histStatus[r.status] ?? r.status}</span>, width: 110 },
  ]
  return (
    <div className="dk-tp-hist">
      <KpiStrip label={d.histTitle}>
        <Kpi label={d.histWin} value={Math.round(h.winRate * 100)} unit="%" />
        <Kpi label={d.histValue} value={h.valueWon} format={(v) => rpShort(v, lang)} />
        <Kpi label={d.histCount} value={h.rows.length} />
      </KpiStrip>
      <figure className="dk-tp-strip is-wide">
        <figcaption>{d.histStrip}</figcaption>
        <div className="dk-tp-strip-plot" role="img" aria-label={ratios.length ? d.histStripSum(pct(lo, lang), pct(hi, lang)) : d.histStrip}>
          <span className="dk-tp-strip-axis" />
          {h.rows.map((r) =>
            r.ratio !== null ? <i key={r.id} className={`dk-tp-strip-dot is-${r.status}`} style={{ left: `${x(r.ratio)}%` }} title={`${r.tender?.code ?? ''} ${pct(r.ratio, lang)}`} /> : null,
          )}
          <span className="dk-tp-strip-lo">80%</span>
          <span className="dk-tp-strip-hi">100%</span>
        </div>
        {ratios.length > 0 && <p className="dk-tp-muted">{d.histStripSum(pct(lo, lang), pct(hi, lang))}</p>}
      </figure>
      <Table rows={h.rows} columns={cols} rowId={(r) => r.id} label={d.histTitle} densityToggle={false} initialSort={{ id: 'date', desc: true }} />
    </div>
  )
}
