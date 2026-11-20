/**
 * Tahap 7 · region matrix (plan docs/build/tahap7-plan.md §6, item 8): 18 demos × {bojonegoro, bandung, padang}.
 * Each test opens `?region=<id>`, checks the world really is that region (the Tahap 7 boot race installed Bojonegoro
 * under a Bandung shell), the TopBar picker shows it, a name from that pack (kecamatan, market, river or the region's
 * short name) is visible in the canvas within 10 s, then switches region from the picker WITHOUT a reload (a window
 * marker survives) and checks the world reset to the new region's seed at the morning clock.
 * The ID → EN → ID part of the matrix lives in tests/e2e/tahap2/region-lang.spec.ts (same 54 combinations).
 * Extra: Siaga Wilayah's map flies to the pack's bbox; Sapa Warga's sample voice note in Sunda / Minang shows its
 * translation.
 */
import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { expect, test } from '../fixtures'
import { ROOT, SLUGS, notNoise, openDemo, type Slug } from '../tahap2/helpers'

/* eslint-disable @typescript-eslint/no-explicit-any */
type G = any

interface PackLite {
  id: string
  shortName: string
  center: [number, number]
  bbox: [number, number, number, number]
  kecamatan: { name: string }[]
  rivers?: { name: string }[]
  markets?: { name: string }[]
  languages: { regional: string[]; samples: { complaintTemplates: { lang: string; text: string }[] } }
}
const REGION_IDS = ['bojonegoro', 'bandung', 'padang'] as const
type RegionId = (typeof REGION_IDS)[number]
const PACK = Object.fromEntries(
  REGION_IDS.map((id) => [id, JSON.parse(readFileSync(`src/demo-kit/region/packs/${id}/pack.json`, 'utf8')) as PackLite]),
) as Record<RegionId, PackLite>
/**
 * Demos whose first screen names no place at all (a shop dashboard, a call-QA list, a procurement desk, the Inti
 * overview). For these the region is asserted on the world (regionId) and the TopBar only. Cek Berkas left this list in
 * Tahap 8: its specimen gallery follows the active pack (test at the end of this file).
 */
const NO_PLACE_ON_FIRST_SCREEN = new Set<string>(['awas-belanja', 'toko-autopilot', 'juara-jualan', 'inti'])
const NEXT: Record<RegionId, RegionId> = { bojonegoro: 'bandung', bandung: 'padang', padang: 'bojonegoro' }
/** WORLD.clockStart (07:00): a fresh region starts there */
const CLOCK_START = 7 * 60

function names(p: PackLite): string[] {
  return [p.shortName, ...p.kecamatan.map((k) => k.name), ...(p.markets ?? []).map((m) => m.name), ...(p.rivers ?? []).map((r) => r.name)].filter((n) => n.length >= 4)
}

const worldRegion = (page: Page) => page.evaluate(() => (window as G).__gamada.world.get().regionId as string)

async function pickRegion(page: Page, to: RegionId): Promise<void> {
  const name = PACK[to].shortName
  const trigger = page.locator('.dk-topbar').getByRole('button', { name: 'Pilih wilayah' })
  if (await trigger.isVisible().catch(() => false)) {
    await trigger.click()
    await page.getByRole('option').filter({ hasText: name }).first().click()
  } else {
    // narrow bar: the region lives in the "more" sheet as a radio group
    await page.locator('[data-dk-more]').click()
    await page.getByRole('radiogroup', { name: /Wilayah|Region/ }).getByRole('radio').filter({ hasText: name }).first().click()
    await page.keyboard.press('Escape')
  }
}

test.describe.configure({ timeout: 120_000 })

for (const slug of SLUGS) {
  for (const region of REGION_IDS) {
    test(`region ${region} · ${slug}: pack names, picker switch without reload resets the world`, async ({ page, errors }) => {
      const pack = PACK[region]
      await openDemo(page, slug as Slug, { extra: `region=${region}` })
      expect(await worldRegion(page)).toBe(region)
      await expect(page.locator('.dk-topbar .dk-region-label')).toContainText(pack.shortName)

      // a name of this pack in the canvas (products show kecamatan, markets, the river or "Kota X")
      const canvas = page.locator('.dk-shell-canvas').first()
      const want = names(pack)
      if (!NO_PLACE_ON_FIRST_SCREEN.has(slug)) await expect
        .poll(async () => {
          const txt = await canvas.innerText().catch(() => '')
          return want.some((n) => txt.includes(n))
        }, { timeout: 10_000, message: `a ${region} name in the ${slug} canvas` })
        .toBe(true)
      await expect(page.locator(ROOT[slug as Slug]).first()).toBeVisible()
      // T8: the Naskah Pintar disposition hint names this region's head (kabupaten Bupati, kota Wali Kota)
      if (slug === 'naskah-pintar') await expect(page.locator('.dk-guide-hint').filter({ hasText: 'Setujui sebagai Sekda' })).toContainText(region === 'bojonegoro' ? 'Setujui sebagai Bupati' : 'Setujui sebagai Wali Kota')

      // switch from the picker: no reload, world reset to the new region's seed at the morning clock
      const to = NEXT[region]
      await page.evaluate(() => {
        ;(window as G).__marker = 1
        ;(window as G).__gamada.clock.setTime(9 * 60)
      })
      await pickRegion(page, to)
      await page.waitForFunction((id) => (window as G).__gamada.world.get().regionId === id && (window as G).__gamada.world.status() === 'ready', to, { timeout: 45_000 })
      expect(await page.evaluate(() => (window as G).__marker)).toBe(1)
      const minutes = await page.evaluate(() => (window as G).__gamada.clock.get().minutes as number)
      expect(minutes).toBeGreaterThanOrEqual(CLOCK_START)
      expect(minutes).toBeLessThan(CLOCK_START + 30)
      await expect(page).toHaveURL(new RegExp(`[?&]region=${to}`))
      await expect(page.locator('.dk-topbar .dk-region-label')).toContainText(PACK[to].shortName)
      await expect(page.locator(ROOT[slug as Slug]).first()).toBeVisible({ timeout: 20_000 })
      expect(errors.filter(notNoise)).toEqual([])
    })
  }
}

const inBbox = (c: { lng: number; lat: number } | null, b: [number, number, number, number]) => !!c && c.lng >= b[0] && c.lng <= b[2] && c.lat >= b[1] && c.lat <= b[3]
const mapCenter = (page: Page) =>
  page.evaluate(() => {
    const m = (window as G).__dkMap?.raw?.()
    if (!m) return null
    const c = m.getCenter()
    return { lng: c.lng as number, lat: c.lat as number }
  })

test('Siaga Wilayah: the map centre lies in the pack bbox, and flies to the next region after a picker switch', async ({ page, errors }) => {
  await openDemo(page, 'siaga-wilayah', { extra: 'region=bandung&debug=fps' })
  await expect.poll(async () => inBbox(await mapCenter(page), PACK.bandung.bbox), { timeout: 20_000 }).toBe(true)
  await pickRegion(page, 'padang')
  await page.waitForFunction(() => (window as G).__gamada.world.get().regionId === 'padang', null, { timeout: 45_000 })
  await expect.poll(async () => inBbox(await mapCenter(page), PACK.padang.bbox), { timeout: 20_000 }).toBe(true)
  expect(errors.filter(notNoise)).toEqual([])
})

for (const region of ['bandung', 'padang'] as const) {
  test(`Sapa Warga ${region}: the sample voice note is a ${PACK[region].languages.regional[0]} template with its translation`, async ({ page, errors }) => {
    const pack = PACK[region]
    const lang = pack.languages.regional[0]
    const texts = pack.languages.samples.complaintTemplates.filter((c) => c.lang === lang).map((c) => c.text)
    expect(texts.length).toBeGreaterThanOrEqual(12)
    await openDemo(page, 'sapa-warga', { extra: `region=${region}` })
    await page.locator('[data-sw="quick-voice"]').click()
    const voice = page.locator('.dk-sw-text').filter({ hasText: new RegExp(texts.map((t) => t.slice(0, 24).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')) })
    await expect(voice.first()).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('.dk-sw-trans').first()).toBeVisible({ timeout: 20_000 })
    expect(errors.filter(notNoise)).toEqual([])
  })
}

// T8: the Cek Berkas specimens (KTP, KK, domisili, house photo) are documents of the active region, not Bojonegoro
test('Cek Berkas bandung: the specimen gallery is a Kota Bandung set (Jawa Barat, Bandung NIK codes, no Bojonegoro)', async ({ page, errors }) => {
  await openDemo(page, 'cek-berkas', { extra: 'region=bandung' })
  expect(await worldRegion(page)).toBe('bandung')
  const cb = page.locator('.dk-cb').first()
  await expect(cb).toContainText('PROVINSI JAWA BARAT', { timeout: 20_000 })
  await expect(cb).toContainText('KOTA BANDUNG')
  await expect(cb).toContainText('Bandung')
  // Kemendagri area code of Kota Bandung (32.73) on the KTP NIK
  await expect(cb).toContainText(/(?<!\d)3273\d{12}(?!\d)/)
  expect(await cb.textContent()).not.toMatch(/Bojonegoro|BOJONEGORO|Jawa Timur|JAWA TIMUR/)
  expect(errors.filter(notNoise)).toEqual([])
})
