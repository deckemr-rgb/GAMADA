/**
 * demo-kit/i18n — shared demo strings (ID/EN) + regional-language labels read from the region pack.
 *   const t = useDemoStrings()            // follows useI18n().lang
 *   regionalLanguageLabel(pack, 'id')     // "Basa Jawa"
 */
import { useI18n, type Lang } from '../../lib/i18n'
import type { RegionPack } from '../region/types'
import { id, type DemoDict } from './id'
import { en } from './en'

export { id as DEMO_ID } from './id'
export { en as DEMO_EN } from './en'
export type { DemoDict } from './id'

export const DEMO_STRINGS: Record<Lang, DemoDict> = { id, en }

export function demoStrings(lang: Lang): DemoDict {
  return DEMO_STRINGS[lang]
}

/** Shared demo strings in the current site language. */
export function useDemoStrings(): DemoDict {
  return DEMO_STRINGS[useI18n().lang]
}

/** Names of regional languages, in the regional language itself (id) and in English (en). */
const REGIONAL: Record<string, { id: string; en: string }> = {
  jv: { id: 'Basa Jawa', en: 'Javanese' },
  su: { id: 'Basa Sunda', en: 'Sundanese' },
  min: { id: 'Baso Minang', en: 'Minangkabau' },
  bug: { id: 'Basa Ugi', en: 'Buginese' },
  bjn: { id: 'Bahasa Banjar', en: 'Banjarese' },
  mad: { id: 'Bhasa Madhura', en: 'Madurese' },
  bal: { id: 'Basa Bali', en: 'Balinese' },
  bat: { id: 'Bahasa Batak', en: 'Batak' },
  id: { id: 'Bahasa Indonesia', en: 'Indonesian' },
}

/** Label of one language code ("jv" → "Basa Jawa" / "Javanese"). Unknown codes → "Bahasa daerah". */
export function languageLabel(code: string, lang: Lang): string {
  return REGIONAL[code]?.[lang] ?? DEMO_STRINGS[lang].regionalLanguage
}

/** The region's main regional language ("Basa Jawa" for Bojonegoro), or null when the pack lists none. */
export function regionalLanguageLabel(pack: Pick<RegionPack, 'languages'> | null | undefined, lang: Lang): string | null {
  const code = pack?.languages.regional[0]
  return code ? languageLabel(code, lang) : null
}

/** Every regional language of the pack, labelled. */
export function regionalLanguages(pack: Pick<RegionPack, 'languages'> | null | undefined, lang: Lang): { code: string; label: string }[] {
  return (pack?.languages.regional ?? []).map((code) => ({
    code,
    label: languageLabel(code, lang),
  }))
}
