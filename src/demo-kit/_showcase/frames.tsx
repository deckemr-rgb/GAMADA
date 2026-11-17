/**
 * /lab/_kit showcase — "frames" module (owner: ui builder). All five device frames with realistic,
 * fictional content: a console in BrowserFrame, a citizen chat in PhoneFrame, a cashier in TabletFrame
 * (Usaha Pintar accent), a leadership wall in WallScreenFrame, and two printable PaperFrames.
 */
import { useEffect, useRef, useState } from 'react'
import { useI18n, type Lang } from '../../lib/i18n'
import { BrowserFrame, PaperFrame, PhoneFrame, TabletFrame, WallScreenFrame, printPaper } from '../frames'
import { Avatar, Button, Chip, IconButton, InsightCallout, Kpi, KpiStrip, Score, SlaLabel, StatusChip, Table, Timeline, dropChips, fmtNum, type TableColumn } from '../ui'
import { STATUS_LABEL, fmtTime, sampleTickets, type Ticket } from '../ui/__fixtures__/sample'
import '../ui/__fixtures__/showcase-ui.css'
import '../ui/__fixtures__/showcase-frames.css'

const C = {
  id: {
    browser: 'Konsol Sapa Warga di peramban',
    phone: 'Simulasi layar HP warga',
    tablet: 'Kasir Toko Autopilot di tablet',
    wall: 'Layar dinding ruang rapat pimpinan',
    wallCap: 'Ruang rapat pimpinan · layar dinding',
    letter: 'Surat masuk 005/412/412.204/2026',
    report: 'Laporan harian aduan',
    print: 'Cetak surat',
    printReport: 'Cetak laporan',
    kpis: ['Aduan hari ini', 'SLA tepat waktu', 'Terlambat'],
    cols: ['Tiket', 'Kategori', 'Kecamatan', 'Status', 'Sisa SLA'],
    chatName: 'Layanan Kabupaten',
    chatSub: 'Akun resmi · dibalas asisten AI',
    msgIn: 'Lampu jalan di pertigaan Desa Ngumpakdalem mati sudah seminggu, Pak. Gelap sekali kalau malam.',
    msgOut: 'Terima kasih, Bu Dwi. Aduan Anda tercatat sebagai SW-2026-0142 dan diteruskan ke Dishub. Target penanganan 3 hari kerja.',
    chips: 'Hasil klasifikasi',
    replay: 'Putar ulang klasifikasi',
    today: 'Hari ini',
    cart: 'Keranjang',
    total: 'Total',
    pay: 'Bayar',
    add: (n: string) => `Tambah ${n}`,
    cats: { all: 'Semua', bangun: 'Bahan bangunan', pipa: 'Pipa & lem', cat: 'Cat' },
    catsLabel: 'Kategori produk',
    inCart: (n: number) => `${n} di keranjang`,
    clear: 'Kosongkan',
    items: 'item',
    wallTitle: 'Ringkasan pagi',
    wallLead: 'Kabupaten Bojonegoro · data simulasi',
    hero: 'Aduan terselesaikan minggu ini',
    wallKpis: ['SLA tepat waktu', 'Peringatan aktif', 'Indeks layanan'],
    agenda: 'Agenda & tindak lanjut',
    agendaItems: [
      ['09.00', 'Rapat koordinasi banjir dengan BPBD dan DPU SDA'],
      ['10.30', 'Tinjau 3 tiket terlambat di Dinas Perhubungan'],
      ['13.00', 'Klarifikasi isu harga beras bersama Disperindag'],
    ] as [string, string][],
    districts: 'Aduan per kecamatan (7 hari)',
    insight: 'Genangan di Kalitidu dan Trucuk naik dua hari berturut-turut. Siapkan pompa air portabel sebelum hujan sore.',
    to: 'Kepada Yth. Bupati Bojonegoro',
    via: 'melalui Sekretaris Daerah',
    subject: 'Perihal: Permohonan perbaikan jalan poros Desa Sumberrejo',
    body1: 'Dengan hormat, bersama surat ini kami sampaikan bahwa ruas jalan poros desa sepanjang ±1,2 km mengalami kerusakan berat sejak musim hujan.',
    body2: 'Kerusakan tersebut mengganggu akses 340 kepala keluarga ke pasar dan puskesmas. Kami mohon ruas ini dimasukkan ke prioritas pemeliharaan tahun berjalan.',
    sign: 'Kepala Desa',
    reportTitle: 'Laporan harian aduan warga',
    reportMeta: 'Selasa, 17 November 2026 · disusun otomatis 16.00 WIB',
  },
  en: {
    browser: 'Sapa Warga console in a browser',
    phone: 'Simulated citizen phone screen',
    tablet: 'Toko Autopilot cashier on a tablet',
    wall: 'Leadership meeting-room wall screen',
    wallCap: 'Leadership meeting room · wall screen',
    letter: 'Incoming letter 005/412/412.204/2026',
    report: 'Daily complaints report',
    print: 'Print letter',
    printReport: 'Print report',
    kpis: ['Complaints today', 'SLA on time', 'Overdue'],
    cols: ['Ticket', 'Category', 'District', 'Status', 'SLA left'],
    chatName: 'Layanan Kabupaten',
    chatSub: 'Official account · answered by AI assistant',
    msgIn: 'Lampu jalan di pertigaan Desa Ngumpakdalem mati sudah seminggu, Pak. Gelap sekali kalau malam.',
    msgOut: 'Thank you, Mrs Dwi. Your complaint is logged as SW-2026-0142 and sent to the Transport Office. Target: 3 working days.',
    chips: 'Classification',
    replay: 'Replay classification',
    today: 'Today',
    cart: 'Cart',
    total: 'Total',
    pay: 'Pay',
    add: (n: string) => `Add ${n}`,
    cats: { all: 'All', bangun: 'Building materials', pipa: 'Pipes & glue', cat: 'Paint' },
    catsLabel: 'Product categories',
    inCart: (n: number) => `${n} in cart`,
    clear: 'Clear',
    items: 'items',
    wallTitle: 'Morning brief',
    wallLead: 'Bojonegoro Regency · simulated data',
    hero: 'Complaints resolved this week',
    wallKpis: ['SLA on time', 'Active alerts', 'Service index'],
    agenda: 'Agenda & follow-ups',
    agendaItems: [
      ['09.00', 'Flood coordination meeting with BPBD and DPU SDA'],
      ['10.30', 'Review 3 overdue tickets at the Transport Office'],
      ['13.00', 'Rice price rumour clarification with Disperindag'],
    ] as [string, string][],
    districts: 'Complaints by district (7 days)',
    insight: 'Standing water in Kalitidu and Trucuk rose two days in a row. Stage portable pumps before the afternoon rain.',
    to: 'To the Regent of Bojonegoro',
    via: 'through the Regional Secretary',
    subject: 'Re: Request to repair the main road of Sumberrejo village',
    body1: 'With respect, we report that about 1.2 km of the main village road has been badly damaged since the rainy season.',
    body2: 'The damage cuts off 340 households from the market and the health centre. We ask that this road be prioritised in this year’s maintenance.',
    sign: 'Village Head',
    reportTitle: 'Daily citizen complaints report',
    reportMeta: 'Tuesday, 17 November 2026 · generated 16.00 WIB',
  },
} as const

/* a fictional building-supply shop's shelf (sample prices) */
type PosCat = 'bangun' | 'pipa' | 'cat'
const PRODUCTS_POS: readonly { id: string; name: string; price: number; cat: PosCat }[] = [
  { id: 'semen', name: 'Semen 40 kg', price: 62000, cat: 'bangun' },
  { id: 'paku', name: 'Paku 5 cm (1 kg)', price: 21000, cat: 'bangun' },
  { id: 'kawat', name: 'Kawat bendrat', price: 27000, cat: 'bangun' },
  { id: 'pasir', name: 'Pasir (karung)', price: 18000, cat: 'bangun' },
  { id: 'bata', name: 'Bata ringan (10 pcs)', price: 95000, cat: 'bangun' },
  { id: 'pipa', name: 'Pipa PVC 3/4"', price: 34500, cat: 'pipa' },
  { id: 'lem', name: 'Lem pipa', price: 12500, cat: 'pipa' },
  { id: 'keni', name: 'Keni PVC 3/4"', price: 4500, cat: 'pipa' },
  { id: 'kran', name: 'Kran air 1/2"', price: 23000, cat: 'pipa' },
  { id: 'cat', name: 'Cat tembok 5 kg', price: 118000, cat: 'cat' },
  { id: 'kuas', name: 'Kuas 3 inci', price: 9500, cat: 'cat' },
  { id: 'roll', name: 'Roll cat 9 inci', price: 26000, cat: 'cat' },
]
const POS_CATS = ['all', 'bangun', 'pipa', 'cat'] as const

const DISTRICTS: [string, number][] = [
  ['Kalitidu', 31],
  ['Trucuk', 24],
  ['Bojonegoro', 19],
  ['Kanor', 12],
]

const rupiah = (lang: Lang, n: number) => `Rp ${fmtNum(lang, n)}`

function useCols(lang: Lang, cols: readonly string[]): TableColumn<Ticket>[] {
  return [
    { id: 'id', header: cols[0]!, value: (t) => t.id, width: 112, card: 'meta', cell: (t) => <span className="dk-num dk-faint">{t.id}</span> },
    { id: 'cat', header: cols[1]!, value: (t) => t.category[lang], min: 120, grow: 1.4, card: 'title' },
    { id: 'kec', header: cols[2]!, value: (t) => t.kecamatan, min: 90 },
    { id: 'st', header: cols[3]!, value: (t) => t.status, width: 150, cell: (t) => <StatusChip label={STATUS_LABEL[t.status][lang]} tone={t.status === 'baru' ? 'new' : t.status === 'selesai' ? 'done' : 'neutral'} /> },
    { id: 'sla', header: cols[4]!, value: (t) => t.slaMin, width: 100, numeric: true, cell: (t) => <SlaLabel minutesLeft={t.slaMin} done={t.status === 'selesai'} /> },
  ]
}

export default function Section() {
  const { lang } = useI18n()
  const c = C[lang]
  const tickets = sampleTickets()
  const cols = useCols(lang, c.cols)
  const reportCols = cols.filter((col) => col.id !== 'kec').map((col) => (col.id === 'id' ? { ...col, width: 104 } : col.id === 'cat' ? { ...col, min: 110 } : col.id === 'st' ? { ...col, width: 140 } : col.id === 'sla' ? { ...col, width: 96 } : col))
  const [cart, setCart] = useState<Record<string, number>>({ semen: 4, paku: 1 })
  const [posCat, setPosCat] = useState<(typeof POS_CATS)[number]>('all')
  const chipsRef = useRef<HTMLDivElement>(null)
  const letterRef = useRef<HTMLDivElement>(null)
  const reportRef = useRef<HTMLDivElement>(null)
  const [replay, setReplay] = useState(0)
  useEffect(() => {
    if (!replay || !chipsRef.current) return
    return dropChips(chipsRef.current)
  }, [replay])
  const total = PRODUCTS_POS.reduce((s, p) => s + (cart[p.id] ?? 0) * p.price, 0)
  const count = Object.values(cart).reduce((s, n) => s + n, 0)
  const late = tickets.filter((t) => t.slaMin < 0 && t.status !== 'selesai').length

  return (
    <div className="dk-root dk-scf" data-eco="satu-daerah">
      {/* Browser */}
      <BrowserFrame slug="sapa-warga" label={c.browser}>
        <div className="dk-scf-console">
          <KpiStrip>
            <Kpi label={c.kpis[0]} value={142} delta={18} goodWhen="down" />
            <Kpi label={c.kpis[1]} value={85.7} decimals={1} unit="%" delta={2.1} goodWhen="up" />
            <Kpi label={c.kpis[2]} value={late} delta={-1} goodWhen="down" />
          </KpiStrip>
          <Table rows={tickets.slice(0, 6)} columns={cols} rowId={(t) => t.id} label={c.browser} densityToggle={false} rowTone={(t) => (t.slaMin < 0 && t.status !== 'selesai' ? 'danger' : undefined)} />
        </div>
      </BrowserFrame>

      {/* Phone + Tablet */}
      <div className="dk-scf-row">
        <div>
          <PhoneFrame label={c.phone} time={fmtTime(8 * 60 + 42)} width={290}>
            <div className="dk-scf-chat">
              <header className="dk-scf-chat-h">
                <Avatar name="Layanan Kabupaten" initials="LK" size={32} ring />
                <span>
                  <b>{c.chatName}</b>
                  <small>{c.chatSub}</small>
                </span>
              </header>
              <p className="dk-scf-day">{c.today}</p>
              <div className="dk-scf-msg is-in">
                {c.msgIn}
                <small>08.41</small>
              </div>
              <div className="dk-scf-msg is-out">
                {c.msgOut}
                <small>08.42 ✓✓</small>
              </div>
              <p className="dk-scf-chips-l">{c.chips}</p>
              <div className="dk-scf-chips" ref={chipsRef}>
                <Chip tone="accent" icon="tag">
                  {lang === 'id' ? 'Lampu jalan mati' : 'Street light out'}
                </Chip>
                <Chip icon="building">Dishub</Chip>
                <Chip icon="pin">Dander</Chip>
                <Chip tone="warn" icon="clock">
                  {lang === 'id' ? 'Prioritas sedang' : 'Medium priority'}
                </Chip>
              </div>
              <div className="dk-scf-replay">
                <Button size="sm" variant="quiet" icon="replay" onClick={() => setReplay((n) => n + 1)}>
                  {c.replay}
                </Button>
              </div>
            </div>
          </PhoneFrame>
        </div>

        <div data-eco="usaha-pintar">
          <TabletFrame label={c.tablet} time="10.15">
            <div className="dk-scf-pos">
              <div className="dk-scf-pos-main">
                <div className="dk-scf-pos-cats" role="group" aria-label={c.catsLabel}>
                  {POS_CATS.map((k) => (
                    <Chip key={k} selected={posCat === k} onToggle={() => setPosCat(k)}>
                      {c.cats[k]}
                    </Chip>
                  ))}
                </div>
                <div className="dk-scf-pos-grid">
                  {PRODUCTS_POS.filter((p) => posCat === 'all' || p.cat === posCat).map((p) => (
                    <button key={p.id} type="button" className="dk-scf-pos-item" onClick={() => setCart((s) => ({ ...s, [p.id]: (s[p.id] ?? 0) + 1 }))} aria-label={`${c.add(p.name)}${cart[p.id] ? `, ${c.inCart(cart[p.id]!)}` : ''}`}>
                      <span className="dk-scf-pos-name">{p.name}</span>
                      <span className="dk-scf-pos-foot">
                        <span className="dk-num dk-faint">{rupiah(lang, p.price)}</span>
                        {cart[p.id] ? <span className="dk-scf-pos-qty dk-num">{cart[p.id]}</span> : null}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <aside className="dk-scf-pos-cart" aria-label={c.cart}>
                <header>
                  <b>{c.cart}</b>
                  <span className="dk-faint dk-num">
                    {count} {c.items}
                  </span>
                  <IconButton icon="trash" label={c.clear} size="sm" onClick={() => setCart({})} />
                </header>
                <ul>
                  {PRODUCTS_POS.filter((p) => cart[p.id]).map((p) => (
                    <li key={p.id}>
                      <span>
                        {cart[p.id]} × {p.name}
                      </span>
                      <span className="dk-num">{rupiah(lang, (cart[p.id] ?? 0) * p.price)}</span>
                    </li>
                  ))}
                </ul>
                <div className="dk-scf-pos-total">
                  <span>{c.total}</span>
                  <b className="dk-num" aria-live="polite">
                    {rupiah(lang, total)}
                  </b>
                </div>
                <Button variant="primary" size="lg" icon="wallet" onClick={() => setCart({})}>
                  {c.pay}
                </Button>
              </aside>
            </div>
          </TabletFrame>
        </div>
      </div>

      {/* Wall */}
      <WallScreenFrame label={c.wall} caption={c.wallCap}>
        <div className="dk-scf-wall">
          <header>
            <p className="dk-scf-wall-t dk-display">{c.wallTitle}</p>
            <p className="dk-faint">{c.wallLead}</p>
          </header>
          <div className="dk-scf-wall-main">
            <Kpi hero label={c.hero} value={412} delta={37} goodWhen="up" />
            <KpiStrip>
              <Kpi label={c.wallKpis[0]} value={87.4} decimals={1} unit="%" delta={2.1} goodWhen="up" />
              <Kpi label={c.wallKpis[1]} value={3} delta={2} goodWhen="down" />
              <Kpi label={c.wallKpis[2]} value={78} unit="/100" delta={1} goodWhen="up" />
            </KpiStrip>
          </div>
          <div className="dk-scf-wall-low">
            <section>
              <p className="dk-scf-wall-h">{c.agenda}</p>
              <Timeline
                label={c.agenda}
                variant="story"
                items={c.agendaItems.map((t, i) => ({ id: `a${i}`, time: t[0], title: t[1], tone: i === 0 ? 'accent' : 'neutral' }))}
              />
            </section>
            <section>
              <p className="dk-scf-wall-h">{c.districts}</p>
              <div className="dk-scf-wall-bars">
                {DISTRICTS.map(([k, v]) => (
                  <Score key={k} variant="bar" label={k} value={v} max={40} warn={0} danger={0} />
                ))}
              </div>
            </section>
          </div>
          <InsightCallout>{c.insight}</InsightCallout>
        </div>
      </WallScreenFrame>

      {/* Papers */}
      <div className="dk-scf-papers">
        <div>
          <div ref={letterRef}>
            <PaperFrame label={c.letter} scanned>
              <div className="dk-scf-letter">
                <header className="dk-scf-kop">
                  <span className="dk-scf-emblem" aria-hidden="true" />
                  <div>
                    <p>PEMERINTAH KABUPATEN BOJONEGORO</p>
                    <p className="dk-scf-kop-b">KECAMATAN SUMBERREJO · DESA SUMBERREJO</p>
                    <p className="dk-scf-kop-s">Jl. Raya Sumberrejo · Bojonegoro</p>
                  </div>
                </header>
                <p className="dk-scf-meta">
                  <span>
                    <i>1</i>Nomor: 005/412/412.204/2026
                  </span>
                  <span>
                    <i>2</i>Sumberrejo, 12 November 2026
                  </span>
                </p>
                <p>
                  <i className="dk-scf-mark">3</i>
                  {c.to}
                  <br />
                  {c.via}
                </p>
                <p className="dk-scf-subj">
                  <i className="dk-scf-mark">4</i>
                  {c.subject}
                </p>
                <p>{c.body1}</p>
                <p>{c.body2}</p>
                <div className="dk-scf-sign">
                  <i className="dk-scf-mark">5</i>
                  <span>{c.sign}</span>
                  <svg viewBox="0 0 120 40" width="120" height="40" aria-hidden="true">
                    <path d="M4 30c10-18 18-22 22-10s-6 14 4 4 14-22 20-8 6 10 14 0 12-12 18-2 10 6 30-6" fill="none" stroke="#2a2a5a" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                  <b>( . . . . . . . . . . . . )</b>
                </div>
              </div>
            </PaperFrame>
          </div>
          <div className="dk-scf-pbtn">
            <Button variant="quiet" icon="print" onClick={() => letterRef.current && printPaper(letterRef.current.querySelector('.dk-paper') ?? letterRef.current)}>
              {c.print}
            </Button>
          </div>
        </div>
        <div>
          <div ref={reportRef}>
            <PaperFrame label={c.report} size="auto">
              <h3 className="dk-scf-rep-t dk-display">{c.reportTitle}</h3>
              <p className="dk-scf-rep-m">{c.reportMeta}</p>
              <Table variant="ruled" rows={tickets.slice(0, 8)} columns={reportCols} rowId={(t) => t.id} label={c.report} densityToggle={false} cardBreakpoint={460} />
            </PaperFrame>
          </div>
          <div className="dk-scf-pbtn">
            <Button variant="quiet" icon="print" onClick={() => reportRef.current && printPaper(reportRef.current.querySelector('.dk-paper') ?? reportRef.current)}>
              {c.printReport}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
