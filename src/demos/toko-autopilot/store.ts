/**
 * demos/toko-autopilot/store.ts — product state that outlives a tab or a role switch: the Kasir cart per outlet
 * (role and language switches keep it), the open PO chat and its "typing" window. Tiny external store.
 */
import { useSyncExternalStore } from 'react'
import { useWorld, type WorldState } from '../../demo-kit/world'
import { shopOutlets } from '../../demo-kit/world/usaha-pintar'
import type { OutKey } from './strings'

export interface Line { productId: string; qty: number; price: number }
export interface Cart { lines: Line[]; discount: number; mode: 'pct' | 'rp'; pct: number }
interface State { carts: Record<string, Cart>; chat: string | null; typingUntil: Record<string, number> }

let st: State = { carts: {}, chat: null, typingUntil: {} }
const subs = new Set<() => void>()
export const ui = {
  get: () => st,
  set(patch: Partial<State>) {
    st = { ...st, ...patch }
    for (const f of subs) f()
  },
  sub(f: () => void) {
    subs.add(f)
    return () => void subs.delete(f)
  },
}
export function useUi<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(ui.sub, () => sel(st), () => sel(st))
}

export const EMPTY_CART: Cart = { lines: [], discount: 0, mode: 'pct', pct: 0 }
export const cartOf = (outletId: string): Cart => st.carts[outletId] ?? EMPTY_CART
export function setCart(outletId: string, c: Cart) {
  ui.set({ carts: { ...st.carts, [outletId]: c } })
}
export function addToCart(outletId: string, productId: string, price: number, n = 1) {
  const c = cartOf(outletId)
  const i = c.lines.findIndex((l) => l.productId === productId)
  const lines = i < 0 ? [...c.lines, { productId, qty: n, price }] : c.lines.map((l, k) => (k === i ? { ...l, qty: Math.max(0, l.qty + n) } : l)).filter((l) => l.qty > 0)
  setCart(outletId, reprice({ ...c, lines }))
}
/** gross, the discount (Rp; % mode recomputed from the gross) and the total */
export function reprice(c: Cart): Cart {
  const gross = c.lines.reduce((a, l) => a + l.qty * l.price, 0)
  return c.mode === 'pct' ? { ...c, discount: Math.round((gross * c.pct) / 100) } : { ...c, discount: Math.min(c.discount, gross) }
}
export const grossOf = (c: Cart) => c.lines.reduce((a, l) => a + l.qty * l.price, 0)

/** the shop's three outlet ids ('' while unknown), as a stable string selection */
const outletSel = (s: WorldState) => {
  const o = shopOutlets(s)
  return `${o.toko?.id ?? ''}|${o.kopi?.id ?? ''}|${o.warung?.id ?? ''}`
}
export function useOutlets(): Record<Exclude<OutKey, 'semua'>, string> {
  const [toko = '', kopi = '', warung = ''] = useWorld(outletSel).split('|')
  return { toko, kopi, warung }
}
export const keyOfOutlet = (o: Record<Exclude<OutKey, 'semua'>, string>, id: string): OutKey => (o.kopi === id ? 'kopi' : o.warung === id ? 'warung' : o.toko === id ? 'toko' : 'semua')

/** run `fn` after the next paint: the pressed control answers in this frame, the heavy work follows (INP) */
export const afterPaint = (fn: () => void): void => {
  requestAnimationFrame(() => setTimeout(fn, 0))
}
