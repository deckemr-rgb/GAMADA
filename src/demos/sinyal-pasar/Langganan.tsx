/**
 * Langganan (Disperindag, lazy): the UMKM subscriber count (`pdKpi().subscribers`, a fictional count, no names) and the
 * alert rule per commodity (early warning when the forecast peak passes the subscriber's threshold; warnings today).
 * "Lihat sisi UMKM" switches the role (the UMKM side subscribes itself; Disperindag never registers named businesses).
 */
import { useMemo } from 'react'
import { Button } from '../../demo-kit/ui'
import { DAY_MIN, rows, setSession, useClock, useSession, useWorld } from '../../demo-kit/world'
import { preloadWorld } from '../../demo-kit/world/ready'
import { pdKpi } from '../../demo-kit/world/pasar-daerah'
import type { Lang } from './strings'

const S = {
  id: {
    title: 'Langganan peringatan UMKM',
    lead: 'UMKM berlangganan sendiri dari sisi Pemilik Toko. Disperindag hanya melihat jumlahnya, tanpa nama usaha.',
    count: 'Pelanggan UMKM (simulasi)',
    rules: 'Aturan peringatan per komoditas',
    cols: ['Komoditas', 'Kelompok', 'Peringatan hari ini'],
    normal: 'pantauan rutin',
    rule: (d: number) => `Peringatan dini ${d} hari sebelum puncak bila puncak ≥ ambang pelanggan (5, 10, atau 15%)`,
    shock: 'dipantau sebagai komoditas rawan banjir',
    advice: 'Isi imbauan: belanja secukupnya untuk 5–7 hari, tanpa menimbun.',
    umkm: 'Lihat sisi UMKM (Pemilik Toko)',
  },
  en: {
    title: 'UMKM alert subscriptions',
    lead: 'Businesses subscribe themselves on the Shop owner side. The Trade Office only sees the count, never a business name.',
    count: 'UMKM subscribers (simulated)',
    rules: 'Alert rule per commodity',
    cols: ['Commodity', 'Group', 'Warnings today'],
    normal: 'routine watch',
    rule: (d: number) => `Early warning ${d} days before the peak when the peak ≥ the subscriber's threshold (5, 10 or 15%)`,
    shock: 'watched as flood-sensitive',
    advice: 'Advice text: buy for 5–7 days only, no hoarding.',
    umkm: 'View the UMKM side (Shop owner)',
  },
}

export default function Langganan() {
  const { lang } = useSession()
  const t = S[lang as Lang]
  const now = useClock().minutes
  const kpi = useWorld((s) => pdKpi(s, now))
  const region = useWorld((s) => s.region)
  const warnT = useWorld((s) => s.priceWarnings)
  const shockIds = useWorld((s) => s.meta.facts.pd?.shockCommodityIds.join(',') ?? '')
  const day0 = Math.floor(now / DAY_MIN) * DAY_MIN
  const perC = useMemo(() => {
    const m = new Map<string, number>()
    for (const w of rows(warnT)) if (w.at >= day0 && w.at <= now) m.set(w.commodityId, (m.get(w.commodityId) ?? 0) + 1)
    return m
  }, [warnT, day0, now])
  const intent = () => {
    preloadWorld('usaha-pintar/data')
    void import('./Umkm')
  }
  return (
    <div className="dk-sp-subs">
      <header className="dk-sp-boardbar">
        <div>
          <h2>{t.title}</h2>
          <p className="dk-sp-muted">{t.lead}</p>
        </div>
        <Button variant="secondary" icon="user" onPointerEnter={intent} onFocus={intent} onTouchStart={intent} onClick={() => setSession({ role: 'pemilik-toko' })} data-sp="to-umkm">
          {t.umkm}
        </Button>
      </header>
      <div className="dk-sp-subcount">
        <span className="dk-sp-muted">{t.count}</span>
        <strong className="dk-num" data-sp="subscribers">{kpi.subscribers.toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB')}</strong>
      </div>
      <h3>{t.rules}</h3>
      <p className="dk-sp-muted">{t.rule(5)}</p>
      <div className="dk-sp-rules" role="table" aria-label={t.rules}>
        <div role="row" className="dk-sp-rule is-head">
          {t.cols.map((c) => (
            <span role="columnheader" key={c}>{c}</span>
          ))}
        </div>
        {region.commodities.map((c) => (
          <div role="row" className="dk-sp-rule" key={c.id}>
            <span role="cell">
              <strong>{c.name[lang as Lang]}</strong>
            </span>
            <span role="cell" className="dk-sp-muted">{shockIds.split(',').includes(c.id) ? t.shock : t.normal}</span>
            <span role="cell" className="dk-num">{perC.get(c.id) ?? 0}</span>
          </div>
        ))}
      </div>
      <p className="dk-sp-muted">{t.advice}</p>
    </div>
  )
}
