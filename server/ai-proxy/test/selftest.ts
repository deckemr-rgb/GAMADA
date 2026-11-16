/**
 * selftest.ts — `npm test`. No network, no API key. Runs in-process against the Hono app and a
 * local fake Claude API (SSE) server, so the real streaming + tool loop is exercised.
 */
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createApp, sniffType } from '../src/app.js'
import { PRODUCT_SLUGS, ROLE_IDS } from '../src/products.js'
import { PROMPTS } from '../prompts/index.js'
import { TOOLS, ExtractedSchema, toInputSchema, ChatRequestSchema, STRUCTURED_KINDS } from '../src/schemas.js'
import type { ToolName } from '../src/schemas.js'
import { MOCK_STRUCTURED, mockExtract } from '../src/mock.js'
import { buildChatParams } from '../src/claude.js'
import { readConfig } from '../src/config.js'
import { MemoryStore } from '../src/kv.js'
import { createBudget, billableTokens, dayKeyWib } from '../src/budget.js'

let passed = 0
let failed = 0
function ok(cond: unknown, name: string, extra?: unknown): void {
  if (cond) {
    passed++
    console.log(`  ok   ${name}`)
  } else {
    failed++
    console.log(`  FAIL ${name}`, extra ?? '')
  }
}
const section = (s: string) => console.log(`\n# ${s}`)

const ORIGIN = 'http://127.0.0.1:5173'
type Ev = { event: string; data: Record<string, unknown> }
function parseSSE(text: string): Ev[] {
  return text
    .split(/\r?\n\r?\n/)
    .map((block) => {
      let event = 'message'
      const data: string[] = []
      for (const line of block.split(/\r?\n/)) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) data.push(line.slice(5).trimStart())
      }
      return data.length ? { event, data: JSON.parse(data.join('\n')) as Record<string, unknown> } : null
    })
    .filter((e): e is Ev => e !== null)
}
const chatBody = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    product: 'sapa-warga',
    role: 'warga',
    lang: 'id',
    messages: [{ role: 'user', content: 'Dalan ing desa kula kebanjiran' }],
    context: { region: { id: 'bojonegoro', name: 'Kabupaten Bojonegoro' }, world: { complaintsToday: 12 } },
    ...over,
  })
const post = (app: ReturnType<typeof createApp>, url: string, body: BodyInit, headers: Record<string, string> = {}) =>
  app.request(url, { method: 'POST', body, headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers } })

/* ------------------------------------------------------------------ registry */
section('registry & prompts')
const here = path.dirname(fileURLToPath(import.meta.url))
const siteProducts = path.resolve(here, '../../../src/content/products.ts')
if (existsSync(siteProducts)) {
  const src = readFileSync(siteProducts, 'utf8')
  const siteSlugs = [...src.matchAll(/slug:\s*'([a-z-]+)'/g)].map((m) => m[1]).sort()
  ok(JSON.stringify(siteSlugs) === JSON.stringify([...PRODUCT_SLUGS].sort()), 'PRODUCT_SLUGS match src/content/products.ts', siteSlugs)
  const roleBlock = src.slice(src.indexOf('export type RoleId'), src.indexOf('export const ROLES'))
  const siteRoles = [...roleBlock.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]).sort()
  ok(JSON.stringify(siteRoles) === JSON.stringify([...ROLE_IDS].sort()), 'ROLE_IDS match RoleId in products.ts', siteRoles)
} else {
  console.log('  skip site registry parity (site repo not present)')
}
ok(PRODUCT_SLUGS.every((s) => PROMPTS[s]?.slug === s), 'a prompt exists for all 18 slugs')
ok(PRODUCT_SLUGS.length === 18, '18 product slugs')
for (const s of PRODUCT_SLUGS) {
  const p = PROMPTS[s]
  const good = p.system.length > 800 && p.tools.length > 0 && p.tools.every((t) => t in TOOLS)
  if (!good) ok(false, `prompt ${s} well-formed`)
}
ok(true, 'every prompt has role/scope/output text and only registered tools')
ok(PROMPTS['naskah-pintar'].tier === 'smart' && PROMPTS['sapa-warga'].tier === 'fast', 'tiers: minutes=smart, chat=fast')

section('schemas')
for (const name of Object.keys(TOOLS) as ToolName[]) {
  const js = toInputSchema(TOOLS[name].schema)
  const r = TOOLS[name].schema.safeParse(MOCK_STRUCTURED[name])
  if (js.type !== 'object' || '$schema' in js || !r.success) ok(false, `tool ${name}`, r.success ? js : r.error.issues)
}
ok(true, `${Object.keys(TOOLS).length} tool schemas convert to JSON Schema and accept their mock example`)
ok(STRUCTURED_KINDS.length === 24 && new Set(STRUCTURED_KINDS).size === 24 && !STRUCTURED_KINDS.includes('followups'), '24 distinct structured kinds (+ followups)')
for (const k of ['document', 'invoice', 'cv', 'ktp-specimen'] as const) {
  ok(ExtractedSchema.safeParse(mockExtract(k)).success, `mockExtract(${k}) matches Extracted`)
}
ok(!ChatRequestSchema.safeParse(JSON.parse(chatBody({ product: 'kasirku' }))).success, 'unknown slug rejected by schema')
ok(
  !ChatRequestSchema.safeParse(JSON.parse(chatBody({ messages: [{ role: 'assistant', content: 'halo' }] }))).success,
  'last message must be from the user',
)
ok(sniffType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0])) === 'image/png' && sniffType(new TextEncoder().encode('hello')) === null, 'magic-byte sniffing')

section('prompt caching layout')
{
  const cfg = readConfig({})
  const req = ChatRequestSchema.parse(
    JSON.parse(chatBody({ messages: [{ role: 'assistant', content: 'Sugeng rawuh' }, { role: 'user', content: 'Tolong' }] })),
  )
  const p1 = buildChatParams(cfg, req)
  const p2 = buildChatParams(cfg, { ...req, context: { world: { complaintsToday: 99 }, region: { name: 'Kabupaten Bojonegoro', id: 'bojonegoro' } } })
  ok(p1.model === 'claude-haiku-5-5' && p1.output_config.effort === 'low', 'sapa-warga → AI_MODEL_FAST, effort low')
  ok(buildChatParams(cfg, { ...req, product: 'meja-pimpinan' }).model === 'claude-sonnet-5-5', 'meja-pimpinan → AI_MODEL_SMART')
  ok(cfg.modelExtract === cfg.modelSmart && readConfig({ AI_MODEL_SMART: 'x-smart' }).modelExtract === 'x-smart' && readConfig({ AI_MODEL_EXTRACT: 'x-ex' }).modelExtract === 'x-ex', 'AI_MODEL_EXTRACT defaults to AI_MODEL_SMART')
  ok(cfg.dailyTokenBudget === 2_000_000, 'daily budget default 2 000 000 tokens')
  ok(p1.system.length === 2 && p1.system.every((b) => b.cache_control?.type === 'ephemeral'), 'system prompt + region block both carry cache_control')
  ok(JSON.stringify(p1.system) === JSON.stringify(p2.system) && JSON.stringify(p1.tools) === JSON.stringify(p2.tools), 'cached prefix byte-stable when world changes and region key order differs')
  ok(p1.messages.length === 1 && p1.messages[0]?.role === 'user', 'leading assistant greeting dropped')
  const lastContent = JSON.stringify(p1.messages[0]?.content)
  ok(lastContent.includes('konteks_dunia') && !JSON.stringify(p1.system).includes('complaintsToday'), 'world summary lives in the last user turn, not in the cached system')
}

section('budget')
{
  const store = new MemoryStore()
  const b = createBudget(store, 1000)
  ok((await b.status()).ok, 'budget ok when unused')
  await b.add(billableTokens({ input_tokens: 600, output_tokens: 300, cache_read_input_tokens: 1000 }))
  ok((await b.status()).used === 1000 && !(await b.status()).ok, 'billable = in + out + cacheRead/10; exhausted at limit')
  ok(/^\d{4}-\d{2}-\d{2}$/.test(dayKeyWib()), 'WIB day key')
}

/* ------------------------------------------------------------------ mock mode over HTTP */
section('AI_MOCK=1 over HTTP')
{
  const app = createApp({ AI_MOCK: '1', AI_MOCK_DELAY_MS: '0', LOG_LEVEL: 'silent' })
  const h = await app.request('/api/ai/health')
  const hj = (await h.json()) as Record<string, unknown>
  ok(h.status === 200 && hj.ok === true && hj.live === true && hj.mock === true, 'health → ok, live:true, mock:true', hj)
  ok(h.headers.get('x-content-type-options') === 'nosniff' && h.headers.get('content-security-policy')?.includes("default-src 'none'"), 'security headers')
  ok(h.headers.get('cache-control') === 'no-store', 'Cache-Control: no-store')

  const r = await post(app, '/api/ai/chat', chatBody())
  ok(r.status === 200 && r.headers.get('content-type')?.startsWith('text/event-stream'), 'chat → 200 text/event-stream')
  ok(r.headers.get('access-control-allow-origin') === ORIGIN, 'CORS echoes allowed origin')
  const evs = parseSSE(await r.text())
  const types = evs.map((e) => e.event)
  const tail = types.slice(types.indexOf('tool_call'))
  ok(types[0] === 'text' && JSON.stringify(tail) === JSON.stringify(['tool_call', 'structured', 'followups', 'done']), 'events: text… tool_call, structured, followups, done', types)
  ok(evs.every((e) => e.data.type === e.event), 'every data.type equals its event name')
  const tc = evs.find((e) => e.event === 'tool_call')?.data as { call?: { name: string; input: unknown } } | undefined
  const st = evs.find((e) => e.event === 'structured')?.data as { value?: { kind: string; data: unknown } } | undefined
  ok(tc?.call?.name === 'create_ticket' && st?.value?.kind === 'ticket' && TOOLS.create_ticket.schema.safeParse(st.value.data).success, 'tool_call step + structured carries a valid ticket')
  const fu = evs.find((e) => e.event === 'followups')?.data as { chips?: unknown } | undefined
  ok(Array.isArray(fu?.chips) && (fu.chips as unknown[]).length === 2 && !evs.some((e) => e.event === 'tool_call' && (e.data as { call: { name: string } }).call.name === 'suggest_followups'), 'suggest_followups → one followups event, no tool_call step')
  ok((evs.at(-1)?.data as { mode?: string; mock?: boolean }).mode === 'live' && (evs.at(-1)?.data as { mock?: boolean }).mock === true, 'done: mode live, mock true')
  const r2 = parseSSE(await (await post(app, '/api/ai/chat', chatBody())).text())
  ok(JSON.stringify(r2) === JSON.stringify(evs), 'mock output is deterministic')

  const en = parseSSE(await (await post(app, '/api/ai/chat', chatBody({ lang: 'en', product: 'naskah-pintar', role: 'sekretariat' }))).text())
  ok(String(en[0]?.data.text).startsWith('[Test'), 'EN mock text when lang=en')
  ok(en.some((e) => e.event === 'structured' && (e.data as { value: { kind: string } }).value.kind === 'minutes'), 'naskah-pintar mock → minutes')

  const err = parseSSE(await (await post(app, '/api/ai/chat', chatBody({ messages: [{ role: 'user', content: 'tes [mock:error]' }] }))).text())
  ok(err.at(-1)?.event === 'error' && err.some((e) => e.event === 'text'), '[mock:error] → text then SSE error')
  const r429 = await post(app, '/api/ai/chat', chatBody({ messages: [{ role: 'user', content: '[mock:429]' }] }))
  ok(r429.status === 429 && r429.headers.get('retry-after') === '30', '[mock:429] → HTTP 429 + Retry-After')
  const inv = parseSSE(await (await post(app, '/api/ai/chat', chatBody({ messages: [{ role: 'user', content: '[mock:invalid]' }] }))).text())
  ok(inv.some((e) => e.event === 'structured' && !TOOLS.create_ticket.schema.safeParse((e.data as { value: { data: unknown } }).value.data).success), '[mock:invalid] → invalid structured for client fallback tests')

  const bad = await post(app, '/api/ai/chat', chatBody({ product: 'kasirku' }))
  const bj = (await bad.json()) as { error: { code: string; issues?: string[] } }
  ok(bad.status === 400 && bj.error.code === 'invalid_request' && bj.error.issues?.[0]?.startsWith('product'), 'unregistered slug → 400 invalid_request')
  ok((await post(app, '/api/ai/chat', '{nope')).status === 400, 'malformed JSON → 400')
  const big = await post(app, '/api/ai/chat', chatBody({ context: { world: { pad: 'x'.repeat(70_000) } } }))
  ok(big.status === 413, 'chat body > 64 KB → 413', big.status)
  const foreign = await post(app, '/api/ai/chat', chatBody(), { origin: 'https://evil.example' })
  ok(foreign.status === 403 && !foreign.headers.get('access-control-allow-origin'), 'foreign origin → 403, no ACAO')
  const pre = await app.request('/api/ai/chat', { method: 'OPTIONS', headers: { origin: ORIGIN, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' } })
  ok(pre.status === 204 && pre.headers.get('access-control-allow-origin') === ORIGIN, 'CORS preflight 204')

  const ex = await post(app, '/api/ai/extract', JSON.stringify({ product: 'pajak-beres', kind: 'invoice', text: 'NOTA TOKO CONTOH total 1.250.000' }))
  const exj = await ex.json()
  ok(ex.status === 200 && ExtractedSchema.strict().safeParse(exj).success && ex.headers.get('x-ai-mock') === '1', 'extract (JSON text) → exactly Extracted (mock flag in X-AI-Mock header)', exj)
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
  const fd = new FormData()
  fd.set('product', 'cek-berkas')
  fd.set('kind', 'ktp-specimen')
  fd.set('image', new File([png], 'ktp.png', { type: 'image/png' }))
  const exm = await app.request('/api/ai/extract', { method: 'POST', body: fd, headers: { origin: ORIGIN } })
  ok(exm.status === 200 && ((await exm.json()) as { kind: string }).kind === 'ktp-specimen', 'extract (multipart image) → 200')
  const fake = new FormData()
  fake.set('product', 'cek-berkas')
  fake.set('kind', 'document')
  fake.set('image', new File([new TextEncoder().encode('<script>')], 'x.png', { type: 'image/png' }))
  ok((await app.request('/api/ai/extract', { method: 'POST', body: fake, headers: { origin: ORIGIN } })).status === 415, 'mislabelled upload → 415 (magic bytes)')
  const huge = new FormData()
  huge.set('product', 'cek-berkas')
  huge.set('kind', 'document')
  const hugeBytes = new Uint8Array(8 * 1024 * 1024 + 10)
  hugeBytes.set([0xff, 0xd8, 0xff])
  huge.set('image', new File([hugeBytes], 'big.jpg', { type: 'image/jpeg' }))
  ok((await app.request('/api/ai/extract', { method: 'POST', body: huge, headers: { origin: ORIGIN } })).status === 413, 'image > 8 MB → 413')
  ok((await app.request('/api/ai/nope')).status === 404, 'unknown route → 404 JSON')
}

section('no key, no mock')
{
  const app = createApp({ LOG_LEVEL: 'silent' })
  const hj = (await (await app.request('/api/ai/health')).json()) as Record<string, unknown>
  ok(hj.live === false && hj.reason === 'no_api_key', 'health → live:false, reason no_api_key', hj)
  const r = await post(app, '/api/ai/chat', chatBody())
  const j = (await r.json()) as { error: { code: string } }
  ok(r.status === 503 && j.error.code === 'not_configured' && r.headers.get('content-type')?.includes('application/json'), 'chat → 503 JSON not_configured')
  const e = await post(app, '/api/ai/extract', JSON.stringify({ product: 'cek-berkas', kind: 'document', text: 'surat' }))
  ok(e.status === 503, 'extract → 503')
}

section('rate limit')
{
  const app = createApp({ AI_MOCK: '1', AI_MOCK_DELAY_MS: '0', RATE_LIMIT_PER_IP: '2', LOG_LEVEL: 'silent' })
  const hdr = { 'x-forwarded-for': '203.0.113.7' }
  const a = await post(app, '/api/ai/chat', chatBody(), hdr)
  await a.text()
  const b = await post(app, '/api/ai/chat', chatBody(), hdr)
  await b.text()
  const c = await post(app, '/api/ai/chat', chatBody(), hdr)
  ok(a.status === 200 && b.status === 200 && c.status === 429 && Number(c.headers.get('retry-after')) > 0, '3rd request in window → 429 + Retry-After')
  const other = await post(app, '/api/ai/chat', chatBody(), { 'x-forwarded-for': '198.51.100.1' })
  await other.text()
  ok(other.status === 200, 'other IP unaffected')
  ok((await app.request('/api/ai/health', { headers: hdr })).status === 200, 'health not rate limited')
}

/* ------------------------------------------------------------------ live path vs fake Claude API */
section('live path against a local fake Claude API')
{
  const seen: Record<string, unknown>[] = []
  const sse = (events: [string, unknown][]) => events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join('')
  const msgStart = (id: string) => ['message_start', { type: 'message_start', message: { id, type: 'message', role: 'assistant', model: 'claude-haiku-5-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 120, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 900 } } }] as [string, unknown]
  const textBlock = (i: number, t: string): [string, unknown][] => [
    ['content_block_start', { type: 'content_block_start', index: i, content_block: { type: 'text', text: '' } }],
    ['content_block_delta', { type: 'content_block_delta', index: i, delta: { type: 'text_delta', text: t } }],
    ['content_block_stop', { type: 'content_block_stop', index: i }],
  ]
  const toolBlock = (i: number, id: string, name: string, input: unknown): [string, unknown][] => [
    ['content_block_start', { type: 'content_block_start', index: i, content_block: { type: 'tool_use', id, name, input: {} } }],
    ['content_block_delta', { type: 'content_block_delta', index: i, delta: { type: 'input_json_delta', partial_json: JSON.stringify(input) } }],
    ['content_block_stop', { type: 'content_block_stop', index: i }],
  ]
  const end = (stop: string): [string, unknown][] => [
    ['message_delta', { type: 'message_delta', delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: 40 } }],
    ['message_stop', { type: 'message_stop' }],
  ]
  let mode: 'ok' | 'invalid' | '429' = 'ok'
  const server = createServer((req, res) => {
    let body = ''
    req.on('data', (d: Buffer) => (body += d.toString()))
    req.on('end', () => {
      const j = JSON.parse(body) as Record<string, unknown> & { messages: unknown[] }
      seen.push(j)
      if (mode === '429') {
        res.writeHead(429, { 'content-type': 'application/json', 'retry-after': '0' })
        res.end(JSON.stringify({ type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } }))
        return
      }
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      const first = j.messages.length === 1
      if (first) {
        const ticket = mode === 'invalid' ? { category: 'Banjir' } : MOCK_STRUCTURED.create_ticket
        res.end(sse([msgStart('m1'), ...textBlock(0, 'Nggih, kula damelaken tiket. '), ...toolBlock(1, 'tu_1', 'create_ticket', ticket), ...end('tool_use')]))
      } else {
        res.end(sse([msgStart('m2'), ...textBlock(0, 'Tiket sampun dipun terusaken dhateng BPBD.'), ...end('end_turn')]))
      }
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const app = createApp({ ANTHROPIC_API_KEY: 'sk-test', ANTHROPIC_BASE_URL: base, LOG_LEVEL: 'silent' })

  const hj = (await (await app.request('/api/ai/health')).json()) as Record<string, unknown>
  ok(hj.live === true && hj.mock === false, 'health live:true with a key')
  const evs = parseSSE(await (await post(app, '/api/ai/chat', chatBody())).text())
  const types = evs.map((e) => e.event)
  ok(JSON.stringify(types) === JSON.stringify(['text', 'tool_call', 'structured', 'text', 'done']), 'stream: text, tool_call, structured, text (after tool_result), done', types)
  const done = evs.at(-1)?.data as { usage: { input: number; output: number; cacheRead: number }; stopReason: string }
  ok(done.usage.input === 240 && done.usage.output === 80 && done.usage.cacheRead === 1800 && done.stopReason === 'end_turn', 'usage summed over both model turns', done)
  const req1 = seen[0] as { system: { cache_control?: unknown }[]; tools: { name: string }[]; output_config: { effort: string }; model: string; tool_choice: { type: string } }
  ok(req1.model === 'claude-haiku-5-5' && req1.output_config.effort === 'low' && req1.tool_choice.type === 'auto', 'request: model, effort, tool_choice auto')
  ok(req1.system.every((b) => b.cache_control) && req1.tools.map((t) => t.name).join() === 'create_ticket,service_checklist,suggest_followups', 'request: cached system blocks + product tools')
  const req2 = seen[1] as { messages: { role: string; content: { type: string; is_error?: boolean }[] }[] }
  ok(req2.messages.at(-1)?.content[0]?.type === 'tool_result' && !req2.messages.at(-1)?.content[0]?.is_error, 'second turn sends tool_result ack')

  seen.length = 0
  mode = 'invalid'
  const inv = parseSSE(await (await post(app, '/api/ai/chat', chatBody())).text())
  ok(!inv.some((e) => e.event === 'tool_call' || e.event === 'structured'), 'invalid tool input is never forwarded to the browser')
  const retry = seen[1] as { messages: { content: { is_error?: boolean }[] }[] } | undefined
  ok(retry?.messages.at(-1)?.content[0]?.is_error === true, 'invalid tool input → is_error tool_result back to the model')

  mode = '429'
  const r429 = await post(app, '/api/ai/chat', chatBody())
  const j429 = (await r429.json()) as { error: { code: string } }
  ok(r429.status === 429 && j429.error.code === 'upstream_rate_limited', 'upstream 429 before first token → HTTP 429 JSON (client falls back)')

  const budgetApp = createApp({ ANTHROPIC_API_KEY: 'sk-test', ANTHROPIC_BASE_URL: base, AI_DAILY_TOKEN_BUDGET: '100', LOG_LEVEL: 'silent' })
  mode = 'ok'
  await (await post(budgetApp, '/api/ai/chat', chatBody())).text()
  const hb = (await (await budgetApp.request('/api/ai/health')).json()) as Record<string, unknown>
  ok(hb.live === false && hb.reason === 'budget_exhausted', 'budget spent → health live:false')
  const rb = await post(budgetApp, '/api/ai/chat', chatBody())
  ok(rb.status === 503 && ((await rb.json()) as { error: { code: string } }).error.code === 'budget_exhausted', 'budget spent → chat 503 budget_exhausted')
  server.close()
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
