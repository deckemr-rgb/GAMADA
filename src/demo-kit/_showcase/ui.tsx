/**
 * /lab/_kit showcase — "ui" module (owner: ui builder). Every component in real use on one shared,
 * fictional ticket state: a new ticket bumps the KPIs, slides into the table, lands in the kanban, the
 * inbox and the flow log; moving a card updates the table; resolving fires confetti and a toast.
 */
import { startTransition, useCallback, useMemo, useRef, useState, type FormEvent } from 'react'
import { useI18n, type Lang } from '../../lib/i18n'
import { ECOSYSTEMS, PRODUCTS, type EcoOrInti } from '../../content/products'
import {
  Avatar,
  Badge,
  Button,
  Chip,
  Confetti,
  fireConfetti,
  Drawer,
  EmptyState,
  Field,
  Icon,
  IconButton,
  ICON_NAMES,
  Inbox,
  InsightCallout,
  Input,
  Kanban,
  Kbd,
  Kpi,
  KpiStrip,
  LiveBadge,
  Menu,
  Modal,
  Panel,
  Score,
  SectionHeader,
  Segmented,
  Select,
  Skeleton,
  SlaLabel,
  StatusChip,
  Stepper,
  Table,
  Tabs,
  Timeline,
  Toast,
  ToastRegion,
  Tooltip,
  fmtNum,
  useSkeleton,
  useToastQueue,
  type StatusTone,
  type TableColumn,
  type TimelineItem,
} from '../ui'
import { CATEGORIES, COMPLAINTS_14D, KECAMATAN, STATUS_FLOW, STATUS_LABEL, fmtTime, manyTickets, nextTicket, sampleTickets, type Channel, type Ticket, type TicketStatus } from '../ui/__fixtures__/sample'
import '../ui/__fixtures__/showcase-ui.css'

const C = {
  id: {
    ecoLabel: 'Aksen ekosistem',
    ecoNote: 'Satu atribut data-eco mewarnai ulang aksen, teks di atas aksen, dan aksen kertas.',
    kpiTitle: 'Angka hari ini ikut bergerak saat aduan masuk',
    kpiLead: 'Angka bergulir saat pertama terlihat dan setiap kali data berubah. Warna selisih mengikuti makna, bukan arah.',
    kpis: ['Aduan hari ini', 'SLA tepat waktu', 'Tiket terlambat', 'Menunggu verifikasi', 'Indeks layanan'],
    tableTitle: 'Dari pesan warga ke tiket, dalam satu tarikan napas',
    tableLead: 'Tabel padat yang bisa diurutkan, dua kepadatan, papan ketik J/K/Enter/N, dan berubah jadi kartu di layar sempit.',
    inbox: 'Tiket',
    tickets: 'tiket',
    fresh: 'baru',
    late: 'terlambat',
    search: 'Cari tiket, kecamatan, OPD…',
    searchLabel: 'Cari tiket',
    simulate: 'Simulasikan tiket baru',
    dataset: 'Data tabel',
    today: 'Hari ini',
    big: '1.000 baris',
    cols: ['Tiket', 'Kanal', 'Kategori', 'Kecamatan', 'OPD', 'Status', 'Sisa SLA'],
    phone: 'Telepon',
    channels: 'Kanal',
    noMatch: 'Tidak ada tiket yang cocok',
    noMatchBody: 'Ubah kata kunci atau nyalakan lagi kanal yang disaring.',
    clearFilter: 'Hapus saringan',
    kanbanTitle: 'Setiap status punya tempat, setiap perpindahan terlihat',
    kanbanLead: 'Kartu meluncur ke kolom barunya (tween GSAP, tanpa plugin Flip). Papan ketik: panah untuk berpindah, Shift + panah untuk memindah kartu.',
    board: 'Papan status tiket',
    feedTitle: 'Pesan masuk dan jejak kejadian dalam satu pandangan',
    feedLead: 'Kotak masuk warga di kiri; log alur bercap waktu dan narasi "Urutan kejadian" di kanan.',
    inboxLabel: 'Pesan warga',
    log: 'Log alur',
    story: 'Urutan kejadian',
    tabsLabel: 'Tampilan jejak',
    ctlTitle: 'Kontrol kecil yang semuanya bekerja',
    ctlLead: 'Tidak ada tombol mati: setiap kontrol di bawah mengubah sesuatu di atas.',
    actions: 'Tombol & aksi',
    reload: 'Muat ulang ringkasan',
    openTop: 'Buka tiket teratas',
    reset: 'Hapus tiket simulasi',
    more: 'Aksi lain',
    form: 'Catat aduan dari telepon',
    summary: 'Ringkasan aduan',
    summaryHint: 'Minimal 8 huruf. Tiket masuk ke tabel dengan kanal Telepon.',
    summaryErr: 'Tulis ringkasan minimal 8 huruf.',
    category: 'Kategori',
    kec: 'Kecamatan',
    save: 'Buat tiket',
    legend: 'Status, SLA & skor',
    statusChips: 'Chip status netral; warna hanya untuk perhatian dan bahaya',
    service: 'Indeks layanan',
    healthy: 'Sehat',
    response: 'Respons ≤ 1 jam',
    attention: 'Perlu perhatian',
    ai: 'Ringkasan AI',
    aiText: (n: number, k: string) => `${n} aduan saluran tersumbat dan genangan dari ${k} dalam 24 jam. Kirim satu tim DPU SDA sekaligus, bukan tiga kunjungan terpisah.`,
    saved: 'Disimpan untuk rapat',
    savedEmpty: 'Belum ada tiket untuk rapat',
    savedEmptyBody: 'Simpan tiket yang ingin dibahas pimpinan. Daftarnya ikut ke Meja Pimpinan.',
    saveTop: 'Simpan tiket teratas',
    remove: 'Hapus dari daftar',
    icons: 'Ikon produk',
    allIcons: (n: number) => `Semua ikon (${n})`,
    drawerFrom: 'Pelapor',
    drawerCh: 'Kanal',
    drawerKec: 'Kecamatan',
    drawerOpd: 'OPD tujuan',
    drawerAt: 'Diterima',
    drawerSla: 'Sisa SLA',
    flow: 'Alur status',
    advance: (s: string) => `Majukan ke ${s}`,
    markDone: 'Tandai selesai',
    reopen: 'Buka kembali',
    saveMeeting: 'Simpan untuk rapat',
    savedMeeting: 'Tersimpan',
    insight: 'Ada 2 aduan serupa di kecamatan yang sama minggu ini. Gabungkan agar OPD menangani sekali jalan.',
    confirmTitle: (id: string) => `Tutup ${id}?`,
    confirmBody: 'Warga menerima pesan bahwa aduannya selesai, beserta tautan penilaian layanan.',
    cancel: 'Batal',
    confirm: 'Ya, tandai selesai',
    tNew: (id: string, ch: string) => `Tiket ${id} masuk lewat ${ch}`,
    tMoved: (id: string, s: string) => `${id} sekarang ${s}`,
    tDone: (id: string) => `${id} selesai — warga diberi tahu`,
    tSent: 'Diteruskan ke Meja Pimpinan',
    tSentBody: (id: string) => `${id} masuk agenda rapat pagi.`,
    tReset: 'Tiket simulasi dihapus',
    logNew: (id: string, ch: string) => `Tiket ${id} dibuat dari pesan ${ch}`,
    logAi: 'AI membaca & mengklasifikasi',
    logMove: (id: string, s: string) => `${id} → ${s}`,
    storySteps: (t: Ticket) => [
      `${t.from} mengirim pesan lewat ${t.channel === 'Telepon' ? 'telepon' : t.channel}.`,
      `AI mengenali kategori "${t.category.id}" di ${t.kecamatan}.`,
      'Petugas memverifikasi lokasi dan foto.',
      `Tiket diteruskan ke ${t.opd}.`,
      `${t.opd} menangani di lapangan.`,
      'Warga menerima kabar selesai dan menilai layanan.',
    ],
    sim: 'Data simulasi · seed 42',
  },
  en: {
    ecoLabel: 'Ecosystem accent',
    ecoNote: 'One data-eco attribute recolours the accent, the text on it and the paper accent.',
    kpiTitle: "Today's numbers move as complaints arrive",
    kpiLead: 'Numbers count up on first view and whenever data changes. Delta colour follows meaning, not direction.',
    kpis: ['Complaints today', 'SLA on time', 'Overdue tickets', 'Awaiting verification', 'Service index'],
    tableTitle: 'From a citizen message to a ticket, in one breath',
    tableLead: 'A dense sortable table with two densities, J/K/Enter/N keys, and cards on narrow screens.',
    inbox: 'Tickets',
    tickets: 'tickets',
    fresh: 'new',
    late: 'overdue',
    search: 'Search tickets, districts, agencies…',
    searchLabel: 'Search tickets',
    simulate: 'Simulate new ticket',
    dataset: 'Table data',
    today: 'Today',
    big: '1,000 rows',
    cols: ['Ticket', 'Channel', 'Category', 'District', 'Agency', 'Status', 'SLA left'],
    phone: 'Phone',
    channels: 'Channel',
    noMatch: 'No matching tickets',
    noMatchBody: 'Change the search or switch the filtered channels back on.',
    clearFilter: 'Clear filters',
    kanbanTitle: 'Every status has a place, every move is visible',
    kanbanLead: 'Cards glide to their new column (a GSAP tween, no Flip plugin). Keyboard: arrows to move around, Shift + arrow to move a card.',
    board: 'Ticket status board',
    feedTitle: 'Incoming messages and the trail of events at a glance',
    feedLead: 'Citizen inbox on the left; a timestamped flow log and the "Sequence of events" story on the right.',
    inboxLabel: 'Citizen messages',
    log: 'Flow log',
    story: 'Sequence of events',
    tabsLabel: 'Trail view',
    ctlTitle: 'Small controls that all do something',
    ctlLead: 'No dead buttons: every control below changes something above.',
    actions: 'Buttons & actions',
    reload: 'Reload summary',
    openTop: 'Open top ticket',
    reset: 'Remove simulated tickets',
    more: 'More actions',
    form: 'Log a phone complaint',
    summary: 'Complaint summary',
    summaryHint: 'At least 8 letters. The ticket lands in the table with channel Phone.',
    summaryErr: 'Write a summary of at least 8 letters.',
    category: 'Category',
    kec: 'District',
    save: 'Create ticket',
    legend: 'Status, SLA & scores',
    statusChips: 'Neutral status chips; colour only for attention and danger',
    service: 'Service index',
    healthy: 'Healthy',
    response: 'Response ≤ 1 hour',
    attention: 'Needs attention',
    ai: 'AI summary',
    aiText: (n: number, k: string) => `${n} blocked-drain and flood complaints from ${k} in 24 hours. Send one DPU SDA team at once instead of three separate visits.`,
    saved: 'Saved for the meeting',
    savedEmpty: 'No tickets for the meeting yet',
    savedEmptyBody: 'Save tickets the leadership should discuss. The list travels to Meja Pimpinan.',
    saveTop: 'Save top ticket',
    remove: 'Remove from list',
    icons: 'Product icons',
    allIcons: (n: number) => `All icons (${n})`,
    drawerFrom: 'Reported by',
    drawerCh: 'Channel',
    drawerKec: 'District',
    drawerOpd: 'Assigned agency',
    drawerAt: 'Received',
    drawerSla: 'SLA left',
    flow: 'Status flow',
    advance: (s: string) => `Advance to ${s}`,
    markDone: 'Mark resolved',
    reopen: 'Reopen',
    saveMeeting: 'Save for meeting',
    savedMeeting: 'Saved',
    insight: 'There are 2 similar complaints in the same district this week. Merge them so the agency handles them in one trip.',
    confirmTitle: (id: string) => `Close ${id}?`,
    confirmBody: 'The citizen gets a message that the complaint is resolved, with a link to rate the service.',
    cancel: 'Cancel',
    confirm: 'Yes, mark resolved',
    tNew: (id: string, ch: string) => `Ticket ${id} arrived via ${ch}`,
    tMoved: (id: string, s: string) => `${id} is now ${s}`,
    tDone: (id: string) => `${id} resolved — citizen notified`,
    tSent: 'Sent to Meja Pimpinan',
    tSentBody: (id: string) => `${id} is on the morning meeting agenda.`,
    tReset: 'Simulated tickets removed',
    logNew: (id: string, ch: string) => `Ticket ${id} created from a ${ch} message`,
    logAi: 'AI read & classified',
    logMove: (id: string, s: string) => `${id} → ${s}`,
    storySteps: (t: Ticket) => [
      `${t.from} sent a message via ${t.channel === 'Telepon' ? 'phone' : t.channel}.`,
      `AI recognised "${t.category.en}" in ${t.kecamatan}.`,
      'An officer verified the location and photo.',
      `The ticket went to ${t.opd}.`,
      `${t.opd} is handling it on site.`,
      'The citizen hears it is resolved and rates the service.',
    ],
    sim: 'Simulated data · seed 42',
  },
} as const

type Copy = (typeof C)[Lang]

const ECO_OPTS: EcoOrInti[] = ['satu-daerah', 'usaha-pintar', 'pasar-daerah', 'inti']
const BASE_COMPLAINTS = 128
const statusTone = (s: TicketStatus): StatusTone => (s === 'baru' ? 'new' : s === 'selesai' ? 'done' : 'neutral')
const nextStatus = (s: TicketStatus): TicketStatus | undefined => STATUS_FLOW[STATUS_FLOW.indexOf(s) + 1]

function Spark({ data }: { data: number[] }) {
  const w = 72
  const h = 24
  const min = Math.min(...data)
  const max = Math.max(...data)
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 3 - ((v - min) / (max - min || 1)) * (h - 6)] as const)
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const last = pts[pts.length - 1]
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" focusable="false" style={{ overflow: 'visible' }}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {last && <circle cx={last[0]} cy={last[1]} r="2.2" fill="currentColor" />}
    </svg>
  )
}

function useColumns(c: Copy, lang: Lang): TableColumn<Ticket>[] {
  return useMemo(
    () => [
      { id: 'id', header: c.cols[0], value: (t) => t.id, width: 116, numeric: false, card: 'meta', cell: (t) => <span className="dk-num dk-faint">{t.id}</span> },
      { id: 'ch', header: c.cols[1], value: (t) => (t.channel === 'Telepon' ? c.phone : t.channel), width: 78 },
      { id: 'cat', header: c.cols[2], value: (t) => t.category[lang], min: 140, grow: 1.5, card: 'title', cell: (t) => <span style={{ fontWeight: 600 }}>{t.category[lang]}</span> },
      { id: 'kec', header: c.cols[3], value: (t) => t.kecamatan, min: 96 },
      { id: 'opd', header: c.cols[4], value: (t) => t.opd, min: 104 },
      { id: 'st', header: c.cols[5], value: (t) => STATUS_FLOW.indexOf(t.status), width: 150, numeric: false, cell: (t) => <StatusChip label={STATUS_LABEL[t.status][lang]} tone={statusTone(t.status)} /> },
      { id: 'sla', header: c.cols[6], value: (t) => (t.status === 'selesai' ? 1e9 : t.slaMin), width: 104, numeric: true, cell: (t) => <SlaLabel minutesLeft={t.slaMin} done={t.status === 'selesai'} /> },
    ],
    [c, lang],
  )
}

type ToastPush = ReturnType<typeof useToastQueue>['push']

/** Owns the toast queue so a push renders this stack only (INP: the page does not re-render for a toast). */
function ToastStack({ apiRef }: { apiRef: { current: ToastPush | null } }) {
  const q = useToastQueue()
  apiRef.current = q.push
  return (
    <ToastRegion>
      {q.toasts.map((t) => (
        <Toast key={t.id} data={t} onDismiss={q.dismiss} />
      ))}
    </ToastRegion>
  )
}

export default function Section() {
  const { lang } = useI18n()
  const c = C[lang]
  const [eco, setEco] = useState<EcoOrInti>('satu-daerah')
  const [tickets, setTickets] = useState<Ticket[]>(sampleTickets)
  // a ref, not state: the insert renders as a transition, so two quick clicks must not reuse a stale number
  const seq = useRef(142)
  const [clock, setClock] = useState(8 * 60 + 42)
  const [openId, setOpenId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [dataset, setDataset] = useState<'today' | 'big'>('today')
  const big = useMemo(() => (dataset === 'big' ? manyTickets(1000) : null), [dataset])
  const [query, setQuery] = useState('')
  const [channels, setChannels] = useState<Record<Channel, boolean>>({ WA: true, Web: true, Telepon: true })
  const [saved, setSaved] = useState<string[]>([])
  const [confetti, setConfetti] = useState(0)
  const [trail, setTrail] = useState<'log' | 'story'>('log')
  const [summaryKey, setSummaryKey] = useState(0)
  const summaryLoading = useSkeleton(summaryKey)
  const [form, setForm] = useState({ text: '', kec: 'Kalitidu', cat: '3', err: '' })
  // the queue lives in its own small component: pushing a toast re-renders only the toast stack, not the page
  const toastApi = useRef<ToastPush | null>(null)
  const toasts = { push: (d: Parameters<ToastPush>[0]) => toastApi.current?.(d) }
  const kanbanRef = useRef<HTMLDivElement>(null)
  const [log, setLog] = useState<TimelineItem[]>(() => [
    { id: 'l3', time: '08.40', title: lang === 'id' ? 'SW-2026-0141 → Diverifikasi' : 'SW-2026-0141 → Verified', tone: 'neutral', source: 'Sapa Warga' },
    { id: 'l2', time: '08.39', title: lang === 'id' ? 'AI membaca & mengklasifikasi' : 'AI read & classified', detail: '+0,95 s · 412 token', tone: 'accent', icon: 'spark', source: 'AI' },
    { id: 'l1', time: '08.39', title: lang === 'id' ? 'Tiket SW-2026-0141 dibuat dari pesan WA' : 'Ticket SW-2026-0141 created from a WA message', tone: 'neutral', source: 'Sapa Warga' },
  ])

  const columns = useColumns(c, lang)
  // stable per language: unchanged kanban cards skip re-rendering (Kanban memoises by item + renderCard)
  const renderCard = useCallback(
    (t: Ticket) => (
      <div className="dk-scu-card">
        <span className="dk-num dk-faint dk-scu-card-id">{t.id}</span>
        <span className="dk-scu-card-t">{t.category[lang]}</span>
        <span className="dk-scu-card-m">
          <span className="dk-faint">{t.kecamatan}</span>
          <SlaLabel minutesLeft={t.slaMin} done={t.status === 'selesai'} />
        </span>
      </div>
    ),
    [lang],
  )
  const byId = useMemo(() => new Map(tickets.map((t) => [t.id, t])), [tickets])
  const open = openId ? (byId.get(openId) ?? big?.find((t) => t.id === openId) ?? null) : null
  const lateCount = tickets.filter((t) => t.status !== 'selesai' && t.slaMin < 0).length
  const newCount = tickets.filter((t) => t.status === 'baru').length
  const onTime = Math.round(((tickets.length - lateCount) / Math.max(1, tickets.length)) * 1000) / 10
  const chLabel = (ch: Channel) => (ch === 'Telepon' ? c.phone : ch)

  const addLog = (title: string, extra: Partial<TimelineItem> = {}) => setLog((l) => [{ id: `l${Date.now()}${Math.random()}`, time: fmtTime(clock), title, tone: 'neutral' as const, source: 'Sapa Warga', ...extra }, ...l].slice(0, 40))

  const simulate = (custom?: Partial<Ticket>) => {
    const t = { ...nextTicket(seq.current++, clock), ...custom }
    // INP: the toast is the immediate feedback; the grid / board / feed update renders as a transition right
    // after that paint (React yields), so the click is not held by the page-wide re-layout of the insert
    startTransition(() => {
      setDataset('today')
      setTickets((ts) => [t, ...ts])
      setClock((m) => m + 3)
      setLog((l) =>
        [
          { id: `${t.id}-ai`, time: fmtTime(clock), title: c.logAi, detail: '+0,9 s · 398 token', tone: 'accent' as const, icon: 'spark' as const, source: 'AI' },
          { id: `${t.id}-new`, time: fmtTime(clock), title: c.logNew(t.id, chLabel(t.channel)), tone: 'neutral' as const, source: 'Sapa Warga' },
          ...l,
        ].slice(0, 40),
      )
    })
    toasts.push({ title: c.tNew(t.id, chLabel(t.channel)), body: t.category[lang], tone: 'accent', icon: 'inbox', onActivate: () => setOpenId(t.id) })
  }

  const setStatus = (id: string, s: TicketStatus) => {
    const t = byId.get(id)
    if (!t || t.status === s) return
    setTickets((ts) => ts.map((x) => (x.id === id ? { ...x, status: s, slaMin: s === 'selesai' ? 0 : x.slaMin } : x)))
    addLog(c.logMove(id, STATUS_LABEL[s][lang]), { tone: s === 'selesai' ? 'done' : 'neutral', icon: s === 'selesai' ? 'check' : undefined })
    if (s === 'selesai') {
      const anchor = document.querySelector('.dk-drawer .dk-ov-foot') ?? kanbanRef.current?.querySelector('.dk-kb-col:last-child .dk-kb-head')
      if (anchor) fireConfetti(anchor)
      else setConfetti((n) => n + 1)
      toasts.push({ title: c.tDone(id), tone: 'accent', icon: 'checkCircle' })
    } else toasts.push({ title: c.tMoved(id, STATUS_LABEL[s][lang]), tone: 'neutral', icon: 'arrowRight' })
  }

  const resetSim = () => {
    setTickets(sampleTickets())
    seq.current = 142
    setClock(8 * 60 + 42)
    setOpenId(null)
    setSaved([])
    toasts.push({ title: c.tReset, tone: 'neutral', icon: 'reset' })
  }

  const filtered = useMemo(() => {
    const src = big ?? tickets
    const q = query.trim().toLowerCase()
    return src.filter((t) => channels[t.channel] && (!q || `${t.id} ${t.kecamatan} ${t.opd} ${t.category[lang]}`.toLowerCase().includes(q)))
  }, [big, tickets, query, channels, lang])

  const submitForm = (e: FormEvent) => {
    e.preventDefault()
    if (form.text.trim().length < 8) {
      setForm((f) => ({ ...f, err: c.summaryErr }))
      return
    }
    const cat = CATEGORIES[Number(form.cat)] ?? CATEGORIES[0]!
    simulate({ channel: 'Telepon', kecamatan: form.kec, category: cat.cat, opd: cat.opd, text: { id: form.text, en: form.text }, from: lang === 'id' ? 'Penelepon' : 'Caller' })
    setForm((f) => ({ ...f, text: '', err: '' }))
  }

  const saveTicket = (id: string) => {
    if (saved.includes(id)) return
    setSaved((s) => [id, ...s])
    toasts.push({ title: c.tSent, body: c.tSentBody(id), tone: 'accent', icon: 'meja' })
  }

  /* memoised blocks: a new ticket or an opened drawer must not rebuild the static parts of the page */
  const inboxItems = useMemo(
    () =>
      tickets.slice(0, 7).map((t) => ({
        id: t.id,
        title: t.from,
        preview: t.text[lang],
        time: fmtTime(t.at),
        unread: t.status === 'baru',
        from: t.from,
        tone: t.status !== 'selesai' && t.slaMin < 0 ? ('danger' as const) : undefined,
        meta: (
          <>
            <Chip>{t.channel === 'Telepon' ? c.phone : t.channel}</Chip>
            <Chip icon="pin">{t.kecamatan}</Chip>
          </>
        ),
      })),
    [tickets, lang, c],
  )
  const iconsPanel = useMemo(
    () => (
            <Panel title={c.icons} icon="grid">
              <ul className="dk-scu-icons">
                {Object.values(PRODUCTS).map((p) => (
                  <li key={p.slug} title={p.name}>
                    <Icon name={p.icon} />
                    <span>{p.name}</span>
                  </li>
                ))}
              </ul>
              <details className="dk-scu-details">
                <summary>{c.allIcons(ICON_NAMES.length)}</summary>
                <ul className="dk-scu-icons is-all">
                  {ICON_NAMES.map((n) => (
                    <li key={n} title={n}>
                      <Icon name={n} />
                      <span>{n}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </Panel>
    ),
    [c],
  )

  const top = tickets[0]
  const storyTicket = (open && byId.get(open.id)) || top
  const storyIdx = storyTicket ? STATUS_FLOW.indexOf(storyTicket.status) : 0
  const story: TimelineItem[] = storyTicket
    ? c
        .storySteps(storyTicket)
        .slice(0, Math.min(6, storyIdx + (storyTicket.status === 'selesai' ? 2 : 1) + 1))
        .map((s, i) => ({ id: `s${i}`, time: fmtTime(storyTicket.at + i * 7), title: s, tone: i <= storyIdx + 1 ? 'accent' : 'neutral' }))
    : []

  const floodCount = tickets.filter((t) => t.kecamatan === 'Kalitidu' || t.category.id === 'Saluran tersumbat').length + 2

  return (
    <div className="dk-root dk-scu" data-eco={eco}>
      {/* eco switcher */}
      <div className="dk-scu-eco">
        <Segmented
          label={c.ecoLabel}
          value={eco}
          onChange={setEco}
          options={ECO_OPTS.map((e) => ({ value: e, label: ECOSYSTEMS[e].name.replace('GAMADA ', '') }))}
        />
        <p className="dk-faint">{c.ecoNote}</p>
        <LiveBadge />
      </div>

      {/* 01 KPI */}
      <section className="dk-scu-block" aria-labelledby="scu-kpi">
        <SectionHeader index="01" id="scu-kpi" title={c.kpiTitle} lead={c.kpiLead} />
        <KpiStrip label={c.kpiTitle}>
          <Kpi label={c.kpis[0]} value={BASE_COMPLAINTS + tickets.length} delta={BASE_COMPLAINTS + tickets.length - 124} goodWhen="down" spark={<Spark data={[...COMPLAINTS_14D.slice(0, -1), BASE_COMPLAINTS + tickets.length]} />} />
          <Kpi label={c.kpis[1]} value={onTime} decimals={1} unit="%" delta={2.1} deltaFormat={(n) => `${fmtNum(lang, n, 1)} pp`} goodWhen="up" target={95} />
          <Kpi label={c.kpis[2]} value={lateCount} delta={lateCount - 3} goodWhen="down" />
          <Kpi label={c.kpis[3]} value={newCount} delta={newCount - 2} goodWhen="down" />
          <Kpi label={c.kpis[4]} value={78} unit="/100" delta={1} goodWhen="up" />
        </KpiStrip>
      </section>

      {/* 02 Table */}
      <section className="dk-scu-block" aria-labelledby="scu-table">
        <SectionHeader
          index="02"
          id="scu-table"
          title={c.tableTitle}
          lead={c.tableLead}
          actions={
            <Segmented
              size="sm"
              label={c.dataset}
              value={dataset}
              onChange={(v) => setDataset(v)}
              options={[
                { value: 'today', label: c.today },
                { value: 'big', label: c.big },
              ]}
            />
          }
        />
        <Table
          rows={filtered}
          columns={columns}
          rowId={(t) => t.id}
          label={c.inbox}
          activeId={openId}
          onOpen={(t) => setOpenId(t.id)}
          onNew={dataset === 'today' ? () => simulate() : undefined}
          rowTone={(t) => (t.status !== 'selesai' && t.slaMin < 0 ? 'danger' : undefined)}
          announce={(t) => `${t.id}, ${t.category[lang]}, ${t.kecamatan}`}
          toolbar={
            <>
              <span className="dk-scu-tt">
                <Icon name="inbox" size={16} />
                {c.inbox}
              </span>
              <span className="dk-scu-counts">
                <span>
                  <b className="dk-num">{fmtNum(lang, (big ?? tickets).length)}</b> {c.tickets}
                </span>
                {!big && (
                  <>
                    <span>
                      <b className="dk-num">{newCount}</b> {c.fresh}
                    </span>
                    <span className={lateCount ? 'is-late' : ''}>
                      <b className="dk-num">{lateCount}</b> {c.late}
                    </span>
                  </>
                )}
              </span>
            </>
          }
          actions={
            <>
              <Input icon="search" className="dk-scu-search" placeholder={c.search} aria-label={c.searchLabel} value={query} onChange={(e) => setQuery(e.target.value)} type="search" />
              <span className="dk-scu-chips" role="group" aria-label={c.channels}>
                {(['WA', 'Web', 'Telepon'] as Channel[]).map((ch) => (
                  <Chip key={ch} selected={channels[ch]} onToggle={() => setChannels((s) => ({ ...s, [ch]: !s[ch] }))}>
                    {chLabel(ch)}
                  </Chip>
                ))}
              </span>
              {dataset === 'today' && (
                <Button variant="primary" icon="plus" kbd="N" onClick={() => simulate()}>
                  {c.simulate}
                </Button>
              )}
            </>
          }
          empty={
            <EmptyState
              art="search"
              compact
              title={c.noMatch}
              body={c.noMatchBody}
              action={{
                label: c.clearFilter,
                icon: 'filter',
                onClick: () => {
                  setQuery('')
                  setChannels({ WA: true, Web: true, Telepon: true })
                },
              }}
            />
          }
        />
      </section>

      {/* 03 Kanban */}
      <section className="dk-scu-block" aria-labelledby="scu-kanban" ref={kanbanRef}>
        <SectionHeader index="03" id="scu-kanban" title={c.kanbanTitle} lead={c.kanbanLead} />
        <Kanban
          label={c.board}
          columns={STATUS_FLOW.map((s) => ({ id: s, title: STATUS_LABEL[s][lang], tone: s === 'selesai' ? 'done' : 'neutral' }))}
          items={tickets.slice(0, 18)}
          itemId={(t) => t.id}
          itemColumn={(t) => t.status}
          itemLabel={(t) => `${t.id} ${t.category[lang]}`}
          onMove={(id, to) => setStatus(id, to as TicketStatus)}
          onOpen={(t) => setOpenId(t.id)}
          renderCard={renderCard}
        />
      </section>

      {/* 04 Inbox + Timeline */}
      <section className="dk-scu-block" aria-labelledby="scu-feed">
        <SectionHeader index="04" id="scu-feed" title={c.feedTitle} lead={c.feedLead} />
        <div className="dk-scu-feed">
          <Panel title={c.inboxLabel} icon="chat" meta={<Badge tone="accent">{newCount}</Badge>} flush>
            <Inbox
              label={c.inboxLabel}
              selectedId={openId}
              onSelect={setOpenId}
              items={inboxItems}
            />
          </Panel>
          <Panel title={trail === 'log' ? c.log : c.story} icon={trail === 'log' ? 'list' : 'flag'} meta={<span className="dk-faint">{c.sim}</span>}>
            <Tabs
              label={c.tabsLabel}
              value={trail}
              onChange={setTrail}
              items={[
                { id: 'log', label: c.log, icon: 'list', badge: log.length },
                { id: 'story', label: c.story, icon: 'flag' },
              ]}
            >
              {trail === 'log' ? <Timeline label={c.log} items={log.slice(0, 9)} live /> : <Timeline label={c.story} variant="story" items={story} />}
            </Tabs>
          </Panel>
        </div>
      </section>

      {/* 05 Controls */}
      <section className="dk-scu-block" aria-labelledby="scu-ctl">
        <SectionHeader index="05" id="scu-ctl" title={c.ctlTitle} lead={c.ctlLead} />
        <div className="dk-scu-grid">
          <Panel title={c.actions} icon="zap">
            <div className="dk-scu-row">
              <Button variant="primary" icon="plus" onClick={() => simulate()}>
                {c.simulate}
              </Button>
              <Button variant="secondary" icon="refresh" onClick={() => setSummaryKey((k) => k + 1)}>
                {c.reload}
              </Button>
              <Button variant="ghost" icon="arrowRight" onClick={() => top && setOpenId(top.id)}>
                {c.openTop}
              </Button>
              <Button variant="danger" icon="reset" onClick={resetSim}>
                {c.reset}
              </Button>
            </div>
            <div className="dk-scu-row">
              <Tooltip content={c.reload}>
                <IconButton icon="refresh" label={c.reload} variant="quiet" onClick={() => setSummaryKey((k) => k + 1)} />
              </Tooltip>
              <Tooltip content={c.openTop}>
                <IconButton icon="inbox" label={c.openTop} variant="quiet" badge={newCount} onClick={() => top && setOpenId(top.id)} />
              </Tooltip>
              <Tooltip content={c.saveTop}>
                <IconButton icon="meja" label={c.saveTop} variant="quiet" onClick={() => top && saveTicket(top.id)} />
              </Tooltip>
              <Menu
                label={c.more}
                items={[
                  { id: 'sim', label: c.simulate, icon: 'plus', onSelect: () => simulate() },
                  { id: 'big', label: dataset === 'today' ? c.big : c.today, icon: 'rowsCompact', onSelect: () => setDataset((d) => (d === 'today' ? 'big' : 'today')) },
                  { id: 'reset', label: c.reset, icon: 'reset', danger: true, onSelect: resetSim },
                ]}
              />
              <span className="dk-scu-kbd dk-kbd-hint" aria-hidden="true">
                <Kbd>J</Kbd>
                <Kbd>K</Kbd>
                <Kbd>↵</Kbd>
                <Kbd>N</Kbd>
              </span>
            </div>
          </Panel>

          <Panel title={c.form} icon="call">
            <form className="dk-scu-form" onSubmit={submitForm} noValidate>
              <Field label={c.summary} hint={c.summaryHint} error={form.err || undefined}>
                {(ids) => <Input {...ids} value={form.text} onChange={(e) => setForm((f) => ({ ...f, text: e.target.value, err: '' }))} placeholder={lang === 'id' ? 'mis. Lampu PJU mati di Jl. Veteran' : 'e.g. Street light out on Jl. Veteran'} />}
              </Field>
              <div className="dk-scu-2">
                <Field label={c.category}>{(ids) => <Select {...ids} value={form.cat} onChange={(e) => setForm((f) => ({ ...f, cat: e.target.value }))} options={CATEGORIES.map((k, i) => ({ value: String(i), label: k.cat[lang] }))} />}</Field>
                <Field label={c.kec}>{(ids) => <Select {...ids} value={form.kec} onChange={(e) => setForm((f) => ({ ...f, kec: e.target.value }))} options={KECAMATAN.map((k) => ({ value: k, label: k }))} />}</Field>
              </div>
              <div>
                <Button type="submit" variant="primary" icon="check">
                  {c.save}
                </Button>
              </div>
            </form>
          </Panel>

          <Panel title={c.legend} icon="shield">
            <p className="dk-scu-cap">{c.statusChips}</p>
            <div className="dk-scu-row">
              <StatusChip label={STATUS_LABEL.baru[lang]} tone="new" />
              <StatusChip label={STATUS_LABEL.opd[lang]} />
              <StatusChip label={c.attention} tone="warn" />
              <StatusChip label={lang === 'id' ? 'Lewat SLA' : 'Past SLA'} tone="danger" />
              <StatusChip label={STATUS_LABEL.selesai[lang]} tone="done" />
            </div>
            <div className="dk-scu-row">
              <SlaLabel minutesLeft={20 * 60} />
              <SlaLabel minutesLeft={45} />
              <SlaLabel minutesLeft={-120} />
              <SlaLabel minutesLeft={0} done />
            </div>
            <div className="dk-scu-row dk-scu-scores">
              <Score label={c.service} value={78} caption={c.healthy} />
              <div className="dk-scu-scorebar">
                <Score label={c.response} value={54} variant="bar" caption={c.attention} />
              </div>
            </div>
            <div className="dk-scu-row">
              <span className="dk-scu-avatars">
                {tickets.slice(0, 4).map((t) => (
                  <Avatar key={t.id} name={t.from} size={32} />
                ))}
              </span>
              <Badge>{tickets.length}</Badge>
              <Badge tone="accent">{newCount}</Badge>
              <Badge tone="warn">2</Badge>
              <Badge tone="danger">{lateCount}</Badge>
            </div>
            {top && <Stepper label={c.flow} steps={STATUS_FLOW.map((s) => STATUS_LABEL[s][lang])} current={STATUS_FLOW.indexOf(top.status)} />}
          </Panel>

          <Panel title={c.ai} icon="spark" actions={<IconButton icon="refresh" label={c.reload} size="sm" onClick={() => setSummaryKey((k) => k + 1)} />}>
            {summaryLoading ? (
              <div className="dk-scu-skel" aria-busy="true">
                <Skeleton width={28} height={28} radius={8} />
                <Skeleton lines={3} height={11} />
              </div>
            ) : (
              <InsightCallout>{c.aiText(floodCount, 'Kalitidu')}</InsightCallout>
            )}
          </Panel>

          <Panel title={c.saved} icon="meja" meta={saved.length ? <Badge>{saved.length}</Badge> : undefined}>
            {saved.length === 0 ? (
              <EmptyState compact art="doc" title={c.savedEmpty} body={c.savedEmptyBody} action={top ? { label: c.saveTop, icon: 'plus', onClick: () => saveTicket(top.id) } : undefined} />
            ) : (
              <div className="dk-scu-row">
                {saved.map((id) => (
                  <Chip key={id} icon="flag" onRemove={() => setSaved((s) => s.filter((x) => x !== id))} removeLabel={`${c.remove}: ${id}`}>
                    {id}
                  </Chip>
                ))}
              </div>
            )}
          </Panel>

          {iconsPanel}
        </div>
      </section>

      {/* overlays */}
      <Drawer
        open={!!open}
        onClose={() => setOpenId(null)}
        eyebrow={open?.id}
        title={open ? open.category[lang] : ''}
        footer={
          open &&
          byId.has(open.id) && (
            <>
              <Button variant="ghost" icon={saved.includes(open.id) ? 'check' : 'meja'} onClick={() => saveTicket(open.id)}>
                {saved.includes(open.id) ? c.savedMeeting : c.saveMeeting}
              </Button>
              {open.status === 'selesai' ? (
                <Button variant="secondary" icon="replay" onClick={() => setStatus(open.id, 'baru')}>
                  {c.reopen}
                </Button>
              ) : nextStatus(open.status) === 'selesai' ? (
                <Button variant="primary" icon="check" onClick={() => setConfirmId(open.id)}>
                  {c.markDone}
                </Button>
              ) : (
                <Button variant="primary" icon="arrowRight" onClick={() => setStatus(open.id, nextStatus(open.status) ?? 'proses')}>
                  {c.advance(STATUS_LABEL[nextStatus(open.status) ?? 'proses'][lang])}
                </Button>
              )}
            </>
          )
        }
      >
        {open && (
          <div className="dk-scu-detail">
            <div className="dk-scu-row">
              <StatusChip label={STATUS_LABEL[open.status][lang]} tone={statusTone(open.status)} />
              <SlaLabel minutesLeft={open.slaMin} done={open.status === 'selesai'} />
            </div>
            <blockquote className="dk-scu-quote">“{open.text[lang]}”</blockquote>
            <dl className="dk-scu-dl">
              <div>
                <dt>{c.drawerFrom}</dt>
                <dd>
                  <Avatar name={open.from} size={24} /> {open.from}
                </dd>
              </div>
              <div>
                <dt>{c.drawerCh}</dt>
                <dd>{chLabel(open.channel)}</dd>
              </div>
              <div>
                <dt>{c.drawerKec}</dt>
                <dd>{open.kecamatan}</dd>
              </div>
              <div>
                <dt>{c.drawerOpd}</dt>
                <dd>{open.opd}</dd>
              </div>
              <div>
                <dt>{c.drawerAt}</dt>
                <dd className="dk-num">{fmtTime(open.at)}</dd>
              </div>
            </dl>
            <p className="dk-scu-cap">{c.flow}</p>
            <Stepper orientation="vertical" label={c.flow} steps={STATUS_FLOW.map((s) => STATUS_LABEL[s][lang])} current={open.status === 'selesai' ? STATUS_FLOW.length : STATUS_FLOW.indexOf(open.status)} />
            <InsightCallout>{c.insight}</InsightCallout>
          </div>
        )}
      </Drawer>

      <Modal
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        size="sm"
        title={c.confirmTitle(confirmId ?? '')}
        description={c.confirmBody}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmId(null)}>
              {c.cancel}
            </Button>
            <Button
              variant="primary"
              icon="check"
              data-autofocus
              onClick={() => {
                if (confirmId) setStatus(confirmId, 'selesai')
                setConfirmId(null)
              }}
            >
              {c.confirm}
            </Button>
          </>
        }
      />

      <Confetti fire={confetti} />
      <ToastStack apiRef={toastApi} />
    </div>
  )
}
