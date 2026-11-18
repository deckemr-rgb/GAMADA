/**
 * MoneyInput — a Rupiah amount field: "Rp" prefix, thousands separated with dots while typing, numeric keypad on
 * phones (`inputMode="numeric"`), `onChange(number | null)`. Uses the kit's .dk-input look (44 px on phones).
 */
import type { ComponentPropsWithRef } from 'react'
import './ui.css'

export interface MoneyInputProps extends Omit<ComponentPropsWithRef<'input'>, 'value' | 'onChange' | 'type' | 'max'> {
  value: number | null
  onChange: (value: number | null) => void
  /** upper bound (e.g. a 10 % discount cap); larger input is clamped */
  max?: number
}

const fmt = (n: number) => Math.round(n).toLocaleString('id-ID')

export function MoneyInput({ value, onChange, max, className, ...rest }: MoneyInputProps) {
  return (
    <span className={`dk-input dk-money${className ? ` ${className}` : ''}`}>
      <span className="dk-input-suffix dk-money-rp" aria-hidden="true">
        Rp
      </span>
      <input
        {...rest}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value == null ? '' : fmt(value)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '')
          if (!digits) return onChange(null)
          const n = Number(digits)
          onChange(max != null ? Math.min(max, n) : n)
        }}
      />
    </span>
  )
}
