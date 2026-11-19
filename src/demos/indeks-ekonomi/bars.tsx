/**
 * Hatched bars (product-local, pure props): sector rows of econSectors / Dinkop bins. A merged or hidden row is
 * hatched and carries text instead of a number ("Lainnya (digabung)", anonymity note). HTML + CSS only (no d3).
 */
import { nf, rpShort, type Lang } from './strings'

export interface BarRow { key: string; label: string; value: number | null; count: number | null; merged: boolean; note?: string }

export function HatchBars({ rows, lang, title, unit, anon, money = true }: { rows: BarRow[]; lang: Lang; title: string; unit?: string; anon: string; money?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.value ?? 0))
  return (
    <figure className="dk-ie-bars" aria-label={title}>
      <ul>
        {rows.map((r) => (
          <li key={r.key} data-merged={r.merged || undefined} data-hidden={r.value == null || undefined}>
            <span className="dk-ie-blabel">{r.label}</span>
            <span className="dk-ie-btrack" aria-hidden="true">
              {r.value == null ? <span className="dk-ie-hatch is-full" /> : <span className={r.merged ? 'dk-ie-hatch' : 'dk-ie-bfill'} style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />}
            </span>
            <span className="dk-ie-bval dk-num">
              {r.value == null ? anon : money ? rpShort(lang, r.value) : nf(lang, r.value)}
              {r.count != null && money ? <small> · {nf(lang, r.count)} {lang === 'id' ? 'usaha' : 'businesses'}</small> : null}
              {r.note && r.value != null ? <small> · {r.note}</small> : null}
            </span>
          </li>
        ))}
      </ul>
      {unit && <figcaption className="dk-ie-muted">{unit}</figcaption>}
    </figure>
  )
}
