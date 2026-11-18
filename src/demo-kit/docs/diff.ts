/**
 * docs/diff.ts — word-level diff (LCS over words, whitespace kept): the engine of TextDiff, importable without CSS.
 */
export type DiffPart = { t: 'same' | 'add' | 'del'; s: string }

/** word diff (exported for tests): tokens are words with their trailing whitespace */
export function diffWords(a: string, b: string): DiffPart[] {
  const A = a.match(/\S+\s*|\s+/g) ?? []
  const B = b.match(/\S+\s*|\s+/g) ?? []
  const key = (x: string) => x.trim()
  const n = A.length
  const m = B.length
  // LCS table (bid sections are a few hundred words, so n × m stays small)
  const L: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i]![j] = key(A[i]!) === key(B[j]!) ? L[i + 1]![j + 1]! + 1 : Math.max(L[i + 1]![j]!, L[i]![j + 1]!)
  const out: DiffPart[] = []
  const push = (t: DiffPart['t'], s: string) => {
    const last = out[out.length - 1]
    if (last && last.t === t) last.s += s
    else out.push({ t, s })
  }
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (key(A[i]!) === key(B[j]!)) {
      push('same', B[j]!)
      i++
      j++
    } else if (L[i + 1]![j]! >= L[i]![j + 1]!) push('del', A[i++]!)
    else push('add', B[j++]!)
  }
  while (i < n) push('del', A[i++]!)
  while (j < m) push('add', B[j++]!)
  return out
}

