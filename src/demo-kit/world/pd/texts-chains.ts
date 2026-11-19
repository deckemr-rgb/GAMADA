/**
 * world/pd/texts-chains.ts — the C32 UMKM alert pools (chains module only). Every sentence carries entity fields.
 */
import type { Bi } from '../types'

/** C32 UMKM alert (WA style): {item} {pct} {days} {market} {shop} */
export const ALERT_TEXT: Bi[] = [
  { id: 'Halo {shop}, harga {item} di {market} diperkirakan naik {pct}% dalam {days} hari (simulasi).', en: 'Hello {shop}, {item} at {market} is expected to rise {pct}% within {days} days (simulated).' },
  { id: '{shop}: {item} di {market} bisa naik sampai {pct}% sekitar {days} hari lagi (simulasi).', en: '{shop}: {item} at {market} may rise up to {pct}% in about {days} days (simulated).' },
  { id: 'Info harga untuk {shop}: puncak {item} di {market} +{pct}% dalam {days} hari (simulasi).', en: 'Price notice for {shop}: {item} at {market} peaks +{pct}% within {days} days (simulated).' },
]
/** the advice under an alert (never hoarding): {item} */
export const ALERT_ADVICE: Bi[] = [
  { id: 'Siapkan stok {item} secukupnya untuk 5–7 hari, jangan menimbun.', en: 'Keep enough {item} for 5–7 days; do not hoard.' },
  { id: 'Belanja {item} untuk kebutuhan 5–7 hari saja; harga diperkirakan turun lagi setelah puncak.', en: 'Buy {item} for 5–7 days only; prices should ease after the peak.' },
  { id: 'Amankan {item} untuk 5–7 hari pemakaian dan pantau harga harian.', en: 'Secure {item} for 5–7 days of use and watch the daily price.' },
]

