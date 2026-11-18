/**
 * Nasabah (KYC) tab (lazy) — SplitStage 40/60: "HP Nasabah" (a generic cooperative app: form → KTP photo → selfie →
 * liveness → Kirim) | "Analis" (DocViewer + ExtractPanel on the KTP SPECIMEN, checks, risk Gauge = kycRisk, AI
 * suggestion preselected, Setujui / Tinjau / Tolak ⇒ partner.verified kind kyc). The edited KTP shows the tamper
 * heatmap and links to the same document flagged in Cek Berkas. The selfie uses a sample face unless the visitor turns
 * the camera on (useCamera: local only, tracks stopped on leave; denied ⇒ the sample face, silently).
 */
import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { DocArt, DocViewer, ExtractPanel, TamperToggle, nikMatchesBirth, parseNik, readPrompt, simulateExtract, type SampleDoc } from '../../demo-kit/docs'
import { BAMBANG, IDENTITY, JOKO, SITI, type KtpPerson } from '../../demo-kit/docs/samples/identity'
import { PhoneFrame } from '../../demo-kit/frames'
import { useCamera } from '../../demo-kit/media'
import { demoHref, useShell } from '../../demo-kit/shell'
import { SplitStage } from '../../demo-kit/shell/SplitStage'
import { Button, Icon, Segmented, Stepper, motionMode } from '../../demo-kit/ui'
import { Gauge } from '../../demo-kit/viz'
import { clock, emit, shallowEqual, useClock, useSession, useWorld, WORLD, type VerificationRequest } from '../../demo-kit/world'
import { kycInputOf, kycRisk, verificationOf } from '../../demo-kit/world/usaha-pintar'
import { CaseList } from './CaseList'
import { afterPaint, casesOf, clockText, reasonCtx, SLUG, type ReasonCheck } from './model'
import { useCaseStr } from './strings-case'

const LivenessLoad = () => import('./LivenessFace')
const LivenessFace = lazy(() => LivenessLoad().then((m) => ({ default: m.LivenessFace })))
const Viewer = memo(DocViewer)
const Panel = memo(ExtractPanel)

type Step = 'form' | 'ktp' | 'selfie' | 'liveness' | 'sent'
const STEP_I: Record<Step, number> = { form: 0, ktp: 1, selfie: 2, liveness: 3, sent: 5 }
/** per KTP document: where the customer is in the app (kept across tab switches for this page session) */
const flows = new Map<string, { step: Step; sentAt: number | null; ktpTaken: boolean; liveOk: boolean }>()
const PERSON: Record<string, { p: KtpPerson; shownBirth: string }> = {
  'ktp-joko': { p: JOKO, shownBirth: JOKO.birth },
  'ktp-siti-edit': { p: SITI, shownBirth: '1986-03-14' },
  'ktp-bambang': { p: BAMBANG, shownBirth: BAMBANG.birth },
}
const DECISION_RESULT = { setujui: 'lolos', tinjau: 'cek-manual', tolak: 'ditolak' } as const
type Decision = keyof typeof DECISION_RESULT
const ids = (a: VerificationRequest[]) => a.map((r) => `${r.id}:${r.status}`).join('|')
const title = (n: string) => n.split(' ').map((w) => w[0] + w.slice(1).toLowerCase()).join(' ')
const dmyOf = (iso: string) => iso.split('-').reverse().join('-')
const rtPlus = (rtrw: string) => {
  const [rt, rw] = rtrw.split('/')
  return `${String(Number(rt) + 1).padStart(3, '0')}/${rw}`
}

export default function Kyc({ caseId, focusKey, onCase }: { caseId: string | null; focusKey: number; onCase: (id: string) => void }) {
  const shell = useShell()
  const now = useClock().minutes
  const cases = useWorld((s) => casesOf(s, 'kyc', now), (a, b) => ids(a) === ids(b))
  const cur = cases.find((r) => r.id === caseId) ?? cases.find((r) => r.status !== 'selesai') ?? cases[0] ?? null
  // pin the case on screen: a decision closes the request and must not swap the view to another case
  useEffect(() => {
    if (cur && cur.id !== caseId) onCase(cur.id)
  }, [cur, caseId, onCase])
  const root = useRef<HTMLDivElement>(null)
  // a focus arrival scrolls the case into view
  useEffect(() => {
    if (focusKey && caseId) root.current?.scrollIntoView({ block: 'start', behavior: motionMode() === 'full' ? 'smooth' : 'auto' })
  }, [focusKey, caseId])
  return (
    <div ref={root} className="dk-km-case is-kyc">
      <CaseList cases={cases} cur={cur?.id ?? null} onPick={onCase} sm={shell.size === 'sm'} />
      {cur && <KycCase key={cur.id} req={cur} />}
    </div>
  )
}

function KycCase({ req }: { req: VerificationRequest }) {
  const { c, lang } = useCaseStr()
  const k = c.kyc
  const shell = useShell()
  const session = useSession()
  const now = useClock().minutes
  const docRec = useWorld((s) => s.documents.byId[req.subjectId] ?? null)
  const seed = useWorld((s) => s.seed)
  const tamperedId = useWorld((s) => s.meta.facts.tamperedDocumentId ?? null)
  const verdict = useWorld((s) => {
    const v = verificationOf(s, req.subjectId)
    return v && v.kind === 'kyc' && v.at >= 0 ? { result: v.result, score: v.score, at: v.at } : null
  }, shallowEqual)
  const risk = useWorld((s) => kycRisk(kycInputOf(s, req.subjectId)), shallowEqual)
  const input = useWorld((s) => kycInputOf(s, req.subjectId), shallowEqual)
  const sampleId = docRec?.sampleId ?? 'ktp-joko'
  const doc: SampleDoc | undefined = useMemo(() => IDENTITY.find((d) => d.id === sampleId), [sampleId])
  const person = PERSON[sampleId] ?? PERSON['ktp-joko']!
  const tilted = sampleId === 'ktp-joko'

  /* ---------------------------------------------------------------- the customer's phone */
  const seeded = req.at < WORLD.clockStart || req.status === 'selesai'
  const [flow, setFlowState] = useState(() => flows.get(req.subjectId) ?? { step: (seeded ? 'sent' : 'form') as Step, sentAt: null, ktpTaken: false, liveOk: seeded })
  const setFlow = useCallback(
    (f: typeof flow) => {
      flows.set(req.subjectId, f)
      setFlowState(f)
    },
    [req.subjectId],
  )
  const [split, setSplit] = useState<'left' | 'right'>(flow.step === 'sent' ? 'right' : 'left')
  const cam = useCamera({ facing: 'user' })
  const [live, setLive] = useState<{ phase: 'idle' | 'blink' | 'turn' | 'done'; p: number }>({ phase: flow.liveOk ? 'done' : 'idle', p: flow.liveOk ? 1 : 0 })
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach((x) => window.clearTimeout(x)), [])
  const runLiveness = useCallback(() => {
    const total = motionMode() === 'static' ? 600 : 4000
    setLive({ phase: 'blink', p: 0 })
    timers.current.push(window.setTimeout(() => setLive({ phase: 'blink', p: 0.5 }), 30))
    timers.current.push(window.setTimeout(() => setLive({ phase: 'turn', p: 1 }), total / 2))
    timers.current.push(
      window.setTimeout(() => {
        setLive({ phase: 'done', p: 1 })
        cam.stop()
        setFlow({ ...(flows.get(req.subjectId) ?? flow), step: 'liveness', liveOk: true })
      }, total),
    )
  }, [cam, flow, req.subjectId, setFlow])
  const send = () => {
    setFlow({ ...flow, step: 'sent', sentAt: clock.get().minutes })
    setSplit('right')
  }

  /* ---------------------------------------------------------------- the analyst's read */
  // the NIK keeps its area + birth-date code readable, the serial masked (as in Cek Berkas)
  const extracted = useMemo(() => {
    const x = doc ? simulateExtract(doc, { lang }) : null
    if (!x) return null
    return { ...x, fields: x.fields.map((f) => (/^\d{16}$/.test(f.value.replace(/\s/g, '')) ? { ...f, value: `${f.value.replace(/\s/g, '').slice(0, 6)} ${f.value.replace(/\s/g, '').slice(6, 12)} ••••` } : f)) }
  }, [doc, lang])
  const total = extracted?.fields.length ?? 0
  const [shown, setShown] = useState(flow.step === 'sent' && verdict ? total : 0)
  const reading = flow.step === 'sent' && shown < total
  const read = flow.step === 'sent' && shown >= total
  const cells = input.tampered ? (extracted?.tamper ?? []) : []
  const [heat, setHeat] = useState(0.7)
  const [pick, setPick] = useState<Decision>(risk.decision)
  useEffect(() => setPick(risk.decision), [risk.decision])
  const onReveal = useCallback((n: number) => setShown(n), [])
  const [active, setActive] = useState<string | null>(null)

  const nik = docRec?.nik ?? ''
  const nikP = parseNik(nik)
  const birthOk = nikMatchesBirth(nik, person.shownBirth, person.p.gender)
  const nikBirth = nikP.ok ? `${String(nikP.day > 40 ? nikP.day - 40 : nikP.day).padStart(2, '0')}-${String(nikP.month).padStart(2, '0')}-${nikP.yy}` : '—'
  const checks: (ReasonCheck & { key: string })[] = [
    { key: 'nik', label: { id: c.kyc.cNikFormat, en: c.kyc.cNikFormat }, ok: nikP.ok, note: { id: nikP.ok ? k.nikOk : k.nikBad, en: nikP.ok ? k.nikOk : k.nikBad } },
    { key: 'birth', label: { id: k.cNikBirth, en: k.cNikBirth }, ok: birthOk, note: { id: birthOk ? k.same : k.birthBad(nikBirth, dmyOf(person.shownBirth)), en: birthOk ? k.same : k.birthBad(nikBirth, dmyOf(person.shownBirth)) } },
    { key: 'name', label: { id: k.cName, en: k.cName }, ok: true, note: { id: k.same, en: k.same } },
    { key: 'addr', label: { id: k.cAddr, en: k.cAddr }, ok: input.fieldMismatches === 0, note: { id: k.addrBad(rtPlus(person.p.rtrw), person.p.rtrw), en: k.addrBad(rtPlus(person.p.rtrw), person.p.rtrw) } },
    { key: 'live', label: { id: k.cLive, en: k.cLive }, ok: !input.livenessFail, note: { id: k.liveOk, en: k.liveOk } },
    { key: 'face', label: { id: k.cFace, en: k.cFace }, ok: true, note: { id: k.faceOk, en: k.faceOk } },
    { key: 'tamper', label: { id: k.cTamper, en: k.cTamper }, ok: !input.tampered, note: { id: input.tampered ? k.tamperBad : k.tamperOk, en: input.tampered ? k.tamperBad : k.tamperOk } },
  ]

  // "Tanya alasan" reads the case on screen
  useEffect(() => {
    reasonCtx.set({
      kind: 'kyc', code: req.code, subject: docRec?.ownerName ?? '', checks: read ? checks : [], score: risk.score, decision: risk.decision, decided: !!verdict, liveness: flow.liveOk,
    })
  })

  const [deciding, setDeciding] = useState(false)
  const decide = () => {
    if (deciding) return
    setDeciding(true)
    const result = DECISION_RESULT[pick]
    afterPaint(() => emit('partner.verified', { subjectKind: 'document', subjectId: req.subjectId, kind: 'kyc', result, score: risk.score }, SLUG))
  }
  const keep = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('controls') === 'all' ? '&controls=all' : ''
  const name = docRec?.ownerName ?? title(person.p.name)

  const phone = (
    <PhoneFrame label={k.phone} time={clockText(now, lang)} width={shell.size === 'sm' ? '100%' : 300} tilt={false} className="dk-km-phone">
      <div className="dk-km-app">
        <header className="dk-km-app-h">
          <b>{req.requestedBy}</b>
          <span>{k.app}</span>
        </header>
        <Stepper steps={k.steps} current={STEP_I[flow.step]} label={k.app} className="dk-km-app-steps" />
        {flow.step === 'form' && (
          <div className="dk-km-app-body">
            <h4>{k.formTitle}</h4>
            <p className="dk-km-muted">{k.fromRequest}</p>
            <dl className="dk-km-form">
              <dt>{k.fName}</dt>
              <dd>{name}</dd>
              <dt>{k.fNik}</dt>
              <dd className="dk-num">{nik ? `${nik.slice(0, 6)} ${nik.slice(6, 12)} ••••` : '—'}</dd>
              <dt>{k.fBirth}</dt>
              <dd className="dk-num">{dmyOf(person.p.birth)}</dd>
              <dt>{k.fAddr}</dt>
              <dd>
                {title(person.p.street)}, Desa {title(person.p.desa)}
              </dd>
              <dt>{k.fRtRw}</dt>
              <dd className="dk-num">{rtPlus(person.p.rtrw)}</dd>
            </dl>
            <Button variant="primary" icon="arrowRight" onClick={() => setFlow({ ...flow, step: 'ktp' })} data-km="kyc-next">
              {k.toKtp}
            </Button>
          </div>
        )}
        {flow.step === 'ktp' && (
          <div className="dk-km-app-body">
            <h4>{k.ktpTitle}</h4>
            <p className="dk-km-muted">{k.ktpHint}</p>
            <div className={`dk-km-ktpshot${flow.ktpTaken ? ' is-taken' : ''}`}>{doc && <DocArt doc={doc} label={k.docLabel(name)} />}</div>
            {flow.ktpTaken ? (
              <>
                <p className="dk-km-ok">
                  <Icon name="checkCircle" size={14} />
                  {k.ktpTaken}
                </p>
                <Button variant="primary" icon="arrowRight" onClick={() => setFlow({ ...flow, step: 'selfie' })} data-km="kyc-next">
                  {k.toSelfie}
                </Button>
              </>
            ) : (
              <Button variant="primary" icon="camera" onClick={() => setFlow({ ...flow, ktpTaken: true })} data-km="kyc-next">
                {k.ktpTake}
              </Button>
            )}
          </div>
        )}
        {(flow.step === 'selfie' || flow.step === 'liveness') && (
          <div className="dk-km-app-body">
            <h4>{flow.step === 'selfie' ? k.selfieTitle : k.livenessTitle}</h4>
            <Suspense fallback={<div className="dk-km-face is-idle" />}>
              <LivenessFace phase={live.phase} progress={live.p} stream={cam.stream} label={k.selfieTitle} />
            </Suspense>
            <p className="dk-km-live-prompt" aria-live="polite">
              {live.phase === 'blink' ? k.blink : live.phase === 'turn' ? k.turn : live.phase === 'done' ? k.livenessOk : k.selfieHint}
            </p>
            {flow.step === 'selfie' && (
              <>
                {cam.supported && !cam.stream && (
                  <Button size="sm" variant="quiet" icon="camera" onClick={() => void cam.start()} onPointerEnter={LivenessLoad}>
                    {k.camera}
                  </Button>
                )}
                {cam.stream && (
                  <p className="dk-km-muted">
                    {k.cameraOn}{' '}
                    <button type="button" className="dk-km-linkbtn" onClick={cam.stop}>
                      {k.cameraOff}
                    </button>
                  </p>
                )}
                <Button
                  variant="primary"
                  icon="camera"
                  onClick={() => {
                    setFlow({ ...flow, step: 'liveness' })
                    runLiveness()
                  }}
                  data-km="kyc-next"
                >
                  {k.selfieTake}
                </Button>
              </>
            )}
            {flow.step === 'liveness' && (
              <>
                <p className="dk-km-muted">{k.livenessSim}</p>
                <Button variant="primary" icon="send" disabled={!flow.liveOk} aria-describedby={!flow.liveOk ? `km-send-${req.id}` : undefined} onClick={send} data-km="kyc-send">
                  {k.send}
                </Button>
                {!flow.liveOk && (
                  <span id={`km-send-${req.id}`} className="dk-km-why">
                    {k.sendLocked}
                  </span>
                )}
              </>
            )}
          </div>
        )}
        {flow.step === 'sent' && (
          <div className="dk-km-app-body is-sent">
            <Icon name="checkCircle" size={28} />
            <p>{flow.sentAt != null ? k.sent(clockText(flow.sentAt, lang)) : k.sentSeed}</p>
          </div>
        )}
      </div>
    </PhoneFrame>
  )

  const analyst =
    flow.step !== 'sent' ? (
      <section className="dk-km-analyst is-wait" aria-label={k.labels[1]}>
        <h4>{k.waitTitle}</h4>
        <p className="dk-km-muted">{k.waitBody}</p>
        <Stepper steps={k.steps} current={STEP_I[flow.step]} label={k.waitTitle} orientation="vertical" />
      </section>
    ) : (
      <section className="dk-km-analyst" aria-label={k.labels[1]}>
        <header className="dk-km-case-h">
          <span className="dk-km-code dk-num">{req.code}</span>
          <b>{name}</b>
          <span className="dk-km-muted">{c.requestedBy(req.requestedBy)}</span>
          <span className="dk-km-consent">{c.consent}</span>
        </header>
        {doc && (
          <Viewer
            doc={doc}
            boxes={extracted?.fields}
            revealBoxes={verdict ? total : true}
            onReveal={onReveal}
            deskew={tilted}
            activeKey={active}
            onBoxFocus={setActive}
            tamper={read && cells.length ? { cells, opacity: heat } : null}
            label={k.docLabel(name)}
            height="clamp(240px, 34vh, 360px)"
          />
        )}
        {read && cells.length > 0 && <TamperToggle opacity={heat} onChange={setHeat} maxScore={Math.max(...cells.map((x) => x.score))} />}
        {read && input.tampered && tamperedId && (
          <Link className="dk-km-xlink" to={demoHref('cek-berkas', session, tamperedId) + keep}>
            <Icon name="cek" size={14} />
            {k.cekBerkas}
          </Link>
        )}
        <div className="dk-km-analyst-grid">
          <Panel extracted={extracted} revealed={shown} activeKey={active} onFieldFocus={setActive} loading={reading && shown === 0} showChecks={false} showVerdict={false} emptyText={readPrompt(k.reading, lang)} className="dk-km-xp" />
          <div className="dk-km-decide">
            <h4>{k.checks}</h4>
            <ul className="dk-km-checks" aria-busy={reading}>
              {checks.map((x) => (
                <li key={x.key} className={!read ? 'is-wait' : x.ok ? 'is-ok' : 'is-bad'}>
                  <Icon name={!read ? 'clock' : x.ok ? 'checkCircle' : 'xCircle'} size={14} />
                  <span>
                    <b>{x.label[lang]}</b>
                    {read && x.note && <small>{x.note[lang]}</small>}
                  </span>
                </li>
              ))}
            </ul>
            {read && (
              <>
                <Gauge
                  seed={seed}
                  title={k.risk}
                  value={risk.score}
                  min={0}
                  max={100}
                  bands={[
                    { from: 0, to: 30, tone: 'accent', label: k.dec.setujui },
                    { from: 30, to: 70, tone: 'warn', label: k.dec.tinjau },
                    { from: 70, to: 100, tone: 'danger', label: k.dec.tolak },
                  ]}
                  size={150}
                  summary={`${k.risk}: ${risk.score}. ${k.riskParts(10, input.tampered ? 45 : 0, 8 * input.fieldMismatches, input.livenessFail ? 30 : 0, input.addressKm > 5 ? 15 : 0)}`}
                />
                <p className="dk-km-muted dk-num">{k.riskParts(10, input.tampered ? 45 : 0, 8 * input.fieldMismatches, input.livenessFail ? 30 : 0, input.addressKm > 5 ? 15 : 0)}</p>
                <p className="dk-km-ai">
                  <Icon name="spark" size={14} />
                  {k.aiSuggest(k.dec[risk.decision] ?? risk.decision)}
                </p>
              </>
            )}
            {verdict ? (
              <p className="dk-km-done" role="status">
                <Icon name={verdict.result === 'lolos' ? 'checkCircle' : 'alert'} size={16} />
                {k.decided(k.dec[verdict.result === 'lolos' ? 'setujui' : verdict.result === 'ditolak' ? 'tolak' : 'tinjau'] ?? '', verdict.score, clockText(verdict.at, lang))}
              </p>
            ) : (
              <div className="dk-km-decbar">
                <Segmented
                  label={k.decision}
                  value={pick}
                  onChange={setPick}
                  options={(['setujui', 'tinjau', 'tolak'] as const).map((d) => ({ value: d, label: k.dec[d] ?? d }))}
                />
                <Button variant="primary" icon="send" disabled={!read} aria-describedby={!read ? `km-dec-${req.id}` : undefined} busy={deciding} onClick={decide} data-km="kyc-decide">
                  {k.submit}
                </Button>
                {!read && (
                  <span id={`km-dec-${req.id}`} className="dk-km-why">
                    {k.submitLocked}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    )

  return <SplitStage left={phone} right={analyst} labels={k.labels as [string, string]} ratio={[40, 60]} tab={split} onTabChange={setSplit} className="dk-km-split" />
}

