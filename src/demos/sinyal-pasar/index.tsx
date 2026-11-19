/**
 * demos/sinyal-pasar — P17 Sinyal Pasar · plan docs/build/tahap4-plan.md §2 P17 + chains §3 (C30–C34, C13, C20).
 *
 * Disperindag (default): BrowserFrame desk (Ticker · KPI · Board · region / warning / anomaly cards; Peta, Operasi
 * Pasar, Langganan and the detail drawer are lazy). Pemilik Toko: "Sinyal Pasar untuk UMKM" phone inbox + side panel
 * (lazy, needs the Usaha Pintar data). This module stays tiny: skeleton, role switch, ?focus= routing, missions.
 * All prices, forecasts and effects are SIMULATED.
 */
import { Suspense, lazy, useEffect, useRef } from 'react'
import type { DemoCanvasProps } from '../registry'
import type { Mission } from '../../demo-kit/shell'
import { useShell } from '../../demo-kit/shell'
import { isEvent, setSession, useSession, world } from '../../demo-kit/world'
import { preloadWorld, useWorldReady, type WorldModule } from '../../demo-kit/world/ready'
import { useI18n } from '../../lib/i18n'
import { routeFocus } from './model'
import { ui } from './store'
import { SpSkeleton } from './Skel'
import './sinyal-pasar.css'

const loadDesk = () => import('./Desk')
const loadUmkm = () => import('./Umkm')
const Desk = lazy(loadDesk)
const Umkm = lazy(loadUmkm)

const MODS: readonly WorldModule[] = ['pasar-daerah']
const NF = { id: { t: 'Data tidak ditemukan', b: 'Tautan menunjuk data yang tidak ada di dunia demo ini.' }, en: { t: 'Item not found', b: 'The link points to data that does not exist in this demo world.' } }

/** the Pemilik Toko side needs the Usaha Pintar data: fetch it on the role chip's intent (hover / focus / touch) */
function useRoleChipPreload() {
  useEffect(() => {
    const sel = '[aria-label^="Ganti peran"],[aria-label^="Switch role"],[role="radiogroup"][aria-label="Peran"],[role="radiogroup"][aria-label="Role"]'
    let done = false
    const on = (e: Event) => {
      if (done || !(e.target instanceof Element) || !e.target.closest(sel)) return
      done = true
      preloadWorld('usaha-pintar/data')
    }
    const opts = { passive: true, capture: true }
    for (const ev of ['pointerover', 'focusin', 'touchstart']) document.addEventListener(ev, on, opts)
    return () => {
      for (const ev of ['pointerover', 'focusin', 'touchstart']) document.removeEventListener(ev, on, opts)
    }
  }, [])
}

/** ?focus= arrivals: market×commodity, OP-, PDN-, GJ-, PA-, DW- (bad id ⇒ default view + toast) */
function useFocusRoute(ready: boolean) {
  const { focus, clearFocus, toast } = useShell()
  const { lang } = useI18n()
  const done = useRef<string | null>(null)
  useEffect(() => {
    if (!focus || !ready) return
    // once per arrival (StrictMode re-runs effects; clearFocus lands on the next render)
    if (done.current === focus) return
    done.current = focus
    const r = routeFocus(world.get(), focus)
    const n = ui.get().n + 1
    if (!r) {
      toast({ title: NF[lang].t, body: NF[lang].b, tone: 'warn', icon: 'alert' })
      ui.set({ tab: 'ringkasan', detail: null, n })
    } else if (r.kind === 'alert') {
      ui.set({ alert: r.id, n })
      setSession({ role: 'pemilik-toko' })
    } else {
      if (r.kind === 'price') ui.set({ tab: 'ringkasan', detail: r.id, panel: 'none', n })
      else if (r.kind === 'watch') ui.set({ tab: 'ringkasan', detail: r.priceId, panel: 'dist', n })
      else if (r.kind === 'op') ui.set({ tab: 'operasi', op: r.id, detail: null, n })
      else ui.set({ tab: 'ringkasan', warn: r.id, detail: null, n })
      setSession({ role: 'disperindag' })
    }
    clearFocus()
  }, [focus, ready, clearFocus, toast, lang])
}

export default function Canvas(_props: DemoCanvasProps) {
  const ready = useWorldReady(MODS)
  const { role } = useSession()
  const { setToastPlacement } = useShell()
  useRoleChipPreload()
  useFocusRoute(ready)
  useEffect(() => {
    setToastPlacement({ wide: 'bottom-left', sm: 'top-right' })
    return () => setToastPlacement(null)
  }, [setToastPlacement])
  const umkm = role === 'pemilik-toko'
  // start the side's chunk together with the world modules (not after them)
  useEffect(() => void (umkm ? loadUmkm() : loadDesk()), [umkm])
  if (!ready) return <SpSkeleton umkm={umkm} />
  return <Suspense fallback={<SpSkeleton umkm={umkm} />}>{umkm ? <Umkm /> : <Desk />}</Suspense>
}

export const missions: readonly Mission[] = [
  {
    id: 'anomali',
    label: { id: 'Temukan anomali', en: 'Find the anomaly' },
    hint: { id: 'Buka baris berlabel Anomali (banjir pukul 07.06 memicunya).', en: 'Open a row labelled Anomaly (the 07:06 flood triggers one).' },
    target: '[data-hotspot="sp-anomaly"]',
  },
  {
    id: 'rekomendasi',
    label: { id: 'Rekomendasikan operasi pasar', en: 'Recommend a market operation' },
    hint: { id: 'Di detail harga: Rekomendasikan operasi pasar → Kirim ke Meja Pimpinan.', en: 'In the price details: Recommend a market operation → Send to Meja Pimpinan.' },
    // C13 also suggests an op (source sinyal-pasar); only Disperindag's own recommendation (sentBy) counts
    done: (e) => isEvent(e, 'market.operation') && e.source === 'sinyal-pasar' && e.payload.stage === 'recommended' && e.payload.sentBy === 'disperindag',
  },
  {
    id: 'efek',
    label: { id: 'Lihat efeknya', en: 'See the effect' },
    hint: { id: 'Tab Operasi Pasar → Simulasikan: kurva sesudah operasi.', en: 'Market operations tab → Simulate: the curve after the operation.' },
    target: '[data-tour="sp-simulate"]',
  },
  {
    id: 'umkm',
    label: { id: 'Peringatan untuk UMKM', en: 'Alert for UMKM' },
    hint: { id: 'Ganti peran ke Pemilik Toko (atas), lalu Siapkan PO di Toko Autopilot.', en: 'Switch the role to Shop owner (top), then Prepare a PO in Toko Autopilot.' },
    hintSm: { id: 'Buka ⋯ → Peran → Pemilik Toko, lalu Siapkan PO.', en: 'Open ⋯ → Role → Shop owner, then Prepare a PO.' },
    done: (e) => isEvent(e, 'po.drafted') && e.source === 'sinyal-pasar',
  },
  {
    id: 'langganan',
    label: { id: 'Atur langganan', en: 'Set the subscription' },
    hint: { id: 'Sebagai Pemilik Toko: tab Langganan → pilih bahan → Simpan.', en: 'As Shop owner: Subscriptions tab → pick ingredients → Save.' },
    hintSm: { id: 'Peran Pemilik Toko (⋯ → Peran) → Langganan → Simpan.', en: 'Shop owner role (⋯ → Role) → Subscriptions → Save.' },
    done: (e) => isEvent(e, 'price.subscribed') && e.source === 'sinyal-pasar',
  },
]

export const hotspot = { target: '[data-hotspot="sp-anomaly"]', id: 'sp-anomaly', label: { id: 'Mulai di sini: buka anomali harga', en: 'Start here: open the price anomaly' } }
