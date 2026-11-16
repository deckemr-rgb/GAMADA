/**
 * ratelimit.ts — fixed-window limit per client IP (RATE_LIMIT_PER_IP per RATE_LIMIT_WINDOW_SEC,
 * default 20 / 10 min). Only POST /api/ai/chat and /api/ai/extract are counted; health is free.
 * Keys hold a hash of the IP, never the IP itself.
 */
import type { CounterStore } from './kv.js'

export interface RateResult {
  ok: boolean
  limit: number
  remaining: number
  /** seconds until the window resets */
  resetSec: number
}

export function createRateLimiter(store: CounterStore, limit: number, windowSec: number) {
  return async (ipHash: string): Promise<RateResult> => {
    const nowSec = Math.floor(Date.now() / 1000)
    const win = Math.floor(nowSec / windowSec)
    const resetSec = (win + 1) * windowSec - nowSec
    const n = await store.incr(`gamada:rl:${ipHash}:${win}`, 1, windowSec + 5)
    return { ok: n <= limit, limit, remaining: Math.max(0, limit - n), resetSec }
  }
}
export type RateLimiter = ReturnType<typeof createRateLimiter>
