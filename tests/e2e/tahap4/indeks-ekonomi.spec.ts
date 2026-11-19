/**
 * Indeks Ekonomi Daerah (P16) — plan docs/build/tahap4-plan.md §2 P16 + chains §3 (C34, C35, C7 from the Kepala
 * Daerah instruction). Missions at 1440 and 390, numbers that agree (map = list = drawer = briefing = AI, KPI =
 * econSeries / econPulse, op effect = marketOps.effectPct, loan Σ), the anonymity crawl over 12 months, ?focus=
 * arrivals, chain hops ≤ 1 s, roles, EN, reduced motion, regions and a no-dead-controls crawl. Not DEMO_READY yet:
 * `?controls=all`.
 */
import type { Page } from '@playwright/test'
import { expect, test } from '../fixtures'

test.describe.configure({ timeout: 120_000 })

/* eslint-disable @typescript-eslint/no-explicit-any */
type G = any
const SLUG = 'indeks-ekonomi'
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } as const
const noise = (e: string): boolean => !/api\/ai|ERR_CONNECTION_REFUSED|ERR_FAILED|ERR_ABORTED|net::ERR_|Failed to load resource/.test(e)
const nf1 = (n: number, lang = 'id') => n.toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

async function open(page: Page, extra = '', o: { run?: boolean } = {}): Promise<void> {
  await page.goto(`/demo/${SLUG}?controls=all&off=preloader&e2e=1${extra ? `&${extra}` : ''}`)
  await page.waitForFunction(() => (window as G).__gamada?.world.status() === 'ready', null, { timeout: 60_000 })
  await expect(page.locator('.dk-ie:not(.dk-ie-skel)').first()).toBeVisible({ timeout: 30_000 })
  if (!o.run) await page.evaluate(() => (window as G).__gamada.clock.pause())
}
/** load the PD chains (a real visitor's first click does it) */
const chains = (page: Page) => page.evaluate(() => (window as G).__gamada.ensure('pasar-daerah'))
const W = <T>(page: Page, body: string): Promise<T> => page.evaluate(`(() => { const g = window.__gamada; const s = g.world.get(); ${body} })()`) as Promise<T>
const settled = (page: Page) => page.evaluate(() => (window as G).__gamada.settled())
const missions = (page: Page) => page.evaluate(() => localStorage.getItem('gamada:demo:missions:indeks-ekonomi') ?? '')
const tab = async (page: Page, id: string) => {
  await page.locator(`#dk-ie-tab-${id}`).click()
  await expect(page.locator(`#dk-ie-tab-${id}`)).toHaveAttribute('aria-selected', 'true')
}
const noHScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
/** latest month's frame (values / hidden / rank) read from the world */
const latestFrame = (page: Page) =>
  W<{ ym: string; vals: Record<string, number | null>; hidden: string[]; low: string }>(
    page,
    `const ms = Object.values(s.econIndex.byId).map((c) => c.month).sort(); const ym = ms[ms.length - 1];
     const vals = {}; const hidden = [];
     for (const k of s.region.kecamatan) { const c = s.econIndex.byId[k.id + ':' + ym]; if (!c) continue; if (c.businesses < 10) { vals[k.id] = null; hidden.push(k.id) } else vals[k.id] = c.index }
     const low = Object.entries(vals).filter(([, v]) => v != null).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))[0][0];
     return { ym, vals, hidden, low }`,
  )

test.describe('indeks-ekonomi · desktop', () => {
  test('alive within 10 s: the clock runs and a 07:01 sale lands in the KPI pulse', async ({ page, errors }) => {
    const t0 = Date.now()
    await open(page, 'autoplay=1', { run: true })
    const kpi = page.locator('.dk-ie-kpis > *').nth(3)
    // the pulse = Σ salesDaily day 0 tx (= Toko Autopilot outletKpis().total.tx, world self-test)
    const worldTx = () => W<number>(page, 'let t = 0; for (const id of s.salesDaily.ids) { const d = s.salesDaily.byId[id]; if (d.day === 0) t += d.tx } return t')
    const tx0 = await worldTx()
    await expect(kpi).toContainText(String(tx0))
    await expect.poll(() => page.evaluate(() => (window as G).__gamada.clock.get().running), { timeout: 5000 }).toBe(true)
    await expect.poll(worldTx, { timeout: Math.max(1000, 10_000 - (Date.now() - t0) + 4000) }).toBeGreaterThan(tx0)
    await expect(kpi).toContainText(String(await worldTx()), { timeout: 3000 })
    expect(errors.filter(noise)).toEqual([])
  })

  test('missions 1–4 by script, confetti + related card; banjir C35 by the formula with delta chip and event row', async ({ page, errors }) => {
    await open(page)
    await chains(page)
    // 1 · time-lapse: Play runs the 12 months in ≤ 9 s (+ slack)
    const t0 = Date.now()
    await page.locator('[data-hotspot="ie-play"] .dk-mts-play').click()
    await expect.poll(() => missions(page), { timeout: 12_000 }).toContain('timelapse')
    expect(Date.now() - t0).toBeLessThan(12_000)
    await expect(page.locator('[data-hotspot="ie-play"] output')).toContainText('November 2026')
    // 2 · flood ⇒ C35 econ.updated kind banjir (source indeks-ekonomi) ≤ 1 s after the alert
    const f = await latestFrame(page)
    const before = await W<Record<string, { index: number; risk: number }>>(page, `const o = {}; for (const k of s.region.kecamatan) { const c = s.econIndex.byId[k.id + ':${f.ym}']; if (c) o[k.id] = { index: c.index, risk: k.riskFlood } } return o`)
    await page.locator('[data-ie="play-flood"]').click()
    await page.waitForFunction(() => Object.values((window as G).__gamada.world.get().alerts.byId).some((a: G) => a.kind === 'banjir' && a.status === 'aktif'), null, { timeout: 5000 })
    const tAlert = Date.now()
    await page.waitForFunction(() => Object.values((window as G).__gamada.world.get().econIndex.byId).some((c: G) => (c.events ?? []).some((e: G) => e.kind === 'banjir')), null, { timeout: 2000 })
    expect(Date.now() - tAlert).toBeLessThan(1000)
    await settled(page)
    const ev = await W<{ kec: string; index: number; delta: number }[]>(page, `const out = []; for (const id of s.econIndex.ids) { const c = s.econIndex.byId[id]; for (const e of c.events ?? []) if (e.kind === 'banjir') out.push({ kec: c.kecamatanId, index: e.index, delta: e.delta }) } return out`)
    expect(ev.length).toBeGreaterThan(0)
    for (const e of ev) expect(e.index).toBeCloseTo(Math.round(before[e.kec]!.index * (1 - (0.04 + 0.05 * before[e.kec]!.risk)) * 10) / 10, 5)
    await expect.poll(() => missions(page)).toContain('banjir')
    await page.locator('[data-ie="flood-banner"]').click()
    const lowEv = ev.filter((e) => !f.hidden.includes(e.kec)).sort((a, b) => a.index - b.index)[0]!
    await expect(page.locator(`[data-ie="rank"] li[data-kec="${lowEv.kec}"] [data-ie="delta-chip"]`)).toHaveText(new RegExp(`^−${nf1(Math.abs(lowEv.delta)).replace('.', '\\.')}$`))
    await expect(page.locator('[data-ie="feed"]')).toBeVisible({ timeout: 5000 })
    const kName = await W<string>(page, `return s.region.kecamatan.find((k) => k.id === '${lowEv.kec}').name`)
    await expect(page.locator('[data-ie="feed"]')).toContainText(`Kec. ${kName}`)
    // 3 · Dampak: the seeded past op (OP-0001) measured; effect = marketOps.effectPct (= Sinyal Pasar)
    await tab(page, 'dampak')
    const op = await W<{ id: string; effectPct: number }>(page, 'const id = s.meta.facts.pd.pastOpId; return { id, effectPct: s.marketOps.byId[id].effectPct }')
    await page.locator(`[data-program="${op.id}"]`).click()
    await page.locator('[data-ie="measure"]').click()
    await expect(page.locator('[data-ie="impact"] [data-ie="effect"]')).toHaveText(`−${Math.abs(op.effectPct)}%`)
    await expect(page.locator('[data-ie="impact"]')).toContainText('selisih-ganda (simulasi)')
    await expect.poll(() => missions(page)).toContain('dampak')
    // 4 · Briefing: one export = one econ.briefed (a double tap stays one)
    await tab(page, 'briefing')
    const n0 = await W<number>(page, `return Object.values(s.auditLog.byId).filter((a) => a.type === 'econ.briefed').length`)
    const dl = page.waitForEvent('download')
    await page.locator('[data-ie="export-download"]').dblclick()
    expect((await dl).suggestedFilename()).toBe(`briefing-ekonomi-bojonegoro-${f.ym}.html`)
    await settled(page)
    await expect.poll(() => W<number>(page, `return Object.values(s.auditLog.byId).filter((a) => a.type === 'econ.briefed').length`)).toBe(n0 + 1)
    await expect.poll(() => missions(page)).toContain('briefing')
    await expect(page.getByText(/Lanjut ke produk terkait/).first()).toBeAttached({ timeout: 10_000 })
    expect(errors.filter(noise)).toEqual([])
  })

  test('numbers agree: map cell = list = drawer = briefing = AI; KPI = econSeries; hidden set identical', async ({ page, errors }) => {
    await open(page)
    const f = await latestFrame(page)
    const v = f.vals[f.low]!
    const row = page.locator(`[data-ie="rank"] li[data-kec="${f.low}"]`)
    await expect(row.locator('[data-val]')).toHaveText(nf1(v))
    // KPI hidden count + kabupaten index (business-weighted, as econSeries(null))
    await expect(page.locator('.dk-ie-kpis > *').nth(2)).toContainText(String(f.hidden.length))
    const kab = await W<number>(page, `let w = 0, a = 0; for (const k of s.region.kecamatan) { const c = s.econIndex.byId[k.id + ':${f.ym}']; if (c) { w += c.businesses; a += c.index * c.businesses } } return Math.round(a / w * 10) / 10`)
    await expect(page.locator('.dk-ie-kpis > *').first()).toContainText(nf1(kab))
    // drawer
    await row.locator('button').click()
    await expect(page.locator('[data-ie="drawer-index"]')).toHaveText(nf1(v))
    await page.keyboard.press('Escape')
    // briefing paper
    await tab(page, 'briefing')
    await expect(page.locator(`[data-ie="paper"] li[data-kec="${f.low}"] [data-val]`)).toContainText(nf1(v))
    await expect(page.locator('[data-ie="paper-kab"]')).toHaveText(nf1(kab))
    for (const h of f.hidden) await expect(page.locator(`[data-ie="paper"] li[data-kec="${h}"] [data-val]`)).toHaveCount(0)
    // AI (sim) names the same number
    await page.locator('[data-ie="ask"]').click()
    const lowName = await W<string>(page, `return s.region.kecamatan.find((k) => k.id === '${f.low}').name`)
    await page.locator('[data-ie="assist"] .dk-chip').first().click()
    await expect(page.locator('[data-ie="assist"]')).toContainText(`${lowName}`, { timeout: 8000 })
    await expect(page.locator('[data-ie="assist"]')).toContainText(nf1(v), { timeout: 8000 })
    expect(errors.filter(noise)).toEqual([])
  })

  test('anonymity crawl: 12 months on list, map spec, drawer, sectors, briefing and AI never show a hidden number', async ({ page, errors }) => {
    await open(page)
    const f = await latestFrame(page)
    expect(f.hidden.length).toBe(2)
    const range = page.locator('[data-hotspot="ie-play"] input[type="range"]')
    await range.focus()
    await page.keyboard.press('Home')
    for (let i = 0; i < 12; i++) {
      if (i) await page.keyboard.press('ArrowRight')
      for (const h of f.hidden) {
        const li = page.locator(`[data-ie="rank"] li[data-kec="${h}"]`)
        await expect(li).toHaveAttribute('data-hidden', 'true')
        await expect(li.locator('[data-val]')).toHaveCount(0)
      }
    }
    // the keyboard visit of all 12 months also completes the time-lapse mission
    await expect.poll(() => missions(page)).toContain('timelapse')
    // world: hidden cells never carry a visible value in any month
    const leaks = await W<number>(page, `let n = 0; for (const id of s.econIndex.ids) { const c = s.econIndex.byId[id]; if (c.businesses < 10 && !${JSON.stringify(f.hidden)}.includes(c.kecamatanId)) n++ } return n`)
    expect(leaks).toBe(0)
    // drawer of a hidden kecamatan: hatch + text only
    await page.locator(`[data-ie="rank"] li[data-kec="${f.hidden[0]}"] button`).click()
    await expect(page.locator('[data-ie="drawer-hidden"]')).toBeVisible()
    await expect(page.locator('[data-ie="drawer-index"]')).toHaveCount(0)
    await page.keyboard.press('Escape')
    // AI: a hidden kecamatan ⇒ the fixed anonymity answer
    const hName = await W<string>(page, `return s.region.kecamatan.find((k) => k.id === '${f.hidden[0]}').name`)
    await page.locator('[data-ie="ask"]').click()
    await page.locator('[data-ie="assist"] textarea, [data-ie="assist"] input[type="text"]').first().fill(`Jelaskan kecamatan ${hName}`)
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-ie="assist"]')).toContainText('disembunyikan untuk menjaga anonimitas', { timeout: 8000 })
    expect(errors.filter(noise)).toEqual([])
  })

  test('chain C34: an operation running ⇒ econ.updated program ≤ 1 s, then ?focus=OP- lands on Dampak (projection)', async ({ page, errors }) => {
    await open(page)
    await chains(page)
    const id = await page.evaluate(() => (window as G).__gamada.emit('market.operation', { stage: 'recommended', commodityId: 'beras-medium', marketIds: ['pasar-kota-bojonegoro'], effectPct: -8, volumeTon: 10, days: 3, sentBy: 'disperindag', reason: { id: 'Operasi pasar uji', en: 'Test operation' } }, 'sinyal-pasar').payload.id)
    await settled(page)
    const opId = id ?? (await W<string>(page, `return Object.values(s.marketOps.byId).sort((a, b) => b.at - a.at)[0].id`))
    const before = await W<number>(page, `const ms = Object.values(s.econIndex.byId).map((c) => c.month).sort(); return s.econIndex.byId['bojonegoro:' + ms[ms.length - 1]].index`)
    const t0 = Date.now()
    await page.evaluate((x) => (window as G).__gamada.emit('market.operation', { id: x, stage: 'running', commodityId: 'beras-medium', marketIds: ['pasar-kota-bojonegoro'] }, 'sinyal-pasar'), opId)
    await page.waitForFunction((x) => Object.values((window as G).__gamada.world.get().econIndex.byId).some((c: G) => (c.events ?? []).some((e: G) => e.kind === 'program' && e.cause === `marketOps:${x}`)), opId, { timeout: 2000 })
    expect(Date.now() - t0).toBeLessThan(1000)
    const after = await W<number>(page, `const ms = Object.values(s.econIndex.byId).map((c) => c.month).sort(); return s.econIndex.byId['bojonegoro:' + ms[ms.length - 1]].index`)
    expect(after).toBeCloseTo(before + 2, 5)
    // the reload must not race the world's save (debounced 120 ms after a user event, after every reaction settled)
    await settled(page)
    await page.waitForTimeout(600)
    await page.goto(`/demo/${SLUG}?controls=all&off=preloader&e2e=1&focus=${opId}`)
    await expect(page.locator('#dk-ie-tab-dampak')).toHaveAttribute('aria-selected', 'true', { timeout: 30_000 })
    await expect(page.locator(`[data-ie="impact"][data-program="${opId}"]`)).toBeVisible()
    await expect(page.locator('[data-ie="impact"] [data-ie="effect"]')).toHaveText('−8%')
    await expect(page.locator('[data-ie="impact"]')).toContainText('proyeksi')
    expect(errors.filter(noise)).toEqual([])
  })

  test('?focus= arrivals: kec:month → Peta + month + drawer; LN- → Dampak modal; bad id → toast + default', async ({ page, errors }) => {
    await open(page)
    const f = await latestFrame(page)
    const months = await W<string[]>(page, `return [...new Set(Object.values(s.econIndex.byId).map((c) => c.month))].sort()`)
    await open(page, `focus=${f.low}:${months[5]}`)
    await expect(page.locator('#dk-ie-tab-peta')).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('[data-ie="drawer"]')).toHaveAttribute('data-kec', f.low)
    const label = new Date(Number(months[5]!.slice(0, 4)), Number(months[5]!.slice(5, 7)) - 1, 15).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
    await expect(page.locator('[data-hotspot="ie-play"] output')).toContainText(label)
    await expect(page.locator(`[data-ie="rank"] li[data-kec="${f.low}"]`)).toHaveClass(/is-sel/)
    const loan = await W<string>(page, `return Object.values(s.loanApps.byId).find((l) => l.status === 'disetujui').id`)
    await open(page, `focus=${loan}`)
    await expect(page.locator('[data-ie="impact"][data-program="modal-kerja"]')).toBeVisible()
    await open(page, 'focus=XX-9999')
    await expect(page.getByText('Data tidak ditemukan').first()).toBeVisible()
    await expect(page.locator('#dk-ie-tab-peta')).toHaveAttribute('aria-selected', 'true')
    expect(errors.filter(noise)).toEqual([])
  })

  test('Kepala Daerah: Ringkasan, instruction carries the econIndex ref ⇒ C7 letter ≤ 1 s, then Briefing', async ({ page, errors }) => {
    await open(page, 'role=kepala-daerah')
    await chains(page)
    await expect(page.locator('#dk-ie-tab-ringkasan')).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('[data-ie="ringkasan"] .dk-ie-head')).toHaveCount(3)
    const f = await latestFrame(page)
    await page.locator('[data-ie="instruct"]').click()
    await expect(page.locator('[data-ie="instruct-dialog"]')).toBeVisible()
    const name = await W<string>(page, `return s.region.kecamatan.find((k) => k.id === '${f.low}').name`)
    await expect(page.locator('[data-ie="instruct-dialog"] textarea')).toHaveValue(new RegExp(`Kec\\. ${name}`))
    const t0 = Date.now()
    await page.locator('[data-ie="instruct-send"]').click()
    await page.waitForFunction((r) => Object.values((window as G).__gamada.world.get().instructions.byId).some((i: G) => i.refs.includes(r) && i.letterId), `econIndex:${f.low}:${f.ym}`, { timeout: 3000 })
    expect(Date.now() - t0).toBeLessThan(1500)
    const ins = await W<G>(page, `return Object.values(s.instructions.byId).find((i) => i.refs.includes('econIndex:${f.low}:${f.ym}'))`)
    expect(ins.opdIds).toEqual(['diskopumkm', 'disperindag', 'bappeda'])
    await expect(page.locator('#dk-ie-tab-briefing')).toHaveAttribute('aria-selected', 'true')
    // ⋯ menu: Sektor / Harga
    await page.getByRole('button', { name: 'Bagian lain' }).click()
    await page.getByRole('menuitem', { name: 'Harga' }).click()
    await expect(page.locator('[data-ie="harga"]')).toBeVisible()
    expect(errors.filter(noise)).toEqual([])
  })

  test('Dinkop: lands on Sektor, aggregates only (no business name), loan Σ = approved loans', async ({ page, errors }) => {
    await open(page, 'role=dinkop')
    await expect(page.locator('#dk-ie-tab-sektor')).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('[data-ie="dinkop"]')).toBeVisible()
    const text = await page.locator('[data-ie="sektor"]').innerText()
    const names = await W<string[]>(page, 'return Object.values(s.businesses.byId).map((b) => b.name)')
    expect(names.filter((n) => n.length > 6 && text.includes(n))).toEqual([])
    const sum = await W<{ n: number; amt: number }>(page, `const l = Object.values(s.loanApps.byId).filter((x) => x.status === 'disetujui'); return { n: l.length, amt: l.reduce((a, x) => a + (x.decidedAmount ?? x.amount), 0) }`)
    await expect(page.locator('[data-ie="modal-card"]')).toContainText(`${sum.n} pinjaman`)
    await expect(page.locator('[data-ie="modal-card"]')).toContainText(`Rp ${(sum.amt / 1e6).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} jt`)
    await expect(page.locator('[data-ie="sektor"]')).toContainText('(simulasi)')
    await tab(page, 'dampak')
    await expect(page.locator('[data-program="modal-kerja"]')).toHaveAttribute('aria-checked', 'true')
    expect(errors.filter(noise)).toEqual([])
  })

  test('EN + role switch keeps month and selection; Harga lines (Bandung / Padang packs: Tahap 7)', async ({ page, errors }) => {
    await open(page, 'lang=en')
    await expect(page.locator('#dk-ie-tab-peta')).toHaveText('Map')
    await expect(page.locator('.dk-ie-kpis')).toContainText('Regency index')
    const range = page.locator('[data-hotspot="ie-play"] input[type="range"]')
    await range.focus()
    await page.keyboard.press('ArrowLeft')
    await expect(page.locator('[data-hotspot="ie-play"] output')).toContainText('October 2026')
    const first = page.locator('[data-ie="rank"] li').first()
    const kec = (await first.getAttribute('data-kec'))!
    await first.locator('button').click()
    await expect(page.locator('[data-ie="drawer"]')).toBeVisible()
    await page.keyboard.press('Escape')
    await tab(page, 'harga')
    await expect(page.locator('[data-ie="harga"] svg').first()).toBeVisible()
    await tab(page, 'peta')
    // role switch (top bar): Bappeda → Dinkop keeps the Map tab, October and the selection
    await page.locator('.dk-topbar').getByRole('button', { name: /Switch role|Ganti peran/ }).first().click()
    await page.getByRole('option', { name: /^(Dinas Koperasi|Cooperatives)/ }).first().click()
    await expect(page.locator('.dk-ie[data-role="dinkop"]')).toBeVisible()
    await expect(page.locator('#dk-ie-tab-peta')).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('[data-hotspot="ie-play"] output')).toContainText('October 2026')
    await expect(page.locator(`[data-ie="rank"] li[data-kec="${kec}"]`)).toHaveClass(/is-sel/)
    expect(errors.filter(noise)).toEqual([])
  })
})

test.describe('indeks-ekonomi · reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })
  test('Play steps month by month and still completes the mission; no idle ticker', async ({ page, errors }) => {
    await open(page)
    await page.locator('[data-hotspot="ie-play"] .dk-mts-play').click()
    await expect.poll(() => missions(page), { timeout: 14_000 }).toContain('timelapse')
    await expect(page.locator('[data-hotspot="ie-play"] output')).toContainText('November 2026')
    await open(page, 'static=1&off=demoAnimations')
    await expect(page.locator('[data-ie="rank"] li').first()).toBeVisible()
    expect(errors.filter(noise)).toEqual([])
  })
})

test.describe('indeks-ekonomi · phone 390', () => {
  test.use(PHONE)
  test('missions on a phone; no horizontal scroll on any tab; 44 px tabs; guide pill visible; briefing drawer export', async ({ page, errors }) => {
    await open(page)
    await chains(page)
    await expect(page.locator('.dk-mpill, .dk-guide-pill, [class*="mpill"]').first()).toBeVisible()
    for (const t of ['peta', 'sektor', 'harga', 'dampak', 'briefing']) {
      await tab(page, t)
      await page.waitForTimeout(300)
      expect(await noHScroll(page), t).toBe(true)
      const h = await page.locator(`#dk-ie-tab-${t}`).evaluate((el) => el.getBoundingClientRect().height)
      expect(h).toBeGreaterThanOrEqual(44)
    }
    // dampak on a phone: Segmented picker
    await tab(page, 'dampak')
    await page.locator('[data-ie="measure"]').click()
    await expect.poll(() => missions(page)).toContain('dampak')
    // briefing: preview in a full-screen drawer with the export at its end
    await tab(page, 'briefing')
    await page.locator('[data-ie="open-preview"]').click()
    const dl = page.waitForEvent('download')
    await page.locator('[data-ie="export-download"]').click()
    await dl
    await expect.poll(() => missions(page)).toContain('briefing')
    await page.keyboard.press('Escape')
    // time-lapse + flood on the phone
    await tab(page, 'peta')
    await page.locator('[data-hotspot="ie-play"] .dk-mts-play').click()
    await expect.poll(() => missions(page), { timeout: 12_000 }).toContain('timelapse')
    await page.locator('[data-ie="play-flood"]').click()
    await expect.poll(() => missions(page), { timeout: 5000 }).toContain('banjir')
    expect(await noHScroll(page)).toBe(true)
    expect(errors.filter(noise)).toEqual([])
  })
})

/* ------------------------------------------------------------------ no dead controls */

const CONTROLS = '#dk-ie-panel :is(button:not(.dk-mts-play):not([aria-label*="Perbesar"]):not([aria-label*="Perkecil"]), [role="radio"], a[href], select, input[type="checkbox"])'
async function crawl(page: Page): Promise<string[]> {
  const dead: string[] = []
  for (let i = 0; i < 24; i++) {
    const r = await page.evaluate(
      async ([sel, idx]) => {
        const els = Array.from(document.querySelectorAll<HTMLElement>(sel)).filter((el) => {
          const b = el.getBoundingClientRect()
          const cur = (el.getAttribute('role') === 'radio' && el.getAttribute('aria-checked') === 'true') || el.getAttribute('aria-current') === 'true'
          return !cur && b.width > 0 && b.height > 0 && !(el as HTMLButtonElement).disabled && !el.closest('[inert]') && !el.closest('.maplibregl-ctrl')
        })
        const el = els[idx as number]
        if (!el) return null
        const label = (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 50)
        if (el instanceof HTMLAnchorElement) return { label, changed: !!el.getAttribute('href') }
        const w = window as unknown as { __gamada: { onEvent(t: string, fn: () => void): () => void } }
        let changed = false
        const mo = new MutationObserver(() => (changed = true))
        mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true })
        const off = w.__gamada.onEvent('*', () => (changed = true))
        const url = location.href
        el.scrollIntoView({ block: 'center' })
        el.click()
        for (let t = 0; t < 30 && !changed && location.href === url; t++) await new Promise((res) => setTimeout(res, 100))
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

test('no dead controls · every tab × role', async ({ page, errors }) => {
  test.setTimeout(300_000)
  await page.addInitScript(() => {
    window.print = () => undefined
  })
  const dead: string[] = []
  for (const [role, tabs] of [['bappeda', ['peta', 'sektor', 'harga', 'dampak', 'briefing']], ['dinkop', ['sektor']], ['kepala-daerah', ['ringkasan']]] as const) {
    for (const t of tabs) {
      await open(page, `role=${role}&tab=${t}`)
      await page.waitForTimeout(800)
      dead.push(...(await crawl(page)).map((x) => `${role}/${t}: ${x}`))
    }
  }
  expect(dead).toEqual([])
  expect(errors.filter(noise)).toEqual([])
})
