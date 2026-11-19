/**
 * tour/Player.tsx (lazy: "Mulai tur" / "Putar bab N" / resume) — desktop 38/62 split (narration / live stage),
 * tablet top band, phone bottom sheet (peek · half · full; drag on the handle or the 44 px toggle). Controls: prev ·
 * play/pause · next · speed (0,75× / 1× / 1,5×) · chapters · presenter · exit. Keyboard: Space, ←/→, L, P, and in
 * presenter F / B / R; ignored in text fields and inside the stage. Summary (ch. 20) is its own lazy chunk.
 */
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { TOUR_CHAPTERS } from '../../content/tour'
import { useFullscreen, useIdleCursor, useMediaQuery } from '../shell/hooks'
import { Icon } from '../ui/icons'
import { chapterOf, SUMMARY_N } from './chapters'
import { ChapterDrawer } from './ChapterDrawer'
import { Constellation, RING_TOTAL, seenCount } from './Constellation'
import { bindProgress, engine, setEngineLang } from './engine'
import { BigClock, NarrationText } from './Narration'
import { useNarration } from './narration-load'
import Stage, { AmbilAlih } from './Stage'
import { tourStore, useTour } from './store'
import { TOUR_STRINGS, fill } from './strings'
import type { Lang } from './types'

const Summary = lazy(() => import('./Summary'))
const SPEEDS = [0.75, 1, 1.5] as const
const TOTAL = SUMMARY_N
type Snap = 'peek' | 'half' | 'full'

export default function Player({ lang, onExit }: { lang: Lang; onExit: () => void }) {
  const st = useTour()
  const t = TOUR_STRINGS[lang]
  const narr = useNarration(lang)
  const phone = useMediaQuery('(max-width: 639.98px)')
  const tablet = useMediaQuery('(min-width: 640px) and (max-width: 1023.98px)')
  const root = useRef<HTMLDivElement>(null)
  const drawerBtn = useRef<HTMLButtonElement>(null)
  const fs = useFullscreen(() => root.current)
  const [snap, setSnap] = useState<Snap>('peek')
  useIdleCursor(st.presenter)
  useEffect(() => setEngineLang(lang), [lang])

  const ch = chapterOf(st.n)
  const entry = narr?.[st.n]
  const summary = st.phase === 'summary'
  const seenK = seenCount(st.seen)

  // during autoplay the sheet stays in peek; on pause it rises to half
  useEffect(() => {
    if (!phone) return
    setSnap((s) => (st.playing ? (s === 'full' ? s : 'peek') : s === 'peek' ? 'half' : s))
  }, [st.playing, phone])

  const closeDrawer = useCallback(() => {
    tourStore.set({ drawer: false })
    drawerBtn.current?.focus()
  }, [])
  const togglePresenter = useCallback(() => {
    const on = !tourStore.get().presenter
    tourStore.set({ presenter: on, black: false })
    if (on && fs.supported && !fs.active) fs.toggle()
    if (!on && fs.active) fs.toggle()
  }, [fs])

  // keyboard (plan §0.3)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
      const el = e.target as HTMLElement | null
      if (el?.closest?.('input, textarea, select, [contenteditable="true"], .dk-tour-stage')) return
      const s = tourStore.get()
      if (s.drawer) return
      const k = e.key
      if (k === 'Escape') {
        if (s.black) tourStore.set({ black: false })
        else if (phone) setSnap('peek')
        return
      }
      if (k === ' ' || k === 'Spacebar') {
        if (el?.closest?.('button, a, [role="radio"]')) return
        e.preventDefault()
        engine.toggle()
      } else if (k === 'ArrowRight') {
        e.preventDefault()
        engine.next()
      } else if (k === 'ArrowLeft') {
        e.preventDefault()
        engine.prev()
      } else if (k === 'l' || k === 'L') tourStore.set({ drawer: true })
      else if (k === 'p' || k === 'P') togglePresenter()
      else if (s.presenter && (k === 'f' || k === 'F')) fs.toggle()
      else if (s.presenter && (k === 'b' || k === 'B')) tourStore.set({ black: !s.black })
      else if (s.presenter && (k === 'r' || k === 'R')) engine.restart()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phone, fs, togglePresenter])

  // phone sheet drag (pointer events on the handle, transform only, velocity snap)
  const sheet = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y0: number; t0: number; base: number; moved: boolean } | null>(null)
  const snapY = (s: Snap) => {
    const h = typeof window !== 'undefined' ? window.innerHeight : 800
    const full = h * 0.9
    return s === 'full' ? 0 : s === 'half' ? full - h * 0.5 : full - 140
  }
  const onDown = (e: React.PointerEvent) => {
    drag.current = { y0: e.clientY, t0: performance.now(), base: snapY(snap), moved: false }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || !sheet.current) return
    const dy = e.clientY - d.y0
    if (!d.moved && Math.abs(dy) <= 4) return
    d.moved = true
    sheet.current.style.transition = 'none'
    sheet.current.style.transform = `translateY(${Math.max(0, d.base + dy)}px)`
  }
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    if (!d || !sheet.current) return
    sheet.current.style.transition = ''
    sheet.current.style.transform = ''
    // a tap (pointer captured by the handle, so the button's own click does not fire): toggle peek ⇄ half
    if (!d.moved) return setSnap(snap === 'peek' ? 'half' : 'peek')
    const dy = e.clientY - d.y0
    const v = dy / Math.max(1, performance.now() - d.t0)
    const y = d.base + dy
    const order: Snap[] = ['full', 'half', 'peek']
    let best: Snap = order.reduce((a, b) => (Math.abs(snapY(b) - y) < Math.abs(snapY(a) - y) ? b : a), 'half' as Snap)
    if (Math.abs(v) > 0.6) best = v > 0 ? (snap === 'full' ? 'half' : 'peek') : snap === 'peek' ? 'half' : 'full'
    setSnap(best)
  }

  const controls = (
    <div className="dk-tour-controls" role="group" aria-label={t.chapters}>
      <button type="button" className="dk-tour-icon" onClick={() => engine.prev()} aria-label={t.prev} disabled={st.n <= 1} data-tour-ctl="prev">
        <Icon name="chevronLeft" size={20} />
      </button>
      <button type="button" className="dk-tour-icon dk-tour-icon--main" onClick={() => engine.toggle()} aria-label={st.playing ? t.pause : t.play} aria-pressed={st.playing} data-tour-ctl="play">
        <Icon name={st.playing ? 'pause' : 'play'} size={22} />
      </button>
      <button type="button" className="dk-tour-icon" onClick={() => engine.next()} aria-label={t.next} disabled={summary} data-tour-ctl="next">
        <Icon name="chevronRight" size={20} />
      </button>
      <div className="dk-tour-seg" role="radiogroup" aria-label={t.speed}>
        {SPEEDS.map((r) => (
          <button key={r} type="button" role="radio" aria-checked={st.rate === r} className="dk-tour-seg-btn" onClick={() => engine.setRate(r)} data-rate={r}>
            {lang === 'id' ? String(r).replace('.', ',') : r}×
          </button>
        ))}
      </div>
      <button ref={drawerBtn} type="button" className="dk-tour-btn" onClick={() => tourStore.set({ drawer: true })} aria-haspopup="dialog" data-tour-ctl="chapters">
        <Icon name="list" size={18} />
        <span>{lang === 'id' ? 'Bab' : 'Chapters'}</span>
      </button>
      {!phone ? (
        <button type="button" className="dk-tour-icon" onClick={togglePresenter} aria-label={t.presenter} aria-pressed={st.presenter} data-tour-ctl="presenter">
          <Icon name="fullscreen" size={18} />
        </button>
      ) : null}
      <button type="button" className="dk-tour-icon" onClick={onExit} aria-label={t.exit} data-tour-ctl="exit">
        <Icon name="close" size={18} />
      </button>
    </div>
  )

  const progress = (
    <div className="dk-tour-progress" role="progressbar" aria-label={t.progress} aria-valuemin={1} aria-valuemax={TOTAL} aria-valuenow={st.n}>
      {TOUR_CHAPTERS.map((c) => (
        <span key={c.n} className={`dk-tour-seg-bar${c.n < st.n ? ' is-done' : ''}`}>
          {c.n === st.n && !summary ? <span className="dk-tour-seg-fill" ref={bindProgress} /> : null}
        </span>
      ))}
    </div>
  )

  const head = (
    <div className="dk-tour-head">
      <span className="dk-tour-eyebrow">
        {summary ? t.summary : fill(t.chapterOf, { n: st.n, total: TOTAL })}
        {ch ? ` · ${ch.time.replace(':', lang === 'id' ? '.' : ':')}` : ''}
      </span>
      <BigClock lang={lang} />
    </div>
  )

  const takeover = st.poster ? <AmbilAlih lang={lang} disabledReason={t.posterOnly} /> : st.stage ? <AmbilAlih lang={lang} /> : null
  const happenedNums = st.poster && entry ? entry.happened : null

  const narration = (
    <>
      {head}
      <NarrationText entry={entry} fills={st.fills} cap={st.cap} lang={lang} n={st.n} total={TOTAL} />
      {phone || st.poster ? takeover : null}
    </>
  )

  const resumeChip = st.interrupted ? (
    <button type="button" className="dk-tour-btn dk-tour-btn--accent dk-tour-resume" onClick={() => engine.play()} data-tour-ctl="resume">
      <Icon name="play" size={16} />
      {t.resume}
    </button>
  ) : null

  return (
    <div ref={root} className={`dk-tour-player${phone ? ' is-phone' : tablet ? ' is-tablet' : ' is-desk'}${st.presenter ? ' is-presenter' : ''}`} data-phase={st.phase}>
      <a href="#dk-tour-controls" className="dk-tour-skip">
        {t.skip}
      </a>
      {summary ? (
        <Suspense fallback={<p className="dk-tour-loading">{t.loading}</p>}>
          <Summary lang={lang} controls={<div id="dk-tour-controls">{controls}</div>} />
        </Suspense>
      ) : phone ? (
        <>
          <div className="dk-tour-stagebox">
            <Stage lang={lang} phone />
            <Curtain on={st.curtain} />
            {resumeChip}
            {happenedNums ? <PosterNums items={happenedNums} fills={st.fills} /> : null}
          </div>
          <div ref={sheet} className={`dk-tour-sheet is-${snap}`} aria-label={t.sheet}>
            <div className="dk-tour-sheet-handle" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
              <button type="button" className="dk-tour-sheet-grip" aria-label={t.sheetToggle} aria-expanded={snap !== 'peek'} onClick={(e) => e.detail === 0 && setSnap(snap === 'peek' ? 'half' : 'peek')} data-tour-ctl="sheet">
                <span aria-hidden="true" />
              </button>
            </div>
            <div className="dk-tour-peek">
              <span className="dk-tour-eyebrow">
                {st.n}/{TOTAL}
              </span>
              <BigClock lang={lang} />
              <span className="dk-tour-peek-title">{entry ? entry.title : ''}</span>
              <button type="button" className="dk-tour-icon dk-tour-icon--main" onClick={() => engine.toggle()} aria-label={st.playing ? t.pause : t.play} data-tour-ctl="play-peek">
                <Icon name={st.playing ? 'pause' : 'play'} size={20} />
              </button>
              <button type="button" className="dk-tour-icon" onClick={() => engine.next()} aria-label={t.next} data-tour-ctl="next-peek">
                <Icon name="chevronRight" size={20} />
              </button>
              <button type="button" className="dk-tour-chip dk-tour-chip--btn" onClick={() => tourStore.set({ drawer: true })} data-tour-ctl="chip">
                {fill(t.chipProducts, { k: seenK, total: RING_TOTAL })}
              </button>
            </div>
            {progress}
            <div className="dk-tour-sheet-body" id="dk-tour-controls">
              {narration}
              {controls}
            </div>
          </div>
        </>
      ) : (
        <div className="dk-tour-split">
          <aside className="dk-tour-col" aria-label={t.sheet}>
            {tablet ? (
              <>
                {head}
                <NarrationText entry={entry} fills={st.fills} cap={st.cap} lang={lang} n={st.n} total={TOTAL} compact />
                <details className="dk-tour-more">
                  <summary>{t.happened}</summary>
                  <NarrationText entry={entry} fills={st.fills} cap={null} lang={lang} n={st.n} total={TOTAL} />
                </details>
                {st.poster ? takeover : null}
              </>
            ) : (
              narration
            )}
            {progress}
            <div id="dk-tour-controls">{controls}</div>
            {!tablet ? <Constellation seen={st.seen} lang={lang} /> : null}
            {!tablet ? <p className="dk-tour-fine">{t.shortcuts}</p> : null}
          </aside>
          <div className="dk-tour-stagebox">
            <Stage lang={lang} phone={false} />
            <Curtain on={st.curtain} />
            {resumeChip}
            {happenedNums ? <PosterNums items={happenedNums} fills={st.fills} /> : null}
          </div>
        </div>
      )}
      <ChapterDrawer open={st.drawer} onClose={closeDrawer} onPick={(n) => engine.go(n)} lang={lang} current={st.n} seen={st.seen} />
      {st.black ? <div className="dk-tour-black" aria-hidden="true" onClick={() => tourStore.set({ black: false })} /> : null}
    </div>
  )
}

function Curtain({ on }: { on: boolean }) {
  return <div className={`dk-tour-curtain${on ? ' is-on' : ''}`} aria-hidden="true" />
}

/** poster mode: the chapter's result lines with their world numbers over the calm card */
function PosterNums({ items, fills }: { items: string[]; fills: Record<string, string | number> }) {
  return (
    <ul className="dk-tour-poster-nums">
      {items.map((h, i) => (
        <li key={i}>{h.replace(/\{(\w+)\}/g, (_m, k: string) => String(fills[k] ?? '…'))}</li>
      ))}
    </ul>
  )
}

export function useExit(): () => void {
  const navigate = useNavigate()
  return () => {
    engine.stop()
    navigate('/')
  }
}
