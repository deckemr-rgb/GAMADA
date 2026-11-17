/**
 * siaga-wilayah/Agriculture.tsx — tab "Pertanian" (lazy): SIMULATED harvest estimate per kecamatan × crop as a map
 * choropleth (estimate / change vs normal / vegetation health index), the scenario switch Normal ↔ Pascabanjir
 * (emits harvest.updated ⇒ the world raises econ.updated for Indeks Ekonomi and supply signals for Sinyal Pasar) and
 * the follow-ups read back from the audit log (causeId = our event).
 */
import { useEffect, useMemo } from 'react'
import { useI18n } from '../../lib/i18n'
import { Chip, Icon, Segmented } from '../../demo-kit/ui'
import { useShell } from '../../demo-kit/shell'
import AppLink from '../../components/AppLink'
import { rows, shallowEqual, useSession, useWorld, world, type Harvest, type WorldState } from '../../demo-kit/world'
import { TIER_DROP, floodTiers, harvestPasca, productHref, setHarvestScenario } from './data'
import { fill, nf, type Bi } from './strings'
import { mapRef, revealMap, ui, useUi, type AgriMetric, type Crop } from './ui'
import './more.css'

const T = {
  title: { id: 'Estimasi panen per kecamatan', en: 'Harvest estimate by district' },
  sim: { id: 'Estimasi & indeks vegetasi adalah simulasi (seed dunia), bukan data resmi Dinas Pertanian/BPS.', en: 'Estimates & the vegetation index are simulated (world seed), not official agriculture/BPS data.' },
  scenario: { id: 'Skenario', en: 'Scenario' },
  normal: { id: 'Normal', en: 'Normal' },
  pasca: { id: 'Pascabanjir', en: 'Post-flood' },
  crop: { id: 'Komoditas', en: 'Crop' },
  all: { id: 'Semua', en: 'All' },
  padi: { id: 'Padi', en: 'Rice' },
  jagung: { id: 'Jagung', en: 'Maize' },
  cabai: { id: 'Cabai', en: 'Chilli' },
  'bawang-merah': { id: 'Bawang merah', en: 'Shallot' },
  metric: { id: 'Tampilan peta', en: 'Map shows' },
  estimate: { id: 'Ton', en: 'Tonnes' },
  change: { id: 'Penurunan', en: 'Drop' },
  ndvi: { id: 'Vegetasi', en: 'Vegetation' },
  total: { id: 'estimasi panen (ton)', en: 'harvest estimate (t)' },
  delta: { id: 'vs musim normal', en: 'vs a normal season' },
  loss: { id: 'potensi kerugian (simulasi)', en: 'potential loss (simulated)' },
  zone: { id: 'Terdampak berat (−{a} %): {k}', en: 'Hit hard (−{a} %): {k}' },
  zone2: { id: 'Terdampak sedang (−{a} %): {k}', en: 'Moderately hit (−{a} %): {k}' },
  zoneHint: { id: 'Berat = zona peringatan aktif atau ≥ 40 % desanya tergenang di model +6 jam; sedang = ≥ 5 desa tergenang. Cabai & bawang merah turun 1,2×.', en: 'Hard = an active warning zone or ≥ 40 % of its villages flooded in the +6 h model; moderate = ≥ 5 flooded villages. Chilli & shallot drop 1.2×.' },
  rows: { id: 'Kecamatan', en: 'District' },
  colEst: { id: 'Estimasi', en: 'Estimate' },
  colChg: { id: 'Perubahan', en: 'Change' },
  colNdvi: { id: 'Vegetasi', en: 'Vegetation' },
  chain: { id: 'Efek berantai', en: 'Chain effects' },
  chainNone: { id: 'Geser ke "Pascabanjir" untuk melihat dampak ke Indeks Ekonomi dan Sinyal Pasar.', en: 'Switch to "Post-flood" to see the effect on Indeks Ekonomi and Sinyal Pasar.' },
  open: { id: 'Buka {p}', en: 'Open {p}' },
} satisfies Record<string, Bi>

const CROPS: (Crop | 'all')[] = ['all', 'padi', 'jagung', 'cabai', 'bawang-merah']
/** Rp per kg (simulated) for crops without a market commodity */
const FALLBACK_PRICE = 5500

const harvestRows = (s: WorldState) => s.harvests
/** follow-ups of the latest post-flood switch (one harvest.updated per severity tier, same minute) */
const lastHarvestFollowUps = (s: WorldState) => {
  const log = rows(s.auditLog)
  const root = log.find((a) => a.type === 'harvest.updated' && a.source === 'siaga-wilayah')
  if (!root) return []
  const roots = new Set(log.filter((a) => a.type === 'harvest.updated' && a.source === 'siaga-wilayah' && a.at === root.at).map((a) => a.eventId))
  // causal order (hard-hit tier first), market signals before the district indices
  const out = log.filter((a) => !!a.causeId && roots.has(a.causeId) && (a.type === 'econ.updated' || a.type === 'supply.signal')).reverse()
  // one market signal per commodity (the hard-hit tier's, the larger one), then up to three district indices
  const seen = new Set<string>()
  const supply = out.filter((a) => {
    if (a.type !== 'supply.signal') return false
    const k = a.summary.en.replace(/-?\d.*$/, '')
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  return [...supply.slice(0, 3), ...out.filter((a) => a.type === 'econ.updated').slice(0, 3)]
}

export default function Agriculture() {
  const { lang } = useI18n()
  const L = (k: keyof typeof T, v?: Record<string, string | number>) => (v ? fill(T[k][lang], v) : T[k][lang])
  const session = useSession()
  const { pack } = useShell()
  const crop = useUi((s) => s.crop)
  const metric = useUi((s) => s.metric)
  const pasca = useWorld(harvestPasca)
  const alertsT = useWorld((s) => s.alerts)
  const sel = useUi((s) => s.selectedKec)
  const prices = useWorld((s) => s.region.commodities)
  const ht = useWorld(harvestRows)
  const follow = useWorld(lastHarvestFollowUps, shallowEqual)

  // the farmland layer belongs to this tab
  useEffect(() => ui.layer('harvest', true), [])

  // severity tiers from the active warnings + the +6 h model (the drop scales with how much of the kecamatan floods)
  const impact6 = useUi((s) => s.impact6)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tiers = useMemo(() => floodTiers(world.get(), impact6), [alertsT, impact6])
  const kecName = (id: string) => pack?.kecamatan.find((k) => k.id === id)?.name ?? id
  const names = (ids: string[]) => ids.slice(0, 4).map(kecName).join(', ') + (ids.length > 4 ? ` +${ids.length - 4}` : '')

  const setScenario = (v: 'normal' | 'pasca') => {
    setHarvestScenario(v, impact6)
    ui.set({ metric: 'change' })
  }
  // the bottom-bar CTA can switch to post-flood too: show the drop on the map either way
  useEffect(() => {
    if (pasca) ui.set({ metric: 'change' })
  }, [pasca])

  const list = useMemo(() => {
    const by = new Map<string, { base: number; now: number; ndvi: number; n: number; loss: number }>()
    for (const h of rows(ht)) {
      if (crop !== 'all' && h.crop !== crop) continue
      const a = by.get(h.kecamatanId) ?? { base: 0, now: 0, ndvi: 0, n: 0, loss: 0 }
      a.base += h.baselineTon
      a.now += h.estimateTon
      a.ndvi += h.ndvi
      a.n++
      a.loss += (h.baselineTon - h.estimateTon) * 1000 * priceOf(h, prices)
      by.set(h.kecamatanId, a)
    }
    return [...by.entries()]
      .map(([id, a]) => ({ id, base: a.base, now: a.now, chg: a.base ? ((a.now - a.base) / a.base) * 100 : 0, ndvi: a.ndvi / Math.max(1, a.n), loss: a.loss }))
      .sort((x, y) => x.chg - y.chg || y.now - x.now)
  }, [ht, crop, prices])
  const tot = list.reduce((a, r) => ({ base: a.base + r.base, now: a.now + r.now, loss: a.loss + r.loss }), { base: 0, now: 0, loss: 0 })
  const chg = tot.base ? ((tot.now - tot.base) / tot.base) * 100 : 0
  const rp = (n: number) => (n >= 1e9 ? `Rp ${nf(n / 1e9, lang, 1)} ${lang === 'id' ? 'M' : 'bn'}` : `Rp ${nf(n / 1e6, lang, 0)} ${lang === 'id' ? 'jt' : 'm'}`)

  return (
    <div className="dk-sg-tab">
      <section className="dk-sg-card" aria-labelledby="sw-ag-h">
        <h3 className="dk-sg-h" id="sw-ag-h">
          <Icon name="grid" size={16} />
          {L('title')}
        </h3>
        <div className="dk-sg-ctl">
          <span className="dk-sg-muted">{L('scenario')}</span>
          <Segmented
            label={L('scenario')}
            value={pasca ? 'pasca' : 'normal'}
            onChange={setScenario}
            options={[
              { value: 'normal', label: L('normal') },
              { value: 'pasca', label: L('pasca') },
            ]}
          />
        </div>
        <p className="dk-sg-fine">
          {tiers.heavy.length > 0 && <>{L('zone', { a: nf(TIER_DROP.heavy, lang), k: names(tiers.heavy) })}<br /></>}
          {tiers.moderate.length > 0 && <>{L('zone2', { a: nf(TIER_DROP.moderate, lang), k: names(tiers.moderate) })}<br /></>}
          {L('zoneHint')}
        </p>
        <div className="dk-sg-ctl">
          <span className="dk-sg-muted">{L('crop')}</span>
          <div className="dk-sg-chips" role="group" aria-label={L('crop')}>
            {CROPS.map((c) => (
              <Chip key={c} selected={crop === c} onToggle={() => ui.set({ crop: c })}>
                {L(c)}
              </Chip>
            ))}
          </div>
        </div>
        <div className="dk-sg-ctl">
          <span className="dk-sg-muted">{L('metric')}</span>
          <Segmented<AgriMetric>
            label={L('metric')}
            value={metric}
            onChange={(v) => {
              ui.set({ metric: v })
              ui.layer('harvest', true)
            }}
            size="sm"
            options={[
              { value: 'estimate', label: L('estimate') },
              { value: 'change', label: L('change') },
              { value: 'ndvi', label: L('ndvi') },
            ]}
          />
        </div>
      </section>

      <dl className="dk-sg-kpis dk-sg-card" aria-live="polite">
        <div>
          <dd className="dk-num">{nf(Math.round(tot.now), lang)}</dd>
          <dt>{L('total')}</dt>
        </div>
        <div>
          <dd className={`dk-num${chg < -0.5 ? ' is-neg' : ''}`}>
            {chg > 0 ? '+' : ''}
            {nf(chg, lang, 1)} %
          </dd>
          <dt>{L('delta')}</dt>
        </div>
        <div>
          <dd className="dk-num">{tot.loss > 0 ? rp(tot.loss) : '—'}</dd>
          <dt>{L('loss')}</dt>
        </div>
      </dl>

      <section className="dk-sg-card" aria-live="polite" aria-labelledby="sw-ag-chain">
        <h3 className="dk-sg-h" id="sw-ag-chain">
          <Icon name="share" size={16} />
          {L('chain')}
        </h3>
        {pasca && follow.length ? (
          <>
            <ul className="dk-sg-chain">
              {follow.slice(0, 6).map((a) => (
                <li key={a.id}>
                  <Icon name={a.type === 'econ.updated' ? 'chart' : 'cart'} size={14} />
                  <span>{a.summary[lang]}</span>
                </li>
              ))}
            </ul>
            <p className="dk-sg-links">
              <AppLink to={productHref('indeks-ekonomi', session)}>{L('open', { p: 'Indeks Ekonomi' })} →</AppLink>
              <AppLink to={productHref('sinyal-pasar', session)}>{L('open', { p: 'Sinyal Pasar' })} →</AppLink>
            </p>
          </>
        ) : (
          <p className="dk-sg-muted">{L('chainNone')}</p>
        )}
      </section>

      <section className="dk-sg-card" aria-labelledby="sw-ag-rows">
        <table className="dk-sg-table">
          <caption id="sw-ag-rows" className="dk-sg-h">
            {L('rows')} · {L(crop)}
          </caption>
          <thead>
            <tr>
              <th scope="col">{L('rows')}</th>
              <th scope="col">{L('colEst')}</th>
              <th scope="col">{L('colChg')}</th>
              <th scope="col">{L('colNdvi')}</th>
            </tr>
          </thead>
          <tbody>
            {list.slice(0, 12).map((r) => (
              <tr key={r.id} className={sel === r.id ? 'is-sel' : undefined}>
                <th scope="row">
                  <button type="button" aria-current={sel === r.id || undefined} onClick={() => {
                    revealMap()
                    ui.set({ selectedKec: r.id })
                    mapRef.current?.fitKecamatan(r.id)
                  }}>
                    {kecName(r.id)}
                  </button>
                </th>
                <td className="dk-num" data-label={L('colEst')}>
                  {nf(Math.round(r.now), lang)} t
                </td>
                <td className={`dk-num${r.chg < -0.5 ? ' is-neg' : ''}`} data-label={L('colChg')}>
                  {r.chg > 0 ? '+' : ''}
                  {nf(r.chg, lang, 1)} %
                </td>
                <td data-label={L('colNdvi')}>
                  <span className="dk-sg-bar" aria-label={nf(r.ndvi, lang, 2)}>
                    <span style={{ transform: `scaleX(${r.ndvi})` }} />
                  </span>
                  <span className="dk-num dk-sg-muted">{nf(r.ndvi, lang, 2)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="dk-sg-fine">{L('sim')}</p>
      </section>
    </div>
  )
}

function priceOf(h: Harvest, prices: WorldState['region']['commodities']): number {
  const p = prices.find((c) => c.id === h.commodityId)?.basePrice ?? FALLBACK_PRICE
  // rice: unhusked grain (gabah) → milled rice ≈ 0.6
  return h.crop === 'padi' ? p * 0.6 : p
}
