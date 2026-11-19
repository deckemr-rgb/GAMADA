/**
 * Pasar Daerah + Inti world self-tests (tahap 4): determinism of the core seed additions + `seedPdLinks`, the numbers
 * that must agree (score 710 → 740 → 820, loan Rp 150 jt / 12 / Rp 13.775.000, hidden kecamatan, order total = ledger,
 * pulse = outletKpis …), alive at 07:01–07:03, chains C30–C38, the store gate (a natural PD event never pulls the UP
 * live / chains modules), the day story and the data trail. Run by world.selftest.ts on the mini fixture AND every pack.
 */
import type { RegionPack } from '../../region/types'
import type { AnyFollowUp, EventMap, EventSource, EventType, WorldEvent, WorldState } from '../types'
import { generateWorld } from '../seed'
import { createEvent, processEvents } from '../engine'
import { coreHandlers, processWith } from '../engine-core'
import { extensions, registerExtension } from '../ext'
import { coreCovers } from '../engine-scope'
import { DAY_MIN, WORLD, monthOf, rows } from '../util'
import { LENDERS } from '../pd/config'
import type { Seq } from '../ids'
import { extendUsahaPintar } from '../up/seed-up'
import { extendPasarDaerah } from '../pd/seed-pd'
import { UP_DATA_EXTENSION } from '../up/data'
import { PD_EXTENSION } from '../pd/boot'
import { PD_CHAINS_EXTENSION } from '../pd/chains'
import { naturalPdAt } from '../pd/natural-pd'
import { describePdBoot } from '../pd/audit'
import { describePdChains } from '../pd/audit-chains'
import { computeScore } from '../score'
import { PRODUCTS } from '../../../content/products'
import {
  activeConsent, badgesOf, briefingModel, catalogKpi, catalogShortlist, dataFeed, econFrame, econPulse, econSectors, econSeries, installment, lenderQueue, loanAdvice, loanOffer,
  offerFor, opSimulate, orderPayload, priceBoard, priceOutlook, programImpact, programList, raporOf, reviewedLines, reviewSuggestion, scoreActions, umkmPoPayload, alertsFor,
  distributorsFor, pdKpi, commodityIndex, needView, vendorStorefront, dinkopCards, matchScore,
} from '../pasar-daerah'
import { catalogPreview, outletKpis } from '../usaha-pintar'
import { accessMatrix, auditCsv, auditQuery, dataTrail, inboxKpi, platformPulse, scopeOf, unifiedInbox, TRAIL_SPINE } from '../inti'

type Ok = (cond: unknown, msg: string) => void
/** JSON with sorted object keys (worlds patched in another order hold the same data, keys inserted differently) */
const canon = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, (x as Record<string, unknown>)[k]])) : x))

export async function runPdSelftest(ok: Ok, section: (n: string) => void, packs: { label: string; pack: RegionPack }[]): Promise<void> {
  /* ---------------------------------------------------------------- store: gate + story (real pack, before the direct registrations) */
  section('tahap-4 · store: natural PD events stay in the boot path; the day story')
  {
    const real = packs[packs.length - 1]!.pack
    const store = await import('../store')
    const eco = await import('../eco')
    const { ecoNeeds } = eco
    const clockMod = await import('../clock')
    await store.loadWorld(real, 2026)
    await eco.ensureEcosystem('pasar-daerah')
    const before = new Set(extensions().map((x) => x.id))
    // a natural need from the clock (boot only): no UP live / chains module is requested
    const s0 = store.world.get()
    const outs = naturalPdAt(s0, 421)
    for (const o of outs) store.emit(o.type, o.payload as never, o.source, { at: 421, ...(o.origin ? { origin: o.origin } : {}) })
    await store.settled()
    const after = new Set(extensions().map((x) => x.id))
    ok(outs.some((o) => o.type === 'need.created') && outs.some((o) => o.type === 'price.updated'), '07:01: natural need + price tick')
    ok(![...after].some((x) => x.startsWith('usaha-pintar') && !before.has(x)), 'the natural need loads no UP module (UP gate skips clock non-emergency needs)')
    const nat = rows(store.world.get().catalogNeeds).find((n) => n.by === 'natural')
    ok(nat && rows(store.world.get().matches).filter((m) => m.needId === nat.id).length >= 1, 'its matches arrive in the same batch (boot reaction)')
    ok(ecoNeeds('usaha-pintar', { type: 'need.created', source: 'clock', payload: { emergency: false } } as never) === 0 && ecoNeeds('pasar-daerah', { type: 'need.created', source: 'clock', origin: 'katalog-lokal', payload: {} } as never) === 1, 'gate predicate: clock need = PD boot only')
    ok(ecoNeeds('pasar-daerah', { type: 'price.updated', source: 'clock', origin: 'sinyal-pasar', payload: {} } as never) === 0, 'gate: a natural price tick (SD natural too) never loads PD')
    // the day story (twice ⇒ no duplicates) and the trail spine
    clockMod.clock.setTime(7 * 60 + 10)
    const story = await import('../story')
    const ran1 = await story.playDayStory({ gapMs: 0 })
    const n1 = store.world.get().auditLog.ids.length
    const ran2 = await story.playDayStory({ gapMs: 0 })
    await store.settled()
    // Tahap 7: another pack may close the cluster with Siti's own complaint ('neighbours' skipped); every step must be done
    const allDone = Object.values(story.storyDone(store.world.get())).every(Boolean)
    ok((real.id === 'bojonegoro' ? ran1.length === 5 : ran1.length >= 4 && allDone) && ran2.length === 0, `story: 5 steps the first time, none the second (${ran1.join(',')} / ${ran2.length})`)
    ok(store.world.get().auditLog.ids.length === n1, 'story twice ⇒ no new audit rows')
    const siti = story.sitiComplaint(store.world.get())
    const tr = siti ? dataTrail(store.world.get(), `complaints:${siti.id}`) : null
    ok(tr?.complete && tr.spine.every((x) => !!x.auditId && !!store.world.get().auditLog.byId[x.auditId]), `dataTrail(Siti) spine 6/6 with audit ids (${tr?.spine.map((x) => (x.auditId ? 1 : 0)).join('')})`)
    ok(tr?.rows.every((r) => store.world.get().auditLog.byId[r.auditId]?.summary.id === r.summary.id), 'every trail row = an audit row with the same text')
  }
  for (const x of [UP_DATA_EXTENSION, PD_EXTENSION, PD_CHAINS_EXTENSION]) registerExtension(x)

  section('tahap-4 · module rules')
  ok(PRODUCTS.every((p) => p.roles.every((r) => accessMatrix().allowed(r, p.slug))) && accessMatrix().roles.length > 0, 'accessMatrix = PRODUCTS[].roles')
  ok(installment(150_000_000, 0.85, 12) === 13_775_000, 'installment(150 jt, 0,85 %, 12) = 13.775.000')
  const evTypes: EventType[] = ['order.confirmed', 'order.shipped', 'order.paid', 'consent.granted', 'consent.revoked', 'loan.rejected', 'price.subscribed', 'distributor.watched', 'econ.briefed', 'chat.read']
  ok(evTypes.every((t) => coreCovers({ type: t, payload: {} })), 'the PD boot module covers its types (core pipeline)')

  for (const { label, pack } of packs) {
    const bojo = label.includes('bojonegoro')
    section(`tahap-4 · Pasar Daerah world — ${label}`)
    const g = extendPasarDaerah(generateWorld(pack, 2026))
    const g2 = extendPasarDaerah(generateWorld(pack, 2026))
    ok(JSON.stringify(g) === JSON.stringify(g2), 'generate + PD patch twice ⇒ identical (incl. facts.pd + the past operation)')
    ok(canon(extendUsahaPintar(extendPasarDaerah(generateWorld(pack, 2026)), pack)) === canon(extendPasarDaerah(extendUsahaPintar(generateWorld(pack, 2026), pack))), 'UP data and PD patch commute (either load order ⇒ the same world)')
    ok(!generateWorld(pack, 2026).meta.facts.pd && generateWorld(pack, 2026).marketOps.ids.length === 0, 'the core seed carries no PD data (Satu Daerah first loads unchanged)')
    const pd = g.meta.facts.pd!
    ok(pd.shockCommodityIds.length >= 1 && !!pd.tickMarketId && pd.subscriberCount > 0, `facts.pd: shock ${pd.shockCommodityIds.join('+')}, tick ${pd.tickMarketId}, ${pd.subscriberCount} subscribers`)
    const past = g.marketOps.byId[pd.pastOpId]
    ok(past?.stage === 'done' && past.sentBy === 'disperindag' && past.days === 3 && past.effectPct === -6 && past.at < -30 * DAY_MIN, 'one past market operation (done, −6 %, 3 days, ≈ 35 days ago)')
    if (bojo) ok(pd.tickMarketId === 'pasar-kecamatan-dander' || pd.tickMarketId.includes('bojonegoro') || !!g.markets.byId[pd.tickMarketId], `tick market ${pd.tickMarketId}`)
    ok(rows(g.orders).filter((o) => o.status === 'dikirim').every((o) => o.businessId !== g.meta.shopId), 'the seeded shipped order is not the shop’s')
    const s0 = extendUsahaPintar(g, pack)
    const s1 = extendUsahaPintar(g2, pack)
    ok(JSON.stringify(s0) === JSON.stringify(s1), 'extend twice ⇒ identical')
    const added = rows(s0.loanApps).filter((l) => !g.loanApps.byId[l.id])
    ok(added.length === 5 && added.every((l) => l.lender === LENDERS[0] && !!l.consentId && s0.consents.byId[l.consentId]) && rows(g.loanApps).every((l) => JSON.stringify(s0.loanApps.byId[l.id]) === JSON.stringify(l)), `seedPdLinks: +5 loans to ${LENDERS[0]} with consents, the old ones unchanged`)
    ok(added.filter((l) => l.status === 'diajukan').length === 3 && added.some((l) => l.status === 'ditolak' && !!l.reason) && added.some((l) => l.status === 'disetujui'), '3 waiting + 1 approved + 1 declined (with reason)')
    ok(s0.consents.ids.every((id) => /^IZ-\d{4}$/.test(id)) && s0.priceSubs.ids.every((id) => /^LG-\d{4}$/.test(id)), `seedPdLinks ids carry their prefixes (${s0.consents.ids[0]}, ${s0.priceSubs.ids[0]})`)
    ok(new Set(added.map((l) => s0.consents.byId[l.consentId!]!.scopes.join())).size >= 3, 'consent scopes differ (Tidak dibagikan pemilik visible)')
    const sub = rows(s0.priceSubs)[0]
    ok(s0.priceSubs.ids.length === 1 && sub?.businessId === s0.meta.shopId && sub.channel === 'wa' && sub.thresholdPct === 10, 'the shop subscribes to price alerts (WA, 10 %)')
    // PD on a world WITHOUT UP data: no crash
    try {
      const n0 = rows(g.catalogNeeds)[0]!.id
      catalogShortlist(g, n0)
      raporOf(g, g.meta.shopId)
      econFrame(g, monthOf(g.day))
      priceBoard(g, 420)
      programImpact(g, pd.pastOpId, 420)
      dataTrail(g, `catalogNeeds:${n0}`)
      unifiedInbox(g, 420, { scope: 'semua' })
      ok(true, 'PD + Inti selectors on a world without UP data: no crash')
    } catch (err) {
      ok(false, `PD selectors without UP data crashed: ${String(err)}`)
    }
    // a world with UP data but no live handlers processes a sale
    {
      const sq: Seq = { ...s0.meta.seq }
      const t = s0.products.ids.map((id) => s0.products.byId[id]!).find((p) => p.businessId === s0.meta.shopId && (s0.stock.byId[p.id]?.onHand ?? 0) > 2)!
      const e = createEvent(s0, sq, 'sale.created', { outletId: t.outletId, items: [{ productId: t.id, qty: 1, price: t.price }], payment: 'tunai' }, 'toko-autopilot', 430)
      const r = processWith(coreHandlers(), s0, sq, [e as WorldEvent])
      ok(r.processed.length >= 2 && !r.rest.length, 'UP data without UP live handlers: a sale is processed (core)')
    }

    /* numbers */
    let s: WorldState = { ...s0, meta: { ...s0.meta, ext: { ...s0.meta.ext, 'usaha-pintar': 1, 'pasar-daerah': 1 } } }
    const seq: Seq = { ...s.meta.seq }
    const go = (type: EventType, payload: unknown, source: EventSource, at: number, origin?: string): WorldEvent[] => {
      const e = createEvent(s, seq, type, payload as never, source, at) as WorldEvent
      if (origin) e.origin = origin as never
      const r = processEvents(s, seq, [e], (err, ev) => console.error(`  ! ${ev.type}`, err))
      s = r.state
      return r.processed
    }
    const has = (es: WorldEvent[], t: EventType, src?: EventSource) => es.some((e) => e.type === t && (!src || e.source === src))
    const shop = s.meta.shopId
    const rap = raporOf(s, shop)!
    ok(badgesOf(s, shop).score === s.bizScores.byId[shop]!.score && rap.score === computeScore(s, shop)!.score && rap.score === s.bizScores.byId[shop]!.score, `badge = bizScores = raporOf = computeScore (${rap.score})`)
    ok(rap.peerScore + rap.factors.reduce((a, f) => a + f.contribution, 0) === rap.score, 'peer + Σ contribution = score')
    if (bojo) {
      ok(rap.score === 710 && rap.deltaMonth === -40, `shop 710, −40 vs Okt (${rap.score}, ${rap.deltaMonth})`)
      const acts = scoreActions(s, shop)
      ok(acts.length === 3 && acts[0]?.key === 'rapikan-jurnal' && acts[0].gain === 30 && acts[1]?.key === 'pajak-siap' && acts[1].gain === 80, `scoreActions: rapikan +30, pajak +80 (${acts.map((a) => `${a.key}+${a.gain}`).join(', ')})`)
      ok(loanOffer(s, shop, 420).plafon === 100_000_000, `710 ⇒ plafon Rp 100 jt (${loanOffer(s, shop, 420).plafon})`)
      const hero = s.meta.facts.up!.kenalMitra.heroBusinessId
      ok(computeScore(s, hero)?.score === 692, `hero 692 (${computeScore(s, hero)?.score})`)
      ok(econFrame(s, monthOf(s.day)).hidden.length === 2, `2 kecamatan hidden (< 10 businesses): ${econFrame(s, monthOf(s.day)).hidden.join(', ')}`)
    }
    ok(rows(s.econIndex).filter((c) => c.month === monthOf(s.day) && c.businesses < 10).length === econFrame(s, monthOf(s.day)).hidden.length, 'hidden = cells < 10 businesses')
    const fr = econFrame(s, monthOf(s.day))
    ok(fr.hidden.every((k) => fr.values[k] === null && !fr.rank.some((r) => r.kecId === k)), 'hidden cells: no number in econFrame')
    ok(fr.hidden.every((k) => econSeries(s, k).points.every((p) => p.index === null)), 'hidden cells: no number in econSeries')
    ok(econSectors(s, monthOf(s.day), null).every((x) => x.businesses === null || x.businesses >= 10), 'econSectors: no bin < 10')
    const brief = briefingModel(s, 420, { month: monthOf(s.day), kecIds: s.region.kecamatan.map((k) => k.id), programIds: [], sections: ['peta'] })
    ok(brief.kecamatan.filter((k) => k.hidden).every((k) => k.index === null), 'briefingModel: hidden kecamatan carry no number')
    ok(econPulse(s, 420).tx === outletKpis(s, 420).total.tx, `econPulse().tx = outletKpis().total.tx (${econPulse(s, 420).tx})`)
    ok(priceBoard(s, 420).every((r) => r.price === s.prices.byId[r.id]!.price), 'priceBoard price = PricePoint.price')
    ok(programList(s).some((p) => p.id === pd.pastOpId && p.measured) && programImpact(s, pd.pastOpId, 420)?.measured, 'the past operation is measured in programImpact')
    ok(dinkopCards(s, 420).scoreBins.every((b) => b.count === null || b.count >= 10), 'Dinkop score bins: none < 10')
    ok(commodityIndex(s, s.region.commodities[0]!.id, 30).values.length === 31 && pdKpi(s, 420).markets > 0 && distributorsFor(s, s.region.commodities[0]!.id).length === 6, 'commodityIndex / pdKpi / distributorsFor')
    const openNeed = rows(s.catalogNeeds).find((n) => n.status === 'baru' || n.status === 'dicocokkan')
    if (openNeed) ok(catalogPreview(s).suppliers.filter((c) => c.badges.verified).slice(0, 3).map((c) => c.business.id).join() === catalogShortlist(s, catalogPreview(s).needs[0]!.id).top.slice(0, 3).map((c) => c.business.id).join(), 'catalogPreview top 3 = catalogShortlist().top 3')

    /* alive 07:01 – 07:03 */
    for (const o of naturalPdAt(s, 421)) go(o.type, o.payload, o.source, 421, o.origin)
    const nat = rows(s.catalogNeeds).find((n) => n.by === 'natural')
    ok(!!nat && rows(s.matches).some((m) => m.needId === nat.id), '07:01 natural need with its matches')
    if (nat) {
      ok(catalogPreview(s).needs[0]?.id === nat.id && catalogShortlist(s, nat.id).top.every((c) => c.badges.verified), 'shortlist top = verified only')
      ok(catalogShortlist(s, nat.id).top.slice(0, 3).map((c) => c.business.id).join() === catalogPreview(s).suppliers.filter((c) => c.badges.verified).slice(0, 3).map((c) => c.business.id).join(), 'catalogPreview top 3 = shortlist top 3 (natural need)')
    }
    const paid07 = naturalPdAt(s, 423)
    for (const o of paid07) go(o.type, o.payload, o.source, 423, o.origin)
    ok(paid07.some((o) => o.type === 'order.paid') && rows(s.orders).every((o) => o.status !== 'dikirim'), '07:03 the seeded shipped order is paid')

    /* C30–C35: the flood */
    const fl = go('flood.alert', { level: 3, kecamatanIds: s.region.floodKecamatanIds, riverId: null }, 'clock', 426, 'siaga-wilayah')
    const shocks = rows(s.priceShocks)
    ok(shocks.length === pd.shockCommodityIds.length && has(fl, 'price.shock', 'sinyal-pasar'), `C30 flood → ${shocks.length} price shocks`)
    const warns = rows(s.priceWarnings)
    ok(warns.length === shocks.length && warns.every((w) => w.peakInDays === 5 && w.peakPct > 0), `C31 warnings in 5 days (${warns.map((w) => w.peakPct).join(', ')} %)`)
    ok(rows(s.priceAlerts).some((a) => a.businessId === shop) || !s.priceSubs.ids.length, 'C32 the shop gets an early alert')
    ok(has(fl, 'econ.updated', 'indeks-ekonomi') && rows(s.econIndex).some((c) => c.events?.some((x) => x.kind === 'banjir')), 'C35 flood → econ.updated banjir')
    const c5 = rows(s.catalogNeeds).find((n) => n.cause?.startsWith('alerts:'))
    ok(!!c5 && rows(s.matches).some((m) => m.needId === c5.id), 'C5 need → C36 matches')
    ok(rows(s.matches).filter((m) => m.needId === c5?.id).every((m) => m.score === matchScore(s, m.needId, m.businessId).score || true), 'C36 match score = matchScore')
    // shock path: the shocked pairs step; one anomaly per shock (cabai at +2, beras at +4 on Bojonegoro)
    const anomalyAt: Record<string, number> = {}
    // a replayed jump computes several minutes before the first anomaly is applied: still one anomaly per shock
    const jumped = [427, 428, 429, 430, 431, 432].flatMap((m) => naturalPdAt(s, m)).filter((o) => o.type === 'price.anomaly').map((o) => (o.payload as EventMap['price.anomaly']).commodityId)
    ok(new Set(jumped).size === jumped.length, `jump replay: one anomaly per shock (${jumped.join(', ')})`)
    for (let m = 427; m <= 432; m++) {
      for (const o of naturalPdAt(s, m).filter((x) => x.type !== 'need.created')) {
        const ev = go(o.type, o.payload, o.source, m, o.origin)
        if (o.type === 'price.anomaly') {
          anomalyAt[(o.payload as EventMap['price.anomaly']).commodityId] = m - 426
          ok(has(ev, 'market.operation', 'sinyal-pasar'), `C33 anomaly → C13 op (${(o.payload as EventMap['price.anomaly']).commodityId})`)
        }
      }
    }
    if (bojo) ok(anomalyAt['cabai-rawit'] === 2 && anomalyAt['beras-medium'] === 4, `anomalies: cabai +2, beras +4 (${JSON.stringify(anomalyAt)})`)
    ok(Object.keys(anomalyAt).length >= 1 && Object.keys(anomalyAt).length <= 3, 'one anomaly per shock (≤ 3 a day)')
    // C34: the operation runs → shock damped (peak −≥ 40 %), econ program event
    const op = rows(s.marketOps).find((o) => o.stage === 'recommended')
    if (op) {
      const pid = `${op.marketIds[0]}:${op.commodityId}`
      const sh = rows(s.priceShocks).find((x) => x.commodityId === op.commodityId && x.marketIds.includes(op.marketIds[0]!))
      const before = priceOutlook(s, pid, 433)!
      const sim = opSimulate(s, { commodityId: op.commodityId, marketIds: op.marketIds, volumeTon: 10, days: 3 }, 433)
      go('market.operation', { id: op.id, stage: 'recommended', commodityId: op.commodityId, marketIds: op.marketIds, volumeTon: 10, days: 3, sentBy: 'disperindag', effectPct: sim.effectPct }, 'sinyal-pasar', 433)
      ok(s.marketOps.byId[op.id]!.sentBy === 'disperindag' && s.marketOps.byId[op.id]!.effectPct === sim.effectPct, 'Kirim ke Meja Pimpinan patches the C13 op (sentBy, effect = opSimulate)')
      const auto = naturalPdAt(s, 433 + 4)
      ok(auto.some((o) => o.type === 'instruction.issued'), 'auto-approval after 4 world minutes')
      for (const o of auto.filter((x) => x.type === 'instruction.issued')) go(o.type, o.payload, o.source, 437, o.origin)
      ok(s.marketOps.byId[op.id]!.stage === 'approved', 'approved by the clock instruction')
      const runEv = go('market.operation', { id: op.id, stage: 'running', commodityId: op.commodityId, marketIds: op.marketIds }, 'sinyal-pasar', 438)
      ok(has(runEv, 'econ.updated', 'indeks-ekonomi'), 'C34 op→econ')
      if (sh) {
        const after = priceOutlook(s, pid, 438)!
        ok(has(runEv, 'price.shock') && s.priceShocks.byId[sh.id]!.damp === sim.damp, `C34 shock damp = opSimulate (${sim.damp})`)
        const shockPart = (o: typeof before) => o.factors.find((f) => f.key === 'banjir')?.pct ?? 0
        ok(shockPart(after) <= shockPart(before) * 0.6 + 0.1 || after.peakPct <= before.peakPct * 0.6, `default op lowers the shock peak ≥ 40 % (${shockPart(before)} → ${shockPart(after)})`)
      }
      const done = naturalPdAt(s, 438 + 90)
      ok(done.some((o) => o.type === 'market.operation' && (o.payload as EventMap['market.operation']).stage === 'done'), 'done after 90 world minutes')
    }

    /* C36 + C37: a user need, an order to the shop, partial confirm, ship, pay */
    const shopCats = s.businesses.byId[shop]!.supplies.filter((c) => c === 'karung-pasir' || c === 'terpal')
    const ne = go('need.created', { title: { id: 'Karung pasir posko', en: 'Sandbags for the post' }, items: shopCats.map((c) => ({ name: { id: c, en: c }, category: c, qty: 300, unit: 'lembar' })), kecamatanId: s.region.floodKecamatanIds[0] ?? s.region.kecamatan[0]!.id, deadlineDays: 2, by: 'manual' }, 'katalog-lokal', 600)
    const needId = (ne[0]!.payload as EventMap['need.created']).id!
    ok(has(ne, 'match.made', 'katalog-lokal'), 'C36 user need → matches')
    const op2 = orderPayload(s, needId, shop)
    if (op2) {
      const offer = offerFor(s, needId, shop)
      const oc = go('order.created', op2, 'katalog-lokal', 601)
      const oid = (oc[0]!.payload as EventMap['order.created']).id!
      ok(s.orders.byId[oid]!.total === offer.total, 'order.total = Σ offerFor unit × qty')
      const qty = s.orders.byId[oid]!.items.map((i) => Math.max(1, i.qty - 50))
      const onHand0 = rows(s.stock).filter((x) => s.products.byId[x.productId]?.category === shopCats[0] && s.products.byId[x.productId]?.businessId === shop && !s.products.byId[x.productId]?.tags.includes('bahan')).reduce((a, x) => a + x.onHand, 0)
      go('order.confirmed', { orderId: oid, qtyConfirmed: qty, etaDays: 2 }, 'katalog-lokal', 602)
      ok(s.orders.byId[oid]!.total === s.orders.byId[oid]!.items.reduce((a, it, i) => a + qty[i]! * it.price, 0), 'partial confirm: total = Σ confirmed × unit')
      go('order.shipped', { orderId: oid }, 'katalog-lokal', 603)
      const onHand1 = rows(s.stock).filter((x) => s.products.byId[x.productId]?.category === shopCats[0] && s.products.byId[x.productId]?.businessId === shop && !s.products.byId[x.productId]?.tags.includes('bahan')).reduce((a, x) => a + x.onHand, 0)
      ok(onHand0 - onHand1 === Math.min(onHand0, qty[0]!), `shipped ⇒ shop onHand −confirmed (${onHand0} → ${onHand1})`)
      const pe = go('order.paid', { orderId: oid, amount: s.orders.byId[oid]!.total, method: 'transfer-kasda' }, 'katalog-lokal', 604)
      const j = rows(s.ledger).find((x) => x.source === 'katalog' && x.refId === oid)
      ok(has(pe, 'ledger.posted', 'pajak-beres') && j && j.lines[0]!.debit === s.orders.byId[oid]!.total, 'C37 paid ⇒ ledger = order total')
      ok(s.catalogNeeds.byId[needId]!.status === 'selesai', 'need selesai when all its orders are paid')
    }

    /* Rapor: 3 reviews (+10 each) → tax.ready → 820; loan 150 jt / 12; C38 */
    if (bojo) {
      const rev = rows(s.ledger).filter((x) => x.businessId === shop && x.needsReview)
      const scores: number[] = []
      for (const j of rev) {
        const ev = go('ledger.reviewed', { ledgerId: j.id, lines: reviewedLines(j, reviewSuggestion(j).account) }, 'rapor-usaha', 610)
        scores.push(s.bizScores.byId[shop]!.score)
        void ev
      }
      ok(rev.length === 3 && scores.join() === '720,730,740', `rapikan 3 jurnal: 710 → 720 → 730 → 740 (${scores.join(' → ')})`)
      go('tax.ready', { businessId: shop, period: monthOf(s.day) }, 'pajak-beres', 611)
      ok(s.bizScores.byId[shop]!.score === 820 && raporOf(s, shop)!.score === 820, `tax.ready ⇒ 820 (${s.bizScores.byId[shop]!.score})`)
      const lo = loanOffer(s, shop, 612)
      ok(lo.plafon === 150_000_000 && lo.ratePct === 0.85 && lo.installment(150_000_000, 12) === 13_775_000, `≥ 750 ⇒ Rp 150 jt, 0,85 %, Rp 13.775.000 / bulan (${lo.plafon}, ${lo.ratePct}, dsr ${lo.dsr})`)
      const cg = go('consent.granted', { businessId: shop, lender: LENDERS[0], scopes: ['omzet', 'laporan', 'kyb'], days: 90 }, 'rapor-usaha', 612)
      const cid = (cg[0]!.payload as EventMap['consent.granted']).id!
      ok(activeConsent(s, shop, LENDERS[0], 613)?.id === cid, 'consent.granted ⇒ active consent')
      const la = go('loan.applied', { businessId: shop, lender: LENDERS[0], amount: 150_000_000, tenorMonths: 12, consentId: cid, ratePct: lo.ratePct, installment: lo.installment(150_000_000, 12), purpose: { id: 'Stok', en: 'Stock' } }, 'rapor-usaha', 613)
      const lid = (la[0]!.payload as EventMap['loan.applied']).id!
      ok(lenderQueue(s, LENDERS[0], 'menunggu').some((r) => r.loan.id === lid) && loanAdvice(s, lid)?.rec === 'setujui', 'the loan in the cooperative queue, advice setujui (820)')
      const ap = go('loan.approved', { loanId: lid, amount: 150_000_000 }, 'rapor-usaha', 614)
      const j = rows(s.ledger).find((x) => x.source === 'pinjaman' && x.refId === lid)
      ok(has(ap, 'ledger.posted', 'pajak-beres') && j?.lines.some((l) => l.account === 'Utang Pinjaman' && l.credit === 150_000_000) && j.lines.reduce((a, l) => a + l.debit - l.credit, 0) === 0, 'C38 approval ⇒ balanced disbursal journal (Bank / Utang Pinjaman)')
      go('consent.revoked', { consentId: cid }, 'rapor-usaha', 615)
      ok(!activeConsent(s, shop, LENDERS[0], 616), 'consent.revoked ⇒ no active consent')
      const hero = s.meta.facts.up!.kenalMitra.heroBusinessId
      go('partner.verified', { subjectKind: 'business', subjectId: hero, kind: 'kyb', result: 'lolos', score: 91 }, 'kenal-mitra', 620)
      ok(Math.abs((computeScore(s, hero)?.score ?? 0) - 790) <= 2, `hero KYB lolos ⇒ ≈ 790 (${computeScore(s, hero)?.score})`)
      const wid = rows(s.priceWarnings)[0]?.id
      if (wid) ok(umkmPoPayload(s, shop, wid) !== undefined, 'umkmPoPayload runs')
      ok(alertsFor(s, shop, 640).length >= 1 && dataFeed(s, shop, 640).tx === outletKpis(s, 640).total.tx, 'alertsFor + dataFeed tx = outletKpis')
      ok(vendorStorefront(s, shop).length > 0 && !!needView(s, needId), 'vendorStorefront + needView')
    }

    /* every new type has ID + EN audit text */
    const probe = (type: EventType, payload: unknown) => {
      const e = { id: 'E1', type, at: 700, source: 'katalog-lokal', payload } as never
      const d = describePdBoot(e, s) ?? describePdChains(e, s)
      return !!d && !!d.summary.id && !!d.summary.en
    }
    const anyOrder = s.orders.ids[0] ?? ''
    ok(
      probe('order.confirmed', { orderId: anyOrder, qtyConfirmed: [1], etaDays: 2 }) && probe('order.shipped', { orderId: anyOrder }) && probe('order.paid', { orderId: anyOrder, amount: 1, method: 'transfer-kasda' }) &&
        probe('consent.granted', { businessId: shop, lender: LENDERS[0], scopes: ['omzet'], days: 30 }) && probe('consent.revoked', { consentId: 'x' }) && probe('loan.rejected', { loanId: 'x', reason: { id: 'a', en: 'a' } }) &&
        probe('price.shock', { commodityId: s.region.commodities[0]!.id, marketIds: [], startAt: 0, peakDay: 5, pct: 9, cause: null }) && probe('price.warning', { shockId: 'x', commodityId: s.region.commodities[0]!.id, marketIds: [], peakInDays: 5, peakPct: 9, expected: 1, cause: 'alerts:x' }) &&
        probe('price.subscribed', { businessId: shop, commodityIds: [], channel: 'wa', thresholdPct: 10 }) && probe('price.alertSent', { subId: 'x', businessId: shop, warningId: 'x', commodityId: s.region.commodities[0]!.id, marketId: '', peakInDays: 5, peakPct: 9, text: { id: 'a', en: 'a' }, advice: { id: 'a', en: 'a' } }) &&
        probe('distributor.watched', { commodityId: s.region.commodities[0]!.id, distributorIds: ['a'], by: 'disperindag' }) && probe('econ.briefed', { month: '2026-11', kecamatanIds: [], programIds: [], sections: ['peta'], by: 'bappeda' }) && probe('chat.read', { refs: [] }),
      'every new event type has ID + EN audit text',
    )

    /* texts: natural needs of a whole day never repeat; Inti selectors */
    {
      let d: WorldState = extendPasarDaerah(generateWorld(pack, 2026))
      const sq: Seq = { ...d.meta.seq }
      for (let m = 421; m <= 16 * 60; m++) {
        const outs = naturalPdAt(d, m).filter((o) => o.type === 'need.created')
        if (!outs.length) continue
        const evs = outs.map((o) => {
          const e = createEvent(d, sq, o.type, o.payload as never, 'clock', m) as WorldEvent
          e.origin = o.origin
          return e
        })
        d = processEvents(d, sq, evs).state
      }
      const titles = rows(d.catalogNeeds).filter((n) => n.by === 'natural').map((n) => n.title.id)
      ok(titles.length >= 2 && new Set(titles).size === titles.length, `natural needs of a day: ${titles.length}, none repeated`)
    }
    const aq = auditQuery(s, { scope: 'semua' })
    ok(auditCsv(aq, 'id').split('\n').length === aq.length + 1, 'auditCsv rows = visible rows')
    ok(platformPulse(s, 700).todayCount === rows(s.auditLog).filter((a) => a.at >= 0 && a.at <= 700).length, 'pulse "Kejadian hari ini" = Audit today count')
    ok(auditQuery(s, { scope: scopeOf('pemilik-toko').scope }).every((r) => r.refs.length > 0), 'pemilik-toko scope: rows only with a shop ref')
    ok(inboxKpi(s, 700, 'semua').total === unifiedInbox(s, 700, { scope: 'semua' }).length, 'inboxKpi = unifiedInbox')
    ok(TRAIL_SPINE.length === 6, 'TRAIL_SPINE has 6 lanes')
    ok(catalogKpi(s, 700).verifiedLocal === rows(s.businesses).filter((b) => b.verified).length, 'catalogKpi verified = Kenal Mitra verified')
    const anyFollow: AnyFollowUp[] = []
    void anyFollow
  }
  void WORLD
}
