/**
 * Tahap 3 · Usaha Pintar cross-product chains through the REAL product UIs (docs/build/tahap3-plan.md §3, C14–C29 +
 * state links L1/L2). The root is emitted on the page of the product that owns the action (source = that product, as
 * its own button does), and the follow-up is checked where the visitor would see it, reached the way a visitor would:
 * the cross-product toast (now that the six demos are DEMO_READY, a real link with ?focus=) or an in-app navigation
 * (the world stays in memory). tests/e2e/chains.spec.ts keeps the world-level contract of the same chains; each
 * product spec covers its own hops and ?focus= arrivals in depth.
 */
import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures'
import { W, emit, notNoise, openDemo, spaGo } from '../tahap2/helpers'

test.describe.configure({ timeout: 120_000 })

/** the scenario flood (Siaga Wilayah early warning) on the flood kecamatan of the pack */
async function flood(page: Page): Promise<void> {
  const kecamatanIds = await W<string[]>(page, 's.region.floodKecamatanIds')
  await emit(page, 'flood.alert', { level: 3, kecamatanIds }, 'siaga-wilayah')
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

test('C14 · a Toko Autopilot sale ⇒ one toast to Pajak Beres ⇒ the journal row opens there', async ({ page, errors }) => {
  await openDemo(page, 'toko-autopilot')
  const sale = await W<{ outletId: string; productId: string; price: number; before: string[] }>(
    page,
    `(() => { const o = Object.values(s.outlets.byId).find((x) => x.businessId === s.meta.shopId && x.kind === 'toko'); const p = Object.values(s.products.byId).find((x) => x.outletId === o.id && (s.stock.byId[x.id]?.onHand ?? 0) > 5); return { outletId: o.id, productId: p.id, price: p.price, before: s.ledger.ids.slice() } })()`,
  )
  await emit(page, 'sale.created', { outletId: sale.outletId, items: [{ productId: sale.productId, qty: 1, price: sale.price }], payment: 'tunai' }, 'toko-autopilot')
  const ledgerId = await W<string>(page, `s.ledger.ids.find((id) => !${JSON.stringify(sale.before)}.includes(id) && s.ledger.byId[id].source === 'sale')`)
  expect(ledgerId).toBeTruthy()
  const urls = await follow(page, 'Pajak Beres')
  await expect(page).toHaveURL(/\/demo\/pajak-beres\?/)
  await expect.poll(() => urls.some((u) => u.includes(`focus=${ledgerId}`))).toBe(true)
  await expect(page.getByRole('tab', { name: 'Jurnal' })).toHaveAttribute('aria-selected', 'true', { timeout: 20_000 })
  await expect(page.locator(`.dk-pb-jrow[data-ledger="${ledgerId}"]`)).toBeVisible()
  expect(errors.filter(notNoise)).toEqual([])
})

test('C15–C18 · flood ⇒ PO drafts; PO sent ⇒ supplier reply + one toast to Juara Jualan and Pajak Beres ⇒ the WA pre-order chat', async ({ page, errors }) => {
  await openDemo(page, 'toko-autopilot')
  await flood(page)
  const po = await W<{ id: string; code: string; businessId: string; supplierId: string; items: unknown[] }>(
    page,
    `(() => { const p = Object.values(s.purchaseOrders.byId).find((x) => x.status === 'draf' && x.businessId === s.meta.shopId); return { id: p.id, code: p.code, businessId: p.businessId, supplierId: p.supplierId, items: p.items } })()`,
  )
  await emit(page, 'po.sent', po, 'toko-autopilot')
  // C16: the supplier answers in the PO chat (no cross toast); C17 + C18 share ONE toast (one root)
  await expect.poll(() => W<string>(page, `s.purchaseOrders.byId['${po.id}'].status`)).toBe('dibalas')
  const toast = page.locator('.dk-toast').filter({ hasText: po.code })
  await expect(toast).toHaveCount(1)
  await expect(toast).toContainText('Juara Jualan')
  await expect(toast).toContainText('Pajak Beres')
  const callId = await W<string>(page, `Object.values(s.calls.byId).find((c) => c.refId === '${po.id}').id`)
  expect(await W<boolean>(page, `Object.values(s.purchaseOrders.byId).some((p) => p.id === '${po.id}' && p.notaAt != null)`)).toBe(true)
  const urls = await follow(page, po.code)
  await expect(page).toHaveURL(/\/demo\/juara-jualan\?/)
  await expect.poll(() => urls.some((u) => u.includes(`focus=${callId}`))).toBe(true)
  await expect(page.locator(`.dk-jj-detail[data-call="${callId}"]`)).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('.dk-jj-tx')).toContainText(po.code)
  // C18 landing: the nota of that PO is in the Pajak Beres inbox
  await spaGo(page, `/demo/pajak-beres?e2e=1&focus=${po.id}`)
  await expect(page.locator(`.dk-pb-doc.is-active[data-doc="${po.id}"]`)).toBeVisible({ timeout: 20_000 })
  expect(errors.filter(notNoise)).toEqual([])
})

test('C21–C24 + C26 + C28 · one Siaga Wilayah flood reaches TenderPilot, Awas Belanja, Kenal Mitra, Pantau Merek and Toko Autopilot', async ({ page, errors }) => {
  await openDemo(page, 'siaga-wilayah')
  await flood(page)
  const toast = page.locator('.dk-toast').first()
  await expect(toast).toBeVisible()
  const ids = await W<{ tender: string; pump: string; p: number; pumpP: number; proc: string; req: string; alert: string; alertAt: number }>(
    page,
    `(() => { const t = Object.values(s.tenders.byId).find((x) => x.key === 'karung-terpal-darurat'); const pm = Object.values(s.tenders.byId).find((x) => x.key === 'pompa-darurat' && x.procurementId); const pk = Object.values(s.procurements.byId).find((x) => x.key === 'karung-terpal-darurat'); const r = Object.values(s.verificationRequests.byId).find((v) => v.priority && v.subjectId === s.meta.facts.up.kenalMitra.heroBusinessId); const a = Object.values(s.brandAlerts.byId)[0]; return { tender: t.id, pump: pm.id, p: t.matches[s.meta.shopId], pumpP: pm.matches[s.meta.shopId], proc: pk.id, req: r.id, alert: a.id, alertAt: a.at } })()`,
  )
  expect(ids.p).toBe(0.78)
  expect(ids.pumpP).toBeLessThan(0.3)
  // C22: TenderPilot opens the emergency tender (chance 78 %); C24: the pump mirror is in the feed as a low chance
  await spaGo(page, `/demo/tenderpilot?e2e=1&focus=${ids.tender}`)
  await expect(page.locator(`.dk-tp-detail[data-tender="${ids.tender}"]`)).toBeVisible({ timeout: 20_000 })
  await expect(page.locator(`.dk-tp-detail[data-tender="${ids.tender}"]`)).toContainText('78')
  // C23: the emergency package is in the Awas Belanja list (clean spec, no bidders yet)
  await spaGo(page, `/demo/awas-belanja?e2e=1&focus=${ids.proc}`)
  await expect(page.locator('.dk-ab-dtitle')).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('.dk-ab').getByText('37.750.000').first()).toBeVisible()
  // C26: the priority KYB of the hero vendor opens in Kenal Mitra
  await spaGo(page, `/demo/kenal-mitra?e2e=1&focus=${ids.req}`)
  await expect(page.locator(`[data-case="${ids.req}"]`)).toHaveAttribute('aria-current', 'true', { timeout: 20_000 })
  // C28: the brand alert (6 min after the flood) opens in Pantau Merek once its time has come
  await page.evaluate((m) => (window as unknown as { __gamada: { clock: { setTime(t: number): void } } }).__gamada.clock.setTime(m), ids.alertAt + 1)
  await spaGo(page, `/demo/pantau-merek?e2e=1&autoplay=0&focus=${ids.alert}`)
  await expect(page.locator(`[data-pm="alert"][data-id="${ids.alert}"]`)).toBeVisible({ timeout: 20_000 })
  // C5 / C15 / L5: Toko Autopilot shows the flood banner and the brand chip
  await spaGo(page, '/demo/toko-autopilot?e2e=1')
  await expect(page.locator('.dk-ta-region [data-tour="flood-banner"]')).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('[data-ta="brand-chip"]')).toBeVisible()
  expect(errors.filter(notNoise)).toEqual([])
})

test('C25 · a TenderPilot bid ⇒ toast to Awas Belanja ⇒ the bid row of the emergency package', async ({ page, errors }) => {
  await openDemo(page, 'tenderpilot')
  await flood(page)
  const t = await W<{ id: string; shop: string }>(page, `({ id: Object.values(s.tenders.byId).find((x) => x.key === 'karung-terpal-darurat').id, shop: s.meta.shopId })`)
  await emit(page, 'bid.submitted', { tenderId: t.id, businessId: t.shop, price: 35_900_000, pages: 34 }, 'tenderpilot')
  await follow(page, 'Awas Belanja')
  await expect(page).toHaveURL(/\/demo\/awas-belanja\?/)
  await expect(page.locator('.dk-ab-dtitle')).toBeVisible({ timeout: 20_000 })
  await page.locator('.dk-ab').getByRole('tab', { name: /Peserta/ }).click()
  await expect(page.locator('.dk-ab').getByText('35.900.000').first()).toBeVisible({ timeout: 10_000 })
  expect(errors.filter(notNoise)).toEqual([])
})

test('C27 + L2 · only a KYB lolos raises the vendor toast (TenderPilot); KYC and a CV batch raise none', async ({ page, errors }) => {
  await openDemo(page, 'kenal-mitra')
  await flood(page)
  const who = await W<{ siti: string; hero: string }>(page, `({ siti: s.meta.personas.siti, hero: s.meta.facts.up.kenalMitra.heroBusinessId })`)
  await emit(page, 'partner.verified', { subjectKind: 'citizen', subjectId: who.siti, kind: 'kyc', result: 'lolos', score: 92 }, 'kenal-mitra')
  for (let i = 1; i <= 3; i++) await emit(page, 'partner.verified', { subjectKind: 'candidate', subjectId: `cv-000${i}`, kind: 'cv', result: 'lolos', score: 80 + i }, 'kenal-mitra')
  await page.waitForTimeout(800)
  await expect(page.locator('.dk-toast')).toHaveCount(0)
  await emit(page, 'partner.verified', { subjectKind: 'business', subjectId: who.hero, kind: 'kyb', result: 'lolos', score: 91 }, 'kenal-mitra')
  // C27: the hero's catalog match is recorded (Katalog Lokal, tahap 4)
  expect(await W<boolean>(page, `Object.values(s.matches.byId).some((m) => m.businessId === '${who.hero}')`)).toBe(true)
  expect(await W<boolean>(page, `s.businesses.byId['${who.hero}'].verified`)).toBe(true)
  await follow(page, 'TenderPilot')
  await expect(page).toHaveURL(/\/demo\/tenderpilot\?/)
  await expect(page.locator('.dk-tp-detail').first()).toBeVisible({ timeout: 20_000 })
  expect(errors.filter(notNoise)).toEqual([])
})

test('C29 · a Pantau Merek service notice on receipts ⇒ toast to Toko Autopilot ⇒ the Kasir banner', async ({ page, errors }) => {
  await openDemo(page, 'pantau-merek', { extra: 'autoplay=0' })
  await flood(page)
  const a = await W<{ id: string; at: number; biz: string }>(page, `(() => { const a = Object.values(s.brandAlerts.byId)[0]; return { id: a.id, at: a.at, biz: s.meta.shopId } })()`)
  await page.evaluate((m) => (window as unknown as { __gamada: { clock: { setTime(t: number): void } } }).__gamada.clock.setTime(m), a.at + 1)
  await emit(
    page,
    'brand.announced',
    { businessId: a.biz, alertId: a.id, topic: 'pengiriman', text: { id: 'Pengiriman ke desa terdampak banjir dijadwal ulang besok pagi', en: 'Deliveries to flooded villages move to tomorrow morning' }, channels: ['marketplace', 'struk'], offer: 'jadwal-ulang', by: 'brand-manager' },
    'pantau-merek',
  )
  expect(await W<string>(page, `s.brandAlerts.byId['${a.id}'].status`)).toBe('ditangani')
  await follow(page, 'Toko Autopilot')
  await expect(page).toHaveURL(/\/demo\/toko-autopilot\?/)
  await expect(page.locator('#dk-ta-tab-kasir')).toHaveAttribute('aria-selected', 'true', { timeout: 20_000 })
  await expect(page.locator('[data-ta="pos-notice"]')).toContainText('dijadwal ulang besok pagi')
  expect(errors.filter(notNoise)).toEqual([])
})

test('C19 + L1 · Pajak Beres review ⇒ Rapor score; tax status ready ⇒ one toast to TenderPilot ⇒ the matched tender', async ({ page, errors }) => {
  await openDemo(page, 'pajak-beres')
  await flood(page)
  const r = await W<{ ledgerId: string; shop: string; period: string; tender: string }>(
    page,
    `({ ledgerId: Object.values(s.ledger.byId).find((j) => j.needsReview).id, shop: s.meta.shopId, period: s.day.slice(0, 7), tender: Object.values(s.tenders.byId).find((x) => x.key === 'karung-terpal-darurat').id })`,
  )
  const at0 = await W<number | null>(page, 's.bizScores.byId[s.meta.shopId]?.updatedAt ?? null')
  await emit(page, 'ledger.reviewed', { ledgerId: r.ledgerId }, 'pajak-beres')
  expect(await W<boolean>(page, `s.ledger.byId['${r.ledgerId}'].needsReview === false && s.ledger.byId['${r.ledgerId}'].reviewed === true`)).toBe(true)
  // C19: 'ledger-reviewed→score' moves the Rapor Usaha score (demo tahap 4)
  expect(await W<number | null>(page, 's.bizScores.byId[s.meta.shopId]?.updatedAt ?? null')).not.toBe(at0)
  await emit(page, 'tax.ready', { businessId: r.shop, period: r.period }, 'pajak-beres')
  expect(await W<boolean>(page, 's.businesses.byId[s.meta.shopId].taxTidy')).toBe(true)
  const urls = await follow(page, 'TenderPilot')
  await expect(page).toHaveURL(/\/demo\/tenderpilot\?/)
  await expect.poll(() => urls.some((u) => u.includes(`focus=${r.tender}`))).toBe(true)
  await expect(page.locator(`.dk-tp-detail[data-tender="${r.tender}"]`)).toBeVisible({ timeout: 20_000 })
  expect(errors.filter(notNoise)).toEqual([])
})
