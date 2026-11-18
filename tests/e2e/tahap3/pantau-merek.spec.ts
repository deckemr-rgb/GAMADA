/**
 * Tahap 3 · P12 Pantau Merek (brief docs/build/tahap3-plan.md P12). Missions at 1440 and 390, the numbers that must
 * agree, ?focus= arrivals, chains C28 / C29, alive within 10 s, ID + EN drafts, owner approval, a no-dead-controls
 * crawl, phone layout, region switch and reduced motion. Opens `?controls=all` (not DEMO_READY yet); `autoplay=0`
 * keeps the world clock still except in the "alive" test.
 */
import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures'

const SLUG = 'pantau-merek'
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } as const
const noise = (e: string) => !/api\/ai|ERR_CONNECTION_REFUSED|ERR_FAILED|ERR_ABORTED|net::ERR_|tiles\.openfreemap|openfreemap\.org/.test(e)

type G = { world: { get(): any; status(): string }; emit(t: string, p: unknown, s: string, o?: unknown): any; settled(): Promise<void>; onEvent(t: string, f: (e: any) => void): () => void; clock: { get(): { minutes: number; running: boolean }; pause(): void; play(): void; setTime(t: number): void }; ensure(e: string): Promise<void> }

async function open(page: Page, o: { lang?: 'id' | 'en'; role?: string; extra?: string; autoplay?: boolean } = {}) {
  const q = new URLSearchParams({ controls: 'all', e2e: '1', off: 'preloader' })
  if (!o.autoplay) q.set('autoplay', '0')
  if (o.lang) q.set('lang', o.lang)
  if (o.role) q.set('role', o.role)
  await page.goto(`/demo/${SLUG}?${q.toString()}${o.extra ? `&${o.extra}` : ''}`)
  await page.waitForFunction(() => {
    const g = (window as unknown as { __gamada?: G }).__gamada
    return !!g && g.world.status() === 'ready'
  }, null, { timeout: 45_000 })
  await page.evaluate(() => (window as unknown as { __gamada: G }).__gamada.ensure('usaha-pintar'))
  await expect(page.locator('.dk-pm-pantauan, .dk-pm-reviews, .dk-pm-comp').first()).toBeVisible({ timeout: 20_000 })
  if (!o.autoplay) await page.evaluate(() => (window as unknown as { __gamada: G }).__gamada.clock.pause())
}
const W = <T,>(page: Page, expr: string): Promise<T> =>
  page.evaluate((x) => new Function('s', `return (${x})`)((window as unknown as { __gamada: G }).__gamada.world.get()) as T, expr)
const minutes = (page: Page) => page.evaluate(() => (window as unknown as { __gamada: G }).__gamada.clock.get().minutes)
const settled = (page: Page) => page.evaluate(() => (window as unknown as { __gamada: G }).__gamada.settled())
async function record(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __ev: { type: string; source: string; payload: any }[]; __gamada: G }
    w.__ev = []
    w.__gamada.onEvent('*', (e) => w.__ev.push({ type: e.type, source: e.source, payload: e.payload }))
  })
}
const events = (page: Page) => page.evaluate(() => (window as unknown as { __ev?: { type: string; source: string; payload: any }[] }).__ev ?? [])
const missions = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('gamada:demo:missions:pantau-merek') ?? '[]') as string[])
async function foldGuide(page: Page) {
  // phones: the guide sheet may cover the canvas; fold it
  const close = page.locator('.dk-guide:not([hidden])').getByRole('button', { name: /Tutup|Close/ }).first()
  if (await close.isVisible().catch(() => false)) await close.click()
}
async function tab(page: Page, name: RegExp) {
  await page.getByRole('tab', { name }).click()
}
/** "Lompat ke lonjakan": one click, the alert card is there */
async function jump(page: Page) {
  if (await page.locator('[data-pm="alert"]').isVisible()) return
  await page.locator('[data-pm="jump-spike"]').click()
  await settled(page)
  await expect(page.locator('[data-pm="alert"]')).toBeVisible({ timeout: 5_000 })
}

for (const size of ['1440', '390'] as const) {
  test.describe(`missions @${size}`, () => {
    if (size === '390') test.use(PHONE)
    test(`all four missions complete by script (${size})`, async ({ page, errors }) => {
      test.setTimeout(120_000)
      await open(page)
      await foldGuide(page)
      await record(page)
      await jump(page)
      // numbers agree: card meta = the one brandAlerts row
      const al = await W<{ id: string; at: number; volume: number; deltaPct: number }>(page, `Object.values(s.brandAlerts.byId)[0]`)
      expect(al.at).toBe(7 * 60 + 12)
      const hm = `${String(Math.floor(al.at / 60)).padStart(2, '0')}.${String(al.at % 60).padStart(2, '0')}`
      await expect(page.locator('[data-pm="alert-meta"]')).toContainText(hm)
      await expect(page.locator('[data-pm="alert-meta"]')).toContainText(`${al.volume} keluhan`)
      await expect(page.locator('[data-pm="alert-meta"]')).toContainText(`${al.deltaPct.toLocaleString('id-ID')}%`)
      // flood notice names the flood kecamatan (= Siaga Wilayah's alert)
      const kec = await W<string[]>(page, `Object.values(s.alerts.byId).filter((a) => a.kind === 'banjir' && a.status === 'aktif')[0].kecamatanIds.map((k) => s.region.kecamatan.find((x) => x.id === k).name)`)
      for (const k of kec) await expect(page.locator('[data-pm="flood-notice"]')).toContainText(k)
      const floodAt = await W<number>(page, `Object.values(s.alerts.byId).filter((a) => a.kind === 'banjir' && a.status === 'aktif')[0].at`)
      expect(floodAt).toBe(7 * 60 + 6)

      // mission 1: cluster → suggest → publish
      await page.locator('[data-pm="cluster"]').click()
      await expect(page.locator('.dk-pm-cl').first()).toBeVisible({ timeout: 10_000 })
      const nClusters = await page.locator('.dk-pm-cl').count()
      expect(nClusters).toBeGreaterThan(0)
      expect(nClusters).toBeLessThanOrEqual(6)
      await page.locator('[data-pm="announce-suggest"]').click()
      await expect(page.locator('[data-pm="announce-text"]')).toBeVisible({ timeout: 10_000 })
      for (const k of kec) await expect(page.locator('[data-pm="announce-text"]')).toContainText(k)
      await expect(page.locator('[data-pm="announce-text"]')).toContainText('1–2 hari')
      await page.locator('[data-pm="announce-publish"]').click()
      await expect(page.locator('[data-pm="announce-published"]')).toBeVisible()
      await settled(page)
      await page.keyboard.press('Escape')
      const ev1 = await events(page)
      expect(ev1.filter((e) => e.type === 'brand.announced' && e.source === SLUG)).toHaveLength(1)
      // C29: the notice reaches the Kasir (struk channel) and no burst mention lands after the notice
      const annId = ev1.find((e) => e.type === 'brand.announced')!.payload.id as string
      expect(await W<boolean>(page, `!!s.posNotices.byId['${annId}']`)).toBe(true)
      expect(await W<number>(page, `(() => { const a = Object.values(s.brandAnnouncements.byId)[0]; const al = s.brandAlerts.byId[a.alertId]; return Object.values(s.brandMentions.byId).filter((m) => m.cause === al.causeRef && m.sentiment === 'negatif' && m.brand === s.meta.shopId && m.at > a.at).length })()`)).toBe(0)
      await expect(page.locator('[data-pm="alert"]')).toHaveClass(/is-done/)
      // the shell's cross-product toast names Toko Autopilot (the Kasir receipt notice)
      await expect(page.locator('.dk-toasts').getByText(/Toko Autopilot/).first()).toBeAttached({ timeout: 5_000 })

      // mission 2: five replies at once
      await tab(page, /Ulasan/)
      const unrepliedBefore = Number(((await page.locator('.dk-pm-kpis').count()) ? 0 : 0))
      void unrepliedBefore
      await page.locator('[data-pm="select-alert-5"]').click()
      await expect(page.locator('.dk-pm-bulk-n')).toContainText('5')
      await page.locator('[data-pm="bulk-open"]').click()
      await expect(page.locator('[data-pm="draft"]')).toHaveCount(5, { timeout: 5_000 })
      const before = await page.locator('[data-pm="draft"]').allTextContents()
      await page.locator('[data-pm="tone-formal"]').click()
      await expect(page.locator('[data-pm="draft"]')).toHaveCount(5, { timeout: 5_000 })
      const after = await page.locator('[data-pm="draft"]').allTextContents()
      expect(after.join('|')).not.toBe(before.join('|'))
      // 5 drafts never share a sentence, each names its own item / order / handle
      // (fragments after abbreviations such as "Yth." / "Kec." are not sentences)
      const sentences = after.flatMap((d) => d.split(String.fromCharCode(10))[0]!.split(/(?<=[.!?])\s+/)).filter((x) => x.length >= 15)
      expect(sentences.filter((x, i) => sentences.indexOf(x) !== i)).toEqual([])
      const picked = await page.evaluate(() => [...document.querySelectorAll('.dk-pm-draft')].map((el) => (el as HTMLElement).dataset.id!))
      for (const [i, id] of picked.entries()) {
        const m = await W<{ author: string; orderCode?: string; item?: string }>(page, `s.brandMentions.byId['${id}']`)
        expect(after[i]).toContain(`@${m.author}`)
        if (m.orderCode) expect(after[i]).toContain(m.orderCode)
        else if (m.item) expect(after[i]).toContain(m.item)
      }
      await page.locator('[data-pm="bulk-send"]').dblclick()
      await settled(page)
      const ev2 = await events(page)
      const rep = ev2.filter((e) => e.type === 'brand.replied' && e.source === SLUG)
      expect(rep).toHaveLength(1)
      expect(rep[0]!.payload.mentionIds).toHaveLength(5)
      await page.getByRole('button', { name: /Sudah dibalas/ }).click()
      for (const id of rep[0]!.payload.mentionIds as string[]) await expect(page.locator(`.dk-pm-rv[data-id="${id}"] [data-pm="reply"]`)).toHaveCount(1)

      // mission 3: competitor metric
      await tab(page, /Kompetitor/)
      await page.getByRole('radio', { name: 'Waktu balas' }).click()
      await expect(page.locator('[data-pm="cmp-reply"]')).toBeVisible()
      // numbers agree: KPI reputation = Kompetitor own row
      const compRep = (await page.locator('[data-pm="comp-rep"]').textContent())!.trim()
      await tab(page, /Pantauan/)
      await expect(page.locator('.dk-pm-kpis .dk-kpi').first()).toContainText(compRep)

      // mission 4: look ahead until the score is back up
      for (let i = 0; i < 6 && !(await missions(page)).includes('pulih'); i++) {
        await page.locator('[data-pm="ahead30"]').click()
        await settled(page)
        await page.waitForTimeout(300)
      }
      // C29 follow-ups: an author answers the reply
      expect(await W<number>(page, `Object.values(s.brandMentions.byId).filter((m) => m.inReplyTo && m.at <= ${await minutes(page)}).length`)).toBeGreaterThan(0)
      await expect.poll(() => missions(page)).toEqual(expect.arrayContaining(['lonjakan', 'balas5', 'kompetitor', 'pulih']))
      await expect(page.getByText(/Lanjut ke produk terkait/).first()).toBeAttached({ timeout: 10_000 })
      expect(errors.filter(noise)).toEqual([])
    })
  })
}

test('alive within 10 s: the clock runs and a new mention lands on the first screen', async ({ page, errors }) => {
  await open(page, { autoplay: true })
  const first = await page.locator('.dk-pm-mlist > li').first().getAttribute('data-id')
  await expect.poll(() => minutes(page), { timeout: 10_000 }).toBeGreaterThan(7 * 60)
  await expect.poll(async () => page.locator('.dk-pm-mlist > li').first().getAttribute('data-id'), { timeout: 10_000 }).not.toBe(first)
  expect(errors.filter(noise)).toEqual([])
})

test('hands-off: flood 07.06 by autoplay and the alert by 07.13, crossing minute 07.12', async ({ page }) => {
  await open(page)
  await page.evaluate(() => (window as unknown as { __gamada: G }).__gamada.clock.setTime(7 * 60 + 5))
  await page.evaluate(() => (window as unknown as { __gamada: G }).__gamada.clock.play())
  await page.evaluate(() => {
    const c = (window as unknown as { __gamada: G }).__gamada.clock as unknown as { setSpeed(n: number): void }
    c.setSpeed(60)
  })
  await expect(page.locator('[data-pm="flood-notice"]')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('[data-pm="alert"]')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('[data-pm="alert-meta"]')).toContainText('07.12')
  expect(await W<number>(page, 's.brandAlerts.ids.length')).toBe(1)
})

test('C28: flood.alert emitted by Siaga Wilayah ⇒ the alert card ≤ 1 s after its crossing minute', async ({ page }) => {
  await open(page)
  await page.evaluate(async () => {
    const g = (window as unknown as { __gamada: G }).__gamada
    const s = g.world.get()
    g.clock.setTime(7 * 60 + 6)
    g.emit('flood.alert', { level: 3, kecamatanIds: s.region.floodKecamatanIds, riverId: null }, 'siaga-wilayah')
    await g.settled()
    g.clock.setTime(7 * 60 + 13)
  })
  await expect(page.locator('[data-pm="alert"]')).toBeVisible({ timeout: 1_000 })
})

test('?focus= arrivals: alert, mention, announcement, unknown id', async ({ page }) => {
  test.setTimeout(90_000)
  await open(page)
  await jump(page)
  await page.locator('[data-pm="cluster"]').click()
  await page.locator('[data-pm="announce-suggest"]').click({ timeout: 10_000 })
  await page.locator('[data-pm="announce-publish"]').click({ timeout: 10_000 })
  await settled(page)
  await page.waitForTimeout(800)
  const ids = await W<{ a: string; n: string; m: string }>(page, `({ a: s.brandAlerts.ids[0], n: s.brandAnnouncements.ids[0], m: Object.values(s.brandMentions.byId).filter((m) => m.brand === s.meta.shopId && m.sentiment === 'negatif' && m.repliedAt == null && m.at <= 433).sort((x, y) => y.at - x.at)[0].id })`)
  await open(page, { extra: `focus=${ids.a}` })
  await expect(page.locator(`[data-pm="alert"][data-id="${ids.a}"]`)).toBeVisible()
  await open(page, { extra: `focus=${ids.m}` })
  await expect(page.getByRole('tab', { name: /Ulasan/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator(`.dk-pm-rv[data-id="${ids.m}"]`)).toHaveClass(/is-on/)
  await open(page, { extra: `focus=${ids.n}` })
  await expect(page.locator(`[data-pm="announce-published"][data-id="${ids.n}"]`)).toBeVisible()
  await open(page, { extra: 'focus=BA-9999' })
  await expect(page.getByText('Data tidak ditemukan').first()).toBeVisible()
  await expect(page.getByRole('tab', { name: /Pantauan/ })).toHaveAttribute('aria-selected', 'true')
})

test('EN: an English review gets an English draft; UI strings in English', async ({ page, errors }) => {
  await open(page, { lang: 'en' })
  await jump(page)
  await expect(page.locator('[data-pm="alert"]')).toContainText('Spike in delivery complaints')
  await tab(page, /Reviews/)
  await page.locator('[data-pm="select-alert-5"]').click()
  await page.locator('[data-pm="bulk-open"]').click()
  await expect(page.locator('[data-pm="draft"]')).toHaveCount(5, { timeout: 5_000 })
  const enId = await W<string | null>(page, `(Object.values(s.brandMentions.byId).find((m) => m.lang === 'en' && m.at <= 433) || {}).id || null`)
  if (enId) {
    const d = page.locator(`.dk-pm-draft[data-id="${enId}"] [data-pm="draft"]`)
    if (await d.count()) {
      await expect(d).toHaveAttribute('lang', 'en')
      await expect(d).not.toContainText('Mohon')
    }
  }
  expect(errors.filter(noise)).toEqual([])
})

test('owner: band numbers, gratis ongkir needs the owner, approval publishes', async ({ page, errors }) => {
  await open(page)
  await jump(page)
  await page.locator('[data-pm="cluster"]').click()
  await page.locator('[data-pm="announce-suggest"]').click({ timeout: 10_000 })
  await expect(page.locator('[data-pm="announce-text"]')).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: 'Gratis ongkir' }).click()
  await expect(page.locator('[data-pm="announce-publish"]')).toBeDisabled()
  await expect(page.getByText('Gratis ongkir perlu persetujuan pemilik.')).toBeVisible()
  await page.locator('[data-pm="ask-owner"]').click()
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-pm="owner-band"]')).toBeVisible({ timeout: 10_000 })
  const aff = await W<number>(page, `new Set(Object.values(s.brandMentions.byId).filter((m) => m.cause === Object.values(s.brandAlerts.byId)[0].causeRef && m.orderCode && m.brand === s.meta.shopId && m.at <= ${await minutes(page)}).map((m) => m.orderCode)).size`)
  await expect(page.locator('[data-pm="owner-orders"]')).toContainText(`Pesanan terdampak banjir: ${aff}`)
  const score = Number(/(\d+)\/100/.exec((await page.locator('[data-pm="owner-score"]').textContent()) ?? '')?.[1])
  await expect(page.locator('.dk-pm-kpis .dk-kpi-val').first()).toContainText(String(score))
  await page.locator('[data-pm="owner-approve"]').click()
  await page.locator('[data-pm="announce-publish"]').click({ timeout: 10_000 })
  await settled(page)
  expect(await W<string | null>(page, `Object.values(s.brandAnnouncements.byId)[0]?.offer ?? null`)).toBe('gratis-ongkir')
  expect(errors.filter(noise)).toEqual([])
})

test('no dead controls: every enabled control on each tab changes something', async ({ page }) => {
  test.setTimeout(120_000)
  await open(page)
  await jump(page)
  const sig = () =>
    page.evaluate(() => {
      const g = (window as unknown as { __gamada: G }).__gamada
      const root = document.querySelector('.dk-pm')!
      return `${location.href}|${g.clock.get().minutes}|${g.world.get().events?.length ?? ''}|${root.innerHTML.length}|${document.querySelectorAll('.dk-ov, [role=dialog]').length}|${document.activeElement?.getAttribute('aria-pressed') ?? ''}|${root.querySelectorAll('[aria-pressed=true], [aria-checked=true], [aria-selected=true], :checked').length}`
    })
  for (const t of [/Pantauan/, /Ulasan/, /Kompetitor/]) {
    await tab(page, t)
    await page.waitForTimeout(400)
    const n = await page.locator('.dk-pm-body button:enabled:visible, .dk-pm-body input:enabled:visible').count()
    for (let i = 0; i < Math.min(n, 30); i++) {
      const el = page.locator('.dk-pm-body button:enabled:visible, .dk-pm-body input:enabled:visible').nth(i)
      if (!(await el.isVisible().catch(() => false))) continue
      const pm = (await el.getAttribute('data-pm')) ?? ''
      // a single-choice option that is already the choice is a no-op by design (radio / current chip)
      if ((await el.getAttribute('aria-checked')) === 'true' || (await el.getAttribute('aria-current')) === 'true' || (await el.getAttribute('aria-selected')) === 'true') continue
      if (/to-siaga|to-toko|announce-publish|bulk-send|ask-owner/.test(pm)) continue
      const name = pm || ((await el.textContent({ timeout: 1_000 }).catch(() => '')) ?? '').trim()
      const a = await sig()
      await el.click({ timeout: 3_000 }).catch(() => undefined)
      // (a lazy sheet needs its chunk first)
      await page.waitForTimeout(800)
      const b = await sig()
      expect(b, `control #${i} (${name}) on ${t}`).not.toBe(a)
      if (await page.locator('.dk-ov').count()) await page.keyboard.press('Escape')
      await page.waitForTimeout(150)
    }
  }
})

test.describe('phone 360–430', () => {
  test.use(PHONE)
  test('no horizontal scroll on any tab; 44 px targets; guide pill visible', async ({ page }) => {
    for (const w of [360, 390, 430]) {
      await page.setViewportSize({ width: w, height: 844 })
      await open(page)
      await jump(page)
      for (const t of [/Pantauan/, /Ulasan/, /Kompetitor/]) {
        await tab(page, t)
        await page.waitForTimeout(400)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        const small = await page.evaluate(() =>
          [...document.querySelectorAll('.dk-pm-body button, .dk-pm-body label.dk-pm-rv-check')]
            .filter((el) => (el as HTMLElement).offsetParent)
            .map((el) => ({ h: el.getBoundingClientRect().height, t: (el.textContent ?? '').trim().slice(0, 30) }))
            .filter((r) => r.h > 0 && r.h < 43.5),
        )
        expect(small, `small targets on ${t} @${w}`).toEqual([])
      }
      await expect(page.locator('.dk-mpill, .dk-guide-pill, [class*="mpill"]').first()).toBeVisible()
    }
  })
})

// Region switch: only the Bojonegoro pack exists in this build (Bandung / Padang packs are Tahap 7); every name on
// screen comes from the world (shop, kecamatan, desa, market), none is typed in the product.

test('static=1 and off=demoAnimations: every tab renders without errors', async ({ page, errors }) => {
  for (const x of ['static=1', 'off=demoAnimations']) {
    await open(page, { extra: x })
    await jump(page)
    for (const t of [/Ulasan/, /Kompetitor/, /Pantauan/]) {
      await tab(page, t)
      await expect(page.locator('.dk-pm-body').first()).toBeVisible()
    }
  }
  expect(errors.filter(noise)).toEqual([])
})

test('reduced motion: final states render, no autoplay, static hint', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page, { autoplay: true })
  await page.waitForTimeout(2_000)
  expect((await page.evaluate(() => (window as unknown as { __gamada: G }).__gamada.clock.get().running))).toBe(false)
  await expect(page.getByText('Jalankan jam untuk melihat sebutan baru masuk.')).toBeVisible()
  await jump(page)
  await expect(page.locator('[data-pm="alert"]')).toBeVisible()
})
