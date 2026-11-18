/**
 * TenderPilot (P13) — missions, numbers that agree, chain hops (C21/C22/C24/C25, L1, L3), focus arrivals, filters,
 * .ics, phone layout, reduced motion, no dead controls on the first screen. Run against the dev server with
 * ?controls=all (before DEMO_READY) or a VITE_DEMO_CONTROLS=1 build.
 */
import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures'

const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } as const
type G = {
  world: { get(): any; status(): string }
  emit(type: string, payload: unknown, source?: string): void
  settled(): Promise<void>
  onEvent(type: string, fn: (e: any) => void): () => void
  clock: { get(): { minutes: number; running: boolean }; pause(): void; play(): void; setTime(t: string | number): void }
  ensure(eco: string): Promise<void>
}

async function open(page: Page, o: { lang?: 'id' | 'en'; extra?: string; autoplay?: boolean } = {}) {
  if (!o.autoplay)
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem('gamada:tp:autoplay', '1')
      } catch {
        /* ignore */
      }
    })
  const q = new URLSearchParams({ controls: 'all', e2e: '1', off: 'preloader' })
  if (o.lang) q.set('lang', o.lang)
  await page.goto(`/demo/tenderpilot?${q.toString()}${o.extra ? `&${o.extra}` : ''}`)
  await page.waitForFunction(() => (window as unknown as { __gamada?: G }).__gamada?.world.status() === 'ready', null, { timeout: 60_000 })
  await page.evaluate(() => (window as unknown as { __gamada: G }).__gamada.ensure('usaha-pintar'))
  await expect(page.locator('.dk-tp-top')).toBeVisible({ timeout: 30_000 })
  if (!o.autoplay) await page.evaluate(() => (window as unknown as { __gamada: G }).__gamada.clock.pause())
}
const g = <T>(page: Page, fn: (g: G) => T | Promise<T>) => page.evaluate(`(${fn.toString()})(window.__gamada)`) as Promise<T>

/** the flood at 07:06 (useFloodAutoplay catch-up on a jump) → emergency tender matched */
async function toFlood(page: Page) {
  await g(page, (x) => x.clock.setTime('07:08'))
  await expect(page.locator('[data-tp="banner"]')).toBeVisible({ timeout: 10_000 })
}
const emergencyId = (page: Page) => g(page, (x) => x.world.get().tenders.ids.map((id: string) => x.world.get().tenders.byId[id]).find((t: any) => t.key === 'karung-terpal-darurat')?.id as string)
const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`

async function missionFlow(page: Page, phone: boolean) {
  await toFlood(page)
  const tid = await emergencyId(page)
  const prob = await g(page, (x) => {
    const s = x.world.get()
    const t = s.tenders.ids.map((id: string) => s.tenders.byId[id]).find((t: any) => t.key === 'karung-terpal-darurat')
    return Math.round(t.matches[s.meta.shopId] * 100)
  })
  expect(prob).toBe(78)
  await expect(page.locator('[data-tp="banner"]')).toHaveAttribute('data-prob', '78')
  await expect(page.locator('[data-tp="banner"]')).toContainText('78%')
  // audit "(78%)"
  expect(await g(page, (x) => Object.values(x.world.get().auditLog.byId).some((a: any) => a.type === 'tender.matched' && a.summary.id.includes('(78%)')))).toBe(true)
  // the feed row (phone: Umpan tab is the landing tab)
  await expect(page.locator(`.dk-tp-row[data-tid="${tid}"]`)).toHaveAttribute('data-prob', '78')

  // mission 1: open
  await page.locator('[data-tp="banner"] [data-hotspot="tp-open"]').click()
  await expect(page.locator(`.dk-tp-detail[data-tender="${tid}"]`)).toBeVisible()
  await expect(page.locator('[data-tp="score"]')).toHaveAttribute('data-prob', '78')
  // HPS = Σ qty × unit HPS = Awas Belanja package HPS
  const hps = await g(page, (x) => {
    const s = x.world.get()
    const t = s.tenders.ids.map((id: string) => s.tenders.byId[id]).find((t: any) => t.key === 'karung-terpal-darurat')
    const p = s.procurements.ids.map((id: string) => s.procurements.byId[id]).find((p: any) => p.key === 'karung-terpal-darurat')
    return { t: t.hps, sum: t.items.reduce((a: number, i: any) => a + i.qty * i.hpsPrice, 0), p: p?.hps }
  })
  expect(hps.t).toBe(37_750_000)
  expect(hps.sum).toBe(hps.t)
  expect(hps.p).toBe(hps.t)
  await expect(page.locator('[data-tp="hps"]')).toHaveText(rp(hps.t))

  // mission 2: tax link (6/7) → tax.ready ticks ≤ 1 s
  const checklist = page.locator('[data-tp="checklist"]')
  await expect(checklist).toHaveAttribute('data-ok', '6')
  const href = await page.locator('[data-tp="tax-link"]').getAttribute('href')
  expect(href).toMatch(/\/demo\/pajak-beres\?focus=PJ-\d+.*from=tenderpilot/)
  await g(page, (x) => {
    const s = x.world.get()
    const ids = s.taxItems.ids.filter((id: string) => s.taxItems.byId[id].businessId === s.meta.shopId && s.taxItems.byId[id].period === '2026-11')
    x.emit('tax.ready', { businessId: s.meta.shopId, period: '2026-11', taxItemIds: ids }, 'pajak-beres')
  })
  await expect(checklist).toHaveAttribute('data-ok', '7', { timeout: 1_000 })

  // mission 3: compose 0 → 34
  await page.locator('[data-tp="to-doc"]').click()
  await expect(page.locator('[data-tp="pages"]')).toHaveAttribute('data-pages', '0')
  await page.locator('[data-tp="compose"]').click()
  await expect(page.locator('[data-tp="pages"]')).toHaveAttribute('data-pages', '34', { timeout: 6_000 })
  // Surat total = Daftar Harga total = terbilang
  const surat = await page.locator('.dk-tp-sec[data-sec="surat"] textarea').inputValue()
  await page.locator('.dk-tp-sec[data-sec="harga"] .dk-tp-sec-h button').click()
  const total = (await page.locator('[data-tp="doc-total"]').innerText()).trim()
  expect(surat).toContain(total)
  const words = (await page.locator('[data-tp="terbilang"]').innerText()).replace(/^Terbilang:\s*/, '').replace(/\s*rupiah$/, '')
  expect(surat).toContain(words)
  const price = Number(total.replace(/\D/g, ''))

  // send: disabled until signed (reason visible), then ONE bid on a double click
  await expect(page.locator('[data-tp="send"]')).toBeDisabled()
  await expect(page.locator('.dk-tp-why')).toBeVisible()
  await page.locator('[data-tp="sign"]').click()
  await expect(page.locator('[data-tp="send"]')).toBeEnabled()
  await page.locator('[data-tp="send"]').dblclick()
  await expect(page.locator('[data-tp="sent"]')).toBeVisible()
  await g(page, (x) => x.settled())
  const bids = await g(page, (x) => {
    const s = x.world.get()
    const t = s.tenders.ids.map((id: string) => s.tenders.byId[id]).find((t: any) => t.key === 'karung-terpal-darurat')
    const mine = s.bids.ids.map((id: string) => s.bids.byId[id]).filter((b: any) => b.tenderId === t.id && b.businessId === s.meta.shopId)
    const p = s.procurements.ids.map((id: string) => s.procurements.byId[id]).find((p: any) => p.key === 'karung-terpal-darurat')
    const pb = (p?.bids ?? []).filter((b: any) => b.bidderId === s.meta.facts.up.shopBidderId)
    return { n: mine.length, price: mine[0]?.price, pages: mine[0]?.pages, procBids: pb.length, procPrice: pb[0]?.price, pid: p?.id }
  })
  expect(bids.n).toBe(1)
  expect(bids.price).toBe(price)
  expect(bids.pages).toBe(34)
  expect(bids.procBids).toBe(1)
  expect(bids.procPrice).toBe(price)
  expect(await g(page, (x) => Object.values(x.world.get().auditLog.byId).some((a: any) => a.type === 'bid.submitted'))).toBe(true)
  // every mission done (stored progress); the desktop guide offers the related products
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gamada:demo:missions:tenderpilot') ?? '[]').sort())).toEqual(['buka', 'kirim', 'susun', 'syarat'])
  if (!phone) {
    await expect(page.getByText(/Lanjut ke produk terkait|Continue to related products/).first()).toBeVisible({ timeout: 5_000 })
    // the bid row in Awas Belanja (?focus=<procurement id>)
    await page.locator('[data-tp="awas-link"]').click()
    await expect(page.locator('.dk-ab')).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('.dk-ab').getByText('37.750.000').first()).toBeVisible({ timeout: 10_000 })
    await page.locator('.dk-ab').getByRole('tab', { name: /Peserta/ }).click()
    await expect(page.locator('.dk-ab').getByText(rp(price)).first()).toBeVisible({ timeout: 10_000 })
  }
}

test.describe('TenderPilot · 1440', () => {
  test.describe.configure({ timeout: 90_000 })

  test('alive within 10 s, no console errors', async ({ page, errors }) => {
    await open(page, { autoplay: true })
    const t0 = Date.now()
    await expect(page.locator('.dk-tp-row.is-fresh').first()).toBeVisible({ timeout: 10_000 })
    expect(Date.now() - t0).toBeLessThan(10_000)
    expect(await g(page, (x) => x.clock.get().running)).toBe(true)
    await expect(page.locator('[data-tp="bell"] .dk-badge, [data-tp="bell"] [class*="badge"]').first()).toBeVisible()
    expect(errors).toEqual([])
  })

  test('missions + numbers that agree + C25 into Awas Belanja', async ({ page, errors }) => {
    await open(page)
    await missionFlow(page, false)
    expect(errors.filter((e) => !/api\/ai/.test(e))).toEqual([])
  })

  test('pump mirror: low chance, risk chip after procurement.flagged (L3)', async ({ page, errors }) => {
    await open(page)
    await toFlood(page)
    const mirror = await g(page, (x) => {
      const s = x.world.get()
      const t = s.tenders.ids.map((id: string) => s.tenders.byId[id]).find((t: any) => t.key === 'pompa-darurat')
      return { id: t.id, pid: t.procurementId, p: t.matches[s.meta.shopId] }
    })
    expect(mirror.p).toBeLessThan(0.3)
    const row = page.locator(`.dk-tp-row[data-tid="${mirror.id}"]`)
    await expect(row).toContainText('peluang rendah')
    await g(page, (x) => {
      const s = x.world.get()
      const t = s.tenders.ids.map((id: string) => s.tenders.byId[id]).find((t: any) => t.key === 'pompa-darurat')
      x.emit('procurement.flagged', { procurementId: t.procurementId, riskScore: 82, findings: [] }, 'awas-belanja')
    })
    await expect(row.locator('[data-tp="risk-link"]')).toBeVisible({ timeout: 1_000 })
    expect(await row.locator('[data-tp="risk-link"]').getAttribute('href')).toContain(`/demo/awas-belanja?focus=${mirror.pid}`)
    await row.locator('.dk-tp-row-btn').click()
    await expect(page.locator('[data-tp="risk-note"]')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('focus arrivals: tender id, procurement id, unknown id', async ({ page }) => {
    await open(page)
    await toFlood(page)
    const ids = await g(page, (x) => {
      const s = x.world.get()
      const all = s.tenders.ids.map((id: string) => s.tenders.byId[id])
      return { em: all.find((t: any) => t.key === 'karung-terpal-darurat').id, pump: all.find((t: any) => t.key === 'pompa-darurat'), }
    })
    // in-app navigation away and back with ?focus= (the world stays in memory, as after a cross-product toast)
    const spa = (path: string) =>
      page.evaluate((p) => {
        window.history.pushState({}, '', p)
        window.dispatchEvent(new PopStateEvent('popstate'))
      }, path)
    const go = async (focus: string) => {
      await spa('/demo/awas-belanja?controls=all&e2e=1')
      await expect(page.locator('.dk-ab')).toBeVisible({ timeout: 20_000 })
      await spa(`/demo/tenderpilot?controls=all&e2e=1&focus=${focus}`)
    }
    await go(ids.em)
    await expect(page.locator(`.dk-tp-detail[data-tender="${ids.em}"]`)).toBeVisible({ timeout: 20_000 })
    await go(ids.pump.procurementId)
    await expect(page.locator(`.dk-tp-detail[data-tender="${ids.pump.id}"]`)).toBeVisible({ timeout: 20_000 })
    await go('TD-9999')
    await expect(page.getByText('Data tidak ditemukan').first()).toBeVisible({ timeout: 20_000 })
  })

  test('filters change the count; .ics is valid; AI summary', async ({ page, errors }) => {
    await open(page)
    await toFlood(page)
    const count = () => page.locator('.dk-tp-feed > li').count()
    const all = await count()
    for (const [sel, v] of [['f-kbli', 'cocok'], ['f-value', 'kecil'], ['f-deadline', '3']] as const) {
      await page.locator(`[data-tp="${sel}"]`).selectOption(v)
      expect(await count()).toBeLessThan(all)
      await page.locator(`[data-tp="${sel}"]`).selectOption({ index: 0 })
      expect(await count()).toBe(all)
    }
    const loc = page.locator('[data-tp="f-loc"]')
    await loc.selectOption({ index: 1 })
    expect(await count()).toBeLessThan(all)
    await loc.selectOption({ index: 0 })
    // calendar + .ics
    await page.locator('[data-tp="calendar"]').click()
    const dl = page.waitForEvent('download')
    await page.locator('[data-tp="ics"]').click()
    const file = await (await dl).path()
    const fs = await import('node:fs')
    const ics = fs.readFileSync(file!, 'utf8')
    expect(ics).toMatch(/^BEGIN:VCALENDAR/)
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toMatch(/END:VCALENDAR\s*$/)
    // AI summary (sim) streams and shows the structure
    await page.locator('[data-tp="summarize"]').click()
    await expect(page.locator('[data-tp="ai-summary"]')).toHaveAttribute('data-done', '1', { timeout: 10_000 })
    // no repeated template sentence in the document
    await page.getByRole('tab', { name: 'Dokumen' }).click()
    await page.locator('[data-tp="compose"]').click()
    await expect(page.locator('[data-tp="pages"]')).toHaveAttribute('data-pages', '34', { timeout: 6_000 })
    await page.locator('[data-tp="preview"]').click()
    const text = await page.locator('.dk-tp-preview .dk-paper').innerText()
    const sentences = text.split(/(?<=[.:;])\s+|\n/).map((x) => x.trim()).filter((x) => x.length > 30)
    expect(sentences.length).toBeGreaterThan(10)
    expect(new Set(sentences).size).toBe(sentences.length)
    expect(errors.filter((e) => !/api\/ai/.test(e))).toEqual([])
  })

  test('EN renders, no console errors', async ({ page, errors }) => {
    await open(page, { lang: 'en' })
    await expect(page.locator('.dk-tp-feedpane h2')).toHaveText('Tender feed')
    await toFlood(page)
    await expect(page.locator('[data-tp="banner"]')).toContainText('78% chance')
    expect(errors).toEqual([])
  })

  test('reduced motion: static line, no autoplay; banner after a jump', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } })
    const page = await ctx.newPage()
    await page.route('**/api/ai/health', (r) => r.fulfill({ json: { ok: true, live: false, mock: false, reason: 'no_api_key' } }))
    await open(page, { autoplay: true })
    await expect(page.locator('.dk-tp-static')).toBeVisible()
    await page.waitForTimeout(2500)
    expect(await g(page, (x) => x.clock.get().running)).toBe(false)
    await toFlood(page)
    await ctx.close()
  })

  test('no dead controls on the first screen', async ({ page }) => {
    await open(page)
    await toFlood(page)
    const n = await page.locator('.dk-tp button:not([disabled]):not([role="tab"])').count()
    const dead: string[] = []
    for (let i = 0; i < Math.min(n, 30); i++) {
      const r = await page.evaluate(async (idx) => {
        const els = [...document.querySelectorAll<HTMLButtonElement>('.dk-tp button:not([disabled]):not([role="tab"])')].filter((el) => el.getBoundingClientRect().width > 0)
        const el = els[idx]
        if (!el) return { label: '', changed: true }
        const label = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 50)
        let changed = false
        const mo = new MutationObserver(() => (changed = true))
        mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true })
        const off = (window as unknown as { __gamada: G }).__gamada.onEvent('*', () => (changed = true))
        const url = location.href
        el.scrollIntoView({ block: 'center' })
        el.click()
        for (let t = 0; t < 30 && !changed && location.href === url; t++) await new Promise((res) => setTimeout(res, 100))
        mo.disconnect()
        off()
        return { label, changed: changed || location.href !== url }
      }, i)
      if (!r.changed) dead.push(r.label)
      await page.keyboard.press('Escape')
      if (!page.url().includes('/demo/tenderpilot')) await page.goBack()
    }
    expect(dead).toEqual([])
  })
})

test.describe('TenderPilot · 390', () => {
  test.use({ ...PHONE })
  test.describe.configure({ timeout: 90_000 })

  test('alive + no horizontal scroll at 360/390/430', async ({ page, errors }) => {
    await open(page, { autoplay: true })
    await expect(page.locator('.dk-tp-row.is-fresh').first()).toBeVisible({ timeout: 10_000 })
    for (const w of [360, 390, 430]) {
      await page.setViewportSize({ width: w, height: 844 })
      await page.waitForTimeout(200)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    }
    expect(errors).toEqual([])
  })

  test('missions on a phone', async ({ page, errors }) => {
    await open(page)
    await missionFlow(page, true)
    await page.keyboard.press('Escape')
    for (const tab of ['Umpan', 'Detail', 'Dokumen', 'Riwayat']) {
      await page.locator('.dk-tp-tabs .dk-tab', { hasText: tab }).click()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    }
    await expect(page.locator('.dk-tp-hist')).toBeVisible()
    expect(errors.filter((e) => !/api\/ai/.test(e))).toEqual([])
  })
})
