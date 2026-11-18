/**
 * demos/juara-jualan/LiveStrip.tsx — "Sedang berlangsung": the industry's conversations in progress at the world time
 * (phone calls and WA chats started and not yet ended). Per row: agent, customer, an mm:ss counter on the WORLD clock,
 * a level meter (phone; scaleY on gsap.ticker, only while the clock runs, on screen, tab visible and motion is full)
 * and the transcript line the call has reached (from its clip, aria-hidden: a simulated live view, no fake events).
 */
import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { Icon, motionMode, useInView, usePageVisible } from '../../demo-kit/ui'
import { clock, useClock, world, type Call } from '../../demo-kit/world'
import { buildClip, type ClipLib } from './clips'
import { customerParts, type Lang, type Strings } from './strings'

export interface LiveStripProps {
  calls: (Call & { agentName: string })[]
  lib: ClipLib | null
  onOpen: (id: string) => void
  t: Strings
  lang: Lang
}

const mmssOf = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`

export function LiveStrip({ calls, lib, onOpen, t, lang }: LiveStripProps) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: false, threshold: 0 })
  const visible = usePageVisible()
  const { running } = useClock()
  const lines = useRef<Record<string, string[]>>({})
  lines.current = {}
  if (lib) for (const c of calls) {
    const b = buildClip(world.get(), c, lib)
    if (b) lines.current[c.id] = b.segments.map((s) => (lang === 'en' && s.en ? s.en : s.text))
  }
  const ids = calls.map((c) => c.id).join('|')

  // counters + current line + meter: text only on the minute when idle / reduced; per frame when it can move
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const paint = (frame: boolean, time: number) => {
      const now = clock.exact()
      for (const c of calls) {
        const row = root.querySelector<HTMLElement>(`[data-live="${c.id}"]`)
        if (!row) continue
        const el = Math.max(0, (now - c.at) * 60)
        const cnt = row.querySelector('.dk-jj-cnt')
        const txt = mmssOf(Math.min(el, c.durationSec))
        if (cnt && cnt.textContent !== txt) cnt.textContent = txt
        const ls = lines.current[c.id]
        if (ls?.length) {
          const i = Math.min(ls.length - 1, Math.floor((el / Math.max(1, c.durationSec)) * ls.length))
          const out = row.querySelector('.dk-jj-crawl')
          if (out && out.textContent !== ls[i]) out.textContent = ls[i]!
        }
        if (frame) {
          const bars = row.querySelectorAll<HTMLElement>('.dk-jj-meter i')
          bars.forEach((b, k) => {
            const v = 0.25 + 0.75 * Math.abs(Math.sin(time * (3.1 + k * 0.7) + k))
            b.style.transform = `scaleY(${v.toFixed(2)})`
          })
        }
      }
    }
    paint(false, 0)
    const animate = running && inView && visible && motionMode() === 'full'
    if (!animate) return clock.subscribe(() => paint(false, 0))
    let last = 0
    const tick = (time: number) => {
      if (time - last < 0.12) return
      last = time
      paint(true, time)
    }
    gsap.ticker.add(tick)
    return () => gsap.ticker.remove(tick)
  }, [ids, running, inView, visible, lang, lib]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section ref={ref} className="dk-jj-live" aria-label={t.live}>
      <p className="dk-jj-h4">
        <span className="dk-jj-dot" aria-hidden="true" /> {t.live} <span className="dk-jj-faint">· {t.liveSim}</span>
      </p>
      {calls.length === 0 ? (
        <p className="dk-jj-faint">{t.liveNone}</p>
      ) : (
        <ul className="dk-jj-live-l">
          {calls.slice(0, 2).map((c) => (
            <li key={c.id} data-live={c.id}>
              <button type="button" className="dk-jj-live-r" onClick={() => onOpen(c.id)} aria-label={`${c.agentName} · ${customerParts(c.customer, lang).full}`}>
                <span className="dk-jj-live-h">
                  <Icon name={c.channel === 'wa' ? 'chat' : 'phone'} size={14} />
                  <b>{c.agentName}</b>
                  <span className="dk-jj-faint">{c.channel === 'wa' ? `${t.liveWa} · ${t.liveTyping}` : t.liveTel}</span>
                  <span className="dk-jj-cnt dk-num" aria-hidden="true">00:00</span>
                  {c.channel === 'telepon' && (
                    <span className="dk-jj-meter" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                      <i />
                    </span>
                  )}
                </span>
                <span className="dk-jj-crawl" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
