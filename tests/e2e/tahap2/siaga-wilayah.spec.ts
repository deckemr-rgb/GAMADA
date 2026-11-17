/**
 * P5 Siaga Wilayah (spec §11): every GuidePanel mission by script (the guided CTA under the map walks the flow:
 * forecast → warning → agriculture → environment), plus the "Cek lulus" check: a warning produces a message on
 * the Sapa Warga phone of a citizen in the zone (Ibu Siti).
 */
import { test, expect } from '../fixtures'
import { PHONE, W, closeGuide, expectGuideComplete, missionsDone, notNoise, openDemo, spaGo } from './helpers'

test.describe.configure({ timeout: 150_000 })

test('Siaga Wilayah · all 5 missions + the warning lands on Ibu Siti’s phone (1440, ID)', async ({ page, errors }) => {
  await openDemo(page, 'siaga-wilayah')
  const cta = page.locator('[data-sw="cta"]')

  // 1 · run the forecast to +6 h (rain + flood model on the map)
  await cta.click()
  await expect.poll(() => missionsDone(page, 'siaga-wilayah'), { timeout: 30_000 }).toContain('scrub6')

  // 2 · send the early warning to the zone
  await expect(cta).toBeEnabled()
  await cta.click()
  await page.locator('[data-sw="bc-send"]').click({ timeout: 15_000 })
  await page.locator('[data-sw="bc-done"]').click({ timeout: 15_000 })
  await expect.poll(() => missionsDone(page, 'siaga-wilayah')).toContain('broadcast')
  const siti = await W<{ n: number }>(page, `({ n: Object.values(s.messages.byId).filter((m) => m.kind === 'peringatan' && m.to.includes(s.meta.personas.siti)).length })`)
  expect(siti.n).toBeGreaterThan(0)
  // the flood alert reached the other products too (pump package, bansos quota, Radar Isu topic)
  expect(await W<boolean>(page, `Object.values(s.procurements.byId).some((p) => p.key === 'pompa-darurat')`)).toBe(true)
  expect(await W<boolean>(page, `Object.values(s.programs.byId).some((p) => p.open)`)).toBe(true)

  // 3 · agriculture tab → post-flood scenario (harvest.updated)
  await cta.click()
  await page.waitForTimeout(800)
  await cta.click()
  await expect.poll(() => missionsDone(page, 'siaga-wilayah'), { timeout: 15_000 }).toContain('harvest')

  // 4 · satellite imagery (Layers → switch)
  await page.locator('[data-sw="layers"]').click()
  await page.getByRole('switch', { name: /Citra satelit/ }).click()
  await page.keyboard.press('Escape')
  await expect.poll(() => missionsDone(page, 'siaga-wilayah')).toContain('imagery')

  // 5 · environment tab: the before/after comparator
  await page.getByRole('tab', { name: /Lingkungan/ }).click()
  await page.locator('[data-sw="compare"]').fill('30')
  await expect.poll(() => missionsDone(page, 'siaga-wilayah')).toContain('compare')
  await expectGuideComplete(page, 5)

  // the warning on Ibu Siti's phone in Sapa Warga
  await spaGo(page, '/demo/sapa-warga?off=preloader&e2e=1')
  await expect(page.locator('.dk-sw').first()).toBeVisible({ timeout: 20_000 })
  await page.locator('[data-sw="persona-siti"]').click()
  await expect(page.locator('.dk-sw-row').filter({ hasText: /PERINGATAN DINI BANJIR/ }).first()).toBeVisible({ timeout: 10_000 })
  expect(errors.filter(notNoise)).toEqual([])
})

test.describe('phone 390', () => {
  test.use(PHONE)
  test('Siaga Wilayah · the forecast runs on a phone, map and scrubber stay reachable (EN)', async ({ page, errors }) => {
    await openDemo(page, 'siaga-wilayah', { lang: 'en' })
    await closeGuide(page)
    const cta = page.locator('[data-sw="cta"]')
    await cta.scrollIntoViewIfNeeded()
    await cta.click()
    await expect.poll(() => missionsDone(page, 'siaga-wilayah'), { timeout: 30_000 }).toContain('scrub6')
    await expect(page.locator('.dk-sg-map, .dk-map').first()).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    expect(errors.filter(notNoise)).toEqual([])
  })
})
