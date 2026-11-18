/**
 * world/up/shop.ts — the business profile every Usaha Pintar product shows the same way (Kenal Mitra, Pajak Beres,
 * TenderPilot, later Katalog Lokal): specimen NIB / NPWP (masked), KBLI, akta, address, staff, KYB date.
 */
import type { Bi, CatalogNeed, Product, Staff, StockLevel, WorldState } from '../types'
import { createParamSelector, createSelector } from '../selectors'
import { hashString } from '../prng'
import { rows } from '../util'
import { SHOP_KBLI } from './config'
import { kecName, desaName } from './base'

const KBLI_LABEL: Record<string, Bi> = {
  '46634': { id: 'Perdagangan besar bahan konstruksi', en: 'Wholesale of construction materials' },
  '47524': { id: 'Perdagangan eceran bahan bangunan', en: 'Retail of building materials' },
  '56103': { id: 'Kedai makanan', en: 'Food stalls' },
}
const digits = (key: string, n: number) => {
  let out = ''
  for (let i = 0; out.length < n; i++) out += String(hashString(`${key}|${i}`) % 1_000_000_000).padStart(9, '0')
  return out.slice(0, n)
}

export interface VendorProfile {
  businessId: string
  name: string
  owner: string
  legal: 'perorangan' | 'UD' | 'CV' | 'PT'
  /** 13-digit SPECIMEN number (never a real NIB) */
  nib: string
  specimen: 'SPESIMEN'
  kbli: { code: string; label: Bi }[]
  /** masked: "0000 •••• •••• 0000" */
  npwp: string
  /** null for an individual (perorangan) */
  akta: { number: string; date: string } | null
  address: string
  kecamatanId: string
  staffCount: number
  years: number
  since: number
  verified: boolean
  taxTidy: boolean
  /** KYB verification (Kenal Mitra) */
  kyb: { verificationId: string; at: number; score: number } | null
}

/** THE source of the business profile values in every product */
export const vendorProfile = createParamSelector((s) => [s.businesses, s.verifications, s.staff, s.meta.shopId, s.region], (bizId: string, businesses, verifications, staff, shopId, region): VendorProfile | null => {
  const b = businesses.byId[bizId]
  if (!b) return null
  const legal = b.legal ?? (b.name.startsWith('CV ') ? 'CV' : b.name.startsWith('PT ') ? 'PT' : b.name.startsWith('UD ') ? 'UD' : 'perorangan')
  const d = digits(b.id, 17)
  const kyb = rows(verifications).filter((v) => v.subjectId === bizId && v.kind === 'kyb' && v.result === 'lolos').sort((a, c) => c.at - a.at)[0]
  const kodes = bizId === shopId ? SHOP_KBLI : b.kind === 'toko-bangunan' ? [SHOP_KBLI[0]!] : b.kind === 'warung-makan' || b.kind === 'kedai-kopi' ? ['56103'] : []
  const s = { region } as WorldState
  return {
    businessId: b.id, name: b.name, owner: b.ownerName, legal, nib: `9${d.slice(0, 12)}`, specimen: 'SPESIMEN',
    kbli: kodes.map((code) => ({ code, label: KBLI_LABEL[code] ?? { id: code, en: code } })),
    npwp: `${d.slice(12, 16)} •••• •••• ${d.slice(4, 8)}`,
    akta: legal === 'CV' || legal === 'PT' ? { number: `${Number(d.slice(8, 10)) + 1}`, date: `${b.since}-0${1 + (Number(d[10]) % 9)}-1${d[11]}` } : null,
    address: `Desa ${desaName(s, b.kecamatanId, b.desaId)}, Kec. ${kecName(s, b.kecamatanId)}`, kecamatanId: b.kecamatanId,
    staffCount: bizId === shopId ? rows(staff).filter((x) => x.businessId === bizId).length || b.employees : b.employees,
    years: 2026 - b.since, since: b.since, verified: b.verified, taxTidy: b.taxTidy,
    kyb: kyb ? { verificationId: kyb.id, at: kyb.at, score: kyb.score } : null,
  }
})

/** staff of a business (optionally one outlet), table order */
const staffSel = createParamSelector((s) => [s.staff], (key: string, staff): Staff[] => {
  const [biz, outlet] = key.split('|')
  return rows(staff).reverse().filter((x) => x.businessId === biz && (!outlet || x.outletId === outlet))
})
export const staffOf = (s: WorldState, bizId: string, outletId?: string): Staff[] => staffSel(s, outletId ? `${bizId}|${outletId}` : bizId)

/** EAN-13 in-store code (prefix 2, cannot collide with a retail barcode) from the SKU */
export function barcodeOf(p: Pick<Product, 'sku' | 'id'>): string {
  const body = `2${String(hashString(p.sku || p.id) % 100_000_000_000).padStart(11, '0')}`
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(body[i]) * (i % 2 ? 3 : 1)
  return `${body}${(10 - (sum % 10)) % 10}`
}

/** the shop's stock of a catalog category (toko outlet): total units + rows */
export const shopStockFor = createParamSelector((s) => [s.stock, s.products, s.meta.shopId], (category: string, stock, products, shopId): { onHand: number; rows: StockLevel[] } => {
  const list = rows(stock).filter((st) => {
    const p = products.byId[st.productId]
    return !!p && p.businessId === shopId && p.category === category && !p.tags.includes('bahan')
  })
  return { onHand: list.reduce((a, st) => a + st.onHand, 0), rows: list }
})

export interface Opportunity { need: CatalogNeed; items: { name: Bi; category: string; qty: number; unit: string; onHand: number }[] }
/** open government needs whose items the shop supplies, with the shop's stock per item (Toko Autopilot card) */
export const shopOpportunities = createSelector((s) => [s.catalogNeeds, s.businesses, s.stock, s.products, s.meta.shopId], (needs, businesses, stock, products, shopId): Opportunity[] => {
  const shop = businesses.byId[shopId]
  if (!shop) return []
  const st = { stock, products, meta: { shopId } } as unknown as WorldState
  return rows(needs)
    .filter((n) => (n.status === 'baru' || n.status === 'dicocokkan') && n.items.every((i) => shop.supplies.includes(i.category)))
    .map((n) => ({ need: n, items: n.items.map((i) => ({ name: i.name, category: i.category, qty: i.qty, unit: i.unit, onHand: shopStockFor(st, i.category).onHand })) }))
})
