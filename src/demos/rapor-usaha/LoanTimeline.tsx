/**
 * LoanTimeline — pure props (reused by the Tahap 6 product page): Diajukan → Ditinjau → Diputus → Dicairkan
 * (simulasi), each step with its time; a declined loan ends at "Ditolak" with the reason.
 */
import { Icon } from '../../demo-kit/ui'

export interface TimelineStep {
  key: 'diajukan' | 'ditinjau' | 'diputus' | 'dicairkan'
  label: string
  state: 'done' | 'now' | 'wait' | 'fail'
  when?: string
  detail?: string
}

export function LoanTimeline({ steps, label }: { steps: TimelineStep[]; label: string }) {
  return (
    <ol className="dk-ru-tl" aria-label={label}>
      {steps.map((s, i) => (
        <li key={s.key} className={`dk-ru-tl-step is-${s.state}`} data-step={s.key} data-state={s.state} aria-current={s.state === 'now' ? 'step' : undefined}>
          <span className="dk-ru-tl-dot" aria-hidden="true">
            {s.state === 'done' ? <Icon name="check" size={12} /> : s.state === 'fail' ? <Icon name="close" size={12} /> : i + 1}
          </span>
          <span className="dk-ru-tl-text">
            <b>{s.label}</b>
            {s.when && <small className="dk-num">{s.when}</small>}
            {s.detail && <small>{s.detail}</small>}
          </span>
        </li>
      ))}
    </ol>
  )
}
