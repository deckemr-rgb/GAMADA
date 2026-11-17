/**
 * demos/siaga-wilayah — P5 Siaga Wilayah: Geo-AI early warning on the real regional map (spec §11 P5).
 *
 * Layout: a wide BrowserFrame with the full map, a collapsible left panel (Peringatan | Prediksi | Pertanian |
 * Lingkungan) and the time scrubber under the map. Phones: map first (≈ 62vh), the bar, then the panel as a sheet.
 * Flow: run the 6-hour forecast (rain moves in, the flood grows, villages light up) → send an early warning (level,
 * area, WA preview to camat / kades of real desa, ticks) → citizens in the zone get it in Sapa Warga → flood reports
 * confirm the prediction → post-flood harvest drop (econ.updated + supply signals) → before/after land-use imagery.
 * Emits rain.forecast, flood.alert, alert.broadcast, harvest.updated (source 'siaga-wilayah'); consumes
 * complaint.created (banjir) and flood.confirmed. All numbers are simulated and labelled so.
 */
import { lazy, Suspense, useEffect, useRef } from 'react'
import { BrowserFrame } from '../../demo-kit/frames'
import { useShell, type Mission } from '../../demo-kit/shell'
import { isEvent, useSession, useWorldStatus, world } from '../../demo-kit/world'
import type { DemoCanvasProps } from '../registry'
import { MapStage } from './MapStage'
import { Panel } from './Panel'
import { Timeline } from './Timeline'
import { swRole } from './data'
import { useT } from './strings'
import { forgetDesa, ui, useUi, withMap } from './ui'
import './siaga.css'

const Broadcast = lazy(() => import('./Broadcast'))
const AskAi = lazy(() => import('./AskAi'))

export default function SiagaWilayah({ product }: DemoCanvasProps) {
  const { t } = useT()
  const { size, focus, clearFocus } = useShell()
  const role = swRole(useSession().role)
  const open = useUi((s) => s.panelOpen)
  const broadcastOpen = useUi((s) => s.broadcastOpen)
  const aiOpen = useUi((s) => s.aiOpen)
  const status = useWorldStatus()

  // fresh view state per visit; the role decides the first tab
  const roleRef = useRef<string | null>(null)
  useEffect(() => {
    if (roleRef.current === role) return
    const first = roleRef.current === null
    roleRef.current = role
    if (first) ui.reset()
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
      withMap((h) => h.flyTo(c.coord, 12.5))
    } else if (cl) {
      ui.set({ tab: 'alerts', panelOpen: true })
      withMap((h) => h.flyTo(cl.center, 12.5))
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
            <MapStage />
            <Timeline />
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

/* ------------------------------------------------------------------ guide */
export const missions: readonly Mission[] = [
  {
    id: 'scrub6',
    label: { id: 'Jalankan prediksi sampai +6 jam', en: 'Run the forecast to +6 h' },
    hint: { id: 'Tekan "Jalankan prediksi 6 jam" atau geser waktu di bawah peta.', en: 'Press "Run 6-hour forecast" or drag the time slider under the map.' },
  },
  {
    id: 'broadcast',
    label: { id: 'Kirim peringatan ke 1 kecamatan', en: 'Send a warning to 1 district' },
    hint: { id: 'Peran BPBD atau Kepala Daerah: "Kirim peringatan dini", pilih level & wilayah, lalu Kirim.', en: 'BPBD or Regional Head role: "Send early warning", pick level & area, then Send.' },
    hintSm: { id: 'Peran BPBD (menu ⋯): "Kirim peringatan dini" di bawah peta.', en: 'BPBD role (⋯ menu): "Send early warning" under the map.' },
    done: (e) => isEvent(e, 'alert.broadcast') && e.source === 'siaga-wilayah',
  },
  {
    id: 'imagery',
    label: { id: 'Buka citra satelit', en: 'Open the satellite imagery' },
    hint: { id: 'Tombol "Lapisan" di peta → Citra satelit Sentinel-2 (2016), atau tab Lingkungan.', en: 'The "Layers" button on the map → Sentinel-2 satellite imagery (2016), or the Environment tab.' },
  },
  {
    id: 'harvest',
    label: { id: 'Lihat dampak pertanian', en: 'See the farm impact' },
    hint: { id: 'Tab Pertanian → geser skenario ke "Pascabanjir".', en: 'Agriculture tab → switch the scenario to "Post-flood".' },
    done: (e) => isEvent(e, 'harvest.updated') && e.payload.scenario === 'pasca-banjir',
  },
  {
    id: 'compare',
    label: { id: 'Bandingkan citra sebelum/sesudah', en: 'Compare before/after imagery' },
    hint: { id: 'Tab Lingkungan → geser slider pada citra.', en: 'Environment tab → drag the slider on the image.' },
  },
]

export const hotspot = { target: '[data-hotspot="sw-run"]', label: { id: 'Mulai di sini: jalankan prediksi banjir', en: 'Start here: run the flood forecast' } }
