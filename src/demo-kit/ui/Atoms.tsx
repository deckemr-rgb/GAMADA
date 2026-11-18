/**
 * Small display atoms: Badge, Chip, StatusChip, SlaLabel, LiveBadge, Avatar, Score, Stepper, InsightCallout,
 * SectionHeader, Panel. Colour discipline (ARAH-VISUAL §4): status chips are neutral; gold = attention,
 * red = danger, "done" = check icon. Accent only for selection / primary action / the ecosystem dot.
 */
import { memo, useLayoutEffect, useRef, type ComponentPropsWithRef, type ReactNode } from 'react'
import { gsap } from 'gsap'
import { DEMO, EASE } from '../../lib/motion'
import { useI18n } from '../../lib/i18n'
import { Icon, type IconName } from './icons'
import { motionMode, useInView, usePageVisible } from './motion'
import { formatSla } from './sla'
import { useUiStrings } from './strings'
import './tokens.css'
import './ui.css'

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

/* ------------------------------------------------------------------ Badge (counts, tiny labels) */

export type Tone = 'neutral' | 'accent' | 'warn' | 'danger'

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return <span className={cx('dk-badge', `dk-badge--${tone}`, 'dk-num', className)}>{children}</span>
}

/* ------------------------------------------------------------------ Chip (filter / tag / AI result) */

export interface ChipProps {
  children: ReactNode
  icon?: IconName
  tone?: Tone
  /** toggle chip: renders a button with aria-pressed */
  selected?: boolean
  onToggle?: () => void
  /** removable chip: renders a remove button */
  onRemove?: () => void
  removeLabel?: string
  className?: string
  /** toggle chip: announced as unavailable (stays focusable; the click handler decides what to do) */
  'aria-disabled'?: boolean
  /** id(s) of the element that explains the chip (e.g. why it is unavailable) */
  'aria-describedby'?: string
  /** single-choice chip group (a filter): the selected chip is the current choice, re-clicking it is a no-op by design */
  'aria-current'?: boolean
}

export function Chip({ children, icon, tone = 'neutral', selected, onToggle, onRemove, removeLabel, className, 'aria-disabled': ariaDisabled, 'aria-describedby': describedBy, 'aria-current': ariaCurrent }: ChipProps) {
  const t = useUiStrings()
  const cls = cx('dk-chip', `dk-chip--${tone}`, selected && 'is-selected', className)
  if (onToggle)
    return (
      <button type="button" className={cls} aria-pressed={!!selected} aria-disabled={ariaDisabled || undefined} aria-describedby={describedBy} aria-current={ariaCurrent || undefined} onClick={onToggle}>
        {icon && <Icon name={icon} size={14} />}
        <span>{children}</span>
      </button>
    )
  return (
    <span className={cls} aria-describedby={describedBy}>
      {icon && <Icon name={icon} size={14} />}
      <span>{children}</span>
      {onRemove && (
        <button type="button" className="dk-chip-x" onClick={onRemove} aria-label={removeLabel ?? `${t.close}`}>
          <Icon name="close" size={12} />
        </button>
      )}
    </span>
  )
}

/* ------------------------------------------------------------------ StatusChip */

export type StatusTone = 'neutral' | 'new' | 'warn' | 'danger' | 'done'

/** Neutral by default. 'new' = brighter text + hollow dot; 'done' = check; warn/danger = semantic colour. */
export const StatusChip = memo(function StatusChip({ label, tone = 'neutral', className }: { label: string; tone?: StatusTone; className?: string }) {
  return (
    <span className={cx('dk-status', `dk-status--${tone}`, className)}>
      {tone === 'done' ? <Icon name="check" size={13} strokeWidth={1.8} /> : <i aria-hidden="true" />}
      <span>{label}</span>
    </span>
  )
})

/* ------------------------------------------------------------------ SlaLabel */

/** "20 j lagi" / "Lewat 2 j" / "Tuntas" with tone colour. `minutesLeft` negative = overdue. */
export const SlaLabel = memo(function SlaLabel({ minutesLeft, done, className, now }: { minutesLeft: number; done?: boolean; className?: string; /** current minute: days 2+ away count calendar days ("Lusa") */ now?: number }) {
  const { lang } = useI18n()
  const s = formatSla(minutesLeft, lang, done, now)
  return (
    <span className={cx('dk-sla', `dk-sla--${s.tone}`, 'dk-num', className)}>
      {s.tone === 'done' && <Icon name="check" size={13} strokeWidth={1.8} />}
      {s.tone === 'late' && <Icon name="alert" size={13} />}
      {s.text}
    </span>
  )
})

/* ------------------------------------------------------------------ LiveBadge */

/** "Langsung" pill with a pulsing dot; the pulse runs only while visible and the tab is shown. */
export function LiveBadge({ label, className }: { label?: string; className?: string }) {
  const t = useUiStrings()
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: false, threshold: 0 })
  const pageVis = usePageVisible()
  const on = inView && pageVis && motionMode() === 'full'
  return (
    <span ref={ref} className={cx('dk-live', on && 'is-on', className)}>
      <i aria-hidden="true" />
      {label ?? t.live}
    </span>
  )
}

/* ------------------------------------------------------------------ Avatar */

const AVATAR_TINTS = ['#4a3f86', '#3e4c86', '#5a3f7a', '#3f5a7a', '#4f4470', '#3b4f6e'] as const

export function initialsOf(name: string): string {
  const parts = name.replace(/[^\p{L}\s]/gu, ' ').trim().split(/\s+/)
  const a = parts[0]?.[0] ?? '?'
  const b = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : (parts[0]?.[1] ?? '')
  return (a + b).toUpperCase()
}

export function Avatar({ name, initials, size = 32, ring, className }: { name: string; initials?: string; size?: 24 | 32 | 40; ring?: boolean; className?: string }) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  const bg = AVATAR_TINTS[h % AVATAR_TINTS.length]
  return (
    <span className={cx('dk-avatar', ring && 'has-ring', className)} style={{ width: size, height: size, background: bg, fontSize: size <= 24 ? 10 : size <= 32 ? 12 : 14 }} role="img" aria-label={name}>
      <span aria-hidden="true">{initials ?? initialsOf(name)}</span>
    </span>
  )
}

/* ------------------------------------------------------------------ Score */

export interface ScoreProps {
  value: number
  max?: number
  label: string
  variant?: 'ring' | 'bar'
  /** below `warn` → gold, below `danger` → red (when higher is better; inverted otherwise) */
  warn?: number
  danger?: number
  higherIsBetter?: boolean
  /** e.g. "Sehat" — the band in words, shown under the number */
  caption?: string
  size?: number
}

export function scoreTone(value: number, warn: number, danger: number, higherIsBetter = true): 'ok' | 'warn' | 'danger' {
  if (higherIsBetter) return value < danger ? 'danger' : value < warn ? 'warn' : 'ok'
  return value > danger ? 'danger' : value > warn ? 'warn' : 'ok'
}

export function Score({ value, max = 100, label, variant = 'ring', warn = 60, danger = 40, higherIsBetter = true, caption, size = 72 }: ScoreProps) {
  const ref = useRef<HTMLDivElement>(null)
  const arc = useRef<SVGCircleElement>(null)
  const bar = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { threshold: 0.3 })
  const tone = scoreTone(value, warn, danger, higherIsBetter)
  const frac = Math.max(0, Math.min(1, value / max))
  const r = 15.5
  const circ = 2 * Math.PI * r
  useLayoutEffect(() => {
    const mode = motionMode()
    const el = variant === 'ring' ? arc.current : bar.current
    if (!el) return
    const to = variant === 'ring' ? { strokeDashoffset: circ * (1 - frac) } : { scaleX: frac }
    if (mode !== 'full') {
      gsap.set(el, to)
      return
    }
    if (!inView) {
      gsap.set(el, variant === 'ring' ? { strokeDashoffset: circ } : { scaleX: 0 })
      return
    }
    const tw = gsap.to(el, { ...to, duration: DEMO.countUp, ease: EASE.out })
    return () => {
      tw.kill()
    }
  }, [inView, frac, circ, variant])
  const valueText = `${Math.round(value)}${max === 100 ? '' : ` / ${max}`}`
  return (
    <div ref={ref} className={cx('dk-score', `dk-score--${variant}`, `dk-score--${tone}`)} role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label} aria-valuetext={caption ? `${valueText}, ${caption}` : valueText}>
      {variant === 'ring' ? (
        <div className="dk-score-ring" style={{ width: size, height: size }}>
          <svg viewBox="0 0 36 36" width={size} height={size} aria-hidden="true">
            <circle cx="18" cy="18" r={r} className="dk-score-track" />
            <circle ref={arc} cx="18" cy="18" r={r} className="dk-score-arc" strokeDasharray={circ} strokeDashoffset={circ * (1 - frac)} transform="rotate(-90 18 18)" />
          </svg>
          <span className="dk-score-num dk-num" aria-hidden="true">
            {Math.round(value)}
          </span>
        </div>
      ) : (
        <div className="dk-score-barwrap" aria-hidden="true">
          <span className="dk-score-num dk-num">
            {Math.round(value)}
            <small>/{max}</small>
          </span>
          <span className="dk-score-bar">
            <span ref={bar} style={{ transform: `scaleX(${frac})` }} />
          </span>
        </div>
      )}
      <div className="dk-score-text" aria-hidden="true">
        <span className="dk-score-label">{label}</span>
        {caption && <span className="dk-score-cap">{caption}</span>}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ Stepper */

export interface StepperProps {
  steps: string[]
  /** index of the current step (0-based); steps.length = all done */
  current: number
  orientation?: 'horizontal' | 'vertical'
  label: string
  className?: string
}

export function Stepper({ steps, current, orientation = 'horizontal', label, className }: StepperProps) {
  const t = useUiStrings()
  const n = steps.length
  const now = Math.min(current, n - 1)
  const allDone = current >= n
  if (orientation === 'vertical')
    return (
      <ol className={cx('dk-stepv', className)} aria-label={label}>
        {steps.map((s, i) => {
          const st = allDone || i < current ? 'done' : i === current ? 'now' : 'todo'
          return (
            <li key={s} className={`is-${st}`} aria-current={st === 'now' ? 'step' : undefined}>
              <span className="dk-stepv-dot" aria-hidden="true">
                {st === 'done' ? <Icon name="check" size={12} strokeWidth={2} /> : i + 1}
              </span>
              <span className="dk-stepv-label">{s}</span>
            </li>
          )
        })}
      </ol>
    )
  return (
    <div className={cx('dk-steph', className)}>
      <div className="dk-steph-bar" aria-hidden="true">
        {steps.map((s, i) => (
          <i key={s} className={allDone || i < current ? 'is-done' : i === current ? 'is-now' : ''} />
        ))}
      </div>
      <p className="dk-steph-meta">
        <b>{allDone ? t.done : steps[now]}</b>
        <span className="dk-num">{t.step(Math.min(current + 1, n), n)}</span>
      </p>
      <ol className="dk-sr" aria-label={label}>
        {steps.map((s, i) => (
          <li key={s} aria-current={i === current ? 'step' : undefined}>
            {s}
            {allDone || i < current ? ` (${t.done})` : ''}
          </li>
        ))}
      </ol>
    </div>
  )
}

/* ------------------------------------------------------------------ InsightCallout (graft B) */

export function InsightCallout({ children, title, action, className }: { children: ReactNode; title?: string; action?: ReactNode; className?: string }) {
  const t = useUiStrings()
  return (
    <aside className={cx('dk-insight', className)}>
      <span className="dk-insight-ic" aria-hidden="true">
        <Icon name="spark" size={16} />
      </span>
      <div className="dk-insight-body">
        <p className="dk-insight-title">{title ?? t.insight}</p>
        <div className="dk-insight-text">{children}</div>
        {action && <div className="dk-insight-act">{action}</div>}
      </div>
    </aside>
  )
}

/* ------------------------------------------------------------------ SectionHeader (graft B: italic Fraunces index, benefit title) */

export function SectionHeader({ index, title, lead, actions, id, as: H = 'h2' }: { index?: string; title: string; lead?: string; actions?: ReactNode; id?: string; as?: 'h2' | 'h3' }) {
  return (
    <header className="dk-sh">
      {index && (
        <span className="dk-sh-idx" aria-hidden="true">
          {index}
        </span>
      )}
      <div className="dk-sh-text">
        <H className="dk-sh-title" id={id}>
          {title}
        </H>
        {lead && <p className="dk-sh-lead">{lead}</p>}
      </div>
      {actions && <div className="dk-sh-act">{actions}</div>}
    </header>
  )
}

/* ------------------------------------------------------------------ Panel (card surface with optional header) */

export interface PanelProps extends Omit<ComponentPropsWithRef<'section'>, 'title'> {
  title?: ReactNode
  icon?: IconName
  meta?: ReactNode
  actions?: ReactNode
  flush?: boolean
}

export function Panel({ title, icon, meta, actions, flush, className, children, ...rest }: PanelProps) {
  return (
    <section className={cx('dk-panel', flush && 'is-flush', className)} {...rest}>
      {(title || actions) && (
        <header className="dk-panel-h">
          <span className="dk-panel-title">
            {icon && <Icon name={icon} size={16} />}
            {title}
            {meta && <span className="dk-panel-meta">{meta}</span>}
          </span>
          {actions && <span className="dk-panel-act">{actions}</span>}
        </header>
      )}
      <div className="dk-panel-b">{children}</div>
    </section>
  )
}
