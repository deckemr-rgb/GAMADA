/**
 * docs/values.ts — how an extracted value reads on screen: the field kind (amount / presence / text) and the
 * bilingual presence words. Small on purpose: DocViewer and ExtractPanel both use it without the sample data.
 */
export type FieldKind = 'amount' | 'presence' | 'text'

/** field keys that hold money (Rupiah); every other bare number (NIK, postcode, KBLI, RT/RW, year) stays verbatim */
export const AMOUNT_KEY = /(^|_)(total|subtotal|bayar|kembali|saldo|modal|nilai|jumlah_rp|harga|biaya|omzet|nominal|dpp|ppn|amount|price|capital)(_|$)/i

const PRESENCE: Record<string, { id: string; en: string }> = {
  ada: { id: 'ada', en: 'present' },
  'tidak ada': { id: 'tidak ada', en: 'absent' },
  present: { id: 'ada', en: 'present' },
  absent: { id: 'tidak ada', en: 'absent' },
}

/** the kind of a field from its key and raw value (an explicit kind wins) */
export function fieldKind(key: string, value: string, kind?: FieldKind): FieldKind {
  if (kind) return kind
  if (PRESENCE[value.toLowerCase()]) return 'presence'
  return AMOUNT_KEY.test(key) && /^\d+$/.test(value) ? 'amount' : 'text'
}

/** 'ada' / 'tidak ada' in the UI language; any other value unchanged */
export function presenceText(value: string, lang: 'id' | 'en'): string {
  return PRESENCE[value.toLowerCase()]?.[lang] ?? value
}
