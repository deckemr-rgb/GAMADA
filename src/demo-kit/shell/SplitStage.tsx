/**
 * shell/SplitStage.tsx — two views side by side on desktop (default 40/60), tabs on top below 768 px
 * ("HP Warga" | "Konsol Petugas"). Both panels stay mounted (state survives a tab switch); the inactive one is
 * hidden only in the mobile layout (CSS), so desktop always shows both.
 */
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useI18n } from '../../lib/i18n'
import type { Bi } from '../../content/products'
import { useDemoStrings } from '../i18n'
import { SHELL } from './constants'
import { useMediaQuery } from './hooks'
import { useShellOptional } from './context'

export interface SplitStageProps {
  left: ReactNode
  right: ReactNode
  /** tab / region labels; default "HP Warga" | "Konsol Petugas" */
  labels?: [Bi | string, Bi | string]
  /** column fractions on desktop, default [40, 60] */
  ratio?: [number, number]
  /** tab shown first on mobile */
  initial?: 'left' | 'right'
  /** controlled mobile tab (e.g. a product switches to the console after "Kirim") */
  tab?: 'left' | 'right'
  onTabChange?: (tab: 'left' | 'right') => void
  className?: string
}

export function SplitStage({ left, right, labels, ratio = [40, 60], initial = 'left', tab, onTabChange, className }: SplitStageProps) {
  const t = useDemoStrings()
  const { lang } = useI18n()
  const ids = useId()
  const [own, setOwn] = useState<'left' | 'right'>(initial)
  // tabs (and tab semantics) only in the mobile layout; desktop shows two labelled regions
  const shell = useShellOptional()
  const narrowViewport = useMediaQuery(`(max-width: ${SHELL.mobileBp - 1}px)`)
  const tabbed = shell ? shell.size === 'sm' : narrowViewport
  const cur = tab ?? own
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const txt = (v: Bi | string | undefined, d: string) => (v === undefined ? d : typeof v === 'string' ? v : v[lang])
  const names = [txt(labels?.[0], t.splitPhone), txt(labels?.[1], t.splitConsole)] as const
  const select = (side: 'left' | 'right') => {
    setOwn(side)
    onTabChange?.(side)
  }
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    const next = e.key === 'Home' ? 'left' : e.key === 'End' ? 'right' : cur === 'left' ? 'right' : 'left'
    select(next)
    tabs.current[next === 'left' ? 0 : 1]?.focus()
  }
  const side = (s: 'left' | 'right', i: 0 | 1) => (
    <button
      ref={(el) => {
        tabs.current[i] = el
      }}
      type="button"
      role="tab"
      id={`${ids}-tab-${s}`}
      aria-selected={cur === s}
      aria-controls={`${ids}-panel-${s}`}
      tabIndex={cur === s ? 0 : -1}
      className="dk-split-tab"
      onClick={() => select(s)}
    >
      {names[i]}
    </button>
  )
  return (
    <div
      className={`dk-split${tabbed ? ' is-tabbed' : ''}${className ? ` ${className}` : ''}`}
      style={{
        ['--dk-split-l' as string]: `${ratio[0]}fr`,
        ['--dk-split-r' as string]: `${ratio[1]}fr`,
      }}
    >
      <div className="dk-split-tabs" role="tablist" aria-label={t.splitViews} onKeyDown={onKey} hidden={!tabbed}>
        {side('left', 0)}
        {side('right', 1)}
      </div>
      <section
        id={`${ids}-panel-left`}
        role={tabbed ? 'tabpanel' : 'region'}
        aria-labelledby={tabbed ? `${ids}-tab-left` : undefined}
        aria-label={tabbed ? undefined : names[0]}
        className={`dk-split-pane is-left${cur === 'left' ? ' is-cur' : ''}`}
      >
        {left}
      </section>
      <section
        id={`${ids}-panel-right`}
        role={tabbed ? 'tabpanel' : 'region'}
        aria-labelledby={tabbed ? `${ids}-tab-right` : undefined}
        aria-label={tabbed ? undefined : names[1]}
        className={`dk-split-pane is-right${cur === 'right' ? ' is-cur' : ''}`}
      >
        {right}
      </section>
    </div>
  )
}
