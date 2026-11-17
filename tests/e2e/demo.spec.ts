/**
 * (c) DemoShell boots from URL params and keeps them in the URL · (d) a cross-product reaction chain through
 * the world store · (e) AI: the sim chat streams, and Live falls back to Simulasi when /api/ai is unreachable.
 */
import type { Locator } from '@playwright/test'
import { test, expect, settle, notAiNoise } from './fixtures'

/** The AI showcase auto-sends one sample when first seen; wait until that answer has finished streaming. */
async function autoDemoDone(chat: Locator): Promise<void> {
  await expect.poll(() => chat.locator('.dk-ai-msg--ai').count(), { timeout: 10_000 }).toBeGreaterThan(0)
  await expect(chat.locator('.dk-ai-caret')).toHaveCount(0, { timeout: 15_000 })
  await expect(chat.locator('.dk-ai-typing')).toHaveCount(0)
}

test('DemoShell boots from ?role= ?t= ?lang=en and keeps them in the URL', async ({ page, errors }) => {
  await page.goto('/demo/indeks-ekonomi?role=kepala-daerah&t=10:00&lang=en&off=preloader')
  await settle(page)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  // the placeholder marks the session role (from ?role=) as current, in English
  await expect(page.locator('[aria-current]').filter({ hasText: 'Regional Head' })).toBeVisible()
  const params = () => {
    const u = new URL(page.url())
    return [u.searchParams.get('role'), u.searchParams.get('t'), u.searchParams.get('lang')]
  }
  await expect.poll(params).toEqual(['kepala-daerah', '10:00', 'en'])
  // still there after the shell has had time to sync session → URL
  await page.waitForTimeout(800)
  expect(params()).toEqual(['kepala-daerah', '10:00', 'en'])
  expect(errors).toEqual([])
})

test('world store: a Sapa Warga flood surge → one toast to Meja Pimpinan + the downstream audit row', async ({ page, errors }) => {
  await page.goto('/lab/_kit?only=shell&off=preloader')
  await settle(page)
  const surge = page.getByRole('button', { name: 'Lonjakan aduan banjir' })
  await expect(surge).toBeEnabled()
  await expect(page.locator('.dk-toast')).toHaveCount(0)
  await surge.click() // 5 complaint.created with source 'sapa-warga'
  // exactly one cross-product toast: 5 complaints → 1 cluster → Meja Pimpinan
  const toast = page.locator('.dk-toast')
  await expect(toast).toHaveCount(1)
  await expect(toast).toContainText('Meja Pimpinan')
  await expect(toast).toContainText('Klaster')
  await page.waitForTimeout(1000)
  await expect(toast).toHaveCount(1)
  // the downstream row lives in the shared, persisted world: the world showcase's audit log shows the reaction
  await page.goto('/lab/_kit?only=world&off=preloader')
  await settle(page)
  await expect(page.locator('#kit-world').getByText(/↳ Klaster banjir/).first()).toBeVisible()
  expect(errors).toEqual([])
})

test('AI sim chat streams an answer', async ({ page, errors }) => {
  await page.route('**/api/ai/**', (r) => r.abort('connectionrefused'))
  await page.goto('/lab/_kit?only=ai&off=preloader')
  await settle(page)
  const chat = page.locator('.dk-ai-chat')
  await chat.scrollIntoViewIfNeeded()
  const input = chat.locator('#dk-ai-input')
  await expect(input).toBeVisible()
  // the panel auto-sends a Javanese sample once it is seen: let that answer finish, then ask our own question
  await autoDemoDone(chat)
  const before = await chat.locator('.dk-ai-msg--ai').count()
  await input.fill('Jalan rusak di Dander, banyak lubang')
  await input.press('Enter')
  const answer = chat.locator('.dk-ai-msg--ai').nth(before).locator('p').first()
  // streaming: the caret shows and the text grows over time
  await expect(chat.locator('.dk-ai-caret')).toBeVisible({ timeout: 10_000 })
  const len1 = (await answer.innerText()).length
  await page.waitForTimeout(400)
  const len2 = (await answer.innerText()).length
  expect(len2).toBeGreaterThan(len1)
  await expect(chat.locator('.dk-ai-caret')).toHaveCount(0, { timeout: 15_000 })
  expect((await answer.innerText()).length).toBeGreaterThan(20)
  expect(errors.filter(notAiNoise)).toEqual([])
})

test('Live toggle falls back to Simulasi when /api/ai/health is unreachable', async ({ page, errors }) => {
  let healthCalls = 0
  await page.route('**/api/ai/**', (r) => {
    if (r.request().url().includes('/api/ai/health')) healthCalls++
    return r.abort('connectionrefused')
  })
  // a shared Live link: the shell downgrades it because health is down
  await page.goto('/lab/_kit?only=shell&off=preloader&ai=live')
  await settle(page)
  const radios = page.locator('.dk-ai[role="radiogroup"] [role="radio"]')
  await expect(radios.nth(1)).toHaveAttribute('aria-disabled', 'true')
  await expect(radios.nth(0)).toHaveAttribute('aria-checked', 'true')
  await expect(radios.nth(1)).toHaveAttribute('aria-checked', 'false')
  expect(healthCalls).toBeGreaterThan(0)
  // trying Live explains why and stays on Simulasi
  await radios.nth(1).click({ force: true })
  await expect(page.locator('.dk-toast').filter({ hasText: 'AI Live belum tersedia' })).toBeVisible()
  await expect(radios.nth(0)).toHaveAttribute('aria-checked', 'true')
  await expect(page).not.toHaveURL(/[?&]ai=live/)
  // the demo route drops ?ai=live too
  await page.goto('/demo/sapa-warga?ai=live&off=preloader')
  await settle(page)
  await expect.poll(() => new URL(page.url()).searchParams.get('ai')).toBeNull()
  expect(errors.filter(notAiNoise)).toEqual([])
})

test('Live chat falls back to Simulasi when the proxy fails mid-session', async ({ page, errors }) => {
  // health says live, but every chat call fails → the provider falls back and the sim answer still streams
  const failed: string[] = []
  await page.route('**/api/ai/**', (r) => {
    failed.push(new URL(r.request().url()).pathname)
    return r.abort('connectionrefused')
  })
  await page.route('**/api/ai/health', (r) => r.fulfill({ json: { ok: true, live: true, mock: true, models: { fast: 'f', smart: 's', extract: 'e' } } }))
  await page.goto('/lab/_kit?only=ai&off=preloader')
  await settle(page)
  const chat = page.locator('.dk-ai-chat')
  await chat.scrollIntoViewIfNeeded()
  await autoDemoDone(chat)
  const live = chat.locator('.dk-ai-mode button.is-live')
  await expect(live).not.toHaveAttribute('aria-disabled', 'true')
  await live.click()
  await expect(live).toHaveAttribute('aria-pressed', 'true')
  const before = await chat.locator('.dk-ai-msg--ai').count()
  await chat.locator('#dk-ai-input').fill('Lampu jalan mati di Kapas')
  await chat.locator('#dk-ai-input').press('Enter')
  await expect(chat.locator('.dk-ai-notice')).toContainText('beralih ke Simulasi', { timeout: 15_000 })
  // the simulated answer still arrives in full
  const answer = chat.locator('.dk-ai-msg--ai').nth(before).locator('p').first()
  await expect.poll(async () => (await answer.innerText().catch(() => '')).length, { timeout: 15_000 }).toBeGreaterThan(20)
  await expect(chat.locator('.dk-ai-caret')).toHaveCount(0, { timeout: 15_000 })
  expect(failed).toContain('/api/ai/chat') // the live request really was attempted
  expect(errors.filter(notAiNoise)).toEqual([])
})
