/**
 * HpsTab.tsx — "HPS vs Pasar": item table (HPS, market median, deviation, gap; + corrected HPS after the
 * recommendation), deviation bar chart, and the local SME benchmark (Katalog Lokal). The memo quotes these same
 * numbers through the same formatters (model.ts).
 */
import { useMemo, useRef } from 'react'
import { Link } from 'react-router'
import { Badge, Icon, Panel, Table, useElementWidth, type TableColumn } from '../../demo-kit/ui'
import { BarChart } from '../../demo-kit/viz'
import { demoHref } from '../../demo-kit/shell'
import { useSession, useWorld, type WorldState } from '../../demo-kit/world'
import { hpsVsMarket, type ItemDeviation } from '../../demo-kit/world/satu-daerah'
import { CORRECTION_MARGIN, correctedUnit, localOffers, needOf, pct, qtyUnit, rpFull, rpShort } from './model'
import { useT } from './strings'

const all = (s: WorldState) => s

/**
 * The kit bar chart caps its label column at 38% of the width but does not shorten the text, so long item names
 * spill past the panel on phones. Shorten to what fits (≈ 5.8 px per character at 11 px) and keep the full name in the
 * tooltip note. Kit fix requested in the report (kitHandoff).
 */
function fitLabel(label: string, chartW: number): string {
  if (!chartW) return label
  const max = Math.max(8, Math.floor((chartW * 0.38 - 10) / 5.8))
  if (label.length <= max) return label
  const cut = label.slice(0, max - 1)
  const sp = cut.lastIndexOf(' ')
  // never end on an unclosed "(…" or a dangling separator
  return `${(sp > max * 0.5 ? cut.slice(0, sp) : cut).replace(/\s*\([^)]*$/, '').replace(/[\s&,–-]+$/, '')}…`
}

export default function HpsTab({ id }: { id: string }) {
  const { t, lang } = useT()
  const s = useWorld(all)
  const p = s.procurements.byId[id]
  // recomputed only when the tables they read change identity (structural sharing in the reducers)
  const hv = useMemo(() => hpsVsMarket(s, id), [s.procurements, id]) // eslint-disable-line react-hooks/exhaustive-deps
  const local = useMemo(() => localOffers(s, id), [s.procurements, s.catalogNeeds, s.matches, s.businesses, id]) // eslint-disable-line react-hooks/exhaustive-deps
  const need = useMemo(() => needOf(s, id), [s.catalogNeeds, id]) // eslint-disable-line react-hooks/exhaustive-deps
  const corrected = !!p?.recommendation
  const chartRef = useRef<HTMLDivElement>(null)
  // the chart frame pads its plot by ≈ 17 px a side
  const chartW = Math.max(0, useElementWidth(chartRef) - 34)

  const boxRef = useRef<HTMLDivElement>(null)
  const boxW = useElementWidth(boxRef)
  // tablets: the volume moves under the item name, so every money column fits without a hidden scroll
  const fold = boxW > 0 && boxW < (corrected ? 860 : 760)
  const columns = useMemo<TableColumn<ItemDeviation>[]>(() => {
    const c: TableColumn<ItemDeviation>[] = [
      // the item name gets the spare width (the money columns are fixed-width): fewer names end in an ellipsis
      {
        id: 'item',
        header: t.colItem,
        card: 'title',
        min: 150,
        grow: 4,
        value: (r) => r.name[lang],
        cell: (r) =>
          fold ? (
            <span className="dk-ab-itemcell" title={r.name[lang]}>
              <span>{r.name[lang]}</span>
              <small className="dk-num">{qtyUnit(r.qty, r.unit, lang)}</small>
            </span>
          ) : (
            <span title={r.name[lang]}>{r.name[lang]}</span>
          ),
      },
      ...(fold ? [] : [{ id: 'qty', header: t.colQty, numeric: true, min: 76, value: (r: ItemDeviation) => r.qty, cell: (r: ItemDeviation) => qtyUnit(r.qty, r.unit, lang) }]),
      // tablets: the unit HPS and the market median share one column (two lines)
      ...(fold
        ? [
            {
              id: 'hps',
              header: t.colHpsVsMarket,
              numeric: true,
              min: 124,
              value: (r: ItemDeviation) => r.hps,
              cell: (r: ItemDeviation) => (
                <span className="dk-ab-itemcell is-num">
                  <span>{rpFull(r.hps, lang)}</span>
                  <small>{t.marketShort(rpFull(r.market, lang))}</small>
                </span>
              ),
            },
          ]
        : [
            { id: 'hps', header: t.colHpsUnit, numeric: true, min: 108, value: (r: ItemDeviation) => r.hps, cell: (r: ItemDeviation) => rpFull(r.hps, lang) },
            { id: 'market', header: t.colMarket, numeric: true, min: 118, value: (r: ItemDeviation) => r.market, cell: (r: ItemDeviation) => rpFull(r.market, lang) },
          ]),
      {
        id: 'dev',
        header: t.colDev,
        numeric: true,
        card: 'meta',
        min: 88,
        value: (r) => r.devPct,
        cell: (r) => <Badge tone={r.level === 'tinggi' ? 'danger' : r.level === 'waspada' ? 'warn' : 'neutral'}>{pct(r.devPct, lang, true)}</Badge>,
      },
      { id: 'gap', header: t.colGap, numeric: true, min: 118, value: (r) => r.overpay, cell: (r) => rpFull(r.overpay, lang) },
    ]
    if (corrected) c.push({ id: 'fix', header: t.colCorrected, numeric: true, min: 118, value: (r) => correctedUnit(r.market) * r.qty, cell: (r) => <span className="dk-ab-fixed">{rpFull(correctedUnit(r.market) * r.qty, lang)}</span> })
    return c
  }, [t, lang, corrected, fold])

  if (!p) return null
  const top = [...hv.items].sort((a, b) => b.devPct - a.devPct)[0]
  const keep = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('controls') === 'all' ? '&controls=all' : ''

  return (
    <div ref={boxRef} className="dk-ab-hps">
      <Table<ItemDeviation>
        rows={hv.items}
        columns={columns}
        rowId={(r) => r.name.id}
        label={t.hpsTitle}
        densityToggle={false}
        highlightNew={false}
        rowTone={(r) => (r.level === 'tinggi' ? 'danger' : r.level === 'waspada' ? 'warn' : undefined)}
        toolbar={
          <span className="dk-ab-tt">
            <Icon name="coins" size={16} />
            {t.hpsTitle}
            <span className="dk-ab-simtag">{t.sim}</span>
          </span>
        }
      />
      <dl className="dk-ab-total" aria-label={t.total}>
        <div>
          <dt>{t.total} · {t.hps}</dt>
          <dd className="dk-num" data-ab="total-hps">{rpFull(hv.hps, lang)}</dd>
        </div>
        <div>
          <dt>{t.colMarket}</dt>
          <dd className="dk-num" data-ab="total-market">{rpFull(hv.market, lang)}</dd>
        </div>
        <div className="is-gap">
          <dt>{t.colGap}</dt>
          <dd className="dk-num" data-ab="total-gap">
            {rpFull(hv.overpay, lang)} <span>({pct(hv.devPct, lang, true)})</span>
          </dd>
        </div>
      </dl>
      {corrected && p.recommendation && (
        <p className="dk-ab-fixnote" role="status">
          <Icon name="check" size={16} />
          {t.correctedNote(rpFull(p.hps, lang), rpFull(p.recommendation.hpsCorrected, lang), rpFull(p.hps - p.recommendation.hpsCorrected, lang), Math.round(CORRECTION_MARGIN * 100))}
        </p>
      )}
      <div className="dk-ab-hps-grid">
        <div ref={chartRef} className="dk-ab-chartbox">
        <BarChart
          title={t.devChart}
          unit={t.devUnit}
          seed={s.seed}
          orientation="horizontal"
          valueLabels
          height={Math.max(140, hv.items.length * 36 + 24)}
          format={(v) => pct(v, lang)}
          axisFormat={(v) => `${Math.round(v)}%`}
          summary={top ? t.devSummary(top.name[lang], pct(top.devPct, lang)) : undefined}
          target={{ value: 20, label: t.hpsLegendHigh }}
          data={hv.items.map((i) => {
            const label = fitLabel(i.name[lang], chartW)
            const money = `${rpShort(i.hps, lang)} vs ${rpShort(i.market, lang)}`
            return { id: i.name.id, label, value: i.devPct, tone: i.level === 'tinggi' ? 'danger' : i.level === 'waspada' ? 'warn' : undefined, note: label === i.name[lang] ? money : `${i.name[lang]} · ${money}` }
          })}
        />
        </div>
        <Panel title={t.localTitle} icon="katalog" className="dk-ab-local">
          <p className="dk-ab-muted">{t.localLead}</p>
          <ul className="dk-ab-local-list">
            {local.map((x) => (
              <li key={x.item.name.id}>
                <p className="dk-ab-local-item">{x.item.name[lang]}</p>
                {x.offers.length ? (
                  <ul>
                    {x.offers.map((o) => (
                      <li key={o.businessId} className={o.matched ? 'is-matched' : undefined}>
                        <span className="dk-ab-local-n">
                          {o.name}
                          <small>
                            {o.kecamatan} · {o.matched ? t.localMatched : t.localOffer}
                          </small>
                        </span>
                        <span className="dk-ab-local-p dk-num">
                          {rpShort(o.price, lang)}
                          <small>{t.vsHps(pct(((o.price - x.item.hps) / x.item.hps) * 100, lang, true))}</small>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="dk-ab-faint">{t.localNone}</p>
                )}
              </li>
            ))}
          </ul>
          {need && (
            <p className="dk-ab-need">
              <Icon name="send" size={14} />
              {t.localNeedSent(need.code)}
              <LocalLink keep={keep} label={t.localOpen} focus={need.id} />
            </p>
          )}
        </Panel>
      </div>
    </div>
  )
}

function LocalLink({ keep, label, focus }: { keep: string; label: string; focus: string }) {
  const session = useSession()
  return (
    <Link className="dk-ab-inlink" to={demoHref('katalog-lokal', session, focus) + keep}>
      {label}
      <Icon name="external" size={12} />
    </Link>
  )
}
