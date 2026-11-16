/**
 * ai/types.ts — the hybrid AI contract (spec §9). UI components only ever see AiProvider and
 * AiChunk; they do not know whether the simulation engine or the live proxy answered.
 */
import type { ProductSlug, RoleId } from '../../content/products'

export type Lang = 'id' | 'en'
export type Msg = { role: 'user' | 'assistant'; content: string }

/** A structured result (ticket, category, disposition, score …). Validated with zod per product. */
export type Structured = { kind: string; data: Record<string, unknown> }

/** One visualised agent step (shown in Inti Agen and as "langkah agent" chips). */
export type ToolCall = { id: string; name: string; input: Record<string, unknown>; output?: unknown; ms?: number }

export type AiChunk =
  | { type: 'text'; text: string }
  | { type: 'tool_call'; call: ToolCall }
  | { type: 'structured'; value: Structured }
  | { type: 'followups'; chips: string[] }
  | { type: 'done'; mode: 'sim' | 'live'; intentId?: string; confidence?: number; fellBack?: boolean }

export type ToolSpec = { name: string; description: string; input_schema: Record<string, unknown> }

export interface ChatRequest {
  product: ProductSlug
  role: RoleId
  lang: Lang
  messages: Msg[]
  /** compact, relevant world summary (≤ ~6 KB JSON when sent live) */
  context: unknown
  tools?: ToolSpec[]
  /** abort when the user resets / navigates */
  signal?: AbortSignal
}

export type ExtractKind = 'document' | 'invoice' | 'cv' | 'ktp-specimen'
export interface ExtractRequest {
  product: ProductSlug
  kind: ExtractKind
  image?: Blob
  text?: string
  /** simulation: id of a bundled sample document */
  sampleId?: string
  signal?: AbortSignal
}
export interface ExtractedField {
  key: string
  label: { id: string; en: string }
  value: string
  confidence: number
  /** bounding box in % of the page */
  box?: { x: number; y: number; w: number; h: number }
}
export interface Extracted {
  kind: ExtractKind
  fields: ExtractedField[]
  checks?: { id: string; label: { id: string; en: string }; status: 'ok' | 'warn' | 'fail'; note?: string }[]
  /** 0..1 edit-likelihood heat cells (for TamperHeatmap) */
  tamper?: { x: number; y: number; w: number; h: number; score: number }[]
  mode: 'sim' | 'live'
}

export interface AiProvider {
  mode: 'sim' | 'live'
  chat(req: ChatRequest): AsyncIterable<AiChunk>
  extract(req: ExtractRequest): Promise<Extracted>
}

/* ---------------------------------------------------------------- simulation DSL (§9.2) */

/** What a scenario's respond() receives. `world` is the live world snapshot (typed in world/types). */
export interface SimContext<W = unknown> {
  world: W
  lang: Lang
  role: RoleId
  product: ProductSlug
  /** last user message (raw) */
  text: string
  history: Msg[]
}

export interface SimResponse {
  /** final answer text (already in the user's language; may depend on world state) */
  text: string
  /** optional small translation shown under the answer (e.g. regional language → ID) */
  translation?: string
  structured?: Structured
  toolCalls?: Omit<ToolCall, 'id'>[]
  followUps?: string[]
  /** side effects the scenario wants (world events); the caller emits them after streaming */
  emits?: { type: string; payload: Record<string, unknown> }[]
}

export interface Intent<W = unknown> {
  id: string
  /** examples in ID, EN and regional languages — the matcher learns from these */
  examples: string[]
  /** optional slot extractors (regex or keyword lists) */
  slots?: Record<string, RegExp | string[]>
  respond: (ctx: SimContext<W>, slots: Record<string, string>) => SimResponse
}

export interface Scenario<W = unknown> {
  product: ProductSlug
  intents: Intent<W>[]
  /** confidence threshold under which the fallback answers (default 0.32) */
  threshold?: number
  fallback: (ctx: SimContext<W>) => SimResponse
  /** extraction answers for bundled sample docs */
  extract?: (req: ExtractRequest) => Extracted
}

export interface IntentMatch {
  intentId: string | null
  confidence: number
  slots: Record<string, string>
  /** top 3 candidates (for "maksud Anda…?" chips) */
  candidates: { intentId: string; confidence: number }[]
}
