/**
 * demos/sapa-warga — P1 Sapa Warga, the public-service AI assistant (spec §11 P1, brief docs/build/tahap2-plan.md).
 *
 * Split 40/60: "HP Warga" (PhoneFrame: three personas, AI chat in Simulasi or Live, voice note in Basa Jawa, photo +
 * location reports, NIB checklist → form → PDF → MPP queue with QR) | "Konsol Petugas" (BrowserFrame: live KPIs,
 * omnichannel inbox, ticket Kanban with SLA, ticket drawer, cluster map). Below 768 px the two become tabs; after a
 * report the phone stays put (the reply + translation) and offers "Lihat" to the console. Roles: Warga (default), Petugas Layanan (console first,
 * Kanban), Kepala Daerah (read-only summary instead of the console).
 *
 * World: emits complaint.created, service.booked, ticket.statusChanged, citizen.notified (officer reply) with source
 * 'sapa-warga'; consumes citizen.notified (phone), ticket.statusChanged, complaint.clustered (banner + map),
 * alert.broadcast via citizen.notified 'peringatan' (Siaga Wilayah warnings land on Ibu Siti's phone).
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { gsap } from 'gsap'
import { useI18n } from '../../lib/i18n'
import type { DemoCanvasProps } from '../registry'
import type { DemoShellProps, Mission } from '../../demo-kit/shell'
import { useShell } from '../../demo-kit/shell'
import { SplitStage } from '../../demo-kit/shell/SplitStage'
import { motionMode } from '../../demo-kit/ui'
import { isEvent, onEvent, useSession, useWorld, world } from '../../demo-kit/world'
import { Phone } from './Phone'
import { Console, type ConsoleView } from './Console'
import { SW, desaName, kecName, type Created, type PersonaKey } from './model'
import type { Conv } from './Thread'
import { fill, useT } from './strings'
import './sapa-warga.css'

const loadDetail = () => import('./TicketDetail')
const TicketDetail = lazy(loadDetail)
/** warm the drawer chunk when the pointer / focus reaches the ticket lists (before the first tap) */
export const warmDetail = () => void loadDetail().catch(() => undefined)
const Summary = lazy(() => import('./Summary'))

type Tab = 'left' | 'right'
type Role = 'warga' | 'petugas' | 'kepala-daerah'
const asRole = (r: string): Role => (r === 'petugas' || r === 'kepala-daerah' ? r : 'warga')

const LEAD: Record<Role, { id: string; en: string }> = {
  warga: {
    id: 'Anda warga. Kirim voice note berbahasa daerah atau foto banjir dari HP di kiri; tiketnya masuk ke konsol petugas di kanan saat itu juga.',
    en: 'You are the citizen. Send a regional-language voice note or a flood photo from the phone on the left; the ticket lands in the officer console on the right at once.',
  },
  petugas: {
    id: 'Anda petugas layanan. Buka tiket, verifikasi, teruskan ke OPD, selesaikan; HP warga di kiri ikut berubah seketika.',
    en: 'You are the service officer. Open a ticket, verify, forward to an agency, resolve; the citizen phone on the left updates instantly.',
  },
  'kepala-daerah': {
    id: 'Anda kepala daerah: ringkasan layanan hari ini dari data yang sama, tanpa tombol petugas.',
    en: "You are the regional head: today's service summary from the same data, without the officer buttons.",
  },
}

/* ------------------------------------------------------------------ ticket flight phone → console (≤ 900 ms) */

function useFlight(root: RefObject<HTMLDivElement | null>, chip: RefObject<HTMLDivElement | null>) {
  const kill = useRef<(() => void) | null>(null)
  useEffect(() => () => kill.current?.(), [])
  return useCallback(
    (from: Element | null, code: string) => {
      const r = root.current
      const el = chip.current
      if (!r || !el || !from || motionMode() !== 'full') return
      const to = r.querySelector('.dk-sw-console [data-sw-drop]') ?? r.querySelector('.dk-sw-console [data-sw-drop-kpi]')
      if (!to) return
      kill.current?.()
      const R = r.getBoundingClientRect()
      const a = from.getBoundingClientRect()
      const b = to.getBoundingClientRect()
      const p0 = { x: a.left + a.width / 2 - R.left, y: a.top + a.height / 2 - R.top }
      const p2 = { x: b.left + Math.min(160, b.width / 2) - R.left, y: b.top + 22 - R.top }
      const p1 = { x: (p0.x + p2.x) / 2, y: Math.min(p0.y, p2.y) - 110 }
      el.textContent = code
      el.hidden = false
      const w = el.offsetWidth / 2
      const h = el.offsetHeight / 2
      const ease = gsap.parseEase('power2.inOut')
      const t0 = gsap.ticker.time
      const tick = () => {
        const k = Math.min(1, (gsap.ticker.time - t0) / SW.flightS)
        const u = ease(k)
        const x = (1 - u) * (1 - u) * p0.x + 2 * (1 - u) * u * p1.x + u * u * p2.x - w
        const y = (1 - u) * (1 - u) * p0.y + 2 * (1 - u) * u * p1.y + u * u * p2.y - h
        el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${(1 - 0.18 * u).toFixed(3)})`
        el.style.opacity = String(k < 0.12 ? k / 0.12 : k > 0.86 ? (1 - k) / 0.14 : 1)
        if (k >= 1) stop()
      }
      const stop = () => {
        gsap.ticker.remove(tick)
        el.hidden = true
        el.style.transform = ''
        el.style.opacity = ''
        kill.current = null
      }
      kill.current = stop
      gsap.ticker.add(tick)
    },
    [root, chip],
  )
}

/* ------------------------------------------------------------------ the canvas */

export default function SapaWarga(_props: DemoCanvasProps) {
  const { lang } = useI18n()
  const t = useT()
  const shell = useShell()
  const session = useSession()
  const role = asRole(session.role)
  const sm = shell.size === 'sm'
  const [persona, setPersona] = useState<PersonaKey>('siti')
  const [tab, setTab] = useState<Tab>(role === 'warga' ? 'left' : 'right')
  const [view, setView] = useState<ConsoleView>(role === 'petugas' ? 'board' : 'inbox')
  const [ticket, setTicket] = useState<string | null>(null)
  // closing only flips `open`: the drawer plays its exit and unmounts its map afterwards, not inside the Esc / click
  const [ticketOpen, setTicketOpen] = useState(false)
  const [arrived, setArrived] = useState<{ ticketId: string; code: string; n: number } | null>(null)
  const [clusterNote, setClusterNote] = useState<{ id: string; n: number; place: string } | null>(null)
  const [focusCluster, setFocusCluster] = useState<string | null>(null)
  const convs = useRef(new Map<PersonaKey, Conv>()).current
  const root = useRef<HTMLDivElement>(null)
  const chip = useRef<HTMLDivElement>(null)
  const lastCreate = useRef(0)
  const fly = useFlight(root, chip)
  /* one polite live region for what happens across the two screens (ticket arrived, cluster formed) */
  const live = useRef<HTMLParagraphElement>(null)
  const tRef = useRef(t)
  tRef.current = t
  const announce = useCallback((msg: string) => {
    const el = live.current
    if (!el) return
    el.textContent = ''
    window.setTimeout(() => {
      if (live.current) live.current.textContent = msg
    }, 60)
  }, [])
  const personas = useWorld((s) => s.meta.personas)

  /* role changes what is shown */
  const prevRole = useRef(role)
  useEffect(() => {
    if (prevRole.current === role) return
    prevRole.current = role
    setTab(role === 'warga' ? 'left' : 'right')
    if (role === 'petugas') setView('board')
    if (role === 'warga') setView('inbox')
    setTicket(null)
  }, [role])

  const personaOf = useCallback(
    (citizenId: string | null): PersonaKey | null => {
      if (!citizenId) return null
      if (personas.siti === citizenId) return 'siti'
      if (personas.raka === citizenId) return 'raka'
      if (personas.darmo === citizenId) return 'darmo'
      return null
    },
    [personas],
  )

  const onCreated = useCallback(
    (c: Created, from: Element | null) => {
      lastCreate.current = performance.now()
      setArrived((a) => ({ ticketId: c.ticketId, code: c.code, n: (a?.n ?? 0) + 1 }))
      announce(fill(t.ticketArrived, { code: c.code }))
      // mobile stays on the phone (the Javanese reply + translation is the moment); the phone offers "Lihat"
      if (!sm) fly(from, c.code)
    },
    [sm, fly, t],
  )

  /* clusters (Sapa Warga → Meja Pimpinan, Siaga Wilayah, Radar Isu): banner, and the map right after the visitor's report */
  useEffect(
    () =>
      onEvent('complaint.clustered', (e) => {
        if (!isEvent(e, 'complaint.clustered')) return
        const s = world.get()
        const cl = s.clusters.byId[e.payload.clusterId ?? '']
        if (!cl) return
        const place = `${desaName(s, cl.kecamatanId, cl.desaId)}, Kec. ${kecName(s, cl.kecamatanId)}`
        setClusterNote({ id: cl.id, n: cl.complaintIds.length, place })
        if (cl.at === e.at) announce(fill(tRef.current.clusterFormed, { n: cl.complaintIds.length, place }))
        if (cl.at === e.at && performance.now() - lastCreate.current < 8000) {
          setFocusCluster(cl.id)
          setView('cluster')
        }
      }),
    [],
  )

  /* arrivals from cross-product toasts: ?focus=<ticket | complaint | cluster> */
  useEffect(() => {
    const f = shell.focus
    if (!f) return
    const s = world.get()
    if (s.tickets.byId[f]) {
      setTicket(f)
      setTicketOpen(true)
    } else if (s.complaints.byId[f]) {
      setTicket(s.complaints.byId[f]!.ticketId)
      setTicketOpen(true)
    }
    else if (s.clusters.byId[f]) {
      setFocusCluster(f)
      setView('cluster')
      setTab('right')
    }
    shell.clearFocus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shell.focus])

  const openTicket = useCallback((id: string) => {
    setTicket(id)
    setTicketOpen(true)
  }, [])
  const closeTicket = useCallback(() => setTicketOpen(false), [])
  const ticketPersona = useWorld((s) => {
    const tk = ticket ? s.tickets.byId[ticket] : undefined
    const c = tk ? s.complaints.byId[tk.complaintId] : undefined
    return !!c?.citizenId && Object.values(s.meta.personas).includes(c.citizenId)
  })

  const toConsole = useCallback(() => setTab('right'), [])
  const left = <Phone persona={persona} setPersona={setPersona} convs={convs} onCreated={onCreated} flat={sm} toConsole={sm ? toConsole : null} />
  const right =
    role === 'kepala-daerah' ? (
      <Suspense fallback={<p className="dk-sw-muted">{t.mapLoading}</p>}>
        <Summary openTicket={openTicket} sm={sm} />
      </Suspense>
    ) : (
      <Console
        view={view}
        setView={setView}
        openTicket={openTicket}
        arrived={arrived}
        onBackToPhone={sm ? () => setTab('left') : null}
        clusterNote={clusterNote}
        focusCluster={focusCluster}
        personaOf={personaOf}
        sm={sm}
      />
    )
  const labels = useMemo<[{ id: string; en: string }, { id: string; en: string }]>(
    () => [
      { id: 'HP Warga', en: 'Citizen phone' },
      role === 'kepala-daerah' ? { id: 'Ringkasan', en: 'Summary' } : { id: 'Konsol Petugas', en: 'Officer console' },
    ],
    [role],
  )

  return (
    <div ref={root} className={`dk-sw${sm ? ' is-sm' : ''}`} data-role={role}>
      {!sm && <p className="dk-sw-lead">{LEAD[role][lang]}</p>}
      <SplitStage left={left} right={right} labels={labels} ratio={[40, 60]} tab={tab} onTabChange={setTab} className="dk-sw-split" />
      <div ref={chip} className="dk-sw-flight" aria-hidden="true" hidden />
      <p ref={live} className="dk-sr" aria-live="polite" />
      {ticket && (
        <Suspense
          fallback={
            <div className="dk-sw-dskel" role="status" aria-busy="true">
              {t.loading}
            </div>
          }
        >
          <TicketDetail key={ticket} ticketId={ticket} open={ticketOpen} onClose={closeTicket} readOnly={role === 'kepala-daerah'} persona={ticketPersona} />
        </Suspense>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ guide: missions + the first hotspot */

export const missions: readonly Mission[] = [
  {
    id: 'nib',
    label: { id: 'Tanya syarat NIB', en: 'Ask for the NIB requirements' },
    hint: { id: 'HP Warga: pilih Raka, ketuk "Syarat bikin NIB apa?"', en: 'Citizen phone: pick Raka, tap "What do I need for an NIB?"' },
  },
  {
    id: 'voice',
    label: { id: 'Kirim voice note', en: 'Send a voice note' },
    hint: { id: 'Ibu Siti: ketuk chip "Voice note contoh" (contoh Basa Jawa, ±3 detik), atau tahan tombol mikrofon untuk bicara', en: 'Ibu Siti: tap the "Sample voice note" chip (a 3-second Javanese sample), or hold the microphone to speak' },
    done: (e) => isEvent(e, 'complaint.created') && e.payload.channel === 'voice' && e.source === 'sapa-warga',
  },
  {
    id: 'flood',
    label: { id: 'Laporkan banjir', en: 'Report a flood' },
    hint: { id: 'Ibu Siti: "Foto genangan + lokasi", lalu Kirim', en: 'Ibu Siti: "Flood photo + location", then Send' },
    // the visitor's own report (a persona), not the cluster panel's simulated neighbours
    done: (e) => isEvent(e, 'complaint.created') && e.payload.category === 'banjir' && e.source === 'sapa-warga' && !!e.payload.citizenId && Object.values(world.get().meta.personas).includes(e.payload.citizenId),
  },
  {
    id: 'forward',
    label: { id: 'Teruskan tiket ke OPD (sebagai petugas)', en: 'Forward a ticket to an agency (as the officer)' },
    hint: { id: 'Konsol Petugas: buka tiket, Verifikasi, lalu Teruskan ke OPD', en: 'Officer console: open a ticket, Verify, then Forward to the agency' },
    done: (e) => isEvent(e, 'ticket.statusChanged') && e.payload.status === 'diteruskan' && e.source === 'sapa-warga',
  },
  {
    id: 'rate',
    label: { id: 'Selesaikan tiket dan beri rating', en: 'Resolve a ticket and rate it' },
    hint: { id: 'Tandai diproses, lampirkan foto sesudah, Selesai; lalu beri bintang di HP Warga', en: 'Mark in progress, attach the after photo, Resolve; then give stars on the citizen phone' },
    done: (e) => isEvent(e, 'ticket.statusChanged') && e.payload.status === 'selesai' && typeof e.payload.rating === 'number',
  },
]

export const hotspot: DemoShellProps['hotspot'] = {
  target: '[data-hotspot="voice"]',
  id: 'sapa-warga:voice',
  placement: 'above',
  label: { id: 'Mulai dari sini', en: 'Start here' },
}
