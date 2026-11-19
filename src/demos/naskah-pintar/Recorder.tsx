/**
 * "Rekam / ketik rapat": Web Speech recognition (pack speech codes → id-ID; en-US in English) writes the transcript
 * live; a typed or pasted transcript works the same without a microphone. "Susun notulen dengan AI" sends it to the
 * AI (Simulasi: rule-based extraction in scenario.ts; Live: extract_minutes), then the found follow-ups are saved
 * to the world (actionItem.created per task, meeting.transcribed for the chosen meeting). Lazy chunk.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { useShell } from '../../demo-kit/shell'
import { Badge, Button, Icon, Select, motionMode } from '../../demo-kit/ui'
import { emit, shallowEqual, useClock, useWorld, world } from '../../demo-kit/world'
import { createRecognizer, recognitionSupported, speechLangs, type Recognizer } from '../../demo-kit/media/speech'
import { structuredOf, useNaskahAi, type MinutesOut } from './ai'
import { buildCtx } from './ctx'
import { clockText, openMeetings, opdName, picFor, placeText, resolveOpd } from './model'
import { dueLabel, parseDue } from './due'
import { useStr } from './strings'

/** "Besok 10.00" / "Today 16.00" / "Kam, 19 Nov 16.00" / "paling lambat Kamis" → world minutes (due.ts) */
export function dueToMinutes(due: string | undefined, now: number, day: string): number {
  return parseDue(due, now, day)
}

/** the meeting being minuted: the one in progress or the latest that has started, else the next one */
function defaultTarget(meetings: { id: string; at: number }[], now: number): string {
  const started = meetings.filter((m) => m.at <= now + 15).sort((a, b) => b.at - a.at)[0]
  return (started ?? meetings[0])?.id ?? ''
}

export default function Recorder({ onClose, sampleMeetingId }: { onClose: () => void; sampleMeetingId: string | undefined }) {
  const S = useStr()
  const { lang } = useI18n()
  const { pack, toast } = useShell()
  const now = useClock().minutes
  const meetings = useWorld((s) => openMeetings(s, sampleMeetingId), shallowEqual)
  const day = useWorld((s) => s.day)
  const [target, setTarget] = useState<string>(() => defaultTarget(meetings, now))
  /** the user picked a meeting (or "no scheduled meeting"): keep it */
  const picked = useRef(false)
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [saved, setSaved] = useState<number | null>(null)
  /** the transcript (+ meeting) whose follow-ups are in the world: saving it again would duplicate them */
  const [savedFor, setSavedFor] = useState<string | null>(null)
  const key = `${target}|${text.trim()}`
  const already = savedFor === key
  const rec = useRef<Recognizer | null>(null)
  const base = useRef('')
  const supported = useMemo(() => recognitionSupported(), [])
  const ai = useNaskahAi()
  const out = ai.last?.status === 'done' ? structuredOf<MinutesOut>(ai.last, 'minutes') : null
  const opdNames = useWorld((s) => (out ? out.actionItems.map((a) => opdName(s, resolveOpd(s, a.owner) ?? '', lang)).join('|') : ''))
  const outRef = useRef<HTMLDivElement>(null)
  /* the result lands below the fold on a phone: bring it into view once (no motion when reduced) */
  const doneId = ai.last?.status === 'done' ? ai.last.id : null
  useEffect(() => {
    if (!doneId) return
    const el = outRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    if (r.top < 64 || r.top > window.innerHeight - 120) el.scrollIntoView({ block: 'start', behavior: motionMode() === 'full' ? 'smooth' : 'auto' })
  }, [doneId])
  /* the AI result is text in the language it was asked in: ask again when the language changes */
  const askedLang = useRef(lang)

  useEffect(() => () => rec.current?.abort(), [])
  useEffect(() => {
    if (!picked.current && !target && meetings[0]) setTarget(defaultTarget(meetings, now))
  }, [meetings, target, now])
  const pick = (v: string) => {
    picked.current = true
    setTarget(v)
  }
  /* "Isi contoh" is the inflation meeting's transcript: minute it for that meeting when it is on today's list */
  const fillSample = () => {
    setText(placeText(S.rSampleText, lang))
    const infl = meetings.find((m) => /inflasi|inflation/i.test(m.title.id))
    if (infl && !picked.current) setTarget(infl.id)
  }

  const startRec = () => {
    setErr(null)
    base.current = text.trim()
    const r = createRecognizer({
      langs: lang === 'en' ? ['en-US', 'en-GB', 'id-ID'] : speechLangs(['id-ID', ...(pack?.languages.speechCodes ?? [])]),
      onInterim: (t) => setText(`${base.current} ${t}`.trim()),
      onError: (e) => {
        setErr(S.rErr[e] ?? S.rErr.other ?? '')
        setListening(false)
      },
      onEnd: () => setListening(false),
      onStart: () => setListening(true),
    })
    rec.current = r
    if (!r) {
      setErr(S.rErr.unsupported ?? '')
      return
    }
    setListening(true)
    r.start()
  }
  const stopRec = () => {
    rec.current?.stop()
    setListening(false)
  }

  const extract = () => {
    askedLang.current = lang
    if (listening) stopRec()
    setSaved(null)
    const s = world.get()
    const m = s.meetings.byId[target]
    ai.reset()
    void ai.ask(
      lang === 'id' ? 'Buat notulen dan tindak lanjut dari transkrip rapat ini' : 'Draft the minutes and action items from this meeting transcript',
      buildCtx(s, now, lang, 'minutes', { meeting: { title: m ? m.title[lang] : '', transcript: text, sample: false } }),
    )
  }

  useEffect(() => {
    if (askedLang.current === lang || !ai.last || ai.busy || text.trim().length <= 12) return
    extract()
  }, [lang]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => {
    if (!out || already) return
    const s = world.get()
    const src = target ? target : null
    const exists = (title: string, opdId: string) =>
      s.actionItems.ids.some((id) => {
        const x = s.actionItems.byId[id]
        return !!x && x.source.id === src && x.opdId === opdId && x.title.id === title
      })
    let n = 0
    for (const a of out.actionItems) {
      const opdId = resolveOpd(s, a.owner) ?? s.region.opd[0]?.id
      if (!opdId || exists(a.task, opdId)) continue
      const opd = s.region.opd.find((o) => o.id === opdId)
      emit(
        'actionItem.created',
        { title: { id: a.task, en: a.task }, opdId, pic: opd ? picFor(opd, opdId) : a.owner, dueAt: dueToMinutes(a.due, now, s.day), source: target ? { kind: 'meeting', id: target } : { kind: 'manual', id: null } },
        'naskah-pintar',
      )
      n++
    }
    if (target && s.meetings.byId[target] && !s.meetings.byId[target]?.transcribed) {
      const sum = ai.last?.content ?? ''
      emit('meeting.transcribed', { meetingId: target, summary: { id: sum, en: sum } }, 'naskah-pintar')
    }
    setSaved(n)
    setSavedFor(key)
    toast({ title: S.rSaved(n), tone: 'accent', icon: 'checkCircle' })
  }

  const names = opdNames.split('|')
  return (
    <section className="dk-np-card dk-np-recorder" aria-label={S.rTitle}>
      <header className="dk-np-card-h dk-np-rec-h">
        <h3>
          <Icon name="mic" size={16} />
          {S.rTitle}
        </h3>
        <Button size="sm" variant="quiet" icon="arrowLeft" onClick={onClose} data-np="rec-close">
          {S.rClose}
        </Button>
      </header>
      <p className="dk-np-muted">{S.rLead}</p>
      <div className="dk-np-recrow">
        {meetings.length > 0 && (
          <label className="dk-np-field">
            <span>{S.rFor}</span>
            <Select
              value={target}
              onChange={(e) => pick(e.target.value)}
              options={[...meetings.map((m) => ({ value: m.id, label: `${clockText(m.at, lang)} · ${m.title[lang]}${m.at > now ? ` (${S.rLater})` : ''}` })), { value: '', label: S.rNoMeeting }]}
            />
          </label>
        )}
        {supported &&
          (listening ? (
            <Button variant="danger" icon="pause" onClick={stopRec} data-np="rec-stop">
              {S.rStop}
            </Button>
          ) : (
            <Button variant="secondary" icon="mic" onClick={startRec} data-np="rec-start">
              {S.rStart}
            </Button>
          ))}
        <Button variant="quiet" icon="doc" onClick={fillSample} data-np="rec-sample">
          {S.rSample}
        </Button>
      </div>
      {listening && (
        <p className="dk-np-listening" role="status">
          <i aria-hidden="true" />
          {S.rListening}
        </p>
      )}
      {err && (
        <p className="dk-np-err" role="alert">
          {err}
        </p>
      )}
      <label className="dk-np-field is-block">
        <span>{S.rText}</span>
        <textarea className="dk-np-textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder={S.rPlaceholder} rows={6} onFocus={ai.prepare} data-np="rec-text" />
      </label>
      {text.trim().length > 12 && (
        <Button variant="primary" icon="spark" onClick={extract} busy={ai.busy} data-np="rec-extract">
          {S.rExtract}
        </Button>
      )}
      {ai.last && (
        <div ref={outRef} className="dk-np-recout" aria-live="polite">
          <p className="dk-np-summary">{ai.last.content}</p>
          {out && (
            <>
              <p className="dk-np-muted">
                <Badge tone="accent">{S.lAiMode[ai.last.mode ?? 'sim']}</Badge> {S.rResult(out.decisions.length, out.actionItems.length)}
              </p>
              {out.decisions.length > 0 && (
                <ol className="dk-np-decisions">
                  {out.decisions.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ol>
              )}
              {out.actionItems.length > 0 ? (
                <ul className="dk-np-recacts">
                  {out.actionItems.map((a, i) => (
                    <li key={`${a.task}-${i}`}>
                      <b>{a.task}</b>
                      <span>
                        {names[i] || a.owner} · {dueLabel(dueToMinutes(a.due, now, day), lang, day)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="dk-np-muted">{S.rNone}</p>
              )}
              {out.actionItems.length > 0 &&
                (saved !== null || already ? (
                  <p className="dk-np-done" role="status">
                    <Icon name="checkCircle" size={16} />
                    {saved !== null ? S.rSaved(saved) : S.rAlready}
                  </p>
                ) : (
                  <Button variant="primary" icon="check" onClick={save} data-np="rec-save">
                    {S.rSave(out.actionItems.length)}
                  </Button>
                ))}
            </>
          )}
        </div>
      )}
    </section>
  )
}
