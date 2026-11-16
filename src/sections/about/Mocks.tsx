/**
 * Lightweight mock UIs for the About panel (pure HTML/CSS + one tiny SVG). They are illustrations,
 * not screenshots of real data: the whole panel is one role="img" with a text label, so everything
 * here is aria-hidden by the parent. Sizes are in em on top of a container-query font size
 * (about.css), so each mock scales with its window.
 */
import type { Dict } from '../../content/i18n/id'

type Mock = Dict['home']['about']['mock']

/* Shapes of the illustrations (not data). */
const BARS = [0.42, 0.58, 0.5, 0.74, 0.66, 0.9, 0.78] as const
/** Device-farm slots: o = online, b = busy, i = idle (20 slots, 5 × 4). */
const SLOTS = 'oobooioooboooboooioo'

export function PosMock({ c }: { c: Mock['pos'] }) {
  return (
    <div className="mk mk-pos">
      <div className="mk-head">
        <span className="mk-title">{c.title}</span>
        <span className="mk-chip">{c.today}</span>
      </div>
      <div className="mk-kpis">
        {c.kpis.map((k, i) => (
          <div key={k.label} className="mk-kpi" data-i={i}>
            <span className="mk-kpi-l">{k.label}</span>
            <span className="mk-kpi-v">{k.value}</span>
          </div>
        ))}
      </div>
      <div className="mk-chart">
        <span className="mk-sub">{c.chart}</span>
        <svg viewBox="0 0 140 52" preserveAspectRatio="none" className="mk-bars">
          {BARS.map((h, i) => (
            <rect key={i} x={i * 20 + 4} y={46 - h * 44} width="12" height={h * 44} rx="2.5" className={i === 5 ? 'is-peak' : undefined} />
          ))}
          <line x1="0" y1="46.5" x2="140" y2="46.5" />
        </svg>
        <div className="mk-days">
          {c.days.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

export function FarmMock({ c }: { c: Mock['farm'] }) {
  const online = [...SLOTS].filter((s) => s !== 'i').length
  return (
    <div className="mk mk-farm">
      <div className="mk-head">
        <span className="mk-title">
          {c.title} <b>20</b>
        </span>
        <span className="mk-chip mk-chip--live">
          <i className="mk-dot" /> {online} {c.online}
        </span>
      </div>
      <div className="mk-grid">
        {[...SLOTS].map((s, i) => (
          <span key={i} className={`mk-slot mk-slot--${s}`}>
            <i className="mk-slot-scr" />
            <i className="mk-slot-dot" data-pulse={s === 'b' ? '' : undefined} />
          </span>
        ))}
      </div>
      <div className="mk-legend">
        <span>
          <i className="mk-lg mk-lg--o" /> {c.online}
        </span>
        <span>
          <i className="mk-lg mk-lg--b" /> {c.busy}
        </span>
        <span>
          <i className="mk-lg mk-lg--i" /> {c.idle}
        </span>
      </div>
    </div>
  )
}

export function QueueMock({ c }: { c: Mock['queue'] }) {
  return (
    <div className="mk mk-queue">
      <div className="mk-head">
        <span className="mk-title">{c.title}</span>
        <span className="mk-chip">{c.jobs.length}</span>
      </div>
      <ul className="mk-jobs">
        {c.jobs.map((j, i) => (
          <li key={j.name} className="mk-job" data-state={i === 0 ? 'done' : i === 1 ? 'run' : 'wait'}>
            <i className="mk-job-ic" />
            <span className="mk-job-n">{j.name}</span>
            <span className="mk-job-s">{j.status}</span>
            {i === 1 ? (
              <span className="mk-prog">
                <i className="mk-prog-fill" />
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
