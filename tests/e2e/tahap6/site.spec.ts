/**
 * Tahap 6 · B3 "Situs" (plan §2.5–2.8, §6.4): navbar Ekosistem dropdown + mobile group, footer Ekosistem column,
 * home integration (hero CTA 2, Services eco cards, Ecosystem teaser, Portfolio demos, Stats from the registry),
 * /karya merged cards, the two new redirects, and the P8–P17 minis (mounted by /produk, paused when off-screen).
 */
import { test, expect } from '../fixtures'
import { ECOSYSTEMS, ECOSYSTEM_STATS, productsOf, PRODUCT_BY_SLUG, type ProductSlug } from '../../../src/content/products'
import { TOUR } from '../../../src/content/tour'
import { DEMO_READY } from '../../../src/demos/registry'
import { open, noHScroll, smallTargets, sameOriginLinks, PHONE } from './helpers'

const ECO_IDS = ['satu-daerah', 'usaha-pintar', 'pasar-daerah', 'inti'] as const
const ECO_NAMES = ECO_IDS.map((id) => ECOSYSTEMS[id].name)
const READY = Object.values(DEMO_READY).filter(Boolean).length
const B3_MINIS: ProductSlug[] = [
  'toko-autopilot', 'pajak-beres', 'juara-jualan', 'kenal-mitra', 'pantau-merek',
  'tenderpilot', 'katalog-lokal', 'rapor-usaha', 'indeks-ekonomi', 'sinyal-pasar',
]

/** Scroll a home section into view (the sections are a lazy chunk below the pinned scenes). */
async function toSection(page: import('@playwright/test').Page, id: string) {
  const sec = page.locator(`#${id}`)
  await expect(sec).toBeAttached({ timeout: 15_000 })
  await sec.evaluate((el) => el.scrollIntoView({ block: 'start' }))
  return sec
}

test.describe('navbar · Ekosistem dropdown (desktop)', () => {
  test('order, hover, chevron click, ArrowDown, Escape returns focus', async ({ page, errors }) => {
    await open(page, '/karya')
    const nav = page.locator('.gnav-nav')
    // order: Layanan, Ekosistem, Karya, Proses, FAQ
    const labels = await nav.locator('.gnav-links > li').evaluateAll((lis) => lis.map((li) => (li.firstElementChild?.textContent ?? '').trim()))
    expect(labels).toEqual(['Layanan & Produk', 'Ekosistem', 'Karya', 'Proses', 'FAQ'])

    const drop = nav.locator('[data-drop="eco"]')
    const link = drop.locator('a.gnav-link')
    await expect(link).toHaveAttribute('href', '/ekosistem')
    const panel = drop.locator('.gnav-panel')
    // items: 4 ecos, then the tour, then "Semua produk & demo"
    const items = await panel.locator('a').evaluateAll((as) => as.map((a) => [a.getAttribute('href'), (a.textContent ?? '').trim()]))
    expect(items.map((x) => x[0])).toEqual([...ECO_IDS.map((id) => `/ekosistem/${id}`), '/tur', '/lab'])
    ECO_NAMES.forEach((n, i) => expect(items[i]![1]).toContain(n))
    expect(items[4]![1]).toContain(TOUR.regionName)

    // hover opens
    await expect(panel).toHaveAttribute('data-open', 'false')
    await link.hover()
    await expect(panel).toHaveAttribute('data-open', 'true')
    await page.mouse.move(5, 600)
    await expect(panel).toHaveAttribute('data-open', 'false')

    // chevron click opens / closes
    const chev = drop.locator('button.gnav-drop-chev')
    await chev.click()
    await expect(chev).toHaveAttribute('aria-expanded', 'true')
    await page.mouse.click(5, 600)
    await expect(chev).toHaveAttribute('aria-expanded', 'false')

    // keyboard: ArrowDown on the link opens and focuses the first item; Escape closes and returns focus
    await link.focus()
    await page.keyboard.press('ArrowDown')
    await expect(panel).toHaveAttribute('data-open', 'true')
    await expect(panel.locator('a').first()).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(panel).toHaveAttribute('data-open', 'false')
    await expect(link).toBeFocused()
    // Enter on the chevron opens too
    await chev.focus()
    await page.keyboard.press('Enter')
    await expect(panel).toHaveAttribute('data-open', 'true')
    await page.keyboard.press('Escape')
    await expect(panel).toHaveAttribute('data-open', 'false')
    expect(errors).toEqual([])
  })

  test('aria-current on /ekosistem and /produk/*; EN labels', async ({ page }) => {
    await open(page, '/ekosistem')
    await expect(page.locator('[data-drop="eco"] a.gnav-link')).toHaveAttribute('aria-current', 'page')
    await open(page, '/produk/sapa-warga')
    await expect(page.locator('[data-drop="eco"] a.gnav-link')).toHaveAttribute('aria-current', 'true')
    await open(page, '/karya', { lang: 'en' })
    await expect(page.locator('[data-drop="eco"] a.gnav-link')).toHaveText('Ecosystem')
    await expect(page.locator('[data-drop="eco"] .gnav-panel a').nth(4)).toContainText('Tour: A Day in')
  })
})

test.describe('mobile menu (390 px)', () => {
  test.use(PHONE)
  test('Ekosistem group: 4 ecos + tour, 44 px rows, no horizontal scroll', async ({ page, errors }) => {
    await open(page, '/karya')
    await page.locator('.gnav-toggle').click()
    const menu = page.locator('.gnav-menu')
    await expect(menu).toHaveAttribute('data-open', 'true')
    const group = menu.locator('.gnav-menu-item').filter({ has: page.locator('a.gnav-menu-link[href="/ekosistem"]') })
    const subs = group.locator('.gnav-menu-sub a')
    await expect(subs).toHaveCount(5)
    expect(await subs.evaluateAll((as) => as.map((a) => a.getAttribute('href')))).toEqual([...ECO_IDS.map((id) => `/ekosistem/${id}`), '/tur'])
    await page.waitForTimeout(700) // curtain + stagger
    expect(await smallTargets(page, 44, '.gnav-menu .gnav-menu-sub')).toEqual([])
    expect(await noHScroll(page)).toBe(true)
    await subs.first().click()
    await expect(page).toHaveURL(/\/ekosistem\/satu-daerah$/)
    expect(errors).toEqual([])
  })
})

test.describe('home integration', () => {
  test('hero CTA 2 opens /ekosistem', async ({ page }) => {
    await open(page, '/')
    const cta = page.getByRole('button', { name: 'Lihat demo ekosistem' })
    await expect(cta).toBeVisible({ timeout: 15_000 })
    await cta.click()
    await expect(page).toHaveURL(/\/ekosistem$/, { timeout: 15_000 })
  })

  test('Services: 3 eco cards with registry counts, Inti line, custom line; Stats from the registry', async ({ page, errors }) => {
    await open(page, '/')
    const sec = await toSection(page, 'layanan')
    const cards = sec.locator('.svc-card')
    await expect(cards).toHaveCount(3)
    for (const [i, id] of (['satu-daerah', 'usaha-pintar', 'pasar-daerah'] as const).entries()) {
      const card = cards.nth(i)
      await expect(card.locator('.svc-title')).toHaveText(ECOSYSTEMS[id].name)
      await expect(card.locator('.tag')).toHaveText(`${productsOf(id).length} produk`)
      await expect(card.locator('.svc-chips li')).toHaveCount(3)
      for (const name of await card.locator('.svc-chips li').allTextContents()) {
        expect(productsOf(id).map((p) => p.name)).toContain(name)
      }
      await expect(card.locator('a')).toHaveAttribute('href', `/ekosistem/${id}`)
    }
    await expect(sec.locator('.svc-more a[href="/ekosistem/inti"]')).toBeVisible()
    await expect(sec.locator('.svc-more a[href="/karya"]')).toBeVisible()

    const stats = await toSection(page, 'angka')
    // the screen-reader copy holds the final value (the visible digits count up)
    const nums = (await stats.locator('.stat-value .sr-only').allTextContents()).map((s) => s.replace(/\D+/g, ''))
    expect(nums.slice(0, 3)).toEqual([String(ECOSYSTEM_STATS.products), String(ECOSYSTEM_STATS.ecosystems), String(READY)])
    expect(errors).toEqual([])
  })

  test('Ecosystem teaser: Inti + 3 ecos, links; Portfolio: 3 demos with try + detail links', async ({ page, errors }) => {
    await open(page, '/')
    const eco = await toSection(page, 'integrasi')
    await expect(eco.locator('.eco-node-btn')).toHaveCount(4)
    await expect(eco.locator('.eco-more a')).toHaveAttribute('href', '/ekosistem')
    await eco.locator('.eco-node--usaha-pintar .eco-node-btn').click()
    await expect(eco.locator('.eco-cta')).toHaveAttribute('href', '/ekosistem/usaha-pintar')

    const pf = await toSection(page, 'portofolio')
    for (const slug of ['sapa-warga', 'siaga-wilayah', 'toko-autopilot'] as const) {
      const card = pf.locator(`.pf-card--${slug}`)
      await expect(card.locator('.pf-title')).toHaveText(PRODUCT_BY_SLUG[slug].name)
      await expect(card.locator(`a[href="/demo/${slug}"]`)).toHaveCount(1)
      await expect(card.locator(`a[href="/produk/${slug}"]`)).toHaveCount(1)
    }
    await expect(pf.locator('.pf-more a')).toHaveAttribute('href', '/karya')
    expect(errors).toEqual([])
  })

  test('EN home sections', async ({ page }) => {
    await open(page, '/', { lang: 'en' })
    await expect(page.getByRole('button', { name: 'See the ecosystem demos' })).toBeVisible({ timeout: 15_000 })
    const sec = await toSection(page, 'layanan')
    await expect(sec.locator('h2')).toHaveText('Three ecosystems, one foundation.')
    await expect(sec.locator('.svc-card').first().locator('.tag')).toHaveText(`${productsOf('satu-daerah').length} products`)
  })
})

test.describe('home at 390 px', () => {
  test.use(PHONE)
  test('home sections: no horizontal scroll, 44 px targets in my sections', async ({ page }) => {
    await open(page, '/')
    for (const id of ['layanan', 'portofolio', 'integrasi']) {
      await toSection(page, id)
      await page.waitForTimeout(400)
      expect(await smallTargets(page, 44, `#${id}`), id).toEqual([])
    }
    expect(await noHScroll(page)).toBe(true)
  })
})

test('footer: Ekosistem column links, Layanan column points to /#layanan + /ekosistem', async ({ page }) => {
  await open(page, '/karya')
  const col = page.locator('.sfoot-col[data-col="eco"]')
  await expect(col.locator('h2')).toHaveText('Ekosistem')
  expect(await sameOriginLinks(page, '.sfoot-col[data-col="eco"]')).toEqual([...ECO_IDS.map((id) => `/ekosistem/${id}`), '/tur', '/lab'])
  const svc = await sameOriginLinks(page, '.sfoot-col:nth-child(2)')
  expect(svc).toContain('/#layanan')
  expect(svc).toContain('/ekosistem')
})

test('/karya: merged cards on the home Card link to the product anchors', async ({ page, errors }) => {
  await open(page, '/karya')
  await expect(page.locator('.karya-merged-card.card')).toHaveCount(2)
  await expect(page.locator('a.karya-merged[href="/produk/toko-autopilot#kasir"]')).toHaveCount(1)
  await expect(page.locator('a.karya-merged[href="/produk/radar-isu#analisis"]')).toHaveCount(1)
  expect(errors).toEqual([])
})

test.describe('redirects (B3)', () => {
  test('/karya/scrappulse → /produk/radar-isu#analisis', async ({ page }) => {
    await page.goto('/karya/scrappulse?off=preloader')
    await expect(page).toHaveURL(/\/produk\/radar-isu\?off=preloader#analisis$/)
  })
  test('/produk/inti → /ekosistem/inti', async ({ page }) => {
    await page.goto('/produk/inti?off=preloader')
    await expect(page).toHaveURL(/\/ekosistem\/inti\?off=preloader$/)
    await expect(page.locator('h1')).toHaveCount(1)
  })
})

test.describe('minis P8–P17 (mounted by /produk, plan §2.3)', () => {
  for (const slug of B3_MINIS) {
    test(`${slug}: mounts near the viewport, plays, stops off-screen`, async ({ page, errors }) => {
      await open(page, `/produk/${slug}`)
      const mini = page.locator(`[data-mini="${slug}"]`).first()
      await expect(mini).toBeAttached({ timeout: 15_000 })
      await mini.evaluate((el) => el.scrollIntoView({ block: 'center' }))
      const step0 = Number(await mini.getAttribute('data-mini-step'))
      await expect.poll(async () => Number(await mini.getAttribute('data-mini-step')), { timeout: 8_000 }).toBeGreaterThan(step0)
      // scrolled away: the loop holds its frame
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      await page.waitForTimeout(600)
      const held = await mini.getAttribute('data-mini-step')
      await page.waitForTimeout(3500)
      expect(await mini.getAttribute('data-mini-step')).toBe(held)
      expect(errors).toEqual([])
    })
  }
})
