/**
 * demos/sapa-warga/triage.ts — the AI's emergency triage (simulated rule). A complaint about life safety (someone to
 * evacuate, trapped, a boat needed; see isEmergency) is not left in "Baru" with a public-works SLA: one minute after
 * it arrives the triage forwards it straight to BPBD (Pusdalops) with the category's own agency copied in, and the
 * console labels it Darurat with a 1-hour response target. The step is a normal world event (ticket.statusChanged,
 * source 'clock', origin sapa-warga, stamped at arrival + 1 min) so the history, the KPIs and Meja Pimpinan agree.
 *
 * Off in ?e2e=1 (deterministic tests) and while the world is not ready.
 */
import { useEffect } from 'react'
import { clock, emit, isEvent, onEvent, rows, useWorldStatus, world, type WorldState } from '../../demo-kit/world'
import { isEmergency, opdShort } from './model'

export const TRIAGE_NOTE_PREFIX = 'Triase darurat AI'

function bpbdId(s: WorldState): string | null {
  return s.region.opd.find((o) => o.id === 'bpbd' || /\bBPBD\b/.test(o.short))?.id ?? null
}

/** forward every open life-safety ticket still waiting in "Baru" (never one that is not yet due in world time) */
function sweep(only?: string): void {
  const s = world.get()
  const bpbd = bpbdId(s)
  if (!bpbd) return
  for (const tk of rows(s.tickets)) {
    if (only && tk.id !== only) continue
    if (tk.status !== 'baru') continue
    const c = s.complaints.byId[tk.complaintId]
    if (!c || !isEmergency(c)) continue
    const cc = tk.opdId && tk.opdId !== bpbd ? opdShort(s, tk.opdId) : ''
    emit(
      'ticket.statusChanged',
      { ticketId: tk.id, status: 'diteruskan', opdId: bpbd, note: `${TRIAGE_NOTE_PREFIX}: keselamatan jiwa → BPBD (Pusdalops)${cc ? ` · tembusan ${cc}` : ''}` },
      'clock',
      { at: Math.max(c.at, Math.min(c.at + 1, clock.get().minutes)), origin: 'sapa-warga' },
    )
  }
}

export function useEmergencyTriage(): void {
  const status = useWorldStatus()
  useEffect(() => {
    if (status !== 'ready' || typeof window === 'undefined') return
    if (new URLSearchParams(window.location.search).get('e2e') === '1') return
    sweep()
    return onEvent('complaint.created', (e) => {
      if (!isEvent(e, 'complaint.created')) return
      const id = e.payload.ticketId
      if (id) window.setTimeout(() => sweep(id), 0)
    })
  }, [status])
}

/** "Triase darurat AI: …" → the bilingual line for the history */
export function triageNoteText(note: string, lang: 'id' | 'en'): string | null {
  if (!note.startsWith(TRIAGE_NOTE_PREFIX)) return null
  // the actor line already says "Triase AI": the note keeps only what happened
  if (lang === 'id') return note.slice(TRIAGE_NOTE_PREFIX.length).replace(/^:\s*/, '')
  const cc = /tembusan (.+)$/.exec(note)?.[1]
  return `life safety → BPBD (emergency operations)${cc ? ` · copy to ${cc}` : ''}`
}
