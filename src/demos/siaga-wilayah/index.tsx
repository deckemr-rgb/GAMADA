/**
 * demos/siaga-wilayah — P5 Siaga Wilayah: Geo-AI early warning on the real regional map (spec §11 P5).
 *
 * Layout: a wide BrowserFrame with the full map, a collapsible left panel (Peringatan | Prediksi | Pertanian |
 * Lingkungan) and the time scrubber under the map. Phones: map first (≈ 46vh, region framed edge to edge), the bar, then the panel below.
 * Flow: run the 6-hour forecast (rain moves in, the flood grows, villages light up) → send an early warning (level,
 * area, WA preview to camat / kades of real desa, ticks) → citizens in the zone get it in Sapa Warga → flood reports
 * confirm the prediction → post-flood harvest drop (econ.updated + supply signals) → before/after land-use imagery.
 * Emits rain.forecast, flood.alert, alert.broadcast, harvest.updated (source 'siaga-wilayah'); consumes
 * complaint.created (banjir) and flood.confirmed. All numbers are simulated and labelled so.
 */
import { lazy, Suspense, useEffect, useRef } from 'react'
import { BrowserFrame } from '../../demo-kit/frames'
import { motionMode } from '../../demo-kit/ui'
import { useShell, type Mission } from '../../demo-kit/shell'
import { clock, isEvent, useSession, useWorldStatus, world } from '../../demo-kit/world'
import type { DemoCanvasProps } from '../registry'
import { Exec, scriptedReport } from './Alerts'
import { MapStage } from './MapStage'
import { Panel } from './Panel'
import { Timeline } from './Timeline'
import { floodAlerts, swRole } from './data'
import { useT } from './strings'
import { forgetDesa, keptView, ui, useUi, withMap } from './ui'
import './siaga.css'

const Broadcast = lazy(() => import('./Broadcast'))
const AskAi = lazy(() => import('./AskAi'))

export default function SiagaWilayah({ product }: DemoCanvasProps) {
  const { t } = useT()
  const { size, focus, clearFocus, setToastPlacement } = useShell()
  const role = swRole(useSession().role)
  const open = useUi((s) => s.panelOpen)
  const broadcastOpen = useUi((s) => s.broadcastOpen)
  const aiOpen = useUi((s) => s.aiOpen)
  const status = useWorldStatus()

  // shell toasts: bottom-left would sit on this product's left panel (its buttons) on wide layouts; bottom-right sits
  // over the HUD / legend (no controls). While the warning dialog (footer button bottom-right) or the Geo-AI drawer
  // (right side) is open, the panel behind is inert, so they go bottom-left. Phones keep the kit default.
  const overlay = broadcastOpen || aiOpen
  useEffect(() => {
    setToastPlacement({ wide: overlay ? 'bottom-left' : 'bottom-right', sm: 'bottom-left' })
  }, [setToastPlacement, overlay])
  useEffect(() => () => setToastPlacement(null), [setToastPlacement])
  // citizen flood reports arrive on their own while the world clock runs (scripted from the morning scenario)
  useEffect(() => clock.onMinute(scriptedReport), [])
  useAutoplay(useSession().present)

  // back from another product: the browser may restore a mid-page scroll; start at the map instead (an arrival with
  // ?focus= scrolls to its own card)
  const arrivedWith = useRef(focus)
  useEffect(() => {
    if (arrivedWith.current) return
    const id = requestAnimationFrame(() => document.querySelector('.dk-shell-canvas')?.scrollTo({ top: 0 }))
    return () => cancelAnimationFrame(id)
  }, [])

  // fresh view state per visit (the forecast run + audit trail are kept, see ui.ts); the role decides the first tab
  const roleRef = useRef<string | null>(null)
  useEffect(() => {
    if (roleRef.current === role) return
    const first = roleRef.current === null
    roleRef.current = role
    if (first) {
      ui.reset(keptView())
      // a warning issued here earlier (world kept in IndexedDB) always has its forecast behind it
      if (!ui.get().ran && floodAlerts(world.get()).length) ui.set({ hour: 6, ran: true })
    }
    if (role === 'pertanian') {
      ui.set({ tab: 'agri' })
      ui.layer('harvest', true)
    } else if (!first) ui.set({ tab: 'alerts' })
  }, [role])

  // world reset (shell "Reset"): the view starts over too
  const seen = useRef(status)
  useEffect(() => {
    if (seen.current !== 'ready' && status === 'ready' && roleRef.current !== null && ui.get().ran) {
      forgetDesa()
      ui.reset({ tab: role === 'pertanian' ? 'agri' : 'alerts' })
    }
    seen.current = status
  }, [status, role])

  // arrivals from a cross-product toast (?focus=<entity id>)
  useEffect(() => {
    if (!focus) return
    const s = world.get()
    const a = s.alerts.byId[focus]
    const c = s.complaints.byId[focus]
    const cl = s.clusters.byId[focus]
    if (a) {
      ui.set({ tab: 'alerts', panelOpen: true, flash: a.id })
      if (a.kecamatanIds[0]) withMap((h) => h.fitKecamatan(a.kecamatanIds[0]!))
    } else if (c) {
      ui.set({ tab: 'alerts', panelOpen: true, picked: { layer: 'reports', id: c.id } })
      withMap((h) => h.flyTo(c.coord, 11.5))
    } else if (cl) {
      ui.set({ tab: 'alerts', panelOpen: true })
      withMap((h) => h.flyTo(cl.center, 11.2))
    } else if (s.gauges.byId[focus]) {
      // a water gauge (Radar Isu links the dam gauge as evidence): Situation card shows it, the map flies there
      const g = s.gauges.byId[focus]!
      ui.set({ tab: 'alerts', panelOpen: true, gauge: g.id, flash: g.id })
      withMap((h) => h.flyTo(g.coord, 11.5))
    } else if (s.harvests.byId[focus]) {
      ui.set({ tab: 'agri', panelOpen: true })
    }
    clearFocus()
  }, [focus, clearFocus])

  return (
    <div className={`dk-sg is-${size}`} data-eco="satu-daerah" data-product={product}>
      <BrowserFrame slug="siaga-wilayah" label={t('frame')} className="dk-sg-frame">
        <div className={`dk-sg-body${open || size === 'sm' ? '' : ' is-collapsed'}`}>
          <div className="dk-sg-stage">
            {/* phones: the one-line value statement sits above the map, in the first screen */}
            {size === 'sm' && <p className="dk-sg-valueline">{t('valueLine')}</p>}
            <MapStage />
            <Timeline />
            {/* phones: the regional head's summary right under the map (wide layouts show it in the panel) */}
            {size === 'sm' && role === 'kepala-daerah' && (
              <div className="dk-sg-execwrap">
                <Exec compact />
              </div>
            )}
          </div>
          <Panel />
        </div>
      </BrowserFrame>
      {broadcastOpen && (
        <Suspense fallback={null}>
          <Broadcast />
        </Suspense>
      )}
      {aiOpen && (
        <Suspense fallback={null}>
          <AskAi />
        </Suspense>
      )}
    </div>
  )
}

/**
 * The world clock starts on its own at the demo's 07.00 start (×10, like Meja Pimpinan), so the river climbs and
 * citizen reports arrive without a click — unless motion is reduced / off, the page was opened at another time (a
 * shared ?t= link), presenter mode, or the visitor already paused it this session.
 */
const AUTOPLAY_KEY = 'gamada:sg:autoplay'
function useAutoplay(present: boolean) {
  useEffect(() => {
    // tests drive the clock themselves (?e2e=1)
    if (present || motionMode() !== 'full' || new URLSearchParams(window.location.search).get('e2e') === '1') return
    let done = false
    try {
      done = window.sessionStorage.getItem(AUTOPLAY_KEY) === '1'
    } catch {
      /* storage blocked: autoplay once per page load */
    }
    if (done) return
    const id = window.setTimeout(() => {
      const c = clock.get()
      if (c.running || c.minutes !== 7 * 60 || world.status() !== 'ready') return
      clock.play()
      try {
        window.sessionStorage.setItem(AUTOPLAY_KEY, '1')
      } catch {
        /* ignore */
      }
    }, 1500)
    return () => window.clearTimeout(id)
  }, [present])
}

/* ------------------------------------------------------------------ guide */
export const missions: readonly Mission[] = [
  {
    id: 'scrub6',
    label: { id: 'Jalankan prediksi sampai +6 jam', en: 'Run the forecast to +6 h' },
    target: '[data-sw="cta"]',
    hint: { id: 'Tekan "Jalankan prediksi 6 jam" atau geser waktu di bawah peta.', en: 'Press "Run 6-hour forecast" or drag the time slider under the map.' },
  },
  {
    id: 'broadcast',
    label: { id: 'Kirim peringatan dini ke zona banjir', en: 'Send an early warning to the flood zone' },
    target: '[data-sw="cta"]',
    hint: { id: 'Peran BPBD atau Kepala Daerah: "Kirim peringatan dini", periksa level & wilayah, lalu Kirim.', en: 'Disaster Management Agency (BPBD) or Regional Head role: "Send early warning", check level & area, then Send.' },
    hintSm: { id: 'Peran BPBD (menu ⋯): "Kirim peringatan dini" di bawah peta.', en: 'Disaster Management Agency (BPBD) role (⋯ menu): "Send early warning" under the map.' },
    done: (e) => isEvent(e, 'alert.broadcast') && e.source === 'siaga-wilayah',
  },
  {
    id: 'confirm',
    label: { id: 'Cek konfirmasi laporan warga', en: 'Check the citizen confirmation' },
    target: '[data-sw="cta"]',
    hint: { id: 'Setelah peringatan terkirim: "Cek konfirmasi laporan warga" di bawah peta. Klaster ≥ 5 aduan dalam 1 km mengonfirmasi prediksi.', en: 'After the warning is out: "Check citizen confirmation" under the map. A cluster of ≥ 5 reports within 1 km confirms the forecast.' },
    done: (e) => isEvent(e, 'flood.confirmed'),
  },
  {
    id: 'harvest',
    label: { id: 'Lihat dampak pertanian', en: 'See the farm impact' },
    target: '.dk-sg [role="tab"][id$="-t-agri"]',
    hint: { id: 'Tab Pertanian → geser skenario ke "Pascabanjir".', en: 'Agriculture tab → switch the scenario to "Post-flood".' },
    done: (e) => isEvent(e, 'harvest.updated') && e.payload.scenario === 'pasca-banjir',
  },
  {
    id: 'imagery',
    label: { id: 'Buka citra satelit', en: 'Open the satellite imagery' },
    target: '[data-sw="layers"]',
    hint: { id: 'Tombol "Lapisan" di peta → Citra satelit Sentinel-2 (2016), atau tab Lingkungan → "Tampilkan citra Sentinel-2 (2016) di peta".', en: 'The "Layers" button on the map → Sentinel-2 satellite imagery (2016), or Environment tab → "Show Sentinel-2 (2016) imagery on the map".' },
  },
  {
    id: 'compare',
    label: { id: 'Bandingkan citra sebelum/sesudah', en: 'Compare before/after imagery' },
    target: '[data-sw="compare"], .dk-sg [role="tab"][id$="-t-env"]',
    hint: { id: 'Tab Lingkungan → geser slider pada citra.', en: 'Environment tab → drag the slider on the image.' },
  },
]

export const hotspot = { target: '[data-hotspot="sw-run"]', label: { id: 'Mulai di sini: jalankan prediksi banjir', en: 'Start here: run the flood forecast' } }
