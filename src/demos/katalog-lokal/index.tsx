/**
 * demos/katalog-lokal — P14 Katalog Lokal · Etalase UMKM untuk Belanja Pemda (spec §11 P14, plan tahap4 §2 P14).
 *
 * One big toggle "Sisi Pemda ↔ Sisi UMKM" (= the session role ukpbj / pemilik-toko) flips the card (rotateY 600 ms;
 * crossfade under reduced motion). Pemda (first load): BrowserFrame (KPI strip, composer, need list, need detail with
 * MatchBoard → compare tray → orders) | PhoneFrame "HP UMKM" peek. UMKM side, Compare, Peta, the composer AI and
 * "Tanya Katalog" are lazy (intent). Alive: 07:01 a natural need arrives with its matches (lines light one by one),
 * 07:03 the seeded order is paid. Emits need.created / order.created / order.confirmed / order.shipped / order.paid
 * (source katalog-lokal); consumes match.made (C36/C27), partner.verified (L8), tax.ready (L7), bid.submitted (L9),
 * procurement.flagged and ?focus=<KB- | OR- | MC- | TD- | UM- id>. Every number comes from world/pasar-daerah.
 */
import { Suspense, lazy, startTransition, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { DemoCanvasProps } from '../registry'
import type { Mission } from '../../demo-kit/shell'
import { preloadNow, useShell } from '../../demo-kit/shell'
import { BrowserFrame } from '../../demo-kit/frames'
import { Button, Kpi, KpiStrip, LoadingText, Skeleton, flashNewRow, flyBetween, motionMode } from '../../demo-kit/ui'
import { clock, emit, getSession, isEvent, onEvent, setSession, useClock, useSession, useWorld, world, type Order, type WorldState } from '../../demo-kit/world'
import { useWorldReady, type WorldModule } from '../../demo-kit/world/ready'
import { catalogKpi, needList, umkmInbox, type NeedTab } from '../../demo-kit/world/pasar-daerah'
import { usePdStrings } from '../../demo-kit/i18n/pd'
import Detail from './Detail'
import { Composer, NeedList, PhonePeek } from './Pemda'
import { SLUG, afterPaint, bizName, exampleKecs, kecName, resolveFocus, rpShort, type Side } from './model'
import { STRINGS, useT } from './strings'
import './katalog-lokal.css'

const MODS: readonly WorldModule[] = ['usaha-pintar/data', 'pasar-daerah']
const loadUmkm = () => import('./Umkm')
const Umkm = lazy(loadUmkm)
const loadCompare = () => import('./Compare')
const Compare = lazy(loadCompare)
const loadSpec = () => import('./Spec')
const Spec = lazy(loadSpec)
const loadAsk = () => import('./Ask')
const Ask = lazy(loadAsk)

const AUTOPLAY_KEY = 'gamada:kl:autoplay'
const ANNOUNCE_GAP_MS = 6000
const whole = (s: WorldState) => s
const STATUS_IX: Record<Order['status'], number> = { dipesan: 0, dikonfirmasi: 1, dikirim: 2, dibayar: 3 }
const tabOf = (st: string): NeedTab => (st === 'dipesan' ? 'dipesan' : st === 'selesai' ? 'selesai' : 'terbuka')

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
    }, 600)
    return () => window.clearTimeout(tm)
  }, [ready])
}

function PdSkeleton({ label }: { label: string }) {
  return (
    <div className="dk-kl dk-kl-skel" data-eco="pasar-daerah" aria-busy="true">
      <p className="dk-kl-muted" role="status">
        {label}
      </p>
      <Skeleton height={48} radius={24} />
      <div className="dk-kl-stage">
        <div className="dk-kl-skel-app">
          <div className="dk-kl-skel-kpis">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={64} radius={10} />
            ))}
          </div>
          <div className="dk-kl-body">
            <Skeleton height={320} radius={12} />
            <Skeleton height={320} radius={12} />
          </div>
        </div>
        <Skeleton height={420} radius={28} className="dk-kl-skel-phone" />
      </div>
    </div>
  )
}

export default function Canvas(_props: DemoCanvasProps) {
  const ready = useWorldReady(MODS)
  const p = usePdStrings()
  useAutoplay(ready)
  return ready ? <Product /> : <PdSkeleton label={p.pdLoading} />
}

/** the flip card: both faces in one grid cell (wide); the hidden face is inert. Phones render the active side only. */
function FlipStage({ side, sm, front, back }: { side: Side; sm: boolean; front: ReactNode; back: ReactNode }) {
  const [backOn, setBackOn] = useState(side === 'umkm')
  useEffect(() => {
    if (side === 'umkm') setBackOn(true)
  }, [side])
  if (sm)
    return (
      <div className="dk-kl-flip is-sm" data-side={side}>
        <section key={side} className="dk-kl-face is-on">
          {side === 'pemda' ? front : back}
        </section>
      </div>
    )
  return (
    <div className="dk-kl-flip" data-side={side} data-motion={motionMode()}>
      <div className="dk-kl-card">
        <section className="dk-kl-face is-front" inert={side !== 'pemda'}>
          {front}
        </section>
        {backOn && (
          <section className="dk-kl-face is-back" inert={side !== 'umkm'}>
            {back}
          </section>
        )}
      </div>
    </div>
  )
}

function Product() {
  const { t, lang } = useT()
  const shell = useShell()
  const { focus, clearFocus, toast } = shell
  const sm = shell.size === 'sm'
  const s = useWorld(whole)
  const clk = useClock()
  const now = clk.minutes
  const { role } = useSession()
  const side: Side = role === 'pemilik-toko' ? 'umkm' : 'pemda'
  const [tab, setTab] = useState<NeedTab>('terbuka')
  const [sel, setSel] = useState<string | null>(null)
  const [pinned, setPinned] = useState(false)
  const [smDetail, setSmDetail] = useState(false)
  const [picks, setPicks] = useState<string[]>([])
  const [view, setView] = useState<'daftar' | 'peta'>(() => {
    try {
      return new URLSearchParams(window.location.search).get('view') === 'peta' ? 'peta' : 'daftar'
    } catch {
      return 'daftar'
    }
  })
  const [text, setText] = useState('')
  const [draft, setDraft] = useState<{ text: string; n: number } | null>(null)
  const [cmp, setCmp] = useState(false)
  const [ask, setAsk] = useState(false)
  const [viewAs, setViewAs] = useState<string>(() => world.get().meta.shopId)
  const [umkmOrder, setUmkmOrder] = useState<string | null>(null)
  const [focusKey, setFocusKey] = useState(0)
  const [flashSel, setFlashSel] = useState<string | null>(null)
  const [fly, setFly] = useState<string | null>(null)
  const [said, setSaid] = useState('')
  const lastSaid = useRef(0)
  const paying = useRef(new Set<string>())
  const langRef = useRef(lang)
  langRef.current = lang

  const kpi = catalogKpi(s, now)
  const lists = useMemo(() => ({ terbuka: needList(s, now, 'terbuka'), dipesan: needList(s, now, 'dipesan'), selesai: needList(s, now, 'selesai') }), [s, now])
  const counts = { terbuka: lists.terbuka.length, dipesan: lists.dipesan.length, selesai: lists.selesai.length }
  // until the visitor picks a need, the newest open need is on screen (the 07:01 natural need slides in by itself)
  const cur = pinned ? (sel && s.catalogNeeds.byId[sel] ? sel : null) : (lists.terbuka[0]?.id ?? null)
  const matchCount = useMemo(() => {
    const m = new Map<string, number>()
    for (const id of s.matches.ids) {
      const x = s.matches.byId[id]!
      m.set(x.needId, (m.get(x.needId) ?? 0) + 1)
    }
    return (needId: string) => m.get(needId) ?? 0
  }, [s.matches])
  const inbox = useMemo(() => umkmInbox(s, s.businesses.byId[viewAs] ? viewAs : s.meta.shopId), [s, viewAs])
  const newCount = inbox.filter((o) => o.isNew).length
  const examples = useMemo(() => {
    const [a, b, c] = exampleKecs(s)
    return [t.ex1(a), t.ex2(b), t.ex3(c)]
  }, [s.region, s.businesses, t]) // eslint-disable-line react-hooks/exhaustive-deps

  const announce = useCallback((msg: string) => {
    if (Date.now() - lastSaid.current < ANNOUNCE_GAP_MS) return
    lastSaid.current = Date.now()
    setSaid(msg)
  }, [])

  const openNeed = useCallback(
    (id: string) => {
      startTransition(() => {
        setSel(id)
        setPinned(true)
        setPicks([])
        setDraft(null)
        if (sm) setSmDetail(true)
      })
    },
    [sm],
  )

  const toggle = useCallback((to?: Side) => {
    const next = to ?? (getSession().role === 'pemilik-toko' ? 'pemda' : 'umkm')
    // the role is a shell-wide store (sync render of the whole frame): flip after the pressed toggle has painted (INP)
    afterPaint(() => {
      setSession({ role: next === 'umkm' ? 'pemilik-toko' : 'ukpbj' })
      setFocusKey((k) => k + 1)
    })
  }, [])

  // arriving needs / order steps: one polite announcement per ≥ 6 s
  useEffect(
    () =>
      onEvent('*', (e) => {
        const L = STRINGS[langRef.current]
        const st = world.get()
        if (isEvent(e, 'need.created')) {
          const n = e.payload.id ? st.catalogNeeds.byId[e.payload.id] : undefined
          if (n) announce(L.announceNeed(n.code, n.title[langRef.current]))
        } else if (isEvent(e, 'order.created') || isEvent(e, 'order.confirmed') || isEvent(e, 'order.shipped') || isEvent(e, 'order.paid')) {
          const oid = 'orderId' in e.payload ? e.payload.orderId : e.payload.id
          const o = oid ? st.orders.byId[oid] : undefined
          if (o) announce(L.announceOrder(o.code, L.status[STATUS_IX[o.status]]!))
        }
      }),
    [announce],
  )

  // ?focus=<need | order | match | tender | business id> (toasts, the tour); unknown → Pemda default + a toast
  useEffect(() => {
    if (!focus) return
    const st = world.get()
    const hit = resolveFocus(st, focus, getSession().role)
    if (!hit) {
      setSession({ role: 'ukpbj' })
      setSmDetail(false)
      toast({ title: STRINGS[langRef.current].notFound, body: STRINGS[langRef.current].notFoundBody, tone: 'warn' })
    } else if (hit.side === 'umkm') {
      setSession({ role: 'pemilik-toko' })
      if (hit.bizId) setViewAs(hit.bizId)
      setUmkmOrder(hit.orderId ?? null)
    } else {
      setSession({ role: 'ukpbj' })
      if (hit.needId) {
        setSel(hit.needId)
        setPinned(true)
        setPicks([])
        setDraft(null)
        setTab(tabOf(st.catalogNeeds.byId[hit.needId]?.status ?? ''))
        setSmDetail(true)
      }
      setFlashSel(hit.orderId ? `[data-kl-order="${hit.orderId}"]` : hit.bizId ? `[data-kl-card="${hit.bizId}"],[data-kl-wait="${hit.bizId}"]` : '[data-kl="need-spec"]')
    }
    clearFocus()
  }, [focus, clearFocus, toast])

  // scroll + flash the focused element once it is on screen
  useEffect(() => {
    if (!flashSel) return
    const tm = window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>(flashSel)
      const det = el?.closest('details')
      if (det) det.open = true
      if (el) {
        el.scrollIntoView({ block: 'center' })
        flashNewRow(el)
      }
      setFlashSel(null)
    }, 160)
    return () => window.clearTimeout(tm)
  }, [flashSel, cur])

  // a new order flies from the tracker to the phone peek (wide)
  useEffect(() => {
    if (!fly) return
    const from = document.querySelector(`[data-kl-order="${fly}"] [data-kl="order-code"]`)
    const to = document.querySelector('[data-kl="phone-peek"]')
    if (!from) return
    setFly(null)
    if (to) void flyBetween(from, to, { duration: 700 })
  }, [fly, s])

  const onPay = useCallback((o: Order) => {
    if (paying.current.has(o.id)) return
    paying.current.add(o.id)
    emit('order.paid', { orderId: o.id, amount: o.total, method: 'transfer-kasda' }, SLUG)
  }, [])
  const onOpenUmkm = useCallback(
    (o: Order) => {
      setViewAs(o.businessId)
      setUmkmOrder(o.id)
      toggle('umkm')
    },
    [toggle],
  )
  const curRef = useRef(cur)
  curRef.current = cur
  const onPick = useCallback((bizId: string) => {
    setSel((x) => x ?? curRef.current)
    setPinned(true)
    setPicks((p) => (p.includes(bizId) ? p.filter((x) => x !== bizId) : p.length >= 3 ? p : [...p, bizId]))
  }, [])
  const compose = (v: string) => {
    if (!v.trim()) return
    setSel((x) => x ?? curRef.current)
    setPinned(true)
    setDraft((d) => ({ text: v, n: (d?.n ?? 0) + 1 }))
    setSmDetail(false)
  }
  const onPublished = useCallback(
    (id: string) => {
      setTab('terbuka')
      setText('')
      openNeed(id)
    },
    [openNeed],
  )
  const onOrdered = useCallback((ids: string[], bizId: string) => {
    setCmp(false)
    setPicks([])
    setViewAs(bizId)
    setUmkmOrder(ids[0] ?? null)
    if (ids[0]) setFly(ids[0])
  }, [])

  const kn = (id: string) => kecName(s, id)
  const detail = cur ? (
    <Detail
      s={s}
      needId={cur}
      picks={picks}
      onPick={onPick}
      onClearPicks={() => setPicks([])}
      onCompare={() => setCmp(true)}
      compareIntent={() => preloadNow(loadCompare)}
      view={view}
      onView={setView}
      onPay={onPay}
      onOpenUmkm={onOpenUmkm}
      t={t}
      lang={lang}
    />
  ) : (
    <p className="dk-kl-empty" data-kl="empty">
      {sm ? t.emptyDetailSm : t.emptyDetail}
    </p>
  )
  const spec = draft && (
    <Suspense fallback={<LoadingText>{t.loading}</LoadingText>}>
      <Spec key={draft.n} text={draft.text} onPublished={onPublished} onOpenNeed={openNeed} onCancel={() => setDraft(null)} />
    </Suspense>
  )
  const composer = (
    <Composer
      text={text}
      onText={setText}
      examples={examples}
      onExample={(x) => {
        setText(x)
        compose(x)
      }}
      onCompose={() => compose(text)}
      onIntent={() => preloadNow(loadSpec)}
      onAsk={() => setAsk(true)}
      askIntent={() => preloadNow(loadAsk)}
      t={t}
    />
  )
  const list = <NeedList tab={tab} onTab={setTab} counts={counts} needs={lists[tab]} selected={cur} onOpen={openNeed} kecName={kn} matchCount={matchCount} t={t} lang={lang} />
  const staticLine = !clk.running && now < 7 * 60 + 1 && (
    <p className="dk-kl-static">
      {t.staticLine}
      <Button size="sm" variant="ghost" icon="play" onClick={() => clock.play()}>
        {t.playClock}
      </Button>
    </p>
  )

  const front = (
    <div className="dk-kl-stage">
      <BrowserFrame slug={SLUG} label={t.frame}>
        <div className="dk-kl-app">
          <h2 className="dk-kl-h" tabIndex={-1} data-kl-face-h="pemda">
            {t.sidePemda} <span className="dk-kl-muted">· {t.roleUkpbj}</span>
          </h2>
          <KpiStrip label={t.kpiLabel} className="dk-kl-kpis">
            <Kpi label={t.kpiOpen} value={kpi.openNeeds} wrapLabel />
            <Kpi label={t.kpiVerified} value={kpi.verifiedLocal} wrapLabel />
            <Kpi label={t.kpiOrders} value={kpi.ordersToday} caption={t.kpiOrdersCap(kpi.ordersTodayBusinesses)} wrapLabel />
            <Kpi label={t.kpiSpend} value={kpi.spendMonth} format={(v) => rpShort(v, lang)} caption={t.sim} wrapLabel />
          </KpiStrip>
          {staticLine}
          {sm ? (
            smDetail && cur ? (
              <div className="dk-kl-push">
                <Button size="sm" variant="ghost" icon="arrowLeft" onClick={() => setSmDetail(false)} data-kl="back">
                  {t.back}
                </Button>
                {detail}
              </div>
            ) : (
              <>
                {composer}
                {spec}
                {list}
              </>
            )
          ) : (
            <div className="dk-kl-body">
              <div className="dk-kl-left">
                {composer}
                {list}
              </div>
              <div className="dk-kl-right">{spec || detail}</div>
            </div>
          )}
        </div>
      </BrowserFrame>
      {!sm && <PhonePeek biz={bizName(s, inbox[0]?.businessId ?? viewAs)} orders={inbox} minutes={now} onOpen={() => toggle('umkm')} t={t} lang={lang} />}
    </div>
  )
  const back = (
    <Suspense fallback={<LoadingText>{t.loading}</LoadingText>}>
      <Umkm viewAs={viewAs} onViewAs={setViewAs} focusOrder={umkmOrder} onFocusDone={() => setUmkmOrder(null)} active={side === 'umkm'} focusKey={focusKey} sm={sm} />
    </Suspense>
  )

  return (
    <div className="dk-kl" data-eco="pasar-daerah" data-size={sm ? 'sm' : 'wide'} data-side={side}>
      <p className="dk-sr" role="status" aria-live="polite">
        {said}
      </p>
      <div className="dk-kl-top">
        <button
          type="button"
          className="dk-kl-toggle"
          data-kl="side-toggle"
          aria-pressed={side === 'umkm'}
          aria-label={side === 'pemda' ? t.toUmkm : t.toPemda}
          onClick={() => toggle()}
          onPointerEnter={() => preloadNow(loadUmkm)}
          onFocus={() => preloadNow(loadUmkm)}
        >
          <span className={side === 'pemda' ? 'is-on' : ''}>{t.sidePemda}</span>
          <span className={side === 'umkm' ? 'is-on' : ''}>{t.sideUmkm}</span>
        </button>
        {sm && side === 'pemda' && newCount > 0 && (
          <button type="button" className="dk-kl-pill" onClick={() => toggle('umkm')} data-kl="new-order-pill">
            {t.newOrderPill(newCount)}
          </button>
        )}
      </div>
      <FlipStage side={side} sm={sm} front={front} back={back} />
      <FaceFocus side={side} focusKey={focusKey} />
      {cmp && cur && (
        <Suspense fallback={null}>
          <Compare needId={cur} picks={picks} onClose={() => setCmp(false)} onOrdered={onOrdered} />
        </Suspense>
      )}
      {ask && (
        <Suspense fallback={null}>
          <Ask open={ask} onClose={() => setAsk(false)} needId={cur} />
        </Suspense>
      )}
    </div>
  )
}

/** after a toggle, focus moves to the new side's heading (waits for the lazy UMKM side) */
function FaceFocus({ side, focusKey }: { side: Side; focusKey: number }) {
  useEffect(() => {
    if (!focusKey) return
    let n = 0
    const iv = window.setInterval(() => {
      const h = document.querySelector<HTMLElement>(`[data-kl-face-h="${side}"]`)
      if (h || ++n > 40) {
        window.clearInterval(iv)
        h?.focus({ preventScroll: true })
      }
    }, 50)
    return () => window.clearInterval(iv)
  }, [side, focusKey])
  return null
}

/* ------------------------------------------------------------------ guide missions (spec §11 P14, plan §2 P14) */

export const missions: readonly Mission[] = [
  {
    id: 'buat',
    label: { id: 'Buat kebutuhan', en: 'Create a need' },
    hint: {
      id: 'Ketuk contoh pertama (karung pasir & terpal). AI menyusun spesifikasi; periksa lalu tekan "Terbitkan kebutuhan".',
      en: 'Tap the first example (sandbags & tarps). The AI drafts the specification; check it, then press "Publish the need".',
    },
    target: '[data-hotspot="kl-example"]',
    done: (e) => isEvent(e, 'need.created') && e.source === SLUG && !e.depth,
  },
  {
    id: 'banding',
    label: { id: 'Bandingkan penawaran', en: 'Compare the offers' },
    hint: { id: 'Centang 2–3 UMKM terverifikasi di papan pencocokan, lalu tekan "Bandingkan".', en: 'Tick 2–3 verified SMEs on the matching board, then press "Compare".' },
    target: '[data-kl="match-board"]',
  },
  {
    id: 'pilih',
    label: { id: 'Pilih UMKM', en: 'Pick an SME' },
    hint: { id: 'Di jendela pembanding, tekan "Pilih", cek pagu, lalu "Kirim pesanan".', en: 'In the comparison, press "Pick", check the budget, then "Send the order".' },
    target: '[data-kl="tray"]',
    done: (e) => isEvent(e, 'order.created') && e.source === SLUG && !!e.payload.needId,
  },
  {
    id: 'konfirmasi',
    label: { id: 'Konfirmasi dari sisi UMKM', en: 'Confirm from the SME side' },
    hint: { id: 'Tekan tombol "Sisi UMKM" di atas, buka pesanan baru, lalu "Konfirmasi penuh" atau "sebagian".', en: 'Press the "SME side" toggle above, open the new order, then "Confirm in full" or "partly".' },
    hintSm: { id: "Ketuk 'Sisi UMKM' di atas kanvas, buka pesanan baru, lalu konfirmasi.", en: "Tap 'SME side' above the canvas, open the new order, then confirm." },
    target: '[data-kl="side-toggle"]',
    done: (e) => isEvent(e, 'order.confirmed') && e.source === SLUG,
  },
  {
    id: 'selesai',
    label: { id: 'Kirim & bayar', en: 'Ship & pay' },
    hint: {
      id: 'Di Sisi UMKM tekan "Tandai dikirim", kembali ke Sisi Pemda lalu "Terima & bayar (simulasi)".',
      en: 'On the SME side press "Mark as shipped", go back to the government side, then "Receive & pay (simulated)".',
    },
    target: '[data-kl="side-toggle"]',
    done: (e) => isEvent(e, 'order.paid') && e.source === SLUG,
  },
]

export const hotspot = { target: '[data-hotspot="kl-example"]', id: 'katalog-lokal-example', label: { id: 'Mulai di sini', en: 'Start here' } }
