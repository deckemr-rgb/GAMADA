/**
 * siaga-wilayah/Timeline.tsx — the bar under the map: the NEXT obvious action (run the forecast → send the warning →
 * farm impact → before/after), the +0…+6 h scrubber that grows the flood and moves the rain, and the impact HUD
 * (villages, people, area) from the map's own flood model. The map animates through onFrame (no React render per
 * frame); React only sees the quantised hour.
 */
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { TimeScrubber } from '../../demo-kit/map'
import { Button, motionMode, useCountUp } from '../../demo-kit/ui'
import { useShell } from '../../demo-kit/shell'
import { emit, useSession, useWorld, world } from '../../demo-kit/world'
import { rainScenario } from '../../demo-kit/world/satu-daerah'
import { canSend, floodAlerts, harvestPasca, setHarvestScenario, swRole } from './data'
import { nf, useT, type SKey } from './strings'
import { ensureDesa, impactAt, mapRef, rainActivity, ui, useUi } from './ui'

/** start the scrubber's own playback (its play button; the kit exposes no imperative play) */
function playScrubber(root: HTMLElement | null) {
  const btn = root?.querySelector<HTMLButtonElement>('.dk-mts-play')
  if (!btn) return
  // the button reads "Putar"/"Play" while stopped
  if (/^(Putar|Play)$/.test(btn.getAttribute('aria-label') ?? '')) btn.click()
}

/** emit the morning rain forecast once (cells move in from the west) */
export function ensureRain(): void {
  const s = world.get()
  if (!s.rainCells.ids.length) emit('rain.forecast', rainScenario(s), 'siaga-wilayah')
}

/** rain forecast + playback; desa and the flood model are prepared BEFORE playback (the one-off build never lands mid-animation) */
export function runForecast(root: HTMLElement | null = document.querySelector<HTMLElement>('.dk-sg-scrub')): void {
  ensureRain()
  void ensureDesa().then(() => requestAnimationFrame(() => playScrubber(root)))
}

const STEP = 0.25
/**
 * Keyboard on the kit scrubber: its range input steps 0.05 h while onChange quantises to 0.25 h, so one arrow press
 * changed nothing. Arrows move one quarter hour, PageUp/PageDown one hour (written through the input's own handler).
 */
function onScrubKey(e: ReactKeyboardEvent<HTMLDivElement>) {
  const el = e.target as HTMLElement
  if (!(el instanceof HTMLInputElement) || !el.classList.contains('dk-mts-range')) return
  const d = { ArrowRight: STEP, ArrowUp: STEP, ArrowLeft: -STEP, ArrowDown: -STEP, PageUp: 1, PageDown: -1 }[e.key]
  if (d === undefined) return
  e.preventDefault()
  const max = Number(el.max) || 6
  const cur = Math.round(Number(el.value) / STEP) * STEP
  const next = Math.max(0, Math.min(max, cur + d))
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(el, String(next))
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

export function Timeline() {
  const { lang, t } = useT()
  const { markMission, size } = useShell()
  const role = swRole(useSession().role)
  const hour = useUi((s) => s.hour)
  const ran = useUi((s) => s.ran)
  const tab = useUi((s) => s.tab)
  const impact = useUi((s) => s.impact)
  const desaReady = useUi((s) => s.desaReady)
  const hasAlert = useWorld((s) => floodAlerts(s).length > 0)
  const pasca = useWorld(harvestPasca)
  const scrubRef = useRef<HTMLDivElement>(null)

  const onFrame = useCallback((h: number) => {
    mapRef.current?.setTime(h)
    rainActivity()
  }, [])
  const onChange = useCallback(
    (h: number) => {
      ui.set((s) => ({ hour: h, ran: s.ran || h > 0 }))
      if (h >= 6) markMission('scrub6')
    },
    [markMission],
  )
  // impact after paint (the first call builds the model: never inside the input handler)
  useEffect(() => {
    if (hour <= 0) {
      ui.set({ impact: null })
      return
    }
    let alive = true
    void ensureDesa().then((ok) => {
      if (alive && ok) ui.set({ impact: impactAt(hour) })
    })
    return () => {
      alive = false
    }
  }, [hour, desaReady])

  // screen readers: ONE summary once the hour settles (the HUD itself is not live: it changes every quarter hour)
  const [said, setSaid] = useState('')
  useEffect(() => {
    if (!impact || !impact.desa.length) return
    const id = window.setTimeout(
      () => setSaid(t('hudDone', { h: nf(impact.hour, lang, impact.hour % 1 ? 2 : 0), p: nf(Math.round(impact.people / 100) * 100, lang), d: nf(impact.desa.length, lang), a: nf(impact.areaKm2, lang, 1) })),
      900,
    )
    return () => window.clearTimeout(id)
  }, [impact, lang, t])

  const run = () => runForecast(scrubRef.current)
  const sm = size === 'sm'
  const send = canSend(role)
  let cta: { key: SKey; act: () => void; icon: 'play' | 'send' | 'grid' | 'eye' | 'spark' }
  if (!ran) cta = { key: 'ctaRun', act: run, icon: 'play' }
  else if (send && !hasAlert) cta = { key: role === 'kepala-daerah' ? 'ctaSendKd' : 'ctaSend', act: () => ui.set({ broadcastOpen: true }), icon: 'send' }
  // already on the Pertanian tab: the CTA does the step itself (never a no-op "open the tab you are on")
  else if (!pasca) cta = tab === 'agri' ? { key: 'ctaPasca', act: () => setHarvestScenario('pasca', ui.get().impact6), icon: 'grid' } : { key: 'ctaAgri', act: () => openTab('agri', sm), icon: 'grid' }
  else if (tab !== 'env') cta = { key: 'ctaEnv', act: () => openTab('env', sm), icon: 'eye' }
  else cta = { key: 'ctaEnv', act: () => wipeCompare(sm), icon: 'eye' }

  const people = impact?.people ?? 0
  const peopleRef = useCountUp<HTMLSpanElement>(Math.round(people / 100) * 100, { format: (n) => nf(Math.round(n / 100) * 100, lang) })
  const loading = hour > 0 && !desaReady

  return (
    <div className="dk-sg-timeline">
      <div className="dk-sg-cta">
        {/* the hotspot rings this wrapper; it folds to display:contents (no box ⇒ the ring hides) once the forecast ran,
            however it was started (button, scrubber drag or keys) */}
        <span className="dk-sg-hot" data-hotspot="sw-run" data-on={ran ? undefined : ''}>
          <Button variant="primary" size={sm ? 'lg' : 'md'} icon={cta.icon} onClick={cta.act} onPointerDown={() => void ensureDesa()} data-sw="cta">
            {t(cta.key)}
          </Button>
        </span>
        {ran && cta.key !== 'ctaRun' && (
          <Button variant="ghost" size="sm" icon="replay" onClick={run}>
            {t('ctaRunAgain')}
          </Button>
        )}
      </div>
      <div className="dk-sg-scrub" ref={scrubRef} onKeyDownCapture={onScrubKey}>
        <TimeScrubber value={hour} onChange={onChange} onFrame={onFrame} label={t('scrub')} />
      </div>
      <section className="dk-sg-hud" aria-label={t('scrub')}>
        {impact && impact.desa.length ? (
          <dl>
            <div className="is-hero">
              <dt>{t('hudPeople')}</dt>
              <dd>
                <span ref={peopleRef} className="dk-sg-hero dk-num">
                  {nf(Math.round(people / 100) * 100, lang)}
                </span>
              </dd>
            </div>
            <div>
              <dt>{t('hudDesa')}</dt>
              <dd className="dk-num">{nf(impact.desa.length, lang)}</dd>
            </div>
            <div>
              <dt>{t('hudArea')}</dt>
              <dd className="dk-num">{nf(impact.areaKm2, lang, 1)}</dd>
            </div>
          </dl>
        ) : (
          <p className="dk-sg-muted">{loading ? t('hudLoading') : t('hudDry')}</p>
        )}
        <p className="dk-sg-fine">{t('hudNote')}</p>
        <p className="dk-sg-sr" aria-live="polite">
          {said}
        </p>
      </section>
    </div>
  )
}

/** switch the panel to a tab (and bring the panel into view on phones, where it sits below the map) */
export function openTab(tab: 'alerts' | 'forecast' | 'agri' | 'env', scroll = false): void {
  ui.set({ tab, panelOpen: true })
  if (scroll) requestAnimationFrame(() => document.querySelector('.dk-sg-panel')?.scrollIntoView({ block: 'start', behavior: motionMode() === 'full' ? 'smooth' : 'auto' }))
}

/** Lingkungan is open: the CTA wipes the before/after comparison (towards "after", then back) and focuses it */
function wipeCompare(scroll: boolean): void {
  const el = document.querySelector<HTMLInputElement>('[data-sw="compare"]')
  if (!el) return openTab('env', scroll)
  const next = Number(el.value) > 30 ? 12 : 88
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(el, String(next))
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.focus({ preventScroll: true })
  el.closest('.dk-sg-card')?.scrollIntoView({ block: 'nearest', behavior: motionMode() === 'full' ? 'smooth' : 'auto' })
}
