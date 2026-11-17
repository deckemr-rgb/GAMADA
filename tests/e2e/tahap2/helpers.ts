/**
 * Shared helpers for the tahap-2 (Satu Daerah) product suites.
 *
 * Every test runs in a fresh browser context, so the world (IndexedDB), the missions (localStorage) and the
 * hotspot dismissals (sessionStorage) start clean. `?e2e=1` exposes `window.__gamada = { world, emit, settled,
 * onEvent, clock }` (DemoShell test hook); the clock is paused in every suite (`pauseClock`) so the 10:00 rumor
 * burst and the natural events never fire mid-test.
 */
import type { Page, TestInfo } from '@playwright/test'
import { expect } from '../fixtures'

export const SLUGS = ['sapa-warga', 'meja-pimpinan', 'naskah-pintar', 'radar-isu', 'siaga-wilayah', 'awas-belanja', 'cek-berkas'] as const
export type Slug = (typeof SLUGS)[number]

/** default role + one alternative role per product (content/products.ts) */
export const ROLES: Record<Slug, [string, string]> = {
  'sapa-warga': ['warga', 'petugas'],
  'meja-pimpinan': ['kepala-daerah', 'kepala-opd'],
  'naskah-pintar': ['sekretariat', 'kepala-daerah'],
  'radar-isu': ['humas', 'kepala-daerah'],
  'siaga-wilayah': ['bpbd', 'kepala-daerah'],
  'awas-belanja': ['ukpbj', 'inspektorat'],
  'cek-berkas': ['perizinan', 'dinsos'],
}

/** the product's root element (CSS prefix of each product) */
export const ROOT: Record<Slug, string> = {
  'sapa-warga': '.dk-sw',
  'meja-pimpinan': '.dk-mp',
  'naskah-pintar': '.dk-np',
  'radar-isu': '.dk-ri',
  'siaga-wilayah': '.dk-sg',
  'awas-belanja': '.dk-ab',
  'cek-berkas': '.dk-cb',
}

export const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } as const

export interface OpenOpts {
  lang?: 'id' | 'en'
  role?: string
  extra?: string
  /** keep the world clock running (default: paused right after boot) */
  run?: boolean
}

/** open /demo/<slug> with the test hook, wait for the world and the product root */
export async function openDemo(page: Page, slug: Slug, o: OpenOpts = {}): Promise<void> {
  const q = new URLSearchParams({ off: 'preloader', e2e: '1' })
  if (o.lang) q.set('lang', o.lang)
  if (o.role) q.set('role', o.role)
  await page.goto(`/demo/${slug}?${q.toString()}${o.extra ? `&${o.extra}` : ''}`)
  await waitWorld(page)
  await expect(page.locator(ROOT[slug]).first()).toBeVisible({ timeout: 20_000 })
  if (!o.run) await pauseClock(page)
}

export async function waitWorld(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const g = (window as unknown as { __gamada?: { world: { status(): string } } }).__gamada
    return !!g && g.world.status() === 'ready'
  }, null, { timeout: 45_000 })
}

/** pause the world clock (deterministic tests; products still emit their own events) */
export async function pauseClock(page: Page): Promise<void> {
  await page.evaluate(() => {
    const c = (window as unknown as { __gamada: { clock: { pause?: () => void; setPlaying?: (b: boolean) => void } } }).__gamada.clock
    if (typeof c.pause === 'function') c.pause()
    else c.setPlaying?.(false)
  })
}

/** SPA navigation (the world stays in memory, like following an in-app link) */
export async function spaGo(page: Page, path: string): Promise<void> {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
}

/** read an expression over the world state `s` */
export function W<T>(page: Page, expr: string): Promise<T> {
  return page.evaluate((x) => {
    const s = (window as unknown as { __gamada: { world: { get(): unknown } } }).__gamada.world.get()
    // eslint-disable-next-line no-new-func
    return new Function('s', `return (${x})`)(s) as T
  }, expr)
}

/** emit events from the test (source = the product that owns the action) and wait for the reactions */
export async function emit(page: Page, type: string, payload: unknown, source: string): Promise<void> {
  await page.evaluate(
    async ([t, p, s]) => {
      const g = (window as unknown as { __gamada: { emit(t: string, p: unknown, s: string): void; settled(): Promise<void> } }).__gamada
      g.emit(t as string, p, s as string)
      await g.settled()
    },
    [type, payload, source] as const,
  )
}

export async function settled(page: Page): Promise<void> {
  await page.evaluate(() => (window as unknown as { __gamada: { settled(): Promise<void> } }).__gamada.settled())
}

/** start recording world events (type + source) in the page; read them with `events()` */
export async function recordEvents(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __ev?: { type: string; source: string }[]; __gamada: { onEvent(t: string, fn: (e: { type: string; source: string }) => void): () => void } }
    w.__ev = []
    w.__gamada.onEvent('*', (e) => w.__ev!.push({ type: e.type, source: e.source }))
  })
}
export const events = (page: Page): Promise<{ type: string; source: string }[]> =>
  page.evaluate(() => (window as unknown as { __ev?: { type: string; source: string }[] }).__ev ?? [])

/** completed mission ids of a product (shell missions, localStorage) */
export function missionsDone(page: Page, slug: Slug): Promise<string[]> {
  return page.evaluate((s) => {
    try {
      return JSON.parse(localStorage.getItem(`gamada:demo:missions:${s}`) ?? '[]') as string[]
    } catch {
      return []
    }
  }, slug)
}

/** close the guide sheet when it covers the canvas (phones) */
export async function closeGuide(page: Page): Promise<void> {
  const guide = page.locator('.dk-guide:not([hidden])')
  if (await guide.count()) {
    const btn = guide.getByRole('button', { name: /Tutup|Close/ }).first()
    if (await btn.isVisible().catch(() => false)) await btn.click()
  }
  await expect(page.locator('.dk-guide:not([hidden])')).toHaveCount(0)
}

/** the guide's own count: "5 dari 5 selesai" / "5 of 5 done" */
export async function expectGuideComplete(page: Page, total: number): Promise<void> {
  const toggle = page.locator('.dk-topbar').getByRole('button', { name: /panduan|guide/i }).first()
  if (!(await page.locator('.dk-guide:not([hidden])').count()) && (await toggle.count())) await toggle.click()
  await expect(page.locator('.dk-guide-step.is-done')).toHaveCount(total)
}

/** the console / page errors that are noise for these suites (external tiles, aborted AI health) */
export const notNoise = (e: string): boolean => !/api\/ai|ERR_CONNECTION_REFUSED|ERR_FAILED|ERR_ABORTED|tiles\.openfreemap|openfreemap\.org|eox\.at|net::ERR_/.test(e)

export async function shot(page: Page, info: TestInfo, name: string): Promise<void> {
  await info.attach(name, { body: await page.screenshot(), contentType: 'image/png' })
}
