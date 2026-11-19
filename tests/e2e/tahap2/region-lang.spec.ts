/**
 * Region + language + role per demo (spec §6, §15; Tahap 7 plan §6 item 8): every demo opens on each of the three
 * region packs (Bojonegoro, Bandung, Padang; the bar shows the region on the picker button), switches ID → EN → ID
 * from the bar without a reload or errors (the canvas text really changes), and, on Bojonegoro, honours `?role=` for
 * the alternative role in EN. 18 demos × 3 regions × ID/EN. The pack names + picker switch are in
 * tests/e2e/tahap7/regions.spec.ts.
 */
import { test, expect } from '../fixtures'
import { ROLES, ROOT, SLUGS, notNoise, openDemo, type Slug } from './helpers'

test.describe.configure({ timeout: 90_000 })

const REGIONS = [
  ['bojonegoro', 'Bojonegoro'],
  ['bandung', 'Bandung'],
  ['padang', 'Padang'],
] as const

for (const slug of SLUGS) {
  for (const [region, short] of REGIONS) {
    test(`region + language${region === 'bojonegoro' ? ' + role' : ''} · ${region} · ${slug}`, async ({ page, errors }) => {
      await openDemo(page, slug as Slug, { extra: `region=${region}` })
      const bar = page.locator('.dk-topbar')
      await expect(bar.locator('.dk-region-label')).toContainText(short)
      await expect(bar.getByRole('button', { name: 'Pilih wilayah' })).toBeVisible()
      await expect(page.locator('html')).toHaveAttribute('lang', 'id')
      expect(await page.evaluate(() => (window as unknown as { __gamada: { world: { get(): { regionId: string } } } }).__gamada.world.get().regionId)).toBe(region)
      const root = page.locator(ROOT[slug as Slug]).first()
      const idText = await root.innerText()

      await bar.getByRole('radio', { name: 'EN', exact: true }).click()
      await expect(page.locator('html')).toHaveAttribute('lang', 'en')
      await expect.poll(async () => (await root.innerText()) !== idText, { timeout: 10_000 }).toBe(true)
      await expect(page).toHaveURL(/[?&]lang=en/)
      await expect(bar.getByRole('button', { name: 'Choose region' })).toBeVisible()
      await expect(bar.locator('.dk-region-label')).toContainText(short)

      await bar.getByRole('radio', { name: 'ID', exact: true }).click()
      await expect(page.locator('html')).toHaveAttribute('lang', 'id')

      if (region === 'bojonegoro') {
        // the alternative role from a shared link
        const [, alt] = ROLES[slug as Slug]
        await openDemo(page, slug as Slug, { role: alt, lang: 'en' })
        await expect.poll(() => new URL(page.url()).searchParams.get('role')).toBe(alt)
        await expect(page.locator(ROOT[slug as Slug]).first()).toBeVisible()
      }
      expect(errors.filter(notNoise)).toEqual([])
    })
  }
}
