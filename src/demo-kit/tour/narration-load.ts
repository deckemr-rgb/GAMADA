/** tour/narration.ts — loads the narration of the current language only (the other one on switch). */
import { useEffect, useState } from 'react'
import type { Fills, Lang, Narration } from './types'

const cache: Partial<Record<Lang, Narration>> = {}
const load = (l: Lang): Promise<Narration> =>
  (l === 'en' ? import('./narration.en') : import('./narration.id')).then((m) => {
    cache[l] = m.default
    return m.default
  })

export function useNarration(lang: Lang): Narration | null {
  const [n, setN] = useState<Narration | null>(cache[lang] ?? null)
  useEffect(() => {
    let alive = true
    if (cache[lang]) setN(cache[lang]!)
    else
      void load(lang).then((x) => {
        if (alive) setN(x)
      })
    return () => {
      alive = false
    }
  }, [lang])
  return n
}

/** fill {placeholders}; unknown ones (world not loaded yet, a cold poster) become "…" */
export const fillText = (s: string, f: Fills): string => s.replace(/\{(\w+)\}/g, (_m, k: string) => (f[k] != null && f[k] !== '' ? String(f[k]) : '…'))
