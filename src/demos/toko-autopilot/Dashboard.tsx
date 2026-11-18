/**
 * Dasbor — KPI strip (outletKpis, vs yesterday at the same minute), "Transaksi masuk" (liveReceipts), "Perlu
 * perhatian", "Kejadian di daerah" (flood button / floodBanner, Pemda need card, Pantau Merek chip). A receipt opens
 * in a drawer (lazy Receipt). Every number comes from a world/usaha-pintar selector.
 */
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import AppLink from '../../components/AppLink'
import { demoHref } from '../../demo-kit/shell'
import { DEMO_READY } from '../registry'
import { Button, Drawer, Icon, Kpi, KpiStrip, LoadingText, flashNewRow } from '../../demo-kit/ui'
import { Sparkline } from '../../demo-kit/viz'
import { clock, hhmm, shallowEqual, useClock, useSession, useWorld, world, type WorldState } from '../../demo-kit/world'
import {
  activeBrandAlert, activeFloodAlert, ensureFloodScenario, floodBanner, hourlyTraffic, kecName, liveReceipts, outletKpis, poSuggestions, shopOpportunities, stockRisk,
} from '../../demo-kit/world/usaha-pintar'
import { nf, rp, tm, useT, type Lang } from './strings'
import { useOutlets } from './store'
import type { TabProps } from './types'

const Receipt = lazy(() => import('./Receipt'))
const dec = (n: number, lang: Lang) => n.toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
const pf = (n: number) => `${Math.round(n)}%`
const keep = () => (new URLSearchParams(window.location.search).get('controls') === 'all' ? '&controls=all' : '')

const hourly = (outletId: string, now: number) => (s: WorldState) => {
  const out: number[] = []
  for (let h = 5; h <= Math.floor(now / 60); h++) out.push(0)
  for (const id of s.sales.ids) {
    const x = s.sales.byId[id]
    if (!x || x.businessId !== s.meta.shopId || x.at < 5 * 60 || x.at > now || (outletId && x.outletId !== outletId)) continue
    const i = Math.floor(x.at / 60) - 5
    if (i >= 0 && i < out.length) out[i]! += x.total
  }
  return out
}

export default function Dashboard({ outletId, sel, go }: TabProps) {
  const { t, lang } = useT()
  const now = useClock().minutes
  const k = useWorld((s) => outletKpis(s, now))
  const kpi = outletId ? k.byOutlet[outletId] : k.total
  const spark = useWorld(useMemo(() => hourly(outletId, now), [outletId, now]), shallowEqual)
  const [open, setOpen] = useState<string | null>(null)
  useEffect(() => {
    if (sel?.kind === 'sale') setOpen(sel.id)
  }, [sel])
  const sim = <span className="dk-ta-sim">{t.sim}</span>
  return (
    <div className="dk-ta-grid">
      <KpiStrip label={t.kpiLabel} className="dk-ta-kpis">
        <Kpi
          label={t.kpiOmzet}
          value={kpi?.revenue ?? 0}
          format={rp}
          delta={(kpi?.vsYesterday.revenue ?? 0) * 100}
          deltaFormat={pf}
          deltaLabel={t.vsYday}
          caption={t.monthCap(rp(k.month))}
          spark={spark.length > 1 ? <Sparkline values={spark} label={t.sparkLabel} area format={rp} /> : undefined}
          wrapLabel
        />
        <Kpi label={t.kpiTx} value={kpi?.tx ?? 0} delta={(kpi?.vsYesterday.tx ?? 0) * 100} deltaFormat={pf} deltaLabel={t.vsYday} wrapLabel />
        <Kpi label={t.kpiAvg} value={kpi?.avgTicket ?? 0} format={rp} delta={(kpi?.vsYesterday.avgTicket ?? 0) * 100} deltaFormat={pf} deltaLabel={t.vsYday} wrapLabel />
        <Kpi
          label={t.kpiMargin}
          value={Math.round((kpi?.grossMargin ?? 0) * 1000) / 10}
          decimals={1}
          unit="%"
          delta={(kpi?.vsYesterday.grossMargin ?? 0) * 100}
          deltaFormat={(n) => `${dec(n, lang)} pp`}
          deltaLabel={t.vsYday}
          caption={t.sim}
          wrapLabel
        />
      </KpiStrip>
      <div className="dk-ta-dash">
        <Feed outletId={outletId} now={now} onOpen={setOpen} sim={sim} />
        <div className="dk-ta-col">
          <Attention outletId={outletId} now={now} go={go} />
          <Region now={now} go={go} />
        </div>
      </div>
      <Drawer open={!!open} onClose={() => setOpen(null)} title={t.receiptTitle(world.get().sales.byId[open ?? '']?.code ?? '')}>
        {open && (
          <Suspense fallback={<LoadingText>{t.loading}</LoadingText>}>
            <Receipt saleId={open} lang={lang} />
          </Suspense>
        )}
      </Drawer>
    </div>
  )
}

function Feed({ outletId, now, onOpen, sim }: { outletId: string; now: number; onOpen: (id: string) => void; sim: React.ReactNode }) {
  const { t, lang } = useT()
  const list = useWorld((s) => liveReceipts(s, now, 12, outletId || undefined), shallowEqual)
  const names = useWorld((s) => s.outlets)
  const ref = useRef<HTMLOListElement>(null)
  const first = useRef<string | null>(null)
  const [said, setSaid] = useState('')
  const lastSaid = useRef(0)
  useEffect(() => {
    const top = list[0]
    if (!top) return
    if (first.current && first.current !== top.id) {
      const el = ref.current?.querySelector<HTMLElement>(`[data-sale="${CSS.escape(top.id)}"]`)
      if (el) flashNewRow(el, { slide: true })
      if (Date.now() - lastSaid.current > 5000) {
        lastSaid.current = Date.now()
        setSaid(t.feedNew(top.code, rp(top.total)))
      }
    }
    first.current = top.id
  }, [list, t])
  return (
    <section className="dk-ta-card" aria-labelledby="dk-ta-feed-h">
      <header className="dk-ta-ch">
        <h3 id="dk-ta-feed-h">{t.feedTitle}</h3>
        {sim}
      </header>
      <p className="dk-sr" role="status" aria-live="polite">{said}</p>
      {list.length ? (
        <ol ref={ref} className="dk-ta-feed">
          {list.map((x) => (
            <li key={x.id} data-sale={x.id}>
              <button type="button" className="dk-ta-row" onClick={() => onOpen(x.id)}>
                <span className="dk-ta-t dk-num">{tm(hhmm(x.at), lang)}</span>
                <span className="dk-ta-main">
                  <b>{t.feedRow(x.code, x.items.reduce((a, i) => a + i.qty, 0))}</b>
                  <small>{names.byId[x.outletId]?.name} · {t.pay[x.payment]}{x.payments && x.payments.length > 1 ? ' +' : ''}</small>
                </span>
                <span className="dk-ta-amt dk-num">{rp(x.total)}</span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="dk-ta-muted">{t.feedEmpty}</p>
      )}
    </section>
  )
}

function Attention({ outletId, now, go }: { outletId: string; now: number; go: TabProps['go'] }) {
  const { t, lang } = useT()
  const outlets = useOutlets()
  const low = useWorld((s) => stockRisk(s, outletId || 'semua').filter((r) => r.onHand <= r.reorderPoint).length)
  const drafts = useWorld((s) => poSuggestions(s, now).filter((p) => p.poId).length)
  const peak = useWorld((s) => {
    const day = (new Date(`${s.day}T00:00:00Z`).getUTCDay() + 6) % 7
    const row = hourlyTraffic(s, outletId || outlets.toko)[day] ?? []
    let best = -1
    for (let h = Math.floor(now / 60) + 1; h < 24; h++) if ((row[h] ?? 0) > 0 && (best < 0 || row[h]! > row[best]!)) best = h
    return best < 0 ? null : `${best}|${Math.round(row[best]!)}`
  })
  const [ph, pn] = peak ? peak.split('|') : []
  return (
    <section className="dk-ta-card" aria-labelledby="dk-ta-attn-h">
      <header className="dk-ta-ch">
        <h3 id="dk-ta-attn-h">{t.attnTitle}</h3>
      </header>
      <ul className="dk-ta-attn">
        <li>
          <button type="button" className="dk-ta-row" onClick={() => go('prediksi')}>
            <Icon name="package" size={18} />
            <span className="dk-ta-main">{t.attnLow(low)}</span>
            <Icon name="forward" size={16} />
          </button>
        </li>
        <li>
          <button type="button" className="dk-ta-row" onClick={() => go('po')}>
            <Icon name="truck" size={18} />
            <span className="dk-ta-main">{t.attnDraft(drafts)}</span>
            <Icon name="forward" size={16} />
          </button>
        </li>
        <li>
          <button type="button" className="dk-ta-row" onClick={() => go('shift')}>
            <Icon name="users" size={18} />
            <span className="dk-ta-main">{peak ? t.attnPeak(tm(`${ph!.padStart(2, '0')}:00`, lang), Number(pn)) : t.attnNoPeak}</span>
            <Icon name="forward" size={16} />
          </button>
        </li>
      </ul>
    </section>
  )
}

const regionSel = (now: number) => (s: WorldState) => {
  const a = activeFloodAlert(s)
  const b = floodBanner(s)
  const o = shopOpportunities(s)[0]
  const it = o?.items[0]
  const br = activeBrandAlert(s, now)
  return {
    alert: a ? a.title : null,
    banner: b ? b.text : null,
    opp: o && it ? { id: o.need.id, qty: it.qty, unit: it.unit, name: it.name, kec: kecName(s, o.need.kecamatanId), stock: it.onHand } : null,
    brand: br ? { id: br.id, pct: Math.round(br.deltaPct) } : null,
  }
}
const regionEq = (a: ReturnType<ReturnType<typeof regionSel>>, b: typeof a) =>
  a.alert === b.alert && a.banner === b.banner && a.opp?.id === b.opp?.id && a.opp?.stock === b.opp?.stock && a.brand?.id === b.brand?.id && a.brand?.pct === b.brand?.pct

function Region({ now, go }: { now: number; go: TabProps['go'] }) {
  const { t, lang } = useT()
  const session = useSession()
  const r = useWorld(useMemo(() => regionSel(now), [now]), regionEq)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (r.alert) setBusy(false)
  }, [r.alert])
  return (
    <section className="dk-ta-card" aria-labelledby="dk-ta-reg-h">
      <header className="dk-ta-ch">
        <h3 id="dk-ta-reg-h">{t.regionTitle}</h3>
      </header>
      <div className="dk-ta-region" aria-live="polite">
        {r.banner ? (
          <div className="dk-ta-flood" data-tour="flood-banner">
            <Icon name="water" size={20} />
            <p>{r.banner[lang]}</p>
            <Button size="sm" variant="secondary" iconEnd="forward" onClick={() => go('prediksi', { kind: 'flood', id: 'flood' })}>
              {t.toForecast}
            </Button>
          </div>
        ) : r.alert ? (
          <div className="dk-ta-flood">
            <Icon name="water" size={20} />
            <p>{t.floodWait(r.alert[lang])}</p>
          </div>
        ) : (
          <div className="dk-ta-noflood">
            <p className="dk-ta-muted">{t.noFlood}</p>
            <Button
              size="sm"
              variant="secondary"
              icon="play"
              busy={busy}
              data-ta="play-flood"
              onClick={() => {
                setBusy(true)
                ensureFloodScenario(world.get(), clock.get().minutes)
              }}
            >
              {t.playFlood}
            </Button>
          </div>
        )}
        {r.opp && (
          <div className="dk-ta-opp" data-ta="opportunity">
            <Icon name="building" size={18} />
            <p>
              {t.oppTitle(nf(r.opp.qty, lang), r.opp.name[lang].toLowerCase(), r.opp.kec, nf(r.opp.stock, lang))}{' '}
              {DEMO_READY['katalog-lokal'] ? (
                <AppLink to={demoHref('katalog-lokal', session, r.opp.id) + keep()}>{t.oppOpen}</AppLink>
              ) : (
                <span className="dk-ta-muted">{t.oppSoon}</span>
              )}
            </p>
          </div>
        )}
        {r.brand &&
          (DEMO_READY['pantau-merek'] ? (
            <AppLink className="dk-ta-chip is-warn" data-ta="brand-chip" to={demoHref('pantau-merek', session, r.brand.id) + keep()}>
              <Icon name="alert" size={16} /> {t.brandChip(r.brand.pct)}
            </AppLink>
          ) : (
            <span className="dk-ta-chip is-warn" data-ta="brand-chip">
              <Icon name="alert" size={16} /> {t.brandChip(r.brand.pct)} <small>{t.brandSoon}</small>
            </span>
          ))}
      </div>
    </section>
  )
}
