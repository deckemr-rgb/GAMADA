/**
 * Leaderboard — OPD ranking (spec P2: SLA, follow-ups, satisfaction). Every row opens that agency's scorecard
 * (step 4). Sort by composite score, SLA or late follow-ups (Sekda opens on "late"). ↑/↓ move between rows.
 */
import { useMemo, useState, type KeyboardEvent } from 'react'
import { useI18n } from '../../lib/i18n'
import { Icon, Segmented } from '../../demo-kit/ui'
import { useWorld, type Minutes } from '../../demo-kit/world'
import { opdLeaderboard } from '../../demo-kit/world/satu-daerah'
import { nf, tr, trf } from './strings'

type Sort = 'score' | 'sla' | 'late'

export function Leaderboard({ now, onOpen, sortDefault, highlight }: { now: Minutes; onOpen: (opdId: string) => void; sortDefault: Sort; highlight: string | null }) {
  const { lang } = useI18n()
  const [sort, setSort] = useState<Sort>(sortDefault)
  const lb = useWorld((s) => opdLeaderboard(s, now))
  const list = useMemo(() => {
    const l = [...lb]
    if (sort === 'sla') l.sort((a, b) => (a.slaPct ?? 101) - (b.slaPct ?? 101))
    else if (sort === 'late') l.sort((a, b) => b.actionsLate - a.actionsLate || b.openTickets - a.openTickets)
    return l
  }, [lb, sort])
  const rank = useMemo(() => new Map(lb.map((r, i) => [r.opdId, i + 1])), [lb])

  const onKey = (e: KeyboardEvent<HTMLOListElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const btns = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button'))
    const i = btns.indexOf(document.activeElement as HTMLButtonElement)
    if (i < 0) return
    e.preventDefault()
    btns[Math.max(0, Math.min(btns.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus()
  }

  return (
    <section className="dk-mp-panel dk-mp-lb" aria-labelledby="dk-mp-lb-h">
      <header className="dk-mp-ph">
        <h3 id="dk-mp-lb-h">
          <Icon name="bars" size={16} />
          {tr('leaderboard', lang)}
        </h3>
        <Segmented<Sort>
          size="sm"
          label={tr('sortBy', lang)}
          value={sort}
          onChange={setSort}
          options={[
            { value: 'score', label: tr('sScore', lang) },
            { value: 'sla', label: tr('sSla', lang) },
            { value: 'late', label: tr('sLate', lang) },
          ]}
        />
      </header>
      <p className="dk-mp-lb-keys" aria-hidden="true">
        <span>{tr('colOpd', lang)}</span>
        <span>{tr('sScore', lang)}</span>
        <span>SLA</span>
        <span>{tr('colOpen', lang)}</span>
        <span>{tr('colLate', lang)}</span>
      </p>
      <ol className="dk-mp-pb dk-mp-lb-list" onKeyDown={onKey}>
        {list.map((r) => {
          const mine = r.opdId === highlight
          return (
            <li key={r.opdId}>
              <button type="button" className={`dk-mp-lb-row${mine ? ' is-mine' : ''}`} onClick={() => onOpen(r.opdId)} aria-label={`${trf('openScorecard', lang, { o: r.short })}: ${tr('sScore', lang)} ${r.score}, SLA ${r.slaPct ?? tr('noSla', lang)}${r.slaPct !== null ? '%' : ''}, ${r.openTickets} ${tr('colOpen', lang)}, ${r.actionsLate} ${tr('colLate', lang)}`}>
                <span className="dk-mp-lb-rank dk-num">{rank.get(r.opdId)}</span>
                <span className="dk-mp-lb-name">
                  {r.short}
                  {mine && <span className="dk-mp-you">{tr('you', lang)}</span>}
                </span>
                <span className="dk-mp-lb-bar" aria-hidden="true">
                  <span style={{ transform: `scaleX(${r.score / 100})` }} className={r.score < 60 ? 'is-low' : r.score < 75 ? 'is-mid' : ''} />
                </span>
                <span className="dk-mp-lb-score dk-num">{r.score}</span>
                <span className="dk-mp-lb-m dk-num">{r.slaPct === null ? '–' : `${nf(lang, r.slaPct)}%`}</span>
                <span className="dk-mp-lb-m dk-num">{r.openTickets}</span>
                <span className={`dk-mp-lb-m dk-num${r.actionsLate ? ' is-late' : ''}`}>{r.actionsLate}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
