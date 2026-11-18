/**
 * KybChecks — the KYB cross-check matrix (standalone, pure props; mini.tsx can reuse it): fields (nama usaha,
 * pemilik/direktur, alamat, KBLI) × documents (NIB, NPWP, Akta, Foto lokasi) with ✓ / ≠ and the values read.
 * `compact` (phones) renders one card per field.
 */
import { Icon } from '../../demo-kit/ui'
import type { KybCase } from '../../demo-kit/world/usaha-pintar'

type DocKind = 'nib' | 'npwp' | 'akta' | 'lokasi'
const norm = (v: string) => v.toLowerCase().replace(/\(gps foto\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

export interface KybChecksProps {
  matrix: KybCase['matrix']
  kinds: DocKind[]
  lang: 'id' | 'en'
  title: string
  kindLabel: Record<string, string>
  cell: { ok: string; bad: string; none: string }
  compact?: boolean
}

/** a cell differs when its value is not the NIB's value (normalised) on a field that failed */
export function cellState(row: KybCase['matrix'][number], kind: DocKind): 'ok' | 'bad' | 'none' {
  const v = row.values[kind]
  if (v == null) return 'none'
  if (row.ok) return 'ok'
  const ref = row.values.nib
  return ref != null && norm(v) === norm(ref) ? 'ok' : 'bad'
}

export function KybChecks({ matrix, kinds, lang, title, kindLabel, cell, compact }: KybChecksProps) {
  if (compact)
    return (
      <section className="dk-km-matrix is-cards" aria-label={title}>
        <h4>{title}</h4>
        {matrix.map((row) => (
          <article key={row.field} className={`dk-km-mcard${row.ok ? '' : ' is-bad'}`} data-field={row.field}>
            <h5>
              <Icon name={row.ok ? 'checkCircle' : 'xCircle'} size={14} />
              {row.label[lang]}
            </h5>
            <dl>
              {kinds.map((k) => {
                const st = cellState(row, k)
                if (st === 'none') return null
                return (
                  <div key={k} className={`is-${st}`}>
                    <dt>{kindLabel[k]}</dt>
                    <dd>
                      <span>{row.values[k]}</span>
                      <em>{st === 'ok' ? `✓ ${cell.ok}` : `≠ ${cell.bad}`}</em>
                    </dd>
                  </div>
                )
              })}
            </dl>
          </article>
        ))}
      </section>
    )
  return (
    <section className="dk-km-matrix" aria-label={title}>
      <h4>{title}</h4>
      <table>
        <thead>
          <tr>
            <th scope="col">
              <span className="dk-sr">{title}</span>
            </th>
            {kinds.map((k) => (
              <th key={k} scope="col">
                {kindLabel[k]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row) => (
            <tr key={row.field} className={row.ok ? undefined : 'is-bad'} data-field={row.field}>
              <th scope="row">
                <Icon name={row.ok ? 'checkCircle' : 'xCircle'} size={14} />
                {row.label[lang]}
              </th>
              {kinds.map((k) => {
                const st = cellState(row, k)
                return (
                  <td key={k} className={`is-${st}`}>
                    {st === 'none' ? (
                      <span className="dk-km-muted" aria-label={cell.none}>
                        —
                      </span>
                    ) : (
                      <>
                        <span aria-hidden="true" className="dk-km-mark">
                          {st === 'ok' ? '✓' : '≠'}
                        </span>
                        <span>{row.values[k]}</span>
                        <span className="dk-sr">{st === 'ok' ? cell.ok : cell.bad}</span>
                      </>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
