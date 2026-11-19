/**
 * Tahap 7 · 44 px hit targets at 390 px (plan docs/build/tahap7-plan.md §3.1 last bullet, §0.1 "Mobile + a11y").
 *
 * Every /demo/<slug> (default role, ID, 390×844 phone) plus /tur (opener) and the site pages. Candidates:
 * `button, a[href], [role=button], input, select` that are visible and not inert. A candidate whose box is smaller
 * than 44 px is measured again by elementFromPoint sampling from its centre outwards (1 px steps, ±30 px), so an
 * enlarged `::after` hit area (or padding on a wrapper label) counts. The test fails on any target whose effective
 * hit area is < 44 × 44 and that is not an exception below.
 *
 * Exceptions (WCAG 2.5.8): links inside running text (inline), elements covered by an overlay at their centre
 * (reported as "obscured", not measured), visually hidden inputs measured through their <label>.
 *
 * Fragments go to $T7_FRAG/targets/ and are merged into docs/build/tahap7-a11y.json (key "targets").
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { expect, test } from '../fixtures'
import { openDemo, closeGuide, SD_SLUGS, SLUGS } from '../tahap2/helpers'
import { open as openSite, PHONE } from '../tahap6/helpers'

/* eslint-disable @typescript-eslint/no-explicit-any */
type G = any

const FRAG = process.env.T7_FRAG ?? '.shots/t7-m/frag'
const OUT = 'docs/build/tahap7-a11y.json'
const SITE = ['/', '/ekosistem', '/ekosistem/satu-daerah', '/produk/sapa-warga', '/lab'] as const

interface Small {
  page: string
  tag: string
  name: string
  cls: string
  box: string
  hit: string
}

/** visible targets whose effective hit area is under `min` px (sampling through elementFromPoint) */
function measure(page: Page, min = 44): Promise<{ small: Small[]; obscured: number; checked: number }> {
  return page.evaluate((min) => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const out: Omit<Small, 'page'>[] = []
    let obscured = 0
    let checked = 0
    const els = [...document.querySelectorAll<HTMLElement>('button, a[href], [role="button"], input, select')]
    const seen = new Set<Element>()
    for (let el of els) {
      if (el.closest('[inert], [aria-hidden="true"]')) continue
      if (el instanceof HTMLInputElement && el.type === 'hidden') continue
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none') continue
      let r = el.getBoundingClientRect()
      // a visually hidden input (opacity 0 / clipped / 1 px) is hit through its label
      if (el instanceof HTMLInputElement && (Number(cs.opacity) === 0 || r.width <= 2 || r.height <= 2)) {
        const lab = el.closest('label') ?? (el.id ? document.querySelector<HTMLElement>(`label[for="${CSS.escape(el.id)}"]`) : null)
        if (!lab) continue
        el = lab
        r = el.getBoundingClientRect()
      }
      if (seen.has(el)) continue
      seen.add(el)
      if (r.width === 0 || r.height === 0) continue
      // inline links in running text are exempt (WCAG 2.5.8 inline exception)
      if (el.tagName === 'A' && cs.display === 'inline' && el.parentElement && /^(P|LI|SPAN|SMALL|DD|TD|FIGCAPTION|BLOCKQUOTE)$/.test(el.parentElement.tagName) && (el.parentElement.textContent ?? '').trim().length > (el.textContent ?? '').trim().length + 8) continue
      if (r.width >= min && r.height >= min) continue
      // bring it into view (the page or its scroller) before sampling
      if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) {
        el.scrollIntoView({ block: 'center', inline: 'center' })
        r = el.getBoundingClientRect()
        if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue
      }
      checked++
      const cx = Math.round(r.left + r.width / 2)
      const cy = Math.round(r.top + r.height / 2)
      const hits = (x: number, y: number): boolean => {
        if (x < 0 || y < 0 || x >= vw || y >= vh) return false
        const t = document.elementFromPoint(x, y)
        return !!t && (t === el || el.contains(t))
      }
      if (!hits(cx, cy)) {
        obscured++
        continue
      }
      const reach = (dx: number, dy: number): number => {
        let n = 0
        for (let i = 1; i <= 30; i++) {
          if (!hits(cx + dx * i, cy + dy * i)) break
          n = i
        }
        return n
      }
      const w = reach(-1, 0) + reach(1, 0) + 1
      const h = reach(0, -1) + reach(0, 1) + 1
      if (w >= min && h >= min) continue
      const name = (el.getAttribute('aria-label') ?? el.textContent ?? (el as HTMLInputElement).value ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)
      out.push({ tag: el.tagName.toLowerCase(), name, cls: (el.getAttribute('class') ?? '').split(/\s+/).slice(0, 3).join('.'), box: `${Math.round(r.width)}x${Math.round(r.height)}`, hit: `${w}x${h}` })
    }
    window.scrollTo(0, 0)
    return { small: out as Small[], obscured, checked }
  }, min)
}

function areaOf(path: string, cls: string): { area: string; hint: string } {
  const m = path.match(/^\/demo\/([a-z-]+)/)
  if (m) {
    const slug = m[1]!
    if (/(^|\.)dk-(topbar|shell|guide|toast|more|btn--quiet|iconbtn|seg|palette|region|role|clock|modebadge)/.test(cls)) return { area: 'P3', hint: 'src/demo-kit/shell/ · src/demo-kit/ui/' }
    return { area: (SD_SLUGS as readonly string[]).includes(slug) ? 'P1' : 'P2', hint: `src/demos/${slug}/ (or the kit component named in cls)` }
  }
  return { area: 'P4', hint: path.startsWith('/tur') ? 'src/demo-kit/tour/' : 'src/routes/ · src/pages/ · src/components/' }
}

function save(name: string, path: string, small: Small[]): void {
  mkdirSync(join(FRAG, 'targets'), { recursive: true })
  const rows = small.map((s) => ({ ...s, page: path, viewport: '390', ...areaOf(path, s.cls) }))
  writeFileSync(join(FRAG, 'targets', `${name.replace(/[^a-z0-9-]+/gi, '_')}.json`), JSON.stringify(rows))
}

/** merge every fragment (axe + targets) into docs/build/tahap7-a11y.json (same function in a11y.spec.ts) */
function mergeA11y(): void {
  const read = (dir: string): G[] => {
    try {
      return readdirSync(join(FRAG, dir)).filter((f) => f.endsWith('.json')).flatMap((f) => JSON.parse(readFileSync(join(FRAG, dir, f), 'utf8')) as G[])
    } catch {
      return []
    }
  }
  const axe = read('axe')
  const targets = read('targets')
  const count = (rows: G[], k: string) => rows.reduce((m: Record<string, number>, r) => ((m[r[k]] = (m[r[k]] ?? 0) + 1), m), {})
  const out = {
    generated: new Date().toISOString(),
    tool: 'axe-core via @axe-core/playwright, tags wcag2a wcag2aa wcag21aa; fail on serious + critical',
    exclusions: { selectors: ['.maplibregl-canvas'], contrastAccepted: {} },
    summary: {
      axe: { total: axe.length, byImpact: count(axe, 'impact'), byArea: count(axe.filter((r) => r.impact === 'serious' || r.impact === 'critical'), 'area'), byRule: count(axe, 'rule') },
      targets: { total: targets.length, byArea: count(targets, 'area') },
    },
    axe: axe.sort((a, b) => (a.area + a.impact + a.rule + a.page).localeCompare(b.area + b.impact + b.rule + b.page)),
    targets,
  }
  mkdirSync('docs/build', { recursive: true })
  writeFileSync(OUT, JSON.stringify(out, null, 1))
}

test.afterAll(() => mergeA11y())
test.use({ ...PHONE })
test.describe.configure({ timeout: 90_000 })

const fmt = (s: Small[]) => s.map((x) => `${x.tag}.${x.cls} "${x.name}" box ${x.box} hit ${x.hit}`)

for (const slug of SLUGS) {
  test(`44 px · demo ${slug} @390`, async ({ page }) => {
    await openDemo(page, slug)
    await closeGuide(page).catch(() => undefined)
    await page.waitForTimeout(500)
    const r = await measure(page)
    save(`demo-${slug}`, `/demo/${slug}`, r.small)
    expect.soft(fmt(r.small), `${r.checked} small boxes sampled, ${r.obscured} obscured`).toEqual([])
  })
}

for (const path of SITE) {
  test(`44 px · site ${path} @390`, async ({ page }) => {
    await openSite(page, path)
    await page.waitForTimeout(500)
    const r = await measure(page)
    save(`site-${path}`, path, r.small)
    expect.soft(fmt(r.small)).toEqual([])
  })
}

test('44 px · tour opener @390', async ({ page }) => {
  await page.goto('/tur?e2e=1&off=preloader')
  await page.waitForFunction(() => !!(window as G).__gamadaTour, null, { timeout: 30_000 })
  await page.waitForTimeout(500)
  const r = await measure(page)
  save('tour-opener', '/tur', r.small)
  expect.soft(fmt(r.small)).toEqual([])
})
