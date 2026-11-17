/**
 * The minutes that write themselves: participants, agenda, discussion, decisions and the follow-up table appear at
 * the transcript line that produced them; each new follow-up flies (ghost card, transform/opacity) into its
 * agency's lane below. Lanes open the Tindak Lanjut board on that agency.
 */
import { memo, useEffect, useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { useI18n } from '../../lib/i18n'
import { Badge, Icon, StatusChip, flashNewRow, motionMode } from '../../demo-kit/ui'
import { useWorld, type WorldState } from '../../demo-kit/world'
import { CLIP, NP, SCRIPT, SPEAKER_FIRST, dueText, existingAction, opdName, picLabel, type ScriptLine } from './model'
import type { NpNav } from './index'
import { useStr } from './strings'

interface Props {
  /** highest transcript line reached (-1 = nothing yet) */
  reached: number
  writing: boolean
  meetingId: string | null
  summary: string
  summaryMode: 'sim' | 'live' | null
  summaryBusy: boolean
  liveCheck: { d: number; a: number } | null
  colors: Map<string, string>
  nav: NpNav
  /** fly new follow-ups into their lane (only while the meeting plays) */
  animate: boolean
  /** discussion points (point 1 carries the world's river report) */
  topics: ScriptLine[]
}

const LANES = [...new Set(SCRIPT.actions.map((a) => a.opdId))]

/** status of each script follow-up in the world (null until created) */
function statuses(s: WorldState, meetingId: string | null): string {
  if (!meetingId) return ''
  return SCRIPT.actions.map((a) => existingAction(s, meetingId, a.text)?.status ?? '-').join('|')
}

export const Minutes = memo(function Minutes({ reached, writing, meetingId, summary, summaryMode, summaryBusy, liveCheck, colors, nav, animate, topics: allTopics }: Props) {
  const S = useStr()
  const { lang } = useI18n()
  const day = useWorld((s) => s.day)
  const status = useWorld((s) => statuses(s, meetingId)).split('|')
  const root = useRef<HTMLElement>(null)
  const seen = useRef<Set<string> | null>(null)
  const anims = useRef<(() => void)[]>([])
  useEffect(
    () => () => {
      for (const k of anims.current) k()
      anims.current = []
    },
    [],
  )

  const people = SPEAKER_FIRST.filter((p) => p.seg <= reached)
  const agenda = SCRIPT.agenda.filter((x) => x.seg <= reached)
  const topics = allTopics.filter((x) => x.seg <= reached)
  const decisions = SCRIPT.decisions.filter((x) => x.seg <= reached)
  const actions = SCRIPT.actions.filter((x) => x.seg <= reached)
  const label = new Map(CLIP.speakers.map((sp) => [sp.id, sp.label[lang]]))

  /* new rows: flash + fly into their lane */
  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    const keys = [...el.querySelectorAll<HTMLElement>('[data-mkey]')].map((n) => n.dataset.mkey ?? '')
    if (seen.current === null || !animate) {
      seen.current = new Set(keys)
      return
    }
    const body = el.querySelector<HTMLElement>('.dk-np-mbody')
    const fresh = keys.filter((k) => !seen.current?.has(k))
    const last = fresh.length ? el.querySelector<HTMLElement>(`[data-mkey="${fresh[fresh.length - 1]}"]`) : null
    if (body && last) {
      const top = last.offsetTop - body.offsetTop
      if (top + last.offsetHeight > body.scrollTop + body.clientHeight || top < body.scrollTop) body.scrollTo({ top: Math.max(0, top - body.clientHeight + last.offsetHeight + 24), behavior: motionMode() === 'full' ? 'smooth' : 'auto' })
    }
    const kills = anims.current
    if (kills.length > 40) kills.splice(0, 20)
    const host = el.closest<HTMLElement>('.dk-np-meeting') ?? el
    for (const k of keys) {
      if (seen.current.has(k)) continue
      seen.current.add(k)
      const node = el.querySelector<HTMLElement>(`[data-mkey="${k}"]`)
      if (!node) continue
      kills.push(flashNewRow(node))
      const act = SCRIPT.actions.find((a) => `act-${a.key}` === k)
      const lane = act ? host.querySelector<HTMLElement>(`[data-lane="${act.opdId}"]`) : null
      if (act && lane && motionMode() === 'full') {
        kills.push(flyCard(host, node, lane, act.text[lang], () => flashNewRow(lane.querySelector<HTMLElement>(`[data-lchip="${act.key}"]`) ?? lane)))
      } else if (lane) kills.push(flashNewRow(lane))
    }
  })
  // a fresh run (reached back to -1) forgets what was already shown
  useLayoutEffect(() => {
    if (reached < 0) seen.current = new Set()
  }, [reached])

  const empty = reached < 0
  return (
    <section ref={root} className="dk-np-card dk-np-minutes" aria-label={S.nTitle}>
      <header className="dk-np-card-h">
        <h3>
          <Icon name="doc" size={16} />
          {S.nTitle}
        </h3>
        {writing && (
          <span className="dk-np-writing" role="status">
            <i aria-hidden="true" />
            <i aria-hidden="true" />
            <i aria-hidden="true" />
            {S.nWriting}
          </span>
        )}
      </header>
      {empty ? (
        <p className="dk-np-empty">{S.nEmpty}</p>
      ) : (
        <div className="dk-np-mbody" aria-live="polite" aria-relevant="additions">
          <div className="dk-np-msec">
            <h4>{S.nParticipants}</h4>
            <ul className="dk-np-people">
              {people.map((p) => (
                <li key={p.id} data-mkey={`p-${p.id}`}>
                  <span className="dk-flash" aria-hidden="true" />
                  <i style={{ background: colors.get(p.id) }} aria-hidden="true" />
                  {label.get(p.id)}
                </li>
              ))}
            </ul>
          </div>
          {agenda.length > 0 && (
            <div className="dk-np-msec">
              <h4>{S.nAgenda}</h4>
              {agenda.map((x) => (
                <p key={x.key} data-mkey={x.key} className="dk-np-mline">
                  <span className="dk-flash" aria-hidden="true" />
                  {x.text[lang]}
                </p>
              ))}
            </div>
          )}
          {topics.length > 0 && (
            <div className="dk-np-msec">
              <h4>{S.nTopics}</h4>
              <ul className="dk-np-bullets">
                {topics.map((x) => (
                  <li key={x.key} data-mkey={x.key}>
                    <span className="dk-flash" aria-hidden="true" />
                    {x.text[lang]}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {decisions.length > 0 && (
            <div className="dk-np-msec">
              <h4>{S.nDecisions}</h4>
              <ol className="dk-np-decisions">
                {decisions.map((x) => (
                  <li key={x.key} data-mkey={x.key}>
                    <span className="dk-flash" aria-hidden="true" />
                    {x.text[lang]}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {actions.length > 0 && (
            <div className="dk-np-msec">
              <h4>
                {S.nActions} <Badge tone="accent">{actions.length}</Badge>
              </h4>
              <div className="dk-np-acts" role="table" aria-label={S.nActions}>
                <div className="dk-np-acts-r is-head" role="row">
                  <span role="columnheader">{S.nTask}</span>
                  <span role="columnheader">{S.nPic}</span>
                  <span role="columnheader">{S.nDue}</span>
                  <span role="columnheader">{S.nStatus}</span>
                </div>
                {actions.map((a) => {
                  const st = status[SCRIPT.actions.indexOf(a)] ?? '-'
                  const mine = nav.myOpd === a.opdId
                  return (
                    <div key={a.key} role="row" data-mkey={`act-${a.key}`} className={`dk-np-acts-r${mine ? ' is-mine' : ''}`}>
                      <span className="dk-flash" aria-hidden="true" />
                      <span role="cell" className="dk-np-acts-task">
                        {a.text[lang]}
                        {mine && <Badge tone="accent">{S.nYourUnit}</Badge>}
                      </span>
                      <span role="cell" data-label={S.nPic}>
                        {picLabel(a.pic, lang, a.opdId)}
                      </span>
                      <span role="cell" data-label={S.nDue} className="dk-num">
                        {dueText(a.dueAt, lang, day)}
                      </span>
                      <span role="cell" data-label={S.nStatus}>
                        <StatusChip label={st === '-' ? S.fStatus.baru : (S.fStatus[st as keyof typeof S.fStatus] ?? st)} tone={st === 'selesai' ? 'done' : st === 'proses' ? 'warn' : 'new'} />
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          <div className="dk-np-msec" data-mkey={summary ? 'sum' : undefined}>
            <h4>
              {S.nSummary}
              {summaryMode && <Badge tone={summaryMode === 'live' ? 'accent' : 'neutral'}>{S.lAiMode[summaryMode]}</Badge>}
            </h4>
            {summary ? (
              <p className={`dk-np-summary${summaryBusy ? ' is-streaming' : ''}`}>{summary}</p>
            ) : summaryBusy ? (
              <p className="dk-np-summary is-streaming">
                <span className="dk-np-dots" aria-label={S.nWriting}>
                  <i />
                  <i />
                  <i />
                </span>
              </p>
            ) : (
              <p className="dk-np-muted">{S.nSummaryWait}</p>
            )}
            {liveCheck && <p className="dk-np-livecheck">{S.nLiveCheck(liveCheck.d, liveCheck.a)}</p>}
          </div>
        </div>
      )}

    </section>
  )
})

/** ghost card flight row → lane (transform/opacity only, one GSAP timeline on the shared ticker) */
function flyCard(host: HTMLElement, from: HTMLElement, to: HTMLElement, text: string, onLand: () => void): () => void {
  const r0 = host.getBoundingClientRect()
  const a = from.getBoundingClientRect()
  const b = to.getBoundingClientRect()
  const ghost = document.createElement('div')
  ghost.className = 'dk-np-ghost'
  ghost.textContent = text
  ghost.setAttribute('aria-hidden', 'true')
  ghost.style.left = `${a.left - r0.left}px`
  ghost.style.top = `${a.top - r0.top}px`
  ghost.style.width = `${Math.min(a.width, 300)}px`
  host.appendChild(ghost)
  const dx = b.left - a.left + 6
  const dy = b.top - a.top + 6
  const tl = gsap.timeline({
    onComplete: () => {
      ghost.remove()
      onLand()
    },
  })
  tl.fromTo(ghost, { x: 0, y: 0, scale: 1, opacity: 0 }, { x: dx * 0.45, y: dy * 0.45 - 36, scale: 0.86, opacity: 1, duration: NP.fly * 0.5, ease: 'power2.out' })
  tl.to(ghost, { x: dx, y: dy, scale: 0.5, opacity: 0, duration: NP.fly * 0.5, ease: 'power2.in' })
  return () => {
    tl.kill()
    ghost.remove()
  }
}

/** one lane per agency of the meeting's follow-ups (targets of the flying cards); opens the board on that agency */
export const Lanes = memo(function Lanes({ reached, nav }: { reached: number; nav: NpNav }) {
  const S = useStr()
  const { lang } = useI18n()
  const laneNames = useWorld((s) => LANES.map((id) => opdName(s, id, lang, true)).join('|')).split('|')
  const actions = SCRIPT.actions.filter((x) => x.seg <= reached)
  return (
      <div className="dk-np-lanes" aria-label={S.lanesTitle} role="group">
      <p className="dk-np-lanes-h">
        <b>{S.lanesTitle}</b>
        <span>{S.lanesHint}</span>
      </p>
      <div className="dk-np-lanes-row">
        {LANES.map((opd, i) => {
          const mine = actions.filter((a) => a.opdId === opd)
          const name = laneNames[i] ?? opd
          return (
            <button key={opd} type="button" className={`dk-np-lane${nav.myOpd === opd ? ' is-mine' : ''}`} data-lane={opd} onClick={() => nav.go('tindak', { opdId: opd })} aria-label={S.laneOpen(name, mine.length)}>
              <span className="dk-flash" aria-hidden="true" />
              <span className="dk-np-lane-h">
                <b>{name}</b>
                <span className="dk-num">{mine.length}</span>
              </span>
              <span className="dk-np-lane-list">
                {mine.map((a) => (
                  <span key={a.key} className="dk-np-lchip" data-lchip={a.key}>
                    <span className="dk-flash" aria-hidden="true" />
                    {a.text[lang]}
                  </span>
                ))}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
})
