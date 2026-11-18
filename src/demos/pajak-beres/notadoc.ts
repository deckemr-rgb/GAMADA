/**
 * demos/pajak-beres/notadoc.ts — the SampleDoc of an inbox nota (kit notaDoc on the world's PO / the altered
 * receipt). Only the Dokumen tab loads it (the finance samples stay out of a consultant's first load).
 */
import { notaDoc } from '../../demo-kit/docs/samples/finance'
import type { SampleDoc } from '../../demo-kit/docs/types'
import type { WorldState } from '../../demo-kit/world'
import { EDIT_DOC_ID, editedSpec, notaSpec, type InboxDoc } from './model'

const docCache = new Map<string, SampleDoc>()
/** the SampleDoc of a nota row (cached per doc id + region) */
export function docOf(s: WorldState, d: InboxDoc): SampleDoc | null {
  if (d.kind === 'mutasi') return null
  const key = `${s.regionId}|${s.seed}|${d.id}`
  const hit = docCache.get(key)
  if (hit) return hit
  const spec = d.kind === 'edit' ? editedSpec(s) : d.po ? notaSpec(s, d.po, d.supplier) : null
  if (!spec) return null
  const doc = d.kind === 'edit' ? notaDoc(spec, { id: EDIT_DOC_ID, edited: true, tilt: 4 }) : notaDoc(spec, { id: `pb-${d.id.toLowerCase()}`, tilt: -6 })
  docCache.set(key, doc)
  return doc
}

