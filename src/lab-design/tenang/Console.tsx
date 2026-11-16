/**
 * 02 · KPI strip + 03 · ticket inbox, framed as one operations console (they share state: a new
 * ticket bumps "Complaints today" live). Keyboard: J/K or arrows move, Enter opens, N simulates.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { gsap } from 'gsap'
import { EASE } from '../../lib/motion'
import { useI18n, type Lang } from '../../lib/i18n'
import { KPIS, NEW_TICKET, SERIES, STATUS_LABEL, TICKETS, type TicketRow, type TicketStatus } from '../sample'
import { Icon, Kbd, SectionHead, TT, fmt, motionMode, useFirstView, useGsap, useVisible } from './shared'

const C = {
  id: {
    kpiTitle: 'Strip KPI',
    kpiLead: 'Angka bergulir saat pertama terlihat dan saat data berubah. Delta dibanding kemarin.',
    inboxTitle: 'Kotak masuk tiket',
    inboxLead: 'Tabel padat dengan panel detail terpisah. Coba papan ketik: J/K untuk pindah, Enter untuk membuka.',
    crumbs: ['Ekosistem', 'Satu Daerah', 'Sapa Warga'],
    demo: 'Mode demo',
    vsYesterday: 'vs kemarin',
    inbox: 'Kotak masuk',
    tickets: 'tiket',
    late: 'terlambat',
    fresh: 'baru',
    simulate: 'Simulasikan tiket baru',
    reset: 'Hapus tiket simulasi',
    density: 'Kepadatan baris',
    compact: 'Padat',
    comfy: 'Nyaman',
    cols: ['Tiket', 'Kanal', 'Kategori', 'Kecamatan', 'OPD', 'Status', 'Sisa SLA'],
    move: 'pindah',
    open: 'buka',
    newKey: 'tiket baru',
    channel: 'Kanal',
    kec: 'Kecamatan',
    opd: 'OPD tujuan',
    sla: 'Sisa SLA',
    progress: 'Alur status',
    step: 'Langkah',
    advance: 'Majukan ke',
    reopen: 'Buka kembali',
    lateWord: 'Terlambat',
    done: 'Tuntas',
    announceNew: (t: TicketRow) => `Tiket baru ${t.id}: ${t.category.id}, ${t.kecamatan}.`,
    announceStatus: (id: string, s: string) => `${id} sekarang ${s}.`,
    detail: 'Detail tiket',
    phone: 'Telepon',
  },
  en: {
    kpiTitle: 'KPI strip',
    kpiLead: 'Numbers count up on first view and whenever the data changes. Delta is vs yesterday.',
    inboxTitle: 'Ticket inbox',
    inboxLead: 'A dense table with a split detail pane. Try the keyboard: J/K to move, Enter to open.',
    crumbs: ['Ecosystem', 'Satu Daerah', 'Sapa Warga'],
    demo: 'Demo mode',
    vsYesterday: 'vs yesterday',
    inbox: 'Inbox',
    tickets: 'tickets',
    late: 'late',
    fresh: 'new',
    simulate: 'Simulate new ticket',
    reset: 'Remove simulated ticket',
    density: 'Row density',
    compact: 'Compact',
    comfy: 'Comfortable',
    cols: ['Ticket', 'Channel', 'Category', 'District', 'Agency', 'Status', 'SLA left'],
    move: 'move',
    open: 'open',
    newKey: 'new ticket',
    channel: 'Channel',
    kec: 'District',
    opd: 'Assigned agency',
    sla: 'SLA left',
    progress: 'Status flow',
    step: 'Step',
    advance: 'Advance to',
    reopen: 'Reopen',
    lateWord: 'Late',
    done: 'Done',
    announceNew: (t: TicketRow) => `New ticket ${t.id}: ${t.category.en}, ${t.kecamatan}.`,
    announceStatus: (id: string, s: string) => `${id} is now ${s}.`,
    detail: 'Ticket detail',
    phone: 'Phone',
  },
}

const FLOW: TicketStatus[] = ['baru', 'verifikasi', 'opd', 'proses', 'selesai']
const pad = (n: number) => String(n).padStart(2, '0')

function sla(row: TicketRow, secsElapsed: number): { txt: string; tone: 'ok' | 'warn' | 'late' | 'done' } {
  if (row.status === 'selesai') return { txt: '—', tone: 'done' }
  const secs = row.slaHours * 3600 - secsElapsed
  const a = Math.abs(secs)
  const txt = `${secs < 0 ? '−' : ''}${pad(Math.floor(a / 3600))}:${pad(Math.floor((a % 3600) / 60))}:${pad(Math.floor(a % 60))}`
  return { txt, tone: secs < 0 ? 'late' : secs < 8 * 3600 ? 'warn' : 'ok' }
}

export function StatusChip({ s, lang }: { s: TicketStatus; lang: Lang }) {
  return (
    <span className={`ldt-status ldt-status--${s}`}>
      <i aria-hidden="true" />
      {STATUS_LABEL[s][lang]}
    </span>
  )
}

/* ---------------------------------------------------------------- KPI */

function useCountUp(ref: RefObject<HTMLElement | null>, value: number, digits: number, lang: Lang, started: boolean) {
  const cur = useRef({ v: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const write = () => {
      el.textContent = fmt(lang, cur.current.v, digits)
    }
    if (motionMode() !== 'full') {
      cur.current.v = value
      write()
      return
    }
    if (!started) {
      write()
      return
    }
    const tw = gsap.to(cur.current, { v: value, duration: TT.countUp, ease: 'power2.out', onUpdate: write })
    return () => {
      tw.kill()
    }
  }, [ref, value, digits, lang, started])
}

type Kpi = (typeof KPIS)[number]

function Spark({ data }: { data: number[] }) {
  const w = 72
  const h = 22
  const min = Math.min(...data)
  const max = Math.max(...data)
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 2 - ((v - min) / (max - min || 1)) * (h - 4)] as const)
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const last = pts[pts.length - 1]
  return (
    <svg className="ldt-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" focusable="false">
      <path d={d} />
      {last && <circle cx={last[0]} cy={last[1]} r="2" />}
    </svg>
  )
}

function KpiCell({ k, value, delta, started, flash, spark, lang }: { k: Kpi; value: number; delta: number; started: boolean; flash: number; spark?: number[]; lang: Lang }) {
  const c = C[lang]
  const numRef = useRef<HTMLSpanElement>(null)
  const deltaRef = useRef<HTMLSpanElement>(null)
  const flashRef = useRef<HTMLSpanElement>(null)
  const plusRef = useRef<HTMLSpanElement>(null)
  const barRef = useRef<HTMLSpanElement>(null)
  const run = useGsap()
  const digits = Number.isInteger(k.value) ? 0 : 1
  useCountUp(numRef, value, digits, lang, started)
  useCountUp(deltaRef, Math.abs(delta), Number.isInteger(k.delta) ? 0 : 1, lang, started)
  const bar = k.unit === '%' ? value / 100 : k.unit === '/100' ? value / 100 : null

  useLayoutEffect(() => {
    const el = barRef.current
    if (!el || bar === null) return
    if (motionMode() !== 'full') {
      gsap.set(el, { scaleX: bar })
      return
    }
    if (!started) {
      gsap.set(el, { scaleX: 0 })
      return
    }
    let tw: gsap.core.Tween | undefined
    run(() => {
      tw = gsap.to(el, { scaleX: bar, duration: TT.countUp, ease: 'power2.out' })
    })
    return () => {
      tw?.kill()
    }
  }, [bar, started, run])

  useEffect(() => {
    if (!flash || !flashRef.current || !plusRef.current) return
    const reduced = motionMode() !== 'full'
    const held: { tl?: gsap.core.Timeline } = {}
    run(() => {
      const tl = gsap.timeline()
      tl.fromTo(flashRef.current, { opacity: 1 }, reduced ? { opacity: 0, duration: TT.reduced, delay: TT.rowFlash - TT.reduced } : { opacity: 0, duration: TT.rowFlash, ease: 'power1.in' })
      if (!reduced) {
        tl.fromTo(numRef.current, { yPercent: 45, opacity: 0.2 }, { yPercent: 0, opacity: 1, duration: TT.panel, ease: EASE.out }, 0)
        tl.fromTo(plusRef.current, { opacity: 0, y: 6 }, { opacity: 1, y: -2, duration: 0.24, ease: EASE.out }, 0)
        tl.to(plusRef.current, { opacity: 0, y: -10, duration: 0.5, ease: 'power1.in' }, 0.9)
      }
      held.tl = tl
    })
    return () => {
      held.tl?.kill()
      gsap.set([flashRef.current, plusRef.current], { opacity: 0 })
      gsap.set(numRef.current, { clearProps: 'transform,opacity' })
    }
  }, [flash, run])

  const up = delta > 0
  return (
    <div className="ldt-kpi" role="group" aria-label={`${k.label[lang]}: ${fmt(lang, value, digits)}${k.unit}`}>
      <span className="ldt-kpi-flash" ref={flashRef} aria-hidden="true" />
      <span className="ldt-kpi-label">{k.label[lang]}</span>
      <div className="ldt-kpi-row" aria-hidden="true">
        <span className="ldt-kpi-val">
          <span ref={numRef} />
          {k.unit && <small>{k.unit}</small>}
          <span className="ldt-kpi-plus" ref={plusRef}>
            +1
          </span>
        </span>
        {spark && <Spark data={spark} />}
      </div>
      {bar !== null && (
        <span className="ldt-kpi-bar" aria-hidden="true">
          <span ref={barRef} />
        </span>
      )}
      <span className={`ldt-kpi-delta ${k.good ? 'is-good' : 'is-bad'}`}>
        <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true" focusable="false" style={{ transform: up ? undefined : 'rotate(180deg)' }}>
          <path d="M4 1 7.2 6.5H.8Z" fill="currentColor" />
        </svg>
        <span ref={deltaRef} />
        {k.unit === '%' ? ' pp' : ''}
        <span className="ldt-kpi-vs">{c.vsYesterday}</span>
      </span>
    </div>
  )
}

/* ---------------------------------------------------------------- console */

export default function Console() {
  const { lang } = useI18n()
  const c = C[lang]
  const mode = motionMode()
  const rootRef = useRef<HTMLElement>(null)
  const kpiRef = useRef<HTMLDivElement>(null)
  const detailRef = useRef<HTMLDivElement>(null)
  const detailInner = useRef<HTMLDivElement>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  const rowEls = useRef(new Map<string, HTMLDivElement>())
  const flashEls = useRef(new Map<string, HTMLSpanElement>())
  const flip = useRef<{ tops: Map<string, number>; added?: string } | null>(null)
  const born = useRef(new Map<string, number>())
  const run = useGsap()

  const [rows, setRows] = useState<TicketRow[]>(TICKETS)
  const [activeId, setActiveId] = useState(TICKETS[0]!.id)
  const [openId, setOpenId] = useState(TICKETS[0]!.id)
  const [density, setDensity] = useState<'compact' | 'comfy'>('compact')
  const [elapsed, setElapsed] = useState(0)
  const [kpiStarted, setKpiStarted] = useState(mode !== 'full')
  const [kpiFlash, setKpiFlash] = useState(0)
  const [announce, setAnnounce] = useState('')
  const visible = useVisible(rootRef)

  const hasNew = rows.some((r) => r.id === NEW_TICKET.id)
  useFirstView(kpiRef, () => setKpiStarted(true), 0.4)

  /* SLA clock: one tick per second while the console is on screen. */
  useEffect(() => {
    if (mode === 'static' || !visible) return
    let call = gsap.delayedCall(1, function tick() {
      setElapsed((e) => e + 1)
      call = gsap.delayedCall(1, tick)
    })
    return () => {
      call.kill()
    }
  }, [mode, visible])

  /* FLIP after insert/remove: existing rows glide, the new one drops in 8 px + accent flash. */
  useLayoutEffect(() => {
    const f = flip.current
    if (!f) return
    flip.current = null
    const reduced = mode !== 'full'
    run(() => {
      rowEls.current.forEach((el, id) => {
        if (id === f.added) return
        const before = f.tops.get(id)
        if (before === undefined) return
        const dy = before - el.getBoundingClientRect().top
        if (dy && !reduced) gsap.fromTo(el, { y: dy }, { y: 0, duration: TT.panel, ease: EASE.out })
      })
      if (f.added) {
        const el = rowEls.current.get(f.added)
        const fl = flashEls.current.get(f.added)
        if (el) {
          if (reduced) gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: TT.reduced })
          else gsap.fromTo(el, { y: -8, opacity: 0 }, { y: 0, opacity: 1, duration: TT.panel, ease: EASE.out })
        }
        if (fl) {
          if (reduced) gsap.fromTo(fl, { opacity: 1 }, { opacity: 0, duration: TT.reduced, delay: TT.rowFlash - TT.reduced })
          else gsap.fromTo(fl, { opacity: 1 }, { opacity: 0, duration: TT.rowFlash, ease: 'power1.in' })
        }
      }
    })
  }, [rows, mode, run])

  const captureTops = () => {
    const tops = new Map<string, number>()
    rowEls.current.forEach((el, id) => tops.set(id, el.getBoundingClientRect().top))
    return tops
  }

  const simulate = useCallback(() => {
    if (rows.some((r) => r.id === NEW_TICKET.id)) return
    flip.current = { tops: captureTops(), added: NEW_TICKET.id }
    born.current.set(NEW_TICKET.id, elapsed)
    setRows((r) => [{ ...NEW_TICKET }, ...r])
    setKpiFlash((n) => n + 1)
    setAnnounce(c.announceNew(NEW_TICKET))
  }, [rows, elapsed, c])

  const removeSim = useCallback(() => {
    const doRemove = () => {
      flip.current = { tops: captureTops() }
      setRows((r) => r.filter((x) => x.id !== NEW_TICKET.id))
      if (openId === NEW_TICKET.id) setOpenId(TICKETS[0]!.id)
      if (activeId === NEW_TICKET.id) setActiveId(TICKETS[0]!.id)
    }
    const el = rowEls.current.get(NEW_TICKET.id)
    if (el && mode === 'full') run(() => gsap.to(el, { opacity: 0, y: -4, duration: TT.press, ease: 'power1.in', onComplete: doRemove }))
    else doRemove()
  }, [openId, activeId, mode, run])

  const focusRow = (id: string) => {
    setActiveId(id)
    rowEls.current.get(id)?.focus()
  }

  const openRow = (id: string, fromPointer = false) => {
    setOpenId(id)
    setActiveId(id)
    if (fromPointer || window.innerWidth < 960) {
      if (window.innerWidth < 960) detailRef.current?.scrollIntoView({ block: 'nearest', behavior: mode === 'full' ? 'smooth' : 'auto' })
    }
  }

  const onGridKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const i = rows.findIndex((r) => r.id === activeId)
    const k = e.key.toLowerCase()
    if (k === 'j' || k === 'arrowdown') {
      e.preventDefault()
      const n = rows[Math.min(rows.length - 1, i + 1)]
      if (n) focusRow(n.id)
    } else if (k === 'k' || k === 'arrowup') {
      e.preventDefault()
      const n = rows[Math.max(0, i - 1)]
      if (n) focusRow(n.id)
    } else if (k === 'home' || k === 'end') {
      e.preventDefault()
      const n = k === 'home' ? rows[0] : rows[rows.length - 1]
      if (n) focusRow(n.id)
    } else if (k === 'enter' || k === ' ') {
      e.preventDefault()
      openRow(activeId)
    } else if (k === 'n') {
      e.preventDefault()
      simulate()
    }
  }

  const open = rows.find((r) => r.id === openId) ?? rows[0]!
  const openIdx = FLOW.indexOf(open.status)
  const next = FLOW[openIdx + 1]

  const advance = () => {
    const to: TicketStatus = next ?? 'proses'
    setRows((rs) => rs.map((r) => (r.id === open.id ? { ...r, status: to } : r)))
    setAnnounce(c.announceStatus(open.id, STATUS_LABEL[to][lang]))
  }

  /* Detail pane cross-fade when a different ticket opens. */
  useLayoutEffect(() => {
    const el = detailInner.current
    if (!el || mode === 'static') return
    let tw: gsap.core.Tween | undefined
    run(() => {
      tw = mode === 'reduced' ? gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: TT.reduced }) : gsap.fromTo(el, { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: TT.press, ease: EASE.out })
    })
    return () => {
      tw?.kill()
    }
  }, [openId, mode, run])

  const density40 = density === 'comfy'
  const lateCount = rows.filter((r) => sla(r, elapsed - (born.current.get(r.id) ?? 0)).tone === 'late').length
  const newCount = rows.filter((r) => r.status === 'baru').length

  const kpis = useMemo(
    () =>
      KPIS.map((k) => {
        const live = k.id === 'aduan' && hasNew ? 1 : 0
        return { k, value: k.value + live, delta: k.delta + live }
      }),
    [hasNew],
  )
  const spark = useMemo(() => {
    const s = SERIES.actual.slice(-14)
    if (hasNew) s[s.length - 1] = (s[s.length - 1] ?? 0) + 1
    return s
  }, [hasNew])

  const chLabel = (ch: TicketRow['channel']) => (ch === 'Telepon' ? c.phone : ch)

  return (
    <section className="ldt-block ldt-console-wrap" ref={rootRef} aria-labelledby="ldt-h-kpi">
      <SectionHead num="02" id="ldt-h-kpi" title={c.kpiTitle} lead={c.kpiLead} />
      <div className="ldt-console">
        <div className="ldt-appbar">
          <nav className="ldt-crumbs" aria-label="Breadcrumb">
            <span>{c.crumbs[0]}</span>
            <span aria-hidden="true">/</span>
            <span>
              <i className="ldt-dot ldt-dot--teal" aria-hidden="true" />
              {c.crumbs[1]}
            </span>
            <span aria-hidden="true">/</span>
            <b aria-current="page">{c.crumbs[2]}</b>
          </nav>
          <span className="ldt-modechip">{c.demo}</span>
        </div>

        <div className="ldt-kpis" ref={kpiRef}>
          {kpis.map(({ k, value, delta }) => (
            <KpiCell key={k.id} k={k} value={value} delta={delta} started={kpiStarted} flash={k.id === 'aduan' ? kpiFlash : 0} spark={k.id === 'aduan' ? spark : undefined} lang={lang} />
          ))}
        </div>

        <div className="ldt-sh ldt-sh--inline">
          <span className="ldt-sh-num" aria-hidden="true">
            03
          </span>
          <div className="ldt-sh-text">
            <h2 className="ldt-sh-title" id="ldt-h-inbox">
              {c.inboxTitle}
            </h2>
            <p className="ldt-sh-lead">{c.inboxLead}</p>
          </div>
        </div>

        <div className="ldt-split">
          <div className="ldt-inbox">
            <div className="ldt-toolbar">
              <div className="ldt-toolbar-l">
                <span className="ldt-toolbar-title">
                  {Icon.inbox()}
                  {c.inbox}
                </span>
                <span className="ldt-counts">
                  <span>
                    <b>{rows.length}</b> {c.tickets}
                  </span>
                  <span>
                    <b>{newCount}</b> {c.fresh}
                  </span>
                  <span className={lateCount ? 'is-late' : ''}>
                    <b>{lateCount}</b> {c.late}
                  </span>
                </span>
              </div>
              <div className="ldt-toolbar-r">
                {hasNew ? (
                  <button type="button" className="ldt-btn ldt-btn--ghost" onClick={removeSim}>
                    {Icon.reset()}
                    <span>{c.reset}</span>
                  </button>
                ) : (
                  <button type="button" className="ldt-btn ldt-btn--primary" onClick={simulate} aria-keyshortcuts="N">
                    {Icon.plus()}
                    <span>{c.simulate}</span>
                    <Kbd>N</Kbd>
                  </button>
                )}
                <div className="ldt-seg ldt-density" role="group" aria-label={c.density}>
                  <button type="button" aria-pressed={!density40} onClick={() => setDensity('compact')} title={`${c.compact} · 32 px`}>
                    {Icon.rowsCompact()}
                    <span>{c.compact}</span>
                  </button>
                  <button type="button" aria-pressed={density40} onClick={() => setDensity('comfy')} title={`${c.comfy} · 40 px`}>
                    {Icon.rowsComfy()}
                    <span>{c.comfy}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className={`ldt-grid ${density40 ? 'is-comfy' : 'is-compact'}`} role="grid" aria-labelledby="ldt-h-inbox" aria-rowcount={rows.length + 1} ref={tableRef}>
              <div className="ldt-tr ldt-thead" role="row">
                {c.cols.map((col, i) => (
                  <span key={col} role="columnheader" className={`ldt-th ldt-c${i}`}>
                    {col}
                  </span>
                ))}
              </div>
              <div role="rowgroup" onKeyDown={onGridKey}>
                {rows.map((r) => {
                  const s = sla(r, elapsed - (born.current.get(r.id) ?? 0))
                  const isOpen = r.id === open.id
                  return (
                    <div
                      key={r.id}
                      role="row"
                      ref={(el) => {
                        if (el) rowEls.current.set(r.id, el)
                        else rowEls.current.delete(r.id)
                      }}
                      tabIndex={r.id === activeId ? 0 : -1}
                      aria-selected={isOpen}
                      className={`ldt-tr ldt-row${isOpen ? ' is-open' : ''}`}
                      onClick={() => openRow(r.id, true)}
                      onFocus={() => setActiveId(r.id)}
                    >
                      <span
                        className="ldt-row-flash"
                        aria-hidden="true"
                        ref={(el) => {
                          if (el) flashEls.current.set(r.id, el)
                          else flashEls.current.delete(r.id)
                        }}
                      />
                      <span role="gridcell" className="ldt-td ldt-c0 ldt-num">
                        {r.id}
                      </span>
                      <span role="gridcell" className="ldt-td ldt-c1">
                        {chLabel(r.channel)}
                      </span>
                      <span role="gridcell" className="ldt-td ldt-c2">
                        {r.category[lang]}
                      </span>
                      <span role="gridcell" className="ldt-td ldt-c3">
                        {r.kecamatan}
                      </span>
                      <span role="gridcell" className="ldt-td ldt-c4">
                        {r.opd}
                      </span>
                      <span role="gridcell" className="ldt-td ldt-c5">
                        <StatusChip s={r.status} lang={lang} />
                      </span>
                      <span role="gridcell" className={`ldt-td ldt-c6 ldt-num ldt-sla ldt-sla--${s.tone}`}>
                        {s.tone === 'done' ? (
                          <>
                            {Icon.check()}
                            <span>{c.done}</span>
                          </>
                        ) : (
                          s.txt
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="ldt-hints" aria-hidden="true">
              <span>
                <Kbd>J</Kbd>
                <Kbd>K</Kbd> {c.move}
              </span>
              <span>
                <Kbd>↵</Kbd> {c.open}
              </span>
              <span>
                <Kbd>N</Kbd> {c.newKey}
              </span>
            </div>
          </div>

          <aside className="ldt-detail" ref={detailRef} aria-label={c.detail}>
            <div ref={detailInner} className="ldt-detail-in">
              <div className="ldt-detail-top">
                <span className="ldt-num ldt-faint">{open.id}</span>
                <StatusChip s={open.status} lang={lang} />
              </div>
              <h3 className="ldt-detail-h">{open.category[lang]}</h3>
              <dl className="ldt-dl">
                <div>
                  <dt>{c.channel}</dt>
                  <dd>{chLabel(open.channel)}</dd>
                </div>
                <div>
                  <dt>{c.kec}</dt>
                  <dd>{open.kecamatan}</dd>
                </div>
                <div>
                  <dt>{c.opd}</dt>
                  <dd>{open.opd}</dd>
                </div>
                <div>
                  <dt>{c.sla}</dt>
                  <dd className={`ldt-num ldt-sla ldt-sla--${sla(open, elapsed - (born.current.get(open.id) ?? 0)).tone}`}>
                    {open.status === 'selesai' ? c.done : sla(open, elapsed - (born.current.get(open.id) ?? 0)).txt}
                    {sla(open, elapsed - (born.current.get(open.id) ?? 0)).tone === 'late' && <span className="ldt-late-tag">{c.lateWord}</span>}
                  </dd>
                </div>
              </dl>
              <p className="ldt-detail-sub">{c.progress}</p>
              <div className="ldt-stepper" aria-hidden="true">
                {FLOW.map((s, i) => (
                  <i key={s} className={i < openIdx ? 'is-done' : i === openIdx ? 'is-now' : ''} />
                ))}
              </div>
              <p className="ldt-stepper-l">
                <b>{STATUS_LABEL[open.status][lang]}</b>
                <span className="ldt-num ldt-faint">
                  {c.step} {openIdx + 1}/{FLOW.length}
                </span>
              </p>
              <ol className="ldt-sr">
                {FLOW.map((s, i) => (
                  <li key={s} aria-current={i === openIdx ? 'step' : undefined}>
                    {STATUS_LABEL[s][lang]}
                  </li>
                ))}
              </ol>
              <button type="button" className="ldt-btn ldt-btn--quiet ldt-detail-btn" onClick={advance}>
                {next ? (
                  <>
                    <span>
                      {c.advance} <b>{STATUS_LABEL[next][lang]}</b>
                    </span>
                    {Icon.arrowRight()}
                  </>
                ) : (
                  <>
                    <span>{c.reopen}</span>
                    {Icon.replay()}
                  </>
                )}
              </button>
            </div>
          </aside>
        </div>
        <p className="ldt-sr" aria-live="polite">
          {announce}
        </p>
      </div>
    </section>
  )
}
