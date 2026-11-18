/**
 * siaga-wilayah/Timeline.tsx — the bar under the map: the NEXT obvious action (run the forecast → send the warning →
 * farm impact → before/after), the +0…+6 h scrubber that grows the flood and moves the rain, and the impact HUD
 * (villages, people, area) from the map's own flood model. The map animates through onFrame (no React render per
 * frame); React only sees the quantised hour.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { TimeScrubber } from '../../demo-kit/map'
import { Button, Icon, flashNewRow, motionMode, useCountUp } from '../../demo-kit/ui'
import { useShell } from '../../demo-kit/shell'
import { emit, useClock, useSession, useWorld, world } from '../../demo-kit/world'
import { confirmStep } from './Alerts'
import { FC_T0, RIVER_CREST_AT, canSend, clockText, confirmedIds, floodAlerts, floodHourAt, forecastRain, gaugeNow, harvestPasca, riverGauge, setHarvestScenario, swRole } from './data'
import { nf, useT, type SKey } from './strings'
import { ensureDesa, impactAt, mapRef, revealMap, ui, useUi } from './ui'

/** the scrubber is playing its own animation (its button reads "Jeda"/"Pause" then) */
const scrubPlaying = (root: HTMLElement | null) => !/^(Putar|Play)$/.test(root?.querySelector('.dk-mts-play')?.getAttribute('aria-label') ?? 'Putar')

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
  if (!s.rainCells.ids.length) emit('rain.forecast', forecastRain(s), 'siaga-wilayah')
}

/** rain forecast + playback; desa and the flood model are prepared BEFORE playback (the one-off build never lands mid-animation) */
export function runForecast(root: HTMLElement | null = document.querySelector<HTMLElement>('.dk-sg-scrub')): void {
  ensureRain()
  void ensureDesa().then(() =>
    requestAnimationFrame(() => {
      focusFloodArea()
      playScrubber(root)
    }),
  )
}

/** frame the hardest-hit stretch of the river (the +6 h model's top districts) so the rising water reads on a phone */
export function focusFloodArea(): void {
  const h = mapRef.current
  const i6 = impactAt(6)
  if (!h || !i6?.desa.length) return
  const per = new Map<string, number>()
  for (const d of i6.desa) per.set(d.kecamatanId, (per.get(d.kecamatanId) ?? 0) + d.people)
  const top = [...per.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => world.get().region.kecamatan.find((x) => x.id === k)).filter((k): k is NonNullable<typeof k> => !!k)
  if (!top.length) return
  const c: [number, number] = [top.reduce((a, k) => a + k.centroid[0], 0) / top.length, top.reduce((a, k) => a + k.centroid[1], 0) / top.length]
  const m = h.raw() as { getZoom?: () => number; getContainer?: () => HTMLElement } | null
  const w = m?.getContainer?.().clientWidth ?? 1000
  // the zoom is taken once from the region framing (a second call, e.g. after the warning, frames the same stretch)
  if (!framed || framed.w !== w) framed = { w, z: Math.min(10.8, (m?.getZoom?.() ?? 9.5) + (w < 640 ? 0.9 : 0.5)) }
  h.flyTo(c, framed.z)
}
let framed: { w: number; z: number } | null = null

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
  const conf = useWorld((s) => confirmedIds(s).size > 0)
  const confirmTried = useUi((s) => s.confirmTried)
  const pasca = useWorld(harvestPasca)
  const impact6 = useUi((s) => s.impact6)
  const scrubRef = useRef<HTMLDivElement>(null)
  const river = useWorld(riverGauge)
  const { minutes } = useClock()
  const gn = river ? gaugeNow(river, minutes) : null
  const awasNoAlert = gn?.state === 'awas' && !hasAlert

  // the world clock drives the flood: the map shows the model hour that matches the river now (rising to the crest at
  // 13.00, then receding). Past 07.30 it runs the model on its own; never while the scrubber plays its animation.
  const nowH = floodHourAt(river, minutes)
  useEffect(() => {
    const u = ui.get()
    if (nowH <= 0 || scrubPlaying(scrubRef.current)) return
    if (!u.ran && nowH < 0.5) return
    const recede = minutes > RIVER_CREST_AT
    if (u.hour >= nowH && !(recede && u.hour > nowH)) return
    ensureRain()
    void ensureDesa()
    ui.set({ hour: nowH, ran: true })
    mapRef.current?.setTime(nowH)
    if (nowH >= 6) markMission('scrub6')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowH])
  // the warning dialog is the next step once the model is in: fetch its code now, so it opens at once
  useEffect(() => {
    if (impact6 && canSend(role)) void import('./Broadcast')
  }, [impact6, role])
  // the river passes AWAS with no warning out: bring the prompt into view once and flash it
  const awasRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (awasNoAlert && awasRef.current) return flashNewRow(awasRef.current)
  }, [awasNoAlert])

  const onFrame = useCallback((h: number) => {
    mapRef.current?.setTime(h)
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
  let cta: { key: SKey; act: () => void; icon: 'play' | 'send' | 'grid' | 'eye' | 'spark'; wait?: boolean }
  if (!ran) cta = { key: 'ctaRun', act: run, icon: 'play' }
  // a warning is only composed on top of the village model (never "0 villages" as its recorded basis)
  else if (send && !hasAlert && !impact6) cta = { key: 'ctaModel', act: () => void ensureDesa(), icon: 'send', wait: true }
  else if (send && !hasAlert) cta = { key: role === 'kepala-daerah' ? 'ctaSendKd' : 'ctaSend', act: () => ui.set({ broadcastOpen: true }), icon: 'send' }
  // step 3 of the flow: the citizen reports confirm the forecast (offered once, then the flow moves on)
  else if (hasAlert && !conf && !confirmTried)
    cta = {
      key: 'ctaConfirm',
      act: () => {
        ui.set({ confirmTried: true })
        // phones: the map (where the confirmed cluster lights up) comes into view
        revealMap()
        confirmStep()
      },
      icon: 'spark',
    }
  // already on the Pertanian tab: the CTA does the step itself (never a no-op "open the tab you are on")
  else if (!pasca) cta = tab === 'agri' ? { key: 'ctaPasca', act: () => setHarvestScenario('pasca', ui.get().impact6), icon: 'grid' } : { key: 'ctaAgri', act: () => openTab('agri', sm), icon: 'grid' }
  else if (tab !== 'env') cta = { key: 'ctaEnv', act: () => openTab('env', sm), icon: 'eye' }
  else cta = { key: 'ctaEnv', act: () => wipeCompare(sm), icon: 'eye' }

  const people = impact?.people ?? 0
  const peopleRef = useCountUp<HTMLSpanElement>(Math.round(people / 100) * 100, { format: (n) => nf(Math.round(n / 100) * 100, lang) })
  const loading = hour > 0 && !desaReady

  return (
    <div className="dk-sg-timeline">
      {awasNoAlert && gn && (
        <p ref={awasRef} className="dk-sg-awasbar" role="status">
          <Icon name="alert" size={16} />
          <span>{t(send ? 'awasNoAlert' : 'awasNoAlertRo', { v: nf(gn.level, lang, 2), t: clockText(minutes, lang) })}</span>
        </p>
      )}
      <div className="dk-sg-cta">
        {/* the hotspot rings this wrapper; it folds to display:contents (no box ⇒ the ring hides) once the forecast ran,
            however it was started (button, scrubber drag or keys) */}
        <span className="dk-sg-hot" data-hotspot="sw-run" data-on={ran ? undefined : ''}>
          <Button variant={awasNoAlert && cta.icon === 'send' ? 'danger' : 'primary'} size={sm ? 'lg' : 'md'} icon={cta.icon} onClick={cta.act} onPointerDown={() => void ensureDesa()} busy={cta.wait} disabled={cta.wait} data-sw="cta">
            {t(cta.key)}
          </Button>
        </span>
        {ran && cta.key !== 'ctaRun' && (
          <Button variant="ghost" size="sm" icon="replay" onClick={run}>
            {t('ctaRunAgain')}
          </Button>
        )}
      </div>
      <div className="dk-sg-scrub" ref={scrubRef}>
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
        <p className="dk-sg-fine">
          {ran ? `${t(minutes > RIVER_CREST_AT ? 'hudModelPast' : 'hudModel', { a: clockText(FC_T0, lang), b: clockText(FC_T0 + 360, lang), t: clockText(FC_T0 + hour * 60, lang) })} · ` : ''}
          {t('hudNote')}
        </p>
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
