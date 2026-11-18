/**
 * Tindak Lanjut tab (lazy). Every follow-up from meetings, letters and the Regional Head's instructions:
 * KPI strip, board per agency (kit Kanban, columns = OPD, late cards pulse red) or per status (cards glide between
 * columns: actionItem.statusChanged), and a deadline list (cards below 640 px). "Kirim pengingat" opens a WhatsApp
 * preview the AI drafts (Simulasi / Live) and sends actionItem.reminded. Kepala OPD sees its own agency only.
 * Phones: the board becomes a list per agency.
 */
import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '../../lib/i18n'
import { Link } from 'react-router'
import { demoHref, useShell } from '../../demo-kit/shell'
import { Badge, Button, Chip, EmptyState, Icon, IconButton, Kanban, Kpi, Modal, Segmented, SlaLabel, StatusChip, flashNewRow, motionMode, useMedia, type KanbanColumn } from '../../demo-kit/ui'
import { emit, useClock, useSession, useWorld, world, type ActionItem } from '../../demo-kit/world'
import { actionBoard } from '../../demo-kit/world/satu-daerah'
import { DAY_MIN } from '../../demo-kit/world/util'
import { structuredOf, useNaskahAi, type ReminderOut } from './ai'
import { buildCtx, ctxItem } from './ctx'
import { SCRIPT, clockText, dayText, dueText, picLabel, sampleMeeting } from './model'
import { pumpTasks } from './day'
import type { NpNav } from './index'
import { opdLabel, useStr, type NpDict } from './strings'
import './followups.css'

type Lang = 'id' | 'en'
type Item = ActionItem & { late: boolean }
type View = 'opd' | 'status' | 'due'

const NEXT: Record<ActionItem['status'], ActionItem['status'] | null> = { baru: 'proses', proses: 'selesai', selesai: null }

/** card order inside a lane / column: overdue, new, in progress, done; then by deadline */
const RANK = (i: Item) => (i.late ? 0 : i.status === 'baru' ? 1 : i.status === 'proses' ? 2 : 3)
const byRank = (a: Item, b: Item) => RANK(a) - RANK(b) || a.dueAt - b.dueAt

/** meeting follow-ups whose work continues in another product (the transcript names it): a link there */
const XLINK: Record<string, 'cek-berkas' | 'siaga-wilayah'> = { a3: 'cek-berkas', a4: 'siaga-wilayah' }

export default function FollowUps({ nav, focusItem, focusOpd, focusOpds, focusLate = false, focusKey }: { nav: NpNav; focusItem: string | null; focusOpd: string | null; focusOpds: readonly string[] | null; focusLate?: boolean; focusKey: number }) {
  const S = useStr()
  const { lang } = useI18n()
  const now = useClock().minutes
  const day = useWorld((s) => s.day)
  const opds = useWorld((s) => s.region.opd)
  const board = useWorld((s) => actionBoard(s, now))
  const session = useSession()
  /* the flood meeting's follow-ups that continue in Cek Berkas / Siaga Wilayah (item id → product) */
  const xItems = useWorld((s) => {
    const m = sampleMeeting(s)
    if (!m) return ''
    const out: string[] = []
    for (const id of m.actionItemIds) {
      const a = s.actionItems.byId[id]
      const key = a ? SCRIPT.actions.find((x) => x.text.id === a.title.id)?.key : undefined
      const slug = key ? XLINK[key] : undefined
      if (a && slug) out.push(`${a.id}=${slug}`)
    }
    return out.join('|')
  })
  const xlinks = useMemo(() => {
    const m = new Map<string, { href: string; slug: 'cek-berkas' | 'siaga-wilayah' }>()
    for (const pair of xItems ? xItems.split('|') : []) {
      const [id, slug] = pair.split('=') as [string, 'cek-berkas' | 'siaga-wilayah']
      m.set(id, { slug, href: demoHref(slug, session) })
    }
    return m
  }, [xItems, session])
  /* today's pump tasks are one matter (meeting follow-up 2, the Regent's memo, a pump letter): each card says so */
  const pumpIds = useWorld((s) => pumpTasks(s).map((a) => a.id).join('|'))
  const thread = useMemo(() => {
    const ids = pumpIds ? pumpIds.split('|') : []
    return ids.length > 1 ? new Map(ids.map((id) => [id, ids.length - 1])) : new Map<string, number>()
  }, [pumpIds])
  const sm = useMedia('(max-width: 767px)')
  /* a Kepala OPD has one agency: on a wide screen the status board says more than one full-width lane (phones keep
     the per-agency list, which already reads as one card list) */
  const [view, setView] = useState<View>(() => (nav.role === 'kepala-opd' && !window.matchMedia('(max-width: 767px)').matches ? 'status' : 'opd'))
  const [lateOnly, setLateOnly] = useState(false)
  const [showDone, setShowDone] = useState(false)
  /* the segmented control / chip answer at once; the (heavier) board follows in a non-blocking render (INP) */
  const dView = useDeferredValue(view)
  const dLate = useDeferredValue(lateOnly)
  const stale = dView !== view || dLate !== lateOnly
  const [remind, setRemind] = useState<string | null>(null)
  /** agencies brought to the front of the board by a jump (lane button, letter, instruction) */
  const [pin, setPin] = useState<readonly string[]>([])
  const root = useRef<HTMLDivElement>(null)
  /** a jump waiting for the board to render it: scroll + flash + focus once its lane is in the DOM */
  const landing = useRef<{ id: string | null; opd: string | null } | null>(null)

  const cols = useMemo(() => (nav.myOpd ? board.filter((c) => c.opdId === nav.myOpd) : board), [board, nav.myOpd])
  const all = useMemo(() => cols.flatMap((c) => c.items).sort(byRank), [cols])
  const items = useMemo(() => (dLate ? all.filter((i) => i.late) : all), [all, dLate])
  /* the same task given to the same agency again by a later meeting reads "assigned again · earlier <day>", so two
     cards with one title are not mistaken for a double entry */
  const again = useMemo(() => {
    const groups = new Map<string, Item[]>()
    for (const i of all) {
      const k = `${i.opdId}|${i.title.id}`
      const g = groups.get(k)
      if (g) g.push(i)
      else groups.set(k, [i])
    }
    const out = new Map<string, number>()
    for (const g of groups.values()) {
      if (g.length < 2) continue
      g.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
      for (let n = 1; n < g.length; n++) out.set(g[n]!.id, g[n - 1]!.createdAt)
    }
    return out
  }, [all])
  const k = useMemo(() => {
    const open = all.filter((i) => i.status !== 'selesai')
    return {
      open: open.length,
      late: open.filter((i) => i.late).length,
      today: open.filter((i) => !i.late && i.dueAt < DAY_MIN).length,
      done: all.length - open.length,
    }
  }, [all])
  const name = useCallback((id: string) => opdLabel(opds.find((o) => o.id === id), id, lang), [opds, lang])

  /* a jump from the banner / a lane / a letter / a toast: bring those agencies to the front, then land on the card */
  useEffect(() => {
    if (!focusItem && !focusOpd && !focusOpds?.length) return
    const opd = focusOpd ?? (focusItem ? world.get().actionItems.byId[focusItem]?.opdId : null) ?? focusOpds?.[0] ?? null
    const list = [...new Set([...(opd ? [opd] : []), ...(focusOpds ?? [])])]
    setPin(list)
    if (view === 'due' || (view === 'status' && !focusItem)) setView('opd')
    // the jump's agencies and card must be on the board: drop the overdue-only filter
    setLateOnly(false)
    landing.current = { id: focusItem, opd }
  }, [focusItem, focusOpd, focusOpds, focusKey]) // eslint-disable-line react-hooks/exhaustive-deps
  /* "Lihat yang lewat tenggat" from the Kepala Daerah desk: the overdue-only filter */
  useEffect(() => {
    if (!focusLate) return
    setLateOnly(true)
    setPin([])
    if (view !== 'opd' && view !== 'due') setView('opd')
  }, [focusLate, focusKey]) // eslint-disable-line react-hooks/exhaustive-deps

  /* after the render that shows the pinned lane: scroll the board to it, centre the card, flash and focus it */
  useLayoutEffect(() => {
    const land = landing.current
    const el = root.current
    if (!land || !el || stale) return
    const card = land.id ? el.querySelector<HTMLElement>(`[data-item="${CSS.escape(land.id)}"]`) : null
    const opd = land.opd
    const col = opd ? el.querySelector<HTMLElement>(`[data-col-opd="${CSS.escape(opd)}"]`) : null
    const firstOfOpd = !card && opd ? el.querySelector<HTMLElement>(`[data-opd="${CSS.escape(opd)}"]`) : null
    const target = card ?? firstOfOpd ?? col
    if (!target) return
    landing.current = null
    const kb = el.querySelector<HTMLElement>('.dk-np-kanban')
    const lane = target.closest<HTMLElement>('.dk-kb-col')
    if (kb && lane) kb.scrollLeft = Math.max(0, lane.offsetLeft - kb.offsetLeft - 8)
    const smooth = motionMode() === 'full'
    target.scrollIntoView({ block: card || firstOfOpd ? 'center' : 'nearest', inline: 'nearest', behavior: smooth ? 'smooth' : 'auto' })
    const flashEl = target.closest<HTMLElement>('.dk-kb-card, .dk-np-fcard') ?? col?.closest<HTMLElement>('.dk-np-fgroup') ?? null
    if (flashEl) flashNewRow(flashEl, { slide: false })
    // keyboard and screen-reader users land on the card too
    const focusEl = target.closest<HTMLElement>('.dk-kb-card') ?? (target.matches('[data-item]') ? target : null)
    if (focusEl) {
      if (!focusEl.hasAttribute('tabindex')) focusEl.tabIndex = -1
      focusEl.focus({ preventScroll: true })
    } else col?.focus({ preventScroll: true })
  })

  /* cards that appear while the board is open (instructions, letters, meetings) get the new-row highlight */
  const known = useRef<Set<string> | null>(null)
  useLayoutEffect(() => {
    const ids = all.map((i) => i.id)
    if (!known.current) {
      known.current = new Set(ids)
      return
    }
    for (const id of ids) {
      if (known.current.has(id)) continue
      known.current.add(id)
      const el = root.current?.querySelector<HTMLElement>(`[data-item="${CSS.escape(id)}"]`)
      const card = el?.closest<HTMLElement>('.dk-kb-card, .dk-np-fcard')
      if (card) flashNewRow(card)
    }
  })

  const move = useCallback((id: string, to: string) => {
    if (to === 'baru' || to === 'proses' || to === 'selesai') emit('actionItem.statusChanged', { actionItemId: id, status: to }, 'naskah-pintar')
  }, [])
  /* card buttons: let the pressed button paint first, then write the world (the whole board re-renders) (INP);
     the Kanban's own drag / keyboard moves keep the direct `move` for its FLIP */
  const moveSoon = useCallback((id: string, to: string) => {
    requestAnimationFrame(() => window.setTimeout(() => move(id, to), 0))
  }, [move])

  /* Sekretariat / Kepala Daerah remind the PIC; a Kepala OPD reminds the staff carrying out its own agency's task */
  const canRemind = true
  const renderCard = useCallback(
    (it: Item) => <Card it={it} S={S} lang={lang} day={day} now={now} opdName={name(it.opdId)} showOpd={dView !== 'opd'} canRemind={canRemind} onMove={moveSoon} onRemind={setRemind} again={again.get(it.id)} xlink={xlinks.get(it.id)} thread={thread.get(it.id)} />,
    [S, lang, day, now, name, dView, canRemind, moveSoon, again, xlinks, thread],
  )

  /* lanes: pinned first, then the ones with overdue work, open work, the newest item; lanes holding only finished
     work fold into one "N OPD tuntas" chip (unless pinned or shown) */
  const lanes = useMemo(() => {
    const rows = cols
      .filter((c) => !dLate || c.items.some((i) => i.late))
      .map((c) => {
        const open = c.items.filter((i) => i.status !== 'selesai').length
        return { c, open, late: c.items.filter((i) => i.late).length, newest: Math.max(...c.items.map((i) => i.createdAt)), pin: pin.indexOf(c.opdId) }
      })
    rows.sort((a, b) => (a.pin < 0 ? 99 : a.pin) - (b.pin < 0 ? 99 : b.pin) || b.late - a.late || b.open - a.open || b.newest - a.newest)
    const done = rows.filter((r) => r.open === 0 && r.pin < 0 && r.c.opdId !== nav.myOpd)
    const shown = showDone ? rows : rows.filter((r) => !done.includes(r))
    return { shown, done: done.length }
  }, [cols, dLate, pin, showDone, nav.myOpd])
  const opdColumns: KanbanColumn[] = useMemo(
    () => lanes.shown.map(({ c, late }) => ({ id: c.opdId, title: name(c.opdId), tone: late ? 'danger' : 'neutral' })),
    [lanes, name],
  )
  const statusColumns: KanbanColumn[] = useMemo(
    () => [
      { id: 'baru', title: S.fStatus.baru, tone: 'neutral' },
      { id: 'proses', title: S.fStatus.proses, tone: 'warn' },
      { id: 'selesai', title: S.fStatus.selesai, tone: 'done' },
    ],
    [S],
  )
  const shownIds = useMemo(() => new Set(opdColumns.map((c) => c.id)), [opdColumns])
  const laneItems = useMemo(() => items.filter((i) => shownIds.has(i.opdId)), [items, shownIds])
  const byOpd = useCallback((i: Item) => i.opdId, [])
  const byStatus = useCallback((i: Item) => i.status, [])
  const itemId = useCallback((i: Item) => i.id, [])
  const label = useCallback((i: Item) => i.title[lang], [lang])
  const target = remind ? (world.get().actionItems.byId[remind] ?? null) : null
  const empty = dLate ? (
    <EmptyState art="chart" title={S.fEmptyLate} compact action={{ label: S.fShowAll, icon: 'kanban', onClick: () => setLateOnly(false) }} />
  ) : (
    <EmptyState art="chart" title={S.fEmpty} compact action={{ label: S.mPlay, icon: 'play', onClick: () => nav.go('rapat') }} />
  )
  const boardEl = useMemo(
    () =>
      !items.length ? (
        empty
      ) : dView === 'due' ? (
        <DueList items={items} S={S} lang={lang} day={day} now={now} name={name} canRemind={canRemind} onMove={moveSoon} onRemind={setRemind} />
      ) : sm && dView === 'opd' ? (
        <div className="dk-np-fgroups">
          {opdColumns.map((c) => {
            const list = laneItems.filter((i) => i.opdId === c.id)
            return (
              <details key={c.id} className="dk-np-fgroup" open={list.some((i) => i.late) || pin.includes(c.id) || c.id === nav.myOpd}>
                <summary data-col-opd={c.id}>
                  <b>{c.title}</b>
                  <span className="dk-np-fgroup-n">
                    {list.some((i) => i.late) && <Badge tone="danger">{list.filter((i) => i.late).length}</Badge>}
                    {S.fCount(list.length)}
                  </span>
                </summary>
                <ul>
                  {list.map((it) => (
                    <li key={it.id} className="dk-np-fcard">
                      <span className="dk-flash" aria-hidden="true" />
                      {renderCard(it)}
                    </li>
                  ))}
                </ul>
              </details>
            )
          })}
        </div>
      ) : dView === 'opd' ? (
        <LaneBoard S={S} count={opdColumns.length}>
          <Kanban<Item> className="dk-np-kanban" columns={opdColumns} items={laneItems} itemId={itemId} itemColumn={byOpd} itemLabel={label} renderCard={renderCard} label={S.fBoard} />
        </LaneBoard>
      ) : (
        <Kanban<Item> className="dk-np-kanban is-status" columns={statusColumns} items={items} itemId={itemId} itemColumn={byStatus} itemLabel={label} renderCard={renderCard} onMove={move} moveButton={false} label={S.fBoard} />
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, laneItems, dView, dLate, sm, S, lang, day, now, name, canRemind, move, moveSoon, opdColumns, statusColumns, pin, nav.myOpd, renderCard, itemId, byOpd, byStatus, label],
  )

  return (
    <div className="dk-np-follow" ref={root}>
      <p className="dk-np-lead dk-np-tablead">{S.fLead}</p>
      <div className="dk-np-kpis">
        {/* change tags coloured by meaning: more overdue / open / due is bad news, more done is good */}
        <Kpi label={S.fLate} value={k.late} hero goodWhen="down" className={k.late > 0 ? 'dk-np-kpi-late' : undefined} />
        <Kpi label={S.fOpen} value={k.open} goodWhen="down" />
        <Kpi label={S.fToday} value={k.today} goodWhen="down" />
        <Kpi label={S.fDone} value={k.done} goodWhen="up" />
      </div>
      <div className="dk-np-ftools">
        <Segmented
          label={S.fView}
          value={view}
          onChange={setView}
          size="sm"
          options={[
            { value: 'opd', label: S.fByOpd, icon: 'building' },
            { value: 'status', label: S.fByStatus, icon: 'kanban' },
            { value: 'due', label: S.fByDue, icon: 'calendar' },
          ]}
        />
        <Chip icon="alert" tone={lateOnly ? 'danger' : 'neutral'} selected={lateOnly} onToggle={() => setLateOnly((v) => !v)}>
          {S.fLateOnly} ({k.late})
        </Chip>
        {view === 'opd' && (lanes.done > 0 || showDone) && (
          <Chip icon="checkCircle" selected={showDone} onToggle={() => setShowDone((v) => !v)}>
            {S.fDoneLanes(lanes.done)}
          </Chip>
        )}
      </div>

      <div className={`dk-np-fboard${stale ? ' is-stale' : ''}`} aria-busy={stale || undefined}>
        {boardEl}
      </div>

      {target && <Reminder item={target} onClose={() => setRemind(null)} name={name(target.opdId)} asOpd={nav.role === 'kepala-opd'} />}
    </div>
  )
}

/* ------------------------------------------------------------------ lane navigation */

/** the agency board with previous / next lane buttons, an edge fade and "Agencies 1–4 of 12" */
function LaneBoard({ S, count, children }: { S: NpDict; count: number; children: ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null)
  const [range, setRange] = useState<{ a: number; b: number; start: boolean; end: boolean }>({ a: 1, b: Math.min(count, 4), start: true, end: count <= 4 })
  const measure = useCallback(() => {
    const kb = wrap.current?.querySelector<HTMLElement>('.dk-np-kanban')
    if (!kb) return
    const colsEl = [...kb.querySelectorAll<HTMLElement>('.dk-kb-col')]
    const l = kb.scrollLeft
    const r = l + kb.clientWidth
    let a = 0
    let b = 0
    colsEl.forEach((c, i) => {
      const x0 = c.offsetLeft - kb.offsetLeft
      const x1 = x0 + c.offsetWidth
      if (x1 > l + 8 && x0 < r - 8) {
        if (!a) a = i + 1
        b = i + 1
      }
    })
    const next = { a: a || 1, b: b || Math.min(count, 1), start: l <= 2, end: r >= kb.scrollWidth - 2 }
    setRange((p) => (p.a === next.a && p.b === next.b && p.start === next.start && p.end === next.end ? p : next))
  }, [count])
  useLayoutEffect(() => {
    const kb = wrap.current?.querySelector<HTMLElement>('.dk-np-kanban')
    if (!kb) return
    measure()
    let raf = 0
    const on = () => {
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0
          measure()
        })
    }
    kb.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => {
      cancelAnimationFrame(raf)
      kb.removeEventListener('scroll', on)
      window.removeEventListener('resize', on)
    }
  }, [measure, count])
  const step = (dir: 1 | -1) => {
    const kb = wrap.current?.querySelector<HTMLElement>('.dk-np-kanban')
    const col = kb?.querySelector<HTMLElement>('.dk-kb-col')
    if (!kb || !col) return
    kb.scrollBy({ left: dir * (col.offsetWidth + 12), behavior: motionMode() === 'full' ? 'smooth' : 'auto' })
  }
  const scrolls = !(range.start && range.end)
  return (
    <div ref={wrap} className={`dk-np-laneboard${range.end ? '' : ' has-more'}${range.start ? '' : ' has-less'}`}>
      {scrolls && (
        <div className="dk-np-lanenav">
          <span className="dk-np-muted dk-num" aria-live="polite">
            {S.fLanesInfo(range.a, range.b, count)}
          </span>
          <IconButton icon="chevronLeft" label={S.fPrevLane} size="sm" onClick={() => step(-1)} disabled={range.start} />
          <IconButton icon="chevronRight" label={S.fNextLane} size="sm" onClick={() => step(1)} disabled={range.end} />
        </div>
      )}
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ card */

interface CardProps {
  it: Item
  S: NpDict
  lang: Lang
  day: string
  now: number
  opdName: string
  showOpd: boolean
  canRemind: boolean
  onMove: (id: string, to: string) => void
  onRemind: (id: string) => void
  /** created again after an identical task of the same agency (that one's creation time) */
  again?: number | undefined
  /** the work continues in another product (Cek Berkas / Siaga Wilayah) */
  xlink?: { href: string; slug: 'cek-berkas' | 'siaga-wilayah' } | undefined
  /** one matter with n other tasks of the day (the pumps) */
  thread?: number | undefined
}

function Card({ it, S, lang, day, now, opdName, showOpd, canRemind, onMove, onRemind, again, xlink, thread }: CardProps) {
  const next = NEXT[it.status]
  return (
    <div className={`dk-np-item${it.late ? ' is-late' : ''}${it.status === 'selesai' ? ' is-done' : ''}`} data-item={it.id} data-opd={it.opdId} data-late={it.late || undefined}>
      {it.late && <span className="dk-np-pulse" aria-hidden="true" />}
      <p className="dk-np-item-t">{it.title[lang]}</p>
      {again !== undefined && <p className="dk-np-item-again">{S.fAgain(dayText(again, lang, day))}</p>}
      {thread !== undefined && <p className="dk-np-item-again">{S.fThread(thread)}</p>}
      <p className="dk-np-item-m">
        <Icon name="user" size={12} />
        {picLabel(it.pic, lang, it.opdId)}
        {showOpd && <span className="dk-np-item-opd">· {opdName}</span>}
      </p>
      <div className="dk-np-item-row">
        {it.status === 'selesai' ? <StatusChip label={S.fStatus.selesai} tone="done" /> : <SlaLabel minutesLeft={it.dueAt - now} />}
        <span className="dk-np-item-due dk-num">{dueText(it.dueAt, lang, day)}</span>
      </div>
      <div className="dk-np-item-row">
        <Badge>
          {S.fSrc[it.source.kind]} · {dayText(it.createdAt, lang, day)}
        </Badge>
        {it.status !== 'selesai' && <StatusChip label={S.fStatus[it.status]} tone={it.status === 'proses' ? 'warn' : 'new'} />}
        {it.remindedAt != null && (
          <span className="dk-np-reminded">
            <Icon name="check" size={12} />
            {S.fReminded(clockText(it.remindedAt, lang))}
          </span>
        )}
      </div>
      <div className="dk-np-item-act">
        {next && (
          <Button size="sm" variant="quiet" icon={next === 'selesai' ? 'check' : 'play'} onClick={() => onMove(it.id, next)} data-np={`move-${next}`}>
            {next === 'selesai' ? S.fFinish : S.fStart}
          </Button>
        )}
        {canRemind && it.status !== 'selesai' && (
          <Button size="sm" variant={it.late ? 'secondary' : 'quiet'} icon="send" onClick={() => onRemind(it.id)} data-np="remind">
            {S.fRemind}
          </Button>
        )}
        {xlink && (
          <Link className="dk-np-xlink is-card" to={xlink.href} data-np={`x-${xlink.slug}`}>
            {S.fXlink[xlink.slug]}
            <Icon name="arrowRight" size={14} />
          </Link>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ deadline list */

function DueList({ items, S, lang, day, now, name, canRemind, onMove, onRemind }: { items: Item[]; S: NpDict; lang: Lang; day: string; now: number; name: (id: string) => string; canRemind: boolean; onMove: (id: string, to: string) => void; onRemind: (id: string) => void }) {
  const rows = [...items].sort((a, b) => Number(a.status === 'selesai') - Number(b.status === 'selesai') || a.dueAt - b.dueAt)
  return (
    <div className="dk-np-due" role="table" aria-label={S.fByDue}>
      <div className="dk-np-due-r is-head" role="row">
        <span role="columnheader">{S.fItem}</span>
        <span role="columnheader">{S.fOpd}</span>
        <span role="columnheader">{S.nPic}</span>
        <span role="columnheader">{S.nDue}</span>
        <span role="columnheader">{S.nStatus}</span>
        <span role="columnheader">{S.fAction}</span>
      </div>
      {rows.map((it) => {
        const next = NEXT[it.status]
        return (
          <div key={it.id} role="row" className={`dk-np-due-r dk-np-fcard${it.late ? ' is-late' : ''}`} data-item={it.id}>
            <span className="dk-flash" aria-hidden="true" />
            <span role="cell" className="dk-np-due-t">
              <b>{it.title[lang]}</b>
              <span className="dk-np-muted">
                {' '}
                · {S.fSrc[it.source.kind]} · {dayText(it.createdAt, lang, day)}
              </span>
            </span>
            <span role="cell" data-label={S.fOpd}>
              {name(it.opdId)}
            </span>
            <span role="cell" data-label={S.nPic}>
              {picLabel(it.pic, lang, it.opdId)}
            </span>
            <span role="cell" data-label={S.nDue} className="dk-num dk-np-due-d">
              {dueText(it.dueAt, lang, day)} {it.status !== 'selesai' && <SlaLabel minutesLeft={it.dueAt - now} />}
            </span>
            <span role="cell" data-label={S.nStatus}>
              <StatusChip label={S.fStatus[it.status]} tone={it.status === 'selesai' ? 'done' : it.status === 'proses' ? 'warn' : 'new'} />
            </span>
            <span role="cell" className="dk-np-due-act">
              {next && (
                <Button size="sm" variant="quiet" icon={next === 'selesai' ? 'check' : 'play'} onClick={() => onMove(it.id, next)}>
                  {next === 'selesai' ? S.fFinish : S.fStart}
                </Button>
              )}
              {canRemind && it.status !== 'selesai' && (
                <Button size="sm" variant="quiet" icon="send" onClick={() => onRemind(it.id)} data-np="remind">
                  {S.fRemind}
                </Button>
              )}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ WhatsApp reminder */

function Reminder({ item, onClose, name, asOpd }: { item: ActionItem; onClose: () => void; name: string; asOpd: boolean }) {
  const S = useStr()
  const { lang } = useI18n()
  const shell = useShell()
  const now = useClock().minutes
  const ai = useNaskahAi()
  const [text, setText] = useState('')
  const [editing, setEditing] = useState(false)
  const [sentAt, setSentAt] = useState<number | null>(null)
  const started = useRef(false)
  const out = structuredOf<ReminderOut>(ai.last, 'reminder')
  /* who receives / signs: the PIC from the Secretariat, or (Kepala OPD) the agency's own implementing staff */
  const to = asOpd ? S.wStaff(name) : picLabel(item.pic, lang, item.opdId)
  const from = asOpd ? S.wFromOpd(name) : S.wFromSetda
  const done = ai.last?.status === 'done' || ai.last?.status === 'error' || ai.last?.status === 'stopped'
  /* Send pressed while the AI is still typing: finish the draft at once (kit flush), then send it */
  const [sendWhenDone, setSendWhenDone] = useState(false)

  /* the AI draft starts after the modal's first paint, so opening it answers at once (INP) */
  useEffect(() => {
    if (started.current) return
    let t = 0
    const raf = requestAnimationFrame(() => {
      t = window.setTimeout(() => {
        if (started.current) return
        started.current = true
        const s = world.get()
        void ai.ask(
          lang === 'id' ? 'Buat pesan pengingat WhatsApp untuk PIC tindak lanjut ini' : 'Draft a WhatsApp reminder to the person in charge of this follow-up',
          buildCtx(s, now, lang, 'reminder', { item: { ...ctxItem(s, item, now, lang), pic: to, from, dueAt: item.dueAt, nowAt: now } }),
        )
      }, 0)
    })
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(t)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (done && !text) setText(out?.message ?? ai.last?.content ?? '')
  }, [done, out, ai.last, text])

  useEffect(() => {
    if (sendWhenDone && done && text.trim()) {
      setSendWhenDone(false)
      send()
    }
  }) // eslint-disable-line react-hooks/exhaustive-deps
  const send = () => {
    if (!done) {
      setSendWhenDone(true)
      ai.flush()
      return
    }
    const msg = text.trim()
    if (!msg) return
    setSentAt(now)
    setEditing(false)
    // the bubble's "sent" tick answers at once; the world write (the board re-renders) and the toast follow the paint
    requestAnimationFrame(() =>
      window.setTimeout(() => {
        emit('actionItem.reminded', { actionItemId: item.id, channel: 'wa', text: { id: msg, en: msg } }, 'naskah-pintar')
        shell.toast({ title: S.wToast(to), tone: 'accent', icon: 'send' })
      }, 0),
    )
  }

  const masked = `+62 8${(item.id.length * 7) % 10}${(item.id.charCodeAt(item.id.length - 1) % 9) + 1}-xxxx-${String(1000 + ((item.id.charCodeAt(0) * 37) % 9000)).slice(0, 4)}`
  const shown = done ? text : (ai.last?.content ?? '')
  return (
    <Modal
      open
      onClose={onClose}
      title={S.wTitle}
      size="sm"
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            {S.wClose}
          </Button>
          {/* the send button is there from the first paint; it is enabled once the AI draft is complete */}
          {sentAt === null && (
            <Button variant="primary" icon="send" onClick={send} disabled={done && !text.trim()} busy={sendWhenDone} data-np="send-reminder">
              {S.wSend}
            </Button>
          )}
        </>
      }
    >
      <div className="dk-np-wa">
        <header className="dk-np-wa-h">
          <span className="dk-np-wa-av" aria-hidden="true">
            <Icon name="user" size={18} />
          </span>
          <span>
            <b>{to}</b>
            <small>
              {name} · {masked} ({S.wNumber})
            </small>
          </span>
        </header>
        <div className="dk-np-wa-body" aria-live="polite" aria-label={S.wPreview}>
          {!ai.last || ai.last.status === 'thinking' ? (
            <p className="dk-np-wa-bubble is-wait">
              <span className="dk-np-dots" aria-label={S.wDrafting}>
                <i />
                <i />
                <i />
              </span>
            </p>
          ) : editing ? (
            <textarea className="dk-np-textarea" rows={6} value={text} onChange={(e) => setText(e.target.value)} aria-label={S.wEdit} />
          ) : (
            <p className="dk-np-wa-bubble">
              {shown}
              <span className="dk-np-wa-meta dk-num">
                {clockText(sentAt ?? now, lang)}
                {sentAt !== null && <Icon name="check" size={12} />}
              </span>
            </p>
          )}
          {sentAt !== null && (
            <p className="dk-np-done" role="status">
              <Icon name="checkCircle" size={16} />
              {S.wSent(clockText(sentAt, lang))}
            </p>
          )}
        </div>
        <p className="dk-np-wa-foot">
          {ai.last?.status === 'done' && <Badge tone={ai.last.mode === 'live' ? 'accent' : 'neutral'}>{S.lAiMode[ai.last.mode ?? 'sim']}</Badge>}
          {done && sentAt === null && (
            <Button size="sm" variant="quiet" icon="edit" onClick={() => setEditing((e) => !e)} aria-pressed={editing}>
              {S.wEdit}
            </Button>
          )}
        </p>
      </div>
    </Modal>
  )
}
