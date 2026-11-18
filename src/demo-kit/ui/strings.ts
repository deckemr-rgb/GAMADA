/** Built-in strings of the ui/ components (ID + EN). Everything else is passed in already localised. */
import { useI18n, type Lang } from '../../lib/i18n'

export const UI_STRINGS = {
  id: {
    close: 'Tutup',
    density: 'Kepadatan baris',
    comfy: 'Nyaman',
    compact: 'Padat',
    sortBy: (c: string) => `Urutkan menurut ${c}`,
    sortLabel: 'Urutan',
    sortNone: 'Urutan bawaan',
    sortedAsc: 'urut naik',
    sortedDesc: 'urut turun',
    rows: (n: string) => `${n} baris`,
    showMore: (n: number) => `Tampilkan ${n} lagi`,
    kbdMove: 'pindah',
    kbdOpen: 'buka',
    kbdNew: 'baru',
    newRow: (s: string) => `Baris baru: ${s}`,
    moveTo: (col: string) => `Pindahkan ke ${col}`,
    moved: (item: string, col: string) => `${item} dipindah ke ${col}.`,
    kanbanHelp: 'Panah untuk berpindah kartu. Shift + panah kiri/kanan memindahkan kartu ke kolom lain.',
    cardsIn: (n: number) => `${n} kartu`,
    cardsShown: (n: number, total: number) => `${n} dari ${total} kartu ditampilkan`,
    empty: 'Belum ada data',
    step: (a: number, b: number) => `Langkah ${a}/${b}`,
    done: 'Tuntas',
    late: 'Lewat',
    left: 'lagi',
    vsYesterday: 'vs kemarin',
    of: 'dari',
    target: 'target',
    loading: 'Memuat…',
    live: 'Langsung',
    menu: 'Menu',
    dismiss: 'Tutup notifikasi',
    notifications: 'Notifikasi',
    unread: 'belum dibaca',
    insight: 'Wawasan AI',
  },
  en: {
    close: 'Close',
    density: 'Row density',
    comfy: 'Comfortable',
    compact: 'Compact',
    sortBy: (c: string) => `Sort by ${c}`,
    sortLabel: 'Sort order',
    sortNone: 'Default order',
    sortedAsc: 'sorted ascending',
    sortedDesc: 'sorted descending',
    rows: (n: string) => `${n} rows`,
    showMore: (n: number) => `Show ${n} more`,
    kbdMove: 'move',
    kbdOpen: 'open',
    kbdNew: 'new',
    newRow: (s: string) => `New row: ${s}`,
    moveTo: (col: string) => `Move to ${col}`,
    moved: (item: string, col: string) => `${item} moved to ${col}.`,
    kanbanHelp: 'Arrow keys move between cards. Shift + left/right arrow moves the card to another column.',
    cardsIn: (n: number) => `${n} cards`,
    cardsShown: (n: number, total: number) => `${n} of ${total} cards shown`,
    empty: 'Nothing here yet',
    step: (a: number, b: number) => `Step ${a}/${b}`,
    done: 'Resolved',
    late: 'Late by',
    left: 'left',
    vsYesterday: 'vs yesterday',
    of: 'of',
    target: 'target',
    loading: 'Loading…',
    live: 'Live',
    menu: 'Menu',
    dismiss: 'Dismiss notification',
    notifications: 'Notifications',
    unread: 'unread',
    insight: 'AI insight',
  },
} as const

export type UiStrings = (typeof UI_STRINGS)[Lang]

export function useUiStrings(): UiStrings {
  return UI_STRINGS[useI18n().lang]
}

const nf = new Map<string, Intl.NumberFormat>()
/** Locale number format (id-ID uses "." thousands and "," decimals). */
export function fmtNum(lang: Lang, v: number, digits = 0): string {
  const key = `${lang}${digits}`
  let f = nf.get(key)
  if (!f) {
    f = new Intl.NumberFormat(lang === 'id' ? 'id-ID' : 'en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    nf.set(key, f)
  }
  return f.format(v)
}
