/**
 * Tahap 6 · /produk/:slug template (plan §2.3, §6.4 B2): per slug the 9 sections (data-sec), FAQ 4–6, no rupiah
 * amounts, CTA hrefs; the hero mini mounts when in view and its loop stops when scrolled out; merged anchors;
 * calm mode (reduced motion) shows the final frame until "Putar"; phone width has no horizontal scroll.
 * /produk/inti redirects to /ekosistem/inti (router), so it is not in the per-slug loop.
 */
import { test, expect } from '../fixtures'
import { PRODUCT_BY_SLUG, PRODUCT_SLUGS } from '../../../src/content/products'
import { open, noHScroll, smallTargets, PHONE } from './helpers'

const SLUGS = PRODUCT_SLUGS.filter((s) => s !== 'inti')
const SECTIONS = ['hero', 'problems', 'steps', 'highlights', 'related', 'roles', 'security', 'faq', 'cta'] as const

for (const slug of SLUGS) {
  test(`/produk/${slug}: 9 sections, FAQ 4–6, CTAs, no prices`, async ({ page, errors }) => {
    const p = PRODUCT_BY_SLUG[slug]
    await open(page, `/produk/${slug}`)
    await expect(page.locator('[data-copy="ready"]')).toBeAttached({ timeout: 15_000 })
    for (const sec of SECTIONS) await expect(page.locator(`[data-sec="${sec}"]`), sec).toHaveCount(1)
    await expect(page.locator('h1')).toHaveCount(1)
    const faq = await page.locator('#pr-faq .acc-item').count()
    expect(faq).toBeGreaterThanOrEqual(4)
    expect(faq).toBeLessThanOrEqual(6)
    const hero = page.locator('[data-sec="hero"]')
    await expect(hero.locator(`a[href="/demo/${slug}"]`)).toHaveCount(1)
    await expect(hero.locator(`a[href="/tur/${p.chapters[0]}"]`)).toHaveCount(1)
    await expect(hero.locator('a[href^="https://wa.me/"]')).toHaveCount(1)
    for (const r of p.related) await expect(page.locator(`[data-sec="related"] .pr-rel-list a[href="/produk/${r}"]`)).toHaveCount(1)
    const text = await page.locator('main').innerText()
    expect(text).not.toMatch(/Rp\s?\d/)
    expect(errors).toEqual([])
  })
}

test('hero mini mounts in view, plays, and stops when scrolled out', async ({ page, errors }) => {
  await open(page, '/produk/siaga-wilayah')
  const mini = page.locator('.pr-mini [data-mini="siaga-wilayah"]')
  await expect(mini).toBeAttached({ timeout: 15_000 })
  await expect.poll(async () => Number(await mini.getAttribute('data-mini-step')), { timeout: 10_000 }).toBeGreaterThan(0)
  await page.locator('[data-sec="faq"]').scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  const a = await mini.getAttribute('data-mini-step')
  await page.waitForTimeout(3000)
  expect(await mini.getAttribute('data-mini-step')).toBe(a)
  expect(errors).toEqual([])
})

test('pause button stops the loop', async ({ page, errors }) => {
  await open(page, '/produk/radar-isu')
  const mini = page.locator('.pr-mini [data-mini]')
  await expect(mini).toBeAttached({ timeout: 15_000 })
  await page.locator('.pr-mini-btn').click()
  const a = await mini.getAttribute('data-mini-step')
  await page.waitForTimeout(3000)
  expect(await mini.getAttribute('data-mini-step')).toBe(a)
  expect(errors).toEqual([])
})

test.describe('reduced motion', () => {
  test('final frame, still until "Putar"', async ({ page, errors }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await open(page, '/produk/cek-berkas')
    const mini = page.locator('.pr-mini [data-mini]')
    await expect(mini).toBeAttached({ timeout: 15_000 })
    await expect(mini).toHaveAttribute('data-mini-frame', 'beda')
    await page.waitForTimeout(2500)
    await expect(mini).toHaveAttribute('data-mini-step', '0')
    await page.getByRole('button', { name: /Putar pratinjau/ }).click()
    await expect.poll(async () => Number(await mini.getAttribute('data-mini-step')), { timeout: 10_000 }).toBeGreaterThan(0)
    expect(errors).toEqual([])
  })
})

test('merged anchors: #kasir and #analisis exist with their module links', async ({ page, errors }) => {
  await open(page, '/produk/toko-autopilot#kasir')
  await expect(page.locator('#kasir')).toBeInViewport()
  await expect(page.locator('#kasir a[href="/demo/toko-autopilot?tab=kasir"]')).toHaveCount(1)
  await open(page, '/produk/radar-isu#analisis')
  await expect(page.locator('#analisis a[href="/demo/radar-isu?tab=analisis"]')).toHaveCount(1)
  expect(errors).toEqual([])
})

test('English: section titles and copy switch', async ({ page, errors }) => {
  await open(page, '/produk/sapa-warga', { lang: 'en' })
  await expect(page.locator('[data-copy="ready"]')).toBeAttached({ timeout: 15_000 })
  await expect(page.locator('#pr-problems-title')).toHaveText(/The problems it solves/)
  await expect(page.locator('[data-sec="hero"] .pr-pitch')).toContainText('voice note')
  expect(errors).toEqual([])
})

test.describe('phone', () => {
  test.use(PHONE)
  test('390 px: no horizontal scroll, 44 px targets', async ({ page, errors }) => {
    for (const slug of ['sapa-warga', 'indeks-ekonomi', 'toko-autopilot'] as const) {
      await open(page, `/produk/${slug}`)
      await expect(page.locator('[data-copy="ready"]')).toBeAttached({ timeout: 15_000 })
      expect(await noHScroll(page)).toBe(true)
      expect(await smallTargets(page, 44, 'main')).toEqual([])
    }
    expect(errors).toEqual([])
  })
})
