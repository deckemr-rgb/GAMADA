/**
 * netlify.ts — Netlify Functions (v2, Web-standard) adapter. Wired by
 * netlify/functions/ai-proxy.ts, which re-exports `default` and `config` from here.
 * Netlify sets X-Nf-Client-Connection-Ip to the real client address.
 */
import { createApp } from './app.js'
import type { ProxyApp } from './app.js'

let app: ProxyApp | undefined

export default async function handler(req: Request): Promise<Response> {
  app ??= createApp(process.env, { ipHeader: 'x-nf-client-connection-ip' })
  return app.fetch(req)
}

export const config = { path: '/api/ai/*' }
