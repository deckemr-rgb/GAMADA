/**
 * shell/TopBar.tsx — 56 px bar (spec §6.3), left → right: logo + breadcrumb (Ekosistem / <eco> / ● product),
 * RegionSwitcher, RoleSwitcher, ClockControl, AiModeToggle, ModeBadge, language, Reset, Fullscreen, "← Kembali
 * ke produk". The guide "?" and the command palette sit with the action buttons.
 *   lg ≥ 1280: everything · md 768–1279: role + clock in the bar, the rest in "⋯" · sm < 768: name + "⋯".
 * MoreSheet is the "⋯" drawer (inline controls: popovers cannot open inside a modal drawer).
 */
import { ECOSYSTEMS, type EcoOrInti, type ProductDef } from '../../content/products'
import AppLink from '../../components/AppLink'
import { Button, Drawer, IconButton } from '../ui'
import { useDemoStrings } from '../i18n'
import { AiModeToggle, BackToProduct, ClockControl, FullscreenButton, LangToggle, ModeBadge, RegionSwitcher, ResetButton, RoleSwitcher, type HealthState } from './controls'
import type { ShellSize } from './hooks'

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

export interface TopBarProps {
  product: ProductDef
  size: ShellSize
  health: HealthState
  rewinding: boolean
  onReset: () => void
  fullscreen: { supported: boolean; active: boolean; toggle: () => void }
  guide: { available: boolean; open: boolean; toggle: () => void; id: string }
  onOpenPalette: () => void
  onOpenMore: () => void
}

export function TopBar({ product, size, health, rewinding, onReset, fullscreen, guide, onOpenPalette, onOpenMore }: TopBarProps) {
  const t = useDemoStrings()
  const lg = size === 'lg' || size === 'xl'
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
    <header className={`dk-topbar is-${size}`} aria-label={t.topBar}>
      {size !== 'sm' && (
        <AppLink to="/" className="dk-topbar-logo" aria-label="GAMADA">
          <Mark />
        </AppLink>
      )}
      <Breadcrumb product={product} size={size} />
      <div className="dk-topbar-mid">
        {lg && <RegionSwitcher />}
        {size !== 'sm' && <RoleSwitcher product={product.slug} />}
        {size !== 'sm' && <ClockControl rewinding={rewinding} />}
        {lg && <AiModeToggle health={health} />}
        {lg && <ModeBadge />}
      </div>
      <div className="dk-topbar-end">
        {lg && <LangToggle />}
        {lg && <IconButton icon="search" label={`${t.palette} (${t.kbdOpen})`} aria-keyshortcuts="Control+K Meta+K" onClick={onOpenPalette} />}
        {size !== 'sm' && guideBtn}
        {lg && <ResetButton onRequest={onReset} />}
        {lg && fullscreen.supported && <FullscreenButton active={fullscreen.active} onToggle={fullscreen.toggle} />}
        {lg && <BackToProduct product={product.slug} compact={size !== 'xl'} />}
        {!lg && <IconButton icon="more" label={t.more} onClick={onOpenMore} />}
      </div>
    </header>
  )
}

export interface MoreSheetProps extends Omit<TopBarProps, 'onOpenMore'> {
  open: boolean
  onClose: () => void
}

/** The "⋯" sheet: on sm everything, on md only what the bar does not show. */
export function MoreSheet({ open, onClose, product, size, health, rewinding, onReset, fullscreen, guide, onOpenPalette }: MoreSheetProps) {
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
        {sm && (
          <section className="dk-more-sec">
            <h3 className="dk-more-h">{t.role}</h3>
            <RoleSwitcher product={product.slug} inline />
          </section>
        )}
        {sm && (
          <section className="dk-more-sec">
            <h3 className="dk-more-h">{t.clock}</h3>
            <ClockControl inline rewinding={rewinding} />
          </section>
        )}
        <section className="dk-more-sec dk-more-row">
          <div>
            <h3 className="dk-more-h">{t.aiMode}</h3>
            <AiModeToggle health={health} />
          </div>
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
          <Button icon="reset" variant="secondary" onClick={then(onReset)}>
            {t.reset}
          </Button>
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
