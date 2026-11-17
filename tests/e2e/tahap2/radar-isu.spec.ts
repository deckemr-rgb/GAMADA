/**
 * P4 Radar Isu (spec §11): every GuidePanel mission by script, plus the "Cek lulus" checks:
 * the hoax raises ONE toast to Meja Pimpinan · the clarification moves the sentiment line · XLSX + JSON downloads
 * with valid content. `?tab=analisis` (the /tools/scrappulse redirect) opens Analisis Mendalam.
 */
import { readFileSync } from 'node:fs'
import { test, expect } from '../fixtures'
import { PHONE, W, closeGuide, expectGuideComplete, missionsDone, notNoise, openDemo } from './helpers'

test.describe.configure({ timeout: 150_000 })

test('Radar Isu · all 4 missions + hoax toast + sentiment recovery + valid exports (1440, ID)', async ({ page, errors }) => {
  await openDemo(page, 'radar-isu')

  // 1 · the biggest topic cluster
  await page.locator('.dk-ri-topicrow button').first().click()
  await expect(page.locator('.dk-drawer')).toBeVisible()
  await expect.poll(() => missionsDone(page, 'radar-isu')).toContain('topik')
  await page.keyboard.press('Escape')

  // 2 · trigger the dam hoax: ONE hoax.detected → ONE toast to Meja Pimpinan
  await page.locator('.dk-ri-hoax-cta').click()
  await expect(page.locator('.dk-ri-hoax.is-active')).toBeVisible({ timeout: 15_000 })
  expect(await W<number>(page, 's.hoaxAlerts.ids.length')).toBe(1)
  await expect(page.locator('.dk-toast').filter({ hasText: 'Meja Pimpinan' })).toHaveCount(1)

  // clarification → publish → recovery mentions; "see 30 minutes ahead" moves the clock so the line recovers now
  await page.locator('.dk-ri-hoax-act .dk-btn--primary').click()
  const publish = page.locator('[data-testid="ri-publish"]')
  await expect(publish).toBeEnabled({ timeout: 20_000 })
  await publish.click()
  await expect(page.locator('.dk-ri-hoax.is-done')).toBeVisible()
  await expect.poll(() => missionsDone(page, 'radar-isu')).toContain('hoaks')
  const kpi0 = await page.locator('.dk-kpi.is-hero .dk-kpi-val').innerText()
  await page.locator('.dk-ri-hoax.is-done .dk-ri-hoax-act .dk-btn').first().click()
  await expect.poll(() => page.locator('.dk-kpi.is-hero .dk-kpi-val').innerText(), { timeout: 10_000 }).not.toBe(kpi0)

  // 3 · Analisis Mendalam (2 preset keywords) + exports (XLSX zip with a workbook, JSON with the mentions)
  await page.getByRole('tab', { name: 'Analisis Mendalam' }).click()
  await page.locator('[data-testid="ri-deep-run"]').click()
  await expect(page.locator('.dk-ri-deep-res')).toBeVisible({ timeout: 15_000 })
  await expect.poll(() => missionsDone(page, 'radar-isu')).toContain('analisis')
  const [xl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-testid="ri-xlsx"]').click()])
  const xbuf = readFileSync((await xl.path())!)
  expect(xl.suggestedFilename()).toMatch(/\.xlsx$/)
  expect(xbuf.subarray(0, 2).toString('latin1')).toBe('PK')
  expect(xbuf.toString('latin1')).toContain('xl/workbook.xml')
  const [js] = await Promise.all([page.waitForEvent('download'), page.locator('[data-testid="ri-json"]').click()])
  const json = JSON.parse(readFileSync((await js.path())!, 'utf8')) as { mentions: unknown[]; hoaxes: unknown[] }
  expect(json.mentions.length).toBeGreaterThan(0)
  expect(json.hoaxes.length).toBe(1)
  await expect.poll(() => missionsDone(page, 'radar-isu')).toContain('ekspor')

  // 4 · Laporan (paper) + its JSON
  await page.getByRole('tab', { name: 'Laporan' }).click()
  await expect(page.locator('.dk-ri-paper')).toBeVisible({ timeout: 15_000 })
  await expectGuideComplete(page, 4)
  expect(errors.filter(notNoise)).toEqual([])
})

test('Radar Isu · ?tab=analisis opens Analisis Mendalam (the /tools/scrappulse redirect)', async ({ page, errors }) => {
  await openDemo(page, 'radar-isu', { extra: 'tab=analisis' })
  await expect(page.getByRole('tab', { name: 'Analisis Mendalam' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('[data-testid="ri-deep-run"]')).toBeVisible()
  expect(errors.filter(notNoise)).toEqual([])
})

test.describe('phone 390', () => {
  test.use(PHONE)
  test('Radar Isu · stream first, the hoax card works on a phone (EN)', async ({ page, errors }) => {
    await openDemo(page, 'radar-isu', { lang: 'en' })
    await closeGuide(page)
    await page.locator('.dk-ri-hoax-cta').click()
    await expect(page.locator('.dk-ri-hoax.is-active')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('.dk-toast').filter({ hasText: 'Meja Pimpinan' })).toHaveCount(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    expect(errors.filter(notNoise)).toEqual([])
  })
})
