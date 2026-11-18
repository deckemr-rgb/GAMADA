/**
 * world/up/payloads.ts — payload builders (plain): products emit them with their own slug, so the math (totals, the
 * main payment method, change) is the same in every product and in tests.
 */
import type { EventMap, PayMethod } from '../types'
import type { RoleId } from '../../../content/products'
import type { Bi } from '../types'

export interface CartLine { productId: string; qty: number; price: number }
/** one Kasir sale: total = Σ lines − discount; `payment` = the method with the largest share; tunai change from `cashGiven` */
export function salePayload(cart: { outletId: string; lines: CartLine[]; discount?: number; payments?: { method: PayMethod; amount: number }[]; staffId?: string; cashGiven?: number }): EventMap['sale.created'] {
  const gross = cart.lines.reduce((a, l) => a + l.qty * l.price, 0)
  const discount = Math.max(0, Math.min(gross, Math.round(cart.discount ?? 0)))
  const total = gross - discount
  const payments = cart.payments?.length ? cart.payments : [{ method: 'tunai' as PayMethod, amount: total }]
  const main = [...payments].sort((a, b) => b.amount - a.amount)[0]!.method
  const cashPart = payments.filter((p) => p.method === 'tunai').reduce((a, p) => a + p.amount, 0)
  return {
    outletId: cart.outletId, items: cart.lines.map(({ productId, qty, price }) => ({ productId, qty, price })), payment: main,
    ...(discount ? { discount } : {}), ...(payments.length > 1 || cart.payments ? { payments } : {}), ...(cart.staffId ? { staffId: cart.staffId } : {}),
    ...(cart.cashGiven != null && cashPart > 0 ? { cash: { given: cart.cashGiven, change: Math.max(0, cart.cashGiven - cashPart) } } : {}),
  }
}

/** the bid TenderPilot sends (34 pages = the 7 composed sections) */
export function bidPayload(tenderId: string, businessId: string, price: number, docSections: string[], pages = 34): EventMap['bid.submitted'] {
  return { tenderId, businessId, price: Math.round(price), pages, docSections }
}

/** ONE event per bulk send: replies in the order of the mentions */
export function repliesPayload(mentionIds: string[], tone: 'empatik' | 'formal' | 'santai', replies: Bi[], by: RoleId, alertId?: string): EventMap['brand.replied'] {
  return { mentionIds, tone, replies, by, ...(alertId ? { alertId } : {}) }
}
