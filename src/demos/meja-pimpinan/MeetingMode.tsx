/**
 * MeetingMode (lazy) — "Mode rapat" (spec P2 step 6): full screen (Fullscreen API when allowed, else a fixed
 * overlay), large type, panels rotating every 15 s: indicators, briefing, complaints per district, agency ranking,
 * today's events. ←/→ change panel, Space pauses, Esc leaves. Not offered below 768 px (brief).
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useI18n } from '../../lib/i18n'
import { PRODUCT_BY_SLUG } from '../../content/products'
import { Icon, IconButton, enterPanel, motionMode, type IconName } from '../../demo-kit/ui'
import { hhmm, shallowEqual, useWorld, world } from '../../demo-kit/world'
import { kpiStrip, opdLeaderboard } from '../../demo-kit/world/satu-daerah'
import { MP, mpBriefingItems, todayEvents, useNow } from './data'
import { runQuery } from './query'
import { nf, type Bi } from './strings'

const M = {
  label: { id: 'Mode rapat', en: 'Meeting mode' },
  panels: [
    { id: 'Indikator utama', en: 'Key indicators' },
    { id: 'Briefing pagi', en: 'Morning briefing' },
    { id: 'Aduan per kecamatan', en: 'Complaints by district' },
    { id: 'Peringkat OPD', en: 'Agency ranking' },
    { id: 'Kejadian hari ini', en: "Today's events" },
  ],
  prev: { id: 'Panel sebelumnya', en: 'Previous panel' },
  next: { id: 'Panel berikutnya', en: 'Next panel' },
  pause: { id: 'Jeda rotasi', en: 'Pause rotation' },
  play: { id: 'Lanjutkan rotasi', en: 'Resume rotation' },
  exit: { id: 'Keluar dari mode rapat (Esc)', en: 'Leave meeting mode (Esc)' },
  go: { id: 'Ke panel {n}: {p}', en: 'Go to panel {n}: {p}' },
  keys: { id: '← → ganti panel · Spasi jeda · Esc keluar', en: '← → change panel · Space pause · Esc leave' },
  k: {
    complaints: { id: 'Aduan hari ini', en: 'Complaints today' },
    sla: { id: 'SLA tepat waktu', en: 'SLA on time' },
    alerts: { id: 'Peringatan aktif', en: 'Active alerts' },
    neg: { id: 'Isu negatif', en: 'Negative issues' },
    overdue: { id: 'Tindak lanjut terlambat', en: 'Overdue follow-ups' },
    index: { id: 'Indeks layanan', en: 'Service index' },
  },
  vs: { id: 'vs kemarin', en: 'vs yesterday' },
  live: { id: 'Butir dihitung langsung (briefing belum disusun)', en: 'Items computed live (briefing not composed yet)' },
  sim: { id: 'Data simulasi', en: 'Simulated data' },
  score: { id: 'skor', en: 'score' },
  bottom: { id: 'Terbawah', en: 'Bottom' },
  top: { id: 'Teratas', en: 'Top' },
  prevWeek: { id: 'pekan lalu', en: 'last week' },
  chartUnit: { id: 'aduan 7 hari terakhir per kecamatan; batang tipis = pekan sebelumnya', en: 'complaints in the last 7 days by district; thin bar = the week before' },
  now: { id: 'Panel {n} dari {t}: {p}', en: 'Panel {n} of {t}: {p}' },
}

export default function MeetingMode({ onClose, onOpened, title, leader }: { onClose: () => void; onOpened: () => void; title: string; leader: Bi }) {
  const { lang } = useI18n()
  const now = useNow(1)
  const now5 = Math.floor(now / 5) * 5
  const root = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const n = M.panels.length
  const fsOn = useRef(false)

  // what opened meeting mode (read while rendering, before this overlay takes the focus)
  const [opener] = useState(() => (document.activeElement instanceof HTMLElement ? document.activeElement : null))
  useEffect(() => {
    onOpened()
    const el = root.current
    el?.querySelector<HTMLButtonElement>('[data-mm-focus]')?.focus()
    if (el?.requestFullscreen && !document.fullscreenElement) {
      el.requestFullscreen().then(() => (fsOn.current = true), () => {})
    }
    const onFs = () => {
      if (fsOn.current && !document.fullscreenElement) onClose()
    }
    document.addEventListener('fullscreenchange', onFs)
    return () => {
      document.removeEventListener('fullscreenchange', onFs)
      if (document.fullscreenElement && fsOn.current) void document.exitFullscreen().catch(() => {})
      // back to "Mode rapat" (or whatever opened it) once the overlay is really gone (a StrictMode re-run keeps it)
      window.requestAnimationFrame(() => {
        if (!el?.isConnected && opener?.isConnected) opener.focus({ preventScroll: true })
      })
    }
    // once on open
  }, [])

  // rotation every 15 s (paused while the viewer pauses it or the tab is hidden)
  useEffect(() => {
    if (paused) return
    const id = window.setTimeout(() => {
      if (!document.hidden) setI((x) => (x + 1) % n)
    }, MP.rotateMs)
    return () => window.clearTimeout(id)
  }, [i, paused, n])
  useLayoutEffect(() => {
    if (!stage.current) return
    const tw = enterPanel(stage.current, { y: 12 }, 0.5)
    return () => tw?.kill()
  }, [i])

  const go = useCallback((d: number) => setI((x) => (x + d + n) % n), [n])
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowRight') go(1)
    else if (e.key === 'ArrowLeft') go(-1)
    else if (e.key === ' ' && (e.target as HTMLElement).tagName !== 'BUTTON') {
      e.preventDefault()
      setPaused((p) => !p)
    } else if (e.key === 'Tab') {
      // keep focus inside the dialog
      const f = Array.from(root.current?.querySelectorAll<HTMLElement>('button') ?? [])
      const a = document.activeElement
      if (e.shiftKey && a === f[0]) {
        e.preventDefault()
        f[f.length - 1]?.focus()
      } else if (!e.shiftKey && a === f[f.length - 1]) {
        e.preventDefault()
        f[0]?.focus()
      }
    }
  }

  return (
    <div ref={root} className="dk-mp-mm" role="dialog" aria-modal="true" aria-label={`${M.label[lang]} · ${title}`} onKeyDown={onKey}>
      <header className="dk-mp-mm-h">
        <div>
          <p className="dk-mp-eyebrow">
            {M.label[lang]} · {leader[lang]}
          </p>
          <h2>{title}</h2>
        </div>
        <p className="dk-mp-mm-clock dk-num">{hhmm(now)} WIB</p>
        <IconButton icon="close" label={M.exit[lang]} onClick={onClose} data-mm-focus="" />
      </header>
      <p className="dk-sr" aria-live="polite">
        {M.now[lang].replace('{n}', String(i + 1)).replace('{t}', String(n)).replace('{p}', M.panels[i]![lang])}
      </p>
      <div className="dk-mp-mm-stage" ref={stage}>
        <h3 className="dk-mp-mm-t">
          <span className="dk-num">{i + 1}</span> {M.panels[i]![lang]}
        </h3>
        {i === 0 ? <KpiPanel now={now5} /> : i === 1 ? <BriefPanel now={now5} /> : i === 2 ? <ChartPanel now={now5} /> : i === 3 ? <OpdPanel now={now5} /> : <EventsPanel />}
      </div>
      <footer className="dk-mp-mm-f">
        <span className="dk-mp-mm-bar" aria-hidden="true">
          <span key={`${i}-${paused}`} className={paused || motionMode() !== 'full' ? 'is-still' : ''} style={{ animationDuration: `${MP.rotateMs}ms` }} />
        </span>
        <div className="dk-mp-mm-ctl">
          <IconButton icon="chevronLeft" label={M.prev[lang]} onClick={() => go(-1)} />
          <IconButton icon={paused ? 'play' : 'pause'} label={paused ? M.play[lang] : M.pause[lang]} onClick={() => setPaused((p) => !p)} aria-pressed={paused} />
          <IconButton icon="chevronRight" label={M.next[lang]} onClick={() => go(1)} />
          <span className="dk-mp-mm-dots">
            {M.panels.map((p, k) => (
              <button key={k} type="button" className={k === i ? 'is-on' : ''} aria-current={k === i ? 'true' : undefined} aria-label={M.go[lang].replace('{n}', String(k + 1)).replace('{p}', p[lang])} onClick={() => setI(k)} />
            ))}
          </span>
          <span className="dk-mp-mm-keys">{M.sim[lang]} · {M.keys[lang]}</span>
        </div>
      </footer>
    </div>
  )
}

function KpiPanel({ now }: { now: number }) {
  const { lang } = useI18n()
  const k = useWorld((s) => kpiStrip(s, now), shallowEqual)
  const tiles: [Bi, string, string?][] = [
    [M.k.complaints, String(k.complaints.today), `${k.complaints.delta >= 0 ? '+' : '−'}${Math.abs(k.complaints.delta)} ${M.vs[lang]}`],
    [M.k.sla, `${k.slaPct}%`],
    [M.k.alerts, String(k.alerts)],
    [M.k.neg, String(k.negativeIssues)],
    [M.k.overdue, String(k.overdue)],
    [M.k.index, `${k.serviceIndex}/100`],
  ]
  return (
    <ul className="dk-mp-mm-kpis">
      {tiles.map(([l, v, d]) => (
        <li key={l.id}>
          <span>{l[lang]}</span>
          <strong className="dk-num">{v}</strong>
          {d && <small className="dk-num">{d}</small>}
        </li>
      ))}
    </ul>
  )
}

function BriefPanel({ now }: { now: number }) {
  const { lang } = useI18n()
  const stored = useWorld((s) => s.briefings.ids.map((id) => s.briefings.byId[id]!).find((b) => b.at >= 0) ?? null)
  const items = useMemo(() => (stored ? stored.items : mpBriefingItems(world.get(), now)), [stored, now])
  return (
    <>
      {!stored && <p className="dk-mp-meta">{M.live[lang]}</p>}
      <ol className="dk-mp-mm-brief">
        {items.slice(0, 8).map((it, k) => (
          <li key={k}>
            <span className="dk-num">{k + 1}</span>
            <p>{it.title[lang]}</p>
            <em>
              <Icon name={PRODUCT_BY_SLUG[it.source].icon as IconName} size={16} />
              {PRODUCT_BY_SLUG[it.source].name}
            </em>
          </li>
        ))}
      </ol>
    </>
  )
}

function ChartPanel({ now }: { now: number }) {
  const { lang } = useI18n()
  const complaints = useWorld((s) => s.complaints)
  const res = useMemo(() => runQuery(world.get(), now, { metric: 'complaints', groupBy: 'kecamatan', range: '7d', chart: 'bar' }, lang), [complaints, now, lang])
  const list = res.rows.slice(0, 8)
  const max = Math.max(1, ...list.map((r) => Math.max(r.value, r.prev ?? 0)))
  return (
    <div className="dk-mp-mm-chart">
      <p className="dk-mp-mm-unit">{M.chartUnit[lang]}</p>
      <ol className="dk-mp-mm-bars" aria-label={`${M.panels[2]![lang]}: ${list.map((r) => `${r.label} ${r.value}`).join(', ')}`}>
        {list.map((r) => (
          <li key={r.id}>
            <p>{r.label}</p>
            <span className="dk-mp-mm-hbar" aria-hidden="true">
              <span style={{ transform: `scaleX(${r.value / max})` }} />
              {(r.prev ?? 0) > 0 && <i style={{ transform: `scaleX(${(r.prev ?? 0) / max})` }} />}
            </span>
            <strong className="dk-num">
              {nf(lang, r.value)} <small>{M.prevWeek[lang]} {nf(lang, r.prev ?? 0)}</small>
            </strong>
          </li>
        ))}
      </ol>
    </div>
  )
}

function OpdPanel({ now }: { now: number }) {
  const { lang } = useI18n()
  const lb = useWorld((s) => opdLeaderboard(s, now))
  const split = lb.length > 8
  const show = split ? [...lb.slice(0, 5), ...lb.slice(-3)] : lb
  return (
    <ol className="dk-mp-mm-opd">
      {show.map((r, k) => [
        split && k === 5 ? (
          <li key="gap" className="dk-mp-mm-gap" aria-hidden="true">
            <span>…</span>
            <p>{M.bottom[lang]}</p>
          </li>
        ) : null,
        <li key={r.opdId} className={r.score < 60 ? 'is-low' : ''}>
          <span className="dk-num">{lb.indexOf(r) + 1}</span>
          <p>{r.short}</p>
          <span className="dk-mp-mm-obar" aria-hidden="true">
            <span style={{ transform: `scaleX(${r.score / 100})` }} />
          </span>
          <strong className="dk-num">
            {r.score} <small>{M.score[lang]}</small>
          </strong>
        </li>,
      ])}
    </ol>
  )
}

function EventsPanel() {
  const { lang } = useI18n()
  const ev = useWorld(todayEvents)
  return (
    <ul className="dk-mp-mm-ev">
      {ev.slice(0, 6).map((e) => (
        <li key={e.id} className={`is-${e.tone}`}>
          <span className="dk-num">{hhmm(e.at)}</span>
          <Icon name={e.icon} size={20} />
          <p>{e.title[lang]}</p>
        </li>
      ))}
    </ul>
  )
}
