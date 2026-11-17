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
import { useWorld, type WorldState } from '../../demo-kit/world'
import type { FloodImpact } from '../../demo-kit/map'
import { ensureRain } from './Timeline'
import { riverGauge } from './data'
import { fill, nf, type Bi } from './strings'
import { ensureDesa, mapRef, ui, useUi } from './ui'
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
  peakAt: { id: '+{h} j', en: '+{h} h' },
  list: { id: 'Desa paling terdampak', en: 'Most affected villages' },
  onset: { id: 'air tiba ±{h} j', en: 'water in ±{h} h' },
  ppl: { id: '{n} jiwa', en: '{n} ppl' },
  receding: { id: 'surut', en: 'receding' },
  peopleNote: { id: 'Penduduk per desa = penduduk kecamatan (region pack) dibagi rata ke desanya × porsi tergenang. Angka simulasi.', en: 'People per village = district population (region pack) spread evenly over its villages × flooded share. Simulated figures.' },
  mapNote: { id: 'Peta menggambar +0…+6 jam. 24 dan 72 jam adalah proyeksi model yang sama (simulasi), bukan peringatan resmi BMKG/BPBD.', en: 'The map draws +0…+6 h. 24 and 72 h are projections of the same model (simulated), not an official BMKG/BPBD warning.' },
  chart: { id: 'Tinggi muka air · prakiraan', en: 'Water level · forecast' },
  unit: { id: 'meter (pembacaan & prakiraan simulasi)', en: 'metres (simulated readings & forecast)' },
  awas: { id: 'Batas awas', en: 'Warning level' },
  observed: { id: 'Terukur', en: 'Observed' },
  fcst: { id: 'Prakiraan', en: 'Forecast' },
  now: { id: 'Sekarang', en: 'Now' },
} satisfies Record<string, Bi>

/** horizon projection of the +6 h impact (crest ×1.25, recession ×0.45) */
function project(i6: FloodImpact, h: H): FloodImpact {
  if (h === '6') return i6
  const k = h === '24' ? 1.25 : 0.45
  const desa = i6.desa
    .map((d) => ({ ...d, share: Math.min(1, d.share * k), people: Math.round(d.people * Math.min(1 / Math.max(d.share, 0.01), k)) }))
    .filter((d) => d.share >= 0.06)
  return { hour: Number(h), desa, kecamatanIds: [...new Set(desa.map((d) => d.kecamatanId))], people: desa.reduce((n, d) => n + d.people, 0), areaKm2: i6.areaKm2 * k }
}

const rainPeak = (s: WorldState) => s.rainCells.ids.reduce((m, id) => Math.max(m, s.rainCells.byId[id]?.intensity ?? 0), 0)

export default function Forecast() {
  const { lang } = useI18n()
  const L = (k: keyof typeof T, v?: Record<string, string | number>) => (v ? fill(T[k][lang], v) : T[k][lang])
  const { size, pack } = useShell()
  const kecName = (id: string) => pack?.kecamatan.find((k) => k.id === id)?.name ?? id
  const [h, setH] = useState<H>('6')
  const i6 = useUi((s) => s.impact6)
  const desaReady = useUi((s) => s.desaReady)
  const [busy, setBusy] = useState(false)
  const g = useWorld(riverGauge)
  const peakRain = useWorld(rainPeak)

  useEffect(() => {
    if (desaReady && !i6) ui.set({ impact6: mapRef.current?.floodImpact(6) ?? null })
  }, [desaReady, i6])

  const imp = useMemo(() => (i6 ? project(i6, h) : null), [i6, h])

  // hydrograph: 24 h observed + forecast to the horizon (crest at +18 h, higher when the rain forecast is in)
  const chart = useMemo(() => {
    if (!g) return null
    const n = Number(h)
    const last = g.level
    const crest = g.siaga + (peakRain ? 1.55 : 0.7)
    const lvl = (t: number) => (t <= 18 ? last + (crest - last) * Math.sin((t / 18) * (Math.PI / 2)) : g.normal + (crest - g.normal) * Math.exp(-(t - 18) / 22))
    const fc = Array.from({ length: n }, (_, i) => Math.round(lvl(i + 1) * 100) / 100)
    const band = (i: number) => 0.08 + 0.018 * (i + 1)
    const x = [...g.history.map((_, i) => `-${g.history.length - 1 - i}`), ...fc.map((_, i) => `+${i + 1}`)]
    return {
      x,
      series: [{ id: 'obs', label: L('observed'), values: g.history }],
      forecast: { values: fc, lo: fc.map((v, i) => Math.round((v - band(i)) * 100) / 100), hi: fc.map((v, i) => Math.round((v + band(i)) * 100) / 100), label: L('fcst') },
      peakH: n >= 18 ? 18 : n,
      awas: g.awas,
      marker: g.history.length - 1,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g, h, peakRain, lang])

  const compute = () => {
    setBusy(true)
    ensureRain()
    void ensureDesa().then(() => setBusy(false))
  }

  return (
    <div className="dk-sw-tab">
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
        <section className="dk-sw-card">
          <p>{busy || (desaReady && !i6) ? L('loading') : L('need')}</p>
          <Button variant="primary" size="sm" icon="play" onClick={compute} busy={busy}>
            {L('run')}
          </Button>
        </section>
      ) : (
        <>
          <dl className="dk-sw-kpis dk-sw-card" aria-live="polite">
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
              <dd className="dk-num">{chart ? L('peakAt', { h: chart.peakH }) : '—'}</dd>
              <dt>{L('peak')}</dt>
            </div>
          </dl>
          <section className="dk-sw-card" aria-labelledby="sw-fc-list">
            <h3 className="dk-sw-h" id="sw-fc-list">
              <Icon name="pin" size={16} />
              {L('list')}
            </h3>
            <ol className="dk-sw-desa">
              {imp.desa.slice(0, size === 'sm' ? 6 : 10).map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => {
                      ui.set({ selectedKec: d.kecamatanId })
                      mapRef.current?.fitKecamatan(d.kecamatanId)
                    }}
                  >
                    <span>
                      <strong>{d.name}</strong>
                      <span className="dk-sw-muted"> · {kecName(d.kecamatanId)}</span>
                    </span>
                    <span className="dk-sw-muted dk-num">{h === '72' ? L('receding') : L('onset', { h: nf(d.onset, lang, 1) })}</span>
                    <span className="dk-num">{L('ppl', { n: nf(d.people, lang) })}</span>
                  </button>
                </li>
              ))}
            </ol>
            <p className="dk-sw-fine">{L('peopleNote')}</p>
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
      <p className="dk-sw-note">{L('mapNote')}</p>
    </div>
  )
}
