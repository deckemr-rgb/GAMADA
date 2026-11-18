/**
 * demos/sapa-warga/Sketch.tsx — an instant, static sketch of the report points (inline SVG, no MapLibre) shown over a
 * mini map until the real map says it is ready, then faded out (opacity only). The points are placed with the same
 * Web Mercator maths as the map at the same centre and zoom, so the swap does not jump. Glows are static radial
 * gradients (nothing animates but the final fade).
 */
import { useId } from 'react'
import type { LngLat } from '../../demo-kit/world'

export interface SketchPoint {
  coord: LngLat
  kind: 'pin' | 'dot' | 'cluster'
}

const W = 400
const H = 240

function project(c: LngLat, center: LngLat, zoom: number): [number, number] {
  const scale = (256 * 2 ** zoom) / (2 * Math.PI)
  const x = (lng: number) => (lng * Math.PI) / 180
  const y = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))
  return [W / 2 + (x(c[0]) - x(center[0])) * scale, H / 2 - (y(c[1]) - y(center[1])) * scale]
}

export default function Sketch({ center, zoom, points, tag, caption, hidden }: { center: LngLat; zoom: number; points: SketchPoint[]; tag?: string | null; caption: string; hidden: boolean }) {
  const gid = useId().replace(/:/g, '')
  return (
    <div className={`dk-sw-sketch${hidden ? ' is-off' : ''}`} aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id={`g${gid}`}>
            <stop offset="0" stopColor="var(--dk-warn, #ffb547)" stopOpacity="0.55" />
            <stop offset="1" stopColor="var(--dk-warn, #ffb547)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <path d={`M0 ${H * 0.62} C ${W * 0.25} ${H * 0.5}, ${W * 0.45} ${H * 0.78}, ${W * 0.7} ${H * 0.6} S ${W} ${H * 0.52}, ${W} ${H * 0.5}`} fill="none" stroke="var(--dk-info, #7cc4ff)" strokeOpacity="0.35" strokeWidth="5" />
        {points.map((p, i) => {
          const [x, y] = project(p.coord, center, zoom)
          if (x < -40 || x > W + 40 || y < -40 || y > H + 40) return null
          return p.kind === 'cluster' ? (
            <g key={i}>
              <circle cx={x} cy={y} r="46" fill={`url(#g${gid})`} />
              <circle cx={x} cy={y} r="9" fill="var(--dk-danger, #ff6b7a)" stroke="var(--dk-s0, #120e2b)" strokeWidth="2" />
            </g>
          ) : (
            <g key={i}>
              <circle cx={x} cy={y} r="22" fill={`url(#g${gid})`} />
              <circle cx={x} cy={y} r={p.kind === 'pin' ? 7 : 4.5} fill={p.kind === 'pin' ? 'var(--dk-danger, #ff6b7a)' : 'var(--dk-warn, #ffb547)'} stroke="var(--dk-s0, #120e2b)" strokeWidth="1.5" />
            </g>
          )
        })}
      </svg>
      {tag && <span className="dk-sw-sketch-tag">{tag}</span>}
      <span className="dk-sw-sketch-cap">{caption}</span>
    </div>
  )
}
