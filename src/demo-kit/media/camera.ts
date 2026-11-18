/**
 * media/camera.ts — `useCamera({ facing })`: opt-in camera for the KYC selfie (Kenal Mitra) and the barcode scan
 * (Toko Autopilot). Nothing is requested until `start()`; frames stay in the browser (never uploaded); every track is
 * stopped on `stop()` and on unmount. Denied / unavailable ⇒ `error` is set and the product uses its sample.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export interface CameraState {
  supported: boolean
  stream: MediaStream | null
  error: 'denied' | 'unavailable' | null
  start: () => Promise<boolean>
  stop: () => void
}

export function useCamera(opts: { facing?: 'user' | 'environment' } = {}): CameraState {
  const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<CameraState['error']>(null)
  const ref = useRef<MediaStream | null>(null)
  const alive = useRef(true)
  const facing = opts.facing ?? 'user'
  const stop = useCallback(() => {
    for (const t of ref.current?.getTracks() ?? []) t.stop()
    ref.current = null
    if (alive.current) setStream(null)
  }, [])
  const start = useCallback(async () => {
    if (!supported) {
      setError('unavailable')
      return false
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false })
      if (!alive.current) {
        for (const t of s.getTracks()) t.stop()
        return false
      }
      ref.current = s
      setStream(s)
      setError(null)
      return true
    } catch (e) {
      setError((e as { name?: string } | null)?.name === 'NotAllowedError' ? 'denied' : 'unavailable')
      return false
    }
  }, [supported, facing])
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      for (const t of ref.current?.getTracks() ?? []) t.stop()
      ref.current = null
    }
  }, [])
  return { supported, stream, error, start, stop }
}
