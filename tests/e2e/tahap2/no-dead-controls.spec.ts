/**
 * "No dead buttons" crawler (spec §8.5, §15): on the first screen of every Satu Daerah demo, each visible, enabled
 * control in the canvas is activated once and must change something observable: the DOM (a dialog, a panel, a
 * pressed / selected state, new rows), the URL, a world event, a download, or the focused element. After each
 * control the page is put back (Escape, or the demo re-opened when the control navigated away).
 */
import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures'
import { SLUGS, notNoise, openDemo, type Slug } from './helpers'

// up to 45 controls, most of which reopen the demo afterwards (about 3.5 s each): 2.5-3 min per demo when run alone
test.describe.configure({ timeout: 420_000 })

// tabs are checked on their own (each one must select its panel): clicking them mid-crawl would change the screen
const CONTROLS = '.dk-shell-canvas :is(button:not([role="tab"]), [role="radio"], [role="switch"], a[href], summary, input[type="checkbox"], input[type="radio"])'
const MAX = 45

async function probe(page: Page, i: number): Promise<{ label: string; changed: boolean; skipped?: boolean; navigated?: boolean }> {
  return page.evaluate(
    async ([sel, idx]) => {
      const els = Array.from(document.querySelectorAll<HTMLElement>(sel)).filter((el) => {
        const r = el.getBoundingClientRect()
        const cs = getComputedStyle(el)
        // an already selected tab / radio option has nothing to do by design (re-selecting is a no-op)
        // (the same goes for the current item of a list / rail, marked aria-current)
        const current =
          (el.getAttribute('role') === 'tab' && el.getAttribute('aria-selected') === 'true') ||
          (el.getAttribute('role') === 'radio' && el.getAttribute('aria-checked') === 'true') ||
          (!!el.getAttribute('aria-current') && el.getAttribute('aria-current') !== 'false')
        return !current && r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !el.closest('[inert], [aria-hidden="true"]') && !(el as HTMLButtonElement).disabled && el.getAttribute('aria-disabled') !== 'true'
      })
      const el = els[idx as number]
      if (!el) return { label: '', changed: false, skipped: true }
      const label = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 60)
      // links leave the page by design (cross-product links, sources): a real href is a working control
      if (el instanceof HTMLAnchorElement) return { label, changed: !!el.getAttribute('href') && el.getAttribute('href') !== '#' }
      const w = window as unknown as { __gamada: { onEvent(t: string, fn: () => void): () => void } }
      let changed = false
      const mo = new MutationObserver((list) => {
        if (list.some((m) => !(m.target instanceof Element && m.target.closest('.dk-hotspot-host, .dk-clock, [data-clock]')))) changed = true
      })
      mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true })
      const off = w.__gamada.onEvent('*', () => (changed = true))
      const url = location.href
      const focus = document.activeElement
      el.scrollIntoView({ block: 'center' })
      el.click()
      // lazy panels (dialogs, tabs) may need their chunk first: wait up to 5 s for a visible effect
      for (let t = 0; t < 50 && !changed && location.href === url && document.activeElement === focus; t++) await new Promise((r) => setTimeout(r, 100))
      await new Promise((r) => setTimeout(r, 150))
      mo.disconnect()
      off()
      const navigated = location.href !== url
      return { label, changed: changed || navigated || document.activeElement !== focus, navigated }
    },
    [CONTROLS, i] as const,
  )
}

for (const slug of SLUGS) {
  test(`no dead controls · ${slug} (first screen, 1440)`, async ({ page, errors }) => {
    page.on('dialog', (d) => void d.dismiss())
    await page.addInitScript(() => {
      window.print = () => undefined
    })
    await openDemo(page, slug as Slug)
    const path = new URL(page.url()).pathname
    const dead: string[] = []
    let checked = 0
    const count = () =>
      page.evaluate((sel) => Array.from(document.querySelectorAll<HTMLElement>(sel)).filter((el) => el.getBoundingClientRect().width > 0 && !el.closest('[inert]')).length, CONTROLS)
    const crawl = async (deeper?: () => Promise<void>) => {
      if (deeper) await deeper()
      const base = await count()
      for (let i = 0; i < MAX; i++) {
        const r = await probe(page, i)
        if (r.skipped) break
        checked++
        if (!r.changed) dead.push(r.label)
        if (new URL(page.url()).pathname !== path) {
          await openDemo(page, slug as Slug)
          if (deeper) await deeper()
        } else {
          // close whatever the control opened (dialogs, drawers, meeting mode) before the next one
          for (let k = 0; k < 3 && (await page.locator('.dk-ov, .dk-mp-mm, [role="dialog"][aria-modal="true"]').count()); k++) {
            await page.keyboard.press('Escape')
            await page.waitForTimeout(400)
          }
          // the control changed the screen (another mode / view): start the next one from the first screen again
          if ((await page.locator('.dk-ov, .dk-mp-mm').count()) || (await count()) !== base) {
            await openDemo(page, slug as Slug)
            if (deeper) await deeper()
          }
        }
      }
    }
    await crawl()
    // Awas Belanja's first screen is the package list: also crawl the opened emergency package
    if (slug === 'awas-belanja') {
      await openDemo(page, slug)
      await crawl(async () => {
        if (!(await page.locator('.dk-ab-dtitle').count())) await page.locator('[data-hotspot="ab-start"]').first().click()
        await expect(page.locator('.dk-ab-dtitle')).toBeVisible({ timeout: 15_000 })
      })
    }
    // every product tab selects its panel
    await openDemo(page, slug as Slug)
    const tabs = page.locator('.dk-shell-canvas [role="tab"]')
    const nTabs = await tabs.count()
    for (let i = 0; i < nTabs; i++) {
      const tab = tabs.nth(i)
      if (!(await tab.isVisible())) continue
      await tab.click()
      await expect(tab, `tab ${i} on ${slug}`).toHaveAttribute('aria-selected', 'true')
    }
    expect(checked).toBeGreaterThan(2)
    expect(dead, `dead controls on ${slug}`).toEqual([])
    expect(errors.filter(notNoise)).toEqual([])
  })
}
