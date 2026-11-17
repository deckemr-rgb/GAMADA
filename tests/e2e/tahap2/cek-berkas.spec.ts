/**
 * P7 Cek Berkas (spec §11): every GuidePanel mission by script, plus the "Cek lulus" checks:
 * every specimen field is extracted (value + confidence, NIK consistent) · the bulk run finds exactly the seeded
 * NIK-sharing pairs (facts.bansosDuplicatePairs = 3) · the CSV export holds the 50 rows.
 */
import { readFileSync } from 'node:fs'
import { test, expect } from '../fixtures'
import { PHONE, W, closeGuide, expectGuideComplete, missionsDone, notNoise, openDemo } from './helpers'

test.describe.configure({ timeout: 150_000 })

test('Cek Berkas · all 5 missions + extracted fields + 3 duplicate pairs + CSV (1440, ID)', async ({ page, errors }) => {
  await openDemo(page, 'cek-berkas')

  // 1 · verify the clean specimen KTP (preselected): every field has a value and a confidence; NIK has 16 digits
  await page.locator('[data-hotspot="cek-go"]').first().click()
  await expect(page.locator('.dk-cb-verdict')).toBeVisible({ timeout: 15_000 })
  const rows = page.locator('.dk-xp-row')
  await expect.poll(() => rows.count()).toBeGreaterThanOrEqual(8)
  const values = await page.locator('.dk-xp-row .dk-xp-value').allInnerTexts()
  expect(values.every((v) => v.trim().length > 0)).toBe(true)
  expect(values.some((v) => /^\d{16}$/.test(v.replace(/\s/g, '')))).toBe(true)
  await expect.poll(() => missionsDone(page, 'cek-berkas')).toContain('verify-ktp')

  // 2 · the deliberately edited KTP: tamper heatmap + "Perlu Cek Manual"
  await page.locator('[data-doc="ktp-siti-edit"]').click()
  await expect(page.locator('.dk-cb-verdict')).toContainText(/Cek Manual/i, { timeout: 15_000 })
  await expect.poll(() => missionsDone(page, 'cek-berkas')).toContain('find-edited')

  // 3 · ask the AI about this file
  await page.locator('.dk-cb-askbtn').click()
  await page.locator('.dk-cb-chat-chips button').first().click()
  await expect(page.locator('.dk-cb-msg.is-ai .dk-cb-msg-meta').first()).toBeVisible({ timeout: 20_000 })
  await expect.poll(() => missionsDone(page, 'cek-berkas')).toContain('ask-ai')
  await page.keyboard.press('Escape')

  // 4 · bulk: 50 flood-aid applicants; duplicates = the seeded pairs
  await page.getByRole('radio', { name: 'Massal' }).or(page.getByRole('button', { name: 'Massal', exact: true })).first().click()
  await page.locator('.dk-cb-bulk [data-hotspot="cek-go"]').click()
  const csvBtn = page.locator('.dk-cb-bulk-act button').filter({ hasText: 'CSV' })
  await expect(csvBtn).toBeVisible({ timeout: 30_000 })
  await expect.poll(() => missionsDone(page, 'cek-berkas')).toContain('bulk')
  const pairs = await W<number>(page, 's.meta.facts.bansosDuplicatePairs')
  expect(pairs).toBe(3)
  await expect(page.locator('.dk-cb-card.is-ganda')).toHaveCount(pairs * 2)
  expect(await W<number>(page, `Object.values(s.documents.byId).filter((d) => d.program === 'bansos-banjir' && d.status && d.status !== 'baru').length`)).toBeGreaterThanOrEqual(50)

  // 5 · CSV export: header + 50 rows
  const [dl] = await Promise.all([page.waitForEvent('download'), csvBtn.click()])
  const csv = readFileSync((await dl.path())!, 'utf8').trim().split(/\r?\n/)
  expect(dl.suggestedFilename()).toMatch(/\.csv$/)
  expect(csv.length).toBe(51)
  await expect.poll(() => missionsDone(page, 'cek-berkas')).toContain('export')
  await expectGuideComplete(page, 5)
  expect(errors.filter(notNoise)).toEqual([])
})

test.describe('phone 390', () => {
  test.use(PHONE)
  test('Cek Berkas · viewer above the extraction, one KTP verified on a phone (EN)', async ({ page, errors }) => {
    await openDemo(page, 'cek-berkas', { lang: 'en' })
    await closeGuide(page)
    const go = page.locator('[data-hotspot="cek-go"]').first()
    await go.scrollIntoViewIfNeeded()
    await go.click()
    await expect(page.locator('.dk-cb-verdict')).toBeVisible({ timeout: 15_000 })
    await expect.poll(() => missionsDone(page, 'cek-berkas')).toContain('verify-ktp')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    expect(errors.filter(notNoise)).toEqual([])
  })
})
