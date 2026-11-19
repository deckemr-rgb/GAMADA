/**
 * world/inti/inbox.ts — GAMADA Inti Kanal: one inbox over the citizens' complaints (voice ⇒ WA + mic), the citizen
 * messages, the shop's chats and calls and the Katalog Lokal orders. `chat.read` marks rows read (source product too).
 */
import type { EcoOrInti, ProductSlug } from '../../../content/products'
import type { Bi, EntityRef, WorldState } from '../types'
import { DAY_MIN, rows } from '../util'

export type InboxChannel = 'wa' | 'web' | 'telepon'
export type Scope = 'semua' | 'usaha'
export interface InboxRow { id: string; ref: EntityRef; channel: InboxChannel; voice: boolean; product: ProductSlug; eco: EcoOrInti; from: string; preview: Bi; at: number; unread: boolean; href: string }

const ECO: Partial<Record<ProductSlug, EcoOrInti>> = {
  'sapa-warga': 'satu-daerah', 'juara-jualan': 'usaha-pintar', 'toko-autopilot': 'usaha-pintar', 'pantau-merek': 'usaha-pintar', 'kenal-mitra': 'usaha-pintar', 'pajak-beres': 'usaha-pintar',
  tenderpilot: 'usaha-pintar', 'katalog-lokal': 'pasar-daerah',
}
const ecoOf = (p: ProductSlug): EcoOrInti => ECO[p] ?? 'satu-daerah'

export interface InboxFilter { channel?: InboxChannel | 'semua'; eco?: EcoOrInti; unreadOnly?: boolean; scope: Scope }
/** every conversation of today (and the open ones of earlier days), newest first */
export function unifiedInbox(s: WorldState, now: number, f: InboxFilter): InboxRow[] {
  const out: InboxRow[] = []
  const d0 = Math.floor(now / DAY_MIN) * DAY_MIN
  const usaha = f.scope === 'usaha'
  if (!usaha) {
    for (const c of rows(s.complaints)) {
      if (c.at < d0 || c.at > now) continue
      const cit = c.citizenId ? s.citizens.byId[c.citizenId] : undefined
      const ch: InboxChannel = c.channel === 'voice' ? 'wa' : c.channel
      out.push({ id: c.id, ref: `complaints:${c.id}`, channel: ch, voice: c.channel === 'voice', product: 'sapa-warga', eco: 'satu-daerah', from: cit?.name ?? c.code, preview: c.summary, at: c.at, unread: c.readAt == null, href: `/demo/sapa-warga?focus=${c.id}` })
    }
  }
  for (const c of rows(s.chats)) {
    if (c.at > now) continue
    out.push({ id: c.id, ref: `chats:${c.id}`, channel: c.channel, voice: false, product: c.product, eco: ecoOf(c.product), from: c.withName, preview: c.preview, at: c.at, unread: c.unread > 0, href: `/demo/${c.product}?focus=${c.refId ?? c.id}` })
  }
  for (const c of rows(s.calls)) {
    if (c.at < d0 || c.at > now || (usaha && c.industry !== 'toko-bangunan')) continue
    out.push({ id: c.id, ref: `calls:${c.id}`, channel: c.channel === 'wa' ? 'wa' : 'telepon', voice: c.channel === 'telepon', product: 'juara-jualan', eco: 'usaha-pintar', from: c.customer, preview: { id: `Panggilan ${Math.round(c.durationSec / 60)} menit`, en: `${Math.round(c.durationSec / 60)}-minute call` }, at: c.at, unread: c.readAt == null && c.score === null, href: `/demo/juara-jualan?focus=${c.id}` })
  }
  for (const o of rows(s.orders)) {
    if (o.at < d0 || o.at > now || (usaha && o.businessId !== s.meta.shopId)) continue
    const b = s.businesses.byId[o.businessId]
    out.push({ id: o.id, ref: `orders:${o.id}`, channel: 'web', voice: false, product: 'katalog-lokal', eco: 'pasar-daerah', from: b?.name ?? o.businessId, preview: { id: `Pesanan ${o.code}: ${o.status}`, en: `Order ${o.code}: ${o.status}` }, at: o.at, unread: false, href: `/demo/katalog-lokal?focus=${o.id}` })
  }
  return out
    .filter((r) => (!f.channel || f.channel === 'semua' || r.channel === f.channel) && (!f.eco || r.eco === f.eco) && (!f.unreadOnly || r.unread))
    .sort((a, b) => b.at - a.at || a.id.localeCompare(b.id))
}

/** Kanal KPI: total, unread (= Σ chats.unread > 0 rows + unread complaints + unscored calls), per channel, calls today */
export function inboxKpi(s: WorldState, now: number, scope: Scope): { total: number; unread: number; byChannel: Record<InboxChannel, number>; callsToday: number } {
  const all = unifiedInbox(s, now, { scope })
  const byChannel: Record<InboxChannel, number> = { wa: 0, web: 0, telepon: 0 }
  for (const r of all) byChannel[r.channel]++
  const d0 = Math.floor(now / DAY_MIN) * DAY_MIN
  return { total: all.length, unread: all.filter((r) => r.unread).length, byChannel, callsToday: rows(s.calls).filter((c) => c.at >= d0 && c.at <= now).length }
}
