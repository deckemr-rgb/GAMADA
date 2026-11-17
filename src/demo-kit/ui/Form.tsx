/** Field (label + hint + error wiring), Input, Textarea, Select (native, styled), Segmented (radio group). */
import { useId, useRef, type ComponentPropsWithRef, type KeyboardEvent, type ReactElement, type ReactNode } from 'react'
import { Icon, type IconName } from './icons'
import './tokens.css'
import './ui.css'

/* ------------------------------------------------------------------ Field */

export interface FieldProps {
  label: string
  hint?: string
  error?: string
  /** visually hide the label (it stays the accessible name) */
  hideLabel?: boolean
  /** render-prop receives the ids to spread on the control */
  children: (ids: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: true }) => ReactElement
  className?: string
}

export function Field({ label, hint, error, hideLabel, children, className }: FieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-h` : undefined
  const errId = error ? `${id}-e` : undefined
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined
  return (
    <div className={`dk-field${error ? ' is-error' : ''}${className ? ` ${className}` : ''}`}>
      <label htmlFor={id} className={hideLabel ? 'dk-sr' : 'dk-field-label'}>
        {label}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {hint && !error && (
        <p id={hintId} className="dk-field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className="dk-field-error">
          <Icon name="alert" size={14} />
          {error}
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ Input / Textarea */

export interface InputProps extends ComponentPropsWithRef<'input'> {
  icon?: IconName
  /** trailing slot (unit, kbd, clear button) */
  suffix?: ReactNode
}

export function Input({ icon, suffix, className, ...rest }: InputProps) {
  return (
    <span className={`dk-input${icon ? ' has-icon' : ''}${className ? ` ${className}` : ''}`}>
      {icon && <Icon name={icon} size={16} className="dk-input-icon" />}
      <input {...rest} />
      {suffix && <span className="dk-input-suffix">{suffix}</span>}
    </span>
  )
}

export function Textarea({ className, ...rest }: ComponentPropsWithRef<'textarea'>) {
  return <textarea className={`dk-textarea${className ? ` ${className}` : ''}`} {...rest} />
}

/* ------------------------------------------------------------------ Select */

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps extends Omit<ComponentPropsWithRef<'select'>, 'children'> {
  options: SelectOption[]
}

export function Select({ options, className, ...rest }: SelectProps) {
  return (
    <span className={`dk-select${className ? ` ${className}` : ''}`}>
      <select {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon name="chevronDown" size={16} className="dk-select-chev" />
    </span>
  )
}

/* ------------------------------------------------------------------ Segmented */

export interface SegmentedOption<V extends string> {
  value: V
  label: string
  icon?: IconName
  /** hide the text, keep it as the accessible name */
  iconOnly?: boolean
}

export interface SegmentedProps<V extends string> {
  options: SegmentedOption<V>[]
  value: V
  onChange: (v: V) => void
  label: string
  size?: 'sm' | 'md'
  className?: string
  /** intent signal (pointer over, focus, touch start) for an option: e.g. preload that tab's lazy chunk */
  onIntent?: (v: V) => void
}

/** Radio-group semantics: one tab stop, arrows move + select (WAI-ARIA radio group). */
export function Segmented<V extends string>({ options, value, onChange, label, size = 'md', className, onIntent }: SegmentedProps<V>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = options.findIndex((o) => o.value === value)
    let n = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % options.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + options.length) % options.length
    else if (e.key === 'Home') n = 0
    else if (e.key === 'End') n = options.length - 1
    if (n < 0) return
    e.preventDefault()
    const o = options[n]
    if (!o) return
    onChange(o.value)
    refs.current[n]?.focus()
  }
  return (
    <div className={`dk-seg dk-seg--${size}${className ? ` ${className}` : ''}`} role="radiogroup" aria-label={label} onKeyDown={onKey}>
      {options.map((o, i) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onPointerEnter={onIntent ? () => onIntent(o.value) : undefined}
            onFocus={onIntent ? () => onIntent(o.value) : undefined}
            onTouchStart={onIntent ? () => onIntent(o.value) : undefined}
            aria-label={o.iconOnly ? o.label : undefined}
            title={o.iconOnly ? o.label : undefined}
            onClick={() => onChange(o.value)}
          >
            {o.icon && <Icon name={o.icon} size={16} />}
            {!o.iconOnly && <span>{o.label}</span>}
          </button>
        )
      })}
    </div>
  )
}
