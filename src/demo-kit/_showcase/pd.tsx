/**
 * /lab/_kit showcase — "pd" (tahap 4 kit parts for Pasar Daerah + Inti): ScoreDial, BizBadges, RangeField,
 * ActivityFeed, LineChart with forecast band + markers, TimeScrubber with 12 labelled steps. Fictional data; every
 * control changes something visible.
 */
import { useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { ActivityFeed, BizBadges, RangeField, type ActivityRow } from '../ui'
import { ScoreDial, TrendChart, type ScoreBand } from '../viz'
import { StepScrubber } from '../map/StepScrubber'

const BANDS: ScoreBand[] = [
  { min: 0, label: { id: 'Perlu perhatian', en: 'Needs attention' }, tone: 'danger' },
  { min: 550, label: { id: 'Cukup', en: 'Fair' }, tone: 'warn' },
  { min: 650, label: { id: 'Baik', en: 'Good' }, tone: 'info' },
  { min: 750, label: { id: 'Sangat baik', en: 'Very good' }, tone: 'ok' },
  { min: 850, label: { id: 'Prima', en: 'Excellent' }, tone: 'accent' },
]
const MONTHS = ['Des', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov']
const MONTHS_EN = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov']
const IDX = [99.1, 97.4, 96.2, 104.3, 101.8, 99.6, 98.4, 99.9, 101.2, 102.4, 101.7, 96.8]
const HIST = [52_000, 52_500, 51_500, 52_000, 53_000, 52_500, 53_500, 54_000, 53_500, 55_000, 56_500, 59_500]
const FC = [62_000, 64_500, 66_000, 67_000, 66_500, 64_000, 61_500]
const ROWS: ActivityRow[] = [
  { id: 'a3', at: 7 * 60 + 8, product: 'sinyal-pasar', text: { id: 'Harga cabai rawit di Pasar Kota +8 % di atas pola (contoh)', en: 'Chilli at the town market +8% above its pattern (example)' }, tone: 'warn' },
  { id: 'a2', at: 7 * 60 + 6, product: 'indeks-ekonomi', text: { id: 'Peringatan banjir: aktivitas usaha Kec. Contoh diperkirakan turun (contoh)', en: 'Flood warning: business activity in a district expected to drop (example)' }, tone: 'danger' },
  { id: 'a1', at: 7 * 60 + 1, product: 'katalog-lokal', text: { id: 'Kebutuhan pemda: nasi kotak rapat (contoh)', en: 'Government need: boxed meals (example)' }, tone: 'info' },
]
const H3 = { margin: '0 0 12px', fontSize: 15 } as const

export default function Section() {
  const { lang } = useI18n()
  const [score, setScore] = useState(710)
  const [ton, setTon] = useState(10)
  const [month, setMonth] = useState(11)
  const [rows, setRows] = useState(ROWS)
  const [verified, setVerified] = useState(false)
  const damp = Math.min(0.8, (ton * 3) / 60)
  const after = FC.map((v, i) => Math.round(HIST[HIST.length - 1]! + (v - HIST[HIST.length - 1]!) * (1 - damp) * (i < 6 ? 1 : 1)))
  const x = [...HIST.map((_, i) => `H-${HIST.length - 1 - i}`), ...FC.map((_, i) => `+${i + 1}`)]
  return (
    <div className="dk-root" data-eco="pasar-daerah" style={{ display: 'grid', gap: 32, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', minWidth: 0 }}>
      <div>
        <h3 style={H3}>ScoreDial</h3>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <ScoreDial value={score} bands={BANDS} label={{ id: 'Skor usaha (simulasi)', en: 'Business score (simulated)' }} size="lg" />
          <ScoreDial value={score} bands={BANDS} label={{ id: 'Skor usaha (simulasi)', en: 'Business score (simulated)' }} size="sm" />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[710, 740, 820].map((v) => (
            <button key={v} type="button" className="dk-btn dk-btn--secondary" aria-pressed={score === v} onClick={() => setScore(v)}>
              {v}
            </button>
          ))}
        </div>
      </div>
      <div>
        <h3 style={H3}>BizBadges</h3>
        <BizBadges badges={{ verified, taxTidy: true, score }} size="md" links />
        <p>
          <button type="button" className="dk-btn dk-btn--ghost" onClick={() => setVerified((v) => !v)}>
            {lang === 'id' ? (verified ? 'Batalkan verifikasi (contoh)' : 'Verifikasi KYB (contoh)') : verified ? 'Undo verification (example)' : 'Verify KYB (example)'}
          </button>
        </p>
        <h3 style={H3}>RangeField</h3>
        <RangeField label={{ id: 'Volume operasi pasar', en: 'Market operation volume' }} min={2} max={30} step={1} value={ton} onChange={setTon} unit={{ id: 'ton', en: 't' }} />
        <p aria-live="polite">{lang === 'id' ? `Puncak lonjakan diredam ${Math.round(damp * 100)} % (simulasi)` : `Spike peak damped by ${Math.round(damp * 100)}% (simulated)`}</p>
      </div>
      <div style={{ minWidth: 0 }}>
        <h3 style={H3}>TrendChart · forecast + markers</h3>
        <TrendChart
          title={lang === 'id' ? 'Harga cabai rawit (contoh, simulasi)' : 'Chilli price (example, simulated)'}
          x={x}
          series={[{ id: 'h', label: lang === 'id' ? 'Harga' : 'Price', values: HIST }]}
          forecast={{ values: after, lo: after.map((v) => v * 0.95), hi: after.map((v) => v * 1.05), label: lang === 'id' ? 'Proyeksi' : 'Projection' }}
          markers={[{ x: 9, label: { id: 'Banjir', en: 'Flood' }, tone: 'danger' }, { x: 11, label: { id: 'Anomali', en: 'Anomaly' }, tone: 'warn' }]}
        />
      </div>
      <div>
        <h3 style={H3}>StepScrubber (TimeScrubber + steps)</h3>
        <StepScrubber
          value={month}
          onChange={(v) => setMonth(Math.round(v))}
          steps={MONTHS.map((m, i) => ({ value: i, label: { id: `${m} ${i ? 2026 : 2025}, indeks ${IDX[i]!.toLocaleString('id-ID')}`, en: `${MONTHS_EN[i]} ${i ? 2026 : 2025}, index ${IDX[i]}` }, short: { id: m, en: MONTHS_EN[i]! } }))}
          label={lang === 'id' ? 'Bulan' : 'Month'}
        />
        <p aria-live="polite">{lang === 'id' ? `Indeks bulan ini ${IDX[month]} (simulasi)` : `Index this month ${IDX[month]} (simulated)`}</p>
      </div>
      <div>
        <h3 style={H3}>ActivityFeed</h3>
        <ActivityFeed rows={rows} label={{ id: 'Kejadian (contoh)', en: 'Events (example)' }} />
        <button
          type="button"
          className="dk-btn dk-btn--secondary"
          onClick={() => setRows((r) => [{ id: `n${r.length}`, at: 7 * 60 + 9 + r.length, product: 'rapor-usaha', text: { id: `Skor usaha naik ke ${700 + r.length * 10} (contoh)`, en: `Business score up to ${700 + r.length * 10} (example)` }, tone: 'ok' }, ...r])}
        >
          {lang === 'id' ? 'Tambah kejadian' : 'Add an event'}
        </button>
      </div>
    </div>
  )
}
