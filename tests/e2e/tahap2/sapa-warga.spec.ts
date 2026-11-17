/**
 * P1 Sapa Warga (spec §11): every GuidePanel mission by script, plus the "Cek lulus" checks:
 * sample voice note → ticket in the officer console ≤ 2 s · console status change → citizen phone ≤ 1 s ·
 * 5 similar flood reports → cluster toast + map point.
 */
import { test, expect } from '../fixtures'
import { PHONE, W, closeGuide, expectGuideComplete, missionsDone, notNoise, openDemo } from './helpers'

test.describe.configure({ timeout: 120_000 })

test('Sapa Warga · all 5 missions + pass checks (1440, ID)', async ({ page, errors }) => {
  await openDemo(page, 'sapa-warga')
  const phone = page.locator('.dk-sw-phone, .dk-sw').first()

  // 1 · NIB checklist (Raka)
  await page.locator('[data-sw="persona-raka"]').click()
  await page.locator('.dk-sw-quick button').first().click()
  await expect(page.locator('.dk-sw-card.is-check')).toBeVisible({ timeout: 15_000 })
  await expect.poll(() => missionsDone(page, 'sapa-warga')).toContain('nib')

  // 2 · voice note (Ibu Siti, Javanese sample) → ticket in the console ≤ 2 s after the complaint exists
  await page.locator('[data-sw="persona-siti"]').click()
  const before = await W<number>(page, 's.complaints.ids.length')
  await page.locator('[data-sw="quick-voice"]').click()
  await page.waitForFunction((n) => (window as unknown as { __gamada: { world: { get(): { complaints: { ids: string[] } } } } }).__gamada.world.get().complaints.ids.length > n, before, { timeout: 15_000 })
  const t0 = Date.now()
  const voice = await W<{ code: string; channel: string; ticketId: string }>(page, 's.complaints.byId[s.complaints.ids[0]]')
  expect(voice.channel).toBe('voice')
  await expect(page.locator('.dk-sw-console').getByText(voice.code).first()).toBeVisible({ timeout: 2_000 })
  expect(Date.now() - t0).toBeLessThanOrEqual(2_000)
  await expect.poll(() => missionsDone(page, 'sapa-warga')).toContain('voice')

  // 3 · flood photo + location → flood mission; 5 similar reports → one cluster toast + map point
  await page.locator('[data-sw="quick-photo"]').click()
  await page.locator('[data-sw="send"]').click()
  await expect.poll(() => missionsDone(page, 'sapa-warga'), { timeout: 15_000 }).toContain('flood')
  for (let i = 0; i < 4 && (await W<number>(page, 's.clusters.ids.length')) === 0; i++) {
    const n = page.locator('[data-sw="neighbour"]')
    if (await n.isVisible().catch(() => false)) await n.click()
    await page.waitForTimeout(600)
  }
  await expect.poll(() => W<number>(page, 's.clusters.ids.length'), { timeout: 10_000 }).toBeGreaterThan(0)
  const toast = page.locator('.dk-toast').filter({ hasText: /Klaster/ })
  await expect(toast).toHaveCount(1)
  await expect(toast).toContainText('Meja Pimpinan')
  await expect(page.locator('.dk-sw-minimap .dk-map').first()).toBeVisible({ timeout: 15_000 })

  // 4 · officer: open the voice ticket, verify, forward → the citizen phone shows the update ≤ 1 s
  await page.locator('.dk-sw-console .dk-seg button').first().click()
  await page.locator(`.dk-sw-console .dk-inbox-li[data-id="${voice.ticketId}"] button`).click()
  await expect(page.locator('.dk-sw-detail')).toBeVisible()
  await page.locator('[data-sw="verify"]').click()
  const phoneMsgs = () => phone.locator('[data-wmsg]').count()
  const n0 = await phoneMsgs()
  const tf = Date.now()
  await page.locator('[data-sw="forward"]').click()
  await expect.poll(phoneMsgs, { timeout: 1_000, intervals: [50, 100, 100, 100, 200, 200, 250] }).toBeGreaterThan(n0)
  expect(Date.now() - tf).toBeLessThanOrEqual(1_000)
  await expect.poll(() => missionsDone(page, 'sapa-warga')).toContain('forward')
  await page.locator('[data-sw="process"]').click()
  await page.locator('[data-sw="after-photo"]').click()
  await page.locator('[data-sw="finish"]').click()
  await page.keyboard.press('Escape')

  // 5 · the citizen rates the closed ticket
  const star = page.locator('[data-sw="rate-5"]').last()
  await star.scrollIntoViewIfNeeded()
  await star.click()
  await expect(page.locator('.dk-sw-rated').first()).toBeVisible()
  expect(await W<number | null>(page, `s.tickets.byId['${voice.ticketId}'].rating`)).toBe(5)

  await expect.poll(() => missionsDone(page, 'sapa-warga')).toEqual(expect.arrayContaining(['nib', 'voice', 'flood', 'forward', 'rate']))
  await expectGuideComplete(page, 5)
  expect(errors.filter(notNoise)).toEqual([])
})

test.describe('phone 390', () => {
  test.use(PHONE)
  test('Sapa Warga · voice report on the phone tab, then "Lihat" opens it in the officer console tab (EN)', async ({ page, errors }) => {
    await openDemo(page, 'sapa-warga', { lang: 'en' })
    await closeGuide(page)
    await page.locator('[data-sw="quick-voice"]').click()
    await expect.poll(() => W<number>(page, `Object.values(s.complaints.byId).filter((c) => c.channel === 'voice' && c.citizenId === s.meta.personas.siti).length`), { timeout: 15_000 }).toBeGreaterThan(0)
    const code = await W<string>(page, 's.complaints.byId[s.complaints.ids[0]].code')
    await page.locator('[data-sw="to-console"]').click()
    await expect(page.locator('.dk-sw-console').getByText(code).first()).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    expect(errors.filter(notNoise)).toEqual([])
  })
})
