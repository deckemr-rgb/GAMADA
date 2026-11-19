/**
 * Trend.tsx (lazy, on "Lihat 12 bulan") — the 12-month score as a TrendChart (history12; the last point = the score
 * now) with a marker on last month's book close and the band floors as the y range. ChartFrame prints "Data simulasi".
 */
import { Modal } from '../../demo-kit/ui'
import { TrendChart } from '../../demo-kit/viz'
import { monthShort } from './model'
import { useT } from './strings'

const S = {
  id: { title: 'Skor usaha 12 bulan', unit: 'skor 0–1000 (simulasi)', series: 'Skor', close: 'Tutup buku', now: 'Sekarang' },
  en: { title: 'Business score, 12 months', unit: 'score 0–1000 (simulated)', series: 'Score', close: 'Book close', now: 'Now' },
}

export default function Trend({ open, onClose, history }: { open: boolean; onClose: () => void; history: { month: string; score: number }[] }) {
  const { lang } = useT()
  const L = S[lang]
  const n = history.length
  return (
    <Modal open={open} onClose={onClose} title={L.title} size="lg">
      <div data-ru="trend-chart">
        <TrendChart
          title={L.title}
          unit={L.unit}
          x={history.map((h) => monthShort(h.month, lang) + ' ' + h.month.slice(2, 4))}
          series={[{ id: 'skor', label: L.series, values: history.map((h) => h.score) }]}
          format={(v) => String(Math.round(v))}
          markers={n > 1 ? [{ x: n - 2, label: `${L.close} ${monthShort(history[n - 2]!.month, lang)}`, tone: 'info' }, { x: n - 1, label: L.now, tone: 'neutral' }] : []}
          height={260}
        />
      </div>
    </Modal>
  )
}
