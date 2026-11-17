/**
 * Region + language + role per Satu Daerah demo (spec §6, §15): the demo opens on the region pack (Bojonegoro, the
 * only pack so far: the bar shows it as a label, not a dead dropdown), switches ID → EN → ID from the bar without a
 * reload or errors (the canvas text really changes), and honours `?role=` for the alternative role.
 */
import { test, expect } from '../fixtures'
import { ROLES, ROOT, SLUGS, notNoise, openDemo, type Slug } from './helpers'

test.describe.configure({ timeout: 90_000 })

for (const slug of SLUGS) {
  test(`region + language + role · ${slug}`, async ({ page, errors }) => {
    await openDemo(page, slug as Slug, { extra: 'region=bojonegoro' })
    const bar = page.locator('.dk-topbar')
    await expect(bar.locator('.dk-region')).toContainText('Bojonegoro')
    await expect(page.locator('html')).toHaveAttribute('lang', 'id')
    const root = page.locator(ROOT[slug as Slug]).first()
    const idText = await root.innerText()

    await bar.getByRole('radio', { name: 'EN', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect.poll(async () => (await root.innerText()) !== idText, { timeout: 10_000 }).toBe(true)
    await expect(page).toHaveURL(/[?&]lang=en/)

    await bar.getByRole('radio', { name: 'ID', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'id')

    // the alternative role from a shared link
    const [, alt] = ROLES[slug as Slug]
    await openDemo(page, slug as Slug, { role: alt, lang: 'en' })
    await expect.poll(() => new URL(page.url()).searchParams.get('role')).toBe(alt)
    await expect(page.locator(ROOT[slug as Slug]).first()).toBeVisible()
    expect(errors.filter(notNoise)).toEqual([])
  })
}
