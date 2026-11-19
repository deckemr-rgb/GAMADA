/**
 * shell/effects-pd.ts — the Pasar Daerah toast landings read from STATE (plan §3 L9–L12 + Sinyal Pasar → Meja /
 * Indeks Ekonomi) and the root labels of the PD actions. Registered by DemoShell on the first interaction on an
 * Usaha Pintar / Pasar Daerah / Inti page (toasts only follow the visitor's own actions), so no page carries it in
 * its first load.
 */
import type { EventType, WorldState } from '../world'
import type { ProductSlug } from '../../content/products'
import { EFFECT_ALSO, ROOT_UP, latestMatchedTender, type EffectRecent } from './effects'

const pay = (e: EffectRecent, k: string): string => String((e.payload as Record<string, unknown>)[k] ?? '')

type Also = typeof EFFECT_ALSO
const ALSO: Also = {
  // L1 / L7: Pajak Rapi badge (Katalog Lokal), the pajak factor (Rapor Usaha)
  'tax.ready': { targets: ['tenderpilot', 'katalog-lokal', 'rapor-usaha'], focus: (s, _e, t) => (t === 'katalog-lokal' ? s.meta.shopId : t === 'rapor-usaha' ? 'pajak' : latestMatchedTender(s)) },
  // L2 / L8: the vendor badge (TenderPilot), the shortlist (Katalog Lokal: the need of its newest match), the bank row (Rapor Usaha)
  'partner.verified': {
    targets: ['tenderpilot', 'katalog-lokal', 'rapor-usaha'],
    focus: (s, e, t) => {
      const biz = pay(e, 'subjectId')
      if (t === 'rapor-usaha') return biz || null
      if (t === 'katalog-lokal') {
        for (const id of s.matches.ids) if (s.matches.byId[id]?.businessId === biz) return s.matches.byId[id]!.needId
        return biz || null
      }
      return latestMatchedTender(s)
    },
  },
  // L9: a bid on a tender of a Katalog Lokal need = the shop's offer there
  'bid.submitted': {
    targets: (s, e) => (s.tenders.byId[pay(e, 'tenderId')]?.needId ? ['katalog-lokal'] : []),
    focus: (s, e) => s.tenders.byId[pay(e, 'tenderId')]?.needId ?? null,
  },
  // L10: an order on a need with a tender closes the tender (TenderPilot Riwayat: the bid that won)
  'order.created': {
    targets: (s, e) => {
      const needId = pay(e, 'needId')
      return needId && s.tenders.ids.some((t) => s.tenders.byId[t]?.needId === needId) ? ['tenderpilot'] : []
    },
    focus: (s, e) => {
      const t = s.tenders.ids.map((id) => s.tenders.byId[id]!).find((x) => x.needId === pay(e, 'needId'))
      return s.bids.ids.map((id) => s.bids.byId[id]!).find((b) => b.tenderId === t?.id && b.businessId === pay(e, 'businessId'))?.id ?? t?.id ?? null
    },
  },
  // L11: the shop ships ⇒ its stock leaves (Toko Autopilot Prediksi, the first SKU of the order's category)
  'order.shipped': {
    targets: (s, e) => (s.orders.byId[pay(e, 'orderId')]?.businessId === s.meta.shopId ? ['toko-autopilot'] : []),
    focus: (s, e) => {
      const cat = s.orders.byId[pay(e, 'orderId')]?.items.find((i) => i.category)?.category
      return s.products.ids.find((id) => s.products.byId[id]?.businessId === s.meta.shopId && s.products.byId[id]?.category === cat) ?? null
    },
  },
  // Sinyal Pasar: a recommendation reaches Meja Pimpinan; a running / finished operation is measured in Indeks Ekonomi (Dampak)
  'market.operation': {
    targets: (_s, e) => {
      const st = pay(e, 'stage')
      return st === 'recommended' ? ['meja-pimpinan'] : st === 'running' || st === 'done' ? ['indeks-ekonomi'] : []
    },
    focus: (_s, e) => pay(e, 'id') || null,
  },
}
const ROOTS: Partial<Record<EventType, [string, string]>> = {
  'order.created': ['Pesanan {code}', 'Order {code}'], 'order.confirmed': ['Konfirmasi pesanan', 'Order confirmation'], 'order.shipped': ['Pengiriman pesanan', 'Order shipment'],
  'order.paid': ['Pembayaran pesanan', 'Order payment'], 'loan.applied': ['Pengajuan modal', 'Loan application'], 'loan.approved': ['Persetujuan modal', 'Loan approval'],
  'loan.rejected': ['Keputusan modal', 'Loan decision'], 'consent.granted': ['Berbagi data', 'Data sharing'], 'consent.revoked': ['Pencabutan akses data', 'Data access revoked'],
  'market.operation': ['Operasi pasar', 'Market operation'], 'price.shock': ['Guncangan pasokan', 'Supply shock'], 'price.warning': ['Peringatan dini harga', 'Early price warning'],
  'price.subscribed': ['Langganan harga', 'Price subscription'], 'distributor.watched': ['Pantauan distributor', 'Distributor watch'], 'econ.updated': ['Indeks ekonomi', 'Economic index'],
  'econ.briefed': ['Briefing ekonomi', 'Economic briefing'], 'ledger.reviewed': ['Tinjauan jurnal', 'Journal review'], 'chat.read': ['Kanal Inti', 'Inti channels'],
}
let done = false
export function register(): void {
  if (done) return
  done = true
  Object.assign(EFFECT_ALSO, ALSO)
  Object.assign(ROOT_UP, ROOTS)
}
export type { WorldState, ProductSlug, EffectRecent }
