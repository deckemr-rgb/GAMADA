/**
 * Desk — the Disperindag side of Sinyal Pasar: BrowserFrame, Ticker, tabs (Ringkasan here; Peta, Operasi Pasar,
 * Langganan, the detail drawer and "Tanya Sinyal Pasar" are lazy chunks fetched on intent). Ringkasan = KPI strip
 * (`pdKpi`), Board (`priceBoard`) and the region / warning / anomaly cards. The clock starts by itself at 07.00 and the
 * scenario flood plays at 07.06 (world/flood-scenario, imported then). Every number comes from world/pasar-daerah.
 */
import { Suspense, lazy, startTransition, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import AppLink from '../../components/AppLink'
import { DEMO_READY } from '../registry'
import { demoHref, intentProps, replaceQuery, usePreloadOnIntent, useShell } from '../../demo-kit/shell'
import { BrowserFrame } from '../../demo-kit/frames'
import { Button, IconButton, Kpi, KpiStrip, LoadingText, Select, flashNewRow, motionMode } from '../../demo-kit/ui'
import { FLOOD_AT, floodOf, playFlood, useAutoplay, useFloodAutoplay } from './live'
import { hhmm, onEvent, rows, useClock, useSession, useWorld, world, DAY_MIN, type WorldState } from '../../demo-kit/world'
import { pdKpi, priceBoard, priceTicker, weekChangeOf } from '../../demo-kit/world/pasar-daerah'
import { Ticker, type TickerItem } from './Ticker'
import { Board, type BoardItem } from './Board'
import { AlertList, RegionCard, SideCard, type AlertLine } from './Cards'
import { SLUG, pct, rp, tm, useT, type Lang, type Strings } from './strings'
import { cName, cUnit, latestTick, mName } from './model'
import { SP_TABS, ui, useUi, type TabId } from './store'

const loadDetail = () => import('./Detail')
const loadPeta = () => import('./Peta')
const loadOperasi = () => import('./Operasi')
const loadLangganan = () => import('./Langganan')
const loadAssist = () => import('./Assist')
const Detail = lazy(loadDetail)
const Peta = lazy(loadPeta)
const Operasi = lazy(loadOperasi)
const Langganan = lazy(loadLangganan)
const Assist = lazy(loadAssist)
const LOAD: Record<TabId, (() => Promise<unknown>) | null> = { ringkasan: null, peta: loadPeta, operasi: loadOperasi, langganan: loadLangganan }

const keep = () => (new URLSearchParams(window.location.search).get('controls') === 'all' ? '&controls=all' : '')

/* ------------------------------------------------------------------ world hooks */

/** own toasts: anomaly (C33), early warning (C31), the demo's auto-approval of a sent recommendation */
function useEventToasts(t: Strings, lang: Lang) {
  const { toast } = useShell()
  useEffect(() => {
    const offs = [
      onEvent('price.anomaly', (e) => {
        const s = world.get()
        const id = `${e.payload.marketId}:${e.payload.commodityId}`
        toast({ title: t.toastAnom(cName(s, e.payload.commodityId)[lang], mName(s, e.payload.marketId), pct(e.payload.deltaPct, lang)), body: t.toastAnomBody, tone: 'danger', icon: 'alert', onActivate: () => ui.set({ tab: 'ringkasan', detail: id, panel: 'none' }) })
      }),
      onEvent('price.warning', (e) => {
        const s = world.get()
        toast({ title: t.toastWarn(cName(s, e.payload.commodityId)[lang].toLowerCase(), pct(e.payload.peakPct, lang), e.payload.peakInDays), tone: 'warn', icon: 'bell', onActivate: () => ui.set({ tab: 'ringkasan', warn: e.payload.id ?? null, n: ui.get().n + 1 }) })
      }),
      onEvent('instruction.issued', (e) => {
        const o = e.payload.origin
        if (!o?.startsWith('marketOps:')) return
        const s = world.get()
        const op = s.marketOps.byId[o.slice('marketOps:'.length)]
        if (!op?.sentBy) return
        toast({ title: t.toastApproved(cName(s, op.commodityId)[lang].toLowerCase()), body: t.toastApprovedBody, tone: 'accent', icon: 'checkCircle', action: { label: t.toOperasi, onClick: () => ui.set({ tab: 'operasi', op: op.id, detail: null }) } })
      }),
    ]
    return () => {
      for (const off of offs) off()
    }
  }, [toast, t, lang])
}

/* ------------------------------------------------------------------ desk */

export default function Desk() {
  const { t, lang } = useT()
  const shell = useShell()
  const u = useUi()
  const [ask, setAsk] = useState(false)
  const askRef = usePreloadOnIntent<HTMLButtonElement>(loadAssist)
  useAutoplay(shell.present)
  useFloodAutoplay()
  useEventToasts(t, lang)
  useEffect(() => void replaceQuery({ tab: u.tab === 'ringkasan' ? null : u.tab, commodity: u.commodity || null, market: u.market || null }), [u.tab, u.commodity, u.market])

  const go = useCallback((k: TabId) => startTransition(() => ui.set({ tab: k })), [])
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const onKey = (e: KeyboardEvent) => {
    const i = SP_TABS.indexOf(u.tab)
    const j = e.key === 'ArrowRight' ? (i + 1) % SP_TABS.length : e.key === 'ArrowLeft' ? (i + SP_TABS.length - 1) % SP_TABS.length : e.key === 'Home' ? 0 : e.key === 'End' ? SP_TABS.length - 1 : -1
    if (j < 0) return
    e.preventDefault()
    go(SP_TABS[j]!)
    tabRefs.current[SP_TABS[j]!]?.focus()
  }

  return (
    <BrowserFrame
      slug={SLUG}
      path={u.tab === 'ringkasan' ? SLUG : `${SLUG}/${u.tab}`}
      label={t.frameLabel}
      actions={
        shell.size === 'sm' ? (
          <IconButton ref={askRef} icon="spark" label={t.askAi} onClick={() => setAsk(true)} aria-haspopup="dialog" />
        ) : (
          <Button ref={askRef} size="sm" variant="ghost" icon="spark" onClick={() => setAsk(true)} aria-haspopup="dialog">
            {t.askAi}
          </Button>
        )
      }
    >
      <div className="dk-sp" data-tab={u.tab}>
        <TickerBar t={t} lang={lang} />
        <div className="dk-sp-tabs" role="tablist" aria-label={t.tabsLabel} onKeyDown={onKey}>
          {SP_TABS.map((k) => {
            const load = LOAD[k]
            return (
              <button
                key={k}
                ref={(el) => void (tabRefs.current[k] = el)}
                type="button"
                role="tab"
                id={`dk-sp-tab-${k}`}
                aria-selected={u.tab === k}
                aria-controls="dk-sp-panel"
                tabIndex={u.tab === k ? 0 : -1}
                className="dk-sp-tab"
                {...(load ? intentProps(load) : {})}
                onClick={() => go(k)}
              >
                {t.tabs[k]}
              </button>
            )
          })}
        </div>
        <div id="dk-sp-panel" role="tabpanel" aria-labelledby={`dk-sp-tab-${u.tab}`} className="dk-sp-panel">
          <Suspense fallback={<LoadingText>{t.loading}</LoadingText>}>
            {u.tab === 'ringkasan' && <Ringkasan t={t} lang={lang} />}
            {u.tab === 'peta' && <Peta />}
            {u.tab === 'operasi' && <Operasi />}
            {u.tab === 'langganan' && <Langganan />}
          </Suspense>
        </div>
      </div>
      {u.detail && (
        <Suspense fallback={null}>
          <Detail id={u.detail} />
        </Suspense>
      )}
      {ask && (
        <Suspense fallback={null}>
          <Assist open={ask} onClose={() => setAsk(false)} />
        </Suspense>
      )}
    </BrowserFrame>
  )
}

/* ------------------------------------------------------------------ ticker */

function TickerBar({ t, lang }: { t: Strings; lang: Lang }) {
  const list = useWorld((s) => priceTicker(s, 0))
  const markets = useWorld((s) => s.markets)
  const region = useWorld((s) => s.region)
  const latest = useWorld(latestTick)
  const sw = { region, markets } as WorldState
  const items: TickerItem[] = list.map((r) => ({
    id: r.id, item: cName(sw, r.commodityId)[lang], market: mName(sw, r.marketId), price: rp(r.price), week: pct(r.weekPct, lang), up: r.weekPct > 0, anomaly: r.anomaly,
  }))
  const latestText = latest
    ? t.lastTickText(tm(hhmm(latest.updatedAt), lang), mName(sw, latest.marketId), cName(sw, latest.commodityId)[lang], rp(latest.price), pct(Math.round(weekChangeOf(latest.price, latest.history) * 1000) / 10, lang))
    : null
  // a tick lands ⇒ its ticker cell and board row flash (≈ every world minute while open)
  const key = latest ? `${latest.id}@${latest.updatedAt}@${latest.price}` : ''
  useEffect(() => {
    if (!key) return
    const id = key.split('@')[0]!
    for (const el of document.querySelectorAll<HTMLElement>(`[data-sp-pair="${CSS.escape(id)}"]`)) flashNewRow(el, { slide: false })
  }, [key])
  return <Ticker items={items} label={t.tickerLabel} pauseLabel={t.tickerPause} playLabel={t.tickerPlay} latest={latestText} latestLabel={t.lastTick} />
}

/* ------------------------------------------------------------------ ringkasan */

function Ringkasan({ t, lang }: { t: Strings; lang: Lang }) {
  const now = useClock().minutes
  const u = useUi()
  const { regionId, seed, present } = useSession()
  const kpi = useWorld((s) => pdKpi(s, now))
  const all = useWorld((s) => priceBoard(s, now))
  const board = useWorld((s) => priceBoard(s, now, { commodity: u.commodity, market: u.market }))
  const region = useWorld((s) => s.region)
  const markets = useWorld((s) => s.markets)
  const prices = useWorld((s) => s.prices)
  const warnTable = useWorld((s) => s.priceWarnings)
  const shocks = useWorld((s) => s.priceShocks)
  const flood = useWorld(floodOf)
  const [more, setMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const boardRef = usePreloadOnIntent<HTMLDivElement>(loadDetail)
  const sw = { region, markets } as WorldState
  const open = useCallback((id: string) => ui.set({ detail: id, panel: 'none' }), [])

  const day0 = Math.floor(now / DAY_MIN) * DAY_MIN
  const warnings = useMemo(() => rows(warnTable).filter((w) => w.at >= day0 && w.at <= now).sort((a, b) => b.at - a.at || a.id.localeCompare(b.id)), [warnTable, day0, now])
  const anomalies = all.filter((r) => r.anomaly)
  const visible = more ? board : board.slice(0, 12)
  const anomVisible = visible.find((r) => r.anomaly)?.id ?? null

  // hotspot target: the anomaly row ⇒ else the anomaly card ⇒ else (no flood yet) the scenario button ⇒ else the warning
  const hot = anomVisible ? 'board' : anomalies.length ? 'anom' : !flood ? 'flood' : warnings.length ? 'warn' : null

  const items: BoardItem[] = visible.map((r) => {
    const item = cName(sw, r.commodityId)[lang]
    const market = mName(sw, r.marketId)
    const status = r.anomaly ? 'anomaly' : r.warning ? 'warning' : 'normal'
    return {
      id: r.id, item, market, price: rp(r.price), unit: t.perUnit(cUnit(sw, r.commodityId)), week: pct(r.weekPct, lang), weekUp: r.weekPct > 0, delta: pct(r.deltaPct, lang), deltaHigh: r.deltaPct >= 5,
      spark: r.spark14, status, statusLabel: status === 'anomaly' ? t.anomaly : status === 'warning' ? t.warning : t.normal, openLabel: t.rowOpen(item, market), sparkLabel: t.sparkLabel(item),
    }
  })

  const warnLines: AlertLine[] = warnings.map((w) => ({
    id: w.id, text: t.warnText(cName(sw, w.commodityId)[lang], pct(w.peakPct, lang), w.peakInDays, mName(sw, w.marketIds[0] ?? '')), meta: t.warnMeta(tm(hhmm(w.at), lang), w.marketIds.length),
  }))
  const anomLines: AlertLine[] = anomalies.map((r) => ({
    id: r.id, text: t.anomText(cName(sw, r.commodityId)[lang], mName(sw, r.marketId), pct(r.deltaPct, lang)), meta: t.anomMeta(rp(r.price), tm(hhmm(prices.byId[r.id]?.updatedAt ?? now), lang)),
  }))

  // ?focus=PDN-… / GJ-…: scroll to the warning card and flash it
  useEffect(() => {
    if (!u.warn) return
    const el = document.querySelector<HTMLElement>(`[data-sp-alert="${CSS.escape(u.warn)}"]`)
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: motionMode() === 'full' ? 'smooth' : 'auto' })
      flashNewRow(el, { slide: false })
    }
    ui.set({ warn: null })
  }, [u.warn, u.n])

  const floodMarkets = flood
    ? (() => {
        const sh = rows(shocks).find((x) => x.cause === `alerts:${flood.id}`)
        return sh ? t.floodMarkets(sh.marketIds.length, sh.marketIds.map((m) => mName(sw, m)).join(', ')) : null
      })()
    : null
  const session = { regionId, seed, lang, present }

  return (
    <div className="dk-sp-ring">
      <div className="dk-sp-kpihead">
        <span className="dk-sp-sim">{t.sim}</span>
      </div>
      <KpiStrip label={t.kpiLabel} className="dk-sp-kpis">
        <Kpi label={t.kpi.commodities} value={kpi.commodities} wrapLabel />
        <Kpi label={t.kpi.markets} value={kpi.markets} wrapLabel />
        <Kpi label={t.kpi.anomalies} value={kpi.anomalies} caption={t.kpiCap.anomalies} wrapLabel />
        <Kpi label={t.kpi.warnings} value={kpi.warnings} caption={t.kpiCap.warnings} wrapLabel />
        <Kpi label={t.kpi.subscribers} value={kpi.subscribers} caption={t.kpiCap.subscribers} wrapLabel />
      </KpiStrip>
      <div className="dk-sp-main">
        <section className="dk-sp-boardbox" aria-labelledby="dk-sp-board-h" ref={boardRef}>
          <header className="dk-sp-boardbar">
            <div>
              <h2 id="dk-sp-board-h">{t.boardTitle}</h2>
              <p className="dk-sp-muted">{t.boardLead}</p>
            </div>
            <Select
              aria-label={t.marketPick}
              value={u.market}
              onChange={(e) => ui.set({ market: e.target.value })}
              options={[{ value: '', label: t.allMarkets }, ...rows(markets).map((m) => ({ value: m.id, label: m.name }))]}
            />
          </header>
          <div className="dk-sp-chips" role="group" aria-label={t.commodityPick}>
            {[{ id: '', name: { id: t.allCommodities, en: t.allCommodities } }, ...region.commodities].map((c) => (
              <button key={c.id || 'all'} type="button" className="dk-chip" aria-pressed={u.commodity === c.id} onClick={() => ui.set({ commodity: c.id })}>
                {c.name[lang]}
              </button>
            ))}
          </div>
          <Board rows={items} cols={t.cols} label={t.boardTitle} activeId={u.detail} onOpen={open} empty={t.emptyBoard} hotId={hot === 'board' ? anomVisible : null} />
          {board.length > 12 && (
            <Button size="sm" variant="ghost" className="dk-sp-more" onClick={() => setMore((m) => !m)} aria-expanded={more}>
              {more ? t.showLess : t.showAll(board.length)}
            </Button>
          )}
        </section>
        <div className="dk-sp-side">
          <RegionCard
            title={t.regionTitle}
            flood={flood ? { text: t.floodOn(flood.title[lang], tm(hhmm(flood.at), lang)), markets: floodMarkets } : null}
            emptyText={t.noFlood}
            autoText={t.autoFlood(tm(hhmm(FLOOD_AT), lang))}
            playLabel={t.playFlood}
            busy={busy}
            onPlay={() => {
              setBusy(true)
              void playFlood().finally(() => setBusy(false))
            }}
            hot={hot === 'flood'}
            hotLabel={t.hotFlood}
            link={flood && DEMO_READY['siaga-wilayah'] ? <AppLink className="dk-sp-link" to={demoHref('siaga-wilayah', session, flood.id) + keep()}>{t.openSiaga}</AppLink> : null}
          />
          <SideCard title={t.warnTitle} icon="bell" tone={warnings.length ? 'warn' : undefined} hook="sp-warning" sim={t.sim}>
            <AlertList kind="warn" rows={warnLines} empty={t.warnNone} openLabel={t.openDetail} hotId={hot === 'warn' ? warnLines[0]?.id : null} hotLabel={t.hotWarn} onOpen={(id) => {
              const w = warnTable.byId[id]
              if (w) open(`${w.marketIds[0]}:${w.commodityId}`)
            }} />
          </SideCard>
          <SideCard title={t.anomTitle} icon="alert" tone={anomalies.length ? 'danger' : undefined} hook="sp-anomaly" sim={t.sim}>
            <AlertList kind="anom" rows={anomLines} empty={t.anomNone} openLabel={t.openDetail} hotId={hot === 'anom' ? anomLines[0]?.id : null} hotLabel={t.hotspot} onOpen={open} />
          </SideCard>
        </div>
      </div>
    </div>
  )
}
