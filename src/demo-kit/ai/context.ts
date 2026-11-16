/**
 * ai/context.ts — compact, JSON-safe world summaries for the live proxy (spec §9.3: ≤ ~6 KB).
 *
 * summarize() walks any value and trims it until its JSON fits `maxBytes` (UTF-8): long arrays keep their first
 * items plus a `{ "…": n }` marker, long strings are cut with "…", deep objects collapse to a key count. World
 * tables shaped `{ byId, ids }` become `{ count, items }` (newest first). Functions/symbols are dropped,
 * Dates become ISO strings, Map/Set become objects/arrays, cycles become "[circular]".
 */

/* ------------------------------------------------------------------ constants (module-local, see report) */
export const CONTEXT = {
  maxBytes: 6000,
  /** first pass limits; halved until the JSON fits */
  arrayItems: 40,
  stringChars: 600,
  depth: 6,
  objectKeys: 60,
} as const

interface Limits {
  arrayItems: number
  stringChars: number
  depth: number
  objectKeys: number
}

const enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null
/** UTF-8 byte length of a string. */
export function byteLength(s: string): number {
  return enc ? enc.encode(s).length : s.length
}

function isTable(v: object): v is { byId: Record<string, unknown>; ids: string[] } {
  const t = v as { byId?: unknown; ids?: unknown }
  return !!t.byId && typeof t.byId === 'object' && Array.isArray(t.ids)
}

function trim(value: unknown, lim: Limits, depth: number, seen: WeakSet<object>): unknown {
  if (value === null) return null
  switch (typeof value) {
    case 'string':
      return value.length > lim.stringChars ? `${value.slice(0, Math.max(1, lim.stringChars - 1))}…` : value
    case 'number':
      return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : null
    case 'boolean':
      return value
    case 'bigint':
      return value.toString()
    case 'undefined':
    case 'function':
    case 'symbol':
      return undefined
  }
  const obj = value as object
  if (obj instanceof Date) return Number.isNaN(obj.getTime()) ? null : obj.toISOString()
  if (seen.has(obj)) return '[circular]'
  if (depth >= lim.depth) {
    if (Array.isArray(obj)) return { '…': obj.length }
    return { '…': Object.keys(obj).length }
  }
  seen.add(obj)
  try {
    if (obj instanceof Map) return trim(Object.fromEntries(obj), lim, depth, seen)
    if (obj instanceof Set) return trim([...obj], lim, depth, seen)
    if (Array.isArray(obj)) {
      const keep = obj.slice(0, lim.arrayItems).map((v) => trim(v, lim, depth + 1, seen)).map((v) => (v === undefined ? null : v))
      if (obj.length > lim.arrayItems) keep.push({ '…': obj.length - lim.arrayItems })
      return keep
    }
    if (isTable(obj)) {
      const items = obj.ids.slice(0, lim.arrayItems).map((id) => trim(obj.byId[id], lim, depth + 1, seen))
      const out: Record<string, unknown> = { count: obj.ids.length, items }
      if (obj.ids.length > lim.arrayItems) out['…'] = obj.ids.length - lim.arrayItems
      return out
    }
    const out: Record<string, unknown> = {}
    const keys = Object.keys(obj)
    for (const k of keys.slice(0, lim.objectKeys)) {
      const v = trim((obj as Record<string, unknown>)[k], lim, depth + 1, seen)
      if (v !== undefined) out[k] = v
    }
    if (keys.length > lim.objectKeys) out['…'] = keys.length - lim.objectKeys
    return out
  } finally {
    seen.delete(obj)
  }
}

/**
 * Trim `value` so that JSON.stringify(result) is at most `maxBytes` UTF-8 bytes.
 * Always returns JSON-safe data (never undefined; an unrepresentable value becomes null).
 */
export function summarize(value: unknown, maxBytes: number = CONTEXT.maxBytes): unknown {
  let lim: Limits = { arrayItems: CONTEXT.arrayItems, stringChars: CONTEXT.stringChars, depth: CONTEXT.depth, objectKeys: CONTEXT.objectKeys }
  for (let pass = 0; pass < 12; pass++) {
    const out = trim(value, lim, 0, new WeakSet()) ?? null
    const json = JSON.stringify(out)
    if (byteLength(json) <= maxBytes) return out
    lim = {
      arrayItems: Math.max(1, Math.floor(lim.arrayItems / 2)),
      stringChars: Math.max(16, Math.floor(lim.stringChars / 2)),
      depth: pass % 2 === 1 ? Math.max(1, lim.depth - 1) : lim.depth,
      objectKeys: Math.max(4, Math.floor(lim.objectKeys * 0.7)),
    }
  }
  // last resort: a truncated JSON string (still valid JSON, still under budget)
  const json = JSON.stringify(trim(value, lim, 0, new WeakSet()) ?? null)
  let cut = json.slice(0, Math.max(0, maxBytes - 16))
  while (byteLength(JSON.stringify(cut)) > maxBytes && cut.length > 0) cut = cut.slice(0, Math.floor(cut.length * 0.9))
  return cut
}
