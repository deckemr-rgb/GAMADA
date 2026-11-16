/// <reference types="node" />
/**
 * Integration: the real proxy (server/ai-proxy, AI_MOCK=1) as a child process on a free port, driven by the real
 * site client (getAi('live')). Checks the chunk sequence, structured validation, the fallback paths the mock can
 * trigger, extract, and — after killing the proxy — the fallback to simulation and health live:false.
 * Needs server/ai-proxy/node_modules (npm --prefix server/ai-proxy install).
 * Run: npx tsx src/demo-kit/ai/__tests__/proxy.integration.test.ts
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { checkHealth, configureLive, ExtractedSchema, STRUCTURED_SCHEMAS } from '../live'
import { createLiveProvider, getAi, onLiveFallback, registerScenario, unregisterScenario, type FallbackInfo } from '../provider'
import { createFixtureWorld, sampleScenario } from '../__fixtures__/sample-scenario'
import type { AiChunk, ChatRequest, Lang } from '../types'
import type { ProductSlug, RoleId } from '../../../content/products'

function assert(c: unknown, msg: string): asserts c {
  if (!c) throw new Error(msg)
}

const here = path.dirname(fileURLToPath(import.meta.url))
const proxyDir = path.resolve(here, '../../../../server/ai-proxy')

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.once('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      srv.close(() => resolve(port))
    })
  })
}

/** One node process (tsx as an --import hook, no wrapper process) so kill() really stops the server. */
function startProxy(port: number): { child: ChildProcess; log: () => string } {
  let out = ''
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/node.ts'], {
    cwd: proxyDir,
    env: { ...process.env, AI_MOCK: '1', AI_MOCK_DELAY_MS: '5', PORT: String(port), HOST: '127.0.0.1', LOG_LEVEL: 'silent' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout?.on('data', (d: Buffer) => (out += d.toString()))
  child.stderr?.on('data', (d: Buffer) => (out += d.toString()))
  return { child, log: () => out }
}

async function waitHealthy(base: string, ms: number): Promise<void> {
  const until = Date.now() + ms
  for (;;) {
    try {
      const r = await fetch(`${base}/api/ai/health`)
      if (r.ok) return
    } catch {
      /* not up yet */
    }
    if (Date.now() > until) throw new Error('proxy did not start')
    await new Promise((r) => setTimeout(r, 150))
  }
}

function stop(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve()
    child.once('exit', () => resolve())
    child.kill()
  })
}

const req = (text: string, o: { product?: ProductSlug; role?: RoleId; lang?: Lang } = {}): ChatRequest => ({
  product: o.product ?? 'sapa-warga',
  role: o.role ?? 'warga',
  lang: o.lang ?? 'id',
  messages: [
    { role: 'assistant', content: 'Sugeng rawuh, wonten ingkang saged kula bantu?' },
    { role: 'user', content: text },
  ],
  context: createFixtureWorld(),
})

async function collect(it: AsyncIterable<AiChunk>) {
  const out: AiChunk[] = []
  for await (const c of it) out.push(c)
  const seq = out.map((c) => c.type).filter((t, i, a) => t !== 'text' || a[i - 1] !== 'text')
  const text = out.flatMap((c) => (c.type === 'text' ? [c.text] : [])).join('')
  const done = out.find((c): c is Extract<AiChunk, { type: 'done' }> => c.type === 'done')
  const structured = out.flatMap((c) => (c.type === 'structured' ? [c.value] : []))
  return { out, seq, text, done, structured }
}

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])

async function main() {
  const port = await freePort()
  const base = `http://127.0.0.1:${port}`
  const proxy = startProxy(port)
  const fallbacks: FallbackInfo[] = []
  const off = onLiveFallback((i) => fallbacks.push(i))
  registerScenario(sampleScenario)
  const watchdog = setTimeout(() => {
    console.error('integration test timed out\n' + proxy.log())
    proxy.child.kill()
    process.exit(1)
  }, 120_000)

  try {
    await waitHealthy(base, 30_000)
    configureLive({ baseUrl: base })
    console.log(`proxy (AI_MOCK=1) up on :${port}`)

    // health fields
    const h = await checkHealth({ force: true })
    assert(h.ok && h.live && h.mock && h.models, `health ${JSON.stringify(h)}`)
    assert(h.models.extract === h.models.smart, `extract model defaults to smart (${JSON.stringify(h.models)})`)
    console.log('health: ok, live, mock, models {fast, smart, extract=smart} OK')

    // 1. live chat: chunk sequence + validated structured
    {
      fallbacks.length = 0
      const r = await collect(getAi('live').chat(req('Dalan ing desa kula kebanjiran')))
      assert(JSON.stringify(r.seq) === JSON.stringify(['text', 'tool_call', 'structured', 'followups', 'done']), `sequence ${r.seq}`)
      assert(r.text.startsWith('[Mode uji] Sapa Warga'), `text "${r.text.slice(0, 40)}"`)
      const tc = r.out.find((c) => c.type === 'tool_call')
      assert(tc?.type === 'tool_call' && tc.call.name === 'create_ticket' && tc.call.id === 'mock_tool_1', 'tool_call step')
      assert(r.structured.length === 1 && r.structured[0]!.kind === 'ticket', `structured ${JSON.stringify(r.structured)}`)
      assert(STRUCTURED_SCHEMAS.ticket.safeParse(r.structured[0]!.data).success, 'ticket passes the site schema')
      const fu = r.out.find((c) => c.type === 'followups')
      assert(fu?.type === 'followups' && fu.chips.join('|') === 'Lihat detail|Pertanyaan lain', 'followups chips')
      assert(r.done?.mode === 'live' && !r.done.fellBack && fallbacks.length === 0, `done ${JSON.stringify(r.done)}`)
      console.log(`live chat: ${r.seq.join(' → ')}, ticket valid OK`)
    }

    // 2. another product, EN, smart tier
    {
      const r = await collect(getAi('live').chat(req('Summarise the meeting', { product: 'naskah-pintar', role: 'sekretariat', lang: 'en' })))
      assert(r.text.startsWith('[Test mode]') && r.structured[0]?.kind === 'minutes' && r.done?.mode === 'live', `naskah-pintar ${r.seq}`)
      console.log('live chat (naskah-pintar, EN): minutes OK')
    }

    // 3. fallbacks the mock can trigger
    const cases: [string, string, FallbackInfo['reason'], (r: Awaited<ReturnType<typeof collect>>) => boolean][] = [
      ['invalid structured', 'Jam buka MPP? [mock:invalid]', 'invalid', (r) => r.structured.length === 1 && r.structured[0]!.kind === 'info' && r.text.startsWith('[Mode uji]')],
      ['mid-stream error', 'Jam buka MPP? [mock:error]', 'upstream', (r) => r.text.startsWith('[Mode uji]') && r.structured[0]?.kind === 'info'],
      ['HTTP 429', 'Jam buka MPP? [mock:429]', 'http', (r) => r.text.startsWith('Mal Pelayanan Publik buka')],
      ['budget 503', 'Jam buka MPP? [mock:budget]', 'http', (r) => r.text.startsWith('Mal Pelayanan Publik buka')],
    ]
    for (const [name, text, reason, check] of cases) {
      fallbacks.length = 0
      const r = await collect(getAi('live').chat(req(text)))
      assert(r.done?.mode === 'sim' && r.done.fellBack === true, `${name}: done ${JSON.stringify(r.done)}`)
      assert(fallbacks.length === 1 && fallbacks[0]!.reason === reason, `${name}: reason ${JSON.stringify(fallbacks)}`)
      assert(check(r), `${name}: content ${r.seq} "${r.text.slice(0, 40)}"`)
      console.log(`fallback on ${name}: done {mode: sim, fellBack: true}, reason ${reason}${fallbacks[0]!.status ? ` ${fallbacks[0]!.status}` : ''} OK`)
    }
    {
      fallbacks.length = 0
      const t0 = Date.now()
      const r = await collect(createLiveProvider({ firstTokenTimeoutMs: 800 }).chat(req('Jam buka MPP? [mock:slow]')))
      assert(r.done?.mode === 'sim' && r.done.fellBack && fallbacks[0]?.reason === 'timeout', `slow: ${JSON.stringify(fallbacks)}`)
      console.log(`fallback on first-token timeout (800 ms): OK (${Date.now() - t0} ms)`)
    }

    // 4. extract: image (multipart) and text
    {
      fallbacks.length = 0
      const img = await getAi('live').extract({ product: 'cek-berkas', kind: 'ktp-specimen', image: new Blob([PNG], { type: 'image/png' }) })
      assert(img.mode === 'live' && img.kind === 'ktp-specimen' && img.fields.length === 4 && img.tamper?.length === 1, `extract image ${JSON.stringify(img).slice(0, 120)}`)
      assert(ExtractedSchema.safeParse(img).success && !('mock' in img), 'extract is exactly Extracted')
      const txt = await getAi('live').extract({ product: 'pajak-beres', kind: 'invoice', text: 'NOTA TOKO CONTOH total 1.250.000' })
      assert(txt.mode === 'live' && txt.fields.some((f) => f.key === 'total') && fallbacks.length === 0, 'extract text')
      console.log('live extract (multipart image + text): Extracted, mode live OK')
    }

    // 5. kill the proxy → fallback to simulation, health live:false
    await stop(proxy.child)
    console.log('proxy killed')
    {
      fallbacks.length = 0
      const r = await collect(getAi('live').chat(req('Jam buka MPP kapan?')))
      assert(r.done?.mode === 'sim' && r.done.fellBack === true && r.text.startsWith('Mal Pelayanan Publik buka'), `dead proxy chat ${JSON.stringify(r.done)}`)
      assert((fallbacks[0]?.reason as string | undefined) === 'network', `dead proxy reason ${JSON.stringify(fallbacks)}`)
      const hd = await checkHealth({ force: true })
      assert(!hd.ok && !hd.live && hd.reason === 'unreachable', `dead proxy health ${JSON.stringify(hd)}`)
      fallbacks.length = 0
      const r2 = await collect(getAi('live').chat(req('Jam buka MPP kapan?')))
      assert(r2.done?.mode === 'sim' && r2.done.fellBack && (fallbacks[0]?.reason as string | undefined) === 'unavailable', 'known-down health → immediate sim')
      const ex = await getAi('live').extract({ product: 'sapa-warga', kind: 'document', sampleId: 'pengantar-ktp', text: 'x' })
      assert(ex.mode === 'sim', 'dead proxy extract → sim')
      console.log('after kill: chat → sim (fellBack, reason network), health live:false, extract → sim OK')
    }
    console.log('proxy integration: all OK')
  } catch (e) {
    console.error(e)
    console.error('--- proxy output ---\n' + proxy.log())
    process.exitCode = 1
  } finally {
    clearTimeout(watchdog)
    off()
    unregisterScenario('sapa-warga')
    configureLive({ baseUrl: null })
    await stop(proxy.child)
  }
}

void main()
