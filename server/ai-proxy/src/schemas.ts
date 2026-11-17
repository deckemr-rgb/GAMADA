/**
 * schemas.ts — zod schemas for (1) request bodies, (2) the structured outputs the model returns
 * through tool use, one tool per structured `kind`, and (3) the /extract result.
 *
 * Structured outputs reach the site as an SSE `tool_call` event followed by a `structured` event
 * `{ value: { kind, data } }` — the same shape as `Structured` in src/demo-kit/ai/types.ts.
 * The site validates them again (spec §9.3) with a MIRROR of these schemas
 * (STRUCTURED_SCHEMAS in src/demo-kit/ai/live.ts); the site's structured-parity test fails when
 * the two drift apart, so change both together. The proxy validates first so an invalid output is
 * sent back to the model for one correction instead of to the browser.
 */
import { z } from 'zod'
import { PRODUCT_SLUGS, ROLE_IDS } from './products.js'

/* ------------------------------------------------------------------ limits */

export const LIMITS = {
  /** POST /api/ai/chat body */
  chatBodyBytes: 64 * 1024,
  /** POST /api/ai/extract body (8 MB file + multipart overhead) */
  extractBodyBytes: 8 * 1024 * 1024 + 64 * 1024,
  /** uploaded image / PDF */
  fileBytes: 8 * 1024 * 1024,
  messageChars: 4000,
  messages: 40,
  /** JSON of context.world (spec §9.3: ±6 KB) — a little headroom */
  worldContextBytes: 12 * 1024,
  /** JSON of context.region (region pack excerpt, cached) */
  regionContextBytes: 40 * 1024,
  extractTextChars: 20_000,
} as const

/* ------------------------------------------------------------------ requests */

export const ProductSlugSchema = z.enum(PRODUCT_SLUGS)
export const RoleIdSchema = z.enum(ROLE_IDS)
export const LangSchema = z.enum(['id', 'en'])

export const MsgSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(LIMITS.messageChars),
})

const jsonBytes = (v: unknown): number => (v === undefined ? 0 : new TextEncoder().encode(JSON.stringify(v)).length)

/**
 * `context` may be anything JSON. When it is an object with `region` and/or `world` keys the proxy
 * puts `region` in a cached system block and `world` in the (uncached) last user turn; any other
 * shape is treated as `world`.
 */
export const ChatRequestSchema = z
  .object({
    product: ProductSlugSchema,
    role: RoleIdSchema.optional(),
    lang: LangSchema.default('id'),
    messages: z.array(MsgSchema).min(1).max(LIMITS.messages),
    context: z.unknown().optional(),
  })
  .superRefine((req, ctx) => {
    const last = req.messages[req.messages.length - 1]
    if (!last || last.role !== 'user') {
      ctx.addIssue({ code: 'custom', path: ['messages'], message: 'last message must be from the user' })
    }
    const { world, region } = splitContext(req.context)
    if (jsonBytes(world) > LIMITS.worldContextBytes) {
      ctx.addIssue({ code: 'custom', path: ['context'], message: `world context over ${LIMITS.worldContextBytes} bytes` })
    }
    if (jsonBytes(region) > LIMITS.regionContextBytes) {
      ctx.addIssue({ code: 'custom', path: ['context', 'region'], message: `region context over ${LIMITS.regionContextBytes} bytes` })
    }
  })
export type ChatRequest = z.infer<typeof ChatRequestSchema>

export function splitContext(context: unknown): { world: unknown; region: unknown } {
  if (context && typeof context === 'object' && !Array.isArray(context)) {
    const c = context as Record<string, unknown>
    if ('region' in c || 'world' in c) {
      const { region, world, ...rest } = c
      const restWorld = Object.keys(rest).length ? rest : undefined
      return { region, world: world === undefined ? restWorld : restWorld ? { ...rest, world } : world }
    }
  }
  return { world: context, region: undefined }
}

export const ExtractKindSchema = z.enum(['document', 'invoice', 'cv', 'ktp-specimen'])
export type ExtractKind = z.infer<typeof ExtractKindSchema>

export const ExtractFieldsSchema = z.object({
  product: ProductSlugSchema,
  kind: ExtractKindSchema,
  lang: LangSchema.default('id'),
  text: z.string().trim().min(1).max(LIMITS.extractTextChars).optional(),
})

export const ACCEPTED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'] as const
export type AcceptedFileType = (typeof ACCEPTED_FILE_TYPES)[number]

/* ------------------------------------------------------------------ structured tool outputs */

const s = (max = 400) => z.string().trim().min(1).max(max)
const opt = (max = 400) => z.string().trim().max(max).optional()

export const TicketSchema = z.object({
  category: s(60).describe('Kategori aduan, mis. "Banjir/Genangan", "Jalan Rusak", "Sampah", "PJU Mati", "Administrasi Kependudukan".'),
  subcategory: opt(80),
  summary: s(280).describe('Ringkasan aduan 1–2 kalimat dalam Bahasa Indonesia.'),
  urgency: z.enum(['rendah', 'sedang', 'tinggi', 'kritis']),
  opd: s(80).describe('OPD tujuan, mis. "BPBD", "Dinas PUPR", "DLH", "Disdukcapil".'),
  location: z
    .object({ kecamatan: opt(80), desa: opt(80), detail: opt(160) })
    .optional()
    .describe('Hanya nama tempat yang ada di konteks region; kosongkan bila tidak disebut.'),
  language: s(20).describe('Bahasa pesan warga: kode singkat, mis. "id", "jv", "su", "mad", "en".'),
  translationId: opt(400).describe('Terjemahan Bahasa Indonesia bila warga tidak memakai Bahasa Indonesia.'),
  slaHours: z.number().int().min(1).max(720).optional(),
})

export const ChecklistSchema = z.object({
  service: s(120),
  requirements: z.array(s(160)).min(1).max(15),
  estimate: opt(80).describe('Perkiraan lama layanan, mis. "1 hari kerja".'),
  office: opt(120),
  fee: opt(80),
})

export const QueryWorldSchema = z.object({
  metric: z.enum([
    'complaints',
    'sla_on_time',
    'ticket_backlog',
    'alerts',
    'mentions_negative',
    'procurement_risk',
    'sales',
    'prices',
    'econ_index',
    'action_items_overdue',
  ]),
  groupBy: z.enum(['none', 'kecamatan', 'opd', 'category', 'day', 'commodity', 'market']).default('none'),
  range: z.enum(['today', '7d', '30d', '90d']).default('7d'),
  filter: z
    .object({ kecamatan: opt(80), category: opt(80), opd: opt(80), commodity: opt(80) })
    .optional(),
  chart: z.enum(['bar', 'line', 'table', 'none']).default('bar'),
})

export const InstructionSchema = z.object({
  to: s(120).describe('OPD/pejabat (jabatan saja) yang menerima instruksi.'),
  instruction: s(400),
  deadline: opt(60),
  priority: z.enum(['biasa', 'tinggi', 'segera']),
})

export const MinutesSchema = z.object({
  decisions: z.array(s(300)).max(12),
  actionItems: z
    .array(z.object({ task: s(240), owner: s(120).describe('Jabatan/unit, bukan nama orang nyata.'), due: opt(60) }))
    .max(15),
})

export const LetterClassSchema = z.object({
  letterClass: z.enum(['undangan', 'permohonan', 'laporan', 'edaran', 'lainnya']),
  nature: z.enum(['segera', 'biasa', 'rahasia']),
  summary: z.array(s(200)).min(1).max(3).describe('Ringkasan maksimal 3 baris.'),
  sender: opt(120),
  deadline: opt(60),
})

export const DispositionSchema = z.object({
  to: z.array(s(120)).min(1).max(6),
  instruction: s(400),
  note: opt(300),
  deadline: opt(60),
})

export const MentionSchema = z.object({
  sentiment: z.enum(['negatif', 'netral', 'positif']),
  topic: s(80),
  hoaxLikelihood: z.number().min(0).max(1),
  reasons: z.array(s(200)).max(5),
  evidenceNeeded: z.array(s(200)).max(5).optional(),
})

export const ClarificationSchema = z.object({
  tone: z.enum(['tegas', 'menenangkan', 'informatif']),
  pressRelease: s(2500),
  socialCaption: s(600),
  infographicPoints: z.array(s(140)).min(1).max(5),
})

export const AlertSchema = z.object({
  level: z.enum(['waspada', 'siaga', 'awas']),
  areas: z.array(s(80)).min(1).max(20),
  message: s(600),
  channels: z.array(z.enum(['wa', 'sms', 'sirine', 'media-sosial', 'radio'])).min(1),
})

export const ProcurementRiskSchema = z.object({
  riskScore: z.number().int().min(0).max(100),
  flags: z
    .array(
      z.object({
        detector: z.enum(['harga', 'afiliasi', 'spesifikasi', 'jadwal', 'pemenang-berulang', 'lainnya']),
        severity: z.enum(['rendah', 'sedang', 'tinggi']),
        note: s(240),
      }),
    )
    .max(8),
  recommendation: s(600),
})

export const DocCheckSchema = z.object({
  status: z.enum(['lengkap', 'kurang', 'ganda', 'diedit']),
  missing: z.array(s(120)).max(10),
  notes: z.array(s(200)).max(6),
})

export const PurchaseOrderSchema = z.object({
  supplier: s(120),
  items: z.array(z.object({ name: s(120), qty: z.number().positive(), unit: s(20) })).min(1).max(20),
  reason: opt(240),
  deliverBy: opt(60),
})

export const LedgerSchema = z.object({
  entries: z
    .array(
      z.object({
        description: s(160),
        account: s(80),
        debit: z.number().min(0),
        credit: z.number().min(0),
      }),
    )
    .min(1)
    .max(20),
  taxNote: opt(300),
})

export const CallScoreSchema = z.object({
  criteria: z
    .array(
      z.object({
        id: z.enum(['salam', 'gali-kebutuhan', 'keberatan', 'penawaran', 'closing', 'kepatuhan-skrip']),
        score: z.number().int().min(0).max(5),
        evidence: s(240),
      }),
    )
    .min(1)
    .max(6),
  total: z.number().int().min(0).max(100),
  coaching: z.array(s(200)).max(3),
})

export const KycSchema = z.object({
  riskScore: z.number().int().min(0).max(100),
  decision: z.enum(['setujui', 'tinjau', 'tolak']),
  reasons: z.array(s(200)).min(1).max(6),
})

export const ClustersSchema = z.object({
  clusters: z
    .array(z.object({ label: s(80), share: z.number().min(0).max(1).optional(), sample: s(240), suggestedAction: opt(240) }))
    .min(1)
    .max(6),
})

export const ReplySchema = z.object({
  tone: z.enum(['empatik', 'formal', 'santai']),
  reply: s(800),
})

export const WinScoreSchema = z.object({
  probability: z.number().int().min(0).max(100),
  factors: z.array(z.object({ name: s(80), impact: z.enum(['naik', 'turun', 'netral']), note: s(200) })).min(1).max(6),
  priceRange: z.object({ low: z.number().min(0), high: z.number().min(0) }).optional(),
})

export const NeedSpecSchema = z.object({
  items: z.array(z.object({ name: s(120), qty: z.number().positive(), unit: s(20), spec: opt(200) })).min(1).max(20),
  location: opt(120),
  deliveryDays: z.number().int().min(0).max(365).optional(),
  budgetCeiling: z.number().min(0).optional(),
})

export const BusinessScoreSchema = z.object({
  score: z.number().int().min(0).max(1000),
  drivers: z.array(z.object({ name: s(80), direction: z.enum(['naik', 'turun']), note: s(200) })).min(1).max(6),
  actions: z.array(s(200)).min(1).max(3),
})

export const EconInsightSchema = z.object({
  indicator: s(80),
  trend: z.enum(['naik', 'turun', 'stabil']),
  explanation: s(600),
  kecamatan: z.array(s(80)).max(10).optional(),
})

export const PriceAlertSchema = z.object({
  commodity: s(60),
  market: opt(120),
  changePct: z.number().min(-100).max(1000),
  horizonDays: z.number().int().min(1).max(30),
  cause: opt(240),
  recommendation: s(400),
})

export const PlanSchema = z.object({
  steps: z.array(z.object({ product: ProductSlugSchema, action: s(200) })).min(1).max(8),
})

/* ---- tahap 2 (Satu Daerah) ---- */

export const ServiceInfoSchema = z.object({
  serviceId: opt(60),
  service: s(120),
  slaDays: z.number().int().min(0).max(60).optional(),
  channel: z.enum(['mpp', 'online', 'kecamatan', 'dinas']).optional(),
  office: opt(120),
  fee: opt(80),
  steps: z.array(s(160)).max(8).optional(),
})

export const BookingSchema = z.object({
  serviceId: opt(60),
  service: s(120),
  slot: z.string().trim().regex(/^([01]\d|2[0-3])[.:][0-5]\d$/),
  date: opt(40),
  office: opt(120),
  notes: opt(200),
})

export const TicketStatusSchema = z.object({
  ticketCode: s(30),
  status: z.enum(['baru', 'diverifikasi', 'diteruskan', 'diproses', 'selesai', 'tidak-ditemukan']),
  opd: opt(80),
  eta: opt(80),
  note: opt(240),
})

export const BriefingSchema = z.object({
  items: z.array(z.object({ title: s(160), source: ProductSlugSchema, detail: opt(240) })).min(1).max(10),
  closing: opt(400),
})

export const TopicAnalysisSchema = z.object({
  keywords: z.array(s(40)).min(1).max(4),
  periodDays: z.number().int().min(1).max(90),
  volumeTrend: z.enum(['naik', 'turun', 'stabil']),
  sentiment: z.object({ negatif: z.number().min(0).max(1), netral: z.number().min(0).max(1), positif: z.number().min(0).max(1) }),
  topics: z.array(z.object({ label: s(80), share: z.number().min(0).max(1) })).max(6),
  quotes: z.array(s(240)).max(5),
  surveyQuestions: z.array(s(200)).max(5),
})

export const AuditMemoSchema = z.object({
  title: s(160),
  findings: z.array(s(300)).min(1).max(8),
  hpsCorrected: z.number().min(0).optional(),
  recommendations: z.array(s(300)).min(1).max(6),
  inviteLocal: z.boolean(),
})

export const ReminderSchema = z.object({
  to: s(120),
  message: s(600),
  dueText: opt(80),
})

export const FollowupsSchema = z.object({
  chips: z.array(z.string().trim().min(1).max(60)).min(1).max(3),
})

/* ------------------------------------------------------------------ tool registry */

export interface ToolDef {
  /** Anthropic tool name */
  name: string
  /** `Structured.kind` sent to the site */
  kind: string
  description: string
  schema: z.ZodType
}

const tool = (name: string, kind: string, schema: z.ZodType, description: string): ToolDef => ({
  name,
  kind,
  schema,
  description,
})

export const TOOLS = {
  create_ticket: tool('create_ticket', 'ticket', TicketSchema, 'Buat tiket aduan warga yang rapi (kategori, lokasi, urgensi, OPD tujuan). Panggil saat warga melaporkan masalah.'),
  service_checklist: tool('service_checklist', 'checklist', ChecklistSchema, 'Tampilkan kartu checklist syarat sebuah layanan publik. Panggil saat warga menanyakan syarat/prosedur.'),
  query_world: tool('query_world', 'query', QueryWorldSchema, 'Minta layar menampilkan grafik/tabel dari data dunia demo (filter dan agregat yang diizinkan). Layar yang menghitung angkanya; Anda menjelaskan dari konteks.'),
  issue_instruction: tool('issue_instruction', 'instruction', InstructionSchema, 'Susun instruksi pimpinan yang akan menjadi disposisi/tugas OPD. Panggil saat pengguna meminta memberi instruksi.'),
  extract_minutes: tool('extract_minutes', 'minutes', MinutesSchema, 'Catat keputusan dan tindak lanjut dari transkrip rapat.'),
  classify_letter: tool('classify_letter', 'classification', LetterClassSchema, 'Klasifikasikan surat masuk (jenis, sifat, ringkasan 3 baris, tenggat).'),
  draft_disposition: tool('draft_disposition', 'disposition', DispositionSchema, 'Susun draf disposisi surat (kepada, instruksi, catatan).'),
  assess_mention: tool('assess_mention', 'sentiment', MentionSchema, 'Nilai sebuah unggahan/isu: sentimen, topik, kemungkinan hoaks dan alasannya.'),
  draft_clarification: tool('draft_clarification', 'clarification', ClarificationSchema, 'Susun paket klarifikasi: rilis pers, caption media sosial, poin infografis.'),
  draft_alert: tool('draft_alert', 'alert', AlertSchema, 'Susun peringatan dini untuk warga di wilayah terdampak (level, wilayah, pesan, kanal).'),
  assess_procurement: tool('assess_procurement', 'risk', ProcurementRiskSchema, 'Nilai risiko paket pengadaan: skor, temuan per detektor, rekomendasi.'),
  check_documents: tool('check_documents', 'doc-check', DocCheckSchema, 'Simpulkan hasil pemeriksaan berkas: lengkap/kurang/ganda/diedit dan apa yang kurang.'),
  draft_po: tool('draft_po', 'po', PurchaseOrderSchema, 'Susun draf purchase order ke supplier.'),
  categorize_transaction: tool('categorize_transaction', 'ledger', LedgerSchema, 'Ubah transaksi/nota menjadi jurnal (akun, debit, kredit) yang seimbang.'),
  score_call: tool('score_call', 'score', CallScoreSchema, 'Nilai percakapan penjualan per kriteria (0–5) dengan bukti kutipan, total 0–100, dan saran coaching.'),
  kyc_decision: tool('kyc_decision', 'kyc', KycSchema, 'Simpulkan verifikasi pelanggan/mitra/kandidat: skor risiko, keputusan, alasan.'),
  cluster_feedback: tool('cluster_feedback', 'clusters', ClustersSchema, 'Kelompokkan keluhan/ulasan pelanggan menjadi pola beserta contoh dan aksi.'),
  draft_reply: tool('draft_reply', 'reply', ReplySchema, 'Susun balasan untuk ulasan/keluhan pelanggan.'),
  estimate_win: tool('estimate_win', 'win-score', WinScoreSchema, 'Perkirakan peluang menang tender (0–100) dengan faktor penjelas dan rentang harga.'),
  need_spec: tool('need_spec', 'need-spec', NeedSpecSchema, 'Ubah kebutuhan belanja pemda dalam bahasa alami menjadi spesifikasi terstruktur.'),
  explain_score: tool('explain_score', 'business-score', BusinessScoreSchema, 'Jelaskan skor kesehatan usaha (0–1000): pendorong naik/turun dan 3 aksi untuk menaikkan skor.'),
  econ_insight: tool('econ_insight', 'insight', EconInsightSchema, 'Ringkas satu temuan indikator ekonomi daerah: tren dan penjelasan.'),
  price_alert: tool('price_alert', 'price-alert', PriceAlertSchema, 'Susun peringatan harga/pasokan bahan pokok dengan horizon hari dan rekomendasi.'),
  plan_agents: tool('plan_agents', 'plan', PlanSchema, 'Susun rencana langkah agen lintas produk GAMADA.'),
  lookup_service: tool('lookup_service', 'service', ServiceInfoSchema, 'Tampilkan kartu info satu layanan (SLA, kanal, kantor, biaya, langkah) dari data layanan region.'),
  book_queue: tool('book_queue', 'booking', BookingSchema, 'Pesan slot antrean 30 menit di Mal Pelayanan Publik untuk sebuah layanan. Panggil setelah warga memilih jam.'),
  ticket_status: tool('ticket_status', 'ticket-status', TicketStatusSchema, 'Tampilkan status tiket aduan dari konteks dunia (nomor SW-YYYY-####).'),
  compose_briefing: tool('compose_briefing', 'briefing', BriefingSchema, 'Susun butir briefing pagi pimpinan dari data dunia demo, tiap butir dengan produk sumbernya.'),
  analyze_topic: tool('analyze_topic', 'analysis', TopicAnalysisSchema, 'Analisis mendalam percakapan publik untuk 1–4 kata kunci: tren volume, sentimen, topik, kutipan, pertanyaan survei.'),
  draft_audit_memo: tool('draft_audit_memo', 'audit-memo', AuditMemoSchema, 'Susun memo audit pengadaan: temuan, koreksi HPS, rekomendasi (termasuk mengundang UMKM lokal).'),
  draft_reminder: tool('draft_reminder', 'reminder', ReminderSchema, 'Susun pesan pengingat singkat (WhatsApp) ke PIC tindak lanjut yang mendekati atau lewat tenggat.'),
  suggest_followups: tool('suggest_followups', 'followups', FollowupsSchema, 'Opsional, di akhir jawaban: 1–3 chip pertanyaan lanjutan singkat dalam bahasa pengguna.'),
} as const satisfies Record<string, ToolDef>

export type ToolName = keyof typeof TOOLS

/** JSON Schema for the Anthropic `input_schema` (zod 4 native conversion, `$schema` stripped). */
export function toInputSchema(schema: z.ZodType): { type: 'object'; [k: string]: unknown } {
  const js = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>
  delete js.$schema
  return { ...js, type: 'object' }
}

/* ------------------------------------------------------------------ /extract result */

const Pct = z.number().min(0).max(100)
const Box = z.object({ x: Pct, y: Pct, w: Pct, h: Pct })

/** What the model returns through the `record_extraction` tool. */
export const ExtractionToolSchema = z.object({
  fields: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(40).regex(/^[a-z0-9_]+$/),
        labelId: s(80),
        labelEn: s(80),
        value: z.string().trim().max(600),
        confidence: z.number().min(0).max(1),
        box: Box.optional().describe('Kotak lokasi nilai di halaman, dalam persen (0–100).'),
      }),
    )
    .min(1)
    .max(40),
  checks: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(40),
        labelId: s(120),
        labelEn: s(120),
        status: z.enum(['ok', 'warn', 'fail']),
        note: opt(240),
      }),
    )
    .max(12)
    .default([]),
  tamper: z
    .array(Box.extend({ score: z.number().min(0).max(1) }))
    .max(64)
    .optional()
    .describe('Sel yang tampak diedit (skor 0..1). Kosongkan bila tidak ada indikasi.'),
})

/** Wire shape of POST /api/ai/extract — identical to `Extracted` in src/demo-kit/ai/types.ts. */
export const ExtractedSchema = z.object({
  kind: ExtractKindSchema,
  fields: z.array(
    z.object({
      key: z.string(),
      label: z.object({ id: z.string(), en: z.string() }),
      value: z.string(),
      confidence: z.number().min(0).max(1),
      box: Box.optional(),
    }),
  ),
  checks: z
    .array(
      z.object({
        id: z.string(),
        label: z.object({ id: z.string(), en: z.string() }),
        status: z.enum(['ok', 'warn', 'fail']),
        note: z.string().optional(),
      }),
    )
    .optional(),
  tamper: z.array(Box.extend({ score: z.number().min(0).max(1) })).optional(),
  mode: z.enum(['sim', 'live']),
})
export type Extracted = z.infer<typeof ExtractedSchema>

export function toExtracted(kind: ExtractKind, raw: z.infer<typeof ExtractionToolSchema>): Extracted {
  return {
    kind,
    fields: raw.fields.map((f) => ({
      key: f.key,
      label: { id: f.labelId, en: f.labelEn },
      value: f.value,
      confidence: f.confidence,
      ...(f.box ? { box: f.box } : {}),
    })),
    checks: raw.checks.map((c) => ({
      id: c.id,
      label: { id: c.labelId, en: c.labelEn },
      status: c.status,
      ...(c.note ? { note: c.note } : {}),
    })),
    ...(raw.tamper && raw.tamper.length ? { tamper: raw.tamper } : {}),
    mode: 'live',
  }
}

/* ------------------------------------------------------------------ SSE wire events */

/**
 * One SSE event per ProxyEvent: `event:` = `type`, `data:` = the whole object as JSON. The protocol
 * is documented ONCE, in README.md → "Protokol SSE"; the site parses it in src/demo-kit/ai/live.ts.
 * Every event except `error` is an `AiChunk` of the site (plus a few extra fields on `done`).
 */
export type ProxyEvent =
  | { type: 'text'; text: string }
  | { type: 'tool_call'; call: { id: string; name: string; input: Record<string, unknown> } }
  | { type: 'structured'; value: { kind: string; data: Record<string, unknown> } }
  | { type: 'followups'; chips: string[] }
  | {
      type: 'done'
      mode: 'live'
      model: string
      stopReason: string | null
      usage: { input: number; output: number; cacheRead: number; cacheWrite: number }
      mock?: boolean
      budgetExhausted?: boolean
    }
  | { type: 'error'; code: string; message: string; retryable: boolean }

/** Structured kinds sent as `structured` events (every tool except suggest_followups). */
export const STRUCTURED_KINDS = Object.values(TOOLS)
  .map((t) => t.kind)
  .filter((k) => k !== 'followups')

/**
 * The events for one VALIDATED tool use: `suggest_followups` → a single `followups` event;
 * any other tool → `tool_call` (the visible agent step) followed by `structured`.
 */
export function toolEvents(def: ToolDef, id: string, data: Record<string, unknown>): ProxyEvent[] {
  if (def.kind === 'followups') {
    const chips = Array.isArray(data.chips) ? data.chips.filter((c): c is string => typeof c === 'string') : []
    return [{ type: 'followups', chips }]
  }
  return [
    { type: 'tool_call', call: { id, name: def.name, input: data } },
    { type: 'structured', value: { kind: def.kind, data } },
  ]
}
