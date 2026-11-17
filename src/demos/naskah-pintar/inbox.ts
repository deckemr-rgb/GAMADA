/**
 * naskah-pintar/inbox.ts — the one mapping between world letters and what Surat Masuk shows. The recent world
 * letters are drawn as the kit's sample letters (scan images with their own number / sender / subject), so the
 * inbox, the letter detail and the AI context (pending list) all read the identity from here. Loaded only by the
 * lazy chunks (Letters, Assistant): the sample letters never reach the eager Rapat chunk.
 */
import { DAY_MIN, type Bi, type Letter, type WorldState } from '../../demo-kit/world'
import { letterInbox } from '../../demo-kit/world/satu-daerah'
import { LETTERS } from '../../demo-kit/docs/samples/letters'
import type { LetterMeta, SampleDoc } from '../../demo-kit/docs/types'

/** the recent world letters are shown as the kit's sample letters (same kind first), stable across status changes */
export function sampleMap(letters: Letter[]): Map<string, SampleDoc> {
  const recent = letters.filter((l) => l.receivedAt >= -DAY_MIN && !l.instructionId && l.kind !== 'nota-dinas').sort((a, b) => a.receivedAt - b.receivedAt || a.id.localeCompare(b.id))
  const free = [...LETTERS]
  const out = new Map<string, SampleDoc>()
  for (const l of recent) {
    if (!free.length) break
    let i = free.findIndex((d) => d.meta.kind === 'letter' && d.meta.cls === l.kind)
    if (i < 0) i = 0
    out.set(l.id, free.splice(i, 1)[0]!)
  }
  return out
}
export const metaOf = (d: SampleDoc | undefined): LetterMeta | null => (d && d.meta.kind === 'letter' ? d.meta : null)

export interface Row {
  letter: Letter
  doc: SampleDoc | undefined
  subject: Bi
  from: string
  number: string
  sifat: string
  kind: string
}

export function rowsOf(letters: Letter[], map: Map<string, SampleDoc>): Row[] {
  return letters.map((l) => {
    const doc = map.get(l.id)
    const m = metaOf(doc)
    return { letter: l, doc, subject: m?.subject ?? l.subject, from: m?.from ?? l.from, number: m?.number ?? l.number, sifat: m?.sifat ?? l.sifat, kind: l.instructionId ? 'nota-dinas' : (m?.cls ?? l.kind) }
  })
}

/** the AI's view of the inbox, with the same identities the screen shows */
export function lettersCtx(s: WorldState): { pending: number; total: number; pendingList: { subject: Bi; from: string; sifat: string }[] } {
  const letters = letterInbox(s)
  const rows = rowsOf(letters, sampleMap(letters))
  const pending = rows.filter((r) => r.letter.status === 'masuk')
  return { pending: pending.length, total: rows.length, pendingList: pending.slice(0, 6).map((r) => ({ subject: r.subject, from: r.from, sifat: r.sifat })) }
}
