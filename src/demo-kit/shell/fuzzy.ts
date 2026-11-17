/**
 * shell/fuzzy.ts — the command palette's fuzzy filter (pure, testable), apart from CommandPalette.tsx so the
 * barrel can export it without pulling the (lazy) palette component into every demo.
 */
import type { PaletteItem } from './CommandPalette'

/** Fuzzy score of `q` in `text` (higher is better), or -1 when not every query char appears in order. */
export function fuzzyScore(q: string, text: string): number {
  const query = q.toLowerCase().replace(/\s+/g, ' ').trim()
  if (!query) return 0
  const s = text.toLowerCase()
  const direct = s.indexOf(query)
  if (direct >= 0) return 1000 - direct + (direct === 0 || /[\s\-/:]/.test(s[direct - 1] ?? '') ? 200 : 0)
  let score = 0
  let si = 0
  let run = 0
  for (const ch of query) {
    if (ch === ' ') continue
    const at = s.indexOf(ch, si)
    if (at < 0) return -1
    run = at === si ? run + 1 : 0
    score += 10 + run * 5 + (at === 0 || /[\s\-/:]/.test(s[at - 1] ?? '') ? 15 : 0) - Math.min(9, at - si)
    si = at + 1
  }
  return score
}

export function filterItems(items: PaletteItem[], q: string): PaletteItem[] {
  if (!q.trim()) return items
  return items
    .map((it, i) => ({
      it,
      i,
      s: Math.max(fuzzyScore(q, it.label), fuzzyScore(q, it.keywords ?? '') - 50),
    }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.it)
}
