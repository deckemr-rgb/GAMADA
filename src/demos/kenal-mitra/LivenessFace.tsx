/**
 * LivenessFace (lazy) — the SPECIMEN selfie: an original SVG face with landmark dots (never a photo of a person), or the
 * visitor's own camera when they opted in (processed locally, never uploaded). The progress ring and the prompts
 * ("Kedipkan mata", "Tolehkan kepala ke kiri") are a simulated liveness test: transform / opacity / stroke-dashoffset only.
 */
import { useEffect, useRef } from 'react'

export type LivePhase = 'idle' | 'blink' | 'turn' | 'done'

const DOTS: [number, number][] = [
  [78, 92], [92, 88], [128, 88], [142, 92], // brows
  [86, 104], [98, 104], [122, 104], [134, 104], // eyes
  [110, 118], [104, 130], [116, 130], // nose
  [94, 148], [110, 152], [126, 148], // mouth
  [70, 120], [150, 120], [110, 176], // jaw
]

export function LivenessFace({ phase, progress, stream, label }: { phase: LivePhase; progress: number; stream?: MediaStream | null; label: string }) {
  const video = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const v = video.current
    if (!v) return
    v.srcObject = stream ?? null
    if (stream) void v.play().catch(() => undefined)
  }, [stream])
  const C = 2 * Math.PI * 100
  return (
    <figure className={`dk-km-face is-${phase}`} aria-label={label} role="img">
      <svg viewBox="0 0 220 220" aria-hidden="true">
        <circle cx="110" cy="110" r="100" className="dk-km-face-track" />
        <circle cx="110" cy="110" r="100" className="dk-km-face-ring" style={{ strokeDasharray: C, strokeDashoffset: C * (1 - Math.max(0, Math.min(1, progress))) }} transform="rotate(-90 110 110)" />
        {!stream && (
          <g className="dk-km-face-head">
            <ellipse cx="110" cy="122" rx="46" ry="58" className="dk-km-face-skin" />
            <path d="M64 108 Q66 58 110 56 Q154 58 156 108 Q150 80 110 78 Q70 80 64 108Z" className="dk-km-face-hair" />
            <g className="dk-km-face-eyes">
              <ellipse cx="92" cy="104" rx="7" ry="4.5" />
              <ellipse cx="128" cy="104" rx="7" ry="4.5" />
            </g>
            <path d="M110 108 L104 130 L116 130" className="dk-km-face-line" />
            <path d="M94 148 Q110 158 126 148" className="dk-km-face-line" />
            <g className="dk-km-face-dots">
              {DOTS.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r="2.2" />
              ))}
            </g>
          </g>
        )}
      </svg>
      {stream && <video ref={video} className="dk-km-face-video" muted playsInline autoPlay aria-hidden="true" />}
      <span className="dk-km-face-tag">SPESIMEN</span>
    </figure>
  )
}
