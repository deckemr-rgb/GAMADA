/**
 * Static card art for the three featured ecosystem demos on the home (Tahap 6, spec §4). Decorative (the card's
 * title + text carry the meaning, the card hides the media with aria-hidden). One small inline SVG each, drawn from
 * a short list of rounded bars (data, not markup: the home bundle stays light). Not the mini-demo. The `.pf-art`
 * root is the element that zooms on hover. Colours: site dusk palette + the product's ecosystem accent.
 */
import type { ReactNode } from 'react'

const C = ['#3fe0c0', '#4fd1ff', '#f59a62', '#ffd77e', '#b9b2ff', 'rgba(255,255,255,.07)', '#211a46'] as const
/** [x, y, w, h, colour index, opacity?] rounded bars */
type Bar = [number, number, number, number, number, number?]

function Art({ name, bars, children }: { name: string; bars: Bar[]; children?: ReactNode }) {
  return (
    <div className={`pf-art pf-art--${name}`}>
      <svg viewBox="0 0 320 210" width="100%" height="100%">
        {bars.map(([x, y, w, h, c, o], i) => (
          <rect key={i} x={x} y={y} width={w} height={h} rx={Math.min(h / 2, 12)} fill={C[c]} opacity={o} stroke={c > 4 ? 'rgba(185,178,255,.22)' : undefined} />
        ))}
        {children}
      </svg>
    </div>
  )
}

const LINE = { fill: 'none', strokeWidth: 2.4, strokeLinecap: 'round' } as const

/** Sapa Warga: three WhatsApp complaints flow into one ticket marked done. */
export const SapaArt = () => (
  <Art
    name="sapa"
    bars={[
      [18, 30, 104, 28, 5], [30, 70, 92, 28, 5], [18, 110, 104, 28, 5],
      [30, 40, 70, 8, 4, 0.55], [42, 80, 60, 8, 4, 0.55], [30, 120, 66, 8, 4, 0.55],
      [178, 50, 124, 100, 6], [192, 66, 56, 8, 0], [192, 84, 92, 6, 4, 0.5], [192, 98, 74, 6, 4, 0.35],
      [236, 120, 52, 18, 0],
    ]}
  >
    <path d="M124 44c30 0 30 40 52 40M124 84h52M124 124c30 0 30-40 52-40" stroke={C[0]} opacity=".7" {...LINE} />
  </Art>
)

/** Siaga Wilayah: district dots under a rain band, two raised to warning. */
export const SiagaArt = () => (
  <Art name="siaga" bars={[[96, 20, 128, 22, 1, 0.2], [214, 60, 92, 30, 6], [226, 70, 60, 8, 2]]}>
    {[[60, 120, 4], [96, 96, 3], [132, 132, 2], [168, 104, 2], [204, 140, 3], [240, 112, 4], [270, 150, 4], [84, 158, 4], [150, 170, 3], [222, 178, 4]].map(([x, y, c], i) => (
      <circle key={i} cx={x} cy={y} r={c === 2 ? 8 : 5} fill={C[c!]} />
    ))}
    <path d="M120 50l-6 12M145 50l-6 12M170 50l-6 12M195 50l-6 12" stroke={C[1]} opacity=".6" {...LINE} />
  </Art>
)

/** Toko Autopilot: a till on a tablet, demand jumping after the flood warning, a PO chip. */
export const TokoArt = () => (
  <Art
    name="toko"
    bars={[
      [16, 20, 288, 172, 6], [30, 34, 104, 144, 5],
      [42, 50, 60, 6, 4, 0.5], [42, 68, 80, 5, 4, 0.5], [42, 82, 70, 5, 4, 0.5], [42, 96, 76, 5, 4, 0.5],
      [42, 148, 80, 20, 2], [150, 40, 64, 22, 3], [150, 160, 140, 18, 0, 0.3],
    ]}
  >
    <path d="M150 140c20-2 34 4 48 0s20-4 30-6" stroke={C[4]} opacity=".5" {...LINE} />
    <path d="M228 134c14-4 18-44 30-56s20-12 32-16" stroke={C[2]} {...LINE} />
  </Art>
)
