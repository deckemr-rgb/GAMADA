/**
 * P15 Rapor Usaha (spec §11, plan docs/build/tahap4-plan.md §2 P15): every GuidePanel mission by script, the numbers
 * that must agree (dial = bizScores, waterfall sums to the score, plafon / cicilan identical in the owner simulation,
 * the bank drawer, the approval card and the C38 disbursal journal), ?focus= arrivals, the chain hops that name Rapor
 * Usaha (C19 review ⇒ score, L7 tax.ready ⇒ 820 + plafon 150 jt, L8 hero KYB ⇒ bank row 692 → 790, L12 consent ⇒
 * bank scopes, C37 shop order paid ⇒ "Data masuk" journal row, C38 approval ⇒ disbursal journal), alive within
 * 10 s, phone 390 (EN), reduced motion. Before DEMO_READY the product opens with ?controls=all.
 */
import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures'

test.describe.configure({ timeout: 150_000 })

const SLUG = 'rapor-usaha'
const LENDER = 'Koperasi Mitra Usaha Sejahtera'
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } as const
const notNoise = (e: string): boolean => !/api\/ai|ERR_CONNECTION_REFUSED|ERR_FAILED|ERR_ABORTED|net::ERR_/.test(e)
type Ev = { type: string; source: string; payload: Record<string, unknown> }

async function open(page: Page, o: { lang?: 'id' | 'en'; role?: string; extra?: string; run?: boolean } = {}): Promise<void> {
  const q = new URLSearchParams({ controls: 'all', off: 'preloader', e2e: '1' })
  if (o.lang) q.set('lang', o.lang)
  if (o.role) q.set('role', o.role)
  await page.goto(`/demo/${SLUG}?${q.toString()}${o.extra ? `&${o.extra}` : ''}`)
  await page.waitForFunction(() => (window as unknown as { __gamada?: { world: { status(): string } } }).__gamada?.world.status() === 'ready', null, { timeout: 45_000 })
  await expect(page.locator('.dk-ru-wf, [data-ru="approve"]').first()).toBeVisible({ timeout: 30_000 })
  if (!o.run) await page.evaluate(() => (window as unknown as { __gamada: { clock: { pause(): void } } }).__gamada.clock.pause())
}
function W<T>(page: Page, expr: string): Promise<T> {
  return page.evaluate((x) => {
    const s = (window as unknown as { __gamada: { world: { get(): unknown } } }).__gamada.world.get()
    // eslint-disable-next-line no-new-func
    return new Function('s', `return (${x})`)(s) as T
  }, expr)
}
async function emitAll(page: Page, list: [string, unknown, string][]): Promise<Ev[]> {
  return page.evaluate(async (items) => {
    type G = { emit(t: string, p: unknown, s: string): void; settled(): Promise<void>; onEvent(t: string, fn: (e: Ev) => void): () => void; ensure(e: string): Promise<void> }
    const g = (window as unknown as { __gamada: G }).__gamada
    await g.ensure('pasar-daerah')
    await g.ensure('usaha-pintar')
    const seen: Ev[] = []
    const off = g.onEvent('*', (e) => seen.push({ type: e.type, source: e.source, payload: e.payload }))
    for (const [t, p, s] of items) g.emit(t, p, s)
    await g.settled()
    off()
    return seen
  }, list)
}
const missionsDone = (page: Page) => page.evaluate((s) => JSON.parse(localStorage.getItem(`gamada:demo:missions:${s}`) ?? '[]') as string[], SLUG)
const shopScore = (page: Page) => W<number>(page, `s.bizScores.byId[s.meta.shopId].score`)
const dialText = async (page: Page) => Number(await page.locator('[data-ru="score"]').textContent())
const num = (t: string | null) => Number((t ?? '').replace(/[^\d]/g, ''))
async function closeGuide(page: Page): Promise<void> {
  const guide = page.locator('.dk-guide:not([hidden])')
  if (await guide.count()) {
    const btn = guide.getByRole('button', { name: /Tutup|Close/ }).first()
    if (await btn.isVisible().catch(() => false)) await btn.click()
  }
}

test('Rapor Usaha · 5 missions + numbers agree: 710 → 740 → 820, plafon 150 jt, cicilan 13.775.000 on both sides + C38 journal (1440, ID)', async ({ page, errors }) => {
  await open(page)
  // fresh 710 · "−40 vs Okt" · ribbon · dial = bizScores
  expect(await shopScore(page)).toBe(710)
  await expect(page.locator('[data-ru="score"]')).toHaveText('710')
  await expect(page.locator('[data-ru="delta"]')).toHaveText('−40 vs Okt')
  await expect(page.locator('.dk-ru-ribbon')).toContainText('Skor simulasi · bukan keputusan kredit')
  await expect(page.locator('[data-ru="band"]')).toHaveText('Baik')
  // waterfall: peer + Σ points = 710 (read from the DOM)
  const pts = await page.locator('.dk-ru-wf [data-points]').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-points'))))
  expect(pts).toHaveLength(6)
  const peer = num(await page.locator('.dk-ru-wf-row.is-base b').textContent())
  expect(peer + pts.reduce((a, x) => a + x, 0)).toBe(710)
  await expect(page.locator('[data-ru="wf-total"]')).toHaveText('710')
  // history[11] = score; "Data masuk" = today's sales of the shop (outletKpis().total.tx)
  expect(await W<number>(page, `s.bizScores.byId[s.meta.shopId].history[11] ?? s.bizScores.byId[s.meta.shopId].score`)).toBeGreaterThan(0)
  const tx = await W<number>(page, `Object.values(s.sales.byId).filter((x) => x.businessId === s.meta.shopId && x.at >= 0).length`)
  await expect(page.locator('[data-ru="feed-sales"]')).toHaveAttribute('data-tx', String(tx))
  // exactly 3 actions, the first pulses
  await expect(page.locator('.dk-ru-act')).toHaveCount(3)
  await expect(page.locator('.dk-ru-act').first()).toHaveAttribute('data-hotspot', 'ru-fix')
  await expect(page.locator('.dk-ru-act').first()).toContainText('+30 poin')

  // 1 · factor drawer
  await page.locator('[data-ru="factor"]').nth(2).click()
  await expect(page.locator('[data-ru="factor-drawer"]')).toHaveAttribute('data-factor', 'pajak')
  await expect.poll(() => missionsDone(page)).toContain('faktor')
  await page.keyboard.press('Escape')

  // 2 · Rapikan 3 jurnal ⇒ 3 ledger.reviewed (rapor-usaha) ⇒ C19 +10 each ⇒ 740; review count 3 = Pajak Beres pendingReviews
  expect(await W<number>(page, `Object.values(s.ledger.byId).filter((j) => j.businessId === s.meta.shopId && j.needsReview).length`)).toBe(3)
  await page.locator('[data-ru="fix"]').first().click()
  await expect(page.locator('.dk-ru-review-row')).toHaveCount(3)
  await page.locator('[data-ru="approve-reviews"]').click()
  await expect.poll(() => shopScore(page), { timeout: 8000 }).toBe(740)
  await expect.poll(() => dialText(page)).toBe(740)
  // T5 (d): the live line names the change since the session start (+30), the last step (+10) apart
  await expect(page.locator('.dk-ru-dialcard [aria-live]')).toHaveText('Skor sekarang 740 (+30 sejak awal sesi; langkah terakhir +10)')
  await expect.poll(() => missionsDone(page)).toContain('naik')
  expect(await W<string[]>(page, `Object.values(s.ledger.byId).filter((j) => j.businessId === s.meta.shopId && j.reviewed).map((j) => j.lines.reduce((a, l) => a + l.debit - l.credit, 0) === 0)`)).toEqual([true, true, true])
  await page.keyboard.press('Escape')

  // L7 · tax.ready (Pajak Beres) ⇒ pajak factor flashes, 820 ≤ 1 s, plafon 100 → 150 jt
  const before = await page.locator('[data-factor="pajak"] [data-points]').getAttribute('data-points')
  await emitAll(page, [['tax.ready', { businessId: await W<string>(page, 's.meta.shopId'), period: await W<string>(page, 's.day.slice(0, 7)'), taxItemIds: await W<string[]>(page, `Object.values(s.taxItems.byId).filter((t) => t.businessId === s.meta.shopId && t.status === 'perlu-hitung').map((t) => t.id)`) }, 'pajak-beres']])
  await expect.poll(() => dialText(page), { timeout: 1000 }).toBe(820)
  expect(await shopScore(page)).toBe(820)
  await expect(page.locator('[data-factor="pajak"] [data-points]')).not.toHaveAttribute('data-points', before ?? '')
  await expect(page.locator('[data-ru="band"]')).toHaveText('Sangat baik')

  // 3 · Modal kerja: no consent ⇒ disabled with reason; share ⇒ consent.granted
  await page.getByRole('tab', { name: 'Modal kerja' }).click()
  await expect(page.locator('[data-ru="apply-reason"]')).toContainText('Bagikan data')
  await expect(page.locator('[data-ru="apply-btn"]')).toBeDisabled()
  await page.locator('[data-ru="grant"]').click()
  await expect.poll(() => missionsDone(page)).toContain('bagikan')
  await expect(page.locator('[data-ru="consent-ok"]')).toBeVisible()
  // 4 · 150 jt / 12 bln ⇒ 13.775.000 (0,85 %), DSR ≤ 35 %
  await expect(page.locator('[data-ru="plafon"]')).toContainText('Rp 150 jt')
  await expect(page.locator('[data-ru="installment"]')).toHaveText('Rp 13.775.000')
  await expect(page.locator('[data-ru="rate"]')).toHaveText('0,85%')
  await page.locator('[data-ru="apply-btn"]').click()
  await expect.poll(() => missionsDone(page)).toContain('ajukan')
  await expect(page.locator('[data-ru="timeline"]')).toHaveAttribute('data-status', 'diajukan')
  const loan = await W<{ id: string; amount: number; installment: number; ratePct: number; consentId: string }>(page, `Object.values(s.loanApps.byId).find((l) => l.businessId === s.meta.shopId)`)
  expect(loan).toMatchObject({ amount: 150_000_000, installment: 13_775_000, ratePct: 0.85 })
  expect(loan.consentId).toMatch(/^IZ-/)
  await expect(page.locator('[data-ru="apply-reason"]')).toContainText(loan.id)
  // owner mirror (Sisi Bank/Koperasi) shows the application
  await expect(page.locator('[data-ru="mirror"]')).toContainText('Menunggu tinjauan analis')

  // 5 · "Buka sebagai Koperasi" (real role switch) ⇒ drawer: same cicilan; consented scopes only; approve
  await page.locator('[data-ru="open-bank"]').click()
  await expect(page.locator('[data-ru="bank-drawer"]')).toHaveAttribute('data-loan', loan.id)
  await expect(page.locator('[data-ru="bd-installment"]')).toHaveText('Rp 13.775.000')
  await expect(page.locator('[data-ru="bd-score"]')).toContainText('820')
  await expect(page.locator('[data-scope="pajak"]')).toContainText('Tidak dibagikan pemilik')
  await expect(page.locator('[data-scope="omzet"]')).toHaveAttribute('data-shared', 'true')
  await page.locator('[data-ru="approve-btn"]').click()
  await expect.poll(() => missionsDone(page)).toContain('setujui')
  await expect(page.locator('[data-ru="bd-decided"]')).toContainText('Rp 13.775.000')
  // owner mirror on the bank side ≤ 1 s
  await expect(page.locator('[data-ru="mirror"] [data-status="disetujui"]')).toBeVisible({ timeout: 1000 })
  // C38: disbursal journal Bank D / Utang Pinjaman C = approved amount, balanced
  const jr = await W<{ d: number; c: number; acc: string[] } | null>(page, `(() => { const j = Object.values(s.ledger.byId).find((x) => x.source === 'pinjaman' && x.refId === '${loan.id}'); return j ? { d: j.lines.reduce((a, l) => a + l.debit, 0), c: j.lines.reduce((a, l) => a + l.credit, 0), acc: j.lines.map((l) => l.account) } : null })()`)
  expect(jr).toEqual({ d: 150_000_000, c: 150_000_000, acc: ['Bank', 'Utang Pinjaman'] })
  // back to the owner: timeline "Disetujui" + approval card with the same cicilan + Dicairkan
  await page.keyboard.press('Escape')
  await page.locator('[data-ru="open-owner"]').click()
  await expect(page.locator('[data-ru="timeline"]')).toHaveAttribute('data-status', 'disetujui')
  await expect(page.locator('[data-ru="approval-line"]')).toHaveAttribute('data-installment', '13775000')
  await expect(page.locator('[data-step="dicairkan"]')).toHaveAttribute('data-state', 'done')
  // all 5 missions ⇒ "Lanjut ke produk terkait"
  expect((await missionsDone(page)).sort()).toEqual(['ajukan', 'bagikan', 'faktor', 'naik', 'setujui'])
  await expect(page.getByText('Lanjut ke produk terkait').first()).toBeVisible()
  expect(errors.filter(notNoise)).toEqual([])
})

test('Rapor Usaha · bank: L8 hero KYB 692 → 790 + recommendation ≤ 1 s, consented scopes only, KYB request, decline, L12 consent ⇒ Riwayat', async ({ page, errors }) => {
  await open(page, { role: 'bank-mitra' })
  const hero = await W<string>(page, `s.meta.facts.up.kenalMitra.heroBusinessId`)
  const row = page.locator(`.dk-ru-qrow[data-biz="${hero}"]`)
  await expect(row.locator('[data-ru="score-now"]')).toContainText('692')
  await expect(row).toContainText('tinjau manual')
  // the queue score = KL / Kenal Mitra badge (BizBadges "Skor nnn")
  await expect(row.locator('.dk-bb.is-score')).toContainText('692')
  await row.locator('.dk-ru-qbtn').click()
  // unchecked scopes ⇒ "Tidak dibagikan pemilik"
  await expect(page.locator('[data-scope="pajak"]')).toContainText('Tidak dibagikan pemilik')
  await expect(page.locator('[data-scope="omzet"]')).toHaveAttribute('data-shared', 'true')
  // Minta verifikasi KYB ⇒ verification.requested (priority) on the open Kenal Mitra request, then disabled with the reason
  await page.locator('[data-ru="kyb-btn"]').click()
  await expect(page.locator('[data-ru="kyb-btn"]')).toBeDisabled()
  await expect(page.locator('[data-ru="bank-drawer"] .dk-ru-reason')).toContainText('diprioritaskan')
  expect(await W<number>(page, `Object.values(s.verificationRequests.byId).filter((r) => r.subjectId === '${hero}' && r.kind === 'kyb' && r.priority).length`)).toBe(1)
  await page.keyboard.press('Escape')
  // L8 · partner.verified ⇒ 692 → ≈ 790, recommendation changes ≤ 1 s
  await emitAll(page, [['partner.verified', { subjectKind: 'business', subjectId: hero, kind: 'kyb', result: 'lolos', score: 96 }, 'kenal-mitra']])
  await expect(row.locator('[data-ru="score-now"]')).not.toContainText('sekarang 692', { timeout: 1000 })
  const now = await W<number>(page, `s.bizScores.byId['${hero}'].score`)
  expect(Math.abs(now - 790)).toBeLessThanOrEqual(5)
  await expect(row.locator('[data-ru="score-now"]')).toContainText(`Skor sekarang ${now}`)
  await expect(row.locator('.dk-bb.is-score')).toContainText(String(now))
  await expect(row.locator('[data-ru="score-now"]')).toContainText('saat diajukan 692')
  await expect(row).not.toContainText('tinjau manual')
  // decline UD Bumi Terpal Lestari with a reason ⇒ loan.rejected, moves to Diputus
  const mis = await W<string>(page, `s.meta.facts.up.kenalMitra.mismatchBusinessId`)
  await page.locator(`.dk-ru-qrow[data-biz="${mis}"] .dk-ru-qbtn`).click()
  await page.locator('[data-ru="reject-btn"]').click()
  await expect(page.locator('[data-ru="bd-decided"]')).toContainText('Ditolak')
  expect(await W<string>(page, `Object.values(s.loanApps.byId).find((l) => l.businessId === '${mis}' && l.lender === '${LENDER}').status`)).toBe('ditolak')
  await page.keyboard.press('Escape')
  await page.getByRole('radio', { name: /Diputus/ }).click()
  await expect(page.locator(`.dk-ru-qrow[data-biz="${mis}"]`)).toBeVisible()
  // L12 · a consent granted by the owner shows in Riwayat
  const ev = await emitAll(page, [['consent.granted', { businessId: await W<string>(page, 's.meta.shopId'), lender: LENDER, scopes: ['omzet', 'laporan', 'kyb'], days: 30 }, 'rapor-usaha']])
  const cid = ev.find((e) => e.type === 'consent.granted')!.payload.id as string
  await page.getByRole('tab', { name: 'Riwayat' }).click()
  await expect(page.locator(`[data-hist="${cid}"]`)).toBeVisible({ timeout: 1000 })
  expect(errors.filter(notNoise)).toEqual([])
})

test('Rapor Usaha · disabled with reasons: revoke ⇒ apply blocked, amount above the limit, open application', async ({ page, errors }) => {
  await open(page)
  await page.getByRole('tab', { name: 'Berbagi data' }).click()
  await page.locator('[data-ru="grant"]').click()
  await expect(page.locator('.dk-ru-consent-row')).toHaveCount(1)
  // too-high amount (Rp 100 jt limit at 710)
  await page.getByRole('tab', { name: 'Modal kerja' }).click()
  await expect(page.locator('[data-ru="next-band"]')).toContainText('Capai 750 untuk plafon Rp 150 jt')
  await page.locator('[data-ru="amount"]').fill('120000000')
  await expect(page.locator('[data-ru="apply-reason"]')).toContainText('Melebihi plafon Rp 100 jt')
  await expect(page.locator('[data-ru="apply-btn"]')).toBeDisabled()
  await page.locator('[data-ru="amount"]').fill('100000000')
  await expect(page.locator('[data-ru="apply-btn"]')).toBeEnabled()
  await expect(page.locator('[data-ru="installment"]')).toHaveText('Rp 9.334.000')
  // revoke ⇒ apply disabled WITH the reason
  await page.getByRole('tab', { name: 'Berbagi data' }).click()
  await page.locator('[data-ru="revoke"]').click()
  await expect(page.locator('.dk-ru-consent-row[data-revoked="true"]')).toHaveCount(1)
  await page.getByRole('tab', { name: 'Modal kerja' }).click()
  await expect(page.locator('[data-ru="apply-reason"]')).toHaveText('Akses data dicabut · bagikan lagi untuk mengajukan')
  await expect(page.locator('[data-ru="apply-btn"]')).toBeDisabled()
  // "simulasi" on score, plafon, rate, cicilan, peer median
  await expect(page.locator('[data-ru="plafon"]')).toContainText('simulasi')
  await expect(page.locator('[data-ru="apply"] .dk-ru-sim')).toHaveText('simulasi')
  await page.getByRole('tab', { name: 'Skor usaha' }).click()
  await expect(page.locator('.dk-ru-wf-row.is-base')).toContainText('(simulasi)')
  expect(errors.filter(notNoise)).toEqual([])
})

test('Rapor Usaha · ?focus= arrivals: shop, factor, JR review row, LN (bank), business, IZ, bad id ⇒ toast', async ({ page, errors }) => {
  const shop = 'UM-0001'
  await open(page, { extra: `focus=${shop}` })
  await expect(page.getByRole('tab', { name: 'Skor usaha' })).toHaveAttribute('aria-selected', 'true')
  await open(page, { extra: 'focus=pajak' })
  await expect(page.locator('[data-ru="factor-drawer"]')).toHaveAttribute('data-factor', 'pajak')
  const jr = await W<string>(page, `Object.values(s.ledger.byId).find((j) => j.businessId === s.meta.shopId && j.needsReview).id`)
  await open(page, { extra: `focus=${jr}` })
  await expect(page.locator(`.dk-ru-review-row[data-ledger="${jr}"]`)).toBeVisible()
  await open(page, { extra: 'focus=LN-0013' })
  await expect(page.locator('[data-ru="bank-drawer"]')).toHaveAttribute('data-loan', 'LN-0013')
  expect(await page.evaluate(() => new URL(location.href).searchParams.get('role'))).toBe('bank-mitra')
  await open(page, { extra: 'focus=UM-0122' })
  await expect(page.locator('[data-ru="bank-drawer"]')).toHaveAttribute('data-loan', 'LN-0012')
  await open(page, { extra: 'focus=IZ-0005' })
  await expect(page.locator('[data-ru="bank-drawer"]')).toHaveAttribute('data-loan', 'LN-0013')
  await open(page, { role: 'pemilik-toko', extra: 'focus=XX-9999' })
  await expect(page.getByText('Data tidak ditemukan').first()).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Skor usaha' })).toHaveAttribute('aria-selected', 'true')
  expect(errors.filter(notNoise)).toEqual([])
})

test('Rapor Usaha · chains C19 + C37: review ⇒ score.updated (rapor-usaha); shop order paid ⇒ journal in "Data masuk"', async ({ page, errors }) => {
  await open(page)
  const shop = await W<string>(page, 's.meta.shopId')
  const jr = await W<{ id: string; lines: unknown[] }>(page, `Object.values(s.ledger.byId).find((j) => j.businessId === s.meta.shopId && j.needsReview)`)
  const evs = await emitAll(page, [['ledger.reviewed', { ledgerId: jr.id, lines: jr.lines }, 'rapor-usaha']])
  const up = evs.find((e) => e.type === 'score.updated')
  expect(up?.source).toBe('rapor-usaha')
  expect(up?.payload.delta).toBe(10)
  await expect.poll(() => dialText(page), { timeout: 1000 }).toBe(720)
  // C37 (world rows of the kit test): an order of the shop, paid ⇒ Kas/Pendapatan journal ⇒ "Data masuk" shows it
  const needId = await W<string>(page, `Object.keys(s.catalogNeeds.byId)[0]`)
  const created = await emitAll(page, [['order.created', { needId, businessId: shop, items: [{ name: { id: 'Karung pasir', en: 'Sandbags' }, qty: 200, unit: 'lembar', price: 15_000, category: 'karung-pasir' }] }, 'katalog-lokal']])
  const orderId = created.find((e) => e.type === 'order.created')!.payload.id as string
  await emitAll(page, [
    ['order.confirmed', { orderId, qtyConfirmed: [150], etaDays: 2 }, 'katalog-lokal'],
    ['order.shipped', { orderId }, 'katalog-lokal'],
    ['order.paid', { orderId, amount: 2_250_000, method: 'transfer-kasda' }, 'katalog-lokal'],
  ])
  const j = await W<{ id: string; d: number }>(page, `(() => { const x = Object.values(s.ledger.byId).find((j) => j.source === 'katalog' && j.refId === '${orderId}'); return { id: x.id, d: x.lines.reduce((a, l) => a + l.debit, 0) } })()`)
  expect(j.d).toBe(2_250_000)
  await expect(page.locator('.dk-ru-feed-chip').first()).toContainText('Jurnal', { timeout: 1000 })
  expect(errors.filter(notNoise)).toEqual([])
})

test('Rapor Usaha · alive within 10 s: the clock runs and a natural sale lands in "Data masuk hari ini"', async ({ page, errors }) => {
  await open(page, { run: true })
  await page.evaluate(() => (window as unknown as { __gamada: { clock: { play(): void } } }).__gamada.clock.play())
  const tx0 = Number(await page.locator('[data-ru="feed-sales"]').getAttribute('data-tx'))
  await expect.poll(async () => Number(await page.locator('[data-ru="feed-sales"]').getAttribute('data-tx')), { timeout: 10_000 }).toBeGreaterThan(tx0)
  expect(errors.filter(notNoise)).toEqual([])
})

test('Rapor Usaha · Tanya skor (sim): "kenapa turun" quotes 710 / 750 and shows the score card; no repeated feed / evidence text', async ({ page, errors }) => {
  await open(page)
  const texts = await page.locator('.dk-ru-wf-name small:not(.dk-ru-wf-note), .dk-ru-feed-chip').allInnerTexts()
  expect(new Set(texts).size).toBe(texts.length)
  // 12-month chart (lazy) opens with the score history
  await page.locator('[data-ru="trend"]').click()
  await expect(page.locator('[data-ru="trend-chart"]')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.locator('[data-ru="ask"]').click()
  await page.getByRole('button', { name: 'Kenapa skor saya turun?' }).click()
  await expect(page.locator('[data-ru="score-card"]')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('[data-ru="ask-drawer"]')).toContainText('710')
  await expect(page.locator('[data-ru="ask-drawer"]')).toContainText('750')
  await expect(page.locator('[data-ru="ask-drawer"]')).toContainText('bukan keputusan kredit')
  expect(errors.filter(notNoise)).toEqual([])
})

test.describe('phone 390', () => {
  test.use(PHONE)
  test('Rapor Usaha · EN at 390: review ⇒ 740, share, apply, open as cooperative, approve; no horizontal scroll, guide pill visible', async ({ page, errors }) => {
    await open(page, { lang: 'en' })
    await closeGuide(page)
    await expect(page.locator('.dk-mpill').first()).toBeVisible()
    await expect(page.locator('[data-ru="delta"]')).toHaveText('−40 vs Oct')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.locator('[data-ru="fix"]').first().click()
    await page.locator('[data-ru="approve-reviews"]').click()
    await expect.poll(() => shopScore(page), { timeout: 8000 }).toBe(740)
    await page.keyboard.press('Escape')
    for (const tab of ['Working capital', 'Data sharing', 'Business score']) {
      await page.getByRole('tab', { name: tab }).click()
      await page.waitForTimeout(300)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    }
    await page.getByRole('tab', { name: 'Working capital' }).click()
    await page.locator('[data-ru="grant"]').click()
    await expect(page.locator('[data-ru="installment"]')).toHaveText('Rp 9,334,000')
    await page.locator('[data-ru="apply-btn"]').click()
    await expect.poll(() => missionsDone(page)).toContain('ajukan')
    // under 1280 px the "Sisi Bank/Koperasi" card sits under the timeline
    await page.locator('[data-ru="open-bank"]').click()
    await expect(page.locator('[data-ru="bank-drawer"]')).toBeVisible()
    await page.locator('[data-ru="approve-btn"]').click()
    await expect.poll(() => missionsDone(page)).toContain('setujui')
    await page.keyboard.press('Escape')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    // 44 px targets on the bank queue
    const small = await page.locator('.dk-ru-qbtn, .dk-ru-tab').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 44).length)
    expect(small).toBe(0)
    expect(errors.filter(notNoise)).toEqual([])
  })
})

test.describe('phone 390 alive', () => {
  test.use(PHONE)
  test('Rapor Usaha · alive within 10 s at 390: "Data masuk" on the first screen counts a natural sale', async ({ page, errors }) => {
    await open(page, { run: true })
    await page.evaluate(() => (window as unknown as { __gamada: { clock: { play(): void } } }).__gamada.clock.play())
    const feed = page.locator('[data-ru="feed-sales"]')
    await expect(feed).toBeInViewport()
    const tx0 = Number(await feed.getAttribute('data-tx'))
    await expect.poll(async () => Number(await feed.getAttribute('data-tx')), { timeout: 10_000 }).toBeGreaterThan(tx0)
    expect(errors.filter(notNoise)).toEqual([])
  })
})

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })
  test('Rapor Usaha · final states at once (dial 710, waterfall bars), static mode, bank landing', async ({ page, errors }) => {
    await open(page, { extra: 'static=1' })
    await expect(page.locator('.dk-score-dial[role="meter"]').first()).toHaveAttribute('aria-valuenow', '710')
    expect(await page.locator('.dk-score-dial text').first().textContent()).toBe('710')
    await expect(page.locator('.dk-ru-wf.is-anim')).toHaveCount(0)
    await open(page, { role: 'bank-mitra', extra: 'off=demoAnimations' })
    await expect(page.locator('.dk-ru-qrow')).toHaveCount(3)
    expect(errors.filter(notNoise)).toEqual([])
  })
})
