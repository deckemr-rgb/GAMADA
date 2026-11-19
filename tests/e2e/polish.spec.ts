/**
 * Tahap-1 polish regressions: NEW-1 (toast auto-dismiss after closing a focused toast), NEW-3 (EN then ID clicked
 * quickly ends in ID), the interim "Yang akan bisa Anda coba" preview panel (?t= shows in it, no controls, no
 * region/world download), and lazy desa (desa.min.json is not fetched on the first load of the map kit page).
 */
import { test, expect, settle } from './fixtures'

test('NEW-1: after closing the only toast while it has focus, the next toast still auto-dismisses', async ({ page, errors }) => {
  await page.goto('/lab/_kit?only=ui&off=preloader')
  await settle(page)
  const sim = page.getByRole('button', { name: 'Simulasikan tiket baru' }).first()
  await sim.scrollIntoViewIfNeeded()
  await page.mouse.move(5, 5) // keep the pointer off the toast region (hover also pauses it)
  await sim.focus()
  await page.keyboard.press('Enter')
  const toasts = page.locator('.dk-toasts .dk-toast')
  await expect(toasts).toHaveCount(1)
  // close it from the keyboard while focus is inside the toast
  await toasts.first().locator('.dk-toast-x').focus()
  await page.keyboard.press('Enter')
  await expect(toasts).toHaveCount(0)
  // push the next toast; it must go by itself (≈ 6 s), not stay paused forever
  await sim.focus()
  await page.keyboard.press('Enter')
  await expect(toasts).toHaveCount(1)
  await expect(toasts).toHaveCount(0, { timeout: 12_000 })
  expect(errors).toEqual([])
})

test('NEW-3: EN then ID clicked while the EN chunk is still loading ends in ID (and stores ID)', async ({ page, errors }) => {
  await page.route(/\/assets\/en-[^/]+\.js$/, async (r) => {
    await new Promise((res) => setTimeout(res, 1500))
    await r.continue()
  })
  await page.goto('/ekosistem?off=preloader')
  await settle(page)
  await expect(page.locator('html')).toHaveAttribute('lang', 'id')
  await page.getByRole('button', { name: /^EN, / }).first().click()
  await page.waitForTimeout(150)
  await page.getByRole('button', { name: /^ID, / }).first().click()
  // the EN chunk arrives ~1.4 s later: it must not win
  await page.waitForTimeout(2500)
  await expect(page.locator('html')).toHaveAttribute('lang', 'id')
  expect(await page.evaluate(() => localStorage.getItem('gamada.lang'))).toBe('id')
  expect(errors).toEqual([])
})

// Since tahap 4 every product is DEMO_READY, so no /demo/:slug shows the interim placeholder any more: the test is kept
// (skipped) for a product that is un-flipped locally. The placeholder code path itself is unchanged.
test.skip('interim preview panel: ?t=09:15 shows as 09.15, no controls inside, no region or world download', async ({ page, errors }) => {
  const json: string[] = []
  page.on('request', (r) => /\.json$/.test(new URL(r.url()).pathname) && json.push(new URL(r.url()).pathname))
  await page.goto('/demo/indeks-ekonomi?role=kepala-daerah&t=09:15&off=preloader')
  await settle(page)
  const panel = page.locator('.dk-ph-try')
  await expect(panel).toBeVisible()
  await expect(panel.getByRole('heading', { name: 'Yang akan bisa Anda coba' })).toBeVisible()
  await expect(panel).toContainText('Tautan ini membuka pukul 09.15')
  await expect(panel.locator('[aria-current]').filter({ hasText: 'Kepala Daerah' })).toBeVisible()
  await expect(panel.locator('button, input, select, textarea, [role="button"], [role="slider"], [role="radio"]')).toHaveCount(0)
  // honest interim: the bar has no role / clock / AI / reset control either
  await expect(page.locator('.dk-topbar, header').first().getByRole('button', { name: /reset|ulang/i })).toHaveCount(0)
  // the interim shell needs neither the region pack nor geometry
  expect(json).toEqual([])
  // English: same panel, English copy and time format
  await page.goto('/demo/indeks-ekonomi?role=kepala-daerah&t=09:15&lang=en&off=preloader')
  await settle(page)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(panel.getByRole('heading', { name: 'What you will be able to try' })).toBeVisible()
  await expect(panel).toContainText('This link opens at 09:15')
  await expect(panel).not.toContainText('Tautan ini')
  expect(errors).toEqual([])
})

test('map kit: desa.min.json is not fetched on first load, only after a flood scrub', async ({ page, errors }) => {
  const files: string[] = []
  page.on('request', (r) => {
    const p = new URL(r.url()).pathname
    if (/\.json$/.test(p)) files.push(p.split('/').pop()!)
  })
  await page.goto('/lab/_kit?only=map&off=preloader')
  await settle(page)
  await page.waitForTimeout(1500)
  expect(files.some((f) => f.startsWith('geo.min'))).toBe(true)
  expect(files.some((f) => f.startsWith('pack.min'))).toBe(true)
  expect(files.filter((f) => f.startsWith('desa'))).toEqual([])
  // moving the flood scrubber past +0 h is a desa trigger
  const scrub = page.locator('input[type="range"]').first()
  await scrub.scrollIntoViewIfNeeded()
  await scrub.focus()
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight')
  await expect.poll(() => files.filter((f) => f.startsWith('desa.min')).length, { timeout: 10_000 }).toBe(1)
  expect(errors).toEqual([])
})
