/**
 * world/up/tender.ts — TenderPilot selectors (SIMULATED procurement data in a public-notice style; no real portal).
 * The win probability shown anywhere is `tender.matches[biz]` = `winScore()`.
 */
import type { Bi, Bid, Tender, WorldState } from '../types'
import type { ProductSlug } from '../../../content/products'
import { DAY_MIN, rows } from '../util'
import { SHOP_KBLI } from './config'
import { REQ } from './labels'
import { itemCost, winScoreOf, type WinScore } from './win-score'
import { procurementOfTender } from './base'
import { shopStockFor, vendorProfile } from './shop'

export { EMERGENCY_TENDER, SHOP_KBLI } from './config'
export { WIN_MODEL, itemCost, kbliOf, type WinScore, type WinFactor, type WinFactorKey } from './win-score'
export { procurementOfTender } from './base'

/** factors + probability of a tender for a business (the same model C22 used) */
export const winScore = (s: WorldState, tenderId: string, bizId: string): WinScore => winScoreOf(s, tenderId, bizId)

export interface FeedFilters { kbli?: 'cocok' | 'semua'; kecamatanId?: string | null; value?: 'kecil' | 'sedang' | 'besar' | null; deadlineDays?: 3 | 7 | null }
export interface FeedRow { tender: Tender; probability: number | null; kbliOk: boolean; deadlineIn: number; risk: number | null; mirror: boolean; isNew: boolean }
/** open tenders at `now` with counts per filter value; sorted by win chance */
export function tenderFeed(s: WorldState, now: number, f: FeedFilters = {}): { rows: FeedRow[]; counts: { kbli: number; kecamatan: number; value: Record<'kecil' | 'sedang' | 'besar', number>; deadline: Record<'3' | '7' | 'semua', number> } } {
  const shopId = s.meta.shopId
  const all = rows(s.tenders).filter((t) => t.status === 'dibuka' && t.publishedAt <= now && t.deadlineAt > now).map((t) => {
    const pid = procurementOfTender(s, t)
    const pr = pid ? s.procurements.byId[pid] : undefined
    const riskScore = t.risk?.score ?? (t.procurementId && pr?.riskScore != null && pr.riskScore >= 60 ? pr.riskScore : null)
    return { tender: t, probability: t.matches[shopId] ?? null, kbliOk: SHOP_KBLI.includes(t.kbli), deadlineIn: t.deadlineAt - now, risk: riskScore, mirror: !!t.procurementId, isNew: now - t.publishedAt < 60 }
  })
  const band = (v: number) => (v <= 50_000_000 ? 'kecil' : v <= 200_000_000 ? 'sedang' : 'besar')
  const keep = all.filter((r) =>
    (f.kbli !== 'cocok' || r.kbliOk) && (!f.kecamatanId || r.tender.kecamatanId === f.kecamatanId) && (!f.value || band(r.tender.value) === f.value) && (!f.deadlineDays || r.deadlineIn <= f.deadlineDays * DAY_MIN),
  )
  keep.sort((a, b) => (b.probability ?? -1) - (a.probability ?? -1) || a.deadlineIn - b.deadlineIn || a.tender.id.localeCompare(b.tender.id))
  return {
    rows: keep,
    counts: {
      kbli: all.filter((r) => r.kbliOk).length, kecamatan: f.kecamatanId ? all.filter((r) => r.tender.kecamatanId === f.kecamatanId).length : all.length,
      value: { kecil: all.filter((r) => band(r.tender.value) === 'kecil').length, sedang: all.filter((r) => band(r.tender.value) === 'sedang').length, besar: all.filter((r) => band(r.tender.value) === 'besar').length },
      deadline: { '3': all.filter((r) => r.deadlineIn <= 3 * DAY_MIN).length, '7': all.filter((r) => r.deadlineIn <= 7 * DAY_MIN).length, semua: all.length },
    },
  }
}

/** header KPIs: open matched tenders, average chance, deadlines ≤ 3 days, value of active bids */
export function tenderKpi(s: WorldState, now: number): { openMatched: number; avgProbability: number | null; dueIn3Days: number; activeBidValue: number } {
  const shopId = s.meta.shopId
  const open = rows(s.tenders).filter((t) => t.status === 'dibuka' && t.publishedAt <= now && t.deadlineAt > now && t.matches[shopId] !== undefined)
  const bids = rows(s.bids).filter((b) => b.businessId === shopId && b.status === 'terkirim')
  return {
    openMatched: open.length, avgProbability: open.length ? Math.round((open.reduce((a, t) => a + t.matches[shopId]!, 0) / open.length) * 100) / 100 : null,
    dueIn3Days: open.filter((t) => t.deadlineAt - now <= 3 * DAY_MIN).length, activeBidValue: bids.reduce((a, b) => a + b.price, 0),
  }
}

export interface Requirement { key: Tender['requirements'][number]; label: Bi; ok: boolean; warn?: Bi; source: ProductSlug | 'profil'; detail: Bi; focus?: string }
/** the checklist of a tender for a business (an individual has no akta): pajak follows tax.ready, kyb follows Kenal Mitra,
 *  kapasitas warns from the Toko Autopilot stock (not blocking) */
export function requirementsFor(s: WorldState, tenderId: string, bizId: string): Requirement[] {
  const t = s.tenders.byId[tenderId]
  const b = s.businesses.byId[bizId]
  const prof = vendorProfile(s, bizId)
  if (!t || !b || !prof) return []
  const fmtDate = (at: number): Bi => {
    const d = new Date(Date.parse(`${s.day}T00:00:00Z`) + Math.floor(at / DAY_MIN) * 86_400_000)
    return { id: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }), en: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) }
  }
  const taxItem = rows(s.taxItems).filter((x) => x.businessId === bizId && x.kind === 'pph-final-umkm').sort((x, y) => y.period.localeCompare(x.period))[0]
  const wins = rows(s.bids).filter((x) => x.businessId === bizId && x.status === 'menang').length
  const out: Requirement[] = []
  for (const key of t.requirements) {
    if (key === 'akta' && !prof.akta) continue
    const label = REQ[key]
    switch (key) {
      case 'nib-kbli': {
        const ok = prof.kbli.some((k) => k.code === t.kbli)
        out.push({ key, label, ok, source: 'profil', detail: { id: `NIB ${prof.nib} (SPESIMEN) · KBLI ${prof.kbli.map((k) => k.code).join(', ')}`, en: `NIB ${prof.nib} (SPECIMEN) · KBLI ${prof.kbli.map((k) => k.code).join(', ')}` } })
        break
      }
      case 'akta':
        out.push({ key, label, ok: !!prof.akta, source: 'profil', detail: { id: `Akta no. ${prof.akta?.number ?? '-'}`, en: `Deed no. ${prof.akta?.number ?? '-'}` } })
        break
      case 'npwp':
        out.push({ key, label, ok: true, source: 'profil', detail: { id: `NPWP ${prof.npwp}`, en: `Tax ID ${prof.npwp}` } })
        break
      case 'kyb': {
        const d = prof.kyb ? fmtDate(prof.kyb.at) : null
        out.push({ key, label, ok: b.verified, source: 'kenal-mitra', detail: d ? { id: `Kenal Mitra · terverifikasi ${d.id}`, en: `Kenal Mitra · verified ${d.en}` } : { id: 'Belum diverifikasi di Kenal Mitra', en: 'Not verified in Kenal Mitra yet' }, ...(prof.kyb ? { focus: prof.kyb.verificationId } : {}) })
        break
      }
      case 'pajak':
        out.push({
          key, label, ok: b.taxTidy, source: 'pajak-beres', ...(taxItem ? { focus: taxItem.id } : {}),
          detail: b.taxTidy ? { id: `Pajak ${taxItem?.period ?? ''} siap lapor (Pajak Beres)`, en: `Tax ${taxItem?.period ?? ''} ready to file (Pajak Beres)` } : { id: 'Status pajak belum valid · Lengkapi di Pajak Beres', en: 'Tax status not valid yet · Complete it in Pajak Beres' },
        })
        break
      case 'pengalaman':
        out.push({ key, label, ok: wins > 0, source: 'tenderpilot', detail: { id: `${wins} pekerjaan sejenis dimenangkan`, en: `${wins} similar contracts won` } })
        break
      case 'kapasitas': {
        let warn: Bi | undefined
        let focus: string | undefined
        for (const it of t.items ?? []) {
          const st = shopStockFor(s, it.category)
          if (st.onHand < it.qty) {
            const sku = [...st.rows].sort((x, y) => y.onHand - x.onHand)[0]
            warn = { id: `Stok ${st.onHand.toLocaleString('id-ID')} dari ${it.qty.toLocaleString('id-ID')} ${it.unit} · kirim PO di Toko Autopilot`, en: `Stock ${st.onHand.toLocaleString('en-GB')} of ${it.qty.toLocaleString('en-GB')} ${it.unit} · send a PO in Toko Autopilot` }
            focus = sku?.productId
            break
          }
        }
        out.push({ key, label, ok: true, source: 'toko-autopilot', detail: { id: `Armada & gudang ${prof.name}`, en: `${prof.name} fleet & warehouse` }, ...(warn ? { warn } : {}), ...(focus ? { focus } : {}) })
        break
      }
      case 'pakta':
        out.push({ key, label, ok: true, source: 'tenderpilot', detail: { id: 'Ditandatangani saat mengirim penawaran (simulasi)', en: 'Signed when the bid is sent (simulated)' } })
        break
    }
  }
  return out
}

/** price advice: HPS, own cost, a range from the bid/HPS history, a suggested price (≥ cost + 5 %) and its margin */
export function priceAdvice(s: WorldState, tenderId: string, bizId: string): { hps: number; cost: number | null; range: [number, number]; suggested: number; margin: number | null; ratio: number; history: number[] } | null {
  const t = s.tenders.byId[tenderId]
  if (!t) return null
  const hps = t.hps ?? t.value
  const hist = rows(s.bids).filter((b) => b.businessId === bizId && b.hps).map((b) => b.price / b.hps!).sort((a, b) => a - b)
  const lo = hist[0] ?? 0.9
  const hi = hist[hist.length - 1] ?? 0.97
  const med = hist.length ? hist[Math.floor(hist.length / 2)]! : 0.93
  const cost = itemCost(s, t, bizId)
  const round = (v: number) => Math.round(v / 10_000) * 10_000
  const suggested = round(Math.max(hps * med, cost !== null ? cost * 1.05 : 0))
  return { hps, cost, range: [round(hps * lo), round(hps * hi)], suggested, margin: cost !== null ? Math.round(((suggested - cost) / suggested) * 1000) / 1000 : null, ratio: Math.round((suggested / hps) * 1000) / 1000, history: hist }
}

/** the business's bids with their tender, bid/HPS ratio; win rate and value won */
export function bidHistory(s: WorldState, bizId: string): { rows: (Bid & { tender: Tender | undefined; ratio: number | null })[]; winRate: number; valueWon: number } {
  const list = rows(s.bids).filter((b) => b.businessId === bizId).sort((a, b) => b.at - a.at).map((b) => ({ ...b, tender: s.tenders.byId[b.tenderId], ratio: b.hps ? Math.round((b.price / b.hps) * 1000) / 1000 : null }))
  const decided = list.filter((b) => b.status === 'menang' || b.status === 'kalah')
  const won = list.filter((b) => b.status === 'menang')
  return { rows: list, winRate: decided.length ? Math.round((won.length / decided.length) * 100) / 100 : 0, valueWon: won.reduce((a, b) => a + b.price, 0) }
}
