/**
 * naskah-pintar/day.ts — the working day moves on while the world clock runs or jumps (scenario events, simulated):
 * the agencies start and finish the flood meeting's follow-ups at plausible times, two older tasks get closed, and
 * the Regent's office sends a memo about the pumps (instruction.issued → memo in Surat Masuk + a task, through the
 * world reactions). A step fires once the clock has passed its time; it reads the world first (a follow-up that does
 * not exist yet, or is already further along, is skipped), so replays, reloads and jumps never double anything.
 * Events carry their scheduled time, so the audit log reads 08.15, 10.00 … even after a jump to 17.00.
 * Something happens within the first minutes (07.05–07.12), so a clock that is started at once shows the day moving.
 * The pump matter is one thread: the Regent's 09.15 memo also settles PUPR's pump memo in the inbox, and when the
 * pumps arrive (13.30) every open PUPR pump task of the day closes (meeting follow-up, the memo's task, a letter task).
 */
import { DAY_MIN, emit, world, type ActionItem, type Bi, type WorldState } from '../../demo-kit/world'
import { SCRIPT, existingAction, sampleMeeting } from './model'
import { getTrail, setTrail } from './trail'

type Status = ActionItem['status']

export interface DayNote {
  /** strings key (dayNotes) or a seeded task started / finished by its agency */
  key: string
  seed?: { title: Bi; opdId: string; start?: boolean }
}

interface Step {
  at: number
  key: string
  run: (s: WorldState, at: number) => DayNote | null
}

const ORDER: Record<Status, number> = { baru: 0, proses: 1, selesai: 2 }

/** what already fired (the world write lands a frame later: a second clock tick must not repeat it) */
const fired = new Set<string>()
const once = (k: string) => (fired.has(k) ? false : (fired.add(k), true))

/** move one of the meeting's follow-ups (script key) forward to `to` */
function meetingStep(at: number, action: string, to: Status, note: string): Step {
  return {
    at,
    key: `${action}:${to}`,
    run: (s, t) => {
      const m = sampleMeeting(s)
      const a = SCRIPT.actions.find((x) => x.key === action)
      const item = m && a ? existingAction(s, m.id, a.text) : undefined
      if (!item || ORDER[item.status] >= ORDER[to] || !once(`${item.id}:${to}`)) return null
      emit('actionItem.statusChanged', { actionItemId: item.id, status: to }, 'naskah-pintar', { at: Math.max(t, item.createdAt) })
      return { key: note }
    },
  }
}

/** an agency closes its oldest overdue task from an earlier meeting (one per step, never one of the flood meeting) */
const closedSeed = new Map<string, string>()
function seedStep(at: number, key: string): Step {
  return {
    at,
    key,
    run: (s, t) => {
      const mk = `${s.day}:${key}`
      if (closedSeed.has(mk)) return null
      const sample = sampleMeeting(s)?.id
      const taken = new Set(closedSeed.values())
      const pick = s.actionItems.ids
        .map((id) => s.actionItems.byId[id])
        .filter((a): a is ActionItem => !!a && a.status !== 'selesai' && a.source.kind === 'meeting' && a.source.id !== sample && a.dueAt < t && !taken.has(a.opdId))
        .sort((a, b) => a.dueAt - b.dueAt || a.id.localeCompare(b.id))[0]
      if (!pick) return null
      closedSeed.set(mk, pick.opdId)
      emit('actionItem.statusChanged', { actionItemId: pick.id, status: 'selesai' }, 'naskah-pintar', { at: t })
      return { key, seed: { title: pick.title, opdId: pick.opdId } }
    },
  }
}

/** early in the day an agency picks up its oldest overdue task from an earlier meeting (Baru → Diproses) */
const startedSeed = new Set<string>()
function seedStartStep(at: number, key: string): Step {
  return {
    at,
    key,
    run: (s, t) => {
      const mk = `${s.day}:${key}`
      if (startedSeed.has(mk)) return null
      const sample = sampleMeeting(s)?.id
      const pick = s.actionItems.ids
        .map((id) => s.actionItems.byId[id])
        .filter((a): a is ActionItem => !!a && a.status === 'baru' && a.source.kind === 'meeting' && a.source.id !== sample && a.dueAt < t)
        .sort((a, b) => a.dueAt - b.dueAt || a.id.localeCompare(b.id))[0]
      if (!pick) return null
      startedSeed.add(mk)
      emit('actionItem.statusChanged', { actionItemId: pick.id, status: 'proses' }, 'naskah-pintar', { at: t })
      return { key, seed: { title: pick.title, opdId: pick.opdId, start: true } }
    },
  }
}

/** today's open PUPR tasks about the pumps (meeting follow-up 2, the Regent's memo task, a pump-letter disposition) */
const PUMP = /pompa|pump/i
export function pumpTasks(s: WorldState): ActionItem[] {
  return s.actionItems.ids
    .map((id) => s.actionItems.byId[id])
    .filter((a): a is ActionItem => !!a && a.opdId === 'pupr' && a.createdAt >= 0 && a.createdAt < DAY_MIN && PUMP.test(a.title.id))
}

/** 13.30: the loaned pumps arrive — every open pump task of the day closes together (no "overdue" after arrival) */
const pumpStep: Step = {
  at: 13 * 60 + 30,
  key: 'pumps',
  run: (s, t) => {
    const open = pumpTasks(s).filter((a) => a.status !== 'selesai' && once(`${a.id}:pumps`))
    if (!open.length) return null
    for (const a of open) emit('actionItem.statusChanged', { actionItemId: a.id, status: 'selesai' }, 'naskah-pintar', { at: Math.max(t, a.createdAt) })
    const viaInstr = open.some((a) => a.source.kind === 'instruction')
    return { key: viaInstr ? 'a2i' : 'a2' }
  },
}

/** letters settled by the Regent's 09.15 memo (not a disposition made in this product: no mission credit) */
const autoDispo = new Set<string>()
export const isAutoDisposition = (letterId: string | undefined): boolean => !!letterId && autoDispo.has(letterId)
const PUMP_MEMO_NO = '600/1189/412.205/2026'
/** the PUPR memo asking for pumps is answered by the Regent's instruction: it leaves "Perlu disposisi" with a note */
function settlePumpMemo(at: number): void {
  void import('./inbox')
    .then(({ rowsOf, sampleMap }) => import('../../demo-kit/world/satu-daerah').then(({ letterInbox }) => ({ rowsOf, sampleMap, letterInbox })))
    .then(({ rowsOf, sampleMap, letterInbox }) => {
      const s = world.get()
      const letters = letterInbox(s)
      const row = rowsOf(letters, sampleMap(letters)).find((r) => r.number === PUMP_MEMO_NO)
      if (!row || row.letter.status !== 'masuk' || autoDispo.has(row.letter.id)) return
      autoDispo.add(row.letter.id)
      setTrail(s.day, row.letter.id, { ...getTrail(s.day, row.letter.id), viaInstrAt: at })
      emit(
        'letter.dispositioned',
        {
          letterId: row.letter.id,
          subject: row.subject,
          number: row.number,
          from: row.from,
          to: ['pupr'],
          note: {
            id: 'Ditindaklanjuti lewat instruksi Kepala Daerah pukul 09.15: pastikan 4 pompa pinjam pakai tiba di lokasi genangan sebelum pukul 14.00.',
            en: 'Handled through the Regional Head’s 09:15 instruction: make sure the 4 loaned pumps reach the flooded area before 14:00.',
          },
          by: 'Bupati',
        },
        'naskah-pintar',
        { at },
      )
    })
    .catch(() => undefined)
}

/** the Regent's memo about the pumps (decision 2 of the meeting): once per day */
export const PUMP_INSTRUCTION: Bi = {
  id: 'Pastikan 4 pompa pinjam pakai dari balai wilayah sungai tiba di lokasi genangan sebelum pukul 14.00 dan laporkan hasilnya.',
  en: 'Make sure the 4 pumps on loan from the river basin office reach the flooded area before 14:00 and report back.',
}
const instructionStep: Step = {
  at: 9 * 60 + 15,
  key: 'instr',
  run: (s, t) => {
    if (s.instructions.ids.some((id) => s.instructions.byId[id]?.text.id === PUMP_INSTRUCTION.id)) return null
    if (!s.region.opd.some((o) => o.id === 'pupr') || !once(`${s.day}:instr`)) return null
    emit('instruction.issued', { text: PUMP_INSTRUCTION, opdIds: ['pupr'], dueAt: 14 * 60 }, 'naskah-pintar', { at: t })
    settlePumpMemo(t)
    return { key: 'instr' }
  },
}

/** the day's scenario, in time order */
const STEPS: Step[] = [
  meetingStep(7 * 60 + 5, 'a4', 'proses', 'a4p'),
  seedStartStep(7 * 60 + 8, 'seedStart'),
  meetingStep(7 * 60 + 12, 'a5', 'proses', 'a5p'),
  meetingStep(8 * 60 + 15, 'a1', 'proses', 'a1p'),
  seedStep(9 * 60, 'seed1'),
  instructionStep,
  meetingStep(10 * 60 - 5, 'a4', 'selesai', 'a4'),
  meetingStep(11 * 60, 'a3', 'proses', 'a3p'),
  pumpStep,
  seedStep(14 * 60, 'seed2'),
  meetingStep(14 * 60 + 40, 'a5', 'selesai', 'a5'),
  meetingStep(15 * 60 + 30, 'a6', 'selesai', 'a6'),
  meetingStep(15 * 60 + 45, 'a1', 'selesai', 'a1'),
  meetingStep(16 * 60 + 40, 'a3', 'selesai', 'a3'),
]

/** run every step whose time has come (each one at most once); returns what happened, for one toast */
export function runDay(now: number): DayNote[] {
  if (world.status() !== 'ready' || now >= DAY_MIN) return []
  const out: DayNote[] = []
  for (const st of STEPS) {
    if (st.at > now) break
    const note = st.run(world.get(), st.at)
    if (note) out.push(note)
  }
  return out
}
