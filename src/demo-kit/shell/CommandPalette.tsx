/**
 * shell/CommandPalette.tsx — Ctrl/Cmd + K (spec §6.3): jump to any product demo, role, world time or region,
 * plus a few shell actions. Fuzzy filter (subsequence match, word-start and contiguity bonuses), full keyboard:
 * ↑/↓ (wraps), Home/End, Enter runs, Esc closes (ui Modal: focus trap, inert background, focus return).
 * ARIA combobox: the input owns a listbox via aria-activedescendant.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { PRODUCTS, ROLES, type ProductDef } from '../../content/products'
import { useI18n } from '../../lib/i18n'
import { Avatar, Icon, Kbd, Modal, isIconName, type IconName } from '../ui'
import { REGIONS } from '../region/loader'
import { CLOCK, clock, formatTime, setSession, useClock, useSession } from '../world'
import { roleInitials, useDemoStrings } from '../i18n'
import { filterItems } from './fuzzy'

export { fuzzyScore, filterItems } from './fuzzy'

export interface PaletteItem {
  id: string
  group: string
  label: string
  /** extra words that should match (slug, descriptor, English name …) */
  keywords?: string
  hint?: string
  icon?: IconName
  lead?: ReactNode
  current?: boolean
  run: () => void
}

export interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  product: ProductDef
  /** navigate to another product's sandbox */
  onOpenProduct: (p: ProductDef) => void
  /** shell actions shown in the "Tindakan" group */
  actions?: PaletteItem[]
  /** list the role and world-clock jumps (default true); false on an interim canvas that reacts to neither */
  sessionItems?: boolean
}

export function CommandPalette({ open, onClose, product, onOpenProduct, actions = [], sessionItems = true }: CommandPaletteProps) {
  const t = useDemoStrings()
  const { lang } = useI18n()
  const session = useSession()
  const c = useClock()
  const ids = useId()
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setQ('')
      setActive(0)
    }
  }, [open])

  const items = useMemo<PaletteItem[]>(() => {
    const now = formatTime(c.minutes)
    const out: PaletteItem[] = []
    for (const p of PRODUCTS) {
      out.push({
        id: `p:${p.slug}`,
        group: t.groupProducts,
        label: p.name,
        keywords: `${p.slug} ${p.descriptor.id} ${p.descriptor.en} ${p.code}`,
        hint: p.descriptor[lang],
        icon: isIconName(p.icon) ? p.icon : 'grid',
        current: p.slug === product.slug,
        run: () => onOpenProduct(p),
      })
    }
    for (const r of sessionItems ? product.roles : []) {
      out.push({
        id: `r:${r}`,
        group: t.groupRoles,
        label: ROLES[r].name[lang],
        keywords: `${r} ${ROLES[r].name.id} ${ROLES[r].name.en} peran role`,
        lead: <Avatar name={ROLES[r].name[lang]} initials={roleInitials(r, lang)} size={24} />,
        current: r === session.role,
        run: () => setSession({ role: r }),
      })
    }
    for (const j of sessionItems ? CLOCK.jumps : []) {
      out.push({
        id: `t:${j}`,
        group: t.groupTimes,
        label: j,
        keywords: `${j.replace(':', '.')} jam time ${t.jumpTo(j)}`,
        hint: t.jumpTo(j),
        icon: 'clock',
        current: j === now,
        run: () => clock.setTime(j),
      })
    }
    for (const r of REGIONS) {
      out.push({
        id: `g:${r.id}`,
        group: t.groupRegions,
        label: r.name,
        keywords: `${r.shortName} ${r.id} wilayah region`,
        icon: 'flag',
        current: r.id === session.regionId,
        run: () => setSession({ regionId: r.id }),
      })
    }
    return [...out, ...actions.map((a) => ({ ...a, group: t.groupActions }))]
  }, [t, lang, product, session.role, session.regionId, c.minutes, onOpenProduct, actions, sessionItems])

  const shown = useMemo(() => filterItems(items, q), [items, q])
  const sel = Math.min(active, Math.max(0, shown.length - 1))

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-i="${sel}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [sel, shown])

  const runAt = (i: number) => {
    const it = shown[i]
    if (!it) return
    onClose()
    it.run()
  }

  const onKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    const n = shown.length
    if (!n) return
    if (e.key === 'ArrowDown') setActive((sel + 1) % n)
    else if (e.key === 'ArrowUp') setActive((sel - 1 + n) % n)
    else if (e.key === 'Home' && e.ctrlKey) setActive(0)
    else if (e.key === 'End' && e.ctrlKey) setActive(n - 1)
    else if (e.key === 'PageDown') setActive(Math.min(n - 1, sel + 6))
    else if (e.key === 'PageUp') setActive(Math.max(0, sel - 6))
    else if (e.key === 'Enter') runAt(sel)
    else return
    e.preventDefault()
  }

  let lastGroup = ''
  return (
    <Modal open={open} onClose={onClose} title={t.paletteTitle} description={t.paletteHint} size="md">
      <div className="dk-palette">
        <div className="dk-palette-field">
          <Icon name="search" size={16} />
          <input
            data-autofocus
            className="dk-palette-input"
            role="combobox"
            aria-expanded="true"
            aria-controls={`${ids}-list`}
            aria-activedescendant={shown[sel] ? `${ids}-o-${sel}` : undefined}
            aria-autocomplete="list"
            aria-label={t.palettePlaceholder}
            placeholder={t.palettePlaceholder}
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setActive(0)
            }}
            onKeyDown={onKey}
            autoComplete="off"
            spellCheck={false}
          />
          <Kbd>Esc</Kbd>
        </div>
        <p className="dk-sr" aria-live="polite">
          {shown.length ? t.paletteResults(shown.length) : t.paletteEmpty}
        </p>
        <div ref={list} id={`${ids}-list`} role="listbox" aria-label={t.paletteTitle} className="dk-palette-list">
          {shown.length === 0 && <p className="dk-palette-empty">{t.paletteEmpty}</p>}
          {shown.map((it, i) => {
            const head = it.group !== lastGroup ? it.group : null
            lastGroup = it.group
            return (
              <div key={it.id} role="presentation">
                {head && (
                  <p className="dk-palette-group" role="presentation">
                    {head}
                  </p>
                )}
                <div
                  id={`${ids}-o-${i}`}
                  data-i={i}
                  role="option"
                  aria-selected={i === sel}
                  className={`dk-palette-opt${i === sel ? ' is-active' : ''}`}
                  onPointerMove={() => i !== sel && setActive(i)}
                  onClick={() => runAt(i)}
                >
                  <span className="dk-palette-ic" aria-hidden="true">
                    {it.lead ?? (it.icon ? <Icon name={it.icon} size={16} /> : null)}
                  </span>
                  <span className="dk-palette-text">
                    <span className="dk-palette-label">{it.label}</span>
                    {it.hint && <span className="dk-palette-hint">{it.hint}</span>}
                  </span>
                  {it.current && <span className="dk-palette-cur">{t.current}</span>}
                  {i === sel && <Icon name="arrowRight" size={14} className="dk-palette-go" />}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}
