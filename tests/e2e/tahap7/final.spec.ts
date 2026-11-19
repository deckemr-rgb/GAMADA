/**
 * Tahap 7 · final proof (plan docs/build/tahap7-plan.md §6): the tour autoplays all 20 chapters on another region
 * pack without a crash or a console error, at 1440×900 and 390×844, with the names from that pack (opener title,
 * no `{placeholder}` leaks, no fallback chapters). Bojonegoro's full assertions (numbers, PDF, WhatsApp) stay in
 * tests/e2e/tahap5/tour.spec.ts; the tour narrative itself stays "Satu Hari di Bojonegoro" on the site (§7 Q5).
 */
import { readFileSync } from 'node:fs'
import type { Browser, Page } from '@playwright/test'
import { expect, test } from '../fixtures'

/* eslint-disable @typescript-eslint/no-explicit-any */
type G = any
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } as const
const DESK = { viewport: { width: 1440, height: 900 } } as const
const shortName = (id: string) => (JSON.parse(readFileSync(`src/demo-kit/region/packs/${id}/pack.json`, 'utf8')) as { shortName: string }).shortName

async function autoplay(browser: Browser, region: string, ctxOpts: typeof PHONE | typeof DESK) {
  const ctx = await browser.newContext(ctxOpts)
  const page: Page = await ctx.newPage()
  const errors: string[] = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  await page.route('**/api/ai/health', (r) => r.fulfill({ json: { ok: true, live: false, mock: false, reason: 'no_api_key' } }))
  await page.goto(`/tur?e2e=1&rate=8&region=${region}`)
  await page.waitForFunction(() => !!(window as G).__gamadaTour, null, { timeout: 30_000 })
  await expect(page.locator('h1')).toContainText(shortName(region))
  await page.locator('[data-tour-ctl="start"]').click()
  const leaks: string[] = []
  let wide = 0
  let last = 0
  for (;;) {
    const s = await page.evaluate(() => {
      const g = (window as G).__gamadaTour
      return g ? { n: g.state.n as number, phase: g.state.phase as string } : null
    })
    if (s?.phase === 'summary') break
    if (s && s.n !== last && s.phase === 'player') {
      last = s.n
      // no auto-wait: the phone layout shows the narration in a sheet, not in .dk-tour-col
      const txt = await page.evaluate(() => (document.querySelector('.dk-tour-col, .dk-tour') as HTMLElement | null)?.innerText ?? '')
      if (/\{\w+\}/.test(txt)) leaks.push(`ch ${s.n}: ${txt.match(/\{\w+\}/)![0]}`)
    }
    if (!(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))) wide++
    await page.waitForTimeout(500)
  }
  const r = await page.evaluate(() => {
    const g = (window as G).__gamadaTour
    return { done: { ...g.doneLog } as Record<string, boolean>, fb: (g.fallbackLog as string[]).slice(), region: (window as G).__gamada?.world?.get?.().regionId ?? null }
  })
  await expect(page.locator('[data-tour="summary-numbers"] [data-sum]')).toHaveCount(6)
  await ctx.close()
  return { leaks, wide, errors, ...r }
}

test.describe('tour on another region pack', () => {
  test.describe.configure({ timeout: 480_000 })
  for (const [region, opts, label] of [
    ['bandung', DESK, '1440'],
    ['bandung', PHONE, '390'],
    ['padang', DESK, '1440'],
  ] as const) {
    test(`/tur?region=${region} at ${label}: 20 chapters, no errors, no placeholder leaks`, async ({ browser }) => {
      const r = await autoplay(browser, region, opts)
      for (let n = 1; n <= 20; n++) expect(r.done[n], `chapter ${n} done`).toBe(true)
      expect(r.fb).toEqual([])
      expect(r.leaks).toEqual([])
      expect(r.wide).toBe(0)
      expect(r.errors).toEqual([])
    })
  }
})
