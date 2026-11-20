/**
 * Detail.tsx — one tender: header (HPS, deadline countdown, method), AI summary (lazy, "Ringkas"), ScoreCard (gauge +
 * 5 factors), Checklist (requirementsFor, deep links to Kenal Mitra / Pajak Beres / Toko Autopilot), PriceCard
 * (priceAdvice + what-if), the deadline calendar (lazy) and the way to the bid document.
 * Missions: 'buka' when an emergency (method darurat) tender renders here; 'syarat' at once when its checklist is
 * already complete.
 */
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { useShell, intentProps } from '../../demo-kit/shell'
import { Button, Icon, LoadingText } from '../../demo-kit/ui'
import { useClock, useWorld, type WorldState } from '../../demo-kit/world'
import { requirementsFor, winScore, type Requirement } from '../../demo-kit/world/usaha-pintar'
import Checklist, { type ChecklistLink } from './Checklist'
import PriceCard from './PriceCard'
import ScoreCard from './ScoreCard'
import { setDraft, useDraft } from './draft'
import { bidOf, canLink, countdown, deadlineText, hrefTo, rp, type Lang } from './model'
import type { Strings } from './strings'

const loadAi = () => import('./ai')
const AiSummary = lazy(() => loadAi().then((m) => ({ default: m.AiSummary })))
const loadDeadlines = () => import('./Deadlines')
const Deadlines = lazy(loadDeadlines)
export const loadComposer = () => import('./Composer')
/** the press paints in the click frame (a frame without a visual change is not presented, so the click would only
 *  "end" after the tab swap rendered); the caller defers the heavy work past that paint (INP) */
function pressed(el: HTMLElement, fn: () => void): void {
  el.setAttribute('data-pressing', '')
  fn()
  window.setTimeout(() => el.removeAttribute('data-pressing'), 600)
}

const whole = (s: WorldState) => s

export default function Detail({ tenderId, onDoc, t, lang, sm }: { tenderId: string; onDoc: () => void; t: Strings; lang: Lang; sm: boolean }) {
  const s = useWorld(whole)
  const now = useClock().minutes
  const { markMission } = useShell()
  const shopId = s.meta.shopId
  const tender = s.tenders.byId[tenderId]
  const draft = useDraft(tenderId)
  const [ai, setAi] = useState(false)
  const [cal, setCal] = useState(false)
  const topRef = useRef<HTMLDivElement>(null)

  const score = useMemo(() => (tender ? winScore(s, tender.id, shopId) : null), [s, tender, shopId])
  const reqs = useMemo(() => (tender ? requirementsFor(s, tender.id, shopId) : []), [s, tender, shopId])
  const bid = useMemo(() => bidOf(s, tenderId, draft), [s, tenderId, draft])
  const advice = bid?.advice ?? null

  // a new tender: AI summary closed again, view at the top
  const firstRender = useRef(true)
  useEffect(() => {
    setAi(false)
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    // another tender opened while this view stays: bring its header into view when it is above the screen
    const el = topRef.current
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: 'start' })
  }, [tenderId])

  const method = tender?.method
  const complete = reqs.length > 0 && reqs.every((r) => r.ok)
  useEffect(() => {
    if (method === 'darurat') markMission('buka')
  }, [method, tenderId, markMission])
  useEffect(() => {
    if (complete) markMission('syarat')
    // only on opening (a later tax.ready is the mission's own event)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenderId])

  if (!tender || !score) return <p className="dk-tp-empty">{t.noTender}</p>
  const prob = tender.matches[shopId] ?? score.probability
  const opd = s.region.opd.find((o) => o.id === tender.opdId)
  const kec = s.region.kecamatan.find((k) => k.id === tender.kecamatanId)?.name ?? tender.kecamatanId
  const price = bid?.total ?? 0
  const proc = tender.procurementId ? s.procurements.byId[tender.procurementId] : undefined
  const risk = tender.risk?.score ?? (proc?.riskScore != null && proc.riskScore >= 60 ? proc.riskScore : null)

  const linkFor = (r: Requirement): ChecklistLink | null => {
    if (r.key === 'pajak' && !r.ok && canLink('pajak-beres')) return { to: hrefTo('pajak-beres', r.focus, 'from=tenderpilot'), label: t.taxLink, tp: 'tax-link' }
    if (r.key === 'kyb' && r.focus && canLink('kenal-mitra')) return { to: hrefTo('kenal-mitra', r.focus), label: t.kybLink, tp: 'kyb-link' }
    if (r.key === 'kapasitas' && r.warn && r.focus && canLink('toko-autopilot')) return { to: hrefTo('toko-autopilot', r.focus), label: t.stockLink, tp: 'stock-link' }
    return null
  }

  return (
    <div className="dk-tp-detail" ref={topRef} data-tender={tender.id} data-method={tender.method}>
      <header className="dk-tp-dh">
        <p className="dk-tp-dh-meta">{t.detailMeta(tender.code, opd?.short ?? tender.opdId, kec)}</p>
        <h2 className="dk-tp-dh-title">{tender.title[lang]}</h2>
        <dl className="dk-tp-dh-facts">
          <div>
            <dt>{t.hpsLabel}</dt>
            <dd className="dk-num">{rp(tender.hps ?? tender.value)}</dd>
          </div>
          <div>
            <dt>{t.deadlineLabel}</dt>
            <dd>
              {deadlineText(s.day, tender.deadlineAt, lang)} · <span className="dk-tp-due is-soon">{countdown(tender.deadlineAt - now, lang)}</span>
            </dd>
          </div>
          <div>
            <dt>{t.methodLabel}</dt>
            <dd>{t.method[tender.method] ?? tender.method}</dd>
          </div>
        </dl>
        {tender.method === 'darurat' && !tender.procurementId && <p className="dk-tp-note is-warn">{t.emergencyNote}</p>}
        {tender.procurementId && <p className="dk-tp-note">{t.mirrorNote}</p>}
        {risk !== null && (
          <p className="dk-tp-note is-danger" data-tp="risk-note">
            <Icon name="flag" size={14} /> {t.mirrorRisk(risk)}
          </p>
        )}
      </header>

      <section className="dk-tp-ai" aria-label={t.aiTitle}>
        <header className="dk-tp-card-h">
          <h3>
            <Icon name="spark" size={16} /> {t.aiTitle}
          </h3>
          {!ai && (
            <Button size="sm" variant="secondary" icon="spark" onClick={() => setAi(true)} {...intentProps(loadAi)} data-tp="summarize">
              {t.aiBtn}
            </Button>
          )}
        </header>
        {ai ? (
          <Suspense fallback={<LoadingText>{t.loading}</LoadingText>}>
            <AiSummary tenderId={tender.id} />
          </Suspense>
        ) : (
          <p className="dk-tp-muted">{t.aiIdle}</p>
        )}
      </section>

      <div className="dk-tp-grid">
        <ScoreCard probability={prob} factors={score.factors} lang={lang} size={sm ? 160 : 180} />
        <Checklist items={reqs} lang={lang} linkFor={linkFor} />
        {advice && <PriceCard advice={advice} price={price} delta={draft.delta} onDelta={(d) => setDraft(tender.id, { delta: d, units: {} })} lang={lang} />}
        <section className="dk-tp-cal" aria-label={t.calendarBtn}>
          <Button size="sm" variant="ghost" icon="calendar" aria-expanded={cal} onClick={() => setCal((v) => !v)} {...intentProps(loadDeadlines)} data-tp="calendar">
            {cal ? t.calendarHide : t.calendarBtn}
          </Button>
          {cal && (
            <Suspense fallback={<LoadingText>{t.loading}</LoadingText>}>
              <Deadlines tenderId={tender.id} />
            </Suspense>
          )}
          {tender.spec && (
            <div className="dk-tp-spec">
              <h3>{t.specTitle}</h3>
              <p>{tender.spec[lang]}</p>
            </div>
          )}
        </section>
      </div>

      <div className="dk-tp-next">
        <p className="dk-tp-muted">{t.toDocNote}</p>
        <Button variant="primary" icon="doc" onClick={(e) => pressed(e.currentTarget, onDoc)} {...intentProps(loadComposer)} data-tp="to-doc">
          {t.toDoc}
        </Button>
      </div>
    </div>
  )
}
