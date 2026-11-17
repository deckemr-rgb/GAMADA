/**
 * P2 Meja Pimpinan (spec §11): every GuidePanel mission by script, plus the "Cek lulus" checks:
 * briefing ≥ 6 items, each linked to real world data · an instruction is visible in Naskah Pintar ≤ 1 s.
 * Phones: meeting mode is not offered below 768 px, so the phone guide lists and completes 4 of 4.
 */
import { test, expect } from '../fixtures'
import { PHONE, W, closeGuide, expectGuideComplete, missionsDone, notNoise, openDemo, spaGo } from './helpers'

test.describe.configure({ timeout: 150_000 })

test('Meja Pimpinan · all 5 missions + briefing refs + instruction reaches Naskah Pintar (1440, ID)', async ({ page, errors }) => {
  await openDemo(page, 'meja-pimpinan')

  // 1 · compose the morning briefing: ≥ 6 items from ≥ 6 products, every ref points at a world entity
  await page.locator('[data-hotspot="briefing"]').click()
  await expect(page.locator('.dk-mp-item').nth(5)).toBeVisible({ timeout: 10_000 })
  const brief = await W<{ n: number; sources: number; bad: string[] }>(
    page,
    `(() => { const b = s.briefings.byId[s.briefings.ids[0]]; const bad = []; for (const it of b.items) for (const r of it.refs) { const i = r.indexOf(':'); const t = r.slice(0, i), id = r.slice(i + 1); if (!s[t] || !s[t].byId[id]) bad.push(r) } return { n: b.items.length, sources: new Set(b.items.map((x) => x.source)).size, bad } })()`,
  )
  expect(brief.n).toBeGreaterThanOrEqual(6)
  expect(brief.sources).toBeGreaterThanOrEqual(6)
  expect(brief.bad).toEqual([])
  await expect.poll(() => missionsDone(page, 'meja-pimpinan')).toContain('briefing')

  // 2 · listen to one item (the reader highlights it; the mission ticks when the first item has been read)
  await page.locator('[data-mp="listen"]').click()
  await expect(page.locator('[data-mp="listen"]')).toHaveAttribute('aria-pressed', 'true')
  // after the intro the item being read is highlighted
  await expect(page.locator('.dk-mp-item.is-reading')).toBeVisible({ timeout: 45_000 })
  await expect.poll(() => missionsDone(page, 'meja-pimpinan'), { timeout: 60_000 }).toContain('listen')
  await page.locator('[data-mp="listen"]').click()

  // 3 · ask the data (a suggested question → an answer with a chart)
  await page.locator('.dk-mp-ask .dk-mp-qchip').first().click()
  await expect(page.locator('.dk-mp-qres').first()).toBeVisible({ timeout: 15_000 })
  await expect.poll(() => missionsDone(page, 'meja-pimpinan'), { timeout: 15_000 }).toContain('ask')

  // 4 · instruction → Naskah Pintar: disposition letter + one task per agency in the same settle (≤ 1 s)
  await page.evaluate(() => {
    const w = window as unknown as { __t: Record<string, number>; __gamada: { onEvent(t: string, fn: () => void): void } }
    w.__t = {}
    w.__gamada.onEvent('instruction.issued', () => (w.__t.issued = performance.now()))
    w.__gamada.onEvent('letter.dispositioned', () => (w.__t.letter = performance.now()))
  })
  await page.locator('[data-mp="instruct"]').click()
  await expect(page.locator('.dk-mp-idea').first()).toBeVisible({ timeout: 10_000 })
  await page.locator('[data-mp="send-instruction"]').click()
  await expect(page.locator('.dk-mp-sent')).toBeVisible({ timeout: 8_000 })
  const t = await page.evaluate(() => (window as unknown as { __t: Record<string, number> }).__t)
  expect(t.letter! - t.issued!).toBeLessThanOrEqual(1_000)
  const ins = await W<{ letter: string | null; tasks: number; opds: number }>(page, `(() => { const i = s.instructions.byId[s.instructions.ids[0]]; return { letter: i.letterId, tasks: i.actionItemIds.length, opds: i.opdIds.length } })()`)
  expect(ins.letter).toBeTruthy()
  expect(ins.tasks).toBe(ins.opds)
  const nToast = page.locator('.dk-toast').filter({ hasText: 'Naskah Pintar' })
  await expect(nToast).toHaveCount(1)
  await expect.poll(() => missionsDone(page, 'meja-pimpinan')).toContain('instruct')
  await page.getByRole('button', { name: /^Selesai$/ }).click()

  // 5 · meeting mode: full screen, Esc closes and focus returns to the button
  await page.locator('[data-mp="meeting"]').click()
  await expect(page.locator('.dk-mp-mm')).toBeVisible({ timeout: 10_000 })
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Escape')
  await expect(page.locator('.dk-mp-mm')).toHaveCount(0)
  await expect(page.locator('[data-mp="meeting"]')).toBeFocused()
  await expect.poll(() => missionsDone(page, 'meja-pimpinan')).toContain('meeting')
  await expectGuideComplete(page, 5)

  // the instruction is in Naskah Pintar: its toast opens Surat Masuk on the disposition memo
  if (await nToast.count()) await nToast.locator('.dk-toast-main').click()
  else await spaGo(page, `/demo/naskah-pintar?focus=${await W<string>(page, 's.instructions.ids[0]')}&off=preloader`)
  await expect(page).toHaveURL(/\/demo\/naskah-pintar/)
  await expect(page.locator('.dk-np').first()).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('tab', { name: /Surat Masuk/ })).toHaveAttribute('aria-selected', 'true', { timeout: 15_000 })
  await expect(page.locator('.dk-np').getByText(/nota dinas/i).first()).toBeVisible()
  expect(errors.filter(notNoise)).toEqual([])
})

test.describe('phone 390', () => {
  test.use(PHONE)
  test('Meja Pimpinan · phone guide offers 4 missions (no meeting mode) and completes them (EN)', async ({ page, errors }) => {
    await openDemo(page, 'meja-pimpinan', { lang: 'en' })
    await expect(page.locator('.dk-guide-step')).toHaveCount(4)
    await closeGuide(page)
    await expect(page.locator('[data-mp="meeting"]')).toHaveCount(0)
    await page.locator('[data-hotspot="briefing"]').click()
    await page.getByRole('tab', { name: /Briefing/ }).first().click().catch(() => undefined)
    await expect(page.locator('.dk-mp-item').nth(5)).toBeVisible({ timeout: 10_000 })
    await page.locator('[data-mp="listen"]').click()
    await expect.poll(() => missionsDone(page, 'meja-pimpinan'), { timeout: 60_000 }).toContain('listen')
    await page.locator('[data-mp="listen"]').click()
    await page.getByRole('tab', { name: /^Ask$/ }).click()
    await page.locator('.dk-mp-ask .dk-mp-qchip').first().click()
    await expect.poll(() => missionsDone(page, 'meja-pimpinan'), { timeout: 15_000 }).toContain('ask')
    await page.locator('[data-mp="instruct"]').first().click()
    await page.locator('[data-mp="send-instruction"]').click()
    await expect(page.locator('.dk-mp-sent')).toBeVisible({ timeout: 8_000 })
    await page.getByRole('button', { name: /^Done$/ }).click()
    await expectGuideComplete(page, 4)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    expect(errors.filter(notNoise)).toEqual([])
  })
})
