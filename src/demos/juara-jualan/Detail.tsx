/**
 * demos/juara-jualan/Detail.tsx — one conversation: header (agent, customer, channel, score), the recording with its
 * moments (WaveMoments), the synced transcript, the six criteria with evidence quotes and "Seharusnya" fixes, and the
 * supervisor actions: "Nilai sekarang" (AI scoring from the clip's ok/miss tags, total via callScore), "Ubah skor"
 * (per criterion, `by: 'supervisor'`) and "Tugaskan coaching". A pre-order WA chat (C17) shows its PO, price and ETA
 * from the world; a flood-topic call links to the warning in Siaga Wilayah.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router'
import { Badge, Button, Chip, Icon, Score, Skeleton } from '../../demo-kit/ui'
import { usePlayback, mmss } from '../../demo-kit/media'
import { demoHref, useShell } from '../../demo-kit/shell'
import { emit, fmtRp, hhmm, rows, useClock, useSession, useWorld, world, type Criteria, type CriterionKey } from '../../demo-kit/world'
import { CALL_CRITERIA, CALL_FLAG, CALL_WEIGHTS, CRITERIA_KEYS, PRAPESAN_CLIP, callScore, weakest } from '../../demo-kit/world/usaha-pintar'
import { DEMO_READY } from '../registry'
import { buildClip, criteriaFromTags, flagsFor, useClipLib, type Moment } from './clips'
import { WaveMoments } from './WaveMoments'
import { Transcript } from './Transcript'
import { SLUG, clockText, customerParts, useT } from './strings'

export interface DetailProps {
  callId: string
  supervisor: boolean
  sm: boolean
  /** bump to seek to the danger moment once the clip is ready (phone list shortcut) */
  seekDanger?: number
  onAssign: (agentId: string, callId: string | null, keys: CriterionKey[]) => void
  onAssignIntent: () => void
}

const EMPTY: never[] = []
const keep = () => (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('controls') === 'all' ? '&controls=all' : '')

export default function Detail({ callId, supervisor, sm, seekDanger = 0, onAssign, onAssignIntent }: DetailProps) {
  const { t, lang } = useT()
  const shell = useShell()
  const session = useSession()
  const call = useWorld((s) => s.calls.byId[callId])
  const agent = useWorld((s) => (call ? s.agentsSales.byId[call.agentId] : undefined))
  const po = useWorld((s) => (call?.refId ? s.purchaseOrders.byId[call.refId] : undefined))
  const alertId = useWorld((s) => (call?.topic === 'banjir' ? (rows(s.alerts).find((a) => a.kind === 'banjir')?.id ?? null) : null))
  const now = useClock().minutes
  const lib = useClipLib(call?.industry ?? 'toko-bangunan')
  const clip = useMemo(() => (call && lib ? buildClip(world.get(), call, lib) : null), [callId, call?.transcript, call?.customer, po, lib]) // eslint-disable-line react-hooks/exhaustive-deps
  const [voice, setVoice] = useState(false)
  const { pb, state } = usePlayback(clip?.segments ?? EMPTY, 'id-ID', { tts: voice })
  const resume = useRef<{ seg: number; play: boolean } | null>(null)
  const [scoring, setScoring] = useState(false)
  const [fresh, setFresh] = useState(false)
  const [draft, setDraft] = useState<Criteria | null>(null)
  const timer = useRef(0)

  // a new call: silent again, no edit, nothing pending
  useEffect(() => {
    setVoice(false)
    setDraft(null)
    setFresh(false)
    setScoring(false)
    window.clearTimeout(timer.current)
  }, [callId])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  // "Putar suara" swaps the engine: continue from the same line
  useEffect(() => {
    const r = resume.current
    if (!r) return
    resume.current = null
    if (r.seg >= 0) pb.toSegment(r.seg)
    if (r.play) pb.play()
  }, [pb])

  const markIfDanger = () => {
    if (!clip) return
    const at = pb.getState().time
    if (clip.moments.some((m) => m.tone === 'danger' && Math.abs(m.t - at) <= 0.3)) shell.markMission('momen')
  }
  const goMoment = (m: Moment) => {
    pb.seek(m.t)
    markIfDanger()
  }
  const goLine = (i: number, check = false) => {
    pb.toSegment(i)
    if (check) markIfDanger()
  }
  // phone shortcut from the list: open at the red moment
  const lastSeek = useRef(0)
  useEffect(() => {
    if (!clip || !seekDanger || seekDanger === lastSeek.current) return
    lastSeek.current = seekDanger
    const m = clip.moments.find((x) => x.tone === 'danger')
    if (m) goMoment(m)
  }, [clip, seekDanger]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!call) return null
  const cust = customerParts(call.customer, lang)
  const end = call.at + Math.ceil(call.durationSec / 60)
  const live = call.score === null && call.at <= now && now < end
  const crit = draft ?? call.criteria
  const total = draft ? callScore(draft) : call.score
  const prapesan = call.transcript === PRAPESAN_CLIP
  const flags = call.flags.length ? call.flags : []

  const scoreNow = () => {
    if (!clip || scoring) return
    setScoring(true)
    const id = call.id
    const code = id
    timer.current = window.setTimeout(() => {
      const c = criteriaFromTags(clip, id)
      const score = callScore(c)
      emit('call.scored', { callId: id, score, criteria: c, flags: flagsFor(c), by: 'ai' }, SLUG)
      setScoring(false)
      setFresh(true)
      shell.toast({ title: t.scoredToast(score, code), body: t.scoredBody(agent?.name ?? ''), tone: score < 60 ? 'warn' : 'accent', icon: 'checkCircle' })
    }, 1200)
  }
  const saveManual = () => {
    if (!draft) return
    const score = callScore(draft)
    emit('call.scored', { callId: call.id, score, criteria: draft, flags: flagsFor(draft), by: 'supervisor' }, SLUG)
    setDraft(null)
    setFresh(true)
    shell.toast({ title: t.manualToast(score, call.id), body: t.scoredBody(agent?.name ?? ''), tone: 'accent', icon: 'edit' })
  }
  const onKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== ' ' || e.defaultPrevented) return
    const el = e.target as HTMLElement
    if (el.closest('input, textarea, select, button, a, [role="slider"]')) return
    e.preventDefault()
    pb.toggle()
  }
  const toggleVoice = () => {
    const st = pb.getState()
    resume.current = { seg: st.seg, play: !voice || st.playing }
    setVoice((v) => !v)
  }
  const poCode = po?.code ?? ''
  const poProd = po ? po.items.map((i) => world.get().products.byId[i.productId]).filter((p) => !!p).sort((a, b) => Number(b!.tags.includes('flood')) - Number(a!.tags.includes('flood')))[0] : undefined
  const eta = po?.reply?.eta
  const etaTxt = eta == null ? t.poWait : eta >= 1440 ? t.tomorrow(clockText(hhmm(eta), lang)) : t.todayAt(clockText(hhmm(eta), lang))
  const taReady = !!DEMO_READY['toko-autopilot']

  return (
    <article className="dk-jj-detail" aria-label={t.detail} onKeyDown={onKey} data-call={call.id} tabIndex={-1}>
      <header className="dk-jj-dh">
        <div className="dk-jj-dh-main">
          <p className="dk-jj-eyebrow">
            <Icon name={call.channel === 'wa' ? 'chat' : 'phone'} size={14} /> {call.channel === 'wa' ? t.wa : t.tel} · {clockText(hhmm(call.at), lang)} · {call.id}
          </p>
          <h3 className="dk-jj-dh-t">{agent?.name ?? ''}</h3>
          <p className="dk-jj-muted">
            {cust.full}
            {call.durationSec > 0 && ` · ${t.dur(mmss(call.durationSec))}`}
          </p>
          <div className="dk-jj-dh-chips">
            {live && <Badge tone="accent">{t.inProgress}</Badge>}
            {flags.map((f) => (
              <Chip key={f} tone="danger" icon="flag">
                {CALL_FLAG[f]?.[lang] ?? f}
              </Chip>
            ))}
            {call.topic === 'banjir' && alertId && (
              <Link className="dk-jj-flood" to={demoHref('siaga-wilayah', session, alertId) + keep()} aria-label={t.floodOpen}>
                <Icon name="water" size={14} /> {t.floodChip}
              </Link>
            )}
          </div>
        </div>
        <div className="dk-jj-dh-score">
          {total !== null ? (
            <Score value={total} label={t.scoreOf(total)} size={sm ? 56 : 72} caption={call.scoredBy === 'supervisor' && !draft ? t.bySup : t.byAi} />
          ) : (
            <Badge tone="warn">{t.unscored}</Badge>
          )}
        </div>
      </header>

      {prapesan && po && (
        <section className="dk-jj-po" aria-label={t.poTitle(poCode)}>
          <p className="dk-jj-h4">
            <Icon name="package" size={16} /> {t.poTitle(poCode)}
          </p>
          <dl className="dk-jj-dl">
            <dt>{t.poItem}</dt>
            <dd>{poProd?.name ?? ''}</dd>
            <dt>{t.poPrice}</dt>
            <dd className="dk-num">
              {poProd ? fmtRp(poProd.price) : ''} <span className="dk-jj-sim">{t.sim}</span>
            </dd>
            <dt>{t.poEta}</dt>
            <dd>{etaTxt}</dd>
          </dl>
          {taReady ? (
            <Link className="dk-jj-inlink" to={demoHref('toko-autopilot', session, po.id) + keep()}>
              {t.poOpen(poCode)} <Icon name="arrowUpRight" size={14} />
            </Link>
          ) : (
            <p className="dk-jj-faint">{t.poSoon(poCode)}</p>
          )}
        </section>
      )}

      {supervisor && (
        <div className="dk-jj-actions">
          {call.score === null && (
            <Button
              variant="primary"
              icon="spark"
              data-jj="score-now"
              onClick={scoreNow}
              disabled={live || scoring || !clip}
              aria-describedby={live ? `jj-live-${call.id}` : undefined}
            >
              {scoring ? t.scoring : t.scoreNow}
            </Button>
          )}
          {live && (
            <span id={`jj-live-${call.id}`} className="dk-jj-faint">
              {t.liveWait}
            </span>
          )}
          {call.score !== null && !draft && (
            <Button variant="secondary" icon="edit" onClick={() => setDraft({ ...(call.criteria ?? ({} as Criteria)) })}>
              {t.edit}
            </Button>
          )}
          {draft && (
            <>
              <Button variant="primary" icon="check" onClick={saveManual}>
                {t.save}
              </Button>
              <Button variant="ghost" onClick={() => setDraft(null)}>
                {t.cancel}
              </Button>
            </>
          )}
          {agent && (
            <Button
              variant="secondary"
              icon="users"
              data-jj="assign"
              onPointerEnter={onAssignIntent}
              onFocus={onAssignIntent}
              onClick={() => onAssign(agent.id, call.id, weakest(call.criteria ?? agent.radar, 3))}
            >
              {t.assign}
            </Button>
          )}
        </div>
      )}

      {!clip ? (
        <Skeleton lines={6} />
      ) : (
        <>
          <WaveMoments
            peaks={clip.peaks}
            duration={clip.duration}
            moments={clip.moments}
            state={state}
            progress={() => (clip.duration ? pb.getState().time / clip.duration : 0)}
            onToggle={() => pb.toggle()}
            onSeek={(sec) => pb.seek(sec)}
            onMoment={goMoment}
            voice={voice}
            onVoice={toggleVoice}
            chips={sm}
            hotspot
            t={t}
            lang={lang}
          />
          <p className="dk-jj-faint">{t.clipOf(mmss(clip.duration), call.durationSec ? mmss(call.durationSec) : '—')}</p>
          <div className="dk-jj-dgrid">
            <Transcript clip={clip} current={state.seg} wa={call.channel === 'wa'} agent={agent?.name ?? ''} customer={cust.name} onLine={(i) => goLine(i)} t={t} lang={lang} />
            <section className="dk-jj-crit" aria-label={t.criteria}>
              <p className="dk-jj-h4">{t.criteria}</p>
              {draft && <p className="dk-jj-faint">{t.editHint}</p>}
              <ul className={`dk-jj-bars${fresh ? ' is-fresh' : ''}`}>
                {CRITERIA_KEYS.map((k, i) => {
                  const v = crit?.[k] ?? null
                  const ev = clip.evidence[k]
                  const line = ev !== null ? clip.lines[ev] : null
                  const miss = line?.tags.some((g) => g.k === k && !g.ok)
                  return (
                    <li key={k} className="dk-jj-bar" style={{ animationDelay: `${i * 60}ms` }}>
                      <span className="dk-jj-bar-h">
                        <span>
                          {CALL_CRITERIA[k][lang]} <span className="dk-jj-faint">×{CALL_WEIGHTS[k]}</span>
                        </span>
                        {draft ? (
                          <input
                            type="number"
                            className="dk-jj-num"
                            min={0}
                            max={100}
                            step={5}
                            value={draft[k]}
                            aria-label={CALL_CRITERIA[k][lang]}
                            onChange={(e) => setDraft({ ...draft, [k]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                          />
                        ) : (
                          <b className="dk-num">{v ?? '–'}</b>
                        )}
                      </span>
                      <span className="dk-jj-track" aria-hidden="true">
                        <span className={`dk-jj-fill${v !== null && v < 60 ? ' is-low' : ''}`} style={{ transform: `scaleX(${(v ?? 0) / 100})` }} />
                      </span>
                      {line && ev !== null && (
                        <button type="button" className={`dk-jj-quote${miss ? ' is-miss' : ''}`} onClick={() => goLine(ev, true)} aria-label={`${t.seekTo(mmss(clip.segments[ev]!.start))}: ${CALL_CRITERIA[k][lang]}`}>
                          <span className="dk-num">{mmss(clip.segments[ev]!.start)}</span> “{clip.segments[ev]!.text}”
                        </button>
                      )}
                      {miss && line?.fix && <p className="dk-jj-fix">{line.fix[lang]}</p>}
                    </li>
                  )
                })}
              </ul>
              {total !== null && (
                <p className="dk-jj-total">
                  {t.total} <b className="dk-num">{total}</b>/100
                </p>
              )}
            </section>
          </div>
        </>
      )}
    </article>
  )
}
