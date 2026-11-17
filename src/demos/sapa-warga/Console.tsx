/**
 * demos/sapa-warga/Console.tsx — "Konsol Petugas": live KPIs, the omnichannel inbox (filters: channel, category,
 * status), the ticket Kanban (Baru → Diverifikasi → Diteruskan ke OPD → Diproses → Selesai, SLA timers in human
 * words), the cluster panel (lazy, with the mini map) and the ticket detail drawer (lazy). Every action is a world
 * event with source 'sapa-warga', so the citizen phone and the other products see it at once.
 */
import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { BrowserFrame } from '../../demo-kit/frames'
import { Button, Chip, EmptyState, Icon, Inbox, Kanban, Kpi, LiveBadge, Segmented, Select, SlaLabel, StatusChip, flashNewRow, type InboxItem, type KanbanColumn } from '../../demo-kit/ui'
import {
  CATEGORY_LABEL, DAY_MIN, avgRating, complaintKpi, emit, hhmm, shallowEqual, slaOnTimePct, useClock, useWorld,
  type ComplaintCategory, type ComplaintChannel, type TicketStatus, type WorldState,
} from '../../demo-kit/world'
import { consoleTickets, type ConsoleTicket } from '../../demo-kit/world/satu-daerah'
import { SLUG, type PersonaKey } from './model'
import { CHANNEL_LABEL, STATUS_LABEL, STATUS_ORDER, fill, useT } from './strings'

const ClusterPanel = lazy(() => import('./ClusterPanel'))

export type ConsoleView = 'inbox' | 'board' | 'cluster'
type ChannelF = 'all' | ComplaintChannel
type StatusF = 'open' | 'all' | TicketStatus

const CHANNEL_ICON: Record<ComplaintChannel, 'chat' | 'globe' | 'phone' | 'mic'> = { wa: 'chat', web: 'globe', telepon: 'phone', voice: 'mic' }
const statusTone = (s: TicketStatus) => (s === 'baru' ? 'new' : s === 'selesai' ? 'done' : 'neutral') as 'new' | 'done' | 'neutral'

export function when(at: number, now: number, t: { yesterday: string; daysAgo: string }): string {
  const day = Math.floor(now / DAY_MIN)
  const d = Math.floor(at / DAY_MIN)
  if (d === day) return hhmm(at).replace(':', '.')
  if (d === day - 1) return t.yesterday
  return fill(t.daysAgo, { n: day - d })
}

/* ------------------------------------------------------------------ KPIs */

const kpiSel = (now: number) => (s: WorldState) => {
  let open = 0
  let late = 0
  for (const id of s.tickets.ids) {
    const tk = s.tickets.byId[id]!
    if (tk.status === 'selesai') continue
    open++
    if (tk.slaDueAt < now) late++
  }
  const day = Math.floor(now / DAY_MIN) * DAY_MIN
  return {
    today: complaintKpi(s, now).today,
    delta: complaintKpi(s, now).delta,
    open,
    late,
    sla: slaOnTimePct(s),
    rating: avgRating(s),
    clusters: s.clusters.ids.filter((id) => (s.clusters.byId[id]?.updatedAt ?? -1) >= day).length,
  }
}

export const Kpis = memo(function Kpis({ now }: { now: number }) {
  const t = useT()
  const { lang } = useI18n()
  const sel = useMemo(() => kpiSel(now), [now])
  const k = useWorld(sel, shallowEqual)
  return (
    <div className="dk-sw-kpis" role="group" aria-label={`${t.kpiGroup} · ${t.simData}`} data-sw-drop-kpi="">
      <Kpi label={t.kToday} value={k.today} delta={k.delta} goodWhen="down" deltaLabel={t.vsYesterday} />
      <Kpi label={t.kOpen} value={k.open} />
      <Kpi label={t.kLate} value={k.late} className={k.late ? 'is-danger' : undefined} />
      <Kpi label={t.kSla} value={k.sla} unit="%" />
      <Kpi label={t.kRating} value={k.rating} decimals={1} unit="/5" format={(n) => n.toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} />
      <Kpi label={t.kClusters} value={k.clusters} />
    </div>
  )
})

/* ------------------------------------------------------------------ console */

export interface ConsoleProps {
  view: ConsoleView
  setView: (v: ConsoleView) => void
  openTicket: (ticketId: string) => void
  /** the ticket that just arrived from the phone (flash on the board) */
  arrived: { ticketId: string; code: string; n: number } | null
  /** mobile: the phone tab is hidden; offer the way back */
  onBackToPhone: (() => void) | null
  clusterNote: { id: string; n: number; place: string } | null
  focusCluster: string | null
  personaOf: (citizenId: string | null) => PersonaKey | null
  sm: boolean
}

export function Console({ view, setView, openTicket, arrived, onBackToPhone, clusterNote, focusCluster, personaOf, sm }: ConsoleProps) {
  const { lang } = useI18n()
  const t = useT()
  const { minutes: now } = useClock()
  const all = useWorld((s) => consoleTickets(s, now))
  const opds = useWorld((s) => s.region.opd)
  const [channel, setChannel] = useState<ChannelF>('all')
  const [cat, setCat] = useState<'all' | ComplaintCategory>('all')
  const [status, setStatus] = useState<StatusF>('open')

  const filtered = useMemo(
    () =>
      all.filter((r) => {
        if (channel !== 'all' && r.complaint.channel !== channel) return false
        if (cat !== 'all' && r.complaint.category !== cat) return false
        if (status === 'open' && r.ticket.status === 'selesai') return false
        if (status !== 'open' && status !== 'all' && r.ticket.status !== status) return false
        return true
      }),
    [all, channel, cat, status],
  )

  const inboxItems = useMemo<InboxItem[]>(
    () =>
      filtered.slice(0, 60).map((r) => {
        const p = personaOf(r.complaint.citizenId)
        return {
          id: r.ticket.id,
          title: `${r.complaint.code} · ${CATEGORY_LABEL[r.complaint.category][lang]}`,
          preview: r.complaint.summary[lang],
          time: when(r.complaint.at, now, t),
          unread: r.ticket.status === 'baru',
          from: r.citizen?.name,
          tone: r.ticket.status !== 'selesai' && r.slaLeft < 0 ? 'danger' : undefined,
          meta: (
            <>
              <StatusChip label={STATUS_LABEL[r.ticket.status][lang]} tone={statusTone(r.ticket.status)} />
              <SlaLabel minutesLeft={r.slaLeft} done={r.ticket.status === 'selesai'} />
              <span className="dk-sw-chan">
                <Icon name={CHANNEL_ICON[r.complaint.channel]} size={13} />
                {CHANNEL_LABEL[r.complaint.channel][lang]}
              </span>
              {r.complaint.lang !== 'id' && <span className="dk-sw-tag">{lang === 'id' ? 'Bahasa daerah' : 'Regional language'}</span>}
              {p && <span className="dk-sw-tag is-acc">{t.fromPersona}</span>}
            </>
          ),
        }
      }),
    [filtered, lang, now, t, personaOf],
  )

  /* board: open tickets + the ones resolved today */
  const day = Math.floor(now / DAY_MIN) * DAY_MIN
  const boardItems = useMemo(
    () => all.filter((r) => (r.ticket.status !== 'selesai' || (r.ticket.closedAt ?? -1) >= day) && (channel === 'all' || r.complaint.channel === channel) && (cat === 'all' || r.complaint.category === cat)),
    [all, channel, cat, day],
  )
  const columns = useMemo<KanbanColumn[]>(
    () => STATUS_ORDER.map((s) => ({ id: s, title: STATUS_LABEL[s][lang], tone: s === 'selesai' ? 'done' : 'neutral' })),
    [lang],
  )
  const renderCard = useCallback(
    (r: ConsoleTicket) => {
      const p = personaOf(r.complaint.citizenId)
      return (
        <div className="dk-sw-kcard">
          <div className="dk-sw-kcard-top">
            <b className="dk-num">{r.complaint.code}</b>
            <Icon name={CHANNEL_ICON[r.complaint.channel]} size={13} title={CHANNEL_LABEL[r.complaint.channel][lang]} />
          </div>
          <p>{r.complaint.summary[lang]}</p>
          <div className="dk-sw-kcard-foot">
            <SlaLabel minutesLeft={r.slaLeft} done={r.ticket.status === 'selesai'} />
            <span>
              {CATEGORY_LABEL[r.complaint.category][lang]}
              {r.ticket.status !== 'baru' && r.ticket.status !== 'diverifikasi' ? ` · ${opds.find((o) => o.id === r.ticket.opdId)?.short ?? r.ticket.opdId}` : ''}
            </span>
            {p && <span className="dk-sw-tag is-acc">{t.fromPersona}</span>}
          </div>
        </div>
      )
    },
    [lang, opds, personaOf, t],
  )
  const onMove = useCallback((id: string, to: string) => {
    const st = to as TicketStatus
    emit('ticket.statusChanged', { ticketId: id, status: st, ...(st === 'selesai' ? { note: 'Ditutup dari papan' } : {}) }, SLUG)
  }, [])
  const itemId = useCallback((r: ConsoleTicket) => r.ticket.id, [])
  const itemColumn = useCallback((r: ConsoleTicket) => r.ticket.status, [])
  const itemLabel = useCallback((r: ConsoleTicket) => r.complaint.code, [])
  const onOpenCard = useCallback((r: ConsoleTicket) => openTicket(r.ticket.id), [openTicket])

  /* a ticket from the phone lands on the board: accent flash */
  useEffect(() => {
    if (!arrived || view !== 'board') return
    const id = window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`.dk-sw-console [data-flip-id="${CSS.escape(arrived.ticketId)}"]`)
      if (el) flashNewRow(el)
    }, 420)
    return () => window.clearTimeout(id)
  }, [arrived, view])

  const resetFilters = () => {
    setChannel('all')
    setCat('all')
    setStatus('open')
  }
  const filtersOn = channel !== 'all' || cat !== 'all' || status !== 'open'
  const catOptions = useMemo(() => [{ value: 'all', label: t.allCat }, ...(Object.keys(CATEGORY_LABEL) as ComplaintCategory[]).map((c) => ({ value: c, label: CATEGORY_LABEL[c][lang] }))], [lang, t])
  const statusOptions = useMemo(() => [{ value: 'open', label: t.allOpen }, { value: 'all', label: t.all }, ...STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABEL[s][lang] }))], [lang, t])

  return (
    <BrowserFrame slug="sapa-warga/konsol" label={t.consoleFrame} className="dk-sw-console" dusk={!sm}>
      <div className="dk-sw-con">
        <header className="dk-sw-con-head">
          <div>
            <h2>{t.consoleHead}</h2>
            <p className="dk-sw-muted">
              {t.console} · {t.simData}
            </p>
          </div>
          <LiveBadge label={t.liveFeed} />
        </header>
        {onBackToPhone && arrived && (
          <div className="dk-sw-banner" role="status">
            <Icon name="checkCircle" size={16} />
            <span>
              {fill(t.newTicketIn, { code: arrived.code })}. {t.backToPhone}.
            </span>
            <Button size="sm" variant="secondary" icon="phone" onClick={onBackToPhone}>
              {t.backBtn}
            </Button>
          </div>
        )}
        {clusterNote && view !== 'cluster' && (
          <div className="dk-sw-banner is-cluster" role="status">
            <Icon name="map" size={16} />
            <span>{fill(t.clusterBanner, { n: clusterNote.n, place: clusterNote.place })}</span>
            <Button size="sm" variant="secondary" icon="map" onClick={() => setView('cluster')}>
              {t.clusterOpen}
            </Button>
          </div>
        )}
        <Kpis now={now} />
        <div className="dk-sw-toolbar">
          <Segmented
            label={t.views}
            value={view}
            onChange={setView}
            size="sm"
            options={[
              { value: 'inbox', label: t.viewInbox, icon: 'inbox' },
              { value: 'board', label: t.viewBoard, icon: 'kanban' },
              { value: 'cluster', label: t.viewCluster, icon: 'map' },
            ]}
          />
          {view !== 'cluster' && (
            <div className="dk-sw-filters">
              <label className="dk-sw-sel">
                <span className="dk-sr">{t.fCategory}</span>
                <Select aria-label={t.fCategory} value={cat} onChange={(e) => setCat(e.target.value as 'all' | ComplaintCategory)} options={catOptions} />
              </label>
              {view === 'inbox' && (
                <label className="dk-sw-sel">
                  <span className="dk-sr">{t.fStatus}</span>
                  <Select aria-label={t.fStatus} value={status} onChange={(e) => setStatus(e.target.value as StatusF)} options={statusOptions} />
                </label>
              )}
            </div>
          )}
          {view !== 'cluster' && (
            <div className="dk-sw-chans" role="group" aria-label={t.fChannel}>
              {(['all', 'wa', 'web', 'telepon', 'voice'] as ChannelF[]).map((c) => (
                <Chip key={c} selected={channel === c} onToggle={() => setChannel(c)} icon={c === 'all' ? undefined : CHANNEL_ICON[c]}>
                  {c === 'all' ? t.all : CHANNEL_LABEL[c][lang]}
                </Chip>
              ))}
            </div>
          )}
        </div>
        <div className="dk-sw-view" data-view={view}>
          {view === 'inbox' && (
            <div data-sw-drop="">
              <Inbox
                items={inboxItems}
                label={t.inboxLabel}
                onSelect={openTicket}
                empty={<EmptyState compact title={t.emptyInbox} body={t.emptyInboxBody} action={filtersOn ? { label: t.resetFilters, onClick: resetFilters, icon: 'refresh' } : undefined} />}
              />
            </div>
          )}
          {view === 'board' && (
            <div className="dk-sw-board" data-sw-drop="">
              <Kanban columns={columns} items={boardItems} itemId={itemId} itemColumn={itemColumn} itemLabel={itemLabel} renderCard={renderCard} onMove={onMove} onOpen={onOpenCard} label={t.boardLabel} />
            </div>
          )}
          {view === 'cluster' && (
            <Suspense fallback={<p className="dk-sw-muted">{t.mapLoading}</p>}>
              <ClusterPanel focus={focusCluster ?? clusterNote?.id ?? null} openTicket={openTicket} />
            </Suspense>
          )}
        </div>
      </div>
    </BrowserFrame>
  )
}
