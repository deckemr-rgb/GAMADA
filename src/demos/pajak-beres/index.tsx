/**
 * demos/pajak-beres — P9 Pajak Beres · Copilot Pembukuan & Pajak (spec §11 P9, plan docs/build/tahap3-plan.md §2 P9).
 *
 * BrowserFrame "demo.gamada.id/pajak-beres": ribbon "Simulasi · bukan nasihat pajak", KPI strip (omzet, laba, PPh
 * Final estimate, review count, next deadline), tabs Dokumen (first screen: Kotak Dokumen · nota · Jurnal hari ini) ·
 * Jurnal · Laporan · Kalender · PPh 21 · Ekspor (all lazy, preloaded on intent), header "Tanya Pajak" (lazy drawer).
 * Roles: Pemilik Usaha (plain words) and Konsultan Pajak (lands on Jurnal, client switcher, CoA codes, period lock).
 * Emits ledger.posted (nota, bank), ledger.reviewed, bank.imported, tax.computed, tax.ready, period.locked (source
 * pajak-beres); consumes sale.created (C14: every sale is journaled), nota.received (C18) and ?focus=<id>.
 */
import { Suspense, lazy, startTransition, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { DemoCanvasProps } from '../registry'
import { DEMO_READY } from '../registry'
import type { Mission } from '../../demo-kit/shell'
import { preloadOnIntent, useShell } from '../../demo-kit/shell'
import { BrowserFrame } from '../../demo-kit/frames'
import { Button, Drawer, Icon, Kpi, KpiStrip, Skeleton, Tabs, flyBetween, motionMode } from '../../demo-kit/ui'
import { useDemoStrings } from '../../demo-kit/i18n'
import { DAY_MIN, clock, isEvent, rows, useEcosystemReady, useSession, useWorld, world, type WorldState } from '../../demo-kit/world'
import { omzetByMonth, pendingReviews, pnlMonthly, taxCalendar } from '../../demo-kit/world/usaha-pintar'
import { PPH_FINAL, pctText } from './rules'
import { SLUG, TAB_IDS, dateText, isTab, isoOf, monthName, periodOf, roleKeyOf, rp, rpShort, taxAmountOf, taxItemOf, type RoleKey, type TabId } from './model'
import { STRINGS, useT } from './strings'
import './pajak-beres.css'

const loaders: Record<TabId, () => Promise<unknown>> = {
  dokumen: () => import('./Inbox'),
  jurnal: () => import('./Journal'),
  laporan: () => import('./Reports'),
  kalender: () => import('./Calendar'),
  pph21: () => import('./Payroll'),
  ekspor: () => import('./Export'),
}
const Inbox = lazy(() => import('./Inbox'))
const Journal = lazy(() => import('./Journal'))
const Reports = lazy(() => import('./Reports'))
const Calendar = lazy(() => import('./Calendar'))
const Payroll = lazy(() => import('./Payroll'))
const Export = lazy(() => import('./Export'))
const loadAsk = () => import('./Ask')
const Ask = lazy(loadAsk)
const loadClients = () => import('./Clients')
const Clients = lazy(loadClients)

const AUTOPLAY_KEY = 'gamada:pb:autoplay'
const DAY_START = 7 * 60

/** the clock starts by itself on a first visit at 07:00 (×10) unless motion is reduced/off, the link set a time,
 *  it runs under test (?e2e=1 without &autoplay=1) or it already started once this session */
function useAutoplay(present: boolean) {
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    if (present || motionMode() !== 'full' || (q.get('e2e') === '1' && q.get('autoplay') !== '1')) return
    try {
      if (window.sessionStorage.getItem(AUTOPLAY_KEY) === '1') return
    } catch {
      /* storage blocked: once per page load */
    }
    const tm = window.setTimeout(() => {
      const c = clock.get()
      if (c.running || c.minutes !== DAY_START || world.status() !== 'ready') return
      clock.play()
      try {
        window.sessionStorage.setItem(AUTOPLAY_KEY, '1')
      } catch {
        /* ignore */
      }
    }, 1200)
    return () => window.clearTimeout(tm)
  }, [present])
}

const bare = (x: string) => (x.includes(':') ? x.slice(x.indexOf(':') + 1) : x)

export default function Canvas(_props: DemoCanvasProps) {
  const ready = useEcosystemReady('usaha-pintar')
  const t = useDemoStrings()
  if (!ready) return <UpSkeleton label={t.upLoading} />
  return <PajakBeres />
}

function UpSkeleton({ label }: { label: string }) {
  return (
    <div className="dk-root dk-pb dk-pb-skel" data-eco="usaha-pintar" aria-busy="true">
      <p className="dk-pb-ribbon">{label}</p>
      <div className="dk-pb-skel-kpis">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="dk-pb-skel-box is-kpi" />
        ))}
      </div>
      <div className="dk-pb-docs">
        <div className="dk-pb-skel-box">
          <Skeleton lines={5} />
        </div>
        <div className="dk-pb-skel-box is-tall" />
        <div className="dk-pb-skel-box">
          <Skeleton lines={6} />
        </div>
      </div>
    </div>
  )
}

function DocsSkeleton() {
  return (
    <div className="dk-pb-docs" aria-busy="true">
      <div className="dk-pb-skel-box">
        <Skeleton lines={5} />
      </div>
      <div className="dk-pb-skel-box is-tall" />
      <div className="dk-pb-skel-box">
        <Skeleton lines={6} />
      </div>
    </div>
  )
}

function PajakBeres() {
  const { t, lang } = useT()
  const shell = useShell()
  const { role } = useSession()
  const roleKey: RoleKey = roleKeyOf(role)
  const landing: TabId = roleKey === 'konsultan' ? 'jurnal' : 'dokumen'
  const [tab, setTab] = useState<TabId>(() => {
    const q = new URLSearchParams(window.location.search).get('tab')
    return isTab(q) ? q : landing
  })
  const [doc, setDoc] = useState<string | null>(null)
  const [arrivedPo, setArrivedPo] = useState<string | null>(null)
  const [jFocus, setJFocus] = useState<string | null>(null)
  const [cFocus, setCFocus] = useState<string | null>(null)
  const [ask, setAsk] = useState(false)
  const [clients, setClients] = useState(false)
  const [badge, setBadge] = useState(0)
  const fromTp = useRef(new URLSearchParams(window.location.search).get('from') === 'tenderpilot').current
  const tabsRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  useAutoplay(shell.present)

  const go = useCallback((next: TabId) => startTransition(() => setTab(next)), [])

  // a role switch lands on that role's tab (Kirim ke konsultan ⇒ Jurnal)
  const prevRole = useRef(roleKey)
  useEffect(() => {
    if (prevRole.current === roleKey) return
    prevRole.current = roleKey
    go(roleKey === 'konsultan' ? 'jurnal' : 'dokumen')
  }, [roleKey, go])

  // ?tab= follows the open tab (Back from another product returns to it)
  useEffect(() => {
    const u = new URL(window.location.href)
    if (u.searchParams.get('tab') === tab) return
    u.searchParams.set('tab', tab)
    window.history.replaceState(window.history.state, '', u.pathname + u.search + u.hash)
    if (tab === 'jurnal') setBadge(0)
  }, [tab])

  // secondary tabs load on intent (pointer over / focus / touch on the tab), never on idle
  useEffect(() => {
    const el = tabsRef.current
    if (!el) return
    const offs: (() => void)[] = []
    el.querySelectorAll<HTMLElement>('[role="tab"]').forEach((b, i) => {
      const id = TAB_IDS[i]
      if (id) offs.push(preloadOnIntent(b, loaders[id]))
    })
    return () => offs.forEach((o) => o())
  }, [])

  // ?focus=<id>: ledger → Jurnal row · PO → Dokumen with that nota · tax item / shop → Kalender · else default + toast
  const { focus, clearFocus, toast } = shell
  const handled = useRef<string | null>(null)
  useEffect(() => {
    if (!focus || handled.current === focus) return
    handled.current = focus
    const id = bare(focus)
    const s = world.get()
    if (s.ledger.byId[id]) {
      go('jurnal')
      setJFocus(id)
    } else if (s.purchaseOrders.byId[id]) {
      go('dokumen')
      setDoc(id)
      setArrivedPo(id)
    } else if (s.taxItems.byId[id] || id === s.meta.shopId) {
      go('kalender')
      setCFocus(s.taxItems.byId[id] ? id : (taxItemOf(s, 'pph-final-umkm', periodOf(s))?.id ?? null))
    } else {
      go(landing)
      const L = STRINGS[lang]
      toast({ title: L.notFound, body: L.notFoundBody, tone: 'warn', icon: 'alert' })
    }
    clearFocus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, clearFocus])

  // a processed document flies into the journal (phones: onto the Jurnal tab, badge +1)
  const onPosted = useCallback(
    (_id: string, fromEl: HTMLElement | null) => {
      const sm = shell.size === 'sm'
      const target = sm ? tabsRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[1] : rootRef.current?.querySelector<HTMLElement>('.dk-pb-feed-list li, .dk-pb-feed')
      void flyBetween(fromEl, target ?? null, { duration: 500 })
      if (sm) setBadge((b) => b + 1)
    },
    [shell.size],
  )
  const openEntry = useCallback(
    (id: string) => {
      go('jurnal')
      setJFocus(id)
    },
    [go],
  )
  const doneJ = useCallback(() => setJFocus(null), [])
  const doneC = useCallback(() => setCFocus(null), [])
  const onCard = useCallback(() => shell.markMission('tanya'), [shell])

  const tpReady = DEMO_READY.tenderpilot || new URLSearchParams(window.location.search).get('controls') === 'all'
  const sm = shell.size === 'sm'
  const items = TAB_IDS.map((id) => ({ id, label: t.tabs[id], ...(id === 'jurnal' && badge ? { badge, badgeTone: 'accent' as const, badgeLabel: t.phoneJurnalBadge } : {}) }))

  let panel: ReactNode = null
  if (tab === 'dokumen') panel = <Inbox roleKey={roleKey} selected={doc} onSelect={setDoc} onPosted={onPosted} onOpenEntry={openEntry} onReview={() => undefined} arrivedPo={arrivedPo} />
  else if (tab === 'jurnal') panel = <Journal roleKey={roleKey} focusId={jFocus} onFocusDone={doneJ} />
  else if (tab === 'laporan') panel = <Reports roleKey={roleKey} />
  else if (tab === 'kalender') panel = <Calendar focusItem={cFocus} fromTp={fromTp} onTab={go} onFocusDone={doneC} />
  else if (tab === 'pph21') panel = <Payroll roleKey={roleKey} />
  else panel = <Export roleKey={roleKey} onTab={go} />

  return (
    <BrowserFrame
      slug={SLUG}
      path={sm || tab === landing ? SLUG : `${SLUG}/${tab}`}
      label={t.product}
      actions={
        <span className="dk-pb-actions">
          {roleKey === 'konsultan' && (
            <Button size="sm" variant="ghost" icon="users" onClick={() => setClients(true)} aria-haspopup="dialog" onPointerEnter={() => void loadClients()} onFocus={() => void loadClients()} data-pb="clients">
              {sm ? '' : t.clients}
              {sm && <span className="dk-sr">{t.clients}</span>}
            </Button>
          )}
          <Button size="sm" variant="ghost" icon="spark" onClick={() => setAsk(true)} aria-haspopup="dialog" onPointerEnter={() => void loadAsk()} onFocus={() => void loadAsk()} data-pb="ask" className="dk-pb-askbtn">
            {sm ? t.askSm : t.ask}
            {sm && <span className="dk-sr"> {t.askSr}</span>}
          </Button>
        </span>
      }
    >
      <div ref={rootRef} className="dk-root dk-pb" data-eco="usaha-pintar" data-role={roleKey}>
        <p className="dk-pb-ribbon" role="note">
          <Icon name="info" size={14} /> {sm ? t.ribbonSm : t.ribbon}
        </p>
        {fromTp && (
          <p className="dk-pb-fromtp">
            <Icon name="tender" size={14} /> {t.fromTpText}
            {tpReady ? (
              <a href={`/demo/tenderpilot${new URLSearchParams(window.location.search).get('controls') === 'all' ? '?controls=all' : ''}`} className="dk-pb-link">
                {t.fromTp}
              </a>
            ) : null}
          </p>
        )}
        <Kpis />
        <div ref={tabsRef}>
          <Tabs items={items} value={tab} onChange={go} label={t.tabsLabel} className="dk-pb-tabs">
            <Suspense fallback={tab === 'dokumen' ? <DocsSkeleton /> : <p className="dk-pb-muted dk-pb-loading">{t.loading}</p>}>{panel}</Suspense>
          </Tabs>
        </div>
      </div>
      {ask && (
        <Suspense fallback={null}>
          <Ask open={ask} onClose={() => setAsk(false)} roleKey={roleKey} onCard={onCard} />
        </Suspense>
      )}
      {clients && (
        <Drawer open={clients} onClose={() => setClients(false)} title={t.clients} width={420}>
          <Suspense fallback={<p className="dk-pb-muted">{t.loading}</p>}>
            <Clients />
          </Suspense>
        </Drawer>
      )}
    </BrowserFrame>
  )
}

/* ------------------------------------------------------------------ KPI strip */

interface KpiVals { omzet: number; laba: number; pph: number; review: number; dueDays: number | null; dueAt: string; dueLabel: string }
const kpiSel = (lang: 'id' | 'en') => (s: WorldState): KpiVals => {
  const shop = s.meta.shopId
  const period = periodOf(s)
  const pnl = pnlMonthly(s, shop)
  const item = taxItemOf(s, 'pph-final-umkm', period)
  const today = Math.floor(clock.get().minutes / DAY_MIN) * DAY_MIN
  const next = taxCalendar(s, shop, today).find((e) => e.at >= today && e.tone !== 'done')
  return {
    omzet: omzetByMonth(s, shop)[period] ?? 0,
    laba: pnl[pnl.length - 1]?.net ?? 0,
    pph: item ? taxAmountOf(s, item).amount : 0,
    review: pendingReviews(s, shop),
    dueDays: next ? Math.round((next.at - today) / DAY_MIN) : null,
    dueAt: next ? isoOf(s, next.at) : '',
    dueLabel: next ? next.label[lang] : '',
  }
}
const kpiEq = (a: KpiVals, b: KpiVals) => a.omzet === b.omzet && a.laba === b.laba && a.pph === b.pph && a.review === b.review && a.dueDays === b.dueDays && a.dueLabel === b.dueLabel

function Kpis() {
  const { t, lang } = useT()
  const sel = useMemo(() => kpiSel(lang), [lang])
  const v = useWorld(sel, kpiEq)
  const period = useWorld(periodOf)
  const m = monthName(period, lang)
  const money = useCallback((n: number) => rpShort(n, lang), [lang])
  const full = useCallback((n: number) => rp(n, lang), [lang])
  return (
    <KpiStrip label={t.kpiLabel} className="dk-pb-kpis">
      <Kpi label={t.kpiDue} value={v.dueDays ?? 0} unit={lang === 'id' ? 'hari lagi' : 'days left'} caption={v.dueDays == null ? t.kpiDueNone : `${dateText(v.dueAt, lang)} · ${v.dueLabel}`} className="dk-pb-kpi-due" wrapLabel />
      <Kpi label={t.kpiOmzet(m)} value={v.omzet} format={money} caption={t.kpiOmzetCap} wrapLabel />
      <Kpi label={t.kpiLaba(m)} value={v.laba} format={money} caption={t.kpiLabaCap} wrapLabel />
      <Kpi label={t.kpiPph(m)} value={v.pph} format={full} caption={t.kpiPphCap(pctText(PPH_FINAL.rate, lang))} wrapLabel />
      <Kpi label={t.kpiReview} value={v.review} caption={t.kpiReviewCap(v.review)} goodWhen="down" wrapLabel />
    </KpiStrip>
  )
}

/* ------------------------------------------------------------------ guide missions (spec §11 P9) */

const shopOf = (s: WorldState) => s.meta.shopId

export const missions: readonly Mission[] = [
  {
    id: 'nota',
    label: { id: 'Ubah nota kusut jadi jurnal', en: 'Turn a crumpled receipt into a journal entry' },
    hint: { id: 'Di tab Dokumen, pilih nota teratas lalu tekan "Proses nota".', en: 'In the Documents tab, pick the top receipt and press "Process receipt".' },
    target: '[data-hotspot="pb-process"]',
    done: (e) => isEvent(e, 'ledger.posted') && e.source === SLUG && e.payload.source === 'nota',
  },
  {
    id: 'mutasi',
    label: { id: 'Impor mutasi bank dan rapikan 3 jurnal', en: 'Import the bank statement and tidy 3 entries' },
    hint: { id: 'Buka "Mutasi rekening November" di Kotak Dokumen, tekan "Impor 40 baris", lalu setujui saran di antrean tinjauan.', en: 'Open "November bank statement" in the document box, press "Import 40 rows", then approve the review suggestions.' },
    done: (e, s) => isEvent(e, 'ledger.reviewed') && pendingReviews(s, shopOf(s)) === 0 && rows(s.bankImports).some((b) => b.businessId === shopOf(s)),
  },
  {
    id: 'pph21',
    label: { id: 'Hitung PPh 21 lima karyawan', en: 'Compute PPh 21 for five employees' },
    hint: { id: 'Buka tab PPh 21 lalu tekan "Hitung semua".', en: 'Open the PPh 21 tab and press "Compute all".' },
    done: (e) => isEvent(e, 'tax.computed') && e.payload.kind === 'pph21',
  },
  {
    id: 'ekspor',
    label: { id: 'Tandai pajak November siap lapor', en: 'Mark November taxes ready to file' },
    hint: { id: 'Di tab Ekspor, hitung PPh Final, lalu tekan "Tandai siap lapor".', en: 'In the Export tab, compute the final tax, then press "Mark ready to file".' },
    done: (e) => isEvent(e, 'tax.ready') && e.source === SLUG,
  },
  {
    id: 'tanya',
    label: { id: 'Tanya: kenapa pajak bulan ini naik?', en: 'Ask: why did my tax go up this month?' },
    hint: { id: 'Tekan "Tanya Pajak" di kepala halaman, lalu pilih "Kenapa pajak bulan ini naik?".', en: 'Press "Ask Tax" in the page header, then pick "Why did my tax go up this month?".' },
    target: '[data-pb="ask"]',
  },
]

export const hotspot = { target: '[data-hotspot="pb-process"]', id: 'pajak-beres-start', label: { id: 'Mulai di sini', en: 'Start here' } }
