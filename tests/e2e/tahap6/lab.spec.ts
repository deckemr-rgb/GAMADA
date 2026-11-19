/**
 * Tahap 6 · B1 — /lab (plan §2.4, §6.4): filters + URL sync still work, hover / focus preview mounts the product's
 * mini ([data-mini]) after the delay, pauses on leave (data-mini-step stops), keeps ≤ 3 mounted; touch = static art.
 */
import { test, expect } from '../fixtures'
import { open, noHScroll, smallTargets, PHONE } from './helpers'
import { ECO_SITE } from '../../../src/lib/motion'

const card = (page: import('@playwright/test').Page, name: string) => page.locator('.es-lab-card').filter({ has: page.getByRole('heading', { name, exact: true }) })

for (const lang of ['id', 'en'] as const) {
  test(`/lab renders (${lang}): 20 cards, filters ≥ 44 px with aria-pressed, no h-scroll`, async ({ page, errors }) => {
    await open(page, '/lab', { lang })
    await expect(page.locator('h1')).toHaveCount(1)
    await expect(page.locator('.es-lab-card')).toHaveCount(20)
    const btns = page.locator('.eco-fbtn')
    for (const b of await btns.all()) {
      expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44)
      await expect(b).toHaveAttribute('aria-pressed', /true|false/)
    }
    expect(await noHScroll(page)).toBe(true)
    expect(errors).toEqual([])
  })
}

test('filters: eco / status / minutes narrow the grid and sync the URL', async ({ page, errors }) => {
  await open(page, '/lab', { query: 'eco=usaha-pintar' })
  await expect(page.locator('.es-lab-card')).toHaveCount(6)
  await page.locator('.eco-fgroup').nth(2).getByRole('button', { name: /^2 / }).click()
  await expect(page).toHaveURL(/menit=2/)
  await expect(page.locator('.es-lab-card')).toHaveCount(2)
  await page.locator('.eco-fgroup').nth(0).getByRole('button', { name: 'Portofolio' }).click()
  await expect(page.locator('.es-lab-card')).toHaveCount(1)
  await page.locator('.eco-fgroup').nth(0).getByRole('button', { name: 'Semua' }).click()
  await page.locator('.eco-fgroup').nth(2).getByRole('button', { name: 'Semua' }).click()
  await expect(page).toHaveURL((u) => !u.search.includes('menit') && !u.search.includes('eco='))
  await expect(page.locator('.es-lab-card')).toHaveCount(20)
  expect(errors).toEqual([])
})

test('hover preview: mounts [data-mini] after the delay, pauses on leave, ≤ 3 kept mounted', async ({ page, errors }) => {
  await open(page, '/lab')
  const sapa = card(page, 'Sapa Warga')
  await sapa.locator('.es-lab-art').hover()
  await expect(sapa.locator('[data-mini="sapa-warga"]')).toBeVisible({ timeout: 5000 })
  // leave: the mini stays mounted but its frame counter stops
  await page.mouse.move(2, 2)
  await page.waitForTimeout(300)
  const step = await sapa.locator('[data-mini]').getAttribute('data-mini-step')
  await page.waitForTimeout(ECO_SITE.mini.frameMs + 600)
  await expect(sapa.locator('[data-mini]')).toHaveAttribute('data-mini-step', step ?? '0')
  // three more cards: the least recently used one (Sapa Warga) is unmounted
  for (const n of ['Meja Pimpinan', 'Naskah Pintar', 'Radar Isu']) {
    await card(page, n).locator('.es-lab-art').hover()
    await expect(card(page, n).locator('[data-mini]')).toBeAttached({ timeout: 5000 })
  }
  await expect(page.locator('.es-lab-card [data-mini]')).toHaveCount(ECO_SITE.mini.maxMounted)
  await expect(sapa.locator('[data-mini]')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('focus preview: keyboard focus on a card link mounts its mini', async ({ page, errors }) => {
  await open(page, '/lab')
  const c = card(page, 'Cek Berkas')
  await c.locator('.eco-lab-cta').focus()
  await expect(c.locator('[data-mini="cek-berkas"]')).toBeAttached({ timeout: 5000 })
  expect(errors).toEqual([])
})

test.describe('phone', () => {
  test.use(PHONE)
  test('/lab at 390: no preview on touch, no h-scroll, 44 px targets', async ({ page, errors }) => {
    await open(page, '/lab')
    expect(await noHScroll(page)).toBe(true)
    expect(await smallTargets(page)).toEqual([])
    await card(page, 'Sapa Warga').locator('.es-lab-art').tap()
    await page.waitForTimeout(ECO_SITE.mini.previewDelayMs + 400)
    await expect(page.locator('[data-mini]')).toHaveCount(0)
    expect(errors).toEqual([])
  })
})
