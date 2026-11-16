/**
 * FpsHud — `?debug=fps` overlay: p50 / p95 frame time and long frames (> 50 ms),
 * sampled on the GSAP ticker (no extra RAF loop). Also exposes `window.__fps`
 * ({ reset(), stats() }) for the automated perf harness (tools/perf.mjs).
 */
import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

const WINDOW = 600 // frames kept for the rolling stats
const LONG_FRAME_MS = 50

export interface FpsStats {
  frames: number
  p50: number
  p95: number
  p99: number
  max: number
  long: number
  fps: number
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0
  const i = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))
  return sorted[i] ?? 0
}

export function isFpsDebug(): boolean {
  return new URLSearchParams(window.location.search).get('debug') === 'fps'
}

export default function FpsHud() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let samples: number[] = []
    let all: number[] = []
    let last = performance.now()
    let lastPaint = 0
    const stats = (src: number[]): FpsStats => {
      const sorted = [...src].sort((a, b) => a - b)
      const sum = src.reduce((a, b) => a + b, 0)
      return {
        frames: src.length,
        p50: +percentile(sorted, 0.5).toFixed(1),
        p95: +percentile(sorted, 0.95).toFixed(1),
        p99: +percentile(sorted, 0.99).toFixed(1),
        max: +(sorted[sorted.length - 1] ?? 0).toFixed(1),
        long: src.filter((d) => d > LONG_FRAME_MS).length,
        fps: src.length ? +((1000 * src.length) / sum).toFixed(1) : 0,
      }
    }
    const tick = () => {
      const now = performance.now()
      const dt = now - last
      last = now
      if (document.visibilityState !== 'visible') return
      samples.push(dt)
      all.push(dt)
      if (samples.length > WINDOW) samples = samples.slice(-WINDOW)
      if (ref.current && now - lastPaint > 500) {
        lastPaint = now
        const s = stats(samples)
        ref.current.textContent = `${s.fps} fps · p50 ${s.p50}ms · p95 ${s.p95}ms · >50ms ${s.long}`
      }
    }
    gsap.ticker.add(tick)
    ;(window as unknown as { __fps: unknown }).__fps = {
      reset: () => {
        all = []
        last = performance.now()
      },
      stats: () => stats(all),
    }
    return () => gsap.ticker.remove(tick)
  }, [])

  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{
        position: 'fixed',
        left: 8,
        top: 8,
        zIndex: 9999,
        font: '600 12px/1.2 ui-monospace, monospace',
        color: '#0f0',
        background: 'rgba(0,0,0,.7)',
        padding: '6px 8px',
        pointerEvents: 'none',
      }}
    />
  )
}
