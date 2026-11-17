/**
 * demos/sapa-warga/photos.tsx — the sample "photos" a citizen can attach: small original line-art scenes drawn as
 * inline SVG (no image files, no real people). Labelled "foto contoh" wherever they are offered.
 */
import { memo } from 'react'
import type { PhotoId } from './model'

const SKY: Record<PhotoId, [string, string]> = {
  genangan: ['#7d8db6', '#c9cfe0'],
  'air-rumah': ['#6f7ea6', '#bcc5db'],
  lampu: ['#1b1838', '#3a3366'],
  lubang: ['#9fb4cf', '#e2e6ef'],
  sesudah: ['#8fc3d9', '#eef3f2'],
}

function Scene({ id }: { id: PhotoId }) {
  switch (id) {
    case 'genangan':
      return (
        <>
          <rect x="0" y="70" width="240" height="90" fill="#7a8a6a" />
          <rect x="132" y="38" width="86" height="44" fill="#d9d2c3" />
          <path d="M126 40 L175 18 L224 40 Z" fill="#8a4b3a" />
          <rect x="146" y="52" width="14" height="14" fill="#5f7ea0" />
          <rect x="168" y="52" width="14" height="14" fill="#5f7ea0" />
          <rect x="190" y="52" width="14" height="14" fill="#5f7ea0" />
          <line x1="40" y1="20" x2="40" y2="70" stroke="#444" strokeWidth="2" />
          <path d="M40 22 h18 v10 h-18z" fill="#c8383b" />
          <path d="M40 32 h18 v10 h-18z" fill="#f4f1ea" />
          <rect x="0" y="92" width="240" height="68" fill="#8c7b5a" />
          <path d="M0 96 Q60 90 120 95 T240 94 V160 H0 Z" fill="#6b7c86" opacity=".92" />
          <g stroke="#c8d5dc" strokeWidth="1.4" fill="none" opacity=".75">
            <path d="M14 112 q10 -4 20 0 t20 0" />
            <path d="M92 124 q10 -4 20 0 t20 0" />
            <path d="M170 110 q10 -4 20 0 t20 0" />
            <path d="M40 142 q10 -4 20 0 t20 0" />
            <path d="M150 140 q10 -4 20 0 t20 0" />
          </g>
          <g transform="translate(78 100)">
            <circle cx="0" cy="14" r="9" fill="none" stroke="#2c2c34" strokeWidth="3" />
            <circle cx="34" cy="14" r="9" fill="none" stroke="#2c2c34" strokeWidth="3" />
            <path d="M0 14 L14 2 H26 L34 14" fill="none" stroke="#2c2c34" strokeWidth="3" />
          </g>
          <rect x="0" y="108" width="240" height="52" fill="#5d6f7a" opacity=".55" />
        </>
      )
    case 'air-rumah':
      return (
        <>
          <rect x="30" y="34" width="140" height="90" fill="#e7dccb" />
          <path d="M20 38 L100 8 L180 38 Z" fill="#7d4232" />
          <rect x="88" y="66" width="28" height="58" fill="#6a4a36" />
          <rect x="44" y="56" width="26" height="22" fill="#5f7ea0" />
          <rect x="132" y="56" width="26" height="22" fill="#5f7ea0" />
          <rect x="186" y="60" width="44" height="64" fill="#5b7a52" />
          <path d="M0 100 Q60 94 120 99 T240 97 V160 H0 Z" fill="#6c7c84" />
          <g stroke="#cfdbe0" strokeWidth="1.4" fill="none" opacity=".8">
            <path d="M18 120 q10 -4 20 0 t20 0" />
            <path d="M110 134 q10 -4 20 0 t20 0" />
            <path d="M178 118 q10 -4 20 0 t20 0" />
          </g>
          <path d="M8 104 h22" stroke="#e8eef0" strokeWidth="2" />
          <text x="10" y="100" fontSize="9" fill="#f4f6f8" fontFamily="sans-serif">60 cm</text>
        </>
      )
    case 'lampu':
      return (
        <>
          <circle cx="200" cy="26" r="9" fill="#e9e4c8" opacity=".55" />
          <rect x="0" y="104" width="240" height="56" fill="#2a2740" />
          <path d="M0 132 H240" stroke="#5a5470" strokeWidth="2" strokeDasharray="14 10" />
          <rect x="0" y="80" width="70" height="26" fill="#25213f" />
          <rect x="160" y="74" width="80" height="32" fill="#25213f" />
          <line x1="110" y1="30" x2="110" y2="112" stroke="#57536e" strokeWidth="4" />
          <path d="M110 32 Q110 22 126 22 H136" fill="none" stroke="#57536e" strokeWidth="4" />
          <rect x="128" y="22" width="18" height="7" rx="2" fill="#4a4660" />
          <path d="M131 30 l2 6 M143 30 l-2 6" stroke="#7a768f" strokeWidth="1.2" />
          <g stroke="#e05c4f" strokeWidth="2" fill="none">
            <path d="M150 12 l8 8 M158 12 l-8 8" />
          </g>
        </>
      )
    case 'lubang':
      return (
        <>
          <path d="M0 64 H240 V160 H0 Z" fill="#6f6a66" />
          <path d="M100 64 L140 64 L230 160 L10 160 Z" fill="#5b5753" />
          <path d="M120 66 V82 M120 92 V110 M120 122 V150" stroke="#e4ddc4" strokeWidth="3" />
          <ellipse cx="96" cy="124" rx="34" ry="11" fill="#2b2827" />
          <ellipse cx="96" cy="122" rx="28" ry="7" fill="#596d78" opacity=".85" />
          <path d="M60 128 q8 6 18 2 M120 132 q8 4 14 0" stroke="#3b3836" strokeWidth="2" fill="none" />
          <rect x="0" y="40" width="240" height="24" fill="#6f8a5c" />
          <path d="M196 70 l10 -28 l10 28 z" fill="#f2b33d" stroke="#3b3836" strokeWidth="1.5" />
          <text x="203" y="66" fontSize="12" fontWeight="700" fill="#3b3836" fontFamily="sans-serif">!</text>
        </>
      )
    case 'sesudah':
      return (
        <>
          <circle cx="204" cy="24" r="12" fill="#ffe7a6" />
          <path d="M0 64 H240 V160 H0 Z" fill="#7e7a73" />
          <path d="M100 64 L140 64 L230 160 L10 160 Z" fill="#605c58" />
          <path d="M120 66 V82 M120 92 V110 M120 122 V150" stroke="#f2ead0" strokeWidth="3" />
          <ellipse cx="96" cy="124" rx="34" ry="11" fill="#4c4945" />
          <rect x="0" y="40" width="240" height="24" fill="#73975e" />
          <g transform="translate(176 92)">
            <circle r="16" fill="#2aa58d" />
            <path d="M-7 0 l5 5 l9 -10" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
          </g>
        </>
      )
  }
}

/** one sample photo; `tag` is the small camera caption burnt into the corner ("07.12 · Banjarsari") */
export const Photo = memo(function Photo({ id, label, tag, className }: { id: PhotoId; label: string; tag?: string; className?: string }) {
  const [a, b] = SKY[id]
  return (
    <svg viewBox="0 0 240 160" className={className ? `dk-sw-photo ${className}` : 'dk-sw-photo'} role="img" aria-label={label} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={`sw-sky-${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <rect width="240" height="160" fill={`url(#sw-sky-${id})`} />
      <Scene id={id} />
      {tag && (
        <g>
          <rect x="6" y="140" width={Math.min(228, 8 + tag.length * 5.6)} height="14" rx="3" fill="rgba(0,0,0,.45)" />
          <text x="10" y="150.5" fontSize="9" fill="#fff" fontFamily="sans-serif">
            {tag}
          </text>
        </g>
      )}
    </svg>
  )
})

/** a stylised map tile with a pin (location bubble on the phone) — not a real map; the console shows the real one */
export const LocationTile = memo(function LocationTile({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 240 110" className="dk-sw-loctile" role="img" aria-label={label} preserveAspectRatio="xMidYMid slice">
      <rect width="240" height="110" fill="#e9e6dc" />
      <path d="M-10 78 C40 60 70 96 120 80 S200 50 250 66" stroke="#9cc3d8" strokeWidth="14" fill="none" />
      <path d="M0 30 H240 M60 0 V110 M170 0 V110 M0 100 L240 20" stroke="#fff" strokeWidth="6" />
      <path d="M0 30 H240 M60 0 V110 M170 0 V110" stroke="#d8d2c2" strokeWidth="1" />
      <rect x="78" y="40" width="30" height="18" fill="#d6dccb" />
      <rect x="182" y="38" width="40" height="22" fill="#d6dccb" />
      <g transform="translate(120 50)">
        <ellipse cx="0" cy="18" rx="8" ry="3" fill="rgba(0,0,0,.18)" />
        <path d="M0 18 C-12 2 -10 -12 0 -12 C10 -12 12 2 0 18 Z" fill="#c8383b" />
        <circle cx="0" cy="-3" r="4" fill="#fff" />
      </g>
    </svg>
  )
})

/** a fake QR-like pattern from a code (deterministic; labelled "QR contoh (fiktif)" next to it) */
export const FakeQr = memo(function FakeQr({ code, label }: { code: string; label: string }) {
  const n = 21
  let h = 2166136261
  const bits: boolean[] = []
  for (let i = 0; i < n * n; i++) {
    h = Math.imul(h ^ (code.charCodeAt(i % code.length) + i), 16777619)
    bits.push(((h >>> 0) & 7) < 3)
  }
  const finder = (x: number, y: number) => {
    const dx = x < 7 ? x : x >= n - 7 ? x - (n - 7) : -1
    const dy = y < 7 ? y : y >= n - 7 ? y - (n - 7) : -1
    if (dx < 0 || dy < 0 || (x >= n - 7 && y >= n - 7)) return null
    return dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4)
  }
  let d = ''
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const f = finder(x, y)
      if (f === true || (f === null && bits[y * n + x])) d += `M${x} ${y}h1v1h-1z`
    }
  return (
    <svg viewBox={`-1 -1 ${n + 2} ${n + 2}`} className="dk-sw-qr" role="img" aria-label={label} shapeRendering="crispEdges">
      <rect x="-1" y="-1" width={n + 2} height={n + 2} fill="#fff" />
      <path d={d} fill="#15112f" />
    </svg>
  )
})

/** static waveform bars for a voice bubble (deterministic from the text) */
export const StaticWave = memo(function StaticWave({ seed, bars = 28, progress = 1 }: { seed: string; bars?: number; progress?: number }) {
  let h = 7
  const heights: number[] = []
  for (let i = 0; i < bars; i++) {
    h = (h * 31 + (seed.charCodeAt(i % Math.max(1, seed.length)) || 3)) % 997
    heights.push(0.25 + ((h % 100) / 100) * 0.75)
  }
  return (
    <svg viewBox={`0 0 ${bars * 4} 24`} className="dk-sw-wave" aria-hidden="true" preserveAspectRatio="none">
      {heights.map((v, i) => (
        <rect key={i} x={i * 4} y={12 - v * 11} width="2.4" height={v * 22} rx="1.2" className={i / bars < progress ? 'is-on' : undefined} />
      ))}
    </svg>
  )
})
