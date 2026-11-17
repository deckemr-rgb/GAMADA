/**
 * AI Live mode on the real products with a mocked SSE proxy (spec §9, §15): the answer streams from
 * /api/ai/chat (text + done events), and when the proxy never answers the first token the chat falls back to
 * Simulasi after DEMO.liveFirstTokenTimeoutMs (10 s) and the simulated answer still arrives in full.
 */
import type { Page, Route } from '@playwright/test'
import { test, expect } from '../fixtures'
import { closeGuide, notNoise, openDemo } from './helpers'

test.describe.configure({ timeout: 90_000 })

const LIVE_HEALTH = { ok: true, live: true, mock: true, models: { fast: 'f', smart: 's', extract: 'e' } }
const sse = (events: [string, unknown][]) => events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join('')

async function liveProxy(page: Page, answer: string): Promise<string[]> {
  const bodies: string[] = []
  await page.route('**/api/ai/health', (r) => r.fulfill({ json: LIVE_HEALTH }))
  await page.route('**/api/ai/chat', (r: Route) => {
    bodies.push(r.request().postData() ?? '')
    return r.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: sse([['text', { text: answer.slice(0, 20) }], ['text', { text: answer.slice(20) }], ['done', { intentId: 'live-test' }]]) })
  })
  return bodies
}

/** the proxy is "up" but never sends a first token */
async function hangingProxy(page: Page): Promise<void> {
  await page.route('**/api/ai/health', (r) => r.fulfill({ json: LIVE_HEALTH }))
  await page.route('**/api/ai/chat', () => new Promise<void>(() => undefined))
}

test('Live · Sapa Warga: the phone chat streams the proxy answer (mock SSE)', async ({ page, errors }) => {
  const answer = 'Jawaban Live dari proxy uji: syarat NIB adalah KTP, NPWP, dan alamat usaha.'
  const bodies = await liveProxy(page, answer)
  await openDemo(page, 'sapa-warga', { extra: 'ai=live' })
  await expect.poll(() => new URL(page.url()).searchParams.get('ai')).toBe('live')
  await page.locator('[data-sw="persona-raka"]').click()
  await page.locator('.dk-sw-input').fill('Syarat NIB apa saja?')
  await page.locator('.dk-sw-input').press('Enter')
  await expect(page.locator('.dk-sw-row.is-ai').filter({ hasText: 'proxy uji' }).first()).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.dk-sw-mode.is-live').last()).toBeVisible()
  const req = JSON.parse(bodies[0]!) as { product: string; context: unknown }
  expect(req.product).toBe('sapa-warga')
  expect(JSON.stringify(req.context).length).toBeLessThanOrEqual(6_200)
  expect(errors.filter(notNoise)).toEqual([])
})

test('Live · Sapa Warga: no first token in 10 s ⇒ falls back to Simulasi, the answer still arrives', async ({ page, errors }) => {
  await hangingProxy(page)
  await openDemo(page, 'sapa-warga', { extra: 'ai=live' })
  await page.locator('[data-sw="persona-raka"]').click()
  const before = await page.locator('.dk-sw-row.is-ai').count()
  await page.locator('.dk-sw-input').fill('Syarat NIB apa saja?')
  await page.locator('.dk-sw-input').press('Enter')
  await expect(page.locator('.dk-sw-mode').filter({ hasText: /Simulasi/ }).last()).toBeVisible({ timeout: 25_000 })
  await expect.poll(() => page.locator('.dk-sw-row.is-ai').count(), { timeout: 25_000 }).toBeGreaterThan(before)
  // the shell drops Live for the session and says so
  await expect.poll(() => new URL(page.url()).searchParams.get('ai'), { timeout: 10_000 }).toBeNull()
  expect(errors.filter(notNoise)).toEqual([])
})

test('Live · Meja Pimpinan: "Tanya data" streams the proxy answer (mock SSE)', async ({ page, errors }) => {
  const answer = 'Jawaban Live dari proxy uji: aduan terbanyak ada di Kecamatan Trucuk.'
  const bodies = await liveProxy(page, answer)
  await openDemo(page, 'meja-pimpinan', { extra: 'ai=live' })
  await closeGuide(page).catch(() => undefined)
  await page.locator('.dk-mp-askform input').fill('Kecamatan mana paling banyak aduan?')
  await page.locator('.dk-mp-askform input').press('Enter')
  await expect(page.locator('.dk-mp-a-t').filter({ hasText: 'proxy uji' }).first()).toBeVisible({ timeout: 15_000 })
  expect((JSON.parse(bodies[0]!) as { product: string }).product).toBe('meja-pimpinan')
  expect(errors.filter(notNoise)).toEqual([])
})

test('Live · Meja Pimpinan: no first token in 10 s ⇒ Simulasi answers the question', async ({ page, errors }) => {
  await hangingProxy(page)
  await openDemo(page, 'meja-pimpinan', { extra: 'ai=live' })
  await page.locator('.dk-mp-askform input').fill('Kecamatan mana paling banyak aduan?')
  await page.locator('.dk-mp-askform input').press('Enter')
  await expect(page.locator('.dk-mp-qres').first()).toBeVisible({ timeout: 30_000 })
  await expect.poll(async () => (await page.locator('.dk-mp-a-t').first().innerText()).length, { timeout: 15_000 }).toBeGreaterThan(20)
  await expect(page.locator('.dk-toast').filter({ hasText: /Simulasi/ }).first()).toBeVisible()
  expect(errors.filter(notNoise)).toEqual([])
})
