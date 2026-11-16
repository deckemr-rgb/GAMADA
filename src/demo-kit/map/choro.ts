/**
 * map/choro.ts — resolves a ChoroplethLayer spec into classes and colours. Shared by the engine (feature
 * states) and MapLegend (swatches), so the map and its legend can never disagree.
 */
import type { Lang } from '../../lib/i18n'
import { classColor, classOf, quantileBreaks, RAMP } from './palette'
import { fmt } from './strings'
import type { ChoroplethLayer } from './types'

export interface ResolvedChoropleth {
  breaks: number[]
  colors: string[]
  /** class index per kecamatan id (absent = no data or hidden) */
  classOf: Record<string, number>
  hidden: Set<string>
  format: (v: number) => string
  min: number
  max: number
}

export function resolveChoropleth(spec: ChoroplethLayer, lang: Lang): ResolvedChoropleth {
  const hidden = new Set(spec.hidden ?? [])
  const shown = Object.entries(spec.values).filter((e): e is [string, number] => typeof e[1] === 'number' && Number.isFinite(e[1]) && !hidden.has(e[0]))
  const vals = shown.map((e) => e[1])
  const breaks = spec.breaks ?? quantileBreaks(vals, RAMP.length)
  const n = breaks.length + 1
  const colors = Array.from({ length: n }, (_, c) => classColor(c, n))
  const cls: Record<string, number> = {}
  for (const [id, v] of shown) cls[id] = classOf(v, breaks)
  const max = vals.length ? Math.max(...vals) : 0
  const min = vals.length ? Math.min(...vals) : 0
  const digits = max >= 100 ? 0 : max >= 10 ? 1 : 2
  return { breaks, colors, classOf: cls, hidden, format: spec.format ?? ((v: number) => fmt(v, lang, digits)), min, max }
}
