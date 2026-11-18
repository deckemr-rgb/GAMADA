/**
 * Calendar.tsx (lazy) — Kalender pajak: the shop's deadlines (taxCalendar: setor the 15th, SPT Masa PPh 21 the 20th,
 * SPT Tahunan OP 31 March) on a MonthCalendar, the list with THE amount of each item (same number as Ekspor and
 * Tanya Pajak), "Ingatkan saya" (a local reminder: chip + toast at world H-3, no world event), an .ics download.
 * ?focus=<tax item id> highlights the item; from TenderPilot a banner names the tender that asked for it.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useShell } from '../../demo-kit/shell'
import { Button, Chip, Icon, MonthCalendar, flashNewRow, icsFor, type CalendarEvent } from '../../demo-kit/ui'
import { DAY_MIN, clock, useClock, useWorld, world, type WorldState } from '../../demo-kit/world'
import { TAX_STATUS, taxCalendar, type TaxEvent } from '../../demo-kit/world/usaha-pintar'
import { computePphFinal } from './actions'
import { REMIND_DAYS, SOURCES } from './rules'
import { dateText, download, isoOf, latestShopTender, rp, taxAmountOf, type TabId } from './model'
import { useT } from './strings'

const S = {
  id: {
    title: 'Kalender pajak',
    calLabel: { id: 'Kalender tenggat pajak', en: 'Tax deadline calendar' },
    list: 'Tenggat',
    ics: 'Unduh .ics',
    remind: 'Ingatkan saya',
    reminded: (d: string) => `Diingatkan ${d}`,
    remindToast: (l: string, d: string) => `Pengingat dipasang: ${l}, muncul ${d} (H-${REMIND_DAYS}).`,
    remindBody: 'Disimpan di peramban ini saja, tidak dikirim ke mana pun (simulasi).',
    dueToast: (l: string) => `Tenggat sudah dekat: ${l}`,
    compute: 'Hitung sekarang',
    openPph21: 'Hitung di tab PPh 21',
    est: 'estimasi',
    noAmount: 'tanpa setoran',
    tp: (t: string) => `Diminta TenderPilot · ${t}`,
    tpBody: 'TenderPilot memeriksa syarat "status pajak" untuk tender ini. Tandai siap lapor di tab Ekspor.',
    source: 'Sumber aturan',
    selected: (d: string, n: number) => (n ? `${d}: ${n} tenggat` : `${d}: tidak ada tenggat`),
    calName: 'Pajak Beres (simulasi)',
  },
  en: {
    title: 'Tax calendar',
    calLabel: { id: 'Kalender tenggat pajak', en: 'Tax deadline calendar' },
    list: 'Deadlines',
    ics: 'Download .ics',
    remind: 'Remind me',
    reminded: (d: string) => `Reminder ${d}`,
    remindToast: (l: string, d: string) => `Reminder set: ${l}, shows on ${d} (${REMIND_DAYS} days before).`,
    remindBody: 'Kept in this browser only, sent nowhere (simulation).',
    dueToast: (l: string) => `Deadline is close: ${l}`,
    compute: 'Compute now',
    openPph21: 'Compute in the PPh 21 tab',
    est: 'estimate',
    noAmount: 'no payment',
    tp: (t: string) => `Requested by TenderPilot · ${t}`,
    tpBody: 'TenderPilot checks the "tax status" requirement for this tender. Mark the period ready in the Export tab.',
    source: 'Rule source',
    selected: (d: string, n: number) => (n ? `${d}: ${n} deadlines` : `${d}: no deadline`),
    calName: 'Pajak Beres (simulated)',
  },
}

const calSel = (s: WorldState) => s.taxItems

export default function Calendar({ focusItem, fromTp, onTab, onFocusDone }: { focusItem: string | null; fromTp: boolean; onTab: (t: TabId) => void; onFocusDone: () => void }) {
  const { lang } = useT()
  const L = S[lang]
  const { toast } = useShell()
  const now = useClock().minutes
  const items = useWorld(calSel)
  const day = useWorld((s) => s.day)
  const events = useMemo(() => {
    const s = world.get()
    return taxCalendar(s, s.meta.shopId, Math.floor(now / DAY_MIN) * DAY_MIN)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, Math.floor(now / DAY_MIN)])
  const tender = useWorld((s) => (fromTp ? (latestShopTender(s)?.title ?? null) : null))
  const [reminders, setReminders] = useState<Set<string>>(new Set())
  const [picked, setPicked] = useState<string>('')
  const listRef = useRef<HTMLUListElement>(null)
  const firedRef = useRef<Set<string>>(new Set())
  const iso = (at: number) => isoOf({ day } as WorldState, at)
  const upcoming = events.filter((e) => e.at >= 0 || e.status === 'perlu-hitung')
  const first = upcoming.find((e) => e.tone !== 'done') ?? upcoming[0]
  const month = first ? iso(first.at).slice(0, 7) : day.slice(0, 7)
  const calEvents: CalendarEvent[] = useMemo(() => events.map((e) => ({ id: e.id, at: iso(e.at), label: e.label, tone: e.tone === 'done' ? 'done' : e.tone })), [events, day])

  // reminders fire when the world clock reaches H-3 (a jump of the clock, or right away when already inside it)
  useEffect(() => {
    const check = () => {
      const m = clock.get().minutes
      for (const id of reminders) {
        const e = events.find((x) => x.id === id)
        if (!e || firedRef.current.has(id) || m < e.at - REMIND_DAYS * DAY_MIN) continue
        firedRef.current.add(id)
        toast({ title: L.dueToast(e.label[lang]), tone: 'warn', icon: 'bell' })
      }
    }
    check()
    return clock.subscribe(check)
  }, [reminders, events, toast, L, lang])

  // ?focus=<tax item id>
  useEffect(() => {
    if (!focusItem) return
    const tm = window.setTimeout(() => {
      const el = listRef.current?.querySelector<HTMLElement>(`[data-tax="${CSS.escape(focusItem)}"]`)
      if (el) {
        el.scrollIntoView({ block: 'center' })
        el.classList.add('is-focus')
        flashNewRow(el)
      }
      onFocusDone()
    }, 60)
    return () => window.clearTimeout(tm)
  }, [focusItem, onFocusDone])

  const remind = (e: TaxEvent) => {
    setReminders((r) => {
      const n = new Set(r)
      if (n.has(e.id)) n.delete(e.id)
      else {
        n.add(e.id)
        toast({ title: L.remindToast(e.label[lang], dateText(iso(e.at - REMIND_DAYS * DAY_MIN), lang)), body: L.remindBody, tone: 'accent', icon: 'bell' })
      }
      return n
    })
  }
  const pickedEvents = picked ? calEvents.filter((e) => e.at === picked) : []

  return (
    <div className="dk-pb-cal">
      {fromTp && tender && (
        <div className="dk-pb-tp" role="status" data-pb="tp-banner">
          <Icon name="tender" size={18} />
          <p>
            <strong>{L.tp(tender[lang])}</strong>
            <span>{L.tpBody}</span>
          </p>
        </div>
      )}
      <div className="dk-pb-cal-grid">
        <div>
          <MonthCalendar month={month} today={day} events={calEvents} label={L.calLabel} onSelect={(d) => setPicked(d)} />
          <p className="dk-pb-muted" aria-live="polite">
            {picked ? L.selected(dateText(picked, lang), pickedEvents.length) : ''}
          </p>
          <Button size="sm" variant="secondary" icon="download" onClick={() => download('pajak-beres-tenggat.ics', icsFor(calEvents.filter((e) => e.tone !== 'done'), { lang, calName: L.calName }), 'text/calendar')} data-pb="ics">
            {L.ics}
          </Button>
        </div>
        <section aria-labelledby="pb-cal-list">
          <h3 id="pb-cal-list" className="dk-pb-h">
            {L.list}
          </h3>
          <ul ref={listRef} className="dk-pb-cal-list">
            {upcoming.map((e) => (
              <EventRow key={e.id} e={e} L={L} lang={lang} iso={iso(e.at)} on={reminders.has(e.id)} onRemind={() => remind(e)} onTab={onTab} hot={!!picked && iso(e.at) === picked} />
            ))}
          </ul>
          <p className="dk-pb-muted">
            {L.source}:{' '}
            <a href={SOURCES.setor.url} target="_blank" rel="noreferrer" className="dk-pb-cite">
              {SOURCES.setor.ref}
            </a>
          </p>
        </section>
      </div>
    </div>
  )
}

function EventRow({ e, L, lang, iso, on, onRemind, onTab, hot }: { e: TaxEvent; L: (typeof S)['id']; lang: 'id' | 'en'; iso: string; on: boolean; onRemind: () => void; onTab: (t: TabId) => void; hot: boolean }) {
  const item = useWorld((s) => (e.taxItemId ? s.taxItems.byId[e.taxItemId] ?? null : null))
  const amt = useWorld((s) => (item ? taxAmountOf(s, item) : null), (a, b) => a?.amount === b?.amount && a?.computed === b?.computed)
  const need = item?.status === 'perlu-hitung' && item.amount == null && e.kind === 'setor'
  return (
    <li data-tax={e.taxItemId ?? e.id} className={`dk-pb-cal-row is-${e.tone}${hot ? ' is-hot' : ''}`}>
      <span className="dk-pb-cal-date">{dateText(iso, lang)}</span>
      <span className="dk-pb-cal-what">
        <strong>{e.label[lang]}</strong>
        <small>
          {item ? TAX_STATUS[item.status][lang] : ''}
          {amt && e.kind === 'setor' ? ` · ${rp(amt.amount, lang)}${amt.computed ? '' : ` (${L.est})`}` : e.kind !== 'setor' ? ` · ${L.noAmount}` : ''}
        </small>
      </span>
      <span className="dk-pb-cal-act">
        {e.tone !== 'done' && (
          <Chip icon="bell" selected={on} onToggle={onRemind}>
            {on ? L.reminded(dateText(isoOfShift(iso, -REMIND_DAYS), lang)) : L.remind}
          </Chip>
        )}
        {need && item?.kind === 'pph-final-umkm' && (
          <Button size="sm" variant="secondary" icon="spark" onClick={() => computePphFinal()} data-pb="compute-final">
            {L.compute}
          </Button>
        )}
        {need && item?.kind === 'pph21' && (
          <Button size="sm" variant="quiet" icon="forward" onClick={() => onTab('pph21')}>
            {L.openPph21}
          </Button>
        )}
      </span>
    </li>
  )
}

const isoOfShift = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
