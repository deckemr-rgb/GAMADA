/**
 * CvFunnel — the screening funnel 200 → … → n (standalone, pure props; mini.tsx can reuse it). Bars scale in with a
 * stagger (transform only; none under reduced motion / static), each with its count.
 */
export function CvFunnel({ steps, title, play }: { steps: { label: string; n: number }[]; title: string; play: number }) {
  const max = Math.max(1, steps[0]?.n ?? 1)
  return (
    <figure className="dk-km-funnel" aria-label={title}>
      <figcaption>{title}</figcaption>
      <ol key={play}>
        {steps.map((s, i) => (
          <li key={s.label} style={{ ['--i' as string]: i }}>
            <span className="dk-km-funnel-l">{s.label}</span>
            <span className="dk-km-funnel-bar" aria-hidden="true">
              <span style={{ transform: `scaleX(${s.n / max})` }} />
            </span>
            <b className="dk-num">{s.n}</b>
          </li>
        ))}
      </ol>
      <p className="dk-sr">{steps.map((s) => `${s.label} ${s.n}`).join(', ')}</p>
    </figure>
  )
}
