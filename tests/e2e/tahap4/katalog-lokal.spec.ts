/**
 * Katalog Lokal (P14) — alive at 07:01 / 07:03, the 5 missions at 1440 (partial confirm) and 390 (full confirm),
 * numbers that agree, chain hops (C21/C26/C36 from a published need, L7 tax.ready, L8 partner.verified, L9
 * bid.submitted, L10 tender closed, L11 stock on shipping, C37 ledger on payment), ?focus= arrivals, the composer
 * parser (ID / EN / unknown kecamatan), reduced motion, no dead controls, no horizontal scroll at 360/390/430.
 * Run against the dev server with ?controls=all (before DEMO_READY) or a VITE_DEMO_CONTROLS=1 build.
 */
import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures'

const SLUG = 'katalog-lokal'
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } as const
type G = {
  world: { get(): any; status(): string }
  emit(type: string, payload: unknown, source?: string): void
  settled(): Promise<void>
  clock: { get(): { minutes: number; running: boolean }; pause(): void; play(): void; setTime(t: string | number): void }
  ensure(eco: string): Promise<void>
}
const g = <T>(page: Page, fn: (g: G) => T | Promise<T>) => page.evaluate(`(${fn.toString()})(window.__gamada)`) as Promise<T>
const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`
const noAi = (errors: string[]) => errors.filter((e) => !/api\/ai/.test(e))

async function open(page: Page, o: { lang?: 'id' | 'en'; extra?: string; autoplay?: boolean; ensure?: boolean } = {}) {
  if (!o.autoplay)
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem('gamada:kl:autoplay', '1')
      } catch {
        /* ignore */
      }
    })
  const q = new URLSearchParams({ controls: 'all', e2e: '1', off: 'preloader' })
  if (o.lang) q.set('lang', o.lang)
  await page.goto(`/demo/${SLUG}?${q.toString()}${o.extra ? `&${o.extra}` : ''}`)
  await page.waitForFunction(() => (window as unknown as { __gamada?: G }).__gamada?.world.status() === 'ready', null, { timeout: 60_000 })
  await expect(page.locator('.dk-kl[data-side]')).toBeVisible({ timeout: 30_000 })
  if (o.ensure !== false) {
    await page.evaluate(() => (window as unknown as { __gamada: G }).__gamada.ensure('pasar-daerah'))
    await page.evaluate(() => (window as unknown as { __gamada: G }).__gamada.ensure('usaha-pintar'))
  }
  if (!o.autoplay) await g(page, (x) => x.clock.pause())
}

/** publish the flood example from the composer; returns the new need id */
async function publishExample(page: Page): Promise<string> {
  await page.locator('[data-hotspot="kl-example"]').click()
  const pub = page.locator('[data-kl="publish"]')
  await expect(pub).toBeEnabled({ timeout: 15_000 })
  await pub.dblclick()
  // disabled right after the first click; on a fast run the composer has already closed (button gone). The double
  // click guard itself is the "exactly one need" check below.
  await expect
    .poll(() => pub.evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().width > 0).every((e) => (e as HTMLButtonElement).disabled)))
    .toBe(true)
  await g(page, (x) => x.settled())
  const ids = await g(page, (x) => {
    const s = x.world.get()
    return s.catalogNeeds.ids.filter((id: string) => s.catalogNeeds.byId[id].by === 'ai')
  })
  expect(ids.length).toBe(1)
  return ids[0]!
}

async function missionFlow(page: Page, phone: boolean) {
  const shopId = await g(page, (x) => x.world.get().meta.shopId as string)
  // mission 1: example → spec → Terbitkan ⇒ ONE need.created (double click safe)
  const needId = await publishExample(page)
  // C21 tender + C26 ≤ 2 KYB + C36 matches
  await expect.poll(() => g(page, (x) => {
    const s = x.world.get()
    return s.matches.ids.filter((id: string) => s.matches.byId[id].needId === s.catalogNeeds.ids.find((n: string) => s.catalogNeeds.byId[n].by === 'ai')).length
  }), { timeout: 10_000 }).toBeGreaterThan(0)
  const chain = await g(page, (x) => {
    const s = x.world.get()
    const n = s.catalogNeeds.ids.map((id: string) => s.catalogNeeds.byId[id]).find((n: any) => n.by === 'ai')
    const t = s.tenders.ids.map((id: string) => s.tenders.byId[id]).find((t: any) => t.needId === n.id)
    const kyb = s.verificationRequests.ids.map((id: string) => s.verificationRequests.byId[id]).filter((r: any) => r.kind === 'kyb' && r.at >= n.at)
    return { tender: t?.id ?? null, hps: t?.hps ?? null, kyb: kyb.length, hero: s.meta.facts.up.kenalMitra.heroBusinessId, emergency: n.emergency }
  })
  expect(chain.emergency).toBe(true)
  expect(chain.tender).not.toBeNull()
  expect(chain.kyb).toBeLessThanOrEqual(2)
  if (phone) await expect(page.locator('[data-kl="match-board"]')).toBeVisible()
  // numbers that agree: HPS acuan = tender hps; top all verified; lit cards' match % = match.made score
  await expect(page.locator('[data-kl="hps"]')).toContainText(rp(chain.hps))
  const cards = await page.locator('[data-kl-card]').evaluateAll((els) => els.map((e) => ({ id: e.getAttribute('data-kl-card')!, score: Number(e.getAttribute('data-score')) })))
  expect(cards.length).toBeGreaterThan(1)
  const agree = await g(page, (x) => {
    const s = x.world.get()
    return { verified: s.businesses.ids.filter((id: string) => s.businesses.byId[id].verified).length, biz: Object.fromEntries(s.businesses.ids.map((id: string) => [id, s.businesses.byId[id].verified])), scores: Object.fromEntries(s.bizScores.ids.map((id: string) => [id, s.bizScores.byId[id].score])), matches: s.matches.ids.map((id: string) => s.matches.byId[id]) }
  })
  for (const c of cards) {
    expect(agree.biz[c.id]).toBe(true)
    const m = agree.matches.find((m: any) => m.needId === needId && m.businessId === c.id)
    if (m) expect(m.score).toBe(c.score)
    await expect(page.locator(`[data-kl-card="${c.id}"] .dk-bb.is-score b`)).toHaveText(String(agree.scores[c.id]))
  }
  await expect(page.locator('.dk-kl-kpis')).toContainText(String(agree.verified))
  // the hero waits for Kenal Mitra with its KYB request code
  await page.locator('[data-kl="waiting"] summary').click()
  await expect(page.locator(`[data-kl-wait="${chain.hero}"]`)).toContainText(/KM-/)

  // mission 2: tick the shop + one other → Bandingkan (≥ 2 offers)
  const pickIds = [cards.find((c) => c.id === shopId)?.id ?? cards[0]!.id]
  pickIds.push(cards.find((c) => !pickIds.includes(c.id))!.id)
  for (const id of pickIds) await page.locator(`[data-kl-card="${id}"] [data-kl="pick"]`).check()
  await page.locator('[data-kl="compare"]').click()
  await expect(page.locator('[data-kl="compare-drawer"]')).toHaveAttribute('data-n', '2')
  // T8: the split suggestion covers every item of the need list (terpal too), or names the one without a local UMKM
  for (const item of await g(page, (x) => x.world.get().catalogNeeds.byId[x.world.get().catalogNeeds.ids.find((n: string) => x.world.get().catalogNeeds.byId[n].by === 'ai')].items.map((i: any) => i.name.id as string))) await expect(page.locator('[data-kl="split"]')).toContainText(item)
  // mission 3: Pilih → Ringkas → Pagu → Kirim
  const chosen = pickIds[0]!
  await page.locator(`[data-kl-offer="${chosen}"] [data-kl="choose"]`).click()
  await page.locator('[data-kl="next"]').click()
  await expect(page.locator('[data-kl="pagu"]')).toBeVisible()
  await page.locator('[data-kl="next"]').click()
  const t0 = Date.now()
  await page.locator('[data-kl="order"]').click()
  await g(page, (x) => x.settled())
  const ord = await g(page, (x) => {
    const s = x.world.get()
    const o = s.orders.ids.map((id: string) => s.orders.byId[id]).find((o: any) => o.needId === s.catalogNeeds.ids.find((n: string) => s.catalogNeeds.byId[n].by === 'ai'))
    const t = s.tenders.ids.map((id: string) => s.tenders.byId[id]).find((t: any) => t.needId === o.needId)
    const bids = s.bids.ids.map((id: string) => s.bids.byId[id]).filter((b: any) => b.tenderId === t?.id)
    return { id: o.id, biz: o.businessId, total: o.total, sum: o.items.reduce((a: number, i: any) => a + i.qty * i.price, 0), items: o.items, tender: t?.status, bids: bids.map((b: any) => b.status) }
  })
  expect(ord.biz).toBe(chosen)
  expect(ord.total).toBe(ord.sum)
  expect(ord.tender).toBe('selesai')
  for (const b of ord.bids) expect(['menang', 'kalah']).toContain(b)
  // order ⇒ phone notification ≤ 1 s (peek on 1440, pill on phones)
  if (!phone) await expect(page.locator(`[data-kl="phone-peek"] [data-kl-note="${ord.id}"]`)).toBeVisible({ timeout: 1_000 })
  else await expect(page.locator('[data-kl="new-order-pill"]')).toBeVisible({ timeout: 1_000 })
  expect(Date.now() - t0).toBeLessThan(4_000)
  await expect(page.locator(`[data-kl-order="${ord.id}"] [data-kl="order-total"]`)).toContainText(rp(ord.total))

  // mission 4: flip to the UMKM side, open the order, confirm (1440: partial; phone: full)
  if (phone) await page.locator('[data-kl="new-order-pill"]').click()
  else await page.locator('[data-kl="side-toggle"]').click()
  await expect(page.locator('[data-kl="umkm"]')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('[data-kl="umkm"]')).toHaveAttribute('data-biz', chosen)
  if (await page.locator(`[data-kl-umkm-order="${ord.id}"]`).count() === 0) await page.locator(`[data-kl-note="${ord.id}"]`).click()
  const od = page.locator(`[data-kl-umkm-order="${ord.id}"]`)
  await expect(od).toBeVisible()
  let expected = ord.total
  const fullOk = await od.locator('[data-kl="umkm-confirm"]').isEnabled()
  if (!phone || !fullOk) {
    await od.locator('[data-kl="umkm-partial"]').click()
    const inputs = od.locator('[data-kl="partial-qty"]')
    const n = await inputs.count()
    const qs: number[] = []
    for (let i = 0; i < n; i++) {
      const v = Number(await inputs.nth(i).inputValue())
      const q = i === 0 ? Math.max(1, v - 1) : v
      await inputs.nth(i).fill(String(q))
      qs.push(q)
    }
    expected = ord.items.reduce((a: number, it: any, i: number) => a + (qs[i] ?? 0) * it.price, 0)
    await od.locator('[data-kl="umkm-confirm-partial"]').click()
  } else await od.locator('[data-kl="umkm-confirm"]').click()
  await g(page, (x) => x.settled())
  const conf = await g(page, (x) => x.world.get().orders.byId[x.world.get().orders.ids.find((id: string) => x.world.get().orders.byId[id].status === 'dikonfirmasi')])
  expect(conf.status).toBe('dikonfirmasi')
  expect(conf.total).toBe(expected)
  await expect(od.locator('[data-kl="umkm-total"]')).toHaveText(rp(expected))
  // shipping moves the shop's stock (L11)
  const before = await g(page, (x) => {
    const s = x.world.get()
    const o = s.orders.byId[s.orders.ids.find((id: string) => s.orders.byId[id].status === 'dikonfirmasi')]
    const cats = o.items.map((i: any) => i.category)
    return { shop: o.businessId === s.meta.shopId, cats, onHand: cats.map((c: string) => s.products.ids.map((id: string) => s.products.byId[id]).filter((p: any) => p.businessId === s.meta.shopId && p.category === c && !p.tags.includes('bahan')).reduce((a: number, p: any) => a + (s.stock.byId[p.id]?.onHand ?? 0), 0)), conf: o.confirmedQty }
  })
  await od.locator('[data-kl="umkm-ship"]').click()
  await g(page, (x) => x.settled())
  if (before.shop) {
    const after = await g(page, (x) => {
      const s = x.world.get()
      const cats = ['karung-pasir', 'terpal', 'pompa', 'semen', 'alat-kerja']
      return Object.fromEntries(cats.map((c) => [c, s.products.ids.map((id: string) => s.products.byId[id]).filter((p: any) => p.businessId === s.meta.shopId && p.category === c && !p.tags.includes('bahan')).reduce((a: number, p: any) => a + (s.stock.byId[p.id]?.onHand ?? 0), 0)]))
    })
    before.cats.forEach((c: string, i: number) => expect(after[c]).toBe(before.onHand[i] - before.conf[i]))
  }
  // mission 5: back to Pemda → Terima & bayar ⇒ order.paid; shop order ⇒ C37 ledger = order total
  await page.locator('[data-kl="side-toggle"]').click()
  await expect(page.locator('[data-kl-face-h="pemda"]')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator(`.dk-kl-detail[data-need="${needId}"]`)).toBeVisible()
  await page.locator(`[data-kl-order="${ord.id}"] [data-kl="pay"]`).click()
  await g(page, (x) => x.settled())
  await expect(page.locator(`[data-kl-order="${ord.id}"]`)).toHaveAttribute('data-status', 'dibayar')
  if (before.shop) {
    await expect.poll(() => g(page, (x) => {
      const s = x.world.get()
      const o = s.orders.ids.map((id: string) => s.orders.byId[id]).find((o: any) => o.status === 'dibayar' && o.needId && s.catalogNeeds.byId[o.needId].by === 'ai')
      const j = s.ledger.ids.map((id: string) => s.ledger.byId[id]).find((j: any) => j.source === 'katalog' && j.refId === o.id)
      return j ? j.lines.reduce((a: number, l: any) => a + l.debit, 0) === o.total : false
    }), { timeout: 5_000 }).toBe(true)
  }
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gamada:demo:missions:katalog-lokal') ?? '[]').sort())).toEqual(['banding', 'buat', 'konfirmasi', 'pilih', 'selesai'])
  if (!phone) await expect(page.getByText(/Lanjut ke produk terkait|Continue to related products/).first()).toBeVisible({ timeout: 5_000 })
}

test.describe('Katalog Lokal · 1440', () => {
  test.describe.configure({ timeout: 120_000 })

  test('alive: 07:01 natural need lights its lines within 10 s; 07:03 paid', async ({ page, errors }) => {
    await open(page, { autoplay: true, ensure: false })
    const t0 = Date.now()
    await expect(page.locator('[data-kl="match-board"]')).toBeVisible({ timeout: 10_000 })
    await expect.poll(async () => Number(await page.locator('[data-kl="match-board"]').getAttribute('data-lit')), { timeout: 10_000 - (Date.now() - t0) }).toBeGreaterThan(0)
    expect(Date.now() - t0).toBeLessThan(10_000)
    await expect(page.locator('.dk-kl-line.is-lit').first()).toBeAttached()
    // 07:03 the seeded (non-shop) order is paid by the clock: KPI belanja > 0
    await g(page, (x) => x.clock.setTime('07:04'))
    await expect.poll(() => g(page, (x) => { const s = x.world.get(); return s.orders.ids.filter((id: string) => s.orders.byId[id].status === 'dikirim').length }), { timeout: 10_000 }).toBe(0)
    await expect(page.locator('.dk-kl-kpis')).not.toContainText('Rp 0')
    expect(errors).toEqual([])
  })

  test('missions + numbers that agree + chain hops (partial confirm)', async ({ page, errors }) => {
    await open(page)
    await missionFlow(page, false)
    expect(noAi(errors)).toEqual([])
  })

  test('L7 tax.ready, L8 partner.verified, L9 bid.submitted land ≤ 1 s', async ({ page, errors }) => {
    await open(page)
    const needId = await publishExample(page)
    const ids = await g(page, (x) => {
      const s = x.world.get()
      return { shop: s.meta.shopId, hero: s.meta.facts.up.kenalMitra.heroBusinessId, tender: s.tenders.ids.find((id: string) => s.tenders.byId[id].needId) }
    })
    expect(ids.tender).toBeTruthy()
    // L8: hero passes KYB ⇒ moves into the top list
    await expect(page.locator(`[data-kl-card="${ids.hero}"]`)).toHaveCount(0)
    await g(page, (x) => x.emit('partner.verified', { subjectKind: 'business', subjectId: x.world.get().meta.facts.up.kenalMitra.heroBusinessId, kind: 'kyb', result: 'lolos', score: 91 }, 'kenal-mitra'))
    await expect(page.locator(`[data-kl-card="${ids.hero}"]`)).toBeVisible({ timeout: 1_500 })
    // L7: tax.ready ⇒ shop "Pajak Rapi" badge
    const shopCard = page.locator(`[data-kl-card="${ids.shop}"]`)
    if (await shopCard.count()) {
      const taxTidy = await g(page, (x) => x.world.get().businesses.byId[x.world.get().meta.shopId].taxTidy)
      if (!taxTidy) {
        await expect(shopCard.locator('.dk-bb.is-missing', { hasText: /Pajak Rapi/ })).toBeVisible()
        await g(page, (x) => x.emit('tax.ready', { businessId: x.world.get().meta.shopId, period: '2026-11' }, 'pajak-beres'))
        await expect(shopCard.locator('.dk-bb.is-ok', { hasText: /Pajak Rapi/ })).toBeVisible({ timeout: 1_500 })
      }
      // L9: the shop's bid on the need's tender ⇒ "Penawaran resmi via TenderPilot"
      await g(page, (x) => {
        const s = x.world.get()
        const t = s.tenders.byId[s.tenders.ids.find((id: string) => s.tenders.byId[id].needId)]
        x.emit('bid.submitted', { tenderId: t.id, businessId: s.meta.shopId, price: Math.round(t.hps * 0.93) }, 'tenderpilot')
      })
      await expect(shopCard.locator('.dk-kl-src.is-bid')).toBeVisible({ timeout: 1_500 })
    }
    expect(needId).toMatch(/^KB-/)
    expect(noAi(errors)).toEqual([])
  })

  test('C36: a need from another product gets its matches ≤ 1 s', async ({ page, errors }) => {
    await open(page)
    await g(page, (x) => {
      const s = x.world.get()
      x.emit('need.created', { title: { id: 'Air minum posko uji', en: 'Test post water' }, items: [{ name: { id: 'Air minum', en: 'Water' }, category: 'air-minum', qty: 60, unit: 'dus' }], kecamatanId: s.region.kecamatan[0].id, deadlineDays: 3, emergency: false, cause: null }, 'siaga-wilayah')
    })
    await expect(page.locator('[data-kl="match-board"]')).toBeVisible({ timeout: 2_000 })
    await expect.poll(async () => Number(await page.locator('[data-kl="match-board"]').getAttribute('data-lit')), { timeout: 1_500 }).toBeGreaterThan(0)
    expect(noAi(errors)).toEqual([])
  })

  test('?focus= arrivals: need, order, match, tender, UMKM order; bad id ⇒ toast', async ({ page, errors }) => {
    await open(page)
    const needId = await publishExample(page)
    const ids = await g(page, (x) => {
      const s = x.world.get()
      const seeded = s.orders.ids.map((id: string) => s.orders.byId[id]).find((o: any) => o.needId)
      const m = s.matches.ids.map((id: string) => s.matches.byId[id]).find((m: any) => m.needId === s.catalogNeeds.ids.find((n: string) => s.catalogNeeds.byId[n].by === 'ai'))
      return { order: seeded.id, orderNeed: seeded.needId, orderBiz: seeded.businessId, match: m.id, matchBiz: m.businessId, tender: s.tenders.ids.find((id: string) => s.tenders.byId[id].needId) }
    })
    const go = async (focus: string, extra = '') => {
      await page.goto(`/demo/${SLUG}?controls=all&e2e=1&off=preloader&focus=${focus}${extra}`)
      await expect(page.locator('.dk-kl[data-side]')).toBeVisible({ timeout: 30_000 })
    }
    await go(ids.orderNeed)
    await expect(page.locator(`.dk-kl-detail[data-need="${ids.orderNeed}"]`)).toBeVisible()
    await go(ids.order)
    await expect(page.locator(`[data-kl-order="${ids.order}"]`)).toBeVisible()
    await go(ids.match)
    await expect(page.locator(`.dk-kl-detail[data-need="${needId}"] [data-kl-card="${ids.matchBiz}"]`)).toBeVisible()
    await go(ids.tender)
    await expect(page.locator(`.dk-kl-detail[data-need="${needId}"]`)).toBeVisible()
    await go(ids.order, '&role=pemilik-toko')
    await expect(page.locator('[data-kl="umkm"]')).toHaveAttribute('data-biz', ids.orderBiz)
    await expect(page.locator(`[data-kl-umkm-order="${ids.order}"]`)).toBeVisible()
    await go('KB-9999')
    await expect(page.getByText('Data tidak ditemukan').first()).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('.dk-kl')).toHaveAttribute('data-side', 'pemda')
    expect(noAi(errors)).toEqual([])
  })

  test('composer: ID + EN examples parse; unknown kecamatan ⇒ disabled with reason', async ({ page, errors }) => {
    await open(page, { lang: 'en' })
    await page.locator('[data-hotspot="kl-example"]').click()
    await expect(page.locator('[data-kl-item="karung-pasir"] [data-kl="qty"]')).toHaveValue('2000')
    await expect(page.locator('[data-kl-item="terpal"] [data-kl="qty"]')).toHaveValue('50')
    await expect(page.locator('[data-kl="days"]')).toHaveValue('2')
    await expect(page.locator('[data-kl="emergency"]')).toBeChecked()
    await expect(page.locator('[data-kl="publish"]')).toBeEnabled()
    await page.locator('[data-kl="composer"]').fill('Need two thousand sandbags for Atlantis district')
    await page.locator('[data-kl="compose"]').click()
    await expect(page.locator('[data-kl-item="karung-pasir"] [data-kl="qty"]')).toHaveValue('2000')
    await expect(page.locator('[data-kl="publish"]')).toBeDisabled()
    await expect(page.locator('#kl-pub-why')).toBeVisible()
    await page.locator('[data-kl="kec-select"]').selectOption({ index: 1 })
    await expect(page.locator('[data-kl="publish"]')).toBeEnabled()
    // ID: "dua puluh", "2rb", budget in juta
    await page.locator('[data-kl="composer"]').fill('Butuh 2rb karung dan dua puluh terpal, kirim 3 hari, pagu 40 juta')
    await page.locator('[data-kl="compose"]').click()
    await expect(page.locator('[data-kl-item="karung-pasir"] [data-kl="qty"]')).toHaveValue('2000')
    await expect(page.locator('[data-kl-item="terpal"] [data-kl="qty"]')).toHaveValue('20')
    await expect(page.locator('[data-kl="days"]')).toHaveValue('3')
    expect(noAi(errors)).toEqual([])
  })

  test('no dead controls on the Pemda first screen; Ask + Peta open', async ({ page, errors }) => {
    await open(page)
    await g(page, (x) => x.clock.setTime('07:02'))
    await expect(page.locator('[data-kl="match-board"]')).toBeVisible({ timeout: 10_000 })
    const sig = () => page.evaluate(() => `${document.querySelector('.dk-kl')?.innerHTML.length}|${document.querySelectorAll('[role="dialog"]').length}|${location.href}|${document.querySelector('.dk-kl')?.getAttribute('data-side')}`)
    const sels = ['.dk-kl-needtabs [role="radio"]:not([aria-checked="true"])', '[data-kl="ask"]', '.dk-kl-parts summary', '[data-kl="pick"]', '[data-kl="phone-peek"]']
    for (const sel of sels) {
      const el = page.locator(sel).first()
      if (!(await el.count())) continue
      const a = await sig()
      await el.click()
      await page.waitForTimeout(400)
      expect(await sig(), sel).not.toBe(a)
      await page.keyboard.press('Escape')
      if (sel === '[data-kl="phone-peek"]') await page.locator('[data-kl="side-toggle"]').click()
    }
    await page.locator('.dk-kl-board-h [role="radio"]', { hasText: 'Peta' }).click()
    await expect(page.locator('[data-kl="map"]')).toBeVisible({ timeout: 15_000 })
    expect(noAi(errors)).toEqual([])
  })

  test('reduced motion: the flip is a fade, final states render', async ({ page, errors }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await open(page)
    await expect(page.locator('.dk-kl-flip')).toHaveAttribute('data-motion', 'reduced')
    await page.locator('[data-kl="side-toggle"]').click()
    await expect(page.locator('[data-kl="umkm"]')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('[data-kl-face-h="umkm"]')).toBeFocused({ timeout: 3_000 })
    await page.locator('[data-kl="side-toggle"]').click()
    await expect(page.locator('[data-kl-face-h="pemda"]')).toBeVisible()
    expect(noAi(errors)).toEqual([])
  })
})

test.describe('Katalog Lokal · roles, EN, static', () => {
  test.describe.configure({ timeout: 90_000 })

  test('?role=pemilik-toko landing in EN: UMKM side, no console errors', async ({ page, errors }) => {
    await open(page, { lang: 'en', extra: 'role=pemilik-toko' })
    await expect(page.locator('[data-kl="umkm"]')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('[data-kl="umkm"]')).toHaveAttribute('data-biz', /^UM-/)
    await expect(page.locator('[data-kl="umkm"]')).toContainText('Storefront')
    await page.locator('[data-kl="side-toggle"]').click()
    await expect(page.locator('[data-kl-face-h="pemda"]')).toBeVisible()
    await expect(page.locator('.dk-kl-kpis')).toContainText('Verified local SMEs')
    expect(noAi(errors)).toEqual([])
  })

  test('?static=1: lines drawn without motion, flip without transform', async ({ page, errors }) => {
    await open(page, { extra: 'static=1' })
    await g(page, (x) => x.clock.setTime('07:02'))
    await expect(page.locator('.dk-kl-flip')).toHaveAttribute('data-motion', 'static')
    await expect(page.locator('.dk-kl-line.is-lit').first()).toBeAttached({ timeout: 10_000 })
    await page.locator('[data-kl="side-toggle"]').click()
    await expect(page.locator('[data-kl="umkm"]')).toBeVisible({ timeout: 15_000 })
    expect(noAi(errors)).toEqual([])
  })
})

test.describe('Katalog Lokal · phone', () => {
  test.use({ ...PHONE })
  test.describe.configure({ timeout: 120_000 })

  test('alive + no horizontal scroll at 360/390/430, both sides', async ({ page, errors }) => {
    await open(page, { autoplay: true, ensure: false })
    await expect(page.locator('[data-kl-need]').first()).toBeVisible({ timeout: 10_000 })
    for (const side of ['pemda', 'umkm']) {
      if (side === 'umkm') {
        await page.locator('[data-kl="side-toggle"]').click()
        await expect(page.locator('[data-kl="umkm"]')).toBeVisible({ timeout: 15_000 })
      }
      for (const w of [360, 390, 430]) {
        await page.setViewportSize({ width: w, height: 844 })
        await page.waitForTimeout(200)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${side} ${w}`).toBe(true)
      }
    }
    expect(errors).toEqual([])
  })

  test('missions on a phone (full confirm)', async ({ page, errors }) => {
    await open(page)
    await missionFlow(page, true)
    expect(noAi(errors)).toEqual([])
  })
})
