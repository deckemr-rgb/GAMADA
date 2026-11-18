/**
 * Usaha Pintar world self-tests (tahap 3): determinism of `extendUsahaPintar`, the seeded numbers that must agree,
 * texts, "alive within 10 s", chains C14–C29, and the store invariant (a flood on a world without the UP module loads
 * it first). Run by world.selftest.ts (`runUpSelftest`), on the mini fixture AND every real pack.
 */
import type { RegionPack } from '../../region/types'
import type { AnyFollowUp, EventSource, EventType, WorldEvent, WorldState } from '../types'
import { generateWorld } from '../seed'
import { createEvent, processEvents } from '../engine'
import { coreHandlers, processWith } from '../engine-core'
import { registerExtension } from '../ext'
import { CORE_EVENT_TYPES } from '../engine-scope'
import { naturalEventsAt } from '../natural-gen'
import { verifiedBusinesses } from '../selectors'
import { DAY_MIN, WORLD, isoDay, rows } from '../util'
import type { Seq } from '../ids'
import { UP_EXTENSION } from '../up/boot'
import { UP_CHAINS_EXTENSION } from '../up/chains'
import { UP_BOOT_REACTIONS } from '../up/reactions-boot'
import { extendUsahaPintar } from '../up/seed-up'
import { naturalUpAt } from '../up/natural-up'
import { UP_CHAIN_REACTIONS } from '../up/reactions-up'
import { generateCvs, CV } from '../../docs/samples/cv-data'
import { COMPANY_WORDS } from '../catalog'
import {
  CALL_CLIPS, EMERGENCY_TENDER, PPH_FINAL, activeBrandAlert, callScore, kybCase, kycRisk, mutasiRows, omzetByMonth, outletKpis, pendingNotas, pphFinalMonth, reputationScore,
  requirementsFor, trialBalance, vendorProfile, poSuggestions, demandForecast, floodBanner, teamBoard, tenderFeed, brandKpi, complaintClusters, cvShortlist, catalogPreview,
} from '../usaha-pintar'
import { terbilang } from '../../i18n/terbilang'
import { diffWords } from '../../docs/diff'

type Ok = (cond: unknown, msg: string) => void

export async function runUpSelftest(ok: Ok, section: (n: string) => void, packs: { label: string; pack: RegionPack }[]): Promise<void> {
  /* ---------------------------------------------------------------- 0. store invariant BEFORE anything registers */
  section('tahap-3 · store: a flood on a world without the UP module loads it first')
  {
    const real = packs[packs.length - 1]!.pack
    const store = await import('../store')
    await store.loadWorld(real, 2026)
    ok(!store.world.get().meta.ext?.['usaha-pintar'] && store.world.get().staff.ids.length === 0, 'a fresh world carries no UP data')
    await import('../eco')
    const fl = store.emit('flood.alert', { level: 3, kecamatanIds: real.scenario.floodKecamatanIds, riverId: null }, 'clock', { at: 426, origin: 'siaga-wilayah' })
    for (let i = 0; i < 40 && !store.world.get().alerts.byId[fl.payload.id ?? '']; i++) {
      await new Promise((r) => setTimeout(r, 10))
      await store.settled()
    }
    const sw = store.world.get()
    ok(sw.meta.ext?.['usaha-pintar'] === UP_EXTENSION.version && sw.staff.ids.length === 14, 'the UP module was loaded and applied before the flood')
    // the same world built directly: generate → extend → flood
    let d = extendUsahaPintar(generateWorld(real, 2026), real)
    const seq: Seq = { ...d.meta.seq }
    d = processEvents(d, seq, [createEvent(d, seq, 'flood.alert', { level: 3, kecamatanIds: real.scenario.floodKecamatanIds, riverId: null }, 'clock', 426) as WorldEvent]).state
    const keyset = (s: WorldState) => JSON.stringify({ t: rows(s.tenders).map((t) => `${t.key ?? t.title.id}|${JSON.stringify(t.matches)}`).sort(), a: rows(s.brandAlerts).map((a) => `${a.topic}|${a.at}|${a.mentionIds.length}`), b: s.brandMentions.ids.length, p: rows(s.purchaseOrders).filter((p) => p.status === 'draf').length, v: rows(s.verificationRequests).filter((r) => r.priority).map((r) => r.subjectId).sort() })
    ok(keyset(sw) === keyset(d), 'same UP rows (by key) as a world extended before the flood')
  }
  registerExtension(UP_EXTENSION)
  registerExtension(UP_CHAINS_EXTENSION)
  const UP_REACTIONS = [...UP_BOOT_REACTIONS, ...UP_CHAIN_REACTIONS]

  /* ---------------------------------------------------------------- rules of the module */
  section('tahap-3 · module rules')
  ok(UP_REACTIONS.every((r) => !CORE_EVENT_TYPES.has(r.on)), 'UP reactions never listen to a core event type')
  ok(UP_REACTIONS.length >= 15, `${UP_REACTIONS.length} UP reactions (C15–C29)`)
  ok(terbilang(37_750_000) === 'tiga puluh tujuh juta tujuh ratus lima puluh ribu' && terbilang(37_750_000, 'en') === 'thirty-seven million seven hundred fifty thousand', 'terbilang ID / EN')
  ok(terbilang(1_115_000) === 'satu juta seratus lima belas ribu' && terbilang(11) === 'sebelas', 'terbilang: seratus, belas, sebelas')
  ok(diffWords('a b c', 'a x c').map((p) => p.t).join(',') === 'same,del,add,same', 'TextDiff word diff')
  ok(PPH_FINAL.rate === 0.005 && PPH_FINAL.exemptOmzetOP === 500_000_000 && pphFinalMonth(100_000_000, 450_000_000) === 250_000 && pphFinalMonth(100_000_000, 600_000_000) === 500_000, 'PPh Final rule: exempt first Rp 500 jt, 0,5 % after')
  ok(kycRisk({ tampered: false, fieldMismatches: 1, livenessFail: false, addressKm: 0 }).score === 18 && kycRisk({ tampered: true, fieldMismatches: 1, livenessFail: false, addressKm: 0 }).score === 63, 'KYC risk: Joko 18 setujui, edited KTP 63 tinjau')

  for (const { label, pack } of packs) {
    section(`tahap-3 · Usaha Pintar world — ${label}`)
    const g = generateWorld(pack, 2026)
    const t0 = performance.now()
    const s = extendUsahaPintar(g, pack)
    const ms = performance.now() - t0
    const js = JSON.stringify(s)
    ok(js === JSON.stringify(extendUsahaPintar(generateWorld(pack, 2026), pack)), `generate + extend twice ⇒ identical (${ms.toFixed(0)} ms, +${((js.length - JSON.stringify(g).length) / 1024).toFixed(0)} KB)`)
    ok(JSON.stringify(g.citizens) === JSON.stringify(s.citizens) && JSON.stringify(g.complaints) === JSON.stringify(s.complaints) && JSON.stringify(g.prices) === JSON.stringify(s.prices), 'Satu Daerah tables untouched by the extension')
    const up = s.meta.facts.up!
    const shopId = s.meta.shopId
    const shop = s.businesses.byId[shopId]!
    ok(shop.legal === 'perorangan' && shop.verified && !shop.taxTidy, 'shop: perorangan, verified, tax not tidy yet')
    ok(s.staff.ids.length === 14 && up.payrollStaffIds.length === 5 && s.staff.byId[up.newCashierStaffId]?.isNew && s.staff.byId[up.newCashierStaffId]?.joinedDays === 9, '14 staff, 5 on the toko payroll, one new cashier (9 days)')
    ok(s.agentsSales.byId[up.newCashierAgentId]?.staffId === up.newCashierStaffId && s.agentsSales.byId[up.newCashierAgentId]?.name === s.staff.byId[up.newCashierStaffId]?.name, 'new cashier = the same person in Juara Jualan')
    ok(s.agentsSales.ids.length === 9 && rows(s.agentsSales).some((a) => a.name === 'Rina Wulandari' && a.industry === 'multifinance'), '9 agents incl. Rina Wulandari (multifinance)')
    ok(rows(s.calls).every((c) => c.score === null || (c.criteria && c.score === callScore(c.criteria))), 'every scored call: score = callScore(criteria)')
    ok(rows(s.calls).every((c) => CALL_CLIPS.some((k) => k.key === c.transcript)), 'every call transcript is a CALL_CLIPS key')
    const newest = rows(s.calls).sort((a, b) => b.at - a.at).slice(0, 10)
    ok(new Set(newest.map((c) => c.transcript)).size === newest.length, '10 newest calls: pairwise different clips')
    for (const ind of ['toko-bangunan', 'multifinance', 'asuransi'] as const) {
      const c = s.calls.byId[up.lowCall[ind]]
      ok(c && c.at >= 0 && c.flags.includes('keberatan-tidak-dijawab'), `lowCall[${ind}] = a call today with keberatan-tidak-dijawab`)
    }
    ok(s.calls.byId[up.lowCall.multifinance]?.transcript === 'mf-tel-keberatan' && s.agentsSales.byId[s.calls.byId[up.lowCall.multifinance]!.agentId]?.name === 'Rina Wulandari', 'mf lowCall = SALES_CALL (Rina)')
    const live = rows(s.calls).filter((c) => c.at === WORLD.clockStart - 3)
    ok(live.length === 3 && live.every((c) => c.score === null && c.durationSec >= 240 && c.durationSec <= 360), '1 live call per industry started 06:57 (4–6 min)')
    ok(s.coachings.ids.length === 3 && rows(s.coachings).every((c) => c.agentId !== up.newCashierAgentId && c.examples.length === 3 && c.focus.length === 3), '3 coachings (3 focus + 3 examples), none for the new cashier')
    const cvs = generateCvs(CV.count, s.seed, s.region.kecamatan.map((k) => ({ id: k.id, name: k.name })))
    ok(s.candidates.ids.length === 200 && cvs.every((cv) => s.candidates.byId[cv.id]?.name === cv.name), '200 candidates = generateCvs')
    const open = rows(s.verificationRequests).filter((r) => r.status !== 'selesai')
    ok(open.length === 8 && open.filter((r) => r.kind === 'kyc').length === 2 && open.filter((r) => r.kind === 'kyb').length === 5 && open.filter((r) => r.kind === 'cv').length === 1, '8 open requests: KYC 2, KYB 5, CV 1')
    const closedKyb = rows(s.verificationRequests).filter((r) => r.status === 'selesai' && r.kind === 'kyb')
    ok(verifiedBusinesses(s).length === closedKyb.length, `verified businesses = closed KYB requests (${closedKyb.length})`)
    ok(!rows(s.verificationRequests).some((r) => r.subjectId === up.kenalMitra.kycCleanDocId), "Joko's KYC request is not seeded (07:01)")
    const hero = s.businesses.byId[up.kenalMitra.heroBusinessId]!
    ok(hero.name.startsWith('CV ') && hero.name.endsWith(' Jaya Abadi') && hero.ownerName === 'Joko Prasetyo' && !hero.verified, `hero ${hero.name} (Joko Prasetyo, unverified)`)
    const hc = kybCase(s, hero.id)
    const mc = kybCase(s, up.kenalMitra.mismatchBusinessId)
    ok(hc?.score === 91 && hc.result === 'lolos' && hc.distanceKm === 0.2, `hero KYB 91 lolos at 0,2 km (${hc?.score}, ${hc?.distanceKm})`)
    ok(mc?.result === 'cek-manual' && mc.distanceKm > 5 && (!label.includes('bojonegoro') || (mc.distanceKm > 7 && mc.distanceKm < 11)), `mismatch KYB cek-manual, GPS ≈ 9 km away (${mc?.distanceKm} km, ${mc?.score})`)
    const names = [...rows(s.businesses).map((b) => b.name), ...rows(s.suppliers).map((x) => x.name), ...rows(s.bidders).map((x) => x.name)]
    const rep = names.filter((n) => {
      const w = n.split(' ').filter((x) => COMPANY_WORDS.includes(x) || x.length > 3).map((x) => x.toLowerCase())
      return new Set(w).size !== w.length
    })
    ok(rep.length === 0, `no company name repeats a word (${rep.slice(0, 2).join(' / ')})`)
    ok(s.bidders.byId[up.shopBidderId]?.legal === 'UD' && !s.bidders.byId[up.shopBidderId]?.ring, 'shop Bidder mirror (UD, no ring)')
    const prof = vendorProfile(s, shopId)!
    ok(/^\d{13}$/.test(prof.nib) && /^\d{4} •••• •••• \d{4}$/.test(prof.npwp) && prof.akta === null && prof.kyb !== null && prof.staffCount === 14, 'vendorProfile: NIB specimen, masked NPWP, no akta, KYB date, 14 staff')

    // books
    const day = s.day
    const nov = day.slice(0, 7)
    const om = omzetByMonth(s, shopId)
    let nSum = 0
    for (const d of rows(s.salesDaily)) if (isoDay(day, d.day).startsWith(nov) && s.outlets.byId[d.outletId]?.businessId === shopId) nSum += d.revenue
    ok(om[nov] === nSum && outletKpis(s, WORLD.clockStart).month === nSum, `omzetByMonth Nov = Σ salesDaily + today = outletKpis month (${nSum})`)
    ok(rows(s.ledger).every((j) => j.lines.reduce((a, l) => a + l.debit - l.credit, 0) === 0), 'every journal entry balances')
    for (const m of [-2, -1, 0]) {
      const p = isoDay(day, 0).slice(0, 7)
      const period = m === 0 ? p : new Date(Date.UTC(Number(p.slice(0, 4)), Number(p.slice(5, 7)) - 1 + m, 1)).toISOString().slice(0, 7)
      ok(trialBalance(s, shopId, period).balanced, `trial balance ${period} balanced`)
    }
    const wages = rows(s.staff).reduce((a, x) => a + x.gross, 0)
    ok(rows(s.ledger).filter((j) => j.memo.id === 'Gaji karyawan').every((j) => j.lines.some((l) => l.account === 'Beban Gaji' && l.debit === wages)), `Beban Gaji = Σ staff gross (${wages})`)
    ok(rows(s.ledger).some((j) => j.memo.id === 'Saldo awal'), 'opening balance entry')
    const todaySales = rows(s.sales).filter((x) => x.at >= 0 && x.businessId === shopId)
    ok(todaySales.every((x) => rows(s.ledger).some((j) => j.refId === x.id)), `today's pre-07:00 sales journaled (${todaySales.length})`)
    const mut = mutasiRows(s, shopId, nov)
    const reviewRows = rows(s.ledger).filter((j) => j.needsReview)
    ok(mut.length === 40 && mut.filter((r) => r.status === 'tinjau').length === 3 && reviewRows.every((j) => mut.some((r) => r.ledgerId === j.id && r.desc === j.memo.id.toUpperCase())), 'mutasi: 40 rows, the 3 review rows = the 3 journal review rows')
    ok(mut.every((r) => r.date >= `${nov}-01` && r.date <= `${nov}-16`), 'mutasi: 1–16 of the month')
    ok(mut.filter((r) => r.lines).every((r) => r.lines!.reduce((a, l) => a + l.debit - l.credit, 0) === 0), 'mutasi: every proposed journal balances')
    const tax = rows(s.taxItems).filter((t) => t.kind === 'pph-final-umkm')
    const year = day.slice(0, 4)
    const okTax = tax.filter((t) => t.status === 'dibayar').every((t) => {
      let before = 0
      for (const [m, v] of Object.entries(om)) if (m.startsWith(year) && m < t.period) before += v
      return t.amount === pphFinalMonth(om[t.period] ?? 0, before)
    })
    ok(tax.filter((t) => t.status === 'dibayar').length === 3 && okTax && tax.some((t) => t.period === nov && t.status === 'perlu-hitung'), 'PPh Final Aug–Oct paid = PPH_FINAL on cumulative omzet; Nov to compute')
    const low = rows(s.stock).filter((st) => st.onHand <= st.reorderPoint * st.factor).length
    ok(low >= 15 && low <= 25, `15–25 SKUs below the reorder point at 07:00 (${low})`)
    ok(rows(s.products).filter((p) => p.tags.some((t) => t.startsWith('cm:'))).length >= 4, 'market ingredients tagged cm:<commodity>')
    ok(pendingNotas(s, shopId).length > 0, 'pendingNotas has a nota to process')
    const replies = rows(s.purchaseOrders).filter((p) => p.reply).map((p) => p.reply!.tpl)
    ok(new Set(replies).size === replies.length, 'seeded supplier replies: no template twice')

    // brand
    const shopMentions = rows(s.brandMentions).filter((m) => m.brand === shopId)
    ok(s.brandMentions.ids.length >= 180 && s.brandMentions.ids.length <= 200, `≈ 190 mentions (${s.brandMentions.ids.length})`)
    ok(shopMentions.filter((m) => m.at > WORLD.clockStart - DAY_MIN && m.at < WORLD.clockStart).length >= 24, '≥ 24 shop mentions in the last 24 h')
    ok(up.brand.preSignalIds.length === 2 && up.brand.preSignalIds.map((id) => s.brandMentions.byId[id]?.at).join(',') === `${6 * 60 + 10},${6 * 60 + 40}`, 'pre-signal: 2 overnight delivery complaints (06:10, 06:40)')
    const byDay = new Map<number, string[]>()
    for (const m of rows(s.brandMentions)) byDay.set(Math.floor(m.at / DAY_MIN), [...(byDay.get(Math.floor(m.at / DAY_MIN)) ?? []), m.text.id])
    ok([...byDay.values()].every((l) => new Set(l).size === l.length), 'no brand sentence twice in a day')
    ok(brandKpi(s, WORLD.clockStart).reputation === up.brand.reputationAt0700, `reputation at 07:00 = facts (${up.brand.reputationAt0700})`)

    // tenders
    const openT = rows(s.tenders).filter((t) => t.status === 'dibuka')
    ok(s.tenders.ids.length === 16 && openT.filter((t) => t.matches[shopId] !== undefined).length >= 4 && openT.filter((t) => t.kbli !== EMERGENCY_TENDER.kbli).length >= 2, '16 tenders: ≥ 4 open matched, ≥ 2 outside KBLI')
    const bids = rows(s.bids).filter((b) => b.businessId === shopId)
    const st = (x: string) => bids.filter((b) => b.status === x).length
    ok(bids.length === 8 && st('menang') === 4 && st('kalah') === 3 && st('evaluasi') === 1 && bids.every((b) => b.hps && b.price / b.hps >= 0.89 && b.price / b.hps <= 0.97), 'shop bid history: 8 bids (4/3/1), bid/HPS 0.89–0.97')

    // alive within 10 s: 07:01–07:03 give an event in each of the 6 UP domains
    {
      let w = s
      const seq: Seq = { ...w.meta.seq }
      const types = new Set<string>()
      for (let m = WORLD.clockStart + 1; m <= WORLD.clockStart + 3; m++) {
        const outs: AnyFollowUp[] = [...naturalEventsAt(w, m), ...naturalUpAt(w, m)]
        const r = processEvents(w, seq, outs.map((o) => { const e = createEvent(w, seq, o.type, o.payload as never, o.source, m); if (o.origin) e.origin = o.origin; return e as WorldEvent }))
        w = r.state
        for (const e of r.processed) types.add(e.type)
      }
      for (const t of ['sale.created', 'ledger.posted', 'call.created', 'verification.requested', 'brand.mentioned', 'tender.created', 'tender.matched'])
        ok(types.has(t), `alive: ${t} within 07:01–07:03`)
      // the UP natural events of 07:01 run in the small core pipeline (no engine.ts download at boot), identically
      const outs = [...naturalEventsAt(s, WORLD.clockStart + 1), ...naturalUpAt(s, WORLD.clockStart + 1)]
      const mk = (q: Seq) => outs.map((o) => createEvent(s, q, o.type, o.payload as never, o.source, WORLD.clockStart + 1) as WorldEvent)
      const qa: Seq = { ...s.meta.seq }
      const qb: Seq = { ...s.meta.seq }
      const ra = processWith(coreHandlers(), s, qa, mk(qa))
      const rb = processEvents(s, qb, mk(qb))
      ok(ra.rest.length === 0 && JSON.stringify(ra.state) === JSON.stringify(rb.state), `07:01 UP natural events: core pipeline only, identical to the full one (${ra.processed.length} events)`)
      const nt = rows(w.tenders).find((t) => t.key === 'material-saluran-0701')
      ok(nt && nt.matches[shopId]! >= 0.55 && nt.matches[shopId]! <= 0.72, `07:01 tender matched ≈ 64 % (${nt?.matches[shopId]})`)
    }

    /* ---------------------------------------------------------------- chains C14–C29 */
    section(`tahap-3 · Usaha Pintar chains C14–C29 — ${label}`)
    let w = s
    const seq: Seq = { ...w.meta.seq }
    const run = (type: EventType, payload: unknown, source: EventSource, at: number) => {
      const r = processEvents(w, seq, [createEvent(w, seq, type, payload as never, source, at) as WorldEvent], (err, e) => ok(false, `${e.type} failed: ${String(err)}`))
      w = r.state
      for (const e of r.processed) {
        const a = rows(w.auditLog).find((x) => x.eventId === e.id)
        if (!a || !a.summary.id || !a.summary.en) ok(false, `audit text ID/EN for ${e.type}`)
      }
      ok(r.dropped === 0, `${type}: no follow-up dropped`)
      return r.processed
    }
    // C14
    const toko = rows(w.outlets).find((o) => o.businessId === shopId && o.kind === 'toko')!
    const sku = rows(w.products).find((p) => p.outletId === toko.id && (w.stock.byId[p.id]?.onHand ?? 0) > 5)!
    let p = run('sale.created', { outletId: toko.id, items: [{ productId: sku.id, qty: 2, price: sku.price }], payment: 'qris', payments: [{ method: 'tunai', amount: sku.price }, { method: 'qris', amount: sku.price }] }, 'toko-autopilot', 430)
    ok(p.some((e) => e.type === 'ledger.posted' && e.source === 'pajak-beres'), 'C14 sale → ledger.posted (pajak-beres)')
    const split = rows(w.ledger).find((j) => j.refId === (p[0]!.payload as { id: string }).id)
    ok(split && split.lines.some((l) => l.account === 'Kas' && l.debit === sku.price) && split.lines.some((l) => l.account === 'Bank' && l.debit === sku.price), 'split payment: Kas + Bank lines')
    // C20 price anomaly → cm: SKUs
    const cm = rows(w.products).find((x) => x.tags.some((t) => t.startsWith('cm:')))
    if (cm) {
      const cid = cm.tags.find((t) => t.startsWith('cm:'))!.slice(3)
      const mk = rows(w.prices).find((x) => x.commodityId === cid)!
      p = run('price.anomaly', { marketId: mk.marketId, commodityId: cid, price: Math.round(mk.price * 1.4), expected: mk.price, deltaPct: 40 }, 'sinyal-pasar', 440)
      const fc = p.find((e) => e.type === 'stock.forecastChanged' && e.source === 'toko-autopilot')
      ok(fc && (fc.payload as { factor: number }).factor === 1.6 && w.stock.byId[cm.id]!.factor === 1.6, 'C20 price.anomaly → stock.forecastChanged ×1.6 on cm: SKUs')
    }
    // flood: C5 / C15 / C21–C24 / C26 / C28
    const floodAt = 7 * 60 + 6
    p = run('flood.alert', { level: 3, kecamatanIds: pack.scenario.floodKecamatanIds, riverId: null }, 'siaga-wilayah', floodAt)
    const has = (t: string, src?: string) => p.some((e) => e.type === t && (!src || e.source === src))
    ok(has('stock.forecastChanged') && has('po.drafted', 'toko-autopilot'), 'C15 forecast → po.drafted')
    ok(has('tender.created', 'tenderpilot') && has('tender.matched', 'tenderpilot') && has('procurement.created', 'awas-belanja'), 'C21–C23 need → tender → matched + Awas Belanja package')
    const et = rows(w.tenders).find((t) => t.key === EMERGENCY_TENDER.key)!
    const q = Object.fromEntries((et.items ?? []).map((i) => [i.category, i.qty]))
    ok(et && et.hps === (q['karung-pasir'] ?? 0) * 15_500 + (q.terpal ?? 0) * 135_000, `emergency HPS = Σ qty × unit HPS (${et?.hps})`)
    if (label.includes('bojonegoro')) ok(et.hps === 37_750_000 && et.matches[shopId] === 0.78, `Bojonegoro: HPS Rp 37.750.000 and chance 0,78 (${et.hps}, ${et.matches[shopId]})`)
    else ok(et.matches[shopId]! >= 0.7 && et.matches[shopId]! <= 0.85, `emergency chance 0,70–0,85 (${et.matches[shopId]})`)
    const shopPrices = rows(w.products).filter((x) => x.businessId === shopId && (x.name.startsWith('Karung pasir siap pakai') || x.name.startsWith('Terpal plastik 4x6')))
    ok(shopPrices.length === 2 && shopPrices.every((x) => x.price < (x.category === 'terpal' ? 135_000 : 15_500)), 'emergency unit HPS above the shop price of karung / terpal')
    const pump = rows(w.tenders).find((t) => t.key === 'pompa-darurat')
    ok(pump && pump.procurementId && pump.matches[shopId]! < 0.3, `C24 pump mirror, low chance (${pump?.matches[shopId]})`)
    const pri = rows(w.verificationRequests).filter((r) => r.priority && r.status !== 'selesai')
    ok(pri.length >= 1 && pri.length <= 2 && pri.some((r) => r.subjectId === up.kenalMitra.heroBusinessId), 'C26 need → priority KYB request(s), hero first')
    const alert = rows(w.brandAlerts)[0]
    ok(alert && alert.at === floodAt + 6 && has('brand.alert', 'pantau-merek'), 'C28 brand.alert stored at flood + 6 min')
    ok(activeBrandAlert(w, floodAt + 5) === null && activeBrandAlert(w, floodAt + 6)?.id === alert?.id, 'activeBrandAlert follows at ≤ now')
    ok(rows(w.brandMentions).filter((m) => m.cause === alert?.causeRef && m.brand === shopId && m.topic === 'pengiriman').length >= 8, 'C28 ≥ 8 delivery complaints scheduled')
    ok(complaintClusters(w, floodAt + 30, alert!.id).length >= 2, 'complaint clusters after the burst')
    ok(floodBanner(w)?.pct === 340, 'flood banner: +340 % (factor 4.4)')
    const sandbag = rows(w.products).find((x) => x.businessId === shopId && x.tags.includes('sandbag'))!
    ok(demandForecast(w, sandbag.id, floodAt)?.factors.some((f) => f.key === 'banjir' && f.pct === 340), 'forecast factor banjir +340 %')
    ok(reputationScore(w, floodAt + 30).score < reputationScore(w, floodAt - 1).score, 'reputation drops during the burst')
    // second flood the same day: nothing doubled
    p = run('flood.alert', { level: 4, kecamatanIds: pack.scenario.floodKecamatanIds, riverId: null }, 'siaga-wilayah', floodAt + 40)
    ok(!has('brand.alert') && !has('tender.created'), 'a second flood the same day: no second burst / tender')
    // C16–C18
    const draft = poSuggestions(w, floodAt + 41).find((x) => x.poId)!
    p = run('po.sent', { id: draft.poId!, code: draft.code!, businessId: shopId, supplierId: draft.supplierId, items: draft.items.map((i) => ({ productId: i.productId, qty: i.qty, cost: i.cost })) }, 'toko-autopilot', floodAt + 41)
    ok(has('supplier.replied', 'toko-autopilot') && has('call.created', 'juara-jualan') && has('nota.received', 'pajak-beres'), 'C16–C18 po.sent → supplier reply + WA chat + nota')
    const chat = rows(w.calls).find((c) => c.refId === draft.poId)
    ok(chat?.transcript === 'tb-wa-prapesan' && chat.agentId === up.newCashierAgentId && chat.topic === 'banjir', 'C17 WA pre-order chat by the new cashier (banjir)')
    const floodPo = draft.items.some((i) => w.products.byId[i.productId]?.tags.includes('flood'))
    ok(!floodPo || w.purchaseOrders.byId[draft.poId!]!.reply?.eta === DAY_MIN + 7 * 60, 'flood goods: supplier ETA tomorrow 07.00')
    p = run('supplier.replied', { poId: draft.poId!, message: { id: 'Siap kirim besok pagi', en: 'Ships tomorrow morning' } }, 'toko-autopilot', floodAt + 45)
    ok(!has('nota.received'), 'C18 once per PO')
    const pn = pendingNotas(w, shopId)[0]
    ok(pn?.po.id === draft.poId, 'pendingNotas[0] = the replied PO')
    // supplier replies never repeat within 20 POs
    const prod = rows(w.products).find((x) => x.businessId === shopId && x.supplierId && w.suppliers.byId[x.supplierId])!
    const sup = w.suppliers.byId[prod.supplierId!]!
    for (let i = 0; i < 20; i++) run('po.sent', { businessId: shopId, supplierId: sup.id, items: [{ productId: prod.id, qty: 10, cost: prod.cost }] }, 'toko-autopilot', floodAt + 50 + i)
    const last20 = rows(w.purchaseOrders).filter((x) => x.reply?.tpl != null).sort((a, b) => b.reply!.at - a.reply!.at || b.id.localeCompare(a.id)).slice(0, 20).map((x) => x.reply!.tpl)
    ok(new Set(last20).size === 20, 'supplier replies: no template twice within 20 POs')
    // C19
    const rv = rows(w.ledger).find((j) => j.needsReview)!
    p = run('ledger.reviewed', { ledgerId: rv.id }, 'pajak-beres', floodAt + 80)
    ok(has('score.updated', 'rapor-usaha') && !w.ledger.byId[rv.id]!.needsReview, 'C19 ledger.reviewed → score.updated')
    // C25
    p = run('bid.submitted', { tenderId: et.id, businessId: shopId, price: 35_900_000, pages: 34, docSections: ['surat'] }, 'tenderpilot', floodAt + 90)
    const pk = rows(w.procurements).find((x) => x.key === EMERGENCY_TENDER.key)!
    ok(has('procurement.bidReceived', 'awas-belanja') && pk.bids?.some((b) => b.bidderId === up.shopBidderId && b.price === 35_900_000) && pk.bidderIds.includes(up.shopBidderId), 'C25 bid → Awas Belanja package bid row (same price)')
    // L1 tax.ready flips the checklist
    ok(requirementsFor(w, et.id, shopId).find((r) => r.key === 'pajak')?.ok === false && !requirementsFor(w, et.id, shopId).some((r) => r.key === 'akta'), 'checklist: pajak missing, no akta for perorangan')
    run('tax.ready', { businessId: shopId, period: nov }, 'pajak-beres', floodAt + 95)
    ok(requirementsFor(w, et.id, shopId).find((r) => r.key === 'pajak')?.ok === true, 'L1 tax.ready → pajak ✓')
    // C27
    const heroId = up.kenalMitra.heroBusinessId
    p = run('partner.verified', { subjectKind: 'business', subjectId: heroId, kind: 'kyb', result: 'lolos', score: 91 }, 'kenal-mitra', floodAt + 100)
    ok(has('match.made', 'katalog-lokal') && w.businesses.byId[heroId]!.verified && w.verificationRequests.byId[up.kenalMitra.heroRequestId]!.status === 'selesai', 'C27 hero lolos → match.made + request closed + badge')
    ok(catalogPreview(w).suppliers.findIndex((c) => c.business.id === heroId) < catalogPreview(s).suppliers.findIndex((c) => c.business.id === heroId), 'catalog preview: the hero moves up after KYB')
    // C29
    const five = rows(w.brandMentions).filter((m) => m.cause === alert!.causeRef && m.brand === shopId && m.at <= floodAt + 30 && m.topic === 'pengiriman').slice(0, 5)
    p = run('brand.replied', { mentionIds: five.map((m) => m.id), tone: 'empatik', replies: five.map((m) => ({ id: `Maaf ${m.orderCode}`, en: `Sorry ${m.orderCode}` })), by: 'brand-manager', alertId: alert!.id }, 'pantau-merek', floodAt + 30)
    ok(p.filter((e) => e.type === 'brand.mentioned').length === 3 && five.every((m) => w.brandMentions.byId[m.id]!.repliedAt === floodAt + 30), 'C29 replies → 2 follow-ups + 1 category post; replies attached')
    const future = rows(w.brandMentions).filter((m) => m.cause === alert!.causeRef && m.at > floodAt + 35 && m.brand === shopId && m.sentiment === 'negatif').length
    p = run('brand.announced', { businessId: shopId, alertId: alert!.id, topic: 'pengiriman', text: { id: 'Pengiriman tertunda 1–2 hari karena banjir', en: 'Deliveries delayed 1–2 days by the flood' }, channels: ['marketplace', 'struk'], offer: 'ambil-sendiri', by: 'brand-manager' }, 'pantau-merek', floodAt + 35)
    ok(future > 0 && rows(w.brandMentions).filter((m) => m.cause === alert!.causeRef && m.at > floodAt + 35 && m.brand === shopId && m.sentiment === 'negatif').length === 0, `announcement withdraws the scheduled burst posts (${future})`)
    ok(has('pos.noticeSet', 'toko-autopilot') && p.filter((e) => e.type === 'brand.mentioned').length === 3 && w.brandAlerts.byId[alert!.id]!.status === 'ditangani', 'C29 announcement → 3 recovery posts + Kasir notice; alert handled')
    // juara jualan board: avg14 is a callScore average
    const board = teamBoard(w, floodAt, 'toko-bangunan')
    ok(board.length === 3 && board.every((b) => b.rank > 0), 'team board ranks the tb team')
    ok(tenderFeed(w, floodAt + 100).rows.some((r) => r.tender.id === et.id && r.probability === 0.78) || !label.includes('bojonegoro'), 'tender feed shows the emergency tender with its chance')
    const sl = cvShortlist(cvs, { education: 'D3', minYears: 1 }, false)
    const sb = cvShortlist(cvs, { education: 'D3', minYears: 1 }, true)
    ok(sl.top.length === 10 && JSON.stringify(sl.top.map((x) => x.cv.id)) === JSON.stringify(sb.top.map((x) => x.cv.id)), 'CV shortlist: 10, blind keeps the same ids in order')
  }
}
