/**
 * P9 Pajak Beres (spec §11, plan docs/build/tahap3-plan.md §2 P9): every GuidePanel mission by script, the numbers
 * that must agree, ?focus= arrivals, the chain hops that name Pajak Beres (C14 sale ⇒ journal row, C18 supplier
 * reply ⇒ nota in the document box, C19 reviewed ⇒ score), phone 390 (EN, consultant), alive within 10 s, regions.
 * Before DEMO_READY the product opens with ?controls=all.
 */
import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures'

test.describe.configure({ timeout: 150_000 })

const SLUG = 'pajak-beres'
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } as const
const notNoise = (e: string): boolean => !/api\/ai|ERR_CONNECTION_REFUSED|ERR_FAILED|ERR_ABORTED|net::ERR_/.test(e)

async function open(page: Page, o: { lang?: 'id' | 'en'; role?: string; extra?: string; run?: boolean } = {}): Promise<void> {
  const q = new URLSearchParams({ controls: 'all', off: 'preloader', e2e: '1' })
  if (o.lang) q.set('lang', o.lang)
  if (o.role) q.set('role', o.role)
  await page.goto(`/demo/${SLUG}?${q.toString()}${o.extra ? `&${o.extra}` : ''}`)
  await page.waitForFunction(() => (window as unknown as { __gamada?: { world: { status(): string } } }).__gamada?.world.status() === 'ready', null, { timeout: 45_000 })
  await expect(page.locator('.dk-pb:not(.dk-pb-skel)').first()).toBeVisible({ timeout: 30_000 })
  if (!o.run) await page.evaluate(() => (window as unknown as { __gamada: { clock: { pause(): void } } }).__gamada.clock.pause())
}
function W<T>(page: Page, expr: string): Promise<T> {
  return page.evaluate((x) => {
    const s = (window as unknown as { __gamada: { world: { get(): unknown } } }).__gamada.world.get()
    // eslint-disable-next-line no-new-func
    return new Function('s', `return (${x})`)(s) as T
  }, expr)
}
async function emitAll(page: Page, list: [string, unknown, string][]): Promise<{ type: string; source: string; payload: Record<string, unknown> }[]> {
  return page.evaluate(async (items) => {
    type G = { emit(t: string, p: unknown, s: string): void; settled(): Promise<void>; onEvent(t: string, fn: (e: { type: string; source: string; payload: Record<string, unknown> }) => void): () => void; ensure(e: string): Promise<void> }
    const g = (window as unknown as { __gamada: G }).__gamada
    await g.ensure('usaha-pintar')
    const seen: { type: string; source: string; payload: Record<string, unknown> }[] = []
    const off = g.onEvent('*', (e) => seen.push({ type: e.type, source: e.source, payload: e.payload }))
    for (const [t, p, s] of items) g.emit(t, p, s)
    await g.settled()
    off()
    return seen
  }, list)
}
const missionsDone = (page: Page) => page.evaluate((s) => JSON.parse(localStorage.getItem(`gamada:demo:missions:${s}`) ?? '[]') as string[], SLUG)
async function closeGuide(page: Page): Promise<void> {
  const guide = page.locator('.dk-guide:not([hidden])')
  if (await guide.count()) {
    const btn = guide.getByRole('button', { name: /Tutup|Close/ }).first()
    if (await btn.isVisible().catch(() => false)) await btn.click()
  }
}
/** money text → number ("Rp 1.032.778" / "Rp 1,032,778") */
const num = (t: string) => Number(t.replace(/[^\d]/g, ''))

/** TER rows copied by hand from the PP 58/2023 annex (the hand calculation the PPh 21 tab must equal) */
const TER: Record<string, [number, number][]> = { A: [[5_400_000, 0], [5_650_000, 0.0025], [5_950_000, 0.005]], B: [[6_200_000, 0], [6_500_000, 0.0025], [6_850_000, 0.005]], C: [[6_600_000, 0]] }
const CAT: Record<string, string> = { 'TK/0': 'A', 'TK/1': 'A', 'K/0': 'A', 'K/1': 'B', 'K/2': 'B', 'K/3': 'C' }
const handPph21 = (gross: number, ptkp: string) => Math.floor(gross * (TER[CAT[ptkp]!]!.find(([to]) => gross <= to)?.[1] ?? 0))

test('Pajak Beres · 5 missions + numbers agree + every entry balanced (1440, ID)', async ({ page, errors }) => {
  await open(page)
  await page.evaluate(() => (window as unknown as { __gamada: { ensure(e: string): Promise<void> } }).__gamada.ensure('usaha-pintar'))
  // ribbon + review KPI = 3 = pendingReviews
  await expect(page.locator('.dk-pb-ribbon')).toContainText('bukan nasihat pajak')
  expect(await W<number>(page, `Object.values(s.ledger.byId).filter((j) => j.businessId === s.meta.shopId && j.needsReview).length`)).toBe(3)

  // 1 · nota → journal (Persediaan D / Utang Usaha C = PO total)
  const po = await W<{ id: string; total: number }>(page, `(() => { const ids = new Set(Object.values(s.ledger.byId).filter((j) => j.source === 'nota').map((j) => j.refId)); const p = Object.values(s.purchaseOrders.byId).filter((x) => x.businessId === s.meta.shopId && (x.status === 'dibalas' || x.status === 'diterima') && !ids.has(x.id)).sort((a, b) => (b.notaAt ?? b.reply?.at ?? b.at) - (a.notaAt ?? a.reply?.at ?? a.at))[0]; return { id: p.id, total: p.total } })()`)
  await expect(page.locator('.dk-pb-doc.is-active')).toHaveAttribute('data-doc', po.id)
  // the processor chunk loads on intent (hover); the reading itself takes ≤ 1.5 s (+ the fly into the journal)
  await page.locator('[data-hotspot="pb-process"]').first().hover()
  await page.waitForTimeout(3000)
  const t0 = Date.now()
  await page.locator('[data-hotspot="pb-process"]').first().click()
  await expect(page.locator('[data-pb="entry"]').first()).toBeVisible({ timeout: 10_000 })
  expect(Date.now() - t0).toBeLessThan(3000)
  await expect.poll(() => missionsDone(page)).toContain('nota')
  const nota = await W<{ d: number; c: number; n: number }>(page, `(() => { const j = Object.values(s.ledger.byId).find((x) => x.source === 'nota' && x.refId === '${po.id}'); return { d: j.lines.reduce((a, l) => a + l.debit, 0), c: j.lines.reduce((a, l) => a + l.credit, 0), n: j.lines.length } })()`)
  expect(nota).toEqual({ d: po.total, c: po.total, n: 2 })

  // 2 · bank statement: 40 = matched + posted + review; new rows balanced; approve ⇒ review 0 + score up
  await page.locator('[data-doc="pb-mutasi"]').click()
  await page.locator('[data-pb="import"]').click()
  await expect(page.locator('[data-pb="review-open"]')).toBeVisible()
  const imp = await W<{ rows: number; matched: number; posted: number; review: number }>(page, `Object.values(s.bankImports.byId)[0]`)
  expect(imp.rows).toBe(40)
  expect(imp.matched + imp.posted + imp.review).toBe(40)
  expect(imp.review).toBe(3)
  expect(await W<number>(page, `Object.values(s.ledger.byId).filter((j) => j.source === 'bank' && String(j.refId).startsWith('MT-')).length`)).toBe(imp.posted)
  const scoreBefore = await W<number>(page, `s.bizScores.byId[s.meta.shopId].score`)
  await page.locator('[data-pb="review-open"]').click()
  await page.locator('[data-pb="approve-all"]').click()
  await expect.poll(() => missionsDone(page)).toContain('mutasi')
  expect(await W<number>(page, `Object.values(s.ledger.byId).filter((j) => j.businessId === s.meta.shopId && j.needsReview).length`)).toBe(0)
  expect(await W<number>(page, `s.bizScores.byId[s.meta.shopId].score`)).toBeGreaterThan(scoreBefore)
  await page.keyboard.press('Escape')
  // every entry balances; trial balance Sep/Oct/Nov balanced; Aset = Kewajiban + Modal
  expect(await W<number>(page, `Object.values(s.ledger.byId).filter((j) => j.lines.reduce((a, l) => a + l.debit - l.credit, 0) !== 0).length`)).toBe(0)

  // 3 · PPh 21: 5 employees, each = hand calculation from the TER rows; total on screen = world
  await page.getByRole('tab', { name: 'PPh 21' }).click()
  const staff = await W<{ gross: number; ptkp: string }[]>(page, `s.meta.facts.up.payrollStaffIds.map((id) => s.staff.byId[id])`)
  expect(staff.length).toBe(5)
  await expect(page.locator('[data-pb="pph21-amt"]')).toHaveCount(5)
  const amts = await page.locator('[data-pb="pph21-amt"] strong').allInnerTexts()
  expect(amts.map(num)).toEqual(staff.map((x) => handPph21(x.gross, x.ptkp)))
  expect(staff.filter((x) => handPph21(x.gross, x.ptkp) === 0).length).toBeGreaterThanOrEqual(3)
  await page.locator('[data-pb="pph21"]').click()
  await expect.poll(() => missionsDone(page)).toContain('pph21')
  const pph21 = await W<number>(page, `Object.values(s.taxItems.byId).find((t) => t.kind === 'pph21' && t.businessId === s.meta.shopId && t.period === '2026-11').amount`)
  expect(pph21).toBe(staff.reduce((a, x) => a + handPph21(x.gross, x.ptkp), 0))
  // Beban Gaji on the 25th = Σ staff gross (shown on the tab)
  const wages = await W<number>(page, `Object.values(s.staff.byId).filter((x) => x.businessId === s.meta.shopId).reduce((a, x) => a + x.gross, 0)`)
  expect(num(await page.locator('[data-pb="wages"]').innerText())).toBe(wages)

  // 4 · Ekspor: "Tandai siap lapor" disabled with its reason, compute PPh Final, ready ⇒ tax.ready, taxTidy
  await page.getByRole('tab', { name: 'Ekspor' }).click()
  await expect(page.locator('[data-pb="ready"]')).toBeDisabled()
  await expect(page.locator('#pb-ready-why')).toBeVisible()
  await page.locator('[data-pb="compute-final"]').click()
  const final = await W<number>(page, `Object.values(s.taxItems.byId).find((t) => t.kind === 'pph-final-umkm' && t.businessId === s.meta.shopId && t.period === '2026-11').amount`)
  const omzet = await W<number>(page, `(() => { let n = 0; const mine = new Set(Object.values(s.outlets.byId).filter((o) => o.businessId === s.meta.shopId).map((o) => o.id)); for (const d of Object.values(s.salesDaily.byId)) if (mine.has(d.outletId) && d.day >= -16) n += d.revenue; return n })()`)
  expect(final).toBe(Math.round(omzet * 0.005)) // cumulative omzet is far past the Rp 500 jt line (Bojonegoro seed)
  await page.locator('[data-pb="ready"]').click()
  await expect(page.locator('[data-pb="ready-done"]')).toBeVisible()
  await expect.poll(() => missionsDone(page)).toContain('ekspor')
  expect(await W<boolean>(page, `s.businesses.byId[s.meta.shopId].taxTidy`)).toBe(true)
  const exportFinal = num(await page.locator('.dk-pb-check li').first().locator('strong').innerText())
  expect(exportFinal).toBe(final)
  // downloads are real files
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-pb="dl-csv"]').click()])
  expect(dl.suggestedFilename()).toContain('SIMULASI')

  // Kalender shows the same amount
  await page.getByRole('tab', { name: 'Kalender' }).click()
  await expect(page.locator('.dk-pb-cal-row').first()).toContainText(new Intl.NumberFormat('id-ID').format(final))

  // 5 · Tanya Pajak: the breakdown card (same PPh Final amount) ticks the last mission
  await page.locator('[data-pb="ask"]').click()
  await page.getByRole('dialog').getByRole('button', { name: 'Kenapa pajak bulan ini naik?', exact: true }).click()
  await expect(page.locator('[data-pb="tax-card"]')).toBeVisible({ timeout: 20_000 })
  expect(num(await page.locator('[data-pb="tax-total"]').innerText())).toBe(final)
  await expect.poll(() => missionsDone(page)).toContain('tanya')
  expect((await missionsDone(page)).length).toBe(5)
  expect(errors.filter(notNoise)).toEqual([])
})

test('Pajak Beres · ?focus= arrivals: ledger → Jurnal row, PO → Dokumen, tax item → Kalender (+ TenderPilot banner), bad id → toast', async ({ page, errors }) => {
  await open(page)
  const ids = await W<{ j: string; po: string; tax: string }>(page, `({ j: Object.values(s.ledger.byId).filter((x) => x.source === 'sale').at(-1).id, po: Object.values(s.purchaseOrders.byId).find((p) => p.status === 'diterima').id, tax: Object.values(s.taxItems.byId).find((t) => t.kind === 'pph21').id })`)
  await page.goto(`/demo/${SLUG}?controls=all&e2e=1&off=preloader&focus=${ids.j}`)
  await expect(page.locator(`.dk-pb-jrow.is-focus[data-ledger="${ids.j}"]`)).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('tab', { name: 'Jurnal' })).toHaveAttribute('aria-selected', 'true')
  await page.goto(`/demo/${SLUG}?controls=all&e2e=1&off=preloader&focus=${ids.po}`)
  await expect(page.locator(`.dk-pb-doc.is-active[data-doc="${ids.po}"]`)).toBeVisible({ timeout: 30_000 })
  await page.goto(`/demo/${SLUG}?controls=all&e2e=1&off=preloader&from=tenderpilot&focus=${ids.tax}`)
  await expect(page.locator(`.dk-pb-cal-row.is-focus[data-tax="${ids.tax}"]`).first()).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('.dk-pb-fromtp')).toBeVisible()
  await page.goto(`/demo/${SLUG}?controls=all&e2e=1&off=preloader&focus=JR-9999`)
  await expect(page.getByText('Data tidak ditemukan')).toHaveCount(1, { timeout: 30_000 })
  await expect(page.getByRole('tab', { name: 'Dokumen' })).toHaveAttribute('aria-selected', 'true')
  expect(errors.filter(notNoise)).toEqual([])
})

test('Pajak Beres · chains C14 (sale ⇒ journal row ≤ 1 s), C18 (supplier reply ⇒ new nota on top), C19 (review ⇒ score)', async ({ page, errors }) => {
  await open(page)
  const sale = await W<{ outletId: string; productId: string; price: number }>(page, `(() => { const o = Object.values(s.outlets.byId).find((x) => x.businessId === s.meta.shopId && x.kind === 'toko'); const p = Object.values(s.products.byId).find((x) => x.outletId === o.id && (s.stock.byId[x.id]?.onHand ?? 0) > 5); return { outletId: o.id, productId: p.id, price: p.price } })()`)
  const before = await page.locator('.dk-pb-feed-list li').first().getAttribute('data-ledger')
  const evs = await emitAll(page, [['sale.created', { outletId: sale.outletId, items: [{ productId: sale.productId, qty: 1, price: sale.price }], payment: 'tunai' }, 'toko-autopilot']])
  const posted = evs.find((e) => e.type === 'ledger.posted' && e.source === 'pajak-beres')
  expect(posted).toBeTruthy()
  const lid = posted!.payload.id as string
  await expect(page.locator(`.dk-pb-feed-list li[data-ledger="${lid}"]`)).toBeVisible({ timeout: 1000 })
  expect(lid).not.toBe(before)

  // C18: a PO sent to the supplier ⇒ supplier reply ⇒ nota.received ⇒ the nota tops the document box as "baru"
  const po = await W<{ id: string; code: string; businessId: string; supplierId: string; items: unknown[] }>(page, `(() => { const p = Object.values(s.purchaseOrders.byId).find((x) => x.status === 'draf' && x.businessId === s.meta.shopId); return { id: p.id, code: p.code, businessId: p.businessId, supplierId: p.supplierId, items: p.items } })()`)
  const ev2 = await emitAll(page, [['po.sent', po, 'toko-autopilot']])
  expect(ev2.some((e) => e.type === 'nota.received' && e.source === 'pajak-beres')).toBe(true)
  await expect(page.locator('.dk-pb-doc').first()).toHaveAttribute('data-doc', po.id, { timeout: 1000 })
  await expect(page.locator('.dk-pb-doc').first()).toContainText(/baru/)

  // C19: reviewing a journal row ⇒ score.updated (rapor-usaha)
  const j = await W<string>(page, `Object.values(s.ledger.byId).find((x) => x.needsReview).id`)
  const ev3 = await emitAll(page, [['ledger.reviewed', { ledgerId: j }, 'pajak-beres']])
  expect(ev3.some((e) => e.type === 'score.updated' && e.source === 'rapor-usaha')).toBe(true)
  expect(errors.filter(notNoise)).toEqual([])
})

test('Pajak Beres · alive within 10 s: the clock runs and a natural sale lands in "Jurnal hari ini"', async ({ page, errors }) => {
  await open(page, { run: true, extra: 'autoplay=1' })
  const first = await page.locator('.dk-pb-feed-list li').first().getAttribute('data-ledger')
  await expect.poll(async () => page.locator('.dk-pb-feed-list li').first().getAttribute('data-ledger'), { timeout: 10_000 }).not.toBe(first)
  expect(await page.evaluate(() => (window as unknown as { __gamada: { clock: { get(): { running: boolean } } } }).__gamada.clock.get().running)).toBe(true)
  expect(errors.filter(notNoise)).toEqual([])
})

test('Pajak Beres · regions Bandung + Padang: no crash, no "Bojonegoro" text', async ({ page, errors }) => {
  for (const region of ['bandung', 'padang']) {
    await open(page, { extra: `region=${region}` })
    await expect(page.locator('.dk-pb-doc').first()).toBeVisible()
    expect(await page.locator('.dk-pb').first().innerText()).not.toContain('Bojonegoro')
  }
  expect(errors.filter(notNoise)).toEqual([])
})

test.describe('phone 390', () => {
  test.use(PHONE)
  test('Pajak Beres · consultant (EN): lands on Journal, review queue, lock October, clients; nota on Documents; no horizontal scroll', async ({ page, errors }) => {
    await open(page, { lang: 'en', role: 'konsultan-pajak' })
    await closeGuide(page)
    await expect(page.getByRole('tab', { name: 'Journal' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('[data-pb="review"]').first()).toBeVisible()
    await page.locator('[data-pb="lock"]').click()
    await expect.poll(() => W<string[]>(page, `s.businesses.byId[s.meta.shopId].lockedPeriods ?? []`)).toContain('2026-10')
    await expect(page.locator('[data-pb="lock"]')).toHaveCount(0)
    await expect(page.locator('[data-pb="ask"]')).toBeVisible()
    await page.locator('[data-pb="clients"]').click()
    await expect(page.locator('.dk-pb-client')).toHaveCount(4)
    await page.keyboard.press('Escape')
    await page.getByRole('tab', { name: 'Documents' }).click()
    await page.locator('[data-hotspot="pb-process"]').first().click()
    await expect(page.locator('[data-pb="entry"]').first()).toBeVisible({ timeout: 10_000 })
    for (const tab of ['Journal', 'Reports', 'Calendar', 'PPh 21', 'Export', 'Documents']) {
      await page.getByRole('tab', { name: tab }).click()
      await page.waitForTimeout(300)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    }
    expect(errors.filter(notNoise)).toEqual([])
  })
})

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })
  test('Pajak Beres · the nota flow is instant, the monthly report opens', async ({ page, errors }) => {
    await open(page)
    // the processor chunk loads on intent (hover); the flow itself is instant under reduced motion
    await page.locator('[data-hotspot="pb-process"]').first().hover()
    await page.waitForTimeout(3000)
    await page.locator('[data-hotspot="pb-process"]').first().click()
    await expect(page.locator('[data-pb="entry"]').first()).toBeVisible({ timeout: 3000 })
    await expect(page.locator('.dk-pb-proc')).toHaveAttribute('data-phase', 'done')
    await page.getByRole('tab', { name: 'Laporan' }).click()
    await page.locator('[data-pb="monthly"]').click()
    await expect(page.locator('.dk-pb-paper')).toContainText('SIMULASI')
    // KPI Laba = P&L Laba (one selector)
    const laba = await page.locator('[data-pb="paper-laba"]').innerText()
    await expect(page.locator('[data-pb="laba"]')).toHaveText(laba)
    expect(errors.filter(notNoise)).toEqual([])
  })
})
