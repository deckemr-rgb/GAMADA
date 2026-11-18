/**
 * world/up/config.ts — Usaha Pintar constants (one block; products read them through world/usaha-pintar).
 */
import type { Bi, ReqKey } from '../types'

export const UP = {
  id: 'usaha-pintar' as const,
  /** bump when the extension's generated shape changes (worlds carrying an older one are not re-patched: WORLD.version) */
  version: 1,
  /** cash float of a cashier shift (Rp) */
  cashFloat: 300_000,
  /** forecast horizon and safety days of a PO suggestion: demand × (leadDays + safetyDays) − onHand */
  safetyDays: 3,
  /** demand factor on market-ingredient SKUs after a price anomaly (C20) */
  priceAnomalyFactor: 1.6,
  /** at most this many open verification requests from the natural flow */
  maxOpenRequests: 12,
  /** natural brand mentions: about one per this many world minutes */
  brandEveryMin: 20,
}

/** the flood of the Usaha Pintar autoplay = Awas Belanja's FLOOD_AT */
export const UP_SCENARIO = { floodAt: 7 * 60 + 6 }

/** C28: the delivery-complaint burst after a flood alert (minutes after the alert) */
export const BRAND_BURST = {
  offsets: [0, 1, 2, 4, 6, 9, 15, 24] as const,
  /** the alert fires with the 5th delivery complaint */
  alertIndex: 4,
  stokAt: 7,
  hargaAt: 12,
  competitorAt: [6, 19] as const,
  /** one more delivery complaint per hour until this minute of day */
  trickleUntil: 17 * 60,
  /** spike rule: this many negative delivery mentions of the shop within `windowMin` */
  spikeMin: 5,
  windowMin: 120,
}

/** the emergency tender a flood need creates (C21): owner-approved simulated unit HPS (§6 P3 f) */
export const EMERGENCY_TENDER = {
  key: 'karung-terpal-darurat',
  kbli: '46634',
  title: { id: 'Pengadaan Karung Pasir & Terpal (darurat)', en: 'Sandbags & Tarps Procurement (emergency)' } as Bi,
  hps: { 'karung-pasir': 15_500, terpal: 135_000 } as Record<string, number>,
  /** deadline: this many days after publication, at 12.00 */
  deadlineDays: 2,
  deadlineAt: 12 * 60,
  competitors: 4,
  requirements: ['nib-kbli', 'akta', 'npwp', 'kyb', 'pajak', 'pengalaman', 'kapasitas', 'pakta'] as ReqKey[],
  spec: {
    id: 'Karung pasir siap pakai ±25 kg, bahan plastik anyaman; terpal plastik 4x6 m tebal, tahan air. Dikirim ke posko kecamatan dalam 2 hari.',
    en: 'Ready-filled sandbags ±25 kg, woven plastic; heavy 4x6 m waterproof plastic tarps. Delivered to the district post within 2 days.',
  } as Bi,
}

/** KBLI codes of the shop (TenderPilot profile chip "KBLI 46634") */
export const SHOP_KBLI = ['46634', '47524']

/** flood goods tags (sandbags, pumps, tarps) */
export const FLOOD_TAGS = ['sandbag', 'pump', 'tarp']
