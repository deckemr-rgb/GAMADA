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
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import type { DemoCanvasProps } from '../registry'
import type { Mission } from '../../demo-kit/shell'
import { useShell } from '../../demo-kit/shell'
import { BrowserFrame } from '../../demo-kit/frames'
import { Button, Icon, IconButton, Select, Skeleton, Tabs } from '../../demo-kit/ui'
import { isEvent, onEvent, shallowEqual, useClock, useSession, useWorld, type ActionItem, type WorldState } from '../../demo-kit/world'
import { useI18n } from '../../lib/i18n'
import { Meeting } from './Meeting'
import { NP, npRole, opdName, type NpRole } from './model'
import { opdLabel, useStr } from './strings'
import './naskah-pintar.css'

const Letters = lazy(() => import('./Letters'))
const FollowUps = lazy(() => import('./FollowUps'))
const Assistant = lazy(() => import('./Assistant'))
const preloadLetters = () => void import('./Letters').catch(() => undefined)
const preloadFollow = () => void import('./FollowUps').catch(() => undefined)

export type NpTab = 'rapat' | 'surat' | 'tindak'

/** shared navigation between the tabs (lanes → board, banner → memo, toasts → tab) */
export interface NpNav {
  tab: NpTab
  go: (tab: NpTab, focus?: { letterId?: string; itemId?: string; opdId?: string }) => void
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
  const { role: sessionRole } = useSession()
  const role = npRole(sessionRole)
  const now = useClock().minutes
  const [tab, setTab] = useState<NpTab>('rapat')
  const [opdPick, setOpdPick] = useState<string>(NP.defaultOpd)
  const myOpd = role === 'kepala-opd' ? opdPick : null
  const [focus, setFocus] = useState<{ letterId?: string; itemId?: string; opdId?: string; n: number }>({ n: 0 })
  const [askOpen, setAskOpen] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)
  const c = useWorld((s) => counts(s, now, myOpd), shallowEqual)
  const opds = useWorld((s) => s.region.opd)
  const instr = useWorld((s) => (banner ? s.instructions.byId[banner] : undefined))
  const instrOpds = useWorld((s) => (instr ? instr.opdIds.map((o) => opdName(s, o, lang)).join(', ') : ''))

  const go = useCallback<NpNav['go']>((t, f) => {
    setTab(t)
    if (f) setFocus((p) => ({ ...f, n: p.n + 1 }))
  }, [])
  const nav = useMemo<NpNav>(() => ({ tab, go, role, myOpd }), [tab, go, role, myOpd])

  /* instructions from Meja Pimpinan: announce them here (their memo + tasks are created by world reactions) */
  useEffect(() => onEvent('instruction.issued', (e) => setBanner(e.payload.id ?? null)), [])

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

  const items = useMemo(
    () => [
      { id: 'rapat' as const, label: S.tabMeeting, icon: 'mic' as const },
      { id: 'surat' as const, label: S.tabLetters, icon: 'inbox' as const, badge: c.pending },
      { id: 'tindak' as const, label: S.tabFollow, icon: 'kanban' as const, badge: c.late },
    ],
    [S, c.pending, c.late],
  )
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
            <b>{S.instrTitle}</b>
            <span>“{instr.text[lang]}”</span>
            <span className="dk-np-muted">{S.instrBody(instrOpds, instr.actionItemIds.length)}</span>
          </div>
          <div className="dk-np-banner-act">
            {instr.letterId && (
              <Button size="sm" variant="primary" icon="doc" onClick={() => go('surat', { letterId: instr.letterId ?? undefined })} onPointerEnter={preloadLetters}>
                {S.instrOpen}
              </Button>
            )}
            <Button size="sm" variant="quiet" icon="kanban" onClick={() => go('tindak', { itemId: instr.actionItemIds[0] })} onPointerEnter={preloadFollow}>
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
            {role === 'kepala-opd' && (
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
        <div className="dk-np-tabs" onPointerOver={(e) => {
          const t = (e.target as HTMLElement).closest('[role=tab]')?.textContent ?? ''
          if (t.includes(S.tabLetters)) preloadLetters()
          else if (t.includes(S.tabFollow)) preloadFollow()
        }}>
          <Tabs items={items} value={tab} onChange={setTab} label={S.tabsLabel}>
            <p className="dk-np-rolenote">
              <Icon name="user" size={14} />
              {S.roleNote[role]}
            </p>
            <div hidden={tab !== 'rapat'}>
              <Meeting nav={nav} />
            </div>
            {tab === 'surat' && (
              <Suspense fallback={fallback}>
                <Letters nav={nav} focusLetter={focus.letterId ?? null} focusKey={focus.n} />
              </Suspense>
            )}
            {tab === 'tindak' && (
              <Suspense fallback={fallback}>
                <FollowUps nav={nav} focusItem={focus.itemId ?? null} focusOpd={focus.opdId ?? null} focusKey={focus.n} />
              </Suspense>
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
    hint: { id: 'Tab Surat Masuk → pilih surat → “Baca & susun disposisi” → Setujui (peran Sekretariat atau Kepala Daerah).', en: 'Incoming tab → pick a letter → “Read & draft disposition” → Approve (Secretariat or Regional Head role).' },
    done: (e) => isEvent(e, 'letter.dispositioned') && e.source === 'naskah-pintar' && !e.payload.instructionId,
  },
  {
    id: 'kirim-pengingat',
    label: { id: 'Kirim 1 pengingat', en: 'Send 1 reminder' },
    hint: { id: 'Tab Tindak Lanjut → kartu merah (lewat tenggat) → “Kirim pengingat”.', en: 'Follow-ups tab → a red (overdue) card → “Send reminder”.' },
    done: (e) => isEvent(e, 'actionItem.reminded') && e.source === 'naskah-pintar',
  },
]

export const hotspot = { target: '[data-hotspot="np-play"]', label: { id: 'Mulai di sini: putar rapat contoh', en: 'Start here: play the sample meeting' } }
