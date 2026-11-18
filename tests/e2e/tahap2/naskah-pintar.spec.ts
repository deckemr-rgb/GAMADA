/**
 * P3 Naskah Pintar (spec §11): every GuidePanel mission by script, plus the "Cek lulus" checks:
 * the sample meeting yields ≥ 5 action items with a person in charge and a due date · a Meja Pimpinan instruction
 * appears here as a disposition (banner → memo in Surat Masuk, tasks on the board).
 */
import { test, expect } from '../fixtures'
import { PHONE, W, closeGuide, emit, expectGuideComplete, missionsDone, notNoise, openDemo } from './helpers'

test.describe.configure({ timeout: 150_000 })

test('Naskah Pintar · all 4 missions + meeting action items + instruction as disposition (1440, ID)', async ({ page, errors }) => {
  await page.addInitScript(() => {
    ;(window as unknown as { __printed: number }).__printed = 0
    window.print = () => {
      ;(window as unknown as { __printed: number }).__printed++
    }
  })
  await openDemo(page, 'naskah-pintar')

  // the flood meeting was held 06.30–07.00 (before the clock start): recording ready, no "play early" wording
  const head = page.locator('.dk-np-mhead')
  await expect(head).toContainText('06.30–07.00')
  await expect(head).toContainText('Rekaman siap')
  await expect(head).not.toContainText(/dijadwalkan|lebih awal/)

  // 1 · play the sample meeting (skip to the end) → meeting.transcribed + ≥ 5 action items with PIC + due date
  const items0 = await W<number>(page, 's.actionItems.ids.length')
  await page.locator('[data-np="play"]').click()
  await page.locator('[data-np="skip"]').click()
  await expect.poll(() => missionsDone(page, 'naskah-pintar'), { timeout: 20_000 }).toContain('putar-rapat')
  const fresh = await W<{ pic: string; dueAt: number | null; kind: string }[]>(
    page,
    `s.actionItems.ids.slice(0, s.actionItems.ids.length - ${items0}).map((id) => s.actionItems.byId[id]).map((a) => ({ pic: a.pic, dueAt: a.dueAt, kind: a.source.kind }))`,
  )
  const fromMeeting = fresh.filter((a) => a.kind === 'meeting')
  expect(fromMeeting.length).toBeGreaterThanOrEqual(5)
  expect(fromMeeting.every((a) => a.pic.trim().length > 0 && typeof a.dueAt === 'number')).toBe(true)

  // 2 · official minutes → print (window.print stubbed)
  await page.locator('[data-np="official"]').click()
  await expect(page.locator('.dk-np-off')).toContainText('06.30')
  await page.locator('[data-np="print"]').click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __printed: number }).__printed)).toBe(1)
  await expect.poll(() => missionsDone(page, 'naskah-pintar')).toContain('ekspor-notulen')
  await page.keyboard.press('Escape')

  // 3 · disposition of one incoming letter (AI draft → approve)
  await page.getByRole('tab', { name: /Surat Masuk/ }).click()
  await page.locator('[data-np="read-side"]').click()
  await page.locator('[data-np="approve"]').click({ timeout: 20_000 })
  // maker ≠ checker: the Sekretariat submits, the Regional Secretary approves (simulated)
  await page.locator('[data-np="sekda-approve"]').click({ timeout: 10_000 })
  await expect.poll(() => missionsDone(page, 'naskah-pintar'), { timeout: 10_000 }).toContain('disposisi-surat')

  // 4 · reminder for an overdue follow-up
  await page.getByRole('tab', { name: /Tindak Lanjut/ }).click()
  await page.locator('[data-np="remind"]').first().click()
  await page.locator('[data-np="send-reminder"]').click({ timeout: 15_000 })
  await expect.poll(() => missionsDone(page, 'naskah-pintar'), { timeout: 10_000 }).toContain('kirim-pengingat')
  await page.keyboard.press('Escape')
  await expect(page.locator('.dk-ov')).toHaveCount(0)
  await expectGuideComplete(page, 4)

  // an instruction from Meja Pimpinan arrives: banner → its memo (nota dinas) in Surat Masuk
  const opds = await W<string[]>(page, 's.region.opd.slice(0, 2).map((o) => o.id)')
  await emit(page, 'instruction.issued', { text: { id: 'Percepat penyaluran bantuan ke kecamatan terdampak banjir', en: 'Speed up aid to the flood-hit districts' }, opdIds: opds, refs: [] }, 'meja-pimpinan')
  const banner = page.locator('.dk-np-banner')
  await expect(banner).toBeVisible()
  const ins = await W<{ letter: string; tasks: number }>(page, `(() => { const i = s.instructions.byId[s.instructions.ids[0]]; return { letter: s.letters.byId[i.letterId].kind, tasks: i.actionItemIds.length } })()`)
  expect(ins).toEqual({ letter: 'nota-dinas', tasks: 2 })
  await banner.getByRole('button', { name: 'Lihat nota dinas' }).click()
  await expect(page.getByRole('tab', { name: /Surat Masuk/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.dk-np').getByText('Percepat penyaluran bantuan').first()).toBeVisible()
  expect(errors.filter(notNoise)).toEqual([])
})

test.describe('phone 390', () => {
  test.use(PHONE)
  test('Naskah Pintar · the three tabs fit, the meeting plays and writes its follow-ups (EN)', async ({ page, errors }) => {
    await openDemo(page, 'naskah-pintar', { lang: 'en' })
    await closeGuide(page)
    const tabs = page.getByRole('tab')
    await expect(tabs).toHaveCount(3)
    for (const tb of await tabs.all()) expect((await tb.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await page.locator('[data-np="play"]').click()
    await page.locator('[data-np="skip"]').click()
    await expect.poll(() => missionsDone(page, 'naskah-pintar'), { timeout: 20_000 }).toContain('putar-rapat')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    expect(errors.filter(notNoise)).toEqual([])
  })
})
