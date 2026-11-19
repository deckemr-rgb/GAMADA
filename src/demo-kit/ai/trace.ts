/**
 * ai/trace.ts — the agent traces GAMADA Inti "Agen" shows: `useAiChat` appends one row per finished answer (any
 * product) to a ring of the last 10 (module store + sessionStorage, so an answer given in Sapa Warga is there after
 * navigating to Inti). No seeded / fake traces: an empty ring is an honest empty state.
 */
import { useSyncExternalStore } from 'react'
import type { ProductSlug, RoleId } from '../../content/products'
import type { ToolCall } from './types'

export interface AiTrace {
  id: string
  product: ProductSlug
  role: RoleId
  /** wall-clock ms (Date.now) */
  at: number
  /** the visitor's question, ≤ 120 chars */
  prompt: string
  intentId: string | null
  confidence: number | null
  mode: 'sim' | 'live'
  fellBack: boolean
  steps: ToolCall[]
  timing: { firstTokenMs: number; streamMs: number; tokens: number } | null
  /** kinds of the structured parts of the answer */
  structuredKinds: string[]
}

const KEY = 'gamada:ai-traces'
const RING = 10
let ring: AiTrace[] | null = null
const subs = new Set<() => void>()
const EMPTY: AiTrace[] = []

function load(): AiTrace[] {
  if (ring) return ring
  try {
    const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(KEY) : null
    ring = raw ? (JSON.parse(raw) as AiTrace[]).slice(0, RING) : []
  } catch {
    ring = []
  }
  return ring
}

/** append a trace (newest first, ring of 10; useAiChat calls it after every finished answer) */
export function pushTrace(t: Omit<AiTrace, 'id'>, persist = true): void {
  const list = load()
  const row: AiTrace = { ...t, prompt: t.prompt.slice(0, 120), id: `tr-${t.at.toString(36)}` }
  ring = [row, ...list.filter((x) => x.id !== row.id)].slice(0, RING)
  if (persist) {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(ring))
    } catch {
      /* private mode: memory only */
    }
  }
  for (const fn of [...subs]) fn()
}

/** @internal useAiChat: a finished answer → one trace */
export function traceOf(product: ProductSlug, role: RoleId, prompt: string, m: { intentId?: string; confidence?: number; mode?: 'sim' | 'live'; fellBack?: boolean; toolCalls?: ToolCall[]; timing?: AiTrace['timing'] | undefined; structured?: unknown[] }): void {
  pushTrace({
    product, role, at: Date.now(), prompt, intentId: m.intentId ?? null, confidence: m.confidence ?? null, mode: m.mode ?? 'sim', fellBack: !!m.fellBack, steps: m.toolCalls ?? [], timing: m.timing ?? null,
    structuredKinds: (m.structured ?? []).map((v) => String((v as { kind?: unknown }).kind ?? 'structured')),
  })
}

/** the newest trace of any product (null when none this session) */
export const lastTrace = (): AiTrace | null => load()[0] ?? null
export const allTraces = (): AiTrace[] => load()

/** the ring (newest first) as React state */
export function useAiTraces(): AiTrace[] {
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn)
      return () => subs.delete(fn)
    },
    () => ring ?? load(),
    () => EMPTY,
  )
}

/** @internal tests: clear the ring */
export function _clearTraces(): void {
  ring = []
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  for (const fn of [...subs]) fn()
}
