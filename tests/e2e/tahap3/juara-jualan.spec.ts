/**
 * P10 Juara Jualan (spec §11, plan docs/build/tahap3-plan.md §2 P10): every mission by script (1440 + 390), the
 * numbers that must agree, ?focus= arrivals, chain C17 (po.sent ⇒ WA pre-order chat), marker sync on 3 clips,
 * evidence quotes = real transcript lines, no repeated fix text across clips, roleplay good vs weak chips, alive
 * within 10 s, Space play/pause, reduced motion, and a no-dead-controls crawl per tab × role.
 * Runs before DEMO_READY through `?controls=all`.
 */
import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures'
import { CALL_CLIPS, FLAG_OF } from '../../../src/demo-kit/world/up/base'
import { TB } from '../../../src/demos/juara-jualan/clips-tb'
import ASR from '../../../src/demos/juara-jualan/clips-asr'

test.describe.configure({ timeout: 180_000 })

const SLUG = 'juara-jualan'
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } as const
const notNoise = (e: string): boolean => !/api\/ai|ERR_CONNECTION_REFUSED|ERR_FAILED|ERR_ABORTED|net::ERR_/.test(e)

interface OpenOpts {
  lang?: 'id' | 'en'
  role?: string
  extra?: string
  /** keep the world clock running */
  run?: boolean
}
async function open(page: Page, o: OpenOpts = {}): Promise<void> {
  const q = new URLSearchParams({ controls: 'all', off: 'preloader', e2e: '1' })
  if (o.lang) q.set('lang', o.lang)
  if (o.role) q.set('role', o.role)
  await page.goto(`/demo/${SLUG}?${q.toString()}${o.extra ? `&${o.extra}` : ''}`)
  await page.waitForFunction(() => (window as unknown as { __gamada?: { world: { status(): string } } }).__gamada?.world.status() === 'ready', null, { timeout: 45_000 })
  await expect(page.locator('.dk-jj-kpis')).toBeVisible({ timeout: 30_000 })
  await page.evaluate(async () => {
    const g = (window as unknown as { __gamada: { ensure(e: string): Promise<void>; clock: { pause(): void } } }).__gamada
    await g.ensure('usaha-pintar')
  })
  if (!o.run) await page.evaluate(() => (window as unknown as { __gamada: { clock: { pause(): void } } }).__gamada.clock.pause())
}
function W<T>(page: Page, expr: string): Promise<T> {
  return page.evaluate((x) => {
    const s = (window as unknown as { __gamada: { world: { get(): unknown } } }).__gamada.world.get()
    return new Function('s', `return (${x})`)(s) as T
  }, expr)
}
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
const missionsDone = (page: Page): Promise<string[]> => page.evaluate((s) => JSON.parse(localStorage.getItem(`gamada:demo:missions:${s}`) ?? '[]') as string[], SLUG)
const WEIGHTS = { salam: 10, gali: 20, keberatan: 20, penawaran: 20, closing: 20, kepatuhan: 10 } as const
const scoreOf = (c: Record<string, number>) => Math.round(Object.entries(WEIGHTS).reduce((a, [k, w]) => a + w * c[k]!, 0) / 100)

/** the moments of the open detail: id → { tone, t } */
async function moments(page: Page): Promise<Record<string, { tone: string; t: number }>> {
  const raw = (await page.locator('.dk-jj-player').first().getAttribute('data-moments')) ?? ''
  return Object.fromEntries(
    raw
      .split(' ')
      .filter(Boolean)
      .map((x) => {
        const [id, tone, t] = x.split(':')
        return [id!, { tone: tone!, t: Number(t) }]
      }),
  )
}
const playhead = async (page: Page) => Number(await page.locator('.dk-jj-player').first().getAttribute('data-playhead'))

const GOOD = [/^Selamat pagi, saya/, /^Boleh tahu untuk/, /^Untuk kebutuhan itu/, /^Saya paham\. Bedanya/, /^Untungnya:/, /^Saya tidak bisa janji/, /^Wajar ragu/, /^Saya kirim formulirnya/]
const WEAK = [/^Langsung saja/, /^Pokoknya ambil/, /^Murah kok/, /^Kalau tidak sekarang/, /^Dijamin 100/, /^Bisa, saya kasih diskon/, /^Sayang lho/, /^Pokoknya transfer/]

/** play the roleplay with one kind of chip until the result shows; returns the number of turns */
async function playChips(page: Page, set: RegExp[]): Promise<number> {
  const chat = page.locator('.dk-jj-chat')
  let n = 0
  for (let i = 0; i < set.length; i++) {
    if (await page.locator('.dk-jj-result').isVisible()) break
    const chip = chat.getByRole('button', { name: set[i]! })
    await expect(chip).toBeEnabled({ timeout: 5_000 })
    await chip.click()
    n++
  }
  await expect(page.locator('.dk-jj-result')).toBeVisible({ timeout: 5_000 })
  return n
}

test('Juara Jualan · 5 missions + numbers agree (1440, ID)', async ({ page, errors }) => {
  await open(page)
  // KPI "Percakapan hari ini" = list length = world (today's tb calls)
  const today = await W<number>(page, `Object.values(s.calls.byId).filter((c) => c.industry === 'toko-bangunan' && c.at >= 0 && c.at <= 420).length`)
  await expect(page.locator('.dk-jj-kpis .dk-kpi').first()).toContainText(String(today))
  await expect(page.locator('.dk-jj-list > li')).toHaveCount(today)
  // the day's lowest tb call is open: list score = detail total = world score = callScore(criteria)
  const low = await W<{ id: string; score: number; criteria: Record<string, number> }>(page, `s.calls.byId[s.meta.facts.up.lowCall['toko-bangunan']]`)
  expect(low.score).toBe(scoreOf(low.criteria))
  await expect(page.locator(`.dk-jj-detail[data-call="${low.id}"]`)).toBeVisible()
  await expect(page.locator(`[data-call-row="${low.id}"] .dk-jj-sc`)).toHaveText(String(low.score))
  await expect(page.locator('.dk-jj-total b')).toHaveText(String(low.score))

  // 1 · momen: the red marker → playhead on the problem second (±0.3 s)
  const m = await moments(page)
  const danger = Object.values(m).find((x) => x.tone === 'danger')!
  expect(danger).toBeTruthy()
  await page.locator('[data-hotspot="jj-marker-danger"]').first().click()
  expect(Math.abs((await playhead(page)) - danger.t)).toBeLessThanOrEqual(0.3)
  await expect.poll(() => missionsDone(page)).toContain('momen')

  // 2 · nilai: an unscored (not running) call → "Nilai sekarang" → list = detail = world = toast
  const un = await W<string>(page, `Object.values(s.calls.byId).filter((c) => c.industry === 'toko-bangunan' && c.at >= 0 && c.at <= 420 && c.score === null && c.at + Math.ceil(c.durationSec / 60) <= 420)[0].id`)
  await page.locator(`[data-call-row="${un}"] .dk-jj-row-b`).click()
  await expect(page.locator(`.dk-jj-detail[data-call="${un}"]`)).toBeVisible()
  await page.locator('[data-jj="score-now"]').click()
  await expect(page.locator('[data-jj="score-now"]')).toHaveText('Menilai…')
  await expect.poll(() => W<number | null>(page, `s.calls.byId['${un}'].score`), { timeout: 5_000 }).not.toBeNull()
  const scored = await W<{ score: number; criteria: Record<string, number> }>(page, `s.calls.byId['${un}']`)
  expect(scored.score).toBe(scoreOf(scored.criteria))
  await expect(page.locator(`[data-call-row="${un}"] .dk-jj-sc`)).toHaveText(String(scored.score))
  await expect(page.locator('.dk-jj-total b')).toHaveText(String(scored.score))
  await expect(page.locator('.dk-toast').filter({ hasText: `Skor ${scored.score} dicatat untuk ${un}` })).toBeVisible()
  await expect.poll(() => missionsDone(page)).toContain('nilai')

  // 3 · coaching: prefilled from the 3 weakest criteria, baseline = board avg14
  const agentId = await W<string>(page, `s.calls.byId['${un}'].agentId`)
  await page.locator('.dk-jj-detail [data-jj="assign"]').click()
  const dlg = page.getByRole('dialog')
  await expect(dlg).toBeVisible()
  const baseTxt = (await dlg.locator('.dk-jj-muted b').innerText()).trim()
  await dlg.getByRole('button', { name: 'Tugaskan' }).click()
  await expect.poll(() => missionsDone(page)).toContain('coaching')
  const co = await W<{ id: string; agentId: string; baseline: number; focus: unknown[]; examples: unknown[]; status: string }>(page, `Object.values(s.coachings.byId).sort((a, b) => b.at - a.at || b.id.localeCompare(a.id))[0]`)
  expect(co.agentId).toBe(agentId)
  expect(co.status).toBe('baru')
  expect(co.focus).toHaveLength(3)
  expect(co.examples).toHaveLength(3)
  expect(String(co.baseline)).toBe(baseTxt)
  // the board shows the same avg14
  await page.getByRole('tab', { name: 'Tim' }).click()
  await expect(page.locator(`[data-agent-row="${agentId}"] .dk-jj-bavg`)).toHaveText(baseTxt)

  // 4 · agen: switch role → the new card renders (3 focus + 3 examples)
  await page.evaluate(() => (window as unknown as { __gamada: unknown }).__gamada) // keep the page alive
  await page.goto(`/demo/${SLUG}?controls=all&off=preloader&e2e=1&role=agen-sales`)
  await expect(page.locator(`[data-coaching="${co.id}"]`)).toBeVisible({ timeout: 30_000 })
  await expect(page.locator(`[data-coaching="${co.id}"] .dk-jj-focus li`)).toHaveCount(3)
  await expect(page.locator('.dk-jj-rank')).toContainText('Anda #')
  await expect.poll(() => missionsDone(page)).toContain('agen')

  // 5 · latihan: good chips ⇒ completed above the baseline
  await page.evaluate(() => (window as unknown as { __gamada: { clock: { pause(): void } } }).__gamada.clock.pause())
  await page.locator(`[data-coaching="${co.id}"]`).getByRole('button', { name: 'Mulai latihan' }).click()
  const turns = await playChips(page, GOOD)
  expect(turns).toBeGreaterThanOrEqual(6)
  await expect.poll(() => missionsDone(page)).toContain('latihan')
  const rp = await W<{ score: number; baseline: number; turns: number; coachingId: string }>(page, `Object.values(s.roleplays.byId).sort((a, b) => b.id.localeCompare(a.id))[0]`)
  expect(rp.turns).toBe(turns)
  expect(rp.coachingId).toBe(co.id)
  expect(rp.baseline).toBe(co.baseline)
  expect(rp.score).toBeGreaterThan(rp.baseline)
  // weak chips honestly score lower
  await page.getByRole('button', { name: 'Mulai ulang' }).click()
  await playChips(page, WEAK)
  const rp2 = await W<{ score: number; baseline: number }>(page, `Object.values(s.roleplays.byId).sort((a, b) => b.id.localeCompare(a.id))[0]`)
  expect(rp2.score).toBeLessThan(rp2.baseline)
  expect(rp2.score).toBeLessThan(rp.score)

  expect((await missionsDone(page)).sort()).toEqual(['agen', 'coaching', 'latihan', 'momen', 'nilai'])
  expect(errors.filter(notNoise)).toEqual([])
})

test.describe('phone 390', () => {
  test.use(PHONE)
  test('Juara Jualan · red Momen chip opens the detail at the problem second, no horizontal scroll (EN)', async ({ page, errors }) => {
    await open(page, { lang: 'en' })
    for (const w of [360, 390, 430]) {
      await page.setViewportSize({ width: w, height: 844 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    }
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.locator('.dk-mpill')).toBeVisible()
    await page.locator('[data-hotspot="jj-marker-danger"]').first().click()
    const dlg = page.getByRole('dialog')
    await expect(dlg.locator('.dk-jj-detail')).toBeVisible()
    const m = await moments(page)
    const danger = Object.values(m).find((x) => x.tone === 'danger')!
    await expect.poll(() => playhead(page)).toBeCloseTo(danger.t, 0)
    expect(Math.abs((await playhead(page)) - danger.t)).toBeLessThanOrEqual(0.3)
    await expect.poll(() => missionsDone(page)).toContain('momen')
    // EN: the Indonesian line stays, the translation sits under it
    await expect(dlg.locator('.dk-jj-tl-en').first()).toBeVisible()
    // moment chips are 44 px
    const hs = await dlg.locator('.dk-jj-mchip').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))
    expect(Math.min(...hs)).toBeGreaterThanOrEqual(44)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    expect(errors.filter(notNoise)).toEqual([])
  })

  test('Juara Jualan · roleplay on a phone with chips only', async ({ page, errors }) => {
    await open(page, { extra: 'tab=latihan' })
    await playChips(page, GOOD)
    await expect.poll(() => missionsDone(page)).toContain('latihan')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    expect(errors.filter(notNoise)).toEqual([])
  })
})

test('Juara Jualan · C17 po.sent ⇒ WA pre-order chat with Toko Autopilot price / PO code / ETA, toast opens it', async ({ page, errors }) => {
  await open(page)
  const po = await W<{ id: string; code: string; businessId: string; supplierId: string; items: unknown[] }>(page, `Object.values(s.purchaseOrders.byId).find((p) => p.businessId === s.meta.shopId && p.status === 'draf')`)
  expect(po).toBeTruthy()
  const t0 = Date.now()
  await emit(page, 'po.sent', { id: po.id, businessId: po.businessId, supplierId: po.supplierId, items: po.items }, 'toko-autopilot')
  const callId = await W<string>(page, `Object.values(s.calls.byId).find((c) => c.refId === '${po.id}').id`)
  await expect(page.locator(`[data-call-row="${callId}"]`)).toBeVisible({ timeout: 1_000 })
  expect(Date.now() - t0).toBeLessThan(2_500)
  const call = await W<{ agentId: string; transcript: string; channel: string; score: number | null }>(page, `s.calls.byId['${callId}']`)
  expect(call.transcript).toBe('tb-wa-prapesan')
  expect(call.channel).toBe('wa')
  expect(call.score).toBeNull()
  expect(call.agentId).toBe(await W<string>(page, 's.meta.facts.up.newCashierAgentId'))
  // the in-canvas toast's action opens it
  const toast = page.locator('.dk-toast').filter({ hasText: `Chat pra-pesan ${po.code} masuk` })
  await expect(toast).toBeVisible()
  await toast.getByRole('button', { name: 'Buka' }).click()
  await expect(page.locator(`.dk-jj-detail[data-call="${callId}"]`)).toBeVisible()
  // PO panel + transcript: code and the shelf price of the (flood-first) item, from the world
  const prod = await W<{ name: string; price: number }>(
    page,
    `s.purchaseOrders.byId['${po.id}'].items.map((i) => s.products.byId[i.productId]).sort((a, b) => Number(b.tags.includes('flood')) - Number(a.tags.includes('flood')))[0]`,
  )
  const rp = 'Rp ' + prod.price.toLocaleString('id-ID')
  const panel = page.locator('.dk-jj-po')
  await expect(panel).toContainText(po.code)
  await expect(panel).toContainText(prod.name)
  await expect(panel).toContainText(rp)
  await expect(page.locator('.dk-jj-tx')).toContainText(po.code)
  await expect(page.locator('.dk-jj-tx')).toContainText(rp)
  // C16 answered the PO: the ETA is the supplier's
  const eta = await W<number | null>(page, `s.purchaseOrders.byId['${po.id}'].reply?.eta ?? null`)
  if (eta !== null) await expect(panel).not.toContainText('menunggu balasan pemasok')
  // the cross-product toast's landing (?focus=<callId>) opens the same chat
  await page.evaluate((id) => {
    window.history.pushState({}, '', `/demo/juara-jualan?controls=all&e2e=1&off=preloader&focus=${id}`)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, callId)
  await expect(page.locator(`.dk-jj-detail[data-call="${callId}"]`)).toBeVisible()
  expect(errors.filter(notNoise)).toEqual([])
})

test('Juara Jualan · ?focus= arrivals: call → industry + detail, staff → Tim, coaching → card, unknown → toast', async ({ page, errors }) => {
  await open(page)
  const mf = await W<string>(page, `s.meta.facts.up.lowCall.multifinance`)
  const staff = await W<string>(page, `s.meta.facts.up.newCashierStaffId`)
  const agent = await W<string>(page, `s.meta.facts.up.newCashierAgentId`)
  const coach = await W<string>(page, `Object.values(s.coachings.byId)[0].id`)
  await open(page, { extra: `focus=${mf}` })
  await expect(page.getByRole('radio', { name: 'Multifinance' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator(`.dk-jj-detail[data-call="${mf}"]`)).toBeVisible()
  await open(page, { extra: `focus=${staff}` })
  await expect(page.getByRole('tab', { name: 'Tim' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator(`[data-agent-row="${agent}"] .dk-jj-brow`)).toHaveAttribute('aria-current', 'true')
  await open(page, { extra: `focus=${coach}` })
  await expect(page.getByRole('tab', { name: 'Coaching' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator(`[data-coaching="${coach}"]`)).toBeVisible()
  await open(page, { extra: 'focus=CL-9999' })
  await expect(page.locator('.dk-toast').filter({ hasText: 'Data tidak ditemukan' })).toHaveCount(1)
  await expect(page.getByRole('tab', { name: 'Percakapan' })).toHaveAttribute('aria-selected', 'true')
  expect(errors.filter(notNoise)).toEqual([])
})

test('Juara Jualan · clip texts: every key has its weak criterion missed with a fix; fixes never repeat (tb + asr data)', () => {
  const libs = { ...TB, ...ASR }
  const fixes = new Map<string, string>()
  for (const def of CALL_CLIPS.filter((c) => c.industry !== 'multifinance')) {
    const text = libs[def.key]
    expect(text, def.key).toBeTruthy()
    const miss = text!.lines.filter((l) => (l[3] ?? '').split(' ').includes(`${def.weak}-`))
    expect(miss.length, `${def.key} weak ${def.weak}`).toBeGreaterThan(0)
    expect(FLAG_OF[def.weak]).toBeTruthy()
    for (const l of text!.lines) {
      if (!l[4]) continue
      expect(fixes.has(l[4]), `fix repeated in ${def.key}`).toBe(false)
      fixes.set(l[4], def.key)
    }
  }
})

test('Juara Jualan · marker sync 3 clips, evidence = real lines, no fix repeated across clips (UI, 3 industries)', async ({ page, errors }) => {
  await open(page)
  const fixByKey = new Map<string, Set<string>>()
  let markersChecked = 0
  for (const [label, ind] of [['Toko Bangunan', 'toko-bangunan'], ['Multifinance', 'multifinance'], ['Asuransi', 'asuransi']] as const) {
    await page.getByRole('radio', { name: label }).click()
    const ids = await W<string[]>(page, `Object.values(s.calls.byId).filter((c) => c.industry === '${ind}' && c.at >= 0 && c.at <= 420).map((c) => c.id)`)
    for (const [i, id] of ids.entries()) {
      await page.locator(`[data-call-row="${id}"] .dk-jj-row-b`).click()
      await expect(page.locator(`.dk-jj-detail[data-call="${id}"] .dk-jj-player`)).toBeVisible({ timeout: 10_000 })
      const m = await moments(page)
      expect(Object.values(m).some((x) => x.tone === 'danger'), `${id} has a danger moment`).toBe(true)
      if (i === 0) {
        // marker click ⇒ playhead within ±0.3 s of the moment (one marker per tagged line: 4–6 per clip)
        const ms = page.locator('.dk-jj-detail .dk-wave-mk')
        const n = await ms.count()
        expect(n).toBeGreaterThanOrEqual(4)
        for (let k = 0; k < n; k++) {
          const mk = ms.nth(k)
          const id2 = (await mk.getAttribute('data-marker'))!
          await mk.click()
          expect(Math.abs((await playhead(page)) - m[id2]!.t), `${id} marker ${id2}`).toBeLessThanOrEqual(0.3)
          markersChecked++
        }
      }
      // evidence quotes are real transcript lines
      const lines = new Set((await page.locator('.dk-jj-detail .dk-jj-tl-t').allInnerTexts()).map((x) => x.trim()))
      for (const q of await page.locator('.dk-jj-detail .dk-jj-quote').allInnerTexts()) {
        const body = q.replace(/^\s*\d\d:\d\d\s*/, '').trim().replace(/^“/, '').replace(/”$/, '')
        expect(lines.has(body), `${id}: “${body}” is a line`).toBe(true)
      }
      const key = await W<string>(page, `s.calls.byId['${id}'].transcript`)
      const set = fixByKey.get(key) ?? new Set<string>()
      for (const f of await page.locator('.dk-jj-detail .dk-jj-fix').allInnerTexts()) set.add(f.trim())
      fixByKey.set(key, set)
    }
  }
  expect(markersChecked).toBeGreaterThanOrEqual(14)
  // the same suggestion never appears under two different clips
  const owner = new Map<string, string>()
  for (const [key, set] of fixByKey)
    for (const f of set) {
      expect(owner.get(f) ?? key, `fix shared by ${owner.get(f)} and ${key}`).toBe(key)
      owner.set(f, key)
    }
  // Space plays / pauses the recording
  await page.locator('.dk-jj-dh-t').click()
  await expect(page.locator('.dk-jj-detail')).toBeFocused()
  await page.keyboard.press('Space')
  await expect(page.locator('.dk-jj-playbtn')).toHaveAttribute('aria-label', 'Jeda')
  await page.keyboard.press('Space')
  await expect(page.locator('.dk-jj-playbtn')).toHaveAttribute('aria-label', 'Putar')
  expect(errors.filter(notNoise)).toEqual([])
})

test('Juara Jualan · alive within 10 s with no input (clock autoplay, a world event lands on the first screen)', async ({ page, errors }) => {
  await page.goto(`/demo/${SLUG}?controls=all&off=preloader`)
  await expect(page.locator('.dk-jj-kpis')).toBeVisible({ timeout: 30_000 })
  const before = await page.locator('.dk-jj-list > li').count()
  const t0 = Date.now()
  await expect.poll(() => page.locator('.dk-jj-list > li').count(), { timeout: 12_000 }).toBeGreaterThan(before)
  expect(Date.now() - t0).toBeLessThan(11_000)
  expect(errors.filter(notNoise)).toEqual([])
})

test('Juara Jualan · reduced motion and ?static=1 render the final states; agent role EN', async ({ page, errors }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page)
  await page.locator('[data-hotspot="jj-marker-danger"]').first().click()
  await expect.poll(() => missionsDone(page)).toContain('momen')
  await open(page, { extra: 'static=1' })
  await expect(page.locator('.dk-jj-detail')).toBeVisible()
  await open(page, { lang: 'en', role: 'agen-sales' })
  await expect(page.getByRole('tab', { name: 'My coaching' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.dk-jj-rank')).toContainText('You are #')
  await page.getByRole('tab', { name: 'My conversations' }).click()
  await expect(page.locator('.dk-jj-list > li').first()).toBeVisible()
  expect(errors.filter(notNoise)).toEqual([])
})

/** every enabled control on every tab × role changes something (DOM, URL, a dialog, the role or the world) */
test('Juara Jualan · no dead controls (tabs × roles)', async ({ page, errors }) => {
  test.setTimeout(600_000)
  const plan: [string | undefined, string][] = [
    [undefined, 'Percakapan'],
    [undefined, 'Tim'],
    [undefined, 'Coaching'],
    [undefined, 'Latihan'],
    [undefined, 'Tanya QA'],
    ['agen-sales', 'Coaching Saya'],
    ['agen-sales', 'Latihan'],
    ['agen-sales', 'Percakapan Saya'],
  ]
  const dead: string[] = []
  const snap = () =>
    page.evaluate(() => {
      const root = document.querySelector('.dk-jj')
      const html = root?.innerHTML ?? ''
      let h = 0
      for (let i = 0; i < html.length; i++) h = (h * 31 + html.charCodeAt(i)) | 0
      const s = (window as unknown as { __gamada: { world: { get(): { coachings: { ids: string[] }; roleplays: { ids: string[] }; calls: { byId: Record<string, { score: number | null }> } } } } }).__gamada.world.get()
      const scored = Object.values(s.calls.byId).filter((c) => c.score !== null).length
      return `${location.href}|${h}|${document.querySelectorAll('[role="dialog"]').length}|${s.coachings.ids.length}|${s.roleplays.ids.length}|${scored}|${document.querySelector('.dk-jj-player')?.getAttribute('data-playhead') ?? ''}`
    })
  for (const [role, tab] of plan) {
    await open(page, role ? { role } : {})
    const tabEl = page.getByRole('tab', { name: tab, exact: true })
    await tabEl.click()
    await page.waitForTimeout(300)
    const panel = page.locator('.dk-jj .dk-tabpanel')
    const n = Math.min(12, await panel.locator('button:visible').count())
    for (let i = 0; i < n; i++) {
      if (!(await tabEl.count())) await open(page, role ? { role } : {})
      if ((await tabEl.getAttribute('aria-selected')) !== 'true') await tabEl.click()
      const btn = panel.locator('button:visible').nth(i)
      if (!(await btn.count()) || !(await btn.isEnabled())) continue
      if ((await btn.getAttribute('aria-checked')) === 'true' || (await btn.getAttribute('aria-current')) === 'true') continue
      const label = ((await btn.getAttribute('aria-label')) ?? (await btn.innerText())).slice(0, 50)
      const a = await snap()
      await btn.click({ timeout: 3_000 }).catch((e: Error) => console.log('click failed', label, e.message.slice(0, 600)))
      // a lazy dialog / tab may need its chunk first: wait up to 2 s for any change
      let b = a
      for (let k = 0; k < 10 && b === a; k++) {
        await page.waitForTimeout(200)
        b = await snap()
      }
      if (a === b) {
        dead.push(`${role ?? 'supervisor'} · ${tab} · ${label}`)
        console.log('dead?', dead[dead.length - 1])
      }
      if (await page.locator('[role="dialog"]').count()) {
        await page.keyboard.press('Escape')
        // a closing dialog must be gone before the next click (on a busy machine its form still covers the panel)
        await expect(page.locator('[role="dialog"]')).toHaveCount(0, { timeout: 5_000 }).catch(() => undefined)
      }
    }
  }
  expect(dead).toEqual([])
  expect(errors.filter(notNoise)).toEqual([])
})
