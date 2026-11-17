/**
 * world/prng.ts — deterministic randomness (mulberry32, FNV-1a, Rng helpers). No data tables, so the running world,
 * docs and ai can import it for a few hundred bytes. Same seed + same stream name ⇒ same sequence, everywhere.
 */

/** mulberry32 PRNG → floats in [0, 1) */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** FNV-1a 32-bit hash of a string */
export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export interface Rng {
  /** float in [0, 1) */
  next(): number
  /** integer in [min, max] */
  int(min: number, max: number): number
  float(min: number, max: number): number
  chance(p: number): boolean
  pick<T>(arr: readonly T[]): T
  weighted<T>(pairs: readonly (readonly [T, number])[]): T
  /** gaussian (Box–Muller) */
  normal(mean?: number, sd?: number): number
  shuffle<T>(arr: readonly T[]): T[]
  /** k distinct items */
  sample<T>(arr: readonly T[], k: number): T[]
}

export function makeRng(seed: number): Rng {
  const next = mulberry32(seed)
  const r: Rng = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    float: (min, max) => min + next() * (max - min),
    chance: (p) => next() < p,
    pick: (arr) => {
      if (!arr.length) throw new Error('rng.pick on empty array')
      return arr[Math.floor(next() * arr.length)] as (typeof arr)[number]
    },
    weighted: (pairs) => {
      let total = 0
      for (const [, w] of pairs) total += w
      let x = next() * total
      for (const [v, w] of pairs) {
        x -= w
        if (x < 0) return v
      }
      const last = pairs[pairs.length - 1]
      if (!last) throw new Error('rng.weighted on empty list')
      return last[0]
    },
    normal: (mean = 0, sd = 1) => {
      const u = Math.max(1e-9, next())
      const v = next()
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
    },
    shuffle: (arr) => {
      const a = [...arr]
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        const t = a[i] as (typeof a)[number]
        a[i] = a[j] as (typeof a)[number]
        a[j] = t
      }
      return a
    },
    sample: (arr, k) => r.shuffle(arr).slice(0, Math.max(0, Math.min(k, arr.length))),
  }
  return r
}

/** independent, named stream: adding a new stream never shifts the numbers of another one */
export function streamRng(seed: number, regionId: string, stream: string): Rng {
  return makeRng(hashString(`${seed}|${regionId}|${stream}`))
}
