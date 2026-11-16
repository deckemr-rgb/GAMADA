/**
 * Fictional sample data for the viz showcase (and for anyone needing chart fixtures). Everything is generated
 * from a seed: businesses, vendors, markets-as-labels and numbers are invented. Place names (kecamatan in
 * Bojonegoro) are real geography only.
 */
import type { Lang } from '../format'
import type { SankeyLink } from '../SankeyLite'

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const L = (id: string, en: string): Bi => ({ id, en })
type Bi = { id: string; en: string }

/** The demo day (WIB): 17 Nov 2026 12:00 WIB. */
export const DEMO_DAY = Date.UTC(2026, 10, 17, 5, 0, 0)
const DAY = 86_400_000

export function makeDemoData(seed: number, lang: Lang) {
  const r = mulberry32(seed)
  const rnd = (a: number, b: number) => a + (b - a) * r()
  const int = (a: number, b: number) => Math.round(rnd(a, b))
  const t = (b: Bi) => b[lang]

  /* 1 · daily complaints: 30 days actual + 7 forecast */
  const actual: number[] = []
  let v = int(96, 112)
  for (let i = 0; i < 30; i++) {
    v = Math.round(v + (112 + i * 0.6 - v) * 0.25 + rnd(-8, 8))
    actual.push(i % 7 === 5 ? v - int(10, 16) : i % 7 === 6 ? v - int(6, 10) : v)
  }
  const lastA = actual[29] ?? 120
  const fc = Array.from({ length: 7 }, (_, i) => Math.round(lastA + (i + 1) * rnd(0.5, 2.6) + Math.sin(i) * 4))
  const band = fc.map((_, i) => Math.round(5 + i * 2.2))
  const days = Array.from({ length: 37 }, (_, i) => new Date(DEMO_DAY + (i - 29) * DAY))

  /* 2 · KPI tiles */
  const revenue14 = Array.from({ length: 14 }, () => int(18, 34) * 1_000_000 + int(0, 999) * 1000)
  const sla = Math.round(rnd(84, 93) * 10) / 10
  const doneY = int(118, 140)
  const doneT = doneY + int(-12, 18)

  /* 3 · chilli price per market (Rp/kg), 14 days */
  const markets = [L('Pasar Kota', 'Town market'), L('Pasar Kalitidu', 'Kalitidu market'), L('Pasar Padangan', 'Padangan market')]
  const price = markets.map((_, m) => {
    let p = 52_000 + m * 3500 + int(-2000, 2000)
    return Array.from({ length: 14 }, (_, i) => {
      p = Math.round((p + rnd(-2600, 3400) + (i > 9 ? 1800 : 0)) / 500) * 500
      return p
    })
  })
  const days14 = Array.from({ length: 14 }, (_, i) => new Date(DEMO_DAY + (i - 13) * DAY))

  /* 4 · sales per hour today vs yesterday */
  const hours = Array.from({ length: 14 }, (_, i) => 8 + i)
  const curve = (h: number) => Math.exp(-((h - 12.5) ** 2) / 10) * 0.9 + Math.exp(-((h - 18.5) ** 2) / 6) * 0.75 + 0.15
  const sales = hours.map((h) => {
    const base = curve(h) * 4_200_000
    return { label: `${String(h).padStart(2, '0')}`, value: Math.round((base * rnd(0.8, 1.25)) / 1000) * 1000, prev: Math.round((base * rnd(0.8, 1.15)) / 1000) * 1000 }
  })

  /* 5 · price deviation vs reference (%) */
  const commodities = [L('Beras medium', 'Medium rice'), L('Cabai rawit', 'Bird’s-eye chilli'), L('Bawang merah', 'Shallots'), L('Minyak goreng', 'Cooking oil'), L('Gula pasir', 'Sugar'), L('Telur ayam', 'Eggs')]
  const deviation = commodities.map((c, i) => ({ label: t(c), value: Math.round((i === 1 ? rnd(12, 28) : rnd(-9, 9)) * 10) / 10 }))

  /* 6 · complaint channels */
  const channels = [L('WhatsApp', 'WhatsApp'), L('Situs web', 'Website'), L('Telepon', 'Phone'), L('Datang langsung', 'Walk-in'), L('Media sosial', 'Social media')]
  const chW = [int(380, 460), int(120, 180), int(70, 110), int(40, 80), int(90, 150)]
  const channelData = channels.map((c, i) => ({ label: t(c), value: chW[i] ?? 0 }))

  /* 7 · gauges */
  const satisfaction = Math.round(rnd(68, 88))
  const score = int(560, 860)

  /* 8 · radar: business profile vs sector */
  const axes = [L('Arus kas', 'Cash flow'), L('Margin', 'Margin'), L('Pertumbuhan', 'Growth'), L('Kepatuhan pajak', 'Tax compliance'), L('Reputasi', 'Reputation'), L('Perputaran stok', 'Stock turnover')].map(t)
  const radar = [
    { id: 'biz', label: 'Toko Sinar Makmur', values: axes.map(() => int(48, 92)) },
    { id: 'sector', label: t(L('Rata-rata sektor', 'Sector average')), values: axes.map(() => int(52, 70)) },
  ]

  /* 9 · sankey: channel → agency → status */
  const sNodes = [
    { id: 'wa', label: 'WhatsApp' },
    { id: 'web', label: t(L('Web & aplikasi', 'Web & app')) },
    { id: 'tel', label: t(L('Telepon', 'Phone')) },
    { id: 'pu', label: t(L('Dinas PU', 'Public Works')) },
    { id: 'kes', label: t(L('Dinas Kesehatan', 'Health Office')) },
    { id: 'dik', label: t(L('Dinas Pendidikan', 'Education Office')) },
    { id: 'ok', label: t(L('Selesai', 'Resolved')) },
    { id: 'run', label: t(L('Diproses', 'In progress')) },
    { id: 'late', label: t(L('Lewat SLA', 'Past SLA')) },
  ]
  const sLinks: SankeyLink[] = [
    { source: 'wa', target: 'pu', value: int(120, 170) },
    { source: 'wa', target: 'kes', value: int(60, 90) },
    { source: 'wa', target: 'dik', value: int(30, 50) },
    { source: 'web', target: 'pu', value: int(40, 70) },
    { source: 'web', target: 'dik', value: int(30, 50) },
    { source: 'tel', target: 'kes', value: int(20, 40) },
    { source: 'tel', target: 'pu', value: int(15, 30) },
  ]
  const inflow = (id: string) => sLinks.filter((l) => l.target === id).reduce((s, l) => s + l.value, 0)
  for (const id of ['pu', 'kes', 'dik']) {
    const total = inflow(id)
    const late = Math.round(total * rnd(0.04, 0.12))
    const run = Math.round(total * rnd(0.15, 0.3))
    sLinks.push({ source: id, target: 'ok', value: total - late - run }, { source: id, target: 'run', value: run }, { source: id, target: 'late', value: late, tone: 'neg' })
  }

  /* 10 · heat: weekday × hour */
  const weekdays = (lang === 'id' ? ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
  const heatCols = Array.from({ length: 17 }, (_, i) => String(6 + i).padStart(2, '0'))
  const heat = weekdays.map((_, d) => heatCols.map((_, h) => Math.max(0, Math.round((curve(6 + h) * (d >= 5 ? 6 : 14) + rnd(0, 4)) * (d === 0 ? 1.25 : 1)))))

  /* 11 · procurement network (fictional vendors) */
  const vendors = [
    { id: 'v1', label: 'CV Sumber Rejeki Abadi', cluster: 'addr' },
    { id: 'v2', label: 'CV Mitra Karya Lestari', cluster: 'addr' },
    { id: 'v3', label: 'CV Tiga Saudara Jaya', cluster: 'addr' },
    { id: 'v4', label: 'PT Bengawan Konstruksi', cluster: 'addr' },
    { id: 'v5', label: 'PT Arta Teknik Mandiri' },
    { id: 'v6', label: 'CV Cahaya Utama' },
    { id: 'v7', label: 'PT Lintas Beton Nusantara' },
    { id: 'v8', label: 'CV Karya Tani Makmur' },
  ]
  const tenders = [
    { id: 't1', label: t(L('Paket jalan Kalitidu', 'Kalitidu road package')) },
    { id: 't2', label: t(L('Rehab SD Padangan', 'Padangan school rehab')) },
    { id: 't3', label: t(L('Drainase Kota', 'Town drainage')) },
    { id: 't4', label: t(L('Pengadaan pupuk', 'Fertiliser supply')) },
  ]
  const people = [
    { id: 'p1', label: t(L('Direktur A (sama)', 'Director A (shared)')), cluster: 'addr' },
    { id: 'p2', label: t(L('Alamat Jl. Veteran 12', 'Address Jl. Veteran 12')), cluster: 'addr' },
  ]
  const netNodes = [
    ...tenders.map((x) => ({ ...x, group: 1, size: 9 })),
    ...vendors.map((x) => ({ ...x, group: x.cluster ? 2 : 0, size: 7, tone: x.cluster ? ('danger' as const) : undefined })),
    ...people.map((x) => ({ ...x, group: 4, size: 6 })),
  ]
  const rel = (id: string, en: string) => t(L(id, en))
  const netEdges = [
    { id: 'e1', source: 'v1', target: 't1', label: rel('Penawar · selisih 0,4%', 'Bidder · 0.4% apart'), tone: 'danger' as const, weight: 2 },
    { id: 'e2', source: 'v2', target: 't1', label: rel('Penawar · selisih 0,4%', 'Bidder · 0.4% apart'), tone: 'danger' as const, weight: 2 },
    { id: 'e3', source: 'v3', target: 't1', label: rel('Penawar', 'Bidder') },
    { id: 'e4', source: 'v5', target: 't1', label: rel('Penawar', 'Bidder') },
    { id: 'e5', source: 'v4', target: 't2', label: rel('Pemenang', 'Winner'), weight: 3 },
    { id: 'e6', source: 'v6', target: 't2', label: rel('Penawar', 'Bidder') },
    { id: 'e7', source: 'v2', target: 't3', label: rel('Pemenang', 'Winner'), weight: 3 },
    { id: 'e8', source: 'v7', target: 't3', label: rel('Penawar', 'Bidder') },
    { id: 'e9', source: 'v8', target: 't4', label: rel('Pemenang', 'Winner'), weight: 3 },
    { id: 'e10', source: 'v6', target: 't4', label: rel('Penawar', 'Bidder') },
    { id: 'e11', source: 'p1', target: 'v1', label: rel('Direktur yang sama', 'Same director'), tone: 'danger' as const },
    { id: 'e12', source: 'p1', target: 'v2', label: rel('Direktur yang sama', 'Same director'), tone: 'danger' as const },
    { id: 'e13', source: 'p2', target: 'v1', label: rel('Alamat terdaftar sama', 'Same registered address'), tone: 'warn' as const },
    { id: 'e14', source: 'p2', target: 'v3', label: rel('Alamat terdaftar sama', 'Same registered address'), tone: 'warn' as const },
    { id: 'e15', source: 'p2', target: 'v4', label: rel('Alamat terdaftar sama', 'Same registered address'), tone: 'warn' as const },
    { id: 'e16', source: 'v5', target: 't3', label: rel('Penawar', 'Bidder') },
  ]
  const netClusters = [{ id: 'addr', label: t(L('Klaster alamat sama', 'Shared-address cluster')), color: 'var(--dk-viz-neg)' }]

  /* 12 · public topics (Radar Isu) */
  const topics = [
    L('Jalan rusak', 'Damaged roads'),
    L('Banjir', 'Flooding'),
    L('Harga beras', 'Rice price'),
    L('Layanan RSUD', 'Hospital service'),
    L('Festival Thengul', 'Thengul festival'),
    L('Beasiswa', 'Scholarships'),
    L('Air PDAM', 'Piped water'),
    L('Sampah', 'Waste'),
    L('Pupuk subsidi', 'Subsidised fertiliser'),
    L('Parkir liar', 'Illegal parking'),
    L('Lampu jalan', 'Street lights'),
    L('UMKM', 'Small business'),
  ]
  const sentBase = [-0.7, -0.5, -0.45, -0.2, 0.75, 0.55, -0.35, -0.25, -0.4, -0.3, 0.05, 0.5]
  const bubbles = topics.map((x, i) => ({
    id: `topic-${i}`,
    label: t(x),
    volume: Math.round((i < 3 ? rnd(800, 1600) : rnd(120, 700)) / 10) * 10,
    sentiment: Math.max(-1, Math.min(1, (sentBase[i] ?? 0) + rnd(-0.15, 0.15))),
  }))

  return {
    complaints: { x: days, actual, fc, lo: fc.map((f, i) => f - (band[i] ?? 0)), hi: fc.map((f, i) => f + (band[i] ?? 0)) },
    kpi: { revenue14, sla, doneY, doneT },
    price: { x: days14, series: markets.map((m, i) => ({ id: `m${i}`, label: t(m), values: price[i] ?? [] })) },
    sales,
    deviation,
    channelData,
    satisfaction,
    score,
    radar: { axes, series: radar },
    sankey: { nodes: sNodes, links: sLinks },
    heat: { rows: weekdays, cols: heatCols, values: heat },
    network: { nodes: netNodes, edges: netEdges, clusters: netClusters },
    bubbles,
  }
}

export type DemoData = ReturnType<typeof makeDemoData>
