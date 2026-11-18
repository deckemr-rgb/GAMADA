/**
 * demos/pajak-beres/actions.ts — the tax actions of the product (shared by the lazy tabs): compute PPh Final /
 * PPh 21 of the period (tax.computed, amounts from the world + rules.ts), mark the period ready (tax.ready).
 */
import { emit, world } from '../../demo-kit/world'
import { pphFinalOf } from '../../demo-kit/world/usaha-pintar'
import { pph21Rows, pph21Total } from './pph21'
import { PPH_FINAL, SOURCES, pctText } from './rules'
import { SLUG, afterPaint, periodOf, taxItemOf } from './model'

export function computePphFinal(): void {
  afterPaint(() => void computePphFinalNow())
}
function computePphFinalNow(): boolean {
  const s = world.get()
  const period = periodOf(s)
  const item = taxItemOf(s, 'pph-final-umkm', period)
  if (!item) return false
  const f = pphFinalOf(s, s.meta.shopId, period)
  emit('tax.computed', {
    taxItemId: item.id, kind: 'pph-final', amount: f.amount,
    basis: { id: `${pctText(PPH_FINAL.rate, 'id')} × omzet ${period} di atas batas bebas pajak`, en: `${pctText(PPH_FINAL.rate, 'en')} × ${period} turnover above the tax-free line` },
    rulesRef: PPH_FINAL.ref,
  }, SLUG)
  return true
}

export function computePph21(): void {
  afterPaint(() => void computePph21Now())
}
function computePph21Now(): boolean {
  const s = world.get()
  const period = periodOf(s)
  const item = taxItemOf(s, 'pph21', period)
  if (!item) return false
  const list = pph21Rows(s)
  emit('tax.computed', {
    taxItemId: item.id, kind: 'pph21', amount: pph21Total(list),
    basis: { id: `TER × bruto ${list.length} karyawan toko`, en: `TER × gross of ${list.length} shop employees` },
    rulesRef: SOURCES.ter.ref,
  }, SLUG)
  return true
}

export function markReady(): void {
  afterPaint(() => void markReadyNow())
}
function markReadyNow(): boolean {
  const s = world.get()
  const period = periodOf(s)
  const ids = (['pph-final-umkm', 'pph21'] as const).map((k) => taxItemOf(s, k, period)?.id).filter((x): x is string => !!x)
  if (!ids.length) return false
  emit('tax.ready', { businessId: s.meta.shopId, period, taxItemIds: ids }, SLUG)
  return true
}
