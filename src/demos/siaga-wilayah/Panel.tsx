/**
 * siaga-wilayah/Panel.tsx — the collapsible left panel: title + role, the morning flow (4 steps that tick from the
 * world), and the tabs Peringatan (eager) | Prediksi | Pertanian | Lingkungan (lazy chunks, fetched when opened).
 * Phones: the panel sits under the map as a sheet with the same tabs (no collapse).
 */
import { lazy, Suspense, useEffect, useRef } from 'react'
import { ROLES } from '../../content/products'
import { Icon, IconButton, Skeleton, Tabs, flashNewRow, motionMode, type IconName } from '../../demo-kit/ui'
import { useShell } from '../../demo-kit/shell'
import { rows, useSession, useWorld, world } from '../../demo-kit/world'
import { Alerts } from './Alerts'
import { canSend, confirmedIds, floodAlerts, floodReports, harvestPasca, swRole } from './data'
import { useT, type SKey } from './strings'
import { openTab, runForecast } from './Timeline'
import { mapRef, ui, useUi, type TabId } from './ui'

const Forecast = lazy(() => import('./Forecast'))
const Agriculture = lazy(() => import('./Agriculture'))
const Environment = lazy(() => import('./Environment'))

const TABS: { id: TabId; label: SKey; icon: IconName }[] = [
  { id: 'alerts', label: 'tabAlerts', icon: 'alert' },
  { id: 'forecast', label: 'tabForecast', icon: 'chart' },
  { id: 'agri', label: 'tabAgri', icon: 'grid' },
  { id: 'env', label: 'tabEnv', icon: 'eye' },
]

export function Panel() {
  const { lang, t } = useT()
  const { size } = useShell()
  const role = swRole(useSession().role)
  const tab = useUi((s) => s.tab)
  const open = useUi((s) => s.panelOpen) || size === 'sm'
  const sm = size === 'sm'
  // phones: the tab strip may scroll sideways — keep the selected tab in view
  const tabsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!sm) return
    const el = tabsRef.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [tab, sm])

  if (!open)
    return (
      <nav className="dk-sg-rail" aria-label={t('panel')}>
        <IconButton icon="chevronRight" label={t('expand')} onClick={() => ui.set({ panelOpen: true })} />
        {TABS.map((x) => (
          <IconButton key={x.id} icon={x.icon} label={t(x.label)} variant={tab === x.id ? 'primary' : 'ghost'} onClick={() => ui.set({ panelOpen: true, tab: x.id })} />
        ))}
      </nav>
    )

  return (
    <aside className="dk-sg-panel" aria-label={t('panel')}>
      <header className="dk-sg-phead">
        <div>
          <p className="dk-sg-kicker">
            <Icon name="siaga" size={14} />
            {ROLES[role].name[lang]}
          </p>
          <h2 className="dk-sg-title">Siaga Wilayah</h2>
        </div>
        <div className="dk-sg-phead-act">
          <button type="button" className="dk-sg-chipbtn is-ai" onClick={() => ui.set({ aiOpen: true })} data-sw="ask-ai">
            <Icon name="spark" size={16} />
            {t('askAi')}
          </button>
          {size !== 'sm' && <IconButton icon="chevronLeft" label={t('collapse')} size="sm" onClick={() => ui.set({ panelOpen: false })} />}
        </div>
      </header>
      <Flow role={role} />
      <div ref={tabsRef} className="dk-sg-tabwrap">
        <Tabs items={TABS.map((x) => ({ id: x.id, label: t(sm && x.id === 'env' ? 'tabEnvShort' : x.label) }))} value={tab} onChange={(v) => ui.set({ tab: v })} label={t('tabs')} fill className="dk-sg-tabs">
          <Suspense fallback={<TabSkeleton />}>
            {tab === 'alerts' ? <Alerts /> : tab === 'forecast' ? <Forecast /> : tab === 'agri' ? <Agriculture /> : <Environment />}
          </Suspense>
        </Tabs>
      </div>
    </aside>
  )
}

function TabSkeleton() {
  return (
    <div className="dk-sg-skel" aria-busy="true">
      <Skeleton height={72} radius={14} />
      <Skeleton height={140} radius={14} />
      <Skeleton height={96} radius={14} />
    </div>
  )
}

/** bring a card of the (eager) Peringatan tab into view and flash it */
function flashCard(id: string): void {
  requestAnimationFrame(() => {
    const el = document.getElementById(id)?.closest<HTMLElement>('.dk-sg-card')
    if (!el) return
    el.scrollIntoView({ block: 'nearest', behavior: motionMode() === 'full' ? 'smooth' : 'auto' })
    flashNewRow(el)
  })
}

/** the 4-step morning flow; every step ticks from real state and DOES its step (never just "open the tab you are on") */
function Flow({ role }: { role: ReturnType<typeof swRole> }) {
  const { t } = useT()
  const { size } = useShell()
  const ran = useUi((s) => s.ran)
  const sent = useWorld((s) => floodAlerts(s).some((a) => !!a.broadcast))
  const conf = useWorld((s) => confirmedIds(s).size > 0)
  const pasca = useWorld(harvestPasca)
  const sm = size === 'sm'
  const steps: { k: SKey; done: boolean; act: () => void }[] = [
    {
      // 1: open Prediksi; before the first run it also starts the forecast
      k: 'step1',
      done: ran,
      act: () => {
        openTab('forecast', sm)
        if (!ui.get().ran) runForecast()
      },
    },
    {
      // 2: compose the warning when it can be sent now, else show the active-warning card
      k: 'step2',
      done: sent,
      act: () => {
        if (canSend(role) && ui.get().ran && !floodAlerts(world.get()).some((a) => !!a.broadcast)) return ui.set({ broadcastOpen: true })
        ui.set({ tab: 'alerts', panelOpen: true })
        flashCard('sw-al')
      },
    },
    {
      // 3: the citizen reports: card in view + flashed, reports layer on, map on the largest flood cluster
      k: 'step3',
      done: conf,
      act: () => {
        ui.set({ tab: 'alerts', panelOpen: true })
        ui.layer('reports', true)
        flashCard('sw-rp')
        const s = world.get()
        const cl = rows(s.clusters).filter((c) => c.category === 'banjir').sort((a, b) => b.complaintIds.length - a.complaintIds.length)[0]
        const at = cl?.center ?? floodReports(s)[0]?.coord
        if (at) mapRef.current?.flyTo(at, 12)
      },
    },
    { k: 'step4', done: pasca, act: () => openTab('agri', sm) },
  ]
  const next = steps.findIndex((s) => !s.done)
  return (
    <ol className="dk-sg-flow" aria-label={t('flow')}>
      {steps.map((s, i) => (
        <li key={s.k} className={s.done ? 'is-done' : i === next ? 'is-next' : ''}>
          <button type="button" onClick={s.act} aria-label
={`${i + 1}. ${t(s.k)}${s.done ? ` (${t('stepDone')})` : ''}`}>
            <span className="dk-sg-flow-n" aria-hidden="true">
              {s.done ? <Icon name="check" size={12} /> : i + 1}
            </span>
            <span className="dk-sg-flow-l">{t(s.k)}</span>
          </button>
        </li>
      ))}
    </ol>
  )
}
