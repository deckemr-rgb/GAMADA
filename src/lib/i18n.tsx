/**
 * i18n.tsx — ID/EN switch. The dictionaries live in content/i18n/{id,en}.ts.
 * Initial language: ?lang=en|id, then the viewer's saved choice (localStorage), then Indonesian.
 * The choice sets <html lang> so screen readers, hyphenation and SEO follow the toggle.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { id, type Dict } from '../content/i18n/id'
import { en } from '../content/i18n/en'

export type Lang = 'id' | 'en'

const DICTS: Record<Lang, Dict> = { id, en }
const STORAGE_KEY = 'gamada.lang'

function initialLang(): Lang {
  if (typeof window === 'undefined') return 'id'
  const q = new URLSearchParams(window.location.search).get('lang')
  if (q === 'en' || q === 'id') return q
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
  setLang: (l: Lang) => void
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try {
      window.localStorage.setItem(STORAGE_KEY, l)
    } catch {
      /* ignore */
    }
  }, [])

  const value = useMemo<I18nValue>(() => ({ lang, t: DICTS[lang], setLang }), [lang, setLang])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const v = useContext(I18nContext)
  if (!v) throw new Error('useI18n() outside <I18nProvider>')
  return v
}
