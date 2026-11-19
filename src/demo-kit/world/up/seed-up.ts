/**
 * world/up/seed-up.ts — `extendUsahaPintar(state, pack)`: the Usaha Pintar data of a generated world (pure,
 * deterministic; every random stream is named `up:<name>`). It fills the UP-only tables (staff, sales team, calls,
 * coachings, roleplays, candidates, verification requests, brand mentions, tenders, bids, shifts) and patches the
 * shop's core rows so every number agrees (opening balance, wages = Σ staff gross, today's sales journaled, PPh Final on
 * cumulative turnover, cm: tags on market ingredients, 15–25 SKUs below the reorder point, supplier replies).
 * Facts land in `meta.facts.up` (types.ts UpFacts). Applied once per world by the store (world/ext.ts).
 */
import type { RegionPack } from '../../region/types'
import type {
  Bi, Bid, Bidder, BizScore, BrandMention, Business, Call, Candidate, Chat, Coaching, Consent, ConsentScope, Criteria, DocumentRec, Industry, LedgerEntry, LedgerLine, LoanApp, PriceSub,
  Product, Roleplay, SalesAgent, Shift, Staff, StaffJob, TableKey, TaxItem, Tender, UpFacts, VerificationRequest, WorldState,
} from '../types'
import { streamRng } from '../prng'
import { makeNamer } from '../names'
import { nextId, type Seq } from '../ids'
import { makeNik } from '../../docs/nik'
import { generateCvs, CV } from '../../docs/samples/cv-data'
import { DAY_MIN, WORLD, clamp, distanceKm, isoDay, monthOf, offsetKm, pad, round, rows, tableFrom } from '../util'
import { EMERGENCY_TENDER, SHOP_KBLI } from './config'
import { computeScore } from '../score'
import { CALL_CLIPS, PRAPESAN_CLIP, kecName, leastRecent, shopOutlets } from './base'
import { callScore, CRITERIA_KEYS, weakest } from './call-score'
import { drawCriteria, flagsOf } from './criteria'
import { BRAND_TEXT, CATEGORY_TEXT, COACH, COMPETITOR_TEXT, CUSTOMER_ROLE, HANDLES, ORG, RINA, SALES_CALL_CUSTOMER, SUPPLIER_REPLY, TENDER_TPL, fillBi, sentimentOf } from './texts'
import { pphFinalMonth } from './tax-constants'
import { omzetByMonthRaw } from './omzet'
import { winScoreOf } from './win-score'
import { reputationAt } from './reputation'
import { installment } from '../pd/loan-math'
import { shockCommodities } from '../pd/shock-commodities'

const roundTo = (n: number, step: number): number => Math.round(n / step) * step
const LENDER = 'Koperasi Mitra Usaha Sejahtera'

export function extendUsahaPintar(s0: WorldState, pack: RegionPack | null): WorldState {
  const year = s0.day.slice(0, 4)
  const S = (name: string) => streamRng(s0.seed, s0.regionId, `up:${name}`)
  const seq: Seq = { ...s0.meta.seq }
  const nid = (t: TableKey) => nextId(seq, t, year)
  const langs = pack?.languages.regional ?? ['jv']
  const shopId = s0.meta.shopId
  const shop = s0.businesses.byId[shopId]!
  const { toko, kopi, warung } = shopOutlets(s0)
  if (!toko || !kopi || !warung) return s0
  const now = WORLD.clockStart - 1
  const region = s0.region
  const floodKec = region.floodKecamatanIds
  const kecById = new Map(region.kecamatan.map((k) => [k.id, k]))
  const fullName = (namer: ReturnType<typeof makeNamer>, g?: 'L' | 'P') => {
    let p = namer(g)
    for (let i = 0; i < 6 && !p.name.includes(' '); i++) p = namer(p.gender)
    return p
  }

  /* ---------------------------------------------------------------- staff (14) */
  const rs = S('staff')
  const snamer = makeNamer(rs, langs)
  // gross wages (Rp / month, SIMULATED): two toko staff above the 0 % TER band, three inside it
  const PLAN: [typeof toko, StaffJob, Staff['ptkp'], number, boolean][] = [
    [toko, 'kepala-toko', 'K/1', 6_450_000, false], [toko, 'admin', 'TK/0', 5_650_000, false], [toko, 'kasir', 'TK/0', 2_650_000, true],
    [toko, 'gudang', 'K/0', 3_100_000, false], [toko, 'sopir', 'K/2', 3_350_000, false],
    [kopi, 'barista', 'TK/0', 2_750_000, false], [kopi, 'barista', 'TK/1', 2_700_000, false], [kopi, 'kasir', 'TK/0', 2_500_000, false], [kopi, 'pramusaji', 'TK/0', 2_450_000, false],
    [warung, 'juru-masak', 'K/1', 3_050_000, false], [warung, 'juru-masak', 'TK/0', 2_800_000, false], [warung, 'pramusaji', 'TK/0', 2_450_000, false],
    [warung, 'pramusaji', 'K/0', 2_500_000, false], [warung, 'kasir', 'TK/0', 2_500_000, false],
  ]
  const staff: Staff[] = PLAN.map(([o, job, ptkp, gross, isNew]) => {
    const p = fullName(snamer, job === 'sopir' || job === 'gudang' ? 'L' : undefined)
    return { id: nid('staff'), businessId: shopId, outletId: o.id, name: p.name, gender: p.gender, job, ptkp, gross, joinedDays: isNew ? 9 : rs.int(120, 3200), isNew, agentId: null }
  })
  const payroll = staff.filter((x) => x.outletId === toko.id)
  const newCashier = staff.find((x) => x.isNew)!
  const wages = staff.reduce((a, x) => a + x.gross, 0)

  /* ---------------------------------------------------------------- sales team (9) */
  const ra = S('sales-team')
  const anamer = makeNamer(ra, langs)
  const radarOf = (base: number): Criteria => {
    const c = {} as Criteria
    for (const k of CRITERIA_KEYS) c[k] = clamp(Math.round(base + ra.normal(0, 9)), 30, 98)
    return c
  }
  const agents: SalesAgent[] = []
  const tbStaff = [payroll.find((x) => x.job === 'kepala-toko')!, payroll.find((x) => x.job === 'admin')!, newCashier]
  for (const st of tbStaff) {
    const base = st.isNew ? 57 : ra.int(64, 82)
    const id = nid('agentsSales')
    st.agentId = id
    agents.push({ id, name: st.name, team: 'Tim Toko', industry: 'toko-bangunan', baseline: base, radar: radarOf(base), role: st.job === 'kasir' ? 'kasir' : 'sales', joinedDays: st.joinedDays, org: shop.name, businessId: shopId, staffId: st.id })
  }
  for (const [ind, org, team] of [['multifinance', `${ORG.mf} · Cabang ${region.shortName}`, 'Tim Mawar'], ['asuransi', `${ORG.asr} · Kantor ${region.shortName}`, 'Tim Melati']] as const) {
    for (let k = 0; k < 3; k++) {
      const base = ind === 'multifinance' && k === 0 ? 63 : ra.int(58, 84)
      const p = ind === 'multifinance' && k === 0 ? RINA : fullName(anamer)
      agents.push({ id: nid('agentsSales'), name: p.name, team, industry: ind, baseline: base, radar: radarOf(base), role: 'sales', joinedDays: ra.int(60, 1500), org, businessId: null, staffId: null })
    }
  }
  const rina = agents.find((a) => a.name === RINA.name)!

  /* ---------------------------------------------------------------- calls (60 history + today) */
  const rc = S('calls')
  const cnamer = makeNamer(rc, langs)
  const customerOf = (ind: Industry) => {
    const p = fullName(cnamer)
    const role = rc.pick(CUSTOMER_ROLE[ind]!)
    return `${p.gender === 'P' ? 'Ibu' : 'Bpk.'} ${p.name} (${role.id})`
  }
  const lastUse = new Map<string, number>()
  type Draft = { at: number; agent: SalesAgent; scored: boolean; dur: number; clip?: (typeof CALL_CLIPS)[number]; low?: boolean }
  const drafts: Draft[] = []
  for (let i = 0; i < 60; i++) {
    const at = -rc.int(1, 14) * DAY_MIN + rc.int(8 * 60, 16 * 60 + 30)
    drafts.push({ at, agent: rc.pick(agents), scored: true, dur: rc.int(150, 720) })
  }
  const today = WORLD.clockStart
  for (const ind of ['toko-bangunan', 'multifinance', 'asuransi'] as Industry[]) {
    const team = agents.filter((a) => a.industry === ind)
    for (let k = 0; k < 6; k++) drafts.push({ at: today - rc.int(30, 95) - k * 4, agent: k === 0 && ind === 'multifinance' ? rina : rc.pick(team), scored: true, dur: rc.int(150, 600), low: k === 0 })
    for (let k = 0; k < 2; k++) drafts.push({ at: today - rc.int(8, 28), agent: rc.pick(team), scored: false, dur: rc.int(150, 420) })
    // one live call per industry: started 06:57, 4–6 minutes
    drafts.push({ at: today - 3, agent: rc.pick(team), scored: false, dur: rc.int(240, 360) })
  }
  drafts.sort((a, b) => a.at - b.at)
  const calls: Call[] = drafts.map((d) => {
    const ind = d.agent.industry
    const pool = CALL_CLIPS.filter((c) => c.industry === ind && c.key !== PRAPESAN_CLIP)
    const clipDef = d.low ? pool.find((c) => c.weak === 'keberatan')! : leastRecent(pool, (c) => lastUse.get(c.key) ?? -Infinity, `${d.at}|${d.agent.id}`)
    lastUse.set(clipDef.key, d.at)
    const criteria = d.scored ? drawCriteria(d.agent.radar, clipDef.weak, rc, d.low ? 14 : 0) : null
    if (criteria && d.low) criteria.keberatan = Math.min(criteria.keberatan, 38)
    const id = nid('calls')
    return {
      id, agentId: d.agent.id, industry: ind, channel: clipDef.channel, customer: clipDef.key === 'mf-tel-keberatan' ? SALES_CALL_CUSTOMER : customerOf(ind), at: d.at,
      durationSec: d.dur, score: criteria ? callScore(criteria) : null, criteria, flags: criteria ? flagsOf(criteria, clipDef.weak) : [], transcript: clipDef.key, topic: null,
      ...(criteria ? { scoredBy: 'ai' as const } : {}),
    }
  })
  const lowCall = {} as Record<Industry, string>
  for (const ind of ['toko-bangunan', 'multifinance', 'asuransi'] as Industry[]) {
    const c = calls.filter((x) => x.industry === ind && x.at >= 0 && x.score !== null && x.flags.includes('keberatan-tidak-dijawab')).sort((a, b) => a.score! - b.score! || a.at - b.at)[0]
    lowCall[ind] = c?.id ?? ''
  }
  // agent baselines follow their scored calls (team board avg14 = the same numbers)
  const chats: Chat[] = Array.from({ length: 12 }, (_, i) => {
    const kinds = [
      { product: 'toko-autopilot' as const, p: { id: 'Stok semen besok dikirim ya, Pak.', en: 'Cement stock ships tomorrow, sir.' } },
      { product: 'juara-jualan' as const, p: { id: 'Untuk renovasi dapur butuh berapa sak semen?', en: 'How many bags of cement for a kitchen renovation?' } },
    ]
    const k = kinds[i % kinds.length]!
    return { id: nid('chats'), channel: 'wa' as const, product: k.product, withName: fullName(cnamer).name, preview: k.p, at: -rc.int(1, 3) * DAY_MIN + rc.int(7 * 60, 20 * 60), unread: rc.chance(0.3) ? rc.int(1, 3) : 0 }
  }).sort((a, b) => a.at - b.at)

  /* ---------------------------------------------------------------- coachings (3) + roleplays (2) */
  const rq = S('coaching')
  const coached = agents.filter((a) => !a.staffId || !newCashierIs(a)).sort((a, b) => a.baseline - b.baseline || a.id.localeCompare(b.id)).slice(0, 3)
  function newCashierIs(a: SalesAgent) {
    return a.staffId === newCashier.id
  }
  const coachings: Coaching[] = coached.map((a, i) => {
    const keys = weakest(a.radar, 3)
    const v = i % 2
    const vars = { agent: a.name.split(' ')[0]!, org: a.org.split(' · ')[0]!, desa: region.kecamatan[0]?.desa[0]?.name ?? '' }
    return {
      id: nid('coachings'), agentId: a.id, focus: keys.map((k) => COACH[k][v]!.focus), examples: keys.map((k) => fillBi(COACH[k][v]!.example, vars)), focusKeys: keys, baseline: a.baseline,
      callId: calls.find((c) => c.agentId === a.id && c.score !== null)?.id ?? null, at: -rq.int(3, 9) * DAY_MIN + rq.int(9 * 60, 15 * 60), status: i < 2 ? ('selesai' as const) : ('latihan' as const),
    }
  }).sort((a, b) => a.at - b.at)
  const roleplays: Roleplay[] = coachings.filter((c) => c.status === 'selesai').map((c, i) => {
    const a = agents.find((x) => x.id === c.agentId)!
    const criteria = drawCriteria(a.radar, c.focusKeys[0] ?? 'keberatan', rq)
    for (const k of c.focusKeys) criteria[k] = clamp(criteria[k] + 12, 10, 100)
    return { id: nid('roleplays'), agentId: a.id, coachingId: c.id, persona: (['ragu-harga', 'banyak-tanya'] as const)[i % 2]!, industry: a.industry, turns: 8, score: callScore(criteria), baseline: c.baseline, criteria, at: c.at + rq.int(1, 2) * DAY_MIN }
  })

  /* ---------------------------------------------------------------- candidates (200 = generateCvs) */
  const cvs = generateCvs(CV.count, s0.seed, region.kecamatan.map((k) => ({ id: k.id, name: k.name })))
  const candidates: Candidate[] = cvs.map((cv) => ({ id: cv.id, name: cv.name, role: cv.role, years: cv.years, education: cv.education, skills: cv.skills, kecamatanId: cv.kecamatanId, score: null, status: 'baru' }))

  /* ---------------------------------------------------------------- Kenal Mitra: hero + mismatch businesses, documents, requests */
  const rk = S('mitra')
  const heroKec = kecById.get('kanor') && kecById.get('kanor')!.desa.some((d) => d.name === 'Sedeng') ? kecById.get('kanor')! : kecById.get(floodKec[floodKec.length - 1] ?? '') ?? region.kecamatan[0]!
  const heroDesa = heroKec.desa.find((d) => d.name === 'Sedeng') ?? heroKec.desa[0] ?? { id: heroKec.id, name: heroKec.name, centroid: heroKec.centroid }
  const hero: Business = {
    id: nid('businesses'), name: `CV ${heroDesa.name} Jaya Abadi`, kind: 'toko-bangunan', sector: 'Perdagangan', ownerName: 'Joko Prasetyo', kecamatanId: heroKec.id, desaId: heroDesa.id,
    coord: offsetKm(heroDesa.centroid, 0.12, -0.08), marketId: null, verified: false, taxTidy: true, monthlyRevenue: 86_000_000, employees: 6, since: 2016, supplies: ['karung-pasir', 'terpal'],
    capacity: 35, legal: 'CV',
  }
  // the mismatch: NIB address in one kecamatan, the photo's GPS ≈ 9 km away in the next one
  const nonFlood = region.kecamatan.filter((k) => !floodKec.includes(k.id) && k.id !== heroKec.id)
  const mmKec = kecById.get('balen') ?? nonFlood[0] ?? region.kecamatan[0]!
  const near = region.kecamatan.filter((k) => k.id !== mmKec.id).sort((a, b) => distanceKm(a.centroid, mmKec.centroid) - distanceKm(b.centroid, mmKec.centroid))
  const photoKec = kecById.get('sumberrejo') ?? near[0] ?? mmKec
  let mmPair = { a: mmKec.desa[0] ?? { id: mmKec.id, name: mmKec.name, centroid: mmKec.centroid }, b: photoKec.desa[0] ?? { id: photoKec.id, name: photoKec.name, centroid: photoKec.centroid }, d: Infinity }
  for (const a of mmKec.desa) for (const b of photoKec.desa) {
    const d = Math.abs(distanceKm(a.centroid, b.centroid) - 9)
    if (d < mmPair.d) mmPair = { a, b, d }
  }
  const mismatch: Business = {
    id: nid('businesses'), name: 'UD Bumi Terpal Lestari', kind: 'toko-bangunan', sector: 'Perdagangan', ownerName: fullName(makeNamer(rk, langs), 'L').name, kecamatanId: mmKec.id,
    desaId: mmPair.a.id, coord: mmPair.a.centroid, marketId: null, verified: false, taxTidy: false, monthlyRevenue: 64_000_000, employees: 4, since: 2019, supplies: ['terpal', 'karung-pasir'],
    capacity: 30, legal: 'UD',
  }
  const bizScoreOf = (b: Business, f: BizScore['factors']): BizScore => ({ id: b.id, businessId: b.id, score: 0, factors: f, history: Array.from({ length: 12 }, (_, i) => 560 + i * 9 + rk.int(-12, 12)), updatedAt: -DAY_MIN })
  const newScores = [
    bizScoreOf(hero, { omzet: 0.7, margin: 0.62, pajak: 0.92, supplier: 0.8, kyb: 0.35, pertumbuhan: 0.68 }),
    bizScoreOf(mismatch, { omzet: 0.58, margin: 0.55, pajak: 0.6, supplier: 0.7, kyb: 0.35, pertumbuhan: 0.5 }),
  ]
  // KYC / KYB specimens as world documents (SPESIMEN; the docs kit renders them)
  const docs: DocumentRec[] = []
  const doc = (d: Omit<DocumentRec, 'id'>) => {
    const row = { ...d, id: nid('documents') }
    docs.push(row)
    return row
  }
  const nikOf = (kecId: string, birth: string, g: 'L' | 'P', serial: number) => makeNik(pack?.kecamatan.find((k) => k.id === kecId) ?? { id: kecId }, birth, g, serial)
  const sitiKec = kecById.get('kalitidu') ? 'kalitidu' : floodKec[0] ?? heroKec.id
  const sitiDesa = kecById.get(sitiKec)?.desa.find((d) => /mojosari/i.test(d.name)) ?? kecById.get(sitiKec)?.desa[0]
  const kycJoko = doc({ kind: 'ktp', ownerName: 'Joko Prasetyo', citizenId: null, nik: nikOf(heroKec.id, '1979-11-27', 'L', 9042), program: 'kyc', kecamatanId: heroKec.id, desaId: heroDesa.id, status: 'baru', at: today + 1, sampleId: 'ktp-joko' })
  const kycSiti = doc({ kind: 'ktp', ownerName: 'Siti Nurjanah', citizenId: null, nik: nikOf(sitiKec, '1988-03-14', 'P', 9017), program: 'kyc', kecamatanId: sitiKec, desaId: sitiDesa?.id ?? sitiKec, status: 'baru', at: today - 52, tampered: true, sampleId: 'ktp-siti-edit' })
  const kycBambang = doc({ kind: 'ktp', ownerName: 'Bambang Sutrisno', citizenId: null, nik: nikOf(sitiKec, '1985-08-02', 'L', 9016), program: 'kyc', kecamatanId: sitiKec, desaId: sitiDesa?.id ?? sitiKec, status: 'baru', at: today - 37, sampleId: 'ktp-bambang' })
  for (const b of [hero, mismatch]) {
    for (const kind of ['nib', 'npwp', ...(b.legal === 'CV' ? (['akta'] as const) : []), 'lokasi'] as const)
      doc({ kind, ownerName: b.name, citizenId: null, nik: null, program: 'kyb', kecamatanId: b.kecamatanId, desaId: b.desaId, status: 'baru', at: today - rk.int(40, 90), sampleId: `${kind}-${b.id}` })
  }
  const unverified = rows(s0.businesses).filter((b) => !b.verified && b.id !== shopId)
  const randomKyb = rk.sample(unverified, 3)
  const reqDrafts: Omit<VerificationRequest, 'id' | 'code'>[] = [
    { kind: 'kyc', subjectKind: 'document', subjectId: kycSiti.id, requestedBy: LENDER, needId: null, priority: false, at: today - 50, status: 'antri', verificationId: null },
    { kind: 'kyc', subjectKind: 'document', subjectId: kycBambang.id, requestedBy: LENDER, needId: null, priority: false, at: today - 35, status: 'antri', verificationId: null },
    { kind: 'kyb', subjectKind: 'business', subjectId: hero.id, requestedBy: shop.name, needId: null, priority: false, at: today - 44, status: 'antri', verificationId: null },
    { kind: 'kyb', subjectKind: 'business', subjectId: mismatch.id, requestedBy: shop.name, needId: null, priority: false, at: today - 41, status: 'antri', verificationId: null },
    ...randomKyb.map((b) => ({ kind: 'kyb' as const, subjectKind: 'business' as const, subjectId: b.id, requestedBy: rk.pick([LENDER, shop.name]), needId: null, priority: false, at: today - rk.int(20, 120), status: 'antri' as const, verificationId: null })),
    { kind: 'cv', subjectKind: 'candidate', subjectId: 'cv-batch', requestedBy: shop.name, needId: null, priority: false, at: today - 25, status: 'antri', verificationId: null },
  ]
  // one closed request per verified business (its KYB verification, when seeded)
  const kybByBiz = new Map(rows(s0.verifications).filter((v) => v.kind === 'kyb' && v.subjectKind === 'business').map((v) => [v.subjectId, v]))
  for (const b of rows(s0.businesses).filter((x) => x.verified)) {
    const v = kybByBiz.get(b.id)
    reqDrafts.push({ kind: 'kyb', subjectKind: 'business', subjectId: b.id, requestedBy: b.id === shopId ? LENDER : rk.pick([LENDER, shop.name]), needId: null, priority: false, at: (v?.at ?? -rk.int(30, 300) * DAY_MIN) - rk.int(60, 600), status: 'selesai', verificationId: v?.id ?? null })
  }
  reqDrafts.sort((a, b) => a.at - b.at)
  const requests: VerificationRequest[] = reqDrafts.map((r) => {
    const id = nid('verificationRequests')
    return { ...r, id, code: id }
  })
  const heroRequest = requests.find((r) => r.subjectId === hero.id && r.status !== 'selesai')!

  /* ---------------------------------------------------------------- the shop's Bidder mirror (Awas Belanja lists its bid) */
  const usedIp = new Set(rows(s0.bidders).map((b) => b.ip))
  let ip = '198.51.100.254'
  for (let n = 253; usedIp.has(ip); n--) ip = `198.51.100.${n}`
  const shopPlace = `${shop.marketId ? (s0.markets.byId[shop.marketId]?.name ?? '') + ', ' : ''}Kec. ${kecName(s0, shop.kecamatanId)}`
  const bidder: Bidder = { id: nid('bidders'), name: shop.name, legal: 'UD', director: shop.ownerName, address: shopPlace, kecamatanId: shop.kecamatanId, ip, wins: 4, ring: null }

  /* ---------------------------------------------------------------- products: cm: tags, stock below reorder (15–25) */
  const commodityOf = (name: string): string | null => {
    const n = name.toLowerCase()
    for (const c of region.commodities) {
      const two = c.name.id.toLowerCase().split(' ').slice(0, 2).join(' ')
      if (n.startsWith(two)) return c.id
    }
    for (const c of region.commodities) {
      const first = c.id.split('-')[0]!
      if (n.startsWith(first) && region.commodities.filter((x) => x.id.startsWith(first)).length === 1) return c.id
    }
    return null
  }
  const products: Record<string, Product> = { ...s0.products.byId }
  for (const id of s0.products.ids) {
    const p = products[id]!
    if (!p.tags.includes('bahan') || p.tags.some((t) => t.startsWith('cm:'))) continue
    const cm = commodityOf(p.name)
    if (cm) products[id] = { ...p, tags: [...p.tags, `cm:${cm}`] }
  }
  const rsk = S('stock')
  const stockById = { ...s0.stock.byId }
  const low = s0.stock.ids.map((id) => stockById[id]!).filter((st) => st.onHand <= st.reorderPoint * st.factor)
  low.sort((a, b) => a.onHand / Math.max(0.01, a.baseDaily) - b.onHand / Math.max(0.01, b.baseDaily) || a.id.localeCompare(b.id))
  const keepLow = 15 + (rsk.int(0, 6))
  for (const st of low.slice(keepLow)) stockById[st.id] = { ...st, onHand: st.reorderPoint + Math.ceil(st.baseDaily * rsk.float(3, 9)) + 1 }

  /* ---------------------------------------------------------------- purchase orders: supplier replies from the pool */
  const poById = { ...s0.purchaseOrders.byId }
  let tplIdx = 0
  for (const po of rows(s0.purchaseOrders).filter((p) => p.reply).sort((a, b) => a.reply!.at - b.reply!.at || a.id.localeCompare(b.id))) {
    const tpl = SUPPLIER_REPLY[tplIdx % SUPPLIER_REPLY.length]!
    const item = products[po.items[0]?.productId ?? '']?.name ?? ''
    poById[po.id] = { ...po, reply: { ...po.reply!, message: { id: fillBi(tpl, { code: po.code, item, eta: 'besok pagi' }).id, en: fillBi(tpl, { code: po.code, item, eta: 'tomorrow morning' }).en }, tpl: tplIdx % SUPPLIER_REPLY.length } }
    tplIdx++
  }

  /* ---------------------------------------------------------------- ledger: opening balance, wages, today's sales */
  const rl = S('ledger')
  // the core seed's weekly purchases cover ~6 of 7 days of cost of goods: scale them (deterministically) so the
  // purchases of the history match its HPP (+3 %) and Persediaan never ends negative on the balance sheet
  let hppHist = 0
  let buyHist = 0
  for (const j of rows(s0.ledger)) {
    if (j.businessId !== shopId) continue
    for (const l of j.lines) {
      if (l.account !== 'Persediaan') continue
      if (j.source === 'purchase') buyHist += l.debit
      else hppHist += l.credit
    }
  }
  const buyScale = buyHist > 0 && hppHist > buyHist ? (hppHist * 1.03) / buyHist : 1
  const ledgerRows: LedgerEntry[] = rows(s0.ledger).map((j) =>
    j.memo.id === 'Gaji karyawan'
      ? { ...j, lines: j.lines.map((l) => (l.debit ? { ...l, debit: wages } : { ...l, credit: wages })) }
      : j.source === 'purchase' && j.businessId === shopId && buyScale !== 1
        ? { ...j, lines: j.lines.map((l) => ({ ...l, debit: roundTo(l.debit * buyScale, 1000), credit: roundTo(l.credit * buyScale, 1000) })) }
        : j,
  )
  let inv = 0
  for (const id of s0.stock.ids) {
    const st = s0.stock.byId[id]!
    inv += st.onHand * (products[st.productId]?.cost ?? 0)
  }
  const opening: LedgerLine[] = [
    { account: 'Kas', debit: 28_500_000, credit: 0 }, { account: 'Bank', debit: roundTo(rl.float(140, 190) * 1_000_000, 100_000), credit: 0 },
    { account: 'Persediaan', debit: roundTo(inv * 1.05, 100_000), credit: 0 }, { account: 'Utang Usaha', debit: 0, credit: roundTo(rl.float(30, 45) * 1_000_000, 100_000) },
  ]
  const plug = opening.reduce((a, l) => a + l.debit - l.credit, 0)
  opening.push({ account: 'Modal Pemilik', debit: 0, credit: plug })
  ledgerRows.push({ id: nid('ledger'), businessId: shopId, at: -91 * DAY_MIN + 8 * 60, memo: { id: 'Saldo awal', en: 'Opening balance' }, lines: opening, source: 'manual', refId: null, needsReview: false, confidence: 1 })
  const journaled = new Set(ledgerRows.map((j) => j.refId).filter(Boolean))
  for (const sale of rows(s0.sales)) {
    if (sale.at < 0 || sale.at >= DAY_MIN || journaled.has(sale.id) || sale.businessId !== shopId) continue
    let cost = 0
    for (const it of sale.items) cost += it.qty * (products[it.productId]?.cost ?? 0)
    const pays = sale.payments ?? [{ method: sale.payment, amount: sale.total }]
    const kas = pays.reduce((a, x) => a + (x.method === 'tunai' ? x.amount : 0), 0)
    const lines: LedgerLine[] = [...(kas ? [{ account: 'Kas', debit: kas, credit: 0 }] : []), ...(sale.total - kas ? [{ account: 'Bank', debit: sale.total - kas, credit: 0 }] : []), { account: 'Pendapatan Penjualan', debit: 0, credit: sale.total }]
    if (cost > 0) lines.push({ account: 'HPP', debit: cost, credit: 0 }, { account: 'Persediaan', debit: 0, credit: cost })
    ledgerRows.push({ id: nid('ledger'), businessId: shopId, at: sale.at, memo: { id: `Penjualan ${sale.code}`, en: `Sale ${sale.code}` }, lines, source: 'sale', refId: sale.id, needsReview: false, confidence: 0.99 })
  }

  /* ---------------------------------------------------------------- tax: PPh Final on cumulative turnover (Aug–Oct paid) */
  const rt0 = S('omzet')
  const historyStart = isoDay(s0.day, -90)
  const startMonth = historyStart.slice(0, 7)
  let daily = 0
  for (const id of s0.salesDaily.ids) {
    const d = s0.salesDaily.byId[id]!
    if (d.day >= -90 && d.day < -60) daily += d.revenue
  }
  daily /= 30
  const omzetPre: Record<string, number> = {}
  for (let m = 1; `${year}-${pad(m)}` <= startMonth; m++) {
    const month = `${year}-${pad(m)}`
    const days = month === startMonth ? Number(historyStart.slice(8, 10)) - 1 : new Date(Date.UTC(Number(year), m, 0)).getUTCDate()
    omzetPre[month] = roundTo(daily * days * rt0.float(0.86, 1.06), 100_000)
  }
  const taxById: Record<string, TaxItem> = { ...s0.taxItems.byId }
  const taxIds = [...s0.taxItems.ids]
  const shopDaily = { ...s0, salesDaily: s0.salesDaily }
  const omzet = omzetByMonthRaw(shopDaily, shopId, omzetPre)
  const cumBefore = (period: string) => Object.entries(omzet).filter(([m]) => m.startsWith(year) && m < period).reduce((a, [, v]) => a + v, 0)
  const daysUntil = (iso: string) => Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${s0.day}T00:00:00Z`)) / 86_400_000)
  for (const m of [-3, -2, -1]) {
    const period = monthOf(s0.day, m)
    const amount = pphFinalMonth(omzet[period] ?? 0, cumBefore(period))
    const existing = taxIds.map((i) => taxById[i]!).find((t) => t.kind === 'pph-final-umkm' && t.period === period)
    if (existing) taxById[existing.id] = { ...existing, amount, status: 'dibayar' }
    else {
      const id = nid('taxItems')
      taxById[id] = { id, businessId: shopId, kind: 'pph-final-umkm', period, dueAt: daysUntil(`${monthOf(s0.day, m + 1)}-15`) * DAY_MIN, amount, status: 'dibayar' }
      taxIds.push(id)
    }
  }

  /* ---------------------------------------------------------------- brand mentions (≈ 190 / 30 days) */
  const rb = S('brand')
  const shopItems = s0.products.ids.map((id) => products[id]!).filter((p) => p.outletId === toko.id)
  const itemName = (p: Product) => p.name
  const desaPick = () => {
    const k = rb.pick(region.kecamatan)
    const d = k.desa.length ? rb.pick(k.desa) : { id: k.id, name: k.name }
    return { kecamatanId: k.id, desaId: d.id, desa: d.name, kec: k.name }
  }
  const marketName = shop.marketId ? (s0.markets.byId[shop.marketId]?.name ?? region.shortName) : region.shortName
  const brandDrafts: { at: number; brand: string; tpl: { topic: BrandMention['topic']; s: number; t: Bi }; pre?: boolean }[] = []
  const comps = s0.meta.competitors
  for (let i = 0; i < 160; i++) {
    const at = -rb.int(1, 29) * DAY_MIN + rb.int(6 * 60, 22 * 60)
    const w = rb.next()
    const brand = w < 0.6 ? shopId : w < 0.85 ? rb.pick(comps) : 'kategori'
    brandDrafts.push({ at, brand, tpl: brand === shopId ? rb.pick(BRAND_TEXT) : brand === 'kategori' ? rb.pick(CATEGORY_TEXT) : rb.pick(COMPETITOR_TEXT) })
  }
  // the last 24 h: ≥ 24 shop mentions, no negative delivery post in the last 6 h except the 2 overnight ones
  for (let i = 0; i < 30; i++) {
    const at = now - rb.int(10, DAY_MIN - 20)
    const w = rb.next()
    const brand = i < 24 || w < 0.5 ? shopId : w < 0.8 ? rb.pick(comps) : 'kategori'
    let tpl = brand === shopId ? rb.pick(BRAND_TEXT) : brand === 'kategori' ? rb.pick(CATEGORY_TEXT) : rb.pick(COMPETITOR_TEXT)
    if (brand === shopId && tpl.topic === 'pengiriman' && tpl.s < -0.2 && at > now - 6 * 60) tpl = BRAND_TEXT.find((t) => t.topic === 'pengiriman' && t.s > 0.3)!
    brandDrafts.push({ at, brand, tpl })
  }
  const overnight = BRAND_TEXT.find((t) => t.topic === 'pengiriman' && t.s < -0.2)!
  brandDrafts.push({ at: 6 * 60 + 10, brand: shopId, tpl: overnight, pre: true }, { at: 6 * 60 + 40, brand: shopId, tpl: { ...overnight, s: -0.55 }, pre: true })
  brandDrafts.sort((a, b) => a.at - b.at)
  const usedTexts = new Map<number, Set<string>>()
  const brandMentions: BrandMention[] = []
  const preSignalIds: string[] = []
  for (const d of brandDrafts) {
    const day = Math.floor(d.at / DAY_MIN)
    const used = usedTexts.get(day) ?? new Set<string>()
    usedTexts.set(day, used)
    let text: Bi = d.tpl.t
    let place = desaPick()
    for (let k = 0; k < 6; k++) {
      place = desaPick()
      const vars = { item: itemName(rb.pick(shopItems)), desa: place.desa, kec: place.kec, market: marketName, brand: d.brand, days: rb.int(1, 3) }
      text = fillBi(d.tpl.t, vars)
      if (!used.has(text.id)) break
    }
    used.add(text.id)
    const sc = d.tpl.s + rb.normal(0, 0.08)
    const channel = rb.weighted([['marketplace', 30], ['instagram', 20], ['x', 10], ['tiktok', 10], ['ulasan-peta', 30]] as const)
    const sentiment = sentimentOf(sc)
    const id = nid('brandMentions')
    const m: BrandMention = {
      id, at: d.at, brand: d.brand, channel, author: `${rb.pick(HANDLES)}${rb.int(11, 98)}`, text, sentiment, topic: d.tpl.topic,
      rating: channel === 'marketplace' || channel === 'ulasan-peta' ? (sc > 0.2 ? rb.int(4, 5) : sc < -0.2 ? rb.int(1, 3) : 3) : null, reply: null,
      kecamatanId: place.kecamatanId, desaId: place.desaId, ...(d.brand === shopId ? { outletId: toko.id } : {}),
    }
    // about a third of the older shop negatives were answered (median ≈ 9 h later)
    if (d.brand === shopId && sentiment === 'negatif' && d.at < -DAY_MIN && rb.chance(0.35)) {
      m.repliedAt = d.at + rb.int(5 * 60, 13 * 60)
      m.replyTone = rb.pick(['empatik', 'formal'] as const)
      m.repliedBy = 'brand-manager'
      m.reply = { id: `Mohon maaf atas kendalanya, Kak. Tim ${shop.name} sudah menindaklanjuti.`, en: `Sorry for the trouble. The ${shop.name} team has followed up.` }
    }
    if (d.pre) {
      preSignalIds.push(id)
      m.channel = 'marketplace'
      m.rating = 2
      m.orderCode = `INV-${pad(rb.int(1000, 9999), 4)}`
    }
    brandMentions.push(m)
  }

  /* ---------------------------------------------------------------- tenders (16) + the shop's bid history (8) */
  const rt = S('tenders')
  const popW: [string, number][] = (pack?.kecamatan ?? region.kecamatan.map((k) => ({ id: k.id, population: 1 }))).map((k) => [k.id, Math.max(1, (k as { population?: number }).population ?? 1)])
  const shopTpl = TENDER_TPL.filter((t) => t.kbli === SHOP_KBLI[0])
  const otherTpl = TENDER_TPL.filter((t) => t.kbli !== SHOP_KBLI[0])
  const usedCodes = new Set<number>()
  const code = () => {
    let n = rt.int(100, 999)
    while (usedCodes.has(n)) n = n >= 999 ? 100 : n + 1
    usedCodes.add(n)
    return `${year}-T${n}`
  }
  const priceOfCat = (cat: string) => {
    const ps = shopItems.filter((p) => p.category === cat).map((p) => p.price)
    return ps.length ? Math.round(ps.reduce((a, b) => a + b, 0) / ps.length) : 50_000
  }
  type TDraft = { tpl: (typeof TENDER_TPL)[number]; at: number; status: Tender['status']; bid?: Bid['status'] }
  const tdrafts: TDraft[] = []
  const history: Bid['status'][] = ['menang', 'kalah', 'menang', 'kalah', 'menang', 'kalah', 'menang', 'evaluasi']
  history.forEach((st, i) => tdrafts.push({ tpl: shopTpl[i % shopTpl.length]!, at: -(300 - i * 36) * DAY_MIN + rt.int(8 * 60, 14 * 60), status: st === 'evaluasi' ? 'evaluasi' : 'selesai', bid: st }))
  for (let i = 0; i < 4; i++) tdrafts.push({ tpl: shopTpl[(i + 1) % shopTpl.length]!, at: -rt.int(1, 9) * DAY_MIN + rt.int(8 * 60, 14 * 60), status: 'dibuka' })
  for (let i = 0; i < 4; i++) tdrafts.push({ tpl: otherTpl[i % otherTpl.length]!, at: -rt.int(1, 12) * DAY_MIN + rt.int(8 * 60, 14 * 60), status: 'dibuka' })
  tdrafts.sort((a, b) => a.at - b.at)
  const tenders: Tender[] = []
  const bids: Bid[] = []
  for (const d of tdrafts) {
    const items = d.tpl.items?.map(([cat, nid_, nen, qty, unit]) => ({ name: { id: nid_, en: nen }, category: cat, qty: Math.round(qty * rt.float(0.7, 1.3)), unit, hpsPrice: roundTo(priceOfCat(cat) * rt.float(1.04, 1.12), 100) }))
    const hps = items ? items.reduce((a, it) => a + it.qty * it.hpsPrice, 0) : roundTo(d.tpl.base * rt.float(0.7, 1.4), 1_000_000)
    const open = d.status === 'dibuka'
    const t: Tender = {
      id: nid('tenders'), code: code(), title: d.tpl.t, opdId: rt.pick(region.opd).id, kbli: d.tpl.kbli, value: hps, kecamatanId: rt.weighted(popW),
      publishedAt: d.at, deadlineAt: open ? Math.max(d.at + rt.int(10, 21) * DAY_MIN, rt.int(2, 20) * DAY_MIN + 12 * 60) : d.at + rt.int(10, 21) * DAY_MIN, status: d.status, emergency: false,
      competitors: rt.int(3, 12), matches: {}, needId: null, method: hps < 200_000_000 ? 'pengadaan-langsung' : rt.chance(0.3) ? 'tender-cepat' : 'tender',
      requirements: [...EMERGENCY_TENDER.requirements], ...(items ? { items } : {}), hps, procurementId: null,
    }
    tenders.push(t)
    if (d.bid) bids.push({ id: nid('bids'), tenderId: t.id, businessId: shopId, price: roundTo(hps * rt.float(0.89, 0.97), 10_000), at: t.publishedAt + rt.int(2, 8) * DAY_MIN, status: d.bid, pages: rt.int(26, 40), hps })
  }

  /* ---------------------------------------------------------------- shifts: the week plan of the 14 staff */
  const shifts: Shift[] = []
  const SLOTS: Record<'toko' | 'kopi' | 'warung', [number, number][]> = {
    toko: [[7 * 60, 15 * 60], [9 * 60, 17 * 60]],
    kopi: [[6 * 60, 14 * 60], [14 * 60, 22 * 60]],
    warung: [[5 * 60 + 30, 13 * 60 + 30], [12 * 60, 20 * 60]],
  }
  staff.forEach((st, i) => {
    const key = st.outletId === toko.id ? 'toko' : st.outletId === kopi.id ? 'kopi' : 'warung'
    const off = (i * 3) % 7
    for (let day = 0; day < 7; day++) {
      if (day === off) continue
      const [start, end] = SLOTS[key][(i + (day >= 5 ? 1 : 0)) % 2]!
      shifts.push({ id: nid('shifts'), staffId: st.id, outletId: st.outletId, day, start, end, origin: 'auto' })
    }
  })

  /* ---------------------------------------------------------------- tahap 4 · seedPdLinks (Rapor Usaha queue + consents, the shop's price alerts) */
  // own stream, appended last: every other UP table is identical by key
  const rpd = S('pd')
  const warungBiz = rows(s0.businesses).find((b) => b.kind === 'warung-makan' && b.id !== shopId)
  const decidedPool = rows(s0.businesses).filter((b) => b.verified && b.id !== shopId && b.id !== warungBiz?.id && (b.kind === 'kelontong' || b.kind === 'konveksi' || b.kind === 'katering'))
  const pdLoans: LoanApp[] = []
  const consents: Consent[] = []
  const loanDraft = (b: Business | undefined, amount: number, tenor: number, at: number, scopes: ConsentScope[], status: LoanApp['status'], purpose: Bi, reason?: Bi) => {
    if (!b) return
    const cid = nid('consents')
    consents.push({ id: cid, businessId: b.id, lender: LENDER, scopes, days: 90, at: at - 20, until: at - 20 + 90 * DAY_MIN, revokedAt: null })
    const rate = status === 'disetujui' ? 0.85 : 1.0
    pdLoans.push({
      id: nid('loanApps'), businessId: b.id, lender: LENDER, amount, tenorMonths: tenor, score: 0, status, at, decidedAt: status === 'diajukan' ? null : at + rpd.int(1, 3) * DAY_MIN,
      consentId: cid, purpose, ratePct: rate, installment: installment(amount, rate, tenor), ...(status === 'disetujui' ? { decidedAmount: amount } : {}), ...(reason ? { reason } : {}),
    })
  }
  const stock: Bi = { id: 'Tambah stok barang dagangan', en: 'More trading stock' }
  const tools: Bi = { id: 'Peralatan usaha', en: 'Business equipment' }
  const cash: Bi = { id: 'Modal kerja harian', en: 'Daily working capital' }
  loanDraft(decidedPool[0], 50_000_000, 12, today - 20 * DAY_MIN - rpd.int(60, 300), ['omzet', 'laporan', 'pajak', 'kyb', 'mutasi'], 'disetujui', stock)
  loanDraft(decidedPool[1], 40_000_000, 18, today - 12 * DAY_MIN - rpd.int(60, 300), ['omzet', 'laporan', 'kyb'], 'ditolak', tools, { id: 'Arus kas belum cukup untuk cicilan', en: 'Cash flow too thin for the instalment' })
  loanDraft(warungBiz, 25_000_000, 6, today - 3 * DAY_MIN - rpd.int(60, 300), ['omzet', 'laporan', 'kyb', 'pajak'], 'diajukan', cash)
  loanDraft(mismatch, 75_000_000, 12, today - 2 * DAY_MIN - rpd.int(60, 300), ['omzet', 'laporan', 'kyb', 'mutasi'], 'diajukan', stock)
  loanDraft(hero, 120_000_000, 12, today - 1 * DAY_MIN - rpd.int(60, 300), ['omzet', 'laporan', 'kyb'], 'diajukan', stock)
  // the shop subscribes to price alerts of its market ingredients (the flood commodities first)
  const cmIds = [...new Set(Object.values(products).filter((p) => p.businessId === shopId).flatMap((p) => p.tags.filter((t) => t.startsWith('cm:')).map((t) => t.slice(3))))]
  const first = shockCommodities(s0.region)
  const subIds = [...[...first].reverse(), ...cmIds.filter((c) => !first.includes(c))].filter((c, i, a) => a.indexOf(c) === i)
  const priceSubs: PriceSub[] = subIds.length ? [{ id: nid('priceSubs'), businessId: shopId, commodityIds: subIds, channel: 'wa', thresholdPct: 10, at: today - 6 * DAY_MIN }] : []

  /* ---------------------------------------------------------------- assemble */
  const byAt = <T extends { at: number }>(r: T) => r.at
  const facts: UpFacts = {
    omzetPre, payrollStaffIds: payroll.map((x) => x.id), newCashierStaffId: newCashier.id, newCashierAgentId: newCashier.agentId!, lowCall,
    kenalMitra: {
      heroBusinessId: hero.id, heroRequestId: heroRequest.id, mismatchBusinessId: mismatch.id, kycCleanDocId: kycJoko.id, kycEditedDocId: kycSiti.id,
      cvOpening: { id: `${CV.opening.id} · ${shop.name}`, en: `${CV.opening.en} · ${shop.name}` }, cvCount: CV.count, shortlistSize: 10,
    },
    brand: { baselinePer2h: 0, preSignalIds, reputationAt0700: 0 },
    shopBidderId: bidder.id,
  }
  const ledgerAll = tableFrom(ledgerRows, (j) => j.at)
  let next: WorldState = {
    ...s0,
    meta: { ...s0.meta, seq, facts: { ...s0.meta.facts, up: facts } },
    businesses: tableFrom([...rows(s0.businesses).reverse().map((b) => (b.id === shopId ? { ...b, legal: 'perorangan' as const, lockedPeriods: [] } : b)), hero, mismatch].reverse()),
    bizScores: tableFrom([...rows(s0.bizScores), ...newScores]),
    bidders: tableFrom([bidder, ...rows(s0.bidders)]),
    documents: tableFrom([...rows(s0.documents), ...docs], byAt),
    products: { byId: products, ids: s0.products.ids },
    stock: { byId: stockById, ids: s0.stock.ids },
    purchaseOrders: { byId: poById, ids: s0.purchaseOrders.ids },
    ledger: ledgerAll,
    taxItems: { byId: taxById, ids: taxIds },
    staff: tableFrom([...staff].reverse()),
    agentsSales: tableFrom([...agents].reverse()),
    calls: tableFrom(calls, byAt),
    chats: tableFrom(chats, byAt),
    coachings: tableFrom(coachings, byAt),
    roleplays: tableFrom(roleplays, byAt),
    candidates: tableFrom([...candidates].reverse()),
    verificationRequests: tableFrom(requests, byAt),
    brandMentions: tableFrom(brandMentions, byAt),
    tenders: tableFrom(tenders, (t) => t.publishedAt),
    bids: tableFrom(bids, byAt),
    shifts: tableFrom([...shifts].reverse()),
    loanApps: tableFrom([...rows(s0.loanApps), ...pdLoans], byAt),
    consents: tableFrom(consents, byAt),
    priceSubs: tableFrom(priceSubs, byAt),
  }
  // derived numbers that need the assembled world: biz scores of the new businesses, win probabilities, brand baseline
  for (const sc of newScores) {
    const c = computeScore(next, sc.id)
    if (c) next.bizScores.byId[sc.id] = { ...sc, score: c.score, factors: c.factors, history: [...sc.history.slice(0, 11), c.score] }
  }
  for (const l of pdLoans) next.loanApps.byId[l.id] = { ...l, score: next.bizScores.byId[l.businessId]?.score ?? 0 }
  // the scenario shop's October score is 40 above today's (Rapor Usaha "−40 vs Okt" on every seed)
  const shopScore = next.bizScores.byId[shopId]
  if (shopScore && shopScore.history.length >= 2) next.bizScores.byId[shopId] = { ...shopScore, history: [...shopScore.history.slice(0, -2), shopScore.score + 40, shopScore.history[shopScore.history.length - 1]!] }
  for (const t of tenders) if (t.kbli === SHOP_KBLI[0]) next.tenders.byId[t.id] = { ...t, matches: { [shopId]: winScoreOf(next, t.id, shopId).probability } }
  const weekNeg = brandMentions.filter((m) => m.brand === shopId && m.topic === 'pengiriman' && m.sentiment === 'negatif' && m.at >= -7 * DAY_MIN && m.at < 0).length
  facts.brand.baselinePer2h = Math.max(0.5, round(weekNeg / (7 * 12), 1))
  facts.brand.reputationAt0700 = reputationAt(next, WORLD.clockStart, shopId)
  return next
}
