/**
 * Tahap 6 · B1 — /ekosistem (constellation, panels, flow, FAQ) and /ekosistem/:eco (plan §2.1, §2.2, §6.4).
 */
import { test, expect } from '../fixtures'
import { open, noHScroll, smallTargets, sameOriginLinks, PHONE } from './helpers'
import { PRODUCT_SLUGS, isProductSlug } from '../../../src/content/products'
import { chaptersOfEco } from '../../../src/content/tour'
import { HUB_FLOW, HUB_FLOW_CHAPTER } from '../../../src/content/ecoPages'
import { DEMO_READY, DEMO_STAGE } from '../../../src/demos/registry'
import { SITE_DEMO_READY, SITE_DEMO_STAGE } from '../../../src/routes/eco/ready'

const ECOS = ['satu-daerah', 'usaha-pintar', 'pasar-daerah', 'inti'] as const
const productPath = (s: string) => (s === 'inti' ? '/ekosistem/inti' : `/produk/${s}`)

/** every same-origin link on the page points at a known product / eco / tour / site route */
async function linksAreKnown(page: import('@playwright/test').Page) {
  const bad: string[] = []
  for (const l of await sameOriginLinks(page, 'main')) {
    const path = l.split(/[?#]/)[0] ?? ''
    const m = path.match(/^\/(produk|demo)\/([^/]+)$/)
    if (m && !isProductSlug(m[2] ?? '')) bad.push(l)
    const e = path.match(/^\/ekosistem\/([^/]+)$/)
    if (e && !(ECOS as readonly string[]).includes(e[1] ?? '')) bad.push(l)
    const t = path.match(/^\/tur\/(\d+)$/)
    if (t && !(Number(t[1]) >= 1 && Number(t[1]) <= 20)) bad.push(l)
  }
  return bad
}

test('routes/eco/ready.ts mirrors DEMO_READY / DEMO_STAGE of the registry', () => {
  expect(SITE_DEMO_READY).toEqual(DEMO_READY)
  expect(SITE_DEMO_STAGE).toEqual(DEMO_STAGE)
})

for (const lang of ['id', 'en'] as const) {
  test(`/ekosistem renders (${lang}): one h1, 18 stars, panels, flow, FAQ, no console errors`, async ({ page, errors }) => {
    await open(page, '/ekosistem', { lang })
    await expect(page.locator('h1')).toHaveCount(1)
    await expect(page.locator('.cst-btn')).toHaveCount(PRODUCT_SLUGS.length)
    for (const id of ['produk', 'satu-daerah', 'usaha-pintar', 'pasar-daerah', 'inti', 'alur', 'faq-ekosistem']) await expect(page.locator(`#${id}`)).toBeAttached()
    await expect(page.locator('#faq-ekosistem .acc-item')).toHaveCount(5)
    expect(await linksAreKnown(page)).toEqual([])
    expect(await noHScroll(page)).toBe(true)
    // honesty: no prices, no claims
    const text = (await page.locator('main').innerText()).toLowerCase()
    expect(text).not.toMatch(/rp\s?\d|e-katalog|sertifika|certif/)
    expect(errors).toEqual([])
  })
}

test('constellation: hover shows the card with the right name and brightens its lines', async ({ page, errors }) => {
  await open(page, '/ekosistem')
  await page.locator('.cst-btn[data-slug="siaga-wilayah"]').hover()
  const card = page.locator('.cst-card')
  await expect(card).toBeVisible()
  await expect(card.locator('.cst-card-name')).toHaveText('Siaga Wilayah')
  await expect(card.getByRole('link')).toHaveAttribute('href', '/produk/siaga-wilayah')
  expect(await page.locator('.cst-line[data-on]').count()).toBeGreaterThan(0)
  expect(errors).toEqual([])
})

test('constellation: star click zooms and opens /produk/<slug>', async ({ page, errors }) => {
  await open(page, '/ekosistem')
  await page.locator('.cst-btn[data-slug="sapa-warga"]').click()
  await expect(page).toHaveURL((u) => u.pathname === '/produk/sapa-warga')
  expect(errors).toEqual([])
})

test('constellation: Tab reaches all 18 stars in order (Inti first), Enter navigates', async ({ page, errors }) => {
  await open(page, '/ekosistem')
  const first = page.locator('.cst-btn').first()
  await first.focus()
  const seen: string[] = []
  for (let i = 0; i < PRODUCT_SLUGS.length; i++) {
    seen.push((await page.evaluate(() => document.activeElement?.getAttribute('data-slug'))) ?? '')
    if (i < PRODUCT_SLUGS.length - 1) await page.keyboard.press('Tab')
  }
  expect(seen[0]).toBe('inti')
  expect(new Set(seen).size).toBe(PRODUCT_SLUGS.length)
  // focus shows the same card as hover
  await expect(page.locator('.cst-card-name')).toHaveText(/Sinyal Pasar/)
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL((u) => u.pathname === '/produk/sinyal-pasar')
  expect(errors).toEqual([])
})

test('constellation: reduced motion ⇒ lines drawn, no zoom transform, plain navigation', async ({ page, errors }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page, '/ekosistem')
  expect(await page.locator('.cst-line').first().evaluate((el) => getComputedStyle(el).strokeDashoffset)).toMatch(/^0(px)?$/)
  await page.locator('.cst-btn[data-slug="awas-belanja"]').click()
  expect(await page.locator('.cst-star[data-slug="awas-belanja"]').evaluate((el) => el.getAttribute('style') ?? '')).not.toMatch(/scale|matrix/)
  await expect(page).toHaveURL((u) => u.pathname === '/produk/awas-belanja')
  expect(errors).toEqual([])
})

test('constellation ?off=constellation: static sky, still navigable', async ({ page, errors }) => {
  await open(page, '/ekosistem', { query: 'off=preloader,constellation' })
  await expect(page.locator('.cst-btn')).toHaveCount(PRODUCT_SLUGS.length)
  expect(await page.locator('.cst-line').first().evaluate((el) => getComputedStyle(el).strokeDasharray)).toBe('none')
  expect(errors).toEqual([])
})

test('flow diagram: 7 nodes link to their products and the CTA opens the tour chapter', async ({ page, errors }) => {
  await open(page, '/ekosistem')
  const steps = page.locator('#alur .flw-step')
  await expect(steps).toHaveCount(HUB_FLOW.length)
  for (let i = 0; i < HUB_FLOW.length; i++) await expect(steps.nth(i).locator('.flw-link')).toHaveAttribute('href', productPath(HUB_FLOW[i]!.slug))
  await expect(page.locator('#alur .es-flow-cta a')).toHaveAttribute('href', `/tur/${HUB_FLOW_CHAPTER}`)
  expect(errors).toEqual([])
})

test.describe('phone', () => {
  test.use(PHONE)
  test('/ekosistem at 390: first tap shows the card, second tap opens; no h-scroll; 44 px targets', async ({ page, errors }) => {
    await open(page, '/ekosistem')
    expect(await noHScroll(page)).toBe(true)
    expect(await smallTargets(page)).toEqual([])
    const star = page.locator('.cst-btn[data-slug="katalog-lokal"]')
    await star.tap()
    await expect(page.locator('.cst-card-name')).toHaveText('Katalog Lokal')
    await expect(page).toHaveURL((u) => u.pathname === '/ekosistem')
    await star.tap()
    await expect(page).toHaveURL((u) => u.pathname === '/produk/katalog-lokal')
    expect(errors).toEqual([])
  })
  for (const eco of ECOS) {
    test(`/ekosistem/${eco} at 390: no h-scroll, 44 px targets`, async ({ page, errors }) => {
      await open(page, `/ekosistem/${eco}`)
      expect(await noHScroll(page)).toBe(true)
      expect(await smallTargets(page)).toEqual([])
      expect(errors).toEqual([])
    })
  }
})

for (const eco of ECOS) {
  for (const lang of ['id', 'en'] as const) {
    test(`/ekosistem/${eco} (${lang}): story, flow → /tur/<n>, products, buyers / Inti modules`, async ({ page, errors }) => {
      await open(page, `/ekosistem/${eco}`, { lang })
      await expect(page.locator('h1')).toHaveCount(1)
      await expect(page.locator('#cerita .es-story li')).toHaveCount(3)
      if (eco === 'inti') {
        await expect(page.locator('#modul .es-module')).toHaveCount(4)
        await expect(page.locator('#produk .es-tile')).toHaveCount(PRODUCT_SLUGS.length - 1)
        await expect(page.locator('#didapat li')).toHaveCount(4)
        await expect(page.locator('#modul a[href="/demo/inti"]')).toHaveCount(1)
      } else {
        const chapters = chaptersOfEco(eco).map((c) => `/tur/${c.n}`)
        expect(await page.locator('#alur .flw-link').evaluateAll((as) => as.map((a) => a.getAttribute('href')))).toEqual(chapters)
        await expect(page.locator('#untuk-siapa .es-buyer')).toHaveCount(4)
      }
      expect(await linksAreKnown(page)).toEqual([])
      expect(errors).toEqual([])
    })
  }
}

test('/ekosistem/xyz is the 404 page', async ({ page }) => {
  await open(page, '/ekosistem/xyz')
  await expect(page).toHaveTitle(/404|tidak ditemukan|not found/i)
})
