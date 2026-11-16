/**
 * log.ts — one JSON line per request. METADATA ONLY: route, status, product, model, timings,
 * token counts, byte sizes and a hashed IP. Message text, context, document text and image bytes
 * are never passed to this module (spec §10 "isi dokumen tidak di-log").
 */

export interface LogRecord {
  route: string
  status: number
  ms: number
  reqId?: string
  ip?: string
  product?: string
  kind?: string
  model?: string
  mock?: boolean
  code?: string
  inputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  toolCalls?: number
  bytes?: number
  mime?: string
  messages?: number
}

export function createLogger(level: 'info' | 'silent') {
  return (rec: LogRecord): void => {
    if (level === 'silent') return
    console.log(JSON.stringify({ ts: new Date().toISOString(), svc: 'ai-proxy', ...rec }))
  }
}
export type Logger = ReturnType<typeof createLogger>

/** FNV-1a 32-bit — enough to tell clients apart in logs and rate-limit keys without storing IPs. */
export function hashIp(ip: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < ip.length; i++) {
    h ^= ip.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}
