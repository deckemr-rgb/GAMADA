/**
 * Tahap 7 · axe (plan docs/build/tahap7-plan.md §3.1, measurer M).
 *
 * AxeBuilder with wcag2a + wcag2aa + wcag21aa on every /demo/<slug> (default role, 1440 + 390, alive state: the world
 * clock runs and the first world event has landed), one demo per eco in EN, the tour (opener, chapter 7, summary) and
 * the site pages (/, /ekosistem, /ekosistem/satu-daerah, /produk/sapa-warga, /lab) at 1440 + 390. Every violation is
 * reported; the test fails on serious + critical only.
 *
 * Known exclusions (documented here, not silenced globally): the MapLibre canvas (`.maplibregl-canvas`, a WebGL
 * surface axe cannot read). Decorative SVG with aria-hidden is skipped by axe itself. Accepted contrast exceptions
 * (simulated glare / disabled control with a visible reason) are listed per selector in CONTRAST_OK.
 *
 * Each test writes a fragment to $T7_FRAG/axe/ (default .shots/t7-m/frag); every worker's afterAll merges all
 * fragments (axe + targets) into docs/build/tahap7-a11y.json.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '../fixtures'
import { openDemo, ROOT, SD_SLUGS, SLUGS, type Slug } from '../tahap2/helpers'
import { open as openSite, PHONE } from '../tahap6/helpers'

/* eslint-disable @typescript-eslint/no-explicit-any */
type G = any

const FRAG = process.env.T7_FRAG ?? '.shots/t7-m/frag'
const OUT = 'docs/build/tahap7-a11y.json'
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa']
const EXCLUDE = ['.maplibregl-canvas']
/** accepted color-contrast exceptions: selector substring → reason (none accepted yet) */
const CONTRAST_OK: Record<string, string> = {}

const SITE = ['/', '/ekosistem', '/ekosistem/satu-daerah', '/produk/sapa-warga', '/lab'] as const
/** one demo per eco in EN (+ Inti) */
const EN_DEMOS: Slug[] = ['sapa-warga', 'toko-autopilot', 'sinyal-pasar', 'inti']

export interface AxeRow {
  rule: string
  impact: string
  page: string
  viewport: string
  lang: string
  selector: string
  html: string
  area: 'P1' | 'P2' | 'P3' | 'P4'
  hint: string
  help: string
  summary: string
}

/** owner area of one node: product root → P1 (Satu Daerah) / P2 (Usaha + Pasar + Inti); tour → P4; demo shell → P3; site → P4 */
async function areaOf(page: Page, selectors: string[], path: string): Promise<{ area: AxeRow['area']; hint: string }[]> {
  const roots = SLUGS.map((s) => [s, ROOT[s].replace(/:not\((?:[^()]|\([^()]*\))*\)/g, '').replace(/\[[^\]]*\]$/, '')] as const)
  return page.evaluate(
    ({ selectors, roots, sd, path }) =>
      selectors.map((sel) => {
        let el: Element | null = null
        try {
          el = document.querySelector(sel)
        } catch {
          el = null
        }
        const isDemo = path.startsWith('/demo/')
        const isTour = path.startsWith('/tur')
        if (el) {
          for (const [slug, root] of roots) {
            if (root && el.closest(root)) return { area: (sd.includes(slug) ? 'P1' : 'P2') as 'P1' | 'P2', hint: `src/demos/${slug}/` }
          }
          if (el.closest('[class*="dk-tour"]')) return { area: 'P4' as const, hint: 'src/demo-kit/tour/' }
        }
        if (isTour) return { area: 'P4' as const, hint: 'src/demo-kit/tour/ (or shell: src/demo-kit/shell/)' }
        if (isDemo) {
          const k = el?.closest('.dk-topbar') ? 'shell/TopBar.tsx' : el?.closest('.dk-guide') ? 'shell (guide)' : el?.closest('.dk-toast, .dk-toasts') ? 'ui (toast)' : 'shell/ or ui/'
          return { area: 'P3' as const, hint: `src/demo-kit/${k}` }
        }
        return { area: 'P4' as const, hint: el?.closest('header, nav, footer') ? 'src/components/ (Navbar/Footer)' : 'src/routes/ · src/pages/' }
      }),
    { selectors, roots: roots as unknown as [string, string][], sd: SD_SLUGS as unknown as string[], path },
  )
}

async function scan(page: Page, label: { page: string; viewport: string; lang: string }): Promise<AxeRow[]> {
  let b = new AxeBuilder({ page }).withTags(TAGS)
  for (const x of EXCLUDE) b = b.exclude(x)
  const res = await b.analyze()
  const rows: AxeRow[] = []
  for (const v of res.violations) {
    const sels = v.nodes.map((n) => String(n.target[n.target.length - 1] ?? n.target[0]))
    const areas = await areaOf(page, sels, label.page.split('?')[0]!)
    v.nodes.forEach((n, i) => {
      const selector = n.target.map(String).join(' >>> ')
      if (v.id === 'color-contrast' && Object.keys(CONTRAST_OK).some((k) => selector.includes(k))) return
      rows.push({
        rule: v.id,
        impact: v.impact ?? 'minor',
        ...label,
        selector,
        html: n.html.slice(0, 160),
        area: areas[i]!.area,
        hint: areas[i]!.hint,
        help: v.help,
        summary: (n.failureSummary ?? '').split('\n').slice(0, 2).join(' ').slice(0, 220),
      })
    })
  }
  return rows
}

function save(name: string, rows: AxeRow[]): void {
  mkdirSync(join(FRAG, 'axe'), { recursive: true })
  writeFileSync(join(FRAG, 'axe', `${name.replace(/[^a-z0-9-]+/gi, '_')}.json`), JSON.stringify(rows))
}

/** merge every fragment (axe + targets) into docs/build/tahap7-a11y.json (same function in targets.spec.ts) */
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
    exclusions: { selectors: EXCLUDE, contrastAccepted: CONTRAST_OK },
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

/** alive state: clock running, wait for the first world event (≤ 10 s) */
async function alive(page: Page): Promise<void> {
  await page
    .evaluate(
      () =>
        new Promise<void>((res) => {
          const g = (window as G).__gamada
          const off = g.onEvent('*', () => {
            off?.()
            res()
          })
          setTimeout(res, 10_000)
        }),
    )
    .catch(() => undefined)
  await page.waitForTimeout(600)
}

function check(rows: AxeRow[]): void {
  const bad = rows.filter((r) => r.impact === 'serious' || r.impact === 'critical').map((r) => `${r.impact} ${r.rule} ${r.selector}`)
  expect.soft(bad, 'serious + critical axe violations').toEqual([])
}

test.describe.configure({ timeout: 90_000 })

for (const vp of ['1440', '390'] as const) {
  test.describe(`axe @${vp}`, () => {
    if (vp === '390') test.use({ ...PHONE })

    for (const slug of SLUGS) {
      test(`demo ${slug} @${vp}`, async ({ page }) => {
        await openDemo(page, slug, { run: true })
        await alive(page)
        const rows = await scan(page, { page: `/demo/${slug}`, viewport: vp, lang: 'id' })
        save(`demo-${slug}-${vp}-id`, rows)
        check(rows)
      })
    }

    for (const path of SITE) {
      test(`site ${path} @${vp}`, async ({ page }) => {
        await openSite(page, path)
        await page.waitForTimeout(800)
        const rows = await scan(page, { page: path, viewport: vp, lang: 'id' })
        save(`site-${path}-${vp}`, rows)
        check(rows)
      })
    }

    test(`tour opener @${vp}`, async ({ page }) => {
      await page.goto('/tur?e2e=1&off=preloader')
      await page.waitForFunction(() => !!(window as G).__gamadaTour, null, { timeout: 30_000 })
      await page.waitForTimeout(800)
      const rows = await scan(page, { page: '/tur', viewport: vp, lang: 'id' })
      save(`tour-opener-${vp}`, rows)
      check(rows)
    })

    test(`tour chapter 7 @${vp}`, async ({ page }) => {
      await page.goto('/tur/7?e2e=1&off=preloader')
      await page.waitForFunction(() => !!(window as G).__gamadaTour, null, { timeout: 30_000 })
      await page.locator('[data-tour-ctl="play-chapter"]').click()
      await page.waitForFunction(() => { const s = (window as G).__gamadaTour?.state; return s && s.n === 7 && s.phase === 'player' && !s.busy }, null, { timeout: 60_000, polling: 200 })
      await page.waitForTimeout(1500)
      await page.evaluate(() => (window as G).__gamadaTour.engine?.pause?.())
      const rows = await scan(page, { page: '/tur/7', viewport: vp, lang: 'id' })
      save(`tour-ch7-${vp}`, rows)
      check(rows)
    })

    test(`tour summary @${vp}`, async ({ page }) => {
      test.setTimeout(150_000)
      await page.goto('/tur/20?e2e=1&off=preloader&rate=8')
      await page.waitForFunction(() => !!(window as G).__gamadaTour, null, { timeout: 30_000 })
      await page.locator('[data-tour-ctl="play-chapter"]').click()
      await page.waitForFunction(() => (window as G).__gamadaTour?.state.phase === 'summary', null, { timeout: 120_000, polling: 300 })
      await page.waitForTimeout(1500)
      const rows = await scan(page, { page: '/tur (summary)', viewport: vp, lang: 'id' })
      save(`tour-summary-${vp}`, rows)
      check(rows)
    })
  })
}

test.describe('axe EN @1440', () => {
  for (const slug of EN_DEMOS) {
    test(`demo ${slug} EN @1440`, async ({ page }) => {
      await openDemo(page, slug, { run: true, lang: 'en' })
      await alive(page)
      const rows = await scan(page, { page: `/demo/${slug}`, viewport: '1440', lang: 'en' })
      save(`demo-${slug}-1440-en`, rows)
      check(rows)
    })
  }
})
