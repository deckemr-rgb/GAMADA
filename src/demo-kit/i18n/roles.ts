/**
 * demo-kit/i18n/roles — role initials per language. Its own tiny module (no dictionary), so site pages such as
 * /produk/:slug can use it without pulling the demo string tables.
 */
import type { Lang } from '../../lib/i18n'
import { ROLES, type RoleId } from '../../content/products'

/**
 * Two-letter initials of a role in the given language (avatars, role chips). Indonesian keeps the registry's
 * `ROLES[r].initials` ("PL" Petugas Layanan); English derives them from the English name so the chip and its label
 * agree ("SO" Service Officer, "RH" Regional Head): the first letters of the first two capitalised words, or for
 * a one-word name its first letter + the next consonant ("CT" Citizen). Names that are the same in both languages
 * (Vendor, Brand Manager) keep the registry initials.
 */
export function roleInitials(role: RoleId, lang: Lang): string {
  const r = ROLES[role]
  if (lang === 'id' || r.name.en === r.name.id) return r.initials
  const words = r.name.en.split(/[\s/&(),]+/).filter((w) => /^[A-Z]/.test(w))
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase()
  const w = words[0] ?? r.name.en
  const next = w.slice(1).match(/[bcdfghjklmnpqrstvwxyz]/i)?.[0] ?? w[1] ?? ''
  return (w[0]! + next).toUpperCase()
}
