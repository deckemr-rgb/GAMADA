/**
 * Self-test: stream rate within DEMO bounds, punctuation pauses, determinism, thinking delay, engine order.
 * Run: npx tsx src/demo-kit/ai/__tests__/stream.test.ts
 */
import { DEMO } from '../../../lib/motion'
import { streamSchedule, streamText, thinkingDelayMs, tokenize } from '../stream'
import { simChunks, simulate } from '../scripted/engine'
import { sampleScenario, createFixtureWorld } from '../__fixtures__/sample-scenario'
import { summarize, byteLength } from '../context'
import type { AiChunk } from '../types'

function assert(c: unknown, msg: string): asserts c {
  if (!c) throw new Error(msg)
}

const TEXTS = [
  'Terima kasih, laporan banjir di Kalitidu sudah kami catat sebagai tiket SW-2438 dan diteruskan ke BPBD. Tim siaga dijadwalkan meninjau dalam 4 jam.',
  'The Public Service Mall is open Monday–Thursday 08:00–15:00 and Friday 08:00–11:00 WIB. Closed on weekends.',
  'Matur nuwun laporanipun. Uwuh ing Dander sampun kula cathet dados tiket SW-2439, lan kula aturaken dhateng Dinas Lingkungan Hidup.',
]

async function main() {
  // 1. schedule bounds, determinism, round trip
  for (const t of TEXTS) {
    const s = streamSchedule(t)
    assert(s.tokens.join('') === t, 'tokens must join back to the text')
    const rate = (s.tokens.length - 1) / (s.genMs / 1000)
    assert(rate >= DEMO.tokensPerSecMin - 0.01 && rate <= DEMO.tokensPerSecMax + 0.01, `rate ${rate.toFixed(1)} out of bounds`)
    for (let i = 1; i < s.delays.length; i++) {
      const pure = s.delays[i]! - (/[.!?…]["')\]]?$/.test(s.tokens[i - 1]!.trimEnd()) ? DEMO.punctuationPauseMs : /[,;:—–]$/.test(s.tokens[i - 1]!.trimEnd()) ? DEMO.punctuationPauseMs / 2 : 0)
      const r = 1000 / pure
      assert(r >= DEMO.tokensPerSecMin - 0.6 && r <= DEMO.tokensPerSecMax + 0.6, `token ${i} rate ${r.toFixed(1)} out of bounds`)
    }
    const s2 = streamSchedule(t)
    assert(JSON.stringify(s.delays) === JSON.stringify(s2.delays), 'schedule must be deterministic')
    assert(s.totalMs > s.genMs, 'punctuation pauses add time')
    const th = thinkingDelayMs(t)
    assert(th >= 300 && th <= 900 && th === thinkingDelayMs(t), `thinking ${th}`)
    console.log(`stream: ${s.tokens.length} tok · ${rate.toFixed(1)} tok/s · ${Math.round(s.totalMs)} ms · think ${th} ms`)
  }
  assert(tokenize('').length === 0, 'empty text')
  assert(streamSchedule('x', { tps: 999 }).tps === DEMO.tokensPerSecMax, 'tps clamped')

  // 2. real-time streamText measured with the real clock (short text)
  const t = TEXTS[1]!
  const t0 = performance.now()
  let n = 0
  let out = ''
  for await (const piece of streamText(t)) {
    n++
    out += piece
  }
  const ms = performance.now() - t0
  const sched = streamSchedule(t)
  assert(out === t, 'streamText output equals text')
  assert(ms >= sched.totalMs * 0.95 && ms <= sched.totalMs * 1.6 + 120, `wall ${ms.toFixed(0)} vs schedule ${sched.totalMs.toFixed(0)}`)
  console.log(`streamText: ${n} tokens in ${ms.toFixed(0)} ms (schedule ${sched.totalMs.toFixed(0)} ms)`)

  // 2b. end to end through the engine (regression: an injected sleep used to disable drift compensation)
  {
    const res = simulate(sampleScenario, { product: 'sapa-warga', role: 'warga', lang: 'id', messages: [{ role: 'user', content: 'Dalane bolong neng Dander, akeh sing tiba' }], world: createFixtureWorld() })
    let tf = 0
    let tl = 0
    let n = 0
    for await (const ch of simChunks(res)) {
      if (ch.type !== 'text') continue
      tl = performance.now()
      if (!tf) tf = tl
      n++
    }
    const sc = streamSchedule(res.response.text)
    const net = (n - 1) / ((tl - tf - (sc.totalMs - sc.genMs)) / 1000)
    assert(net >= DEMO.tokensPerSecMin - 1 && net <= DEMO.tokensPerSecMax + 1, `engine net rate ${net.toFixed(1)} tok/s out of bounds`)
    assert(Math.abs(tl - tf - sc.totalMs) < sc.totalMs * 0.1 + 40, `engine wall ${(tl - tf).toFixed(0)} vs schedule ${sc.totalMs.toFixed(0)}`)
    console.log(`engine stream: ${n} tok · net ${net.toFixed(1)} tok/s (schedule base ${sc.tps.toFixed(1)})`)
  }

  // 3. abort stops the stream
  const ctrl = new AbortController()
  let got = 0
  setTimeout(() => ctrl.abort(), 120)
  for await (const _ of streamText(TEXTS[0]!, { signal: ctrl.signal })) {
    void _
    got++
  }
  assert(got > 0 && got < tokenize(TEXTS[0]!).length, `abort mid-stream (got ${got})`)

  // 4. engine order: text… → tool_call… → structured → followups → done (instant)
  const world = createFixtureWorld()
  const r = simulate(sampleScenario, { product: 'sapa-warga', role: 'warga', lang: 'id', messages: [{ role: 'user', content: 'banyu munggah neng Kalitidu, omah kelebon banyu' }], world })
  assert(r.match.intentId === 'lapor-banjir' && r.response.translation, 'jawa flood intent with translation')
  assert(r.response.text.includes('SW-2440') || /SW-\d+/.test(r.response.text), 'ticket id from world')
  const kinds: AiChunk['type'][] = []
  for await (const c of simChunks(r, { instant: true })) kinds.push(c.type)
  const order = kinds.filter((k, i) => k !== kinds[i - 1]).join(',')
  assert(order === 'text,tool_call,structured,followups,done', `order ${order}`)
  // fallback answer + chips
  const f = simulate(sampleScenario, { product: 'sapa-warga', role: 'warga', lang: 'en', messages: [{ role: 'user', content: 'tell me a joke' }], world })
  assert(f.fallback && f.response.followUps?.some((x) => /officer/i.test(x)), 'fallback offers "forward to an officer"')
  // world-dependent answer
  const st = simulate(sampleScenario, { product: 'sapa-warga', role: 'warga', lang: 'en', messages: [{ role: 'user', content: 'check status SW-2416' }], world })
  assert(st.response.text.includes('resolved'), 'status read from world')
  console.log('engine: chunk order, Jawa translation, fallback chips, world reads OK')

  // 5. summarize ≤ 6 KB
  const big = { regionId: 'bojonegoro', complaints: { byId: Object.fromEntries(Array.from({ length: 900 }, (_, i) => [`c${i}`, { id: `c${i}`, text: 'Jalan rusak '.repeat(40), at: i }])), ids: Array.from({ length: 900 }, (_, i) => `c${i}`) }, fn: () => 1, when: new Date(0) }
  const sum = summarize(big)
  const bytes = byteLength(JSON.stringify(sum))
  assert(bytes <= 6000, `summarize ${bytes} bytes`)
  assert((sum as { complaints: { count: number } }).complaints.count === 900, 'table → count/items')
  console.log(`context: 900-row table summarised to ${bytes} bytes`)
}

main().catch((e) => {
  console.error(e)
  throw e
})
