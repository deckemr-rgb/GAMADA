/**
 * siaga-wilayah/Forecast.tsx — tab "Prediksi" (lazy): horizon 6 / 24 / 72 h. +6 h is the map's own flood model
 * (affected desa + people from the region pack's population spread over desa); +24 h (river crest) and +72 h
 * (recession) are projections of the same model — all SIMULATED and labelled so. The river hydrograph shows the
 * gauge's last 24 h (simulated readings at the real gauge site) and the forecast band.
 */
import { useEffect, useMemo, useState } from 'react'
import { AreaChart } from '../../demo-kit/viz'
import { Button, Icon, Segmented } from '../../demo-kit/ui'
import { useShell } from '../../demo-kit/shell'
import { useClock, useWorld, world, type WorldState } from '../../demo-kit/world'
import type { FloodImpact } from '../../demo-kit/map'
import { ensureRain } from './Timeline'
import { FC_T0, arrivalAt, arrivals, clockText, floodReports, gaugeNow, riverGauge, riverLevelAt, warnZone } from './data'
import { fill, nf, type Bi } from './strings'
import { ensureDesa, impactAt, mapRef, revealMap, ui, useUi } from './ui'
import { useI18n } from '../../lib/i18n'
import './more.css'

type H = '6' | '24' | '72'
const T = {
  horizon: { id: 'Horizon prediksi', en: 'Forecast horizon' },
  h6: { id: '6 jam', en: '6 h' },
  h24: { id: '24 jam', en: '24 h' },
  h72: { id: '72 jam', en: '72 h' },
  need: { id: 'Prediksi dihitung dari model genangan peta. Jalankan sekali untuk melihat desa terdampak.', en: 'The forecast comes from the map flood model. Run it once to see the affected villages.' },
  run: { id: 'Hitung prediksi', en: 'Compute forecast' },
  loading: { id: 'Memuat batas desa & model genangan…', en: 'Loading village boundaries & the flood model…' },
  desa: { id: 'desa terdampak', en: 'villages affected' },
  people: { id: 'perkiraan warga', en: 'est. people' },
  area: { id: 'km² tergenang', en: 'km² flooded' },
  peak: { id: 'puncak sungai', en: 'river crest' },
  peakAt: { id: '{v} m ±{t}', en: '{v} m at ±{t}' },
  peakPast: { id: 'lewat, surut', en: 'passed, receding' },
  list: { id: 'Desa terdampak', en: 'Affected villages' },
  sortFirst: { id: 'Paling cepat (zona peringatan)', en: 'Earliest (warning zone)' },
  sortPeople: { id: 'Warga terbanyak', en: 'Most people' },
  sortLabel: { id: 'Urutkan', en: 'Sort' },
  onset: { id: 'air tiba ±{t}', en: 'water at ±{t}' },
  outside: { id: 'di luar zona', en: 'outside zone' },
  zoneNote: { id: 'Zona peringatan = 6 kecamatan dengan warga terdampak terbanyak di model +6 j ({k}); sama dengan usulan di dialog peringatan, kartu peringatan dan Geo-AI. Jam tiba dari model yang dijalankan {t}.', en: 'Warning zone = the 6 districts with the most people affected in the +6 h model ({k}); the same as the warning dialog, the warning card and Geo-AI. Arrival times from the model run at {t}.' },
  ppl: { id: '{n} jiwa', en: '{n} ppl' },
  receding: { id: 'surut', en: 'receding' },
  reported: { id: 'sudah tergenang (laporan warga)', en: 'already flooded (citizen reports)' },
  peopleNote: { id: 'Penduduk per desa = penduduk kecamatan (region pack) dibagi rata ke desanya × porsi tergenang. Angka simulasi.', en: 'People per village = district population (region pack) spread evenly over its villages × flooded share. Simulated figures.' },
  mapNote: { id: 'Peta menggambar +0…+6 jam. 24 dan 72 jam adalah proyeksi model yang sama (simulasi), bukan peringatan resmi BMKG/BPBD.', en: 'The map draws +0…+6 h. 24 and 72 h are projections of the same model (simulated), not an official BMKG/BPBD warning.' },
  chart: { id: 'Tinggi muka air · prakiraan', en: 'Water level · forecast' },
  unit: { id: 'meter (pembacaan & prakiraan simulasi)', en: 'metres (simulated readings & forecast)' },
  awas: { id: 'Batas awas', en: 'Warning level' },
  observed: { id: 'Terukur', en: 'Observed' },
  fcst: { id: 'Prakiraan', en: 'Forecast' },
  now: { id: 'Sekarang', en: 'Now' },
} satisfies Record<string, Bi>

/** desa with a flood report already in by the world clock (the model's arrival time is moot there) */
const reportedDesa = (() => {
  let k: unknown = null
  let v = new Set<string>()
  return (s: WorldState): ReadonlySet<string> => {
    if (k === s.complaints) return v
    k = s.complaints
    v = new Set<string>()
    for (const c of floodReports(s)) {
      v.add(c.desaId)
      const k = s.region.kecamatan.find((x) => x.id === c.kecamatanId)
      const txt = `${c.text} ${c.summary.id}`.toLowerCase()
      for (const d of k?.desa ?? []) if (d.name.length > 3 && txt.includes(d.name.toLowerCase())) v.add(d.id)
    }
    return v
  }
})()

/** horizon projection of the +6 h impact (crest ×1.25, recession ×0.45) */
function project(i6: FloodImpact, h: H): FloodImpact {
  if (h === '6') return i6
  const k = h === '24' ? 1.25 : 0.45
  const desa = i6.desa
    .map((d) => ({ ...d, share: Math.min(1, d.share * k), people: Math.round(d.people * Math.min(1 / Math.max(d.share, 0.01), k)) }))
    .filter((d) => d.share >= 0.06)
  return { hour: Number(h), desa, kecamatanIds: [...new Set(desa.map((d) => d.kecamatanId))], people: desa.reduce((n, d) => n + d.people, 0), areaKm2: i6.areaKm2 * k }
}


export default function Forecast() {
  const { lang } = useI18n()
  const L = (k: keyof typeof T, v?: Record<string, string | number>) => (v ? fill(T[k][lang], v) : T[k][lang])
  const { size, pack } = useShell()
  const kecName = (id: string) => pack?.kecamatan.find((k) => k.id === id)?.name ?? id
  const [h, setH] = useState<H>('6')
  const [sort, setSort] = useState<'first' | 'people'>('first')
  const i6 = useUi((s) => s.impact6)
  const desaReady = useUi((s) => s.desaReady)
  const [busy, setBusy] = useState(false)
  const sel = useUi((s) => s.selectedKec)
  const g = useWorld(riverGauge)
  const reported = useWorld(reportedDesa)

  useEffect(() => {
    if (desaReady && !i6) ui.set({ impact6: impactAt(6) })
  }, [desaReady, i6])

  const imp = useMemo(() => (i6 ? project(i6, h) : null), [i6, h])
  // one definition of the warning zone everywhere (active warnings, else the model's recommendation)
  const alertsT = useWorld((s) => s.alerts)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const zone = useMemo(() => warnZone(world.get(), i6), [alertsT, i6])
  const shown = useMemo(() => {
    if (!imp) return []
    if (sort === 'people') return [...imp.desa].sort((a, b) => b.people - a.people)
    const a = arrivals(imp, zone)
    return [...a.inZone, ...a.outside]
  }, [imp, sort, zone])
  const inZone = useMemo(() => new Set(zone), [zone])

  // hydrograph: the last 24 h up to the world clock + the forecast to the horizon — the same river curve as the
  // Situation card, the warning dialog and Geo-AI (crest 13.00, then recession)
  const { minutes } = useClock()
  const chart = useMemo(() => {
    if (!g) return null
    const n = Number(h)
    const r2 = (v: number) => Math.round(v * 100) / 100
    const obs = Array.from({ length: 24 }, (_, i) => r2(riverLevelAt(g, minutes - (23 - i) * 60)))
    const fc = Array.from({ length: n }, (_, i) => r2(riverLevelAt(g, minutes + (i + 1) * 60)))
    const band = (i: number) => 0.08 + 0.018 * (i + 1)
    const x = [...obs.map((_, i) => `-${obs.length - 1 - i}`), ...fc.map((_, i) => `+${i + 1}`)]
    const gn = gaugeNow(g, minutes)
    const peakH = gn.peak.at > minutes ? gn.peak.at - minutes : 0
    return {
      x,
      series: [{ id: 'obs', label: L('observed'), values: obs }],
      forecast: { values: fc, lo: fc.map((v, i) => r2(v - band(i))), hi: fc.map((v, i) => r2(v + band(i))), label: L('fcst') },
      peakH,
      peakAt: clockText(gn.peak.at, lang),
      peakV: gn.peak.level,
      awas: g.awas,
      marker: obs.length - 1,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g, h, minutes, lang])

  const compute = () => {
    setBusy(true)
    ensureRain()
    void ensureDesa().then(() => setBusy(false))
  }

  return (
    <div className="dk-sg-tab">
      <Segmented
        label={L('horizon')}
        value={h}
        onChange={setH}
        options={[
          { value: '6', label: L('h6') },
          { value: '24', label: L('h24') },
          { value: '72', label: L('h72') },
        ]}
      />
      {!imp ? (
        <section className="dk-sg-card">
          <p>{busy || (desaReady && !i6) ? L('loading') : L('need')}</p>
          <Button variant="primary" size="sm" icon="play" onClick={compute} busy={busy}>
            {L('run')}
          </Button>
        </section>
      ) : (
        <>
          <dl className="dk-sg-kpis dk-sg-card" aria-live="polite">
            <div>
              <dd className="dk-num">{nf(imp.desa.length, lang)}</dd>
              <dt>{L('desa')}</dt>
            </div>
            <div>
              <dd className="dk-num">{nf(Math.round(imp.people / 100) * 100, lang)}</dd>
              <dt>{L('people')}</dt>
            </div>
            <div>
              <dd className="dk-num">{nf(imp.areaKm2, lang, 1)}</dd>
              <dt>{L('area')}</dt>
            </div>
            <div>
              <dd className="dk-num">{chart ? (chart.peakH ? L('peakAt', { h: chart.peakH, t: chart.peakAt, v: nf(chart.peakV, lang, 2) }) : L('peakPast')) : '—'}</dd>
              <dt>{L('peak')}</dt>
            </div>
          </dl>
          <section className="dk-sg-card" aria-labelledby="sw-fc-list">
            <h3 className="dk-sg-h" id="sw-fc-list">
              <Icon name="pin" size={16} />
              {L('list')}
            </h3>
            <Segmented
              label={L('sortLabel')}
              size="sm"
              value={sort}
              onChange={setSort}
              options={[
                { value: 'first', label: L('sortFirst') },
                { value: 'people', label: L('sortPeople') },
              ]}
            />
            <ol className="dk-sg-desa">
              {shown.slice(0, size === 'sm' ? 6 : 10).map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    aria-current={sel === d.kecamatanId || undefined}
                    onClick={() => {
                      revealMap()
                      ui.set({ selectedKec: d.kecamatanId })
                      mapRef.current?.fitKecamatan(d.kecamatanId)
                    }}
                  >
                    <span>
                      <strong>{d.name}</strong>
                      <span className="dk-sg-muted"> · {kecName(d.kecamatanId)}</span>
                      {!inZone.has(d.kecamatanId) && <span className="dk-sg-tag">{L('outside')}</span>}
                    </span>
                    <span className="dk-sg-muted dk-num">{h === '72' ? L('receding') : reported.has(d.id) ? L('reported') : L('onset', { t: clockText(arrivalAt(d.onset), lang) })}</span>
                    <span className="dk-num">{L('ppl', { n: nf(d.people, lang) })}</span>
                  </button>
                </li>
              ))}
            </ol>
            <p className="dk-sg-fine">
              {L('zoneNote', { k: zone.map(kecName).join(', '), t: clockText(FC_T0, lang) })} {L('peopleNote')}
            </p>
          </section>
        </>
      )}
      {chart && (
        <AreaChart
          title={L('chart')}
          unit={L('unit')}
          x={chart.x}
          series={chart.series}
          forecast={chart.forecast}
          target={{ value: chart.awas, label: L('awas') }}
          marker={{ index: chart.marker, label: L('now') }}
          format={(v) => `${nf(v, lang, 2)} m`}
          axisFormat={(v) => nf(v, lang, 1)}
          xFormat={(x) => `${String(x)} ${lang === 'id' ? 'j' : 'h'}`}
          zero={false}
          height={size === 'sm' ? 160 : 150}
        />
      )}
      <p className="dk-sg-note">{L('mapNote')}</p>
    </div>
  )
}
