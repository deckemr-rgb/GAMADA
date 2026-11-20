/**
 * Naskah Pintar (P3) — AI minutes & dispositions. BrowserFrame with three tabs:
 *   Rapat (eager): the sample meeting plays, the transcript flows, the minutes and follow-ups write themselves and
 *     fly to their agency's lane (emits actionItem.created ×6, meeting.transcribed); official minutes in a PaperFrame.
 *   Surat Masuk (lazy): crooked scans → AI summary, classification, disposition draft → approve → stamp
 *     (emits letter.dispositioned + one actionItem.created per recipient agency).
 *   Tindak Lanjut (lazy): board per agency / per status / deadline list, status moves, WhatsApp reminders
 *     (emits actionItem.statusChanged, actionItem.reminded).
 * Consumes instruction.issued (Meja Pimpinan): its memo and tasks arrive through the world reactions and are
 * announced here. Roles: Sekretariat (default), Kepala Daerah (approves as the Regent), Kepala OPD (own agency only).
 */
import { Activity, Suspense, lazy, memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import type { DemoCanvasProps } from '../registry'
import type { Mission } from '../../demo-kit/shell'
import { intentProps, preloadNow, useShell } from '../../demo-kit/shell'
import { BrowserFrame } from '../../demo-kit/frames'
import { Button, Icon, IconButton, Select, Skeleton, Tabs } from '../../demo-kit/ui'
import { clock, isEvent, onEvent, shallowEqual, useClock, useSession, useWorld, world, type ActionItem, type WorldState } from '../../demo-kit/world'
import { useI18n } from '../../lib/i18n'
import { Meeting as MeetingTab } from './Meeting'
import { isAutoDisposition, runDay } from './day'
import { approveDue } from './approvals'
import { NP, clockText, npRole, opdName, placeText, setMeetingRegion, type NpRole } from './model'
import { opdLabel, useStr } from './strings'
import './naskah-pintar.css'

/* memo: a tab click re-renders the shell of the page first (the tab bar answers at once), the panels follow in the
   deferred render below (INP) */
const Meeting = memo(MeetingTab)
const loadLetters = () => import('./Letters')
const loadFollowUps = () => import('./FollowUps')
const Letters = memo(lazy(loadLetters))
const FollowUps = memo(lazy(loadFollowUps))
const Assistant = lazy(() => import('./Assistant'))
const LeaderDesk = lazy(() => import('./LeaderDesk'))
/* the other tabs are fetched on intent (hover / focus / press of their tab or of a button that opens them), never at
   boot: they stay out of the first load (size limit, CONTRACTS.md) and still arrive before the click */
const lettersIntent = intentProps(loadLetters)
const followIntent = intentProps(loadFollowUps)

export type NpTab = 'rapat' | 'surat' | 'tindak'

export interface NpFocus {
  letterId?: string
  itemId?: string
  opdId?: string
  opdIds?: readonly string[]
  /** open the letter and start the AI reading at once (Kepala Daerah desk) */
  autoRead?: boolean
  /** board: show only the overdue follow-ups */
  lateOnly?: boolean
}

/** shared navigation between the tabs (lanes → board, banner → memo, toasts → tab) */
export interface NpNav {
  tab: NpTab
  /** focus: a letter, an item and/or agencies (opdIds: every agency to bring to the front of the board) */
  go: (tab: NpTab, focus?: NpFocus) => void
  role: NpRole
  /** the agency of the "Kepala OPD" role (null for the other roles) */
  myOpd: string | null
}

function counts(s: WorldState, now: number, opd: string | null) {
  let pending = 0
  for (const id of s.letters.ids) {
    const l = s.letters.byId[id]
    if (!l) continue
    if (opd ? l.status === 'didisposisi' && l.disposition?.to.includes(opd) && l.disposition.at >= now - 24 * 60 : l.status === 'masuk') pending++
  }
  let late = 0
  for (const id of s.actionItems.ids) {
    const a: ActionItem | undefined = s.actionItems.byId[id]
    if (a && a.status !== 'selesai' && a.dueAt < now && (!opd || a.opdId === opd)) late++
  }
  return { pending, late }
}

export default function NaskahPintar({ product }: DemoCanvasProps) {
  const S = useStr()
  const { lang } = useI18n()
  const shell = useShell()
  // the sample meeting names this region's river, kecamatan and embankment (idempotent; before any tab renders)
  setMeetingRegion(shell.pack)
  const { role: sessionRole } = useSession()
  const role = npRole(sessionRole)
  const now = useClock().minutes
  const [tab, setTab] = useState<NpTab>('rapat')
  const [opdPick, setOpdPick] = useState<string>(NP.defaultOpd)
  const myOpd = role === 'kepala-opd' ? opdPick : null
  const [focus, setFocus] = useState<NpFocus & { n: number }>({ n: 0 })
  const [askOpen, setAskOpen] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)
  const c = useWorld((s) => counts(s, now, myOpd), shallowEqual)
  const opds = useWorld((s) => s.region.opd)
  const instr = useWorld((s) => (banner ? s.instructions.byId[banner] : undefined))
  const instrOpds = useWorld((s) => (instr ? instr.opdIds.map((o) => opdName(s, o, lang)).join(', ') : ''))
  /* the banner leaves on its own once the instruction's tasks are done (or their deadline has passed) */
  const instrOver = useWorld((s) => {
    if (!instr || !instr.actionItemIds.length) return false
    const its = instr.actionItemIds.map((id) => s.actionItems.byId[id])
    return its.every((a) => !a || a.status === 'selesai') || Math.max(instr.dueAt, ...its.map((a) => a?.dueAt ?? 0)) < now
  })
  useEffect(() => {
    if (instrOver) setBanner(null)
  }, [instrOver])

  const go = useCallback<NpNav['go']>((t, f) => {
    setTab(t)
    if (f) setFocus((p) => ({ ...f, n: p.n + 1 }))
  }, [])
  /* a plain tab click forgets the last arrival focus (a pre-rendered tab must not jump back to it) */
  const pickTab = useCallback((t: NpTab) => {
    setTab(t)
    setFocus((p) => (p.letterId || p.itemId || p.opdId || p.opdIds || p.lateOnly ? { n: p.n } : p))
  }, [])
  /* the tab bar follows `tab` at once; the panels follow `shown` in a non-blocking render (a lazy panel that is still
     loading keeps the previous one on screen instead of a skeleton flash) */
  const shown = useDeferredValue(tab)
  const nav = useMemo<NpNav>(() => ({ tab: shown, go, role, myOpd }), [shown, go, role, myOpd])

  /* instructions from Meja Pimpinan: announce them here (their memo + tasks are created by world reactions) */
  useEffect(() => onEvent('instruction.issued', (e) => setBanner(e.payload.id ?? null)), [])

  /* the working day: while the clock runs or jumps, the agencies move the meeting's follow-ups and the Regent's
     office sends a memo (day.ts); what happened since the last tick is announced in one toast */
  const toast = shell.toast
  useEffect(() => {
    let last = -1
    const tick = () => {
      const t = clock.get().minutes
      if (t === last) return
      last = t
      approveDue(t)
      const notes = runDay(t)
      if (!notes.length) return
      const L = lang
      const Sx = S
      const s = world.get()
      const lines = notes.map((n) => (n.seed ? (n.seed.start ? Sx.daySeedStart : Sx.daySeed)(n.seed.title[L], opdName(s, n.seed.opdId, L)) : placeText(Sx.dayNotes[n.key] ?? '', L)))
      /* the latest updates (phones: one line, the toast covers less of the screen); one toast id, so a jump replaces
         the previous toast instead of stacking a stale one */
      const shown = lines.slice(-(window.matchMedia('(max-width: 640px)').matches ? 1 : 2)) // the latest news first
      toast({
        id: 'np-day',
        title: Sx.dayToast(clockText(t, L)),
        body: shown.join(' ') + (lines.length > shown.length ? ` ${Sx.dayMore(lines.length - shown.length)}` : ''),
        tone: 'neutral',
        icon: 'clock',
        action: { label: Sx.daySee, onClick: () => go('tindak') },
      })
    }
    /* catch up once on mount: a clock that was moved (or a ?t= link) before this page was up still gets its day */
    tick()
    return clock.subscribe(tick)
  }, [toast, lang, S, go])

  /* once a tab's intent has fetched its chunk, render it hidden (React Activity, low priority) so the tap only reveals it */
  const [warm, setWarm] = useState<{ surat: boolean; tindak: boolean }>({ surat: false, tindak: false })

  /* ?focus=<entity> (cross-product toast): open the right tab and entity */
  const { focus: shellFocus, clearFocus } = shell
  const focusKind = useWorld((s) => {
    if (!shellFocus) return null
    if (s.letters.byId[shellFocus]) return 'letter'
    if (s.actionItems.byId[shellFocus]) return 'item'
    if (s.instructions.byId[shellFocus]) return 'instruction'
    if (s.meetings.byId[shellFocus]) return 'meeting'
    return null
  })
  const focusLetterOfInstr = useWorld((s) => (shellFocus && focusKind === 'instruction' ? (s.instructions.byId[shellFocus]?.letterId ?? null) : null))
  useEffect(() => {
    if (!shellFocus || !focusKind) return
    if (focusKind === 'letter') go('surat', { letterId: shellFocus })
    else if (focusKind === 'item') go('tindak', { itemId: shellFocus })
    else if (focusKind === 'instruction' && focusLetterOfInstr) go('surat', { letterId: focusLetterOfInstr })
    else go('rapat')
    clearFocus()
  }, [shellFocus, focusKind, focusLetterOfInstr, go, clearFocus])

  /* phones: short labels without icons so the three tabs fit 326 px without scrolling */
  const sm = shell.size === 'sm'
  const items = useMemo(
    () => [
      { id: 'rapat' as const, label: sm ? S.tabShort.rapat : S.tabMeeting, ...(sm ? {} : { icon: 'mic' as const }) },
      { id: 'surat' as const, label: sm ? S.tabShort.surat : S.tabLetters, ...(sm ? {} : { icon: 'inbox' as const }), badge: c.pending },
      { id: 'tindak' as const, label: sm ? S.tabShort.tindak : S.tabFollow, ...(sm ? {} : { icon: 'kanban' as const }), badge: c.late },
    ],
    [S, c.pending, c.late, sm],
  )
  /* intent on a tab (pointer over, keyboard focus, press, touch): fetch its chunk, then pre-render it hidden */
  const warmTab = useCallback((e: { target: EventTarget }) => {
    const t = (e.target as HTMLElement).closest?.('[role=tab]')?.id ?? ''
    const k = t.endsWith('-t-surat') ? 'surat' : t.endsWith('-t-tindak') ? 'tindak' : null
    if (!k) return
    const load = k === 'surat' ? loadLetters : loadFollowUps
    preloadNow(load)
    load().then(
      () => setWarm((w) => (w[k] ? w : { ...w, [k]: true })),
      () => undefined,
    )
  }, [])
  const opdOptions = useMemo(() => opds.map((o) => ({ value: o.id, label: opdLabel(o, o.id, lang) })), [opds, lang])
  const path = `naskah-pintar/${tab === 'rapat' ? 'rapat' : tab === 'surat' ? 'surat-masuk' : 'tindak-lanjut'}`

  const fallback = (
    <div className="dk-np-skel" aria-busy="true">
      <Skeleton height={44} />
      <Skeleton height={260} />
    </div>
  )

  return (
    <div className="dk-np" data-product={product} data-role={role}>
      {instr && (
        <aside className="dk-np-banner" role="status" aria-live="polite">
          <span className="dk-np-banner-ic" aria-hidden="true">
            <Icon name="stamp" size={18} />
          </span>
          <div className="dk-np-banner-txt">
            {/* the Regent reads it as his own instruction (sent from Meja Pimpinan), not as one "received" */}
            <b>{role === 'kepala-daerah' ? S.instrTitleMine(clockText(instr.at, lang)) : S.instrTitle}</b>
            <span>“{instr.text[lang]}”</span>
            <span className="dk-np-muted">{role === 'kepala-daerah' ? S.instrBodyMine(instrOpds, instr.actionItemIds.length) : S.instrBody(instrOpds, instr.actionItemIds.length)}</span>
          </div>
          <div className="dk-np-banner-act">
            {instr.letterId && (
              <Button size="sm" variant="primary" icon="doc" {...lettersIntent} onClick={() => go('surat', { letterId: instr.letterId ?? undefined })}>
                {S.instrOpen}
              </Button>
            )}
            <Button size="sm" variant="quiet" icon="kanban" {...followIntent} onClick={() => go('tindak', { itemId: instr.actionItemIds[0], opdIds: instr.opdIds })}>
              {S.instrTasks}
            </Button>
            <IconButton icon="close" label={S.dismiss} size="sm" onClick={() => setBanner(null)} />
          </div>
        </aside>
      )}
      <BrowserFrame
        path={path}
        label={S.frame}
        className="dk-np-frame"
        actions={
          <span className="dk-np-actions">
            {/* phones: the demo clock is the kit's top-bar clock chip (no second clock here) */}
            {role === 'kepala-opd' && shell.size !== 'sm' && (
              <label className="dk-np-unit">
                <span>{S.myUnit}</span>
                <Select value={opdPick} onChange={(e) => setOpdPick(e.target.value)} options={opdOptions} aria-label={S.myUnit} />
              </label>
            )}
            {shell.size === 'sm' ? (
              <IconButton icon="spark" label={S.askAi} onClick={() => setAskOpen(true)} data-np="ask" />
            ) : (
              <Button size="sm" variant="quiet" icon="spark" onClick={() => setAskOpen(true)} data-np="ask">
                {S.askAi}
              </Button>
            )}
          </span>
        }
      >
        <div className="dk-np-tabs" onPointerOver={warmTab} onPointerDown={warmTab} onFocus={warmTab} onTouchStart={warmTab}>
          <Tabs items={items} value={tab} onChange={pickTab} label={S.tabsLabel} fill={sm}>
            <div className="dk-np-rolenote">
              <Icon name="user" size={14} />
              <span>{S.roleNote[role]}</span>
              {role === 'kepala-opd' && shell.size === 'sm' && (
                <label className="dk-np-unit is-inline">
                  <span>{S.myUnit}</span>
                  <Select value={opdPick} onChange={(e) => setOpdPick(e.target.value)} options={opdOptions} aria-label={S.myUnit} />
                </label>
              )}
            </div>
            {role === 'kepala-daerah' && (
              <Suspense fallback={null}>
                <LeaderDesk nav={nav} compact={shown !== 'rapat'} />
              </Suspense>
            )}
            <div hidden={shown !== 'rapat'}>
              <Meeting nav={nav} />
            </div>
            {(warm.surat || shown === 'surat') && (
              <Activity mode={shown === 'surat' ? 'visible' : 'hidden'}>
                <Suspense fallback={fallback}>
                  <Letters nav={nav} focusLetter={focus.letterId ?? null} focusKey={focus.n} autoRead={!!focus.autoRead} />
                </Suspense>
              </Activity>
            )}
            {(warm.tindak || shown === 'tindak') && (
              <Activity mode={shown === 'tindak' ? 'visible' : 'hidden'}>
                <Suspense fallback={fallback}>
                  <FollowUps nav={nav} focusItem={focus.itemId ?? null} focusOpd={focus.opdId ?? null} focusOpds={focus.opdIds ?? null} focusLate={!!focus.lateOnly} focusKey={focus.n} />
                </Suspense>
              </Activity>
            )}
          </Tabs>
        </div>
      </BrowserFrame>
      {askOpen && (
        <Suspense fallback={null}>
          <Assistant open={askOpen} onClose={() => setAskOpen(false)} nav={nav} />
        </Suspense>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ guide */

export const missions: readonly Mission[] = [
  {
    id: 'putar-rapat',
    label: { id: 'Putar rapat contoh', en: 'Play the sample meeting' },
    hint: { id: 'Tab Rapat → “Putar rekaman contoh”. Notulen dan tindak lanjut menulis sendiri.', en: 'Meeting tab → “Play the sample recording”. Minutes and follow-ups write themselves.' },
    done: (e) => isEvent(e, 'meeting.transcribed') && e.source === 'naskah-pintar',
  },
  {
    id: 'ekspor-notulen',
    label: { id: 'Ekspor notulen resmi', en: 'Export the official minutes' },
    hint: { id: 'Setelah rapat: “Format tata naskah dinas” → “Cetak / Simpan PDF”.', en: 'After the meeting: “Official memo format” → “Print / Save as PDF”.' },
  },
  {
    id: 'disposisi-surat',
    label: { id: 'Disposisikan 1 surat', en: 'Disposition 1 letter' },
    /* the head title follows the world's region (a kota: Wali Kota / Mayor; a kabupaten: Bupati / Regent), read when
       the guide renders (it can render before the canvas has set the meeting region) */
    get hint() {
      const h = /^kota\s/i.test(world.get().region?.name ?? '') ? { id: 'Wali Kota', en: 'Mayor' } : { id: 'Bupati', en: 'Regent' }
      return { id: `Tab Surat Masuk (di HP: Surat) → pilih surat → “Baca & susun disposisi” → Ajukan ke Sekda → Setujui sebagai Sekda (atau Setujui sebagai ${h.id}).`, en: `Incoming tab (Letters on a phone) → pick a letter → “Read & draft disposition” → Submit to the Regional Secretary → Approve as the Regional Secretary (or Approve as the ${h.en}).` }
    },
    done: (e) => isEvent(e, 'letter.dispositioned') && e.source === 'naskah-pintar' && !e.payload.instructionId && !isAutoDisposition(e.payload.letterId),
  },
  {
    id: 'kirim-pengingat',
    label: { id: 'Kirim 1 pengingat', en: 'Send 1 reminder' },
    hint: { id: 'Tab Tindak Lanjut (di HP: Tugas) → kartu merah (lewat tenggat) → “Kirim pengingat”.', en: 'Follow-ups tab (Tasks on a phone) → a red (overdue) card → “Send reminder”.' },
    done: (e) => isEvent(e, 'actionItem.reminded') && e.source === 'naskah-pintar',
  },
]

export const hotspot = { target: '[data-hotspot="np-play"]', label: { id: 'Mulai di sini: putar rapat contoh', en: 'Start here: play the sample meeting' } }
