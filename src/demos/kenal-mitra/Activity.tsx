/**
 * Activity — the last 6 verification rows of the world audit log (requests and decisions; a CV batch is one row).
 */
import type { Lang } from './strings'

export interface ActivityRow {
  id: string
  at: number
  kind: 'req' | 'done'
  text: { id: string; en: string }
  /** a CV batch: number of candidates in it */
  batch?: number
}

export function ActivityList({ rows, lang, title, empty, batchText, time }: { rows: ActivityRow[]; lang: Lang; title: string; empty: string; batchText: (n: number) => string; time: (m: number) => string }) {
  return (
    <section className="dk-km-activity" aria-label={title}>
      <h3>{title}</h3>
      {rows.length ? (
        <ol>
          {rows.map((r) => (
            <li key={r.id} className={`is-${r.kind}`}>
              <time className="dk-num">{time(r.at)}</time>
              <span>{r.batch && r.batch > 1 ? batchText(r.batch) : r.text[lang]}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="dk-km-muted">{empty}</p>
      )}
    </section>
  )
}
