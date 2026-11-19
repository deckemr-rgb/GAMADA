/**
 * demos/awas-belanja/model.ts — pure helpers of the product: detector metadata, formatting (one formatter for the
 * table AND the memo, so their numbers are identical), the local-SME benchmark, the memo model and the compact AI
 * context (the same object feeds the simulation and, summarised, the Live proxy).
 *
 * All numbers come from the seeded world (world/satu-daerah selectors); companies and people are fictional.
 */
import type { Bi, Procurement, ProcurementFinding, WorldState } from '../../demo-kit/world'
import { DAY_MIN, currentRegion, rows } from '../../demo-kit/world/util'
import { clock } from '../../demo-kit/world/clock'
import { affiliationEdges, analyzeProcurement, hpsVsMarket, localBenchmarks, type AffiliationEdge, type ItemDeviation } from '../../demo-kit/world/satu-daerah'
import { num, percent, rupiah } from '../../demo-kit/viz/format'
import type { Lang } from './strings'

/** the head of a kota is a Wali Kota (EN Mayor), of a kabupaten a Bupati (Regent): wording follows the running region */
export function headWord(t: string): string {
  return currentRegion()?.type === 'kota' ? t.replace(/Bupati/g, 'Wali Kota').replace(/Regent/g, 'Mayor') : t
}

export const SLUG = 'awas-belanja' as const
export const PUMP_KEY = 'pompa-darurat'

/** module-local timing constants (seconds) — see the report */
export const AB = {
  /** one detector of the scan animation */
  scanStep: 0.36,
  /** reduced motion: per detector */
  scanStepReduced: 0.08,
  /** ring "opens" after the analysis (NetworkGraph cluster unfold) */
  ringOpenDelay: 0.35,
} as const

export type Detector = ProcurementFinding['detector']
export type Level = ProcurementFinding['level']

/** detector order of the scan + labels and what each one checks */
export const DETECTORS: { id: Detector; name: Bi; checks: Bi; tab: 'hps' | 'bidders' | 'patterns' }[] = [
  { id: 'hps-kemahalan', name: { id: 'HPS di atas harga pasar', en: 'HPS above market' }, checks: { id: 'Membandingkan HPS tiap item dengan median harga pasar (simulasi).', en: 'Compares each item HPS with the market median price (simulated).' }, tab: 'hps' },
  { id: 'harga-seragam', name: { id: 'Harga penawaran seragam', en: 'Uniform bid prices' }, checks: { id: 'Mencari 3 penawaran atau lebih yang selisihnya di bawah 0,5%.', en: 'Looks for 3 or more bids less than 0.5% apart.' }, tab: 'bidders' },
  { id: 'afiliasi', name: { id: 'Peserta terafiliasi', en: 'Affiliated bidders' }, checks: { id: 'Alamat, direktur, IP pendaftaran yang sama, dan giliran menang.', en: 'Shared address, director, registration IP and rotating wins.' }, tab: 'bidders' },
  { id: 'pemenang-berulang', name: { id: 'Pemenang berulang', en: 'Repeat winners' }, checks: { id: 'Riwayat pemenang paket OPD yang sama.', en: 'Winner history of the same agency.' }, tab: 'bidders' },
  { id: 'spesifikasi-merek', name: { id: 'Spesifikasi mengunci merek', en: 'Brand-locked specification' }, checks: { id: 'Spesifikasi menyebut satu merek tanpa "atau setara".', en: 'The spec names one brand without "or equivalent".' }, tab: 'patterns' },
  { id: 'jadwal-singkat', name: { id: 'Jadwal terlalu singkat', en: 'Schedule too short' }, checks: { id: 'Masa penawaran di bawah 7 hari untuk nilai Rp 1 M ke atas.', en: 'A bidding window under 7 days for Rp 1 bn or more.' }, tab: 'patterns' },
  { id: 'pemecahan-paket', name: { id: 'Pemecahan paket', en: 'Package splitting' }, checks: { id: 'Paket sejenis tepat di bawah ambang pengadaan langsung Rp 200 jt (aturan simulasi).', en: 'Similar packages just under the Rp 200 m direct-procurement ceiling (simulated rule).' }, tab: 'patterns' },
]
export const DETECTOR_BY_ID = Object.fromEntries(DETECTORS.map((d) => [d.id, d])) as Record<Detector, (typeof DETECTORS)[number]>

export const LEVEL_TONE: Record<Level, 'done' | 'warn' | 'danger'> = { lolos: 'done', waspada: 'warn', tinggi: 'danger' }
const LEVEL_RANK: Record<Level, number> = { tinggi: 2, waspada: 1, lolos: 0 }

/** order findings like the scan (detector order) */
export function orderFindings(f: ProcurementFinding[]): ProcurementFinding[] {
  const ix = (d: Detector) => DETECTORS.findIndex((x) => x.id === d)
  return [...f].sort((a, b) => ix(a.detector) - ix(b.detector))
}
/** the 3 findings shown as cards after the scan: highest level first, detector order breaks ties */
export function topFindings(f: ProcurementFinding[], n = 3): ProcurementFinding[] {
  return orderFindings(f)
    .filter((x) => x.level !== 'lolos')
    .sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level])
    .slice(0, n)
}

export type RiskBand = 'high' | 'mid' | 'low'
export const riskBand = (score: number): RiskBand => (score >= 60 ? 'high' : score >= 35 ? 'mid' : 'low')
export const BAND_TONE: Record<RiskBand, 'danger' | 'warn' | 'neutral'> = { high: 'danger', mid: 'warn', low: 'neutral' }

/* ------------------------------------------------------------------ formatting (shared by table + memo) */

export const rpFull = (n: number, lang: Lang) => rupiah(n, 'full', lang)
export const rpShort = (n: number, lang: Lang) => rupiah(n, 'short', lang)
export const pct = (n: number, lang: Lang, signed = false) => percent(n, { lang, digits: 1, signed })
export const qty = (n: number, lang: Lang) => num(n, { lang })

/** item units are stored in Indonesian; English shows its own words (plural by quantity) */
const UNIT_EN: Record<string, [string, string]> = {
  unit: ['unit', 'units'], rol: ['roll', 'rolls'], stel: ['set', 'sets'], set: ['set', 'sets'], kotak: ['box', 'boxes'], dus: ['carton', 'cartons'],
  lembar: ['sheet', 'sheets'], liter: ['litre', 'litres'], ton: ['tonne', 'tonnes'], titik: ['point', 'points'], paket: ['package', 'packages'], buah: ['piece', 'pieces'],
}
export const unitText = (unit: string, n: number, lang: Lang) => (lang === 'en' ? (UNIT_EN[unit]?.[n === 1 ? 0 : 1] ?? unit) : unit)
export const qtyUnit = (n: number, unit: string, lang: Lang) => `${qty(n, lang)} ${unitText(unit, n, lang)}`

/**
 * Detector notes come from the kit with their own short money ("Rp 315.4 m", "Rp 1.0 bn"); in English the product
 * writes short money as "Rp 315M" / "Rp 1.04B", so the notes are aligned to the same units.
 */
export const noteText = (b: Bi, lang: Lang) =>
  lang === 'en' ? b.en.replace(/Rp\s(\d+(?:\.\d+)?)\s(m|bn)\b/g, (_m, n: string, u: string) => `Rp\u00a0${n}${u === 'm' ? 'M' : 'B'}`) : b.id

export const opdShort = (s: WorldState, id: string) => s.region.opd.find((o) => o.id === id)?.short ?? id
export const opdName = (s: WorldState, id: string) => s.region.opd.find((o) => o.id === id)?.name ?? id
export const kecName = (s: WorldState, id: string) => s.region.kecamatan.find((k) => k.id === id)?.name ?? id

/** "procurements:PR-1" or "PR-1" → "PR-1" */
export const bareId = (x: string) => (x.includes(':') ? x.slice(x.indexOf(':') + 1) : x)

export const daysLeft = (p: Procurement, now: number) => Math.ceil((p.deadlineAt - now) / DAY_MIN)
export const isOpenStage = (p: Procurement) => p.status === 'perencanaan' || p.status === 'pengumuman' || p.status === 'evaluasi'

export const findPump = (s: WorldState): Procurement | undefined => rows(s.procurements).find((p) => p.key === PUMP_KEY && p.status !== 'selesai')

/** the analysis is "full" only when the detectors ran (seeded packages may carry a screening score only) */
export const isAnalysed = (p: Procurement) => p.flagged && p.findings.length > 0

/* ------------------------------------------------------------------ risk score (product calibration) */

/**
 * Weight of each detector verdict (0..1). The score combines the detectors that fire as independent signals,
 * 100 × (1 − Π(1 − w)), so it rises with every extra signal but never reaches a staged-looking 100. The weights are
 * shown in the Pola tab ("bobot"), so the score can be explained detector by detector.
 */
export const DETECTOR_WEIGHT: Record<Detector, { tinggi: number; waspada: number }> = {
  'hps-kemahalan': { tinggi: 0.3, waspada: 0.12 },
  'harga-seragam': { tinggi: 0.3, waspada: 0.12 },
  afiliasi: { tinggi: 0.45, waspada: 0.2 },
  'pemenang-berulang': { tinggi: 0.25, waspada: 0.1 },
  'spesifikasi-merek': { tinggi: 0.2, waspada: 0.08 },
  'jadwal-singkat': { tinggi: 0.15, waspada: 0.06 },
  'pemecahan-paket': { tinggi: 0.15, waspada: 0.08 },
}
export const weightOf = (f: ProcurementFinding) => (f.level === 'lolos' ? 0 : DETECTOR_WEIGHT[f.detector][f.level])
export const scoreOf = (findings: ProcurementFinding[]) => Math.round(100 * (1 - findings.reduce((a, f) => a * (1 - weightOf(f)), 1)))

const KIND_TEXT: Record<AffiliationEdge['kinds'][number], Bi> = {
  alamat: { id: 'alamat', en: 'address' },
  direktur: { id: 'direktur', en: 'director' },
  ip: { id: 'IP pendaftaran', en: 'registration IP' },
  giliran: { id: 'giliran menang', en: 'rotating wins' },
}

/**
 * The kit analysis + the product calibration: the score from DETECTOR_WEIGHT, and the affiliation note lists only
 * the kinds of link the network really shows (the kit note always lists all four).
 */
export function analyse(s: WorldState, procurementId: string): { riskScore: number; findings: ProcurementFinding[] } {
  const r = analyzeProcurement(s, procurementId)
  const edges = affiliationEdges(s, procurementId)
  const kinds = [...new Set(edges.flatMap((e) => e.kinds))]
  const ring = new Set(edges.flatMap((e) => [e.a, e.b])).size
  const findings = r.findings.map((f) =>
    f.detector === 'afiliasi' && edges.length
      ? {
          ...f,
          note: {
            id: `${ring} peserta terhubung lewat ${edges.length} kesamaan (${kinds.map((k) => KIND_TEXT[k].id).join(', ')})`,
            en: `${ring} bidders linked by ${edges.length} shared traits (${kinds.map((k) => KIND_TEXT[k].en).join(', ')})`,
          },
        }
      : f,
  )
  return { riskScore: scoreOf(findings), findings }
}

/**
 * Registration IPs are stored as private 10.x addresses; real LPSE logs show public ones. Shown as addresses from
 * the documentation range 203.0.113.0/24 (never routable, so still fictional), mapped one-to-one per stored IP.
 */
export function publicIp(ip: string): string {
  const m = /^10\.(\d+)\.(\d+)\.(\d+)$/.exec(ip)
  if (!m) return ip
  return `203.0.113.${((Number(m[1]) * 31 + Number(m[2]) * 7 + Number(m[3])) % 253) + 1}`
}
export const publicIpText = (text: string) => text.replace(/\b10\.\d+\.\d+\.\d+\b/g, (x) => publicIp(x))

/**
 * The seeded screening score a package had before the 7 detectors replaced it (recorded when the clock screening
 * runs), so the list and the strip can show "awal 28 → 12" instead of a silent jump. Per page load.
 */
export const prelimBefore = new Map<string, number>()

/* ------------------------------------------------------------------ package money (KPIs, list, AI share it) */

/** HPS above the market median (Rp), the same number as hpsVsMarket().overpay */
export const gapOf = (p: Procurement) => Math.max(0, p.items.reduce((a, i) => a + (i.hpsPrice - i.marketPrice) * i.qty, 0))

/** fair margin on top of the market median (profit + overheads) for a proposed HPS: a simulation assumption */
export const CORRECTION_MARGIN = 0.1
/** per item: (market median + margin), rounded to Rp 100 per unit — so the total can differ from median × 1.1 by a
 *  few thousand rupiah; every text that quotes the total says so (ROUNDING_NOTE) */
export const correctedUnit = (market: number) => Math.round((market * (1 + CORRECTION_MARGIN)) / 100) * 100
export const ROUNDING_NOTE: Bi = { id: 'dihitung per item, harga satuan dibulatkan ke Rp 100', en: 'computed per item, unit prices rounded to Rp 100' }
/** proposed HPS = Σ (market median + fair margin) × qty */
export const correctedTotal = (items: { market: number; qty: number }[]) => items.reduce((a, i) => a + correctedUnit(i.market) * i.qty, 0)

/** bids above an HPS (they fail evaluation) */
export const bidsAbove = (p: Procurement, hps: number) => (p.bids ?? []).filter((b) => b.price > hps)

export interface Watch {
  /** not completed (tender + contract) — the "Paket aktif dipantau" KPI */
  watched: number
  tender: number
  contract: number
  done: number
  value: number
  gap: number
  /** proposed HPS reductions (recommendations waiting for the PPK; NOT subtracted from gap) */
  proposed: number
  high: number
  mid: number
  /** fully analysed (detectors ran) */
  analysed: number
  /** screening score only */
  prelim: number
  /** neither */
  none: number
}
/** one summary for the KPI strip and the AI (the same numbers on screen and in answers) */
export function watchSummary(s: WorldState): Watch {
  const w: Watch = { watched: 0, tender: 0, contract: 0, done: 0, value: 0, gap: 0, proposed: 0, high: 0, mid: 0, analysed: 0, prelim: 0, none: 0 }
  for (const p of rows(s.procurements)) {
    if (p.status === 'selesai') {
      w.done++
      continue
    }
    w.watched++
    if (isOpenStage(p)) w.tender++
    else w.contract++
    w.value += p.hps
    // the same rule as the "Berisiko" filter (score ≥ 35, a screening score counts too)
    const band = p.riskScore != null ? riskBand(p.riskScore) : null
    if (band === 'high') w.high++
    if (band === 'mid') w.mid++
    if (isAnalysed(p)) w.analysed++
    else if (p.riskScore != null) w.prelim++
    else w.none++
    // a proposal waiting for the PPK changes nothing yet: the gap stays counted, the proposal is shown beside it
    w.gap += gapOf(p)
    if (p.recommendation) w.proposed += Math.max(0, p.hps - p.recommendation.hpsCorrected)
  }
  return w
}

/* ------------------------------------------------------------------ local SME benchmark (Katalog Lokal) */

/** catalog category of an item (same rule as the world reaction procurement-recommendation→catalog-need) */
export const itemCategory = (name: string) =>
  /pompa|pump/i.test(name) ? 'pompa' : /genset|generator/i.test(name) ? 'genset' : /selang|hose/i.test(name) ? 'selang' : /solar|bbm|diesel fuel/i.test(name) ? 'bbm' : 'alat-kerja'

function unit01(key: string): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619)
  return ((h >>> 0) % 10000) / 10000
}

export interface LocalOffer {
  businessId: string
  name: string
  kecamatan: string
  price: number
  /** matched for real through Katalog Lokal (match.made) */
  matched: boolean
}
export interface LocalItem {
  item: ItemDeviation
  category: string
  offers: LocalOffer[]
}

/**
 * Up to 3 verified local SMEs per item that supply its catalog category, with a SIMULATED offer around the market
 * median (deterministic per business × item). Real Katalog Lokal matches (match.made) come first.
 */
export function localOffers(s: WorldState, procurementId: string): LocalItem[] {
  const hv = hpsVsMarket(s, procurementId)
  const matched = new Set(localBenchmarks(s, procurementId).map((m) => m.businessId))
  const biz = rows(s.businesses)
  return hv.items.map((item) => {
    const category = itemCategory(item.name.id)
    const cands = biz
      .filter((b) => b.verified && (b.supplies.includes(category) || (category === 'selang' && b.supplies.includes('pompa'))))
      .map((b) => ({ b, k: (matched.has(b.id) ? -1 : 0) + unit01(`${b.id}|${procurementId}`) }))
      .sort((a, b) => a.k - b.k)
      .slice(0, 3)
    const offers = cands.map(({ b }) => ({
      businessId: b.id,
      name: b.name,
      kecamatan: kecName(s, b.kecamatanId),
      price: Math.round((item.market * (0.95 + unit01(`${b.id}|${item.name.id}`) * 0.1)) / 1000) * 1000 || item.market,
      matched: matched.has(b.id),
    }))
    return { item, category, offers }
  })
}

/** the Katalog Lokal need created by this package's recommendation, if any */
export function needOf(s: WorldState, procurementId: string) {
  const cause = `procurements:${procurementId}`
  return rows(s.catalogNeeds).find((n) => n.cause === cause)
}

/* ------------------------------------------------------------------ memo model */

export interface MemoModel {
  role: 'ukpbj' | 'inspektorat'
  number: string
  to: string
  from: string
  cc: string
  subject: string
  table: { items: ItemDeviation[]; hps: number; market: number; overpay: number; devPct: number }
  findings: ProcurementFinding[]
  recs: string[]
  ring: string[]
  hpsCorrected: number
}

/** everything the memo shows besides the AI summary; numbers come from hpsVsMarket (= the HPS tab table) */
export function memoModel(s: WorldState, procurementId: string, role: string, lang: Lang): MemoModel | null {
  const p = s.procurements.byId[procurementId]
  if (!p) return null
  const r: MemoModel['role'] = role === 'inspektorat' ? 'inspektorat' : 'ukpbj'
  const table = hpsVsMarket(s, procurementId)
  const edges = affiliationEdges(s, procurementId)
  const ringIds = [...new Set(edges.flatMap((e) => [e.a, e.b]))]
  const ring = ringIds.map((id) => s.bidders.byId[id]).filter((b): b is NonNullable<typeof b> => !!b).map((b) => `${b.legal} ${b.name}`)
  const findings = orderFindings(p.findings).filter((f) => f.level !== 'lolos')
  const has = (d: Detector) => findings.some((f) => f.detector === d)
  const L = (x: Bi) => x[lang]
  const opd = opdShort(s, p.opdId)
  const recs: string[] = []
  const proposed = correctedTotal(table.items)
  const above = bidsAbove(p, proposed)
  const overHps = bidsAbove(p, p.hps)
  const lowest = Math.min(...(p.bids ?? []).map((b) => b.price))
  const mPct = Math.round(CORRECTION_MARGIN * 100)
  if (table.overpay > 0)
    recs.push(headWord(L(r === 'inspektorat'
      ? {
          // the inspectorate (APIP) recommends a review; it does not propose the HPS itself (independence)
          id: `Merekomendasikan Bupati memerintahkan PPK/UKPBJ meninjau HPS ${rpFull(table.hps, 'id')}. Sebagai acuan: median harga pasar ${rpFull(table.market, 'id')} ditambah margin wajar ${mPct}% = ${rpFull(proposed, 'id')} (asumsi simulasi; ${ROUNDING_NOTE.id}). Penetapan HPS tetap wewenang PPK.`,
          en: `Recommend that the Regent instruct the PPK/UKPBJ to review the HPS of ${rpFull(table.hps, 'en')}. As a reference: the market median ${rpFull(table.market, 'en')} plus a fair ${mPct}% margin = ${rpFull(proposed, 'en')} (simulation assumption; ${ROUNDING_NOTE.en}). Setting the HPS remains the PPK's decision.`,
        }
      : {
          id: `Usulkan kepada PPK koreksi HPS dari ${rpFull(table.hps, 'id')} menjadi ${rpFull(proposed, 'id')}: median harga pasar ${rpFull(table.market, 'id')} ditambah margin keuntungan dan biaya umum wajar ${mPct}% (asumsi simulasi; ${ROUNDING_NOTE.id}). Penetapan HPS tetap wewenang PPK.`,
          en: `Propose to the PPK an HPS correction from ${rpFull(table.hps, 'en')} to ${rpFull(proposed, 'en')}: the market median ${rpFull(table.market, 'en')} plus a fair ${mPct}% margin for profit and overheads (simulation assumption; ${ROUNDING_NOTE.en}). Setting the HPS remains the PPK's decision.`,
        })))
  if (above.length && Number.isFinite(lowest))
    recs.push(L(above.length === (p.bids ?? []).length
      ? {
          id: `Seluruh ${above.length} penawaran (terendah ${rpFull(lowest, 'id')}) berada di atas HPS usulan. Bila HPS dikoreksi, lakukan negosiasi harga atau tender ulang dengan mengundang UMKM lokal.`,
          en: `All ${above.length} bids (lowest ${rpFull(lowest, 'en')}) are above the proposed HPS. If the HPS is corrected, negotiate the price or re-tender and invite local SMEs.`,
        }
      : {
          id: `${above.length} dari ${(p.bids ?? []).length} penawaran berada di atas HPS usulan dan perlu dievaluasi ulang.`,
          en: `${above.length} of the ${(p.bids ?? []).length} bids are above the proposed HPS and need re-evaluation.`,
        }))
  if (overHps.length)
    recs.push(L({
      id: `${overHps.length} penawaran sudah melebihi HPS saat ini (${overHps.map((b) => s.bidders.byId[b.bidderId]?.name ?? b.bidderId).join(', ')}) dan gugur dalam evaluasi harga.`,
      en: `${overHps.length === 1 ? 'One bid already exceeds' : `${overHps.length} bids already exceed`} the current HPS (${overHps.map((b) => s.bidders.byId[b.bidderId]?.name ?? b.bidderId).join(', ')}) and ${overHps.length === 1 ? 'fails' : 'fail'} the price evaluation.`,
    }))
  if (ring.length)
    recs.push(L({
      id: `Klarifikasi ${ring.length} peserta yang terhubung (${ring.join(', ')}) sebelum penetapan pemenang.`,
      en: `Clarify the ${ring.length} linked bidders (${ring.join(', ')}) before a winner is named.`,
    }))
  if (has('spesifikasi-merek')) recs.push(L({ id: 'Revisi spesifikasi teknis: hapus penyebutan merek atau tambahkan "atau setara".', en: 'Revise the technical spec: remove the brand name or add "or equivalent".' }))
  if (has('jadwal-singkat')) recs.push(L({ id: `Lengkapi justifikasi tertulis untuk jadwal penawaran ${p.scheduleDays ?? '?'} hari.`, en: `Add a written justification for the ${p.scheduleDays ?? '?'}-day bidding window.` }))
  if (has('pemecahan-paket'))
    recs.push(L({
      id: `Telaah paket sejenis ${opd} yang sudah berkontrak di bawah ambang pengadaan langsung, dan cegah pemecahan pada paket berikutnya.`,
      en: `Review the similar ${opd} packages already contracted under the direct-procurement ceiling, and prevent splitting in the next packages.`,
    }))
  recs.push(L({ id: 'Undang UMKM lokal terverifikasi lewat Katalog Lokal sebagai pembanding harga dan calon pemasok.', en: 'Invite verified local SMEs through Katalog Lokal as a price benchmark and potential suppliers.' }))
  const year = s.day.slice(0, 4)
  return {
    role: r,
    number: r === 'inspektorat' ? `700/AB-${p.code}/${year}` : `027/AB-${p.code}/${year}`,
    to: headWord(L(r === 'inspektorat' ? { id: `Bupati ${s.region.shortName}`, en: `Regent of ${s.region.shortName}` } : { id: `Pejabat Pembuat Komitmen (PPK) ${opd}`, en: `Commitment Officer (PPK), ${opd}` })),
    from: L(r === 'inspektorat' ? { id: 'Inspektur Daerah', en: 'Regional Inspector' } : { id: 'Kepala Bagian Pengadaan Barang/Jasa (UKPBJ)', en: 'Head of the Procurement Unit (UKPBJ)' }),
    cc: L(r === 'inspektorat' ? { id: `Kepala UKPBJ; Kepala ${opd}`, en: `Head of UKPBJ; Head of ${opd}` } : { id: `Inspektur Daerah; Kepala ${opd}`, en: `Regional Inspector; Head of ${opd}` }),
    subject: `${L(p.name)} (${p.code})`,
    table,
    findings,
    recs,
    ring,
    hpsCorrected: proposed,
  }
}

/* ------------------------------------------------------------------ AI context */

/** compact, relevant context for one package (sim answers read it; Live sends it summarised, ≤ 6 KB) */
export interface AbContext {
  role: string
  region: string
  paket: {
    id: string
    kode: string
    nama: Bi
    opd: string
    metode: string
    tahap: string
    darurat: boolean
    hps: number
    jadwalHari: number | null
    /** days until the bid deadline (null when the package is past the bidding stages) */
    sisaHari: number | null
    spesifikasi: string | null
    jumlahPeserta: number
  } | null
  hpsVsPasar: { items: { nama: Bi; volume: number; satuan: string; hps: number; pasar: number; deviasiPct: number; selisih: number }[]; hps: number; pasar: number; selisih: number; deviasiPct: number; hpsUsulan: number; marginPct: number } | null
  analisis: { skor: number; temuan: { detektor: Detector; tingkat: Level; catatan: Bi }[] } | null
  peserta: { nama: string; direktur: string; alamat: string; penawaran: number | null; menang: number; diAtasHps: boolean; terhubungDengan: string[] }[]
  afiliasi: { a: string; b: string; jenis: AffiliationEdge['kinds']; bukti: Bi[] }[]
  rekomendasi: { hpsKoreksi: number } | null
  umkmLokal: { item: Bi; kategori: string; umkm: { nama: string; kecamatan: string; harga: number }[] }[]
  /** every package (completed ones too: they are the history the detectors read) */
  daftarPaket: {
    id: string; kode: string; nama: Bi; opd: string; opdNama: string; hps: number; skor: number | null; deviasiPct: number; selisih: number; tahap: string; aktif: boolean; sisaHari: number | null; dianalisis: boolean; pemenang: string | null
    /** screening score (no detector detail), or the one it had before the 7 detectors replaced it */
    skorAwal: number | null
    /** analysed packages only: detectors that fired, with their weight (%) */
    temuan: { detektor: Detector; tingkat: Level; catatan: Bi; bobot: number }[]
    /** median + margin per item (the same rule as the open package) */
    hpsUsulan: number
    /** a proposal recorded and waiting for the PPK */
    usulanTercatat: number | null
    darurat: boolean
  }[]
  /** the KPI strip numbers (same function) */
  ringkasan: Watch
}

export function aiContext(s: WorldState, procurementId: string | null, role: string, now: number = clock.get().minutes): AbContext {
  const p = procurementId ? s.procurements.byId[procurementId] : undefined
  const left = (x: Procurement) => (isOpenStage(x) ? daysLeft(x, now) : null)
  const list = rows(s.procurements).map((x) => {
    const d = hpsVsMarket(s, x.id)
    const win = x.winnerId ? s.bidders.byId[x.winnerId] : undefined
    return {
      id: x.id, kode: x.code, nama: x.name, opd: opdShort(s, x.opdId), opdNama: opdName(s, x.opdId), hps: x.hps, skor: isAnalysed(x) ? x.riskScore : null, deviasiPct: d.devPct, selisih: d.overpay,
      tahap: x.status, aktif: isOpenStage(x), sisaHari: left(x), dianalisis: isAnalysed(x), pemenang: win ? `${win.legal} ${win.name}` : null,
      skorAwal: isAnalysed(x) ? (prelimBefore.get(x.id) ?? null) : (x.riskScore ?? null),
      temuan: isAnalysed(x) ? orderFindings(x.findings).filter((f) => f.level !== 'lolos').map((f) => ({ detektor: f.detector, tingkat: f.level, catatan: f.note, bobot: Math.round(weightOf(f) * 100) })) : [],
      hpsUsulan: correctedTotal(d.items),
      usulanTercatat: x.recommendation?.hpsCorrected ?? null,
      darurat: x.emergency,
    }
  })
  const ringkasan = watchSummary(s)
  if (!p) return { role, region: s.region.name, paket: null, hpsVsPasar: null, analisis: null, peserta: [], afiliasi: [], rekomendasi: null, umkmLokal: [], daftarPaket: list, ringkasan }
  const hv = hpsVsMarket(s, p.id)
  const name = (id: string) => s.bidders.byId[id]?.name ?? id
  const edges = affiliationEdges(s, p.id)
  return {
    role,
    region: s.region.name,
    paket: {
      id: p.id, kode: p.code, nama: p.name, opd: opdShort(s, p.opdId), metode: p.method, tahap: p.status, darurat: p.emergency, hps: hv.hps,
      jadwalHari: p.scheduleDays ?? null, sisaHari: left(p), spesifikasi: p.spec?.id ?? null, jumlahPeserta: p.bidderIds.length,
    },
    hpsVsPasar: { items: hv.items.map((i) => ({ nama: i.name, volume: i.qty, satuan: i.unit, hps: i.hps, pasar: i.market, deviasiPct: i.devPct, selisih: i.overpay })), hps: hv.hps, pasar: hv.market, selisih: hv.overpay, deviasiPct: hv.devPct, hpsUsulan: correctedTotal(hv.items), marginPct: Math.round(CORRECTION_MARGIN * 100) },
    analisis: isAnalysed(p) ? { skor: p.riskScore ?? 0, temuan: orderFindings(p.findings).map((f) => ({ detektor: f.detector, tingkat: f.level, catatan: f.note })) } : null,
    peserta: p.bidderIds.map((id) => {
      const b = s.bidders.byId[id]
      const bid = p.bids?.find((x) => x.bidderId === id)?.price ?? null
      const linked = edges.filter((e) => e.a === id || e.b === id).map((e) => name(e.a === id ? e.b : e.a))
      return { nama: b ? `${b.legal} ${b.name}` : id, direktur: b?.director ?? '', alamat: b?.address ?? '', penawaran: bid, menang: b?.wins ?? 0, diAtasHps: bid != null && bid > p.hps, terhubungDengan: linked }
    }),
    afiliasi: edges.map((e) => ({ a: name(e.a), b: name(e.b), jenis: e.kinds, bukti: e.evidence.map((x) => ({ id: publicIpText(x.id), en: publicIpText(x.en) })) })),
    rekomendasi: p.recommendation ? { hpsKoreksi: p.recommendation.hpsCorrected } : null,
    umkmLokal: localOffers(s, p.id)
      .filter((x) => x.offers.length)
      .map((x) => ({ item: x.item.name, kategori: x.category, umkm: x.offers.map((o) => ({ nama: o.name, kecamatan: o.kecamatan, harga: o.price })) })),
    daftarPaket: list,
    ringkasan,
  }
}
