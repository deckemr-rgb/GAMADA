/**
 * demos/pantau-merek — P12 Pantau Merek, brand reputation monitoring (spec §11 P12; brief docs/build/tahap3-plan.md P12).
 *
 * BrowserFrame "demo.gamada.id/pantau-merek", tabs Pantauan (first screen) · Ulasan (lazy) · Kompetitor (lazy),
 * `?tab=pantauan|ulasan|kompetitor`. Roles: Brand Manager (default) and Pemilik Toko (owner band above the stream,
 * approves the "Gratis ongkir" notice). The flood scenario starts by itself at 07.06 (`useFloodAutoplay`); C28 brings
 * the delivery-complaint burst and the alert (07.12). Emits `brand.replied` (bulk replies) and `brand.announced`
 * (service notice; C29 recovery + `pos.noticeSet` to Toko Autopilot's Kasir). `?focus=` BA-… (alert) · BM-… (mention)
 * · BN-… (announcement).
 */
import { Suspense, lazy, startTransition, useCallback, useEffect, useRef, useState } from 'react'
import type { DemoCanvasProps } from '../registry'
import { BrowserFrame } from '../../demo-kit/frames'
import { LoadingText, Skeleton, Tabs, motionMode } from '../../demo-kit/ui'
import { replaceQuery, useShell, type Mission } from '../../demo-kit/shell'
import { clock, isEvent, onEvent, useEcosystemReady, useSession, world } from '../../demo-kit/world'
import { useDemoStrings } from '../../demo-kit/i18n'
import { useFloodAutoplay } from '../../demo-kit/world/usaha-pintar'
import Pantauan from './Pantauan'
import { SLUG, focusKind, recovery, reviewSelection, useBrandTables, useNow } from './model'
import { STR, useStr } from './strings'
import './pantau-merek.css'

import { loadCluster, loadCompetitors, loadOwner, loadReviews } from './loaders'
const Reviews = lazy(loadReviews)
const Competitors = lazy(loadCompetitors)
const Cluster = lazy(loadCluster)
const OwnerBand = lazy(loadOwner)

type TabId = 'pantauan' | 'ulasan' | 'kompetitor'
const readTab = (): TabId => {
  const v = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('tab')
  return v === 'ulasan' || v === 'kompetitor' ? v : 'pantauan'
}

const AUTOPLAY_KEY = 'gamada:pm:autoplay'
/** the clock starts by itself on a first visit at the morning start (full motion; `?autoplay=0` keeps it still) */
function useAutoplay(ready: boolean, timeLink: boolean) {
  useEffect(() => {
    if (!ready || timeLink || motionMode() !== 'full') return
    const q = new URLSearchParams(window.location.search)
    if (q.get('autoplay') === '0') return
    try {
      if (window.sessionStorage.getItem(AUTOPLAY_KEY) === '1') return
    } catch {
      /* storage blocked: once per page load */
    }
    const tm = window.setTimeout(() => {
      const c = clock.get()
      if (c.running || c.minutes > 7 * 60) return
      clock.play()
      try {
        window.sessionStorage.setItem(AUTOPLAY_KEY, '1')
      } catch {
        /* ignore */
      }
    }, 1200)
    return () => window.clearTimeout(tm)
  }, [ready, timeLink])
}

/** the skeleton has the boxes of the Pantauan grid (no jump when the data arrives) */
function UpSkeleton({ text }: { text: string }) {
  return (
    <div className="dk-pm-body dk-pm-skel" aria-busy="true">
      <p className="dk-pm-skel-t">{text}</p>
      <div className="dk-pm-grid">
        <div className="dk-pm-a-kpi">
          <Skeleton lines={2} />
        </div>
        <div className="dk-pm-a-alert dk-pm-card">
          <Skeleton lines={3} />
        </div>
        <div className="dk-pm-a-stream dk-pm-card">
          <Skeleton lines={8} />
        </div>
        <div className="dk-pm-a-rep dk-pm-card">
          <Skeleton lines={5} />
        </div>
      </div>
    </div>
  )
}

export default function Canvas({ product }: DemoCanvasProps) {
  const ready = useEcosystemReady('usaha-pintar')
  const ds = useDemoStrings()
  const { t } = useStr()
  const { link } = useShell()
  useFloodAutoplay(ready)
  useAutoplay(ready, link.t != null)
  const [tab, setTab] = useState<TabId>(readTab)
  const change = useCallback((v: TabId) => {
    startTransition(() => setTab(v))
    replaceQuery({ tab: v === 'pantauan' ? null : v })
  }, [])
  const preload = useCallback(() => {
    void loadReviews().catch(() => undefined)
    void loadCompetitors().catch(() => undefined)
  }, [])
  return (
    <div className="dk-root dk-pm" data-eco="usaha-pintar" data-product={product}>
      <BrowserFrame slug={`pantau-merek${tab === 'pantauan' ? '' : `?tab=${tab}`}`} label={t.frame} className="dk-pm-frame">
        <div className="dk-pm-tabwrap" onPointerOver={preload} onFocus={preload} onTouchStart={preload}>
          <Tabs<TabId>
            label={t.tabsLabel}
            value={tab}
            onChange={change}
            className="dk-pm-tabs"
            items={[
              { id: 'pantauan', label: t.tabPantauan, icon: 'pulse' },
              { id: 'ulasan', label: t.tabUlasan, icon: 'chat' },
              { id: 'kompetitor', label: t.tabKompetitor, icon: 'bars' },
            ]}
          >
            {ready ? <Main tab={tab} setTab={change} /> : <UpSkeleton text={ds.upLoading} />}
          </Tabs>
        </div>
      </BrowserFrame>
    </div>
  )
}

export interface Arrival {
  kind: 'alert' | 'mention' | 'ann'
  id: string
  n: number
}

function Main({ tab, setTab }: { tab: TabId; setTab: (v: TabId) => void }) {
  const { lang } = useStr()
  const shell = useShell()
  const { role } = useSession()
  const owner = role === 'pemilik-toko'
  const now = useNow()
  const { mentions, anns } = useBrandTables()
  const [arrive, setArrive] = useState<Arrival | null>(null)
  const [cluster, setCluster] = useState<{ open: boolean; view: 'cluster' | 'announce' | 'published'; alertId: string | null }>({ open: false, view: 'cluster', alertId: null })
  const arrN = useRef(0)

  // ?focus= arrivals (from toasts / links): route the id to its tab, move the clock to it when it lies ahead
  const { focus, clearFocus, toast } = shell
  useEffect(() => {
    if (!focus) return
    const s = world.get()
    const kind = focusKind(focus)
    const at = kind === 'alert' ? s.brandAlerts.byId[focus]?.at : kind === 'mention' ? s.brandMentions.byId[focus]?.at : kind === 'ann' ? s.brandAnnouncements.byId[focus]?.at : undefined
    clearFocus()
    if (!kind || at == null) {
      setTab('pantauan')
      const L = STR[lang]
      toast({ title: L.notFound, body: L.notFoundBody, tone: 'warn', icon: 'info' })
      return
    }
    if (at > clock.get().minutes) clock.setTime(at)
    arrN.current++
    if (kind === 'mention') {
      setTab('ulasan')
      if (s.brandMentions.byId[focus]?.repliedAt == null && !reviewSelection.get().includes(focus)) reviewSelection.set([...reviewSelection.get(), focus])
    } else setTab('pantauan')
    if (kind === 'ann') {
      const a = s.brandAnnouncements.byId[focus]
      setCluster({ open: true, view: 'published', alertId: a?.alertId ?? null })
    }
    setArrive({ kind, id: focus, n: arrN.current })
  }, [focus]) // eslint-disable-line react-hooks/exhaustive-deps

  // mission 4: the score is back ≥ 5 points above the spike's low after a reply or the notice
  const markMission = shell.markMission
  const pulihDone = useRef(false)
  useEffect(() => {
    if (pulihDone.current) return
    const r = recovery(world.get(), now)
    if (r && r.acted && r.score >= r.low + 5) {
      pulihDone.current = true
      markMission('pulih')
    }
  }, [now, mentions, anns, markMission])

  // a cross-product toast from our own notice (C29) is the shell's; keep the drawer state honest after a publish
  useEffect(
    () =>
      onEvent('brand.announced', (e) => {
        if (e.source === SLUG) setCluster((c) => (c.open ? { ...c, view: 'published' } : c))
      }),
    [],
  )

  const openCluster = useCallback((alertId: string, view: 'cluster' | 'announce' | 'published' = 'cluster') => setCluster({ open: true, view, alertId }), [])
  const closeCluster = useCallback(() => setCluster((c) => ({ ...c, open: false })), [])
  const toReviews = useCallback(() => setTab('ulasan'), [setTab])

  const fallback = <LoadingText>{STR[lang].loading}</LoadingText>
  return (
    <div className="dk-pm-body">
      {tab === 'pantauan' && (
        <Pantauan
          now={now}
          arrive={arrive}
          onHandle={openCluster}
          onReplies={toReviews}
          ownerBand={
            owner ? (
              <Suspense fallback={<div className="dk-pm-owner is-slot" />}>
                <OwnerBand now={now} onApprove={(id) => openCluster(id, 'announce')} />
              </Suspense>
            ) : null
          }
        />
      )}
      {tab === 'ulasan' && (
        <Suspense fallback={fallback}>
          <Reviews now={now} arrive={arrive} />
        </Suspense>
      )}
      {tab === 'kompetitor' && (
        <Suspense fallback={fallback}>
          <Competitors now={now} />
        </Suspense>
      )}
      {cluster.alertId && (cluster.open || cluster.view !== 'cluster') && (
        <Suspense fallback={null}>
          <Cluster open={cluster.open} view={cluster.view} alertId={cluster.alertId} onView={(v) => setCluster((c) => ({ ...c, view: v }))} onClose={closeCluster} />
        </Suspense>
      )}
    </div>
  )
}

/** "Coba ini" (spec P12 missions) */
export const missions: readonly Mission[] = [
  {
    id: 'lonjakan',
    label: { id: 'Tangani lonjakan keluhan', en: 'Handle the complaint spike' },
    hint: {
      id: 'Tunggu banjir 07.06 atau “Lompat ke lonjakan”, lalu “Kelompokkan & tangani” → “Sarankan pengumuman” → “Terbitkan”.',
      en: 'Wait for the 07:06 flood or “Jump to the spike”, then “Group & handle” → “Suggest a notice” → “Publish”.',
    },
    hintSm: {
      id: 'Ketuk “Lompat ke lonjakan”, lalu “Kelompokkan & tangani” → “Sarankan pengumuman” → “Terbitkan”.',
      en: 'Tap “Jump to the spike”, then “Group & handle” → “Suggest a notice” → “Publish”.',
    },
    target: '[data-pm="cluster"], [data-pm="jump-spike"]',
    done: (e) => isEvent(e, 'brand.announced') && e.source === SLUG,
  },
  {
    id: 'balas5',
    label: { id: 'Balas 5 keluhan sekaligus', en: 'Reply to 5 complaints at once' },
    hint: { id: 'Tab Ulasan → “Pilih 5 dari lonjakan” → “Balas 5 terpilih” → “Kirim 5 balasan”.', en: 'Reviews tab → “Pick 5 from the spike” → “Reply to 5 selected” → “Send 5 replies”.' },
    hintSm: { id: 'Tab Ulasan → “Pilih 5 dari lonjakan” → “Balas” → “Kirim 5 balasan”.', en: 'Reviews tab → “Pick 5 from the spike” → “Reply” → “Send 5 replies”.' },
    done: (e) => isEvent(e, 'brand.replied') && e.source === SLUG && e.payload.mentionIds.length >= 5,
  },
  {
    id: 'kompetitor',
    label: { id: 'Bandingkan dengan pesaing', en: 'Compare with competitors' },
    hint: { id: 'Tab Kompetitor → ganti metrik ke Waktu balas atau Rating.', en: 'Competitors tab → switch the metric to Reply time or Rating.' },
    hintSm: { id: 'Tab Kompetitor → ganti metrik.', en: 'Competitors tab → switch the metric.' },
  },
  {
    id: 'pulih',
    label: { id: 'Pulihkan skor reputasi', en: 'Bring the reputation back up' },
    hint: {
      id: 'Setelah membalas atau mengumumkan, “Lihat 30 menit ke depan” sampai skor naik ≥ 5 poin dari titik terendah.',
      en: 'After replying or publishing the notice, “See the next 30 minutes” until the score is ≥ 5 points above its low.',
    },
    hintSm: { id: 'Setelah membalas/mengumumkan, ketuk “Lihat 30 menit ke depan”.', en: 'After replying / the notice, tap “See the next 30 minutes”.' },
    target: '[data-pm="ahead30"]',
  },
]

/** first the jump to the spike; once the alert is up, the handle button (the label follows the element) */
export const hotspot = {
  target: '[data-hotspot="pm-jump"], [data-hotspot="pm-handle"]',
  label: { id: 'Mulai di sini', en: 'Start here' },
  placement: 'below' as const,
}
