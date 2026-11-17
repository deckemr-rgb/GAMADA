/**
 * useEco.ts — the ecosystem-page copy (eco.ts: /ekosistem, /produk, /demo, /tur, /lab, the merged /karya cards)
 * for the current language. eco.ts is NOT part of the global id/en dictionaries: those ship in the home entry, and
 * spec §14 forbids growing home JS. Only the lazy route chunks import this module, so the copy lands in their
 * shared chunk instead.
 */
import { useI18n } from '../../lib/i18n'
import { eco } from './eco'

export type EcoStrings = (typeof eco)['id']

/** useI18n() plus `eco`: the ecosystem copy in the active language. */
export function useEcoI18n() {
  const v = useI18n()
  const copy: EcoStrings = eco[v.lang]
  return { ...v, eco: copy }
}
