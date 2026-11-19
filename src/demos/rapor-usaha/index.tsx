/**
 * demos/rapor-usaha — P15 Rapor Usaha (Skor Kesehatan Bisnis) · plan docs/build/tahap4-plan.md §2 P15.
 *
 * Pemilik Usaha: BrowserFrame "demo.gamada.id/rapor-usaha" with Skor usaha · Modal kerja · Berbagi data (each a lazy
 * chunk fetched on intent; the first one with the page) + the read-only "Sisi Bank/Koperasi" panel (≥ 1280 px beside
 * the frame, below it a card in Modal kerja). Analis kredit Koperasi Mitra Usaha Sejahtera (`LENDERS[0]`): Antrian
 * pengajuan (Menunggu / Diputus) · Riwayat + the "Sisi Pemilik Usaha" panel. URL: ?tab= ?role= ?focus=.
 * Every number comes from world/pasar-daerah selectors (raporOf, scoreActions, loanOffer, loanAdvice, lenderQueue);
 * scores, limits, rates and instalments are SIMULATED.
 */
import { Suspense, lazy, startTransition, useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { DemoCanvasProps } from '../registry'
import type { Mission } from '../../demo-kit/shell'
import { intentProps, replaceQuery, useMediaQuery, useShell } from '../../demo-kit/shell'
import { BrowserFrame } from '../../demo-kit/frames'
import { Button, IconButton, LoadingText, Skeleton, motionMode } from '../../demo-kit/ui'
import { clock, get, isEvent, setSession, useSession, world } from '../../demo-kit/world'
import { useWorldReady, type WorldModule } from '../../demo-kit/world/ready'
import { usePdStrings } from '../../demo-kit/i18n/pd'
import { pendingReviews } from '../../demo-kit/world/pasar-daerah'
import { BANK_TABS, LENDER, OWNER_TABS, SLUG, route, uiStore, type BankTab, type OwnerTab } from './model'
import { useT } from './strings'
import { Mirror } from './Mirror'
import './rapor-usaha.css'

const MODS: readonly WorldModule[] = ['usaha-pintar/data', 'pasar-daerah']
const loadRapor = () => import('./Rapor')
const loadModal = () => import('./Modal')
const loadBerbagi = () => import('./Berbagi')
const loadBank = () => import('./Bank')
const loadAsk = () => import('./Ask')
const Rapor = lazy(loadRapor)
const Modal = lazy(loadModal)
const Berbagi = lazy(loadBerbagi)
const Bank = lazy(loadBank)
const Ask = lazy(loadAsk)
const LOAD: Record<OwnerTab, () => Promise<unknown>> = { rapor: loadRapor, modal: loadModal, berbagi: loadBerbagi }

type Role = 'pemilik-toko' | 'bank-mitra'
const roleOf = (r: string): Role => (r === 'bank-mitra' ? 'bank-mitra' : 'pemilik-toko')
function readParam<T extends string>(k: string, list: readonly T[], d: T): T {
  const v = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get(k)
  return v && (list as readonly string[]).includes(v) ? (v as T) : d
}

const AUTOPLAY_KEY = 'gamada:ru:autoplay'
/** the world clock starts by itself on a first visit at 07.00 (×10), as the other demos do */
function useAutoplay(present: boolean, ready: boolean) {
  useEffect(() => {
    if (!ready || present || motionMode() !== 'full' || new URLSearchParams(window.location.search).get('e2e') === '1') return
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
  }, [present, ready])
}

export default function Canvas(_props: DemoCanvasProps) {
  const ready = useWorldReady(MODS)
  const shell = useShell()
  const { setToastPlacement } = shell
  useAutoplay(shell.present, ready)
  useEffect(() => {
    setToastPlacement({ wide: 'bottom-left', sm: 'top-right' })
    return () => setToastPlacement(null)
  }, [setToastPlacement])
  // start the landing's first chunk with the world modules (not after them)
  useEffect(() => {
    void (roleOf(new URLSearchParams(window.location.search).get('role') ?? '') === 'bank-mitra' ? loadBank() : loadRapor()).catch(() => undefined)
  }, [])
  if (!ready) return <RuSkeleton />
  return <Sandbox />
}

function RuSkeleton() {
  const t = usePdStrings()
  const { t: s } = useT()
  return (
    <div className="dk-ru-stage">
      <BrowserFrame slug={SLUG} label={s.product}>
        <div className="dk-ru" aria-busy="true">
          <p className="dk-ru-muted" role="status">
            {t.pdLoading}
          </p>
          <Skeleton height={44} />
          <div className="dk-ru-top">
            <Skeleton height={300} radius={12} />
            <Skeleton height={300} radius={12} />
          </div>
          <Skeleton height={220} radius={12} />
        </div>
      </BrowserFrame>
    </div>
  )
}

function Sandbox() {
  const { t } = useT()
  const shell = useShell()
  const { focus, clearFocus, toast } = shell
  const session = useSession()
  const role = roleOf(session.role)
  const [ownerTab, setOwnerTab] = useState<OwnerTab>(() => readParam('tab', OWNER_TABS, 'rapor'))
  const [bankTab, setBankTab] = useState<BankTab>(() => readParam('tab', BANK_TABS, 'antrian'))
  const wide = useMediaQuery('(min-width: 1280px)')
  const ask = useAskOpen()

  // ?focus= arrival (also from a cross-product toast): route the id to its role / tab / drawer, then clear it
  useEffect(() => {
    if (!focus) return
    const r = route(world.get(), focus, role)
    if (!r) {
      toast({ title: t.notFound, body: t.notFoundBody, tone: 'warn', icon: 'alert' })
      if (role === 'bank-mitra') setBankTab('antrian')
      else setOwnerTab('rapor')
    } else {
      // always (no-op when unchanged): `role` is the deferred render value, which can still hold the previous page's role
      setSession({ role: r.role })
      if (r.role === 'bank-mitra') setBankTab(r.tab)
      else setOwnerTab(r.tab)
      uiStore.set({ factor: null, review: false, loan: null, ...r.open })
    }
    clearFocus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, clearFocus])
  const tab = role === 'bank-mitra' ? bankTab : ownerTab
  useEffect(() => void replaceQuery({ tab: (role === 'bank-mitra' ? tab === 'antrian' : tab === 'rapor') ? null : tab }), [tab, role])

  const openOther = useCallback(
    (loanId: string | null) => {
      if (role === 'bank-mitra') {
        setSession({ role: 'pemilik-toko' })
        setOwnerTab('modal')
        uiStore.set({ loan: null, flash: loanId })
        toast({ title: t.openOwner, body: t.switched(t.roleOwner), tone: 'accent', icon: 'user' })
      } else {
        setSession({ role: 'bank-mitra' })
        setBankTab('antrian')
        const l = loanId ? get(world.get().loanApps, loanId) : undefined
        uiStore.set({ loan: loanId, seg: l && l.status !== 'diajukan' ? 'diputus' : 'menunggu', flash: loanId })
        toast({ title: t.openBank, body: t.switched(t.roleBank), tone: 'accent', icon: 'users' })
      }
    },
    [role, t, toast],
  )

  const tabs = role === 'bank-mitra' ? BANK_TABS : OWNER_TABS
  const label = (k: string) => (role === 'bank-mitra' ? t.bank[k as BankTab] : t.owner[k as OwnerTab])
  const setTab = (k: string) => startTransition(() => (role === 'bank-mitra' ? setBankTab(k as BankTab) : setOwnerTab(k as OwnerTab)))
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const onKey = (e: KeyboardEvent) => {
    const i = (tabs as readonly string[]).indexOf(tab)
    const n = tabs.length
    const j = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i + n - 1) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1
    if (j < 0) return
    e.preventDefault()
    setTab(tabs[j]!)
    tabRefs.current[tabs[j]!]?.focus()
  }

  const askBtn =
    role === 'pemilik-toko' ? (
      shell.size === 'sm' ? (
        <IconButton icon="spark" label={t.ask} onClick={() => uiStore.set({ ask: true })} aria-haspopup="dialog" {...intentProps(loadAsk)} data-ru="ask" />
      ) : (
        <Button size="sm" variant="ghost" icon="spark" onClick={() => uiStore.set({ ask: true })} aria-haspopup="dialog" {...intentProps(loadAsk)} data-ru="ask">
          {t.ask}
        </Button>
      )
    ) : undefined

  return (
    <div className={`dk-ru-stage${wide ? ' is-wide' : ''}`} data-role={role}>
      <BrowserFrame slug={SLUG} path={tab === tabs[0] ? SLUG : `${SLUG}/${tab}`} label={role === 'bank-mitra' ? t.bankFrame(LENDER) : t.product} actions={askBtn}>
        <div className="dk-ru" data-tab={tab}>
          <div className="dk-ru-tabs" role="tablist" aria-label={t.tabsLabel} onKeyDown={onKey}>
            {tabs.map((k) => (
              <button
                key={k}
                ref={(el) => void (tabRefs.current[k] = el)}
                type="button"
                role="tab"
                id={`dk-ru-tab-${k}`}
                aria-selected={tab === k}
                aria-controls="dk-ru-panel"
                tabIndex={tab === k ? 0 : -1}
                className="dk-ru-tab"
                {...(role === 'pemilik-toko' ? intentProps(LOAD[k as OwnerTab]) : {})}
                {...(k === 'modal' ? { 'data-hotspot': 'ru-modal-tab' } : {})}
                onClick={() => setTab(k)}
              >
                {label(k)}
              </button>
            ))}
          </div>
          <div id="dk-ru-panel" role="tabpanel" aria-labelledby={`dk-ru-tab-${tab}`} className="dk-ru-panel">
            <Suspense fallback={<LoadingText>{t.loading}</LoadingText>}>
              {role === 'bank-mitra' ? (
                <Bank tab={bankTab} />
              ) : ownerTab === 'rapor' ? (
                <Rapor goTab={setTab} />
              ) : ownerTab === 'modal' ? (
                <Modal goTab={setTab} mirror={wide ? null : <Mirror side="bank" onOpen={openOther} inline />} />
              ) : (
                <Berbagi />
              )}
            </Suspense>
          </div>
        </div>
      </BrowserFrame>
      {wide && <Mirror side={role === 'bank-mitra' ? 'owner' : 'bank'} onOpen={openOther} />}
      {ask && role === 'pemilik-toko' && (
        <Suspense fallback={null}>
          <Ask />
        </Suspense>
      )}
    </div>
  )
}

function useAskOpen(): boolean {
  const [open, setOpen] = useState(uiStore.get().ask)
  useEffect(() => uiStore.sub(() => setOpen(uiStore.get().ask)), [])
  return open
}

/* ------------------------------------------------------------------ guide missions (plan §2 P15) */

export const missions: readonly Mission[] = [
  {
    id: 'faktor',
    label: { id: 'Lihat faktor skor', en: 'See a score factor' },
    hint: { id: 'Di Skor usaha, ketuk salah satu baris "Yang menaikkan / menurunkan" untuk melihat buktinya.', en: 'In Business score, tap one of the "What raises / lowers it" rows to see its evidence.' },
    target: '[data-ru="factor"]',
  },
  {
    id: 'naik',
    label: { id: 'Naikkan skor', en: 'Raise the score' },
    hint: { id: 'Kartu "Rapikan 3 jurnal": periksa saran akun, lalu "Setujui 3 saran". Skor naik +10 per jurnal.', en: 'The "Tidy 3 journal entries" card: check the suggested accounts, then "Approve 3 suggestions". +10 per entry.' },
    target: '[data-ru="fix"]',
    done: (e, s) => isEvent(e, 'score.updated') && e.payload.businessId === s.meta.shopId && e.payload.delta > 0 && pendingReviews(s, s.meta.shopId) === 0,
  },
  {
    id: 'bagikan',
    label: { id: 'Bagikan data', en: 'Share data' },
    hint: { id: 'Tab Berbagi data: pilih data, lama akses, lalu "Setujui berbagi" ke Koperasi Mitra Usaha Sejahtera.', en: 'Data sharing tab: pick the data and how long, then "Approve sharing" with Koperasi Mitra Usaha Sejahtera.' },
    target: '[data-ru="share"]',
    done: (e) => isEvent(e, 'consent.granted') && e.source === SLUG && e.payload.lender === LENDER,
  },
  {
    id: 'ajukan',
    label: { id: 'Ajukan modal', en: 'Apply for capital' },
    hint: { id: 'Tab Modal kerja: geser plafon, pilih tenor dan tujuan, lalu "Ajukan modal".', en: 'Working capital tab: slide the amount, pick a tenor and purpose, then "Apply".' },
    target: '[data-hotspot="ru-modal-tab"]',
    done: (e, s) => isEvent(e, 'loan.applied') && e.source === SLUG && e.payload.businessId === s.meta.shopId,
  },
  {
    id: 'setujui',
    label: { id: 'Setujui sebagai koperasi', en: 'Approve as the cooperative' },
    hint: { id: 'Ganti peran ke Bank/Koperasi Mitra di bilah atas (atau "Buka sebagai Koperasi"), buka pengajuan toko, lalu "Setujui".', en: 'Switch the role to Partner Bank / Cooperative in the top bar (or "Open as the cooperative"), open the shop’s application, then "Approve".' },
    hintSm: { id: 'Ketuk ⋯ → Peran → Bank/Koperasi Mitra, buka pengajuan toko, lalu "Setujui".', en: 'Tap ⋯ → Role → Partner Bank / Cooperative, open the shop’s application, then "Approve".' },
    done: (e, s) => isEvent(e, 'loan.approved') && get(s.loanApps, e.payload.loanId)?.businessId === s.meta.shopId,
  },
]

export const hotspot = { target: '[data-hotspot="ru-fix"]', id: 'rapor-usaha-start', label: { id: 'Mulai di sini: naikkan skor', en: 'Start here: raise the score' } }
