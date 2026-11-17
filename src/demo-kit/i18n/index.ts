/**
 * demo-kit/i18n — shared demo strings (ID/EN) + regional-language labels read from the region pack.
 *   const t = useDemoStrings()            // follows useI18n().lang
 *   regionalLanguageLabel(pack, 'id')     // "Basa Jawa"
 *
 * Indonesian ships with the shell; English is its own small chunk (owner decision 2026-11-17: a lazy EN dictionary
 * is fine, but EN must never show the wrong language or raw keys). So:
 *   - the chunk starts loading as soon as this module runs when the visitor is headed for English (?lang=en, a
 *     saved EN choice, or <html lang="en">), in parallel with the route;
 *   - switch the language with `switchLang(l, setLang)` (LangToggle, the palette, ?lang on mount): it fetches the
 *     dictionary first, then flips the site language, so nothing renders in EN before its strings are here;
 *   - any other path to EN (e.g. the site navbar on /lab) makes useDemoStrings() suspend until the chunk arrives;
 *     DemoShell has its own Suspense boundary, so the shell shows its blank frame for that moment, never ID text.
 */
import { use } from 'react'
import { langRequestSeq, preloadLang, useI18n, type Lang, type SetLangOptions } from '../../lib/i18n'
import type { RegionPack } from '../region/types'
import { id, type DemoDict } from './id'

export { id as DEMO_ID } from './id'
export type { DemoDict } from './id'

let EN: DemoDict | null = null
let enFailed = false
/** The EN fetch, tracked the way React's use() reads it (status/value), so a render after it settled never suspends. */
type Tracked = Promise<DemoDict>
let enLoad: Tracked | null = null

function startEn(): Tracked {
  enFailed = false
  const p: Tracked = import('./en').then(
    (m) => (EN = m.en),
    // offline / chunk gone: keep the demo usable in Indonesian; the next switchLang() tries again
    () => {
      enFailed = true
      return id
    },
  )
  void p.then((v) => Object.assign(p, { status: 'fulfilled', value: v }))
  return p
}

/** Fetch a dictionary (only EN is lazy). Never rejects: if the EN chunk cannot load, resolves to Indonesian. */
export function loadDemoStrings(lang: Lang): Promise<DemoDict> {
  if (lang === 'id') return Promise.resolve(id)
  if (!enLoad || enFailed) enLoad = startEn()
  return enLoad
}

/** The dictionary if it is in memory (Indonesian always, English once fetched), else null. */
export function demoStringsIfLoaded(lang: Lang): DemoDict | null {
  return lang === 'id' ? id : EN
}

let wanted: Lang | null = null
/**
 * Change the site language only once the demo strings for it are in memory (no frame in the wrong language).
 * The last call wins: EN then ID clicked while the EN chunk is still loading ends in ID.
 * `opts.persist`: true for a viewer's explicit choice (toggle, palette), false when applying a link's ?lang.
 */
export function switchLang(lang: Lang, setLang: (l: Lang, opts?: SetLangOptions) => unknown, opts?: SetLangOptions): void {
  wanted = lang
  // a site-level setLang (e.g. the navbar toggle) made while we load also counts as a newer choice
  const at = langRequestSeq()
  // site dictionary and demo dictionary in parallel (one round trip, not two)
  void Promise.all([loadDemoStrings(lang), preloadLang(lang)]).then(() => {
    if (wanted === lang && langRequestSeq() === at) void setLang(lang, opts)
  })
}

/** Shared demo strings in the current site language (suspends while the EN chunk is still on its way). */
export function useDemoStrings(): DemoDict {
  const { lang } = useI18n()
  if (lang === 'id') return id
  // always through use() in EN (also once loaded: the settled, tracked promise returns at once), so a render that
  // suspended here calls use() again when it resumes, as React requires
  enLoad ??= startEn()
  return use(enLoad)
}

function headedForEnglish(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const q = new URLSearchParams(window.location.search).get('lang')
    if (q === 'en' || q === 'id') return q === 'en'
    return document.documentElement.lang === 'en' || window.localStorage.getItem('gamada.lang') === 'en'
  } catch {
    return document.documentElement.lang === 'en'
  }
}
if (headedForEnglish()) void loadDemoStrings('en')

export { roleInitials } from './roles'

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

/** Plain function (no hook, no EN chunk needed): the fallback label lives here, not in the dictionaries. */
const REGIONAL_FALLBACK: Record<Lang, string> = { id: 'Bahasa daerah', en: 'Regional language' }

/** Label of one language code ("jv" → "Basa Jawa" / "Javanese"). Unknown codes → "Bahasa daerah". */
export function languageLabel(code: string, lang: Lang): string {
  return REGIONAL[code]?.[lang] ?? REGIONAL_FALLBACK[lang]
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
