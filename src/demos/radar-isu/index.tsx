/**
 * demos/radar-isu — P4 Radar Isu, public opinion intelligence (spec §11 P4; brief docs/build/tahap2-plan.md P4).
 *
 * BrowserFrame with three tabs: Pantauan Live (default, in this chunk), Analisis Mendalam (ex-ScrapPulse; lazy;
 * `?tab=analisis` opens it — /tools/scrappulse redirects there) and Laporan (lazy PaperFrame). The tab is written back
 * to the URL (`?tab=analisis | laporan`). Roles: Humas/Diskominfo (default: drafts and publishes) and Kepala Daerah
 * (executive summary, negative filter, instructs the Comms Office or approves the draft).
 * Module contract (demos/registry.ts): default canvas + `missions` + `hotspot`.
 */
import { Suspense, lazy, startTransition, useCallback, useEffect, useState } from 'react'
import { BrowserFrame } from '../../demo-kit/frames'
import { LoadingText, Tabs } from '../../demo-kit/ui'
import { replaceQuery, useShell, type Mission } from '../../demo-kit/shell'
import { isEvent } from '../../demo-kit/world'
import type { DemoCanvasProps } from '../registry'
import Live from './Live'
import { requestDeepKeyword } from './model'
import { useStr } from './strings'
import './radar-isu.css'

const loadDeep = () => import('./Deep')
const loadReport = () => import('./Report')
const Deep = lazy(loadDeep)
const Report = lazy(loadReport)
/** fetch the secondary tabs when the visitor reaches for the tab bar (hover / focus), so the switch is instant */
let prefetched = false
const prefetchTabs = () => {
  if (prefetched) return
  prefetched = true
  void loadDeep().catch(() => (prefetched = false))
  void loadReport().catch(() => (prefetched = false))
}

type TabId = 'live' | 'deep' | 'report'
const TAB_PARAM: Record<TabId, string | null> = {
  live: null,
  deep: 'analisis',
  report: 'laporan',
}

/** phones (< 480 px): short tab labels, so "Laporan" never ends up cut to "Lap" */
const NARROW = '(max-width: 479px)'
function useNarrowTabs(): boolean {
  const [n, setN] = useState(() => typeof window !== 'undefined' && window.matchMedia(NARROW).matches)
  useEffect(() => {
    const mq = window.matchMedia(NARROW)
    const on = () => setN(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return n
}

function readTab(): TabId {
  if (typeof window === 'undefined') return 'live'
  const v = new URLSearchParams(window.location.search).get('tab')
  return v === 'analisis' || v === 'analysis' || v === 'deep' ? 'deep' : v === 'laporan' || v === 'report' ? 'report' : 'live'
}

export default function RadarIsu({ product }: DemoCanvasProps) {
  const { t } = useStr()
  const shell = useShell()
  const [tab, setTab] = useState<TabId>(readTab)
  const narrow = useNarrowTabs()
  // a transition keeps the tab bar responsive while the heavier view renders (INP)
  const change = useCallback((v: TabId) => {
    startTransition(() => setTab(v))
    replaceQuery({ tab: TAB_PARAM[v] })
  }, [])
  // an arrival from another product (?focus=<hoax or mention id>) belongs to the live monitor
  useEffect(() => {
    if (shell.focus && tab !== 'live') change('live')
  }, [shell.focus]) // eslint-disable-line react-hooks/exhaustive-deps

  const onDeep = useCallback(
    (kw: string) => {
      requestDeepKeyword(kw)
      change('deep')
    },
    [change],
  )

  return (
    <div className="dk-ri" data-product={product}>
      {/* the fake address bar shows the real, shareable address (?tab=…), not a path that would 404 */}
      <BrowserFrame slug={`radar-isu${TAB_PARAM[tab] ? `?tab=${TAB_PARAM[tab]}` : ''}`} label={t.frame} className="dk-ri-frame">
        <div className="dk-ri-tabwrap" onPointerOver={prefetchTabs} onFocus={prefetchTabs}>
          <Tabs<TabId>
            label={t.tabsLabel}
            value={tab}
            onChange={change}
            className="dk-ri-tabs"
            items={[
              { id: 'live', label: narrow ? t.tabLiveShort : t.tabLive, icon: 'pulse' },
              { id: 'deep', label: narrow ? t.tabDeepShort : t.tabDeep, icon: 'search' },
              { id: 'report', label: narrow ? t.tabReportShort : t.tabReport, icon: 'doc' },
            ]}
          >
            <div className="dk-ri-body">
              {tab === 'live' ? (
                <Live onDeep={onDeep} focus={shell.focus} onFocusDone={shell.clearFocus} />
              ) : (
                <Suspense fallback={<LoadingText>{t.loadingTab}</LoadingText>}>{tab === 'deep' ? <Deep /> : <Report />}</Suspense>
              )}
            </div>
          </Tabs>
        </div>
      </BrowserFrame>
    </div>
  )
}

/** "Coba ini" (spec P4 Misi 1–4): the hoax first — it is what the "Mulai di sini" hotspot points at */
export const missions: readonly Mission[] = [
  {
    id: 'hoaks',
    label: { id: 'Tangani hoaks bendungan', en: 'Handle the dam hoax' },
    hint: {
      id: 'Picu skenario, lalu “Susun klarifikasi” dan ajukan untuk disetujui & terbit.',
      en: 'Trigger the scenario, then “Draft a clarification” and send it for approval & publishing.',
    },
    done: (e) => isEvent(e, 'clarification.published') && e.source === 'radar-isu',
  },
  {
    id: 'topik',
    label: {
      id: 'Buka klaster topik terbesar',
      en: 'Open the biggest topic cluster',
    },
    hint: {
      id: 'Klik atau ketuk gelembung terbesar di “Klaster topik 24 jam”.',
      en: 'Click or tap the biggest bubble in “Topic clusters, 24 h”.',
    },
  },
  {
    id: 'analisis',
    label: {
      id: 'Analisis Mendalam untuk 2 kata kunci',
      en: 'Deep Analysis for 2 keywords',
    },
    hint: {
      id: 'Tab Analisis Mendalam → “Jalankan analisis”.',
      en: 'Deep Analysis tab → “Run the analysis”.',
    },
  },
  {
    id: 'ekspor',
    label: { id: 'Ekspor laporan', en: 'Export the report' },
    hint: {
      id: 'Tab Laporan → Cetak/PDF, XLSX, atau JSON.',
      en: 'Report tab → Print/PDF, XLSX or JSON.',
    },
  },
]

/** the first thing to click: the hoax scenario (or, once it runs, the clarification) */
export const hotspot = {
  target: '[data-hotspot="radar-start"]',
  label: { id: 'Mulai di sini', en: 'Start here' },
  // under the trigger: never over the "connected products" chips above it
  placement: 'below' as const,
}
