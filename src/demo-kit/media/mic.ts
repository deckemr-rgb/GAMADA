/**
 * media/mic.ts — microphone permission + live level (AnalyserNode RMS). The level is read on demand (from a
 * gsap.ticker callback in Waveform), never on its own loop.
 */

export type MicError = 'denied' | 'nomic' | 'unsupported' | 'other'

export interface MicHandle {
  /** 0..1 loudness of the latest buffer */
  level(): number
  close(): void
}

export const MIC = {
  fftSize: 512,
  /** RMS → 0..1 gain */
  gain: 4.2,
} as const

export function micSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof window !== 'undefined' && typeof window.AudioContext === 'function'
}

export class MicOpenError extends Error {
  constructor(public kind: MicError) {
    super(kind)
  }
}

/** Ask for the microphone and start metering. Throws MicOpenError. */
export async function openMic(): Promise<MicHandle> {
  if (!micSupported()) throw new MicOpenError('unsupported')
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
  } catch (e) {
    const name = e instanceof DOMException ? e.name : ''
    throw new MicOpenError(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'NotReadableError' ? 'nomic' : 'other')
  }
  const ctx = new AudioContext()
  const src = ctx.createMediaStreamSource(stream)
  const an = ctx.createAnalyser()
  an.fftSize = MIC.fftSize
  src.connect(an)
  const buf = new Uint8Array(an.fftSize)
  let closed = false
  return {
    level() {
      if (closed) return 0
      an.getByteTimeDomainData(buf)
      let sum = 0
      for (let i = 0; i < buf.length; i++) {
        const v = ((buf[i] ?? 128) - 128) / 128
        sum += v * v
      }
      return Math.min(1, Math.sqrt(sum / buf.length) * MIC.gain)
    },
    close() {
      if (closed) return
      closed = true
      stream.getTracks().forEach((t) => t.stop())
      src.disconnect()
      void ctx.close().catch(() => {})
    },
  }
}

/** Current permission state when the browser can tell (no prompt). */
export async function micPermission(): Promise<'granted' | 'denied' | 'prompt' | 'unknown'> {
  try {
    const p = await navigator.permissions?.query({ name: 'microphone' as PermissionName })
    return p?.state ?? 'unknown'
  } catch {
    return 'unknown'
  }
}
