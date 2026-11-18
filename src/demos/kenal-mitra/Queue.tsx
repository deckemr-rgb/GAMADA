/**
 * Antrian (first load): KPI strip (verificationKpi), three lanes KYC | KYB | Kandidat of open requests (priority first,
 * waiting time ticking per world minute), the Katalog Lokal storefront preview and the verification activity.
 * Phones: KPI 2×2, lane filter chips + one list, the preview as a collapsible card below.
 */
import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { preloadNow, useShell } from '../../demo-kit/shell'
import { Chip, Icon, Kpi, KpiStrip, flashNewRow } from '../../demo-kit/ui'
import { shallowEqual, useClock, useWorld, type AuditEntry, type VerificationRequest, type WorldState } from '../../demo-kit/world'
import { catalogPreview, verificationKpi, verificationQueue, type QueueRow } from '../../demo-kit/world/usaha-pintar'
import { CatalogPreview } from './CatalogPreview'
import { ActivityList, type ActivityRow } from './Activity'
import { clockText, waitLabel, type KmTab, type Lane } from './model'
import { useStr } from './strings'

const LANES: Lane[] = ['kyc', 'kyb', 'cv']
const queueKey = (q: QueueRow[]) => q.map((r) => `${r.req.id}:${r.waitingMin}:${r.req.priority ? 1 : 0}:${r.needCode ?? ''}`).join('|')

/** the business the preview highlights (the KYB hero) + its shortlist line once matched to an open need */
function heroPreview(s: WorldState) {
  const hero = s.meta.facts.up?.kenalMitra.heroBusinessId ?? null
  let match: { code: string; item: { id: string; en: string } } | null = null
  if (hero) {
    for (const id of s.matches.ids) {
      const m = s.matches.byId[id]
      if (!m || m.businessId !== hero) continue
      const n = s.catalogNeeds.byId[m.needId]
      if (!n || (n.status !== 'baru' && n.status !== 'dicocokkan')) continue
      const b = s.businesses.byId[hero]
      const it = n.items.find((i) => b?.supplies.includes(i.category)) ?? n.items[0]
      if (it) match = { code: n.code, item: it.name }
    }
  }
  return { hero, match }
}

/** the last 6 verification rows of the audit log (a CV batch of 10 is one row) */
function activityRows(s: WorldState): ActivityRow[] {
  const out: (ActivityRow & { batch?: number })[] = []
  const ids = s.auditLog.ids
  for (let i = ids.length - 1; i >= 0 && out.length < 6; i--) {
    const a: AuditEntry | undefined = s.auditLog.byId[ids[i]!]
    if (!a || (a.type !== 'verification.requested' && a.type !== 'partner.verified') || a.at < 0) continue
    const cv = a.type === 'partner.verified' && a.entityRefs.some((r) => r.startsWith('candidates:'))
    const last = out[out.length - 1]
    if (cv && last?.batch !== undefined && last.at === a.at) {
      last.batch++
      continue
    }
    const docId = a.entityRefs.find((r) => r.startsWith('documents:'))?.slice('documents:'.length)
    const owner = docId ? s.documents.byId[docId]?.ownerName : undefined
    const RES_EN: Record<string, string> = { lolos: 'passed', 'cek-manual': 'needs manual check', ditolak: 'rejected', kurang: 'incomplete' }
    const RES_ID: Record<string, string> = { lolos: 'lolos', 'cek-manual': 'perlu cek manual', ditolak: 'ditolak', kurang: 'kurang' }
    const fix = (x: string, res: Record<string, string>) => (owner && docId ? x.replace(docId, owner) : x).replace(/: (lolos|cek-manual|ditolak|kurang)$/, (_m, r: string) => `: ${res[r] ?? r}`)
    out.push({ id: a.id, at: a.at, kind: a.type === 'partner.verified' ? 'done' : 'req', text: { id: fix(a.summary.id, RES_ID), en: fix(a.summary.en, RES_EN) }, ...(cv ? { batch: 1 } : {}) })
  }
  return out
}

function QueueTab({ onOpen, intent }: { onOpen: (r: VerificationRequest) => void; intent: Partial<Record<KmTab, () => Promise<unknown>>> }) {
  const { t, lang } = useStr()
  const shell = useShell()
  const sm = shell.size === 'sm'
  const now = useClock().minutes
  const kpi = useWorld((s) => verificationKpi(s, now), shallowEqual)
  const queue = useWorld((s) => verificationQueue(s, now), (a, b) => queueKey(a) === queueKey(b))
  const joko = useWorld((s) => s.meta.facts.up?.kenalMitra.kycCleanDocId ?? null)
  const preview = useWorld((s) => catalogPreview(s))
  const { hero, match } = useWorld(heroPreview, (a, b) => a.hero === b.hero && a.match?.code === b.match?.code)
  const region = useWorld((s) => s.region)
  const kecOf = useCallback((id: string) => region.kecamatan.find((k) => k.id === id)?.name ?? id, [region])
  const activity = useWorld(activityRows, (a, b) => a.length === b.length && a.every((x, i) => x.id === b[i]?.id && x.text.id === b[i]?.text.id))
  const opening = useWorld((s) => s.meta.facts.up?.kenalMitra.cvOpening ?? null)
  const [filter, setFilter] = useState<Lane | 'all'>('all')
  const [previewOpen, setPreviewOpen] = useState(false)

  /* new cards: flash once + one polite announcement per 6 s */
  const root = useRef<HTMLDivElement>(null)
  const seen = useRef<Set<string> | null>(null)
  const [said, setSaid] = useState('')
  const lastSaid = useRef(0)
  useLayoutEffect(() => {
    const ids = queue.map((r) => r.req.id)
    if (!seen.current) {
      seen.current = new Set(ids)
      return
    }
    const fresh = queue.filter((r) => !seen.current!.has(r.req.id))
    for (const r of fresh) {
      seen.current.add(r.req.id)
      const el = root.current?.querySelector<HTMLElement>(`[data-req="${r.req.id}"]`)
      if (el) flashNewRow(el, { slide: true })
    }
    const f = fresh[0]
    if (f && performance.now() - lastSaid.current > 6000) {
      lastSaid.current = performance.now()
      setSaid(t.newReq(f.req.code, f.subject, t.kindLabel[f.req.kind] ?? f.req.kind))
    }
  }, [queue, t])

  const byLane = useMemo(() => {
    const m: Record<Lane, QueueRow[]> = { kyc: [], kyb: [], cv: [] }
    for (const r of queue) m[r.req.kind].push(r)
    return m
  }, [queue])
  const subjectOf = (r: QueueRow) => (r.req.kind === 'cv' && opening ? `${r.subject} · ${opening[lang]}` : r.subject)

  const card = (r: QueueRow) => {
    const first = r.req.kind === 'kyc' && r.req.subjectId === joko
    const load = intent[r.req.kind === 'kyc' ? 'kyc' : r.req.kind === 'kyb' ? 'kyb' : 'cv']
    const warm = () => load && preloadNow(load)
    return (
      <li key={r.req.id}>
        <button
          type="button"
          className={`dk-km-card${r.req.priority ? ' is-prio' : ''}`}
          data-req={r.req.id}
          data-kind={r.req.kind}
          {...(first ? { 'data-hotspot': 'km-first-request', 'data-hotspot-label': t.firstReq } : {})}
          onPointerEnter={warm}
          onFocus={warm}
          onTouchStart={warm}
          onClick={() => onOpen(r.req)}
        >
          <span className="dk-km-card-top">
            <span className="dk-km-code dk-num">{r.req.code}</span>
            {r.req.priority && (
              <span className="dk-km-prio">
                <Icon name="flag" size={12} />
                {r.needCode ? t.forNeed(r.needCode) : t.priority}
              </span>
            )}
          </span>
          <b className="dk-km-card-who">{subjectOf(r)}</b>
          <span className="dk-km-card-meta">
            <span>{r.req.requestedBy}</span>
            <span className="dk-num">{t.waiting(waitLabel(r.waitingMin, lang))}</span>
          </span>
        </button>
      </li>
    )
  }

  const lane = (k: Lane) => (
    <section key={k} className="dk-km-lane" data-km-lane={k} aria-label={t.lanes[k]}>
      <h3 className="dk-km-lane-h">
        <span>{t.lanes[k]}</span>
        <span className="dk-km-count dk-num">{byLane[k].length}</span>
      </h3>
      {byLane[k].length ? <ul className="dk-km-cards">{byLane[k].map(card)}</ul> : <p className="dk-km-empty">{t.laneEmpty[k]}</p>}
    </section>
  )

  const previewCard = (
    <CatalogPreview
      lang={lang}
      needs={preview.needs}
      suppliers={preview.suppliers}
      highlightId={hero}
      match={match ? { code: match.code, item: match.item[lang] } : null}
      kecName={kecOf}
    />
  )

  return (
    <div ref={root} className="dk-km-queue">
      <KpiStrip label={t.kpiLabel} className="dk-km-kpis">
        <Kpi label={t.kpiQueue} value={kpi.queue} caption={t.kpiQueueCap} wrapLabel />
        <Kpi label={t.kpiDone} value={kpi.doneToday} caption={t.kpiDoneCap} wrapLabel />
        <Kpi label={t.kpiMedian} value={kpi.medianMin} unit={t.kpiMedianUnit} caption={t.kpiMedianCap} wrapLabel />
        <Kpi label={t.kpiVerified} value={kpi.verified} caption={t.kpiVerifiedCap} wrapLabel />
      </KpiStrip>
      <p className="dk-sr" aria-live="polite">
        {said}
      </p>
      <div className="dk-km-board">
        {sm ? (
          <div className="dk-km-lanes is-one">
            <div className="dk-km-chips" role="group" aria-label={t.filter}>
              {(['all', ...LANES] as const).map((k) => (
                <Chip key={k} selected={filter === k} onToggle={() => setFilter(k)}>
                  {k === 'all' ? `${t.all} ${queue.length}` : `${t.kindLabel[k]} ${byLane[k].length}`}
                </Chip>
              ))}
            </div>
            {(filter === 'all' ? LANES : [filter]).map(lane)}
          </div>
        ) : (
          <div className="dk-km-lanes">{LANES.map(lane)}</div>
        )}
        <div className="dk-km-rail">
          {sm ? (
            <div className={`dk-km-collapse${previewOpen ? ' is-open' : ''}`}>
              <button type="button" className="dk-km-collapse-btn" aria-expanded={previewOpen} onClick={() => setPreviewOpen((o) => !o)}>
                <Icon name="katalog" size={16} />
                <span>{t.previewToggle}</span>
                <Icon name={previewOpen ? 'chevronUp' : 'chevronDown'} size={16} />
              </button>
              {previewOpen && previewCard}
            </div>
          ) : (
            previewCard
          )}
          <ActivityList rows={activity} lang={lang} title={t.activity} empty={t.activityEmpty} batchText={(n) => t.cvBatch(n, opening?.[lang] ?? '')} time={(m) => clockText(m, lang)} />
        </div>
      </div>
    </div>
  )
}

export default memo(QueueTab)
