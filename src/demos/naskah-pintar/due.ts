/**
 * naskah-pintar/due.ts — everyday deadline wording → world minutes, and back to a label the parser reads again.
 * Shared by the recorder (lazy) and the simulation scenario (lazy): "besok pukul sepuluh", "paling lambat Kamis",
 * "minggu ini", "lusa", "3 hari lagi", "by Thursday", "this week", "19 Nov 16.00". Day 0 = the world's day
 * (`day`, ISO date); weekdays are counted from that date. No React, no world import.
 */
const DAY = 1440
type Lang = 'id' | 'en'

const NUM: Record<string, number> = {
  satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10, sebelas: 11, 'dua belas': 12,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
}
const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, mei: 4, may: 4, jun: 5, jul: 6, agu: 7, aug: 7, sep: 8, okt: 9, oct: 9, nov: 10, des: 11, dec: 11 }
/** weekday words (Sunday = 0); "minggu" alone is Sunday only after "minggu ini / depan" were ruled out */
const WEEKDAYS: [RegExp, number][] = [
  [/\b(senin|monday)\b/, 1],
  [/\b(selasa|tuesday)\b/, 2],
  [/\b(rabu|wednesday)\b/, 3],
  [/\b(kamis|thursday)\b/, 4],
  [/\b(jumat|jum'at|friday)\b/, 5],
  [/\b(sabtu|saturday)\b/, 6],
  [/\b(minggu|ahad|sunday)\b/, 0],
]
const WD_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const WD_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const dayMs = (day: string) => {
  const t = Date.parse(`${day}T00:00:00Z`)
  return Number.isFinite(t) ? t : Date.UTC(2026, 10, 17)
}
/** weekday (0 = Sunday) of world day index `d` */
const weekdayOf = (day: string, d: number) => new Date(dayMs(day) + d * 86_400_000).getUTCDay()

/** "pukul 10", "jam sepuluh", "at ten", "16.00", "10:30" → minutes in the day (null when no time is named) */
export function timeOf(text: string): number | null {
  const t = text.toLowerCase()
  const said = /\b(?:pukul|jam|at)\s+(\d{1,2}|dua belas|[a-z]+)(?:[.:](\d{2}))?/.exec(t)
  if (said) {
    const raw = said[1] ?? ''
    const h = /^\d+$/.test(raw) ? Number(raw) : NUM[raw]
    if (h !== undefined && h >= 0 && h < 24) return h * 60 + Number(said[2] ?? 0)
  }
  const bare = /\b(\d{1,2})[.:](\d{2})\b/.exec(t)
  if (bare) {
    const h = Number(bare[1])
    if (h < 24) return h * 60 + Number(bare[2])
  }
  return null
}

/** deadline wording → world minutes (default: in 3 days, 12.00). `now` = the world clock (minutes) */
export function parseDue(text: string | undefined, now: number, day: string): number {
  const t = (text ?? '').toLowerCase()
  const time = timeOf(t)
  const today = Math.floor(now / DAY)
  const wd0 = weekdayOf(day, today)
  const at = (d: number, def: number) => d * DAY + (time ?? def)
  /* a written date: "19 Nov" / "19 November" */
  const dm = /\b(\d{1,2})\s+(jan|feb|mar|apr|mei|may|jun|jul|agu|aug|sep|okt|oct|nov|des|dec)[a-z]*\b/.exec(t)
  if (dm) {
    const base = new Date(dayMs(day))
    const target = Date.UTC(base.getUTCFullYear(), MONTHS[dm[2] ?? 'jan'] ?? 0, Number(dm[1]))
    const d = Math.round((target - dayMs(day)) / 86_400_000)
    return at(d, 16 * 60)
  }
  if (/\b(besok|tomorrow|sesuk)\b/.test(t)) return at(today + 1, 12 * 60)
  if (/\blusa\b|day after tomorrow|\b(two|dua) (days|hari)\b/.test(t)) return at(today + 2, 12 * 60)
  if (/(minggu|pekan) ini|this week|akhir (pekan|minggu)|end of (the )?week/.test(t)) return at(today + ((5 - wd0 + 7) % 7), 16 * 60)
  if (/(minggu|pekan) depan|next week/.test(t)) return at(today + ((1 - wd0 + 7) % 7 || 7), 12 * 60)
  for (const [re, wd] of WEEKDAYS) if (re.test(t)) return at(today + ((wd - wd0 + 7) % 7 || 7), 16 * 60)
  if (/hari ini|today|dina iki|siang ini|sore ini|malam ini|this afternoon|tonight/.test(t)) return Math.max(now + 30, at(today, 16 * 60))
  const n = /\b(\d+|satu|dua|tiga|empat|lima|enam|tujuh|one|two|three|four|five|six|seven)\s*(hari|days?)\b/.exec(t)
  if (n) {
    const k = /^\d+$/.test(n[1] ?? '') ? Number(n[1]) : (NUM[n[1] ?? ''] ?? 3)
    return at(today + k, 12 * 60)
  }
  if (time !== null) return Math.max(now + 30, at(today, time))
  return at(today + 3, 12 * 60)
}

/** world minutes → "Hari ini 16.00" / "Besok 12.00" / "Kam, 19 Nov 16.00" (parseDue reads every form back) */
export function dueLabel(at: number, lang: Lang, day: string): string {
  const d = Math.floor(at / DAY)
  const m = ((at % DAY) + DAY) % DAY
  const hh = `${String(Math.floor(m / 60)).padStart(2, '0')}${lang === 'id' ? '.' : ':'}${String(m % 60).padStart(2, '0')}`
  if (d === 0) return `${lang === 'id' ? 'Hari ini' : 'Today'} ${hh}`
  if (d === 1) return `${lang === 'id' ? 'Besok' : 'Tomorrow'} ${hh}`
  const date = new Date(dayMs(day) + d * 86_400_000)
  const wd = (lang === 'id' ? WD_ID : WD_EN)[date.getUTCDay()]
  const dm = date.toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  return `${wd}, ${dm} ${hh}`
}

/** an ISO date ("2026-11-18") → "18 Nov 2026" / "Rab, 18 Nov" style text for prose (AI answers) */
export function isoDateText(iso: string, lang: Lang): string {
  const t = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`)
  if (!Number.isFinite(t)) return iso
  const date = new Date(t)
  const wd = (lang === 'id' ? WD_ID : WD_EN)[date.getUTCDay()]
  return `${wd}, ${date.toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}`
}
