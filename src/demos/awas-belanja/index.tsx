/**
 * demos/awas-belanja — P6 Awas Belanja · Pengawas Pengadaan AI (spec §11 P6, brief docs/build/tahap2-plan.md P6).
 *
 * BrowserFrame "demo.gamada.id/awas-belanja": the package list (KPIs, flood banner, table) ⇄ the package detail
 * (lazy: header + scan, tabs HPS vs Pasar | Peserta | Pola | Laporan). Roles: UKPBJ (default) and Inspektorat change
 * the list filter + columns, the primary action, the memo letterhead and the audit trail.
 * Emits procurement.flagged / procurement.recommended (source awas-belanja); consumes flood.alert (via the
 * procurement.created reaction: the emergency pump package), match.made (local SME offers) and ?focus=<id>.
 */
import { Suspense, lazy, startTransition, useCallback, useEffect, useRef, useState } from 'react'
import type { DemoCanvasProps } from '../registry'
import type { Mission } from '../../demo-kit/shell'
import { useShell } from '../../demo-kit/shell'
import { BrowserFrame } from '../../demo-kit/frames'
import { Button, IconButton, LoadingText } from '../../demo-kit/ui'
import { isEvent, onEvent, useSession, useWorld, world, type WorldState } from '../../demo-kit/world'
import { STRINGS, useT } from './strings'
import { PUMP_KEY, SLUG, bareId } from './model'
import List from './List'
import type { TabId } from './types'
import './awas-belanja.css'

const Detail = lazy(() => import('./Detail'))
const Assistant = lazy(() => import('./Assistant'))

const codeOf = (id: string | null) => (s: WorldState) => (id ? (s.procurements.byId[id]?.code ?? null) : null)

export default function Canvas(_props: DemoCanvasProps) {
  const { t, lang } = useT()
  const langRef = useRef(lang)
  langRef.current = lang
  const shell = useShell()
  const { role } = useSession()
  const roleKey = role === 'inspektorat' ? 'inspektorat' : 'ukpbj'
  const [openId, setOpenId] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>('hps')
  const [chatOpen, setChatOpen] = useState(false)
  const [memoReq, setMemoReq] = useState(0)
  const [fresh, setFresh] = useState<string | null>(null)
  const [arrived, setArrived] = useState(false)
  const [said, setSaid] = useState('')
  const openPumpWhenReady = useRef(false)
  /** memo requests already started — per Canvas instance (a module-level counter broke after SPA re-mounts) */
  const memoHandled = useRef(0)
  /** the package that was open + where it was opened from, so Back can return focus there */
  const lastOpen = useRef<{ id: string; from: 'row' | 'banner' } | null>(null)
  const restoreFocus = useRef(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const code = useWorld(codeOf(openId))

  // opening a package mounts the (heavy) detail: a transition keeps the click responsive (INP)
  const open = useCallback((id: string, t0: TabId = 'hps', from: 'row' | 'banner' = 'row') => {
    lastOpen.current = { id, from }
    startTransition(() => {
      setOpenId(id)
      setTab(t0)
    })
  }, [])

  // ?focus=<procurement id> (cross-product toast, Meja Pimpinan briefing)
  const { focus, clearFocus } = shell
  useEffect(() => {
    if (!focus) return
    const id = bareId(focus)
    if (world.get().procurements.byId[id]) {
      open(id)
      setArrived(true)
    }
    clearFocus()
  }, [focus, clearFocus, open])

  // the emergency pump package appears after a flood alert (reaction flood→pump-procurement)
  useEffect(
    () =>
      onEvent('procurement.created', (e) => {
        if (e.payload.key !== PUMP_KEY || !e.payload.id) return
        setFresh(e.payload.id)
        if (openPumpWhenReady.current) {
          openPumpWhenReady.current = false
          open(e.payload.id, 'hps', 'banner')
          const name = world.get().procurements.byId[e.payload.id]?.name[langRef.current]
          if (name) setSaid(STRINGS[langRef.current].autoOpened(name))
        }
      }),
    [open],
  )

  // local SME offers through Katalog Lokal (match.made) → price benchmark; tell the analyst
  const toast = shell.toast
  useEffect(
    () =>
      onEvent('*', (e) => {
        if (!isEvent(e, 'match.made')) return
        const s = world.get()
        const need = s.catalogNeeds.byId[e.payload.needId]
        if (!need?.cause?.startsWith('procurements:')) return
        const biz = s.businesses.byId[e.payload.businessId]?.name ?? e.payload.businessId
        const L = STRINGS[langRef.current]
        toast({ title: L.matchToast(biz), body: L.matchToastBody, tone: 'accent' })
      }),
    [toast],
  )

  const back = useCallback(() => {
    restoreFocus.current = true
    setSaid('')
    startTransition(() => {
      setOpenId(null)
      setArrived(false)
    })
  }, [])

  // Back: focus returns to the row (or banner button) that opened the package
  useEffect(() => {
    if (openId || !restoreFocus.current) return
    restoreFocus.current = false
    const root = rootRef.current
    const last = lastOpen.current
    if (!root) return
    const row = last && last.from === 'row' ? root.querySelector<HTMLElement>(`[data-pid="${CSS.escape(last.id)}"]`)?.closest<HTMLElement>('[role="row"]') : null
    const target = row ?? root.querySelector<HTMLElement>('.dk-ab-flood .dk-btn') ?? root.querySelector<HTMLElement>('.dk-ab-h')
    target?.focus()
  }, [openId])
  const startMemo = useCallback(() => {
    setTab('memo')
    setMemoReq((n) => n + 1)
  }, [])

  return (
    <BrowserFrame
      slug={SLUG}
      path={openId && code ? (shell.size === 'sm' ? `${SLUG}/${code}` : `${SLUG}/paket/${code}`) : SLUG}
      label={t.product}
      actions={
        shell.size === 'sm' ? (
          <IconButton icon="spark" label={t.askAi} onClick={() => setChatOpen(true)} className="dk-ab-askbtn" aria-haspopup="dialog" />
        ) : (
          <Button size="sm" variant="ghost" icon="spark" onClick={() => setChatOpen(true)} className="dk-ab-askbtn" aria-haspopup="dialog">
            {t.askAi}
          </Button>
        )
      }
    >
      <div ref={rootRef} className="dk-ab" data-role={roleKey}>
        <p className="dk-sr" role="status" aria-live="polite">
          {said}
        </p>
        {openId ? (
          <Suspense fallback={<LoadingText>{t.loading}</LoadingText>}>
            <Detail
              id={openId}
              tab={tab}
              onTab={setTab}
              onBack={back}
              onSwitch={open}
              roleKey={roleKey}
              memoReq={memoReq}
              memoHandled={memoHandled}
              onRecommend={startMemo}
              arrived={arrived}
            />
          </Suspense>
        ) : (
          <List
            roleKey={roleKey}
            fresh={fresh}
            onOpen={open}
            onShortcut={() => {
              openPumpWhenReady.current = true
            }}
          />
        )}
      </div>
      {chatOpen && (
        <Suspense fallback={null}>
          <Assistant
            open={chatOpen}
            onClose={() => setChatOpen(false)}
            procurementId={openId}
            roleKey={roleKey}
            onOpenMemo={() => {
              setChatOpen(false)
              if (openId) startMemo()
            }}
            onOpenPackage={(id) => {
              setChatOpen(false)
              open(id)
            }}
          />
        </Suspense>
      )}
    </BrowserFrame>
  )
}

/* ------------------------------------------------------------------ guide missions (spec §11 P6) */

export const missions: readonly Mission[] = [
  {
    id: 'analyze-pump',
    label: { id: 'Analisis paket pompa darurat', en: 'Analyse the emergency pump package' },
    hint: {
      id: 'Paket muncul setelah peringatan banjir. Buka paketnya, lalu tekan "Jalankan analisis".',
      en: 'The package appears after a flood warning. Open it, then press "Run analysis".',
    },
    done: (e, s) => isEvent(e, 'procurement.flagged') && e.source === SLUG && s.procurements.byId[e.payload.procurementId]?.key === PUMP_KEY,
  },
  {
    id: 'find-affiliated',
    label: { id: 'Temukan peserta terafiliasi', en: 'Find the affiliated bidders' },
    hint: {
      id: 'Setelah analisis, buka tab Peserta lalu klik atau ketuk garis di antara dua perusahaan untuk melihat buktinya.',
      en: 'After the analysis, open the Bidders tab and click or tap the line between two companies to see the evidence.',
    },
  },
  {
    id: 'audit-memo',
    label: { id: 'Buat memo audit', en: 'Write the audit memo' },
    hint: {
      id: 'Tekan "Rekomendasikan koreksi" (UKPBJ) atau "Terbitkan memo audit" (Inspektorat): AI menyusun memo, HPS terkoreksi otomatis.',
      en: 'Press "Recommend a correction" (UKPBJ) or "Issue audit memo" (Inspectorate): AI drafts the memo and the HPS is corrected automatically.',
    },
    done: (e) => isEvent(e, 'procurement.recommended') && e.source === SLUG,
  },
]

export const hotspot = { target: '[data-hotspot="ab-start"]', id: 'awas-belanja-start', label: { id: 'Mulai di sini', en: 'Start here' } }
