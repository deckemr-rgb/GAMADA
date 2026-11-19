/**
 * Harga — staple price lines (commodityIndex: the regional mean of every market, index 100 = the 30-day mean, the
 * same series Sinyal Pasar shows), anomaly markers from the price board, and per commodity a link to Sinyal Pasar
 * (?commodity=, only when that demo is ready). Up to 4 lines at once (chips).
 */
import { useMemo, useState } from 'react'
import AppLink from '../../components/AppLink'
import { DEMO_READY } from '../registry'
import { demoHref } from '../../demo-kit/shell'
import { TrendChart } from '../../demo-kit/viz'
import { useClock, useSession, useWorld, world } from '../../demo-kit/world'
import { commodityIndex, priceBoard } from '../../demo-kit/world/pasar-daerah'
import { nf, sgn, useT } from './strings'
import type { View } from './types'

const S = {
  id: { title: 'Indeks harga bahan pokok (30 hari)', unit: 'indeks, 100 = rata-rata 30 hari semua pasar', pick: 'Pilih komoditas (maks. 4)', table: 'Semua komoditas', c: 'Komoditas', i: 'Indeks hari ini', w: 'Perubahan 7 hari', a: 'Anomali', open: 'Buka di Sinyal Pasar', soon: 'Sinyal Pasar (demo tahap 4)', anomaly: (c: string, m: string) => `Anomali ${c} di ${m}`, today: 'Hari ini', src: 'Harga simulasi · pasar nyata di wilayah ini', max: 'Maksimal 4 garis: lepas satu dulu' },
  en: { title: 'Staple price index (30 days)', unit: 'index, 100 = 30-day mean of all markets', pick: 'Choose commodities (max 4)', table: 'All commodities', c: 'Commodity', i: 'Index today', w: '7-day change', a: 'Anomalies', open: 'Open in Sinyal Pasar', soon: 'Sinyal Pasar (stage 4 demo)', anomaly: (c: string, m: string) => `${c} anomaly at ${m}`, today: 'Today', src: 'Simulated prices · real markets in this region', max: 'At most 4 lines: remove one first' },
}

export default function Harga({ view }: { view: View }) {
  const { lang } = useT()
  const L = S[lang]
  void view
  const session = useSession()
  const now = useClock().minutes
  const prices = useWorld((s) => s.prices)
  const region = useWorld((s) => s.region)
  const facts = useWorld((s) => s.meta.facts.pd)
  const [on, setOn] = useState<string[]>(() => [...(facts?.shockCommodityIds ?? []), region.commodities.find((c) => !facts?.shockCommodityIds.includes(c.id))?.id].filter((x): x is string => !!x).slice(0, 3))
  const day = Math.floor(now / 1440)
  const data = useMemo(() => {
    const s = world.get()
    const board = priceBoard(s, now)
    return region.commodities.map((c) => {
      const b = board.filter((r) => r.commodityId === c.id)
      const idx = commodityIndex(s, c.id, 30)
      return {
        id: c.id, name: c.name, values: idx.values, today: idx.values[idx.values.length - 1] ?? 100,
        week: b.length ? b.reduce((a, r) => a + r.weekPct, 0) / b.length : 0,
        anomalies: b.filter((r) => r.anomaly).map((r) => s.markets.byId[r.marketId]?.name ?? r.marketId),
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prices, region, day, Math.floor(now / 30)])
  const shown = data.filter((d) => on.includes(d.id))
  const n = shown[0]?.values.length ?? 31
  const x = Array.from({ length: n }, (_, i) => (i === n - 1 ? L.today : `H−${n - 1 - i}`))
  const keep = () => (new URLSearchParams(window.location.search).get('controls') === 'all' ? '&controls=all' : '')
  const toggle = (id: string) => setOn((o) => (o.includes(id) ? (o.length > 1 ? o.filter((k) => k !== id) : o) : o.length >= 4 ? o : [...o, id]))
  return (
    <div className="dk-ie-harga" data-ie="harga">
      <div className="dk-ie-chips" role="group" aria-label={L.pick}>
        {data.map((d) => (
          <button key={d.id} type="button" className="dk-chip" aria-pressed={on.includes(d.id)} disabled={!on.includes(d.id) && on.length >= 4} title={!on.includes(d.id) && on.length >= 4 ? L.max : undefined} onClick={() => toggle(d.id)}>
            {d.name[lang]}
          </button>
        ))}
      </div>
      <TrendChart
        title={L.title}
        unit={L.unit}
        source={L.src}
        x={x}
        series={shown.map((d) => ({ id: d.id, label: d.name[lang], values: d.values }))}
        format={(v) => nf(lang, v, 1)}
        markers={shown.flatMap((d) => d.anomalies.slice(0, 1).map((m) => ({ x: n - 1, label: L.anomaly(d.name[lang], m), tone: 'danger' as const })))}
        height={260}
      />
      <section className="dk-ie-card">
        <h3 className="dk-ie-h3">{L.table}</h3>
        <table className="dk-ie-table">
          <thead>
            <tr>
              <th scope="col">{L.c}</th>
              <th scope="col">{L.i}</th>
              <th scope="col">{L.w}</th>
              <th scope="col">{L.a}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.id} data-commodity={d.id}>
                <th scope="row">
                  {DEMO_READY['sinyal-pasar'] ? <AppLink to={`${demoHref('sinyal-pasar', session)}&commodity=${d.id}${keep()}`} title={L.open}>{d.name[lang]}</AppLink> : d.name[lang]}
                </th>
                <td className="dk-num" data-label={L.i}>{nf(lang, d.today, 1)}</td>
                <td className="dk-num" data-label={L.w} data-tone={d.week > 0 ? 'up' : d.week < 0 ? 'down' : 'flat'}>{sgn(lang, d.week)}%</td>
                <td data-label={L.a}>{d.anomalies.length ? d.anomalies.join(', ') : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!DEMO_READY['sinyal-pasar'] && <p className="dk-ie-muted">{L.soon}</p>}
      </section>
    </div>
  )
}
