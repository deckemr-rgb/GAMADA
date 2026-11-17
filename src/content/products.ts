/**
 * products.ts — registry of the GAMADA ecosystem: GAMADA Inti + 3 ecosystems + 17 products.
 * SOURCE OF TRUTH for names, slugs, accents, roles and relations (spec §3). Home stats, navbar,
 * /ekosistem, /produk, /lab, the tour and every demo read from here — never retype a name.
 */
import { PRODUCT_SLUGS, type ProductSlug } from './productSlugs'

export type Bi = { id: string; en: string }

export type EcoId = 'satu-daerah' | 'usaha-pintar' | 'pasar-daerah'
/** 'inti' is the foundation; it is addressed like an ecosystem in /ekosistem/inti. */
export type EcoOrInti = EcoId | 'inti'

/** Slugs live in productSlugs.ts (tiny, eager-safe); re-exported here so callers keep one import. */
export type { ProductSlug } from './productSlugs'
export { PRODUCT_SLUGS, isProductSlug } from './productSlugs'

/**
 * Global roles (spec §6.5, split per the per-product lists in spec §11: UKPBJ and Inspektorat, Loket Perizinan and
 * Dinsos are separate roles; Kepala OPD and Dinas Koperasi & UMKM come from §11 P2/P3 and P16). One account, many
 * roles = Inti ID. Mirrored by ROLE_IDS in server/ai-proxy/src/products.ts (its selftest checks drift).
 */
export type RoleId =
  | 'warga'
  | 'petugas'
  | 'kepala-daerah'
  | 'sekretariat'
  | 'humas'
  | 'bpbd'
  | 'pertanian'
  | 'ukpbj'
  | 'inspektorat'
  | 'perizinan'
  | 'dinsos'
  | 'kepala-opd'
  | 'dinkop'
  | 'pemilik-toko'
  | 'kasir'
  | 'konsultan-pajak'
  | 'supervisor-sales'
  | 'agen-sales'
  | 'analis-kyc'
  | 'brand-manager'
  | 'vendor'
  | 'bank-mitra'
  | 'bappeda'
  | 'disperindag'
  | 'supplier'

export const ROLES: Record<RoleId, { name: Bi; initials: string }> = {
  warga: { name: { id: 'Warga', en: 'Citizen' }, initials: 'WG' },
  petugas: { name: { id: 'Petugas Layanan', en: 'Service Officer' }, initials: 'PL' },
  'kepala-daerah': { name: { id: 'Kepala Daerah', en: 'Regional Head' }, initials: 'KD' },
  sekretariat: { name: { id: 'Sekretariat/ASN', en: 'Secretariat / Civil Servant' }, initials: 'SA' },
  humas: { name: { id: 'Humas/Diskominfo', en: 'Public Relations / Comms Office' }, initials: 'HM' },
  bpbd: { name: { id: 'BPBD', en: 'Disaster Management Agency' }, initials: 'BP' },
  pertanian: { name: { id: 'Dinas Pertanian', en: 'Agriculture Office' }, initials: 'DP' },
  ukpbj: { name: { id: 'UKPBJ', en: 'Procurement Unit (UKPBJ)' }, initials: 'UK' },
  inspektorat: { name: { id: 'Inspektorat', en: 'Inspectorate' }, initials: 'IN' },
  perizinan: { name: { id: 'Loket Perizinan', en: 'Licensing Desk' }, initials: 'LP' },
  dinsos: { name: { id: 'Dinsos', en: 'Social Affairs Office' }, initials: 'DS' },
  'kepala-opd': { name: { id: 'Kepala OPD', en: 'Head of Regional Agency' }, initials: 'KO' },
  dinkop: { name: { id: 'Dinas Koperasi & UMKM', en: 'Cooperatives & SME Office' }, initials: 'DK' },
  'pemilik-toko': { name: { id: 'Pemilik Toko', en: 'Shop Owner' }, initials: 'PT' },
  kasir: { name: { id: 'Kasir', en: 'Cashier' }, initials: 'KS' },
  'konsultan-pajak': { name: { id: 'Konsultan Pajak', en: 'Tax Consultant' }, initials: 'KP' },
  'supervisor-sales': { name: { id: 'Supervisor Sales', en: 'Sales Supervisor' }, initials: 'SS' },
  'agen-sales': { name: { id: 'Agen Sales', en: 'Sales Agent' }, initials: 'AS' },
  'analis-kyc': { name: { id: 'Analis KYC/HR', en: 'KYC / HR Analyst' }, initials: 'AK' },
  'brand-manager': { name: { id: 'Brand Manager', en: 'Brand Manager' }, initials: 'BM' },
  vendor: { name: { id: 'Vendor', en: 'Vendor' }, initials: 'VD' },
  'bank-mitra': { name: { id: 'Bank/Koperasi Mitra', en: 'Partner Bank / Cooperative' }, initials: 'BK' },
  bappeda: { name: { id: 'Bappeda', en: 'Regional Planning Agency' }, initials: 'BA' },
  disperindag: { name: { id: 'Disperindag', en: 'Trade & Industry Office' }, initials: 'DI' },
  supplier: { name: { id: 'Supplier', en: 'Supplier' }, initials: 'SP' },
}

export type FrameKind = 'browser' | 'phone' | 'tablet' | 'wall' | 'paper' | 'split'

export interface EcoDef {
  id: EcoOrInti
  name: string
  /** short audience line */
  audience: Bi
  tagline: Bi
  /** CSS custom property names (from src/styles/tokens.css) */
  accent: string
  accent2: string
}

export const ECOSYSTEMS: Record<EcoOrInti, EcoDef> = {
  inti: {
    id: 'inti',
    name: 'GAMADA Inti',
    audience: { id: 'Fondasi semua produk', en: 'The foundation of every product' },
    tagline: { id: 'Satu akun, satu data, satu jejak audit untuk semua produk.', en: 'One account, one data layer, one audit trail for every product.' },
    accent: '--c-lavender-soft',
    accent2: '--c-white',
  },
  'satu-daerah': {
    id: 'satu-daerah',
    name: 'GAMADA Satu Daerah',
    audience: { id: 'Untuk pemerintah daerah', en: 'For local governments' },
    tagline: { id: 'Layanan publik, kepemimpinan, dan kesiapsiagaan dalam satu sistem yang saling terhubung.', en: 'Public service, leadership and preparedness in one connected system.' },
    accent: '--c-teal',
    accent2: '--c-cyan',
  },
  'usaha-pintar': {
    id: 'usaha-pintar',
    name: 'GAMADA Usaha Pintar',
    audience: { id: 'Untuk bisnis', en: 'For businesses' },
    tagline: { id: 'Operasional, pembukuan, penjualan, dan reputasi yang berjalan sendiri.', en: 'Operations, bookkeeping, sales and reputation that run themselves.' },
    accent: '--c-peach',
    accent2: '--c-gold',
  },
  'pasar-daerah': {
    id: 'pasar-daerah',
    name: 'GAMADA Pasar Daerah',
    audience: { id: 'Jembatan pemda dan UMKM', en: 'The bridge between government and SMEs' },
    tagline: { id: 'Belanja pemda mengalir ke UMKM lokal, ekonomi daerah terbaca setiap hari.', en: 'Government spending flows to local SMEs, and the local economy is readable every day.' },
    accent: '--c-plum',
    accent2: '--c-lavender',
  },
}

export interface ProductDef {
  code: string
  slug: ProductSlug
  eco: EcoOrInti
  /** brand name, never translated */
  name: string
  /** descriptor after the colon in the full name */
  descriptor: Bi
  tagline: Bi
  /** icon key in src/demo-kit/ui/icons.tsx */
  icon: string
  frame: FrameKind
  roles: RoleId[]
  defaultRole: RoleId
  /** products this one exchanges events with (for "Terhubung dengan" graphs) */
  related: ProductSlug[]
  /** demo needs MapLibre */
  map: boolean
  /** demo has an AI chat surface */
  chat: boolean
  /** tour chapter numbers where it appears (spec §12.2) */
  chapters: number[]
}

export const PRODUCTS: ProductDef[] = [
  {
    code: 'P0', slug: 'inti', eco: 'inti', name: 'GAMADA Inti',
    descriptor: { id: 'Platform AI Terpadu', en: 'Unified AI Platform' },
    tagline: { id: 'Identitas, agen AI, kanal, dan jejak data yang dipakai bersama oleh 17 produk.', en: 'Identity, AI agents, channels and a data trail shared by all 17 products.' },
    icon: 'inti', frame: 'browser', roles: ['kepala-daerah', 'sekretariat', 'pemilik-toko'], defaultRole: 'kepala-daerah',
    related: ['sapa-warga', 'meja-pimpinan', 'naskah-pintar', 'siaga-wilayah', 'awas-belanja', 'katalog-lokal'], map: false, chat: false, chapters: [19],
  },
  {
    code: 'P1', slug: 'sapa-warga', eco: 'satu-daerah', name: 'Sapa Warga',
    descriptor: { id: 'Asisten Layanan Publik AI', en: 'AI Public Service Assistant' },
    tagline: { id: 'Warga bertanya dan melapor lewat WhatsApp, termasuk dengan bahasa daerah dan pesan suara. Petugas menerima tiket yang sudah rapi.', en: 'Citizens ask and report over WhatsApp, in local languages and voice notes too. Officers receive tidy tickets.' },
    icon: 'sapa', frame: 'split', roles: ['warga', 'petugas', 'kepala-daerah'], defaultRole: 'warga',
    related: ['meja-pimpinan', 'siaga-wilayah', 'radar-isu', 'naskah-pintar'], map: true, chat: true, chapters: [2, 4],
  },
  {
    code: 'P2', slug: 'meja-pimpinan', eco: 'satu-daerah', name: 'Meja Pimpinan',
    descriptor: { id: 'Command Center Kepala Daerah', en: "Regional Head's Command Center" },
    tagline: { id: 'Briefing pagi yang menyusun dirinya sendiri dari seluruh daerah, dan instruksi yang langsung menjadi tugas.', en: 'A morning briefing that assembles itself from the whole region, and instructions that become tasks at once.' },
    icon: 'meja', frame: 'wall', roles: ['kepala-daerah', 'sekretariat', 'kepala-opd'], defaultRole: 'kepala-daerah',
    related: ['sapa-warga', 'siaga-wilayah', 'radar-isu', 'awas-belanja', 'naskah-pintar', 'sinyal-pasar'], map: true, chat: true, chapters: [3, 19],
  },
  {
    code: 'P3', slug: 'naskah-pintar', eco: 'satu-daerah', name: 'Naskah Pintar',
    descriptor: { id: 'Notulen & Disposisi AI', en: 'AI Minutes & Dispositions' },
    tagline: { id: 'Notulen yang menulis dirinya sendiri, surat masuk yang langsung terdisposisi, dan tindak lanjut yang tidak terlupa.', en: 'Minutes that write themselves, incoming letters dispositioned at once, follow-ups that are never forgotten.' },
    icon: 'naskah', frame: 'browser', roles: ['sekretariat', 'kepala-daerah', 'kepala-opd'], defaultRole: 'sekretariat',
    related: ['meja-pimpinan', 'awas-belanja'], map: false, chat: false, chapters: [5],
  },
  {
    code: 'P4', slug: 'radar-isu', eco: 'satu-daerah', name: 'Radar Isu',
    descriptor: { id: 'Intelijen Opini Publik', en: 'Public Opinion Intelligence' },
    tagline: { id: 'Isu dan hoaks terdeteksi sebelum viral, lengkap dengan bukti dan draf klarifikasi.', en: 'Issues and hoaxes detected before they go viral, with evidence and a draft clarification.' },
    icon: 'radar', frame: 'browser', roles: ['humas', 'kepala-daerah'], defaultRole: 'humas',
    related: ['siaga-wilayah', 'sapa-warga', 'meja-pimpinan', 'pantau-merek'], map: false, chat: true, chapters: [6],
  },
  {
    code: 'P5', slug: 'siaga-wilayah', eco: 'satu-daerah', name: 'Siaga Wilayah',
    descriptor: { id: 'Geo-AI Peringatan Dini', en: 'Geo-AI Early Warning' },
    tagline: { id: 'Hujan, genangan, dan dampaknya terbaca di peta daerah, lalu peringatan sampai ke warga yang tepat.', en: 'Rain, flooding and their impact read on the regional map, and warnings reach the right citizens.' },
    icon: 'siaga', frame: 'browser', roles: ['bpbd', 'pertanian', 'kepala-daerah'], defaultRole: 'bpbd',
    related: ['sapa-warga', 'meja-pimpinan', 'cek-berkas', 'sinyal-pasar', 'indeks-ekonomi', 'toko-autopilot'], map: true, chat: false, chapters: [1, 2],
  },
  {
    code: 'P6', slug: 'awas-belanja', eco: 'satu-daerah', name: 'Awas Belanja',
    descriptor: { id: 'Pengawas Pengadaan AI', en: 'AI Procurement Watchdog' },
    tagline: { id: 'Harga yang kemahalan dan peserta tender yang terafiliasi terlihat sebelum kontrak ditandatangani.', en: 'Overpricing and affiliated bidders surface before the contract is signed.' },
    icon: 'awas', frame: 'browser', roles: ['ukpbj', 'inspektorat'], defaultRole: 'ukpbj',
    related: ['siaga-wilayah', 'katalog-lokal', 'tenderpilot', 'meja-pimpinan'], map: false, chat: false, chapters: [7],
  },
  {
    code: 'P7', slug: 'cek-berkas', eco: 'satu-daerah', name: 'Cek Berkas',
    descriptor: { id: 'Verifikasi Dokumen Otomatis', en: 'Automated Document Verification' },
    tagline: { id: 'Berkas warga diperiksa dalam hitungan detik: lengkap, kurang, ganda, atau diedit.', en: 'Citizen documents checked in seconds: complete, missing, duplicated or edited.' },
    icon: 'cek', frame: 'browser', roles: ['perizinan', 'dinsos'], defaultRole: 'perizinan',
    related: ['siaga-wilayah', 'kenal-mitra'], map: false, chat: false, chapters: [16],
  },
  {
    code: 'P8', slug: 'toko-autopilot', eco: 'usaha-pintar', name: 'Toko Autopilot',
    descriptor: { id: 'Operasional Retail & F&B', en: 'Retail & F&B Operations' },
    tagline: { id: 'Kasir, stok, PO ke supplier, harga, dan jadwal shift yang berjalan sendiri dan membaca kejadian di daerah.', en: 'Checkout, stock, supplier POs, pricing and shift schedules that run themselves and react to local events.' },
    icon: 'toko', frame: 'tablet', roles: ['pemilik-toko', 'kasir', 'supplier'], defaultRole: 'pemilik-toko',
    related: ['pajak-beres', 'rapor-usaha', 'sinyal-pasar', 'katalog-lokal', 'juara-jualan', 'siaga-wilayah'], map: false, chat: false, chapters: [11],
  },
  {
    code: 'P9', slug: 'pajak-beres', eco: 'usaha-pintar', name: 'Pajak Beres',
    descriptor: { id: 'Copilot Pembukuan & Pajak', en: 'Bookkeeping & Tax Copilot' },
    tagline: { id: 'Nota kusut menjadi jurnal rapi, dan laporan pajak siap tanpa begadang.', en: 'Crumpled receipts become clean journals, and tax reports are ready without late nights.' },
    icon: 'pajak', frame: 'browser', roles: ['pemilik-toko', 'konsultan-pajak'], defaultRole: 'pemilik-toko',
    related: ['toko-autopilot', 'rapor-usaha', 'tenderpilot', 'katalog-lokal'], map: false, chat: true, chapters: [13],
  },
  {
    code: 'P10', slug: 'juara-jualan', eco: 'usaha-pintar', name: 'Juara Jualan',
    descriptor: { id: 'QA & Coaching Tim Penjualan', en: 'Sales Team QA & Coaching' },
    tagline: { id: 'Setiap percakapan penjualan dinilai, dan setiap agen dilatih tepat di titik lemahnya.', en: 'Every sales conversation is scored, and every agent is coached exactly where they are weak.' },
    icon: 'juara', frame: 'browser', roles: ['supervisor-sales', 'agen-sales'], defaultRole: 'supervisor-sales',
    related: ['toko-autopilot'], map: false, chat: true, chapters: [12],
  },
  {
    code: 'P11', slug: 'kenal-mitra', eco: 'usaha-pintar', name: 'Kenal Mitra',
    descriptor: { id: 'Verifikasi Pelanggan, Mitra & Kandidat', en: 'Customer, Partner & Candidate Verification' },
    tagline: { id: 'Nasabah, mitra usaha, dan kandidat terverifikasi dalam beberapa menit, bukan beberapa hari.', en: 'Customers, business partners and candidates verified in minutes, not days.' },
    icon: 'kenal', frame: 'browser', roles: ['analis-kyc', 'bank-mitra'], defaultRole: 'analis-kyc',
    related: ['katalog-lokal', 'rapor-usaha', 'tenderpilot', 'cek-berkas'], map: true, chat: false, chapters: [9],
  },
  {
    code: 'P12', slug: 'pantau-merek', eco: 'usaha-pintar', name: 'Pantau Merek',
    descriptor: { id: 'Monitoring Reputasi Brand', en: 'Brand Reputation Monitoring' },
    tagline: { id: 'Keluhan pelanggan terbaca sebagai pola, lalu dijawab cepat dan tetap personal.', en: 'Customer complaints read as patterns, then answered fast and still personally.' },
    icon: 'pantau', frame: 'browser', roles: ['brand-manager', 'pemilik-toko'], defaultRole: 'brand-manager',
    related: ['radar-isu', 'toko-autopilot'], map: false, chat: false, chapters: [15],
  },
  {
    code: 'P13', slug: 'tenderpilot', eco: 'usaha-pintar', name: 'TenderPilot',
    descriptor: { id: 'Asisten Tender untuk Vendor', en: 'Tender Assistant for Vendors' },
    tagline: { id: 'Tender yang cocok ditemukan, syarat dicentang otomatis, dan dokumen penawaran tersusun dalam beberapa menit.', en: 'Matching tenders found, requirements ticked automatically, and bid documents assembled in minutes.' },
    icon: 'tender', frame: 'browser', roles: ['vendor'], defaultRole: 'vendor',
    related: ['katalog-lokal', 'awas-belanja', 'kenal-mitra', 'pajak-beres'], map: false, chat: false, chapters: [10],
  },
  {
    code: 'P14', slug: 'katalog-lokal', eco: 'pasar-daerah', name: 'Katalog Lokal',
    descriptor: { id: 'Etalase UMKM untuk Belanja Pemda', en: 'SME Storefront for Government Purchasing' },
    tagline: { id: 'Kebutuhan pemda dicocokkan ke UMKM lokal yang terverifikasi, dalam sekejap.', en: 'Government needs matched to verified local SMEs in an instant.' },
    icon: 'katalog', frame: 'split', roles: ['ukpbj', 'pemilik-toko'], defaultRole: 'ukpbj',
    related: ['kenal-mitra', 'pajak-beres', 'rapor-usaha', 'tenderpilot', 'awas-belanja'], map: true, chat: false, chapters: [8],
  },
  {
    code: 'P15', slug: 'rapor-usaha', eco: 'pasar-daerah', name: 'Rapor Usaha',
    descriptor: { id: 'Skor Kesehatan Bisnis', en: 'Business Health Score' },
    tagline: { id: 'Skor kesehatan usaha dari data nyata, sehingga modal kerja cair tanpa tumpukan berkas.', en: 'A business health score from real data, so working capital is released without stacks of paperwork.' },
    icon: 'rapor', frame: 'browser', roles: ['pemilik-toko', 'bank-mitra'], defaultRole: 'pemilik-toko',
    related: ['toko-autopilot', 'pajak-beres', 'kenal-mitra', 'katalog-lokal'], map: false, chat: false, chapters: [14],
  },
  {
    code: 'P16', slug: 'indeks-ekonomi', eco: 'pasar-daerah', name: 'Indeks Ekonomi Daerah',
    descriptor: { id: 'Dasbor Ekonomi Lokal', en: 'Local Economy Dashboard' },
    tagline: { id: 'Ekonomi setiap kecamatan terbaca bulan demi bulan, dan dampak kebijakan bisa diukur.', en: 'The economy of every district readable month by month, and policy impact measurable.' },
    icon: 'indeks', frame: 'browser', roles: ['bappeda', 'dinkop', 'kepala-daerah'], defaultRole: 'bappeda',
    related: ['sinyal-pasar', 'siaga-wilayah', 'toko-autopilot', 'meja-pimpinan'], map: true, chat: false, chapters: [18],
  },
  {
    code: 'P17', slug: 'sinyal-pasar', eco: 'pasar-daerah', name: 'Sinyal Pasar',
    descriptor: { id: 'Peringatan Harga & Pasokan', en: 'Price & Supply Alerts' },
    tagline: { id: 'Lonjakan harga bahan pokok terlihat beberapa hari sebelum terjadi.', en: 'Staple price spikes visible days before they happen.' },
    icon: 'sinyal', frame: 'browser', roles: ['disperindag', 'pemilik-toko'], defaultRole: 'disperindag',
    related: ['meja-pimpinan', 'toko-autopilot', 'indeks-ekonomi', 'siaga-wilayah'], map: true, chat: false, chapters: [17],
  },
]

export const PRODUCT_BY_SLUG = Object.fromEntries(PRODUCTS.map((p) => [p.slug, p])) as Record<ProductSlug, ProductDef>
/* drift guard: every slug in productSlugs.ts has exactly one registry entry */
if (PRODUCTS.length !== PRODUCT_SLUGS.length || PRODUCT_SLUGS.some((s) => !(s in PRODUCT_BY_SLUG))) {
  throw new Error('products.ts: PRODUCTS and productSlugs.ts PRODUCT_SLUGS disagree')
}
export const productsOf = (eco: EcoOrInti): ProductDef[] => PRODUCTS.filter((p) => p.eco === eco)
export const fullName = (p: ProductDef, lang: 'id' | 'en'): string => `${p.name}: ${p.descriptor[lang]}`

/** Counts for home stats etc. — computed, never typed by hand. */
export const ECOSYSTEM_STATS = {
  products: PRODUCTS.filter((p) => p.slug !== 'inti').length,
  ecosystems: (Object.keys(ECOSYSTEMS) as EcoOrInti[]).filter((e) => e !== 'inti').length,
  roles: Object.keys(ROLES).length,
}
