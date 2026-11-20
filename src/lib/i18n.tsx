/**
 * i18n.tsx — ID/EN switch. The dictionaries live in content/i18n/{id,en}.ts.
 * Initial language: ?lang=en|id, then the viewer's saved choice (localStorage), then Indonesian.
 * The choice sets <html lang> so screen readers, hyphenation and SEO follow the toggle.
 * The Indonesian dictionary ships in the entry; the English one is its own chunk, fetched the first time EN is
 * needed (spec §14: home JS must not grow). An EN-first visitor waits for that one small chunk before the first
 * render (behind the preloader); a toggle to EN switches as soon as it arrives.
 *
 * setLang is last-call-wins: every call takes a request token and a call that resolves after a newer one is dropped,
 * so "EN, then ID" while the EN chunk is still downloading ends in ID (and stores ID).
 *
 * Persistence: only an explicit choice is saved. A language that merely comes from the URL (?lang= on a shared link)
 * applies to this session/view and never overwrites the viewer's saved preference. Callers pass `persist` when they
 * know (the toggles pass true, a ?lang reader passes false); without it, a call that just applies the URL's own
 * ?lang is treated as view-only and any other call as a choice.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { id, type Dict } from '../content/i18n/id'
import { appPath } from './base'

export type Lang = 'id' | 'en'

export interface SetLangOptions {
  /** Save as the viewer's preference. Default: true, unless `l` is just the current URL's ?lang. */
  persist?: boolean
}

const DICTS: Partial<Record<Lang, Dict>> = { id }
const STORAGE_KEY = 'gamada.lang'
let enLoad: Promise<void> | null = null
/** setLang request token (one provider per app): only the newest call may apply its language */
let seq = 0
/** Current setLang token: lets a deferred caller (demo-kit switchLang) see that a newer language request was made. */
export const langRequestSeq = (): number => seq

/** Fetch a dictionary chunk (only EN is lazy). Resolves once DICTS[l] is set; a failed fetch can be retried. */
function loadDict(l: Lang): Promise<void> {
  if (DICTS[l]) return Promise.resolve()
  enLoad ??= import('../content/i18n/en').then(
    (m) => {
      DICTS.en = m.en
    },
    (e: unknown) => {
      enLoad = null
      throw e
    },
  )
  return enLoad
}

/**
 * Start fetching a language's dictionary without switching (never rejects). demo-kit/i18n's switchLang uses it to
 * fetch the site EN chunk and the demo EN chunk in parallel instead of one after the other.
 */
export function preloadLang(l: Lang): Promise<void> {
  return loadDict(l).catch(() => {})
}

function urlLang(): Lang | null {
  if (typeof window === 'undefined') return null
  const q = new URLSearchParams(window.location.search).get('lang')
  return q === 'en' || q === 'id' ? q : null
}

function initialLang(): Lang {
  if (typeof window === 'undefined') return 'id'
  const q = urlLang()
  if (q) return q
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'id') return saved
  } catch {
    /* storage blocked: fall through */
  }
  return 'id'
}

interface I18nValue {
  lang: Lang
  t: Dict
  /** Switch language. Resolves true once applied, false when a newer call won or the dictionary could not load. */
  setLang: (l: Lang, opts?: SetLangOptions) => Promise<boolean>
}

const I18nContext = createContext<I18nValue | null>(null)

/**
 * A demo sandbox (/demo/<slug>, no site chrome) reads no site-dictionary text: the demo kit and the products carry
 * their own strings and only read `lang`. An English visitor landing there renders at once in English, and the site
 * EN chunk is fetched the first time something reads `t` (a page with site chrome after a client-side jump, or the
 * 404 of an unknown slug, which shows Indonesian until it arrives), so the demo's first load does not carry the home
 * page's English copy. No slug check here: the slug list would become one more chunk on the home page.
 */
function sandboxRoute(): boolean {
  return typeof window !== 'undefined' && /^\/demo\/[a-z-]+\/?$/.test(appPath(window.location.pathname))
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [want] = useState(initialLang)
  const [lang, setLangState] = useState<Lang | null>(() => (DICTS[want] || sandboxRoute() ? want : null))
  // bumped when a dictionary that was read lazily (see sandboxRoute) arrives
  const [dictVersion, setDictVersion] = useState(0)

  useEffect(() => {
    if (lang) return
    // EN-first visitor: fetch the EN chunk, fall back to Indonesian if it cannot load
    loadDict(want).then(
      () => setLangState(want),
      () => setLangState('id'),
    )
  }, [lang, want])

  useEffect(() => {
    if (lang) document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((l: Lang, opts?: SetLangOptions): Promise<boolean> => {
    const token = ++seq
    const persist = opts?.persist ?? urlLang() !== l
    return loadDict(l).then(
      () => {
        if (token !== seq) return false
        setLangState(l)
        if (persist) {
          try {
            window.localStorage.setItem(STORAGE_KEY, l)
          } catch {
            /* ignore */
          }
        }
        return true
      },
      () => false,
    )
  }, [])

  const value = useMemo<I18nValue | null>(() => {
    if (!lang) return null
    const dict = DICTS[lang]
    if (dict) return { lang, t: dict, setLang }
    // sandbox route in a language whose dictionary is not here yet: `t` fetches it on first read (Indonesian until
    // it arrives, then a re-render); `lang` alone (all a demo reads) never does
    return {
      lang,
      setLang,
      get t(): Dict {
        loadDict(lang).then(
          () => setDictVersion((v) => v + 1),
          () => {},
        )
        return DICTS.id as Dict
      },
    }
    // dictVersion: a new value object (with the real `t`) once the lazily read dictionary has arrived
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, setLang, dictVersion])
  if (!value) return null
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const v = useContext(I18nContext)
  if (!v) throw new Error('useI18n() outside <I18nProvider>')
  return v
}
