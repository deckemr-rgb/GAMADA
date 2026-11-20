/**
 * useVizLang in its own small module (Tahap 8): Micro (KPI sparklines, meters) needs only this, not the ChartFrame
 * chunk, so a first load with kit micro-visuals no longer pulls ChartFrame in. ChartFrame re-exports it.
 */
import { useI18n } from '../../lib/i18n'
import { formatters, type Formatters, type Lang } from './format'
import { VT, type VizStrings } from './i18n'

/** Language + bound formatters + strings for charts. */
export function useVizLang(): { lang: Lang; f: Formatters; s: VizStrings } {
  const { lang } = useI18n()
  return { lang, f: formatters(lang), s: VT[lang] }
}
