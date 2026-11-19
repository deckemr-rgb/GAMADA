/**
 * Shared helpers for tests/e2e/tahap6/*.spec.ts (plan §6). Builders import from here; integrator owns the file.
 * Console-error collection + settle() stay in ../fixtures.ts.
 */
import type { Page } from '@playwright/test'
import { settle } from '../fixtures'

export const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } as const
export const WIDTHS = [360, 390, 430, 768, 1440] as const

/** Open a site page quietly: no preloader, optional language, settled. */
export async function open(page: Page, path: string, opts: { lang?: 'id' | 'en'; query?: string } = {}): Promise<void> {
  const u = new URL(path, 'http://x')
  u.searchParams.set('off', ['preloader', u.searchParams.get('off')].filter(Boolean).join(','))
  if (opts.lang === 'en') u.searchParams.set('lang', 'en')
  if (opts.query) for (const [k, v] of new URLSearchParams(opts.query)) u.searchParams.set(k, v)
  await page.goto(u.pathname + u.search + u.hash)
  await settle(page)
}

export const noHScroll = (page: Page): Promise<boolean> =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)

/** Visible buttons / links smaller than `min` px in either dimension (list exceptions in the spec). */
export function smallTargets(page: Page, min = 44, scope = 'main'): Promise<string[]> {
  return page.evaluate(
    ([min, scope]) => {
      const out: string[] = []
      const root = document.querySelector(scope as string) ?? document.body
      for (const el of root.querySelectorAll<HTMLElement>('a[href], button, [role="button"]')) {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) continue
        if (r.width < (min as number) || r.height < (min as number)) {
          out.push(`${el.tagName.toLowerCase()} "${(el.textContent ?? el.getAttribute('aria-label') ?? '').trim().slice(0, 40)}" ${Math.round(r.width)}×${Math.round(r.height)}`)
        }
      }
      return out
    },
    [min, scope] as const,
  )
}

/** Same-origin hrefs (path + search + hash) of every link under `scope`, unique. */
export function sameOriginLinks(page: Page, scope = 'body'): Promise<string[]> {
  return page.evaluate((scope) => {
    const set = new Set<string>()
    for (const a of document.querySelectorAll<HTMLAnchorElement>(`${scope} a[href]`)) {
      const u = new URL(a.href, location.href)
      if (u.origin === location.origin) set.add(u.pathname + u.search + u.hash)
    }
    return [...set]
  }, scope)
}
