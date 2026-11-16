/**
 * worker.ts — Cloudflare Workers adapter (see wrangler.toml). Env vars and secrets arrive as
 * bindings on every fetch; the app is built once per isolate. Cloudflare sets CF-Connecting-IP.
 * Rate limit / budget are per isolate in memory — set REDIS_URL (Upstash REST) for global counts.
 */
import { createApp } from './app.js'
import type { ProxyApp } from './app.js'

type WorkerEnv = Record<string, unknown>

let app: ProxyApp | undefined

function stringEnv(env: WorkerEnv): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(env)) if (typeof v === 'string') out[k] = v
  return out
}

export default {
  fetch(req: Request, env: WorkerEnv): Response | Promise<Response> {
    app ??= createApp(stringEnv(env), { ipHeader: 'cf-connecting-ip' })
    return app.fetch(req)
  },
}
