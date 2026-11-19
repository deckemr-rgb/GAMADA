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

export const SD_SLUGS = ['sapa-warga', 'meja-pimpinan', 'naskah-pintar', 'radar-isu', 'siaga-wilayah', 'awas-belanja', 'cek-berkas'] as const
/** tahap 3 · Usaha Pintar (DEMO_READY since 2026-11-18): the shared suites (no dead controls, region + language) cover them too */
export const UP_SLUGS = ['toko-autopilot', 'pajak-beres', 'juara-jualan', 'kenal-mitra', 'pantau-merek', 'tenderpilot'] as const
/** tahap 4 · Pasar Daerah + GAMADA Inti (DEMO_READY since 2026-11-19): covered by the shared suites as well */
export const PD_SLUGS = ['katalog-lokal', 'rapor-usaha', 'indeks-ekonomi', 'sinyal-pasar', 'inti'] as const
export const SLUGS = [...SD_SLUGS, ...UP_SLUGS, ...PD_SLUGS] as const
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
  'toko-autopilot': ['pemilik-toko', 'kasir'],
  'pajak-beres': ['pemilik-toko', 'konsultan-pajak'],
  'juara-jualan': ['supervisor-sales', 'agen-sales'],
  'kenal-mitra': ['analis-kyc', 'bank-mitra'],
  'pantau-merek': ['brand-manager', 'pemilik-toko'],
  tenderpilot: ['vendor', 'vendor'],
  'katalog-lokal': ['ukpbj', 'pemilik-toko'],
  'rapor-usaha': ['pemilik-toko', 'bank-mitra'],
  'indeks-ekonomi': ['bappeda', 'dinkop'],
  'sinyal-pasar': ['disperindag', 'pemilik-toko'],
  inti: ['kepala-daerah', 'sekretariat'],
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
  // Usaha Pintar canvases render a skeleton until the ecosystem module is in: the root is the loaded one
  'toko-autopilot': '.dk-ta:not([aria-busy])',
  'pajak-beres': '.dk-pb:not(.dk-pb-skel)',
  'juara-jualan': '.dk-jj:not([aria-busy])',
  'kenal-mitra': '.dk-km:not(.dk-km-skel)',
  'pantau-merek': '.dk-pm:not(:has(.dk-pm-skel))',
  tenderpilot: '.dk-tp:not(.dk-tp-skel)',
  // Pasar Daerah / Inti canvases: skeleton (aria-busy / -skel) until useWorldReady
  'katalog-lokal': '.dk-kl[data-side]',
  'rapor-usaha': '.dk-ru:not([aria-busy])',
  'indeks-ekonomi': '.dk-ie:not(.dk-ie-skel)',
  'sinyal-pasar': ':is(.dk-sp, .dk-sp-umkm):not([aria-busy])',
  inti: '.dk-in:not([aria-busy])',
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
  // Pantau Merek and TenderPilot start the clock by themselves once per session: mark it as done (deterministic)
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem('gamada:pm:autoplay', '1')
      sessionStorage.setItem('gamada:tp:autoplay', '1')
    } catch {
      /* ignore */
    }
  })
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
