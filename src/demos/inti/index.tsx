/**
 * demos/inti — P0 GAMADA Inti · Platform AI Terpadu (spec §11 P0, brief docs/build/tahap4-plan.md §2 P0).
 *
 * BrowserFrame "demo.gamada.id/inti" with a rail of 5 modules: Inti Data (landing: pulse, KPI line, the 6-lane data
 * trail of one entity, activity feed) · Inti ID (one demo account, role preview, access matrix = PRODUCTS[].roles) ·
 * Inti Agen (the last agent runs of any product + Inti's orchestrator console) · Inti Kanal (unified inbox, chat.read)
 * · Audit Log (every event, filters, CSV / JSON export). Every module but Data is a lazy chunk fetched on intent.
 * Roles: kepala-daerah (default) · sekretariat (+ "Kelola peran" preview, actor column first) · pemilik-toko (scope =
 * the shop's rows; government data hidden with a visible note). URL: ?tab= ?focus= ?as= ?root= ?product=.
 */
import { Suspense, lazy, startTransition, useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { DemoCanvasProps } from '../registry'
import type { Mission } from '../../demo-kit/shell'
import { intentProps, replaceQuery, useShell } from '../../demo-kit/shell'
import { BrowserFrame } from '../../demo-kit/frames'
import { Icon, LoadingText, Skeleton, motionMode } from '../../demo-kit/ui'
import { clock, isEvent, useSession, world } from '../../demo-kit/world'
import { useWorldReady, type WorldModule } from '../../demo-kit/world/ready'
import { scopeOf } from '../../demo-kit/world/inti'
import { usePdStrings } from '../../demo-kit/i18n/pd'
import { ROLES, isProductSlug, type RoleId } from '../../content/products'
import Data from './Data'
import { AUDIT0, SLUG, TABS, routeFocus, type AuditUiFilter, type KanalFilter, type TabId } from './model'
import { useT } from './strings'
import './inti.css'

const MODS: readonly WorldModule[] = ['usaha-pintar/data', 'pasar-daerah']
const loadId = () => import('./IdTab')
const loadAgen = () => import('./Agen')
const loadKanal = () => import('./Kanal')
const loadAudit = () => import('./Audit')
const IdTab = lazy(loadId)
const Agen = lazy(loadAgen)
const Kanal = lazy(loadKanal)
const Audit = lazy(loadAudit)
const LOAD: Partial<Record<TabId, () => Promise<unknown>>> = { id: loadId, agen: loadAgen, kanal: loadKanal, audit: loadAudit }
const ICON = { data: 'layers', id: 'users', agen: 'spark', kanal: 'inbox', audit: 'list' } as const

const AUTOPLAY_KEY = 'gamada:in:autoplay'
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

const param = (k: string) => (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get(k))

export default function Canvas(_props: DemoCanvasProps) {
  const ready = useWorldReady(MODS)
  const shell = useShell()
  useAutoplay(shell.present)
  const { setToastPlacement } = shell
  useEffect(() => {
    setToastPlacement({ wide: 'bottom-left', sm: 'top-right' })
    return () => setToastPlacement(null)
  }, [setToastPlacement])
  if (!ready) return <IntiSkeleton />
  return <Inti />
}

function IntiSkeleton() {
  const { t } = useT()
  const p = usePdStrings()
  return (
    <BrowserFrame slug={SLUG} label={t.product}>
      <div className="dk-in" aria-busy="true">
        <p className="dk-sr" role="status">
          {p.pdLoading}
        </p>
        <div className="dk-in-rail is-skel">
          {TABS.map((k) => (
            <Skeleton key={k} height={44} />
          ))}
        </div>
        <div className="dk-in-panel">
          <p className="dk-in-muted">{p.pdLoading}</p>
          <div className="dk-in-top">
            <Skeleton height={180} radius={12} />
            <Skeleton height={180} radius={12} />
          </div>
          <Skeleton height={300} radius={12} />
        </div>
      </div>
    </BrowserFrame>
  )
}

function Inti() {
  const { t } = useT()
  const shell = useShell()
  const { role } = useSession()
  const scope = scopeOf(role).scope
  const [tab, setTab] = useState<TabId>(() => {
    const v = param('tab')
    return v && (TABS as readonly string[]).includes(v) ? (v as TabId) : 'data'
  })
  const [root, setRoot] = useState<string | null>(() => param('root'))
  const [as, setAs] = useState<RoleId>(() => {
    const v = param('as')
    return v && v in ROLES ? (v as RoleId) : role
  })
  const [audit, setAudit] = useState<AuditUiFilter>(() => {
    const p = param('product')
    return p && isProductSlug(p) ? { ...AUDIT0, product: p } : AUDIT0
  })
  const [kanal, setKanal] = useState<KanalFilter>(() => ({ channel: 'semua', eco: role === 'kepala-daerah' ? 'satu-daerah' : 'semua', unread: false }))
  const [flash, setFlash] = useState<string | null>(null)

  const go = useCallback((next: TabId) => startTransition(() => setTab(next)), [])
  useEffect(() => void replaceQuery({ tab: tab === 'data' ? null : tab, root, as: tab === 'id' && as !== role ? as : null, product: tab === 'audit' && audit.product ? audit.product : null }), [tab, root, as, role, audit.product])

  // ?focus= : AU-… ⇒ Audit (that row); an entity ⇒ Data with that root; unknown ⇒ default + toast
  const { focus, clearFocus, toast } = shell
  const handled = useRef<string | null>(null)
  useEffect(() => {
    if (!focus) return
    if (handled.current === focus) return clearFocus()
    handled.current = focus
    const r = routeFocus(world.get(), focus)
    if (!r) {
      toast({ title: t.notFound, body: t.notFoundBody, tone: 'warn', icon: 'alert' })
      go('data')
    } else if (r.tab === 'audit') {
      setAudit({ ...AUDIT0, q: r.q, when: 'semua' })
      setFlash(r.q)
      go('audit')
    } else {
      setRoot(r.root)
      go('data')
    }
    clearFocus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, clearFocus])

  const toAudit = useCallback(
    (id: string) => {
      setAudit({ ...AUDIT0, q: id, when: 'semua' })
      setFlash(id)
      go('audit')
    },
    [go],
  )

  const btns = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({})
  const onKey = (e: KeyboardEvent) => {
    const i = TABS.indexOf(tab)
    const fwd = e.key === 'ArrowDown' || e.key === 'ArrowRight'
    const back = e.key === 'ArrowUp' || e.key === 'ArrowLeft'
    const j = fwd ? (i + 1) % TABS.length : back ? (i + TABS.length - 1) % TABS.length : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : -1
    if (j < 0) return
    e.preventDefault()
    go(TABS[j]!)
    btns.current[TABS[j]!]?.focus()
  }
  useEffect(() => {
    if (shell.size === 'sm') btns.current[tab]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [tab, shell.size])

  return (
    <BrowserFrame slug={SLUG} path={tab === 'data' ? SLUG : `${SLUG}/${tab}`} label={t.product}>
      <div className={`dk-in${shell.size === 'sm' ? ' is-sm' : ''}`} data-tab={tab} data-scope={scope}>
        <div className="dk-in-rail" role="tablist" aria-label={t.railLabel} aria-orientation={shell.size === 'sm' ? 'horizontal' : 'vertical'} onKeyDown={onKey}>
          {TABS.map((k) => (
            <button
              key={k}
              ref={(el) => void (btns.current[k] = el)}
              type="button"
              role="tab"
              id={`dk-in-tab-${k}`}
              aria-selected={tab === k}
              aria-controls="dk-in-panel"
              tabIndex={tab === k ? 0 : -1}
              className="dk-in-tab"
              {...(LOAD[k] ? intentProps(LOAD[k]) : {})}
              onClick={() => go(k)}
            >
              <Icon name={ICON[k]} size={18} />
              <span className="dk-in-tab-t">
                <span>{t.tabs[k]}</span>
                <small>{t.tabSub[k]}</small>
              </span>
            </button>
          ))}
        </div>
        <div id="dk-in-panel" role="tabpanel" aria-labelledby={`dk-in-tab-${tab}`} className="dk-in-panel">
          <Suspense fallback={<LoadingText>{t.loading}</LoadingText>}>
            {tab === 'data' && <Data scope={scope} root={root} setRoot={setRoot} onAudit={toAudit} />}
            {tab === 'id' && <IdTab role={role} as={as} setAs={setAs} />}
            {tab === 'agen' && <Agen role={role} scope={scope} onShowTrail={() => go('data')} />}
            {tab === 'kanal' && <Kanal scope={scope} filter={kanal} setFilter={setKanal} />}
            {tab === 'audit' && <Audit scope={scope} role={role} filter={audit} setFilter={setAudit} flashId={flash} />}
          </Suspense>
        </div>
      </div>
    </BrowserFrame>
  )
}

/* ------------------------------------------------------------------ guide missions (plan §2 P0) */

export const missions: readonly Mission[] = [
  {
    id: 'jejak',
    label: { id: 'Lihat jejak data', en: 'See the data trail' },
    hint: {
      id: 'Di Inti Data tekan "Putar jejak aduan Ibu Siti": 6 produk menyala berurutan, setiap simpul satu baris Audit Log.',
      en: 'In Inti Data press "Play the trail of Ibu Siti’s complaint": 6 products light up in order, each node one Audit Log row.',
    },
    target: '[data-in="trail"]',
  },
  {
    id: 'peran',
    label: { id: 'Ganti peran', en: 'Switch roles' },
    hint: {
      id: 'Buka Inti ID, lalu pratinjau peran dari ekosistem lain (mis. Pemilik Toko): centang di matriks ikut berganti.',
      en: 'Open Inti ID and preview a role from another ecosystem (e.g. Shop Owner): the matrix ticks change with it.',
    },
    hintSm: {
      id: 'Buka Inti ID (geser deretan modul di atas), lalu ketuk nama peran dan pilih peran dari ekosistem lain.',
      en: 'Open Inti ID (swipe the module row at the top), tap the role name and pick a role from another ecosystem.',
    },
    target: '#dk-in-tab-id',
  },
  {
    id: 'agen',
    label: { id: 'Lihat jejak berpikir', en: 'See the reasoning trace' },
    hint: {
      id: 'Buka Inti Agen dan pakai contoh "Tangani banjir…": intent, 5 alat di 5 produk, data, lalu jawaban dengan durasinya.',
      en: 'Open Inti Agents and use the "Handle the flood…" example: intent, 5 tools in 5 products, data, then the answer with its timings.',
    },
    target: '#dk-in-tab-agen',
  },
  {
    id: 'kanal',
    label: { id: 'Baca pesan', en: 'Read a message' },
    hint: { id: 'Buka Inti Kanal, pilih satu percakapan yang belum dibaca, lalu "Tandai dibaca".', en: 'Open Inti Channels, pick an unread conversation, then "Mark as read".' },
    target: '#dk-in-tab-kanal',
    done: (e) => isEvent(e, 'chat.read') && e.source === SLUG,
  },
  {
    id: 'audit',
    label: { id: 'Ekspor audit', en: 'Export the audit' },
    hint: { id: 'Buka Audit Log, saring bila perlu, lalu "Ekspor CSV" atau "Ekspor JSON".', en: 'Open the Audit Log, filter if you like, then "Export CSV" or "Export JSON".' },
    target: '#dk-in-tab-audit',
  },
]

export const hotspot = { target: '[data-hotspot="trail-play"]', id: 'inti-start', label: { id: 'Mulai di sini: putar jejak data', en: 'Start here: play the data trail' } }
