/**
 * Inti Data (landing): the platform pulse + KPI line, the root chips, the 6-lane data trail (dataTrail spine) and the
 * cross-product activity feed. "Putar jejak" loads world/story on click and plays the missing steps of the day
 * story; every lane lights when its Audit Log row lands. Node click ⇒ NodeDrawer (lazy).
 */
import { Suspense, lazy, useCallback, useMemo, useState } from 'react'
import { intentProps, useShell } from '../../demo-kit/shell'
import { ActivityFeed, Button, Icon, Kpi, KpiStrip, motionMode } from '../../demo-kit/ui'
import { hhmm, rows, useClock, useWorld, world, type AuditEntry, type WorldState } from '../../demo-kit/world'
import { TRAIL_SPINE, dataTrail, inboxKpi, activityRows, productOfAudit, scopeOf, type Scope } from '../../demo-kit/world/inti'
import { useAiTraces } from '../../demo-kit/ai/trace'
import { ROLES, type ProductSlug } from '../../content/products'
import { PulseStrip } from './PulseStrip'
import { TrailLanes, type TrailLane } from './TrailLanes'
import { PRODUCTS17, ROOT_KEYS, canLink, ecoOf, productName, pulseOf, refExists, rootsOf, type RootKey } from './model'
import { tm, useT } from './strings'

const NodeDrawer = lazy(() => import('./NodeDrawer'))
const loadStory = () => import('../../demo-kit/world/story')
const all = (s: WorldState) => s

export interface DataProps {
  scope: Scope
  root: string | null
  setRoot: (r: string | null) => void
  onAudit: (auditId: string) => void
}

export default function Data({ scope, root, setRoot, onAudit }: DataProps) {
  const { t, lang } = useT()
  const shell = useShell()
  const s = useWorld(all)
  const now = useClock().minutes
  const traces = useAiTraces()
  const motion = motionMode() === 'full'
  const sm = shell.size === 'sm'
  const usaha = scope === 'usaha'

  const pulse = useMemo(() => pulseOf(s, now, scope), [s, now, scope])
  const unread = useMemo(() => inboxKpi(s, now, scope).unread, [s, now, scope])
  const roots = useMemo(() => rootsOf(s, now), [s, now])
  const eff = root && refExists(s, root) ? root : usaha ? roots.shop : roots.siti
  const trail = useMemo(() => (eff ? dataTrail(s, eff) : null), [s, eff])

  const lanes = useMemo<TrailLane[]>(() => {
    const allow = usaha ? scopeOf('pemilik-toko').allows : null
    const rowsOk = (trail?.rows ?? []).filter((r) => !allow || allow(r.refs, s))
    // the root's own (first) Audit row: trail.rows stops at 40, the root's row may be later than that
    let rootRow: AuditEntry | null = null
    if (eff) for (const a of rows(s.auditLog)) if (a.entityRefs.includes(eff) && (!rootRow || a.at < rootRow.at || (a.at === rootRow.at && a.id < rootRow.id))) rootRow = a
    return TRAIL_SPINE.map((p, i) => {
      const eco = ecoOf(p) ?? 'satu-daerah'
      const name = productName(p)
      if (usaha && eco === 'satu-daerah') return { product: p, name, eco, state: 'hidden', auditId: null, time: null, text: '', more: 0 }
      const mine = rowsOk.filter((r) => r.product === p)
      // the root's own row first (Ibu Siti's complaint = the Sapa Warga node), else the spine's first row
      let id = (rootRow && productOfAudit(rootRow) === p ? rootRow.id : null) ?? trail?.spine[i]?.auditId ?? null
      if (id && allow && !allow(s.auditLog.byId[id]?.entityRefs ?? [], s)) id = null
      id ??= mine[0]?.auditId ?? null
      const a = id ? s.auditLog.byId[id] : undefined
      return { product: p, name, eco, state: a ? 'lit' : 'off', auditId: a?.id ?? null, time: a ? tm(hhmm(a.at), lang) : null, text: a?.summary[lang] ?? '', more: Math.max(0, mine.length - (a ? 1 : 0)) }
    })
  }, [trail, s, usaha, lang, eff])
  const litCount = lanes.filter((l) => l.state === 'lit').length
  const complete = lanes.every((l) => l.state === 'lit')

  const { markMission } = shell
  const onDrawn = useCallback(
    (n: number) => {
      if (n === 6 && complete) markMission('jejak')
    },
    [complete, markMission],
  )

  const [playing, setPlaying] = useState(false)
  const play = async () => {
    if (playing) return
    setPlaying(true)
    shell.holdGuide(true)
    try {
      const m = await loadStory()
      const pick = () => {
        const c = m.sitiComplaint(world.get())
        if (c) setRoot(`complaints:${c.id}`)
      }
      pick()
      await m.playDayStory({ gapMs: 600, onStep: () => pick() })
      pick()
    } finally {
      setPlaying(false)
      shell.holdGuide(false)
    }
  }

  const [node, setNode] = useState<string | null>(null)
  const feed = useMemo(() => {
    const allow = usaha ? scopeOf('pemilik-toko').allows : null
    return activityRows(s, now, { max: usaha ? 400 : 12 })
      .filter((r) => !allow || allow(s.auditLog.byId[r.id]?.entityRefs ?? [], s))
      .slice(0, 8)
      .map((r) => (r.href && canLink(r.product) ? r : { ...r, href: undefined }))
  }, [s, now, usaha])

  const top = Object.entries(pulse.perProduct)
    .sort((a, b) => (b[1]?.count ?? 0) - (a[1]?.count ?? 0))
    .slice(0, 2)
    .map(([k, v]) => `${productName(k as ProductSlug)} (${v?.count ?? 0})`)
    .join(', ')
  const chips = usaha ? (['shop'] as RootKey[]) : ROOT_KEYS
  const shopName = s.businesses.byId[s.meta.shopId]?.name ?? ''
  const showPlay = !usaha && (!trail || !trail.complete)

  return (
    <div className="dk-in-data">
      <div className="dk-in-top">
        <PulseStrip
          perProduct={pulse.perProduct}
          todayCount={pulse.todayCount}
          now={now}
          compact={sm}
          motion={motion}
          title={t.pulseTitle}
          countText={t.pulseCount(pulse.todayCount)}
          aria={t.pulseAria(pulse.todayCount, top)}
          ecoLabel={t.ecoShort}
        />
        <div className="dk-in-kpiwrap" data-unread={unread} data-events={pulse.todayCount}>
          <span className="dk-in-sim">{t.sim}</span>
          <KpiStrip label={t.kpiLabel} className="dk-in-kpis">
            <Kpi label={t.kpiProducts} value={PRODUCTS17.length} />
            <Kpi label={t.kpiRoles} value={Object.keys(ROLES).length} />
            <Kpi label={t.kpiEvents} value={pulse.todayCount} />
            <Kpi label={t.kpiUnread} value={unread} />
            <Kpi label={t.kpiAgents} value={traces.length} wrapLabel />
          </KpiStrip>
        </div>
      </div>

      <section className="dk-in-box dk-in-trailbox" data-tour="in-trail" aria-labelledby="dk-in-trail-h">
        <header className="dk-in-boxh">
          <div>
            <h2 id="dk-in-trail-h" className="dk-in-h">
              {t.trailTitle}
            </h2>
            <p className="dk-in-lead">{t.trailLead}</p>
          </div>
          <span className="dk-in-status" data-in="trail-status">
            {complete ? t.complete(litCount) : t.partial(litCount)}
          </span>
        </header>
        <div className="dk-in-roots" role="group" aria-label={t.rootLabel}>
          {chips.map((k) => {
            const r = roots[k]
            const label = k === 'shop' ? t.roots.shop(shopName) : t.roots[k]
            return (
              <button key={k} type="button" className={`dk-in-root${r && r === eff ? ' is-on' : ''}`} data-root={k} aria-pressed={!!r && r === eff} disabled={!r} onClick={() => r && setRoot(r)}>
                <span>{label}</span>
                {!r && <small className="dk-in-why">{t.rootWhy[k]}</small>}
              </button>
            )
          })}
        </div>
        {usaha && (
          <p className="dk-in-scope" data-in="scope-note">
            <Icon name="lock" size={14} /> {t.scopeNote}
          </p>
        )}
        <TrailLanes
          key={eff ?? 'none'}
          lanes={lanes}
          vertical={sm}
          motion={motion}
          onNode={(i) => setNode(lanes[i]?.auditId ?? null)}
          onDrawn={onDrawn}
          labels={{ off: t.laneOff, hidden: t.laneHidden, more: t.laneMore, aria: t.laneAria, lit: t.laneLit, steps: t.stepsLabel }}
        />
        {!trail && !playing && !usaha && (
          <div className="dk-in-empty">
            <p className="dk-in-empty-t">{t.emptyTitle}</p>
            <p className="dk-in-muted">{t.emptyBody}</p>
          </div>
        )}
        {showPlay && (
          <div className="dk-in-play" data-tour="in-trail-play">
            <Button variant="primary" icon="play" data-hotspot="trail-play" data-in="play" disabled={playing} onClick={() => void play()} {...intentProps(loadStory)}>
              {playing ? t.playing : t.play}
            </Button>
            <p className="dk-in-muted dk-in-note">{t.playNote}</p>
          </div>
        )}
        {trail && trail.branches.length > 0 && !usaha && (
          <p className="dk-in-branches">
            <span className="dk-in-muted">{t.branches}:</span>{' '}
            {trail.branches.slice(0, 5).map((b) => (
              <span key={b.product} className="dk-in-branch" data-eco={ecoOf(b.product) ?? undefined}>
                {productName(b.product)} · {b.count}
              </span>
            ))}
          </p>
        )}
      </section>

      <section className="dk-in-box dk-in-feed">
        <ActivityFeed rows={feed} max={8} label={t.activity} empty={t.activityEmpty} />
      </section>

      {node && (
        <Suspense fallback={null}>
          <NodeDrawer
            auditId={node}
            onClose={() => setNode(null)}
            onAudit={(id) => {
              setNode(null)
              onAudit(id)
            }}
          />
        </Suspense>
      )}
    </div>
  )
}
