/** Shared helpers: collect console errors / page errors for every test page. */
import { test as base, expect, type Page } from '@playwright/test'

export const test = base.extend<{ errors: string[] }>({
  page: async ({ page }, use) => {
    // The e2e build talks to a same-origin AI proxy (VITE_AI_PROXY_URL=''), which does not run during the tests.
    // Default answer: "proxy up, no API key" (live off, no network error). Tests that need another answer add
    // their own page.route(), which takes precedence.
    await page.route('**/api/ai/health', (r) => r.fulfill({ json: { ok: true, live: false, mock: false, reason: 'no_api_key' } }))
    await use(page)
  },
  errors: async ({ page }, use) => {
    const errors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`console: ${m.text()} @ ${m.location().url}`)
    })
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
    await use(errors)
  },
})
export { expect }

/** Wait until the route has rendered its main landmark and the network is quiet. */
export async function settle(page: Page): Promise<void> {
  await expect(page.locator('main, [role="main"]').first()).toBeAttached()
  await page.waitForLoadState('networkidle')
}

/** Errors expected when a test deliberately blocks the AI proxy. */
export const notAiNoise = (e: string): boolean => !/api\/ai|ERR_CONNECTION_REFUSED|ERR_FAILED/.test(e)
