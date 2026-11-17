/**
 * Cross-product reaction chains (spec §15.3, ≥ 10 chains) through the REAL world store in the browser.
 *
 * Runs on the live shell of the kit showcase (/lab/_kit?only=shell, product "sapa-warga") with `?e2e=1`, which makes
 * DemoShell expose `window.__gamada = { world, emit, settled, onEvent, clock }`. Each test emits the root event(s)
 * with the product that owns the action as `source` and checks the follow-ups (event types, sources, world state).
 * Chain list + product UI wording: docs/build/tahap2-plan.md §3. When the products are DEMO_READY the integrator
 * adds UI-driven variants; these stay as the contract of the world.
 */
import type { Page } from '@playwright/test'
import { test, expect, settle } from './fixtures'

type Ev = { type: string; source: string; depth: number; payload: Record<string, unknown> }
type Emit = [type: string, payload: unknown, source: string]

async function open(page: Page): Promise<void> {
  await page.goto('/lab/_kit?only=shell&e2e=1&off=preloader')
  await settle(page)
  await page.waitForFunction(() => {
    const g = (window as unknown as { __gamada?: { world: { status(): string } } }).__gamada
    return !!g && g.world.status() === 'ready'
  })
}

/** emit events in order (payload may use "$flood" for the scenario flood kecamatan list), return every processed event */
async function emitAll(page: Page, list: Emit[]): Promise<Ev[]> {
  return page.evaluate(async (items) => {
    type G = {
      world: { get(): { region: { floodKecamatanIds: string[] } } }
      emit(t: string, p: unknown, s: string): void
      settled(): Promise<void>
      onEvent(t: string, fn: (e: Ev) => void): () => void
    }
    const g = (window as unknown as { __gamada: G }).__gamada
    const seen: Ev[] = []
    const off = g.onEvent('*', (e) => seen.push({ type: e.type, source: e.source, depth: e.depth ?? 0, payload: e.payload }))
    const flood = g.world.get().region.floodKecamatanIds
    for (const [t, p, s] of items) g.emit(t, JSON.parse(JSON.stringify(p).replace('"$flood"', JSON.stringify(flood))), s)
    await g.settled()
    off()
    return seen
  }, list)
}

/** read something from the world (expression over `s`, the WorldState) */
const read = <T,>(page: Page, expr: string): Promise<T> =>
  page.evaluate((x) => {
    const s = (window as unknown as { __gamada: { world: { get(): unknown } } }).__gamada.world.get()
    // eslint-disable-next-line no-new-func
    return new Function('s', `return (${x})`)(s) as T
  }, expr)

const has = (evs: Ev[], type: string, source?: string) => evs.some((e) => e.type === type && e.depth > 0 && (!source || e.source === source))

/** five flood complaints within ~300 m of one desa (citizen = persona Ibu Siti) */
async function floodComplaints(page: Page): Promise<Emit[]> {
  const where = await read<{ kec: string; desa: string; c: [number, number]; siti: string }>(
    page,
    // a kecamatan with no flood report yet, so exactly these five form the cluster
    `(() => { const busy = new Set(Object.values(s.complaints.byId).filter((c) => c.category === 'banjir' && c.at >= -1440).map((c) => c.kecamatanId)); const k = s.region.kecamatan.find((x) => !busy.has(x.id) && x.desa.length) ?? s.region.kecamatan[0]; const d = k.desa[0]; return { kec: k.id, desa: d.id, c: d.centroid, siti: s.meta.personas.siti } })()`,
  )
  return Array.from({ length: 5 }, (_, i) => [
    'complaint.created',
    { category: 'banjir', channel: 'wa', text: 'Banjir', kecamatanId: where.kec, desaId: where.desa, coord: [where.c[0] + i * 0.0007, where.c[1] + 0.0004], citizenId: where.siti },
    'sapa-warga',
  ])
}

test('chain 1 · 5 flood complaints ⇒ complaint.clustered ⇒ Meja Pimpinan + Siaga Wilayah (flood.confirmed) + Radar Isu topic, one toast', async ({ page, errors }) => {
  await open(page)
  const evs = await emitAll(page, await floodComplaints(page))
  expect(has(evs, 'complaint.clustered', 'sapa-warga')).toBe(true)
  expect(has(evs, 'flood.confirmed', 'siaga-wilayah')).toBe(true)
  expect(has(evs, 'mention.created', 'radar-isu')).toBe(true)
  const toast = page.locator('.dk-toast')
  await expect(toast).toHaveCount(1)
  await expect(toast).toContainText('Meja Pimpinan')
  await expect(toast).toContainText('Siaga Wilayah')
  expect(errors).toEqual([])
})

test('chain 2 · ticket.statusChanged ⇒ citizen.notified on the citizen phone', async ({ page, errors }) => {
  await open(page)
  await emitAll(page, await floodComplaints(page))
  const ticketId = await read<string>(page, `Object.values(s.complaints.byId).find((c) => c.citizenId === s.meta.personas.siti).ticketId`)
  const evs = await emitAll(page, [['ticket.statusChanged', { ticketId, status: 'diteruskan', opdId: 'bpbd' }, 'sapa-warga']])
  expect(has(evs, 'citizen.notified', 'sapa-warga')).toBe(true)
  expect(await read<boolean>(page, `Object.values(s.messages.byId).some((m) => m.kind === 'tiket' && m.to.includes(s.meta.personas.siti))`)).toBe(true)
  expect(errors).toEqual([])
})

test('chain 3 · flood.alert ⇒ Awas Belanja emergency pump package (affiliated bidders, bids, brand-locked spec)', async ({ page, errors }) => {
  await open(page)
  const evs = await emitAll(page, [['flood.alert', { level: 3, kecamatanIds: '$flood' }, 'siaga-wilayah']])
  expect(has(evs, 'procurement.created', 'awas-belanja')).toBe(true)
  const pump = await read<{ bids: number; ring: number; spec: boolean }>(
    page,
    `(() => { const p = Object.values(s.procurements.byId).find((x) => x.key === 'pompa-darurat'); return { bids: p.bids.length, ring: p.bidderIds.filter((b) => s.bidders.byId[b].ring === 'pompa').length, spec: !!p.spec } })()`,
  )
  expect(pump.ring).toBeGreaterThanOrEqual(3)
  expect(pump.bids).toBeGreaterThanOrEqual(pump.ring)
  expect(pump.spec).toBe(true)
  expect(errors).toEqual([])
})

test('chain 4 · flood.alert ⇒ Cek Berkas bansos quota opens (eligibility.opened)', async ({ page, errors }) => {
  await open(page)
  const evs = await emitAll(page, [['flood.alert', { level: 3, kecamatanIds: '$flood' }, 'siaga-wilayah']])
  expect(has(evs, 'eligibility.opened', 'cek-berkas')).toBe(true)
  expect(await read<boolean>(page, `Object.values(s.programs.byId).some((p) => p.kind === 'bansos-banjir' && p.open && p.quota > 0)`)).toBe(true)
  expect(await read<number>(page, `s.meta.facts.bansosDuplicatePairs`)).toBe(3)
  expect(errors).toEqual([])
})

test('chain 5 · flood.alert ⇒ Radar Isu topic + Toko Autopilot demand + Katalog Lokal need', async ({ page, errors }) => {
  await open(page)
  const evs = await emitAll(page, [['flood.alert', { level: 3, kecamatanIds: '$flood' }, 'siaga-wilayah']])
  expect(has(evs, 'mention.created', 'radar-isu')).toBe(true)
  expect(has(evs, 'stock.forecastChanged', 'toko-autopilot')).toBe(true)
  expect(has(evs, 'need.created', 'katalog-lokal')).toBe(true)
  expect(errors).toEqual([])
})

test('chain 6 · alert.broadcast ⇒ warning on the phones in the zone (Ibu Siti), not outside', async ({ page, errors }) => {
  await open(page)
  await emitAll(page, [['flood.alert', { level: 3, kecamatanIds: '$flood' }, 'siaga-wilayah']])
  const alertId = await read<string>(page, `Object.values(s.alerts.byId).find((a) => a.status === 'aktif' && a.kind === 'banjir').id`)
  const evs = await emitAll(page, [['alert.broadcast', { alertId, channels: ['wa', 'sms'] }, 'siaga-wilayah']])
  expect(has(evs, 'citizen.notified', 'sapa-warga')).toBe(true)
  const r = await read<{ siti: boolean; darmoIn: boolean; darmo: boolean }>(
    page,
    `(() => { const m = Object.values(s.messages.byId).filter((x) => x.kind === 'peringatan'); const d = s.citizens.byId[s.meta.personas.darmo]; return { siti: m.some((x) => x.to.includes(s.meta.personas.siti)), darmoIn: s.region.floodKecamatanIds.includes(d.kecamatanId), darmo: m.some((x) => x.to.includes(s.meta.personas.darmo)) } })()`,
  )
  expect(r.siti).toBe(true)
  expect(r.darmo).toBe(r.darmoIn)
  expect(errors).toEqual([])
})

test('chain 7 · instruction.issued ⇒ Naskah Pintar disposition + OPD action items', async ({ page, errors }) => {
  await open(page)
  const evs = await emitAll(page, [['instruction.issued', { text: { id: 'Kerahkan pompa', en: 'Deploy pumps' }, opdIds: ['bpbd', 'pupr'] }, 'meja-pimpinan']])
  expect(has(evs, 'letter.dispositioned', 'naskah-pintar')).toBe(true)
  expect(evs.filter((e) => e.type === 'actionItem.created' && e.source === 'naskah-pintar')).toHaveLength(2)
  expect(errors).toEqual([])
})

test('chain 8 · rumor burst (6 mentions) ⇒ hoax.detected with dam evidence (→ Meja Pimpinan)', async ({ page, errors }) => {
  await open(page)
  const rumor = await read<string>(page, 's.meta.facts.hoax.rumor')
  const burst: Emit[] = Array.from({ length: 8 }, (_, i) => [
    'mention.created',
    { at: 600 + i * 3, outlet: '@kabar.kilat.88', kind: 'sosmed', author: `@akun${i}`, text: { id: 'Bendungan jebol', en: 'Dam burst' }, sentiment: 'negatif', score: -0.8, topic: 'hoaks-bendungan', reach: 1500, rumor },
    'radar-isu',
  ])
  const evs = await emitAll(page, burst)
  expect(evs.filter((e) => e.type === 'hoax.detected' && e.source === 'radar-isu')).toHaveLength(1)
  const ev = await read<string>(page, `Object.values(s.hoaxAlerts.byId)[0].evidence.id`)
  expect(ev).toContain(await read<string>(page, 's.meta.facts.hoax.damName'))
  expect(errors).toEqual([])
})

test('chain 9 · clarification.published ⇒ recovering (positive) mentions over the next 30 world minutes', async ({ page, errors }) => {
  await open(page)
  const rumor = await read<string>(page, 's.meta.facts.hoax.rumor')
  await emitAll(page, Array.from({ length: 6 }, (_, i): Emit => ['mention.created', { at: 600 + i, outlet: '@x', kind: 'sosmed', author: `@a${i}`, text: { id: 'Jebol', en: 'Burst' }, sentiment: 'negatif', score: -0.8, topic: 'hoaks-bendungan', reach: 900, rumor }, 'radar-isu']))
  const hoaxId = await read<string>(page, 'Object.values(s.hoaxAlerts.byId)[0].id')
  const evs = await emitAll(page, [['clarification.published', { hoaxId, tone: 'menenangkan', channels: ['web', 'wa'] }, 'radar-isu']])
  const rec = evs.filter((e) => e.type === 'mention.created' && e.depth > 0)
  expect(rec.length).toBe(5)
  expect(rec.every((e) => (e.payload.score as number) > 0)).toBe(true)
  expect(await read<string>(page, `s.hoaxAlerts.byId['${hoaxId}'].status`)).toBe('diklarifikasi')
  expect(errors).toEqual([])
})

test('chain 10 · harvest.updated (pasca-banjir) ⇒ econ.updated (Indeks Ekonomi) + supply.signal (Sinyal Pasar)', async ({ page, errors }) => {
  await open(page)
  const evs = await emitAll(page, [['harvest.updated', { scenario: 'pasca-banjir', kecamatanIds: '$flood' }, 'siaga-wilayah']])
  expect(has(evs, 'econ.updated', 'indeks-ekonomi')).toBe(true)
  expect(has(evs, 'supply.signal', 'sinyal-pasar')).toBe(true)
  expect(await read<boolean>(page, `Object.values(s.supplySignals.byId).some((x) => /beras/.test(x.commodityId) && x.pct < 0)`)).toBe(true)
  expect(errors).toEqual([])
})

test('chain 11 · procurement.recommended (invite local UMKM) ⇒ Katalog Lokal need', async ({ page, errors }) => {
  await open(page)
  await emitAll(page, [['flood.alert', { level: 3, kecamatanIds: '$flood' }, 'siaga-wilayah']])
  const id = await read<string>(page, `Object.values(s.procurements.byId).find((x) => x.key === 'pompa-darurat').id`)
  const evs = await emitAll(page, [['procurement.recommended', { procurementId: id, hpsCorrected: 500000000, note: { id: 'Koreksi HPS', en: 'Correct HPS' }, inviteLocal: true }, 'awas-belanja']])
  expect(has(evs, 'need.created', 'katalog-lokal')).toBe(true)
  expect(errors).toEqual([])
})

test('chain 12 · price.anomaly ⇒ market.operation recommended to Meja Pimpinan', async ({ page, errors }) => {
  await open(page)
  const p = await read<{ m: string; c: string; price: number }>(page, `(() => { const x = s.prices.byId[s.prices.ids[0]]; return { m: x.marketId, c: x.commodityId, price: x.price } })()`)
  const evs = await emitAll(page, [['price.anomaly', { marketId: p.m, commodityId: p.c, price: Math.round(p.price * 1.3), expected: p.price, deltaPct: 30 }, 'sinyal-pasar']])
  expect(has(evs, 'market.operation', 'sinyal-pasar')).toBe(true)
  expect(errors).toEqual([])
})

test('chain 13 · service.booked ⇒ queue ticket on the citizen phone', async ({ page, errors }) => {
  await open(page)
  const who = await read<{ raka: string; svc: string }>(page, `({ raka: s.meta.personas.raka, svc: s.region.services[0].id })`)
  const evs = await emitAll(page, [['service.booked', { serviceId: who.svc, citizenId: who.raka, slotAt: 570 }, 'sapa-warga']])
  expect(has(evs, 'citizen.notified', 'sapa-warga')).toBe(true)
  expect(await read<boolean>(page, `Object.values(s.messages.byId).some((m) => m.kind === 'antrean' && m.to.includes('${who.raka}'))`)).toBe(true)
  expect(errors).toEqual([])
})
