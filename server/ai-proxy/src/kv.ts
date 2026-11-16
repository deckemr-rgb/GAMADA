/**
 * kv.ts — tiny counter store used by the rate limiter and the daily token budget.
 *
 * - Default: in-memory (per process / per serverless instance — fine for one VPS container).
 * - REDIS_URL=https://…  : Upstash-compatible Redis REST API, called with plain `fetch`
 *   (no redis client dependency). Token from REDIS_TOKEN / UPSTASH_REDIS_REST_TOKEN or the
 *   URL's password (`https://default:<token>@host`). Works on Node, Vercel, Netlify and Workers.
 * - REDIS_URL=redis://…  : not supported (would need a TCP client) → warning + in-memory.
 * A failing REST call never fails the request: that call falls back to memory.
 */

export interface CounterStore {
  readonly kind: 'memory' | 'upstash'
  /** INCRBY key by; sets the TTL when the key is new. Returns the new value. */
  incr(key: string, by: number, ttlSec: number): Promise<number>
  get(key: string): Promise<number>
}

export class MemoryStore implements CounterStore {
  readonly kind = 'memory' as const
  private map = new Map<string, { v: number; exp: number }>()
  private ops = 0

  async incr(key: string, by: number, ttlSec: number): Promise<number> {
    const now = Date.now()
    if (++this.ops % 500 === 0) this.sweep(now)
    const cur = this.map.get(key)
    if (!cur || cur.exp <= now) {
      this.map.set(key, { v: by, exp: now + ttlSec * 1000 })
      return by
    }
    cur.v += by
    return cur.v
  }

  async get(key: string): Promise<number> {
    const cur = this.map.get(key)
    return cur && cur.exp > Date.now() ? cur.v : 0
  }

  private sweep(now: number): void {
    for (const [k, e] of this.map) if (e.exp <= now) this.map.delete(k)
  }
}

export class UpstashStore implements CounterStore {
  readonly kind = 'upstash' as const
  private warned = false
  constructor(
    private base: string,
    private token: string,
    private fallback: MemoryStore,
  ) {}

  private async call(body: unknown, path = ''): Promise<unknown> {
    const res = await fetch(this.base + path, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(1500),
    })
    if (!res.ok) throw new Error(`upstash ${res.status}`)
    return res.json()
  }

  private warn(err: unknown): void {
    if (this.warned) return
    this.warned = true
    console.warn(JSON.stringify({ svc: 'ai-proxy', warn: 'redis_unavailable_using_memory', err: String(err) }))
  }

  async incr(key: string, by: number, ttlSec: number): Promise<number> {
    try {
      const out = (await this.call(
        [
          ['INCRBY', key, String(by)],
          ['EXPIRE', key, String(ttlSec), 'NX'],
        ],
        '/pipeline',
      )) as { result?: unknown }[]
      const n = Number(out[0]?.result)
      if (!Number.isFinite(n)) throw new Error('bad upstash reply')
      return n
    } catch (err) {
      this.warn(err)
      return this.fallback.incr(key, by, ttlSec)
    }
  }

  async get(key: string): Promise<number> {
    try {
      const out = (await this.call(['GET', key])) as { result?: unknown }
      const n = Number(out.result ?? 0)
      return Number.isFinite(n) ? n : 0
    } catch (err) {
      this.warn(err)
      return this.fallback.get(key)
    }
  }
}

export function createStore(redisUrl: string | undefined, redisToken: string | undefined): CounterStore {
  const memory = new MemoryStore()
  if (!redisUrl) return memory
  let url: URL
  try {
    url = new URL(redisUrl)
  } catch {
    console.warn(JSON.stringify({ svc: 'ai-proxy', warn: 'REDIS_URL invalid, using memory' }))
    return memory
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    console.warn(
      JSON.stringify({ svc: 'ai-proxy', warn: 'REDIS_URL must be an Upstash-compatible REST URL (https://…); using memory' }),
    )
    return memory
  }
  const token = redisToken ?? (url.password ? decodeURIComponent(url.password) : undefined)
  if (!token) {
    console.warn(JSON.stringify({ svc: 'ai-proxy', warn: 'REDIS_URL has no token (REDIS_TOKEN), using memory' }))
    return memory
  }
  url.username = ''
  url.password = ''
  return new UpstashStore(url.toString().replace(/\/+$/, ''), token, memory)
}
