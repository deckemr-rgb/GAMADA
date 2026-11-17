/**
 * DocArt — renders a SampleDoc (shapes + text runs) as one inline SVG. Original art only: the emblem is a generic
 * shield, portraits are faceless silhouettes, QR blocks encode nothing, signatures are seeded strokes.
 */
import { memo, useId, type ReactElement } from 'react'
import { makeRng } from '../world/prng'
import type { Background, FontKind, Run, SampleDoc, Shape } from './types'

const FONTS: Record<FontKind, string> = {
  sans: 'Arial, "Liberation Sans", Helvetica, sans-serif',
  serif: '"Times New Roman", "Liberation Serif", Times, serif',
  mono: '"Courier New", "Liberation Mono", monospace',
  hand: '"Segoe Script", "Bradley Hand", "Comic Sans MS", cursive',
}

function Bg({ bg, w, h, uid }: { bg: Background; w: number; h: number; uid: string }) {
  switch (bg) {
    case 'card':
      return (
        <g>
          <defs>
            <linearGradient id={`${uid}-card`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#e3eef7" />
              <stop offset="0.55" stopColor="#d2e4f2" />
              <stop offset="1" stopColor="#c3d9ec" />
            </linearGradient>
          </defs>
          <rect width={w} height={h} rx={26} fill={`url(#${uid}-card)`} />
          {Array.from({ length: 9 }, (_, i) => (
            <path
              key={i}
              d={`M0 ${120 + i * 48} C ${w * 0.25} ${90 + i * 48}, ${w * 0.5} ${160 + i * 48}, ${w} ${110 + i * 48}`}
              fill="none"
              stroke="#9fbfdc"
              strokeWidth={0.8}
              opacity={0.45}
            />
          ))}
          <rect x={1} y={1} width={w - 2} height={h - 2} rx={25} fill="none" stroke="#9ab6cf" strokeWidth={2} />
        </g>
      )
    case 'thermal':
      return <rect width={w} height={h} fill="#fbfaf6" />
    case 'sheet':
      return <rect width={w} height={h} fill="#fdfcf8" />
    case 'nib':
      return (
        <g>
          <rect width={w} height={h} fill="#fffdf8" />
          <rect x={28} y={28} width={w - 56} height={h - 56} fill="none" stroke="#2f4a8a" strokeWidth={2} />
          <rect x={36} y={36} width={w - 72} height={h - 72} fill="none" stroke="#2f4a8a" strokeWidth={0.8} />
        </g>
      )
    case 'photo':
      return <rect width={w} height={h} fill="#8fb3c9" />
    default:
      return <rect width={w} height={h} fill="#fbfaf5" />
  }
}

function Emblem({ x, y, size, tone = '#2a3f6a' }: { x: number; y: number; size: number; tone?: string }) {
  const s = size / 100
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} aria-hidden="true">
      <path d="M50 4 L90 18 V52 C90 76 72 90 50 98 C28 90 10 76 10 52 V18 Z" fill="#f3efe2" stroke={tone} strokeWidth={4} />
      <path d="M50 12 L82 23 V52 C82 71 68 83 50 90 C32 83 18 71 18 52 V23 Z" fill="none" stroke={tone} strokeWidth={1.5} />
      <path d="M50 24 L54 35 L66 35 L56 42 L60 54 L50 46 L40 54 L44 42 L34 35 L46 35 Z" fill={tone} />
      {[0, 1, 2, 3, 4].map((i) => (
        <ellipse key={`l${i}`} cx={30 + i * 1.2} cy={58 + i * 6} rx={3.2} ry={1.8} fill={tone} transform={`rotate(-35 ${30 + i * 1.2} ${58 + i * 6})`} />
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <circle key={`r${i}`} cx={70 - i * 1.2} cy={58 + i * 6} r={2.2} fill="none" stroke={tone} strokeWidth={1.4} />
      ))}
      <path d="M36 82 Q50 74 64 82" fill="none" stroke={tone} strokeWidth={2} />
    </g>
  )
}

function Portrait({ x, y, w, h, seed, gender, bg = '#b8433a' }: Extract<Shape, { t: 'portrait' }>) {
  const r = makeRng(seed)
  const skin = r.pick(['#c99a78', '#b88763', '#d4a985', '#a87a58'])
  const shirt = r.pick(['#f2f2f2', '#2d3a5c', '#e9e4d8', '#5a6b8c'])
  const cx = x + w / 2
  return (
    <g aria-hidden="true">
      <rect x={x} y={y} width={w} height={h} fill={bg} />
      <path d={`M${x + w * 0.08} ${y + h} C ${x + w * 0.12} ${y + h * 0.74}, ${x + w * 0.88} ${y + h * 0.74}, ${x + w * 0.92} ${y + h} Z`} fill={shirt} />
      <rect x={cx - w * 0.09} y={y + h * 0.56} width={w * 0.18} height={h * 0.14} fill={skin} />
      <ellipse cx={cx} cy={y + h * 0.42} rx={w * 0.22} ry={h * 0.2} fill={skin} />
      {gender === 'P' ? (
        <path d={`M${cx - w * 0.3} ${y + h * 0.66} C ${cx - w * 0.34} ${y + h * 0.12}, ${cx + w * 0.34} ${y + h * 0.12}, ${cx + w * 0.3} ${y + h * 0.66} C ${cx + w * 0.2} ${y + h * 0.36}, ${cx - w * 0.2} ${y + h * 0.36}, ${cx - w * 0.3} ${y + h * 0.66} Z`} fill={r.pick(['#3b2f4a', '#5b6b8a', '#e8e2d6'])} />
      ) : (
        <path d={`M${cx - w * 0.23} ${y + h * 0.4} C ${cx - w * 0.24} ${y + h * 0.18}, ${cx + w * 0.24} ${y + h * 0.18}, ${cx + w * 0.23} ${y + h * 0.4} C ${cx + w * 0.12} ${y + h * 0.3}, ${cx - w * 0.12} ${y + h * 0.3}, ${cx - w * 0.23} ${y + h * 0.4} Z`} fill="#1f1b24" />
      )}
    </g>
  )
}

function signaturePath(x: number, y: number, w: number, h: number, seed: number): string {
  const r = makeRng(seed)
  let d = `M${x} ${y + h * 0.7}`
  const n = 5
  for (let i = 1; i <= n; i++) {
    const px = x + (w * i) / n
    const py = y + h * r.float(0.2, 0.85)
    d += ` C ${px - w * 0.14} ${y + h * r.float(-0.1, 0.4)}, ${px - w * 0.04} ${y + h * r.float(0.6, 1.1)}, ${px} ${py}`
  }
  d += ` M${x + w * 0.1} ${y + h * 0.82} Q ${x + w * 0.5} ${y + h * 0.6} ${x + w * 0.95} ${y + h * 0.78}`
  return d
}

function Seal({ cx, cy, r, top, center, tone = '#2a3f9a', rotate = 0, opacity = 0.8, uid }: Extract<Shape, { t: 'seal' }> & { uid: string }) {
  const pid = `${uid}-seal-${Math.round(cx)}-${Math.round(cy)}`
  return (
    <g transform={`rotate(${rotate} ${cx} ${cy})`} opacity={opacity} aria-hidden="true">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={tone} strokeWidth={3} />
      <circle cx={cx} cy={cy} r={r * 0.66} fill="none" stroke={tone} strokeWidth={1.4} />
      <defs>
        <path id={pid} d={`M ${cx - r * 0.82} ${cy} A ${r * 0.82} ${r * 0.82} 0 1 1 ${cx + r * 0.82} ${cy}`} />
      </defs>
      <text fontFamily={FONTS.sans} fontSize={r * 0.2} fontWeight={700} fill={tone} letterSpacing={1}>
        <textPath href={`#${pid}`} startOffset="50%" textAnchor="middle">
          {top}
        </textPath>
      </text>
      <path d={`M${cx} ${cy - r * 0.42} l${r * 0.08} ${r * 0.2} h${r * 0.2} l-${r * 0.16} ${r * 0.12} l${r * 0.06} ${r * 0.2} l-${r * 0.18} -${r * 0.12} l-${r * 0.18} ${r * 0.12} l${r * 0.06} -${r * 0.2} l-${r * 0.16} -${r * 0.12} h${r * 0.2} Z`} fill={tone} />
      <text x={cx} y={cy + r * 0.32} fontFamily={FONTS.sans} fontSize={r * 0.18} fontWeight={700} fill={tone} textAnchor="middle">
        {center}
      </text>
    </g>
  )
}

function Qr({ x, y, size, seed }: Extract<Shape, { t: 'qr' }>) {
  const r = makeRng(seed)
  const n = 21
  const c = size / n
  const cells: ReactElement[] = []
  const finder = (i: number, j: number) => (i < 7 && j < 7) || (i < 7 && j >= n - 7) || (i >= n - 7 && j < 7)
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      if (finder(i, j)) continue
      if (r.chance(0.48)) cells.push(<rect key={`${i}-${j}`} x={x + j * c} y={y + i * c} width={c + 0.2} height={c + 0.2} />)
    }
  const F = ({ fx, fy }: { fx: number; fy: number }) => (
    <g>
      <rect x={fx} y={fy} width={7 * c} height={7 * c} />
      <rect x={fx + c} y={fy + c} width={5 * c} height={5 * c} fill="#fff" />
      <rect x={fx + 2 * c} y={fy + 2 * c} width={3 * c} height={3 * c} />
    </g>
  )
  return (
    <g fill="#1f1d2b" aria-hidden="true">
      <rect x={x - c} y={y - c} width={size + 2 * c} height={size + 2 * c} fill="#fff" />
      {cells}
      <F fx={x} fy={y} />
      <F fx={x + (n - 7) * c} fy={y} />
      <F fx={x} fy={y + (n - 7) * c} />
    </g>
  )
}

function House({ x, y, w, h, flood, uid }: Extract<Shape, { t: 'house' }> & { uid: string }) {
  const gY = y + h * 0.62
  const wl = gY - h * 0.1 * (flood / 0.42)
  return (
    <g aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8aa6bd" />
          <stop offset="1" stopColor="#c9d6d9" />
        </linearGradient>
      </defs>
      <rect x={x} y={y} width={w} height={h} fill={`url(#${uid}-sky)`} />
      <path d={`M${x} ${gY - 40} C ${x + w * 0.2} ${gY - 70}, ${x + w * 0.35} ${gY - 30}, ${x + w * 0.5} ${gY - 50} S ${x + w * 0.85} ${gY - 60}, ${x + w} ${gY - 36} V ${gY} H ${x} Z`} fill="#6f8a63" />
      <rect x={x} y={gY} width={w} height={h - (gY - y)} fill="#7a6a4f" />
      {/* banana tree */}
      <path d={`M${x + 90} ${gY} V ${gY - 150}`} stroke="#5d6b3a" strokeWidth={10} />
      <path d={`M${x + 90} ${gY - 150} q -60 -10 -80 30 M${x + 90} ${gY - 150} q 60 -20 86 20 M${x + 90} ${gY - 140} q -40 -50 -20 -90`} stroke="#6f8c45" strokeWidth={14} fill="none" strokeLinecap="round" />
      {/* house */}
      <rect x={x + 250} y={y + 210} width={300} height={gY - (y + 210) + 6} fill="#a8573f" />
      {Array.from({ length: 9 }, (_, i) => (
        <line key={i} x1={x + 250} y1={y + 226 + i * 16} x2={x + 550} y2={y + 226 + i * 16} stroke="#8c4733" strokeWidth={1.4} />
      ))}
      <path d={`M${x + 222} ${y + 216} L${x + 400} ${y + 100} L${x + 578} ${y + 216} Z`} fill="#8d8f8c" />
      {Array.from({ length: 14 }, (_, i) => (
        <line key={i} x1={x + 236 + i * 24} y1={y + 214} x2={x + 400 + (i - 6.5) * 6} y2={y + 106} stroke="#6f716e" strokeWidth={1.6} />
      ))}
      <path d={`M${x + 330} ${y + 150} l 40 -18 l 30 40 l -50 10 Z`} fill="#9a6a3d" opacity={0.8} />
      <rect x={x + 300} y={y + 270} width={70} height={gY - (y + 270) + 6} fill="#5b3f2c" />
      <rect x={x + 420} y={y + 262} width={90} height={60} fill="#2e3d48" stroke="#e8dfcf" strokeWidth={5} />
      <line x1={x + 465} y1={y + 262} x2={x + 465} y2={y + 322} stroke="#e8dfcf" strokeWidth={4} />
      {flood > 0 && (
        <g>
          <rect x={x} y={wl} width={w} height={h - (wl - y)} fill="#7d6f4f" opacity={0.86} />
          {Array.from({ length: 8 }, (_, i) => (
            <path key={i} d={`M${x + i * 110 - 20} ${wl + 14 + (i % 3) * 18} q 25 -8 50 0 t 50 0`} stroke="#b9ab86" strokeWidth={2} fill="none" opacity={0.7} />
          ))}
        </g>
      )}
    </g>
  )
}

function Creases({ seed, count, w, h }: { seed: number; count: number; w: number; h: number }) {
  const r = makeRng(seed)
  const out: ReactElement[] = []
  for (let i = 0; i < count; i++) {
    const y0 = r.float(0.05, 0.95) * h
    const y1 = y0 + r.float(-0.18, 0.18) * h
    const mx = r.float(0.3, 0.7) * w
    const my = (y0 + y1) / 2 + r.float(-30, 30)
    const d = `M0 ${y0} Q ${mx} ${my} ${w} ${y1}`
    out.push(
      <g key={i}>
        <path d={`${d} L ${w} ${y1 + 60} Q ${mx} ${my + 60} 0 ${y0 + 60} Z`} fill={i % 2 ? '#000' : '#fff'} opacity={0.05} />
        <path d={d} stroke="#5d5a52" strokeWidth={1.2} fill="none" opacity={0.28} />
        <path d={d} stroke="#ffffff" strokeWidth={1.6} fill="none" opacity={0.5} transform="translate(0 2)" />
      </g>,
    )
  }
  return <g aria-hidden="true">{out}</g>
}

function renderShape(s: Shape, i: number, doc: SampleDoc, uid: string): ReactElement | null {
  switch (s.t) {
    case 'rect':
      return <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r} fill={s.fill ?? 'none'} stroke={s.stroke} strokeWidth={s.sw} opacity={s.opacity} strokeDasharray={s.dash} />
    case 'line':
      return <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.stroke ?? '#1f1d2b'} strokeWidth={s.sw ?? 1} strokeDasharray={s.dash} opacity={s.opacity} />
    case 'path':
      return <path key={i} d={s.d} fill={s.fill ?? 'none'} stroke={s.stroke} strokeWidth={s.sw} opacity={s.opacity} />
    case 'circle':
      return <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={s.fill ?? 'none'} stroke={s.stroke} strokeWidth={s.sw} opacity={s.opacity} />
    case 'emblem':
      return <Emblem key={i} x={s.x} y={s.y} size={s.size} {...(s.tone ? { tone: s.tone } : {})} />
    case 'portrait':
      return <Portrait key={i} {...s} />
    case 'signature':
      return <path key={i} d={signaturePath(s.x, s.y, s.w, s.h, s.seed)} fill="none" stroke={s.tone ?? '#1c2a6b'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    case 'seal':
      return <Seal key={i} {...s} uid={uid} />
    case 'watermark':
      return (
        <text
          key={i}
          x={s.cx}
          y={s.cy}
          fontFamily={FONTS.sans}
          fontSize={s.size}
          fontWeight={700}
          fill={s.fill ?? '#b3261e'}
          opacity={s.opacity ?? 0.2}
          textAnchor="middle"
          dominantBaseline="middle"
          letterSpacing={s.size * 0.08}
          transform={`rotate(${s.angle} ${s.cx} ${s.cy})`}
          aria-hidden="true"
        >
          {s.text}
        </text>
      )
    case 'qr':
      return <Qr key={i} {...s} />
    case 'house':
      return <House key={i} {...s} uid={uid} />
    case 'creases':
      return <Creases key={i} seed={s.seed} count={s.count} w={doc.w} h={doc.h} />
    case 'patch':
      return <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} fill={s.fill} />
  }
}

function RunText({ r }: { r: Run }) {
  return (
    <text
      x={r.x}
      y={r.y}
      fontFamily={FONTS[r.font ?? 'sans']}
      fontSize={r.size}
      fontWeight={r.weight ?? 400}
      fontStyle={r.italic ? 'italic' : undefined}
      textAnchor={r.anchor ?? 'start'}
      fill={r.fill ?? '#1f1d2b'}
      opacity={r.opacity}
      letterSpacing={r.ls ? r.ls * r.size : undefined}
      transform={r.rotate ? `rotate(${r.rotate} ${r.x} ${r.y})` : undefined}
      data-field={r.field}
    >
      {r.text}
    </text>
  )
}

export interface DocArtProps {
  doc: SampleDoc
  /** accessible name (defaults to the doc title in Indonesian) */
  label?: string
  className?: string
}

export const DocArt = memo(function DocArt({ doc, label, className }: DocArtProps) {
  const uid = useId().replace(/:/g, '')
  return (
    <svg className={className} viewBox={`0 0 ${doc.w} ${doc.h}`} role="img" aria-label={label ?? doc.title.id} preserveAspectRatio="xMidYMid meet">
      <Bg bg={doc.bg} w={doc.w} h={doc.h} uid={uid} />
      {doc.shapes.map((s, i) => renderShape(s, i, doc, uid))}
      {doc.runs.map((r, i) => (
        <RunText key={i} r={r} />
      ))}
      {doc.overlays.map((s, i) => renderShape(s, 1000 + i, doc, uid))}
    </svg>
  )
})
