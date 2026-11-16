/**
 * Self-test: live provider with a fake fetch — success, first-token timeout, 503, 429, network error,
 * malformed SSE, mid-stream error, invalid structured, caller abort, health timeout + cache, extract fallback.
 * Run: npx tsx src/demo-kit/ai/__tests__/fallback.test.ts
 */
import { configureLive, checkHealth, parseSSE, peekHealth } from '../live'
import { createLiveProvider, getAi, onLiveFallback, registerScenario, unregisterScenario, type FallbackInfo } from '../provider'
import { sampleScenario, createFixtureWorld } from '../__fixtures__/sample-scenario'
import type { AiChunk, ChatRequest } from '../types'

function assert(c: unknown, msg: string): asserts c {
  if (!c) throw new Error(msg)
}

const enc = new TextEncoder()
function sseBody(parts: string[], gapMs = 5, hang = false): ReadableStream<Uint8Array> {
  return new ReadableStream({
    async start(ctrl) {
      for (const p of parts) {
        await new Promise((r) => setTimeout(r, gapMs))
        ctrl.enqueue(enc.encode(p))
      }
      if (!hang) ctrl.close()
    },
  })
}
const ev = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`

type Handler = (url: string, init?: RequestInit) => Promise<Response>
let calls: string[] = []
function useFetch(h: Handler) {
  calls = []
  configureLive({
    baseUrl: 'https://proxy.test/',
    fetch: (url, init) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`)
      return h(url, init)
    },
  })
}

const req = (text: string, signal?: AbortSignal): ChatRequest => ({
  product: 'sapa-warga',
  role: 'warga',
  lang: 'id',
  messages: [{ role: 'user', content: text }],
  context: createFixtureWorld(),
  ...(signal ? { signal } : {}),
})

async function collect(it: AsyncIterable<AiChunk>) {
  const out: AiChunk[] = []
  for await (const c of it) out.push(c)
  const text = out.filter((c): c is Extract<AiChunk, { type: 'text' }> => c.type === 'text').map((c) => c.text).join('')
  const done = out.find((c): c is Extract<AiChunk, { type: 'done' }> => c.type === 'done')
  const structured = out.filter((c): c is Extract<AiChunk, { type: 'structured' }> => c.type === 'structured').map((c) => c.value)
  return { out, text, done, structured }
}

async function main() {
  registerScenario(sampleScenario)
  const fallbacks: FallbackInfo[] = []
  const off = onLiveFallback((i) => fallbacks.push(i))
  const live = createLiveProvider({ firstTokenTimeoutMs: 250 })
  const Q = 'Jam buka MPP kapan?'

  // 0. SSE parser edge cases: CRLF, split chunks, comments, multi-line data
  {
    const body = sseBody([': keep-alive\r\n', 'event: text\r\nda', 'ta: {"text":"a"}\r\n\r\n', 'data: line1\ndata: line2\n\n'])
    const evs = []
    for await (const e of parseSSE(body)) evs.push(e)
    assert(evs.length === 2 && evs[0]!.event === 'text' && evs[0]!.data === '{"text":"a"}' && evs[1]!.data === 'line1\nline2', `sse parse ${JSON.stringify(evs)}`)
    console.log('sse parser: CRLF, split chunks, comments, multi-line data OK')
  }

  // 1. success
  useFetch(async () =>
    new Response(
      sseBody([
        ev('text', { text: 'Halo ' }),
        ev('text', { text: 'dari live.' }),
        ev('tool_call', { call: { name: 'search', input: { q: 'x' }, ms: 40 } }),
        ev('structured', { value: { kind: 'info', data: { place: 'MPP' } } }),
        ev('followups', { chips: ['Syarat KTP?'] }),
        ev('done', { confidence: 0.9 }),
      ]),
      { status: 200, headers: { 'content-type': 'text/event-stream' } },
    ),
  )
  {
    const r = await collect(live.chat(req(Q)))
    assert(r.text === 'Halo dari live.', `live text "${r.text}"`)
    assert(r.done?.mode === 'live' && !r.done.fellBack, 'live done')
    assert(r.structured.length === 1 && r.out.some((c) => c.type === 'tool_call'), 'live chunks')
    assert(calls[0] === 'POST https://proxy.test/api/ai/chat', `url ${calls[0]}`)
    console.log('live success: OK')
  }

  // 2–6. full fallbacks
  const cases: [string, Handler, string][] = [
    ['first-token timeout', async () => new Response(sseBody([': waiting\n\n'], 5, true), { status: 200 }), 'timeout'],
    ['HTTP 503', async () => new Response('busy', { status: 503 }), 'http'],
    ['HTTP 429', async () => new Response('slow down', { status: 429 }), 'http'],
    ['network error', async () => Promise.reject(new TypeError('Failed to fetch')), 'network'],
    ['malformed SSE', async () => new Response(sseBody(['event: text\ndata: {not json\n\n']), { status: 200 }), 'protocol'],
    ['error event', async () => new Response(sseBody([ev('error', { message: 'budget', status: 429 })]), { status: 200 }), 'upstream'],
  ]
  for (const [name, h, reason] of cases) {
    useFetch(h)
    fallbacks.length = 0
    const t0 = performance.now()
    const r = await collect(live.chat(req(Q)))
    assert(r.done?.mode === 'sim' && r.done.fellBack === true, `${name}: done ${JSON.stringify(r.done)}`)
    assert(r.text.startsWith('Mal Pelayanan Publik buka'), `${name}: sim text continues ("${r.text.slice(0, 30)}")`)
    assert(fallbacks.length === 1 && fallbacks[0]!.reason === reason, `${name}: reason ${fallbacks[0]?.reason}`)
    console.log(`fallback on ${name}: OK (${Math.round(performance.now() - t0)} ms, reason ${reason})`)
  }

  // 7. mid-stream failure after text: no duplicated text, sim structured appended
  useFetch(async () => new Response(sseBody([ev('text', { text: 'Sebagian ' }), 'event: text\ndata: {broken\n\n']), { status: 200 }))
  {
    fallbacks.length = 0
    const r = await collect(live.chat(req(Q)))
    assert(r.text === 'Sebagian ', `partial text kept only ("${r.text}")`)
    assert(r.structured[0]?.kind === 'info' && r.done?.fellBack && r.done.mode === 'live', 'sim structured after partial live text')
    console.log('mid-stream failure: OK')
  }

  // 8. invalid structured → sim structured
  useFetch(async () => new Response(sseBody([ev('text', { text: 'Ok.' }), ev('structured', { value: { kind: '', data: 5 } }), ev('done', {})]), { status: 200 }))
  {
    fallbacks.length = 0
    const r = await collect(live.chat(req(Q)))
    assert(r.structured.length === 1 && r.structured[0]!.kind === 'info' && r.structured[0]!.data.place === 'MPP', `sim structured ${JSON.stringify(r.structured)}`)
    assert(r.done?.fellBack === true && fallbacks[0]?.reason === 'invalid', 'invalid structured flagged')
    console.log('invalid structured → sim structured: OK')
  }

  // 9. caller abort: no fallback, stream ends quietly
  useFetch(async (_u, init) => new Response(sseBody([ev('text', { text: 'a ' }), ev('text', { text: 'b ' }), ev('text', { text: 'c' })], 80), { status: 200, ...(init ? {} : {}) }))
  {
    fallbacks.length = 0
    const ctrl = new AbortController()
    setTimeout(() => ctrl.abort(), 120)
    const r = await collect(live.chat(req(Q, ctrl.signal)))
    assert(!r.done && fallbacks.length === 0, `abort: ${JSON.stringify(r.out)}`)
    console.log('caller abort: OK')
  }

  // 10. not configured → immediate sim
  configureLive({ baseUrl: null })
  {
    fallbacks.length = 0
    const r = await collect(getAi('live').chat(req(Q)))
    assert(r.done?.mode === 'sim' && r.done.fellBack && (fallbacks[0]?.reason as string | undefined) === 'unavailable', 'unconfigured → sim')
    const h = await checkHealth()
    assert(!h.ok && !h.live, 'health without proxy')
    console.log('no proxy: OK')
  }

  // 11. health: timeout (3 s) + cache + dedupe
  useFetch((_u, init) => new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))))
  {
    const t0 = performance.now()
    const [a, b] = await Promise.all([checkHealth(), checkHealth()])
    const ms = performance.now() - t0
    assert(!a.live && !b.live && ms >= 2900 && ms < 3800, `health timeout ${ms.toFixed(0)} ms`)
    assert(calls.length === 1, `deduped (${calls.length} calls)`)
    await checkHealth()
    assert(calls.length === 1 && peekHealth()?.live === false, 'cached')
    console.log(`health timeout: ${ms.toFixed(0)} ms, deduped + cached: OK`)
  }
  useFetch(async () => new Response(JSON.stringify({ ok: true, live: true, models: ['fast', 'smart'] }), { status: 200 }))
  {
    const h = await checkHealth({ force: true })
    assert(h.live && h.models.length === 2, `health ok ${JSON.stringify(h)}`)
    console.log('health ok: OK')
  }

  // 12. extract: sim + live 500 → sim
  {
    const s = await getAi('sim').extract({ product: 'sapa-warga', kind: 'document', sampleId: 'pengantar-ktp' })
    assert(s.mode === 'sim' && s.fields.length === 3, 'sim extract')
    useFetch(async () => new Response('err', { status: 500 }))
    fallbacks.length = 0
    const l = await live.extract({ product: 'sapa-warga', kind: 'document', sampleId: 'pengantar-ktp', text: 'x' })
    assert(l.mode === 'sim' && fallbacks[0]?.op === 'extract', 'live extract → sim')
    assert(String(calls[0]) === 'POST https://proxy.test/api/ai/extract', `extract url ${calls[0]}`)
    console.log('extract (sim, live→sim): OK')
  }

  off()
  unregisterScenario('sapa-warga')
  configureLive({ baseUrl: null })
  console.log('fallback: all OK')
}

main().catch((e) => {
  console.error(e)
  throw e
})
