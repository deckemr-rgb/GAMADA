/**
 * Jadwal Shift — shiftPlan of the outlet on the WeekGrid (traffic shading from hourlyTraffic, flood days raise it),
 * the extra blocks the traffic asks for ("+1 kasir 13.00–17.00") with their reason, moves → shift.updated. The new
 * cashier's block carries "Sedang coaching di Juara Jualan" while a coaching for that agent exists (L4).
 */
import { useEffect, useMemo, useState } from 'react'
import AppLink from '../../components/AppLink'
import { demoHref, useShell } from '../../demo-kit/shell'
import { DEMO_READY } from '../registry'
import { Button, Icon, Segmented, flashNewRow } from '../../demo-kit/ui'
import { emit, rows, useClock, useSession, useWorld } from '../../demo-kit/world'
import { STAFF_JOB, hourlyTraffic, shiftPlan, type ExtraBlock } from '../../demo-kit/world/usaha-pintar'
import { SLUG, hhmmL, useT } from './strings'
import WeekGrid, { type GridBlock } from './WeekGrid'
import type { TabProps } from './types'
import { useOutlets } from './store'

const S = {
  id: {
    title: 'Jadwal shift minggu ini', grid: 'Jadwal shift per hari dan jam', hint: 'Seret, atau pilih lalu pakai panah / ketuk slot jam untuk memindah.', day: 'Pilih hari',
    extra: (a: string, b: string) => `+1 kasir ${a}–${b}`, why: 'Kenapa perlu kasir tambahan?', add: 'Tambahkan ke jadwal', added: 'Sudah ada di jadwal',
    coaching: 'Sedang coaching di Juara Jualan', coachLink: 'Lihat coaching', coachSoon: '(Juara Jualan, demo tahap 3)', slot: (d: string, h: number) => `Pindah ke ${d} pukul ${String(h).padStart(2, '0')}.00`,
    moved: (n: string, d: string, a: string) => `${n} dipindah ke ${d} ${a}`, sel: (n: string) => `${n} dipilih. Panah memindah 1 hari / 1 jam, atau ketuk slot jam.`, legend: 'Warna sel = perkiraan pembeli per jam (simulasi)',
    rationale: (n: string, d: string, a: string, b: string) => `Saran: ${n} menambah jaga ${d} ${a}–${b} supaya antrean di kasir tidak lewat 2 pembeli per petugas.`,
  },
  en: {
    title: 'This week’s shift schedule', grid: 'Shift schedule by day and hour', hint: 'Drag, or select then use arrows / tap an hour slot to move.', day: 'Pick a day',
    extra: (a: string, b: string) => `+1 cashier ${a}–${b}`, why: 'Why an extra cashier?', add: 'Add to schedule', added: 'Already on the schedule',
    coaching: 'In coaching at Juara Jualan', coachLink: 'See coaching', coachSoon: '(Juara Jualan, stage 3 demo)', slot: (d: string, h: number) => `Move to ${d} at ${String(h).padStart(2, '0')}:00`,
    moved: (n: string, d: string, a: string) => `${n} moved to ${d} ${a}`, sel: (n: string) => `${n} selected. Arrows move it 1 day / 1 hour, or tap an hour slot.`, legend: 'Cell shade = expected customers per hour (simulated)',
    rationale: (n: string, d: string, a: string, b: string) => `Suggestion: ${n} adds a ${d} ${a}–${b} shift so the checkout queue stays under 2 customers per person.`,
  },
}
const keep = () => (new URLSearchParams(window.location.search).get('controls') === 'all' ? '&controls=all' : '')

export default function Shifts({ outletId: picked0, outKey, sel }: TabProps) {
  const { lang, t: T } = useT()
  const t = S[lang]
  const shell = useShell()
  const session = useSession()
  const sm = shell.size === 'sm'
  const now = useClock().minutes
  const outs = useOutlets()
  // "Semua": the outlet whose traffic asks for an extra cashier (else the toko)
  const outletId = useWorld((s) => (outKey === 'semua' ? ([outs.toko, outs.kopi, outs.warung].find((id) => id && shiftPlan(s, id, now).extra.length) ?? picked0) : picked0))
  const plan = useWorld((s) => shiftPlan(s, outletId, now))
  const traffic = useWorld((s) => hourlyTraffic(s, outletId))
  const staff = useWorld((s) => s.staff)
  const outlet = useWorld((s) => s.outlets.byId[outletId])
  const coach = useWorld((s) => {
    const a = s.meta.facts.up?.newCashierAgentId
    return a && rows(s.coachings).some((c) => c.agentId === a) ? (s.meta.facts.up?.newCashierStaffId ?? '') : ''
  })
  const today = useWorld((s) => (new Date(`${s.day}T00:00:00Z`).getUTCDay() + 6) % 7)
  const [picked, setPicked] = useState<string | null>(null)
  const [why, setWhy] = useState<ExtraBlock | null>(null)
  const [day, setDay] = useState(today)
  const [said, setSaid] = useState('')
  useEffect(() => {
    if (sel?.kind !== 'staff') return
    const b = plan.blocks.find((x) => x.staffId === sel.id && x.day === today) ?? plan.blocks.find((x) => x.staffId === sel.id)
    if (!b) return
    setPicked(b.id)
    setDay(b.day)
    const tm = window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-shift="${CSS.escape(b.id)}"]`)
      if (el) {
        el.scrollIntoView({ block: 'nearest' })
        flashNewRow(el)
      }
    }, 60)
    return () => window.clearTimeout(tm)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel])
  const { markMission } = shell
  useEffect(() => {
    if (why) markMission('shift')
  }, [why, markMission])

  const blocks: GridBlock[] = useMemo(
    () =>
      plan.blocks.map((b) => {
        const st = staff.byId[b.staffId]
        return {
          id: b.id, day: b.day, start: b.start, end: b.end, label: st?.name.split(' ')[0] ?? b.staffId, sub: st ? STAFF_JOB[st.job]?.[lang] : undefined,
          ...(coach && b.staffId === coach ? { badge: t.coaching, tone: 'new' as const } : st?.isNew ? { tone: 'new' as const } : {}),
        }
      }),
    [plan.blocks, staff, coach, lang, t],
  )
  const extra = plan.extra.map((x, i) => ({ key: `x${i}`, day: x.day, start: x.start, end: x.end, label: t.extra(hhmmL(x.start, lang), hhmmL(x.end, lang)) }))
  const h0 = Math.floor((outlet?.opensAt ?? 420) / 60)
  const h1 = Math.ceil((outlet?.closesAt ?? 1020) / 60)
  const move = (id: string, d: number, start: number) => {
    const b = plan.blocks.find((x) => x.id === id)
    if (!b) return
    const len = b.end - b.start
    const s0 = Math.min(h1 * 60 - len, Math.max(h0 * 60, start))
    const dd = Math.min(6, Math.max(0, d))
    if (dd === b.day && s0 === b.start) return
    emit('shift.updated', { shiftId: id, staffId: b.staffId, outletId, day: dd, start: s0, end: s0 + len }, SLUG)
    setSaid(t.moved(staff.byId[b.staffId]?.name ?? '', T.days[dd]!, hhmmL(s0, lang)))
    if (sm) setDay(dd)
  }
  const ex = why ?? undefined
  const exStaff = ex?.staffId ? staff.byId[ex.staffId] : undefined
  const exAdded = !!ex && plan.blocks.some((b) => b.staffId === ex.staffId && b.day === ex.day && b.start <= ex.start && b.end >= ex.end)
  const days = sm ? [{ label: T.days[day]!, index: day }] : T.days.map((label, index) => ({ label, index }))
  return (
    <div className="dk-ta-grid">
      <p className="dk-sr" role="status" aria-live="polite">{said}</p>
      <section className="dk-ta-card" aria-labelledby="dk-ta-shift-h">
        <header className="dk-ta-ch">
          <h3 id="dk-ta-shift-h">
            {t.title} · {outlet?.name}
          </h3>
          <span className="dk-ta-sim">{T.sim}</span>
        </header>
        <p className="dk-ta-muted">
          {t.legend} · {picked ? t.sel(blocks.find((b) => b.id === picked)?.label ?? '') : t.hint}
        </p>
        {sm && (
          <Segmented size="sm" className="dk-ta-days" label={t.day} value={String(day)} onChange={(v) => setDay(Number(v))} options={T.days.map((d, i) => ({ value: String(i), label: d }))} />
        )}
        <WeekGrid
          days={days}
          h0={h0}
          h1={h1}
          traffic={traffic}
          blocks={blocks}
          extra={extra}
          selected={picked}
          today={today}
          label={t.grid}
          hint={t.hint}
          onSelect={setPicked}
          onMove={move}
          onExtra={(k) => setWhy(plan.extra[Number(k.slice(1))] ?? null)}
          slotLabel={t.slot}
        />
      </section>
      {ex && (
        <section className="dk-ta-card dk-ta-why2" aria-labelledby="dk-ta-why-h" data-ta="extra-why">
          <header className="dk-ta-ch">
            <h3 id="dk-ta-why-h">{t.why}</h3>
          </header>
          <p>{ex.reason[lang]}</p>
          {exStaff && <p>{t.rationale(exStaff.name, T.days[ex.day]!, hhmmL(ex.start, lang), hhmmL(ex.end, lang))}</p>}
          {exAdded ? (
            <p className="dk-ta-ok">
              <Icon name="check" size={16} /> {t.added}
            </p>
          ) : (
            exStaff && (
              <Button size="sm" variant="primary" icon="plus" onClick={() => emit('shift.updated', { staffId: exStaff.id, outletId, day: ex.day, start: ex.start, end: ex.end }, SLUG)} data-ta="extra-add">
                {t.add}
              </Button>
            )
          )}
        </section>
      )}
      {coach && (
        <p className="dk-ta-coach" data-ta="coach-badge">
          <Icon name="juara" size={18} /> {staff.byId[coach]?.name}: {t.coaching}{' '}
          {DEMO_READY['juara-jualan'] ? <AppLink to={demoHref('juara-jualan', session, coach) + keep()}>{t.coachLink}</AppLink> : <span className="dk-ta-muted">{t.coachSoon}</span>}
        </p>
      )}
    </div>
  )
}
