/** (a) routes render without console errors · (b) legacy redirects · (f) the deleted /lab/_design is a 404. */
import { test, expect, settle } from './fixtures'
import { PRODUCT_SLUGS } from '../../src/content/products'

const ROUTES = ['/', '/ekosistem', '/ekosistem/satu-daerah', '/produk/sapa-warga', '/demo/sapa-warga', '/demo/siaga-wilayah', '/ekosistem/usaha-pintar', '/produk/toko-autopilot',
  '/demo/toko-autopilot', '/demo/pajak-beres', '/demo/juara-jualan', '/demo/kenal-mitra', '/demo/pantau-merek', '/demo/tenderpilot',
  // tahap 4 · Pasar Daerah + GAMADA Inti
  '/ekosistem/pasar-daerah', '/ekosistem/inti', '/produk/katalog-lokal', '/demo/katalog-lokal', '/demo/rapor-usaha', '/demo/indeks-ekonomi', '/demo/sinyal-pasar', '/demo/inti',
  '/tur', '/lab', '/karya', '/lab/_kit',
  // tahap 6
  '/produk/radar-isu', '/produk/inti', '/ekosistem/inti?lang=en', '/ekosistem?lang=en', '/lab?lang=en', '/karya?lang=en']

for (const path of ROUTES) {
  test(`renders ${path} with no console errors`, async ({ page, errors }) => {
    const res = await page.goto(path)
    expect(res?.ok()).toBe(true)
    await settle(page)
    await expect(page.locator('main').getByRole('heading').first()).toBeAttached({ timeout: 15_000 })
    await expect(page).not.toHaveTitle(/^404/)
    expect(errors).toEqual([])
  })
}

test.describe('legacy redirects', () => {
  test('/tools → /lab', async ({ page, errors }) => {
    await page.goto('/tools')
    await expect(page).toHaveURL((u) => u.pathname === '/lab')
    expect(errors).toEqual([])
  })
  test('/tools/scrappulse → /demo/radar-isu?tab=analisis', async ({ page, errors }) => {
    await page.goto('/tools/scrappulse')
    await expect(page).toHaveURL((u) => u.pathname === '/demo/radar-isu' && u.searchParams.get('tab') === 'analisis')
    expect(errors).toEqual([])
  })
  test('/karya/kasirku → /produk/toko-autopilot#kasir', async ({ page, errors }) => {
    await page.goto('/karya/kasirku')
    await expect(page).toHaveURL((u) => u.pathname === '/produk/toko-autopilot' && u.hash === '#kasir')
    expect(errors).toEqual([])
  })
  // tahap 6 (plan §6.2)
  test('/tools keeps its query: /tools?eco=usaha-pintar → /lab?eco=usaha-pintar', async ({ page, errors }) => {
    await page.goto('/tools?eco=usaha-pintar')
    await expect(page).toHaveURL((u) => u.pathname === '/lab' && u.searchParams.get('eco') === 'usaha-pintar')
    expect(errors).toEqual([])
  })
  test('/karya/scrappulse → /produk/radar-isu#analisis', async ({ page, errors }) => {
    await page.goto('/karya/scrappulse?off=preloader')
    await expect(page).toHaveURL((u) => u.pathname === '/produk/radar-isu' && u.hash === '#analisis')
    await expect(page.locator('#analisis')).toBeAttached({ timeout: 15_000 })
    expect(errors).toEqual([])
  })
  test('/produk/inti → /ekosistem/inti', async ({ page, errors }) => {
    await page.goto('/produk/inti?off=preloader')
    await expect(page).toHaveURL((u) => u.pathname === '/ekosistem/inti')
    expect(errors).toEqual([])
  })
  test('#kasir lands in the viewport below the navbar', async ({ page, errors }) => {
    await page.goto('/karya/kasirku?off=preloader')
    await settle(page)
    const kasir = page.locator('#kasir')
    await expect(kasir).toBeInViewport({ timeout: 15_000 })
    await expect
      .poll(async () => {
        const top = (await kasir.boundingBox())?.y ?? -1
        const nav = await page.evaluate(() => document.querySelector('header')?.getBoundingClientRect().bottom ?? 0)
        return top >= nav - 2
      }, { timeout: 8_000 })
      .toBe(true)
    expect(errors).toEqual([])
  })
})

// tahap 6 (plan §6.1): every product page in ID and EN; unknown slugs are the 404 page
for (const slug of PRODUCT_SLUGS.filter((s) => s !== 'inti')) {
  for (const lang of ['id', 'en'] as const) {
    test(`renders /produk/${slug} (${lang}): one h1, not 404, no console errors`, async ({ page, errors }) => {
      const res = await page.goto(`/produk/${slug}?off=preloader${lang === 'en' ? '&lang=en' : ''}`)
      expect(res?.ok()).toBe(true)
      await settle(page)
      await expect(page.locator('h1')).toHaveCount(1, { timeout: 15_000 })
      await expect(page).not.toHaveTitle(/^404/)
      if (lang === 'en') await expect(page.locator('html')).toHaveAttribute('lang', 'en')
      expect(errors).toEqual([])
    })
  }
}
for (const path of ['/produk/xyz', '/ekosistem/xyz']) {
  test(`${path} is the 404 page`, async ({ page, errors }) => {
    await page.goto(path)
    await expect(page).toHaveTitle(/^404/, { timeout: 15_000 })
    expect(errors).toEqual([])
  })
}

test('/lab/_design is gone: shows the not-found page', async ({ page, errors }) => {
  await page.goto('/lab/_design')
  await expect(page).toHaveTitle(/^404/)
  await expect(page.locator('h1').first()).toBeAttached()
  expect(errors).toEqual([])
})

test('home in English: the lazy EN dictionary loads and the toggle switches back', async ({ page, errors }) => {
  const en: string[] = []
  page.on('request', (r) => /\/assets\/en-[\w-]+\.js$/.test(r.url()) && en.push(r.url()))
  await page.goto('/?lang=en&off=preloader')
  await settle(page)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  expect(en.length).toBe(1)
  await page.getByRole('button', { name: /^ID, / }).first().click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'id')
  expect(errors).toEqual([])
})
