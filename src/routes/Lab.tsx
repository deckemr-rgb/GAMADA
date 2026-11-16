/**
 * /lab — replaces /tools: grid of the 17 product demos + GAMADA Inti + the earlier portfolio tools (PhoneFarm
 * panel, ScrapPulse → Radar Isu), with working filters by ecosystem and by try-time (2 / 5 / 10 minutes).
 * Filters start from ?eco= / ?menit= and are written back to the URL (replaceState, no navigation) so a filtered
 * view can be shared. Mini-demo previews on hover arrive with the mini demos (tahap 2–4 / 6).
 */
import { useState } from 'react'
import { useI18n } from '../lib/i18n'
import { ECOSYSTEMS, PRODUCTS, ECOSYSTEM_STATS, fullName, type EcoOrInti, type ProductSlug } from '../content/products'
import { DEMO_READY, DEMO_STAGE } from '../demos/registry'
import PageShell from '../components/PageShell'
import AppLink from '../components/AppLink'
import Card from '../components/ui/Card'
import { Icon } from '../demo-kit/ui/icons'
import { ECO_ORDER, EcoBadge, fill } from './EcoParts'

/** Typical time a visitor needs to see the product's "wow" moment in its sandbox (minutes). */
const TRY_MINUTES: Record<ProductSlug | 'phonefarm' | 'scrappulse', TryMin> = {
  inti: 10,
  'sapa-warga': 5,
  'meja-pimpinan': 5,
  'naskah-pintar': 5,
  'radar-isu': 5,
  'siaga-wilayah': 10,
  'awas-belanja': 10,
  'cek-berkas': 2,
  'toko-autopilot': 10,
  'pajak-beres': 5,
  'juara-jualan': 5,
  'kenal-mitra': 2,
  'pantau-merek': 2,
  tenderpilot: 5,
  'katalog-lokal': 5,
  'rapor-usaha': 2,
  'indeks-ekonomi': 5,
  'sinyal-pasar': 2,
  phonefarm: 2,
  scrappulse: 5,
}

type TryMin = 2 | 5 | 10
type EcoFilter = 'all' | EcoOrInti | 'portfolio'
type TimeFilter = 'all' | TryMin

const TIMES: readonly TryMin[] = [2, 5, 10]
const ECO_FILTERS: readonly EcoFilter[] = ['all', ...ECO_ORDER, 'portfolio']

interface LabItem {
  key: string
  group: EcoOrInti | 'portfolio'
  minutes: TryMin
  icon: string
  name: string
  desc: string
  tagline?: string
  to: string
  cta: string
  /** null = ready to try */
  stage: number | null
  more?: { to: string; label: string }
}

function readInitial(): { eco: EcoFilter; time: TimeFilter } {
  if (typeof window === 'undefined') return { eco: 'all', time: 'all' }
  const q = new URLSearchParams(window.location.search)
  const e = q.get('eco')
  const m = Number(q.get('menit'))
  return {
    eco: ECO_FILTERS.includes(e as EcoFilter) ? (e as EcoFilter) : 'all',
    time: TIMES.includes(m as TryMin) ? (m as TryMin) : 'all',
  }
}

function writeUrl(eco: EcoFilter, time: TimeFilter) {
  try {
    const url = new URL(window.location.href)
    if (eco === 'all') url.searchParams.delete('eco')
    else url.searchParams.set('eco', eco)
    if (time === 'all') url.searchParams.delete('menit')
    else url.searchParams.set('menit', String(time))
    // replaceState keeps react-router's history state (no route change, focus stays on the filter)
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
  } catch {
    /* ignore */
  }
}

export default function Lab() {
  const { lang, t } = useI18n()
  const s = t.eco.lab
  const c = t.eco.common
  const [{ eco, time }, setFilters] = useState(readInitial)

  const set = (next: { eco?: EcoFilter; time?: TimeFilter }) => {
    const v = { eco: next.eco ?? eco, time: next.time ?? time }
    setFilters(v)
    writeUrl(v.eco, v.time)
  }

  const items: LabItem[] = [
    ...ECO_ORDER.flatMap((g) =>
      PRODUCTS.filter((p) => p.eco === g).map<LabItem>((p) => ({
        key: p.slug,
        group: g,
        minutes: TRY_MINUTES[p.slug],
        icon: p.icon,
        name: p.name,
        desc: p.descriptor[lang],
        tagline: p.tagline[lang],
        to: `/demo/${p.slug}`,
        cta: c.openDemo,
        stage: DEMO_READY[p.slug] ? null : DEMO_STAGE[p.eco],
        more: { to: `/produk/${p.slug}`, label: `${c.productPage}: ${fullName(p, lang)}` },
      })),
    ),
    {
      key: 'phonefarm',
      group: 'portfolio',
      minutes: TRY_MINUTES.phonefarm,
      icon: 'phone',
      name: s.tools.phonefarm.name,
      desc: s.portfolioTag,
      tagline: s.tools.phonefarm.desc,
      to: '/panel/phonefarm',
      cta: s.tools.phonefarm.cta,
      stage: null,
    },
    {
      key: 'scrappulse',
      group: 'portfolio',
      minutes: TRY_MINUTES.scrappulse,
      icon: 'pulse',
      name: s.tools.scrappulse.name,
      desc: fill(t.eco.karya.mergedInto, { name: 'Radar Isu' }),
      tagline: s.tools.scrappulse.desc,
      to: '/demo/radar-isu?tab=analisis',
      cta: s.tools.scrappulse.cta,
      stage: DEMO_READY['radar-isu'] ? null : DEMO_STAGE['satu-daerah'],
      more: { to: '/produk/radar-isu#analisis', label: `${c.productPage}: Radar Isu` },
    },
  ]

  const shown = items.filter((it) => (eco === 'all' || it.group === eco) && (time === 'all' || it.minutes === time))
  const demoCount = ECOSYSTEM_STATS.products

  return (
    <PageShell eyebrow={s.eyebrow} title={s.title} lead={fill(s.lead, { n: demoCount })} docTitle={s.docTitle}>
      <div className="eco-page">
        <div className="eco-stack">
        <div className="eco-filters" role="group" aria-label={s.filtersLabel}>
          <FilterGroup
            label={s.filterEco}
            options={ECO_FILTERS.map((f) => ({
              value: f,
              label: f === 'all' ? s.all : f === 'portfolio' ? s.portfolio : f === 'inti' ? ECOSYSTEMS.inti.name : ECOSYSTEMS[f].name.replace('GAMADA ', ''),
              eco: f === 'all' || f === 'portfolio' ? undefined : f,
            }))}
            value={eco}
            onChange={(v) => set({ eco: v })}
          />
          <FilterGroup
            label={s.filterTime}
            options={[{ value: 'all' as TimeFilter, label: s.all }, ...TIMES.map((m) => ({ value: m as TimeFilter, label: fill(s.minutes, { n: m }) }))]}
            value={time}
            onChange={(v) => set({ time: v })}
          />
        </div>

        <p className="eco-results" aria-live="polite">
          {fill(s.results, { n: shown.length })}
        </p>
        </div>

        {shown.length > 0 ? (
          <ul className="eco-grid eco-lab-grid">
            {shown.map((it) => (
              <Card key={it.key} as="li" className="eco-lab-card">
                <div className="eco-lab-in" data-eco={it.group === 'portfolio' ? undefined : it.group}>
                  <div className="eco-pcard-top">
                    <span className="eco-pcard-icon">
                      <Icon name={it.icon} size={22} />
                    </span>
                    <span className="eco-lab-time">
                      <Icon name="clock" size={14} />
                      {fill(s.tryTime, { n: it.minutes })}
                    </span>
                  </div>
                  <h2 className="eco-lab-name">{it.name}</h2>
                  <p className="eco-pcard-desc">{it.desc}</p>
                  {it.tagline ? <p className="eco-pcard-tag">{it.tagline}</p> : null}
                  <div className="eco-lab-meta">
                    {it.group === 'portfolio' ? <span className="eco-badge">{s.portfolio}</span> : <EcoBadge eco={it.group} />}
                    <span className={`eco-status${it.stage === null ? ' is-live' : ''}`}>{it.stage === null ? s.statusLive : fill(s.statusBuilding, { n: it.stage })}</span>
                  </div>
                  <div className="eco-lab-actions">
                    <AppLink to={it.to} className="eco-lab-cta" aria-label={`${it.cta}: ${it.name}`}>
                      {it.cta}
                      <span aria-hidden="true"> →</span>
                    </AppLink>
                    {it.more ? (
                      <AppLink to={it.more.to} className="eco-lab-more" aria-label={it.more.label}>
                        {c.productPage}
                      </AppLink>
                    ) : null}
                  </div>
                </div>
              </Card>
            ))}
          </ul>
        ) : (
          <div className="eco-empty">
            <p>{s.empty}</p>
            <button type="button" className="btn btn--ghost" onClick={() => set({ eco: 'all', time: 'all' })}>
              <span className="btn-label">{s.reset}</span>
            </button>
          </div>
        )}
      </div>
    </PageShell>
  )
}

function FilterGroup<V extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: V; label: string; eco?: EcoOrInti }[]
  value: V
  onChange: (v: V) => void
}) {
  return (
    <div className="eco-fgroup" role="group" aria-label={label}>
      <span className="eco-flabel" aria-hidden="true">
        {label}
      </span>
      <div className="eco-fopts">
        {options.map((o) => (
          <button key={String(o.value)} type="button" className="eco-fbtn" aria-pressed={value === o.value} onClick={() => onChange(o.value)} data-eco={o.eco}>
            {o.eco ? <span className="eco-badge-dot" aria-hidden="true" /> : null}
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
