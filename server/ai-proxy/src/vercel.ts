/**
 * vercel.ts — Vercel adapter. `api/[...route].ts` re-exports these handlers, so every request to
 * /api/ai/* reaches the Hono app (Web-standard Request → Response, Node.js runtime by default).
 * Vercel overwrites X-Real-IP / X-Forwarded-For itself, so they can be trusted.
 */
import { createApp } from './app.js'
import type { ProxyApp } from './app.js'

let app: ProxyApp | undefined
const handle = (req: Request): Response | Promise<Response> => (app ??= createApp(process.env, { ipHeader: 'x-real-ip' })).fetch(req)

export const GET = handle
export const POST = handle
export const OPTIONS = handle
