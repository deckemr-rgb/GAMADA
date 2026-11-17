/**
 * demos/awas-belanja/model.ts — pure helpers of the product: detector metadata, formatting (one formatter for the
 * table AND the memo, so their numbers are identical), the local-SME benchmark, the memo model and the compact AI
 * context (the same object feeds the simulation and, summarised, the Live proxy).
 *
 * All numbers come from the seeded world (world/satu-daerah selectors); companies and people are fictional.
 */
import type { Bi, Procurement, ProcurementFinding, WorldState } from '../../demo-kit/world'
import { DAY_MIN, rows } from '../../demo-kit/world/util'
import { clock } from '../../demo-kit/world/clock'
import { affiliationEdges, hpsVsMarket, localBenchmarks, type AffiliationEdge, type ItemDeviation } from '../../demo-kit/world/satu-daerah'
import { num, percent, rupiah } from '../../demo-kit/viz/format'
import type { Lang } from './strings'

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
  if (table.overpay > 0)
    recs.push(L({
      id: `Koreksi HPS dari ${rpFull(table.hps, 'id')} menjadi ${rpFull(table.market, 'id')} sesuai median harga pasar; selisih ${rpFull(table.overpay, 'id')} (${pct(table.devPct, 'id')}).`,
      en: `Correct the HPS from ${rpFull(table.hps, 'en')} to ${rpFull(table.market, 'en')}, the market median; a difference of ${rpFull(table.overpay, 'en')} (${pct(table.devPct, 'en')}).`,
    }))
  if (ring.length)
    recs.push(L({
      id: `Klarifikasi ${ring.length} peserta yang terhubung (${ring.join(', ')}) sebelum penetapan pemenang.`,
      en: `Clarify the ${ring.length} linked bidders (${ring.join(', ')}) before a winner is named.`,
    }))
  if (has('spesifikasi-merek')) recs.push(L({ id: 'Revisi spesifikasi teknis: hapus penyebutan merek atau tambahkan "atau setara".', en: 'Revise the technical spec: remove the brand name or add "or equivalent".' }))
  if (has('jadwal-singkat')) recs.push(L({ id: `Lengkapi justifikasi tertulis untuk jadwal penawaran ${p.scheduleDays ?? '?'} hari.`, en: `Add a written justification for the ${p.scheduleDays ?? '?'}-day bidding window.` }))
  if (has('pemecahan-paket')) recs.push(L({ id: `Gabungkan paket sejenis ${opd} yang dipecah di bawah ambang pengadaan langsung.`, en: `Merge the similar ${opd} packages split under the direct-procurement ceiling.` }))
  recs.push(L({ id: 'Undang UMKM lokal terverifikasi lewat Katalog Lokal sebagai pembanding harga dan calon pemasok.', en: 'Invite verified local SMEs through Katalog Lokal as a price benchmark and potential suppliers.' }))
  const year = s.day.slice(0, 4)
  return {
    role: r,
    number: r === 'inspektorat' ? `700/AB-${p.code}/${year}` : `027/AB-${p.code}/${year}`,
    to: L(r === 'inspektorat' ? { id: `Bupati ${s.region.shortName}`, en: `Regent of ${s.region.shortName}` } : { id: `Pejabat Pembuat Komitmen (PPK) ${opd}`, en: `Commitment Officer (PPK), ${opd}` }),
    from: L(r === 'inspektorat' ? { id: 'Inspektur Daerah', en: 'Regional Inspector' } : { id: 'Kepala Bagian Pengadaan Barang/Jasa (UKPBJ)', en: 'Head of the Procurement Unit (UKPBJ)' }),
    cc: L(r === 'inspektorat' ? { id: `Kepala UKPBJ; Kepala ${opd}`, en: `Head of UKPBJ; Head of ${opd}` } : { id: `Inspektur Daerah; Kepala ${opd}`, en: `Regional Inspector; Head of ${opd}` }),
    subject: `${L(p.name)} (${p.code})`,
    table,
    findings,
    recs,
    ring,
    hpsCorrected: table.market,
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
  hpsVsPasar: { items: { nama: Bi; volume: number; satuan: string; hps: number; pasar: number; deviasiPct: number; selisih: number }[]; hps: number; pasar: number; selisih: number; deviasiPct: number } | null
  analisis: { skor: number; temuan: { detektor: Detector; tingkat: Level; catatan: Bi }[] } | null
  peserta: { nama: string; direktur: string; alamat: string; penawaran: number | null; menang: number }[]
  afiliasi: { a: string; b: string; jenis: AffiliationEdge['kinds']; bukti: Bi[] }[]
  rekomendasi: { hpsKoreksi: number } | null
  umkmLokal: { item: Bi; kategori: string; umkm: { nama: string; kecamatan: string; harga: number }[] }[]
  daftarPaket: { kode: string; nama: Bi; opd: string; hps: number; skor: number | null; deviasiPct: number; tahap: string; sisaHari: number | null; dianalisis: boolean }[]
}

export function aiContext(s: WorldState, procurementId: string | null, role: string, now: number = clock.get().minutes): AbContext {
  const p = procurementId ? s.procurements.byId[procurementId] : undefined
  const left = (x: Procurement) => (isOpenStage(x) ? daysLeft(x, now) : null)
  const list = rows(s.procurements)
    .filter((x) => x.status !== 'selesai')
    .map((x) => ({ x, d: hpsVsMarket(s, x.id) }))
    .sort((a, b) => (b.x.riskScore ?? b.d.devPct / 2) - (a.x.riskScore ?? a.d.devPct / 2))
    .slice(0, 8)
    .map(({ x, d }) => ({ kode: x.code, nama: x.name, opd: opdShort(s, x.opdId), hps: x.hps, skor: x.riskScore, deviasiPct: d.devPct, tahap: x.status, sisaHari: left(x), dianalisis: isAnalysed(x) }))
  if (!p) return { role, region: s.region.name, paket: null, hpsVsPasar: null, analisis: null, peserta: [], afiliasi: [], rekomendasi: null, umkmLokal: [], daftarPaket: list }
  const hv = hpsVsMarket(s, p.id)
  const name = (id: string) => s.bidders.byId[id]?.name ?? id
  return {
    role,
    region: s.region.name,
    paket: {
      id: p.id, kode: p.code, nama: p.name, opd: opdShort(s, p.opdId), metode: p.method, tahap: p.status, darurat: p.emergency, hps: hv.hps,
      jadwalHari: p.scheduleDays ?? null, sisaHari: left(p), spesifikasi: p.spec?.id ?? null, jumlahPeserta: p.bidderIds.length,
    },
    hpsVsPasar: { items: hv.items.map((i) => ({ nama: i.name, volume: i.qty, satuan: i.unit, hps: i.hps, pasar: i.market, deviasiPct: i.devPct, selisih: i.overpay })), hps: hv.hps, pasar: hv.market, selisih: hv.overpay, deviasiPct: hv.devPct },
    analisis: isAnalysed(p) ? { skor: p.riskScore ?? 0, temuan: orderFindings(p.findings).map((f) => ({ detektor: f.detector, tingkat: f.level, catatan: f.note })) } : null,
    peserta: p.bidderIds.map((id) => {
      const b = s.bidders.byId[id]
      return { nama: b ? `${b.legal} ${b.name}` : id, direktur: b?.director ?? '', alamat: b?.address ?? '', penawaran: p.bids?.find((x) => x.bidderId === id)?.price ?? null, menang: b?.wins ?? 0 }
    }),
    afiliasi: affiliationEdges(s, p.id).map((e) => ({ a: name(e.a), b: name(e.b), jenis: e.kinds, bukti: e.evidence })),
    rekomendasi: p.recommendation ? { hpsKoreksi: p.recommendation.hpsCorrected } : null,
    umkmLokal: localOffers(s, p.id)
      .filter((x) => x.offers.length)
      .map((x) => ({ item: x.item.name, kategori: x.category, umkm: x.offers.map((o) => ({ nama: o.name, kecamatan: o.kecamatan, harga: o.price })) })),
    daftarPaket: list,
  }
}
