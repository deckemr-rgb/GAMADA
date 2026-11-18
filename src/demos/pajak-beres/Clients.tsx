/**
 * Clients.tsx (lazy) — the consultant's client switcher: the shop (open) and three other businesses of the world as
 * read-only cards with status chips (tax tidy, KYB, monthly turnover, simulated). Only the shop's books are open
 * in this demo; the other cards say so.
 */
import { Icon } from '../../demo-kit/ui'
import { rows, useWorld, type Business, type WorldState } from '../../demo-kit/world'
import { kecName } from '../../demo-kit/world/usaha-pintar'
import { rpShort } from './model'
import { useT } from './strings'

const S = {
  id: {
    open: 'Klien aktif · buku dibuka',
    readOnly: 'Ringkasan saja (baca saja di demo ini)',
    tidy: 'Pajak rapi',
    untidy: 'Pajak belum rapi',
    kyb: 'KYB terverifikasi',
    noKyb: 'Belum KYB',
    omzet: (v: string) => `Omzet ≈ ${v}/bulan (simulasi)`,
    lead: 'Klien Anda (simulasi). Data fiktif.',
  },
  en: {
    open: 'Active client · books open',
    readOnly: 'Summary only (read-only in this demo)',
    tidy: 'Taxes tidy',
    untidy: 'Taxes not tidy',
    kyb: 'KYB verified',
    noKyb: 'No KYB yet',
    omzet: (v: string) => `Turnover ≈ ${v}/month (simulated)`,
    lead: 'Your clients (simulated). Fictional data.',
  },
}

const clientsSel = (s: WorldState): Business[] => {
  const shop = s.businesses.byId[s.meta.shopId]
  const others = rows(s.businesses).filter((b) => b.id !== s.meta.shopId && b.monthlyRevenue > 0).sort((a, b) => b.monthlyRevenue - a.monthlyRevenue || a.id.localeCompare(b.id)).slice(0, 3)
  return shop ? [shop, ...others] : others
}
const same = (a: Business[], b: Business[]) => a.length === b.length && a.every((x, i) => x === b[i])

export default function Clients() {
  const { lang } = useT()
  const L = S[lang]
  const list = useWorld(clientsSel, same)
  const shop = useWorld((s) => s.meta.shopId)
  const kecs = useWorld((s) => list.map((b) => kecName(s, b.kecamatanId)).join('|')).split('|')
  return (
    <div className="dk-pb-clients">
      <p className="dk-pb-muted">{L.lead}</p>
      <ul>
        {list.map((b, i) => (
          <li key={b.id} className={`dk-pb-client${b.id === shop ? ' is-open' : ''}`} aria-current={b.id === shop ? 'true' : undefined}>
            <p className="dk-pb-client-n">
              <Icon name="building" size={16} /> <strong>{b.name}</strong>
            </p>
            <p className="dk-pb-muted">
              {kecs[i]} · {L.omzet(rpShort(b.monthlyRevenue, lang))}
            </p>
            <p className="dk-pb-client-chips">
              <span className={`dk-pb-st is-${b.taxTidy ? 'done' : 'warn'}`}>{b.taxTidy ? L.tidy : L.untidy}</span>
              <span className={`dk-pb-st is-${b.verified ? 'done' : 'neutral'}`}>{b.verified ? L.kyb : L.noKyb}</span>
            </p>
            <p className="dk-pb-client-foot">{b.id === shop ? L.open : L.readOnly}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
