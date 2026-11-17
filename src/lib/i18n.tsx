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

export function I18nProvider({ children }: { children: ReactNode }) {
  const [want] = useState(initialLang)
  const [lang, setLangState] = useState<Lang | null>(() => (DICTS[want] ? want : null))

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

  const value = useMemo<I18nValue | null>(() => (lang ? { lang, t: DICTS[lang] as Dict, setLang } : null), [lang, setLang])
  if (!value) return null
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const v = useContext(I18nContext)
  if (!v) throw new Error('useI18n() outside <I18nProvider>')
  return v
}
