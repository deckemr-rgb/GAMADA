/**
 * claude.ts — the two calls the proxy makes to the Claude API (@anthropic-ai/sdk).
 *
 * chat: streamed Messages API call with the product's tools. Structured outputs come back as tool
 * calls; each one is validated with zod and forwarded to the browser as `tool_call` + `structured`
 * events (`suggest_followups` → one `followups` event; see toolEvents in schemas.ts). The
 * tool result we send back is only an acknowledgement ("shown on screen") so the model can finish
 * its sentence — the site executes/visualises the result itself. Invalid input goes back to the
 * model as an `is_error` tool result for one correction (max AI_MAX_TOOL_ROUNDS model turns).
 *
 * Prompt caching: tools + the product system prompt form a frozen prefix (breakpoint 1); the
 * region pack excerpt follows as its own block (breakpoint 2). Volatile data — the world summary
 * and the session block — goes into the LAST user turn, after every breakpoint, so it never
 * invalidates the cache. Note the model-specific minimum cacheable prefix: short prompts simply
 * do not cache (cache_read_input_tokens stays 0), which is harmless.
 *
 * extract: one non-streamed vision call that must answer through the `record_extraction` tool.
 */
import Anthropic from '@anthropic-ai/sdk'
import type { Config } from './config.js'
import type { Budget } from './budget.js'
import { billableTokens } from './budget.js'
import { PROMPTS, EXTRACT_SYSTEM } from '../prompts/index.js'
import type { ChatRequest, ExtractKind, Extracted, ProxyEvent, ToolName, AcceptedFileType } from './schemas.js'
import { ExtractionToolSchema, TOOLS, splitContext, toExtracted, toInputSchema, toolEvents } from './schemas.js'
import type { ProductSlug } from './products.js'

export type Usage = { input: number; output: number; cacheRead: number; cacheWrite: number }
const zeroUsage = (): Usage => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 })

function addUsage(acc: Usage, u: Anthropic.Usage): void {
  acc.input += u.input_tokens ?? 0
  acc.output += u.output_tokens ?? 0
  acc.cacheRead += u.cache_read_input_tokens ?? 0
  acc.cacheWrite += u.cache_creation_input_tokens ?? 0
}

export function createClient(cfg: Config): Anthropic {
  // 1 SDK retry (429/5xx/connection) keeps us inside the site's 10 s first-token window.
  return new Anthropic({
    apiKey: cfg.apiKey,
    ...(cfg.baseUrl ? { baseURL: cfg.baseUrl } : {}),
    maxRetries: 1,
    timeout: 60_000,
  })
}

/** JSON.stringify with sorted keys — byte-stable, so the cached region block really caches. */
export function stableStringify(v: unknown): string {
  return JSON.stringify(v, (_k, val: unknown) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.fromEntries(Object.entries(val as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : val,
  )
}

const toolCache = new Map<string, Anthropic.Tool>()
function toolFor(name: ToolName): Anthropic.Tool {
  let t = toolCache.get(name)
  if (!t) {
    const def = TOOLS[name]
    t = { name: def.name, description: def.description, input_schema: toInputSchema(def.schema) }
    toolCache.set(name, t)
  }
  return t
}

export function toolNamesFor(product: ProductSlug): ToolName[] {
  return [...PROMPTS[product].tools, 'suggest_followups']
}

export function modelFor(cfg: Config, product: ProductSlug): { model: string; effort: Config['effortFast'] } {
  return PROMPTS[product].tier === 'smart'
    ? { model: cfg.modelSmart, effort: cfg.effortSmart }
    : { model: cfg.modelFast, effort: cfg.effortFast }
}

/** Builds the Messages API params (exported for the self-test; no network). */
export function buildChatParams(cfg: Config, req: ChatRequest) {
  const prompt = PROMPTS[req.product]
  const { model, effort } = modelFor(cfg, req.product)
  const { world, region } = splitContext(req.context)

  const system: Anthropic.TextBlockParam[] = [
    { type: 'text', text: prompt.system, cache_control: { type: 'ephemeral' } },
  ]
  if (region !== undefined && region !== null) {
    system.push({
      type: 'text',
      text: `<konteks_region>\n${stableStringify(region)}\n</konteks_region>`,
      cache_control: { type: 'ephemeral' },
    })
  }

  // The API wants the conversation to start with a user turn: drop a leading greeting.
  const history = [...req.messages]
  while (history.length && history[0]?.role === 'assistant') history.shift()

  const session = `<sesi peran="${req.role ?? 'tidak-diketahui'}" bahasa_antarmuka="${req.lang}" />`
  const worldBlock =
    world === undefined || world === null ? '' : `\n<konteks_dunia>\n${stableStringify(world)}\n</konteks_dunia>`

  const messages: Anthropic.MessageParam[] = history.map((m, i) =>
    i === history.length - 1
      ? {
          role: 'user',
          content: [
            { type: 'text', text: session + worldBlock },
            { type: 'text', text: m.content },
          ],
        }
      : { role: m.role, content: m.content },
  )

  return {
    model,
    max_tokens: cfg.maxOutputTokens,
    system,
    tools: toolNamesFor(req.product).map(toolFor),
    tool_choice: { type: 'auto' as const },
    messages,
    output_config: { effort },
  }
}

function issuesText(err: { issues: { path: PropertyKey[]; message: string }[] }): string {
  return err.issues
    .slice(0, 6)
    .map((i) => `${i.path.map(String).join('.') || '(root)'}: ${i.message}`)
    .join('; ')
}

const ACK: Record<string, string> = {
  query: 'Grafik/tabel ditampilkan di layar pengguna; angka rinci dihitung oleh layar. Lanjutkan penjelasan singkat dengan angka dari <konteks_dunia>.',
  followups: 'Chip ditampilkan.',
}

export interface ChatRun {
  usage: Usage
  model: string
  toolCalls: number
}

/**
 * Streams one chat answer as ProxyEvents. Throws Anthropic errors before/while streaming;
 * the HTTP layer maps them (before the first event → JSON status, after → SSE `error`).
 */
export async function* runChat(
  client: Anthropic,
  cfg: Config,
  budget: Budget,
  req: ChatRequest,
  signal: AbortSignal,
  run: ChatRun,
): AsyncGenerator<ProxyEvent, void> {
  const params = buildChatParams(cfg, req)
  run.model = params.model
  const allowed = new Set<string>(toolNamesFor(req.product))
  let convo = params.messages
  let lastStop: string | null = null

  for (let round = 1; ; round++) {
    const stream = client.messages.stream({ ...params, messages: convo }, { signal })
    for await (const ev of stream) {
      if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta' && ev.delta.text) {
        yield { type: 'text', text: ev.delta.text }
      }
    }
    const msg = await stream.finalMessage()
    addUsage(run.usage, msg.usage)
    await budget.add(billableTokens(msg.usage))
    lastStop = msg.stop_reason

    if (msg.stop_reason === 'refusal') {
      yield { type: 'error', code: 'refusal', message: 'The model declined this request.', retryable: false }
      return
    }

    const toolUses = msg.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
    if (msg.stop_reason !== 'tool_use' || toolUses.length === 0) break

    const results: Anthropic.ToolResultBlockParam[] = []
    let invalid = 0
    let onlyFollowups = true
    for (const tu of toolUses) {
      const def = allowed.has(tu.name) ? TOOLS[tu.name as ToolName] : undefined
      if (!def) {
        invalid++
        results.push({ type: 'tool_result', tool_use_id: tu.id, is_error: true, content: `Alat ${tu.name} tidak tersedia.` })
        continue
      }
      const parsed = def.schema.safeParse(tu.input)
      if (!parsed.success) {
        invalid++
        results.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          is_error: true,
          content: `Input tidak sesuai skema: ${issuesText(parsed.error)}. Perbaiki dan panggil lagi.`,
        })
        continue
      }
      if (def.kind !== 'followups') onlyFollowups = false
      run.toolCalls++
      const data = parsed.data as Record<string, unknown>
      yield* toolEvents(def, tu.id, data)
      results.push({ type: 'tool_result', tool_use_id: tu.id, content: ACK[def.kind] ?? 'Ditampilkan di layar pengguna.' })
    }

    if (invalid === 0 && onlyFollowups) break
    if (round >= cfg.maxToolRounds) {
      if (invalid > 0) {
        yield { type: 'error', code: 'invalid_structured', message: 'Structured output failed validation.', retryable: true }
        return
      }
      break
    }
    const b = await budget.status()
    if (!b.ok) {
      yield doneEvent(run, lastStop, { budgetExhausted: true })
      return
    }
    convo = [...convo, { role: 'assistant', content: msg.content }, { role: 'user', content: results }]
  }
  yield doneEvent(run, lastStop)
}

function doneEvent(run: ChatRun, stopReason: string | null, extra: { budgetExhausted?: boolean } = {}): ProxyEvent {
  return { type: 'done', mode: 'live', model: run.model, stopReason, usage: { ...run.usage }, ...extra }
}

export const newChatRun = (): ChatRun => ({ usage: zeroUsage(), model: '', toolCalls: 0 })

/* ------------------------------------------------------------------ extract */

export class InvalidOutputError extends Error {
  constructor(public detail: string) {
    super('invalid_output')
  }
}

export interface ExtractInput {
  product: ProductSlug
  kind: ExtractKind
  lang: 'id' | 'en'
  file?: { mime: AcceptedFileType; base64: string }
  text?: string
}

export async function runExtract(
  client: Anthropic,
  cfg: Config,
  budget: Budget,
  input: ExtractInput,
  signal: AbortSignal,
): Promise<{ extracted: Extracted; usage: Usage; model: string }> {
  const content: Anthropic.ContentBlockParam[] = []
  if (input.file) {
    if (input.file.mime === 'application/pdf') {
      content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: input.file.base64 } })
    } else {
      content.push({ type: 'image', source: { type: 'base64', media_type: input.file.mime, data: input.file.base64 } })
    }
  }
  if (input.text) content.push({ type: 'text', text: `<dokumen>\n${input.text}\n</dokumen>` })
  content.push({
    type: 'text',
    text: `Jenis dokumen: ${input.kind}. Produk: ${input.product}. Bahasa antarmuka: ${input.lang}. Panggil record_extraction sekarang.`,
  })

  const model = cfg.modelExtract
  const msg = await client.messages.create(
    {
      model,
      max_tokens: 4096,
      system: [{ type: 'text', text: EXTRACT_SYSTEM, cache_control: { type: 'ephemeral' } }],
      tools: [
        {
          name: 'record_extraction',
          description: 'Kirim hasil ekstraksi dokumen (fields, checks, tamper).',
          input_schema: toInputSchema(ExtractionToolSchema),
        },
      ],
      tool_choice: { type: 'auto' },
      messages: [{ role: 'user', content }],
      output_config: { effort: 'low' },
    },
    { signal },
  )
  const usage = zeroUsage()
  addUsage(usage, msg.usage)
  await budget.add(billableTokens(msg.usage))
  if (msg.stop_reason === 'refusal') throw new InvalidOutputError('refusal')
  const tu = msg.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'record_extraction')
  if (!tu) throw new InvalidOutputError('no record_extraction call')
  const parsed = ExtractionToolSchema.safeParse(tu.input)
  if (!parsed.success) throw new InvalidOutputError(issuesText(parsed.error))
  return { extracted: toExtracted(input.kind, parsed.data), usage, model }
}

/* ------------------------------------------------------------------ error mapping */

export interface MappedError {
  status: 400 | 413 | 429 | 499 | 500 | 502 | 503 | 504
  code: string
  message: string
  retryable: boolean
}

/** Maps SDK errors to HTTP statuses the site treats as "fall back to simulation" (429/5xx). */
export function mapError(err: unknown): MappedError {
  if (err instanceof InvalidOutputError) {
    return { status: 502, code: 'invalid_output', message: 'The model did not return valid structured output.', retryable: true }
  }
  if (err instanceof Anthropic.APIUserAbortError) {
    return { status: 499, code: 'aborted', message: 'Request aborted by the client.', retryable: false }
  }
  if (err instanceof Anthropic.RateLimitError) {
    return { status: 429, code: 'upstream_rate_limited', message: 'AI provider rate limit reached.', retryable: true }
  }
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return { status: 503, code: 'upstream_auth', message: 'AI provider credentials are not valid.', retryable: false }
  }
  if (err instanceof Anthropic.NotFoundError) {
    return { status: 502, code: 'upstream_model_not_found', message: 'Configured model was not found.', retryable: false }
  }
  if (err instanceof Anthropic.BadRequestError) {
    return { status: 502, code: 'upstream_bad_request', message: 'AI provider rejected the request.', retryable: false }
  }
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return { status: 504, code: 'upstream_timeout', message: 'AI provider timed out.', retryable: true }
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return { status: 503, code: 'upstream_unreachable', message: 'AI provider unreachable.', retryable: true }
  }
  if (err instanceof Anthropic.APIError) {
    return { status: 503, code: 'upstream_unavailable', message: 'AI provider unavailable.', retryable: true }
  }
  return { status: 500, code: 'internal', message: 'Internal error.', retryable: true }
}
