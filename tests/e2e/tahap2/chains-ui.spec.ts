/**
 * Cross-product reaction chains through the REAL product UIs (spec §15.3; chain list docs/build/tahap2-plan.md §3).
 * The root is done in the owning product's UI (or, for tahap-4 products that are not built yet, emitted with that
 * product as source); the follow-up is checked where the visitor would see it, reached the way a visitor would:
 * the cross-product toast, or an in-app navigation (the world stays in memory and in IndexedDB).
 * tests/e2e/chains.spec.ts keeps the world-level contract of the same chains.
 */
import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures'
import { W, emit, notNoise, openDemo, recordEvents, events, spaGo } from './helpers'

test.describe.configure({ timeout: 120_000 })

/** Siaga Wilayah UI: run the 6-hour forecast, then compose + send the early warning (flood.alert + alert.broadcast) */
async function siagaWarning(page: Page): Promise<void> {
  await openDemo(page, 'siaga-wilayah')
  const cta = page.locator('[data-sw="cta"]')
  await cta.click()
  await expect.poll(() => W<number>(page, 's.rainCells.ids.length'), { timeout: 30_000 }).toBeGreaterThan(0)
  await expect(cta).toBeEnabled()
  await cta.click()
  await page.locator('[data-sw="bc-send"]').click({ timeout: 15_000 })
  await page.locator('[data-sw="bc-done"]').click({ timeout: 15_000 })
  await expect.poll(() => W<number>(page, `Object.values(s.alerts.byId).filter((a) => a.broadcast).length`)).toBeGreaterThan(0)
}

/** Sapa Warga UI: Ibu Siti's flood photo report + neighbours' reports until the cluster forms */
async function sapaCluster(page: Page): Promise<void> {
  await openDemo(page, 'sapa-warga')
  // the Javanese voice note (a flood report) + the flood photo: with the overnight reports near her desa, 5 ⇒ cluster
  await page.locator('[data-sw="quick-voice"]').click()
  await expect.poll(() => W<number>(page, `Object.values(s.complaints.byId).filter((c) => c.channel === 'voice' && c.citizenId === s.meta.personas.siti).length`), { timeout: 15_000 }).toBeGreaterThan(0)
  await page.locator('[data-sw="quick-photo"]').click()
  await page.locator('[data-sw="send"]').click()
  for (let i = 0; i < 6 && (await W<number>(page, 's.clusters.ids.length')) === 0; i++) {
    const n = page.locator('[data-sw="neighbour"]')
    if (await n.isVisible().catch(() => false)) await n.click()
    else await page.waitForTimeout(500)
    await page.waitForTimeout(500)
  }
  await expect.poll(() => W<number>(page, 's.clusters.ids.length'), { timeout: 10_000 }).toBeGreaterThan(0)
}

test('chain 1 · Sapa Warga flood reports ⇒ cluster: one toast; Meja Pimpinan, Siaga Wilayah (confirmed) and Radar Isu (topic) see it', async ({ page, errors }) => {
  await sapaCluster(page)
  const toast = page.locator('.dk-toast').filter({ hasText: /Klaster/ })
  await expect(toast).toHaveCount(1)
  await expect(toast).toContainText('Meja Pimpinan')
  expect(await W<number>(page, `Object.values(s.mentions.byId).filter((m) => m.topic === 'banjir' && m.at >= 0 && m.kind === 'sosmed').length`)).toBeGreaterThan(0)
  // the target demo is preloaded when the toast appears, so it may read ?focus= and drop it from the URL (replaceState)
  // before a URL poll sees it: record every URL the page passes through instead
  const urls: string[] = []
  page.on('framenavigated', (f) => {
    if (f === page.mainFrame()) urls.push(f.url())
  })
  await toast.locator('.dk-toast-main').click()
  await expect(page).toHaveURL(/\/demo\/meja-pimpinan\?/)
  await expect.poll(() => urls.some((u) => /\/demo\/meja-pimpinan\?.*focus=/.test(u))).toBe(true)
  await expect(page.locator('.dk-mp').first()).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('.dk-mp').getByText(/Klaster banjir/).first()).toBeVisible({ timeout: 15_000 })
  expect(errors.filter(notNoise)).toEqual([])
})

test('chain 2 · officer status change in the console ⇒ the citizen phone gets the ticket update', async ({ page, errors }) => {
  await openDemo(page, 'sapa-warga')
  await page.locator('[data-sw="quick-voice"]').click()
  await expect.poll(() => W<number>(page, `Object.values(s.complaints.byId).filter((c) => c.channel === 'voice' && c.citizenId === s.meta.personas.siti).length`), { timeout: 15_000 }).toBeGreaterThan(0)
  const tid = await W<string>(page, 's.complaints.byId[s.complaints.ids[0]].ticketId')
  await page.locator('.dk-sw-console .dk-seg button').first().click()
  await page.locator(`.dk-sw-console .dk-inbox-li[data-id="${tid}"] button`).click()
  const code = await W<string>(page, `s.complaints.byId[s.tickets.byId['${tid}'].complaintId].code`)
  await page.locator('[data-sw="verify"]').click()
  await expect.poll(() => W<number>(page, `Object.values(s.messages.byId).filter((m) => m.kind === 'tiket' && m.refs.includes('tickets:${tid}')).length`), { timeout: 1_000 }).toBeGreaterThan(0)
  // the phone thread shows the update for that ticket
  await expect(page.locator('.dk-sw-row').filter({ hasText: code }).filter({ hasText: /status/i }).first()).toBeAttached({ timeout: 2_000 })
  expect(errors.filter(notNoise)).toEqual([])
})

test('chains 3–6 · Siaga Wilayah flood warning ⇒ Awas Belanja pump package, Cek Berkas quota banner, Radar Isu news, Ibu Siti’s phone', async ({ page, errors }) => {
  await siagaWarning(page)
  // 3 · Awas Belanja: the emergency pump package is in the list
  await spaGo(page, '/demo/awas-belanja?off=preloader&e2e=1')
  await expect(page.locator('.dk-ab').first()).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('.dk-ab').getByText(/Pompa Air Darurat/).first()).toBeVisible({ timeout: 10_000 })
  // 4 · Cek Berkas: the flood-aid registration banner with its quota and zone
  await spaGo(page, '/demo/cek-berkas?off=preloader&e2e=1')
  await expect(page.locator('.dk-cb').first()).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('.dk-cb').getByText(/Kuota pendaftar dibuka/i).first()).toBeVisible({ timeout: 10_000 })
  // 5 · Radar Isu: the flood news mention (topic banjir) in the live stream
  await spaGo(page, '/demo/radar-isu?off=preloader&e2e=1')
  await expect(page.locator('.dk-ri-live').first()).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('.dk-ri-live').getByText(/peringatan banjir/i).first()).toBeVisible({ timeout: 10_000 })
  // 6 · Sapa Warga: the warning on Ibu Siti's phone
  await spaGo(page, '/demo/sapa-warga?off=preloader&e2e=1')
  await expect(page.locator('.dk-sw').first()).toBeVisible({ timeout: 20_000 })
  await page.locator('[data-sw="persona-siti"]').click()
  await expect(page.locator('.dk-sw-row').filter({ hasText: /PERINGATAN DINI BANJIR/ }).first()).toBeVisible({ timeout: 10_000 })
  expect(errors.filter(notNoise)).toEqual([])
})

test('chain 7 · Meja Pimpinan instruction ⇒ Naskah Pintar disposition memo + one task per agency (toast → Surat Masuk)', async ({ page, errors }) => {
  await openDemo(page, 'meja-pimpinan')
  await page.locator('[data-mp="instruct"]').first().click()
  await page.locator('[data-mp="send-instruction"]').click()
  await expect(page.locator('.dk-mp-sent')).toBeVisible({ timeout: 8_000 })
  const toast = page.locator('.dk-toast').filter({ hasText: 'Naskah Pintar' })
  await expect(toast).toHaveCount(1)
  await page.getByRole('button', { name: /^Selesai$/ }).click()
  await toast.locator('.dk-toast-main').click()
  await expect(page).toHaveURL(/\/demo\/naskah-pintar/)
  await expect(page.getByRole('tab', { name: /Surat Masuk/ })).toHaveAttribute('aria-selected', 'true', { timeout: 20_000 })
  await page.getByRole('tab', { name: /Tindak Lanjut/ }).click()
  const tasks = await W<number>(page, `s.instructions.byId[s.instructions.ids[0]].actionItemIds.length`)
  expect(tasks).toBeGreaterThan(0)
  expect(errors.filter(notNoise)).toEqual([])
})

test('chain 8 · Radar Isu rumor burst ⇒ ONE hoax ⇒ toast ⇒ Meja Pimpinan hoax alert', async ({ page, errors }) => {
  await openDemo(page, 'radar-isu')
  await page.locator('.dk-ri-hoax-cta').click()
  await expect(page.locator('.dk-ri-hoax.is-active')).toBeVisible({ timeout: 15_000 })
  expect(await W<number>(page, 's.hoaxAlerts.ids.length')).toBe(1)
  const toast = page.locator('.dk-toast').filter({ hasText: 'Meja Pimpinan' })
  await expect(toast).toHaveCount(1)
  await toast.locator('.dk-toast-main').click()
  await expect(page).toHaveURL(/\/demo\/meja-pimpinan/)
  await expect(page.locator('.dk-mp').first()).toBeVisible({ timeout: 20_000 })
  await page.locator('[data-hotspot="briefing"]').click()
  await expect(page.locator('.dk-mp-item').filter({ hasText: /Hoaks/i }).first()).toBeVisible({ timeout: 10_000 })
  expect(errors.filter(notNoise)).toEqual([])
})

test('chain 9 · Radar Isu clarification ⇒ 5 positive recovery mentions over the next 30 minutes', async ({ page, errors }) => {
  await openDemo(page, 'radar-isu')
  await page.locator('.dk-ri-hoax-cta').click()
  await expect(page.locator('.dk-ri-hoax.is-active')).toBeVisible({ timeout: 15_000 })
  await recordEvents(page)
  await page.locator('.dk-ri-hoax-act .dk-btn--primary').click()
  await expect(page.locator('[data-testid="ri-publish"]')).toBeEnabled({ timeout: 20_000 })
  await page.locator('[data-testid="ri-publish"]').click()
  await expect(page.locator('.dk-ri-hoax.is-done')).toBeVisible()
  const ev = await events(page)
  expect(ev.some((e) => e.type === 'clarification.published' && e.source === 'radar-isu')).toBe(true)
  expect(ev.filter((e) => e.type === 'mention.created' && e.source === 'radar-isu').length).toBeGreaterThanOrEqual(5)
  expect(errors.filter(notNoise)).toEqual([])
})

test('chain 10 · Siaga Wilayah post-flood harvest ⇒ Indeks Ekonomi update + Sinyal Pasar supply signal ⇒ Meja Pimpinan briefing item', async ({ page, errors }) => {
  await openDemo(page, 'siaga-wilayah')
  await recordEvents(page)
  await page.getByRole('tab', { name: /Pertanian/ }).click()
  // the scenario radio itself: the open guide's step 4 ("geser skenario ke Pascabanjir") is a button earlier in the DOM
  await page.getByRole('radiogroup', { name: 'Skenario' }).getByRole('radio', { name: /Pascabanjir/ }).click()
  await expect.poll(async () => (await events(page)).map((e) => `${e.type}:${e.source}`), { timeout: 10_000 }).toEqual(
    expect.arrayContaining(['harvest.updated:siaga-wilayah', 'econ.updated:indeks-ekonomi', 'supply.signal:sinyal-pasar']),
  )
  await spaGo(page, '/demo/meja-pimpinan?off=preloader&e2e=1')
  await expect(page.locator('.dk-mp').first()).toBeVisible({ timeout: 20_000 })
  await page.locator('[data-hotspot="briefing"]').click()
  await expect(page.locator('.dk-mp-item').filter({ hasText: /Indeks ekonomi/i }).first()).toBeVisible({ timeout: 10_000 })
  expect(errors.filter(notNoise)).toEqual([])
})

test('chain 11 · Awas Belanja correction with local invitation ⇒ Katalog Lokal need', async ({ page, errors }) => {
  await openDemo(page, 'awas-belanja')
  await page.locator('[data-hotspot="ab-start"]').first().click()
  await expect(page.locator('.dk-ab-dtitle')).toContainText('Pompa', { timeout: 15_000 })
  await page.getByRole('button', { name: 'Jalankan analisis' }).first().click()
  await expect(page.locator('.dk-ab-top')).toBeVisible({ timeout: 20_000 })
  await page.getByRole('tab', { name: 'HPS vs Pasar' }).click()
  await recordEvents(page)
  await page.getByRole('button', { name: 'Rekomendasikan koreksi' }).click()
  await expect(page.locator('.dk-ab-memo-ok')).toBeVisible({ timeout: 30_000 })
  await expect.poll(async () => (await events(page)).map((e) => `${e.type}:${e.source}`)).toEqual(expect.arrayContaining(['procurement.recommended:awas-belanja', 'need.created:katalog-lokal']))
  expect(errors.filter(notNoise)).toEqual([])
})

test('chain 12 · Sinyal Pasar price anomaly (tahap 4, emitted) ⇒ market operation suggested in Meja Pimpinan', async ({ page, errors }) => {
  await openDemo(page, 'meja-pimpinan')
  const pp = await W<{ marketId: string; commodityId: string; price: number }>(page, 's.prices.byId[s.prices.ids[0]]')
  await emit(page, 'price.anomaly', { marketId: pp.marketId, commodityId: pp.commodityId, price: Math.round(pp.price * 1.3), expected: pp.price, deltaPct: 30 }, 'sinyal-pasar')
  expect(await W<number>(page, `Object.values(s.marketOps.byId).filter((m) => m.stage === 'recommended').length`)).toBeGreaterThan(0)
  await page.locator('[data-hotspot="briefing"]').click()
  await expect(page.locator('.dk-mp-item').filter({ hasText: /operasi pasar/i }).first()).toBeVisible({ timeout: 10_000 })
  expect(errors.filter(notNoise)).toEqual([])
})

test('chain 13 · Sapa Warga queue booking (NIB form) ⇒ queue ticket on Raka’s phone', async ({ page, errors }) => {
  await openDemo(page, 'sapa-warga')
  await page.locator('[data-sw="persona-raka"]').click()
  await page.locator('.dk-sw-quick button').first().click()
  await expect(page.locator('.dk-sw-card.is-check')).toBeVisible({ timeout: 15_000 })
  await page.locator('[data-sw="fill-form"]').click()
  await page.locator('[data-sw="form-queue"]').click()
  await page.locator('[data-sw="slot"]').first().click()
  await expect(page.locator('.dk-sw-card.is-queue')).toBeVisible({ timeout: 5_000 })
  expect(await W<number>(page, `Object.values(s.messages.byId).filter((m) => m.kind === 'antrean' && m.to.includes(s.meta.personas.raka)).length`)).toBeGreaterThan(0)
  expect(errors.filter(notNoise)).toEqual([])
})
