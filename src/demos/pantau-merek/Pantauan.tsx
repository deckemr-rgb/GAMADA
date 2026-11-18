/**
 * demos/pantau-merek/Pantauan.tsx — the first screen. KPI strip; stream (40 %) | reputation line + topic bars |
 * alert slot + channel sentiment. Toolbar: run / pause the world clock and "Lihat 30 menit ke depan". The flood notice
 * appears when the scenario flood is active (Siaga Wilayah link). Owner role: the owner band above the stream.
 */
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { Button, flashNewRow, motionMode } from '../../demo-kit/ui'
import { useShell } from '../../demo-kit/shell'
import { DEMO_READY } from '../registry'
import { clock, getSession, world } from '../../demo-kit/world'
import { brandKpi, brandSpike, brandStream, brandTopics, reputationAt, reputationSeries, sentimentByChannel } from '../../demo-kit/world/usaha-pintar'
import { AlertCard } from './AlertCard'
import { Channels } from './Channels'
import { Crawl } from './Crawl'
import { Kpis } from './Kpis'
import { ReputationChart, type RepMarker } from './ReputationChart'
import { Stream } from './Stream'
import { Topics } from './Topics'
import { cardAlert, deliveryHourly, floodNotice, shopOf, spikeTarget, useBrand, useRunning } from './model'
import type { Arrival } from './index'
import { fill, tm, useStr } from './strings'
import { useLocation, useNavigate } from 'react-router'
import { goTo } from '../../components/AppLink'
import { demoHref } from '../../demo-kit/shell'

export default function Pantauan({
  now,
  arrive,
  onHandle,
  onReplies,
  ownerBand,
}: {
  now: number
  arrive: Arrival | null
  onHandle: (alertId: string, view?: 'cluster' | 'announce' | 'published') => void
  onReplies: () => void
  ownerBand: ReactNode
}) {
  const { t, lang } = useStr()
  const shell = useShell()
  const sm = shell.size === 'sm'
  const running = useRunning()
  const s = world.get()
  const shop = useMemo(() => shopOf(s), [s.meta.shopId, s.businesses]) // eslint-disable-line react-hooks/exhaustive-deps

  const kpi = useBrand((st, n) => ({ ...brandKpi(st, n), repYesterday: reputationAt(st, n - 1440, st.meta.shopId) }), now)
  const items = useBrand((st, n) => brandStream(st, n, { limit: 160 }), now)
  const fresh = useMemo(() => items.filter((m) => m.at > now - 60).length, [items, now])
  const series = useBrand((st, n) => ({ shop: reputationSeries(st, n, 24), cat: reputationSeries(st, n, 24, 'kategori') }), now)
  const topics = useBrand((st, n) => brandTopics(st, n, 24), now)
  const channels = useBrand((st, n) => sentimentByChannel(st, n, 24), now)
  const card = useBrand(cardAlert, now)
  const pre = useBrand((st, n) => {
    const sp = brandSpike(st, n)
    return { count: sp.count, rule: sp.rule, baseline: sp.baselinePer2h, hourly: deliveryHourly(st, n, 8) }
  }, now)
  const flood = useBrand((st) => floodNotice(st), now)

  const markers = useMemo<RepMarker[]>(() => {
    const out: RepMarker[] = []
    if (card.alert) out.push({ at: card.alert.at, label: fill(t.repSpike, { t: tm(card.alert.at, lang) }), tone: 'danger' })
    if (card.ann) out.push({ at: card.ann.at, label: fill(t.repAnn, { t: tm(card.ann.at, lang) }), tone: 'accent' })
    return out
  }, [card, t, lang])
  const repSummary = useMemo(() => {
    const l = series.shop
    let lo = l[0]
    for (const p of l) if (lo && p.value < lo.value) lo = p
    return fill(t.repSummary, {
      a: l[0]?.value ?? 0,
      t0: tm(l[0]?.at ?? now, lang),
      b: l[l.length - 1]?.value ?? 0,
      c: series.cat[series.cat.length - 1]?.value ?? 0,
      lo: lo?.value ?? 0,
      tl: tm(lo?.at ?? now, lang),
    })
  }, [series, t, lang, now])
  const ticks = useMemo(() => [0, 6, 12, 18, 24].map((h) => tm(Math.floor(now / 60) * 60 - (24 - h) * 60, lang)), [now, lang])
  const animate = useRef(motionMode() === 'full').current

  // arrival on the alert (?focus=BA-…): scroll the card into view and flash it
  const alertRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (arrive?.kind !== 'alert') return
    const el = alertRef.current?.querySelector<HTMLElement>('.dk-pm-alert')
    if (!el) return
    el.scrollIntoView({ block: 'nearest', behavior: motionMode() === 'full' ? 'smooth' : 'auto' })
    return flashNewRow(el)
  }, [arrive])

  const navigate = useNavigate()
  const { pathname } = useLocation()
  const goSiaga = (id: string) => {
    const h = demoHref('siaga-wilayah', getSession(), id)
    void goTo(new URLSearchParams(window.location.search).get('controls') === 'all' ? `${h}&controls=all` : h, navigate, pathname)
  }
  const reduced = motionMode() !== 'full'

  return (
    <div className="dk-pm-pantauan">
      <header className="dk-pm-head">
        <div className="dk-pm-head-t">
          <h2 className="dk-pm-h2">{fill(t.title, { shop: shop.name })}</h2>
          <p className="dk-pm-lead">{t.lead}</p>
          <Crawl now={now} fresh={fresh} running={running} t={t} lang={lang} />
        </div>
        <div className="dk-pm-head-act">
          <Button size="sm" variant="secondary" icon={running ? 'pause' : 'play'} onClick={() => clock.toggle()} data-pm="clock" aria-pressed={running}>
            {running ? t.pause : t.play}
          </Button>
          <Button size="sm" variant="ghost" icon="forward" onClick={() => clock.setTime(Math.min(1439, clock.get().minutes + 30))} data-pm="ahead30">
            {t.ahead30}
          </Button>
        </div>
        {reduced && !running && now < 7 * 60 + 6 && <p className="dk-pm-note dk-pm-static">{t.staticHint}</p>}
      </header>
      {flood && (
        <div className="dk-pm-flood" role="status" data-pm="flood-notice">
          <span>{fill(t.flood, { l: flood.level, k: flood.kec })}</span>
          {DEMO_READY['siaga-wilayah'] && (
            <Button size="sm" variant="quiet" iconEnd="arrowUpRight" onClick={() => goSiaga(flood.id)} data-pm="to-siaga">
              {t.floodLink}
            </Button>
          )}
        </div>
      )}
      {ownerBand}
      <div className="dk-pm-grid">
        <div className="dk-pm-a-kpi">
          <Kpis k={kpi} t={t} />
        </div>
        <div className={`dk-pm-a-alert${sm && card.alert?.status === 'aktif' ? ' is-sticky' : ''}`} ref={alertRef}>
          <AlertCard
            alert={card.alert}
            ann={card.ann}
            pre={pre}
            t={t}
            lang={lang}
            compact={sm}
            flash={arrive?.kind === 'alert' ? arrive.n : 0}
            onJump={() => clock.setTime(spikeTarget(world.get(), clock.get().minutes))}
            onHandle={onHandle}
            onReplies={onReplies}
          />
        </div>
        <div className="dk-pm-a-stream">
          <Stream items={items} t={t} lang={lang} shopId={shop.id} compact={sm} />
        </div>
        <div className="dk-pm-a-rep">
          <ReputationChart
            shop={series.shop}
            cat={series.cat}
            markers={markers}
            title={t.repTitle}
            unit={t.repUnit}
            shopLabel={t.repShop}
            catLabel={t.repCat}
            summary={repSummary}
            ticks={ticks}
            seed={s.seed}
            animate={animate}
          />
        </div>
        <div className="dk-pm-a-topics">
          <Topics rows={topics} t={t} lang={lang} />
        </div>
        <div className="dk-pm-a-chan">
          <Channels rows={channels} t={t} lang={lang} />
        </div>
      </div>
    </div>
  )
}
