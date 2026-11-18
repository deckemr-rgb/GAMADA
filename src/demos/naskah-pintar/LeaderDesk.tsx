/**
 * Kepala Daerah desk (lazy, only for that role): what waits for the Regent's decision (incoming letters still
 * without a disposition, urgent first, each one a tap from "read & approve"), how far the flood meeting's
 * follow-ups have got, and — kept apart from the meeting — how many older follow-ups are overdue across the agencies.
 * Full on the Rapat tab; on Surat / Tugas it folds into one line so the tab's own content stays on the first screen.
 */
import { memo, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { Badge, Button, Icon } from '../../demo-kit/ui'
import { useShell } from '../../demo-kit/shell'
import { shallowEqual, useClock, useWorld, type WorldState } from '../../demo-kit/world'
import { letterInbox } from '../../demo-kit/world/satu-daerah'
import { rowsOf, sampleMap } from './inbox'
import { SCRIPT, existingAction, opdName, sampleMeeting } from './model'
import type { NpNav } from './index'
import { byText, useStr } from './strings'
import './desk.css'

function meetingProgress(s: WorldState): { made: number; run: number; done: number } {
  const m = sampleMeeting(s)
  if (!m) return { made: 0, run: 0, done: 0 }
  let made = 0
  let run = 0
  let done = 0
  for (const a of SCRIPT.actions) {
    const it = existingAction(s, m.id, a.text)
    if (!it) continue
    made++
    if (it.status === 'proses') run++
    if (it.status === 'selesai') done++
  }
  return { made, run, done }
}

/** overdue follow-ups outside the flood meeting, and the agency with the most of them */
function lateOutside(s: WorldState, now: number, lang: 'id' | 'en'): { n: number; top: string; topN: number } {
  const sample = sampleMeeting(s)?.id
  const per = new Map<string, number>()
  let n = 0
  for (const id of s.actionItems.ids) {
    const a = s.actionItems.byId[id]
    if (!a || a.status === 'selesai' || a.dueAt >= now) continue
    if (a.source.kind === 'meeting' && a.source.id === sample) continue
    n++
    per.set(a.opdId, (per.get(a.opdId) ?? 0) + 1)
  }
  const [topId, topN] = [...per.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? ['', 0]
  return { n, top: topId ? opdName(s, topId, lang) : '', topN }
}

function LeaderDesk({ nav, compact = false }: { nav: NpNav; compact?: boolean }) {
  const S = useStr()
  const { lang } = useI18n()
  const now = useClock().minutes
  /* phones: two letters, so the meeting's play button stays near the first screen */
  const max = useShell().size === 'sm' ? 2 : 3
  const letters = useWorld(letterInbox)
  const prog = useWorld(meetingProgress, shallowEqual)
  const late = useWorld((s) => lateOutside(s, now, lang), shallowEqual)
  /* the folded line can be opened again on Surat / Tugas */
  const [open, setOpen] = useState(false)
  useEffect(() => setOpen(false), [compact])
  const waiting = useMemo(() => {
    const rows = rowsOf(letters, sampleMap(letters)).filter((r) => r.letter.status === 'masuk' && !!r.doc)
    return rows.sort((a, b) => Number(b.sifat === 'segera') - Number(a.sifat === 'segera') || b.letter.receivedAt - a.letter.receivedAt)
  }, [letters])
  const n = SCRIPT.actions.length
  const progText = prog.made ? (prog.done === n ? S.ldAllDone(n) : S.ldProgress(prog.run, prog.done, n)) : S.ldNoMinutesShort

  if (compact && !open)
    return (
      <section className="dk-np-desk is-line" aria-label={S.ldLabel}>
        <Icon name="stamp" size={16} />
        <p>
          <b>{S.ldWaitingShort(waiting.length)}</b>
          <span className="dk-np-muted"> · {S.ldMeetingShort}: {progText}</span>
        </p>
        <Button size="sm" variant="quiet" icon="chevronDown" onClick={() => setOpen(true)} aria-expanded={false} data-np="desk-open">
          {S.ldExpand}
        </Button>
      </section>
    )

  return (
    <section className="dk-np-desk" aria-label={S.ldLabel}>
      <div className="dk-np-desk-col">
        <h3>
          <Icon name="stamp" size={16} />
          {S.ldWaiting(waiting.length)}
        </h3>
        {waiting.length ? (
          <ul className="dk-np-desk-list">
            {waiting.slice(0, max).map((r) => (
              <li key={r.letter.id}>
                <span className="dk-np-desk-t">
                  <b>{r.subject[lang]}</b>
                  <span className="dk-np-muted">
                    {byText(r.from, lang)}
                    {r.sifat === 'segera' && (
                      <>
                        {' '}
                        <Badge tone="warn">{S.sifat.segera}</Badge>
                      </>
                    )}
                  </span>
                </span>
                <Button size="sm" variant="primary" icon="spark" onClick={() => nav.go('surat', { letterId: r.letter.id, autoRead: true })} data-np="desk-read">
                  {S.ldOpen}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="dk-np-muted">{S.ldNone}</p>
        )}
        {waiting.length > max && (
          <Button size="sm" variant="quiet" icon="inbox" onClick={() => nav.go('surat')} data-np="desk-all">
            {S.ldAll(waiting.length)}
          </Button>
        )}
      </div>
      <div className="dk-np-desk-col">
        <h3>
          <Icon name="kanban" size={16} />
          {S.ldMeeting}
        </h3>
        {prog.made ? (
          <>
            <p className="dk-np-desk-prog">
              <span className="dk-np-desk-bar" aria-hidden="true">
                <span style={{ transform: `scaleX(${(prog.run + prog.done) / n})` }} />
              </span>
              <span>
                {prog.done === n && <Icon name="checkCircle" size={14} />} {progText}
              </span>
            </p>
            <Button size="sm" variant="secondary" icon="kanban" onClick={() => nav.go('tindak', { opdIds: [...new Set(SCRIPT.actions.map((a) => a.opdId))] })}>
              {S.ldBoard}
            </Button>
          </>
        ) : (
          <>
            <p className="dk-np-muted">{S.ldNoMinutes}</p>
            {nav.tab !== 'rapat' && (
              <Button size="sm" variant="secondary" icon="mic" onClick={() => nav.go('rapat')}>
                {S.ldToMeeting}
              </Button>
            )}
          </>
        )}
        {/* older work, kept apart from the meeting's own progress (it is not the flood meeting's tasks running late) */}
        <div className="dk-np-desk-old">
          <p className={late.n ? 'dk-np-desk-late' : 'dk-np-muted'}>{S.ldLateOld(late.n, late.top, late.topN)}</p>
          {late.n > 0 && (
            <Button size="sm" variant="quiet" icon="alert" onClick={() => nav.go('tindak', { lateOnly: true })} data-np="desk-late">
              {S.ldLateSee}
            </Button>
          )}
        </div>
        {compact && (
          <Button size="sm" variant="quiet" icon="chevronUp" onClick={() => setOpen(false)} aria-expanded data-np="desk-close">
            {S.ldCollapse}
          </Button>
        )}
      </div>
    </section>
  )
}

export default memo(LeaderDesk)
