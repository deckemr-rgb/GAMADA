/**
 * LayerToggle — a panel of real switches (role="switch") for map layers. Every switch changes what the map
 * draws; layers out of scope are simply not listed (e.g. no satellite switch until a licensed provider exists).
 */
import { useI18n } from '../../lib/i18n'
import { Icon, type IconName } from '../ui/icons'
import { ms } from './strings'
import './map.css'

export interface LayerToggleItem {
  id: string
  label: string
  hint?: string
  icon?: IconName
  /** colour chip next to the label */
  swatch?: string
  checked: boolean
}

export interface LayerToggleProps {
  items: LayerToggleItem[]
  onChange: (id: string, checked: boolean) => void
  title?: string
  className?: string
}

export function LayerToggle({ items, onChange, title, className }: LayerToggleProps) {
  const { lang } = useI18n()
  const heading = title ?? ms('layers', lang)
  return (
    <fieldset className={`dk-mlt${className ? ` ${className}` : ''}`}>
      <legend className="dk-mlt-title">
        <Icon name="layers" size={16} />
        {heading}
      </legend>
      <ul>
        {items.map((it) => (
          <li key={it.id}>
            <button type="button" role="switch" aria-checked={it.checked} className="dk-mlt-row" onClick={() => onChange(it.id, !it.checked)}>
              {it.icon ? <Icon name={it.icon} size={16} className="dk-mlt-icon" /> : <span className="dk-mlt-icon" aria-hidden="true" />}
              <span className="dk-mlt-text">
                <span className="dk-mlt-label">
                  {it.swatch && <span className="dk-mlt-chip" style={{ background: it.swatch }} aria-hidden="true" />}
                  {it.label}
                </span>
                {it.hint && <span className="dk-mlt-hint">{it.hint}</span>}
              </span>
              <span className="dk-mlt-switch" aria-hidden="true">
                <span className="dk-mlt-knob" />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </fieldset>
  )
}
