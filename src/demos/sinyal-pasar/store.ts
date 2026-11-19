/**
 * demos/sinyal-pasar/store.ts — the view state both roles share (tiny external store): the commodity filter, the open
 * detail (market × commodity), the open UMKM alert, the selected operation. A role or language switch keeps it.
 */
import { useSyncExternalStore } from 'react'

export type TabId = 'ringkasan' | 'peta' | 'operasi' | 'langganan'
export type Panel = 'none' | 'rekom' | 'dist'
export interface Ui {
  tab: TabId
  /** '' = all commodities */
  commodity: string
  market: string
  /** open drawer: price id `${marketId}:${commodityId}` */
  detail: string | null
  panel: Panel
  /** selected operation (Operasi tab) */
  op: string | null
  /** warning card to flash (focus arrival) */
  warn: string | null
  /** open UMKM alert (Pemilik Toko inbox) */
  alert: string | null
  /** bump to re-run a focus flash on the same id */
  n: number
}

const TABS: readonly TabId[] = ['ringkasan', 'peta', 'operasi', 'langganan']
const q = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
const tab0 = q.get('tab') as TabId | null
let state: Ui = {
  tab: tab0 && TABS.includes(tab0) ? tab0 : 'ringkasan',
  commodity: q.get('commodity') ?? '',
  market: q.get('market') ?? '',
  detail: null,
  panel: 'none',
  op: null,
  warn: null,
  alert: null,
  n: 0,
}
const subs = new Set<() => void>()

export const ui = {
  get: (): Ui => state,
  set(patch: Partial<Ui>) {
    state = { ...state, ...patch }
    for (const fn of [...subs]) fn()
  },
  subscribe(fn: () => void) {
    subs.add(fn)
    return () => {
      subs.delete(fn)
    }
  },
}

export function useUi(): Ui {
  return useSyncExternalStore(ui.subscribe, ui.get, ui.get)
}

export const SP_TABS = TABS
