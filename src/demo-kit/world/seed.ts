/**
 * world/seed.ts — deterministic world generator (spec §6.1). `generateWorld(pack, seed)` builds a believable
 * morning of the demo day: same seed + same region ⇒ byte-identical JSON. Every stream of randomness is named
 * (streamRng) so tweaking one generator never reshuffles the others.
 *
 * Real: kecamatan / desa / markets / commodities / OPD names from the region pack.
 * Fictional: every citizen, business, supplier, vendor, outlet, medium, account, bank and transaction.
 */
import type { RegionPack } from '../region/types'
import type {
  ActionItem, Alert, AuditEntry, Bi, Bid, Bidder, BizScore, Booking, BrandMention, Business, Call, Candidate, CatalogNeed, Chat,
  Citizen, Coaching, Complaint, ComplaintCategory, DocumentRec, EconIndex, LedgerEntry, Letter, LngLat, LoanApp, Market, Match,
  Meeting, Mention, Minutes, Order, Outlet, PricePoint, Procurement, Product, PurchaseOrder, RegionRef, Sale, SaleItem, SalesAgent,
  SalesDay, ScoreFactor, StockLevel, Supplier, TableKey, TaxItem, Tender, Ticket, TicketStatus, Verification, WorldState,
} from './types'
import {
  ACTION_TPL, AGENT_TEAMS, BIZ_KINDS, BIZ_WORDS, BRAND_TEXT, CALL_CUSTOMERS, CANDIDATE_ROLES, CATEGORY_LABEL, CATEGORY_OPD_HINTS,
  CATEGORY_SLA_DAYS, COMPANY_WORDS, COMPETITOR_BRANDS, COMPLAINT_TEXT, COMPLAINT_WEIGHTS, LENDERS, LETTER_TPL, MEDIA_OUTLETS,
  MEETING_PARTICIPANTS, MEETING_TPL, MENTION_TEXT, PROCUREMENT_TPL, SHOP_NAMES, SKILLS, SKUS, SOCIAL_HANDLES, TENDER_TPL,
  type SkuRow,
} from './catalog'
import { makeNamer, makeRng, mulberry32, hashString, streamRng, groupWeights, personName, type Rng } from './rng'
import { formatId, nextId, type Seq } from './ids'
import { scoreOf, computeScore } from './score'
import { DAY_MIN, HOUR_RHYTHM, WORLD, clamp, emptyTable, isoDay, monthOf, offsetKm, pad, round, roundCoord, tableFrom } from './util'

export { mulberry32, hashString, makeRng, streamRng, groupWeights, personName, makeNamer }
export type { Rng }

/* ------------------------------------------------------------------ constants */
/** PPh final UMKM rate 0.5 % of gross turnover — PP 55/2022 (berlaku 2022–). Pajak Beres's rules.ts is the authority. */
const PPH_FINAL_UMKM_RATE = 0.005
/** average receipt (Rp) */
const AVG_TICKET = { toko: 320_000, fnb: 21_000 }
const GEN = {
  citizens: 300,
  complaints: 140,
  complaintsToday: 14,
  businesses: 120,
  mentions: 160,
  candidates: 200,
  calls: 60,
  brandMentions: 100,
  historyDays: 90,
  priceDays: 60,
  /** last moment of seeded activity (07:00) */
  seedUntil: WORLD.clockStart - 1,
}

/* ------------------------------------------------------------------ helpers */
type Place = { kecamatanId: string; desaId: string; coord: LngLat; label: string }

function pickHour(rng: Rng, from = 0, to = 23): number {
  const pairs: [number, number][] = []
  for (let h = from; h <= to; h++) pairs.push([h, HOUR_RHYTHM[h] ?? 0.1])
  return rng.weighted(pairs)
}
/** minute on day `dayOffset` following the hourly rhythm (clamped before `until` when today) */
function minuteOn(rng: Rng, dayOffset: number, fromH = 0, toH = 23, until?: number): Minutes {
  let m = pickHour(rng, fromH, toH) * 60 + rng.int(0, 59)
  if (until !== undefined && dayOffset === 0 && m > until) m = until - rng.int(0, 50)
  return dayOffset * DAY_MIN + Math.max(0, m)
}
const roundTo = (n: number, step: number): number => Math.round(n / step) * step

function buildRegion(pack: RegionPack, rng: Rng): RegionRef {
  const categoryOpd = {} as Record<ComplaintCategory, string>
  const fallback = pack.opd[0]?.id ?? 'opd'
  for (const [cat, hints] of Object.entries(CATEGORY_OPD_HINTS) as [ComplaintCategory, string[]][]) {
    let found: string | undefined
    for (const h of hints) {
      found = pack.opd.find((o) => `${o.short} ${o.name}`.toLowerCase().includes(h))?.id
      if (found) break
    }
    categoryOpd[cat] = found ?? fallback
  }
  return {
    id: pack.id,
    name: pack.name,
    shortName: pack.shortName,
    opd: pack.opd.map((o) => ({ id: o.id, name: o.name, short: o.short })),
    categoryOpd,
    kecamatan: pack.kecamatan.map((k) => ({
      id: k.id,
      name: k.name,
      centroid: roundCoord(k.centroid),
      riskFlood: k.riskFlood,
      desa: k.desa.map((d, i) => {
        if (d.centroid) return { id: d.id, name: d.name, centroid: roundCoord(d.centroid) }
        // no desa centroid in the pack: deterministic ring around the kecamatan centroid
        const a = (i / Math.max(1, k.desa.length)) * Math.PI * 2 + rng.float(0, 0.5)
        const r = rng.float(1.2, 4)
        return { id: d.id, name: d.name, centroid: offsetKm(k.centroid, Math.cos(a) * r, Math.sin(a) * r) }
      }),
    })),
    commodities: pack.economy.commodities.map((c) => ({ id: c.id, name: c.name, unit: c.unit, basePrice: c.basePrice })),
    services: pack.services.map((s) => ({ id: s.id, name: s.name, slaDays: s.slaDays, opdId: s.opdId })),
    floodKecamatanIds: pack.scenario.floodKecamatanIds,
    floodRiverId: pack.scenario.floodRiverId,
    shopMarketId: pack.scenario.shopMarketId,
  }
}

/* ================================================================== generateWorld */

export function generateWorld(pack: RegionPack, seed: number, opts: { day?: string } = {}): WorldState {
  const day = opts.day ?? WORLD.day
  const year = day.slice(0, 4)
  const S = (stream: string) => streamRng(seed, pack.id, stream)
  const seq: Seq = {}
  const nid = (t: TableKey) => nextId(seq, t, year)
  const region = buildRegion(pack, S('geo'))
  const kecById = new Map(region.kecamatan.map((k) => [k.id, k]))
  const popW: [string, number][] = pack.kecamatan.map((k) => [k.id, Math.max(1, k.population)])
  const floodSet = new Set(region.floodKecamatanIds)
  const now = GEN.seedUntil

  const place = (rng: Rng, kecId?: string, spreadKm = 0.8): Place => {
    const k = kecById.get(kecId ?? rng.weighted(popW)) ?? region.kecamatan[0]!
    const d = k.desa.length ? rng.pick(k.desa) : { id: k.id, name: k.name, centroid: k.centroid }
    const coord = offsetKm(d.centroid, rng.float(-spreadKm, spreadKm), rng.float(-spreadKm, spreadKm))
    const kind = pack.kecamatan.find((x) => x.id === k.id)?.desa.find((x) => x.id === d.id)?.kind === 'kelurahan' ? 'Kel.' : 'Desa'
    return { kecamatanId: k.id, desaId: d.id, coord, label: `${kind} ${d.name}, Kec. ${k.name}` }
  }

  /* ---------------------------------------------------------------- citizens */
  const rc = S('citizens')
  const namer = makeNamer(rc, pack.languages.regional)
  const regionalGroups = new Set(pack.languages.regional)
  const citizens: Citizen[] = []
  for (let i = 0; i < GEN.citizens; i++) {
    const p = namer()
    const pl = place(rc)
    const nativeLang = (Object.entries({ jawa: 'jv', sunda: 'su', minang: 'min', bugis: 'bug', madura: 'mad', bali: 'bal', batak: 'bat', banjar: 'bjn' }) as [string, string][])
      .find(([g]) => g === p.group)?.[1]
    const speaksRegional = nativeLang && regionalGroups.has(nativeLang as never) && rc.chance(0.7)
    citizens.push({
      id: nid('citizens'),
      name: p.name,
      gender: p.gender,
      age: rc.int(18, 78),
      group: p.group,
      kecamatanId: pl.kecamatanId,
      desaId: pl.desaId,
      address: pl.label,
      coord: pl.coord,
      phone: `08${rc.int(11, 99)}-xxxx-${pad(rc.int(0, 9999), 4)}`,
      lang: speaksRegional ? (nativeLang as Citizen['lang']) : 'id',
    })
  }

  /* ---------------------------------------------------------------- complaints + tickets */
  const rq = S('complaints')
  const templates = pack.languages.samples.complaintTemplates
  type Draft = Omit<Complaint, 'id' | 'code' | 'ticketId'>
  const drafts: Draft[] = []
  const floodKec = region.floodKecamatanIds.length ? region.floodKecamatanIds : [region.kecamatan[0]!.id]
  const makeDraft = (at: Minutes, category: ComplaintCategory, pl: Place, urgency?: Complaint['urgency']): Draft => {
    const c = rq.pick(citizens.filter((x) => x.kecamatanId === pl.kecamatanId).slice(0, 40).concat(citizens.slice(0, 1)))
    const tpls = templates.filter((t) => t.category === category)
    const useTpl = tpls.length > 0 && c.lang !== 'id' && rq.chance(0.75)
    const desaName = kecById.get(pl.kecamatanId)?.desa.find((d) => d.id === pl.desaId)?.name ?? ''
    let text: string
    let summary: Bi
    let lang: Complaint['lang'] = 'id'
    let templateId: string | undefined
    if (useTpl) {
      const t = rq.pick(tpls)
      text = t.text
      summary = t.translation
      lang = t.lang
      templateId = t.id
    } else {
      const t = rq.pick(COMPLAINT_TEXT[category])
      text = t.id.replace('{d}', desaName)
      summary = { id: text, en: t.en.replace('{d}', desaName) }
    }
    return {
      citizenId: c.id, category, channel: rq.weighted([['wa', 55], ['web', 20], ['telepon', 10], ['voice', 15]] as const),
      text, lang, summary, kecamatanId: pl.kecamatanId, desaId: pl.desaId, coord: pl.coord,
      urgency: urgency ?? (category === 'banjir' || category === 'pohon-tumbang' ? 'tinggi' : rq.weighted([['rendah', 35], ['sedang', 50], ['tinggi', 15]] as const)),
      at, clusterId: null, templateId, photo: rq.chance(0.45),
    }
  }
  // today: overnight rain → a few flood reports (fewer than the cluster rule, so the demo can form the cluster live)
  const firstFlood = kecById.get(floodKec[0]!)!
  const hotDesa = firstFlood.desa[0]
  for (let i = 0; i < 3; i++) {
    const pl = place(rq, firstFlood.id, 0.3)
    const coord = hotDesa ? offsetKm(hotDesa.centroid, rq.float(-0.35, 0.35), rq.float(-0.35, 0.35)) : pl.coord
    drafts.push(makeDraft(360 + rq.int(0, 58), 'banjir', { ...pl, desaId: hotDesa?.id ?? pl.desaId, coord }, 'tinggi'))
  }
  for (let i = 0; i < 2; i++) drafts.push(makeDraft(330 + rq.int(0, 85), 'banjir', place(rq, floodKec[(i + 1) % floodKec.length]), 'tinggi'))
  for (let i = drafts.length; i < GEN.complaintsToday; i++) {
    const night = i < 7
    drafts.push(makeDraft(night ? rq.int(0, 359) : 360 + rq.int(0, 59), rq.weighted(COMPLAINT_WEIGHTS), place(rq)))
  }
  // yesterday: a normal day (a few before 07:00 so "Δ vs kemarin" compares like with like)
  for (let i = 0; i < 9; i++) drafts.push(makeDraft(i < 3 ? -DAY_MIN + rq.int(300, 419) : minuteOn(rq, -1, 7, 21), rq.weighted(COMPLAINT_WEIGHTS), place(rq)))
  for (let i = drafts.length; i < GEN.complaints; i++) {
    const d = -rq.int(2, 30)
    let cat = rq.weighted(COMPLAINT_WEIGHTS)
    const pl = place(rq)
    if (cat === 'banjir' && !floodSet.has(pl.kecamatanId) && rq.chance(0.6)) cat = 'jalan-rusak'
    drafts.push(makeDraft(minuteOn(rq, d), cat, pl))
  }
  drafts.sort((a, b) => a.at - b.at)
  const complaints: Complaint[] = []
  const tickets: Ticket[] = []
  for (const d of drafts) {
    const id = nid('complaints')
    const tid = nid('tickets')
    complaints.push({ ...d, id, code: id, ticketId: tid })
    const sla = CATEGORY_SLA_DAYS[d.category] * DAY_MIN
    const ageDays = (now - d.at) / DAY_MIN
    const flow: TicketStatus[] = ['baru', 'diverifikasi', 'diteruskan', 'diproses', 'selesai']
    let reach: number
    if (ageDays < 0.05) reach = 0
    else if (ageDays < 0.4) reach = rq.weighted([[0, 40], [1, 45], [2, 15]] as const)
    else if (ageDays * DAY_MIN < sla) reach = rq.weighted([[1, 10], [2, 30], [3, 40], [4, 20]] as const)
    else reach = rq.weighted([[2, 6], [3, 14], [4, 80]] as const)
    const history: Ticket['history'] = [{ at: d.at, status: 'baru' }]
    let t = d.at
    const span = Math.max(30, Math.min(now - d.at, sla * rq.float(0.4, 1.3)))
    for (let s = 1; s <= reach; s++) {
      t = Math.min(now, Math.round(d.at + (span * s) / reach))
      history.push({ at: t, status: flow[s]! })
    }
    const status = flow[reach]!
    tickets.push({
      id: tid, code: id, complaintId: id, status, opdId: region.categoryOpd[d.category], createdAt: d.at, updatedAt: t,
      slaDueAt: d.at + sla, closedAt: status === 'selesai' ? t : null,
      rating: status === 'selesai' && rq.chance(0.7) ? rq.weighted([[5, 40], [4, 35], [3, 15], [2, 7], [1, 3]] as const) : null,
      history,
    })
  }

  /* ---------------------------------------------------------------- bookings (MPP queue today) */
  const rb = S('bookings')
  const bookings: Booking[] = []
  for (let i = 0; i < 9 && region.services.length; i++) {
    const sv = rb.pick(region.services)
    const id = nid('bookings')
    bookings.push({ id, code: `A-${pad(i + 1, 3)}`, serviceId: sv.id, citizenId: rb.pick(citizens).id, slotAt: 8 * 60 + rb.int(0, 7) * 30, channel: 'mpp', at: rb.chance(0.5) ? -rb.int(60, 600) : rb.int(300, now) })
  }

  /* ---------------------------------------------------------------- letters, meetings, action items */
  const rl = S('letters')
  const letters: Letter[] = []
  const letterDrafts = Array.from({ length: 24 }, (_, i) => {
    const t = LETTER_TPL[i % LETTER_TPL.length]!
    const recent = i < 6
    const at = recent ? (rl.chance(0.5) ? minuteOn(rl, -1, 12, 16) : rl.int(380, now)) : minuteOn(rl, -rl.int(2, 10), 8, 15)
    return { t, at, recent }
  }).sort((a, b) => a.at - b.at)
  for (const { t, at, recent } of letterDrafts) {
    const id = nid('letters')
    const opds = rl.sample(region.opd, rl.int(1, 2)).map((o) => o.id)
    letters.push({
      id, number: `${rl.int(1, 999).toString().padStart(3, '0')}/${rl.int(100, 999)}/${rl.int(400, 499)}.${rl.int(100, 300)}/${year}`,
      from: t.from, subject: t.s, kind: t.kind, sifat: rl.weighted([['segera', 25], ['biasa', 70], ['rahasia', 5]] as const),
      receivedAt: at, dueAt: rl.chance(0.6) ? at + rl.int(1, 7) * DAY_MIN : null, status: recent ? 'masuk' : 'didisposisi', scanned: rl.chance(0.4),
      disposition: recent ? null : { to: opds, note: { id: 'Tindak lanjuti dan laporkan.', en: 'Follow up and report back.' }, by: 'Sekda', at: at + rl.int(60, 600) },
    })
  }
  const rm = S('meetings')
  const meetings: Meeting[] = []
  const actionItems: ActionItem[] = []
  const meetingDrafts: { title: Bi; at: Minutes; done: boolean }[] = []
  for (let i = 0; i < 6; i++) meetingDrafts.push({ title: MEETING_TPL[(i + 1) % MEETING_TPL.length]!, at: -rm.int(1, 14) * DAY_MIN + rm.int(8, 14) * 60, done: true })
  meetingDrafts.push({ title: MEETING_TPL[0]!, at: 9 * 60, done: false }, { title: MEETING_TPL[3]!, at: 13 * 60 + 30, done: false })
  meetingDrafts.sort((a, b) => a.at - b.at)
  for (const m of meetingDrafts) {
    const id = nid('meetings')
    const items: string[] = []
    if (m.done) {
      for (let k = 0, n = rm.int(3, 5); k < n; k++) {
        const aid = nid('actionItems')
        const due = m.at + rm.int(2, 10) * DAY_MIN
        const opd = rm.pick(region.opd)
        const status: ActionItem['status'] = due < now ? rm.weighted([['selesai', 62], ['proses', 28], ['baru', 10]] as const) : rm.weighted([['baru', 50], ['proses', 45], ['selesai', 5]] as const)
        actionItems.push({ id: aid, title: rm.pick(ACTION_TPL), opdId: opd.id, pic: `Kepala ${opd.short}`, dueAt: due, status, source: { kind: 'meeting', id }, createdAt: m.at + 90 })
        items.push(aid)
      }
    }
    meetings.push({
      id, title: m.title, at: m.at, durationMin: rm.pick([60, 90, 120]), participants: rm.sample(MEETING_PARTICIPANTS, rm.int(4, 6)),
      status: m.done ? 'selesai' : 'terjadwal', transcribed: m.done, summary: m.done ? { id: `Notulen ${m.title.id} disahkan.`, en: `Minutes of ${m.title.en} approved.` } : null,
      actionItemIds: items,
    })
  }

  /* ---------------------------------------------------------------- mentions (Radar Isu) */
  const rn = S('mentions')
  const mentions: Mention[] = []
  const mDrafts = Array.from({ length: GEN.mentions }, (_, i) => {
    const d = i < 22 ? 0 : -rn.int(1, 7)
    return minuteOn(rn, d, 0, 23, now)
  }).sort((a, b) => a - b)
  for (const at of mDrafts) {
    const tpl = rn.pick(MENTION_TEXT)
    const k = kecById.get(rn.weighted(popW))!
    const kind = rn.weighted([['berita', 40], ['sosmed', 50], ['forum', 10]] as const)
    const score = clamp(round(tpl.s + rn.normal(0, 0.15), 2), -1, 1)
    const fill = (s: string) => s.replace('{k}', k.name).replace('{r}', region.shortName)
    mentions.push({
      id: nid('mentions'), at, outlet: kind === 'berita' ? rn.pick(MEDIA_OUTLETS) : kind === 'sosmed' ? rn.pick(SOCIAL_HANDLES) : 'Forum Warga',
      kind, author: kind === 'berita' ? 'Redaksi' : rn.pick(SOCIAL_HANDLES), text: { id: fill(tpl.t.id), en: fill(tpl.t.en) },
      sentiment: score < -0.2 ? 'negatif' : score > 0.2 ? 'positif' : 'netral', score, topic: tpl.topic,
      reach: Math.round(Math.exp(rn.normal(kind === 'berita' ? 8 : 6.5, 1))),
    })
  }

  /* ---------------------------------------------------------------- alerts (one resolved weather alert) */
  const alerts: Alert[] = [{
    id: nid('alerts'), at: -3 * DAY_MIN + 15 * 60, kind: 'cuaca', level: 1,
    title: { id: 'Waspada hujan lebat disertai angin kencang', en: 'Watch: heavy rain with strong winds' },
    kecamatanIds: floodKec.slice(0, 2), desaIds: [], riverId: null, expectedAt: null, status: 'selesai', broadcast: null,
  }]

  /* ---------------------------------------------------------------- bidders + procurements */
  const rp = S('procurement')
  const bidders: Bidder[] = []
  const company = (r: Rng) => `${r.pick(COMPANY_WORDS)} ${r.pick(COMPANY_WORDS)}${r.chance(0.4) ? ' ' + r.pick(COMPANY_WORDS) : ''}`
  const bnamer = makeNamer(rp, pack.languages.regional)
  const ringDefs: { ring: string; n: number }[] = [{ ring: 'pompa', n: 4 }, { ring: 'jalan', n: 3 }]
  for (const { ring, n } of ringDefs) {
    const director = bnamer('L').name
    const addr = place(rp)
    const ip = `10.${rp.int(10, 250)}.${rp.int(0, 255)}.${rp.int(2, 250)}`
    for (let i = 0; i < n; i++) {
      bidders.push({
        id: nid('bidders'), name: company(rp), legal: rp.chance(0.6) ? 'CV' : 'PT', director: i < 2 ? director : bnamer().name,
        address: i !== 1 ? addr.label : place(rp).label, kecamatanId: addr.kecamatanId, ip: i < 3 ? ip : `10.${rp.int(10, 250)}.${rp.int(0, 255)}.${rp.int(2, 250)}`,
        wins: rp.int(1, 6), ring,
      })
    }
  }
  for (let i = bidders.length; i < 36; i++) {
    const pl = place(rp)
    bidders.push({ id: nid('bidders'), name: company(rp), legal: rp.chance(0.55) ? 'CV' : 'PT', director: bnamer().name, address: pl.label, kecamatanId: pl.kecamatanId, ip: `10.${rp.int(10, 250)}.${rp.int(0, 255)}.${rp.int(2, 250)}`, wins: rp.int(0, 4), ring: null })
  }
  const opdByHint = (hints: string[]) => {
    for (const h of hints) {
      const o = region.opd.find((x) => `${x.short} ${x.name}`.toLowerCase().includes(h))
      if (o) return o.id
    }
    return region.opd[0]?.id ?? 'opd'
  }
  const procurements: Procurement[] = PROCUREMENT_TPL.map((t, i) => ({ t, at: -rp.int(3, 60) * DAY_MIN + rp.int(8, 15) * 60, i }))
    .sort((a, b) => a.at - b.at)
    .map(({ t, at }) => {
      const items = t.items.map(([nid_, nen, qty, unit]) => {
        const market = Math.round(t.base / t.items.length / qty / 1000) * 1000 || 1000
        return { name: { id: nid_, en: nen }, qty, unit, hpsPrice: Math.round(market * rp.float(1.0, 1.22) / 100) * 100, marketPrice: market }
      })
      const hps = items.reduce((s, it) => s + it.hpsPrice * it.qty, 0)
      const ringPick = t.hint.includes('pupr') && rp.chance(0.5) ? bidders.filter((b) => b.ring === 'jalan').map((b) => b.id) : []
      const ids = [...new Set([...ringPick, ...rp.sample(bidders.filter((b) => !b.ring), rp.int(2, 5)).map((b) => b.id)])]
      const age = (now - at) / DAY_MIN
      const status: Procurement['status'] = age > 40 ? 'selesai' : age > 25 ? 'kontrak' : age > 12 ? 'evaluasi' : 'pengumuman'
      const analysed = rp.chance(0.4)
      return {
        id: nid('procurements'), code: `${year}-${pad(rp.int(1000, 9999), 4)}`, name: t.n, opdId: opdByHint(t.hint), hps,
        method: hps > 1_000_000_000 ? 'tender' : hps > 200_000_000 ? 'tender-cepat' : 'pengadaan-langsung', status,
        riskScore: analysed ? rp.int(8, 45) : null, flagged: false, findings: [], items, bidderIds: ids, createdAt: at,
        deadlineAt: at + rp.int(14, 30) * DAY_MIN, emergency: false,
      } satisfies Procurement
    })

  /* ---------------------------------------------------------------- businesses */
  const rz = S('businesses')
  const znamer = makeNamer(rz, pack.languages.regional)
  const markets: Market[] = pack.markets.map((m) => ({ id: m.id, name: m.name, coord: roundCoord(m.coord), kecamatanId: m.kecamatanId ?? null }))
  const shopMarket = markets.find((m) => m.id === region.shopMarketId) ?? markets[0]
  const businesses: Business[] = []
  const shopOwner = znamer('L')
  const shopKec = shopMarket?.kecamatanId ?? floodKec[0]!
  const shopPlace = place(rz, shopKec, 0.2)
  const shop: Business = {
    id: nid('businesses'), name: `Toko Bangunan ${rz.pick(SHOP_NAMES)}`, kind: 'toko-bangunan', sector: 'Perdagangan', ownerName: shopOwner.name,
    kecamatanId: shopKec, desaId: shopPlace.desaId, coord: shopMarket ? offsetKm(shopMarket.coord, 0.08, -0.05) : shopPlace.coord, marketId: shopMarket?.id ?? null,
    verified: true, taxTidy: false, monthlyRevenue: 0, employees: 14, since: 2009, supplies: ['karung-pasir', 'terpal', 'pompa', 'semen', 'alat-kerja'], capacity: 25,
  }
  businesses.push(shop)
  for (let i = 1; i < GEN.businesses; i++) {
    const k = rz.weighted(BIZ_KINDS.map((b) => [b, b.w] as const))
    const owner = znamer()
    const pl = place(rz)
    const mk = markets.filter((m) => m.kecamatanId === pl.kecamatanId)
    const base = { 'toko-bangunan': 160, kelontong: 45, 'warung-makan': 38, 'kedai-kopi': 22, katering: 55, konveksi: 70, kerajinan: 30, tani: 50, bengkel: 40, jasa: 60, percetakan: 35, 'olahan-pangan': 28 }[k.kind]
    const firstName = owner.name.split(' ')[0] ?? owner.name
    const nm = k.kind === 'warung-makan' || k.kind === 'katering' ? `${rz.pick(k.names)} ${owner.gender === 'P' ? 'Bu' : 'Pak'} ${firstName}` : `${rz.pick(k.names)} ${rz.pick(BIZ_WORDS)}`
    businesses.push({
      id: nid('businesses'), name: nm, kind: k.kind, sector: k.sector, ownerName: owner.name, kecamatanId: pl.kecamatanId, desaId: pl.desaId, coord: pl.coord,
      marketId: mk.length && (k.kind === 'kelontong' || k.kind === 'toko-bangunan') ? rz.pick(mk).id : null,
      verified: rz.chance(0.45), taxTidy: rz.chance(0.4), monthlyRevenue: roundTo(base * 1_000_000 * Math.exp(rz.normal(0, 0.45)), 100_000),
      employees: rz.int(1, k.kind === 'konveksi' ? 25 : 8), since: rz.int(1998, 2024), supplies: k.supplies, capacity: rz.int(5, 40),
    })
  }

  /* ---------------------------------------------------------------- outlets, suppliers, products, stock */
  const ro = S('shop')
  const fnbName = shop.name.replace('Toko Bangunan ', '')
  const outlets: Outlet[] = [
    { id: nid('outlets'), businessId: shop.id, name: shop.name, kind: 'toko', kecamatanId: shopKec, marketId: shop.marketId, coord: shop.coord, opensAt: 7 * 60, closesAt: 17 * 60 },
    { id: nid('outlets'), businessId: shop.id, name: `Kedai Kopi ${fnbName.split(' ')[0]}`, kind: 'fnb', kecamatanId: shopKec, marketId: null, coord: offsetKm(shop.coord, 0.6, 0.3), opensAt: 6 * 60, closesAt: 22 * 60 },
    { id: nid('outlets'), businessId: shop.id, name: `Warung Makan Bu ${personName(ro, 'jawa', 'P').split(' ')[0]}`, kind: 'fnb', kecamatanId: shopKec, marketId: null, coord: offsetKm(shop.coord, -0.4, 0.5), opensAt: 5 * 60 + 30, closesAt: 20 * 60 },
  ]
  const [oToko, oKopi, oWarung] = outlets as [Outlet, Outlet, Outlet]
  const kecNames = region.kecamatan.map((k) => k.name)
  const supplierGroups: string[][] = [
    ['semen', 'bata'], ['pasir-batu'], ['besi', 'baja-ringan'], ['pipa', 'sanitasi'], ['cat'], ['keramik'], ['kayu', 'atap'], ['listrik'],
    ['paku', 'kunci', 'alat', 'perlengkapan'], ['karung-pasir', 'terpal'], ['pompa'], ['bahan'], ['minuman', 'makanan', 'katering'],
  ]
  const suppliers: Supplier[] = supplierGroups.map((cats) => ({
    id: nid('suppliers'), name: `${ro.pick(['CV', 'UD', 'PT', 'UD'])} ${company(ro)}`, city: ro.chance(0.7) ? ro.pick(kecNames) : 'luar daerah',
    phone: `08${ro.int(11, 99)}-xxxx-${pad(ro.int(0, 9999), 4)}`, categories: cats, leadDays: ro.int(1, 4), reliability: round(ro.float(0.72, 0.98), 2),
  }))
  const supplierFor = (cat: string) => suppliers.find((s) => s.categories.includes(cat))?.id ?? null
  /** category → daily turnover of the whole category in Rp (toko, ≈ Rp 8,5 jt/day); FnB items get per-item unit rates */
  const CAT_DAILY_RP: Record<string, number> = {
    semen: 1_200_000, pipa: 500_000, besi: 900_000, paku: 250_000, cat: 600_000, keramik: 500_000, bata: 450_000, 'pasir-batu': 700_000, kayu: 600_000,
    'baja-ringan': 350_000, atap: 450_000, listrik: 450_000, sanitasi: 350_000, alat: 250_000, 'karung-pasir': 120_000, terpal: 100_000, pompa: 250_000,
    perlengkapan: 150_000, kunci: 100_000,
  }
  const products: Product[] = []
  const stockDraft: { p: Product; base: number }[] = []
  const addSkus = (rowsIn: SkuRow[], outlet: Outlet, prefix: string, menu: boolean) => {
    const weightsByCat = new Map<string, number>()
    const w = rowsIn.map((r) => {
      const x = ro.float(0.25, 1.75)
      weightsByCat.set(r[1], (weightsByCat.get(r[1]) ?? 0) + x)
      return x
    })
    rowsIn.forEach(([name, category, unit, price, tags], i) => {
      const sellable = !menu || category !== 'bahan'
      const margin = menu ? (sellable ? ro.float(0.4, 0.62) : 0) : ro.float(0.12, 0.26)
      const p: Product = {
        id: nid('products'), businessId: shop.id, outletId: outlet.id, sku: `${prefix}-${pad(i + 1, 4)}`, name, category, unit, price,
        cost: sellable ? Math.round((price * (1 - margin)) / 50) * 50 : price, supplierId: supplierFor(menu && category !== 'bahan' ? 'bahan' : category), tags: tags ?? [],
      }
      if (menu && category === 'bahan') p.tags = [...p.tags, 'bahan']
      products.push(p)
      const base = menu ? (sellable ? ro.float(1.5, 11) : ro.float(0.3, 2.2)) : ((CAT_DAILY_RP[category] ?? 150_000) * w[i]!) / (weightsByCat.get(category) ?? 1) / price
      stockDraft.push({ p, base })
    })
  }
  addSkus(SKUS.shop, oToko, 'TB', false)
  addSkus(SKUS.kopi, oKopi, 'KK', true)
  addSkus(SKUS.warung, oWarung, 'WM', true)

  // 90 days of demand per SKU (weekday pattern, payday bump, rainy-season lift on flood goods)
  const dayDate = (off: number) => new Date(`${isoDay(day, off)}T00:00:00Z`)
  const dayFactor: number[] = []
  const dayFactorFnb: number[] = []
  for (let d = 0; d < GEN.historyDays; d++) {
    const off = d - GEN.historyDays
    const dt = dayDate(off)
    const dow = dt.getUTCDay()
    const dom = dt.getUTCDate()
    const payday = dom >= 25 || dom <= 3 ? 1.14 : 1
    dayFactor.push((dow === 0 ? 0.55 : dow === 6 ? 1.15 : 1) * payday)
    dayFactorFnb.push((dow === 0 || dow === 6 ? 1.22 : 1) * payday)
  }
  const draw = (x: number) => Math.max(0, Math.floor(x + ro.next()))
  const stock: StockLevel[] = stockDraft.map(({ p, base }) => {
    const fnb = p.outletId !== oToko.id
    const flood = p.tags.includes('flood')
    const history: number[] = []
    for (let d = 0; d < GEN.historyDays; d++) {
      const rainy = flood && d >= GEN.historyDays - 30 ? 1.3 : 1
      history.push(draw(base * (fnb ? dayFactorFnb[d]! : dayFactor[d]!) * rainy * Math.exp(ro.normal(0, 0.3))))
    }
    const lead = suppliers.find((s) => s.id === p.supplierId)?.leadDays ?? 2
    return {
      id: p.id, productId: p.id, outletId: p.outletId, onHand: Math.max(1, Math.round(base * (flood ? ro.float(3, 8) : ro.float(6, 24)))),
      reorderPoint: Math.max(1, Math.ceil(base * (lead + 3))), baseDaily: round(base, 2), factor: 1, history, reason: null, updatedAt: -DAY_MIN,
    }
  })
  const stockById = new Map(stock.map((s) => [s.id, s]))
  const prodById = new Map(products.map((p) => [p.id, p]))

  // receipts for yesterday and this morning (individual sales); older days only as daily aggregates
  const rs = S('sales')
  const saleDrafts: Omit<Sale, 'id' | 'code'>[] = []
  for (const outlet of outlets) {
    const sellable = stock.filter((s) => s.outletId === outlet.id && !prodById.get(s.productId)!.tags.includes('bahan'))
    // pick lines by turnover share; quantity so that the average ticket is realistic
    const pairs = sellable.map((s) => [s, Math.max(1, s.baseDaily * prodById.get(s.productId)!.price)] as const)
    const turnover = pairs.reduce((a, [, w]) => a + w, 0)
    const avgTicket = outlet.kind === 'toko' ? AVG_TICKET.toko : AVG_TICKET.fnb
    const linesPerReceipt = 2
    const receipts = Math.max(1, Math.round(turnover / avgTicket))
    for (const off of [-1, 0]) {
      const n = off === 0 ? Math.round(receipts * 0.08) : receipts
      const openH = Math.floor(outlet.opensAt / 60)
      const closeH = Math.floor(outlet.closesAt / 60) - 1
      if (off === 0 && outlet.opensAt >= now) continue
      for (let i = 0; i < n; i++) {
        const at = off === 0 ? rs.int(outlet.opensAt, now) : minuteOn(rs, off, openH, closeH)
        const lines = rs.int(1, 3)
        const items: SaleItem[] = []
        for (let l = 0; l < lines; l++) {
          const st = rs.weighted(pairs)
          if (items.some((x) => x.productId === st.productId)) continue
          const p = prodById.get(st.productId)!
          const qty = Math.max(1, Math.round((avgTicket / linesPerReceipt / p.price) * rs.float(0.5, 1.5)))
          items.push({ productId: p.id, qty, price: p.price })
        }
        saleDrafts.push({ outletId: outlet.id, businessId: shop.id, at, items, total: items.reduce((a, x) => a + x.qty * x.price, 0), payment: rs.weighted([['tunai', 55], ['qris', 35], ['transfer', 10]] as const) })
      }
    }
  }
  saleDrafts.sort((a, b) => a.at - b.at)
  const sales: Sale[] = saleDrafts.map((d) => {
    const id = nid('sales')
    return { ...d, id, code: id }
  })
  // yesterday's history = receipts; today's units come off the shelf
  const ydUnits = new Map<string, number>()
  for (const s of sales) for (const it of s.items) {
    if (s.at < 0) ydUnits.set(it.productId, (ydUnits.get(it.productId) ?? 0) + it.qty)
    else {
      const st = stockById.get(it.productId)
      if (st) st.onHand = Math.max(0, st.onHand - it.qty)
    }
  }
  for (const st of stock) {
    if (prodById.get(st.productId)!.tags.includes('bahan')) continue
    st.history[st.history.length - 1] = ydUnits.get(st.productId) ?? 0
  }
  // ingredients: consumption follows sales roughly (already random history)

  const salesDaily: SalesDay[] = []
  for (const outlet of outlets) {
    const own = stock.filter((s) => s.outletId === outlet.id && !prodById.get(s.productId)!.tags.includes('bahan'))
    const avgTicket = outlet.kind === 'toko' ? AVG_TICKET.toko : AVG_TICKET.fnb
    for (let d = 0; d < GEN.historyDays - 1; d++) {
      let revenue = 0
      let cost = 0
      for (const s of own) {
        const p = prodById.get(s.productId)!
        revenue += s.history[d]! * p.price
        cost += s.history[d]! * p.cost
      }
      salesDaily.push({ id: `${outlet.id}:${d - GEN.historyDays}`, outletId: outlet.id, day: d - GEN.historyDays, revenue, cost, tx: Math.max(1, Math.round(revenue / avgTicket)) })
    }
    for (const off of [-1, 0]) {
      const list = sales.filter((s) => s.outletId === outlet.id && Math.floor(s.at / DAY_MIN) === off)
      let revenue = 0
      let cost = 0
      for (const s of list) for (const it of s.items) {
        revenue += it.qty * it.price
        cost += it.qty * (prodById.get(it.productId)?.cost ?? 0)
      }
      salesDaily.push({ id: `${outlet.id}:${off}`, outletId: outlet.id, day: off, revenue, cost, tx: list.length })
    }
  }
  const rev30 = salesDaily.filter((s) => s.day >= -30 && s.day < 0).reduce((a, s) => a + s.revenue, 0)
  shop.monthlyRevenue = roundTo(rev30, 100_000)

  /* ---------------------------------------------------------------- purchase orders */
  const purchaseOrders: PurchaseOrder[] = []
  const poDrafts: { at: Minutes; supplierId: string; status: PurchaseOrder['status'] }[] = []
  for (let i = 0; i < 10; i++) poDrafts.push({ at: minuteOn(ro, -ro.int(2, 60), 8, 15), supplierId: ro.pick(suppliers).id, status: 'diterima' })
  const low = stock.filter((s) => s.onHand <= s.reorderPoint && prodById.get(s.productId)!.supplierId)
  const lowSuppliers = [...new Set(low.map((s) => prodById.get(s.productId)!.supplierId!))].slice(0, 2)
  for (const sid of lowSuppliers) poDrafts.push({ at: ro.int(300, now), supplierId: sid, status: 'draf' })
  poDrafts.sort((a, b) => a.at - b.at)
  for (const d of poDrafts) {
    const own = products.filter((p) => p.supplierId === d.supplierId && p.outletId === oToko.id)
    const pool = d.status === 'draf' ? low.map((s) => prodById.get(s.productId)!).filter((p) => p.supplierId === d.supplierId) : own
    const picks = ro.sample(pool.length ? pool : products.filter((p) => p.supplierId === d.supplierId), ro.int(2, 5))
    const items = picks.map((p) => ({ productId: p.id, qty: Math.max(2, Math.round((stockById.get(p.id)?.baseDaily ?? 1) * ro.int(7, 14))), cost: p.cost }))
    if (!items.length) continue
    const id = nid('purchaseOrders')
    purchaseOrders.push({
      id, code: id, businessId: shop.id, supplierId: d.supplierId, items, total: items.reduce((a, x) => a + x.qty * x.cost, 0), status: d.status, at: d.at,
      reply: d.status === 'diterima' ? { at: d.at + ro.int(20, 240), message: { id: 'Siap, barang dikirim besok pagi.', en: 'Noted, goods ship tomorrow morning.' }, eta: d.at + DAY_MIN } : null,
    })
  }

  /* ---------------------------------------------------------------- ledger + tax (the shop) */
  const rj = S('ledger')
  const ledger: LedgerEntry[] = []
  const dayAgg = new Map<number, { revenue: number; cost: number }>()
  for (const s of salesDaily) {
    const a = dayAgg.get(s.day) ?? { revenue: 0, cost: 0 }
    a.revenue += s.revenue
    a.cost += s.cost
    dayAgg.set(s.day, a)
  }
  const jdrafts: Omit<LedgerEntry, 'id'>[] = []
  for (let d = -GEN.historyDays; d <= -1; d++) {
    const a = dayAgg.get(d)
    if (!a || a.revenue <= 0) continue
    const cash = Math.round(a.revenue * 0.58)
    jdrafts.push({
      businessId: shop.id, at: d * DAY_MIN + 21 * 60, memo: { id: 'Penjualan harian 3 outlet', en: 'Daily sales, 3 outlets' }, source: 'sale', refId: null, needsReview: false, confidence: 0.99,
      lines: [{ account: 'Kas', debit: cash, credit: 0 }, { account: 'Bank', debit: a.revenue - cash, credit: 0 }, { account: 'Pendapatan Penjualan', debit: 0, credit: a.revenue },
        { account: 'HPP', debit: Math.round(a.cost), credit: 0 }, { account: 'Persediaan', debit: 0, credit: Math.round(a.cost) }],
    })
    const dt = dayDate(d)
    if (dt.getUTCDay() === 1) {
      const amt = roundTo((dayAgg.get(d - 1)?.cost ?? a.cost) * rj.float(5, 7), 1000)
      jdrafts.push({ businessId: shop.id, at: d * DAY_MIN + 10 * 60, memo: { id: 'Pembelian stok mingguan', en: 'Weekly stock purchase' }, source: 'purchase', refId: null, needsReview: false, confidence: 0.97,
        lines: [{ account: 'Persediaan', debit: amt, credit: 0 }, { account: 'Utang Usaha', debit: 0, credit: amt }] })
    }
    if (dt.getUTCDate() === 25) {
      for (const [acc, amt, mid, men] of [['Beban Gaji', 14 * 2_350_000, 'Gaji karyawan', 'Staff wages'], ['Beban Listrik & Air', rj.int(18, 26) * 100_000, 'Listrik & air', 'Electricity & water'], ['Beban Sewa', 4_500_000, 'Sewa kios pasar', 'Market stall rent']] as const) {
        jdrafts.push({ businessId: shop.id, at: d * DAY_MIN + 9 * 60, memo: { id: mid, en: men }, source: 'bank', refId: null, needsReview: false, confidence: 0.95, lines: [{ account: acc, debit: amt, credit: 0 }, { account: 'Bank', debit: 0, credit: amt }] })
      }
    }
  }
  const reviewMemos: Bi[] = [
    { id: 'Transfer masuk tanpa keterangan', en: 'Incoming transfer without description' },
    { id: 'Pembelian di toko online (kategori belum jelas)', en: 'Online-shop purchase (category unclear)' },
    { id: 'Tarik tunai ATM', en: 'ATM cash withdrawal' },
  ]
  reviewMemos.forEach((memo, i) => {
    const amt = roundTo(rj.float(0.4, 3.5) * 1_000_000, 1000)
    jdrafts.push({ businessId: shop.id, at: -(i + 1) * DAY_MIN - rj.int(60, 400), memo, source: 'bank', refId: null, needsReview: true, confidence: round(rj.float(0.52, 0.68), 2),
      lines: i === 0 ? [{ account: 'Bank', debit: amt, credit: 0 }, { account: 'Pendapatan Lain-lain', debit: 0, credit: amt }] : [{ account: 'Beban Lain-lain', debit: amt, credit: 0 }, { account: i === 2 ? 'Bank' : 'Kas', debit: 0, credit: amt }] })
  })
  jdrafts.sort((a, b) => a.at - b.at)
  for (const j of jdrafts) ledger.push({ ...j, id: nid('ledger') })

  const taxItems: TaxItem[] = []
  const daysUntil = (iso: string) => Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86_400_000)
  for (let m = -2; m <= 0; m++) {
    const period = monthOf(day, m)
    const next = monthOf(day, m + 1)
    let gross = 0
    for (const s of salesDaily) if (isoDay(day, s.day).startsWith(period)) gross += s.revenue
    taxItems.push({
      id: nid('taxItems'), businessId: shop.id, kind: 'pph-final-umkm', period, dueAt: daysUntil(`${next}-15`) * DAY_MIN,
      amount: m < 0 ? Math.round(gross * PPH_FINAL_UMKM_RATE) : null, status: m < 0 ? 'dibayar' : 'perlu-hitung',
    })
  }
  taxItems.push({ id: nid('taxItems'), businessId: shop.id, kind: 'pph21', period: monthOf(day, 0), dueAt: daysUntil(`${monthOf(day, 1)}-15`) * DAY_MIN, amount: null, status: 'perlu-hitung' })
  taxItems.push({ id: nid('taxItems'), businessId: shop.id, kind: 'pbb', period: `${year}-08`, dueAt: daysUntil(`${year}-08-31`) * DAY_MIN, amount: 1_284_000, status: 'dibayar' })

  /* ---------------------------------------------------------------- sales team (Juara Jualan) */
  const ra = S('sales-team')
  const anamer = makeNamer(ra, pack.languages.regional)
  const industries: Call['industry'][] = ['toko-bangunan', 'multifinance', 'asuransi']
  const agentsSales: SalesAgent[] = []
  industries.forEach((ind, i) => {
    for (let k = 0; k < 3; k++) {
      const base = ra.int(58, 84)
      const r = () => clamp(Math.round(base + ra.normal(0, 9)), 30, 98)
      agentsSales.push({ id: nid('agentsSales'), name: anamer().name, team: AGENT_TEAMS[i]!, industry: ind, baseline: base, radar: { salam: r(), gali: r(), keberatan: r(), penawaran: r(), closing: r(), kepatuhan: r() } })
    }
  })
  const calls: Call[] = Array.from({ length: GEN.calls }, () => minuteOn(ra, -ra.int(0, 14), 8, 16, now)).sort((a, b) => a - b).map((at) => {
    const ag = ra.pick(agentsSales)
    const scored = ra.chance(0.85) || at < -DAY_MIN
    const sc = clamp(Math.round(ag.baseline + ra.normal(0, 11)), 22, 98)
    const c = () => clamp(Math.round(sc + ra.normal(0, 10)), 10, 100)
    const flags: string[] = []
    if (sc < 60) flags.push(ra.pick(['keberatan-tidak-dijawab', 'lupa-salam', 'janji-berlebihan', 'tidak-closing']))
    return {
      id: nid('calls'), agentId: ag.id, industry: ag.industry, channel: ag.industry === 'toko-bangunan' && ra.chance(0.5) ? 'wa' : 'telepon', customer: ra.pick(CALL_CUSTOMERS), at,
      durationSec: ra.int(90, 720), score: scored ? sc : null, criteria: scored ? { salam: c(), gali: c(), keberatan: c(), penawaran: c(), closing: c(), kepatuhan: c() } : null, flags,
    } satisfies Call
  })
  const coachings: Coaching[] = agentsSales.filter((a) => a.baseline < 66).slice(0, 3).map((a) => ({
    id: nid('coachings'), agentId: a.id, focus: [{ id: 'Jawab keberatan harga dengan nilai', en: 'Answer price objections with value' }, { id: 'Gali kebutuhan sebelum menawarkan', en: 'Probe needs before offering' }],
    callId: calls.find((c) => c.agentId === a.id)?.id ?? null, at: -ra.int(2, 9) * DAY_MIN, status: 'latihan' as const,
  }))
  const chats: Chat[] = Array.from({ length: 18 }, (_, i) => {
    const kinds = [
      { product: 'sapa-warga' as const, ch: 'wa' as const, p: { id: 'Terima kasih, aduan sudah kami terima.', en: 'Thank you, we have received your report.' } },
      { product: 'toko-autopilot' as const, ch: 'wa' as const, p: { id: 'Stok semen besok dikirim ya, Pak.', en: 'Cement stock ships tomorrow, sir.' } },
      { product: 'juara-jualan' as const, ch: 'wa' as const, p: { id: 'Untuk renovasi dapur butuh berapa sak semen?', en: 'How many bags of cement for a kitchen renovation?' } },
    ]
    const k = kinds[i % kinds.length]!
    return { id: nid('chats'), channel: k.ch, product: k.product, withName: anamer().name, preview: k.p, at: minuteOn(ra, -ra.int(0, 3), 7, 20, now), unread: ra.chance(0.3) ? ra.int(1, 3) : 0 }
  }).sort((a, b) => a.at - b.at)

  /* ---------------------------------------------------------------- candidates (Kenal Mitra CV) */
  const rk = S('candidates')
  const knamer = makeNamer(rk, pack.languages.regional)
  const candidates: Candidate[] = Array.from({ length: GEN.candidates }, () => ({
    id: nid('candidates'), name: knamer().name, role: rk.pick(CANDIDATE_ROLES), years: Math.max(0, Math.round(rk.normal(3, 2.6))),
    education: rk.weighted([['SMA/SMK', 55], ['D3', 15], ['S1', 27], ['S2', 3]] as const), skills: rk.sample(SKILLS, rk.int(2, 4)),
    kecamatanId: rk.weighted(popW), score: null, status: 'baru' as const,
  }))

  /* ---------------------------------------------------------------- verifications + documents */
  const rv = S('documents')
  const verifications: Verification[] = businesses.filter((b) => b.verified).slice(0, 36).map((b) => ({
    id: '', subjectKind: 'business' as const, subjectId: b.id, kind: 'kyb' as const, result: 'lolos' as const, score: rv.int(78, 97), at: -rv.int(5, 300) * DAY_MIN + rv.int(8, 15) * 60, by: 'kenal-mitra' as const,
  })).sort((a, b) => a.at - b.at).map((v) => ({ ...v, id: nid('verifications') }))
  const nikPrefix = (kecId: string) => {
    const code = (pack.kecamatan.find((k) => k.id === kecId)?.code ?? '').replace(/\D/g, '')
    return (code + '000000').slice(0, 6)
  }
  const makeNik = (c: Citizen) => {
    const dob = rv.int(1, 28) + (c.gender === 'P' ? 40 : 0)
    // serials ≥ 9000 so specimen NIKs are unlikely to match real ones; documents are SPESIMEN
    return `${nikPrefix(c.kecamatanId)}${pad(dob)}${pad(rv.int(1, 12))}${pad((Number(year) - c.age) % 100)}${rv.int(9001, 9999)}`
  }
  const documents: DocumentRec[] = []
  const regPool = citizens.filter((c) => floodSet.has(c.kecamatanId))
  const others = citizens.filter((c) => !floodSet.has(c.kecamatanId))
  const registrants: Citizen[] = []
  for (let i = 0; i < 50; i++) registrants.push(i % 5 === 4 && others.length ? rv.pick(others) : rv.pick(regPool.length ? regPool : citizens))
  const regDocs: Omit<DocumentRec, 'id'>[] = registrants.map((c) => ({ kind: 'ktp' as const, ownerName: c.name, citizenId: c.id, nik: makeNik(c), program: 'bansos-banjir' as const, kecamatanId: c.kecamatanId, desaId: c.desaId, status: 'baru' as const, at: rv.int(0, now) }))
  // exactly 3 duplicate NIK pairs (Cek Berkas P7 "3 NIK ganda")
  for (const [a, b] of [[3, 17], [22, 41], [8, 33]] as const) regDocs[b]!.nik = regDocs[a]!.nik
  for (const c of rv.sample(citizens, 10)) regDocs.push({ kind: rv.pick(['nib', 'domisili', 'kk'] as const), ownerName: c.name, citizenId: c.id, nik: makeNik(c), program: 'perizinan', kecamatanId: c.kecamatanId, desaId: c.desaId, status: rv.pick(['lengkap', 'kurang', 'baru'] as const), at: -rv.int(1, 6) * DAY_MIN })
  const spec = rv.pick(citizens)
  regDocs.push({ kind: 'ktp', ownerName: spec.name, citizenId: spec.id, nik: makeNik(spec), program: 'perizinan', kecamatanId: spec.kecamatanId, desaId: spec.desaId, status: 'baru', at: 300, tampered: true })
  regDocs.sort((a, b) => a.at - b.at)
  for (const d of regDocs) documents.push({ ...d, id: nid('documents') })

  /* ---------------------------------------------------------------- brand mentions (Pantau Merek) */
  const rr = S('brand')
  const brandMentions: BrandMention[] = Array.from({ length: GEN.brandMentions }, () => minuteOn(rr, -rr.int(0, 30), 6, 22, now)).sort((a, b) => a - b).map((at) => {
    const t = rr.pick(BRAND_TEXT)
    const sc = t.s + rr.normal(0, 0.1)
    const channel = rr.weighted([['marketplace', 30], ['instagram', 20], ['x', 10], ['tiktok', 10], ['ulasan-peta', 30]] as const)
    return {
      id: nid('brandMentions'), at, brand: rr.chance(0.7) ? shop.id : rr.pick(COMPETITOR_BRANDS), channel, author: `${rr.pick(SOCIAL_HANDLES)}${rr.int(1, 99)}`, text: t.t,
      sentiment: sc < -0.2 ? 'negatif' : sc > 0.2 ? 'positif' : 'netral', topic: t.topic,
      rating: channel === 'marketplace' || channel === 'ulasan-peta' ? (sc > 0.2 ? rr.int(4, 5) : sc < -0.2 ? rr.int(1, 3) : 3) : null, reply: null,
    } satisfies BrandMention
  })

  /* ---------------------------------------------------------------- tenders + bids (TenderPilot) */
  const rt = S('tenders')
  const tenders: Tender[] = Array.from({ length: 16 }, (_, i) => ({ i, at: -rt.int(1, 45) * DAY_MIN + rt.int(8, 15) * 60 })).sort((a, b) => a.at - b.at).map(({ i, at }) => {
    const t = TENDER_TPL[i % TENDER_TPL.length]!
    const open = now - at < 14 * DAY_MIN
    const value = roundTo(t.base * rt.float(0.7, 1.4), 1_000_000)
    return {
      id: nid('tenders'), code: `${year}-T${pad(rt.int(100, 999), 3)}`, title: t.t, opdId: rt.pick(region.opd).id, kbli: t.kbli, value, kecamatanId: rt.weighted(popW),
      publishedAt: at, deadlineAt: at + rt.int(10, 21) * DAY_MIN, status: open ? 'dibuka' : rt.chance(0.5) ? 'selesai' : 'evaluasi', emergency: false, competitors: rt.int(3, 14),
      matches: t.kbli === '46634' ? { [shop.id]: round(rt.float(0.35, 0.82), 2) } : {}, needId: null,
    } satisfies Tender
  })
  const bids: Bid[] = tenders.filter((t) => t.status !== 'dibuka' && t.matches[shop.id] !== undefined).slice(0, 6).map((t) => ({
    id: nid('bids'), tenderId: t.id, businessId: shop.id, price: roundTo(t.value * rt.float(0.86, 0.98), 100_000), at: t.publishedAt + rt.int(2, 8) * DAY_MIN,
    status: t.status === 'selesai' ? (rt.chance(0.45) ? 'menang' : 'kalah') : 'terkirim',
  }))

  /* ---------------------------------------------------------------- catalog needs, matches, orders (Katalog Lokal) */
  const rg = S('katalog')
  const catalogNeeds: CatalogNeed[] = []
  const matches: Match[] = []
  const orders: Order[] = []
  const needTpl: { t: Bi; cat: string; unit: string; q: [number, number] }[] = [
    { t: { id: 'Nasi kotak rapat koordinasi', en: 'Boxed meals for a coordination meeting' }, cat: 'nasi-kotak', unit: 'kotak', q: [80, 250] },
    { t: { id: 'Seragam relawan posko', en: 'Volunteer uniforms' }, cat: 'seragam', unit: 'stel', q: [40, 120] },
    { t: { id: 'Spanduk sosialisasi layanan', en: 'Service information banners' }, cat: 'spanduk', unit: 'lembar', q: [10, 40] },
    { t: { id: 'Air minum kemasan untuk posko', en: 'Bottled water for the shelter post' }, cat: 'air-minum', unit: 'dus', q: [50, 200] },
  ]
  needTpl.forEach((n, i) => {
    const at = -rg.int(4, 40) * DAY_MIN + rg.int(8, 14) * 60
    const id = nid('catalogNeeds')
    const qty = rg.int(n.q[0], n.q[1])
    catalogNeeds.push({ id, code: id, at, title: n.t, items: [{ name: n.t, category: n.cat, qty, unit: n.unit }], kecamatanId: rg.weighted(popW), deadlineDays: rg.int(2, 7), emergency: false, status: i < 3 ? 'selesai' : 'dipesan', cause: null })
    const cands = businesses.filter((b) => b.supplies.includes(n.cat)).slice(0, 3)
    cands.forEach((b, k) => matches.push({ id: nid('matches'), needId: id, businessId: b.id, score: round(rg.float(0.55, 0.95), 2), at: at + 30, status: k === 0 ? 'dipilih' : 'kandidat' }))
    const win = cands[0]
    if (win) {
      const oid = nid('orders')
      const price = roundTo(rg.float(15_000, 90_000), 500)
      orders.push({ id: oid, code: oid, needId: id, businessId: win.id, items: [{ name: n.t, qty, unit: n.unit, price }], total: qty * price, status: i < 3 ? 'dibayar' : 'dikirim', at: at + 240 })
    }
  })

  /* ---------------------------------------------------------------- loans */
  const rn2 = S('loans')
  const loanApps: LoanApp[] = rn2.sample(businesses.slice(1), 8).map((b, i) => ({ b, i, at: -rn2.int(1, 40) * DAY_MIN + rn2.int(8, 15) * 60 })).sort((a, b) => a.at - b.at).map(({ b, i, at }) => {
    const status: LoanApp['status'] = i < 3 ? 'diajukan' : i < 7 ? 'disetujui' : 'ditolak'
    return { id: nid('loanApps'), businessId: b.id, lender: rn2.pick(LENDERS), amount: roundTo(b.monthlyRevenue * rn2.float(1, 3), 1_000_000) || 5_000_000, tenorMonths: rn2.pick([6, 12, 18, 24]), score: 0, status, at, decidedAt: status === 'diajukan' ? null : at + rn2.int(1, 6) * DAY_MIN }
  })

  /* ---------------------------------------------------------------- econ index (12 months per kecamatan) */
  const re = S('econ')
  const totalPop = pack.kecamatan.reduce((a, k) => a + k.population, 0) || 1
  const smallest = new Set([...pack.kecamatan].sort((a, b) => a.population - b.population).slice(0, Math.min(2, Math.max(0, pack.kecamatan.length - 3))).map((k) => k.id))
  const rawIdx: { k: (typeof pack.kecamatan)[number]; m: number; month: string; raw: number; biz: number }[] = []
  for (const k of pack.kecamatan) {
    const kBase = re.float(0.85, 1.15) * (k.mainSector.toLowerCase().includes('dagang') ? 1.08 : 1)
    const biz = smallest.has(k.id) ? re.int(4, 9) : Math.max(12, Math.round((k.population / totalPop) * 2400 * re.float(0.5, 1.3)))
    for (let m = -11; m <= 0; m++) {
      const month = monthOf(day, m)
      const mm = Number(month.slice(5, 7))
      const season = (mm === 3 ? 1.12 : 1) * (mm === 4 || mm === 8 || mm === 9 ? 1.05 : 1) * (mm === 12 ? 1.05 : 1) * (floodSet.has(k.id) && (mm === 1 || mm === 2) ? 0.95 : 1)
      rawIdx.push({ k, m, month, raw: kBase * season * (1 + (m + 11) * 0.003) * Math.exp(re.normal(0, 0.025)), biz })
    }
  }
  const meanRaw = rawIdx.reduce((a, r) => a + r.raw, 0) / Math.max(1, rawIdx.length)
  const econIndex: EconIndex[] = rawIdx.map((r) => {
    const index = round((r.raw / meanRaw) * 100, 1)
    return { id: `${r.k.id}:${r.month}`, kecamatanId: r.k.id, month: r.month, index, omzet: roundTo(r.biz * 18_000_000 * (index / 100), 100_000), businesses: r.biz, topSector: r.k.mainSector }
  })

  /* ---------------------------------------------------------------- prices (market × commodity, 60 days) */
  const rpz = S('prices')
  const prices: PricePoint[] = []
  for (const m of markets) {
    const mOff = rpz.float(-0.03, 0.03)
    for (const c of region.commodities) {
      const vol = /cabai|chili|bawang/i.test(`${c.id} ${c.name.id}`) ? 0.025 : 0.006
      const rising = (/cabai|beras/i.test(`${c.id} ${c.name.id}`) && m.kecamatanId && floodSet.has(m.kecamatanId)) || /cabai/i.test(c.id)
      const base = c.basePrice * (1 + mOff)
      let x = 0
      const history: number[] = []
      const step = c.basePrice >= 20_000 ? 500 : 100
      for (let d = 0; d < GEN.priceDays; d++) {
        x = x * 0.92 + rpz.normal(0, vol)
        const trend = rising && d >= GEN.priceDays - 7 ? (d - (GEN.priceDays - 8)) * 0.008 : 0
        history.push(roundTo(base * (1 + x + trend + 0.02 * Math.sin((d / 30) * Math.PI)), step))
      }
      const last = history[history.length - 1] ?? base
      prices.push({ id: `${m.id}:${c.id}`, marketId: m.id, commodityId: c.id, price: roundTo(last * (1 + rpz.normal(0, vol / 2)), step), history, updatedAt: 6 * 60, anomaly: false })
    }
  }

  /* ---------------------------------------------------------------- biz scores */
  const rsc = S('scores')
  const bizFactors = (b: Business): Record<ScoreFactor, number> => {
    const q = rsc.float(-0.12, 0.12)
    return {
      omzet: round(clamp(rsc.float(0.45, 0.88) + q, 0.1, 1), 3), margin: round(clamp(rsc.float(0.4, 0.85) + q, 0.1, 1), 3),
      pajak: b.taxTidy ? 0.92 : 0.6, supplier: round(clamp(rsc.float(0.5, 0.95), 0.1, 1), 3), kyb: b.verified ? 1 : 0.35,
      pertumbuhan: round(clamp(rsc.float(0.35, 0.85) + q, 0.1, 1), 3),
    }
  }
  const bizScores: BizScore[] = businesses.map((b) => {
    const f = b.id === shop.id ? { omzet: 0.78, margin: 0.66, pajak: 0.6, supplier: 0.83, kyb: 1, pertumbuhan: 0.71 } : bizFactors(b)
    const sc = scoreOf(f)
    const history: number[] = []
    let v = sc - rsc.int(40, 110)
    for (let i = 0; i < 12; i++) {
      v += (sc - v) / (12 - i) + rsc.normal(0, 8)
      history.push(clamp(Math.round(v), 0, 1000))
    }
    return { id: b.id, businessId: b.id, score: sc, factors: f, history, updatedAt: -DAY_MIN }
  })

  /* ---------------------------------------------------------------- audit rows for this morning's activity */
  const auditDrafts: Omit<AuditEntry, 'id' | 'eventId'>[] = []
  for (const c of complaints) if (c.at >= 0) auditDrafts.push({ at: c.at, source: 'sapa-warga', type: 'complaint.created', summary: { id: `Aduan ${c.code} (${CATEGORY_LABEL[c.category].id}) masuk dari ${c.channel.toUpperCase()}`, en: `Complaint ${c.code} (${CATEGORY_LABEL[c.category].en}) received via ${c.channel.toUpperCase()}` }, entityRefs: [`complaints:${c.id}`, `tickets:${c.ticketId}`], depth: 0, causeId: null })
  for (const s of sales) if (s.at >= 0) auditDrafts.push({ at: s.at, source: 'toko-autopilot', type: 'sale.created', summary: { id: `Transaksi ${s.code} · Rp ${s.total.toLocaleString('id-ID')}`, en: `Sale ${s.code} · Rp ${s.total.toLocaleString('id-ID')}` }, entityRefs: [`sales:${s.id}`], depth: 0, causeId: null })
  for (const m of mentions) if (m.at >= 0) auditDrafts.push({ at: m.at, source: 'radar-isu', type: 'mention.created', summary: { id: `Mention baru: ${m.outlet} (${m.sentiment})`, en: `New mention: ${m.outlet} (${m.sentiment})` }, entityRefs: [`mentions:${m.id}`], depth: 0, causeId: null })
  auditDrafts.sort((a, b) => a.at - b.at)
  const auditLog: AuditEntry[] = auditDrafts.map((a) => {
    const n = (seq.event ?? 0) + 1
    seq.event = n
    return { ...a, id: nid('auditLog'), eventId: `E${pad(n, 6)}` }
  })

  /* ---------------------------------------------------------------- assemble */
  const byAt = <T extends { at: number }>(r: T) => r.at
  const rev = <T>(a: T[]) => [...a].reverse()
  const state: WorldState = {
    regionId: pack.id,
    seed,
    day,
    region,
    meta: { version: WORLD.version, seq, shopId: shop.id, competitors: [...COMPETITOR_BRANDS], processed: 0 },
    citizens: tableFrom(rev(citizens)),
    complaints: tableFrom(complaints, byAt),
    tickets: tableFrom(tickets, (t) => t.createdAt),
    clusters: emptyTable(),
    bookings: tableFrom(bookings, byAt),
    briefings: emptyTable(),
    instructions: emptyTable(),
    letters: tableFrom(letters, (l) => l.receivedAt),
    meetings: tableFrom(meetings, byAt),
    actionItems: tableFrom(actionItems, (a) => a.createdAt),
    mentions: tableFrom(mentions, byAt),
    hoaxAlerts: emptyTable(),
    alerts: tableFrom(alerts, byAt),
    rainCells: emptyTable(),
    programs: emptyTable(),
    procurements: tableFrom(procurements, (p) => p.createdAt),
    bidders: tableFrom(rev(bidders)),
    documents: tableFrom(documents, byAt),
    verifications: tableFrom(verifications, byAt),
    businesses: tableFrom(rev(businesses)),
    outlets: tableFrom(rev(outlets)),
    products: tableFrom(rev(products)),
    sales: tableFrom(sales, byAt),
    salesDaily: tableFrom(salesDaily, (s) => s.day),
    stock: tableFrom(rev(stock)),
    purchaseOrders: tableFrom(purchaseOrders, byAt),
    suppliers: tableFrom(rev(suppliers)),
    ledger: tableFrom(ledger, byAt),
    taxItems: tableFrom(rev(taxItems)),
    calls: tableFrom(calls, byAt),
    chats: tableFrom(chats, byAt),
    agentsSales: tableFrom(rev(agentsSales)),
    coachings: tableFrom(coachings, byAt),
    candidates: tableFrom(rev(candidates)),
    brandMentions: tableFrom(brandMentions, byAt),
    tenders: tableFrom(tenders, (t) => t.publishedAt),
    bids: tableFrom(bids, byAt),
    catalogNeeds: tableFrom(catalogNeeds, byAt),
    matches: tableFrom(matches, byAt),
    orders: tableFrom(orders, byAt),
    bizScores: tableFrom(rev(bizScores)),
    loanApps: tableFrom(loanApps, byAt),
    econIndex: tableFrom(rev(econIndex)),
    prices: tableFrom(rev(prices)),
    markets: tableFrom(rev(markets)),
    marketOps: emptyTable(),
    auditLog: tableFrom(auditLog, byAt),
  }
  // final scores derived from live state (pajak / kyb) so a recompute after load gives the same number
  for (const b of businesses) {
    const c = computeScore(state, b.id)
    const row = state.bizScores.byId[b.id]
    if (c && row) {
      row.score = c.score
      row.factors = c.factors
      row.history[row.history.length - 1] = c.score
    }
  }
  for (const l of loanApps) l.score = state.bizScores.byId[l.businessId]?.score ?? 0
  return state
}

/** id formatting is exposed for products that create entities themselves */
export { formatId }
