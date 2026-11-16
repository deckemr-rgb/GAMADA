/** /lab/_kit showcase section for the "viz" module — owned by the viz builder. */
import { useMemo, useState, type CSSProperties } from 'react'
import { useI18n } from '../../lib/i18n'
import '../ui/tokens.css'
import '../viz/_showcase.css'
import {
  AreaChart,
  BarChart,
  BubbleChart,
  Donut,
  Gauge,
  Heat,
  LineChart,
  NetworkGraph,
  PairBars,
  RadarChart,
  SankeyLite,
  Sparkline,
  TargetMeter,
  formatters,
  type BubbleDatum,
  type NetEdge,
} from '../viz'
import { DEMO_DAY, makeDemoData } from '../viz/__fixtures__/demo'

const T = {
  id: {
    lead: 'Satu sistem grafik untuk 17 produk: tergambar saat pertama terlihat, nilai baru bergeser halus, setiap titik bisa dibaca dengan papan ketik dan pembaca layar.',
    refresh: 'Perbarui data',
    updated: (n: number) => `Data diperbarui (versi ${n}).`,
    eco: 'Aksen ekosistem',
    ecos: { 'satu-daerah': 'Satu Daerah', 'usaha-pintar': 'Usaha Pintar', 'pasar-daerah': 'Pasar Daerah' },
    paper: 'Kertas',
    dark: 'Gelap',
    theme: 'Tema',
    complaints: 'Aduan warga per hari',
    complaintsUnit: 'aduan / hari · 30 hari + prakiraan 7 hari',
    actual: 'Aktual',
    today: 'Hari ini',
    avg: 'Rata-rata 30 hari',
    change: 'Perubahan 30 hari',
    peak: 'Puncak prakiraan',
    revenue: 'Omzet harian',
    sla: 'SLA tepat waktu',
    done: 'Tiket selesai',
    yday: 'Kemarin',
    days14: '14 hari',
    target: 'Target',
    price: 'Harga cabai rawit di tiga pasar',
    priceUnit: 'Rp / kg · 14 hari',
    sales: 'Penjualan per jam',
    salesUnit: 'Rp · hari ini vs kemarin',
    dev: 'Selisih harga terhadap acuan',
    devUnit: '% di atas (+) atau di bawah (−) harga acuan',
    channels: 'Kanal masuk aduan',
    channelsUnit: 'aduan · 30 hari',
    satisfaction: 'Indeks kepuasan layanan',
    satisfactionUnit: 'skala 0–100',
    score: 'Skor Rapor Usaha',
    scoreUnit: 'skala 0–1000 · Toko Sinar Makmur',
    radar: 'Profil kesehatan usaha',
    radarUnit: 'skor 0–100 per aspek',
    sankey: 'Ke mana aduan mengalir',
    sankeyUnit: 'aduan · kanal → OPD → status',
    heat: 'Jam sibuk aduan',
    heatUnit: 'aduan · hari × jam (WIB)',
    heatScale: ['Sepi', 'Ramai'] as [string, string],
    net: 'Jaringan penawar pengadaan',
    netUnit: 'vendor, paket, direktur & alamat · klik klaster untuk membuka',
    collapse: 'Ciutkan klaster lagi',
    edgeHint: 'Pilih garis hubungan untuk melihat detailnya.',
    edgeSel: 'Hubungan terpilih',
    bubbles: 'Topik percakapan publik',
    bubblesUnit: 'ukuran = volume sebutan · warna = sentimen',
    topicHint: 'Pilih topik untuk melihat ringkasannya.',
    topicSel: (d: BubbleDatum, vol: string) => `${d.label}: ${vol} sebutan, sentimen ${d.sentiment < -0.2 ? 'negatif' : d.sentiment > 0.2 ? 'positif' : 'netral'}.`,
    formats: 'Format angka & waktu',
  },
  en: {
    lead: 'One chart system for 17 products: draws in on first view, new values glide into place, every point is readable by keyboard and screen reader.',
    refresh: 'Refresh data',
    updated: (n: number) => `Data refreshed (version ${n}).`,
    eco: 'Ecosystem accent',
    ecos: { 'satu-daerah': 'Satu Daerah', 'usaha-pintar': 'Usaha Pintar', 'pasar-daerah': 'Pasar Daerah' },
    paper: 'Paper',
    dark: 'Dark',
    theme: 'Theme',
    complaints: 'Citizen complaints per day',
    complaintsUnit: 'complaints / day · 30 days + 7-day forecast',
    actual: 'Actual',
    today: 'Today',
    avg: '30-day average',
    change: '30-day change',
    peak: 'Forecast peak',
    revenue: 'Daily revenue',
    sla: 'SLA on time',
    done: 'Tickets closed',
    yday: 'Yesterday',
    days14: '14 days',
    target: 'Target',
    price: 'Bird’s-eye chilli price in three markets',
    priceUnit: 'Rp / kg · 14 days',
    sales: 'Sales per hour',
    salesUnit: 'Rp · today vs yesterday',
    dev: 'Price gap to the reference price',
    devUnit: '% above (+) or below (−) the reference',
    channels: 'Where complaints come in',
    channelsUnit: 'complaints · 30 days',
    satisfaction: 'Service satisfaction index',
    satisfactionUnit: 'scale 0–100',
    score: 'Rapor Usaha score',
    scoreUnit: 'scale 0–1000 · Toko Sinar Makmur',
    radar: 'Business health profile',
    radarUnit: 'score 0–100 per aspect',
    sankey: 'Where complaints flow',
    sankeyUnit: 'complaints · channel → agency → status',
    heat: 'Complaint rush hours',
    heatUnit: 'complaints · day × hour (WIB)',
    heatScale: ['Quiet', 'Busy'] as [string, string],
    net: 'Procurement bidder network',
    netUnit: 'vendors, packages, directors & addresses · click the cluster to open it',
    collapse: 'Collapse the cluster again',
    edgeHint: 'Pick a link to see its details.',
    edgeSel: 'Selected link',
    bubbles: 'Public conversation topics',
    bubblesUnit: 'size = mention volume · colour = sentiment',
    topicHint: 'Pick a topic to see its summary.',
    topicSel: (d: BubbleDatum, vol: string) => `${d.label}: ${vol} mentions, ${d.sentiment < -0.2 ? 'negative' : d.sentiment > 0.2 ? 'positive' : 'neutral'} sentiment.`,
    formats: 'Number & time formats',
  },
}

type Eco = 'satu-daerah' | 'usaha-pintar' | 'pasar-daerah'

export default function Section() {
  const { lang } = useI18n()
  const c = T[lang]
  const f = formatters(lang)
  const [version, setVersion] = useState(0)
  const [eco, setEco] = useState<Eco>('satu-daerah')
  const [paper, setPaper] = useState(false)
  const [collapsed, setCollapsed] = useState<string[]>(['addr'])
  const [edge, setEdge] = useState<NetEdge | null>(null)
  const [topic, setTopic] = useState<BubbleDatum | null>(null)
  const d = useMemo(() => makeDemoData(42 + version * 7, lang), [version, lang])

  const ca = d.complaints
  const last = ca.actual[ca.actual.length - 1] ?? 0
  const first = ca.actual[0] ?? 0
  const avg = ca.actual.reduce((a, b) => a + b, 0) / ca.actual.length
  const peak = Math.max(...ca.fc)
  const peakI = ca.fc.indexOf(peak)
  const revToday = d.kpi.revenue14[d.kpi.revenue14.length - 1] ?? 0
  const nodeLabel = (id: string) => d.network.nodes.find((n) => n.id === id)?.label ?? id

  return (
    <div className="dk-root dk-vizsc" data-eco={eco} data-theme={paper ? 'paper' : undefined}>
      <div className="dk-vizsc-bar">
        <p className="dk-vizsc-lead">{c.lead}</p>
        <div className="dk-vizsc-ctrls">
          <div className="dk-vizsc-seg" role="radiogroup" aria-label={c.eco}>
            {(Object.keys(c.ecos) as Eco[]).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={eco === k} className={eco === k ? 'is-on' : ''} onClick={() => setEco(k)}>
                <i style={{ '--k': k === 'satu-daerah' ? 'var(--c-teal)' : k === 'usaha-pintar' ? 'var(--c-peach)' : '#c08ad0' } as CSSProperties} aria-hidden="true" />
                {c.ecos[k]}
              </button>
            ))}
          </div>
          <div className="dk-vizsc-seg" role="radiogroup" aria-label={c.theme}>
            <button type="button" role="radio" aria-checked={!paper} className={!paper ? 'is-on' : ''} onClick={() => setPaper(false)}>
              {c.dark}
            </button>
            <button type="button" role="radio" aria-checked={paper} className={paper ? 'is-on' : ''} onClick={() => setPaper(true)}>
              {c.paper}
            </button>
          </div>
          <button type="button" className="dk-vizsc-btn" onClick={() => setVersion((v) => v + 1)}>
            <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M16 10a6 6 0 1 1-1.8-4.3M16 3.5v3.2h-3.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {c.refresh}
          </button>
        </div>
        <p className="dk-viz-sr" aria-live="polite">
          {version ? c.updated(version + 1) : ''}
        </p>
      </div>

      <div className="dk-vizsc-grid">
        <AreaChart
          className="dk-vizsc-span8"
          title={c.complaints}
          unit={c.complaintsUnit}
          x={ca.x}
          series={[{ id: 'a', label: c.actual, values: ca.actual }]}
          forecast={{ values: ca.fc, lo: ca.lo, hi: ca.hi }}
          marker={{ index: ca.actual.length - 1, label: c.today }}
          zero={false}
          aside={
            <dl className="dk-viz-stats">
              <div>
                <dt>{c.today}</dt>
                <dd>{f.num(last)}</dd>
              </div>
              <div>
                <dt>{c.avg}</dt>
                <dd>{f.num(avg, { digits: 1 })}</dd>
              </div>
              <div>
                <dt>{c.change}</dt>
                <dd>{f.percent(((last - first) / first) * 100, { signed: true })}</dd>
              </div>
              <div>
                <dt>{c.peak}</dt>
                <dd>
                  {peak}
                  <small>{f.dateWib(ca.x[ca.actual.length + peakI] ?? DEMO_DAY, 'dayMonth')}</small>
                </dd>
              </div>
            </dl>
          }
        />

        <div className="dk-vizsc-span4 dk-vizsc-kpis">
          <div className="dk-vizsc-kpi">
            <p className="dk-vizsc-kpi-l">{c.revenue}</p>
            <p className="dk-vizsc-kpi-v">{f.rupiah(revToday)}</p>
            <Sparkline values={d.kpi.revenue14} label={`${c.revenue}, ${c.days14}`} format={(v) => f.rupiah(v)} area />
            <p className="dk-vizsc-kpi-c">{c.days14}</p>
          </div>
          <div className="dk-vizsc-kpi">
            <p className="dk-vizsc-kpi-l">{c.sla}</p>
            <p className="dk-vizsc-kpi-v">{f.percent(d.kpi.sla)}</p>
            <TargetMeter value={d.kpi.sla} target={90} label={c.sla} format={(v) => f.percent(v)} />
            <p className="dk-vizsc-kpi-c">
              {c.target} {f.percent(90)}
            </p>
          </div>
          <div className="dk-vizsc-kpi">
            <p className="dk-vizsc-kpi-l">{c.done}</p>
            <p className="dk-vizsc-kpi-v">{f.num(d.kpi.doneT)}</p>
            <PairBars current={d.kpi.doneT} previous={d.kpi.doneY} labels={[c.yday, c.today]} label={c.done} />
          </div>
        </div>

        <LineChart className="dk-vizsc-span6" title={c.price} unit={c.priceUnit} x={d.price.x} series={d.price.series} format={(v) => f.rupiah(v, 'full')} axisFormat={(v) => f.compact(v)} />
        <BarChart className="dk-vizsc-span6" title={c.sales} unit={c.salesUnit} data={d.sales} format={(v) => f.rupiah(v)} valueLabel={c.today} prevLabel={c.yday} />

        <BarChart className="dk-vizsc-span6" title={c.dev} unit={c.devUnit} orientation="horizontal" diverging data={d.deviation} format={(v) => f.percent(v, { signed: true })} axisFormat={(v) => f.percent(v, { signed: true, digits: 0 })} />
        <Donut className="dk-vizsc-span6" title={c.channels} unit={c.channelsUnit} data={d.channelData} />

        <Gauge className="dk-vizsc-span4" title={c.satisfaction} unit={c.satisfactionUnit} value={d.satisfaction} target={80} bands={[
          { from: 0, to: 60, tone: 'neg' },
          { from: 60, to: 80, tone: 'warn' },
          { from: 80, to: 100, tone: 'accent' },
        ]} caption={`${c.target} 80`} />
        <Gauge className="dk-vizsc-span4" variant="score" title={c.score} unit={c.scoreUnit} value={d.score} />
        <RadarChart className="dk-vizsc-span4" title={c.radar} unit={c.radarUnit} axes={d.radar.axes} series={d.radar.series} max={100} size={260} />

        <SankeyLite className="dk-vizsc-span6" title={c.sankey} unit={c.sankeyUnit} nodes={d.sankey.nodes} links={d.sankey.links} />
        <Heat className="dk-vizsc-span6" title={c.heat} unit={c.heatUnit} rows={d.heat.rows} cols={d.heat.cols} values={d.heat.values} scaleLabels={c.heatScale} colEvery={2} />

        <div className="dk-vizsc-span12 dk-vizsc-stack">
          <NetworkGraph
            title={c.net}
            unit={c.netUnit}
            nodes={d.network.nodes}
            edges={d.network.edges}
            clusters={d.network.clusters}
            collapsed={collapsed}
            onClusterToggle={(id, isCollapsed) => setCollapsed((cur) => (isCollapsed ? [...cur, id] : cur.filter((x) => x !== id)))}
            onEdgeSelect={setEdge}
            selectedEdge={edge?.id ?? null}
            actions={
              collapsed.length === 0 ? (
                <button type="button" className="dk-vizsc-btn is-quiet" onClick={() => setCollapsed(['addr'])}>
                  {c.collapse}
                </button>
              ) : undefined
            }
          />
          <p className="dk-vizsc-detail" role="status">
            {edge ? (
              <>
                <b>{c.edgeSel}:</b> {nodeLabel(edge.source)} – {nodeLabel(edge.target)} · <span className={edge.tone ? `is-${edge.tone}` : ''}>{edge.label}</span>
              </>
            ) : (
              c.edgeHint
            )}
          </p>
        </div>

        <div className="dk-vizsc-span8 dk-vizsc-stack">
          <BubbleChart title={c.bubbles} unit={c.bubblesUnit} data={d.bubbles} onSelect={setTopic} selectedId={topic?.id ?? null} />
          <p className="dk-vizsc-detail" role="status">
            {topic ? c.topicSel(d.bubbles.find((b) => b.id === topic.id) ?? topic, f.num((d.bubbles.find((b) => b.id === topic.id) ?? topic).volume)) : c.topicHint}
          </p>
        </div>

        <section className="dk-vizsc-span4 dk-vizsc-formats" aria-labelledby="dk-vizsc-fmt">
          <h3 id="dk-vizsc-fmt">{c.formats}</h3>
          <dl>
            {[
              ['rupiah(1250000)', f.rupiah(1_250_000)],
              ["rupiah(1250000, 'full')", f.rupiah(1_250_000, 'full')],
              ['rupiah(1250000000)', f.rupiah(1_250_000_000)],
              ['rupiah(−1500000)', f.rupiah(-1_500_000)],
              ['percent(87.4)', f.percent(87.4)],
              ['num(1250000)', f.num(1_250_000)],
              ['dateWib(…, long)', f.dateWib(DEMO_DAY, 'long')],
              ['timeWib(…)', f.timeWib(DEMO_DAY)],
              ['relative(−2 j)', f.relative(DEMO_DAY - 2 * 3_600_000, DEMO_DAY)],
            ].map(([k, v]) => (
              <div key={k}>
                <dt>
                  <code>{k}</code>
                </dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  )
}
