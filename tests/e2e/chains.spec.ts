/**
 * Cross-product reaction chains (spec §15.3, ≥ 10 chains) through the REAL world store in the browser.
 *
 * Runs on the live shell of the kit showcase (/lab/_kit?only=shell, product "sapa-warga") with `?e2e=1`, which makes
 * DemoShell expose `window.__gamada = { world, emit, settled, onEvent, clock }`. Each test emits the root event(s)
 * with the product that owns the action as `source` and checks the follow-ups (event types, sources, world state).
 * Chain list + product UI wording: docs/build/tahap2-plan.md §3. When the products are DEMO_READY the integrator
 * adds UI-driven variants; these stay as the contract of the world.
 */
import type { Page } from '@playwright/test'
import { test, expect, settle } from './fixtures'

type Ev = { type: string; source: string; depth: number; payload: Record<string, unknown> }
type Emit = [type: string, payload: unknown, source: string]

async function open(page: Page): Promise<void> {
  await page.goto('/lab/_kit?only=shell&e2e=1&off=preloader')
  await settle(page)
  await page.waitForFunction(() => {
    const g = (window as unknown as { __gamada?: { world: { status(): string } } }).__gamada
    return !!g && g.world.status() === 'ready'
  })
}

/** emit events in order (payload may use "$flood" for the scenario flood kecamatan list), return every processed event */
async function emitAll(page: Page, list: Emit[]): Promise<Ev[]> {
  return page.evaluate(async (items) => {
    type G = {
      world: { get(): { region: { floodKecamatanIds: string[] } } }
      emit(t: string, p: unknown, s: string): void
      settled(): Promise<void>
      onEvent(t: string, fn: (e: Ev) => void): () => void
    }
    const g = (window as unknown as { __gamada: G }).__gamada
    const seen: Ev[] = []
    const off = g.onEvent('*', (e) => seen.push({ type: e.type, source: e.source, depth: e.depth ?? 0, payload: e.payload }))
    const flood = g.world.get().region.floodKecamatanIds
    for (const [t, p, s] of items) g.emit(t, JSON.parse(JSON.stringify(p).replace('"$flood"', JSON.stringify(flood))), s)
    await g.settled()
    off()
    return seen
  }, list)
}

/** read something from the world (expression over `s`, the WorldState) */
const read = <T,>(page: Page, expr: string): Promise<T> =>
  page.evaluate((x) => {
    const s = (window as unknown as { __gamada: { world: { get(): unknown } } }).__gamada.world.get()
    // eslint-disable-next-line no-new-func
    return new Function('s', `return (${x})`)(s) as T
  }, expr)

const has = (evs: Ev[], type: string, source?: string) => evs.some((e) => e.type === type && e.depth > 0 && (!source || e.source === source))

/** five flood complaints within ~300 m of one desa (citizen = persona Ibu Siti) */
async function floodComplaints(page: Page): Promise<Emit[]> {
  const where = await read<{ kec: string; desa: string; c: [number, number]; siti: string }>(
    page,
    // a kecamatan with no flood report yet, so exactly these five form the cluster
    `(() => { const busy = new Set(Object.values(s.complaints.byId).filter((c) => c.category === 'banjir' && c.at >= -1440).map((c) => c.kecamatanId)); const k = s.region.kecamatan.find((x) => !busy.has(x.id) && x.desa.length) ?? s.region.kecamatan[0]; const d = k.desa[0]; return { kec: k.id, desa: d.id, c: d.centroid, siti: s.meta.personas.siti } })()`,
  )
  return Array.from({ length: 5 }, (_, i) => [
    'complaint.created',
    { category: 'banjir', channel: 'wa', text: 'Banjir', kecamatanId: where.kec, desaId: where.desa, coord: [where.c[0] + i * 0.0007, where.c[1] + 0.0004], citizenId: where.siti },
    'sapa-warga',
  ])
}

test('chain 1 · 5 flood complaints ⇒ complaint.clustered ⇒ Meja Pimpinan + Siaga Wilayah (flood.confirmed) + Radar Isu topic, one toast', async ({ page, errors }) => {
  await open(page)
  const evs = await emitAll(page, await floodComplaints(page))
  expect(has(evs, 'complaint.clustered', 'sapa-warga')).toBe(true)
  expect(has(evs, 'flood.confirmed', 'siaga-wilayah')).toBe(true)
  expect(has(evs, 'mention.created', 'radar-isu')).toBe(true)
  const toast = page.locator('.dk-toast')
  await expect(toast).toHaveCount(1)
  await expect(toast).toContainText('Meja Pimpinan')
  await expect(toast).toContainText('Siaga Wilayah')
  expect(errors).toEqual([])
})

test('chain 2 · ticket.statusChanged ⇒ citizen.notified on the citizen phone', async ({ page, errors }) => {
  await open(page)
  await emitAll(page, await floodComplaints(page))
  const ticketId = await read<string>(page, `Object.values(s.complaints.byId).find((c) => c.citizenId === s.meta.personas.siti).ticketId`)
  const evs = await emitAll(page, [['ticket.statusChanged', { ticketId, status: 'diteruskan', opdId: 'bpbd' }, 'sapa-warga']])
  expect(has(evs, 'citizen.notified', 'sapa-warga')).toBe(true)
  expect(await read<boolean>(page, `Object.values(s.messages.byId).some((m) => m.kind === 'tiket' && m.to.includes(s.meta.personas.siti))`)).toBe(true)
  expect(errors).toEqual([])
})

test('chain 3 · flood.alert ⇒ Awas Belanja emergency pump package (affiliated bidders, bids, brand-locked spec)', async ({ page, errors }) => {
  await open(page)
  const evs = await emitAll(page, [['flood.alert', { level: 3, kecamatanIds: '$flood' }, 'siaga-wilayah']])
  expect(has(evs, 'procurement.created', 'awas-belanja')).toBe(true)
  const pump = await read<{ bids: number; ring: number; spec: boolean }>(
    page,
    `(() => { const p = Object.values(s.procurements.byId).find((x) => x.key === 'pompa-darurat'); return { bids: p.bids.length, ring: p.bidderIds.filter((b) => s.bidders.byId[b].ring === 'pompa').length, spec: !!p.spec } })()`,
  )
  expect(pump.ring).toBeGreaterThanOrEqual(3)
  expect(pump.bids).toBeGreaterThanOrEqual(pump.ring)
  expect(pump.spec).toBe(true)
  expect(errors).toEqual([])
})

test('chain 4 · flood.alert ⇒ Cek Berkas bansos quota opens (eligibility.opened)', async ({ page, errors }) => {
  await open(page)
  const evs = await emitAll(page, [['flood.alert', { level: 3, kecamatanIds: '$flood' }, 'siaga-wilayah']])
  expect(has(evs, 'eligibility.opened', 'cek-berkas')).toBe(true)
  expect(await read<boolean>(page, `Object.values(s.programs.byId).some((p) => p.kind === 'bansos-banjir' && p.open && p.quota > 0)`)).toBe(true)
  expect(await read<number>(page, `s.meta.facts.bansosDuplicatePairs`)).toBe(3)
  expect(errors).toEqual([])
})

test('chain 5 · flood.alert ⇒ Radar Isu topic + Toko Autopilot demand + Katalog Lokal need', async ({ page, errors }) => {
  await open(page)
  const evs = await emitAll(page, [['flood.alert', { level: 3, kecamatanIds: '$flood' }, 'siaga-wilayah']])
  expect(has(evs, 'mention.created', 'radar-isu')).toBe(true)
  expect(has(evs, 'stock.forecastChanged', 'toko-autopilot')).toBe(true)
  expect(has(evs, 'need.created', 'katalog-lokal')).toBe(true)
  expect(errors).toEqual([])
})

test('chain 6 · alert.broadcast ⇒ warning on the phones in the zone (Ibu Siti), not outside', async ({ page, errors }) => {
  await open(page)
  await emitAll(page, [['flood.alert', { level: 3, kecamatanIds: '$flood' }, 'siaga-wilayah']])
  const alertId = await read<string>(page, `Object.values(s.alerts.byId).find((a) => a.status === 'aktif' && a.kind === 'banjir').id`)
  const evs = await emitAll(page, [['alert.broadcast', { alertId, channels: ['wa', 'sms'] }, 'siaga-wilayah']])
  expect(has(evs, 'citizen.notified', 'sapa-warga')).toBe(true)
  const r = await read<{ siti: boolean; darmoIn: boolean; darmo: boolean }>(
    page,
    `(() => { const m = Object.values(s.messages.byId).filter((x) => x.kind === 'peringatan'); const d = s.citizens.byId[s.meta.personas.darmo]; return { siti: m.some((x) => x.to.includes(s.meta.personas.siti)), darmoIn: s.region.floodKecamatanIds.includes(d.kecamatanId), darmo: m.some((x) => x.to.includes(s.meta.personas.darmo)) } })()`,
  )
  expect(r.siti).toBe(true)
  expect(r.darmo).toBe(r.darmoIn)
  expect(errors).toEqual([])
})

test('chain 7 · instruction.issued ⇒ Naskah Pintar disposition + OPD action items', async ({ page, errors }) => {
  await open(page)
  const evs = await emitAll(page, [['instruction.issued', { text: { id: 'Kerahkan pompa', en: 'Deploy pumps' }, opdIds: ['bpbd', 'pupr'] }, 'meja-pimpinan']])
  expect(has(evs, 'letter.dispositioned', 'naskah-pintar')).toBe(true)
  expect(evs.filter((e) => e.type === 'actionItem.created' && e.source === 'naskah-pintar')).toHaveLength(2)
  expect(errors).toEqual([])
})

test('chain 8 · rumor burst (6 mentions) ⇒ hoax.detected with dam evidence (→ Meja Pimpinan)', async ({ page, errors }) => {
  await open(page)
  const rumor = await read<string>(page, 's.meta.facts.hoax.rumor')
  const burst: Emit[] = Array.from({ length: 8 }, (_, i) => [
    'mention.created',
    { at: 600 + i * 3, outlet: '@kabar.kilat.88', kind: 'sosmed', author: `@akun${i}`, text: { id: 'Bendungan jebol', en: 'Dam burst' }, sentiment: 'negatif', score: -0.8, topic: 'hoaks-bendungan', reach: 1500, rumor },
    'radar-isu',
  ])
  const evs = await emitAll(page, burst)
  expect(evs.filter((e) => e.type === 'hoax.detected' && e.source === 'radar-isu')).toHaveLength(1)
  const ev = await read<string>(page, `Object.values(s.hoaxAlerts.byId)[0].evidence.id`)
  expect(ev).toContain(await read<string>(page, 's.meta.facts.hoax.damName'))
  expect(errors).toEqual([])
})

test('chain 9 · clarification.published ⇒ recovering (positive) mentions over the next 30 world minutes', async ({ page, errors }) => {
  await open(page)
  const rumor = await read<string>(page, 's.meta.facts.hoax.rumor')
  await emitAll(page, Array.from({ length: 6 }, (_, i): Emit => ['mention.created', { at: 600 + i, outlet: '@x', kind: 'sosmed', author: `@a${i}`, text: { id: 'Jebol', en: 'Burst' }, sentiment: 'negatif', score: -0.8, topic: 'hoaks-bendungan', reach: 900, rumor }, 'radar-isu']))
  const hoaxId = await read<string>(page, 'Object.values(s.hoaxAlerts.byId)[0].id')
  const evs = await emitAll(page, [['clarification.published', { hoaxId, tone: 'menenangkan', channels: ['web', 'wa'] }, 'radar-isu']])
  const rec = evs.filter((e) => e.type === 'mention.created' && e.depth > 0)
  expect(rec.length).toBe(5)
  expect(rec.every((e) => (e.payload.score as number) > 0)).toBe(true)
  expect(await read<string>(page, `s.hoaxAlerts.byId['${hoaxId}'].status`)).toBe('diklarifikasi')
  expect(errors).toEqual([])
})

test('chain 10 · harvest.updated (pasca-banjir) ⇒ econ.updated (Indeks Ekonomi) + supply.signal (Sinyal Pasar)', async ({ page, errors }) => {
  await open(page)
  const evs = await emitAll(page, [['harvest.updated', { scenario: 'pasca-banjir', kecamatanIds: '$flood' }, 'siaga-wilayah']])
  expect(has(evs, 'econ.updated', 'indeks-ekonomi')).toBe(true)
  expect(has(evs, 'supply.signal', 'sinyal-pasar')).toBe(true)
  expect(await read<boolean>(page, `Object.values(s.supplySignals.byId).some((x) => /beras/.test(x.commodityId) && x.pct < 0)`)).toBe(true)
  expect(errors).toEqual([])
})

test('chain 11 · procurement.recommended (invite local UMKM) ⇒ Katalog Lokal need', async ({ page, errors }) => {
  await open(page)
  await emitAll(page, [['flood.alert', { level: 3, kecamatanIds: '$flood' }, 'siaga-wilayah']])
  const id = await read<string>(page, `Object.values(s.procurements.byId).find((x) => x.key === 'pompa-darurat').id`)
  const evs = await emitAll(page, [['procurement.recommended', { procurementId: id, hpsCorrected: 500000000, note: { id: 'Koreksi HPS', en: 'Correct HPS' }, inviteLocal: true }, 'awas-belanja']])
  expect(has(evs, 'need.created', 'katalog-lokal')).toBe(true)
  expect(errors).toEqual([])
})

test('chain 12 · price.anomaly ⇒ market.operation recommended to Meja Pimpinan', async ({ page, errors }) => {
  await open(page)
  const p = await read<{ m: string; c: string; price: number }>(page, `(() => { const x = s.prices.byId[s.prices.ids[0]]; return { m: x.marketId, c: x.commodityId, price: x.price } })()`)
  const evs = await emitAll(page, [['price.anomaly', { marketId: p.m, commodityId: p.c, price: Math.round(p.price * 1.3), expected: p.price, deltaPct: 30 }, 'sinyal-pasar']])
  expect(has(evs, 'market.operation', 'sinyal-pasar')).toBe(true)
  expect(errors).toEqual([])
})

test('chain 13 · service.booked ⇒ queue ticket on the citizen phone', async ({ page, errors }) => {
  await open(page)
  const who = await read<{ raka: string; svc: string }>(page, `({ raka: s.meta.personas.raka, svc: s.region.services[0].id })`)
  const evs = await emitAll(page, [['service.booked', { serviceId: who.svc, citizenId: who.raka, slotAt: 570 }, 'sapa-warga']])
  expect(has(evs, 'citizen.notified', 'sapa-warga')).toBe(true)
  expect(await read<boolean>(page, `Object.values(s.messages.byId).some((m) => m.kind === 'antrean' && m.to.includes('${who.raka}'))`)).toBe(true)
  expect(errors).toEqual([])
})

/* ---------------------------------------------------------------- tahap 3 · Usaha Pintar chains C14–C29 (docs/build/tahap3-plan.md §3) */

/** the lab shell is a Satu Daerah page: load the Usaha Pintar world module (boot + chains) first */
async function openUp(page: Page): Promise<void> {
  await open(page)
  await page.evaluate(() => (window as unknown as { __gamada: { ensure(eco: string): Promise<void> } }).__gamada.ensure('usaha-pintar'))
  await page.waitForFunction(() => {
    const g = (window as unknown as { __gamada: { world: { get(): { meta: { ext?: Record<string, number> } } } } }).__gamada
    return !!g.world.get().meta.ext?.['usaha-pintar']
  })
}
const FLOOD: Emit = ['flood.alert', { level: 3, kecamatanIds: '$flood' }, 'siaga-wilayah']

test('chains 14 + 20 · sale ⇒ ledger (Pajak Beres) ⇒ score; market price anomaly ⇒ ingredient forecast ×1.6', async ({ page, errors }) => {
  await openUp(page)
  const sale = await read<{ outletId: string; productId: string; price: number }>(
    page,
    `(() => { const o = Object.values(s.outlets.byId).find((x) => x.businessId === s.meta.shopId && x.kind === 'toko'); const p = Object.values(s.products.byId).find((x) => x.outletId === o.id && (s.stock.byId[x.id]?.onHand ?? 0) > 5); return { outletId: o.id, productId: p.id, price: p.price } })()`,
  )
  let evs = await emitAll(page, [['sale.created', { outletId: sale.outletId, items: [{ productId: sale.productId, qty: 1, price: sale.price }], payment: 'tunai' }, 'toko-autopilot']])
  expect(has(evs, 'ledger.posted', 'pajak-beres')).toBe(true)
  // 'ledger→score' emits score.updated only when the score changes (one small sale usually does not move it)
  const saleId = evs.find((e) => e.type === 'sale.created')!.payload.id as string
  expect(await read<boolean>(page, `Object.values(s.ledger.byId).some((j) => j.refId === '${saleId}' && j.source === 'sale')`)).toBe(true)
  const an = await read<{ marketId: string; commodityId: string; price: number }>(
    page,
    `(() => { const p = Object.values(s.products.byId).find((x) => x.tags.some((t) => t.startsWith('cm:'))); const c = p.tags.find((t) => t.startsWith('cm:')).slice(3); const m = Object.values(s.prices.byId).find((x) => x.commodityId === c); return { marketId: m.marketId, commodityId: c, price: m.price } })()`,
  )
  evs = await emitAll(page, [['price.anomaly', { ...an, price: Math.round(an.price * 1.4), expected: an.price, deltaPct: 40 }, 'sinyal-pasar']])
  const fc = evs.find((e) => e.type === 'stock.forecastChanged' && e.source === 'toko-autopilot')
  expect(fc?.payload.factor).toBe(1.6)
  expect(errors).toEqual([])
})

test('chains 15 + 21–24 + 26 + 28 · flood ⇒ PO drafts, emergency tender (matched 0,78) + Awas Belanja package, pump mirror, priority KYB, brand alert', async ({ page, errors }) => {
  await openUp(page)
  const evs = await emitAll(page, [FLOOD])
  expect(has(evs, 'po.drafted', 'toko-autopilot')).toBe(true)
  expect(has(evs, 'tender.created', 'tenderpilot')).toBe(true)
  expect(has(evs, 'tender.matched', 'tenderpilot')).toBe(true)
  expect(has(evs, 'verification.requested', 'kenal-mitra')).toBe(true)
  expect(has(evs, 'brand.alert', 'pantau-merek')).toBe(true)
  const r = await read<{ p: number; hps: number; pk: boolean; pump: number; hero: boolean; alertAt: number; flood: number }>(
    page,
    `(() => { const t = Object.values(s.tenders.byId).find((x) => x.key === 'karung-terpal-darurat'); const pm = Object.values(s.tenders.byId).find((x) => x.key === 'pompa-darurat'); const a = Object.values(s.brandAlerts.byId)[0]; const f = Object.values(s.alerts.byId).find((x) => x.kind === 'banjir' && x.status === 'aktif'); return { p: t.matches[s.meta.shopId], hps: t.hps, pk: Object.values(s.procurements.byId).some((x) => x.key === 'karung-terpal-darurat'), pump: pm && pm.procurementId ? pm.matches[s.meta.shopId] : 1, hero: Object.values(s.verificationRequests.byId).some((v) => v.priority && v.subjectId === s.meta.facts.up.kenalMitra.heroBusinessId), alertAt: a.at, flood: f.at } })()`,
  )
  expect(r.p).toBe(0.78)
  expect(r.hps).toBe(37_750_000)
  expect(r.pk).toBe(true)
  expect(r.pump).toBeLessThan(0.3)
  expect(r.hero).toBe(true)
  expect(r.alertAt).toBe(r.flood + 6)
  expect(errors).toEqual([])
})

test('chains 16–19 · PO sent ⇒ supplier reply + WA pre-order chat (new cashier) + nota; ledger reviewed ⇒ score', async ({ page, errors }) => {
  await openUp(page)
  await emitAll(page, [FLOOD])
  const po = await read<{ id: string; code: string; businessId: string; supplierId: string; items: unknown[] }>(
    page,
    `(() => { const p = Object.values(s.purchaseOrders.byId).find((x) => x.status === 'draf' && x.businessId === s.meta.shopId); return { id: p.id, code: p.code, businessId: p.businessId, supplierId: p.supplierId, items: p.items } })()`,
  )
  let evs = await emitAll(page, [['po.sent', po, 'toko-autopilot']])
  expect(has(evs, 'supplier.replied', 'toko-autopilot')).toBe(true)
  expect(has(evs, 'call.created', 'juara-jualan')).toBe(true)
  expect(has(evs, 'nota.received', 'pajak-beres')).toBe(true)
  const chat = await read<{ clip: string; cashier: boolean }>(page, `(() => { const c = Object.values(s.calls.byId).find((x) => x.refId === '${po.id}'); return { clip: c.transcript, cashier: c.agentId === s.meta.facts.up.newCashierAgentId } })()`)
  expect(chat).toEqual({ clip: 'tb-wa-prapesan', cashier: true })
  // C18 fires once per PO: a manual supplier reply adds no second nota
  evs = await emitAll(page, [['supplier.replied', { poId: po.id, message: { id: 'Siap kirim', en: 'Will ship' } }, 'toko-autopilot']])
  expect(has(evs, 'nota.received')).toBe(false)
  const ledgerId = await read<string>(page, `Object.values(s.ledger.byId).find((j) => j.needsReview).id`)
  evs = await emitAll(page, [['ledger.reviewed', { ledgerId }, 'pajak-beres']])
  expect(has(evs, 'score.updated', 'rapor-usaha')).toBe(true)
  expect(errors).toEqual([])
})

test('chains 25 + 27 + L1 · bid ⇒ Awas Belanja bid row; hero KYB lolos ⇒ catalog match; tax.ready ⇒ tax tidy', async ({ page, errors }) => {
  await openUp(page)
  await emitAll(page, [FLOOD])
  const ids = await read<{ tenderId: string; shop: string; hero: string; period: string }>(
    page,
    `({ tenderId: Object.values(s.tenders.byId).find((x) => x.key === 'karung-terpal-darurat').id, shop: s.meta.shopId, hero: s.meta.facts.up.kenalMitra.heroBusinessId, period: s.day.slice(0, 7) })`,
  )
  let evs = await emitAll(page, [['bid.submitted', { tenderId: ids.tenderId, businessId: ids.shop, price: 35_900_000 }, 'tenderpilot']])
  expect(has(evs, 'procurement.bidReceived', 'awas-belanja')).toBe(true)
  expect(await read<boolean>(page, `Object.values(s.procurements.byId).find((x) => x.key === 'karung-terpal-darurat').bids.some((b) => b.bidderId === s.meta.facts.up.shopBidderId && b.price === 35900000)`)).toBe(true)
  evs = await emitAll(page, [['partner.verified', { subjectKind: 'business', subjectId: ids.hero, kind: 'kyb', result: 'lolos', score: 91 }, 'kenal-mitra']])
  expect(has(evs, 'match.made', 'katalog-lokal')).toBe(true)
  expect(await read<boolean>(page, `s.businesses.byId['${ids.hero}'].verified`)).toBe(true)
  await emitAll(page, [['tax.ready', { businessId: ids.shop, period: ids.period }, 'pajak-beres']])
  expect(await read<boolean>(page, `s.businesses.byId[s.meta.shopId].taxTidy`)).toBe(true)
  expect(errors).toEqual([])
})

test('chain 29 · brand replies + service announcement ⇒ recovery mentions + Kasir notice; alert handled', async ({ page, errors }) => {
  await openUp(page)
  await emitAll(page, [FLOOD])
  const a = await read<{ alertId: string; mentionIds: string[]; shop: string }>(
    page,
    `(() => { const a = Object.values(s.brandAlerts.byId)[0]; const m = Object.values(s.brandMentions.byId).filter((x) => x.cause === a.causeRef && x.brand === s.meta.shopId && x.topic === 'pengiriman').sort((x, y) => x.at - y.at).slice(0, 5); return { alertId: a.id, mentionIds: m.map((x) => x.id), shop: s.meta.shopId } })()`,
  )
  let evs = await emitAll(page, [['brand.replied', { mentionIds: a.mentionIds, tone: 'empatik', replies: a.mentionIds.map((id) => ({ id: `Mohon maaf (${id})`, en: `Sorry (${id})` })), by: 'brand-manager', alertId: a.alertId }, 'pantau-merek']])
  expect(evs.filter((e) => e.type === 'brand.mentioned' && e.depth > 0).length).toBe(3)
  evs = await emitAll(page, [['brand.announced', { businessId: a.shop, alertId: a.alertId, topic: 'pengiriman', text: { id: 'Pengiriman tertunda 1–2 hari karena banjir', en: 'Deliveries delayed 1–2 days by the flood' }, channels: ['marketplace', 'struk'], offer: 'ambil-sendiri', by: 'brand-manager' }, 'pantau-merek']])
  expect(has(evs, 'pos.noticeSet', 'toko-autopilot')).toBe(true)
  expect(evs.filter((e) => e.type === 'brand.mentioned' && e.depth > 0).length).toBe(3)
  expect(await read<string>(page, `s.brandAlerts.byId['${a.alertId}'].status`)).toBe('ditangani')
  expect(errors).toEqual([])
})
