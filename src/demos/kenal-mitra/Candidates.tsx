/**
 * Kandidat (CV) tab (lazy) — the opening "Staf Administrasi Keuangan · <shop>": "Unggah 200 CV contoh" fills 200 dots
 * (stagger, transform), the criteria (education, years, required skills, domicile ≤ n km from the shop) and "Saring"
 * (cvShortlist: funnel 200 → n → top 10 with fit bar + one reason) ⇒ partner.verified ×10 kind cv (one batch). The
 * blind toggle hides names / photos (Kandidat K-0147, neutral tiles); the ranking is identical (dev assert). Name,
 * gender, age and the kecamatan name are never inputs.
 */
import { startTransition, useCallback, useEffect, useMemo, useState } from 'react'
import { DocArt, type SampleDoc } from '../../demo-kit/docs'
import type { CvRecord } from '../../demo-kit/docs/types'
import { CV, generateCvs } from '../../demo-kit/docs/samples/cv-data'
import { useShell } from '../../demo-kit/shell'
import { Button, Chip, Drawer, Icon, Modal, Select } from '../../demo-kit/ui'
import { clock, emit, settled, useWorld } from '../../demo-kit/world'
import { cvShortlist, shopDistance, type CvCriteria, type ShortlistRow } from '../../demo-kit/world/usaha-pintar'
import { CvFunnel } from './CvFunnel'
import { clockText, reasonCtx, SLUG } from './model'
import { useCaseStr } from './strings-case'

const SKILLS: { key: string; en: string }[] = [
  { key: 'Spreadsheet', en: 'Spreadsheet' },
  { key: 'Pembukuan', en: 'Bookkeeping' },
  { key: 'Perpajakan dasar', en: 'Basic tax' },
  { key: 'Rekonsiliasi bank', en: 'Bank reconciliation' },
  { key: 'Laporan keuangan', en: 'Financial reports' },
  { key: 'Administrasi arsip', en: 'Filing' },
  { key: 'Aplikasi kasir', en: 'POS app' },
]
const EDU: CvRecord['education'][] = ['SMA/SMK', 'D3', 'S1']
interface Crit {
  education: CvRecord['education']
  minYears: number
  skills: string[]
  maxKm: number
}
const DEFAULT: Crit = { education: 'D3', minYears: 2, skills: ['Spreadsheet'], maxKm: 30 }
/** this page session's run (kept across tab switches) */
let RUN: { uploaded: boolean; crit: Crit; screened: Crit | null; at: number | null; blind: boolean } = { uploaded: false, crit: DEFAULT, screened: null, at: null, blind: false }

export default function Candidates() {
  const { c, lang } = useCaseStr()
  const k = c.cv
  const shell = useShell()
  const sm = shell.size === 'sm'
  const seed = useWorld((s) => s.seed)
  const region = useWorld((s) => s.region)
  const opening = useWorld((s) => s.meta.facts.up?.kenalMitra.cvOpening ?? null)
  const size = useWorld((s) => s.meta.facts.up?.kenalMitra.shortlistSize ?? 10)
  const dist = useWorld((s) => shopDistance(s), () => true)
  const cvs = useMemo(() => generateCvs(CV.count, seed, region.kecamatan.map((x) => ({ id: x.id, name: x.name }))), [seed, region])
  const [run, setRunState] = useState(RUN)
  const setRun = useCallback((r: typeof RUN) => {
    RUN = r
    setRunState(r)
  }, [])
  const [busy, setBusy] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [play, setPlay] = useState(0)
  const [cvOpen, setCvOpen] = useState<ShortlistRow | null>(null)
  const [cvDocOf, setCvDocOf] = useState<SampleDoc | null>(null)

  const critOf = (x: Crit): CvCriteria => ({ education: x.education, minYears: x.minYears, skills: x.skills, maxKm: x.maxKm, distanceKm: dist })
  const result = useMemo(() => (run.screened ? cvShortlist(cvs, critOf(run.screened), run.blind, size) : null), [run.screened, run.blind, cvs, size]) // eslint-disable-line react-hooks/exhaustive-deps
  const pool = useMemo(() => (run.screened ? cvShortlist(cvs, critOf(run.screened), true, 30).top : []), [run.screened, cvs]) // eslint-disable-line react-hooks/exhaustive-deps
  // dev assert: the blind toggle never changes the ranking
  useEffect(() => {
    if (!import.meta.env.DEV || !run.screened) return
    const a = cvShortlist(cvs, critOf(run.screened), true, size).top.map((x) => x.cv.id).join()
    const b = cvShortlist(cvs, critOf(run.screened), false, size).top.map((x) => x.cv.id).join()
    console.assert(a === b, 'kenal-mitra: blind screening changed the ranking')
  }, [run.screened, cvs, size]) // eslint-disable-line react-hooks/exhaustive-deps

  const passIds = useMemo(() => {
    if (!run.screened) return null
    const all = cvShortlist(cvs, critOf(run.screened), true, CV.count).top
    return { pass: new Set(all.map((x) => x.cv.id)), top: new Set(all.slice(0, size).map((x) => x.cv.id)) }
  }, [run.screened, cvs, size]) // eslint-disable-line react-hooks/exhaustive-deps

  const screen = () => {
    if (!run.uploaded || busy) return
    setBusy(true)
    // the button answers in this frame; the screening, the batch and the list follow (INP)
    requestAnimationFrame(() =>
      setTimeout(() => {
        const crit = run.crit
        const r = cvShortlist(cvs, critOf(crit), false, size)
        for (const row of r.top) emit('partner.verified', { subjectKind: 'candidate', subjectId: row.cv.id, kind: 'cv', result: 'lolos', score: row.fit }, SLUG)
        startTransition(() => {
          setRun({ ...RUN, screened: crit, at: clock.get().minutes })
          setPlay((p) => p + 1)
          setDrawer(false)
        })
        void settled().then(() => {
          setBusy(false)
          if (r.top.length) shell.markMission('cv')
        })
      }, 0),
    )
  }

  // "Tanya alasan" reads the shortlist on screen (anonymised refs only)
  useEffect(() => {
    const ref = (id: string) => `K-${id.slice(-4)}`
    reasonCtx.set({
      kind: 'cv',
      code: opening?.[lang] ?? '',
      criteria: [`${k.edu}: ${run.crit.education}`, `${k.years}: ${k.yearsN(run.crit.minYears)}`, `${k.skills}: ${run.crit.skills.join(', ') || '—'}`, `${k.dist}: ${k.distN(run.crit.maxKm)}`],
      top: result?.top.map((x) => ({ ref: ref(x.cv.id), fit: x.fit, reason: x.reason })) ?? [],
      funnel: result ? [result.funnel.total, result.funnel.education, result.funnel.years, result.funnel.skills, result.funnel.distance] : [],
      blind: run.blind,
      decided: !!result,
      pool: pool.map((x) => ({ ref: ref(x.cv.id), years: x.cv.years, education: x.cv.education, major: x.cv.major, skills: x.cv.skills })),
    })
  })

  const seeCv = (row: ShortlistRow) => {
    setCvOpen(row)
    setCvDocOf(null)
    if (!run.blind) void import('../../demo-kit/docs/samples/cv').then((m) => setCvDocOf(m.cvDoc(row.cv)))
  }
  const skillLabel = (key: string) => (lang === 'id' ? key : (SKILLS.find((x) => x.key === key)?.en ?? key))

  const criteria = (
    <div className="dk-km-crit">
      <label>
        <span>{k.edu}</span>
        <Select value={run.crit.education} onChange={(e) => setRun({ ...run, crit: { ...run.crit, education: e.target.value as Crit['education'] } })} options={EDU.map((x) => ({ value: x, label: x }))} aria-label={k.edu} />
      </label>
      <label>
        <span>{k.years}</span>
        <Select value={String(run.crit.minYears)} onChange={(e) => setRun({ ...run, crit: { ...run.crit, minYears: Number(e.target.value) } })} options={[0, 1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: k.yearsN(n) }))} aria-label={k.years} />
      </label>
      <label>
        <span>{k.dist}</span>
        <Select value={String(run.crit.maxKm)} onChange={(e) => setRun({ ...run, crit: { ...run.crit, maxKm: Number(e.target.value) } })} options={[10, 20, 30, 50].map((n) => ({ value: String(n), label: k.distN(n) }))} aria-label={k.dist} />
      </label>
      <fieldset>
        <legend>{k.skills}</legend>
        <div className="dk-km-chips">
          {SKILLS.map((x) => {
            const on = run.crit.skills.includes(x.key)
            return (
              <Chip key={x.key} selected={on} onToggle={() => setRun({ ...run, crit: { ...run.crit, skills: on ? run.crit.skills.filter((y) => y !== x.key) : [...run.crit.skills, x.key] } })}>
                {skillLabel(x.key)}
              </Chip>
            )
          })}
        </div>
      </fieldset>
    </div>
  )
  const screenBtn = (
    <div className="dk-km-row">
      <Button variant="primary" icon="filter" disabled={!run.uploaded} busy={busy} aria-describedby={!run.uploaded ? 'km-screen-why' : undefined} onClick={screen} data-km="screen">
        {k.screen}
      </Button>
      {!run.uploaded && (
        <span id="km-screen-why" className="dk-km-why">
          {k.screenLocked}
        </span>
      )}
    </div>
  )

  return (
    <section className="dk-km-cv" aria-label={opening?.[lang] ?? k.opening}>
      <header className="dk-km-case-h">
        <span className="dk-km-muted">{k.opening}</span>
        <b>{opening?.[lang]}</b>
      </header>
      <div className="dk-km-cv-grid">
        <div className="dk-km-cv-left">
          <div className={`dk-km-dots${run.uploaded ? ' is-in' : ''}${passIds ? ' is-screened' : ''}`} aria-label={run.uploaded ? k.uploaded(cvs.length) : k.dots(0)} role="img">
            {cvs.map((x, i) => (
              <span key={x.id} style={{ ['--i' as string]: i }} className={passIds ? (passIds.top.has(x.id) ? 'is-top' : passIds.pass.has(x.id) ? 'is-pass' : 'is-out') : undefined} />
            ))}
          </div>
          {run.uploaded ? (
            <p className="dk-km-ok">
              <Icon name="checkCircle" size={14} />
              {k.uploaded(cvs.length)}
            </p>
          ) : (
            <Button variant="primary" icon="upload" onClick={() => startTransition(() => setRun({ ...RUN, uploaded: true }))} data-km="upload">
              {k.upload}
            </Button>
          )}
          {sm ? (
            <>
              <Button variant="quiet" icon="filter" onClick={() => setDrawer(true)}>
                {k.openCriteria}
              </Button>
              {screenBtn}
              <Drawer open={drawer} onClose={() => setDrawer(false)} title={k.criteria} footer={screenBtn}>
                {criteria}
              </Drawer>
            </>
          ) : (
            <>
              <h4>{k.criteria}</h4>
              {criteria}
              {screenBtn}
            </>
          )}
          {result && <CvFunnel title={k.funnel} play={play} steps={k.funnelSteps.map((label, i) => ({ label, n: [result.funnel.total, result.funnel.education, result.funnel.years, result.funnel.skills, result.funnel.distance][i] ?? 0 }))} />}
        </div>
        <div className="dk-km-cv-right">
          {result && (
            <>
              <div className="dk-km-cv-head">
                <h4>{k.top(result.top.length)}</h4>
                <Chip selected={run.blind} onToggle={() => setRun({ ...run, blind: !run.blind })} icon="eye">
                  {k.blind}
                </Chip>
              </div>
              <p className="dk-km-muted">{k.blindNote}</p>
              {run.at != null && <p className="dk-km-muted">{k.shortlisted(result.top.length, clockText(run.at, lang))}</p>}
              {result.top.length ? (
                <ol className="dk-km-short" key={play} data-km="shortlist">
                  {result.top.map((x, i) => (
                    <li key={x.cv.id} data-cv={x.cv.id} style={{ ['--i' as string]: i }}>
                      <span className={`dk-km-tile${run.blind ? ' is-blind' : ''}`} aria-hidden="true">
                        {run.blind ? '•' : x.cv.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                      </span>
                      <span className="dk-km-short-body">
                        <b>{x.label}</b>
                        <small>
                          {x.cv.education} · {x.cv.major} · {k.yearsN(x.cv.years)}
                        </small>
                        <span className="dk-km-fit">
                          <span className="dk-km-fit-bar" aria-hidden="true">
                            <span style={{ transform: `scaleX(${x.fit / 100})` }} />
                          </span>
                          <span className="dk-num">
                            {k.fit} {x.fit}
                          </span>
                        </span>
                        <small className="dk-km-reason">{x.reason[lang]}</small>
                      </span>
                      <Button size="sm" variant="quiet" icon="doc" onClick={() => seeCv(x)}>
                        {k.seeCv}
                      </Button>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="dk-km-empty">{k.none}</p>
              )}
            </>
          )}
        </div>
      </div>
      <Modal open={!!cvOpen} onClose={() => setCvOpen(null)} title={cvOpen ? k.cvTitle(cvOpen.label) : ''} size="lg">
        {cvOpen && (
          <div className="dk-km-cvdoc">
            {!run.blind && cvDocOf && <DocArt doc={cvDocOf} label={k.cvTitle(cvOpen.label)} className="dk-km-cvart" />}
            <div>
              <h4>{k.reasons}</h4>
              <ul className="dk-km-hl">
                {cvOpen.cv.reasons.map((r) => (
                  <li key={r.id}>{r[lang]}</li>
                ))}
              </ul>
              <h4>{k.exp}</h4>
              <ul>
                {cvOpen.cv.experience.map((e) => (
                  <li key={`${e.org}-${e.from}`}>
                    {e.title} · {e.org} ({e.from}–{e.to ?? (lang === 'id' ? 'sekarang' : 'now')})
                  </li>
                ))}
              </ul>
              <h4>{k.skillsOf}</h4>
              <p>{cvOpen.cv.skills.map(skillLabel).join(', ')}</p>
            </div>
          </div>
        )}
      </Modal>
    </section>
  )
}
