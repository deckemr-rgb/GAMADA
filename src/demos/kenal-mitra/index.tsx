/**
 * demos/kenal-mitra — P11 Kenal Mitra · verifikasi nasabah (KYC), mitra/supplier (KYB) dan kandidat (CV)
 * (spec §11 P11, brief docs/build/tahap3-plan.md §2 P11).
 *
 * BrowserFrame "demo.gamada.id/kenal-mitra", tabs Antrian · Nasabah (KYC) · Mitra/Supplier (KYB) · Kandidat (CV)
 * (`?tab=antrian|kyc|kyb|cv`). Antrian is the first load (KPI, three lanes, Katalog Lokal preview, activity); the
 * case tabs are lazy and fetched on intent. Role Bank/Koperasi Mitra: "Permintaan saya" + "Hasil verifikasi" (lazy).
 * Emits verification.requested (bank role) and partner.verified (kyc / kyb / cv batch, source kenal-mitra); consumes
 * the 07:01 natural KYC request, C26 priority KYB requests (need.created) and ?focus=<request|verification|business>.
 */
import { Suspense, lazy, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DemoCanvasProps } from '../registry'
import type { Mission } from '../../demo-kit/shell'
import { preloadNow, replaceQuery, useShell } from '../../demo-kit/shell'
import { BrowserFrame } from '../../demo-kit/frames'
import { Button, IconButton, Icon, Skeleton, Tabs, motionMode } from '../../demo-kit/ui'
import { clock, isEvent, onEvent, setSession, useEcosystemReady, useSession, useWorld, world, WORLD } from '../../demo-kit/world'
import { useDemoStrings } from '../../demo-kit/i18n'
import { BANK_TABS, ANALYST_TABS, defaultTab, kmRole, readTab, resolveFocus, type KmTab } from './model'
import { STR, useStr } from './strings'
import QueueTab from './Queue'
import './kenal-mitra.css'

const loadKyc = () => import('./Kyc')
const loadKyb = () => import('./Kyb')
const loadCv = () => import('./Candidates')
const loadBank = () => import('./Bank')
const loadReasons = () => import('./Reasons')
const Kyc = lazy(loadKyc)
const Kyb = lazy(loadKyb)
const Candidates = lazy(loadCv)
const Bank = lazy(loadBank)
const Reasons = lazy(loadReasons)
const LOADER: Partial<Record<KmTab, () => Promise<unknown>>> = { kyc: loadKyc, kyb: loadKyb, cv: loadCv, minta: loadBank, hasil: loadBank }

/** the world clock starts on its own at 07.00 (×10) on a first visit, unless motion is reduced / off, the page was
 *  opened at another time (?t=), a test drives it (?e2e=1, unless &autoplay=1) or it already ran in this tab */
const AUTOPLAY_KEY = 'gamada:km:autoplay'
function useAutoplay(present: boolean) {
  useEffect(() => {
    if (present || motionMode() !== 'full') return
    const q = new URLSearchParams(window.location.search)
    if (q.get('e2e') === '1' && q.get('autoplay') !== '1') return
    try {
      if (window.sessionStorage.getItem(AUTOPLAY_KEY) === '1') return
    } catch {
      /* storage blocked: autoplay once per page load */
    }
    const tm = window.setTimeout(() => {
      const c = clock.get()
      if (c.running || c.minutes !== WORLD.clockStart || world.status() !== 'ready') return
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

/** skeleton with the final boxes (tab bar, KPI strip, three lanes + rail) until the business world is in */
function KmSkeleton() {
  const t = useDemoStrings()
  return (
    <div className="dk-km dk-km-skel" aria-busy="true">
      <p className="dk-sr" role="status">
        {t.upLoading}
      </p>
      <div className="dk-km-skel-bar">
        <Skeleton height={44} />
      </div>
      <div className="dk-km-kpis">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={92} radius={12} />
        ))}
      </div>
      <div className="dk-km-board">
        <div className="dk-km-lanes">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={300} radius={12} />
          ))}
        </div>
        <div className="dk-km-rail">
          <Skeleton height={220} radius={12} />
          <Skeleton height={180} radius={12} />
        </div>
      </div>
    </div>
  )
}

export default function Canvas({ product }: DemoCanvasProps) {
  const ready = useEcosystemReady('usaha-pintar')
  const { present } = useSession()
  useAutoplay(present)
  if (!ready) return <KmSkeleton />
  return <KenalMitra product={product} />
}

function KenalMitra({ product }: { product: string }) {
  const { t, lang } = useStr()
  const langRef = useRef(lang)
  langRef.current = lang
  const shell = useShell()
  const { role: sessionRole } = useSession()
  const role = kmRole(sessionRole)
  const [tab, setTab] = useState<KmTab>(() => readTab(role))
  const [cases, setCases] = useState<{ kyc: string | null; kyb: string | null; n: number }>({ kyc: null, kyb: null, n: 0 })
  const [bankFocus, setBankFocus] = useState<{ req: string | null; cert: string | null; n: number }>({ req: null, cert: null, n: 0 })
  const [askOpen, setAskOpen] = useState(false)
  const sm = shell.size === 'sm'
  const queueN = useWorld((s) => {
    let n = 0
    const now = clock.get().minutes
    for (const id of s.verificationRequests.ids) {
      const r = s.verificationRequests.byId[id]
      if (r && r.status !== 'selesai' && r.at <= now) n++
    }
    return n
  })

  const sessionRoleRef = useRef(sessionRole)
  sessionRoleRef.current = sessionRole
  const go = useCallback((next: KmTab, caseId?: string | null) => {
    startTransition(() => {
      setTab(next)
      if (caseId !== undefined && (next === 'kyc' || next === 'kyb')) setCases((c) => ({ ...c, [next]: caseId, n: c.n + 1 }))
    })
    replaceQuery({ tab: next === defaultTab(kmRole(sessionRoleRef.current)) ? null : next })
  }, [])

  // a role switch: the other role's tabs do not exist here (a "Ganti peran" from a bank toast lands on its request)
  const pending = useRef<{ tab: KmTab; caseId: string | null } | null>(null)
  useEffect(() => {
    const ok = role === 'bank' ? BANK_TABS : ANALYST_TABS
    if (ok.includes(tab)) return
    const p = pending.current
    pending.current = null
    if (p && ok.includes(p.tab)) go(p.tab, p.caseId)
    else go(defaultTab(role))
  }, [role, tab, go])
  const toAnalyst = useCallback((caseId: string | null) => {
    pending.current = { tab: 'kyc', caseId }
    setSession({ role: 'analis-kyc' })
  }, [])

  // ?focus=<request | verification | business | KTP document | candidate> → tab + case; unknown ⇒ default tab + toast
  const { focus, clearFocus, toast } = shell
  const handled = useRef<string | null>(null)
  useEffect(() => {
    if (!focus) {
      handled.current = null
      return
    }
    if (handled.current === focus) return
    handled.current = focus
    const hit = resolveFocus(world.get(), focus, role)
    if (!hit) {
      go(defaultTab(role))
      toast({ title: STR[langRef.current].notFound, body: STR[langRef.current].notFoundBody, tone: 'warn', icon: 'alert' })
    } else if (role === 'bank') {
      go(hit.tab)
      setBankFocus((b) => ({ req: hit.caseId, cert: hit.certId ?? null, n: b.n + 1 }))
    } else go(hit.tab, hit.caseId)
    clearFocus()
  }, [focus, clearFocus, role, go, toast])

  // C26: priority KYB requests for an emergency need jump to the top of the KYB lane (one toast per need)
  useEffect(() => {
    const told = new Set<string>()
    return onEvent('*', (e) => {
      if (!isEvent(e, 'verification.requested') || !e.payload.priority || !e.payload.needId || told.has(e.payload.needId)) return
      const needId = e.payload.needId
      told.add(needId)
      window.setTimeout(() => {
        const s = world.get()
        const n = s.verificationRequests.ids.filter((id) => {
          const r = s.verificationRequests.byId[id]
          return r?.needId === needId && r.priority && r.status !== 'selesai'
        }).length
        const L = STR[langRef.current]
        const code = s.catalogNeeds.byId[needId]?.code ?? needId
        if (kmRole(sessionRoleRef.current) === 'bank' || !n) return
        toast({ id: `km-prio-${needId}`, title: L.priorityToast(n, code), body: L.priorityBody, tone: 'warn', icon: 'flag', action: { label: L.priorityOpen, onClick: () => go('kyb') } })
      }, 60)
    })
  }, [toast, go])

  // intent on a tab (pointer over, focus, press, touch): fetch its chunk before the click
  const warmTab = useCallback((e: { target: EventTarget }) => {
    const id = (e.target as HTMLElement).closest?.('[role=tab]')?.id ?? ''
    const k = (Object.keys(LOADER) as KmTab[]).find((x) => id.endsWith(`-t-${x}`))
    const load = k ? LOADER[k] : undefined
    if (load) preloadNow(load)
  }, [])
  const warmReasons = useCallback(() => preloadNow(loadReasons), [])

  const tabs = role === 'bank' ? BANK_TABS : ANALYST_TABS
  const items = useMemo(
    () =>
      tabs.map((id) => ({
        id,
        label: sm ? t.tabSm[id] : t.tab[id],
        ...(id === 'antrian' && queueN ? { badge: queueN, badgeLabel: t.queueBadge(queueN) } : {}),
        ...(!sm ? { icon: id === 'antrian' ? ('inbox' as const) : id === 'kyc' ? ('user' as const) : id === 'kyb' ? ('building' as const) : id === 'cv' ? ('users' as const) : id === 'minta' ? ('send' as const) : ('shield' as const) } : {}),
      })),
    [tabs, sm, t, queueN],
  )
  const fallback = (
    <div className="dk-km-fallback" aria-busy="true">
      <Skeleton height={44} />
      <Skeleton height={280} radius={12} />
    </div>
  )
  const cur = tabs.includes(tab) ? tab : defaultTab(role)

  return (
    <div className="dk-km" data-product={product} data-role={role} data-tab={cur}>
      <BrowserFrame
        path={`kenal-mitra${cur === defaultTab(role) ? '' : `/${cur}`}`}
        label={t.frame}
        className="dk-km-frame"
        actions={
          sm ? (
            <IconButton icon="help" label={t.askWhy} onClick={() => setAskOpen(true)} onPointerEnter={warmReasons} onFocus={warmReasons} onTouchStart={warmReasons} data-km="ask" />
          ) : (
            <Button size="sm" variant="quiet" icon="help" onClick={() => setAskOpen(true)} onPointerEnter={warmReasons} onFocus={warmReasons} data-km="ask">
              {t.askWhy}
            </Button>
          )
        }
      >
        <div className="dk-km-tabs" onPointerOver={warmTab} onPointerDown={warmTab} onFocus={warmTab} onTouchStart={warmTab}>
          <Tabs items={items} value={cur} onChange={(v) => go(v)} label={t.tabsLabel} fill={sm}>
            <p className="dk-km-rolenote">
              <Icon name={role === 'bank' ? 'building' : 'shield'} size={14} />
              <span>{t.roleNote[role]}</span>
            </p>
            {cur === 'antrian' && <QueueTab onOpen={(r) => go(r.kind === 'kyc' ? 'kyc' : r.kind === 'kyb' ? 'kyb' : 'cv', r.id)} intent={LOADER} />}
            {cur !== 'antrian' && (
              <Suspense fallback={fallback}>
                {cur === 'kyc' && <Kyc caseId={cases.kyc} focusKey={cases.n} onCase={(id) => setCases((c) => ({ ...c, kyc: id }))} />}
                {cur === 'kyb' && <Kyb caseId={cases.kyb} focusKey={cases.n} onCase={(id) => setCases((c) => ({ ...c, kyb: id }))} onGoKyc={(id) => go('kyc', id)} />}
                {cur === 'cv' && <Candidates />}
                {(cur === 'minta' || cur === 'hasil') && <Bank view={cur} focusReq={bankFocus.req} focusCert={bankFocus.cert} focusKey={bankFocus.n} onSwitchToAnalyst={toAnalyst} />}
              </Suspense>
            )}
          </Tabs>
        </div>
      </BrowserFrame>
      {askOpen && (
        <Suspense fallback={null}>
          <Reasons open={askOpen} onClose={() => setAskOpen(false)} />
        </Suspense>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ guide */

export const missions: readonly Mission[] = [
  {
    id: 'kyc',
    label: { id: 'Verifikasi 1 nasabah (KYC)', en: 'Verify 1 customer (KYC)' },
    hint: {
      id: 'Antrian → lajur KYC → kartu nasabah → ikuti langkah di HP Nasabah (KTP, swafoto, liveness, Kirim) → di panel Analis pilih keputusan → “Kirim keputusan”.',
      en: 'Queue → KYC lane → a customer card → follow the steps on the customer phone (ID card, selfie, liveness, Send) → in the Analyst panel pick a decision → “Send decision”.',
    },
    target: '[data-km-lane="kyc"]',
    done: (e) => isEvent(e, 'partner.verified') && e.payload.kind === 'kyc' && e.source === 'kenal-mitra',
  },
  {
    id: 'kyb',
    label: { id: 'Loloskan 1 mitra usaha (KYB)', en: 'Pass 1 business partner (KYB)' },
    hint: {
      id: 'Tab Mitra/Supplier (di HP: KYB) → CV pemasok karung & terpal → “Mulai verifikasi” → “Cek lokasi” → “Setujui”.',
      en: 'Partners/Suppliers tab (KYB on a phone) → the sandbag & tarp CV supplier → “Start verification” → “Check location” → “Approve”.',
    },
    target: '[data-km-lane="kyb"]',
    done: (e) => isEvent(e, 'partner.verified') && e.payload.kind === 'kyb' && e.payload.result === 'lolos' && e.source === 'kenal-mitra',
  },
  {
    id: 'alamat',
    label: { id: 'Temukan alamat yang tidak cocok', en: 'Catch a mismatched address' },
    hint: {
      id: 'Tab Mitra/Supplier → UD pemasok terpal → “Mulai verifikasi” → “Cek lokasi” (GPS foto ±9 km) → “Tandai cek manual”.',
      en: 'Partners/Suppliers tab → the tarp UD supplier → “Start verification” → “Check location” (photo GPS ±9 km) → “Mark for manual check”.',
    },
    target: '[data-km-lane="kyb"]',
    done: (e) => isEvent(e, 'partner.verified') && e.payload.kind === 'kyb' && e.payload.result === 'cek-manual' && e.source === 'kenal-mitra',
  },
  {
    id: 'cv',
    label: { id: 'Saring 200 CV jadi 10 kandidat', en: 'Screen 200 CVs down to 10 candidates' },
    hint: {
      id: 'Tab Kandidat (di HP: CV) → “Unggah 200 CV contoh” → atur kriteria → “Saring”.',
      en: 'Candidates tab (CV on a phone) → “Upload 200 sample CVs” → set the criteria → “Screen”.',
    },
    target: '[data-km-lane="cv"]',
  },
]

export const hotspot = {
  target: '[data-hotspot="km-first-request"]',
  label: { id: 'Mulai verifikasi nasabah ini', en: 'Start verifying this customer' },
}
