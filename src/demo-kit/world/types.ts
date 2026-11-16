/**
 * world/types.ts — the simulated world shared by every product sandbox (spec §6.1).
 *
 * Time: every `at` / `…At` is in WORLD MINUTES relative to 00:00 of the demo day (`WorldState.day`).
 * Negative values are previous days (-1440 = yesterday 00:00). Clock minutes use the same scale.
 *
 * Everything people-, company-, media- or money-shaped is FICTIONAL (generated from the seed).
 * Geography (kecamatan, desa, markets, rivers) comes from the real region pack.
 */
import type { ProductSlug, RoleId } from '../../content/products'
import type { ComplaintCategory, RegionalLang } from '../region/types'

export type { ComplaintCategory, RegionalLang }
export type Bi = { id: string; en: string }
export type LngLat = [number, number]
/** world minutes since 00:00 of the demo day (negative = earlier days) */
export type Minutes = number

/** Normalised table. `ids` are newest first. */
export type Table<T extends { id: string }> = { byId: Record<string, T>; ids: string[] }

/** "<tableKey>:<id>" — used by AuditEntry.entityRefs and the Inti data trail. */
export type EntityRef = string

export type EventSource = ProductSlug | 'clock' | 'tour' | 'user'

/* ================================================================== Satu Daerah */

export type NameGroup = 'jawa' | 'sunda' | 'batak' | 'minang' | 'bugis' | 'tionghoa' | 'madura' | 'bali' | 'banjar'

export interface Citizen {
  id: string
  name: string
  gender: 'L' | 'P'
  age: number
  group: NameGroup
  kecamatanId: string
  desaId: string
  /** "Desa X, Kec. Y" (real place names) */
  address: string
  coord: LngLat
  /** fictional, masked */
  phone: string
  lang: RegionalLang | 'id'
}

export type ComplaintChannel = 'wa' | 'web' | 'telepon' | 'voice'
export type Urgency = 'rendah' | 'sedang' | 'tinggi'

export interface Complaint {
  id: string
  /** SW-YYYY-#### */
  code: string
  citizenId: string | null
  category: ComplaintCategory
  channel: ComplaintChannel
  /** original text (regional language or Indonesian) */
  text: string
  lang: RegionalLang | 'id'
  /** ID + EN rendering */
  summary: Bi
  kecamatanId: string
  desaId: string
  coord: LngLat
  urgency: Urgency
  at: Minutes
  ticketId: string
  clusterId: string | null
  templateId?: string
  photo?: boolean
}

export type TicketStatus = 'baru' | 'diverifikasi' | 'diteruskan' | 'diproses' | 'selesai'
export interface Ticket {
  id: string
  code: string
  complaintId: string
  status: TicketStatus
  opdId: string
  createdAt: Minutes
  updatedAt: Minutes
  slaDueAt: Minutes
  closedAt: Minutes | null
  rating: number | null
  history: { at: Minutes; status: TicketStatus; note?: string }[]
}

export interface ComplaintCluster {
  id: string
  category: ComplaintCategory
  kecamatanId: string
  desaId: string
  center: LngLat
  radiusKm: number
  complaintIds: string[]
  at: Minutes
  updatedAt: Minutes
}

export interface Booking {
  id: string
  code: string
  serviceId: string
  citizenId: string | null
  slotAt: Minutes
  channel: 'mpp' | 'online' | 'kecamatan' | 'dinas'
  at: Minutes
}

export interface Briefing {
  id: string
  at: Minutes
  items: { title: Bi; source: ProductSlug; refs: EntityRef[] }[]
}

export interface Instruction {
  id: string
  at: Minutes
  text: Bi
  opdIds: string[]
  dueAt: Minutes
  refs: EntityRef[]
  letterId: string | null
  actionItemIds: string[]
  /** where it came from (e.g. an accepted market-operation suggestion) */
  origin?: EntityRef
}

export type LetterKind = 'undangan' | 'permohonan' | 'laporan' | 'edaran' | 'nota-dinas'
export interface Letter {
  id: string
  number: string
  /** sender institution (fictional or by title) */
  from: string
  subject: Bi
  kind: LetterKind
  sifat: 'segera' | 'biasa' | 'rahasia'
  receivedAt: Minutes
  dueAt: Minutes | null
  status: 'masuk' | 'didisposisi'
  /** does the image look like a crooked scan */
  scanned: boolean
  disposition: { to: string[]; note: Bi; by: string; at: Minutes } | null
  instructionId?: string
}

export interface Meeting {
  id: string
  title: Bi
  at: Minutes
  durationMin: number
  /** titles only (officials are never named) */
  participants: string[]
  status: 'terjadwal' | 'berlangsung' | 'selesai'
  transcribed: boolean
  summary: Bi | null
  actionItemIds: string[]
}

export interface ActionItem {
  id: string
  title: Bi
  opdId: string
  /** person in charge, by title */
  pic: string
  dueAt: Minutes
  status: 'baru' | 'proses' | 'selesai'
  source: { kind: 'meeting' | 'instruction' | 'letter' | 'manual'; id: string | null }
  createdAt: Minutes
}

export type Sentiment = 'negatif' | 'netral' | 'positif'
export interface Mention {
  id: string
  at: Minutes
  /** fictional outlet / account */
  outlet: string
  kind: 'berita' | 'sosmed' | 'forum'
  author: string
  text: Bi
  sentiment: Sentiment
  /** -1..1 */
  score: number
  topic: string
  reach: number
  hoaxId?: string
}

export interface HoaxAlert {
  id: string
  at: Minutes
  claim: Bi
  /** 0..1 likelihood of being a hoax */
  score: number
  spreadPerHour: number
  accounts: string[]
  evidence: Bi | null
  topic: string
  status: 'aktif' | 'diklarifikasi'
  clarification: { at: Minutes; tone: 'tegas' | 'menenangkan' | 'informatif'; channels: string[] } | null
}

export interface Alert {
  id: string
  at: Minutes
  kind: 'banjir' | 'longsor' | 'cuaca'
  level: 1 | 2 | 3 | 4
  title: Bi
  kecamatanIds: string[]
  desaIds: string[]
  riverId: string | null
  expectedAt: Minutes | null
  status: 'aktif' | 'selesai'
  broadcast: { at: Minutes; recipients: number; channels: string[] } | null
}

export interface RainCell {
  id: string
  at: Minutes
  center: LngLat
  radiusKm: number
  /** mm/hour */
  intensity: number
  /** degrees, 0 = north */
  heading: number
  speedKmh: number
}

/** A programme opened by an event (e.g. flood-relief bansos registration that Cek Berkas checks against). */
export interface Program {
  id: string
  kind: 'bansos-banjir'
  title: Bi
  kecamatanIds: string[]
  quota: number
  open: boolean
  openedAt: Minutes
  alertId: string | null
}

/* ------------------------------------------------------------------ procurement */

export interface ProcurementItem {
  name: Bi
  qty: number
  unit: string
  hpsPrice: number
  marketPrice: number
}
export interface ProcurementFinding {
  detector: 'harga-seragam' | 'pemenang-berulang' | 'pemecahan-paket' | 'jadwal-singkat' | 'spesifikasi-merek' | 'hps-kemahalan' | 'afiliasi'
  level: 'lolos' | 'waspada' | 'tinggi'
  note: Bi
}
export interface Procurement {
  id: string
  code: string
  name: Bi
  opdId: string
  /** total HPS (Rp) */
  hps: number
  method: 'tender' | 'tender-cepat' | 'pengadaan-langsung' | 'e-katalog' | 'darurat'
  status: 'perencanaan' | 'pengumuman' | 'evaluasi' | 'kontrak' | 'selesai'
  /** 0..100, null = not analysed yet */
  riskScore: number | null
  flagged: boolean
  findings: ProcurementFinding[]
  items: ProcurementItem[]
  bidderIds: string[]
  createdAt: Minutes
  deadlineAt: Minutes
  emergency: boolean
  /** stable scenario key (e.g. 'pompa-darurat') so reactions stay idempotent */
  key?: string
  alertId?: string | null
}

export interface Bidder {
  id: string
  /** fictional company */
  name: string
  legal: 'PT' | 'CV'
  director: string
  address: string
  kecamatanId: string
  /** registration IP (fictional, for the affiliation graph) */
  ip: string
  wins: number
  /** affiliation ring tag (same director/address/ip) — null when independent */
  ring: string | null
  bidPrice?: number
}

export type DocKind = 'ktp' | 'kk' | 'nib' | 'domisili' | 'foto-rumah' | 'npwp' | 'akta' | 'cv'
export interface DocumentRec {
  id: string
  kind: DocKind
  ownerName: string
  citizenId: string | null
  /** fictional specimen NIK */
  nik: string | null
  program: 'bansos-banjir' | 'perizinan' | 'kyc' | 'kyb' | 'rekrutmen'
  kecamatanId: string
  desaId: string
  status: 'baru' | 'lengkap' | 'kurang' | 'cek-manual'
  at: Minutes
  /** specimen flagged as digitally edited (Cek Berkas tamper demo) */
  tampered?: boolean
}

export interface Verification {
  id: string
  subjectKind: 'citizen' | 'business' | 'candidate' | 'document'
  subjectId: string
  kind: 'kyc' | 'kyb' | 'cv' | 'document'
  result: 'lolos' | 'kurang' | 'cek-manual' | 'ditolak'
  score: number
  at: Minutes
  by: EventSource
}

/* ================================================================== Usaha Pintar */

export type BizKind = 'toko-bangunan' | 'kelontong' | 'warung-makan' | 'kedai-kopi' | 'konveksi' | 'kerajinan' | 'tani' | 'bengkel' | 'katering' | 'jasa' | 'percetakan' | 'olahan-pangan'
export interface Business {
  id: string
  name: string
  kind: BizKind
  sector: string
  ownerName: string
  kecamatanId: string
  desaId: string
  coord: LngLat
  marketId: string | null
  /** KYB verified (Kenal Mitra) */
  verified: boolean
  /** tax records tidy (Pajak Beres) */
  taxTidy: boolean
  /** Rp / month (average of the last 3 months) */
  monthlyRevenue: number
  employees: number
  since: number
  /** what it can supply to Pemda through Katalog Lokal (catalog category keys) */
  supplies: string[]
  /** km of delivery radius */
  capacity: number
}

export interface Outlet {
  id: string
  businessId: string
  name: string
  kind: 'toko' | 'fnb'
  kecamatanId: string
  marketId: string | null
  coord: LngLat
  /** opening minutes (e.g. 420 = 07:00) */
  opensAt: Minutes
  closesAt: Minutes
}

export interface Product {
  id: string
  businessId: string
  outletId: string
  sku: string
  name: string
  category: string
  unit: string
  price: number
  cost: number
  supplierId: string | null
  /** scenario tags, e.g. 'flood' for sandbags / pumps / tarps */
  tags: string[]
}

export interface SaleItem { productId: string; qty: number; price: number }
export interface Sale {
  id: string
  code: string
  outletId: string
  businessId: string
  at: Minutes
  items: SaleItem[]
  total: number
  payment: 'tunai' | 'qris' | 'transfer'
}

/** Daily aggregate per outlet (90 days of history without 90 days of receipts). id = `${outletId}:${dayOffset}` */
export interface SalesDay {
  id: string
  outletId: string
  /** 0 = demo day, -1 = yesterday … */
  day: number
  revenue: number
  tx: number
  cost: number
}

/** id = productId */
export interface StockLevel {
  id: string
  productId: string
  outletId: string
  onHand: number
  reorderPoint: number
  /** baseline units / day */
  baseDaily: number
  /** multiplier applied by events (1 = normal, 4.4 = +340 %) */
  factor: number
  /** units sold per day, oldest → newest, last 90 days (excluding today) */
  history: number[]
  reason: Bi | null
  updatedAt: Minutes
}

export interface POItem { productId: string; qty: number; cost: number }
export interface PurchaseOrder {
  id: string
  code: string
  businessId: string
  supplierId: string
  items: POItem[]
  total: number
  status: 'draf' | 'terkirim' | 'dibalas' | 'diterima'
  at: Minutes
  reply: { at: Minutes; message: Bi; eta: Minutes | null } | null
}

export interface Supplier {
  id: string
  name: string
  /** city / kecamatan where it ships from (real place name) */
  city: string
  phone: string
  categories: string[]
  leadDays: number
  /** 0..1 on-time ratio */
  reliability: number
}

export interface LedgerLine { account: string; debit: number; credit: number }
export interface LedgerEntry {
  id: string
  businessId: string
  at: Minutes
  memo: Bi
  lines: LedgerLine[]
  source: 'sale' | 'purchase' | 'bank' | 'manual' | 'nota'
  refId: string | null
  needsReview: boolean
  confidence: number
}

export interface TaxItem {
  id: string
  businessId: string
  kind: 'pph-final-umkm' | 'pph21' | 'pbb' | 'pajak-reklame'
  /** YYYY-MM */
  period: string
  dueAt: Minutes
  /** Rp, null = not computed yet (Pajak Beres computes with rules.ts) */
  amount: number | null
  status: 'perlu-hitung' | 'siap' | 'dibayar' | 'dilaporkan'
}

export interface Call {
  id: string
  agentId: string
  industry: 'multifinance' | 'asuransi' | 'toko-bangunan'
  channel: 'telepon' | 'wa'
  customer: string
  at: Minutes
  durationSec: number
  /** 0..100, null = not scored yet */
  score: number | null
  criteria: Record<'salam' | 'gali' | 'keberatan' | 'penawaran' | 'closing' | 'kepatuhan', number> | null
  flags: string[]
  /** PO / chat this came from (consume po.sent) */
  refId?: string
}

export interface Chat {
  id: string
  channel: 'wa' | 'web' | 'telepon'
  product: ProductSlug
  withName: string
  preview: Bi
  at: Minutes
  unread: number
  refId?: string
}

export interface SalesAgent {
  id: string
  name: string
  team: string
  industry: Call['industry']
  baseline: number
  radar: Record<'salam' | 'gali' | 'keberatan' | 'penawaran' | 'closing' | 'kepatuhan', number>
}

export interface Coaching {
  id: string
  agentId: string
  focus: Bi[]
  callId: string | null
  at: Minutes
  status: 'baru' | 'latihan' | 'selesai'
}

export interface Candidate {
  id: string
  name: string
  role: string
  years: number
  education: 'SMA/SMK' | 'D3' | 'S1' | 'S2'
  skills: string[]
  kecamatanId: string
  /** 0..100 fit score, null = not screened */
  score: number | null
  status: 'baru' | 'shortlist' | 'ditolak' | 'wawancara'
}

export interface BrandMention {
  id: string
  at: Minutes
  /** business id or a fictional competitor brand */
  brand: string
  channel: 'marketplace' | 'instagram' | 'x' | 'tiktok' | 'ulasan-peta'
  author: string
  text: Bi
  sentiment: Sentiment
  topic: 'pengiriman' | 'kualitas' | 'harga' | 'layanan' | 'stok'
  rating: number | null
  reply: Bi | null
}

export interface Tender {
  id: string
  code: string
  title: Bi
  opdId: string
  kbli: string
  value: number
  kecamatanId: string
  publishedAt: Minutes
  deadlineAt: Minutes
  status: 'dibuka' | 'evaluasi' | 'selesai'
  emergency: boolean
  competitors: number
  /** businesses this tender was matched to → probability (0..1) */
  matches: Record<string, number>
  needId?: string | null
}

export interface Bid {
  id: string
  tenderId: string
  businessId: string
  price: number
  at: Minutes
  status: 'draf' | 'terkirim' | 'menang' | 'kalah'
}

/* ================================================================== Pasar Daerah */

export interface NeedItem { name: Bi; category: string; qty: number; unit: string }
export interface CatalogNeed {
  id: string
  code: string
  at: Minutes
  title: Bi
  items: NeedItem[]
  kecamatanId: string
  deadlineDays: number
  emergency: boolean
  status: 'baru' | 'dicocokkan' | 'dipesan' | 'selesai'
  cause: EntityRef | null
}

export interface Match {
  id: string
  needId: string
  businessId: string
  /** 0..1 */
  score: number
  at: Minutes
  status: 'kandidat' | 'dipilih'
}

export interface Order {
  id: string
  code: string
  needId: string | null
  businessId: string
  items: { name: Bi; qty: number; unit: string; price: number }[]
  total: number
  status: 'dipesan' | 'dikonfirmasi' | 'dikirim' | 'dibayar'
  at: Minutes
}

export type ScoreFactor = 'omzet' | 'margin' | 'pajak' | 'supplier' | 'kyb' | 'pertumbuhan'
/** id = businessId */
export interface BizScore {
  id: string
  businessId: string
  /** 0..1000 */
  score: number
  /** each 0..1 */
  factors: Record<ScoreFactor, number>
  /** monthly scores, oldest → newest (12) */
  history: number[]
  updatedAt: Minutes
}

export interface LoanApp {
  id: string
  businessId: string
  /** fictional bank / cooperative */
  lender: string
  amount: number
  tenorMonths: number
  score: number
  status: 'diajukan' | 'disetujui' | 'ditolak'
  at: Minutes
  decidedAt: Minutes | null
}

/** id = `${kecamatanId}:${month}` */
export interface EconIndex {
  id: string
  kecamatanId: string
  /** YYYY-MM */
  month: string
  /** 100 = 12-month regional average */
  index: number
  /** simulated UMKM turnover, Rp */
  omzet: number
  /** number of businesses in the aggregate (< 10 ⇒ hidden for anonymity) */
  businesses: number
  topSector: string
}

/** id = `${marketId}:${commodityId}` — one row per real market × commodity, with history. */
export interface PricePoint {
  id: string
  marketId: string
  commodityId: string
  /** Rp per unit, today */
  price: number
  /** 60 daily closes, oldest → newest (excluding today) */
  history: number[]
  updatedAt: Minutes
  anomaly: boolean
}

export interface Market {
  id: string
  name: string
  coord: LngLat
  kecamatanId: string | null
}

export interface MarketOperation {
  id: string
  at: Minutes
  stage: 'recommended' | 'approved' | 'running' | 'done' | 'dismissed'
  commodityId: string
  marketIds: string[]
  reason: Bi
  /** expected price effect in % (negative = lowers price) */
  effectPct: number
  /** shown to this role as an instruction suggestion */
  forRole: RoleId
  cause: EntityRef | null
}

export interface AuditEntry {
  id: string
  eventId: string
  at: Minutes
  source: EventSource
  type: EventType | 'seed'
  summary: Bi
  entityRefs: EntityRef[]
  /** chain depth (0 = emitted directly, 1+ = reaction) */
  depth: number
  /** event that caused this one (reactions) */
  causeId: string | null
}

/* ================================================================== world state */

export interface RegionRef {
  id: string
  name: string
  shortName: string
  opd: { id: string; name: string; short: string }[]
  /** complaint category → OPD id */
  categoryOpd: Record<ComplaintCategory, string>
  kecamatan: { id: string; name: string; centroid: LngLat; riskFlood: number; desa: { id: string; name: string; centroid: LngLat }[] }[]
  commodities: { id: string; name: Bi; unit: string; basePrice: number }[]
  services: { id: string; name: Bi; slaDays: number; opdId: string }[]
  floodKecamatanIds: string[]
  floodRiverId: string
  shopMarketId: string
}

export interface WorldMeta {
  version: number
  /** sequential counters (event ids, codes) — deterministic per world */
  seq: Record<string, number>
  /** id of the scenario building-supplies shop */
  shopId: string
  /** competitor brand names (fictional) for Pantau Merek */
  competitors: string[]
  /** events processed since generation */
  processed: number
}

export interface WorldState {
  regionId: string
  seed: number
  /** ISO date of the demo day */
  day: string
  region: RegionRef
  meta: WorldMeta
  citizens: Table<Citizen>
  complaints: Table<Complaint>
  tickets: Table<Ticket>
  clusters: Table<ComplaintCluster>
  bookings: Table<Booking>
  briefings: Table<Briefing>
  instructions: Table<Instruction>
  letters: Table<Letter>
  meetings: Table<Meeting>
  actionItems: Table<ActionItem>
  mentions: Table<Mention>
  hoaxAlerts: Table<HoaxAlert>
  alerts: Table<Alert>
  rainCells: Table<RainCell>
  programs: Table<Program>
  procurements: Table<Procurement>
  bidders: Table<Bidder>
  documents: Table<DocumentRec>
  verifications: Table<Verification>
  businesses: Table<Business>
  outlets: Table<Outlet>
  products: Table<Product>
  sales: Table<Sale>
  salesDaily: Table<SalesDay>
  stock: Table<StockLevel>
  purchaseOrders: Table<PurchaseOrder>
  suppliers: Table<Supplier>
  ledger: Table<LedgerEntry>
  taxItems: Table<TaxItem>
  calls: Table<Call>
  chats: Table<Chat>
  agentsSales: Table<SalesAgent>
  coachings: Table<Coaching>
  candidates: Table<Candidate>
  brandMentions: Table<BrandMention>
  tenders: Table<Tender>
  bids: Table<Bid>
  catalogNeeds: Table<CatalogNeed>
  matches: Table<Match>
  orders: Table<Order>
  bizScores: Table<BizScore>
  loanApps: Table<LoanApp>
  econIndex: Table<EconIndex>
  prices: Table<PricePoint>
  markets: Table<Market>
  marketOps: Table<MarketOperation>
  auditLog: Table<AuditEntry>
}

/** keys of WorldState that are tables */
export type TableKey = {
  [K in keyof WorldState]: WorldState[K] extends { byId: Record<string, unknown>; ids: string[] } ? K : never
}[keyof WorldState]
export type EntityOf<K extends TableKey> = WorldState[K] extends Table<infer T> ? T : never

/* ================================================================== events */

/** fields assigned by the engine when missing (so callers may omit them) */
type Opt<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export interface EventMap {
  /* Sapa Warga */
  'complaint.created': {
    id?: string
    code?: string
    ticketId?: string
    citizenId?: string | null
    category: ComplaintCategory
    channel: ComplaintChannel
    text: string
    lang?: RegionalLang | 'id'
    summary?: Bi
    kecamatanId: string
    desaId: string
    coord: LngLat
    urgency?: Urgency
    templateId?: string
    photo?: boolean
  }
  'complaint.clustered': { clusterId?: string; category: ComplaintCategory; kecamatanId: string; desaId: string; center: LngLat; radiusKm: number; complaintIds: string[] }
  'ticket.statusChanged': { ticketId: string; status: TicketStatus; note?: string; rating?: number; opdId?: string }
  'service.booked': { id?: string; code?: string; serviceId: string; citizenId?: string | null; slotAt: Minutes; channel?: Booking['channel'] }
  /* Meja Pimpinan */
  'briefing.generated': { id?: string; items: Briefing['items'] }
  'instruction.issued': { id?: string; text: Bi; opdIds: string[]; dueAt?: Minutes; refs?: EntityRef[]; origin?: EntityRef }
  /* Naskah Pintar */
  'meeting.transcribed': { meetingId: string; summary?: Bi; durationMin?: number }
  'actionItem.created': { id?: string; title: Bi; opdId: string; pic?: string; dueAt: Minutes; source?: ActionItem['source'] }
  'letter.dispositioned': { letterId?: string; subject?: Bi; to: string[]; note: Bi; by?: string; instructionId?: string }
  /* Radar Isu */
  'hoax.detected': { id?: string; claim: Bi; score: number; spreadPerHour: number; accounts: string[]; evidence?: Bi | null; topic: string }
  'clarification.published': { hoaxId: string; tone: 'tegas' | 'menenangkan' | 'informatif'; channels: string[] }
  'mention.created': Opt<Mention, 'id' | 'at'>
  /* Siaga Wilayah */
  'rain.forecast': { cells: Omit<RainCell, 'id' | 'at'>[]; horizonH: number; peakMmH: number; kecamatanIds: string[] }
  'flood.alert': { id?: string; level: Alert['level']; kecamatanIds: string[]; desaIds?: string[]; riverId?: string | null; title?: Bi; expectedAt?: Minutes | null }
  'alert.broadcast': { alertId: string; channels: string[]; recipients?: number }
  'eligibility.opened': { id?: string; kind: Program['kind']; kecamatanIds: string[]; quota: number; alertId: string | null }
  /* Awas Belanja · Cek Berkas */
  'procurement.created': Opt<Omit<Procurement, 'createdAt' | 'riskScore' | 'flagged' | 'findings'>, 'id' | 'code' | 'status'>
  'procurement.flagged': { procurementId: string; riskScore: number; findings: ProcurementFinding[] }
  'document.verified': { documentId: string; status: DocumentRec['status']; notes?: Bi }
  /* Toko Autopilot */
  'sale.created': { id?: string; code?: string; outletId: string; items: SaleItem[]; payment: Sale['payment'] }
  'stock.forecastChanged': { productIds: string[]; factor: number; reason: Bi; cause?: EntityRef | null }
  'po.sent': { id?: string; code?: string; businessId: string; supplierId: string; items: POItem[] }
  'supplier.replied': { poId: string; message: Bi; eta?: Minutes | null }
  /* Pajak Beres */
  'ledger.posted': { id?: string; businessId: string; memo: Bi; lines: LedgerLine[]; source: LedgerEntry['source']; refId?: string | null; needsReview?: boolean; confidence?: number }
  'tax.ready': { businessId: string; period: string; taxItemIds?: string[] }
  /* Juara Jualan */
  'call.scored': { callId: string; score: number; criteria?: Call['criteria'] }
  'coaching.assigned': { id?: string; agentId: string; focus: Bi[]; callId?: string | null }
  /* Kenal Mitra */
  'partner.verified': { subjectKind: Verification['subjectKind']; subjectId: string; kind: Verification['kind']; result: Verification['result']; score?: number }
  /* Pantau Merek */
  'brand.alert': { businessId: string; topic: BrandMention['topic']; volume: number; deltaPct: number; cause?: Bi }
  /* TenderPilot */
  'tender.matched': { tenderId: string; businessId: string; probability: number }
  'bid.submitted': { id?: string; tenderId: string; businessId: string; price: number }
  /* Katalog Lokal */
  'need.created': { id?: string; code?: string; title: Bi; items: NeedItem[]; kecamatanId: string; deadlineDays: number; emergency?: boolean; cause?: EntityRef | null }
  'match.made': { id?: string; needId: string; businessId: string; score: number }
  'order.created': { id?: string; code?: string; needId?: string | null; businessId: string; items: Order['items'] }
  /* Rapor Usaha */
  'score.updated': { businessId: string; score: number; delta: number; reason: Bi; factors?: Record<ScoreFactor, number> }
  'loan.applied': { id?: string; businessId: string; lender: string; amount: number; tenorMonths: number }
  'loan.approved': { loanId: string }
  /* Indeks Ekonomi · Sinyal Pasar */
  'econ.updated': { kecamatanId: string; month: string; index: number; delta: number; reason: Bi }
  'price.updated': { marketId: string; commodityId: string; price: number }
  'price.anomaly': { marketId: string; commodityId: string; price: number; expected: number; deltaPct: number }
  'market.operation': { id?: string; stage: MarketOperation['stage']; commodityId: string; marketIds: string[]; reason?: Bi; effectPct?: number; forRole?: RoleId; cause?: EntityRef | null }
}

export type EventType = keyof EventMap

export interface WorldEvent<K extends EventType = EventType> {
  /** sequential per world: E000001 … */
  id: string
  type: K
  /** world minutes since 00:00 */
  at: Minutes
  source: EventSource
  payload: EventMap[K]
  /** 0 = emitted directly; n = n-th reaction level */
  depth?: number
  causeId?: string | null
}

/** distributive union — `e.type` narrows `e.payload` */
export type AnyWorldEvent = { [K in EventType]: WorldEvent<K> }[EventType]

export interface FollowUp<K extends EventType = EventType> {
  type: K
  payload: EventMap[K]
  source: EventSource
}
export type AnyFollowUp = { [K in EventType]: FollowUp<K> }[EventType]
