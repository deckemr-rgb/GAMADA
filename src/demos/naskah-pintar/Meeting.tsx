/**
 * Rapat tab — the sample meeting (kit clip MEETING_BANJIR) plays on the kit playback engine (silent ×3 timeline or
 * the synthetic voice in real time); each transcript line reveals what the AI writes into the minutes, and every
 * follow-up is created in the world the moment it is spoken (actionItem.created, idempotent on replays/reloads).
 * At the end: meeting.transcribed + an AI summary (Simulasi / Live) + "Format tata naskah dinas" (PaperFrame, lazy).
 * "Rekam / ketik rapat" opens the recorder (lazy): Web Speech or a typed transcript → AI minutes → saved tasks.
 */
import { Suspense, lazy, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useI18n } from '../../lib/i18n'
import { useShell } from '../../demo-kit/shell'
import { Badge, Button, Icon, Segmented, StatusChip } from '../../demo-kit/ui'
import { emit, useClock, useWorld, world, type Meeting as MeetingRec } from '../../demo-kit/world'
import { Waveform } from '../../demo-kit/media/Waveform'
import { usePlayback } from '../../demo-kit/media/usePlayback'
import { mmss } from '../../demo-kit/media/playback'
import { CATEGORICAL_HEX } from '../../demo-kit/viz/palette'
import { structuredOf, useNaskahAi, type MinutesOut } from './ai'
import { buildCtx } from './ctx'
import { Lanes, Minutes } from './Minutes'
import { CLIP, SCRIPT, SEGS_FAST, SEGS_VOICE, SUMMARY, clockText, dueText, existingAction, opdIdIn, sampleMeeting, transcriptText, type ScriptAction } from './model'
import type { NpNav } from './index'
import { useStr } from './strings'

const Recorder = lazy(() => import('./Recorder'))
const OfficialMinutes = lazy(() => import('./OfficialMinutes'))

const LAST = CLIP.segments.length - 1

type Run = 'idle' | 'playing' | 'done'

export function Meeting({ nav }: { nav: NpNav }) {
  const S = useStr()
  const { lang } = useI18n()
  const shell = useShell()
  const meeting = useWorld(sampleMeeting)
  const now = useClock().minutes
  const [speed, setSpeed] = useState<'fast' | 'voice'>('fast')
  const segs = speed === 'fast' ? SEGS_FAST : SEGS_VOICE
  const { pb, state } = usePlayback(segs, CLIP.lang, { tts: speed === 'voice' })
  const [run, setRun] = useState<Run>(() => (meeting?.transcribed ? 'done' : 'idle'))
  const [reached, setReached] = useState(() => (meeting?.transcribed ? LAST : -1))
  const [recorder, setRecorder] = useState(false)
  const [official, setOfficial] = useState(false)
  const [transcriptOpen, setTranscriptOpen] = useState(true)
  const emitting = useRef(false)
  const emitted = useRef(new Set<string>())
  const ai = useNaskahAi()
  const [aiAsked, setAiAsked] = useState(false)
  const listRef = useRef<HTMLOListElement>(null)
  const timeRef = useRef<HTMLSpanElement>(null)
  const hsRef = useRef<HTMLSpanElement>(null)
  const resume = useRef<{ seg: number; playing: boolean } | null>(null)
  const runRef = useRef(run)
  runRef.current = run

  // the world may finish loading / be reset after mount: follow its transcription state while idle
  const transcribed = !!meeting?.transcribed
  useEffect(() => {
    if (runRef.current === 'playing') return
    setRun(transcribed ? 'done' : 'idle')
    reachedRef.current = transcribed ? LAST : -1
    setReached(reachedRef.current)
  }, [transcribed, meeting?.id])

  /* ---------------------------------------------------------------- world writes */
  const emitAction = useCallback(
    (a: ScriptAction, m: MeetingRec) => {
      const k = `${m.id}:${a.key}`
      if (emitted.current.has(k)) return
      emitted.current.add(k)
      const s = world.get()
      if (existingAction(s, m.id, a.text)) return
      emit('actionItem.created', { title: a.text, opdId: opdIdIn(s, a.opdId), pic: a.pic, dueAt: a.dueAt, source: { kind: 'meeting', id: m.id } }, 'naskah-pintar')
    },
    [],
  )

  const reachedRef = useRef(reached)
  const setReach = useCallback((v: number) => {
    reachedRef.current = v
    setReached(v)
  }, [])
  const reveal = useCallback(
    (to: number) => {
      const from = reachedRef.current
      if (to <= from) return
      const m = meeting
      if (emitting.current && m) for (const a of SCRIPT.actions) if (a.seg > from && a.seg <= to) emitAction(a, m)
      setReach(to)
    },
    [meeting, emitAction, setReach],
  )

  const askSummary = useCallback(() => {
    const s = world.get()
    setAiAsked(true)
    void ai.ask(
      lang === 'id' ? 'Buat notulen dan tindak lanjut dari transkrip rapat ini' : 'Draft the minutes and action items from this meeting transcript',
      buildCtx(s, now, lang, 'minutes', {
        meeting: { title: CLIP.title[lang], transcript: transcriptText(lang), sample: true },
        minutes: { decisions: SCRIPT.decisions.map((d) => d.text), actions: SCRIPT.actions.map((a) => ({ task: a.text, pic: a.pic, due: dueText(a.dueAt, lang, s.day) })) },
      }),
    )
  }, [ai, lang, now])

  const finish = useCallback(() => {
    reveal(LAST)
    setRun('done')
    const m = meeting
    if (emitting.current && m && !world.get().meetings.byId[m.id]?.transcribed) {
      emit('meeting.transcribed', { meetingId: m.id, summary: SUMMARY, durationMin: m.durationMin }, 'naskah-pintar')
      shell.toast({
        title: S.mToastTitle,
        body: S.mToastBody(SCRIPT.actions.length),
        tone: 'accent',
        icon: 'checkCircle',
        action: { label: S.mToastAct, onClick: () => nav.go('tindak') },
      })
    }
    emitting.current = false
    askSummary()
  }, [reveal, meeting, shell, S, nav, askSummary])

  /* ---------------------------------------------------------------- playback → minutes */
  useEffect(() => {
    if (run !== 'playing') return
    if (state.seg >= 0) reveal(state.seg)
  }, [state.seg, run, reveal])
  useEffect(() => {
    if (run === 'playing' && state.ended) finish()
  }, [state.ended, run, finish])

  // speed switch: the new playback continues where the old one was
  useEffect(() => {
    const r = resume.current
    if (!r) return
    resume.current = null
    if (r.seg >= 0) pb.toSegment(r.seg)
    if (r.playing) pb.play()
  }, [pb])

  // time read-out on the ticker while playing (no re-render per frame)
  useEffect(() => {
    const el = timeRef.current
    if (!el) return
    const k = speed === 'fast' ? 3 : 1
    const write = () => {
      // a finished (or skipped-to-the-end) meeting reads as the full length
      el.textContent = mmss((runRef.current === 'done' && !pb.getState().playing ? pb.duration : pb.getState().time) * k)
    }
    write()
    if (!state.playing) return
    gsap.ticker.add(write)
    return () => gsap.ticker.remove(write)
  }, [pb, state.playing, state.seg, speed, run])

  // keep the current line in view inside the transcript list only (once the deferred render has drawn it)
  const drawnSeg = useDeferredValue(state.seg)
  useEffect(() => {
    const list = listRef.current
    if (!list || drawnSeg < 0 || !state.playing) return
    const li = list.querySelector<HTMLElement>(`[data-seg="${drawnSeg}"]`)
    if (!li) return
    const top = li.offsetTop - list.offsetTop
    if (top < list.scrollTop || top + li.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTo({ top: Math.max(0, top - 8), behavior: 'smooth' })
  }, [drawnSeg, state.playing])

  const start = () => {
    emitting.current = !world.get().meetings.byId[meeting?.id ?? '']?.transcribed
    emitted.current.clear()
    setReach(-1)
    setRun('playing')
    setAiAsked(false)
    ai.reset()
    pb.toSegment(0)
    pb.play()
  }
  const onPlay = () => {
    // retire the first-action hotspot (its capture listener only reacts to clicks on the anchor itself)
    hsRef.current?.dispatchEvent(new MouseEvent('click', { bubbles: false }))
    setRecorder(false)
    if (run === 'playing') pb.toggle()
    else start()
  }
  const skip = () => {
    pb.pause()
    finish()
  }
  const fromLine = (i: number) => {
    if (run !== 'playing') {
      if (run === 'idle') emitting.current = !transcribed
      setRun('playing')
    }
    pb.toSegment(i)
    if (!pb.getState().playing) pb.play()
  }
  const seekFrac = (f: number) => {
    if (run === 'idle') {
      start()
      pb.seek(f * pb.duration)
      return
    }
    if (run === 'done') setRun('playing')
    pb.seek(f * pb.duration)
    if (!pb.getState().playing) pb.play()
  }
  const changeSpeed = (v: 'fast' | 'voice') => {
    if (v === speed) return
    const st = pb.getState()
    resume.current = { seg: st.seg, playing: st.playing }
    setSpeed(v)
  }

  /* ---------------------------------------------------------------- view */
  const color = useMemo(() => new Map(CLIP.speakers.map((sp, i) => [sp.id, CATEGORICAL_HEX[i % CATEGORICAL_HEX.length] ?? '#b9b2ff'])), [])
  const speaker = useMemo(() => new Map(CLIP.speakers.map((sp) => [sp.id, sp.label[lang]])), [lang])
  const shownSeg = run === 'done' ? LAST : run === 'playing' ? Math.max(reached, state.seg) : -1
  /* the controls answer at once; transcript, minutes and lanes (the heavy part) follow in a non-blocking render */
  const seg = useDeferredValue(shownSeg)
  const playing = run === 'playing' && state.playing
  const status: keyof typeof S.mStatus = run === 'playing' ? 'berlangsung' : run === 'done' || transcribed ? 'selesai' : 'terjadwal'
  const playLabel = run === 'playing' ? (state.playing ? S.mPause : S.mResume) : run === 'done' ? S.mReplay : S.mPlay
  const liveMinutes = structuredOf<MinutesOut>(ai.last, 'minutes')
  const summaryText = aiAsked && ai.last ? ai.last.content : run === 'done' ? (meeting?.summary?.[lang] ?? SUMMARY[lang]) : ''
  const progress = useCallback(() => (runRef.current === 'done' && !pb.getState().playing ? 1 : pb.duration ? pb.getState().time / pb.duration : 0), [pb])
  const dur = pb.duration * (speed === 'fast' ? 3 : 1)
  const curStart = state.seg >= 0 ? (CLIP.segments[state.seg]?.start ?? 0) : 0

  return (
    <div className="dk-np-meeting">
      <header className="dk-np-mhead">
        <div className="dk-np-mtitle">
          <span className="dk-np-eyebrow">
            {S.mTitleHint} · {clockText(meeting?.at ?? 540, lang)} · {S.mPlace}
          </span>
          <h2>{(meeting?.title ?? CLIP.title)[lang]}</h2>
          <p className="dk-np-lead">{S.mLead}</p>
        </div>
        <div className="dk-np-mmeta">
          <StatusChip label={S.mStatus[status]} tone={status === 'selesai' ? 'done' : status === 'berlangsung' ? 'new' : 'neutral'} />
          <Badge>{S.mParticipants(CLIP.speakers.length)}</Badge>
          <span className="dk-np-sim">{S.simulated}</span>
        </div>
      </header>

      <div className="dk-np-controls">
        <Button variant="primary" icon={playing ? 'pause' : run === 'done' ? 'replay' : 'play'} onClick={onPlay} aria-pressed={playing} data-np="play" className={`dk-np-playbtn${run === 'idle' ? ' is-idle' : ''}`}>
          {playLabel}
          {/* hotspot anchor: a strip on the button's bottom edge, so the kit's hint label sits below the button
              instead of over its text (the kit draws the label 16 px under the target's top edge) */}
          <span ref={hsRef} className="dk-np-hs" data-hotspot="np-play" aria-hidden="true" />
        </Button>
        {run === 'playing' && (
          <Button variant="secondary" icon="forward" onClick={skip} data-np="skip">
            {S.mSkip}
          </Button>
        )}
        {run === 'done' && (
          <Button variant="secondary" icon="doc" onClick={() => setOfficial(true)} data-np="official">
            {S.mFormat}
          </Button>
        )}
        <Segmented
          size="sm"
          label={S.mSpeed}
          value={speed}
          onChange={changeSpeed}
          options={[
            { value: 'fast', label: S.mFast, icon: 'zap' },
            { value: 'voice', label: S.mVoice, icon: 'mic' },
          ]}
        />
        <span className="dk-np-time dk-num" aria-hidden="true">
          <span ref={timeRef}>00:00</span> / {mmss(dur)}
        </span>
        <span className="dk-np-mode">
          <Icon name={state.mode === 'tts' && speed === 'voice' ? 'mic' : 'doc'} size={12} />
          {speed === 'voice' && state.mode === 'tts' ? S.mModeTts : S.mModeText}
        </span>
        {!recorder && (
          <Button variant="quiet" icon="mic" onClick={() => setRecorder(true)} className="dk-np-rec" data-np="record">
            {S.mRecord}
          </Button>
        )}
      </div>
      <Waveform
        peaks={CLIP.peaks}
        progress={progress}
        active={state.playing}
        height={40}
        label={S.mTimeline}
        valueText={`${mmss(curStart)} ${S.mOf} ${mmss(CLIP.segments[LAST]?.end ?? 0)}`}
        onSeek={seekFrac}
        className="dk-np-wave"
      />
      {run === 'done' && (
        <p className="dk-np-done" role="status">
          <Icon name="checkCircle" size={16} />
          {S.mDone(SCRIPT.actions.length)}
        </p>
      )}

      {recorder ? (
        <Suspense fallback={null}>
          <Recorder onClose={() => setRecorder(false)} sampleMeetingId={meeting?.id} />
        </Suspense>
      ) : (
        <div className="dk-np-mgrid">
          <section className={`dk-np-card dk-np-transcript${transcriptOpen ? '' : ' is-collapsed'}`} aria-label={S.mTranscript}>
            <header className="dk-np-card-h">
              <h3>
                <Icon name="mic" size={16} />
                {S.mTranscript}
              </h3>
              <button type="button" className="dk-np-collapse" aria-expanded={transcriptOpen} aria-label={`${transcriptOpen ? S.mCollapse : S.mExpand}: ${S.mTranscript}`} onClick={() => setTranscriptOpen((o) => !o)}>
                {transcriptOpen ? S.mCollapse : S.mExpand}
                <Icon name={transcriptOpen ? 'chevronUp' : 'chevronDown'} size={14} />
              </button>
            </header>
            {transcriptOpen &&
              (seg < 0 ? (
                <p className="dk-np-empty">{S.mTranscriptEmpty}</p>
              ) : (
                <ol ref={listRef} className="dk-np-lines">
                  {CLIP.segments.slice(0, seg + 1).map((line, i) => {
                    const cur = run === 'playing' && i === state.seg
                    return (
                      <li key={line.id} data-seg={i} className={cur ? 'is-cur' : undefined}>
                        <button type="button" className="dk-np-line" onClick={() => fromLine(i)} aria-current={cur ? 'true' : undefined} aria-label={`${S.mFromHere}: ${mmss(line.start)} ${speaker.get(line.speaker) ?? ''}`}>
                          <span className="dk-np-ts dk-num">{mmss(line.start)}</span>
                          <span className="dk-np-who" style={{ color: color.get(line.speaker) }}>
                            {speaker.get(line.speaker)}
                          </span>
                        </button>
                        <p className="dk-np-said">{line.text}</p>
                        {lang === 'en' && line.en && <p className="dk-np-tr">{line.en}</p>}
                      </li>
                    )
                  })}
                </ol>
              ))}
          </section>
          <Minutes
            reached={seg}
            writing={playing}
            meetingId={meeting?.id ?? null}
            summary={summaryText}
            summaryMode={aiAsked && ai.last?.status === 'done' ? (ai.last.mode ?? 'sim') : null}
            summaryBusy={aiAsked && ai.busy}
            liveCheck={liveMinutes && ai.last?.mode === 'live' ? { d: liveMinutes.decisions.length, a: liveMinutes.actionItems.length } : null}
            colors={color}
            nav={nav}
            animate={run === 'playing'}
          />
          <section className="dk-np-card dk-np-lanescard">
            <Lanes reached={seg} nav={nav} />
          </section>
        </div>
      )}
      {official && (
        <Suspense fallback={null}>
          <OfficialMinutes open={official} onClose={() => setOfficial(false)} meetingId={meeting?.id ?? null} summary={summaryText || SUMMARY[lang]} />
        </Suspense>
      )}
    </div>
  )
}
