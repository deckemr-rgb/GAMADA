/** Button, IconButton, Kbd. Primary uses the ecosystem accent with --dk-on-accent text (AA tested). */
import type { ComponentPropsWithRef, ReactNode } from 'react'
import { Icon, type IconName } from './icons'
import './tokens.css'
import './ui.css'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'quiet' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: IconName
  iconEnd?: IconName
  /** keyboard shortcut hint, shown only for fine pointers; also sets aria-keyshortcuts */
  kbd?: string
  /** shows a progress dot and sets aria-busy (the button still works / is not a dead control) */
  busy?: boolean
}

export function Button({ variant = 'secondary', size = 'md', icon, iconEnd, kbd, busy, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={`dk-btn dk-btn--${variant} dk-btn--${size}${className ? ` ${className}` : ''}`}
      aria-keyshortcuts={kbd}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy ? <span className="dk-btn-busy" aria-hidden="true" /> : icon && <Icon name={icon} size={16} />}
      {children != null && <span className="dk-btn-label">{children}</span>}
      {iconEnd && <Icon name={iconEnd} size={16} />}
      {kbd && (
        <kbd className="dk-kbd dk-kbd-hint" aria-hidden="true">
          {kbd}
        </kbd>
      )}
    </button>
  )
}

export interface IconButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'children'> {
  icon: IconName
  /** required accessible name (also the tooltip title) */
  label: string
  variant?: 'ghost' | 'quiet' | 'primary'
  size?: 'sm' | 'md'
  /** small count badge */
  badge?: number
}

export function IconButton({ icon, label, variant = 'ghost', size = 'md', badge, className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button type={type} className={`dk-ibtn dk-ibtn--${variant} dk-ibtn--${size}${className ? ` ${className}` : ''}`} aria-label={label} title={label} {...rest}>
      <Icon name={icon} size={size === 'sm' ? 16 : 18} />
      {badge ? (
        <span className="dk-ibtn-badge dk-num" aria-hidden="true">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </button>
  )
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return <kbd className={`dk-kbd${className ? ` ${className}` : ''}`}>{children}</kbd>
}
