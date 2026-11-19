/**
 * Peta (lazy): MapView with one marker per real market coloured by Δ vs seasonal of the chosen commodity (popup =
 * the board price), active flood zones, and a "Daftar pasar" list for non-map use. A marker / list row opens the drawer.
 */
import { useMemo, useState } from 'react'
import { MapView, alertZones, type MapLayer, type MarkerItem } from '../../demo-kit/map'
import { Segmented } from '../../demo-kit/ui'
import { useShell } from '../../demo-kit/shell'
import { rows, useClock, useSession, useWorld } from '../../demo-kit/world'
import { priceBoard } from '../../demo-kit/world/pasar-daerah'
import { cName, cUnit } from './model'
import { pct, rp, type Lang } from './strings'
import { ui, useUi } from './store'

const S = {
  id: {
    title: 'Peta harga pasar',
    lead: (item: string) => `${item} per pasar · warna = selisih dari pola musiman (simulasi).`,
    view: 'Tampilan',
    map: 'Peta',
    list: 'Daftar pasar',
    pick: 'Pilih komoditas',
    aria: (item: string) => `Peta pasar dengan harga ${item}`,
    legend: ['Anomali', '≥ 5% di atas pola', 'Dalam pola'],
    open: (m: string) => `Buka detail di ${m}`,
    detail: (price: string, d: string) => `${price} · ${d} vs pola musiman (simulasi)`,
  },
  en: {
    title: 'Market price map',
    lead: (item: string) => `${item} per market · colour = gap to the seasonal pattern (simulated).`,
    view: 'View',
    map: 'Map',
    list: 'Market list',
    pick: 'Choose a commodity',
    aria: (item: string) => `Market map with ${item} prices`,
    legend: ['Anomaly', '≥ 5% above pattern', 'Within pattern'],
    open: (m: string) => `Open details at ${m}`,
    detail: (price: string, d: string) => `${price} · ${d} vs seasonal pattern (simulated)`,
  },
}

export default function Peta() {
  const { lang } = useSession()
  const L = lang as Lang
  const t = S[L]
  const u = useUi()
  const { pack } = useShell()
  const now = useClock().minutes
  const region = useWorld((s) => s.region)
  const markets = useWorld((s) => s.markets)
  const alerts = useWorld((s) => s.alerts)
  const first = useWorld((s) => s.meta.facts.pd?.shockCommodityIds[0] ?? s.region.commodities[0]?.id ?? '')
  const commodity = u.commodity || first
  const board = useWorld((s) => priceBoard(s, now, { commodity }))
  const [view, setView] = useState<'peta' | 'daftar'>('peta')
  const sw = { region, markets } as Parameters<typeof cName>[0]
  const item = cName(sw, commodity)[L]
  const unit = cUnit(sw, commodity)

  const items = useMemo<MarkerItem[]>(
    () =>
      board.flatMap((r) => {
        const m = markets.byId[r.marketId]
        if (!m) return []
        return [{ id: r.id, coord: m.coord, icon: 'cart', label: m.name, detail: t.detail(`${rp(r.price)}/${unit}`, pct(r.deltaPct, L)), tone: r.anomaly ? 'danger' : r.deltaPct >= 5 ? 'warn' : 'accent' } satisfies MarkerItem]
      }),
    [board, markets, t, unit, L],
  )
  const zones = useMemo(() => alertZones(rows(alerts)), [alerts])
  const layers = useMemo<MapLayer[]>(
    () => [
      { id: 'kec', kind: 'kecamatan', labels: 'name' },
      { id: 'zones', kind: 'zones', visible: zones.length > 0, zones },
      { id: 'markets', kind: 'markers', items },
    ],
    [items, zones],
  )
  const open = (id: string) => ui.set({ detail: id, panel: 'none' })

  return (
    <div className="dk-sp-map">
      <header className="dk-sp-boardbar">
        <div>
          <h2>{t.title}</h2>
          <p className="dk-sp-muted">{t.lead(item)}</p>
        </div>
        <Segmented size="sm" label={t.view} value={view} onChange={setView} options={[{ value: 'peta', label: t.map }, { value: 'daftar', label: t.list }]} />
      </header>
      <div className="dk-sp-chips" role="group" aria-label={t.pick}>
        {region.commodities.map((c) => (
          <button key={c.id} type="button" className="dk-chip" aria-pressed={commodity === c.id} onClick={() => ui.set({ commodity: c.id })}>
            {c.name[L]}
          </button>
        ))}
      </div>
      {view === 'peta' && pack ? (
        <div className="dk-sp-mapbox">
          <MapView regionId={pack.id} layers={layers} onMarker={(_l, id) => open(id)} ariaLabel={t.aria(item)} minHeight={420} />
          <ul className="dk-sp-legend" aria-label={t.title}>
            {t.legend.map((x, i) => (
              <li key={x}>
                <span className={`dk-sp-dot is-${['danger', 'warn', 'accent'][i]}`} aria-hidden="true" />
                {x}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ul className="dk-sp-mlist" aria-label={t.list}>
          {board.map((r) => (
            <li key={r.id} data-sp-pair={r.id}>
              <button type="button" className="dk-sp-mrow" aria-label={t.open(markets.byId[r.marketId]?.name ?? r.marketId)} onClick={() => open(r.id)}>
                <strong>{markets.byId[r.marketId]?.name ?? r.marketId}</strong>
                <span className="dk-num">{rp(r.price)}</span>
                <span className={`dk-num${r.anomaly ? ' is-high' : ''}`}>{pct(r.deltaPct, L)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
