/**
 * P6 Awas Belanja (spec §11): every GuidePanel mission by script, plus the "Cek lulus" checks:
 * every detector shows an explanation · the audit memo quotes exactly the HPS-vs-market table numbers.
 */
import { test, expect } from '../fixtures'
import { PHONE, W, closeGuide, expectGuideComplete, missionsDone, notNoise, openDemo } from './helpers'

test.describe.configure({ timeout: 150_000 })

test('Awas Belanja · all 3 missions + 7 explained detectors + memo numbers = table numbers (1440, ID)', async ({ page, errors }) => {
  await openDemo(page, 'awas-belanja')
  // before any flood alert the emergency package does not exist yet: honest empty state with a real link
  expect(await W<boolean>(page, `Object.values(s.procurements.byId).some((p) => p.key === 'pompa-darurat')`)).toBe(false)

  // the shortcut raises the flood scenario and opens the pump package
  await page.locator('[data-hotspot="ab-start"]').first().click()
  await expect(page.locator('.dk-ab-dtitle')).toContainText('Pompa', { timeout: 15_000 })

  // 1 · run the analysis: 7 detectors, each with an explanation → procurement.flagged
  await page.getByRole('button', { name: 'Jalankan analisis' }).first().click()
  await expect(page.locator('.dk-ab-top')).toBeVisible({ timeout: 20_000 })
  const notes = await page.locator('.dk-ab-det.is-done .dk-ab-det-c').allInnerTexts()
  expect(notes.length).toBe(7)
  expect(notes.every((n) => n.trim().length > 10)).toBe(true)
  await expect.poll(() => missionsDone(page, 'awas-belanja')).toContain('analyze-pump')

  // 2 · bidders graph: an affiliation edge shows its evidence
  await page.getByRole('tab', { name: 'Peserta' }).click()
  const edge = page.locator('.dk-viz-edgehit').first()
  await expect(edge).toBeAttached({ timeout: 15_000 })
  await edge.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.dk-ab-ev-pair')).toBeVisible()
  await expect.poll(() => missionsDone(page, 'awas-belanja')).toContain('find-affiliated')

  // 3 · HPS table → recommend a correction → memo; its numbers equal the table's
  await page.getByRole('tab', { name: 'HPS vs Pasar' }).click()
  const table = {
    hps: await page.locator('[data-ab="total-hps"]').innerText(),
    market: await page.locator('[data-ab="total-market"]').innerText(),
    gap: (await page.locator('[data-ab="total-gap"]').innerText()).split(' (')[0],
  }
  await page.getByRole('button', { name: 'Rekomendasikan koreksi' }).click()
  await expect(page.locator('.dk-ab-memo-ok')).toBeVisible({ timeout: 30_000 })
  const memo = {
    hps: await page.locator('[data-ab="memo-hps"]').innerText(),
    market: await page.locator('[data-ab="memo-market"]').innerText(),
    gap: await page.locator('[data-ab="memo-gap"]').innerText(),
  }
  expect(memo).toEqual(table)
  await expect.poll(() => missionsDone(page, 'awas-belanja')).toContain('audit-memo')
  // procurement.recommended (inviteLocal) ⇒ a Katalog Lokal need (chain 11)
  expect(await W<number>(page, `Object.values(s.catalogNeeds.byId).filter((n) => String(n.cause).startsWith('procurements:')).length`)).toBeGreaterThan(0)
  await expectGuideComplete(page, 3)
  expect(errors.filter(notNoise)).toEqual([])
})

test.describe('phone 390', () => {
  test.use(PHONE)
  test('Awas Belanja · list as cards, the pump package opens full screen and analyses (EN)', async ({ page, errors }) => {
    await openDemo(page, 'awas-belanja', { lang: 'en' })
    await closeGuide(page)
    await page.locator('[data-hotspot="ab-start"]').first().click()
    await expect(page.locator('.dk-ab-dtitle')).toContainText('Pump', { timeout: 15_000 })
    await page.getByRole('button', { name: 'Run analysis' }).first().click()
    await expect(page.locator('.dk-ab-top')).toBeVisible({ timeout: 20_000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    expect(errors.filter(notNoise)).toEqual([])
  })
})
