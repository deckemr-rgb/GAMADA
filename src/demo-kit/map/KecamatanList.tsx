/**
 * KecamatanList — the accessible mirror of the map: every kecamatan as a button (value + bar when a
 * choropleth is shown). ↑/↓/Home/End move focus; focusing or hovering highlights the polygon on the map;
 * Enter/click picks it (the parent flies the map there). A polite live region announces the flight.
 */
import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useI18n } from '../../lib/i18n'
import { Icon } from '../ui/icons'
import { fmt, ms } from './strings'
import './map.css'

export interface KecamatanListProps {
  items: { id: string; name: string }[]
  values?: Record<string, number | null | undefined>
  hidden?: string[]
  format?: (v: number) => string
  unit?: string
  selectedId?: string | null
  onPick: (id: string) => void
  onFocusItem?: (id: string | null) => void
  /** 'value' sorts high → low when values exist (default), 'name' alphabetically */
  sort?: 'value' | 'name'
  title?: string
  className?: string
}

export function KecamatanList({ items, values, hidden, format, unit, selectedId, onPick, onFocusItem, sort = 'value', title, className }: KecamatanListProps) {
  const { lang } = useI18n()
  const [q, setQ] = useState('')
  const [said, setSaid] = useState('')
  const listRef = useRef<HTMLUListElement>(null)
  const fid = useId()
  const hid = useMemo(() => new Set(hidden ?? []), [hidden])
  const fmtV = format ?? ((v: number) => fmt(v, lang, 2))
  const max = useMemo(() => Math.max(0, ...Object.values(values ?? {}).filter((v): v is number => typeof v === 'number')), [values])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = items.filter((k) => !needle || k.name.toLowerCase().includes(needle))
    const val = (id: string) => (hid.has(id) ? -1 : (values?.[id] ?? -2))
    return [...list].sort((a, b) => (sort === 'value' && values ? val(b.id) - val(a.id) : 0) || a.name.localeCompare(b.name, 'id'))
  }, [items, q, values, sort, hid])

  const focusAt = (i: number) => {
    const btns = listRef.current?.querySelectorAll<HTMLButtonElement>('button')
    if (!btns?.length) return
    btns[Math.max(0, Math.min(btns.length - 1, i))]?.focus()
  }
  const onKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const btns = [...(listRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
    const i = btns.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'ArrowDown') focusAt(i + 1)
    else if (e.key === 'ArrowUp') focusAt(i - 1)
    else if (e.key === 'Home') focusAt(0)
    else if (e.key === 'End') focusAt(btns.length - 1)
    else return
    e.preventDefault()
  }
  const pick = (id: string, name: string) => {
    onPick(id)
    setSaid(`${ms('flyingTo', lang)} ${name}`)
  }

  return (
    <section className={`dk-mkl${className ? ` ${className}` : ''}`} aria-label={title ?? ms('listLabel', lang)}>
      <div className="dk-mkl-head">
        <h3 className="dk-mkl-title">{title ?? ms('listLabel', lang)}</h3>
        {unit && <span className="dk-mkl-unit">{unit}</span>}
      </div>
      <label className="dk-mkl-filter" htmlFor={fid}>
        <Icon name="search" size={16} />
        <span className="dk-sr">{ms('filter', lang)}</span>
        <input id={fid} type="search" value={q} placeholder={ms('filter', lang)} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
      </label>
      <p className="dk-mkl-hint">{ms('listHint', lang)}</p>
      {rows.length ? (
        <ul ref={listRef} className="dk-mkl-list" onKeyDown={onKey} onMouseLeave={() => onFocusItem?.(null)} onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && onFocusItem?.(null)}>
          {rows.map((k) => {
            const v = values?.[k.id]
            const isHid = hid.has(k.id)
            const sel = k.id === selectedId
            return (
              <li key={k.id}>
                <button type="button" className={`dk-mkl-row${sel ? ' is-sel' : ''}`} aria-pressed={sel} onClick={() => pick(k.id, k.name)} onFocus={() => onFocusItem?.(k.id)} onMouseEnter={() => onFocusItem?.(k.id)}>
                  <span className="dk-mkl-name">{k.name}</span>
                  {values && (
                    <span className="dk-mkl-val dk-num">
                      {isHid ? <span title={ms('hidden', lang)}>{ms('hiddenShort', lang).split(' (')[0]}</span> : typeof v === 'number' ? fmtV(v) : '—'}
                    </span>
                  )}
                  {values && <span className="dk-mkl-bar" aria-hidden="true" style={{ ['--w' as string]: !isHid && typeof v === 'number' && max > 0 ? `${(v / max) * 100}%` : '0%' }} />}
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="dk-mkl-empty">{ms('noMatch', lang)}</p>
      )}
      <p className="dk-sr" aria-live="polite">
        {said}
      </p>
    </section>
  )
}
