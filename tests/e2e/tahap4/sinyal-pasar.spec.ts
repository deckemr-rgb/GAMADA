/**
 * Sinyal Pasar (P17) — plan docs/build/tahap4-plan.md §2 P17 + chains §3 (C30–C34, C13, C20). Missions at 1440 and
 * 390, numbers that agree, ?focus= arrivals, chain hops, roles, language, reduced motion, alive within 10 s and a light
 * no-dead-controls / no-repeated-sentence crawl. The product is not DEMO_READY yet: `?controls=all`.
 * The clock is stepped one world minute at a time (as it runs), so the natural shock path sees each minute's state.
 */
import type { Page } from '@playwright/test'
import { expect, test } from '../fixtures'

/* eslint-disable @typescript-eslint/no-explicit-any */
type G = any
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } as const
const URL0 = '/demo/sinyal-pasar?controls=all&off=preloader&e2e=1'
const MKEY = 'gamada:demo:missions:sinyal-pasar'
const pctId = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
const rp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')

async function open(page: Page, q = ''): Promise<void> {
  await page.goto(URL0 + q)
  await page.waitForFunction(() => (window as G).__gamada?.world.status() === 'ready', null, { timeout: 60_000 })
  await page.evaluate(async () => {
    const g = (window as G).__gamada
    g.clock.pause()
    await g.ensure('pasar-daerah')
    await g.ensure('usaha-pintar')
  })
  await expect(page.locator('.dk-sp:not([aria-busy]), .dk-sp-app').first()).toBeVisible({ timeout: 30_000 })
}
const W = <T>(page: Page, fn: string): Promise<T> => page.evaluate(`(() => { const g = window.__gamada; const s = g.world.get(); ${fn} })()`) as Promise<T>
const missions = (page: Page) => page.evaluate((k) => localStorage.getItem(k) ?? '', MKEY)
const noHScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
/** advance the world clock one minute at a time up to `to` (natural events land per minute, as when it runs) */
async function stepTo(page: Page, to: number): Promise<void> {
  await page.evaluate(async (target) => {
    const g = (window as G).__gamada
    for (let m = g.clock.get().minutes + 1; m <= target; m++) {
      g.clock.setTime(m)
      await new Promise((r) => setTimeout(r, 350))
      await g.settled()
    }
  }, to)
}
const alertAt = (page: Page) => W<number>(page, `return Object.values(s.alerts.byId).find((a) => a.kind === 'banjir' && a.status === 'aktif')?.at ?? -1`)
async function flood(page: Page): Promise<number> {
  await page.locator('[data-sp="play-flood"]').first().click()
  await expect.poll(() => alertAt(page), { timeout: 5000 }).toBeGreaterThan(0)
  return alertAt(page)
}
async function tab(page: Page, id: string): Promise<void> {
  await page.locator(`#dk-sp-tab-${id}`).click()
  await expect(page.locator(`#dk-sp-tab-${id}`)).toHaveAttribute('aria-selected', 'true')
}

test.describe('sinyal-pasar · desktop', () => {
  test.setTimeout(150_000)

  test('alive within 10 s: the 07:01 tick lands on the first screen; ticker / latest line = PricePoint.price', async ({ page, errors }) => {
    await open(page)
    await expect(page.locator('[data-tour="sp-ticker"]')).toBeVisible()
    await page.evaluate(() => (window as G).__gamada.clock.play())
    await expect(page.locator('[data-sp="latest"]')).toBeVisible({ timeout: 10_000 })
    const p = await W<{ id: string; price: number; market: string }>(page, `const p = Object.values(s.prices.byId).filter((x) => x.updatedAt > 360).sort((a, b) => b.updatedAt - a.updatedAt)[0]; return { id: p.id, price: p.price, market: s.markets.byId[p.marketId].name }`)
    await page.evaluate(() => (window as G).__gamada.clock.pause())
    const tick = await W<string>(page, `return s.meta.facts.pd.tickMarketId`)
    expect(await W<number>(page, `return Object.values(s.prices.byId).filter((x) => x.marketId === '${tick}' && x.updatedAt === 421).length`)).toBe(1)
    await expect(page.locator('[data-sp="latest"]')).toContainText(p.market)
    // board / ticker prices are the world's PricePoint.price
    const rows = await page.locator('.dk-sp-row').evaluateAll((els) => els.slice(0, 5).map((e) => ({ id: e.getAttribute('data-sp-pair')!, price: e.querySelector('.dk-sp-c-price')!.firstChild!.textContent! })))
    for (const r of rows) expect(r.price).toBe(rp(await W<number>(page, `return s.prices.byId['${r.id}'].price`)))
    const kpi = await page.locator('.dk-sp-kpis').innerText()
    expect(kpi).toContain(String(await W<number>(page, `return s.region.commodities.length`)))
    // T8: a flood while the clock runs ⇒ the anomaly row within ~5 s (×60 until it lands, then the chosen speed again)
    await page.evaluate(() => (window as G).__gamada.clock.play())
    await page.locator('[data-sp="play-flood"]').first().click()
    await expect(page.locator('.dk-sp-row').filter({ hasText: 'Anomali' }).first()).toBeVisible({ timeout: 5_000 })
    await expect.poll(() => page.evaluate(() => (window as G).__gamada.clock.get().speed), { timeout: 3_000 }).toBe(10)
    expect(errors).toEqual([])
  })

  test('flood ⇒ shocks (C30) ⇒ early warning ≤ 1 s (C31) ⇒ anomaly (C33 + C13 + C20) ⇒ missions 1–3, operation lifecycle (C34)', async ({ page, errors }) => {
    await open(page)
    const t0 = Date.now()
    const at = await flood(page)
    await expect(page.locator('[data-tour="sp-warning"] .dk-sp-alert').first()).toBeVisible({ timeout: 1500 })
    expect(Date.now() - t0).toBeLessThan(5000)
    const shocks = await W<{ commodityId: string; marketIds: string[] }[]>(page, `return Object.values(s.priceShocks.byId).map((x) => ({ commodityId: x.commodityId, marketIds: x.marketIds }))`)
    expect(shocks.length).toBe(2)
    const warns = await W<{ id: string; commodityId: string; peakPct: number; peakInDays: number }[]>(page, `return Object.values(s.priceWarnings.byId)`)
    expect(warns.length).toBe(2)
    for (const w of warns) {
      expect(w.peakInDays).toBe(5)
      await expect(page.locator(`[data-sp-alert="${w.id}"]`)).toContainText(`${pctId(w.peakPct)} dalam 5 hari`)
    }
    // C33: the shock path, minute by minute ⇒ cabai anomaly at Pasar Kota Bojonegoro (+2), beras at Pasar Banjarejo (+4)
    await page.evaluate(() => {
      const g = (window as G).__gamada
      ;(window as G).__an = []
      g.onEvent('price.anomaly', (e: G) => (window as G).__an.push(e.payload))
    })
    await stepTo(page, at + 2)
    const a0 = await page.evaluate(() => (window as G).__an[0])
    expect(`${a0.marketId}:${a0.commodityId}`).toBe('pasar-kota-bojonegoro:cabai-rawit')
    const cabaiRow = page.locator('.dk-sp-row[data-sp-pair="pasar-kota-bojonegoro:cabai-rawit"]')
    await expect(cabaiRow).toContainText('Anomali')
    // T5 (a): the anomaly toast names its value as "when detected" (the row keeps moving)
    await expect(page.locator('.dk-toast').filter({ hasText: /^Harga .* di atas pola/ }).first()).toContainText('saat terdeteksi')
    // Δ vs musiman: board row = price.anomaly deltaPct = C13 reason (at the anomaly's minute)
    await expect(cabaiRow.locator('.dk-sp-c-delta')).toHaveText(pctId(a0.deltaPct))
    await expect.poll(() => W<string>(page, `return Object.values(s.marketOps.byId).find((o) => o.commodityId === 'cabai-rawit' && !o.sentBy)?.reason.id ?? ''`)).toContain(`${Math.round(a0.deltaPct)}%`)
    await stepTo(page, at + 5)
    const an = await W<{ id: string; price: number }[]>(page, `return Object.values(s.prices.byId).filter((p) => p.anomaly).map((p) => ({ id: p.id, price: p.price }))`)
    expect(an.map((x) => x.id).sort()).toEqual(['pasar-banjarejo:beras-medium', 'pasar-kota-bojonegoro:cabai-rawit'])
    await expect(page.locator('.dk-sp-kpis')).toContainText('Anomali aktif')
    // one C13 op per commodity; C20 ingredient forecast ×1.6
    const c13 = await W<{ id: string; reason: string; commodityId: string }[]>(page, `return Object.values(s.marketOps.byId).filter((o) => o.stage === 'recommended' && !o.sentBy).map((o) => ({ id: o.id, reason: o.reason.id, commodityId: o.commodityId }))`)
    expect(c13.map((o) => o.commodityId).sort()).toEqual(['beras-medium', 'cabai-rawit'])
    await expect.poll(() => W<number>(page, `const sku = Object.values(s.products.byId).find((p) => p.businessId === s.meta.shopId && p.tags.includes('cm:cabai-rawit')); return sku ? s.stock.byId[sku.id].factor : 0`), { timeout: 3000 }).toBe(1.6)
    // mission 1: open the anomaly (hotspot row) ⇒ the outlook chart
    await page.locator('.dk-sp-rowbtn[data-hotspot="sp-anomaly"]').click()
    const drawer = page.locator('[data-sp="detail"]')
    await expect(drawer.locator('[data-tour="sp-outlook"] svg').first()).toBeVisible()
    const pair = (await drawer.getAttribute('data-pair'))!
    expect(await drawer.locator('[data-sp="detail-price"]').innerText()).toContain(rp(await W<number>(page, `return s.prices.byId['${pair}'].price`)))
    await expect.poll(() => missions(page)).toContain('anomali')
    // T5 (c): the forecast factor chips add up to the forecast peak shown in front of them
    const chips = (await drawer.locator('[data-factor] strong').allInnerTexts()).map((x) => Number(x.replace('−', '-').replace('%', '').replace(',', '.')))
    expect(Math.round(chips.reduce((a, b) => a + b, 0) * 10) / 10).toBe(Number((await drawer.locator('[data-sp="factor-sum"]').innerText()).replace(/[^0-9,−+-]/g, '').replace('−', '-').replace(',', '.')))
    // mission 2: recommend ⇒ patches the C13 op (sentBy disperindag, effect = opSimulate)
    await page.locator('[data-tour="sp-recommend"]').click()
    const effect = Number(await page.locator('[data-sp="rekom-effect"]').getAttribute('data-effect'))
    const commodity = pair.split(':')[1]!
    const c13Id = c13.find((o) => o.commodityId === commodity)!.id
    await page.locator('[data-sp="send-meja"]').click()
    await expect(page.locator('[data-sp="rekom-status"]')).toContainText(c13Id)
    const op = await W<G>(page, `return s.marketOps.byId['${c13Id}']`)
    expect(op).toMatchObject({ stage: 'recommended', sentBy: 'disperindag', effectPct: effect, volumeTon: 10, days: 3 })
    expect(await W<number>(page, `return Object.values(s.marketOps.byId).filter((o) => o.commodityId === '${commodity}' && o.stage !== 'done').length`)).toBe(1)
    await expect(page.locator('[data-sp="rekom-status"] a')).toHaveAttribute('href', new RegExp(`/demo/meja-pimpinan\\?.*focus=${c13Id}`))
    await expect.poll(() => missions(page)).toContain('rekomendasi')
    // Operasi: "Mulai" disabled with its reason until the (auto) approval, enabled after
    await page.getByRole('button', { name: 'Lihat di Operasi Pasar' }).click()
    await expect(page.locator('#dk-sp-tab-operasi')).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('[data-sp="start-op"]')).toBeDisabled()
    await expect(page.locator('[data-sp="start-reason"]')).toHaveText('Menunggu persetujuan Kepala Daerah')
    const sentAt = await W<number>(page, `return s.marketOps.byId['${c13Id}'].sentAt`)
    await stepTo(page, sentAt + 5)
    await expect.poll(() => W<string>(page, `return s.marketOps.byId['${c13Id}'].stage`)).toBe('approved')
    await expect(page.locator('[data-sp="start-op"]')).toBeEnabled()
    const peak0 = await W<number>(page, `return Math.max(...Object.values(s.priceShocks.byId).filter((x) => x.commodityId === '${commodity}').map((x) => x.damp))`)
    await page.locator('[data-sp="start-op"]').click()
    // C34: the shock is damped ≤ 1 s, Indeks Ekonomi records the program
    await expect.poll(() => W<number>(page, `return Math.max(...Object.values(s.priceShocks.byId).filter((x) => x.commodityId === '${commodity}').map((x) => x.damp))`), { timeout: 1500 }).toBeGreaterThan(peak0)
    expect(await W<boolean>(page, `return Object.values(s.econIndex.byId).some((c) => (c.events ?? []).some((e) => e.cause === 'marketOps:${c13Id}'))`)).toBe(true)
    // running ⇒ prices of its markets step down
    const before = await W<number>(page, `return s.prices.byId['${pair}'].price`)
    const now = await page.evaluate(() => (window as G).__gamada.clock.get().minutes)
    await stepTo(page, now + 3)
    expect(await W<number>(page, `return s.prices.byId['${pair}'].price`)).toBeLessThan(before)
    // mission 3: the simulator draws "sesudah" ≠ "tanpa operasi"; its effect = the op's effectPct
    await page.locator('[data-sp="simulate"]').click()
    await expect(page.locator('[data-sp="sim-result"]')).toContainText(pctId(effect))
    await expect.poll(() => missions(page)).toContain('efek')
    // the recommendation lands in Meja Pimpinan (?focus=<opId> opens its approval)
    await page.waitForTimeout(1500)
    await page.goto(`/demo/meja-pimpinan?off=preloader&e2e=1&focus=${c13Id}`)
    await expect(page.getByText(/Setujui operasi pasar cabai rawit/i).first()).toBeVisible({ timeout: 30_000 })
    expect(errors).toEqual([])
  })

  test('Pemilik Toko: early alert (C32) ⇒ PO draft in Toko Autopilot (mission 4), subscription (mission 5)', async ({ page, errors }) => {
    await open(page, '&role=pemilik-toko')
    await expect(page.locator('.dk-sp-app')).toBeVisible()
    await expect(page.locator('.dk-sp-ingr li').first()).toBeVisible()
    // T5 (f): the ingredient stock is listed per food outlet of the business (never as the building-supply shop's)
    await expect(page.locator('[data-sp="ingr-outlet"] h4')).toHaveText(await W<string[]>(page, `return [...new Set(Object.values(s.products.byId).filter((p) => p.businessId === s.meta.shopId && p.tags.some((t) => t.startsWith('cm:'))).map((p) => s.outlets.byId[p.outletId].name))].sort((a, b) => a.localeCompare(b))`))
    // alive within 10 s on this side: the latest market tick
    await page.evaluate(() => (window as G).__gamada.clock.play())
    await expect(page.locator('[data-sp="latest"]')).toBeVisible({ timeout: 10_000 })
    await page.evaluate(() => (window as G).__gamada.clock.pause())
    await flood(page)
    await expect(page.locator('.dk-sp-bubble').first()).toBeVisible({ timeout: 1500 })
    const alerts = await W<{ id: string; peakPct: number; warningId: string; commodityId: string }[]>(page, `return Object.values(s.priceAlerts.byId).filter((a) => a.businessId === s.meta.shopId)`)
    expect(alerts.length).toBeGreaterThan(0)
    for (const a of alerts) {
      const w = await W<G>(page, `return s.priceWarnings.byId['${a.warningId}']`)
      expect(a.peakPct).toBe(w.peakPct)
      await expect(page.locator(`[data-alert="${a.id}"]`)).toContainText(`${pctId(a.peakPct)} dalam 5 hari`)
    }
    const first = page.locator(`[data-alert="${alerts[0]!.id}"]`)
    await first.locator('[data-sp="prepare-po"]').click()
    await expect(first.locator('[data-sp="po-open"]')).toBeVisible({ timeout: 5000 })
    const po = await W<G>(page, `return Object.values(s.purchaseOrders.byId).find((p) => p.status === 'draf' && p.cause === 'priceWarnings:${alerts[0]!.warningId}')`)
    expect(po).toBeTruthy()
    await expect(first).toContainText(`Draf PO dibuat: ${po.items[0].qty}`)
    await expect(first.locator('[data-sp="po-open"]')).toHaveAttribute('href', new RegExp(`/demo/toko-autopilot\\?.*focus=${po.id}`))
    await expect(first.locator('[data-sp="forecast-open"]')).toHaveAttribute('href', /tab=prediksi&outlet=warung/)
    await expect.poll(() => missions(page)).toContain('umkm')
    // Langganan: 15 %, Aplikasi, one commodity less ⇒ price.subscribed
    await page.locator('.dk-sp-app').getByRole('radio', { name: 'Langganan' }).click()
    await page.locator('.dk-sp-subform').getByRole('checkbox', { name: 'Gula pasir' }).uncheck()
    await page.locator('.dk-sp-subform').getByRole('radio', { name: '15%' }).click()
    await page.locator('.dk-sp-subform').getByRole('radio', { name: 'Aplikasi' }).click()
    await page.locator('[data-sp="save-sub"]').click()
    await expect(page.locator('.dk-sp-subform [role="status"]')).toContainText('Tersimpan')
    const sub = await W<G>(page, `return Object.values(s.priceSubs.byId).find((x) => x.businessId === s.meta.shopId)`)
    expect(sub).toMatchObject({ thresholdPct: 15, channel: 'aplikasi' })
    expect(sub.commodityIds).not.toContain('gula-pasir')
    await expect.poll(() => missions(page)).toContain('langganan')
    // no op controls, no other business names on this side
    await expect(page.locator('[data-sp="send-meja"], [data-sp="start-op"]')).toHaveCount(0)
    // the draft is visible at the Toko Autopilot PO landing with the same quantity
    await page.waitForTimeout(1500)
    await page.goto(`/demo/toko-autopilot?off=preloader&e2e=1&focus=${po.id}`)
    await expect(page.getByText(po.code).first()).toBeVisible({ timeout: 30_000 })
    expect(errors).toEqual([])
  })

  test('?focus= arrivals: market×commodity ⇒ drawer, OP- ⇒ Operasi, PDN- ⇒ warning card, PA- ⇒ UMKM inbox, DW- ⇒ distributor list, bad ⇒ toast', async ({ page, errors }) => {
    await open(page, '&focus=pasar-kota-bojonegoro:cabai-rawit')
    await expect(page.locator('[data-sp="detail"]')).toHaveAttribute('data-pair', 'pasar-kota-bojonegoro:cabai-rawit')
    await page.keyboard.press('Escape')
    await open(page, '&focus=OP-0001')
    await expect(page.locator('#dk-sp-tab-operasi')).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('[data-op="OP-0001"]')).toHaveClass(/is-active/)
    await expect(page.locator('[data-op="OP-0001"]')).toContainText('Efek terukur')
    await open(page, '&focus=XX-9999')
    await expect(page.getByText('Data tidak ditemukan')).toHaveCount(1)
    await expect(page.locator('#dk-sp-tab-ringkasan')).toHaveAttribute('aria-selected', 'true')
    // state-made ids: create them, let the world persist, reopen with the focus
    await flood(page)
    await page.locator('[data-sp-alert]').first().waitFor()
    await page.locator('[data-sp-alert]').first().getByRole('button').click()
    await page.locator('[data-sp="detail"] button', { hasText: 'Pantau distributor' }).click()
    await page.locator('[data-sp="watch"]').click()
    await expect(page.locator('[data-sp="dist"] .dk-sp-pill').first()).toBeVisible()
    const ids = await W<{ pdn: string; pa: string; dw: string }>(page, `return { pdn: s.priceWarnings.ids[0], pa: s.priceAlerts.ids[0], dw: s.distributorWatches.ids[0] }`)
    await page.waitForTimeout(1500)
    await page.goto(URL0 + `&focus=${ids.pdn}`)
    await expect(page.locator(`[data-sp-alert="${ids.pdn}"]`)).toBeVisible({ timeout: 30_000 })
    await page.goto(URL0 + `&focus=${ids.dw}`)
    await expect(page.locator('[data-sp="dist"]')).toBeVisible({ timeout: 30_000 })
    await page.goto(URL0 + `&focus=${ids.pa}`)
    await expect(page.locator(`[data-alert="${ids.pa}"]`)).toBeVisible({ timeout: 30_000 })
    await expect(page.locator(`[data-alert="${ids.pa}"]`)).toHaveClass(/is-active/)
    expect(errors).toEqual([])
  })

  test('EN + reduced motion: static ticker, no pause button, English strings; tabs render; buttons named; no repeated sentence', async ({ page, errors }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await open(page)
    await page.locator('.dk-topbar').getByRole('radio', { name: 'EN', exact: true }).click()
    await expect(page.locator('#dk-sp-board-h')).toHaveText('Price board')
    await expect(page.locator('.dk-sp-ticker-box.is-static')).toBeVisible()
    await expect(page.locator('.dk-sp-ticker-btn')).toHaveCount(0)
    const idle = await page.evaluate(() => new Promise<number>((res) => {
      let n = 0
      const f = () => { n++; if (n < 30) requestAnimationFrame(f); else res(n) }
      requestAnimationFrame(f)
    }))
    expect(idle).toBe(30)
    await flood(page)
    await stepTo(page, (await alertAt(page)) + 5)
    const lines = await page.locator('.dk-sp-alert .dk-sp-strong').allInnerTexts()
    expect(new Set(lines).size).toBe(lines.length)
    for (const k of ['peta', 'operasi', 'langganan', 'ringkasan']) {
      await tab(page, k)
      await expect(page.locator('#dk-sp-panel')).not.toContainText('Loading…', { timeout: 10_000 })
      const unnamed = await page.locator('.dk-sp button').evaluateAll((els) => els.filter((e) => !(e.textContent ?? '').trim() && !e.getAttribute('aria-label')).length)
      expect(unnamed).toBe(0)
      expect(await noHScroll(page)).toBe(true)
    }
    expect(errors.filter((e) => !/maplibre|webgl|tile/i.test(e))).toEqual([])
  })
})

test.describe('sinyal-pasar · phone 390', () => {
  test.use(PHONE)
  test.setTimeout(180_000)

  test('all five missions at 390, guide pill visible, no horizontal scroll', async ({ page, errors }) => {
    await open(page)
    expect(await noHScroll(page)).toBe(true)
    await expect(page.getByText(/Coba ini/).first()).toBeVisible()
    // alive within 10 s at 390 too
    await page.evaluate(() => (window as G).__gamada.clock.play())
    await expect(page.locator('[data-sp="latest"]')).toBeInViewport({ timeout: 10_000 })
    await page.evaluate(() => (window as G).__gamada.clock.pause())
    const at = await flood(page)
    await stepTo(page, at + 5)
    await page.locator('[data-hotspot="sp-anomaly"]').first().click()
    await expect(page.locator('[data-tour="sp-outlook"] svg').first()).toBeVisible()
    await page.locator('[data-tour="sp-recommend"]').click()
    await page.locator('[data-sp="send-meja"]').click()
    await expect(page.locator('[data-sp="rekom-status"]')).toBeVisible()
    await page.getByRole('button', { name: 'Lihat di Operasi Pasar' }).click()
    await page.locator('[data-sp="simulate"]').click()
    await expect(page.locator('[data-sp="sim-result"]')).toBeVisible()
    expect(await noHScroll(page)).toBe(true)
    await tab(page, 'langganan')
    await page.locator('[data-sp="to-umkm"]').click()
    await expect(page.locator('.dk-sp-app')).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('.dk-sp-app [data-sp="latest"]')).toBeInViewport()
    expect(await noHScroll(page)).toBe(true)
    await page.locator('[data-sp="prepare-po"]').first().click()
    await expect(page.locator('[data-sp="po-open"]').first()).toBeVisible({ timeout: 5000 })
    await page.locator('.dk-sp-app').getByRole('radio', { name: 'Langganan' }).click()
    await page.locator('[data-sp="save-sub"]').click()
    await expect.poll(async () => JSON.parse((await missions(page)) || '[]').length).toBe(5)
    await expect(page.getByText('Lanjut ke produk terkait').first()).toBeAttached({ timeout: 5000 })
    const small = await page.locator('.dk-sp-app button, .dk-sp-app a').evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent && e.getBoundingClientRect().height < 43.5).map((e) => e.textContent))
    expect(small).toEqual([])
    expect(errors).toEqual([])
  })
})
