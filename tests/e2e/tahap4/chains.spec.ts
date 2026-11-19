/**
 * Tahap 4 · Pasar Daerah + Inti cross-product chains through the REAL product UIs (docs/build/tahap4-plan.md §3,
 * C30–C38 + state links L7–L12, and the Tahap 3 C20 hop whose root now lives in Sinyal Pasar). The root is emitted on
 * the page of the product that owns the action (source = that product, as its own button does); the follow-up is
 * checked where a visitor sees it, reached the way a visitor would: the cross-product toast (a real link with
 * ?focus=, now that the five demos are DEMO_READY) for the toast's first product, and an in-app navigation (the world
 * stays in memory) with the same ?focus= for the other products the toast names. tests/e2e/chains.spec.ts keeps the
 * world-level contract of the same chains; each product spec covers its own hops and ?focus= arrivals in depth.
 */
import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures'
import { W, emit, notNoise, openDemo, spaGo } from '../tahap2/helpers'

test.describe.configure({ timeout: 150_000 })

/** the scenario flood (Siaga Wilayah early warning) on the flood kecamatan of the pack */
async function flood(page: Page): Promise<void> {
  const kecamatanIds = await W<string[]>(page, 's.region.floodKecamatanIds')
  await emit(page, 'flood.alert', { level: 3, kecamatanIds }, 'siaga-wilayah')
}

/** the Pasar Daerah chains module (a visitor's first click loads it; the test emits without clicking) */
async function chainsReady(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const g = (window as unknown as { __gamada: { ensure(eco: string): Promise<void> } }).__gamada
    await g.ensure('pasar-daerah')
  })
}

/** click a toast and record every URL the page passes through (the target may drop ?focus= right after reading it) */
async function follow(page: Page, toastText: RegExp | string): Promise<string[]> {
  const urls: string[] = []
  page.on('framenavigated', (f) => {
    if (f === page.mainFrame()) urls.push(f.url())
  })
  const toast = page.locator('.dk-toast').filter({ hasText: toastText })
  await expect(toast).toHaveCount(1)
  await toast.locator('.dk-toast-main').click()
  return urls
}

test('C30–C32 + C35 · a Siaga Wilayah flood ⇒ one toast (Sinyal Pasar + Indeks Ekonomi among its receivers) ⇒ the warning card, the shop alert, the kecamatan drawer', async ({ page, errors }) => {
  await openDemo(page, 'siaga-wilayah')
  await chainsReady(page)
  await flood(page)
  // one toast for the flood (its title lists the first receivers + "+n"; Sinyal Pasar and Indeks Ekonomi are among them)
  await expect(page.locator('.dk-toast').filter({ hasText: /Peringatan banjir diteruskan ke .*\+\d+/ })).toHaveCount(1)
  expect(await W<string[]>(page, `[...new Set(Object.values(s.auditLog.byId).filter((a) => a.causeId && (a.type === 'price.shock' || a.type === 'econ.updated')).map((a) => a.source))].sort()`)).toEqual(['indeks-ekonomi', 'sinyal-pasar'])
  const ids = await W<{ shock: string; warn: string; alert: string; kec: string; month: string }>(
    page,
    `(() => {
      const shock = s.priceShocks.ids[0]; const warn = s.priceWarnings.ids.find((w) => s.priceWarnings.byId[w].shockId === shock);
      const alert = s.priceAlerts.ids.find((a) => s.priceAlerts.byId[a].businessId === s.meta.shopId);
      const ev = Object.values(s.econIndex.byId).filter((c) => (c.events ?? []).some((x) => x.kind === 'banjir')).sort((a, b) => a.index - b.index)[0];
      return { shock, warn, alert, kec: ev.kecamatanId, month: ev.month }
    })()`,
  )
  expect(ids.shock && ids.warn && ids.alert).toBeTruthy()
  // C30 → C31: the shock id lands on its early-warning card (Sinyal Pasar, Disperindag)
  await spaGo(page, `/demo/sinyal-pasar?e2e=1&focus=${ids.shock}`)
  await expect(page.locator(`[data-sp-alert="${ids.warn}"]`)).toBeVisible({ timeout: 20_000 })
  // C35: the flood nowcast of the lowest kecamatan opens its drawer on the map tab
  await spaGo(page, `/demo/indeks-ekonomi?e2e=1&tab=peta&focus=${ids.kec}:${ids.month}`)
  await expect(page.locator('[data-ie="drawer"]')).toHaveAttribute('data-kec', ids.kec, { timeout: 20_000 })
  // C32: the shop's early alert: the PA- id alone switches Sinyal Pasar to the Pemilik Toko inbox
  await spaGo(page, `/demo/sinyal-pasar?e2e=1&focus=${ids.alert}`)
  await expect(page.locator(`[data-alert="${ids.alert}"]`)).toHaveClass(/is-active/, { timeout: 20_000 })
  expect(errors.filter(notNoise)).toEqual([])
})

test('C33 + C13 + C20 · a Sinyal Pasar price anomaly ⇒ one toast to Toko Autopilot ⇒ the commodity SKU forecast (×1,6); the op waits in Meja Pimpinan', async ({ page, errors }) => {
  await openDemo(page, 'sinyal-pasar')
  await chainsReady(page)
  // the Disperindag landing carries no Usaha Pintar data: the anomaly (a UP trigger) loads it, then C20 runs
  const c = await W<{ cm: string; market: string; price: number }>(
    page,
    `(() => { const cm = s.meta.facts.pd.shockCommodityIds[1]; const pp = Object.values(s.prices.byId).find((x) => x.commodityId === cm); return { cm, market: pp.marketId, price: pp.price } })()`,
  )
  await emit(page, 'price.anomaly', { marketId: c.market, commodityId: c.cm, price: Math.round(c.price * 1.4), expected: c.price, deltaPct: 40 }, 'sinyal-pasar')
  const pid = await W<string>(page, `Object.values(s.products.byId).find((x) => x.businessId === s.meta.shopId && x.tags.includes('cm:${c.cm}')).id`)
  expect(await W<number>(page, `s.stock.byId['${pid}'].factor`)).toBeCloseTo(1.6)
  const op = await W<string>(page, `Object.values(s.marketOps.byId).find((o) => o.stage === 'recommended' && o.commodityId === '${c.cm}').id`)
  expect(op).toBeTruthy()
  const urls = await follow(page, 'Toko Autopilot')
  await expect(page).toHaveURL(/\/demo\/toko-autopilot\?/)
  await expect.poll(() => urls.some((u) => /[?&]focus=/.test(u))).toBe(true)
  await expect(page.locator('#dk-ta-tab-prediksi')).toHaveAttribute('aria-selected', 'true', { timeout: 20_000 })
  await expect(page.locator('[data-factor="harga"]').first()).toContainText('+60%')
  // C13: the recommended operation is on the leader's desk
  await spaGo(page, `/demo/meja-pimpinan?e2e=1&focus=${op}`)
  await expect(page.locator('.dk-mp').getByText(/operasi pasar/i).first()).toBeVisible({ timeout: 20_000 })
  expect(errors.filter(notNoise)).toEqual([])
})

test('C34 · Sinyal Pasar sends + starts a market operation ⇒ toast to Indeks Ekonomi ⇒ the Dampak tab measures that operation', async ({ page, errors }) => {
  await openDemo(page, 'sinyal-pasar')
  await chainsReady(page)
  await flood(page)
  const sh = await W<{ c: string; m: string[] }>(page, `(() => { const x = Object.values(s.priceShocks.byId)[0]; return { c: x.commodityId, m: x.marketIds.slice(0, 1) } })()`)
  await emit(page, 'market.operation', { stage: 'recommended', commodityId: sh.c, marketIds: sh.m, volumeTon: 10, days: 3, sentBy: 'disperindag', effectPct: -8 }, 'sinyal-pasar')
  const opId = await W<string>(page, `Object.values(s.marketOps.byId).find((o) => o.sentBy === 'disperindag' && o.commodityId === '${sh.c}').id`)
  // the recommendation reaches Meja Pimpinan (its own toast)
  await expect(page.locator('.dk-toast').filter({ hasText: 'Meja Pimpinan' })).toHaveCount(1)
  await emit(page, 'market.operation', { id: opId, stage: 'running', commodityId: sh.c, marketIds: sh.m }, 'sinyal-pasar')
  expect(await W<boolean>(page, `Object.values(s.econIndex.byId).some((c) => (c.events ?? []).some((e) => e.kind === 'program' && e.cause === 'marketOps:${opId}'))`)).toBe(true)
  const urls = await follow(page, 'Indeks Ekonomi')
  await expect(page).toHaveURL(/\/demo\/indeks-ekonomi\?/)
  await expect.poll(() => urls.some((u) => u.includes(`focus=${opId}`))).toBe(true)
  await expect(page.locator('#dk-ie-tab-dampak')).toHaveAttribute('aria-selected', 'true', { timeout: 20_000 })
  await expect(page.locator(`[data-ie="impact"][data-program="${opId}"]`)).toBeVisible()
  expect(errors.filter(notNoise)).toEqual([])
})

test('L9 + C36 + L10 · a TenderPilot bid ⇒ toast to Katalog Lokal (offer from the bid) ⇒ ordering it closes the tender ⇒ toast to TenderPilot Riwayat', async ({ page, errors }) => {
  await openDemo(page, 'tenderpilot')
  await chainsReady(page)
  await flood(page)
  const t = await W<{ id: string; needId: string; shop: string }>(page, `(() => { const x = Object.values(s.tenders.byId).find((y) => y.key === 'karung-terpal-darurat'); return { id: x.id, needId: x.needId, shop: s.meta.shopId } })()`)
  expect(t.needId).toBeTruthy()
  // C36: the flood need (C5) has its verified matches
  expect(await W<number>(page, `Object.values(s.matches.byId).filter((m) => m.needId === '${t.needId}').length`)).toBeGreaterThan(0)
  await emit(page, 'bid.submitted', { tenderId: t.id, businessId: t.shop, price: 35_900_000, pages: 34 }, 'tenderpilot')
  const urls = await follow(page, 'Katalog Lokal')
  await expect(page).toHaveURL(/\/demo\/katalog-lokal\?/)
  await expect.poll(() => urls.some((u) => u.includes(`focus=${t.needId}`))).toBe(true)
  const detail = page.locator(`.dk-kl-detail[data-need="${t.needId}"]`)
  await expect(detail).toBeVisible({ timeout: 20_000 })
  // L9: the shop's card prices the offer from its bid
  await expect(detail.locator(`[data-kl-card="${t.shop}"] .dk-kl-src.is-bid, [data-kl-wait="${t.shop}"] .dk-kl-src.is-bid`).first()).toBeAttached()
  // L10: ordering from the shop on that need closes the tender; the toast opens TenderPilot on the winning bid
  await chainsReady(page)
  const items = await W<unknown[]>(page, `s.catalogNeeds.byId['${t.needId}'].items.map((i) => ({ name: i.name, qty: Math.min(i.qty, 10), unit: i.unit, price: 15000, category: i.category }))`)
  await emit(page, 'order.created', { needId: t.needId, businessId: t.shop, items }, 'katalog-lokal')
  expect(await W<string>(page, `s.tenders.byId['${t.id}'].status`)).toBe('selesai')
  const bid = await W<string>(page, `Object.values(s.bids.byId).find((b) => b.tenderId === '${t.id}' && b.businessId === s.meta.shopId).id`)
  expect(await W<string>(page, `s.bids.byId['${bid}'].status`)).toBe('menang')
  const urls2 = await follow(page, 'TenderPilot')
  await expect(page).toHaveURL(/\/demo\/tenderpilot\?/)
  await expect.poll(() => urls2.some((u) => u.includes(`focus=${bid}`))).toBe(true)
  await expect(page.locator('.dk-tp [role="tab"][aria-selected="true"]').filter({ hasText: /Riwayat/ })).toBeVisible({ timeout: 20_000 })
  expect(errors.filter(notNoise)).toEqual([])
})

test('L11 + C37 · the shop ships and the Pemda pays a Katalog Lokal order ⇒ toasts to Toko Autopilot and Pajak Beres ⇒ the SKU and the journal row (= order total); Rapor score moves', async ({ page, errors }) => {
  await openDemo(page, 'katalog-lokal')
  await chainsReady(page)
  const shop = await W<{ id: string; kec: string }>(page, `({ id: s.meta.shopId, kec: s.region.floodKecamatanIds[0] })`)
  await emit(page, 'need.created', { title: { id: 'Karung pasir posko', en: 'Sandbags' }, items: [{ name: { id: 'Karung pasir', en: 'Sandbags' }, category: 'karung-pasir', qty: 40, unit: 'lembar' }], kecamatanId: shop.kec, deadlineDays: 2, by: 'manual' }, 'katalog-lokal')
  const needId = await W<string>(page, `Object.values(s.catalogNeeds.byId).find((n) => n.by === 'manual' && n.title.id === 'Karung pasir posko').id`)
  await emit(page, 'order.created', { needId, businessId: shop.id, items: [{ name: { id: 'Karung pasir', en: 'Sandbags' }, qty: 40, unit: 'lembar', price: 15_000, category: 'karung-pasir' }] }, 'katalog-lokal')
  const order = await W<{ id: string; total: number }>(page, `(() => { const o = Object.values(s.orders.byId).find((x) => x.needId === '${needId}' && x.businessId === s.meta.shopId); return { id: o.id, total: o.total } })()`)
  await emit(page, 'order.confirmed', { orderId: order.id, qtyConfirmed: [40], etaDays: 2 }, 'katalog-lokal')
  const score0 = await W<number>(page, 's.bizScores.byId[s.meta.shopId].score')
  await emit(page, 'order.shipped', { orderId: order.id }, 'katalog-lokal')
  // L11: the toast opens Toko Autopilot on the SKU that left the shelf
  const urls = await follow(page, 'Toko Autopilot')
  await expect(page).toHaveURL(/\/demo\/toko-autopilot\?/)
  await expect.poll(() => urls.some((u) => /[?&]focus=/.test(u))).toBe(true)
  await expect(page.locator('#dk-ta-tab-prediksi')).toHaveAttribute('aria-selected', 'true', { timeout: 20_000 })
  // C37: back in Katalog Lokal the Pemda pays; the ledger row equals the order total
  await spaGo(page, '/demo/katalog-lokal?e2e=1')
  await expect(page.locator('.dk-kl[data-side]')).toBeVisible({ timeout: 20_000 })
  const total = await W<number>(page, `s.orders.byId['${order.id}'].total`)
  await emit(page, 'order.paid', { orderId: order.id, amount: total, method: 'transfer-kasda' }, 'katalog-lokal')
  const ledgerId = await W<string>(page, `Object.values(s.ledger.byId).find((j) => j.source === 'katalog' && j.refId === '${order.id}').id`)
  expect(await W<number>(page, `s.ledger.byId['${ledgerId}'].lines[0].debit`)).toBe(total)
  const urls2 = await follow(page, 'Pajak Beres')
  await expect(page).toHaveURL(/\/demo\/pajak-beres\?/)
  await expect.poll(() => urls2.some((u) => u.includes(`focus=${ledgerId}`))).toBe(true)
  await expect(page.locator(`.dk-pb-jrow[data-ledger="${ledgerId}"]`)).toBeVisible({ timeout: 20_000 })
  // C37 → 'ledger→score': Rapor Usaha shows the same score as the world
  const score1 = await W<number>(page, 's.bizScores.byId[s.meta.shopId].score')
  expect(typeof score0).toBe('number')
  await spaGo(page, `/demo/rapor-usaha?e2e=1&focus=${shop.id}`)
  await expect(page.locator('.dk-ru:not([aria-busy])')).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('.dk-ru [role="meter"]').first()).toHaveAttribute('aria-valuenow', String(score1))
  expect(errors.filter(notNoise)).toEqual([])
})

test('C38 · the cooperative approves the shop loan in Rapor Usaha ⇒ toast to Pajak Beres ⇒ the disbursal journal (Utang Pinjaman)', async ({ page, errors }) => {
  await openDemo(page, 'rapor-usaha', { role: 'bank-mitra' })
  await chainsReady(page)
  const shop = await W<string>(page, 's.meta.shopId')
  await emit(page, 'loan.applied', { businessId: shop, lender: 'Koperasi Mitra Usaha Sejahtera', amount: 100_000_000, tenorMonths: 12 }, 'rapor-usaha')
  const loanId = await W<string>(page, `Object.values(s.loanApps.byId).filter((l) => l.businessId === '${shop}').sort((a, b) => b.at - a.at || b.id.localeCompare(a.id))[0].id`)
  await emit(page, 'loan.approved', { loanId, amount: 100_000_000 }, 'rapor-usaha')
  const ledgerId = await W<string>(page, `Object.values(s.ledger.byId).find((j) => j.source === 'pinjaman' && j.refId === '${loanId}').id`)
  expect(await W<boolean>(page, `s.ledger.byId['${ledgerId}'].lines.some((l) => l.account === 'Utang Pinjaman' && l.credit === 100000000)`)).toBe(true)
  const urls = await follow(page, 'Pajak Beres')
  await expect(page).toHaveURL(/\/demo\/pajak-beres\?/)
  await expect.poll(() => urls.some((u) => u.includes(`focus=${ledgerId}`))).toBe(true)
  await expect(page.locator(`.dk-pb-jrow[data-ledger="${ledgerId}"]`)).toBeVisible({ timeout: 20_000 })
  expect(errors.filter(notNoise)).toEqual([])
})

test('L7 + L8 · tax ready (Pajak Beres) and KYB lolos (Kenal Mitra) ⇒ toasts name Katalog Lokal + Rapor Usaha ⇒ Pajak Rapi badge, the pajak factor, the bank row', async ({ page, errors }) => {
  await openDemo(page, 'pajak-beres')
  await chainsReady(page)
  await flood(page)
  const r = await W<{ shop: string; period: string; hero: string }>(page, `({ shop: s.meta.shopId, period: s.day.slice(0, 7), hero: s.meta.facts.up.kenalMitra.heroBusinessId })`)
  await emit(page, 'tax.ready', { businessId: r.shop, period: r.period }, 'pajak-beres')
  const t1 = page.locator('.dk-toast').filter({ hasText: 'Katalog Lokal' })
  await expect(t1).toHaveCount(1)
  await expect(t1).toContainText('Rapor Usaha')
  // L7: the shop's Pajak Rapi badge in Katalog Lokal; the pajak factor in Rapor Usaha
  expect(await W<boolean>(page, 's.businesses.byId[s.meta.shopId].taxTidy')).toBe(true)
  await spaGo(page, `/demo/rapor-usaha?e2e=1&focus=pajak`)
  await expect(page.locator('[data-ru="factor-drawer"]')).toHaveAttribute('data-factor', 'pajak', { timeout: 20_000 })
  // L8: Kenal Mitra KYB lolos for the hero vendor ⇒ the cooperative's queue row (Rapor Usaha bank side)
  await spaGo(page, '/demo/kenal-mitra?e2e=1')
  await expect(page.locator('.dk-km:not(.dk-km-skel)')).toBeVisible({ timeout: 20_000 })
  await emit(page, 'partner.verified', { subjectKind: 'business', subjectId: r.hero, kind: 'kyb', result: 'lolos', score: 96 }, 'kenal-mitra')
  const t2 = page.locator('.dk-toast').filter({ hasText: 'Rapor Usaha' }).filter({ hasText: 'Katalog Lokal' })
  await expect(t2).toHaveCount(1)
  const loan = await W<string>(page, `Object.values(s.loanApps.byId).find((l) => l.businessId === '${r.hero}').id`)
  await spaGo(page, `/demo/rapor-usaha?e2e=1&role=bank-mitra&focus=${r.hero}`)
  await expect(page.locator('[data-ru="bank-drawer"]')).toHaveAttribute('data-loan', loan, { timeout: 20_000 })
  await expect(page.locator('[data-ru="bank-drawer"]')).toContainText(String(await W<number>(page, `s.bizScores.byId['${r.hero}'].score`)))
  expect(errors.filter(notNoise)).toEqual([])
})
