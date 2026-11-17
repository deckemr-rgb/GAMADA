/**
 * ai/live.ts — client for the AI proxy (spec §9.3, §10). Raw, no fallback: provider.ts wraps it.
 * This is the ZOD half of the live client and is loaded ONLY on the live path (provider.ts → dynamic import()),
 * so the simulation path and every demo route stay zod-free. The zod-free half — config, LiveError, health check,
 * fallback bus, structured-validator registry — is ai/live-base.ts and is re-exported here for tests/tools.
 *
 * Base URL: import.meta.env.VITE_AI_PROXY_URL
 *   absent        ⇒ live is unavailable and nothing is fetched (production default: simulation only)
 *   "" (empty)    ⇒ same origin: `/api/ai/*` (dev: vite.config.ts proxies it to 127.0.0.1:8787)
 *   "https://…"   ⇒ that proxy (CORS: the proxy's ALLOWED_ORIGINS must list the site)
 *
 * The wire protocol (health fields, chat SSE events, extract body) is documented ONCE in
 * server/ai-proxy/README.md → "Protokol SSE". This file is its parser; keep both in step.
 * STRUCTURED_SCHEMAS below mirrors server/ai-proxy/src/schemas.ts (TOOLS) and is checked by
 * __tests__/structured-parity.test.ts. EventSource is not used because it cannot POST.
 */
import { z } from 'zod'
import type { AiChunk, ChatRequest, Extracted, ExtractRequest, Msg, Structured, ToolCall } from './types'
import { PRODUCTS, type ProductSlug } from '../../content/products'
import { summarize, byteLength } from './context'
import { LIVE, LiveError, asLiveError, cfg, customStructuredSchema, httpError } from './live-base'

export * from './live-base'

/* ------------------------------------------------------------------ SSE */

export interface SseEvent {
  event: string
  data: string
  id?: string
}

/** Parse a text/event-stream body (WHATWG rules: event/data/id fields, ':' comments, blank-line dispatch). */
export async function* parseSSE(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<SseEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let event = ''
  let data: string[] = []
  let id: string | undefined
  const onAbort = () => void reader.cancel().catch(() => {})
  signal?.addEventListener('abort', onAbort, { once: true })

  function* lines(flush: boolean): Generator<SseEvent> {
    for (;;) {
      const m = /\r\n|\r|\n/.exec(buf)
      if (!m) break
      // a lone \r at the very end may be the first half of \r\n
      if (m[0] === '\r' && m.index === buf.length - 1 && !flush) break
      const line = buf.slice(0, m.index)
      buf = buf.slice(m.index + m[0].length)
      if (line === '') {
        if (data.length) {
          const ev: SseEvent = { event: event || 'message', data: data.join('\n') }
          if (id !== undefined) ev.id = id
          yield ev
        }
        event = ''
        data = []
        continue
      }
      if (line.startsWith(':')) continue
      const c = line.indexOf(':')
      const field = c === -1 ? line : line.slice(0, c)
      let value = c === -1 ? '' : line.slice(c + 1)
      if (value.startsWith(' ')) value = value.slice(1)
      if (field === 'event') event = value
      else if (field === 'data') data.push(value)
      else if (field === 'id') id = value
    }
  }

  try {
    for (;;) {
      if (signal?.aborted) return
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      yield* lines(false)
    }
    buf += decoder.decode()
    yield* lines(true)
    if (data.length) yield { event: event || 'message', data: data.join('\n'), ...(id !== undefined ? { id } : {}) }
  } finally {
    signal?.removeEventListener('abort', onAbort)
    try {
      reader.releaseLock()
    } catch {
      /* already released */
    }
  }
}

/* ------------------------------------------------------------------ structured kinds (mirror of the proxy) */

/*
 * One zod schema per `Structured.kind` the proxy can send — a field-for-field MIRROR of the tool schemas in
 * server/ai-proxy/src/schemas.ts (descriptions left out). provider.ts registers them as the default
 * validators; a product may register a stricter schema with registerStructuredSchema(), but it must still
 * accept this shape or every live result of that kind falls back to the simulation's.
 * __tests__/structured-parity.test.ts compares both lists (JSON Schema, enums sorted) and fails on drift.
 */
const s = (max = 400) => z.string().trim().min(1).max(max)
const opt = (max = 400) => z.string().trim().max(max).optional()
const ProductSlugEnum = z.enum(PRODUCTS.map((p) => p.slug) as [ProductSlug, ...ProductSlug[]])

export const STRUCTURED_SCHEMAS = {
  ticket: z.object({
    category: s(60),
    subcategory: opt(80),
    summary: s(280),
    urgency: z.enum(['rendah', 'sedang', 'tinggi', 'kritis']),
    opd: s(80),
    location: z.object({ kecamatan: opt(80), desa: opt(80), detail: opt(160) }).optional(),
    language: s(20),
    translationId: opt(400),
    slaHours: z.number().int().min(1).max(720).optional(),
  }),
  checklist: z.object({
    service: s(120),
    requirements: z.array(s(160)).min(1).max(15),
    estimate: opt(80),
    office: opt(120),
    fee: opt(80),
  }),
  query: z.object({
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
    filter: z.object({ kecamatan: opt(80), category: opt(80), opd: opt(80), commodity: opt(80) }).optional(),
    chart: z.enum(['bar', 'line', 'table', 'none']).default('bar'),
  }),
  instruction: z.object({
    to: s(120),
    instruction: s(400),
    deadline: opt(60),
    priority: z.enum(['biasa', 'tinggi', 'segera']),
  }),
  minutes: z.object({
    decisions: z.array(s(300)).max(12),
    actionItems: z.array(z.object({ task: s(240), owner: s(120), due: opt(60) })).max(15),
  }),
  classification: z.object({
    letterClass: z.enum(['undangan', 'permohonan', 'laporan', 'edaran', 'lainnya']),
    nature: z.enum(['segera', 'biasa', 'rahasia']),
    summary: z.array(s(200)).min(1).max(3),
    sender: opt(120),
    deadline: opt(60),
  }),
  disposition: z.object({
    to: z.array(s(120)).min(1).max(6),
    instruction: s(400),
    note: opt(300),
    deadline: opt(60),
  }),
  sentiment: z.object({
    sentiment: z.enum(['negatif', 'netral', 'positif']),
    topic: s(80),
    hoaxLikelihood: z.number().min(0).max(1),
    reasons: z.array(s(200)).max(5),
    evidenceNeeded: z.array(s(200)).max(5).optional(),
  }),
  clarification: z.object({
    tone: z.enum(['tegas', 'menenangkan', 'informatif']),
    pressRelease: s(2500),
    socialCaption: s(600),
    infographicPoints: z.array(s(140)).min(1).max(5),
  }),
  alert: z.object({
    level: z.enum(['waspada', 'siaga', 'awas']),
    areas: z.array(s(80)).min(1).max(20),
    message: s(600),
    channels: z.array(z.enum(['wa', 'sms', 'sirine', 'media-sosial', 'radio'])).min(1),
  }),
  risk: z.object({
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
  }),
  'doc-check': z.object({
    status: z.enum(['lengkap', 'kurang', 'ganda', 'diedit']),
    missing: z.array(s(120)).max(10),
    notes: z.array(s(200)).max(6),
  }),
  po: z.object({
    supplier: s(120),
    items: z.array(z.object({ name: s(120), qty: z.number().positive(), unit: s(20) })).min(1).max(20),
    reason: opt(240),
    deliverBy: opt(60),
  }),
  ledger: z.object({
    entries: z
      .array(z.object({ description: s(160), account: s(80), debit: z.number().min(0), credit: z.number().min(0) }))
      .min(1)
      .max(20),
    taxNote: opt(300),
  }),
  score: z.object({
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
  }),
  kyc: z.object({
    riskScore: z.number().int().min(0).max(100),
    decision: z.enum(['setujui', 'tinjau', 'tolak']),
    reasons: z.array(s(200)).min(1).max(6),
  }),
  clusters: z.object({
    clusters: z
      .array(z.object({ label: s(80), share: z.number().min(0).max(1).optional(), sample: s(240), suggestedAction: opt(240) }))
      .min(1)
      .max(6),
  }),
  reply: z.object({
    tone: z.enum(['empatik', 'formal', 'santai']),
    reply: s(800),
  }),
  'win-score': z.object({
    probability: z.number().int().min(0).max(100),
    factors: z.array(z.object({ name: s(80), impact: z.enum(['naik', 'turun', 'netral']), note: s(200) })).min(1).max(6),
    priceRange: z.object({ low: z.number().min(0), high: z.number().min(0) }).optional(),
  }),
  'need-spec': z.object({
    items: z.array(z.object({ name: s(120), qty: z.number().positive(), unit: s(20), spec: opt(200) })).min(1).max(20),
    location: opt(120),
    deliveryDays: z.number().int().min(0).max(365).optional(),
    budgetCeiling: z.number().min(0).optional(),
  }),
  'business-score': z.object({
    score: z.number().int().min(0).max(1000),
    drivers: z.array(z.object({ name: s(80), direction: z.enum(['naik', 'turun']), note: s(200) })).min(1).max(6),
    actions: z.array(s(200)).min(1).max(3),
  }),
  insight: z.object({
    indicator: s(80),
    trend: z.enum(['naik', 'turun', 'stabil']),
    explanation: s(600),
    kecamatan: z.array(s(80)).max(10).optional(),
  }),
  'price-alert': z.object({
    commodity: s(60),
    market: opt(120),
    changePct: z.number().min(-100).max(1000),
    horizonDays: z.number().int().min(1).max(30),
    cause: opt(240),
    recommendation: s(400),
  }),
  plan: z.object({
    steps: z.array(z.object({ product: ProductSlugEnum, action: s(200) })).min(1).max(8),
  }),
  service: z.object({
    serviceId: opt(60),
    service: s(120),
    slaDays: z.number().int().min(0).max(60).optional(),
    channel: z.enum(['mpp', 'online', 'kecamatan', 'dinas']).optional(),
    office: opt(120),
    fee: opt(80),
    steps: z.array(s(160)).max(8).optional(),
  }),
  booking: z.object({
    serviceId: opt(60),
    service: s(120),
    slot: z.string().trim().regex(/^([01]\d|2[0-3])[.:][0-5]\d$/),
    date: opt(40),
    office: opt(120),
    notes: opt(200),
  }),
  'ticket-status': z.object({
    ticketCode: s(30),
    status: z.enum(['baru', 'diverifikasi', 'diteruskan', 'diproses', 'selesai', 'tidak-ditemukan']),
    opd: opt(80),
    eta: opt(80),
    note: opt(240),
  }),
  briefing: z.object({
    items: z.array(z.object({ title: s(160), source: ProductSlugEnum, detail: opt(240) })).min(1).max(10),
    closing: opt(400),
  }),
  analysis: z.object({
    keywords: z.array(s(40)).min(1).max(4),
    periodDays: z.number().int().min(1).max(90),
    volumeTrend: z.enum(['naik', 'turun', 'stabil']),
    sentiment: z.object({ negatif: z.number().min(0).max(1), netral: z.number().min(0).max(1), positif: z.number().min(0).max(1) }),
    topics: z.array(z.object({ label: s(80), share: z.number().min(0).max(1) })).max(6),
    quotes: z.array(s(240)).max(5),
    surveyQuestions: z.array(s(200)).max(5),
  }),
  'audit-memo': z.object({
    title: s(160),
    findings: z.array(s(300)).min(1).max(8),
    hpsCorrected: z.number().min(0).optional(),
    recommendations: z.array(s(300)).min(1).max(6),
    inviteLocal: z.boolean(),
  }),
  reminder: z.object({
    to: s(120),
    message: s(600),
    dueText: opt(80),
  }),
} as const satisfies Record<string, z.ZodType<Record<string, unknown>>>

export type StructuredKind = keyof typeof STRUCTURED_SCHEMAS
export const STRUCTURED_KINDS = Object.keys(STRUCTURED_SCHEMAS) as StructuredKind[]

const StructuredEnvelope = z.object({ kind: z.string().min(1), data: z.record(z.string(), z.unknown()) })
const DEFAULT_SCHEMAS = new Map<string, z.ZodType<Record<string, unknown>>>(Object.entries(STRUCTURED_SCHEMAS))

/**
 * Validate a structured value: envelope + per-kind schema (a product's registerStructuredSchema() first, else the
 * STRUCTURED_SCHEMAS default). Unknown kinds pass with the envelope only. null when invalid.
 */
export function validateStructured(value: unknown): Structured | null {
  const env = StructuredEnvelope.safeParse(value)
  if (!env.success) return null
  const schema = customStructuredSchema(env.data.kind) ?? DEFAULT_SCHEMAS.get(env.data.kind)
  if (!schema) return env.data
  const p = schema.safeParse(env.data.data)
  return p.success ? { kind: env.data.kind, data: p.data as Record<string, unknown> } : null
}

/** `followups` event data (mirror of the proxy's FollowupsSchema). */
export const FOLLOWUPS_SCHEMA = z.object({
  chips: z.array(z.string().trim().min(1).max(60)).min(1).max(3),
})

/* ------------------------------------------------------------------ chunk mapping */

const TextData = z.object({ text: z.string() })
const ToolCallData = z.object({
  call: z.object({
    id: z.string().min(1).optional(),
    name: z.string().min(1),
    input: z.record(z.string(), z.unknown()).optional(),
    output: z.unknown().optional(),
    ms: z.number().optional(),
  }),
})
/** only the envelope here; provider.ts validates kind + data (STRUCTURED_SCHEMAS) and falls back when invalid */
const StructuredData = z.object({ value: z.object({ kind: z.unknown(), data: z.unknown() }) })
const FollowupsData = z.object({ chips: z.array(z.unknown()) })
const DoneData = z.object({ intentId: z.string().optional(), confidence: z.number().optional() })
const ErrorData = z.object({ code: z.string().optional(), message: z.string().optional(), status: z.number().optional() })

let toolSeq = 0

function parseData<T>(ev: SseEvent, schema: z.ZodType<T>): T {
  let raw: unknown
  try {
    raw = JSON.parse(ev.data)
  } catch {
    throw new LiveError('protocol', `malformed SSE data (${ev.event})`)
  }
  const p = schema.safeParse(raw)
  if (!p.success) throw new LiveError('protocol', `bad ${ev.event} event`)
  return p.data
}

/**
 * Map one SSE event to an AiChunk (null = ignore: keep-alive pings and event names this client does not know,
 * so the proxy can add events without breaking old clients). The event name decides; `data.type` is redundant.
 * Throws LiveError('upstream') on `error` events and LiveError('protocol') on malformed data.
 */
export function sseToChunk(ev: SseEvent): AiChunk | null {
  switch (ev.event) {
    case 'text':
      return { type: 'text', text: parseData(ev, TextData).text }
    case 'tool_call': {
      const c = parseData(ev, ToolCallData).call
      const call: ToolCall = { id: c.id ?? `live-${++toolSeq}`, name: c.name, input: c.input ?? {} }
      if (c.output !== undefined) call.output = c.output
      if (c.ms !== undefined) call.ms = c.ms
      return { type: 'tool_call', call }
    }
    case 'structured': {
      const v = parseData(ev, StructuredData).value
      return { type: 'structured', value: v as { kind: string; data: Record<string, unknown> } }
    }
    case 'followups': {
      const raw = parseData(ev, FollowupsData).chips
      const strict = FOLLOWUPS_SCHEMA.safeParse({ chips: raw })
      const chips = strict.success
        ? strict.data.chips
        : raw
            .filter((c): c is string => typeof c === 'string' && c.trim() !== '')
            .map((c) => c.trim().slice(0, 60))
            .slice(0, 3)
      return chips.length ? { type: 'followups', chips } : null
    }
    case 'done': {
      const d = parseData(ev, DoneData)
      const out: AiChunk = { type: 'done', mode: 'live' }
      if (d.intentId !== undefined) out.intentId = d.intentId
      if (d.confidence !== undefined) out.confidence = d.confidence
      return out
    }
    case 'error': {
      const e = parseData(ev, ErrorData)
      throw new LiveError('upstream', e.message ?? 'upstream error', e.status, e.code)
    }
    default:
      return null
  }
}

/* ------------------------------------------------------------------ chat */

/**
 * The history as the proxy accepts it: non-empty messages, each ≤ 4000 chars, the newest ≤ 40 messages
 * within ~48 KB, starting with a user turn (the proxy drops a leading assistant greeting anyway).
 */
export function wireMessages(messages: Msg[]): Msg[] {
  const out: Msg[] = []
  let bytes = 0
  for (let i = messages.length - 1; i >= 0 && out.length < LIVE.historyMaxMessages; i--) {
    const m = messages[i]!
    const content = m.content.trim().slice(0, LIVE.messageMaxChars)
    if (!content) continue
    bytes += byteLength(content) + 32
    if (out.length && bytes > LIVE.historyMaxBytes) break
    out.unshift({ role: m.role, content })
  }
  while (out.length > 1 && out[0]!.role === 'assistant') out.shift()
  return out
}

/**
 * Stream a live chat answer. Throws LiveError for: not configured, HTTP ≥ 400, a non-SSE 200, network failure,
 * abort, malformed SSE, an `error` event. Ends after the `done` chunk (or when the stream closes).
 */
export async function* liveChat(req: ChatRequest): AsyncGenerator<AiChunk> {
  if (cfg.baseUrl === null) throw new LiveError('unavailable', 'VITE_AI_PROXY_URL is not set')
  // `tools` is not sent: the proxy picks the tools per product (README → chat request)
  const body = JSON.stringify({
    product: req.product,
    role: req.role,
    lang: req.lang,
    messages: wireMessages(req.messages),
    context: summarize(req.context, LIVE.contextMaxBytes),
  })
  let res: Response
  try {
    res = await cfg.fetch(`${cfg.baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
      body,
      ...(req.signal ? { signal: req.signal } : {}),
    })
  } catch (e) {
    throw asLiveError(e, req.signal)
  }
  if (!res.ok) throw await httpError(res)
  const ctype = res.headers.get('content-type')
  if (ctype && !ctype.includes('text/event-stream')) throw new LiveError('protocol', `not an event stream (${ctype})`)
  if (!res.body) throw new LiveError('protocol', 'empty body')
  try {
    for await (const ev of parseSSE(res.body, req.signal)) {
      const chunk = sseToChunk(ev)
      if (!chunk) continue
      yield chunk
      if (chunk.type === 'done') return
    }
  } catch (e) {
    throw asLiveError(e, req.signal)
  }
  if (req.signal?.aborted) throw new LiveError('abort', 'aborted')
}

/* ------------------------------------------------------------------ extract */

const Bi = z.object({ id: z.string(), en: z.string() })
const Pct = z.number().min(0).max(100)
const Box = z.object({ x: Pct, y: Pct, w: Pct, h: Pct })
/** Body of POST /api/ai/extract — `Extracted` (types.ts); mirror of the proxy's ExtractedSchema. */
export const ExtractedSchema = z.object({
  kind: z.enum(['document', 'invoice', 'cv', 'ktp-specimen']),
  fields: z.array(
    z.object({ key: z.string(), label: Bi, value: z.string(), confidence: z.number().min(0).max(1), box: Box.optional() }),
  ),
  checks: z
    .array(z.object({ id: z.string(), label: Bi, status: z.enum(['ok', 'warn', 'fail']), note: z.string().optional() }))
    .optional(),
  tamper: z.array(Box.extend({ score: z.number().min(0).max(1) })).optional(),
  mode: z.enum(['sim', 'live']).optional(),
})

/** POST multipart {product, kind, text?, image?} to {base}/api/ai/extract; validated with zod. */
export async function liveExtract(req: ExtractRequest): Promise<Extracted> {
  if (cfg.baseUrl === null) throw new LiveError('unavailable', 'VITE_AI_PROXY_URL is not set')
  if (req.image && req.image.size > LIVE.extractMaxBytes) throw new LiveError('invalid', 'image larger than 8 MB')
  const form = new FormData()
  form.append('product', req.product)
  form.append('kind', req.kind)
  if (req.text) form.append('text', req.text)
  if (req.image) form.append('image', req.image, 'upload')
  let res: Response
  try {
    res = await cfg.fetch(`${cfg.baseUrl}/api/ai/extract`, {
      method: 'POST',
      body: form,
      headers: { accept: 'application/json' },
      ...(req.signal ? { signal: req.signal } : {}),
    })
  } catch (e) {
    throw asLiveError(e, req.signal)
  }
  if (!res.ok) throw await httpError(res)
  let json: unknown
  try {
    json = await res.json()
  } catch (e) {
    if (req.signal?.aborted) throw asLiveError(e, req.signal)
    throw new LiveError('protocol', 'extract: invalid JSON')
  }
  const p = ExtractedSchema.safeParse(json)
  if (!p.success) throw new LiveError('invalid', 'extract: schema mismatch')
  const out: Extracted = {
    kind: p.data.kind,
    fields: p.data.fields.map((f) => {
      const field: Extracted['fields'][number] = { key: f.key, label: f.label, value: f.value, confidence: f.confidence }
      if (f.box) field.box = f.box
      return field
    }),
    mode: 'live',
  }
  if (p.data.checks) out.checks = p.data.checks.map((c) => (c.note === undefined ? { id: c.id, label: c.label, status: c.status } : { ...c, note: c.note }))
  if (p.data.tamper) out.tamper = p.data.tamper
  return out
}
