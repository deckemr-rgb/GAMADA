/**
 * shell/TopBar.tsx — 56 px bar (spec §6.3), left → right: logo + breadcrumb (Ekosistem / <eco> / ● product),
 * RegionSwitcher, RoleSwitcher, ClockControl, AiModeToggle, ModeBadge, language, Reset, Fullscreen, "← Kembali
 * ke produk". The guide "?" and the command palette sit with the action buttons.
 *   lg ≥ 1280: everything · md 768–1279: role + clock in the bar, the rest in "⋯" · sm < 768: name + "⋯".
 * MoreSheet is the "⋯" drawer (inline controls: popovers cannot open inside a modal drawer).
 * `interim` (a tahap-1 placeholder canvas): the role, clock, AI and reset controls are not shown, because nothing
 * on that canvas reacts to them (spec §8.5: no control without an effect).
 * Fit: the bar measures itself (fitBar) and steps through data-tight 1..3 (badge → dot, region → icon, shorter
 * role label) until the middle group and the product name fit; it never overlaps the end group.
 */
import { Suspense, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'
import { ECOSYSTEMS, type EcoOrInti, type ProductDef } from '../../content/products'
import AppLink from '../../components/AppLink'
import { Button, Drawer, IconButton } from '../ui'
import { useDemoStrings } from '../i18n'
import { AiModeToggle, BackToProduct, ClockChip, ClockControl, FullscreenButton, LangToggle, ModeBadge, RegionSwitcher, ResetButton, RoleSwitcher, type HealthState } from './controls'
import type { ShellSize } from './hooks'
import { LazyTourBar, preloadPalette } from './lazy'

export const ecoShortName = (eco: EcoOrInti): string => ECOSYSTEMS[eco].name.replace(/^GAMADA\s+/, '')

function Mark() {
  return (
    <svg className="dk-topbar-mark" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="21" cy="11" r="4.2" fill="var(--c-peach-soft)" />
      <path d="M2 27 L12 12 L17 19 L21 14 L30 27 Z" fill="currentColor" />
    </svg>
  )
}

export function Breadcrumb({ product, size }: { product: ProductDef; size: ShellSize }) {
  const t = useDemoStrings()
  const full = size === 'xl'
  return (
    <nav className="dk-crumbs" aria-label={t.breadcrumb}>
      <ol>
        {full && (
          <li>
            <AppLink to="/ekosistem">{t.ecosystem}</AppLink>
          </li>
        )}
        {full && product.eco !== 'inti' && (
          <li>
            <AppLink to={`/ekosistem/${product.eco}`}>{ecoShortName(product.eco)}</AppLink>
          </li>
        )}
        <li>
          <AppLink to={`/produk/${product.slug}`} className="dk-crumbs-product">
            <span className="dk-eco-dot" aria-hidden="true" />
            <span className="dk-crumbs-name">{product.name}</span>
          </AppLink>
        </li>
      </ol>
    </nav>
  )
}

/** Tightening steps, applied in order until nothing overflows (CSS in shell.css: `.dk-topbar[data-tight]`). */
const TIGHT_MAX = 3

function overflowing(bar: HTMLElement): boolean {
  const mid = bar.querySelector<HTMLElement>('.dk-topbar-mid')
  const name = bar.querySelector<HTMLElement>('.dk-crumbs-name')
  return bar.scrollWidth > bar.clientWidth + 1 || (!!mid && mid.scrollWidth > mid.clientWidth) || (!!name && name.scrollWidth > name.clientWidth + 1)
}

/** Start loose, then tighten one step at a time while the bar overflows (a few sync layouts, only on resize). */
function fitBar(bar: HTMLElement): void {
  bar.removeAttribute('data-tight')
  for (let level = 1; level <= TIGHT_MAX && overflowing(bar); level++) bar.setAttribute('data-tight', String(level))
}

function useFitBar(ref: RefObject<HTMLElement | null>, deps: readonly unknown[]): void {
  useLayoutEffect(() => {
    const bar = ref.current
    if (!bar) return
    fitBar(bar)
    if (typeof ResizeObserver === 'undefined') return
    // the bar's width (viewport) and the size of every control (role / language / fonts change their labels)
    const ro = new ResizeObserver(() => fitBar(bar))
    ro.observe(bar)
    bar.querySelectorAll('.dk-crumbs ol, .dk-topbar-mid > *, .dk-topbar-end').forEach((el) => ro.observe(el))
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

export interface TopBarProps {
  product: ProductDef
  size: ShellSize
  health: HealthState
  /** tahap-1 placeholder canvas: hide the controls nothing on the canvas reacts to (role, clock, AI, reset) */
  interim?: boolean
  /** a tap / click on the disabled "Live" pill: explain why (toast) */
  onLiveUnavailable?: () => void
  rewinding: boolean
  onReset: () => void
  fullscreen: { supported: boolean; active: boolean; toggle: () => void }
  guide: { available: boolean; open: boolean; toggle: () => void; id: string }
  onOpenPalette: () => void
  onOpenMore: () => void
  /** the tour's stage (DemoShell mode="tour"): only the product name (plain text) + `tourSlot` */
  tour?: boolean
  tourSlot?: ReactNode
  /** K4: a sandbox taken over from the tour (session scope 'tour' + from 'tur-<n>'): "Kembali ke tur" (44 px) left of the product name */
  fromTour?: boolean
}


export function TopBar({ product, size, health, interim, onLiveUnavailable, rewinding, onReset, fullscreen, guide, onOpenPalette, onOpenMore, tour, tourSlot, fromTour }: TopBarProps) {
  const t = useDemoStrings()
  const lg = size === 'lg' || size === 'xl'
  const bar = useRef<HTMLElement>(null)
  useFitBar(bar, [size, interim, product.slug, tour, fromTour])
  // the tour's stage: no session controls (the tour owns them)
  const bare = interim || tour
  const guideBtn = guide.available && (
    <IconButton
      icon="help"
      label={guide.open ? t.guideClose : t.guideOpen}
      aria-expanded={guide.open}
      aria-controls={guide.id}
      onClick={guide.toggle}
      className={guide.open ? 'is-on' : undefined}
    />
  )
  return (
    <header ref={bar} className={`dk-topbar is-${size}${tour ? ' is-tour' : ''}`} aria-label={t.topBar}>
      {size !== 'sm' && !tour && (
        <AppLink to="/" className="dk-topbar-logo" aria-label="GAMADA">
          <Mark />
        </AppLink>
      )}
      {(tour || fromTour) && (
        <Suspense fallback={null}>
          <LazyTourBar name={tour ? product.name : undefined} />
        </Suspense>
      )}
      {!tour && <Breadcrumb product={product} size={size} />}
      <div className="dk-topbar-mid">
        {lg && !tour && <RegionSwitcher />}
        {size !== 'sm' && !bare && <RoleSwitcher product={product.slug} />}
        {size !== 'sm' && !bare && <ClockControl rewinding={rewinding} />}
        {size === 'sm' && !bare && <ClockChip />}
        {lg && !bare && <AiModeToggle health={health} onUnavailable={onLiveUnavailable} />}
        {lg && !tour && <ModeBadge />}
      </div>
      <div className="dk-topbar-end">
        {tour ? tourSlot : (
          <>
            {lg && <LangToggle />}
            {lg && (
              <IconButton
                icon="search"
                label={`${t.palette} (${t.kbdOpen})`}
                aria-keyshortcuts="Control+K Meta+K"
                onClick={onOpenPalette}
                onPointerEnter={preloadPalette}
                onFocus={preloadPalette}
              />
            )}
            {size !== 'sm' && guideBtn}
            {lg && !interim && <ResetButton onRequest={onReset} />}
            {lg && fullscreen.supported && <FullscreenButton active={fullscreen.active} onToggle={fullscreen.toggle} />}
            {lg && <BackToProduct product={product.slug} compact={size !== 'xl'} />}
            {!lg && <IconButton icon="more" label={t.more} onClick={onOpenMore} data-dk-more="" />}
          </>
        )}
      </div>
    </header>
  )
}

export interface MoreSheetProps extends Omit<TopBarProps, 'onOpenMore'> {
  open: boolean
  onClose: () => void
  /** a role was picked in the sheet: on phones the sheet closes so the visitor sees the result (plus a toast) */
  onRolePicked?: (name: string) => void
}

/** The "⋯" sheet: on sm everything, on md only what the bar does not show. */
export function MoreSheet({ open, onClose, product, size, health, interim, onLiveUnavailable, rewinding, onReset, fullscreen, guide, onOpenPalette, onRolePicked }: MoreSheetProps) {
  const t = useDemoStrings()
  const sm = size === 'sm'
  const then = (fn: () => void) => () => {
    onClose()
    fn()
  }
  return (
    <Drawer open={open} onClose={onClose} title={t.moreTitle} eyebrow={product.name} width={380}>
      <div className="dk-more">
        <Breadcrumb product={product} size="xl" />
        <section className="dk-more-sec">
          <h3 className="dk-more-h">{t.region}</h3>
          <RegionSwitcher inline />
        </section>
        {sm && !interim && (
          <section className="dk-more-sec">
            <h3 className="dk-more-h">{t.role}</h3>
            <RoleSwitcher
              product={product.slug}
              inline
              onPicked={(name) => {
                onClose()
                onRolePicked?.(name)
              }}
            />
          </section>
        )}
        {sm && !interim && (
          <section className="dk-more-sec">
            <h3 className="dk-more-h">{t.clock}</h3>
            <ClockControl inline rewinding={rewinding} onPicked={onClose} />
          </section>
        )}
        <section className="dk-more-sec dk-more-row">
          {!interim && (
            <div className="dk-more-ai">
              <h3 className="dk-more-h">{t.aiMode}</h3>
              <AiModeToggle health={health} inline onUnavailable={onLiveUnavailable} />
            </div>
          )}
          <div>
            <h3 className="dk-more-h">{t.language}</h3>
            <LangToggle />
          </div>
        </section>
        <section className="dk-more-sec">
          <ModeBadge />
        </section>
        <section className="dk-more-actions">
          {sm && guide.available && (
            <Button icon="help" variant="secondary" onClick={then(guide.toggle)}>
              {guide.open ? t.guideClose : t.tryThis}
            </Button>
          )}
          <Button icon="search" variant="secondary" onClick={then(onOpenPalette)}>
            {t.paletteTitle}
          </Button>
          {!interim && (
            <Button icon="reset" variant="secondary" onClick={then(onReset)}>
              {t.reset}
            </Button>
          )}
          {fullscreen.supported && (
            <Button icon="fullscreen" variant="secondary" aria-pressed={fullscreen.active} onClick={then(fullscreen.toggle)}>
              {fullscreen.active ? t.exitFullscreen : t.fullscreen}
            </Button>
          )}
          <BackToProduct product={product.slug} />
        </section>
      </div>
    </Drawer>
  )
}
