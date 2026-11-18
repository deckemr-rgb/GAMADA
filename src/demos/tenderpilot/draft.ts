/**
 * demos/tenderpilot/draft.ts — the visitor's bid draft per tender (page memory, not world state): the price what-if
 * (−3 % / 0 / +3 % on the suggested price), edited unit prices, the 7 document sections (AI or edited text) and the
 * signing step. The bid total is computed from it by model.bidLines (one formula everywhere).
 */
import { useSyncExternalStore } from 'react'

export type SectionId = 'surat' | 'harga' | 'spek' | 'jadwal' | 'pengalaman' | 'pakta' | 'lampiran'
export const SECTIONS: readonly { id: SectionId; pages: number }[] = [
  { id: 'surat', pages: 2 },
  { id: 'harga', pages: 3 },
  { id: 'spek', pages: 6 },
  { id: 'jadwal', pages: 3 },
  { id: 'pengalaman', pages: 5 },
  { id: 'pakta', pages: 2 },
  { id: 'lampiran', pages: 13 },
]
export const TOTAL_PAGES = SECTIONS.reduce((a, s) => a + s.pages, 0)

export interface Draft {
  delta: -0.03 | 0 | 0.03
  units: Record<number, number>
  /** section → ai once composed; `text` only when the visitor edited it (else the text follows the world + price) */
  sections: Partial<Record<SectionId, { ai: boolean; text?: string }>>
  signed: boolean
}
const EMPTY: Draft = { delta: 0, units: {}, sections: {}, signed: false }
const drafts = new Map<string, Draft>()
const subs = new Set<() => void>()

export const getDraft = (tenderId: string): Draft => drafts.get(tenderId) ?? EMPTY
export function setDraft(tenderId: string, patch: Partial<Draft> | ((d: Draft) => Partial<Draft>)): void {
  const cur = getDraft(tenderId)
  const p = typeof patch === 'function' ? patch(cur) : patch
  drafts.set(tenderId, { ...cur, ...p })
  for (const fn of [...subs]) fn()
}
export function useDraft(tenderId: string | null): Draft {
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn)
      return () => subs.delete(fn)
    },
    () => (tenderId ? getDraft(tenderId) : EMPTY),
  )
}
export const composedCount = (d: Draft) => SECTIONS.filter((s) => d.sections[s.id]?.ai).length
export const pagesOf = (d: Draft) => SECTIONS.reduce((a, s) => a + (d.sections[s.id]?.ai ? s.pages : 0), 0)
