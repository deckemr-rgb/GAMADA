/**
 * SoundToggle — small round button (bottom-left; top bar on phones; bottom-right with a
 * visually-hidden label on short landscape screens) with four equalizer bars
 * that animate only while sound is on. Sound is OFF by default; state syncs from on('sound').
 */
import { useEffect, useRef, useState } from 'react'
import { isEnabled } from '../lib/motion'
import { on } from '../lib/store'
import { audio } from '../lib/audio'
import { useI18n } from '../lib/i18n'
import '../styles/ui.css'

type AudioApi = typeof audio & { toggle?: () => Promise<void> }

export default function SoundToggle() {
  const { t } = useI18n()
  const [enabled] = useState(() => isEnabled('audio'))
  const [isOn, setIsOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!enabled) return
    const sync = () => setIsOn(audio.isOn())
    sync()
    return on('sound', sync)
  }, [enabled])

  // step aside once the pinned stage has scrolled away (it would sit on top of the footer text).
  // Geometry is measured on resize only; scroll compares cached numbers (no layout reads).
  useEffect(() => {
    const btn = btnRef.current
    if (!btn) return
    let away = false
    let trackBottom = Infinity // document px
    let vh = window.innerHeight
    let btnBottom = 0 // viewport px (the toggle is position: fixed)
    const check = () => {
      // away once the track's bottom edge rises above 60 % of the viewport
      // step aside before the next section's text reaches the toggle's own band
      const next = trackBottom - window.scrollY < Math.max(vh * 0.6, btnBottom)
      if (next === away) return
      away = next
      btn.dataset.away = String(away)
      if (away && btn === document.activeElement) btn.blur()
    }
    const track = document.querySelector<HTMLElement>('.track')
    const measure = () => {
      trackBottom = track ? track.getBoundingClientRect().bottom + window.scrollY : Infinity
      vh = window.innerHeight
      btnBottom = btn.getBoundingClientRect().bottom
      check()
    }
    measure()
    const ro = track && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    if (track) ro?.observe(track)
    window.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      ro?.disconnect()
      window.removeEventListener('scroll', check)
      window.removeEventListener('resize', measure)
    }
  }, [enabled])

  if (!enabled) return null

  const onClick = async () => {
    if (busy) return
    const api = audio as AudioApi
    setBusy(true)
    try {
      if (typeof api.toggle === 'function') await api.toggle()
      else if (api.isOn()) api.disable()
      else await api.enable()
    } catch {
      // autoplay refusal etc. — state below reflects what actually happened
    } finally {
      setIsOn(audio.isOn())
      setBusy(false)
    }
  }

  return (
    <button
      ref={btnRef}
      type="button"
      className="sound-toggle"
      aria-pressed={isOn}
      data-cursor="hover"
      onClick={() => void onClick()}
    >
      <span className="sound-toggle-disc" aria-hidden="true">
        <span className="sound-bar" />
        <span className="sound-bar" />
        <span className="sound-bar" />
        <span className="sound-bar" />
      </span>
      <span className="sound-toggle-label">
        {t.a11y.sound}
        <span className="sr-only-ui">{` ${isOn ? t.a11y.soundOn : t.a11y.soundOff}`}</span>
      </span>
    </button>
  )
}
