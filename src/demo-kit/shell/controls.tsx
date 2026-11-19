/**
 * shell/controls.tsx — the TopBar controls (spec §6.3 order): RegionSwitcher, RoleSwitcher, ClockControl,
 * AiModeToggle, ModeBadge, LangToggle, ResetButton, FullscreenButton, BackToProduct. Every one is usable on its
 * own (they read/write the world session + clock), and the "⋯" sheet reuses their inline variants.
 */
import { useEffect, useId, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { PRODUCT_BY_SLUG, ROLES, type ProductSlug, type RoleId } from '../../content/products'
import { useI18n, type Lang } from '../../lib/i18n'
import { sfx } from '../../lib/audio'
import AppLink from '../../components/AppLink'
import { Avatar, Icon, IconButton, Menu, Segmented, Tooltip } from '../ui'
import { REGIONS, preloadRegion } from '../region/loader'
import { CLOCK, clock, formatTime, getSession, setSession, useClock, useSession, type ClockSpeed } from '../world'
// live-base directly, not the ai/ barrel: the barrel drags the scripted engine, intents and useAiChat (~9 KB gzip)
// into every demo, also the ones without AI. live-base is dependency-free (the ai/ barrel re-exports it).
import { checkHealth, peekHealth } from '../ai/live-base'
import { regionLabel, roleInitials, switchLang, useDemoStrings } from '../i18n'
import { Picker } from './Picker'

/* ------------------------------------------------------------------ region */

type RegionEntry = { id: string; name: string; shortName: string; type: 'kabupaten' | 'kota'; province?: string }

/**
 * Tahap 7: the region picker (spec §2.3, §7). With ≥ 2 packs in REGIONS it lists every region with its type (+ province
 * when the REGIONS entry carries one); picking one writes the session (→ ?region=) and DemoShell resets the world to that
 * region's seed without a reload (map demos fly to the new bbox). Opening it starts fetching the packs. One pack: a label.
 */
export function RegionSwitcher({ inline }: { inline?: boolean }) {
  const t = useDemoStrings()
  const { lang } = useI18n()
  const { regionId } = useSession()
  const list = REGIONS as readonly RegionEntry[]
  const current = list.find((r) => r.id === regionId) ?? list[0]!
  // one region only (tahap 1): a label, not a control (no dead dropdowns)
  if (list.length < 2) {
    return (
      <span className="dk-shell-chip dk-region" title={t.regionOnly(current.name)}>
        <Icon name="flag" size={16} />
        <span className="dk-sr">{t.region}: </span>
        <span className="dk-region-label">{current.shortName}</span>
      </span>
    )
  }
  const warm = () => list.forEach((r) => preloadRegion(r.id))
  const pick = (id: string) => {
    sfx.click()
    setSession({ regionId: id })
  }
  const options = list.map((r) => {
    const l = regionLabel(r, lang)
    return { value: r.id, label: l.name, sub: l.sub }
  })
  if (inline) return <OptionList label={t.region} value={regionId} options={options} onChange={pick} onFocusIn={warm} />
  return (
    <Picker label={t.regionPick} heading={t.region} value={regionId} onChange={pick} onOpen={warm} options={options.map((o) => ({ ...o, lead: <Icon name="flag" size={16} /> }))}>
      <Icon name="flag" size={16} />
      <span className="dk-pick-label dk-region-label">{current.shortName}</span>
    </Picker>
  )
}

/* ------------------------------------------------------------------ role */

export function RoleSwitcher({ product, inline, onPicked }: { product: ProductSlug; inline?: boolean; onPicked?: (name: string) => void }) {
  const t = useDemoStrings()
  const { lang } = useI18n()
  const { role } = useSession()
  const roles = PRODUCT_BY_SLUG[product].roles
  const name = (r: RoleId) => ROLES[r].name[lang]
  const pick = (r: RoleId) => {
    sfx.click()
    const changed = r !== getSession().role
    setSession({ role: r })
    if (changed) onPicked?.(name(r))
  }
  const lead = (r: RoleId, size: 24 | 32 = 24) => <Avatar name={name(r)} initials={roleInitials(r, lang)} size={size} />
  if (roles.length < 2) {
    return (
      <span className="dk-shell-chip" title={t.roleAs(name(role))}>
        {lead(role)}
        <span className="dk-sr">{t.role}: </span>
        <span className="dk-pick-label">{name(role)}</span>
      </span>
    )
  }
  if (inline) return <OptionList label={t.role} value={role} options={roles.map((r) => ({ value: r, label: name(r) }))} onChange={pick} />
  return (
    <Picker label={`${t.rolePick}: ${name(role)}`} heading={t.roleHint} value={role} onChange={pick} options={roles.map((r) => ({ value: r, label: name(r), lead: lead(r) }))}>
      {lead(role)}
      <span className="dk-pick-label">{name(role)}</span>
    </Picker>
  )
}

/* ------------------------------------------------------------------ clock */

/** phones: the world clock in the top bar (time + play / pause), so world time is visible without opening "⋯" */
/** the clock as people read it: "07.00" in Indonesian, "07:00" in English (the same as the frame bar) */
const timeOf = (time: string, lang: Lang) => (lang === 'id' ? time.replace(':', '.') : time)

export function ClockChip() {
  const t = useDemoStrings()
  const { lang } = useI18n()
  const c = useClock()
  const time = timeOf(formatTime(c.minutes), lang)
  return (
    <div className="dk-clockchip" role="group" aria-label={t.clock}>
      <IconButton
        icon={c.running ? 'pause' : 'play'}
        label={c.running ? t.pause : t.play}
        size="sm"
        variant="quiet"
        onClick={() => {
          sfx.click()
          clock.toggle()
        }}
      />
      <span className="dk-clockchip-time dk-num" aria-hidden="true">
        {time}
      </span>
      <span className="dk-sr">{t.clockNow(time)}</span>
    </div>
  )
}

const SPEEDS = CLOCK.speeds.map(String) as ('1' | '10' | '60')[]

export function ClockControl({ inline, rewinding, onPicked }: { inline?: boolean; rewinding?: boolean; /** a speed or a jump was chosen (the phone "⋯" sheet closes so the result is seen at once) */ onPicked?: () => void }) {
  const t = useDemoStrings()
  const { lang } = useI18n()
  const c = useClock()
  const time = formatTime(c.minutes)
  const shown = timeOf(time, lang)
  const speed = String(c.speed === 0 ? CLOCK.defaultSpeed : c.speed) as (typeof SPEEDS)[number]
  return (
    <div className={`dk-clock${inline ? ' is-inline' : ''}${rewinding ? ' is-rewinding' : ''}`} role="group" aria-label={t.clock}>
      <IconButton
        icon={c.running ? 'pause' : 'play'}
        label={c.running ? t.pause : t.play}
        size="sm"
        variant="quiet"
        onClick={() => {
          sfx.click()
          clock.toggle()
        }}
      />
      <span className="dk-clock-time" title={t.clockNow(shown)}>
        <span className="dk-clock-digits" aria-hidden="true">
          {shown}
        </span>
        <span className="dk-clock-tz" aria-hidden="true">
          WIB
        </span>
        <span className="dk-sr">{t.clockNow(shown)}</span>
      </span>
      <Segmented
        size="sm"
        label={t.speed}
        value={speed}
        onChange={(v) => {
          sfx.click()
          clock.setSpeed(Number(v) as ClockSpeed)
          onPicked?.()
        }}
        options={SPEEDS.map((s) => ({ value: s, label: t.speedX(Number(s)) }))}
      />
      {inline ? (
        <div className="dk-clock-jumps" role="group" aria-label={t.jump}>
          {CLOCK.jumps.map((j) => (
            <button key={j} type="button" className={`dk-clock-jump${time === j ? ' is-on' : ''}`} aria-label={t.jumpTo(timeOf(j, lang))} onClick={() => {
              clock.setTime(j)
              onPicked?.()
            }}>
              {timeOf(j, lang)}
            </button>
          ))}
        </div>
      ) : (
        <Menu
          label={t.jump}
          icon="clock"
          items={CLOCK.jumps.map((j) => ({
            id: j,
            label: timeOf(j, lang),
            icon: time === j ? 'check' : undefined,
            onSelect: () => clock.setTime(j),
          }))}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ AI mode */

export type HealthState = 'checking' | 'live' | 'down'

/** Proxy health for the Live pill (cached by ai/live.ts). Falls the session back to 'sim' when not live. */
export function useAiHealth(): HealthState {
  const [state, setState] = useState<HealthState>(() => {
    const h = peekHealth()
    return h ? (h.live ? 'live' : 'down') : 'checking'
  })
  useEffect(() => {
    let alive = true
    checkHealth()
      .then((h) => alive && setState(h.live ? 'live' : 'down'))
      .catch(() => alive && setState('down'))
    return () => {
      alive = false
    }
  }, [])
  return state
}

/**
 * Simulasi / Live. When the proxy is not live the Live pill is aria-disabled, and a tap / click on it explains why:
 * `onUnavailable` (the shell pushes a toast), and the `inline` variant (the "⋯" sheet) also prints the reason as
 * visible helper text under the pill — the hover / focus Tooltip never opens on touch.
 */
export function AiModeToggle({ health, inline, onUnavailable }: { health: HealthState; inline?: boolean; onUnavailable?: () => void }) {
  const t = useDemoStrings()
  const { aiMode } = useSession()
  const live = health === 'live'
  const set = (m: 'sim' | 'live') => {
    if (m === 'live' && !live) {
      onUnavailable?.()
      return
    }
    if (m !== aiMode) sfx.click()
    setSession({ aiMode: m })
  }
  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      set(aiMode === 'sim' ? 'live' : 'sim')
    }
  }
  const tip = health === 'checking' ? t.aiLiveChecking : live ? t.aiLiveOn : t.aiLiveOff
  const whyId = useId()
  const group = (
    <div className="dk-ai" role="radiogroup" aria-label={t.aiMode} onKeyDown={onKey}>
      <button type="button" role="radio" aria-checked={aiMode === 'sim'} tabIndex={aiMode === 'sim' ? 0 : -1} className="dk-ai-opt" onClick={() => set('sim')}>
        {t.aiSim}
      </button>
      <Tooltip content={tip} side="bottom">
        <button
          type="button"
          role="radio"
          aria-checked={aiMode === 'live'}
          aria-disabled={!live || undefined}
          aria-describedby={inline && !live ? whyId : undefined}
          tabIndex={aiMode === 'live' ? 0 : -1}
          className={`dk-ai-opt${aiMode === 'live' ? ' is-live' : ''}`}
          onClick={() => set('live')}
        >
          <span className="dk-ai-dot" aria-hidden="true" />
          {t.aiLive}
          {!live && !inline && <span className="dk-sr">. {tip}</span>}
        </button>
      </Tooltip>
    </div>
  )
  if (!inline) return group
  return (
    <div className="dk-ai-wrap">
      {group}
      {!live && (
        <p className="dk-ai-why" id={whyId}>
          {tip}
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ badge, language, buttons */

export function ModeBadge() {
  const t = useDemoStrings()
  return (
    <span className="dk-modebadge" title={t.demoModeHint}>
      <span className="dk-modebadge-dot" aria-hidden="true" />
      <span className="dk-modebadge-text">{t.demoMode}</span>
      <span className="dk-sr">. {t.demoModeHint}</span>
    </span>
  )
}

export function LangToggle() {
  const t = useDemoStrings()
  const { lang, setLang } = useI18n()
  return (
    <Segmented<Lang>
      size="sm"
      label={t.language}
      value={lang}
      onChange={(l) => {
        sfx.click()
        switchLang(l, setLang, { persist: true })
      }}
      options={[
        { value: 'id', label: 'ID' },
        { value: 'en', label: 'EN' },
      ]}
      className="dk-lang"
    />
  )
}

export function ResetButton({ onRequest }: { onRequest: () => void }) {
  const t = useDemoStrings()
  return <IconButton icon="reset" label={t.reset} onClick={onRequest} />
}

export function FullscreenButton({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  const t = useDemoStrings()
  return <IconButton icon="fullscreen" label={active ? t.exitFullscreen : t.fullscreen} aria-pressed={active} onClick={onToggle} />
}

export function BackToProduct({ product, compact }: { product: ProductSlug; compact?: boolean }) {
  const t = useDemoStrings()
  return (
    <AppLink to={`/produk/${product}`} className={`dk-btn dk-btn--quiet dk-btn--sm dk-back${compact ? ' is-compact' : ''}`} aria-label={t.backToProduct} title={t.backToProduct}>
      <Icon name="arrowLeft" size={16} />
      <span className="dk-btn-label dk-back-label">{t.backToProduct}</span>
    </AppLink>
  )
}

/* ------------------------------------------------------------------ inline radio list (inside the "⋯" sheet) */

export function OptionList<V extends string>({ label, value, options, onChange, onFocusIn }: { label: string; value: V; options: { value: V; label: string; sub?: string }[]; onChange: (v: V) => void; onFocusIn?: () => void }) {
  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const i = options.findIndex((o) => o.value === value)
    let n = -1
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') n = (i + 1) % options.length
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') n = (i - 1 + options.length) % options.length
    if (n < 0) return
    e.preventDefault()
    const o = options[n]
    if (!o) return
    onChange(o.value)
    const el = e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[n]
    el?.focus()
  }
  return (
    <div className="dk-optlist" role="radiogroup" aria-label={label} onKeyDown={onKey} onFocus={onFocusIn} onPointerEnter={onFocusIn}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            className={`dk-optlist-item${on ? ' is-on' : ''}`}
            onClick={() => onChange(o.value)}
          >
            <span className="dk-optlist-radio" aria-hidden="true" />
            <span className="dk-pick-text">
              <span>{o.label}</span>
              {o.sub && <span className="dk-pick-sub">{o.sub}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}
