/**
 * Kenal Mitra (P11) — missions at 1440 and 390, the numbers that must agree, ?focus= arrivals, chains C26 / C27 /
 * L2, the bank role round trip, alive within 10 s, reduced motion + static, and a no-dead-controls crawl per tab.
 * Plan: docs/build/tahap3-plan.md §2 P11. Opens `/demo/kenal-mitra?controls=all` (not DEMO_READY yet).
 */
import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures'

test.describe.configure({ timeout: 120_000 })

const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } as const
const noise = (e: string) => !/api\/ai|ERR_CONNECTION_REFUSED|ERR_FAILED|ERR_ABORTED|openfreemap|eox\.at|net::ERR_|Failed to load resource/.test(e)

async function open(page: Page, q = '', o: { run?: boolean; root?: string } = {}): Promise<void> {
  await page.goto(`/demo/kenal-mitra?controls=all&e2e=1&off=preloader${q ? `&${q}` : ''}`)
  await page.waitForFunction(() => (window as unknown as { __gamada?: { world: { status(): string } } }).__gamada?.world.status() === 'ready', null, { timeout: 60_000 })
  await page.evaluate(() => (window as unknown as { __gamada: { ensure(e: string): Promise<void> } }).__gamada.ensure('usaha-pintar'))
  await expect(page.locator(o.root ?? '.dk-km-tabs').first()).toBeVisible({ timeout: 30_000 })
  if (!o.run) await page.evaluate(() => (window as unknown as { __gamada: { clock: { pause(): void } } }).__gamada.clock.pause())
}
const W = <T>(page: Page, expr: string): Promise<T> =>
  page.evaluate((x) => new Function('s', `return (${x})`)((window as unknown as { __gamada: { world: { get(): unknown } } }).__gamada.world.get()) as T, expr)
async function emit(page: Page, type: string, payload: unknown, source: string): Promise<void> {
  await page.evaluate(
    async ([t, p, s]) => {
      const g = (window as unknown as { __gamada: { emit(t: string, p: unknown, s: string): void; settled(): Promise<void> } }).__gamada
      g.emit(t as string, p, s as string)
      await g.settled()
    },
    [type, payload, source] as const,
  )
}
/** move the world clock to 07:01: Joko Prasetyo's KYC request arrives (natural event) */
async function at0701(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const g = (window as unknown as { __gamada: { clock: { setTime(m: number): void; pause(): void }; settled(): Promise<void> } }).__gamada
    g.clock.setTime(421)
    g.clock.pause()
    await g.settled()
  })
}
const sm = (page: Page) => (page.viewportSize()?.width ?? 1440) < 640
async function tab(page: Page, id: 'antrian' | 'kyc' | 'kyb' | 'cv' | 'minta' | 'hasil') {
  await page.locator(`.dk-km-tabs [role=tab][id$="-t-${id}"]`).click()
}
async function pickCase(page: Page, reqId: string) {
  if (sm(page)) await page.locator('.dk-km-casepick select').selectOption(reqId)
  else await page.locator(`[data-case="${reqId}"]`).click()
}
async function foldGuide(page: Page) {
  if (!sm(page)) return
  const sheet = page.locator('.dk-guide:not([hidden])')
  if (await sheet.count()) await page.keyboard.press('Escape')
}

/* ------------------------------------------------------------------ missions (the whole product, 1440 and 390) */

async function allMissions(page: Page) {
  await open(page)
  await at0701(page)
  await foldGuide(page)
  const f = await W<{ hero: string; heroReq: string; mm: string; joko: string; siti: string }>(
    page,
    `({ hero: s.meta.facts.up.kenalMitra.heroBusinessId, heroReq: s.meta.facts.up.kenalMitra.heroRequestId, mm: s.meta.facts.up.kenalMitra.mismatchBusinessId, joko: s.meta.facts.up.kenalMitra.kycCleanDocId, siti: s.meta.facts.up.kenalMitra.kycEditedDocId })`,
  )
  // 1 · KYC: Joko's request (hotspot card) → phone steps → analyst decision (AI suggestion setujui, risk 18)
  await page.locator('[data-hotspot="km-first-request"]').click()
  for (let i = 0; i < 4; i++) await page.locator('[data-km="kyc-next"]').first().click()
  await page.locator('[data-km="kyc-send"]:not([disabled])').click({ timeout: 10_000 })
  await expect(page.locator('[data-km="kyc-decide"]')).toBeEnabled({ timeout: 15_000 })
  await expect(page.locator('.dk-km-decide')).toContainText('18')
  await page.locator('[data-km="kyc-decide"]').click()
  await expect(page.locator('.dk-km-done')).toBeVisible()
  // risk 18 = kycRisk (the emitted score), AI suggestion setujui ⇒ lolos
  expect(await W<string>(page, `(v => v.result + ':' + v.score)(Object.values(s.verifications.byId).find(v => v.subjectId === '${f.joko}' && v.at >= 0))`)).toBe('lolos:18')
  // the edited KTP: heatmap + 63 tinjau + the Cek Berkas link to the same flagged document
  const sitiReq = await W<string>(page, `Object.values(s.verificationRequests.byId).find(r => r.subjectId === '${f.siti}').id`)
  await pickCase(page, sitiReq)
  await expect(page.locator('[data-km="kyc-decide"]')).toBeEnabled({ timeout: 15_000 })
  await expect(page.locator('.dk-km-decide')).toContainText('63')
  const tampered = await W<string>(page, 's.meta.facts.tamperedDocumentId')
  await expect(page.locator('.dk-km-xlink')).toHaveAttribute('href', new RegExp(`/demo/cek-berkas\\?.*focus=${tampered}`))

  // 2 · KYB hero: start → matrix → location (0,2 km) → approve ⇒ verified, KPI +1, preview badge flips
  const before = await W<number>(page, 'Object.values(s.businesses.byId).filter(b => b.verified).length')
  await tab(page, 'kyb')
  await pickCase(page, f.heroReq)
  await page.locator('[data-km="start"]').click()
  await expect(page.locator('[data-km="map-check"]')).toBeEnabled({ timeout: 10_000 })
  await expect(page.locator('.dk-km-matrix')).toBeVisible()
  await page.locator('[data-km="map-check"]').click()
  await expect(page.locator('[data-km="distance"]')).toContainText(/0[,.]2 km/, { timeout: 20_000 })
  await expect(page.locator('.dk-km-score')).toContainText('91')
  const t0 = Date.now()
  await page.locator('[data-km="approve"]').click()
  await expect(page.locator('.dk-km-done [data-km="catalog-preview"] [data-biz="' + f.hero + '"] [data-badge="verified"].is-ok')).toBeVisible({ timeout: 1_000 })
  expect(Date.now() - t0).toBeLessThan(1_500)
  expect(await W<boolean>(page, `s.businesses.byId['${f.hero}'].verified`)).toBe(true)
  expect(await W<number>(page, 'Object.values(s.businesses.byId).filter(b => b.verified).length')).toBe(before + 1)
  // KYB 91 = kybCase().score (the emitted score)
  expect(await W<number>(page, `Object.values(s.verifications.byId).filter(v => v.subjectId === '${f.hero}').sort((a, b) => b.at - a.at)[0].score`)).toBe(91)

  // 3 · the mismatch: GPS ≈ 9 km in another kecamatan + NPWP name ≠ ⇒ approve disabled, cek-manual
  const mmReq = await W<string>(page, `Object.values(s.verificationRequests.byId).find(r => r.subjectId === '${f.mm}' && r.status !== 'selesai').id`)
  await pickCase(page, mmReq)
  await page.locator('[data-km="start"]').click()
  await expect(page.locator('[data-km="map-check"]')).toBeEnabled({ timeout: 10_000 })
  await page.locator('[data-km="map-check"]').click()
  await expect(page.locator('[data-km="distance"]')).toContainText(/\b9 km/, { timeout: 20_000 })
  await expect(page.locator('[data-km="approve"]')).toBeDisabled()
  await expect(page.locator('.dk-km-matrix .is-bad').first()).toBeVisible()
  await page.locator('[data-km="manual"]').click()
  await expect(page.locator('.dk-km-done')).toBeVisible()
  expect(await W<boolean>(page, `s.businesses.byId['${f.mm}'].verified`)).toBe(false)
  expect(await W<string>(page, `Object.values(s.verifications.byId).filter(v => v.subjectId === '${f.mm}').sort((a, b) => b.at - a.at)[0].result`)).toBe('cek-manual')

  // 4 · CV: 200 → funnel → 10, one batch of partner.verified kind cv; blind keeps the same ids in order
  await tab(page, 'cv')
  await page.locator('[data-km="upload"]').click()
  if (sm(page)) await page.locator('.dk-km-cv-left > .dk-km-row [data-km="screen"]').click()
  else await page.locator('[data-km="screen"]').click()
  await expect(page.locator('[data-km="shortlist"] > li')).toHaveCount(10, { timeout: 10_000 })
  expect(await W<number>(page, `Object.values(s.verifications.byId).filter(v => v.kind === 'cv' && v.at >= 0).length`)).toBe(10)
  expect(await W<number>(page, 's.meta.facts.up.kenalMitra.cvCount')).toBe(200)
  await expect(page.locator('.dk-km-funnel')).toContainText('200')
  const ids1 = await page.locator('[data-km="shortlist"] > li').evaluateAll((l) => l.map((x) => (x as HTMLElement).dataset.cv).join())
  await page.locator('.dk-km-cv-head button[aria-pressed]').click()
  await expect(page.locator('[data-km="shortlist"] > li').first()).toContainText(/Kandidat K-\d{4}/)
  const ids2 = await page.locator('[data-km="shortlist"] > li').evaluateAll((l) => l.map((x) => (x as HTMLElement).dataset.cv).join())
  expect(ids2).toBe(ids1)

  // every mission done
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('gamada:demo:missions:kenal-mitra') ?? '[]').length)).toBe(4)
}

test('missions + numbers · 1440', async ({ page, errors }) => {
  await allMissions(page)
  await expect(page.locator('.dk-guide-step.is-done')).toHaveCount(4)
  expect(errors.filter(noise)).toEqual([])
})

test.describe('phone 390', () => {
  test.use(PHONE)
  test('missions + no horizontal scroll · 390', async ({ page, errors }) => {
    await allMissions(page)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(errors.filter(noise)).toEqual([])
  })
})

/* ------------------------------------------------------------------ first screen */

test('first screen: KPI = selectors, 07:01 request, preview, activity', async ({ page, errors }) => {
  await open(page)
  const kpiBefore = await W<number>(page, `Object.values(s.verificationRequests.byId).filter(r => r.status !== 'selesai').length`)
  expect(kpiBefore).toBe(8)
  await at0701(page)
  await expect(page.locator('[data-hotspot="km-first-request"]')).toBeVisible()
  await expect(page.locator('.dk-km-kpis .dk-kpi').first()).toContainText('9')
  const verified = await W<number>(page, 'Object.values(s.businesses.byId).filter(b => b.verified).length')
  await expect(page.locator('.dk-km-kpis .dk-kpi').nth(3)).toContainText(String(verified))
  await expect(page.locator('.dk-km-kpis')).toContainText(/simulasi/)
  await expect(page.locator('[data-km="catalog-preview"]')).toBeVisible()
  await expect(page.locator('.dk-km-activity li').first()).toContainText(/KYC/)
  expect(errors.filter(noise)).toEqual([])
})

test('alive within 10 s (autoplay, no input)', async ({ page }) => {
  await open(page, 'autoplay=1', { run: true })
  await expect.poll(() => W<number>(page, `Object.values(s.verificationRequests.byId).filter(r => r.at >= 420).length`), { timeout: 10_000 }).toBeGreaterThan(0)
  await expect(page.locator('[data-hotspot="km-first-request"]')).toBeVisible()
})

/* ------------------------------------------------------------------ focus arrivals */

test('?focus= arrivals: request, business, verification (bank certificate), unknown id', async ({ page, errors }) => {
  await open(page)
  const f = await W<{ heroReq: string; mm: string }>(page, `({ heroReq: s.meta.facts.up.kenalMitra.heroRequestId, mm: s.meta.facts.up.kenalMitra.mismatchBusinessId })`)
  await open(page, `tab=kyb&focus=${f.heroReq}`)
  await expect(page.locator('.dk-km-kyb .dk-km-case-h')).toContainText('CV ')
  await expect(page.locator(`[data-case="${f.heroReq}"]`)).toHaveAttribute('aria-current', 'true')
  await open(page, `focus=${f.mm}`)
  await expect(page.locator('.dk-km-kyb .dk-km-case-h')).toContainText('UD Bumi Terpal')
  await open(page, 'focus=KM-9999')
  await expect(page.locator('.dk-km-queue')).toBeVisible()
  await expect(page.locator('.dk-toast').filter({ hasText: /Data tidak ditemukan/ })).toBeVisible()
  // bank role: a lender verification opens its certificate
  const vf = await W<string>(page, `(() => { const lender = Object.values(s.verificationRequests.byId).find(r => r.kind === 'kyc').requestedBy; const r = Object.values(s.verificationRequests.byId).find(r => r.requestedBy === lender && r.status === 'selesai' && r.verificationId && s.verifications.byId[r.verificationId]); return r.verificationId })()`)
  await open(page, `role=bank-mitra&focus=${vf}`, { root: '.dk-km-bank' })
  await expect(page.locator('.dk-km-cert')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.dk-km-cert')).toContainText('SPESIMEN')
  expect(errors.filter(noise)).toEqual([])
})

/* ------------------------------------------------------------------ chains */

test('chains C26 + C27 + L2: need → priority KYB first in the lane ≤ 1 s; hero lolos → match.made + shortlist line', async ({ page, errors }) => {
  await open(page)
  const hero = await W<string>(page, 's.meta.facts.up.kenalMitra.heroBusinessId')
  const kec = await W<string>(page, `s.businesses.byId['${hero}'].kecamatanId`)
  const t0 = Date.now()
  await emit(page, 'need.created', { title: { id: 'Karung pasir darurat', en: 'Emergency sandbags' }, items: [{ name: { id: 'Karung pasir', en: 'Sandbags' }, category: 'karung-pasir', qty: 500, unit: 'karung' }], kecamatanId: kec, deadlineDays: 2, emergency: true }, 'katalog-lokal')
  const prio = await W<{ id: string; subjectId: string }[]>(page, `Object.values(s.verificationRequests.byId).filter(r => r.priority && r.needId && r.status !== 'selesai').map(r => ({ id: r.id, subjectId: r.subjectId }))`)
  expect(prio.length).toBeGreaterThan(0)
  expect(prio.length).toBeLessThanOrEqual(2)
  expect(prio[0]!.subjectId).toBe(hero)
  await expect(page.locator('[data-km-lane="kyb"] .dk-km-card').first()).toHaveClass(/is-prio/, { timeout: 1_000 })
  expect(Date.now() - t0).toBeLessThan(2_500)
  await expect(page.locator('[data-km-lane="kyb"] .dk-km-card').first()).toContainText(/Untuk kebutuhan [A-Z]{2}-\d+/)
  // C27: the hero passes KYB (UI) → match.made for the open need, the preview shows the shortlist line
  await page.locator('[data-km-lane="kyb"] .dk-km-card').first().click()
  await page.locator('[data-km="start"]').click()
  await expect(page.locator('[data-km="map-check"]')).toBeEnabled({ timeout: 10_000 })
  await page.locator('[data-km="map-check"]').click()
  await expect(page.locator('[data-km="approve"]')).toBeEnabled({ timeout: 20_000 })
  await page.locator('[data-km="approve"]').click()
  await expect.poll(() => W<number>(page, `Object.values(s.matches.byId).filter(m => m.businessId === '${hero}').length`)).toBeGreaterThan(0)
  await expect(page.locator('.dk-km-done [data-km="shortlisted"]')).toContainText(/[A-Z]{2}-\d+/, { timeout: 1_000 })
  // L2: TenderPilot reads the KYB state (requirementsFor kyb ✓ comes from verified)
  expect(await W<boolean>(page, `s.businesses.byId['${hero}'].verified`)).toBe(true)
  expect(errors.filter(noise)).toEqual([])
})

/* ------------------------------------------------------------------ bank role */

test('bank role round trip: request KYC → switch role → analyst sees it → results + certificate', async ({ page, errors }) => {
  await open(page, 'role=bank-mitra', { root: '.dk-km-bank' })
  await expect(page.locator('.dk-km-consent').first()).toContainText(/persetujuan nasabah/)
  await expect(page.locator('.dk-km-tabs [role=tab]')).toHaveCount(2)
  const joko = await W<string>(page, 's.meta.facts.up.kenalMitra.kycCleanDocId')
  await page.locator('[data-km="bank-request"]').first().click()
  const q = `Object.values(s.verificationRequests.byId).filter(r => r.kind === 'kyc' && r.at >= 420).map(r => ({ id: r.id, subjectId: r.subjectId }))[0]`
  await expect.poll(() => W<{ subjectId: string } | undefined>(page, q).then((r) => r?.subjectId)).toBe(joko)
  const req = await W<{ id: string; subjectId: string }>(page, q)
  const toast = page.locator('.dk-toast').filter({ hasText: /Analis KYC/ })
  await expect(toast).toBeVisible()
  await toast.getByRole('button', { name: /Ganti peran/ }).click()
  await expect(page.locator(`[data-case="${req!.id}"]`)).toHaveAttribute('aria-current', 'true', { timeout: 10_000 })
  // back to the bank: results list, certificate, close
  await open(page, 'role=bank-mitra&tab=hasil', { root: '.dk-km-bank' })
  await page.locator('[data-km="see-cert"]').first().click()
  await expect(page.locator('.dk-km-cert')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.dk-km-cert')).toHaveCount(0)
  expect(errors.filter(noise)).toEqual([])
})

/* ------------------------------------------------------------------ language, motion */

test('EN + reduced motion + static: KYB and CV final states render', async ({ page, errors }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page, 'lang=en&static=1&tab=kyb')
  await expect(page.locator('.dk-km-tabs [role=tab]').first()).toContainText('Queue')
  await page.locator('[data-km="start"]').click()
  await expect(page.locator('[data-km="map-check"]')).toBeEnabled({ timeout: 5_000 })
  await expect(page.locator('.dk-km-matrix')).toContainText(/Business name/)
  await tab(page, 'cv')
  await page.locator('[data-km="upload"]').click()
  await page.locator('[data-km="screen"]').click()
  await expect(page.locator('[data-km="shortlist"] > li')).toHaveCount(10)
  // idle: no gsap ticker running under reduced motion
  const ticks = await page.evaluate(() => {
    const g = (window as unknown as { gsap?: { ticker: { _listeners?: unknown[] } } }).gsap
    return g?.ticker?._listeners?.length ?? 0
  })
  expect(ticks).toBe(0)
  expect(errors.filter(noise)).toEqual([])
})

test('Tanya alasan: ≥ 10 questions, answers name the case, no repeated answer', async ({ page, errors }) => {
  await open(page, 'tab=cv')
  await page.locator('[data-km="upload"]').click()
  await page.locator('[data-km="screen"]').click()
  await expect(page.locator('[data-km="shortlist"] > li')).toHaveCount(10)
  await page.locator('[data-km="ask"]').click()
  const chips = page.locator('.dk-km-why-chip')
  await expect(chips).toHaveCount(11)
  for (const id of ['cv-why-rank', 'cv-blind', 'cv-bias', 'data-stored']) {
    await page.locator(`[data-intent="${id}"]`).click()
    await expect(page.locator('.dk-km-why-msg.is-assistant')).toHaveCount((await page.locator('.dk-km-why-msg.is-user').count()), { timeout: 8_000 })
    await page.waitForTimeout(1_800)
  }
  const answers = await page.locator('.dk-km-why-msg.is-assistant').allTextContents()
  expect(new Set(answers).size).toBe(answers.length)
  expect(answers[0]).toMatch(/K-\d{4}/)
  expect(errors.filter(noise)).toEqual([])
})

/* ------------------------------------------------------------------ no dead controls */

const CONTROLS = '.dk-km :is(button:not([role="tab"]), [role="radio"], a[href], select, input[type="checkbox"])'
async function crawlTab(page: Page): Promise<string[]> {
  const dead: string[] = []
  for (let i = 0; i < 30; i++) {
    const r = await page.evaluate(
      async ([sel, idx]) => {
        const els = Array.from(document.querySelectorAll<HTMLElement>(sel)).filter((el) => {
          const b = el.getBoundingClientRect()
          const cur = (el.getAttribute('role') === 'radio' && el.getAttribute('aria-checked') === 'true') || el.getAttribute('aria-current') === 'true'
          return !cur && b.width > 0 && b.height > 0 && !(el as HTMLButtonElement).disabled && !el.closest('[inert]')
        })
        const el = els[idx as number]
        if (!el) return null
        const label = (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 50)
        if (el instanceof HTMLAnchorElement) return { label, changed: !!el.getAttribute('href') }
        if (el instanceof HTMLSelectElement) return { label, changed: el.options.length > 1 }
        const w = window as unknown as { __gamada: { onEvent(t: string, fn: () => void): () => void } }
        let changed = false
        const mo = new MutationObserver(() => (changed = true))
        mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true })
        const off = w.__gamada.onEvent('*', () => (changed = true))
        const url = location.href
        el.scrollIntoView({ block: 'center' })
        el.click()
        for (let t = 0; t < 40 && !changed && location.href === url; t++) await new Promise((res) => setTimeout(res, 100))
        mo.disconnect()
        off()
        return { label, changed: changed || location.href !== url }
      },
      [CONTROLS, i] as const,
    )
    if (!r) break
    if (!r.changed) dead.push(r.label)
    await page.keyboard.press('Escape')
  }
  return dead
}

test('no dead controls · every tab, both roles', async ({ page }) => {
  test.setTimeout(240_000)
  page.on('dialog', (d) => void d.dismiss())
  await page.addInitScript(() => {
    window.print = () => undefined
  })
  const dead: string[] = []
  for (const t of ['antrian', 'kyc', 'kyb', 'cv']) {
    await open(page, `tab=${t}`)
    await at0701(page)
    dead.push(...(await crawlTab(page)).map((x) => `${t}: ${x}`))
  }
  for (const t of ['minta', 'hasil']) {
    await open(page, `role=bank-mitra&tab=${t}`, { root: '.dk-km-bank' })
    dead.push(...(await crawlTab(page)).map((x) => `${t}: ${x}`))
  }
  expect(dead, dead.join(' | ')).toEqual([])
})
