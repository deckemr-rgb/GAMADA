/**
 * P2 Meja Pimpinan (spec §11): every GuidePanel mission by script, plus the "Cek lulus" checks (the agency-head view
 * now labels its one-click switch "See the Regent's briefing"):
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
  // (the hidden Notulen panel stays mounted and mentions "nota dinas" too: look at what is on screen)
  await expect(page.locator('.dk-np').getByText(/nota dinas/i).filter({ visible: true }).first()).toBeVisible()
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

/* the other language at each size: every mission still completes, and on a phone the kit's top bar alone carries the
   clock chip and the guide pill (no in-canvas duplicates) */
for (const v of [{ lang: 'en' as const, phone: false }, { lang: 'id' as const, phone: true }]) {
  test.describe(`missions ${v.phone ? '390' : '1440'} ${v.lang.toUpperCase()}`, () => {
    if (v.phone) test.use(PHONE)
    test(`Meja Pimpinan · every mission completes (${v.phone ? '390' : '1440'}, ${v.lang.toUpperCase()})`, async ({ page, errors }) => {
      await openDemo(page, 'meja-pimpinan', v.lang === 'en' ? { lang: 'en' } : {})
      const n = v.phone ? 4 : 5
      await expect(page.locator('.dk-guide-step')).toHaveCount(n)
      if (v.phone) await closeGuide(page)
      if (v.phone) {
        await expect(page.locator('.dk-mp .dk-mp-clock')).toHaveCount(0)
        await expect(page.locator('[data-mp="guide"]')).toHaveCount(0)
      }
      await page.locator('[data-hotspot="briefing"]').click()
      await expect(page.locator('.dk-mp-item').nth(5)).toBeVisible({ timeout: 10_000 })
      await page.locator('[data-mp="listen"]').click()
      await expect.poll(() => missionsDone(page, 'meja-pimpinan'), { timeout: 60_000 }).toContain('listen')
      await page.locator('[data-mp="listen"]').click()
      if (v.phone) await page.getByRole('tab', { name: v.lang === 'en' ? /^Ask$/ : /^Tanya$/ }).click()
      await page.locator('.dk-mp-ask .dk-mp-qchip').first().click()
      await expect.poll(() => missionsDone(page, 'meja-pimpinan'), { timeout: 15_000 }).toContain('ask')
      await page.locator('[data-mp="instruct"]').first().click()
      await page.locator('[data-mp="send-instruction"]').click()
      await expect(page.locator('.dk-mp-sent')).toBeVisible({ timeout: 8_000 })
      await page.getByRole('button', { name: v.lang === 'en' ? /^Done$/ : /^Selesai$/ }).click()
      if (!v.phone) {
        await page.locator('[data-mp="meeting"]').click()
        await expect(page.locator('.dk-mp-mm')).toBeVisible({ timeout: 10_000 })
        await page.keyboard.press('Escape')
      }
      await expectGuideComplete(page, n)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      expect(errors.filter(notNoise)).toEqual([])
    })
  })
}

test('Meja Pimpinan · Kepala OPD composes the briefing as the leader; meeting KPIs carry captions + trends (1440, EN)', async ({ page, errors }) => {
  await openDemo(page, 'meja-pimpinan', { lang: 'en', role: 'kepala-opd' })
  await closeGuide(page)
  // agency view: tasks instead of the briefing, and one click to the leader's briefing
  await expect(page.locator('.dk-mp[data-role="kepala-opd"]')).toBeVisible()
  await page.getByRole('button', { name: /^See the .+'s briefing$/ }).click()
  await expect(page.locator('.dk-mp[data-role="kepala-daerah"]')).toBeVisible({ timeout: 5_000 })
  await expect(page.locator('.dk-mp-item').nth(5)).toBeVisible({ timeout: 10_000 })
  await expect.poll(() => missionsDone(page, 'meja-pimpinan')).toContain('briefing')
  // the start ring retires once a briefing exists (no hint left over the KPI labels)
  await expect(page.locator('.dk-hotspot')).toBeHidden()
  await page.locator('[data-mp="meeting"]').click()
  await expect(page.locator('.dk-mp-mm-kpis > li')).toHaveCount(6)
  await expect(page.locator('.dk-mp-mm-kpis > li > small')).toHaveCount(6)
  // every tile carries a trend (river level, service index) or bars (overdue follow-ups per agency)
  await expect(page.locator('.dk-mp-mm-kpis .dk-mp-mm-spark')).toHaveCount(5)
  await page.keyboard.press('Escape')
  await expect(page.locator('.dk-mp-mm')).toHaveCount(0)
  expect(errors.filter(notNoise)).toEqual([])
})

test('Meja Pimpinan · one river reading: briefing item 3 = "Tanya data" flood answer, with its status (1440, ID)', async ({ page, errors }) => {
  for (const t of ['07:00', '13:00', '17:00']) {
    await openDemo(page, 'meja-pimpinan', { extra: `t=${t}` })
    await closeGuide(page)
    await page.locator('.dk-mp-actions .dk-btn--primary').first().click()
    const item = page.locator('.dk-mp-item[data-source="siaga-wilayah"]').first()
    await expect(item).toBeVisible({ timeout: 10_000 })
    const brief = (await item.locator('.dk-mp-item-t').innerText()).match(/(\d+,\d) m/)?.[1]
    expect(brief).toBeTruthy()
    const input = page.locator('.dk-mp-askform input')
    await input.fill('Bagaimana status banjir?')
    await input.press('Enter')
    const a = page.locator('.dk-mp-a').last()
    await expect(a).toHaveAttribute('aria-busy', 'false', { timeout: 20_000 })
    await expect(a).toContainText(`${brief} m`)
    // past SIAGA with no warning out, the alerts tile says so instead of "no flood warning"
    const it3 = await item.innerText()
    if (/status (AWAS|SIAGA)/.test(it3) && /Belum ada peringatan/.test(it3)) await expect(page.locator('.dk-mp-kpis .dk-kpi').nth(2)).toContainText(/sungai (AWAS|SIAGA)/)
  }
  expect(errors.filter(notNoise)).toEqual([])
})
