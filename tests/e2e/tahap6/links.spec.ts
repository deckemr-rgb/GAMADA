/**
 * Tahap 6 · link crawl (plan §6.3, integrator). Source pages: home, /ekosistem, the 4 eco pages, the 17 product
 * pages, /lab, /karya, plus the open navbar dropdowns (desktop), the open mobile menu (390 px) and the footer.
 * Every same-origin a[href] is visited once per test: the route must not be the 404 page and, when the link has a
 * hash, the element with that id must exist after the page settles. External links: wa.me must carry `text=`,
 * mailto: is allowed, anything else is listed as a failure. Failures list every dead link with its source page.
 * Also: every redirect of spec §4 (with its anchor) lands on a real page with the anchor present.
 */
import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures'
import { PRODUCT_SLUGS } from '../../../src/content/products'
import { open, PHONE } from './helpers'

const ECOS = ['satu-daerah', 'usaha-pintar', 'pasar-daerah', 'inti']
const PRODUCTS = PRODUCT_SLUGS.filter((s) => s !== 'inti').map((s) => `/produk/${s}`)

type Found = Map<string, string> // target (path + search + hash) → first source page

async function collect(page: Page, source: string, found: Found, external: Found, scope = 'body'): Promise<void> {
  const hrefs = await page.evaluate((scope) => [...document.querySelectorAll<HTMLAnchorElement>(`${scope} a[href]`)].map((a) => a.href), scope)
  for (const h of hrefs) {
    const u = new URL(h)
    if (u.protocol === 'mailto:' || u.protocol === 'tel:') continue
    if (u.origin === new URL(page.url()).origin) {
      const key = u.pathname + u.search + u.hash
      if (!found.has(key)) found.set(key, source)
    } else if (!external.has(h)) external.set(h, source)
  }
}

async function visitPage(page: Page, path: string, found: Found, external: Found): Promise<void> {
  await open(page, path)
  // product pages render their sections (and anchors such as #kasir) once copy.ts arrives
  if (path.startsWith('/produk/')) await page.locator('[data-copy="ready"]').waitFor({ state: 'attached', timeout: 15_000 })
  await collect(page, path, found, external)
}

/** Visit every collected target; return the dead ones as "target  (from source): reason". */
async function check(page: Page, found: Found, external: Found): Promise<string[]> {
  const dead: string[] = []
  for (const [h, src] of external) {
    const u = new URL(h)
    if (u.hostname === 'wa.me') {
      if (!u.searchParams.get('text')) dead.push(`${h}  (from ${src}): wa.me link without text=`)
    } else dead.push(`${h}  (from ${src}): external link outside wa.me`)
  }
  // one visit per path+search; all hashes of that page checked on the same visit
  const byPage = new Map<string, { hashes: Set<string>; src: string }>()
  for (const [key, src] of found) {
    const u = new URL(key, 'http://x')
    const k = u.pathname + u.search
    const e = byPage.get(k) ?? { hashes: new Set<string>(), src }
    if (u.hash) e.hashes.add(decodeURIComponent(u.hash.slice(1)))
    byPage.set(k, e)
  }
  for (const [k, { hashes, src }] of byPage) {
    const sep = k.includes('?') ? '&' : '?'
    try {
      await page.goto(`${k}${sep}off=preloader`)
      await page.locator('main, [role="main"]').first().waitFor({ state: 'attached', timeout: 15_000 })
      await page.locator('main h1, main h2, [role="main"] h1').first().waitFor({ state: 'attached', timeout: 15_000 }).catch(() => undefined)
      const title = await page.title()
      if (/^404/.test(title)) {
        dead.push(`${k}  (from ${src}): 404`)
        continue
      }
      for (const id of hashes) {
        const ok = await page
          .waitForFunction((id) => !!document.getElementById(id), id, { timeout: 15_000 })
          .then(() => true)
          .catch(() => false)
        if (!ok) dead.push(`${k}#${id}  (from ${src}): no element with id "${id}"`)
      }
    } catch (e) {
      dead.push(`${k}  (from ${src}): ${String(e).slice(0, 120)}`)
    }
  }
  return dead
}

test.describe.configure({ timeout: 360_000 })

test('home, navbar dropdowns and footer: no dead links', async ({ page }) => {
  const found: Found = new Map()
  const external: Found = new Map()
  await open(page, '/')
  // open each desktop dropdown (hover) so its panel links are the ones a visitor reaches
  for (const drop of await page.locator('.gnav-nav [data-drop]').all()) {
    await drop.hover()
    await page.waitForTimeout(250)
    await collect(page, '/ (navbar dropdown)', found, external, '.gnav-nav')
  }
  await collect(page, '/ (footer)', found, external, 'footer')
  await collect(page, '/', found, external)
  expect(found.has('/ekosistem')).toBe(true)
  const dead = await check(page, found, external)
  expect(dead, dead.join('\n')).toEqual([])
})

test.describe('mobile menu (390 px)', () => {
  test.use(PHONE)
  test('every link in the open mobile menu resolves', async ({ page }) => {
    const found: Found = new Map()
    const external: Found = new Map()
    await open(page, '/karya')
    await page.locator('.gnav-toggle').click()
    await expect(page.locator('.gnav-menu')).toHaveAttribute('data-open', 'true')
    await collect(page, '/karya (mobile menu)', found, external, '.gnav-menu')
    expect(found.size).toBeGreaterThan(8)
    await page.keyboard.press('Escape')
    const dead = await check(page, found, external)
    expect(dead, dead.join('\n')).toEqual([])
  })
})

test('/ekosistem, the eco pages, /lab and /karya: no dead links', async ({ page }) => {
  const found: Found = new Map()
  const external: Found = new Map()
  for (const p of ['/ekosistem', ...ECOS.map((e) => `/ekosistem/${e}`), '/lab', '/karya']) await visitPage(page, p, found, external)
  const dead = await check(page, found, external)
  expect(dead, dead.join('\n')).toEqual([])
})

const half = Math.ceil(PRODUCTS.length / 2)
for (const [i, group] of [PRODUCTS.slice(0, half), PRODUCTS.slice(half)].entries()) {
  test(`product pages (group ${i + 1}): no dead links`, async ({ page }) => {
    const found: Found = new Map()
    const external: Found = new Map()
    for (const p of group) await visitPage(page, p, found, external)
    const dead = await check(page, found, external)
    expect(dead, dead.join('\n')).toEqual([])
  })
}

// spec §4 redirects, each landing on a real page (and its anchor)
const REDIRECTS: Array<[from: string, path: string, extra: { hash?: string; q?: [string, string] }]> = [
  ['/karya/kasirku', '/produk/toko-autopilot', { hash: 'kasir' }],
  ['/karya/scrappulse', '/produk/radar-isu', { hash: 'analisis' }],
  ['/produk/inti', '/ekosistem/inti', {}],
  ['/tools', '/lab', {}],
  ['/tools?eco=usaha-pintar', '/lab', { q: ['eco', 'usaha-pintar'] }],
  ['/tools/scrappulse', '/demo/radar-isu', { q: ['tab', 'analisis'] }],
]
for (const [from, path, { hash, q }] of REDIRECTS) {
  test(`redirect ${from} → ${path}${q ? `?${q[0]}=${q[1]}` : ''}${hash ? `#${hash}` : ''}`, async ({ page, errors }) => {
    await page.goto(from)
    await expect(page).toHaveURL((u) => u.pathname === path && (!hash || u.hash === `#${hash}`) && (!q || u.searchParams.get(q[0]) === q[1]))
    await expect(page.locator('main, [role="main"]').first()).toBeAttached()
    await expect(page).not.toHaveTitle(/^404/)
    if (hash) await expect(page.locator(`#${hash}`)).toBeAttached({ timeout: 15_000 })
    expect(errors).toEqual([])
  })
}
