/**
 * Tahap 5 — the tour /tur (plan docs/build/tahap5-plan.md §5). Autoplay at 1440 and 390, cold chapters, numbers
 * across screens, Ambil alih ⇄ Kembali ke tur, the visitor's world untouched, determinism, controls + keyboard, phone
 * sheet, reduced motion, poster mode, language and the node checks (durations, narration length, hooks, no region name).
 * The engine is exposed on ?e2e=1 as window.__gamadaTour (state, doneLog, fallbackLog, listeners(), audit(), summary()).
 * axe (test 13) is not run: axe-core is not a dependency (no new npm deps in Tahap 5).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { expect, test } from '../fixtures'
import { CHAPTERS, totalSeconds } from '../../../src/demo-kit/tour/chapters'
import NID from '../../../src/demo-kit/tour/narration.id'
import NEN from '../../../src/demo-kit/tour/narration.en'

/* eslint-disable @typescript-eslint/no-explicit-any */
type G = any
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } as const
const T = <R>(page: Page, body: string): Promise<R> => page.evaluate(`(async () => { const g = window.__gamadaTour; ${body} })()`) as Promise<R>
const state = (page: Page) => T<{ n: number; phase: string; playing: boolean; rate: number; presenter: boolean; black: boolean; drawer: boolean; interrupted: boolean; poster: boolean }>(page, 'return g ? JSON.parse(JSON.stringify(g.state, (k, v) => (k === "fills" || k === "seen" || k === "stage" ? undefined : v))) : null')
const done = (page: Page, n: number) => T<boolean | null>(page, `return g ? (g.doneLog[${n}] ?? null) : null`)
const noHScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)

async function waitTour(page: Page): Promise<void> {
  await page.waitForFunction(() => !!(window as G).__gamadaTour, null, { timeout: 30_000 })
}
async function startTour(page: Page, q = ''): Promise<void> {
  await page.goto(`/tur?e2e=1&rate=8${q}`)
  await waitTour(page)
  await page.locator('[data-tour-ctl="start"]').click()
}
async function playCold(page: Page, n: number, q = ''): Promise<void> {
  await page.goto(`/tur/${n}?e2e=1&rate=8${q}`)
  await expect(page.locator('[data-tour-ctl="play-chapter"]')).toBeVisible({ timeout: 5_000 })
  await waitTour(page)
  await page.locator('[data-tour-ctl="play-chapter"]').click()
}
async function untilDone(page: Page, n: number, timeout = 90_000): Promise<void> {
  await page.waitForFunction((k) => (window as G).__gamadaTour?.doneLog[k] !== undefined, n, { timeout, polling: 250 })
}
async function untilSummary(page: Page, timeout = 280_000): Promise<void> {
  await page.waitForFunction(() => (window as G).__gamadaTour?.state.phase === 'summary', null, { timeout, polling: 500 })
}
/** audit rows as a multiset of "type|entity ids" (minute and generated verification ids dropped: same-minute order and
 * real-time ±1 minute of product reactions are not part of the story) */
const normFp = (text: string) =>
  text
    .split('\n')
    .map((l) => l.split('|').slice(1).join('|').replace(/verifications:VF-E\d+/g, 'verifications:*'))
    .sort()
    .join('\n')

/* ------------------------------------------------------------------ 1 autoplay */

test.describe('tour · autoplay', () => {
  test.describe.configure({ timeout: 320_000 })

  test('1440: 20 chapters, every done true, 0 fallbacks, placeholders filled, summary = tourSummary', async ({ page, errors }) => {
    await startTour(page)
    const leaks: string[] = []
    let last = 0
    for (;;) {
      const s = await state(page)
      if (s?.phase === 'summary') break
      if (s && s.n !== last && s.phase === 'player') {
        last = s.n
        await page.waitForTimeout(400)
        const txt = await page.locator('.dk-tour-col').innerText().catch(() => '')
        if (/\{\w+\}/.test(txt)) leaks.push(`ch ${s.n}: ${txt.match(/\{\w+\}/)![0]}`)
      }
      await page.waitForTimeout(300)
    }
    expect(leaks).toEqual([])
    const r = await T<{ done: Record<string, boolean>; fb: string[] }>(page, 'return { done: { ...g.doneLog }, fb: g.fallbackLog.slice() }')
    for (let n = 1; n <= 20; n++) expect(r.done[n], `chapter ${n} done`).toBe(true)
    expect(r.fb).toEqual([])
    // summary numbers on screen = tourSummary recomputed in the page (test 3)
    const sum = await T<Record<string, number>>(page, 'return await g.summary()')
    await expect(page.locator('[data-tour="summary-numbers"] [data-sum]')).toHaveCount(6)
    const shown = await page.locator('[data-tour="summary-numbers"] .dk-tour-num-v').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-value'))))
    expect(shown).toEqual([sum.complaintsHandled, sum.warningsSent, sum.hoaxesCountered, sum.savingsRp, sum.umkmOrders, sum.pricesStabilised])
    for (const v of shown) expect(v).toBeGreaterThan(0)
    await expect(page.getByText('17 dari 17 produk sudah tampil')).toBeVisible()
    // PDF paper = summary (print stubbed)
    await page.evaluate(() => {
      ;(window as G).__printed = 0
      window.print = () => {
        ;(window as G).__printed++
      }
    })
    await page.waitForTimeout(1500) // count-ups land
    const cardText = await page.locator('[data-tour="summary-numbers"] .dk-tour-num-v').allInnerTexts()
    await page.locator('[data-tour-ctl="pdf"]').click()
    await expect(page.locator('[data-tour="paper"]')).toBeAttached()
    const paperText = await page.locator('[data-tour="paper"] [data-sum] b').allInnerTexts()
    expect(paperText).toEqual(cardText)
    await expect.poll(() => page.evaluate(() => (window as G).__printed)).toBeGreaterThan(0)
    // WhatsApp prefill carries the region
    const wa = await page.locator('[data-tour-ctl="wa"]').getAttribute('href')
    expect(decodeURIComponent(wa ?? '')).toContain('Bojonegoro')
    expect(await noHScroll(page)).toBe(true)
    expect(errors).toEqual([])
  })

  test('390: 20 chapters, no horizontal scroll, summary reached', async ({ browser }) => {
    const ctx = await browser.newContext(PHONE)
    const page = await ctx.newPage()
    const errors: string[] = []
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    page.on('pageerror', (e) => errors.push(e.message))
    await page.route('**/api/ai/health', (r) => r.fulfill({ json: { ok: true, live: false, mock: false, reason: 'no_api_key' } }))
    await startTour(page)
    let wide = 0
    for (;;) {
      const s = await state(page)
      if (s?.phase === 'summary') break
      if (!(await noHScroll(page))) wide++
      await page.waitForTimeout(700)
    }
    expect(wide).toBe(0)
    const r = await T<{ done: Record<string, boolean>; fb: string[] }>(page, 'return { done: { ...g.doneLog }, fb: g.fallbackLog.slice() }')
    for (let n = 1; n <= 20; n++) expect(r.done[n], `chapter ${n} done`).toBe(true)
    expect(r.fb).toEqual([])
    expect(await noHScroll(page)).toBe(true)
    expect(errors).toEqual([])
    await ctx.close()
  })
})

/* ------------------------------------------------------------------ 2 + 3 cold chapters, numbers */

test.describe('tour · cold chapters', () => {
  test.describe.configure({ timeout: 420_000 })
  for (const [a, b] of [[1, 7], [8, 13], [14, 19]] as const) {
    test(`/tur/N for N = ${a}…${b}: poster, Putar bab N, done true`, async ({ page, errors }) => {
      for (let n = a; n <= b; n++) {
        await playCold(page, n)
        await untilDone(page, n)
        expect(await done(page, n), `chapter ${n}`).toBe(true)
        if (n === 10) {
          // caption % = tender.matches[shop] (the same selector TenderPilot shows)
          const p = await page.evaluate(() => {
            const s = (window as G).__gamada.world.get()
            const t = Object.values(s.tenders.byId).find((x: G) => x.key === 'karung-terpal-darurat') as G
            return Math.round((t.matches[s.meta.shopId] ?? 0) * 100)
          })
          await expect(page.locator('.dk-tour-col')).toContainText(`${p}%`)
        }
        if (n === 16) {
          await expect(page.locator('.dk-tour-col')).toContainText('50 berkas')
          await expect(page.locator('.dk-tour-col')).toContainText('3 pasang NIK ganda')
        }
      }
      expect(await T<string[]>(page, 'return g.fallbackLog.slice()')).toEqual([])
      expect(errors).toEqual([])
    })
  }

  test('/tur/20 cold: summary with 6 numbers > 0', async ({ page, errors }) => {
    test.setTimeout(240_000)
    await playCold(page, 20)
    await untilSummary(page)
    await expect(page.locator('[data-tour="summary-numbers"] [data-sum]')).toHaveCount(6)
    const vals = await page.locator('[data-tour="summary-numbers"] .dk-tour-num-v').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-value'))))
    for (const v of vals) expect(v).toBeGreaterThan(0)
    expect(errors).toEqual([])
  })
})

/* ------------------------------------------------------------------ 4 Ambil alih, 5 isolation */

test.describe('tour · Ambil alih and the visitor world', () => {
  test.describe.configure({ timeout: 240_000 })

  for (const [n, slug] of [[4, 'sapa-warga'], [11, 'toko-autopilot']] as const) {
    test(`chapter ${n}: Ambil alih → /demo/${slug}?world=tour&from=tur-${n} → Kembali ke tur resumes ${n}`, async ({ page, errors }) => {
      await playCold(page, n)
      // pause while chapter n shows its entity on the stage (at rate 8 the chapter hold is short)
      await page.waitForFunction((k) => { const s = (window as G).__gamadaTour?.state; return s && s.n === k && !s.busy && s.stage?.focus }, n, { timeout: 60_000, polling: 100 })
      await page.evaluate(() => (window as G).__gamadaTour.engine.pause())
      const take = page.locator('[data-tour="takeover"]').first()
      await expect(take).toBeEnabled()
      await take.click()
      await page.waitForURL(new RegExp(`/demo/${slug}\\?`))
      const u = new URL(page.url())
      expect(u.searchParams.get('world')).toBe('tour')
      expect(u.searchParams.get('from')).toBe(`tur-${n}`)
      expect(u.searchParams.get('focus')).toBeTruthy()
      await page.waitForFunction(() => (window as G).__gamada?.world.status() === 'ready', null, { timeout: 60_000 }).catch(() => undefined)
      const back = page.locator('[data-tour="back-to-tour"]')
      await expect(back).toBeVisible({ timeout: 20_000 })
      // the focus arrival may open the entity in a modal drawer (its scrim covers the bar): close it first, like a visitor
      if (await page.locator('.dk-ov-scrim').isVisible().catch(() => false)) await page.keyboard.press('Escape')
      await back.click()
      await page.waitForURL(new RegExp(`/tur/${n}\\?.*resume=1|/tur/${n}`))
      await waitTour(page)
      await expect.poll(async () => (await state(page))?.n, { timeout: 30_000 }).toBe(n)
      expect((await state(page))?.phase).toBe('player')
      await expect(page.locator(`.dk-tour-stage[data-stage="${slug}"]`)).toBeAttached({ timeout: 30_000 })
      expect(errors).toEqual([])
    })
  }

  test('the visitor world (scope default) is unchanged by the tour', async ({ page, errors }) => {
    const snap = async () => {
      await page.goto('/demo/sapa-warga?e2e=1&off=preloader')
      await page.waitForFunction(() => (window as G).__gamada?.world.status() === 'ready', null, { timeout: 60_000 })
      return page.evaluate(() => {
        const g = (window as G).__gamada
        g.clock.pause()
        const s = g.world.get()
        return { scope: g.world.scope(), audit: s.auditLog.ids.length, complaints: s.complaints.ids.length }
      })
    }
    const before = await snap()
    expect(before.scope).toBe('default')
    await page.waitForTimeout(1500)
    await playCold(page, 4)
    await untilDone(page, 4)
    const tourAudit = await page.evaluate(() => (window as G).__gamada.world.get().auditLog.ids.length)
    expect(tourAudit).not.toBe(before.audit)
    const after = await snap()
    expect(after.scope).toBe('default')
    expect(after.complaints).toBe(before.complaints)
    // the sandbox clock may tick once between ready and pause: its own natural rows only, never the tour's ±100s
    expect(Math.abs(after.audit - before.audit)).toBeLessThanOrEqual(3)
    expect(errors).toEqual([])
  })
})

/* ------------------------------------------------------------------ 6 determinism */

test('tour · determinism: two autoplays give the same audit trail', async ({ browser }) => {
  test.setTimeout(600_000)
  const fps: string[] = []
  for (let run = 0; run < 2; run++) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await ctx.newPage()
    await page.route('**/api/ai/health', (r) => r.fulfill({ json: { ok: true, live: false, mock: false, reason: 'no_api_key' } }))
    await startTour(page)
    await untilSummary(page)
    const a = await T<{ text: string }>(page, 'return await g.audit()')
    fps.push(normFp(a.text))
    await ctx.close()
  }
  const [x, y] = fps.map((f) => f.split('\n'))
  const diff = x!.filter((l) => !y!.includes(l)).concat(y!.filter((l) => !x!.includes(l)))
  // story rows (alerts, complaints, clusters, letters, procurement, orders, bids, loans, ops) must be identical
  expect(diff.filter((l) => !/^(call\.scored|sale\.created|ledger\.posted|price\.updated|brand\.mentioned)\|/.test(l))).toEqual([])
  // natural Usaha Pintar rows (sales, ledger ids, AI call scores) can pair differently when a product reacts in real time
  console.log(`determinism: ${diff.length} natural Usaha Pintar rows differ`)
})

/* ------------------------------------------------------------------ 7 controls + keyboard */

test('tour · controls and keyboard', async ({ page, errors }) => {
  test.setTimeout(180_000)
  await playCold(page, 3)
  await expect.poll(async () => (await state(page))?.n).toBe(3)
  await expect(page.locator('.dk-tour-stage[data-stage="meja-pimpinan"]')).toBeAttached({ timeout: 30_000 })
  await page.locator('[data-tour-ctl="chapters"]').focus()
  await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => undefined)
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  const p0 = (await state(page))!.playing
  await page.keyboard.press('Space')
  expect((await state(page))!.playing).toBe(!p0)
  await page.keyboard.press('Space')
  expect((await state(page))!.playing).toBe(p0)
  await page.keyboard.press('ArrowRight')
  await expect.poll(async () => (await state(page))?.n).toBe(4)
  await page.keyboard.press('ArrowLeft')
  await expect.poll(async () => (await state(page))?.n).toBe(3)
  await page.keyboard.press('l')
  const dlg = page.getByRole('dialog')
  await expect(dlg).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dlg).toBeHidden()
  await page.keyboard.press('p')
  expect((await state(page))!.presenter).toBe(true)
  await page.keyboard.press('b')
  await expect(page.locator('.dk-tour-black')).toBeVisible()
  await page.keyboard.press('b')
  await expect(page.locator('.dk-tour-black')).toHaveCount(0)
  await page.keyboard.press('r')
  await expect.poll(async () => (await state(page))?.n).toBe(3)
  await page.keyboard.press('p')
  expect((await state(page))!.presenter).toBe(false)
  // speed
  await page.locator('[data-rate="1.5"]').click()
  expect((await state(page))!.rate).toBe(1.5)
  await page.locator('[data-rate="0.75"]').click()
  expect((await state(page))!.rate).toBe(0.75)
  // drawer jump
  await page.locator('[data-tour-ctl="chapters"]').click()
  await page.getByRole('dialog').getByRole('button', { name: /Juara Jualan|Penjualan|13\.30/ }).first().click()
  await expect.poll(async () => (await state(page))?.n, { timeout: 20_000 }).toBe(12)
  // a visitor's pointer in the stage pauses the tour; "Lanjutkan tur" resumes
  await expect(page.locator('.dk-tour-stage[data-stage="juara-jualan"]')).toBeAttached({ timeout: 30_000 })
  await page.waitForFunction(() => (window as G).__gamadaTour.state.playing && !(window as G).__gamadaTour.state.busy, null, { timeout: 30_000 })
  const box = (await page.locator('.dk-tour-stage').boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height - 20)
  await expect(page.locator('[data-tour-ctl="resume"]')).toBeVisible()
  expect((await state(page))!.playing).toBe(false)
  expect(await T<number>(page, 'return g.listeners()')).toBe(0)
  await page.locator('[data-tour-ctl="resume"]').click()
  expect((await state(page))!.playing).toBe(true)
  // exit → opener
  await page.locator('[data-tour-ctl="exit"]').click()
  await expect(page.locator('[data-tour-ctl="start"]')).toBeVisible()
  expect(errors).toEqual([])
})

/* ------------------------------------------------------------------ 8 phone */

for (const width of [360, 390, 430]) {
  test(`tour · phone ${width}: sheet snaps, 44 px targets, Ambil alih reachable`, async ({ browser }) => {
    test.setTimeout(120_000)
    const ctx = await browser.newContext({ ...PHONE, viewport: { width, height: 844 } })
    const page = await ctx.newPage()
    await page.route('**/api/ai/health', (r) => r.fulfill({ json: { ok: true, live: false, mock: false, reason: 'no_api_key' } }))
    await playCold(page, 4)
    await expect(page.locator('.dk-tour-stage[data-stage="sapa-warga"]')).toBeAttached({ timeout: 30_000 })
    expect(await noHScroll(page)).toBe(true)
    const sheet = page.locator('.dk-tour-sheet')
    await expect(sheet).toHaveClass(/is-peek/)
    // paused ⇒ the sheet rises to half; Esc ⇒ peek (the rest runs paused so a chapter change never moves the sheet)
    await page.locator('[data-tour-ctl="play-peek"]').click()
    await expect(sheet).toHaveClass(/is-half/)
    await page.keyboard.press('Escape')
    await expect(sheet).toHaveClass(/is-peek/)
    // peek controls ≥ 44 px
    const small = await page.locator('.dk-tour-peek button, .dk-tour-sheet-grip').evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent).map((e) => e.getBoundingClientRect()).filter((r) => r.width < 44 || r.height < 44).length)
    expect(small).toBe(0)
    // button toggle
    await page.locator('[data-tour-ctl="sheet"]').click()
    await expect(sheet).toHaveClass(/is-half/)
    const take = page.locator('.dk-tour-sheet [data-tour="takeover"]')
    await expect(take).toBeVisible()
    const tb = (await take.boundingBox())!
    expect(tb.height).toBeGreaterThanOrEqual(44)
    await page.keyboard.press('Escape')
    await expect(sheet).toHaveClass(/is-peek/)
    // drag the handle up ⇒ a higher snap
    // the class flips at once but the sheet slides back over its transition: grab the handle once it stopped moving
    const handle = page.locator('.dk-tour-sheet-handle')
    let prevY = -1
    await expect.poll(async () => {
      const y = (await handle.boundingBox())!.y
      const still = y === prevY
      prevY = y
      return still
    }, { intervals: [150] }).toBe(true)
    const h = (await handle.boundingBox())!
    await page.mouse.move(h.x + h.width / 4, h.y + h.height / 2)
    await page.mouse.down()
    await page.mouse.move(h.x + h.width / 4, h.y - 200, { steps: 8 })
    await page.mouse.up()
    await expect(sheet).not.toHaveClass(/is-peek/)
    expect(await noHScroll(page)).toBe(true)
    await ctx.close()
  })
}

/* ------------------------------------------------------------------ 9 motion */

test('tour · reduced motion + ?off=tourCinematics: autoplay completes, paused = 0 ticker listeners', async ({ page, errors }) => {
  test.setTimeout(320_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await startTour(page, '&off=tourCinematics')
  await page.waitForFunction(() => (window as G).__gamadaTour?.state.n >= 2, null, { timeout: 60_000 })
  await page.locator('[data-tour-ctl="play"]').click()
  expect((await state(page))!.playing).toBe(false)
  expect(await T<number>(page, 'return g.listeners()')).toBe(0)
  await page.locator('[data-tour-ctl="play"]').click()
  await untilSummary(page)
  const r = await T<Record<string, boolean>>(page, 'return { ...g.doneLog }')
  for (let n = 1; n <= 20; n++) expect(r[n], `chapter ${n}`).toBe(true)
  expect(errors).toEqual([])
})

/* ------------------------------------------------------------------ 10 poster mode */

for (const [n, slug] of [[17, 'sinyal-pasar'], [19, 'inti']] as const) {
  test(`tour · degrade ${slug}: chapter ${n} as a poster, numbers, Ambil alih disabled with the reason`, async ({ page, errors }) => {
    test.setTimeout(240_000)
    await playCold(page, n, `&tourDegrade=${slug}`)
    await expect.poll(async () => (await state(page))?.poster, { timeout: 60_000 }).toBe(true)
    await untilDone(page, n)
    expect(await done(page, n)).toBe(true)
    await expect(page.locator('.dk-tour-poster-nums li').first()).toBeVisible()
    expect(await page.locator('.dk-tour-poster-nums').innerText()).not.toMatch(/\{\w+\}|…/)
    const take = page.locator('[data-tour="takeover"]').first()
    await expect(take).toBeDisabled()
    await expect(page.locator('.dk-tour-why').first()).toContainText('Demo penuh menyusul')
    await expect.poll(async () => (await state(page))?.n, { timeout: 60_000 }).toBe(n + 1)
    expect(errors).toEqual([])
  })
}

/* ------------------------------------------------------------------ 11 region, 12 language */

test('tour · region: the opener title uses the pack name', async ({ page, errors }) => {
  const PACKS = 'src/demo-kit/region/packs'
  const ids = readdirSync(PACKS).filter((d) => statSync(join(PACKS, d)).isDirectory())
  const id = ids.find((r) => r !== 'bojonegoro') ?? 'bojonegoro'
  const pack = JSON.parse(readFileSync(join(PACKS, id, 'pack.min.json'), 'utf8')) as { shortName: string }
  await page.goto(`/tur?e2e=1&region=${id}`)
  await expect(page.locator('h1')).toContainText(`Satu Hari di ${pack.shortName}`)
  expect(errors).toEqual([])
})

test('tour · English: title, chapters 1–5 narration without Indonesian words', async ({ page, errors }) => {
  test.setTimeout(180_000)
  await page.goto('/tur?e2e=1&rate=8&lang=en')
  await waitTour(page)
  await expect(page.locator('h1')).toContainText('A Day in Bojonegoro')
  await page.locator('[data-tour-ctl="start"]').click()
  const ID_WORDS = /\b(yang|dan|dengan|dari|untuk|Pukul|berkas|aduan|warga menerima)\b/
  const seen: string[] = []
  for (let n = 1; n <= 5; n++) {
    await expect.poll(async () => (await state(page))?.n, { timeout: 60_000 }).toBe(n)
    await page.waitForTimeout(600)
    const txt = await page.locator('.dk-tour-col').innerText()
    if (ID_WORDS.test(txt)) seen.push(`ch ${n}: ${txt.match(ID_WORDS)![0]}`)
  }
  expect(seen).toEqual([])
  expect(errors).toEqual([])
})

/* ------------------------------------------------------------------ 14 node checks */

test.describe('tour · data (node)', () => {
  test('length 7–9 min at 1×, narration ≤ 60 words ID + EN, hooks exist, no region name typed', () => {
    const total = totalSeconds()
    console.log(`tour length at 1×: ${total} s (${(total / 60).toFixed(1)} min)`)
    expect(total).toBeGreaterThanOrEqual(420)
    expect(total).toBeLessThanOrEqual(540)
    for (const N of [NID, NEN]) {
      for (let n = 1; n <= 20; n++) {
        const e = N[n]
        expect(e, `narration ${n}`).toBeTruthy()
        expect(e!.body.split(/\s+/).filter(Boolean).length, `narration ${n} words`).toBeLessThanOrEqual(60)
        if (n < 20) expect(e!.happened.length).toBeGreaterThanOrEqual(1)
        expect(e!.happened.length).toBeLessThanOrEqual(3)
      }
    }
    // hook audit: every selector of chapters.ts is in a product (or the kit) source file
    const files: string[] = []
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.tsx?$/.test(f)) files.push(readFileSync(p, 'utf8'))
      }
    }
    walk('src/demos')
    walk('src/demo-kit/shell')
    walk('src/demo-kit/ui')
    const missing: string[] = []
    for (const ch of CHAPTERS)
      for (const st of ch.steps) {
        const sels = 'sel' in st ? [st.sel, ...('send' in st ? [st.send] : [])] : []
        for (const sel of sels) {
          const m = /^\[([\w-]+)="([^"]+)"\]$/.exec(sel)
          if (!m) continue
          const [, attr, val] = m
          const base = val!.replace(/-\d+$/, '')
          if (!files.some((src) => (attr === 'data-tour' || src.includes(attr!)) && (src.includes(`"${val}"`) || src.includes(`'${val}'`) || src.includes(base)))) missing.push(`ch ${ch.n} ${sel}`)
        }
      }
    expect(missing).toEqual([])
    // region-agnostic
    const tourSrc: string[] = []
    for (const f of readdirSync('src/demo-kit/tour')) if (/\.(tsx?|css)$/.test(f)) tourSrc.push(readFileSync(join('src/demo-kit/tour', f), 'utf8'))
    expect(tourSrc.filter((s) => s.includes('Bojonegoro'))).toEqual([])
  })
})
