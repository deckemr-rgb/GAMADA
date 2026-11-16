/**
 * Decorative art for the "Kenapa GAMADA" bento: the small tile icons, the ecosystem hub diagram
 * and the insight sparkline. All aria-hidden. Lines marked `data-why-stroke` are drawn by scroll
 * through kit.stroke() in Why.tsx (the shared reveal language).
 */
export type WhyIconKey = 'ecosystem' | 'security' | 'ops' | 'insight' | 'scale' | 'local'

const ICONS: Record<WhyIconKey, string[]> = {
  ecosystem: ['M12 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z', 'M5.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM18.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z', 'M10.8 9.2 6.8 15M13.2 9.2l4 5.8M8 17.5h8'],
  security: ['M12 3 19 6v5c0 4.6-3 8.2-7 10-4-1.8-7-5.4-7-10V6l7-3Z', 'm9 12 2.2 2.2L15.5 10'],
  ops: ['M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z'],
  insight: ['M4 20h16', 'M7 16.5v-4M12 16.5V7.5M17 16.5v-7'],
  scale: ['M12 3.5 20.5 8 12 12.5 3.5 8 12 3.5Z', 'm3.5 12 8.5 4.5 8.5-4.5', 'm3.5 16 8.5 4.5 8.5-4.5'],
  local: ['M12 21s-7-6.1-7-11.2a7 7 0 0 1 14 0C19 14.9 12 21 12 21Z', 'M12 12.3a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z'],
}

export function WhyIcon({ name }: { name: WhyIconKey }) {
  return (
    <svg className="why-icon-svg" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      {ICONS[name].map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  )
}

/** Hub-and-spoke diagram: four channels around one shared data core. */
export function EcoDiagram({ nodes, center }: { nodes: readonly [string, string, string, string]; center: string }) {
  // node centres in a 360 × 200 box (left-top, right-top, left-bottom, right-bottom)
  const pos: Array<[number, number]> = [
    [62, 46],
    [298, 46],
    [62, 154],
    [298, 154],
  ]
  return (
    <svg className="why-eco" viewBox="0 0 360 200" aria-hidden="true" focusable="false">
      {pos.map(([x, y], i) => (
        <path
          key={`l${i}`}
          data-why-stroke
          className="why-eco-line"
          d={`M${x < 180 ? x + 44 : x - 44} ${y} C ${x < 180 ? 140 : 220} ${y}, ${x < 180 ? 140 : 220} 100, ${x < 180 ? 142 : 218} 100`}
        />
      ))}
      <path className="why-eco-ring" d="M180 62a38 38 0 1 1 0 76 38 38 0 0 1 0-76Z" />
      <circle className="why-eco-core" cx="180" cy="100" r="30" />
      <text className="why-eco-core-t" x="180" y="100" textAnchor="middle" dominantBaseline="central">
        {center}
      </text>
      {pos.map(([x, y], i) => (
        <g key={`n${i}`}>
          <rect className="why-eco-node" x={x - 44} y={y - 17} width="88" height="34" rx="17" />
          <text className="why-eco-t" x={x} y={y} textAnchor="middle" dominantBaseline="central">
            {nodes[i]}
          </text>
        </g>
      ))}
    </svg>
  )
}

/** Illustrative sparkline (no axis, no values): a UI hint, not a metric. */
export function Sparkline() {
  return (
    <svg className="why-spark" viewBox="0 0 220 60" aria-hidden="true" focusable="false">
      <path className="why-spark-area" d="M0 50 L0 46 C 22 44, 30 34, 50 36 S 82 46, 100 34 S 132 18, 152 24 S 190 10, 220 6 L220 60 L0 60 Z" />
      <path data-why-stroke className="why-spark-line" d="M0 46 C 22 44, 30 34, 50 36 S 82 46, 100 34 S 132 18, 152 24 S 190 10, 220 6" />
    </svg>
  )
}

/** Growth steps: one block, then more columns stacking up (outlet → branches). Decorative only. */
export function GrowthSteps() {
  const cols = [1, 2, 3, 4]
  const size = 14
  const gap = 5
  return (
    <svg className="why-steps" viewBox="0 0 92 75" aria-hidden="true" focusable="false">
      {cols.map((n, ci) =>
        Array.from({ length: n }, (_, ri) => (
          <rect
            key={`${ci}-${ri}`}
            className={ri === n - 1 && ci === cols.length - 1 ? 'why-step why-step--top' : 'why-step'}
            x={ci * (size + gap) + 2}
            y={73 - (ri + 1) * size - ri * gap}
            width={size}
            height={size}
            rx="3.5"
          />
        )),
      )}
    </svg>
  )
}
