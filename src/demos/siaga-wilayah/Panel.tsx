/**
 * siaga-wilayah/Panel.tsx — the collapsible left panel: title + role, the morning flow (4 steps that tick from the
 * world), and the tabs Peringatan (eager) | Prediksi | Pertanian | Lingkungan (lazy chunks, fetched when opened).
 * Phones: the panel sits under the map as a sheet with the same tabs (no collapse).
 */
import { lazy, Suspense } from 'react'
import { ROLES } from '../../content/products'
import { Icon, IconButton, Skeleton, Tabs, type IconName } from '../../demo-kit/ui'
import { useShell } from '../../demo-kit/shell'
import { useSession, useWorld } from '../../demo-kit/world'
import { Alerts } from './Alerts'
import { confirmedIds, floodAlerts, harvestPasca, swRole } from './data'
import { useT, type SKey } from './strings'
import { ui, useUi, type TabId } from './ui'

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

  if (!open)
    return (
      <nav className="dk-sw-rail" aria-label={t('panel')}>
        <IconButton icon="chevronRight" label={t('expand')} onClick={() => ui.set({ panelOpen: true })} />
        {TABS.map((x) => (
          <IconButton key={x.id} icon={x.icon} label={t(x.label)} variant={tab === x.id ? 'primary' : 'ghost'} onClick={() => ui.set({ panelOpen: true, tab: x.id })} />
        ))}
      </nav>
    )

  return (
    <aside className="dk-sw-panel" aria-label={t('panel')}>
      <header className="dk-sw-phead">
        <div>
          <p className="dk-sw-kicker">
            <Icon name="siaga" size={14} />
            {ROLES[role].name[lang]}
          </p>
          <h2 className="dk-sw-title">Siaga Wilayah</h2>
        </div>
        <div className="dk-sw-phead-act">
          <button type="button" className="dk-sw-chipbtn is-ai" onClick={() => ui.set({ aiOpen: true })} data-sw="ask-ai">
            <Icon name="spark" size={16} />
            {t('askAi')}
          </button>
          {size !== 'sm' && <IconButton icon="chevronLeft" label={t('collapse')} size="sm" onClick={() => ui.set({ panelOpen: false })} />}
        </div>
      </header>
      <Flow />
      <Tabs items={TABS.map((x) => ({ id: x.id, label: t(x.label), }))} value={tab} onChange={(v) => ui.set({ tab: v })} label={t('tabs')} fill className="dk-sw-tabs">
        <Suspense fallback={<TabSkeleton />}>
          {tab === 'alerts' ? <Alerts /> : tab === 'forecast' ? <Forecast /> : tab === 'agri' ? <Agriculture /> : <Environment />}
        </Suspense>
      </Tabs>
    </aside>
  )
}

function TabSkeleton() {
  return (
    <div className="dk-sw-skel" aria-busy="true">
      <Skeleton height={72} radius={14} />
      <Skeleton height={140} radius={14} />
      <Skeleton height={96} radius={14} />
    </div>
  )
}

/** the 4-step morning flow; every step ticks from real state and opens its tab */
function Flow() {
  const { t } = useT()
  const ran = useUi((s) => s.ran)
  const sent = useWorld((s) => floodAlerts(s).some((a) => !!a.broadcast))
  const conf = useWorld((s) => confirmedIds(s).size > 0)
  const pasca = useWorld(harvestPasca)
  const steps: { k: SKey; done: boolean; tab: TabId }[] = [
    { k: 'step1', done: ran, tab: 'forecast' },
    { k: 'step2', done: sent, tab: 'alerts' },
    { k: 'step3', done: conf, tab: 'alerts' },
    { k: 'step4', done: pasca, tab: 'agri' },
  ]
  const next = steps.findIndex((s) => !s.done)
  return (
    <ol className="dk-sw-flow" aria-label={t('flow')}>
      {steps.map((s, i) => (
        <li key={s.k} className={s.done ? 'is-done' : i === next ? 'is-next' : ''}>
          <button type="button" onClick={() => ui.set({ tab: s.tab })} aria-label={`${i + 1}. ${t(s.k)}${s.done ? ` (${t('stepDone')})` : ''}`}>
            <span className="dk-sw-flow-n" aria-hidden="true">
              {s.done ? <Icon name="check" size={12} /> : i + 1}
            </span>
            <span className="dk-sw-flow-l">{t(s.k)}</span>
          </button>
        </li>
      ))}
    </ol>
  )
}
