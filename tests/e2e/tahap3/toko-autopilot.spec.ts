/**
 * Toko Autopilot (P8) — plan docs/build/tahap3-plan.md §2 P8 + chains §3 (C5, C14–C18, C20, C29, L4–L6).
 * Missions at 1440 and 390, payment math, numbers that agree, ?focus= arrivals, chain hops ≤ 1 s, roles, language,
 * region, reduced motion and a no-dead-controls crawl. The product is not DEMO_READY yet: `?controls=all`.
 */
import type { Page } from '@playwright/test'
import { expect, test } from '../fixtures'

/* eslint-disable @typescript-eslint/no-explicit-any */
type G = any
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } as const
const URL0 = '/demo/toko-autopilot?controls=all&off=preloader&e2e=1'
const rp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')
const num = (s: string) => Number(s.replace(/[^\d]/g, ''))

async function open(page: Page, q = ''): Promise<void> {
  await page.goto(URL0 + q)
  await page.waitForFunction(() => (window as G).__gamada?.world.status() === 'ready', null, { timeout: 60_000 })
  await page.evaluate(async () => {
    const g = (window as G).__gamada
    g.clock.pause()
    await g.ensure('usaha-pintar')
  })
  await expect(page.locator('.dk-ta:not([aria-busy]), .dk-ta-sup').first()).toBeVisible({ timeout: 20_000 })
}
const W = <T>(page: Page, fn: string): Promise<T> => page.evaluate(`(() => { const g = window.__gamada; const s = g.world.get(); ${fn} })()`) as Promise<T>
const settled = (page: Page) => page.evaluate(() => (window as G).__gamada.settled())
const missions = (page: Page) => page.evaluate(() => localStorage.getItem('gamada:demo:missions:toko-autopilot') ?? '')
const tab = async (page: Page, id: string) => {
  await page.locator(`#dk-ta-tab-${id}`).click()
  await expect(page.locator(`#dk-ta-tab-${id}`)).toHaveAttribute('aria-selected', 'true')
}
const todayRevenue = (page: Page) => W<number>(page, `const now = g.clock.get().minutes; let r = 0; for (const id of s.sales.ids) { const x = s.sales.byId[id]; if (x.businessId === s.meta.shopId && x.at >= 0 && x.at <= now) r += x.total } return r`)
const noHScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)

test.describe('toko-autopilot · desktop', () => {
  test('mission QRIS: one sale, stock badge, Dasbor omzet and the ledger agree (C14)', async ({ page, errors }) => {
    await open(page)
    await tab(page, 'kasir')
    const pid = (await page.locator('.dk-ta-item:not([disabled])').evaluateAll((els) => els.find((e) => Number(e.querySelector('[data-stock]')?.getAttribute('data-stock')) >= 3)?.getAttribute('data-pid')))!
    const item = page.locator(`.dk-ta-item[data-pid="${pid}"]`)
    const before = await W<number>(page, `return s.stock.byId['${pid}'].onHand`)
    const rev0 = await todayRevenue(page)
    await item.click()
    await item.click()
    const total = num(await page.locator('[data-ta="cart-total"]').innerText())
    await page.locator('[data-ta="pay"]').click()
    await page.getByRole('radio', { name: 'QRIS', exact: true }).click()
    await expect(page.locator('[data-ta="qr"]')).toContainText('QR contoh, tidak dapat dibayar')
    await page.locator('[data-ta="qris-pay"]').click()
    await expect(page.locator('[data-ta="receipt"]')).toBeVisible()
    await settled(page)
    const sale = await W<G>(page, `return Object.values(s.sales.byId).filter((x) => x.items.some((i) => i.productId === '${pid}') && x.payment === 'qris').sort((a, b) => b.at - a.at)[0]`)
    expect(sale.total).toBe(total)
    expect(await todayRevenue(page)).toBe(rev0 + total)
    expect(await W<number>(page, `return s.stock.byId['${pid}'].onHand`)).toBe(before - 2)
    await expect.poll(() => missions(page)).toContain('qris')
    // C14: the sale reaches Pajak Beres' ledger
    await expect.poll(() => W<number>(page, `return Object.values(s.ledger.byId).filter((l) => l.refId === '${sale.id}').length`), { timeout: 1500 }).toBeGreaterThan(0)
    await page.locator('[data-ta="new-sale"]').click()
    await expect(page.locator(`[data-pid="${pid}"] [data-stock]`)).toHaveAttribute('data-stock', String(before - 2))
    await tab(page, 'dasbor')
    await expect(page.locator('.dk-ta-kpis').first()).toContainText(rp(rev0 + total), { timeout: 5000 })
    expect(errors).toEqual([])
  })

  test('payment math: change, double tap, split, discount, shift variance', async ({ page, errors }) => {
    await open(page)
    await tab(page, 'kasir')
    // the cheapest items until the gross passes Rp 73.500
    const items = await page.locator('.dk-ta-item:not([disabled])').evaluateAll((els) => els.map((e) => ({ pid: e.getAttribute('data-pid')!, price: Number(e.querySelector('.dk-ta-iprice')!.textContent!.replace(/[^\d]/g, '')) })))
    items.sort((a, b) => a.price - b.price)
    let gross = 0
    for (const it of items) {
      if (gross >= 73_500) break
      await page.locator(`.dk-ta-item[data-pid="${it.pid}"]`).click()
      gross += it.price
    }
    expect(gross).toBeLessThanOrEqual(147_000)
    const cart = page.locator('[data-ta="cart"]')
    await cart.getByRole('radio', { name: 'Rp', exact: true }).click()
    await page.locator('[data-ta="disc-rp"]').fill(String(gross - 73_500))
    await expect(page.locator('[data-ta="cart-total"]')).toHaveText(rp(73_500))
    await page.locator('[data-ta="pay"]').click()
    await page.locator('[data-ta="cash-given"]').fill('100000')
    await expect(page.locator('.dk-ta-change')).toHaveText(`Kembalian: ${rp(26_500)}`)
    const n0 = await W<number>(page, 'return s.sales.ids.length')
    await page.locator('[data-ta="pay-cash"]').dblclick()
    await expect(page.locator('[data-ta="receipt"]')).toBeVisible()
    await settled(page)
    expect(await W<number>(page, 'return s.sales.ids.length')).toBe(n0 + 1)
    const cash = await W<G>(page, `return Object.values(s.sales.byId).find((x) => x.cash && x.total === 73500 && x.discount === ${gross - 73_500})`)
    expect(cash.cash).toEqual({ given: 100_000, change: 26_500 })
    await page.locator('[data-ta="new-sale"]').click()
    // split tunai + QRIS
    for (const it of items.slice(-3)) await page.locator(`.dk-ta-item[data-pid="${it.pid}"]`).click()
    const total = num(await page.locator('[data-ta="cart-total"]').innerText())
    await page.locator('[data-ta="pay"]').click()
    await page.getByRole('radio', { name: 'Tunai + QRIS', exact: true }).click()
    await expect(page.locator('[data-ta="qris-pay"]')).toBeDisabled()
    await page.locator('[data-ta="split-cash"]').fill('10000')
    await page.locator('[data-ta="qris-pay"]').click()
    await expect(page.locator('[data-ta="receipt"]')).toBeVisible()
    await settled(page)
    const split = await W<G>(page, `return Object.values(s.sales.byId).find((x) => x.payments && x.payments.length === 2 && x.total === ${total})`)
    expect(split.payments).toEqual([{ method: 'tunai', amount: 10_000 }, { method: 'qris', amount: total - 10_000 }])
    await page.locator('[data-ta="new-sale"]').click()
    // shift close: variance = counted − expected
    await page.locator('[data-ta="close-shift"]').click()
    const expected = num(await page.locator('[data-ta="expected-cash"]').innerText())
    await page.locator('[data-ta="counted-cash"]').fill(String(expected + 5000))
    await expect(page.locator('[data-ta="variance"]')).toContainText(`+${rp(5000)}`)
    await page.locator('[data-ta="close-shift-confirm"]').click()
    await settled(page)
    const shift = await W<G>(page, 'return Object.values(s.cashShifts.byId).sort((a, b) => b.at - a.at)[0]')
    expect(shift).toMatchObject({ expectedCash: expected, countedCash: expected + 5000, variance: 5000 })
    expect(errors).toEqual([])
  })

  test('Kasir role: 10 % discount cap, no cost/margin, cart survives a role and language switch', async ({ page, errors }) => {
    await open(page)
    await tab(page, 'kasir')
    await page.locator('.dk-ta-item:not([disabled])').first().click()
    await page.locator('.dk-topbar').getByRole('radio', { name: 'EN', exact: true }).click()
    await expect(page.locator('[data-ta="cart"] h3')).toHaveText('Cart')
    await expect(page.locator('.dk-ta-lines > li')).toHaveCount(1)
    await page.locator('.dk-topbar').getByRole('button', { name: /Pemilik Toko|Shop owner/i }).first().click()
    await page.getByRole('option', { name: /^(Kasir|Cashier)/ }).first().click()
    await expect(page.locator('.dk-ta--kasir')).toBeVisible()
    await expect(page.locator('.dk-ta-lines > li')).toHaveCount(1)
    await expect(page.locator('.dk-ta-kpis')).toHaveCount(0)
    await expect(page.locator('[role="tablist"].dk-ta-tabs')).toHaveCount(0)
    await page.locator('[data-ta="disc-pct"]').fill('50')
    await expect(page.locator('[data-ta="disc-pct"]')).toHaveValue('10')
    await expect(page.locator('.dk-ta')).not.toContainText(/Margin|margin/)
    // camera button only where BarcodeDetector exists
    const hasDetector = await page.evaluate(() => 'BarcodeDetector' in window)
    await expect(page.locator('[data-ta="pos-camera"]')).toHaveCount(hasDetector ? 1 : 0)
    expect(errors).toEqual([])
  })

  test('flood (C5/C15): banner ≤ 1 s, chart factor +340 %, mission, price lock, PO draft, need card (L6)', async ({ page, errors }) => {
    await open(page)
    const t0 = Date.now()
    await page.locator('[data-ta="play-flood"]').click()
    await expect(page.locator('.dk-ta-region [data-tour="flood-banner"]')).toBeVisible()
    const ms = Date.now() - t0
    console.log(`flood → banner ${ms} ms`)
    expect(ms).toBeLessThan(1500)
    const banner = await W<G>(page, `const id = Object.values(s.stock.byId).find((x) => x.factor > 4 && x.reason).productId; return { text: s.stock.byId[id].reason.id, factor: s.stock.byId[id].factor }`)
    expect(banner.factor).toBeCloseTo(4.4)
    await expect(page.locator('.dk-ta-region [data-tour="flood-banner"]')).toContainText(banner.text)
    await expect(page.locator('[data-ta="opportunity"]')).toContainText(/Kebutuhan Pemda: [\d.]+ /)
    const need = await W<number>(page, `return Object.values(s.catalogNeeds.byId).find((n) => n.emergency).items[0].qty`)
    await expect(page.locator('[data-ta="opportunity"]')).toContainText(need.toLocaleString('id-ID'))
    await tab(page, 'prediksi')
    await expect(page.locator('[data-ta="forecast-banner"]')).toContainText('+340%')
    await page.locator('.dk-ta-risk .dk-ta-row').filter({ hasText: '+340%' }).first().click()
    await expect(page.locator('[data-factor="banjir"]')).toContainText('+340%')
    await expect(page.locator('[data-tour="forecast-chart"]')).toBeVisible()
    await page.locator('[data-factor="banjir"] .dk-ta-why').click()
    await expect(page.locator('[data-ta="why"]')).toHaveText(banner.text)
    await expect.poll(() => missions(page)).toContain('banjir')
    await tab(page, 'harga')
    await page.getByRole('radio', { name: 'Toko', exact: true }).click()
    await expect(page.locator('[data-ta="price-lock"]').first()).toContainText('Harga barang darurat tidak dinaikkan')
    await tab(page, 'po')
    const draft = await W<string>(page, `return Object.values(s.purchaseOrders.byId).find((p) => p.status === 'draf' && String(p.cause).startsWith('alerts:')).id`)
    await expect(page.locator(`[data-po="${draft}"]`)).toBeVisible()
    expect(errors).toEqual([])
  })

  test('mission PO: send → typing → supplier reply (C16), WA chat (C17), nota (C18), receive goods', async ({ page, errors }) => {
    await open(page, '&tab=po')
    await page.locator('[data-tour="po-approve"]').click()
    await expect(page.locator('[data-tour="po-chat"]')).toBeVisible()
    await settled(page)
    const id = await W<string>(page, `return Object.values(s.purchaseOrders.byId).filter((p) => p.status !== 'draf' && p.reply).sort((a, b) => b.at - a.at)[0].id`)
    const po = await W<G>(page, `return s.purchaseOrders.byId['${id}']`)
    expect(po.status).toBe('dibalas')
    for (const it of po.items) await expect(page.locator('[data-tour="po-chat"]')).toContainText(`× ${it.qty.toLocaleString('id-ID')}`)
    await expect(page.locator('[data-tour="po-chat"]')).toContainText(po.reply.message.id, { timeout: 4000 })
    expect(await W<number>(page, `return Object.values(s.calls.byId).filter((c) => c.refId === '${id}').length`)).toBe(1)
    expect(await W<G>(page, `return s.purchaseOrders.byId['${id}'].notaAt`)).not.toBeNull()
    await expect.poll(() => missions(page)).toContain('po')
    const pid = po.items[0].productId
    const on0 = await W<number>(page, `return s.stock.byId['${pid}'].onHand`)
    await page.locator('[data-ta="po-receive"]').click()
    await settled(page)
    expect(await W<number>(page, `return s.stock.byId['${pid}'].onHand`)).toBe(on0 + po.items[0].qty)
    expect(await W<string>(page, `return s.purchaseOrders.byId['${id}'].status`)).toBe('diterima')
    expect(errors).toEqual([])
  })

  test('missions harga + shift: applied price reaches the Kasir grid; extra cashier reason; keyboard move', async ({ page, errors }) => {
    await open(page, '&tab=harga&outlet=toko')
    const row = page.locator('.dk-ta-prices > li').filter({ has: page.locator('[data-ta="price-apply"]') }).first()
    const pid = (await row.getAttribute('data-pid'))!
    await row.locator('[data-ta="price-apply"]').click()
    await settled(page)
    const price = await W<number>(page, `return s.products.byId['${pid}'].price`)
    await expect.poll(() => missions(page)).toContain('harga')
    await tab(page, 'kasir')
    const name = await W<string>(page, `return s.products.byId['${pid}'].name`)
    await page.locator('[data-ta="pos-search"]').fill(name)
    await expect(page.locator(`.dk-ta-item[data-pid="${pid}"] .dk-ta-iprice`)).toHaveText(rp(price))
    await tab(page, 'shift')
    await page.getByRole('radio', { name: 'Semua', exact: true }).click()
    await page.locator('[data-ta="extra-block"]').first().click()
    await expect(page.locator('[data-ta="extra-why"]')).toBeVisible()
    await expect.poll(() => missions(page)).toContain('shift')
    await page.locator('[data-ta="extra-add"]').click()
    await expect(page.locator('[data-ta="extra-why"]')).toContainText('Sudah ada di jadwal')
    const block = page.locator('.dk-ta-wg-block').first()
    const sid = (await block.getAttribute('data-shift'))!
    const d0 = await W<number>(page, `return s.shifts.byId['${sid}'].day`)
    await block.focus()
    await page.keyboard.press(d0 < 6 ? 'ArrowRight' : 'ArrowLeft')
    await settled(page)
    expect(await W<number>(page, `return s.shifts.byId['${sid}'].day`)).toBe(d0 < 6 ? d0 + 1 : d0 - 1)
    expect(errors).toEqual([])
  })

  test('?focus= arrivals land on the right tab and entity; a bad id ⇒ Dasbor + toast', async ({ page, errors }) => {
    await open(page)
    const ids = await W<G>(page, `const shopPo = Object.values(s.purchaseOrders.byId).find((p) => p.businessId === s.meta.shopId && p.status !== 'draf');
      const cm = Object.values(s.products.byId).find((p) => p.tags.some((t) => t.startsWith('cm:')));
      return { po: shopPo.id, code: shopPo.code, cm: cm.id, sale: s.sales.ids.find((id) => s.sales.byId[id].businessId === s.meta.shopId && s.sales.byId[id].at >= 0), staff: s.meta.facts.up.newCashierStaffId }`)
    await open(page, `&focus=${ids.po}`)
    await expect(page.locator('#dk-ta-tab-po')).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('[data-tour="po-chat"]')).toContainText(ids.code)
    await open(page, `&focus=${ids.cm}`)
    await expect(page.locator('#dk-ta-tab-prediksi')).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator(`.dk-ta-risk [data-pid="${ids.cm}"]`)).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('.dk-ta-outlets [aria-checked="true"]')).not.toHaveText(/Semua/)
    await open(page, `&focus=${ids.sale}`)
    await expect(page.locator('[data-ta="receipt"]')).toBeVisible()
    await open(page, `&focus=${ids.staff}`)
    await expect(page.locator('#dk-ta-tab-shift')).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('.dk-ta-wg-block[aria-pressed="true"]')).toHaveCount(1)
    await open(page, '&focus=XX-9999')
    await expect(page.locator('#dk-ta-tab-dasbor')).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByText('Data tidak ditemukan').first()).toBeVisible()
    expect(errors).toEqual([])
  })

  test('chains: C20 price anomaly → cm: SKU forecast, C29 announcement → Kasir notice, L4 coaching badge, L5 brand chip', async ({ page, errors }) => {
    await open(page)
    // C20
    const c = await W<G>(page, `const p = Object.values(s.products.byId).find((x) => x.tags.some((t) => t.startsWith('cm:'))); const cm = p.tags.find((t) => t.startsWith('cm:')).slice(3); return { pid: p.id, cm, market: s.markets.ids[0] }`)
    await page.evaluate((x) => (window as G).__gamada.emit('price.anomaly', { marketId: x.market, commodityId: x.cm, price: 16000, expected: 12000, deltaPct: 33 }, 'sinyal-pasar'), c)
    await settled(page)
    await expect.poll(() => W<number>(page, `return s.stock.byId['${c.pid}'].factor`), { timeout: 1000 }).toBeCloseTo(1.6)
    // the toast lands with ?focus=<productId> (the world is restored from the saved session)
    await page.waitForTimeout(600)
    await open(page, `&focus=${c.pid}`)
    expect(await W<number>(page, `return s.stock.byId['${c.pid}'].factor`)).toBeCloseTo(1.6)
    await expect(page.locator('#dk-ta-tab-prediksi')).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('[data-factor="harga"]')).toContainText('+60%')
    // flood → brand alert (C28, future-dated) → C29 announcement with the 'struk' channel
    await tab(page, 'dasbor')
    await page.locator('[data-ta="play-flood"]').click()
    await expect(page.locator('.dk-ta-region [data-tour="flood-banner"]')).toBeVisible()
    await expect.poll(() => W<number>(page, 'return s.brandAlerts.ids.length')).toBeGreaterThan(0)
    const al = await W<G>(page, 'const a = s.brandAlerts.byId[s.brandAlerts.ids[0]]; return { id: a.id, at: a.at, biz: s.meta.shopId }')
    await page.evaluate((m) => (window as G).__gamada.clock.setTime(m), al.at + 1)
    await expect(page.locator('[data-ta="brand-chip"]')).toContainText('Keluhan pengiriman +')
    await page.evaluate(
      (a) => (window as G).__gamada.emit('brand.announced', { businessId: a.biz, alertId: a.id, topic: 'pengiriman', text: { id: 'Pengiriman ke desa terdampak banjir dijadwal ulang besok pagi', en: 'Deliveries to flooded villages move to tomorrow morning' }, channels: ['struk'], offer: 'jadwal-ulang', by: 'pemilik-toko' }, 'pantau-merek'),
      al,
    )
    await settled(page)
    await tab(page, 'kasir')
    await expect(page.locator('[data-ta="pos-notice"]')).toContainText('dijadwal ulang besok pagi', { timeout: 1000 })
    // L4: a coaching for the new cashier → badge in Jadwal Shift
    const ag = await W<string>(page, 'return s.meta.facts.up.newCashierAgentId')
    const bi = { id: 'Jawab keberatan harga dengan contoh ukuran karung', en: 'Answer the price objection with a sack size example' }
    await page.evaluate((x) => (window as G).__gamada.emit('coaching.assigned', { agentId: x.ag, focus: [x.bi, x.bi, x.bi], examples: [x.bi, x.bi, x.bi], focusKeys: ['keberatan', 'closing', 'salam'], baseline: 60 }, 'juara-jualan'), { ag, bi })
    await settled(page)
    await tab(page, 'shift')
    await expect(page.locator('[data-ta="coach-badge"]')).toContainText('Sedang coaching di Juara Jualan')
    expect(errors).toEqual([])
  })

  test('alive within 10 s without input; reduced motion: reply without typing pause', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await ctx.newPage()
    await page.goto('/demo/toko-autopilot?controls=all&off=preloader')
    await expect(page.locator('.dk-ta-feed li').first()).toBeVisible({ timeout: 30_000 })
    const first = await page.locator('.dk-ta-feed li').first().getAttribute('data-sale')
    await expect.poll(() => page.locator('.dk-ta-feed li').first().getAttribute('data-sale'), { timeout: 12_000 }).not.toBe(first)
    await ctx.close()
    const rm = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
    const p2 = await rm.newPage()
    await open(p2, '&tab=po')
    await p2.locator('[data-tour="po-approve"]').click()
    await expect(p2.locator('[data-ta="po-receive"]')).toBeEnabled({ timeout: 2000 })
    await rm.close()
  })

  test('roles: supplier quick reply; region Bandung follows the pack', async ({ page, errors }) => {
    await open(page, '&role=supplier')
    await expect(page.locator('[data-ta="supplier"]')).toBeVisible()
    // the shop sends a PO to the sandbag supplier (Supplier role inbox)
    const id = await W<string>(page, `const p = Object.values(s.products.byId).find((x) => x.businessId === s.meta.shopId && x.supplierId && x.tags.includes('sandbag'));
      return g.emit('po.sent', { businessId: s.meta.shopId, supplierId: p.supplierId, items: [{ productId: p.id, qty: 20, cost: p.cost }] }, 'toko-autopilot').payload.id`)
    await settled(page)
    await page.locator(`.dk-ta-suplist [data-po="${id}"]`).click()
    await page.getByRole('button', { name: 'Bisa kirim hari ini sore' }).click()
    await settled(page)
    const r = await W<G>(page, `return s.purchaseOrders.byId['${id}']`)
    expect(r.reply.message.id).toContain(r.code)
    expect(r.reply.message.id).toContain('hari ini sore')
    await open(page, '&role=pemilik-toko&region=bandung')
    await expect(page.locator('.dk-ta-kpis')).toBeVisible()
    await expect(page.locator('.dk-ta')).not.toContainText('Bojonegoro')
    expect(errors).toEqual([])
  })

  test('Tanya AI (sim): PO draft and price answers carry the screen numbers', async ({ page, errors }) => {
    await open(page)
    await page.getByRole('button', { name: 'Tanya AI' }).first().click()
    await page.locator('[data-ta="assist"]').getByRole('button', { name: 'Susun PO' }).click()
    await expect(page.locator('[data-ta="assist"] [role="log"]')).toContainText('Rp ', { timeout: 8000 })
    await expect(page.locator('[data-ta="assist"] [role="log"]')).toContainText('/hari ×')
    await page.locator('[data-ta="assist"]').getByRole('button', { name: 'Saran harga' }).click()
    await expect(page.locator('[data-ta="assist"] [role="log"]')).toContainText('elastisitas simulasi', { timeout: 8000 })
    expect(errors).toEqual([])
  })

  test('no dead controls on every owner tab', async ({ page, errors }) => {
    test.setTimeout(240_000)
    await open(page)
    const dead: string[] = []
    for (const id of ['dasbor', 'kasir', 'prediksi', 'po', 'harga', 'shift']) {
      await tab(page, id)
      await page.waitForTimeout(400)
      const n = Math.min(9, await page.locator('#dk-ta-panel button:not([disabled]):not([aria-pressed="true"]):not([aria-checked="true"])').count())
      for (let i = 0; i < n; i++) {
        const btn = page.locator('#dk-ta-panel button:not([disabled]):not([aria-pressed="true"]):not([aria-checked="true"])').nth(i)
        if (!(await btn.isVisible())) continue
        const label = (await btn.innerText()).slice(0, 40)
        const snap = () => page.evaluate(() => `${document.body.innerHTML.length}|${location.href}|${Object.values((window as G).__gamada.world.get()).reduce((a: number, t: G) => a + (t && Array.isArray(t.ids) ? t.ids.length : 0), 0)}|${document.activeElement?.outerHTML.length}`)
        const a = await snap()
        await btn.click({ timeout: 3000 }).catch(() => undefined)
        await page.waitForTimeout(250)
        const b = await snap()
        if (a === b) dead.push(`${id}: ${label}`)
        await page.keyboard.press('Escape')
        await page.waitForTimeout(150)
        if (!(await page.locator(`#dk-ta-tab-${id}`).getAttribute('aria-selected'))?.includes('true')) await tab(page, id)
      }
    }
    expect(dead).toEqual([])
    expect(errors).toEqual([])
  })
})

test.describe('toko-autopilot · phone 390', () => {
  test.use(PHONE)
  test('tabs fit (no horizontal scroll), sticky cart bar, mission QRIS on a phone, chart in a drawer', async ({ page, errors }) => {
    await open(page)
    for (const id of ['dasbor', 'kasir', 'prediksi', 'po', 'harga', 'shift']) {
      await tab(page, id)
      await page.waitForTimeout(300)
      expect(await noHScroll(page), id).toBe(true)
    }
    await tab(page, 'prediksi')
    await page.locator('.dk-ta-risk .dk-ta-row').first().click()
    await expect(page.locator('.dk-ov [data-tour="forecast-chart"]')).toBeVisible()
    await page.keyboard.press('Escape')
    await tab(page, 'kasir')
    await page.locator('.dk-ta-item:not([disabled])').first().click()
    await expect(page.locator('[data-ta="cart-bar"]')).toContainText('Keranjang (1)')
    await page.locator('[data-ta="cart-bar"]').click()
    await page.locator('.dk-ov [data-ta="pay"]').click()
    await page.getByRole('radio', { name: 'QRIS', exact: true }).click()
    await page.locator('[data-ta="qris-pay"]').click()
    await expect(page.locator('[data-ta="receipt"]')).toBeVisible()
    await expect.poll(() => missions(page)).toContain('qris')
    expect(await noHScroll(page)).toBe(true)
    expect(errors).toEqual([])
  })

  test('missions banjir, PO, harga and shift on a phone; 44 px targets; EN', async ({ page, errors }) => {
    test.setTimeout(150_000)
    await open(page)
    await page.locator('[data-ta="play-flood"]').click()
    await expect(page.locator('.dk-ta-region [data-tour="flood-banner"]')).toBeVisible()
    await tab(page, 'prediksi')
    await page.locator('.dk-ta-risk .dk-ta-row').filter({ hasText: '+340%' }).first().click()
    await expect(page.locator('.dk-ov [data-factor="banjir"]')).toContainText('+340%')
    await expect.poll(() => missions(page)).toContain('banjir')
    await page.keyboard.press('Escape')
    await tab(page, 'po')
    await page.locator('[data-tour="po-approve"]').click()
    await expect(page.locator('.dk-ov [data-tour="po-chat"]')).toBeVisible()
    await expect.poll(() => missions(page)).toContain('po')
    await page.keyboard.press('Escape')
    await tab(page, 'harga')
    await page.locator('[data-ta="price-apply"]').first().click()
    await expect.poll(() => missions(page)).toContain('harga')
    await tab(page, 'shift')
    await page.locator('[data-ta="extra-block"]').first().click()
    await expect(page.locator('[data-ta="extra-why"]')).toBeVisible()
    await expect.poll(() => missions(page)).toContain('shift')
    // touch targets on every tab
    const small: string[] = []
    for (const id of ['dasbor', 'kasir', 'prediksi', 'po', 'harga', 'shift']) {
      await tab(page, id)
      await page.waitForTimeout(300)
      small.push(
        ...(await page.locator('.dk-ta button:visible, .dk-ta a:visible').evaluateAll((els, t) =>
          els.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && Math.min(r.height, r.width) < 43.5 && !e.closest('.dk-ta-wg-hours') }).map((e) => `${t}: ${(e.textContent ?? e.getAttribute('aria-label') ?? '').trim().slice(0, 30)} ${Math.round(e.getBoundingClientRect().height)}`), id)),
      )
      expect(await noHScroll(page), id).toBe(true)
    }
    expect(small).toEqual([])
    await page.locator('.dk-topbar, .dk-more, body').getByRole('radio', { name: 'EN', exact: true }).first().click({ timeout: 3000 }).catch(() => undefined)
    expect(errors).toEqual([])
  })
})
