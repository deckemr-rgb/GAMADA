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
  /** last "Kirim pengingat" (Naskah Pintar) */
  remindedAt?: Minutes | null
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
  /** scenario key of a false narrative (e.g. 'waduk-jebol'); the hoax-burst reaction counts these */
  rumor?: string
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
  /** scenario key of the narrative (Mention.rumor) when it came from a burst */
  rumor?: string
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
  broadcast: { at: Minutes; recipients: number; channels: string[]; desaIds?: string[] } | null
  /** citizen complaints (Sapa Warga) that confirm this alert on the ground ("Terkonfirmasi warga") */
  confirmedBy?: string[]
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

/** A message on a citizen's phone (Sapa Warga "HP Warga"): early warnings, ticket updates, queue tickets. */
export interface CitizenMessage {
  id: string
  at: Minutes
  kind: 'peringatan' | 'tiket' | 'antrean' | 'info'
  /** recipients (citizen ids) — one row per broadcast, not per person */
  to: string[]
  text: Bi
  refs: EntityRef[]
  /** channel label shown on the phone */
  channel: 'wa' | 'sms'
}

/** Important places: real ones from the pack (rs, puskesmas, sekolah, kantor, bendungan) + SIMULATED shelters. */
export interface Facility {
  id: string
  name: string
  kind: 'rs' | 'puskesmas' | 'sekolah' | 'kantor' | 'bendungan' | 'pengungsian' | 'mpp' | 'pasar' | 'pelabuhan'
  coord: LngLat
  kecamatanId: string | null
  desaId: string | null
  /** people (shelters) / beds (hospitals); simulated */
  capacity: number
  /** currently used (shelters fill after a flood alert); simulated */
  occupied: number
  /** 'pack' = real place from the region pack (name/location real); 'simulasi' = generated for the demo */
  origin: 'pack' | 'simulasi'
}

/** Simulated harvest estimate per kecamatan × crop (Siaga Wilayah "Pertanian"). id = `${kecamatanId}:${crop}` */
export interface Harvest {
  id: string
  kecamatanId: string
  crop: 'padi' | 'jagung' | 'cabai' | 'bawang-merah'
  /** commodity id in region.commodities this crop feeds (null when none) */
  commodityId: string | null
  areaHa: number
  /** normal-season estimate (ton) */
  baselineTon: number
  /** current estimate (ton) */
  estimateTon: number
  /** 0..1 simulated vegetation health index (now) */
  ndvi: number
  /** 0..1 simulated vegetation health index of a normal season */
  ndviBase: number
  scenario: 'normal' | 'pasca-banjir'
  updatedAt: Minutes
}

/** Supply signal for Sinyal Pasar (e.g. post-flood harvest drop → rice / chilli supply down). */
export interface SupplySignal {
  id: string
  at: Minutes
  commodityId: string
  kecamatanIds: string[]
  direction: 'turun' | 'naik'
  /** expected supply change in % (negative = less supply) */
  pct: number
  horizonDays: number
  reason: Bi
  cause: EntityRef | null
}

/** Simulated water gauge (dam / river) — evidence for Radar Isu, context for Siaga Wilayah. */
export interface WaterGauge {
  id: string
  /** real place name (dam / river from the pack); the readings are SIMULATED */
  name: string
  kind: 'waduk' | 'sungai'
  coord: LngLat
  kecamatanId: string | null
  /** metres (simulated) */
  level: number
  normal: number
  siaga: number
  awas: number
  /** hourly readings, oldest → newest, last 24 h (simulated) */
  history: number[]
  updatedAt: Minutes
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
  /** submitted prices (fictional) — 'harga-seragam' detector input */
  bids?: { bidderId: string; price: number; at: Minutes }[]
  /** winner of a finished package (history for the 'pemenang-berulang' detector) */
  winnerId?: string | null
  /** schedule: announcement → bid deadline in days ('jadwal-singkat' detector) */
  scheduleDays?: number
  /** technical spec text (may lock a brand — 'spesifikasi-merek' detector) */
  spec?: Bi
  /** Awas Belanja "Rekomendasikan" */
  recommendation?: { at: Minutes; hpsCorrected: number; note: Bi; inviteLocal: boolean } | null
}

export interface Bidder {
  id: string
  /** fictional company */
  name: string
  legal: 'PT' | 'CV' | 'UD'
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

export type DocKind = 'ktp' | 'kk' | 'nib' | 'domisili' | 'foto-rumah' | 'npwp' | 'akta' | 'cv' | 'lokasi'
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
  /** the docs-kit specimen that renders this document ('ktp-joko', 'nib-<businessId>' …) */
  sampleId?: string
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
  /** legal form (Usaha Pintar): the scenario shop is an individual ('perorangan', non-PKP) */
  legal?: 'perorangan' | 'UD' | 'CV' | 'PT'
  /** periods closed by the tax consultant (Pajak Beres "Kunci periode") */
  lockedPeriods?: string[]
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
  /** Σ items − discount */
  total: number
  /** the method with the largest share */
  payment: PayMethod
  /** Rp off the receipt (Kasir) */
  discount?: number
  /** split payment (Σ amount = total); missing = one payment of `payment` */
  payments?: { method: PayMethod; amount: number }[]
  /** cashier (staff id) */
  staffId?: string
  cash?: { given: number; change: number }
}
export type PayMethod = 'tunai' | 'qris' | 'transfer'

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
  /** `tpl` = index of the kit's supplier reply pool (rotates: no text repeats within 20 POs) */
  reply: { at: Minutes; message: Bi; eta: Minutes | null; tpl?: number } | null
  /** why the PO was drafted (po.drafted) */
  reason?: Bi
  cause?: EntityRef | null
  /** when the goods arrived (po.received) */
  receivedAt?: Minutes
  /** when its supplier invoice reached Pajak Beres (nota.received, once per PO) */
  notaAt?: Minutes
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

export type Industry = 'multifinance' | 'asuransi' | 'toko-bangunan'
export type CriterionKey = 'salam' | 'gali' | 'keberatan' | 'penawaran' | 'closing' | 'kepatuhan'
export type Criteria = Record<CriterionKey, number>
/** key of a call transcript clip (Juara Jualan owns the clip texts; the kit owns the key list CALL_CLIPS) */
export type ClipKey = string
export interface Call {
  id: string
  agentId: string
  industry: Industry
  channel: 'telepon' | 'wa'
  customer: string
  at: Minutes
  durationSec: number
  /** 0..100 = callScore(criteria), null = not scored yet */
  score: number | null
  criteria: Criteria | null
  flags: string[]
  /** PO / chat this came from (consume po.sent) */
  refId?: string
  /** transcript clip (CALL_CLIPS key) */
  transcript: ClipKey
  topic?: 'banjir' | null
  scoredBy?: 'ai' | 'supervisor'
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
  industry: Industry
  baseline: number
  radar: Criteria
  role: 'sales' | 'kasir'
  joinedDays: number
  /** fictional organisation ("Arta Kencana Finance · Cabang …") or the shop's name */
  org: string
  /** the shop for the toko-bangunan team, else null */
  businessId: string | null
  /** staff row of a shop employee, else null */
  staffId: string | null
}

export interface Coaching {
  id: string
  agentId: string
  focus: Bi[]
  callId: string | null
  at: Minutes
  status: 'baru' | 'latihan' | 'selesai'
  /** one example sentence per focus */
  examples: Bi[]
  /** agent avg14 when assigned (roleplay baseline) */
  baseline: number
  focusKeys: CriterionKey[]
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

export type BrandTopic = 'pengiriman' | 'kualitas' | 'harga' | 'layanan' | 'stok'
export interface BrandMention {
  id: string
  /** may lie in the future (a scheduled burst post): selectors only show `at ≤ now` */
  at: Minutes
  /** business id, a fictional competitor brand (s.meta.competitors) or 'kategori' (the category in general) */
  brand: string
  /** keys only; the UI labels them generically (Marketplace, Medsos foto, Medsos singkat, Video pendek, Ulasan peta) */
  channel: 'marketplace' | 'instagram' | 'x' | 'tiktok' | 'ulasan-peta'
  author: string
  text: Bi
  sentiment: Sentiment
  topic: BrandTopic
  rating: number | null
  reply: Bi | null
  outletId?: string
  item?: string
  orderCode?: string
  kecamatanId?: string
  desaId?: string
  daysLate?: number
  /** scenario cause (e.g. 'alerts:PW-0002') */
  cause?: EntityRef
  /** a follow-up post answers this mention */
  inReplyTo?: string
  repliedAt?: Minutes
  replyTone?: 'empatik' | 'formal' | 'santai'
  repliedBy?: RoleId
  /** language of the post (EN reviews get EN replies) */
  lang?: 'id' | 'en'
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
  /** businesses this tender was matched to → probability (0..1) = winScore() */
  matches: Record<string, number>
  needId?: string | null
  method: 'tender' | 'tender-cepat' | 'pengadaan-langsung' | 'e-katalog' | 'darurat'
  requirements: ReqKey[]
  items?: TenderItem[]
  /** Σ qty × hpsPrice (item tenders); = value */
  hps?: number
  /** the Awas Belanja package this tender mirrors or created */
  procurementId?: string | null
  /** stable scenario key (idempotent reactions) */
  key?: string
  /** set when Awas Belanja flagged the mirrored package (riskScore ≥ 60) */
  risk?: { score: number; at: Minutes } | null
  spec?: Bi
}
export type ReqKey = 'nib-kbli' | 'akta' | 'npwp' | 'kyb' | 'pajak' | 'pengalaman' | 'kapasitas' | 'pakta'
export interface TenderItem { name: Bi; category: string; qty: number; unit: string; hpsPrice: number }

export interface Bid {
  id: string
  tenderId: string
  businessId: string
  price: number
  at: Minutes
  status: 'draf' | 'terkirim' | 'menang' | 'kalah' | 'evaluasi'
  pages?: number
  /** section ids of the composed bid document */
  docSections?: string[]
  /** the tender's HPS when bid (history: bid / HPS) */
  hps?: number
}

/* ------------------------------------------------------------------ Usaha Pintar · tahap 3 tables */

export type StaffJob = 'kepala-toko' | 'admin' | 'kasir' | 'gudang' | 'sopir' | 'barista' | 'pramusaji' | 'juru-masak'
export type Ptkp = 'TK/0' | 'TK/1' | 'K/0' | 'K/1' | 'K/2' | 'K/3'
/** shop employee (Toko Autopilot shifts, Pajak Beres payroll, Juara Jualan tb team). Wages are SIMULATED. */
export interface Staff {
  id: string
  businessId: string
  outletId: string
  name: string
  gender: 'L' | 'P'
  job: StaffJob
  ptkp: Ptkp
  /** Rp / month, simulasi */
  gross: number
  joinedDays: number
  isNew: boolean
  /** Juara Jualan agent id (toko sales team), else null */
  agentId: string | null
}
/** one block of the week plan: day 0..6 = Monday..Sunday of the demo week; start/end = minutes of that day */
export interface Shift { id: string; staffId: string; outletId: string; day: number; start: Minutes; end: Minutes; origin: 'auto' | 'manual' }
export interface Promo { id: string; businessId: string; title: Bi; productIds: string[]; discountPct: number; until: Minutes; at: Minutes }
export interface CashShift { id: string; staffId: string; outletId: string; expectedCash: number; countedCash: number; variance: number; tx: number; at: Minutes }
/** banner on the Kasir screen (id = the announcement id) */
export interface PosNotice { id: string; outletIds: string[]; text: Bi; at: Minutes }
export interface BankImport { id: string; businessId: string; period: string; rows: number; matched: number; posted: number; review: number; bank: string; at: Minutes }
export type RoleplayPersona = 'ragu-harga' | 'buru-buru' | 'banyak-tanya'
export interface Roleplay {
  id: string
  agentId: string
  coachingId: string | null
  persona: RoleplayPersona
  industry: Industry
  turns: number
  score: number
  baseline: number
  criteria: Criteria
  at: Minutes
}
export interface VerificationRequest {
  id: string
  /** KM-0xx */
  code: string
  kind: 'kyc' | 'kyb' | 'cv'
  /** KYC: the KTP document; KYB: the business; CV: the opening ('candidate', subjectId 'cv-batch') */
  subjectKind: Verification['subjectKind']
  subjectId: string
  /** who asked (a lender or the shop) */
  requestedBy: string
  needId: string | null
  priority: boolean
  at: Minutes
  status: 'antri' | 'diproses' | 'selesai'
  verificationId: string | null
}
export interface BrandAlert {
  id: string
  businessId: string
  topic: BrandTopic
  volume: number
  deltaPct: number
  /** detection time (= the 5th burst mention); may lie in the future when stored: selectors filter at ≤ now */
  at: Minutes
  mentionIds: string[]
  causeRef: EntityRef | null
  baselinePer2h: number
  cause: Bi | null
  status: 'aktif' | 'ditangani'
}
export type AnnounceChannel = 'marketplace' | 'sosmed' | 'ulasan-peta' | 'wa-status' | 'struk'
export interface BrandAnnouncement {
  id: string
  businessId: string
  alertId: string
  topic: BrandTopic
  text: Bi
  channels: AnnounceChannel[]
  offer: 'gratis-ongkir' | 'ambil-sendiri' | 'jadwal-ulang' | null
  by: RoleId
  at: Minutes
}

/** Usaha Pintar facts (written once by extendUsahaPintar) */
export interface UpFacts {
  /** omzet (Rp, simulasi) of each month's days BEFORE the 90-day daily history: 'YYYY-MM' → Rp */
  omzetPre: Record<string, number>
  /** the 5 toko staff (PPh 21 "5 karyawan") */
  payrollStaffIds: string[]
  /** the new cashier: ONE person (staff row + Juara Jualan agent) */
  newCashierStaffId: string
  newCashierAgentId: string
  /** lowest scored call today with flag keberatan-tidak-dijawab, per industry */
  lowCall: Record<Industry, string>
  kenalMitra: {
    heroBusinessId: string
    heroRequestId: string
    mismatchBusinessId: string
    kycCleanDocId: string
    kycEditedDocId: string
    cvOpening: Bi
    cvCount: number
    shortlistSize: number
  }
  brand: { baselinePer2h: number; preSignalIds: string[]; reputationAt0700: number }
  /** the shop's Bidder mirror (Awas Belanja lists its bid) */
  shopBidderId: string
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
  /** source 'clock' (natural background events): the product whose domain the event belongs to */
  origin?: ProductSlug
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
  /** Sapa Warga personas → citizen ids (fictional characters of the script) */
  personas: { siti: string; raka: string; darmo: string }
  /** seeded facts the demos and tests can rely on (spec "cek lulus") */
  facts: SeedFacts
  /** ecosystem extensions applied to this world: id → extension version (world/eco.ts) */
  ext?: Record<string, number>
}

/** Known numbers of the seeded world (Cek Berkas duplicate count, hoax scenario …). */
export interface SeedFacts {
  /** bansos-banjir applicant documents (KTP) */
  bansosApplicants: number
  /** pairs of applicants sharing one NIK */
  bansosDuplicatePairs: number
  /** applicants whose address lies outside the flood kecamatan of the scenario */
  bansosOutsideZone: number
  /** the specimen document that was digitally edited (tamper demo) */
  tamperedDocumentId: string
  /** the false narrative Radar Isu detects (rumor key, dam landmark name, gauge with the evidence) */
  hoax: { rumor: string; damName: string; gaugeId: string }
  /** bidders of the affiliated ring that bids on the emergency pump package */
  pumpRingBidderIds: string[]
  /** Usaha Pintar facts (present once the ecosystem extension ran) */
  up?: UpFacts
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
  messages: Table<CitizenMessage>
  facilities: Table<Facility>
  harvests: Table<Harvest>
  supplySignals: Table<SupplySignal>
  gauges: Table<WaterGauge>
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
  staff: Table<Staff>
  shifts: Table<Shift>
  promos: Table<Promo>
  cashShifts: Table<CashShift>
  posNotices: Table<PosNotice>
  bankImports: Table<BankImport>
  roleplays: Table<Roleplay>
  verificationRequests: Table<VerificationRequest>
  brandAlerts: Table<BrandAlert>
  brandAnnouncements: Table<BrandAnnouncement>
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
  /** a message reaches citizens' phones (alerts, ticket updates, queue tickets) */
  'citizen.notified': { id?: string; to: string[]; kind: CitizenMessage['kind']; text: Bi; refs?: EntityRef[]; channel?: CitizenMessage['channel'] }
  'service.booked': { id?: string; code?: string; serviceId: string; citizenId?: string | null; slotAt: Minutes; channel?: Booking['channel'] }
  /* Meja Pimpinan */
  'briefing.generated': { id?: string; items: Briefing['items'] }
  'instruction.issued': { id?: string; text: Bi; opdIds: string[]; dueAt?: Minutes; refs?: EntityRef[]; origin?: EntityRef }
  /* Naskah Pintar */
  'meeting.transcribed': { meetingId: string; summary?: Bi; durationMin?: number }
  'actionItem.created': { id?: string; title: Bi; opdId: string; pic?: string; dueAt: Minutes; source?: ActionItem['source'] }
  'actionItem.statusChanged': { actionItemId: string; status: ActionItem['status'] }
  /** "Kirim pengingat" to the person in charge (preview of a WA message) */
  'actionItem.reminded': { actionItemId: string; channel: 'wa'; text?: Bi }
  /** number / from / subject (optional): the identity the inbox shows for this letter (e.g. its scanned sample), so
   *  the audit log and other products name the same letter */
  /** a new incoming letter during the day (e.g. a scheduled reply arriving at 11.30): it lands in the inbox as 'masuk' */
  'letter.received': { id?: string; number: string; from: string; subject: Bi; kind: LetterKind; sifat?: Letter['sifat']; receivedAt?: Minutes; dueAt?: Minutes | null; scanned?: boolean }
  'letter.dispositioned': { letterId?: string; subject?: Bi; number?: string; from?: string; to: string[]; note: Bi; by?: string; instructionId?: string }
  /* Radar Isu */
  'hoax.detected': { id?: string; claim: Bi; score: number; spreadPerHour: number; accounts: string[]; evidence?: Bi | null; topic: string; rumor?: string }
  'clarification.published': { hoaxId: string; tone: 'tegas' | 'menenangkan' | 'informatif'; channels: string[] }
  'mention.created': Opt<Mention, 'id' | 'at'>
  /* Siaga Wilayah */
  'rain.forecast': { cells: Omit<RainCell, 'id' | 'at'>[]; horizonH: number; peakMmH: number; kecamatanIds: string[] }
  'flood.alert': { id?: string; level: Alert['level']; kecamatanIds: string[]; desaIds?: string[]; riverId?: string | null; title?: Bi; expectedAt?: Minutes | null }
  'alert.broadcast': { alertId: string; channels: string[]; recipients?: number; desaIds?: string[]; message?: Bi }
  /** citizen flood complaints confirm a prediction / alert on the ground (Siaga Wilayah "Terkonfirmasi warga") */
  'flood.confirmed': { alertId: string | null; clusterId: string; kecamatanId: string; complaintIds: string[] }
  /** Dinas Pertanian scenario switch: harvest estimates for the given kecamatan */
  'harvest.updated': {
    scenario: Harvest['scenario']; kecamatanIds: string[]; dropPct?: number
    /** per-kecamatan drop (%), e.g. scaled by flooded share; a kecamatan missing here uses dropPct (else the default) */
    dropPctByKecamatan?: Record<string, number>
    cause?: EntityRef | null
  }
  'eligibility.opened': { id?: string; kind: Program['kind']; kecamatanIds: string[]; quota: number; alertId: string | null }
  /* Awas Belanja · Cek Berkas */
  'procurement.created': Opt<Omit<Procurement, 'createdAt' | 'riskScore' | 'flagged' | 'findings'>, 'id' | 'code' | 'status'>
  'procurement.flagged': { procurementId: string; riskScore: number; findings: ProcurementFinding[] }
  /** Awas Belanja "Rekomendasikan": corrected HPS (+ optionally invite local UMKM through Katalog Lokal) */
  'procurement.recommended': { procurementId: string; hpsCorrected: number; note: Bi; inviteLocal: boolean }
  'document.verified': { documentId: string; status: DocumentRec['status']; notes?: Bi }
  /* Toko Autopilot */
  'sale.created': {
    id?: string; code?: string; outletId: string; items: SaleItem[]; payment: PayMethod
    discount?: number; payments?: { method: PayMethod; amount: number }[]; staffId?: string; cash?: { given: number; change: number }
  }
  'stock.forecastChanged': { productIds: string[]; factor: number; reason: Bi; cause?: EntityRef | null }
  'po.drafted': { id?: string; code?: string; businessId: string; supplierId: string; items: POItem[]; reason: Bi; cause?: EntityRef | null }
  'po.sent': { id?: string; code?: string; businessId: string; supplierId: string; items: POItem[] }
  'supplier.replied': { poId: string; supplierId?: string; message: Bi; eta?: Minutes | null; tpl?: number }
  'po.received': { poId: string }
  'price.changed': { productId: string; price: number; prev: number; reason: Bi; suggestionId?: string }
  'promo.created': { id?: string; title: Bi; productIds: string[]; discountPct: number; until: Minutes }
  'shift.updated': { shiftId?: string; staffId: string; outletId: string; day: number; start: Minutes; end: Minutes }
  'shift.closed': { id?: string; staffId: string; outletId: string; expectedCash: number; countedCash: number; variance: number; tx: number }
  'pos.noticeSet': { announcementId: string; outletIds: string[]; text: Bi }
  /* Pajak Beres */
  'nota.received': { businessId: string; poId: string; supplierId: string; total: number }
  'ledger.posted': { id?: string; businessId: string; memo: Bi; lines: LedgerLine[]; source: LedgerEntry['source']; refId?: string | null; needsReview?: boolean; confidence?: number }
  'ledger.reviewed': { ledgerId: string; lines?: LedgerLine[]; note?: Bi }
  'bank.imported': { id?: string; businessId: string; period: string; rows: number; matched: number; posted: number; review: number; bank: string }
  'tax.computed': { taxItemId: string; kind: 'pph-final' | 'pph21'; amount: number; basis: Bi; rulesRef: string }
  'tax.ready': { businessId: string; period: string; taxItemIds?: string[] }
  'period.locked': { businessId: string; period: string }
  /* Juara Jualan */
  'call.created': { id?: string; agentId: string; industry: Industry; channel: 'telepon' | 'wa'; customer: string; transcript: ClipKey; durationSec: number; refId?: string; topic?: 'banjir' | null }
  'call.scored': { callId: string; score: number; criteria?: Criteria | null; flags?: string[]; by?: 'ai' | 'supervisor' }
  'coaching.assigned': { id?: string; agentId: string; focus: Bi[]; callId?: string | null; examples?: Bi[]; focusKeys?: CriterionKey[]; baseline?: number }
  'roleplay.completed': { id?: string; agentId: string; coachingId: string | null; persona: RoleplayPersona; industry: Industry; turns: number; score: number; baseline: number; criteria: Criteria }
  /* Kenal Mitra */
  'verification.requested': { id?: string; code?: string; kind: VerificationRequest['kind']; subjectKind: Verification['subjectKind']; subjectId: string; requestedBy: string; needId?: string | null; priority?: boolean }
  'partner.verified': { subjectKind: Verification['subjectKind']; subjectId: string; kind: Verification['kind']; result: Verification['result']; score?: number }
  /* Pantau Merek */
  'brand.mentioned': Opt<BrandMention, 'id' | 'at'>
  'brand.alert': {
    id?: string; businessId: string; topic: BrandTopic; volume: number; deltaPct: number; cause?: Bi
    at?: Minutes; mentionIds?: string[]; causeRef?: EntityRef | null; baselinePer2h?: number
  }
  'brand.replied': { mentionIds: string[]; tone: 'empatik' | 'formal' | 'santai'; replies: Bi[]; by: RoleId; alertId?: string }
  'brand.announced': { id?: string; businessId: string; alertId: string; topic: BrandTopic; text: Bi; channels: AnnounceChannel[]; offer: BrandAnnouncement['offer']; by: RoleId }
  /* TenderPilot */
  'tender.created': Opt<Omit<Tender, 'matches'>, 'id' | 'code' | 'status'> & { key?: string }
  'tender.matched': { tenderId: string; businessId: string; probability: number }
  'bid.submitted': { id?: string; tenderId: string; businessId: string; price: number; pages?: number; docSections?: string[] }
  'procurement.bidReceived': { procurementId: string; bidderId: string; businessId: string; price: number; bidId: string }
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
  'supply.signal': { id?: string; commodityId: string; kecamatanIds: string[]; direction: SupplySignal['direction']; pct: number; horizonDays: number; reason: Bi; cause?: EntityRef | null }
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
  /**
   * Natural background events (natural.ts) carry source 'clock' — nobody pressed anything — and name here the
   * product whose domain they belong to (sale → toko-autopilot, complaint → sapa-warga …). Audit/labels only.
   */
  origin?: ProductSlug
}

/** distributive union — `e.type` narrows `e.payload` */
export type AnyWorldEvent = { [K in EventType]: WorldEvent<K> }[EventType]

export interface FollowUp<K extends EventType = EventType> {
  type: K
  payload: EventMap[K]
  source: EventSource
  /** see WorldEvent.origin */
  origin?: ProductSlug
}
export type AnyFollowUp = { [K in EventType]: FollowUp<K> }[EventType]
