/**
 * demos/sapa-warga/arrivals.ts — the first minute feels like a working service desk: while the visitor reads the
 * first screen, three ordinary (simulated) complaints from other fictional residents trickle into the officer console
 * (≈ 6 s, 17 s, 29 s after the demo opens). They are natural background events (source 'clock', origin sapa-warga):
 * no toast, no mission, never a flood (so they cannot form a cluster), never a voice note. Their texts are this
 * product's own (not the seed templates), so they never repeat an older complaint word for word. While the world
 * clock is paused they wait (a paused world does not receive new complaints stamped with a frozen time).
 *
 * useAutoClock: a fresh visit starts the world clock at ×10, so the phone's status bar, the SLA timers and every
 * timestamp move from the first seconds (the visitor can pause it in the clock control).
 *
 * Off when: natural events are off (presenter mode), ?e2e=1 (deterministic tests), the Kepala Daerah summary role,
 * or this world already carries them (a reload, or another visit with the same saved world).
 */
import { useEffect } from 'react'
import { WORLD, clock, emit, naturalEventsOn, useWorldStatus, world, type Bi, type ComplaintCategory, type ComplaintChannel } from '../../demo-kit/world'
import { offsetKm } from './model'

const TAG = 'sw-arrive-'
const PLAN: { after: number; category: ComplaintCategory; text: Bi; channel: ComplaintChannel; urgency: 'rendah' | 'sedang' | 'tinggi' }[] = [
  {
    after: 6000, category: 'pju', channel: 'wa', urgency: 'sedang',
    text: { id: 'Lampu PJU di depan musala {d} berkedip lalu padam sejak Sabtu, jalan ke sawah gelap kalau subuh.', en: 'The street light in front of the prayer house in {d} flickered and went out on Saturday; the path to the fields is dark at dawn.' },
  },
  {
    after: 17000, category: 'jalan-rusak', channel: 'web', urgency: 'tinggi',
    text: { id: 'Aspal di tanjakan dekat balai desa {d} mengelupas, ada lubang sedalam kira-kira 15 cm di jalur sepeda anak sekolah.', en: 'The asphalt on the slope near the {d} village hall is peeling; a hole about 15 cm deep sits on the bike route school children use.' },
  },
  {
    after: 29000, category: 'air-bersih', channel: 'telepon', urgency: 'sedang',
    text: { id: 'Air PDAM di RT 04 {d} keruh kecokelatan sejak kemarin sore, belum bisa dipakai masak.', en: 'Piped water in RT 04, {d} has been brownish since yesterday afternoon and cannot be used for cooking.' },
  },
]
/** while the clock is paused an arrival waits and retries this often (ms) */
const RETRY_MS = 3000

/** true = done (emitted or not needed); false = retry later (paused clock) */
function arrive(i: number): boolean {
  const s = world.get()
  if (world.status() !== 'ready' || !naturalEventsOn()) return true
  if (!clock.get().running) return false
  const tag = `${TAG}${i}`
  if (s.complaints.ids.some((id) => s.complaints.byId[id]?.templateId === tag)) return true
  const personas = new Set(Object.values(s.meta.personas))
  const pool = s.citizens.ids.filter((id) => !personas.has(id))
  if (!pool.length) return true
  const c = s.citizens.byId[pool[(i * 7 + 3) % pool.length]!]!
  const p = PLAN[i]!
  const desa = s.region.kecamatan.find((k) => k.id === c.kecamatanId)?.desa.find((d) => d.id === c.desaId)?.name ?? ''
  const tx = p.text
  const text = tx.id.replace('{d}', desa)
  emit(
    'complaint.created',
    {
      citizenId: c.id, category: p.category, channel: p.channel, text, lang: 'id', summary: { id: text, en: tx.en.replace('{d}', desa) },
      kecamatanId: c.kecamatanId, desaId: c.desaId, coord: offsetKm(c.coord, 0.05 * (i + 1), -0.04 * i), urgency: p.urgency, photo: i === 1, templateId: tag,
    },
    'clock',
    { origin: 'sapa-warga' },
  )
  return true
}

export function useArrivals(on: boolean): void {
  const status = useWorldStatus()
  useEffect(() => {
    if (!on || status !== 'ready' || typeof window === 'undefined') return
    if (new URLSearchParams(window.location.search).get('e2e') === '1') return
    const timers = new Set<number>()
    const at = (i: number, ms: number) => {
      const id = window.setTimeout(() => {
        timers.delete(id)
        if (!arrive(i)) at(i, RETRY_MS)
      }, ms)
      timers.add(id)
    }
    PLAN.forEach((p, i) => at(i, p.after))
    return () => timers.forEach((x) => window.clearTimeout(x))
  }, [on, status])
}

let autoStarted = false
/**
 * Start the world clock at its default ×10 once per page load, on a fresh morning only: not for a shared link that
 * pins a time (?t), not in presenter mode or with natural events off, not in ?e2e=1 tests, and never over a clock the
 * visitor already set (running, or moved away from the 07.00 start).
 */
export function useAutoClock(on: boolean, pinned: boolean): void {
  const status = useWorldStatus()
  useEffect(() => {
    if (!on || autoStarted || status !== 'ready' || typeof window === 'undefined') return
    // a shared link that pins a time (?t) stays paused, unless this tab's own clock was running before (a reload)
    if (pinned && readRun() !== '1') return
    if (new URLSearchParams(window.location.search).get('e2e') === '1') return
    autoStarted = true
    const c = clock.get()
    if (c.running || !naturalEventsOn()) return
    // a fresh morning starts at ×10; after a reload (e.g. ?lang=en) a clock that was running when the page went away
    // runs again (the clock itself is not persisted, only the time)
    if (c.minutes === WORLD.clockStart || readRun() === '1') {
      clock.play()
      writeRun('1')
    }
  }, [on, pinned, status])
  /* remember whether the world clock is running, so a reload resumes it (a pause by the visitor is remembered too) */
  useEffect(() => {
    if (!on || typeof window === 'undefined') return
    let was = clock.get().running
    if (was) writeRun('1')
    return clock.subscribe(() => {
      const r = clock.get().running
      if (r === was) return
      was = r
      if (document.visibilityState === 'visible') writeRun(r ? '1' : '0')
    })
  }, [on])
}
const RUN_KEY = 'gamada:sw-clock-run'
function readRun(): string | null {
  try {
    return sessionStorage.getItem(RUN_KEY)
  } catch {
    return null
  }
}
function writeRun(v: string): void {
  try {
    sessionStorage.setItem(RUN_KEY, v)
  } catch {
    /* blocked storage: a reload simply starts paused */
  }
}
