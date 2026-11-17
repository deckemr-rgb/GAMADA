/**
 * Satu Berkas — gallery of SPESIMEN documents → DocViewer (OCR boxes one by one, deskew of scans) + ExtractPanel
 * (fields with confidence, consistency checks, verdict Lengkap / Kurang / Perlu Cek Manual) + tamper heatmap with
 * opacity toggle. Every finished read emits `document.verified` (source cek-berkas) and lands in the session log.
 * Live mode adds "Unggah dokumen sendiri" (lazy UploadOwn, consent first, not stored). "Tanya AI" is lazy (AskAi).
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react'
import { DocArt, DocViewer, ExtractPanel, TamperToggle, VERDICT_LABEL, getSample, readPrompt, simulateExtract, verdictOf, type SampleDoc, type VerdictResult } from '../../demo-kit/docs'
import type { Extracted } from '../../demo-kit/ai/types'
import { useShell } from '../../demo-kit/shell'
import { Button, Icon, LoadingText, motionMode } from '../../demo-kit/ui'
import { clock, emit, hhmm, useSession, world } from '../../demo-kit/world'
import { useI18n, type Lang } from '../../lib/i18n'
import { CEK, GALLERY, sessionLog, worldDocFor, type CekContext, type CekRole, type LogRow } from './model'
import { STR } from './strings'

const AskAi = lazy(() => import('./AskAi'))
const UploadDialog = lazy(() => import('./UploadOwn').then((m) => ({ default: m.UploadDialog })))
const OwnView = lazy(() => import('./UploadOwn').then((m) => ({ default: m.OwnView })))

export interface OwnDoc {
  url: string
  name: string
  extracted: Extracted
}

const isEdited = (d: SampleDoc) => d.id.endsWith('-edit')

/** amounts are the only bare numbers the kit panel may show as Rupiah: postcodes, KBLI codes, years stay verbatim */
const MONEY_KEY = /modal|nilai|jumlah|total|harga|biaya|omzet|nominal|amount|price|capital/i
function displayValue(key: string, v: string, lang: Lang): string {
  if (/^[1-9]\d{3,8}$/.test(v) && !MONEY_KEY.test(key)) return `\u2060${v}` // word joiner: invisible, keeps the digits verbatim
  return STR[lang].presence[v] ?? v
}
const narrowLayout = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 980px)').matches
const smooth = (): ScrollBehavior => (motionMode() === 'full' ? 'smooth' : 'auto')

export default function Single({ role, pick, onPick }: { role: CekRole; pick: string; onPick: (id: string) => void }) {
  const { lang } = useI18n()
  const t = STR[lang]
  const shell = useShell()
  const session = useSession()
  const docs = useMemo(() => GALLERY[role].map((id) => getSample(id)).filter((d): d is SampleDoc => !!d), [role])
  const doc = getSample(pick) ?? docs[0]!
  const extracted = useMemo(() => simulateExtract(doc, { lang }), [doc, lang])
  const shownExtract = useMemo<Extracted>(() => ({ ...extracted, fields: extracted.fields.map((f) => ({ ...f, value: displayValue(f.key, f.value, lang) })) }), [extracted, lang])
  const total = extracted.fields.length

  /* ---------------------------------------------------------------- read run */
  const [run, setRun] = useState<{ doc: string; n: number } | null>(null)
  const [aiOpen, setAiOpen] = useState(false)
  const [shown, setShown] = useState(0)
  const [heat, setHeat] = useState(0)
  const [active, setActive] = useState<string | null>(null)
  const [lastMs, setLastMs] = useState<{ doc: string; ms: number } | null>(null)
  const t0 = useRef(0)
  const emitted = useRef('')
  const reveal = run !== null && run.doc === doc.id
  const done = reveal && shown >= total
  const reading = reveal && !done

  const start = useCallback((id: string) => {
    t0.current = performance.now()
    setShown(0)
    setHeat(0)
    setActive(null)
    setAiOpen(false) // a new read: the assistant reopens on the new result instead of an empty thread
    setRun((r) => ({ doc: id, n: (r?.n ?? 0) + 1 }))
  }, [])

  const select = useCallback(
    (id: string) => {
      onPick(id)
      start(id)
    },
    [onPick, start],
  )

  // the role changed the gallery: forget a run on a document that is no longer shown
  useEffect(() => {
    if (run && !GALLERY[role].includes(run.doc)) setRun(null)
  }, [role, run])

  const onReveal = useCallback((c: number) => setShown(c), [])
  const sideRef = useRef<HTMLElement>(null)
  // keep the newest extracted field in view while the list is capped (desktop) and still filling
  useEffect(() => {
    if (!reading) return
    const ol = sideRef.current?.querySelector<HTMLElement>('.dk-xp-fields')
    if (ol && ol.scrollHeight > ol.clientHeight) ol.scrollTop = ol.scrollHeight
  }, [shown, reading])

  // finished read → verdict, world event, session log, heatmap for edited documents, mission
  useEffect(() => {
    if (!done || !run) return
    const key = `${run.doc}:${run.n}`
    if (emitted.current === key) return
    emitted.current = key
    const v = verdictOf(extracted)
    const idv = verdictOf(simulateExtract(doc, { lang: 'id' }))
    const env = verdictOf(simulateExtract(doc, { lang: 'en' }))
    // the desk record this specimen stands for (the world only knows its own documents)
    const documentId = worldDocFor(world.get(), doc.id)
    if (documentId) {
      const notes = {
        id: `Spesimen “${doc.title.id}”${idv.reasons.length ? `: ${idv.reasons.join('; ')}` : ''}`,
        en: `Specimen “${doc.title.en}”${env.reasons.length ? `: ${env.reasons.join('; ')}` : ''}`,
      }
      emit('document.verified', { documentId, status: v.verdict, notes }, 'cek-berkas')
    }
    if (doc.kind === 'ktp') shell.markMission('verify-ktp')
    const row: LogRow = { docId: doc.id, verdict: v.verdict, ms: Math.max(300, Math.round(performance.now() - t0.current)), at: clock.get().minutes, tampered: isEdited(doc) }
    sessionLog.add(row)
    setLastMs({ doc: doc.id, ms: row.ms })
    if (doc.tamper?.length) setHeat(CEK.heatOn)
    if (isEdited(doc) && v.verdict === 'cek-manual') shell.markMission('find-edited')
    // the field list rests on the first field to look at (low confidence), else its top
    const ol = sideRef.current?.querySelector<HTMLElement>('.dk-xp-fields')
    if (ol && ol.scrollHeight > ol.clientHeight) {
      const low = ol.querySelector<HTMLElement>('.dk-xp-row.is-low')
      ol.scrollTo({ top: low ? Math.max(0, low.offsetTop - ol.offsetTop - 8) : 0, behavior: smooth() })
    }
    // one column (tablet / phone): bring the verdict into view, the document stays partly visible above it
    if (narrowLayout()) requestAnimationFrame(() => sideRef.current?.querySelector('.dk-cb-verdict')?.scrollIntoView({ block: 'nearest', behavior: smooth() }))
  }, [done, run, doc, extracted, shell])

  const cells = extracted.tamper ?? []
  const maxScore = cells.reduce((m, c) => Math.max(m, c.score), 0)
  const verdict = done ? verdictOf(extracted) : null

  /* ---------------------------------------------------------------- own document (Live only) */
  const [uploadOpen, setUploadOpen] = useState(false)
  const [own, setOwn] = useState<OwnDoc | null>(null)
  const closeOwn = useCallback(() => {
    setOwn(null)
  }, [])
  useEffect(
    () => () => {
      if (own) URL.revokeObjectURL(own.url)
    },
    [own],
  )
  useEffect(() => {
    if (session.aiMode !== 'live') {
      setUploadOpen(false)
      closeOwn()
    }
  }, [session.aiMode, closeOwn])

  /* ---------------------------------------------------------------- AI */
  const askRef = useRef<HTMLDivElement>(null)
  const refocusAsk = useRef(false)
  const closeAi = useCallback(() => {
    refocusAsk.current = true
    setAiOpen(false)
  }, [])
  // closing the assistant hands focus back to the button that opened it
  useEffect(() => {
    if (aiOpen || !refocusAsk.current) return
    refocusAsk.current = false
    askRef.current?.querySelector<HTMLButtonElement>('.dk-cb-askbtn')?.focus()
  }, [aiOpen])
  const docInfo = useMemo<CekContext['doc']>(() => {
    if (own) {
      const v = verdictOf(own.extracted)
      return {
        id: 'unggahan',
        title: own.name,
        kind: own.extracted.kind,
        verdict: v.verdict,
        reasons: v.reasons,
        checks: (own.extracted.checks ?? []).map((c) => ({ id: c.id, label: c.label[lang], status: c.status, ...(c.note ? { note: c.note } : {}) })),
        fields: own.extracted.fields.map((f) => ({ key: f.key, label: f.label[lang], value: f.value, confidence: f.confidence })),
        tamperTop: (own.extracted.tamper ?? []).reduce((m, c) => Math.max(m, c.score), 0),
        tamperReasons: [],
      }
    }
    return {
      id: doc.id,
      title: doc.title[lang],
      kind: doc.kind,
      verdict: verdict?.verdict ?? null,
      reasons: verdict?.reasons ?? [],
      checks: done ? (extracted.checks ?? []).map((c) => ({ id: c.id, label: c.label[lang], status: c.status, ...(c.note ? { note: c.note } : {}) })) : [],
      fields: done ? extracted.fields.map((f) => ({ key: f.key, label: f.label[lang], value: f.value, confidence: f.confidence })) : [],
      tamperTop: done ? maxScore : 0,
      tamperReasons: done ? (doc.tamper ?? []).map((x) => x.reason[lang]) : [],
    }
  }, [own, doc, lang, verdict, done, extracted, maxScore])

  return (
    <div className="dk-cb-single">
      <Gallery docs={docs} value={doc.id} onSelect={select} lang={lang} live={session.aiMode === 'live'} onUpload={() => setUploadOpen(true)} ownActive={!!own} />

      <div className="dk-cb-work">
        <div className="dk-cb-viewer">
          {own ? (
            <Suspense fallback={<LoadingText />}>
              <OwnView doc={own} onClose={closeOwn} />
            </Suspense>
          ) : (
            <DocViewer
              doc={doc}
              boxes={extracted.fields}
              revealBoxes={reveal}
              replay={run?.n ?? 0}
              onReveal={onReveal}
              deskew={reveal}
              activeKey={active}
              onBoxFocus={setActive}
              tamper={done && cells.length ? { cells, opacity: heat } : null}
              height="clamp(300px, 58vh, 600px)"
              toolbar={
                <>
                  <Button size="sm" variant="primary" icon={done ? 'refresh' : 'shield'} onClick={() => start(doc.id)} busy={reading} data-hotspot="cek-go">
                    {done ? t.reverify : t.verify}
                  </Button>
                  {done && cells.length > 0 && <TamperToggle opacity={heat} onChange={setHeat} maxScore={maxScore} />}
                </>
              }
            />
          )}
        </div>

        <aside ref={sideRef} className="dk-cb-side" aria-label={lang === 'id' ? 'Hasil pemeriksaan' : 'Check result'}>
          {!own && reading && (
            <p className="dk-cb-progress dk-num">
              <span style={{ transform: `scaleX(${shown / Math.max(1, total)})` }} aria-hidden="true" />
              {t.reading(shown, total)}
            </p>
          )}
          {!own && done && verdict && <VerdictCard verdict={verdict} checks={extracted.checks ?? []} fields={total} ms={lastMs?.doc === doc.id ? lastMs.ms : null} lang={lang} />}
          {own && <VerdictCard verdict={verdictOf(own.extracted)} checks={own.extracted.checks ?? []} fields={own.extracted.fields.length} ms={null} lang={lang} />}
          {!own && done && heat > 0 && isEdited(doc) && (
            <p className="dk-cb-callout is-danger" role="status">
              <Icon name="alert" size={16} />
              {t.tamperFound}
            </p>
          )}
          {own ? (
            <ExtractPanel extracted={own.extracted} showVerdict={false} className="dk-cb-xp" />
          ) : (
            <ExtractPanel extracted={reveal ? shownExtract : null} revealed={shown} activeKey={active} onFieldFocus={setActive} emptyText={readPrompt(t.verify, lang)} showVerdict={false} className="dk-cb-xp" />
          )}
          {!own && done && (
            <p className="dk-cb-sent">
              <Icon name="checkCircle" size={14} />
              {t.sentTo} · {hhmm(clock.get().minutes)} WIB
            </p>
          )}
          {(done || own) && (
            <div className="dk-cb-ai" ref={askRef}>
              {aiOpen ? (
                <Suspense fallback={<LoadingText />}>
                  <AskAi role={role} doc={docInfo} onClose={closeAi} />
                </Suspense>
              ) : (
                <Button variant="secondary" icon="chat" onClick={() => setAiOpen(true)} className="dk-cb-askbtn">
                  {t.askAi}
                </Button>
              )}
            </div>
          )}
          <History lang={lang} onOpen={(id) => (GALLERY[role].includes(id) ? select(id) : undefined)} role={role} />
        </aside>
      </div>

      {uploadOpen && (
        <Suspense fallback={null}>
          <UploadDialog
            open={uploadOpen}
            onClose={() => setUploadOpen(false)}
            onResult={(r) => {
              setUploadOpen(false)
              setOwn(r)
              setAiOpen(false)
            }}
          />
        </Suspense>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ gallery */

const KIND_ICON: Record<string, 'user' | 'users' | 'building' | 'home' | 'camera' | 'doc'> = { ktp: 'user', kk: 'users', nib: 'building', domisili: 'home', house: 'camera' }

function Gallery({ docs, value, onSelect, lang, live, onUpload, ownActive }: { docs: SampleDoc[]; value: string; onSelect: (id: string) => void; lang: Lang; live: boolean; onUpload: () => void; ownActive: boolean }) {
  const t = STR[lang]
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const stripRef = useRef<HTMLDivElement>(null)
  const sel = docs.findIndex((d) => d.id === value)
  // keep the selected card whole inside the strip (phones: the strip scrolls sideways)
  useEffect(() => {
    const strip = stripRef.current
    const el = refs.current[sel]
    if (!strip || !el || strip.scrollWidth <= strip.clientWidth) return
    const l = el.offsetLeft - strip.offsetLeft
    const r = l + el.offsetWidth
    if (l < strip.scrollLeft + 8) strip.scrollTo({ left: Math.max(0, l - 24), behavior: smooth() })
    else if (r > strip.scrollLeft + strip.clientWidth - 8) strip.scrollTo({ left: r - strip.clientWidth + 24, behavior: smooth() })
  }, [sel])
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = docs.length
    let j = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % n
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + n) % n
    else if (e.key === 'Home') j = 0
    else if (e.key === 'End') j = n - 1
    if (j < 0) return
    e.preventDefault()
    refs.current[j]?.focus()
  }
  return (
    <section className="dk-cb-gallery" aria-label={t.gallery}>
      <div className="dk-cb-gal-head">
        <h3>{t.gallery}</h3>
        <span>{t.pickHint}</span>
      </div>
      <div className="dk-cb-gal-strip" ref={stripRef} role="group" aria-label={t.gallery}>
        {docs.map((d, i) => {
          const on = d.id === value && !ownActive
          return (
            <button
              key={d.id}
              ref={(el) => {
                refs.current[i] = el
              }}
              type="button"
              className={`dk-cb-thumb${on ? ' is-on' : ''}`}
              aria-pressed={on}
              tabIndex={on || (sel < 0 || ownActive ? i === 0 : false) ? 0 : -1}
              onClick={() => onSelect(d.id)}
              onKeyDown={(e) => onKey(e, i)}
              data-doc={d.id}
            >
              <span className={`dk-cb-mini is-${d.bg}`} aria-hidden="true">
                <DocArt doc={d} />
              </span>
              <span className="dk-cb-tt">
                <span className="dk-cb-kind">
                  <Icon name={KIND_ICON[d.kind] ?? 'doc'} size={12} />
                  {t.kindLabel[d.kind] ?? d.kind}
                </span>
                <b>{d.title[lang]}</b>
                <small>{d.caption[lang]}</small>
              </span>
            </button>
          )
        })}
        {live ? (
          <button type="button" className={`dk-cb-thumb is-upload${ownActive ? ' is-on' : ''}`} onClick={onUpload} aria-pressed={ownActive}>
            <span className="dk-cb-mini is-upload" aria-hidden="true">
              <Icon name="upload" size={22} />
            </span>
            <span className="dk-cb-tt">
              <span className="dk-cb-kind is-live">
                <i aria-hidden="true" />
                Live
              </span>
              <b>{t.upload}</b>
              <small>{t.uploadTitle}</small>
            </span>
          </button>
        ) : (
          <p className="dk-cb-upnote">
            <Icon name="lock" size={14} />
            {t.uploadLiveOnly}
          </p>
        )}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ verdict card (top of the result column) */

const VERDICT_ICON = { lengkap: 'checkCircle', kurang: 'info', 'cek-manual': 'alert' } as const

function VerdictCard({ verdict, checks, fields, ms, lang }: { verdict: VerdictResult; checks: NonNullable<Extracted['checks']>; fields: number; ms: number | null; lang: Lang }) {
  const ok = checks.filter((c) => c.status === 'ok').length
  const loc = lang === 'id' ? 'id-ID' : 'en-US'
  const meta =
    lang === 'id'
      ? `${ok} dari ${checks.length} cek lolos · ${fields} field terbaca${ms !== null ? ` · ${(ms / 1000).toLocaleString(loc, { maximumFractionDigits: 1, minimumFractionDigits: 1 })} dtk` : ''}`
      : `${ok} of ${checks.length} checks passed · ${fields} fields read${ms !== null ? ` · ${(ms / 1000).toLocaleString(loc, { maximumFractionDigits: 1, minimumFractionDigits: 1 })} s` : ''}`
  return (
    <div className={`dk-cb-verdict is-${verdict.verdict}`} role="status">
      <span className="dk-cb-verdict-ic" aria-hidden="true">
        <Icon name={VERDICT_ICON[verdict.verdict]} size={20} strokeWidth={2} />
      </span>
      <span className="dk-cb-verdict-b">
        <small>{lang === 'id' ? 'Hasil verifikasi' : 'Verification result'}</small>
        <b>{VERDICT_LABEL[verdict.verdict][lang]}</b>
        <span className="dk-num">{meta}</span>
      </span>
      {verdict.reasons.length > 0 && (
        <ul>
          {verdict.reasons.slice(0, 3).map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ session history */

function History({ lang, onOpen, role }: { lang: Lang; onOpen: (id: string) => void; role: CekRole }) {
  const t = STR[lang]
  const log = useSyncExternalStore(sessionLog.subscribe, sessionLog.get, sessionLog.get)
  return (
    <section className="dk-cb-hist" aria-label={t.history}>
      <h4>{t.history}</h4>
      {log.length === 0 ? (
        <p className="dk-cb-hist-empty">{t.historyEmpty}</p>
      ) : (
        <ol aria-live="polite">
          {log.slice(0, 6).map((r, i) => {
            const d = getSample(r.docId)
            const canOpen = GALLERY[role].includes(r.docId)
            const body = (
              <>
                <span className={`dk-cb-vdot is-${r.verdict}`} aria-hidden="true" />
                <span className="dk-cb-hist-t">{d?.title[lang] ?? r.docId}</span>
                <span className={`dk-cb-vchip is-${r.verdict}`}>{VERDICT_LABEL[r.verdict][lang]}</span>
                <span className="dk-cb-hist-m dk-num">
                  {hhmm(r.at)} · {(r.ms / 1000).toLocaleString(lang === 'id' ? 'id-ID' : 'en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} {t.sec}
                </span>
              </>
            )
            return (
              <li key={`${r.docId}-${log.length - i}`}>
                {canOpen ? (
                  <button type="button" className="dk-cb-hist-row" onClick={() => onOpen(r.docId)} aria-label={`${t.open}: ${d?.title[lang] ?? r.docId}, ${VERDICT_LABEL[r.verdict][lang]}`}>
                    {body}
                  </button>
                ) : (
                  <div className="dk-cb-hist-row">{body}</div>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
