/**
 * demos/pantau-merek/announce-text.ts — the service notice draft (simulated AI wording): names the flood kecamatan of
 * the alert's cause, "pengiriman tertunda 1–2 hari karena banjir", pick-up at the shop by the market, and the offer.
 */
import type { Bi, BrandAnnouncement, WorldState } from '../../demo-kit/world'
import { kecName } from '../../demo-kit/world/usaha-pintar'
import { shopOf } from './model'

export type Offer = NonNullable<BrandAnnouncement['offer']>
export const OFFERS: Offer[] = ['ambil-sendiri', 'jadwal-ulang', 'gratis-ongkir']

/** the flood kecamatan behind an alert (its cause = the flood alert) */
export function alertKecs(s: WorldState, alertId: string): string[] {
  const a = s.brandAlerts.byId[alertId]
  const fid = a?.causeRef?.startsWith('alerts:') ? a.causeRef.slice(7) : ''
  const ids = s.alerts.byId[fid]?.kecamatanIds ?? s.region.floodKecamatanIds
  return ids.map((k) => kecName(s, k))
}

const join = (l: string[], and: string) => (l.length <= 1 ? (l[0] ?? '') : `${l.slice(0, -1).join(', ')} ${and} ${l[l.length - 1]}`)

export function announcementDraft(s: WorldState, alertId: string, offer: Offer): Bi {
  const shop = shopOf(s)
  const k = alertKecs(s, alertId)
  const offerId: Record<Offer, string> = {
    'ambil-sendiri': 'Yang mengambil sendiri kami layani tanpa antre di kasir khusus.',
    'jadwal-ulang': 'Jadwal kirim ulang bisa Anda pilih sendiri lewat pesan ke admin.',
    'gratis-ongkir': 'Ongkos kirim ulang untuk pesanan yang tertunda kami gratiskan.',
  }
  const offerEn: Record<Offer, string> = {
    'ambil-sendiri': 'Pick-ups are served without queueing at a dedicated till.',
    'jadwal-ulang': 'You can choose a new delivery slot by messaging our admin.',
    'gratis-ongkir': 'Re-delivery of delayed orders is free of charge.',
  }
  return {
    id: `Info layanan ${shop.name}: karena banjir di Kec. ${join(k, 'dan')}, pengiriman ke wilayah tersebut tertunda 1–2 hari. Pesanan tetap aman di gudang dan dikirim begitu jalur dibuka. Untuk kebutuhan mendesak, barang bisa diambil sendiri di toko kami dekat ${shop.market}. ${offerId[offer]} Kabar terbaru kami kirim lewat pesan ke tiap pembeli.`,
    en: `Service notice from ${shop.name}: because of flooding in ${join(k, 'and')}, deliveries to these areas are delayed by 1–2 days. Orders stay safe in our warehouse and ship as soon as the roads reopen. For urgent needs, items can be picked up at our shop by ${shop.market}. ${offerEn[offer]} We will message every buyer with updates.`,
  }
}
