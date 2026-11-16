/**
 * node.ts — Node adapter (Docker + Caddy on a VPS, or local dev). Listens on PORT (default 8787).
 * Behind Caddy set TRUST_PROXY=1 (docker-compose does) so the client IP comes from
 * X-Forwarded-For; when the port is exposed directly leave it unset (socket address is used).
 */
import { serve } from '@hono/node-server'
import { getConnInfo } from '@hono/node-server/conninfo'
import { createApp } from './app.js'

// `--mock` = AI_MOCK=1 without shell-specific env syntax (npm run dev:mock)
if (process.argv.includes('--mock')) process.env.AI_MOCK = '1'

const app = createApp(process.env, {
  ipHeader: 'x-forwarded-for',
  trustProxyDefault: false,
  getIp: (c) => getConnInfo(c).remote.address,
})

const port = Number.parseInt(process.env.PORT ?? '8787', 10) || 8787
const hostname = process.env.HOST ?? '0.0.0.0'

const mock = ['1', 'true', 'yes', 'on'].includes((process.env.AI_MOCK ?? '').toLowerCase())

const server = serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(
    JSON.stringify({
      svc: 'ai-proxy',
      msg: 'listening',
      port: info.port,
      mock,
      live: mock || Boolean(process.env.ANTHROPIC_API_KEY),
    }),
  )
})

const shutdown = () => {
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 5000).unref()
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
