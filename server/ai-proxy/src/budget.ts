/**
 * budget.ts — daily token budget (AI_DAILY_TOKEN_BUDGET, 0 = unlimited). The day rolls over at
 * 00:00 WIB (UTC+7). When the budget is spent, health reports live:false and chat/extract answer
 * 503 { code: 'budget_exhausted' } — the site then falls back to simulation (spec §9.3/§10).
 * A stream that crosses the limit mid-answer finishes its current model turn and stops cleanly.
 *
 * Counted tokens ("billable-equivalent"): input + cache writes + output + cache reads / 10
 * (cache reads cost about a tenth of normal input).
 */
import type { CounterStore } from './kv.js'

export interface UsageLike {
  input_tokens?: number | null
  output_tokens?: number | null
  cache_creation_input_tokens?: number | null
  cache_read_input_tokens?: number | null
}

export const billableTokens = (u: UsageLike): number =>
  (u.input_tokens ?? 0) +
  (u.cache_creation_input_tokens ?? 0) +
  (u.output_tokens ?? 0) +
  Math.ceil((u.cache_read_input_tokens ?? 0) / 10)

const WIB_OFFSET_MS = 7 * 3600 * 1000

export function dayKeyWib(now = Date.now()): string {
  return new Date(now + WIB_OFFSET_MS).toISOString().slice(0, 10)
}

/** seconds until the next 00:00 WIB */
export function secondsToWibMidnight(now = Date.now()): number {
  const wib = now + WIB_OFFSET_MS
  const next = Math.floor(wib / 86_400_000 + 1) * 86_400_000
  return Math.ceil((next - wib) / 1000)
}

export function createBudget(store: CounterStore, limit: number) {
  const key = () => `gamada:budget:${dayKeyWib()}`
  return {
    limit,
    async status(): Promise<{ ok: boolean; used: number; limit: number; resetSec: number }> {
      const resetSec = secondsToWibMidnight()
      if (limit <= 0) return { ok: true, used: 0, limit: 0, resetSec }
      const used = await store.get(key())
      return { ok: used < limit, used, limit, resetSec }
    },
    async add(tokens: number): Promise<number> {
      if (limit <= 0 || tokens <= 0) return 0
      return store.incr(key(), Math.round(tokens), 2 * 86_400)
    },
  }
}
export type Budget = ReturnType<typeof createBudget>
