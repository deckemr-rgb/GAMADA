/**
 * Tindak Lanjut tab (lazy). Every follow-up from meetings, letters and the Regional Head's instructions:
 * KPI strip, board per agency (kit Kanban, columns = OPD, late cards pulse red) or per status (cards glide between
 * columns: actionItem.statusChanged), and a deadline list (cards below 640 px). "Kirim pengingat" opens a WhatsApp
 * preview the AI drafts (Simulasi / Live) and sends actionItem.reminded. Kepala OPD sees its own agency only.
 * Phones: the board becomes a list per agency.
 */
import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { useShell } from '../../demo-kit/shell'
import { Badge, Button, Chip, EmptyState, Icon, Kanban, Kpi, Modal, Segmented, SlaLabel, StatusChip, flashNewRow, useMedia, type KanbanColumn } from '../../demo-kit/ui'
import { emit, useClock, useWorld, world, type ActionItem } from '../../demo-kit/world'
import { actionBoard } from '../../demo-kit/world/satu-daerah'
import { DAY_MIN } from '../../demo-kit/world/util'
import { structuredOf, useNaskahAi, type ReminderOut } from './ai'
import { buildCtx, ctxItem } from './ctx'
import { clockText, dueText, picLabel } from './model'
import type { NpNav } from './index'
import { opdLabel, useStr, type NpDict } from './strings'
import './followups.css'

type Lang = 'id' | 'en'
type Item = ActionItem & { late: boolean }
type View = 'opd' | 'status' | 'due'

const NEXT: Record<ActionItem['status'], ActionItem['status'] | null> = { baru: 'proses', proses: 'selesai', selesai: null }

export default function FollowUps({ nav, focusItem, focusOpd, focusKey }: { nav: NpNav; focusItem: string | null; focusOpd: string | null; focusKey: number }) {
  const S = useStr()
  const { lang } = useI18n()
  const now = useClock().minutes
  const day = useWorld((s) => s.day)
  const opds = useWorld((s) => s.region.opd)
  const board = useWorld((s) => actionBoard(s, now))
  const sm = useMedia('(max-width: 767px)')
  const [view, setView] = useState<View>('opd')
  const [lateOnly, setLateOnly] = useState(false)
  /* the segmented control / chip answer at once; the (heavier) board follows in a non-blocking render (INP) */
  const dView = useDeferredValue(view)
  const dLate = useDeferredValue(lateOnly)
  const stale = dView !== view || dLate !== lateOnly
  const [remind, setRemind] = useState<string | null>(null)
  const [pin, setPin] = useState<string | null>(null)
  const root = useRef<HTMLDivElement>(null)

  const cols = useMemo(() => (nav.myOpd ? board.filter((c) => c.opdId === nav.myOpd) : board), [board, nav.myOpd])
  const all = useMemo(() => cols.flatMap((c) => c.items), [cols])
  const items = useMemo(() => (dLate ? all.filter((i) => i.late) : all), [all, dLate])
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

  /* focus from the banner / a lane / a toast: show that agency (or item), flash it */
  useEffect(() => {
    if (!focusItem && !focusOpd) return
    if (focusItem && view === 'due') setView('opd')
    const id = focusItem
    const opd = focusOpd ?? (id ? world.get().actionItems.byId[id]?.opdId : null) ?? null
    setPin(opd)
    const raf = requestAnimationFrame(() => {
      const el = root.current
      if (!el) return
      const card = id ? el.querySelector<HTMLElement>(`[data-item="${CSS.escape(id)}"]`) : null
      const col = opd ? el.querySelector<HTMLElement>(`[data-col-opd="${CSS.escape(opd)}"]`) : null
      const firstOfOpd = !card && opd ? el.querySelector<HTMLElement>(`[data-opd="${CSS.escape(opd)}"]`) : null
      const target = card ?? col ?? firstOfOpd
      target?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
      const flashEl = card?.closest<HTMLElement>('.dk-kb-card, .dk-np-fcard') ?? col?.closest<HTMLElement>('.dk-np-fgroup') ?? firstOfOpd?.closest<HTMLElement>('.dk-kb-col') ?? null
      if (flashEl) flashNewRow(flashEl, { slide: false })
    })
    return () => cancelAnimationFrame(raf)
  }, [focusItem, focusOpd, focusKey]) // eslint-disable-line react-hooks/exhaustive-deps

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

  /* Sekretariat / Kepala Daerah remind the PIC; a Kepala OPD reminds the staff carrying out its own agency's task */
  const canRemind = true
  const renderCard = useCallback(
    (it: Item) => <Card it={it} S={S} lang={lang} day={day} now={now} opdName={name(it.opdId)} showOpd={dView !== 'opd'} canRemind={canRemind} onMove={move} onRemind={setRemind} />,
    [S, lang, day, now, name, dView, canRemind, move],
  )

  const opdColumns: KanbanColumn[] = useMemo(
    () =>
      cols
        .filter((c) => !dLate || c.items.some((i) => i.late))
        .sort((a, b) => Number(b.opdId === pin) - Number(a.opdId === pin))
        .map((c) => ({ id: c.opdId, title: name(c.opdId), tone: c.items.some((i) => i.late) ? 'danger' : 'neutral' })),
    [cols, dLate, name, pin],
  )
  const statusColumns: KanbanColumn[] = useMemo(
    () => [
      { id: 'baru', title: S.fStatus.baru, tone: 'neutral' },
      { id: 'proses', title: S.fStatus.proses, tone: 'warn' },
      { id: 'selesai', title: S.fStatus.selesai, tone: 'done' },
    ],
    [S],
  )
  const byOpd = useCallback((i: Item) => i.opdId, [])
  const byStatus = useCallback((i: Item) => i.status, [])
  const itemId = useCallback((i: Item) => i.id, [])
  const label = useCallback((i: Item) => i.title[lang], [lang])
  const target = remind ? (world.get().actionItems.byId[remind] ?? null) : null
  const boardEl = useMemo(
    () =>
      !items.length ? (
        <EmptyState art="chart" title={dLate ? S.fEmptyLate : S.fEmpty} compact />
      ) : dView === 'due' ? (
        <DueList items={items} S={S} lang={lang} day={day} now={now} name={name} canRemind={canRemind} onMove={move} onRemind={setRemind} />
      ) : sm && dView === 'opd' ? (
        <div className="dk-np-fgroups">
          {opdColumns.map((c) => {
            const list = items.filter((i) => i.opdId === c.id)
            return (
              <details key={c.id} className="dk-np-fgroup" open={list.some((i) => i.late) || c.id === (pin ?? nav.myOpd)}>
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
        <Kanban<Item> className="dk-np-kanban" columns={opdColumns} items={items} itemId={itemId} itemColumn={byOpd} itemLabel={label} renderCard={renderCard} label={S.fBoard} />
      ) : (
        <Kanban<Item> className="dk-np-kanban is-status" columns={statusColumns} items={items} itemId={itemId} itemColumn={byStatus} itemLabel={label} renderCard={renderCard} onMove={move} label={S.fBoard} />
      ),
    [items, dView, dLate, sm, S, lang, day, now, name, canRemind, move, opdColumns, statusColumns, pin, nav.myOpd, renderCard, itemId, byOpd, byStatus, label],
  )

  return (
    <div className="dk-np-follow" ref={root}>
      <p className="dk-np-lead dk-np-tablead">{S.fLead}</p>
      <div className="dk-np-kpis">
        <Kpi label={S.fOpen} value={k.open} hero />
        <Kpi label={S.fLate} value={k.late} />
        <Kpi label={S.fToday} value={k.today} />
        <Kpi label={S.fDone} value={k.done} />
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
      </div>

      <div className={`dk-np-fboard${stale ? ' is-stale' : ''}`} aria-busy={stale || undefined}>
        {boardEl}
      </div>

      {target && <Reminder item={target} onClose={() => setRemind(null)} name={name(target.opdId)} asOpd={nav.role === 'kepala-opd'} />}
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
}

function Card({ it, S, lang, day, now, opdName, showOpd, canRemind, onMove, onRemind }: CardProps) {
  const next = NEXT[it.status]
  return (
    <div className={`dk-np-item${it.late ? ' is-late' : ''}${it.status === 'selesai' ? ' is-done' : ''}`} data-item={it.id} data-opd={it.opdId} data-late={it.late || undefined}>
      {it.late && <span className="dk-np-pulse" aria-hidden="true" />}
      <p className="dk-np-item-t">{it.title[lang]}</p>
      <p className="dk-np-item-m">
        <Icon name="user" size={12} />
        {picLabel(it.pic, lang)}
        {showOpd && <span className="dk-np-item-opd">· {opdName}</span>}
      </p>
      <div className="dk-np-item-row">
        {it.status === 'selesai' ? <StatusChip label={S.fStatus.selesai} tone="done" /> : <SlaLabel minutesLeft={it.dueAt - now} />}
        <span className="dk-np-item-due dk-num">{dueText(it.dueAt, lang, day)}</span>
      </div>
      <div className="dk-np-item-row">
        <Badge>{S.fSrc[it.source.kind]}</Badge>
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
              <span className="dk-np-muted"> · {S.fSrc[it.source.kind]}</span>
            </span>
            <span role="cell" data-label={S.fOpd}>
              {name(it.opdId)}
            </span>
            <span role="cell" data-label={S.nPic}>
              {picLabel(it.pic, lang)}
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
  const to = asOpd ? S.wStaff(name) : picLabel(item.pic, lang)
  const from = asOpd ? S.wFromOpd(name) : S.wFromSetda
  const done = ai.last?.status === 'done' || ai.last?.status === 'error' || ai.last?.status === 'stopped'

  useEffect(() => {
    if (started.current) return
    started.current = true
    const s = world.get()
    void ai.ask(
      lang === 'id' ? 'Buat pesan pengingat WhatsApp untuk PIC tindak lanjut ini' : 'Draft a WhatsApp reminder to the person in charge of this follow-up',
      buildCtx(s, now, lang, 'reminder', { item: { ...ctxItem(s, item, now, lang), pic: to, from, dueAt: item.dueAt, nowAt: now } }),
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (done && !text) setText(out?.message ?? ai.last?.content ?? '')
  }, [done, out, ai.last, text])

  const send = () => {
    const msg = text.trim()
    if (!msg) return
    emit('actionItem.reminded', { actionItemId: item.id, channel: 'wa', text: { id: msg, en: msg } }, 'naskah-pintar')
    setSentAt(now)
    setEditing(false)
    shell.toast({ title: S.wToast(to), tone: 'accent', icon: 'send' })
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
          {done && sentAt === null && text.trim() && (
            <Button variant="primary" icon="send" onClick={send} data-np="send-reminder">
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
