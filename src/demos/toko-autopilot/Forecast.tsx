/**
 * Prediksi — stockRisk list ("habis dalam X hari", flood goods first while a flood alert is active), the selected
 * SKU's ForecastChart (demandForecast: 30 d + 14 d band) and its factor chips with a "Kenapa?" explanation. After a
 * flood alert the peach floodBanner (reaction reason, factor 4.4 = +340 %) shows on top. Phones: list first, chart
 * in a drawer.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useShell } from '../../demo-kit/shell'
import { Button, Drawer, Icon, flashNewRow } from '../../demo-kit/ui'
import { shallowEqual, useClock, useWorld } from '../../demo-kit/world'
import { demandForecast, floodBanner, stockRisk, type DemandForecast, type FactorKey } from '../../demo-kit/world/usaha-pintar'
import { nf, useT, type Lang } from './strings'
import ForecastChart from './ForecastChart'
import type { TabProps } from './types'

const S = {
  id: {
    list: 'Stok berisiko habis', onlyFlood: 'Hanya barang banjir', all: 'Semua barang', left: (d: string) => `habis dalam ${d} hari`, stock: (n: string, u: string) => `stok ${n} ${u}`,
    none: 'Tidak ada barang yang berisiko habis dalam 14 hari.', sold: 'Terjual per hari', fc: 'Perkiraan', today: 'Hari ini', unit: (u: string) => `${u} / hari`, factors: 'Faktor prediksi',
    why: 'Kenapa?', open: 'Lihat grafik', summary: (n: string, d: string) => `${n}: stok habis dalam ${d} hari pada laju perkiraan (simulasi).`,
    whyText: {
      musim: (n: string, p: number) => `Musim hujan: ${n} biasanya naik ±${p}% antara November dan Februari (pola penjualan 3 tahun, simulasi).`,
      gajian: (n: string, p: number) => `Tanggal gajian (25 s.d. 3) masuk rentang 14 hari ini: belanja ${n} naik ±${p}%.`,
      promo: (n: string, p: number) => `Promo yang berjalan menurunkan harga ${n}; permintaannya diperkirakan naik ${p}%.`,
    } as Record<string, (n: string, p: number) => string>,
  },
  en: {
    list: 'Stock at risk of running out', onlyFlood: 'Flood goods only', all: 'All items', left: (d: string) => `runs out in ${d} days`, stock: (n: string, u: string) => `stock ${n} ${u}`,
    none: 'No item is at risk of running out within 14 days.', sold: 'Sold per day', fc: 'Forecast', today: 'Today', unit: (u: string) => `${u} / day`, factors: 'Forecast factors',
    why: 'Why?', open: 'See chart', summary: (n: string, d: string) => `${n}: stock runs out in ${d} days at the forecast rate (simulated).`,
    whyText: {
      musim: (n: string, p: number) => `Rainy season: ${n} usually rises ±${p}% between November and February (3-year sales pattern, simulated).`,
      gajian: (n: string, p: number) => `Payday (25th to 3rd) falls inside these 14 days: ${n} purchases rise ±${p}%.`,
      promo: (n: string, p: number) => `A running promo lowers the price of ${n}; demand is expected to rise ${p}%.`,
    } as Record<string, (n: string, p: number) => string>,
  },
}
const days = (d: number, lang: Lang) => (Number.isFinite(d) ? d.toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB', { maximumFractionDigits: 1 }) : '∞')

export default function Forecast({ outletId, sel }: TabProps) {
  const { lang, t: T } = useT()
  const t = S[lang]
  const shell = useShell()
  const sm = shell.size === 'sm'
  const now = useClock().minutes
  const banner = useWorld(floodBanner, (a, b) => a?.alertId === b?.alertId && a?.pct === b?.pct)
  const [floodOnly, setFloodOnly] = useState(false)
  const [pick, setPick] = useState<string | null>(null)
  const [drawer, setDrawer] = useState(false)
  const listRef = useRef<HTMLUListElement>(null)
  useEffect(() => {
    if (!sel) return
    if (sel.kind === 'flood') {
      setFloodOnly(true)
      setPick(null)
    } else if (sel.kind === 'product') {
      setFloodOnly(false)
      setPick(sel.id)
      if (sm) setDrawer(true)
    }
  }, [sel, sm])
  const risk = useWorld((s) => stockRisk(s, outletId || 'semua', now))
  const pinned = useWorld((s) => (pick && !risk.some((r) => r.productId === pick) && s.products.byId[pick] ? pick : null))
  const pinnedRow = useWorld((s) => {
    if (!pinned) return null
    const p = s.products.byId[pinned]!
    const st = s.stock.byId[pinned]
    const f = demandForecast(s, pinned, now)
    return { productId: pinned, name: p.name, onHand: st?.onHand ?? 0, reorderPoint: st?.reorderPoint ?? 0, daysLeft: f?.daysLeft ?? 99, factor: st?.factor ?? 1, flood: false, reason: st?.reason ?? null }
  }, shallowEqual)
  const list = useMemo(() => {
    const l = (floodOnly ? risk.filter((r) => r.flood) : risk).slice(0, 30)
    return pinnedRow ? [pinnedRow, ...l] : l
  }, [risk, floodOnly, pinnedRow])
  const selId = pick && list.some((r) => r.productId === pick) ? pick : (list[0]?.productId ?? null)
  const fc = useWorld((s) => (selId ? demandForecast(s, selId, now) : null))
  const meta = useWorld((s) => (selId ? `${s.products.byId[selId]?.name ?? ''}|${s.products.byId[selId]?.unit ?? ''}|${s.day}|${s.seed}` : '|||'))
  useEffect(() => {
    if (!sel || sel.kind !== 'product') return
    const el = listRef.current?.querySelector<HTMLElement>(`[data-pid="${CSS.escape(sel.id)}"]`)
    if (!el) return
    el.scrollIntoView({ block: 'nearest' })
    return flashNewRow(el)
  }, [sel, list.length])

  const choose = (id: string) => {
    setPick(id)
    if (sm) setDrawer(true)
  }
  const detail = fc && <Detail fc={fc} meta={meta} lang={lang} />
  const { markMission } = shell
  const chartShown = !!fc && (!sm || drawer) && fc.factors.some((f) => f.key === 'banjir')
  useEffect(() => {
    if (chartShown) markMission('banjir')
  }, [chartShown, markMission])
  return (
    <div className="dk-ta-grid">
      {banner && (
        <div className="dk-ta-flood" data-tour="flood-banner" data-ta="forecast-banner" role="status">
          <Icon name="water" size={20} />
          <p>
            <b className="dk-num">+{banner.pct}%</b> {banner.text[lang]}
          </p>
        </div>
      )}
      <div className="dk-ta-fc">
        <section className="dk-ta-card" aria-labelledby="dk-ta-risk-h">
          <header className="dk-ta-ch">
            <h3 id="dk-ta-risk-h">{t.list}</h3>
            {banner && (
              <button type="button" className="dk-chip" aria-pressed={floodOnly} onClick={() => setFloodOnly(!floodOnly)} data-ta="flood-only">
                {floodOnly ? t.all : t.onlyFlood}
              </button>
            )}
            <span className="dk-ta-sim">{T.sim}</span>
          </header>
          {list.length ? (
            <ul ref={listRef} className="dk-ta-risk">
              {list.map((r) => (
                <li key={r.productId}>
                  <button type="button" className="dk-ta-row" aria-pressed={r.productId === selId} data-pid={r.productId} onClick={() => choose(r.productId)}>
                    <span className="dk-ta-main">
                      <b>{r.name}</b>
                      <small className="dk-num" data-onhand={r.onHand}>{t.stock(nf(r.onHand, lang), '')}</small>
                    </span>
                    <span className={`dk-ta-left dk-num${r.daysLeft < 3 ? ' is-bad' : ''}`}>{t.left(days(r.daysLeft, lang))}</span>
                    {r.flood && r.factor > 1 && <span className="dk-ta-chip is-warn dk-num">+{Math.round((r.factor - 1) * 100)}%</span>}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dk-ta-muted">{t.none}</p>
          )}
        </section>
        {!sm && <div className="dk-ta-card">{detail}</div>}
      </div>
      {sm && (
        <Drawer open={drawer && !!fc} onClose={() => setDrawer(false)} title={meta.split('|')[0] ?? ''}>
          {detail}
        </Drawer>
      )}
      {sm && fc && !drawer && (
        <Button variant="secondary" icon="chart" onClick={() => setDrawer(true)}>
          {t.open}
        </Button>
      )}
    </div>
  )
}

function Detail({ fc, meta, lang }: { fc: DemandForecast; meta: string; lang: Lang }) {
  const t = S[lang]
  const [name = '', unit = '', day = '', seed = '1'] = meta.split('|')
  const [why, setWhy] = useState<FactorKey | null>(null)
  const reason = useWorld((s) => s.stock.byId[fc.productId]?.reason ?? null)
  const text = (k: FactorKey, p: number) => (k === 'banjir' || k === 'harga' ? (reason?.[lang] ?? '') : (t.whyText[k]?.(name, p) ?? ''))
  return (
    <div className="dk-ta-detail" data-pid={fc.productId}>
      <ForecastChart
        title={name}
        unit={t.unit(unit)}
        day={day}
        seed={Number(seed)}
        history30={fc.history30}
        forecast14={fc.forecast14}
        lo={fc.lo}
        hi={fc.hi}
        labels={{ sold: t.sold, forecast: t.fc, today: t.today }}
      />
      <p className="dk-ta-muted">{t.summary(name, days(fc.daysLeft, lang))}</p>
      <div className="dk-ta-factors" role="group" aria-label={t.factors}>
        {fc.factors.map((f) => (
          <span key={f.key} className={`dk-ta-factor${f.key === 'banjir' ? ' is-warn' : ''}`} data-factor={f.key}>
            {f.label[lang]} <b className="dk-num">+{f.pct}%</b>
            <button type="button" className="dk-ta-why" aria-expanded={why === f.key} onClick={() => setWhy(why === f.key ? null : f.key)}>
              {t.why}
            </button>
          </span>
        ))}
      </div>
      {why && (
        <p className="dk-ta-whytext" role="note" data-ta="why">
          {text(why, fc.factors.find((f) => f.key === why)?.pct ?? 0)}
        </p>
      )}
    </div>
  )
}
