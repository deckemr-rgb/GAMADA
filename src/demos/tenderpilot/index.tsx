/**
 * demos/tenderpilot — P13 TenderPilot · Asisten Tender untuk Vendor (spec §11 P13, brief docs/build/tahap3-plan.md P13).
 *
 * BrowserFrame "demo.gamada.id/tenderpilot": header KPIs (tenderKpi) + the vendor profile chip; 1440: Umpan 40 % |
 * Detail · Dokumen · Riwayat 60 %; phones: one tab row Umpan · Detail · Dokumen · Riwayat. The clock plays by itself
 * (once per session, full motion); 07:01 a natural tender is matched (new row + bell badge), 07:06 the flood
 * (useFloodAutoplay) → need → emergency tender → tender.matched 0.78 → the peach banner.
 * Emits bid.submitted (source tenderpilot); consumes tender.matched (C22), procurement.flagged (L3), tax.ready (L1),
 * partner.verified (L2) and ?focus=<tender | procurement id>.
 */
import { Suspense, lazy, startTransition, useCallback, useEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react'
import type { DemoCanvasProps } from '../registry'
import type { Mission } from '../../demo-kit/shell'
import { preloadNow, useShell } from '../../demo-kit/shell'
import { BrowserFrame } from '../../demo-kit/frames'
import { Button, Drawer, IconButton, Kpi, KpiStrip, LoadingText, Skeleton, Tabs, motionMode } from '../../demo-kit/ui'
import { clock, isEvent, onEvent, useClock, useEcosystemReady, useWorld, world, type WorldState } from '../../demo-kit/world'
import { shopStockFor, tenderFeed, tenderKpi, useFloodAutoplay, vendorProfile } from '../../demo-kit/world/usaha-pintar'
import { useDemoStrings } from '../../demo-kit/i18n'
import { Link } from 'react-router'
import Banner from './Banner'
import Detail, { loadComposer } from './Detail'
import Feed from './Feed'
import Filters, { NO_FILTER, activeCount, type Filt } from './Filters'
import { SLUG, canLink, dateText, deadlineText, emergencyOf, hrefTo, pctOf, rpShort, tenderForFocus } from './model'
import { STRINGS, useT } from './strings'
import './tenderpilot.css'

const Composer = lazy(loadComposer)
const loadHistory = () => import('./History')
const History = lazy(loadHistory)
const loadAi = () => import('./ai')
const Assistant = lazy(() => loadAi().then((m) => ({ default: m.Assistant })))

type Tab = 'umpan' | 'detail' | 'dokumen' | 'riwayat'
const LOADERS: Partial<Record<Tab, () => Promise<unknown>>> = { dokumen: loadComposer, riwayat: loadHistory }
const AUTOPLAY_KEY = 'gamada:tp:autoplay'
const AUTOPLAY_DELAY_MS = 900
const ANNOUNCE_GAP_MS = 6000

const whole = (s: WorldState) => s

/** the world clock starts by itself on a first visit at 07:00 (×10), once per session, unless motion is reduced/off */
function useAutoplay(ready: boolean) {
  useEffect(() => {
    if (!ready || motionMode() !== 'full') return
    try {
      if (window.sessionStorage.getItem(AUTOPLAY_KEY) === '1') return
    } catch {
      /* storage blocked: once per page load */
    }
    const tm = window.setTimeout(() => {
      const c = clock.get()
      if (c.running || c.minutes !== 7 * 60) return
      clock.play()
      try {
        window.sessionStorage.setItem(AUTOPLAY_KEY, '1')
      } catch {
        /* ignore */
      }
    }, AUTOPLAY_DELAY_MS)
    return () => window.clearTimeout(tm)
  }, [ready])
}

function UpSkeleton({ label }: { label: string }) {
  return (
    <div className="dk-tp dk-tp-skel" aria-busy="true">
      <p className="dk-tp-muted">{label}</p>
      <div className="dk-tp-skel-kpis">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={64} radius={10} />
        ))}
      </div>
      <div className="dk-tp-body">
        <div className="dk-tp-col-feed">
          <Skeleton lines={8} height={14} />
        </div>
        <div className="dk-tp-col-main">
          <Skeleton height={220} radius={12} />
        </div>
      </div>
    </div>
  )
}

export default function Canvas(_props: DemoCanvasProps) {
  const ready = useEcosystemReady('usaha-pintar')
  const { t } = useT()
  const ds = useDemoStrings()
  useFloodAutoplay(ready)
  useAutoplay(ready)
  return (
    <BrowserFrame slug={SLUG} label={t.frameLabel}>
      {ready ? <Product /> : <UpSkeleton label={ds.upLoading} />}
    </BrowserFrame>
  )
}

function Product() {
  const { t, lang } = useT()
  const shell = useShell()
  const sm = shell.size === 'sm'
  const s = useWorld(whole)
  const clk = useClock()
  const now = clk.minutes
  const shopId = s.meta.shopId
  const [openId, setOpenId] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>(sm ? 'umpan' : 'detail')
  const [filt, setFilt] = useState<Filt>(NO_FILTER)
  const [bannerOff, setBannerOff] = useState<string | null>(null)
  const [fresh, setFresh] = useState<ReadonlySet<string>>(() => new Set())
  const [unseen, setUnseen] = useState<string[]>([])
  const [profile, setProfile] = useState(false)
  const [chat, setChat] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [said, setSaid] = useState('')
  const lastSaid = useRef(0)
  const langRef = useRef(lang)
  langRef.current = lang

  const feedAll = useMemo(() => tenderFeed(s, now, {}), [s, now])
  const feed = useMemo(() => tenderFeed(s, now, filt), [s, now, filt])
  const kpi = useMemo(() => tenderKpi(s, now), [s, now])
  const prof = vendorProfile(s, shopId)
  const emergency = emergencyOf(s)
  const showBanner = !!emergency && bannerOff !== emergency.id && openId !== emergency.id
  const kecs = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of feedAll.rows) m.set(r.tender.kecamatanId, (m.get(r.tender.kecamatanId) ?? 0) + 1)
    return [...m].map(([id, n]) => ({ id, n, name: s.region.kecamatan.find((k) => k.id === id)?.name ?? id })).sort((a, b) => a.name.localeCompare(b.name))
  }, [feedAll, s.region])
  const opdShort = useCallback((id: string) => s.region.opd.find((o) => o.id === id)?.short ?? id, [s.region])
  const kecName = useCallback((id: string) => s.region.kecamatan.find((k) => k.id === id)?.name ?? id, [s.region])

  const open = useCallback(
    (id: string) => {
      startTransition(() => {
        setOpenId(id)
        setTab((cur) => (sm || cur === 'riwayat' ? 'detail' : cur === 'umpan' ? 'detail' : cur))
      })
      setUnseen((u) => u.filter((x) => x !== id))
    },
    [sm],
  )

  // first screen: the best match open on the right (wide) unless a ?focus arrival decides
  const { focus, clearFocus, toast } = shell
  const booted = useRef(false)
  useEffect(() => {
    if (booted.current) return
    booted.current = true
    if (focus) return
    const best = feedAll.rows.find((r) => r.probability !== null)
    if (best && !sm) setOpenId(best.tender.id)
  }, [feedAll, focus, sm])

  // ?focus=<tender id | procurement id> (cross-product toasts, the tour); unknown → the feed + a toast
  useEffect(() => {
    if (!focus) return
    const id = tenderForFocus(world.get(), focus)
    // tahap 4 L10: a Katalog Lokal order closed the tender ⇒ the toast carries the shop's bid id: its tender + Riwayat
    const bid = world.get().bids.byId[focus.includes(':') ? focus.slice(focus.lastIndexOf(':') + 1) : focus]
    if (bid && world.get().tenders.byId[bid.tenderId]) {
      open(bid.tenderId)
      setTab('riwayat')
    } else if (id) {
      open(id)
      setTab('detail')
    } else {
      setTab(sm ? 'umpan' : 'detail')
      toast({ title: STRINGS[langRef.current].notFound, body: STRINGS[langRef.current].notFoundBody, tone: 'warn' })
    }
    clearFocus()
  }, [focus, clearFocus, open, sm, toast])

  // arriving matches: new row + bell badge; the emergency one brings the banner back; one announcement per ≥ 6 s
  useEffect(
    () =>
      onEvent('*', (e) => {
        if (!isEvent(e, 'tender.matched')) return
        const { tenderId, businessId } = e.payload
        const st = world.get()
        if (businessId !== st.meta.shopId) return
        setFresh((f) => new Set(f).add(tenderId))
        setUnseen((u) => (u.includes(tenderId) ? u : [...u, tenderId]))
        const tn = st.tenders.byId[tenderId]
        const L = STRINGS[langRef.current]
        if (tn && Date.now() - lastSaid.current > ANNOUNCE_GAP_MS) {
          lastSaid.current = Date.now()
          setSaid(L.bannerTitle(tn.title[langRef.current], pctOf(e.payload.probability) ?? 0, deadlineText(st.day, tn.deadlineAt, langRef.current)))
        }
      }),
    [],
  )

  const switchTab = useCallback((v: Tab) => startTransition(() => setTab(v)), [])
  // tab intent → preload that tab's chunk (hover / focus / touch on the tab button)
  const onTabIntent = (e: SyntheticEvent) => {
    const el = (e.target as Element).closest?.('[role="tab"]')
    const key = el?.id.split('-t-').pop() as Tab | undefined
    const load = key ? LOADERS[key] : undefined
    if (load) preloadNow(load)
  }
  const bell = () => {
    const id = unseen[unseen.length - 1] ?? emergency?.id ?? feedAll.rows.find((r) => r.probability !== null)?.tender.id
    setUnseen([])
    if (id) open(id)
  }

  const nFilt = activeCount(filt)
  const banner = showBanner && emergency && (
    <Banner
      title={emergency.title[lang]}
      pct={pctOf(emergency.matches[shopId]) ?? 0}
      deadline={deadlineText(s.day, emergency.deadlineAt, lang)}
      onOpen={() => open(emergency.id)}
      onClose={() => setBannerOff(emergency.id)}
      t={t}
    />
  )
  const staticLine = !clk.running && !emergency && (
    <p className="dk-tp-static">
      {t.staticLine}
      <Button size="sm" variant="ghost" icon="play" onClick={() => clock.play()}>
        {t.playClock}
      </Button>
    </p>
  )

  const feedPane = (
    <section className="dk-tp-feedpane" aria-label={t.feedTitle}>
      <header className="dk-tp-feed-h">
        <div>
          <h2>{t.feedTitle}</h2>
          <p className="dk-tp-muted">
            {t.feedCount(feed.rows.length, feedAll.rows.length)} · {t.feedSort}
          </p>
        </div>
        {sm ? (
          <Button size="sm" variant={nFilt ? 'secondary' : 'ghost'} icon="filter" onClick={() => setFiltersOpen(true)} aria-haspopup="dialog" data-tp="filters-btn">
            {t.filtersBtn(nFilt)}
          </Button>
        ) : (
          nFilt > 0 && (
            <Button size="sm" variant="ghost" icon="close" onClick={() => setFilt(NO_FILTER)}>
              {t.resetFilters}
            </Button>
          )
        )}
      </header>
      {!sm && <Filters f={filt} counts={feedAll.counts} all={feedAll.rows.length} kecs={kecs} onChange={setFilt} t={t} />}
      <p className="dk-tp-feednote">{t.feedNote}</p>
      <Feed rows={feed.rows} activeId={openId} onOpen={open} hotspotFirst={!showBanner} fresh={fresh} opdShort={opdShort} kecName={kecName} t={t} lang={lang} />
    </section>
  )

  const mainTabs: Tab[] = sm ? ['umpan', 'detail', 'dokumen', 'riwayat'] : ['detail', 'dokumen', 'riwayat']
  const body =
    tab === 'umpan' ? (
      feedPane
    ) : tab === 'detail' ? (
      openId ? (
        <Detail tenderId={openId} onDoc={() => requestAnimationFrame(() => setTimeout(() => switchTab('dokumen'), 0))} t={t} lang={lang} sm={sm} />
      ) : (
        <p className="dk-tp-empty">{t.noTender}</p>
      )
    ) : (
      <Suspense fallback={<LoadingText>{t.loading}</LoadingText>}>
        {tab === 'dokumen' ? openId ? <Composer tenderId={openId} sm={sm} /> : <p className="dk-tp-empty">{t.noTender}</p> : <History />}
      </Suspense>
    )

  return (
    <div className="dk-tp" data-eco="usaha-pintar" data-size={sm ? 'sm' : 'wide'}>
      <p className="dk-sr" role="status" aria-live="polite">
        {said}
      </p>
      <header className="dk-tp-top">
        <button type="button" className="dk-tp-profile" onClick={() => setProfile(true)} aria-haspopup="dialog" data-tp="profile">
          <span className="dk-tp-profile-name">{prof ? t.profileChip(prof.name) : ''}</span>
          <span className={`dk-tp-profile-badge${prof?.verified ? ' is-ok' : ''}`}>{prof?.verified ? t.verified : t.notVerified}</span>
        </button>
        <div className="dk-tp-top-act">
          <IconButton icon="bell" label={t.bell(unseen.length)} badge={unseen.length || undefined} onClick={bell} data-tp="bell" />
          <Button size="sm" variant="ghost" icon="spark" onClick={() => setChat(true)} onPointerEnter={() => preloadNow(loadAi)} onFocus={() => preloadNow(loadAi)} aria-haspopup="dialog" data-tp="ask">
            {t.aiAsk}
          </Button>
        </div>
      </header>
      <KpiStrip label={t.kpiLabel} className="dk-tp-kpis">
        <Kpi label={t.kpiOpen} value={kpi.openMatched} wrapLabel />
        <Kpi label={t.kpiAvg} value={Math.round((kpi.avgProbability ?? 0) * 100)} unit="%" caption={t.sim} wrapLabel />
        <Kpi label={t.kpiDue} value={kpi.dueIn3Days} wrapLabel />
        <Kpi label={t.kpiBids} value={kpi.activeBidValue} format={(v) => rpShort(v, lang)} caption={t.sim} wrapLabel />
      </KpiStrip>
      <div className="dk-tp-banner-slot">{banner || staticLine}</div>

      <div className="dk-tp-body">
        {!sm && <div className="dk-tp-col-feed">{feedPane}</div>}
        <div className="dk-tp-col-main" onPointerOverCapture={onTabIntent} onFocusCapture={onTabIntent} onTouchStartCapture={onTabIntent}>
          <Tabs<Tab> items={mainTabs.map((k) => ({ id: k, label: t.tabs[k] }))} value={mainTabs.includes(tab) ? tab : 'detail'} onChange={switchTab} label={t.tabsLabel} className="dk-tp-tabs">
            {body}
          </Tabs>
        </div>
      </div>

      <Drawer open={filtersOpen} onClose={() => setFiltersOpen(false)} title={t.filters} className="dk-tp-filter-ov" footer={<Button variant="primary" onClick={() => setFiltersOpen(false)}>{`${t.fApply} (${feed.rows.length})`}</Button>}>
        <Filters f={filt} counts={feedAll.counts} all={feedAll.rows.length} kecs={kecs} onChange={setFilt} t={t} />
        {nFilt > 0 && (
          <Button size="sm" variant="ghost" icon="close" onClick={() => setFilt(NO_FILTER)}>
            {t.resetFilters}
          </Button>
        )}
      </Drawer>

      <Drawer open={profile} onClose={() => setProfile(false)} title={t.profileTitle} eyebrow={t.profileEyebrow}>
        {prof && (
          <dl className="dk-tp-prof">
            <div>
              <dt>{t.profileOwner}</dt>
              <dd>{prof.owner}</dd>
            </div>
            <div>
              <dt>{t.profileLegal}</dt>
              <dd>{t.legal[prof.legal] ?? prof.legal}</dd>
            </div>
            <div>
              <dt>{t.profileNib}</dt>
              <dd className="dk-num">
                {prof.nib} ({prof.specimen})
              </dd>
            </div>
            <div>
              <dt>{t.profileNpwp}</dt>
              <dd className="dk-num">{prof.npwp}</dd>
            </div>
            <div>
              <dt>{t.profileKbli}</dt>
              <dd>{prof.kbli.map((k) => `${k.code} ${k.label[lang]}`).join(' · ')}</dd>
            </div>
            <div>
              <dt>{t.profileAddress}</dt>
              <dd>{prof.address}</dd>
            </div>
            <div>
              <dt>{t.profileStaff}</dt>
              <dd>{prof.staffCount}</dd>
            </div>
            <div>
              <dt>{t.profileSince}</dt>
              <dd>{t.profileYears(prof.years, prof.since)}</dd>
            </div>
            <div>
              <dt>{t.profileKyb}</dt>
              <dd>
                {prof.kyb ? `Kenal Mitra · ${dateText(s.day, prof.kyb.at, lang)}` : t.notVerified}
                <ProfLink slug="kenal-mitra" focus={prof.kyb?.verificationId} label="Kenal Mitra" t={t} />
              </dd>
            </div>
            <div>
              <dt>{t.profileTax}</dt>
              <dd>
                {prof.taxTidy ? t.taxOk : t.taxMissing}
                <ProfLink slug="pajak-beres" focus={null} label="Pajak Beres" t={t} />
              </dd>
            </div>
            <div>
              <dt>{t.profileStock}</dt>
              <dd>
                {t.profileStockLine(shopStockFor(s, 'karung-pasir').onHand, shopStockFor(s, 'terpal').onHand)}
                <ProfLink slug="toko-autopilot" focus={null} label="Toko Autopilot" t={t} />
              </dd>
            </div>
          </dl>
        )}
      </Drawer>

      {chat && (
        <Suspense fallback={null}>
          <Assistant open={chat} onClose={() => setChat(false)} tenderId={openId} />
        </Suspense>
      )}
    </div>
  )
}

function ProfLink({ slug, focus, label, t }: { slug: 'kenal-mitra' | 'pajak-beres' | 'toko-autopilot'; focus: string | null | undefined; label: string; t: (typeof STRINGS)['id'] }) {
  if (!canLink(slug)) return <span className="dk-tp-muted"> · {t.soon(label)}</span>
  return (
    <Link className="dk-tp-link" to={hrefTo(slug, focus)}>
      {t.openIn(label)}
    </Link>
  )
}

/* ------------------------------------------------------------------ guide missions (spec §11 P13, plan §2 P13) */

export const missions: readonly Mission[] = [
  {
    id: 'buka',
    label: { id: 'Buka tender darurat yang cocok', en: 'Open the matching emergency tender' },
    hint: {
      id: 'Jam dunia berjalan: pukul 07.06 banjir memicu tender darurat karung pasir & terpal. Tekan "Buka" pada pemberitahuannya.',
      en: 'The world clock runs: at 07:06 the flood triggers an emergency sandbag & tarp tender. Press "Open" on its notice.',
    },
    hintSm: {
      id: 'Pukul 07.06 banjir memicu tender darurat (jalankan jam lewat menu ⋯ bila berhenti). Tekan "Buka" pada pemberitahuannya.',
      en: 'At 07:06 the flood triggers an emergency tender (run the clock from the ⋯ menu if it is stopped). Press "Open" on its notice.',
    },
    target: '[data-hotspot="tp-open"]',
  },
  {
    id: 'syarat',
    label: { id: 'Lengkapi syarat pajak', en: 'Complete the tax requirement' },
    hint: {
      id: 'Di Detail, satu syarat kurang. Ikuti "Lengkapi di Pajak Beres", siapkan pajak November, lalu kembali: checklist tercentang.',
      en: 'In Detail one requirement is missing. Follow "Complete it in Pajak Beres", get November’s tax ready, then come back: the checklist ticks.',
    },
    target: '[data-tp="tax-link"]',
    done: (e, s) => isEvent(e, 'tax.ready') && e.payload.businessId === s.meta.shopId,
  },
  {
    id: 'susun',
    label: { id: 'Susun dokumen dengan AI', en: 'Build the document with AI' },
    hint: { id: 'Tab Dokumen: tekan "Susun dengan AI". Tujuh bagian, 34 halaman, terisi dari profil.', en: 'Documents tab: press "Build with AI". Seven sections, 34 pages, filled from the profile.' },
    target: '[data-tp="compose"]',
  },
  {
    id: 'kirim',
    label: { id: 'Kirim penawaran', en: 'Send the bid' },
    hint: { id: 'Tanda tangani (simulasi), lalu "Kirim penawaran". Penawaran muncul di Awas Belanja.', en: 'Sign (simulated), then "Send the bid". The bid shows up in Awas Belanja.' },
    target: '[data-tp="send"]',
    done: (e) => isEvent(e, 'bid.submitted') && e.source === SLUG,
  },
]

export const hotspot = { target: '[data-hotspot="tp-open"]', id: 'tenderpilot-open', label: { id: 'Mulai di sini', en: 'Start here' } }
