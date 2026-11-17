/**
 * siaga-wilayah/Timeline.tsx — the bar under the map: the NEXT obvious action (run the forecast → send the warning →
 * farm impact → before/after), the +0…+6 h scrubber that grows the flood and moves the rain, and the impact HUD
 * (villages, people, area) from the map's own flood model. The map animates through onFrame (no React render per
 * frame); React only sees the quantised hour.
 */
import { useCallback, useEffect, useRef } from 'react'
import { TimeScrubber } from '../../demo-kit/map'
import { Button, motionMode, useCountUp } from '../../demo-kit/ui'
import { useShell } from '../../demo-kit/shell'
import { emit, useSession, useWorld, world } from '../../demo-kit/world'
import { rainScenario } from '../../demo-kit/world/satu-daerah'
import { canSend, floodAlerts, harvestPasca, swRole } from './data'
import { nf, useT, type SKey } from './strings'
import { ensureDesa, impactAt, mapRef, ui, useUi } from './ui'

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

export function Timeline() {
  const { lang, t } = useT()
  const { markMission, size } = useShell()
  const role = swRole(useSession().role)
  const hour = useUi((s) => s.hour)
  const ran = useUi((s) => s.ran)
  const impact = useUi((s) => s.impact)
  const desaReady = useUi((s) => s.desaReady)
  const hasAlert = useWorld((s) => floodAlerts(s).length > 0)
  const pasca = useWorld(harvestPasca)
  const scrubRef = useRef<HTMLDivElement>(null)

  const onFrame = useCallback((h: number) => mapRef.current?.setTime(h), [])
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

  // desa + the flood model are prepared BEFORE playback starts (the one-off model build never lands mid-animation)
  const run = () => {
    ensureRain()
    const root = scrubRef.current
    void ensureDesa().then(() => requestAnimationFrame(() => playScrubber(root)))
  }
  const send = canSend(role)
  let cta: { key: SKey; act: () => void; icon: 'play' | 'send' | 'grid' | 'eye'; hot?: boolean }
  if (!ran) cta = { key: 'ctaRun', act: run, icon: 'play', hot: true }
  else if (send && !hasAlert) cta = { key: role === 'kepala-daerah' ? 'ctaSendKd' : 'ctaSend', act: () => ui.set({ broadcastOpen: true }), icon: 'send' }
  else if (!pasca) cta = { key: 'ctaAgri', act: () => openTab('agri', size === 'sm'), icon: 'grid' }
  else cta = { key: 'ctaEnv', act: () => openTab('env', size === 'sm'), icon: 'eye' }

  const people = impact?.people ?? 0
  const peopleRef = useCountUp<HTMLSpanElement>(Math.round(people / 100) * 100, { format: (n) => nf(Math.round(n / 100) * 100, lang) })
  const loading = hour > 0 && !desaReady

  return (
    <div className="dk-sw-timeline">
      <div className="dk-sw-cta">
        <Button variant="primary" size={size === 'sm' ? 'lg' : 'md'} icon={cta.icon} onClick={cta.act} onPointerDown={() => void ensureDesa()} data-hotspot={cta.hot ? 'sw-run' : undefined} data-sw="cta">
          {t(cta.key)}
        </Button>
        {ran && cta.key !== 'ctaRun' && (
          <Button variant="ghost" size="sm" icon="replay" onClick={run}>
            {t('ctaRunAgain')}
          </Button>
        )}
      </div>
      <div className="dk-sw-scrub" ref={scrubRef}>
        <TimeScrubber value={hour} onChange={onChange} onFrame={onFrame} label={t('scrub')} />
      </div>
      <section className="dk-sw-hud" aria-live="polite" aria-label={t('scrub')}>
        {impact && impact.desa.length ? (
          <dl>
            <div className="is-hero">
              <dt>{t('hudPeople')}</dt>
              <dd>
                <span ref={peopleRef} className="dk-sw-hero dk-num">
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
          <p className="dk-sw-muted">{loading ? t('hudLoading') : t('hudDry')}</p>
        )}
        <p className="dk-sw-fine">{t('hudNote')}</p>
      </section>
    </div>
  )
}

/** switch the panel to a tab (and bring the panel into view on phones, where it sits below the map) */
export function openTab(tab: 'alerts' | 'forecast' | 'agri' | 'env', scroll = false): void {
  ui.set({ tab, panelOpen: true })
  if (scroll) requestAnimationFrame(() => document.querySelector('.dk-sw-panel')?.scrollIntoView({ block: 'start', behavior: motionMode() === 'full' ? 'smooth' : 'auto' }))
}
