/**
 * GAMADA Inti (P0) — plan docs/build/tahap4-plan.md §2 P0. Missions at 1440 and 390, the data trail = Audit Log,
 * the access matrix = PRODUCTS[].roles, Kanal unread across screens, Audit export = filtered rows, ?focus= arrivals,
 * roles (sekretariat preview, pemilik-toko scope), language, reduced motion, alive within 10 s and the story hops
 * (C1 / C7 / C11 / C36 lanes light). Not DEMO_READY yet: `?controls=all`.
 */
import type { Page } from '@playwright/test'
import { expect, test } from '../fixtures'
import { PRODUCTS, ROLES } from '../../../src/content/products'

/* eslint-disable @typescript-eslint/no-explicit-any */
type G = any
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } as const
const URL0 = '/demo/inti?controls=all&off=preloader&e2e=1'
const MKEY = 'gamada:demo:missions:inti'

async function open(page: Page, q = ''): Promise<void> {
  await page.goto(URL0 + q)
  await page.waitForFunction(() => (window as G).__gamada?.world.status() === 'ready', null, { timeout: 60_000 })
  await page.evaluate(() => (window as G).__gamada.clock.pause())
  await expect(page.locator('.dk-in:not([aria-busy])')).toBeVisible({ timeout: 20_000 })
}
const W = <T>(page: Page, fn: string): Promise<T> => page.evaluate(`(() => { const g = window.__gamada; const s = g.world.get(); ${fn} })()`) as Promise<T>
const missions = (page: Page) => page.evaluate((k) => localStorage.getItem(k) ?? '', MKEY)
const tab = async (page: Page, id: string) => {
  await page.locator(`#dk-in-tab-${id}`).click()
  await expect(page.locator(`#dk-in-tab-${id}`)).toHaveAttribute('aria-selected', 'true')
}
const num = (s: string) => Number(s.replace(/[^\d]/g, ''))
const noHScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)

async function playTrail(page: Page): Promise<void> {
  await page.locator('[data-in="play"]').click()
  await expect(page.locator('[data-in="trail"]')).toHaveAttribute('data-drawn', '6', { timeout: 20_000 })
  await expect(page.locator('[data-in="trail-status"]')).toContainText('6 dari 6')
}

test.describe('inti · desktop', () => {
  test('alive within 10 s: the pulse counter moves without input', async ({ page, errors }) => {
    await open(page)
    const c0 = num(await page.locator('[data-in="pulse-count"]').innerText())
    await page.evaluate(() => (window as G).__gamada.clock.play())
    await expect.poll(async () => num(await page.locator('[data-in="pulse-count"]').innerText()), { timeout: 10_000 }).toBeGreaterThan(c0)
    expect(errors).toEqual([])
  })

  test('mission jejak: 6 lanes in order, every node = an Audit row, drawer → Audit row', async ({ page, errors }) => {
    await open(page)
    await expect(page.locator('[data-root="siti"]')).toBeDisabled()
    const t0 = Date.now()
    await playTrail(page)
    expect(Date.now() - t0).toBeLessThan(15_000)
    const ids = await page.locator('[data-in="node"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-audit')))
    expect(ids.every(Boolean)).toBe(true)
    for (const id of ids) expect(await W<boolean>(page, `return !!s.auditLog.byId['${id}']`)).toBe(true)
    // lanes in spine order: each node's product
    const lanes = await page.locator('.dk-in-lane').evaluateAll((els) => els.map((e) => e.getAttribute('data-lane')))
    expect(lanes).toEqual(['sapa-warga', 'siaga-wilayah', 'meja-pimpinan', 'naskah-pintar', 'awas-belanja', 'katalog-lokal'])
    // the Sapa Warga node = Ibu Siti's complaint code
    const code = await W<string>(page, `const d0 = Math.floor(g.clock.get().minutes / 1440) * 1440; const c = s.complaints.ids.map((i) => s.complaints.byId[i]).find((c) => c.citizenId === s.meta.personas.siti && c.category === 'banjir' && c.at >= d0); return c.code`)
    await expect(page.locator('[data-lane="sapa-warga"] .dk-in-node-text')).toContainText(code)
    // the Awas Belanja node's package exists, the Katalog Lokal node is a need with matches (C11 → C36)
    expect(await W<number>(page, `const n = Object.values(s.catalogNeeds.byId).find((n) => (n.cause || '').startsWith('procurements:')); return n ? Object.values(s.matches.byId).filter((m) => m.needId === n.id).length : 0`)).toBeGreaterThan(0)
    await expect.poll(() => missions(page)).toContain('jejak')
    // node → drawer → Audit row with the same text
    const node = page.locator('[data-lane="meja-pimpinan"] [data-in="node"]')
    const aid = (await node.getAttribute('data-audit'))!
    const text = await W<string>(page, `return s.auditLog.byId['${aid}'].summary.id`)
    await node.click()
    await page.locator('[data-in="to-audit"]').click()
    await expect(page.locator('#dk-in-tab-audit')).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator(`[data-audit-id="${aid}"]`)).toHaveText(text)
    await expect(page.locator('[data-in="audit-count"]')).toHaveAttribute('data-n', '1')
    expect(errors).toEqual([])
  })

  test('mission peran + matrix = PRODUCTS[].roles (25 × 17)', async ({ page, errors }) => {
    await open(page)
    await tab(page, 'id')
    const cells = await page.locator('[data-in="matrix"] [data-cell]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-cell'), e.classList.contains('is-yes')] as [string, boolean]))
    const prods = PRODUCTS.filter((p) => p.slug !== 'inti')
    expect(cells.length).toBe(Object.keys(ROLES).length * prods.length)
    expect(cells.length).toBe(25 * 17)
    for (const [k, yes] of cells) {
      const [r, slug] = k.split('|') as [string, string]
      expect(yes, k).toBe(prods.find((p) => p.slug === slug)!.roles.includes(r as never))
    }
    await expect(page.locator('[data-in="as-count"]')).toContainText('akses ke 6 dari 17')
    await page.locator('.dk-in-aspick').click()
    await page.getByRole('option', { name: 'Pemilik Toko' }).click()
    await expect(page.locator('[data-in="as-role"]')).toContainText('Pemilik Toko')
    await expect.poll(() => missions(page)).toContain('peran')
    expect(errors).toEqual([])
  })

  test('mission agen: empty state, then the flood plan shows intent + 5 tools + data + answer', async ({ page, errors }) => {
    await open(page)
    await page.evaluate(() => sessionStorage.removeItem('gamada:ai-traces'))
    await open(page)
    await tab(page, 'agen')
    await expect(page.locator('[data-in="agen-empty"]')).toBeVisible()
    await page.locator('[data-in="chip-flood"]').click()
    await expect(page.locator('[data-in="timeline"]')).toHaveAttribute('data-steps', '8', { timeout: 20_000 })
    await expect(page.locator('[data-in="plan"] li')).toHaveCount(5)
    await expect(page.locator('.dk-in-tl-step.is-tool')).toHaveCount(5)
    // T5 (e): the request history shows the world clock of the answer (not the wall clock)
    const wAt = await page.evaluate(() => JSON.parse(sessionStorage.getItem('gamada:ai-traces') ?? '[]')[0]?.worldAt as number)
    await expect(page.locator('.dk-in-tr-from').first()).toContainText(`${String(Math.floor(wAt / 60) % 24).padStart(2, '0')}.${String(wAt % 60).padStart(2, '0')}`)
    await expect.poll(() => missions(page)).toContain('agen')
    // the KPI on Inti Data counts the run
    await tab(page, 'data')
    await expect(page.locator('.dk-in-kpis')).toContainText('Agen berjalan (sesi ini)')
    expect(errors).toEqual([])
  })

  test('mission kanal: chat.read lowers unread in Kanal and on Inti Data; the source row is read', async ({ page, errors }) => {
    await open(page)
    const kpiUnread = async () => Number(await page.locator('.dk-in-kpiwrap').getAttribute('data-unread'))
    const u0 = await kpiUnread()
    await tab(page, 'kanal')
    await expect(page.locator('[data-in="kanal-kpi"]')).toHaveAttribute('data-unread', String(u0))
    const first = page.locator('.dk-in-msg.is-unread').first()
    const id = (await first.getAttribute('data-msg'))!
    await first.click()
    await page.locator('[data-in="mark-read"]').click()
    await expect(page.locator('[data-in="kanal-kpi"]')).toHaveAttribute('data-unread', String(u0 - 1))
    await expect.poll(() => missions(page)).toContain('kanal')
    expect(await W<boolean>(page, `const c = s.complaints.byId['${id}'] || s.chats.byId['${id}'] || s.calls.byId['${id}']; return c.readAt != null || c.unread === 0`)).toBe(true)
    await page.keyboard.press('Escape')
    await tab(page, 'data')
    expect(await kpiUnread()).toBe(u0 - 1)
    expect(errors).toEqual([])
  })

  test('mission audit: today count = pulse, CSV rows = filtered rows', async ({ page, errors }) => {
    await open(page)
    const pulse = num(await page.locator('[data-in="pulse-count"]').innerText())
    await tab(page, 'audit')
    await expect(page.locator('[data-in="audit-today"]')).toHaveAttribute('data-n', String(pulse))
    await page.locator('[data-in="audit-product"]').selectOption('sapa-warga')
    const n = Number(await page.locator('[data-in="audit-count"]').getAttribute('data-n'))
    expect(n).toBeGreaterThan(0)
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-in="export-csv"]').click()])
    expect(dl.suggestedFilename()).toMatch(/^audit-gamada-.+-\d{4}\.csv$/)
    const csv = await (await dl.createReadStream()).toArray().then((b) => Buffer.concat(b).toString('utf8'))
    const lines = csv.trim().split('\n')
    expect(lines[0]).toBe('id,waktu,produk,aktor,jenis,ringkasan,entitas,sebab')
    expect(lines.length - 1).toBe(n)
    await expect.poll(() => missions(page)).toContain('audit')
    expect(errors).toEqual([])
  })

  test('?focus= arrivals: AU- ⇒ Audit row, entity ⇒ Data root, unknown ⇒ toast', async ({ page, errors }) => {
    await open(page, '&focus=AU-0003')
    await expect(page.locator('#dk-in-tab-audit')).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('[data-audit-id="AU-0003"]')).toBeVisible()
    await open(page, '&focus=businesses:UM-0001')
    await expect(page.locator('[data-root="shop"]')).toHaveAttribute('aria-pressed', 'true')
    await open(page, '&focus=XX-9999')
    await expect(page.getByText('Data tidak ditemukan')).toBeVisible()
    await expect(page.locator('#dk-in-tab-data')).toHaveAttribute('aria-selected', 'true')
    expect(errors).toEqual([])
  })

  test('roles: sekretariat preview + actor first; pemilik-toko scope', async ({ page, errors }) => {
    await open(page, '&role=sekretariat&tab=id')
    await page.locator('[data-in="manage"]').click()
    await page.locator('[data-cell="warga|rapor-usaha"]').click()
    await expect(page.locator('[data-in="changes"]')).toContainText('1 sel diubah')
    await expect(page.locator('[data-cell="warga|rapor-usaha"]')).toHaveAttribute('aria-pressed', 'true')
    await page.locator('[data-in="manage-reset"]').click()
    await expect(page.locator('[data-cell="warga|rapor-usaha"]')).toHaveAttribute('aria-pressed', 'false')
    await tab(page, 'audit')
    await expect(page.locator('[role="columnheader"]').first()).toContainText('Aktor')
    await open(page, '&role=pemilik-toko')
    await expect(page.locator('[data-in="scope-note"]')).toBeVisible()
    await expect(page.locator('[data-lane="sapa-warga"]')).toHaveAttribute('data-state', 'hidden')
    const pulse = num(await page.locator('[data-in="pulse-count"]').innerText())
    await tab(page, 'audit')
    await expect(page.locator('[data-in="audit-today"]')).toHaveAttribute('data-n', String(pulse))
    expect(errors).toEqual([])
  })

  test('EN + reduced motion: the trail renders its final state; no repeated feed sentence', async ({ page, errors }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await open(page, '&lang=en')
    await expect(page.locator('#dk-in-tab-agen')).toContainText('Inti Agents')
    await page.locator('[data-in="play"]').click()
    await expect(page.locator('[data-in="trail"]')).toHaveAttribute('data-drawn', '6', { timeout: 20_000 })
    await expect(page.locator('[data-in="trail-status"]')).toContainText('6 of 6')
    const feed = await page.locator('.dk-actfeed-text').allInnerTexts()
    expect(new Set(feed).size).toBe(feed.length)
    expect(await noHScroll(page)).toBe(true)
    expect(errors).toEqual([])
  })
})

test.describe('inti · phone 390', () => {
  test.use(PHONE)
  test('missions jejak + audit on a phone; no horizontal scroll; guide visible', async ({ page, errors }) => {
    await open(page)
    expect(await noHScroll(page)).toBe(true)
    await expect(page.locator('.dk-mpill, .dk-guide-pill, [class*="mpill"]').first()).toBeVisible()
    await playTrail(page)
    await expect.poll(() => missions(page)).toContain('jejak')
    expect(await noHScroll(page)).toBe(true)
    await tab(page, 'audit')
    await page.locator('[data-in="audit-filters"]').click()
    await page.locator('[data-in="audit-product"]').selectOption('meja-pimpinan')
    await page.keyboard.press('Escape')
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-in="export-json"]').click()])
    expect(dl.suggestedFilename()).toMatch(/\.json$/)
    await expect.poll(() => missions(page)).toContain('audit')
    for (const t of ['id', 'agen', 'kanal']) {
      await tab(page, t)
      expect(await noHScroll(page), t).toBe(true)
    }
    expect(errors).toEqual([])
  })
})
