/** shell/hooks.ts — small hooks shared by the shell parts. */
import { useEffect, useLayoutEffect, useState, useSyncExternalStore, type RefObject } from 'react'
import { useSession } from '../world'
import { SHELL } from './constants'

/** matchMedia as state (false on the server). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (fn) => {
      if (typeof window === 'undefined') return () => {}
      const mq = window.matchMedia(query)
      mq.addEventListener('change', fn)
      return () => mq.removeEventListener('change', fn)
    },
    () => (typeof window === 'undefined' ? false : window.matchMedia(query).matches),
    () => false,
  )
}

export type ShellSize = 'sm' | 'md' | 'lg' | 'xl'

/** Layout size from the SHELL's own width (it may live in a bounded box, not the viewport):
 *  sm < 768 (name + "⋯") · md < 1240 (role + clock, rest in "⋯") · lg < 1600 (all controls) · xl (+ full crumbs). */
export function sizeFor(width: number): ShellSize {
  return width < SHELL.mobileBp ? 'sm' : width < SHELL.compactBp ? 'md' : width < SHELL.wideBp ? 'lg' : 'xl'
}

export function useShellSize(el: RefObject<Element | null>): ShellSize {
  const [size, setSize] = useState<ShellSize>(() => sizeFor(typeof window === 'undefined' ? 1440 : window.innerWidth))
  useLayoutEffect(() => {
    const node = el.current
    if (!node) return
    const measure = (w: number) => setSize(sizeFor(w))
    measure(node.getBoundingClientRect().width)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const last = entries[entries.length - 1]
      if (last) measure(last.contentRect.width)
    })
    ro.observe(node)
    return () => ro.disconnect()
  }, [el])
  return size
}

/**
 * Presenter flag (?present=1): `present` and the type-scale multiplier the tour / products may apply
 * (the shell also exposes it as the CSS variable --dk-present-scale on .dk-shell).
 */
export function usePresenter(): { present: boolean; scale: number } {
  const { present } = useSession()
  return { present, scale: present ? SHELL.presentScale : 1 }
}

/** Presenter mode: adds `dk-cursor-idle` to <html> after SHELL.presentIdleMs without pointer movement. */
export function useIdleCursor(active: boolean): void {
  useEffect(() => {
    if (!active) return
    const html = document.documentElement
    let timer = 0
    const arm = () => {
      html.classList.remove('dk-cursor-idle')
      window.clearTimeout(timer)
      timer = window.setTimeout(() => html.classList.add('dk-cursor-idle'), SHELL.presentIdleMs)
    }
    arm()
    window.addEventListener('pointermove', arm, { passive: true })
    window.addEventListener('pointerdown', arm, { passive: true })
    window.addEventListener('keydown', arm)
    return () => {
      window.clearTimeout(timer)
      html.classList.remove('dk-cursor-idle')
      window.removeEventListener('pointermove', arm)
      window.removeEventListener('pointerdown', arm)
      window.removeEventListener('keydown', arm)
    }
  }, [active])
}

/** Fullscreen state of an element (null API → unsupported, so the button is not rendered). */
export function useFullscreen(target: () => Element | null): {
  supported: boolean
  active: boolean
  toggle: () => void
} {
  const [active, setActive] = useState(false)
  const supported = typeof document !== 'undefined' && !!document.fullscreenEnabled
  useEffect(() => {
    const on = () => setActive(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    else
      void target()
        ?.requestFullscreen?.()
        .catch(() => {})
  }
  return { supported, active, toggle }
}

/** localStorage boolean with a default (try/catch). */
export function readFlag(key: string, fallback: boolean): boolean {
  try {
    const v = window.localStorage.getItem(SHELL.storage + key)
    return v === null ? fallback : v === '1'
  } catch {
    return fallback
  }
}
export function writeFlag(key: string, v: boolean): void {
  try {
    window.localStorage.setItem(SHELL.storage + key, v ? '1' : '0')
  } catch {
    /* ignore */
  }
}
