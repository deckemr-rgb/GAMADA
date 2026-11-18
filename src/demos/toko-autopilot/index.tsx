/**
 * demos/toko-autopilot — P8 Toko Autopilot (incl. Kasir, ex-KasirKu) · plan docs/build/tahap3-plan.md §2 P8.
 *
 * Pemilik Toko: BrowserFrame "demo.gamada.id/toko-autopilot" with Dasbor · Kasir · Prediksi · PO · Harga & Promo ·
 * Jadwal Shift (every tab but the first is a lazy chunk fetched on intent) and the outlet toggle. Kasir: TabletFrame
 * with the checkout only (outlet Toko). Supplier: PhoneFrame "Pesanan masuk" (WA-style PO chat with quick replies).
 * URL: ?tab= ?outlet= ?role= ?focus=. Every number comes from world/usaha-pintar selectors (simulated).
 */
import { Suspense, lazy, startTransition, useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { DemoCanvasProps } from '../registry'
import type { Mission } from '../../demo-kit/shell'
import { intentProps, replaceQuery, usePreloadOnIntent, useShell } from '../../demo-kit/shell'
import { BrowserFrame, PhoneFrame, TabletFrame } from '../../demo-kit/frames'
import { Button, IconButton, LoadingText, Segmented, Skeleton, motionMode } from '../../demo-kit/ui'
import { clock, formatTime, isEvent, useClock, useEcosystemReady, useSession, world, type WorldState } from '../../demo-kit/world'
import { SLUG, useT, type OutKey, type TabId } from './strings'
import type { Sel, TabProps } from './types'
import { keyOfOutlet, ui, useOutlets } from './store'
import './toko-autopilot.css'

const loadDash = () => import('./Dashboard')
const loadKasir = () => import('./Kasir')
const loadForecast = () => import('./Forecast')
const loadPo = () => import('./Po')
const loadPricing = () => import('./Pricing')
const loadShifts = () => import('./Shifts')
const loadSupplier = () => import('./Supplier')
const loadAssist = () => import('./Assist')
const Dashboard = lazy(loadDash)
const Kasir = lazy(loadKasir)
const Forecast = lazy(loadForecast)
const Po = lazy(loadPo)
const Pricing = lazy(loadPricing)
const Shifts = lazy(loadShifts)
const Supplier = lazy(loadSupplier)
const Assist = lazy(loadAssist)
const LOAD: Record<TabId, () => Promise<unknown>> = { dasbor: loadDash, kasir: loadKasir, prediksi: loadForecast, po: loadPo, harga: loadPricing, shift: loadShifts }
const TABS: TabId[] = ['dasbor', 'kasir', 'prediksi', 'po', 'harga', 'shift']
const OUTS: OutKey[] = ['semua', 'toko', 'kopi', 'warung']


const bare = (x: string) => (x.includes(':') ? x.slice(x.indexOf(':') + 1) : x)
/** route a focus id to its tab (null = unknown id) */
function route(s: WorldState, raw: string): { tab: TabId; sel: Omit<Sel, 'n'>; outletId?: string } | null {
  const id = bare(raw)
  if (raw.startsWith('alerts:') || s.alerts.byId[id]) return { tab: 'prediksi', sel: { kind: 'flood', id } }
  if (s.purchaseOrders.byId[id]) return { tab: 'po', sel: { kind: 'po', id } }
  const po = s.purchaseOrders.ids.find((k) => s.purchaseOrders.byId[k]?.code === id)
  if (po) return { tab: 'po', sel: { kind: 'po', id: po } }
  const p = s.products.byId[id]
  if (p) return { tab: 'prediksi', sel: { kind: 'product', id }, outletId: p.outletId }
  if (s.sales.byId[id]) return { tab: 'dasbor', sel: { kind: 'sale', id }, outletId: s.sales.byId[id]!.outletId }
  if (s.staff.byId[id]) return { tab: 'shift', sel: { kind: 'staff', id }, outletId: s.staff.byId[id]!.outletId }
  if (s.posNotices.byId[id]) return { tab: 'kasir', sel: { kind: 'notice', id } }
  return null
}

const AUTOPLAY_KEY = 'gamada:ta:autoplay'
/** the world clock starts by itself on a first visit at 07.00 (×10), as the other demos do */
function useAutoplay(present: boolean) {
  useEffect(() => {
    if (present || motionMode() !== 'full' || new URLSearchParams(window.location.search).get('e2e') === '1') return
    try {
      if (window.sessionStorage.getItem(AUTOPLAY_KEY) === '1') return
    } catch {
      /* storage blocked */
    }
    const tm = window.setTimeout(() => {
      const c = clock.get()
      if (c.running || c.minutes !== 7 * 60 || world.status() !== 'ready') return
      clock.play()
      try {
        window.sessionStorage.setItem(AUTOPLAY_KEY, '1')
      } catch {
        /* ignore */
      }
    }, 1500)
    return () => window.clearTimeout(tm)
  }, [present])
}

function readParam<T extends string>(k: string, list: readonly T[], d: T): T {
  const v = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get(k)
  return v && (list as readonly string[]).includes(v) ? (v as T) : d
}

export default function Canvas(_props: DemoCanvasProps) {
  const ready = useEcosystemReady('usaha-pintar')
  const { t } = useT()
  const shell = useShell()
  const { role } = useSession()
  useAutoplay(shell.present)
  const { setToastPlacement } = shell
  useEffect(() => {
    setToastPlacement({ wide: 'bottom-left', sm: 'top-right' })
    return () => setToastPlacement(null)
  }, [setToastPlacement])
  if (!ready) return <UpSkeleton label={t.product} msg={t.loading} />
  if (role === 'kasir') return <KasirRole />
  if (role === 'supplier') return <SupplierRole />
  return <Owner />
}

function UpSkeleton({ label, msg }: { label: string; msg: string }) {
  return (
    <BrowserFrame slug={SLUG} label={label}>
      <div className="dk-ta" aria-busy="true">
        <p className="dk-sr" role="status">{msg}</p>
        <Skeleton height={44} />
        <div className="dk-ta-kpis">{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={96} />)}</div>
        <div className="dk-ta-dash">
          <Skeleton height={320} />
          <Skeleton height={320} />
        </div>
      </div>
    </BrowserFrame>
  )
}

/** ?focus= arrival: returns the routed selection once (then clears the focus) */
function useFocus(apply: (r: ReturnType<typeof route>) => void) {
  const { focus, clearFocus, toast } = useShell()
  const { t } = useT()
  useEffect(() => {
    if (!focus) return
    const r = route(world.get(), focus)
    if (!r) toast({ title: t.notFound, body: t.notFoundBody, tone: 'warn', icon: 'alert' })
    apply(r)
    clearFocus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, clearFocus])
}

function Owner() {
  const { t } = useT()
  const shell = useShell()
  const outlets = useOutlets()
  const [tab, setTab] = useState<TabId>(() => readParam('tab', TABS, 'dasbor'))
  const [out, setOut] = useState<OutKey>(() => readParam('outlet', OUTS, 'semua'))
  const [sel, setSel] = useState<Sel | null>(null)
  const [ask, setAsk] = useState(false)
  const n = useRef(0)
  const askRef = usePreloadOnIntent<HTMLButtonElement>(loadAssist)

  const go = useCallback((next: TabId, s?: Omit<Sel, 'n'> | null, o?: OutKey) => {
    startTransition(() => {
      setTab(next)
      if (o) setOut(o)
      setSel(s ? { ...s, n: ++n.current } : null)
    })
  }, [])
  useFocus((r) => {
    if (!r) return go('dasbor')
    const ok = r.outletId ? keyOfOutlet(outlets, r.outletId) : undefined
    go(r.tab, r.sel, ok && ok !== 'semua' ? ok : undefined)
    if (r.sel.kind === 'po') ui.set({ chat: r.sel.id })
  })
  useEffect(() => void replaceQuery({ tab: tab === 'dasbor' ? null : tab, outlet: out === 'semua' ? null : out }), [tab, out])

  const outletId = out === 'semua' ? '' : outlets[out]
  const props: TabProps = { outletId, outKey: out, sel, go, role: 'pemilik-toko' }
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const onKey = (e: KeyboardEvent) => {
    const i = TABS.indexOf(tab)
    const j = e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i + TABS.length - 1) % TABS.length : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : -1
    if (j < 0) return
    e.preventDefault()
    go(TABS[j]!)
    tabRefs.current[TABS[j]!]?.focus()
  }
  useEffect(() => {
    tabRefs.current[tab]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [tab])

  return (
    <BrowserFrame
      slug={SLUG}
      path={tab === 'dasbor' ? SLUG : `${SLUG}/${tab}`}
      label={t.product}
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
      <div className="dk-ta" data-tab={tab}>
        <div className="dk-ta-bar">
          <div className="dk-ta-tabs" role="tablist" aria-label={t.tabsLabel} onKeyDown={onKey}>
            {TABS.map((k) => (
              <button
                key={k}
                ref={(el) => void (tabRefs.current[k] = el)}
                type="button"
                role="tab"
                id={`dk-ta-tab-${k}`}
                aria-selected={tab === k}
                aria-controls="dk-ta-panel"
                tabIndex={tab === k ? 0 : -1}
                className="dk-ta-tab"
                {...(k === 'kasir' ? { 'data-hotspot': 'kasir-tab' } : {})}
                {...intentProps(LOAD[k])}
                onClick={() => go(k)}
              >
                {t.tabs[k]}
              </button>
            ))}
          </div>
          {tab !== 'po' && (
            <Segmented
              className="dk-ta-outlets"
              size="sm"
              label={t.outletLabel}
              value={out}
              onChange={(v) => startTransition(() => setOut(v))}
              options={OUTS.map((k) => ({ value: k, label: t.outlets[k] }))}
            />
          )}
        </div>
        <div id="dk-ta-panel" role="tabpanel" aria-labelledby={`dk-ta-tab-${tab}`} className="dk-ta-panel">
          <Suspense fallback={<LoadingText>{t.loading}</LoadingText>}>
            {tab === 'dasbor' && <Dashboard {...props} />}
            {tab === 'kasir' && <Kasir {...props} outletId={outletId || outlets.toko} />}
            {tab === 'prediksi' && <Forecast {...props} />}
            {tab === 'po' && <Po {...props} />}
            {tab === 'harga' && <Pricing {...props} outletId={outletId || outlets.toko} />}
            {tab === 'shift' && <Shifts {...props} outletId={outletId || outlets.toko} />}
          </Suspense>
        </div>
      </div>
      {ask && (
        <Suspense fallback={null}>
          <Assist open={ask} onClose={() => setAsk(false)} tab={tab} outletId={outletId || outlets.toko} />
        </Suspense>
      )}
    </BrowserFrame>
  )
}

function KasirRole() {
  const { t } = useT()
  const outlets = useOutlets()
  const c = useClock()
  const [sel, setSel] = useState<Sel | null>(null)
  useFocus((r) => setSel(r && r.sel.kind === 'notice' ? { ...r.sel, n: Date.now() } : null))
  return (
    <TabletFrame label={`${t.product} · ${t.tabs.kasir}`} time={formatTime(c.minutes)} orientation="landscape">
      <div className="dk-ta dk-ta--kasir">
        <Suspense fallback={<LoadingText>{t.loading}</LoadingText>}>
          <Kasir outletId={outlets.toko} outKey="toko" sel={sel} go={() => undefined} role="kasir" />
        </Suspense>
      </div>
    </TabletFrame>
  )
}

function SupplierRole() {
  const { t } = useT()
  const c = useClock()
  const [sel, setSel] = useState<string | null>(null)
  useFocus((r) => setSel(r && r.sel.kind === 'po' ? r.sel.id : null))
  return (
    <div className="dk-ta-phone">
      <PhoneFrame label={`${t.product} · ${t.supplierTitle}`} time={formatTime(c.minutes)} width={360}>
        <Suspense fallback={<LoadingText>{t.loading}</LoadingText>}>
          <Supplier focusPo={sel} />
        </Suspense>
      </PhoneFrame>
    </div>
  )
}

/* ------------------------------------------------------------------ guide missions (plan §2 P8) */

export const missions: readonly Mission[] = [
  {
    id: 'qris',
    label: { id: 'Transaksi QRIS', en: 'A QRIS transaction' },
    hint: { id: 'Buka tab Kasir, isi keranjang, tekan Bayar, pilih QRIS lalu "Simulasikan pembayaran".', en: 'Open Checkout, fill the cart, press Pay, choose QRIS, then "Simulate payment".' },
    target: '[data-hotspot="kasir-tab"]',
    done: (e) => isEvent(e, 'sale.created') && e.source === SLUG && (e.payload.payment === 'qris' || !!e.payload.payments?.some((p) => p.method === 'qris')),
  },
  {
    id: 'banjir',
    label: { id: 'Lihat dampak banjir', en: 'See the flood impact' },
    hint: {
      id: 'Di Dasbor tekan "Putar skenario banjir", lalu buka Prediksi dan pilih karung pasir: grafiknya melonjak.',
      en: 'On the Dashboard press "Play the flood scenario", then open Forecast and pick the sandbags: the chart jumps.',
    },
  },
  {
    id: 'po',
    label: { id: 'Kirim PO', en: 'Send a PO' },
    hint: { id: 'Tab PO: periksa rumus kekurangan tiap baris, lalu "Setujui & kirim". Balasan supplier masuk di chat.', en: 'POs tab: check each line’s shortfall formula, then "Approve & send". The supplier replies in the chat.' },
    done: (e) => isEvent(e, 'po.sent') && e.source === SLUG,
  },
  {
    id: 'harga',
    label: { id: 'Terapkan 1 saran harga', en: 'Apply 1 price suggestion' },
    hint: {
      id: 'Tab Harga & Promo: pilih outlet di tombol Semua/Toko/Kedai Kopi/Warung di atas, lalu "Terapkan".',
      en: 'Prices & Promos tab: pick an outlet with the All/Shop/Coffee bar/Eatery toggle above, then "Apply".',
    },
    hintSm: {
      id: 'Tab Harga & Promo (geser deretan tab): pilih outlet di bawah tab, lalu "Terapkan".',
      en: 'Prices & Promos tab (swipe the tab row): pick an outlet below the tabs, then "Apply".',
    },
    done: (e) => isEvent(e, 'price.changed') && e.source === SLUG,
  },
  {
    id: 'shift',
    label: { id: 'Lihat kasir tambahan', en: 'See the extra cashier' },
    hint: { id: 'Tab Jadwal Shift: ketuk blok bergaris "+1 kasir" untuk melihat alasannya.', en: 'Shift Schedule tab: tap the dashed "+1 cashier" block to see why.' },
  },
]

export const hotspot = { target: '[data-hotspot="kasir-tab"]', id: 'toko-autopilot-start', label: { id: 'Mulai di sini: 1 transaksi QRIS', en: 'Start here: 1 QRIS transaction' } }
