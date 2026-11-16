/**
 * /lab/_kit showcase section for the "shell" module — owned by the shell builder.
 * A full DemoShell (product "sapa-warga") in a bounded container around a tiny fake canvas that uses the REAL
 * world: a mini inbox (useWorld) and buttons that emit complaint.created. Five flood complaints close together
 * form a cluster (world/reactions.ts) → the EventToast "Aduan #… diteruskan ke Meja Pimpinan". Missions tick
 * from world events and UI steps; clock, role, reset, palette (Ctrl K) and the hotspot all work.
 */
import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { ROLES } from '../../content/products'
import { BrowserFrame } from '../frames'
import { Button, Inbox, Kpi, Panel, StatusChip, EmptyState, type InboxItem } from '../ui'
import { clock, emit, formatTime, shallowEqual, useClock, useSession, useWorld, type Complaint, type WorldState } from '../world'
import { DemoShell, CoachMark, useShell, type Mission } from '../shell'
import { regionalLanguageLabel } from '../i18n'
import './shell.css'

type L = 'id' | 'en'
const T = {
  id: {
    note: 'DemoShell lengkap di dalam wadah terbatas. Coba: kirim aduan, buka satu aduan, ganti peran, jalankan jam, lalu "Lonjakan aduan banjir" untuk memicu toast lintas produk. Ctrl/Cmd + K membuka palet.',
    heading: 'Aduan warga masuk, langsung rapi',
    inbox: 'Kotak masuk aduan',
    send: 'Kirim aduan warga',
    surge: 'Lonjakan aduan banjir',
    surgeHint: '5 aduan berdekatan membentuk klaster → Meja Pimpinan',
    today: 'Aduan hari ini',
    open: 'Belum selesai',
    view: 'Tampilan untuk',
    detail: 'Detail aduan',
    pick: 'Pilih aduan di kotak masuk',
    pickBody: 'Detailnya muncul di sini, lengkap dengan teks asli dalam bahasa daerah.',
    original: 'Teks asli',
    channel: 'Kanal',
    coach: 'Aduan baru masuk dari sini',
    coachBody: 'Setiap aduan menjadi event dunia: KPI, kotak masuk, dan misi ikut berubah.',
    tip: 'Tampilkan tip',
    focus: 'Dibuka dari tautan',
  },
  en: {
    note: 'A complete DemoShell in a bounded container. Try: send a complaint, open one, switch role, run the clock, then "Flood complaint surge" to trigger a cross-product toast. Ctrl/Cmd + K opens the palette.',
    heading: 'Citizen complaints arrive already tidy',
    inbox: 'Complaint inbox',
    send: 'Send a citizen complaint',
    surge: 'Flood complaint surge',
    surgeHint: '5 nearby complaints form a cluster → Meja Pimpinan',
    today: 'Complaints today',
    open: 'Still open',
    view: 'View for',
    detail: 'Complaint detail',
    pick: 'Pick a complaint in the inbox',
    pickBody: 'Its detail appears here, with the original text in the regional language.',
    original: 'Original text',
    channel: 'Channel',
    coach: 'New complaints come in here',
    coachBody: 'Every complaint is a world event: KPIs, the inbox and the missions all follow.',
    tip: 'Show tip',
    focus: 'Opened from a link',
  },
} satisfies Record<L, Record<string, string>>

const MISSIONS: Mission[] = [
  {
    id: 'send',
    label: { id: 'Kirim satu aduan warga', en: 'Send one citizen complaint' },
    hint: {
      id: 'Tombol "Kirim aduan warga"',
      en: 'The "Send a citizen complaint" button',
    },
    done: (e) => e.type === 'complaint.created' && e.source === 'sapa-warga',
  },
  {
    id: 'open',
    label: { id: 'Buka salah satu aduan', en: 'Open one complaint' },
  },
  {
    id: 'role',
    label: {
      id: 'Ganti peran ke Petugas Layanan',
      en: 'Switch role to Service Officer',
    },
    hint: {
      id: 'Pemilih peran di bilah atas',
      en: 'The role picker in the top bar',
    },
  },
  {
    id: 'clock',
    label: { id: 'Jalankan jam dunia', en: 'Run the world clock' },
  },
  {
    id: 'cluster',
    label: { id: 'Picu klaster banjir', en: 'Trigger a flood cluster' },
    hint: {
      id: '5 aduan berdekatan → Meja Pimpinan',
      en: '5 nearby complaints → Meja Pimpinan',
    },
    done: (e) => e.type === 'complaint.clustered',
  },
]

const latest = (s: WorldState): Complaint[] =>
  s.complaints.ids
    .slice(0, 8)
    .map((id) => s.complaints.byId[id]!)
    .filter(Boolean)

function MiniSapaWarga() {
  const { lang } = useI18n()
  const t = T[lang]
  const shell = useShell()
  const { role } = useSession()
  const c = useClock()
  const items = useWorld(latest, shallowEqual)
  const counts = useWorld((s) => {
    let today = 0
    let open = 0
    for (const id of s.complaints.ids) {
      const x = s.complaints.byId[id]
      if (!x || x.at < 0) continue
      today++
      const tk = s.tickets.byId[x.ticketId]
      if (tk && tk.status !== 'selesai') open++
    }
    return { today, open }
  }, shallowEqual)
  const region = useWorld((s) => s.region)
  const [sel, setSel] = useState<string | null>(null)
  const [coach, setCoach] = useState(false)
  const selected = useWorld((s) => (sel ? (s.complaints.byId[sel] ?? null) : null))

  // UI-only missions
  useEffect(() => {
    if (role === 'petugas') shell.markMission('role')
  }, [role, shell])
  useEffect(() => {
    if (c.running) shell.markMission('clock')
  }, [c.running, shell])
  // ?focus=<complaintId> opens that complaint
  useEffect(() => {
    if (shell.focus && items.some((i) => i.id === shell.focus)) setSel(shell.focus)
  }, [shell.focus, items])

  const pack = shell.pack
  const tpls = useMemo(() => pack?.languages.samples.complaintTemplates ?? [], [pack])
  const n = useWorld((s) => s.complaints.ids.length)

  const sendOne = () => {
    const kec = region.kecamatan[n % Math.max(1, region.kecamatan.length)]
    const desa = kec?.desa[0]
    const tpl = tpls[n % Math.max(1, tpls.length)]
    if (!kec || !desa) return
    emit(
      'complaint.created',
      {
        category: tpl?.category ?? 'jalan-rusak',
        channel: 'wa',
        text: tpl?.text ?? 'Dalan rusak parah, akeh bolongan.',
        lang: tpl?.lang ?? 'jv',
        summary: tpl?.translation ?? {
          id: 'Jalan rusak parah, banyak lubang.',
          en: 'Badly damaged road, many potholes.',
        },
        kecamatanId: kec.id,
        desaId: desa.id,
        coord: desa.centroid,
        urgency: 'sedang',
        templateId: tpl?.id,
      },
      'sapa-warga',
    )
  }
  const surge = () => {
    const kec = region.kecamatan.find((k) => region.floodKecamatanIds.includes(k.id)) ?? region.kecamatan[0]
    const desa = kec?.desa[0]
    if (!kec || !desa) return
    const flood = tpls.find((x) => x.category === 'banjir')
    for (let i = 0; i < 5; i++) {
      const [lng, lat] = desa.centroid
      emit(
        'complaint.created',
        {
          category: 'banjir',
          channel: i % 2 ? 'wa' : 'voice',
          text: flood?.text ?? 'Banyu wis mlebu omah, dalan ora iso diliwati.',
          lang: flood?.lang ?? 'jv',
          summary: flood?.translation ?? {
            id: 'Air sudah masuk rumah, jalan tidak bisa dilewati.',
            en: 'Water has entered homes, the road is impassable.',
          },
          kecamatanId: kec.id,
          desaId: desa.id,
          coord: [lng + i * 0.0012, lat + i * 0.0008],
          urgency: 'tinggi',
          templateId: flood?.id,
        },
        'sapa-warga',
      )
    }
  }

  const inbox: InboxItem[] = items.map((x) => ({
    id: x.id,
    title: `${x.code} · ${region.kecamatan.find((k) => k.id === x.kecamatanId)?.name ?? ''}`,
    preview: x.summary[lang],
    time: formatTime(Math.max(0, x.at)),
    icon: x.channel === 'voice' ? 'mic' : x.channel === 'telepon' ? 'phone' : 'chat',
    tone: x.urgency === 'tinggi' ? 'warn' : undefined,
  }))

  const petugas = role !== 'warga'
  return (
    <BrowserFrame slug="sapa-warga" label="Sapa Warga">
      <div className="dk-sc-shell-canvas">
        <div className="dk-sc-shell-head">
          <div>
            <p className="dk-sc-shell-view">
              {t.view} <strong>{ROLES[role].name[lang]}</strong>
              {shell.focus && <StatusChip tone="neutral" label={t.focus} />}
            </p>
            <h3 className="dk-sc-shell-h">{t.heading}</h3>
          </div>
          <div className="dk-sc-shell-actions">
            <Button variant="primary" icon="send" onClick={sendOne} data-hotspot="kirim">
              {t.send}
            </Button>
            <Button variant="secondary" icon="water" onClick={surge} title={t.surgeHint}>
              {t.surge}
            </Button>
            <Button variant="ghost" size="sm" icon="info" onClick={() => setCoach(true)} id="dk-sc-shell-tip">
              {t.tip}
            </Button>
          </div>
        </div>
        <div className="dk-sc-shell-kpis">
          <Kpi label={t.today} value={counts.today} />
          <Kpi label={t.open} value={counts.open} />
        </div>
        <div className={`dk-sc-shell-grid${petugas ? '' : ' is-warga'}`}>
          <Panel title={t.inbox}>
            <Inbox
              label={t.inbox}
              items={inbox}
              selectedId={sel}
              onSelect={(id) => {
                setSel(id)
                shell.markMission('open')
              }}
            />
          </Panel>
          <Panel title={t.detail}>
            {selected ? (
              <dl className="dk-sc-shell-dl">
                <dt>{selected.code}</dt>
                <dd>{selected.summary[lang]}</dd>
                <dt>
                  {t.original}
                  {selected.lang !== 'id' && pack ? ` · ${regionalLanguageLabel(pack, lang)}` : ''}
                </dt>
                <dd lang={selected.lang === 'id' ? 'id' : 'jv'}>
                  <em>{selected.text}</em>
                </dd>
                <dt>{t.channel}</dt>
                <dd>{selected.channel.toUpperCase()}</dd>
              </dl>
            ) : (
              <EmptyState compact art="inbox" title={t.pick} body={t.pickBody} />
            )}
          </Panel>
        </div>
      </div>
      <CoachMark target="[data-hotspot=kirim]" open={coach} title={t.coach} onClose={() => setCoach(false)}>
        {t.coachBody}
      </CoachMark>
    </BrowserFrame>
  )
}

export default function Section() {
  const { lang } = useI18n()
  // the showcase never leaves the clock running when the section unmounts
  useEffect(() => () => clock.pause(), [])
  return (
    <div className="dk-sc-shell">
      <p className="dk-sc-shell-note">{T[lang].note}</p>
      <div className="dk-sc-shell-box">
        <DemoShell product="sapa-warga" layout="contained" missions={MISSIONS} hotspot={{ target: '[data-hotspot=kirim]', id: 'showcase-kirim' }} canvas={<MiniSapaWarga />} />
      </div>
    </div>
  )
}
