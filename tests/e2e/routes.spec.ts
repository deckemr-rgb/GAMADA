/** (a) routes render without console errors · (b) legacy redirects · (f) the deleted /lab/_design is a 404. */
import { test, expect, settle } from './fixtures'

const ROUTES = ['/', '/ekosistem', '/ekosistem/satu-daerah', '/produk/sapa-warga', '/demo/sapa-warga', '/demo/siaga-wilayah', '/ekosistem/usaha-pintar', '/produk/toko-autopilot',
  '/demo/toko-autopilot', '/demo/pajak-beres', '/demo/juara-jualan', '/demo/kenal-mitra', '/demo/pantau-merek', '/demo/tenderpilot',
  // tahap 4 · Pasar Daerah + GAMADA Inti
  '/ekosistem/pasar-daerah', '/ekosistem/inti', '/produk/katalog-lokal', '/demo/katalog-lokal', '/demo/rapor-usaha', '/demo/indeks-ekonomi', '/demo/sinyal-pasar', '/demo/inti',
  '/tur', '/lab', '/karya', '/lab/_kit']

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
})

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
