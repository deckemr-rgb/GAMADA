/**
 * Leaderboard — OPD ranking (spec P2: SLA, follow-ups, satisfaction). Every row opens that agency's scorecard
 * (step 4). Sort by composite score, SLA or late follow-ups (Sekda opens on "late"). ↑/↓ move between rows.
 */
import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useI18n } from '../../lib/i18n'
import { Icon, Segmented } from '../../demo-kit/ui'
import { shallowEqual, useWorld } from '../../demo-kit/world'
import { OPD_MIN_SAMPLE, mpLeaderboard, useNow, type MpOpdRow } from './data'
import { nf, tr, trf } from './strings'

type Sort = 'score' | 'sla' | 'late'

type Row = MpOpdRow
const sameRows = (a: Row[], b: Row[]) => a.length === b.length && a.every((x, i) => shallowEqual(x, b[i]!))

export function Leaderboard({ onOpen, sortDefault, highlight }: { onOpen: (opdId: string) => void; sortDefault: Sort; highlight: string | null }) {
  const { lang } = useI18n()
  const [sort, setSort] = useState<Sort>(sortDefault)
  const now = useNow(5)
  const lb = useWorld((s) => mpLeaderboard(s, now), sameRows)
  const list = useMemo(() => {
    const l = [...lb]
    if (sort === 'sla') l.sort((a, b) => (a.slaPct ?? 101) - (b.slaPct ?? 101))
    else if (sort === 'late') l.sort((a, b) => b.actionsLate - a.actionsLate || b.lateTickets - a.lateTickets)
    // agencies without a rank: the ones with the most late work first (not alphabetical)
    else l.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || (a.score === null ? b.actionsLate - a.actionsLate || b.lateTickets - a.lateTickets : 0))
    return l
  }, [lb, sort])

  // roving tabindex: the list is ONE Tab stop; ↑/↓ (Home/End) move between rows, Enter opens the scorecard
  const [active, setActive] = useState<string | null>(null)
  const cur = list.some((r) => r.opdId === active) ? active : (list[0]?.opdId ?? null)
  const listRef = useRef<HTMLOListElement>(null)
  const onKey = (e: KeyboardEvent<HTMLOListElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
    const i = list.findIndex((r) => r.opdId === cur)
    if (i < 0) return
    e.preventDefault()
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : Math.max(0, Math.min(list.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))
    const id = list[j]?.opdId
    if (!id) return
    setActive(id)
    listRef.current?.querySelector<HTMLButtonElement>(`[data-opd="${id}"]`)?.focus()
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
        <span>{tr('colSla', lang)}</span>
        <span>{tr('colPastSla', lang)}</span>
        <span>{tr('colLate', lang)}</span>
      </p>
      <ol ref={listRef} className="dk-mp-pb dk-mp-lb-list" onKeyDown={onKey} aria-label={`${tr('leaderboard', lang)} · ${tr('lbKeys', lang)}`}>
        {list.map((r) => {
          const mine = r.opdId === highlight
          return (
            <li key={r.opdId}>
              <button type="button" className={`dk-mp-lb-row${mine ? ' is-mine' : ''}`} data-opd={r.opdId} tabIndex={r.opdId === cur ? 0 : -1} onFocus={() => setActive(r.opdId)} onClick={() => onOpen(r.opdId)} aria-label={`${trf('openScorecard', lang, { o: r.short })}: ${r.score === null ? trf('notEnoughN', lang, { n: r.closed30 + r.lateTickets }) : `${tr('sScore', lang)} ${r.score} (${trf('lbN', lang, { n: r.closed30 + r.lateTickets })}), ${tr('colSla', lang)} ${r.slaPct}%`}, ${r.lateTickets} ${tr('colPastSla', lang)}, ${r.openTickets} ${tr('colOpen', lang)}, ${r.actionsLate} ${tr('colLate', lang)}`}>
                <span className="dk-mp-lb-rank dk-num">{r.rank ?? '–'}</span>
                <span className="dk-mp-lb-name">
                  {r.short}
                  {/* a thin sample is shown, so a rank from 4 tickets reads as such */}
                  {r.score !== null && r.closed30 + r.lateTickets < 10 && <small className="dk-mp-lb-n dk-num">{trf('lbN', lang, { n: r.closed30 + r.lateTickets })}</small>}
                  {mine && <span className="dk-mp-you">{tr('you', lang)}</span>}
                </span>
                {r.score === null ? (
                  <span className="dk-mp-lb-na">{trf('notEnoughN', lang, { n: r.closed30 + r.lateTickets })}</span>
                ) : (
                  <>
                    <span className="dk-mp-lb-bar" aria-hidden="true">
                      <span style={{ transform: `scaleX(${r.score / 100})` }} className={r.score < 60 ? 'is-low' : r.score < 75 ? 'is-mid' : ''} />
                    </span>
                    <span className="dk-mp-lb-score dk-num">{r.score}</span>
                  </>
                )}
                <span className="dk-mp-lb-m dk-num">{r.slaPct === null ? '–' : `${nf(lang, r.slaPct)}%`}</span>
                <span className={`dk-mp-lb-m dk-num${r.lateTickets ? ' is-late' : ''}`}>{r.lateTickets}</span>
                <span className={`dk-mp-lb-m dk-num${r.actionsLate ? ' is-late' : ''}`}>{r.actionsLate}</span>
              </button>
            </li>
          )
        })}
        {/* the scoring rule scrolls with the list (on the wall the panel has room for rows, not for a footnote) */}
        <li className="dk-mp-lb-rule">{trf('lbRule', lang, { n: OPD_MIN_SAMPLE })}</li>
      </ol>
    </section>
  )
}
