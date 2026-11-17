/**
 * World self-tests — run with:  npx tsx src/demo-kit/world/__tests__/world.selftest.ts
 * Determinism, invariants under 1000 random events, reactions, batching, natural events.
 * Uses the mini fixture pack, and the real Bojonegoro pack too when it exists.
 */
import { RegionPack } from '../../region/types'
import { MINI_PACK } from '../__fixtures__/mini-pack'
import { generateWorld } from '../seed'
import { createEvent, processEvents } from '../engine'
import { REACTIONS } from '../reactions'
import { naturalEventsAt } from '../natural-gen'
import { _onNaturalMinute, setNaturalEvents } from '../natural'
import { clock } from '../clock'
import { emit, loadWorld, onEvent, settled, world, exportWorld, importWorld, resetWorld } from '../store'
import { complaintKpi, slaOnTimePct, tableCounts, auditFor, overdueActions, instructionSuggestions } from '../selectors'
import type { AnyFollowUp, EventSource, WorldEvent, WorldState } from '../types'
import { makeRng } from '../rng'
import { TABLE_KEYS, WORLD, distanceKm, offsetKm, rows } from '../util'
import type { Seq } from '../ids'
import { nikRegion, nikRegions, parseNik } from '../../docs/nik'
import { isProductSlug } from '../../../content/products'

let failures = 0
let passes = 0
function ok(cond: unknown, msg: string) {
  if (cond) passes++
  else {
    failures++
    console.error('  ✗', msg)
  }
}
function section(name: string) {
  console.log(`\n▸ ${name}`)
}

// node:fs through a computed specifier so the app tsconfig (no @types/node globals) stays untouched
const fs = (await import(/* @vite-ignore */ ['node', 'fs'].join(':'))) as { existsSync(p: URL): boolean; readFileSync(p: URL, enc: 'utf8'): string }
const exit = (code: number) => (globalThis as unknown as { process: { exit(c: number): never } }).process.exit(code)
const realPackPath = new URL('../../region/packs/bojonegoro/pack.json', import.meta.url)
const packs: { label: string; pack: RegionPack }[] = [{ label: 'mini fixture', pack: MINI_PACK }]
if (fs.existsSync(realPackPath)) {
  const parsed = RegionPack.safeParse(JSON.parse(fs.readFileSync(realPackPath, 'utf8')))
  if (parsed.success) packs.push({ label: 'bojonegoro pack.json', pack: parsed.data })
  else console.warn('real pack exists but does not pass the RegionPack schema yet:', parsed.error.issues.slice(0, 3))
}

/* ------------------------------------------------------------------ helpers */
function checkTables(s: WorldState, label: string) {
  for (const k of TABLE_KEYS) {
    const t = s[k]
    const keys = Object.keys(t.byId)
    ok(new Set(t.ids).size === t.ids.length, `${label}: ${k} ids unique`)
    ok(keys.length === t.ids.length, `${label}: ${k} byId/ids same size (${keys.length} vs ${t.ids.length})`)
    ok(t.ids.every((id) => (t.byId as Record<string, { id: string }>)[id]?.id === id), `${label}: ${k} byId[id].id === id`)
    ok(t.ids.length <= WORLD.maxPerTable, `${label}: ${k} ≤ ${WORLD.maxPerTable}`)
  }
}
function run(state: WorldState, seq: Seq, type: AnyFollowUp['type'], payload: unknown, source: EventSource = 'user', at = 480) {
  const e = createEvent(state, seq, type, payload as never, source, at)
  return processEvents(state, seq, [e as WorldEvent], (err) => console.error(err))
}

/* ------------------------------------------------------------------ 0. NIK generator (docs/nik.ts) */
section('NIK generator')
ok(nikRegion({ id: 'kalitidu', code: '3522200', kemendagri: '35.22.16' }) === '352216', 'pack kemendagri field wins over the BPS code')
ok(nikRegion({ id: 'kalitidu', code: '3522200' }) === '352216', 'no kemendagri field: built-in Bojonegoro table (not BPS digits)')
ok(nikRegion({ id: 'gayam', code: '3522191' }) !== nikRegion({ id: 'ngasem', code: '3522190' }), 'Gayam and Ngasem no longer share a prefix')
ok(nikRegion({ id: 'somewhere', code: '3204123', kemendagri: '32.04.12' }) === '320412', 'other regions: kemendagri digits')

/* ------------------------------------------------------------------ 1. determinism + size */
for (const { label, pack } of packs) {
  section(`generateWorld — ${label}`)
  const t0 = performance.now()
  const a = generateWorld(pack, 2026)
  const ms = performance.now() - t0
  const ja = JSON.stringify(a)
  ok(ja === JSON.stringify(generateWorld(pack, 2026)), 'same seed + region ⇒ identical JSON')
  ok(ja !== JSON.stringify(generateWorld(pack, 2027)), 'different seed ⇒ different world')
  ok(ja.length < 2.5 * 1024 * 1024, `size ${(ja.length / 1024).toFixed(0)} KB < 2.5 MB`)
  console.log(`  generated in ${ms.toFixed(0)} ms, ${(ja.length / 1024).toFixed(0)} KB`)
  checkTables(a, label)
  const c = tableCounts(a)
  ok(c.citizens === 300, `≈300 citizens (${c.citizens})`)
  ok(c.complaints === 140 && c.tickets === 140, `140 complaints + tickets (${c.complaints}/${c.tickets})`)
  ok(c.businesses === 120, `120 businesses (${c.businesses})`)
  ok(c.products >= 350 && c.products <= 450, `~400 SKUs (${c.products})`)
  ok(c.outlets === 3, '3 outlets for the shop')
  ok(c.candidates === 200, '200 candidates')
  ok(c.markets === pack.markets.length, 'markets from pack')
  ok(c.prices === pack.markets.length * pack.economy.commodities.length, 'prices = markets × commodities')
  ok(c.econIndex === pack.kecamatan.length * 12, 'econ index = kecamatan × 12 months')
  ok(rows(a.prices).every((p) => p.history.length === 60), 'price history 60 days')
  ok(rows(a.stock).every((st) => st.history.length === 90), 'SKU history 90 days')
  ok(c.procurements > 0 && !rows(a.procurements).some((p) => p.key === 'pompa-darurat'), 'pump package NOT pre-generated')
  const shop = a.businesses.byId[a.meta.shopId]!
  ok(shop.name.startsWith('Toko Bangunan ') && shop.marketId === pack.scenario.shopMarketId, `shop at scenario market (${shop.name})`)
  const today = rows(a.complaints).filter((x) => x.at >= 0)
  ok(today.length >= 10 && today.some((x) => x.at >= 360 && x.at < 420), `today's 06:00–07:00 activity (${today.length} today)`)
  const desaIds = new Set(pack.kecamatan.flatMap((k) => k.desa.map((d) => d.id)))
  ok(rows(a.citizens).every((x) => desaIds.has(x.desaId)), 'addresses use real desa from the pack')
  ok(rows(a.tickets).every((t) => a.complaints.byId[t.complaintId]), 'tickets reference complaints')
  ok(rows(a.products).every((p) => a.outlets.byId[p.outletId]), 'products reference outlets')
  const niks = rows(a.documents).filter((d) => d.program === 'bansos-banjir').map((d) => d.nik)
  ok(niks.length === 50 && niks.length - new Set(niks).size === 3, '50 bansos registrants with exactly 3 duplicate NIKs')
  // one NIK rule (docs/nik.ts): every seeded document passes parseNik for this pack's kecamatan
  const regions = nikRegions(pack.kecamatan)
  ok(regions.size === pack.kecamatan.length, `every kecamatan has its own NIK region code (${regions.size}/${pack.kecamatan.length})`)
  const docs = rows(a.documents).filter((d) => d.nik)
  const badNik = docs.filter((d) => !parseNik(d.nik!, regions).ok)
  ok(docs.length > 0 && badNik.length === 0, `every seeded document passes parseNik (${docs.length - badNik.length}/${docs.length}${badNik.length ? `; e.g. ${badNik[0]!.nik} ${parseNik(badNik[0]!.nik!, regions).problem}` : ''})`)
  ok(docs.every((d) => parseNik(d.nik!).ok), 'every seeded NIK also passes the default (all-Bojonegoro) parseNik')
  const byNik = new Map<string, typeof docs>()
  for (const d of docs) byNik.set(d.nik!, [...(byNik.get(d.nik!) ?? []), d])
  const dupes = [...byNik.values()].filter((g) => g.length > 1)
  ok(dupes.length === 3 && dupes.every((g) => g.length === 2 && g.every((d) => d.program === 'bansos-banjir')), `only the 3 intended bansos pairs share a NIK (${dupes.map((g) => g.length).join(',') || 'none'})`)
  const dupIds = new Set(dupes.flatMap((g) => g.map((d) => d.id)))
  const kecById = new Map(pack.kecamatan.map((k) => [k.id, k]))
  const regionMismatch = docs.filter((d) => !dupIds.has(d.id) && d.nik!.slice(0, 6) !== nikRegion(kecById.get(d.kecamatanId) ?? { id: d.kecamatanId }))
  ok(regionMismatch.length === 0, `NIK region digits = the document's kecamatan (Kemendagri) (${regionMismatch.length} off)`)
  const yearNum = Number(a.day.slice(0, 4))
  const personOff = docs.filter((d) => {
    if (dupIds.has(d.id) || !d.citizenId) return false
    const c = a.citizens.byId[d.citizenId]
    const p = parseNik(d.nik!, regions)
    return !c || p.gender !== c.gender || p.yy !== (yearNum - c.age) % 100
  })
  ok(personOff.length === 0, `NIK gender + birth-year digits match the citizen (${personOff.length} off)`)
  if (pack.kecamatan.some((k) => k.id === 'kalitidu')) {
    ok(nikRegion(kecById.get('kalitidu')!) === '352216' && nikRegion(kecById.get('bojonegoro')!) === '352215' && nikRegion(kecById.get('trucuk')!) === '352223', 'Kemendagri codes: Kalitidu 35.22.16, Bojonegoro 35.22.15, Trucuk 35.22.23')
  }
  ok(a.auditLog.ids.length > 0, `seeded audit rows for this morning (${a.auditLog.ids.length})`)
  ok(rows(a.auditLog).every((x) => x.source === 'clock' && !!x.origin), 'seeded morning activity is background: source clock + origin product')
  const groups = new Set(rows(a.citizens).map((x) => x.group))
  ok(groups.size >= 5, `diverse name groups (${[...groups].join(', ')})`)
  const ledgerOk = rows(a.ledger).every((j) => j.lines.reduce((x, l) => x + l.debit - l.credit, 0) === 0)
  ok(ledgerOk, 'every journal entry balances (debit = credit)')
}

/* ------------------------------------------------------------------ 2. reactions */
section('reactions')
{
  let s = generateWorld(MINI_PACK, 2026)
  const seq: Seq = { ...s.meta.seq }
  const flood = MINI_PACK.scenario.floodKecamatanIds
  // flood.alert ⇒ procurement + forecast + need + eligibility
  let r = run(s, seq, 'flood.alert', { level: 3, kecamatanIds: flood }, 'siaga-wilayah', 380)
  s = r.state
  const types = r.processed.map((e) => e.type)
  ok(types[0] === 'flood.alert', 'flood.alert processed first')
  for (const t of ['procurement.created', 'stock.forecastChanged', 'need.created', 'eligibility.opened'] as const) ok(types.includes(t), `flood.alert ⇒ ${t}`)
  const pump = rows(s.procurements).find((p) => p.key === 'pompa-darurat')
  ok(pump && pump.name.id === 'Pengadaan Pompa Air Darurat' && !pump.flagged && pump.riskScore === null, 'pump procurement created, not flagged')
  ok(pump && pump.bidderIds.filter((b) => s.bidders.byId[b]?.ring === 'pompa').length >= 3, 'pump bidders include the affiliated ring')
  const floodSkus = rows(s.products).filter((p) => p.tags.some((t) => ['sandbag', 'pump', 'tarp'].includes(t)))
  ok(floodSkus.length > 10 && floodSkus.every((p) => s.stock.byId[p.id]!.factor === WORLD.floodDemandFactor), `flood SKUs ×${WORLD.floodDemandFactor} (${floodSkus.length})`)
  const need = rows(s.catalogNeeds).find((n) => n.emergency)
  ok(need && need.kecamatanId === flood[0] && need.items.some((i) => i.category === 'karung-pasir') && need.items.some((i) => i.category === 'terpal'), 'katalog need: sandbags + tarps for the flooded kecamatan')
  ok(rows(s.programs).some((p) => p.kind === 'bansos-banjir' && p.open), 'bansos eligibility opened')
  ok(r.processed.slice(1).every((e) => e.depth === 1 && e.causeId === r.processed[0]!.id), 'follow-ups carry depth 1 + causeId')
  // idempotent: a second alert does not duplicate the package / forecast
  r = run(s, seq, 'flood.alert', { level: 4, kecamatanIds: flood }, 'siaga-wilayah', 400)
  s = r.state
  ok(rows(s.procurements).filter((p) => p.key === 'pompa-darurat').length === 1, 'second flood.alert: no duplicate pump package')
  ok(!r.processed.some((e) => e.type === 'stock.forecastChanged'), 'second flood.alert: forecast already raised')

  // price.anomaly ⇒ market.operation recommendation (once per commodity)
  const pp = rows(s.prices)[0]!
  r = run(s, seq, 'price.anomaly', { marketId: pp.marketId, commodityId: pp.commodityId, price: Math.round(pp.price * 1.3), expected: pp.price, deltaPct: 30 }, 'sinyal-pasar', 600)
  s = r.state
  const sug = instructionSuggestions(s)
  ok(sug.length === 1 && sug[0]!.forRole === 'kepala-daerah' && sug[0]!.commodityId === pp.commodityId, 'price.anomaly ⇒ market.operation recommended for Meja Pimpinan')
  r = run(s, seq, 'price.anomaly', { marketId: pp.marketId, commodityId: pp.commodityId, price: Math.round(pp.price * 1.35), expected: pp.price, deltaPct: 35 }, 'sinyal-pasar', 610)
  s = r.state
  ok(instructionSuggestions(s).length === 1, 'no duplicate suggestion while one is open')
  // accepting it as an instruction moves it to approved
  r = run(s, seq, 'instruction.issued', { text: { id: 'Gelar operasi pasar', en: 'Run a market operation' }, opdIds: ['disperindag'], origin: `marketOps:${sug[0]!.id}` }, 'meja-pimpinan', 620)
  s = r.state
  ok(s.marketOps.byId[sug[0]!.id]!.stage === 'approved', 'instruction with origin approves the suggestion')

  // instruction.issued ⇒ letter.dispositioned + actionItem.created per OPD
  const before = s.actionItems.ids.length
  r = run(s, seq, 'instruction.issued', { text: { id: 'Kerahkan pompa ke Kel. Ledok Kulon', en: 'Deploy pumps to Ledok Kulon' }, opdIds: ['bpbd', 'pupr'] }, 'meja-pimpinan', 630)
  s = r.state
  const ins = rows(s.instructions)[0]!
  ok(r.processed.filter((e) => e.type === 'letter.dispositioned').length === 1, 'instruction ⇒ 1 disposition')
  ok(s.actionItems.ids.length === before + 2 && ins.actionItemIds.length === 2, 'instruction ⇒ action item per OPD')
  ok(ins.letterId && s.letters.byId[ins.letterId]?.status === 'didisposisi', 'instruction linked to its dispositioned letter')

  // complaint.created (banjir) ⇒ complaint.clustered when ≥ 5 similar within 1 km today
  const centre: [number, number] = [111.95, -7.13]
  let clustered: WorldEvent[] = []
  for (let i = 0; i < 5; i++) {
    r = run(s, seq, 'complaint.created', { category: 'banjir', channel: 'wa', text: 'Banjir', kecamatanId: 'bojonegoro', desaId: 'ledok-kulon', coord: offsetKm(centre, i * 0.1, 0.05) }, 'sapa-warga', 640 + i)
    s = r.state
    clustered = clustered.concat(r.processed.filter((e) => e.type === 'complaint.clustered'))
  }
  ok(clustered.length === 1, `5th similar complaint ⇒ cluster (${clustered.length})`)
  const cl = rows(s.clusters)[0]
  ok(cl && cl.complaintIds.length >= 5 && cl.complaintIds.every((id) => s.complaints.byId[id]!.clusterId === cl.id), 'cluster holds the complaints')
  r = run(s, seq, 'complaint.created', { category: 'banjir', channel: 'wa', text: 'Banjir', kecamatanId: 'bojonegoro', desaId: 'ledok-kulon', coord: offsetKm(centre, 0.2, 0.1) }, 'sapa-warga', 660)
  s = r.state
  ok(rows(s.clusters).length === 1 && rows(s.clusters)[0]!.complaintIds.length === cl!.complaintIds.length + 1, '6th joins the existing cluster')
  r = run(s, seq, 'complaint.created', { category: 'banjir', channel: 'wa', text: 'Banjir', kecamatanId: 'kalitidu', desaId: 'kalitidu', coord: [111.7, -7.15] }, 'sapa-warga', 661)
  ok(!r.processed.some((e) => e.type === 'complaint.clustered'), 'a far-away flood complaint does not cluster')
  s = r.state
  ok(distanceKm(rows(s.clusters)[0]!.center, centre) < 1, 'cluster centre near the reports')

  // sale.created ⇒ ledger.posted (balanced, linked) and stock decreases
  const shopOutlet = rows(s.outlets).find((o) => o.kind === 'toko')!
  const sku = rows(s.products).find((p) => p.outletId === shopOutlet.id && (s.stock.byId[p.id]?.onHand ?? 0) > 3)!
  const onHand = s.stock.byId[sku.id]!.onHand
  r = run(s, seq, 'sale.created', { outletId: shopOutlet.id, items: [{ productId: sku.id, qty: 2, price: sku.price }], payment: 'qris' }, 'toko-autopilot', 700)
  s = r.state
  const sale = rows(s.sales)[0]!
  const j = rows(s.ledger).find((x) => x.refId === sale.id)
  ok(j && j.lines.reduce((a, l) => a + l.debit - l.credit, 0) === 0, 'sale ⇒ balanced journal entry')
  ok(s.stock.byId[sku.id]!.onHand === onHand - 2, 'sale decrements stock')
  ok(s.salesDaily.byId[`${shopOutlet.id}:0`]!.tx >= 1, 'sale updates today’s daily aggregate')

  // compliance ⇒ score.updated
  const shopId = s.meta.shopId
  const s0 = s.bizScores.byId[shopId]!.score
  r = run(s, seq, 'ledger.posted', { businessId: shopId, memo: { id: 'Nota tanpa kategori', en: 'Uncategorised receipt' }, lines: [{ account: 'Beban Lain-lain', debit: 50000, credit: 0 }, { account: 'Kas', debit: 0, credit: 50000 }], source: 'nota', needsReview: true }, 'pajak-beres', 710)
  s = r.state
  ok(r.processed.some((e) => e.type === 'score.updated') && s.bizScores.byId[shopId]!.score < s0, 'journal needing review ⇒ score down')
  const s1 = s.bizScores.byId[shopId]!.score
  r = run(s, seq, 'tax.ready', { businessId: shopId, period: s.day.slice(0, 7) }, 'pajak-beres', 720)
  s = r.state
  ok(s.businesses.byId[shopId]!.taxTidy && s.bizScores.byId[shopId]!.score > s1, 'tax.ready ⇒ Pajak Rapi + score up')
  const unverified = rows(s.businesses).find((b) => !b.verified)!
  const s2 = s.bizScores.byId[unverified.id]!.score
  r = run(s, seq, 'partner.verified', { subjectKind: 'business', subjectId: unverified.id, kind: 'kyb', result: 'lolos', score: 91 }, 'kenal-mitra', 730)
  s = r.state
  ok(s.businesses.byId[unverified.id]!.verified && s.bizScores.byId[unverified.id]!.score > s2, 'partner.verified ⇒ badge + score up')

  // hoax.detected ⇒ nothing automatic
  r = run(s, seq, 'hoax.detected', { claim: { id: 'Bendungan jebol', en: 'Dam collapsed' }, score: 0.92, spreadPerHour: 340, accounts: ['@x'], topic: 'banjir' }, 'radar-isu', 740)
  ok(r.processed.length === 1, 'hoax.detected has no automatic follow-up')
  s = r.state

  // depth limit
  const deep = createEvent(s, seq, 'sale.created', { outletId: shopOutlet.id, items: [{ productId: sku.id, qty: 1, price: sku.price }], payment: 'tunai' }, 'toko-autopilot', 750, WORLD.maxDepth)
  r = processEvents(s, seq, [deep as WorldEvent])
  ok(r.dropped === 1 && r.processed.length === 1, `follow-ups beyond depth ${WORLD.maxDepth} are dropped`)
  ok(REACTIONS.every((x) => typeof x.run === 'function'), `${REACTIONS.length} reactions registered`)

  // data trail
  const trail = auditFor(s, `complaints:${clustered[0] ? (clustered[0].payload as { complaintIds: string[] }).complaintIds[0]! : ''}`)
  ok(trail.length >= 2 && trail[0]!.type === 'complaint.created', 'auditFor(complaint) gives its trail (created → clustered)')
  ok(overdueActions(s, 720).length >= 0 && slaOnTimePct(s) >= 0 && slaOnTimePct(s) <= 100, 'selectors run')
  ok(complaintKpi(s, 720) === complaintKpi(s, 720), 'param selector memoised')
}

/* ------------------------------------------------------------------ 3. 1000 random events */
section('1000 random events — invariants + determinism')
function randomRun(seed: number) {
  let s = generateWorld(MINI_PACK, 2026)
  const seq: Seq = { ...s.meta.seq }
  const startAudit = s.auditLog.ids.length
  const r = makeRng(seed)
  let processed = 0
  const eventIds: string[] = []
  for (let i = 0; i < 1000; i++) {
    const at = 420 + Math.floor(i / 2)
    const pick = <T>(t: { ids: string[]; byId: Record<string, T> }) => t.byId[r.pick(t.ids)]!
    const kec = r.pick(s.region.kecamatan)
    const desa = r.pick(kec.desa)
    const gens: (() => [AnyFollowUp['type'], unknown, EventSource])[] = [
      () => ['complaint.created', { category: r.pick(['banjir', 'sampah', 'jalan-rusak', 'pju'] as const), channel: 'wa', text: 'x', kecamatanId: kec.id, desaId: desa.id, coord: offsetKm(desa.centroid, r.float(-0.4, 0.4), r.float(-0.4, 0.4)) }, 'sapa-warga'],
      () => ['ticket.statusChanged', { ticketId: pick(s.tickets).id, status: r.pick(['diverifikasi', 'diteruskan', 'diproses', 'selesai'] as const), rating: r.int(1, 5) }, 'sapa-warga'],
      () => { const o = pick(s.outlets); const p = rows(s.products).find((x) => x.outletId === o.id && !x.tags.includes('bahan'))!; return ['sale.created', { outletId: o.id, items: [{ productId: p.id, qty: r.int(1, 3), price: p.price }], payment: 'qris' }, 'toko-autopilot'] },
      () => ['flood.alert', { level: r.pick([2, 3, 4] as const), kecamatanIds: [kec.id] }, 'siaga-wilayah'],
      () => { const p = pick(s.prices); return ['price.anomaly', { marketId: p.marketId, commodityId: p.commodityId, price: p.price * 1.2, expected: p.price, deltaPct: 20 }, 'sinyal-pasar'] },
      () => ['instruction.issued', { text: { id: 'Instruksi', en: 'Instruction' }, opdIds: [r.pick(s.region.opd).id] }, 'meja-pimpinan'],
      () => ['mention.created', { outlet: 'Rona Kabar', kind: 'berita', author: 'Redaksi', text: { id: 'a', en: 'a' }, sentiment: 'netral', score: 0, topic: 'layanan', reach: 10 }, 'radar-isu'],
      () => ['ledger.posted', { businessId: s.meta.shopId, memo: { id: 'm', en: 'm' }, lines: [{ account: 'Kas', debit: 1, credit: 0 }, { account: 'Pendapatan Lain-lain', debit: 0, credit: 1 }], source: 'manual', needsReview: r.chance(0.3) }, 'pajak-beres'],
      () => ['partner.verified', { subjectKind: 'business', subjectId: pick(s.businesses).id, kind: 'kyb', result: r.pick(['lolos', 'ditolak'] as const) }, 'kenal-mitra'],
      () => ['need.created', { title: { id: 'n', en: 'n' }, items: [], kecamatanId: kec.id, deadlineDays: 2 }, 'katalog-lokal'],
      () => ['po.sent', { businessId: s.meta.shopId, supplierId: pick(s.suppliers).id, items: [] }, 'toko-autopilot'],
      () => ['hoax.detected', { claim: { id: 'h', en: 'h' }, score: 0.9, spreadPerHour: 10, accounts: [], topic: 'banjir' }, 'radar-isu'],
      () => ['tax.ready', { businessId: s.meta.shopId, period: s.day.slice(0, 7) }, 'pajak-beres'],
      () => ['market.operation', { stage: 'done', commodityId: pick(s.prices).commodityId, marketIds: [pick(s.markets).id] }, 'sinyal-pasar'],
      () => ['score.updated', { businessId: s.meta.shopId, score: r.int(500, 900), delta: 1, reason: { id: 'r', en: 'r' } }, 'rapor-usaha'],
    ]
    const [type, payload, source] = r.pick(gens)()
    const e = createEvent(s, seq, type, payload as never, source, at)
    const res = processEvents(s, seq, [e as WorldEvent], (err, ev) => {
      console.error('reducer error', ev.type, err)
      failures++
    })
    s = res.state
    processed += res.processed.length
    for (const p of res.processed) eventIds.push(p.id)
  }
  return { s, processed, startAudit, eventIds }
}
{
  const a = randomRun(99)
  checkTables(a.s, 'after 1000 events')
  ok(new Set(a.eventIds).size === a.eventIds.length, `event ids unique (${a.eventIds.length} processed incl. reactions)`)
  const nums = a.eventIds.map((x) => Number(x.slice(1)))
  ok(nums.every((n, i) => i === 0 || n > nums[i - 1]!), 'event ids increase monotonically')
  ok(a.s.auditLog.ids.length === Math.min(WORLD.maxPerTable, a.startAudit + a.processed), `auditLog rows = seeded + processed events (${a.s.auditLog.ids.length} = ${a.startAudit} + ${a.processed})`)
  ok(new Set(rows(a.s.auditLog).map((x) => x.eventId)).size === a.s.auditLog.ids.length, 'one audit row per event')
  ok(a.s.meta.processed === a.processed, 'meta.processed counts events')
  const b = randomRun(99)
  ok(JSON.stringify(a.s) === JSON.stringify(b.s), 'same seed + same random events ⇒ identical world')
  // cap: push 5100 mentions through one table
  let s = a.s
  const seq: Seq = { ...s.meta.seq }
  const evs = Array.from({ length: 5100 }, () => createEvent(s, seq, 'mention.created', { outlet: 'x', kind: 'sosmed', author: 'y', text: { id: 'a', en: 'a' }, sentiment: 'netral', score: 0, topic: 't', reach: 1 }, 'radar-isu', 900))
  const t0 = performance.now()
  s = processEvents(s, seq, evs as WorldEvent[]).state
  ok(s.mentions.ids.length === WORLD.maxPerTable && s.auditLog.ids.length === WORLD.maxPerTable, `tables capped at ${WORLD.maxPerTable} (oldest dropped)`)
  console.log(`  5100 events in one batch: ${(performance.now() - t0).toFixed(0)} ms`)
  checkTables(s, 'after cap')
}

/* ------------------------------------------------------------------ 4. natural events */
section('natural events')
{
  const s = generateWorld(MINI_PACK, 2026)
  ok(JSON.stringify(naturalEventsAt(s, 545)) === JSON.stringify(naturalEventsAt(s, 545)), 'deterministic per seed + minute')
  let busy = 0
  let quiet = 0
  for (let m = 7 * 60; m < 11 * 60; m++) busy += naturalEventsAt(s, m).length
  for (let m = 0; m < 4 * 60; m++) quiet += naturalEventsAt(s, m).length
  ok(busy > quiet * 3, `busy 07–11 (${busy}) ≫ quiet 00–04 (${quiet})`)
  const kinds = new Set<string>()
  for (let m = 420; m < 1020; m++) for (const e of naturalEventsAt(s, m)) kinds.add(e.type)
  ok(['complaint.created', 'sale.created', 'mention.created', 'price.updated'].every((k) => kinds.has(k)), `kinds: ${[...kinds].join(', ')}`)
  // background events are nobody's action: source 'clock', owning product kept in `origin` (C3)
  const all: AnyFollowUp[] = []
  for (let m = 420; m < 1020; m++) all.push(...naturalEventsAt(s, m))
  ok(all.length > 0 && all.every((e) => e.source === 'clock'), `every natural event has source 'clock' (${all.length})`)
  ok(all.every((e) => !!e.origin && isProductSlug(e.origin)), 'every natural event names its owning product in origin')
  ok(all.filter((e) => e.type === 'sale.created').every((e) => e.origin === 'toko-autopilot'), 'natural sale → origin toko-autopilot')
}

/* ------------------------------------------------------------------ 5. store: microtask batch + one notify */
section('store')
await (async () => {
  await loadWorld(MINI_PACK, 2026)
  ok(world.status() === 'ready' && world.get().citizens.ids.length === 300, 'loadWorld (no IndexedDB in Node ⇒ generated)')
  let notifies = 0
  const unsub = world.subscribe(() => notifies++)
  const seen: string[] = []
  const off = onEvent('*', (e) => seen.push(e.type))
  const before = world.get()
  const e1 = emit('complaint.created', { category: 'sampah', channel: 'web', text: 'Sampah', kecamatanId: 'bojonegoro', desaId: 'jetak', coord: [111.893, -7.153] }, 'sapa-warga')
  emit('flood.alert', { level: 3, kecamatanIds: ['bojonegoro'] }, 'siaga-wilayah')
  emit('price.anomaly', { marketId: 'pasar-kota', commodityId: 'cabai-rawit', price: 60000, expected: 45000, deltaPct: 33 }, 'sinyal-pasar')
  ok(e1.payload.id?.startsWith('SW-2026-') && e1.payload.ticketId, `emit returns the event with ids (${e1.payload.id})`)
  ok(world.get() === before && notifies === 0, 'nothing applied synchronously')
  await settled()
  ok(notifies === 1, `one notify per microtask batch (${notifies})`)
  ok(seen.length >= 8 && seen.includes('market.operation') && seen.includes('procurement.created'), `onEvent sees direct + reaction events (${seen.length})`)
  ok(world.get().complaints.byId[e1.payload.id!] !== undefined, 'complaint in the store')
  ok(world.get().citizens === before.citizens, 'untouched tables keep identity (structural sharing)')
  // natural-style emit: source 'clock' + origin → audit row keeps both; its reactions are not product actions
  const nat = emit('mention.created', { outlet: 'Forum Warga', kind: 'forum', author: 'Redaksi', text: { id: 'a', en: 'a' }, sentiment: 'netral', score: 0, topic: 'layanan', reach: 5 }, 'clock', { origin: 'radar-isu' })
  await settled()
  const natRow = rows(world.get().auditLog).find((x) => x.eventId === nat.id)
  ok(natRow?.source === 'clock' && natRow.origin === 'radar-isu', `clock event audit row: source clock, origin radar-isu (${natRow?.source}/${natRow?.origin})`)
  const json = exportWorld()
  await resetWorld()
  ok(world.get().complaints.byId[e1.payload.id!] === undefined, 'resetWorld returns to the seed')
  importWorld(json)
  ok(world.get().complaints.byId[e1.payload.id!] !== undefined, 'importWorld restores an export')
  off()
  unsub()

  // the running clock's natural events: the generator is loaded lazily; minutes crossed meanwhile are replayed in order
  await resetWorld()
  clock.setTime(600)
  const s0 = world.get()
  const want: string[] = []
  for (let m = 540; m <= 600; m++) for (const o of naturalEventsAt(s0, m)) want.push(`${m}:${o.type}`)
  const got: string[] = []
  const off2 = onEvent('*', (e) => {
    if (e.source === 'clock' && (e.depth ?? 0) === 0) got.push(`${e.at}:${e.type}`)
  })
  setNaturalEvents(true)
  for (let m = 540; m <= 600; m++) _onNaturalMinute(m)
  for (let i = 0; i < 50 && got.length < want.length; i++) {
    await new Promise((r) => setTimeout(r, 10))
    await settled()
  }
  ok(want.length > 0 && JSON.stringify(got) === JSON.stringify(want), `clock minutes → natural events, in order, same as naturalEventsAt (${got.length}/${want.length})`)
  setNaturalEvents(false)
  _onNaturalMinute(601)
  await settled()
  ok(got.length === want.length, 'no natural events while switched off')
  setNaturalEvents(true)
  off2()
})()

console.log(`\n${failures ? '✗' : '✓'} ${passes} passed, ${failures} failed`)
exit(failures ? 1 : 0)
