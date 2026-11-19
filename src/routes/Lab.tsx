/**
 * /lab — replaces /tools: grid of the 17 product demos + GAMADA Inti + the earlier portfolio tools (PhoneFarm
 * panel, ScrapPulse → Radar Isu), with working filters by ecosystem, status (spec §13: "Bisa dicoba" / "Sedang
 * dibangun", from DEMO_READY in demos/registry.ts) and try-time (2 / 5 / 10 minutes). Filters start from ?eco= /
 * ?status= / ?menit= and are written back to the URL (replaceState, no navigation) so a filtered view can be shared.
 * Honesty: a demo that is not built yet shows its try-time as an estimate ("Perkiraan") and its CTA reads
 * "Lihat rencana demo" (it opens the tahap-1 plan panel), never "Buka demo".
 * Tahap 6 (plan §2.4): cards in the home Card style with an art box; on hover / focus (fine pointer only) a
 * ECO_SITE.mini.previewDelayMs-delayed preview mounts the product's mini (MINIS via useMini) and plays it; on leave it
 * pauses and stays mounted, at most ECO_SITE.mini.maxMounted at once (LRU). Touch: static icon art.
 */
import { useEffect, useRef, useState } from 'react'
import { useEcoI18n } from '../content/i18n/useEco'
import { ECOSYSTEMS, PRODUCTS, fullName, type EcoOrInti, type ProductSlug } from '../content/products'
import { useEcoPages } from '../content/ecoPages'
import { ECO_SITE } from '../lib/motion'
import LabArt from './eco/LabArt'
import { useMedia } from './eco/parts'
import { SITE_DEMO_READY as DEMO_READY, SITE_DEMO_STAGE as DEMO_STAGE } from './eco/ready'
import PageShell from '../components/PageShell'
import AppLink from '../components/AppLink'
import Card from '../components/ui/Card'
import { Icon } from '../demo-kit/ui/icons'
import { ECO_ORDER, EcoBadge, fill } from './EcoParts'
import Arrow from '../components/ui/Arrow'

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
type StatusFilter = 'all' | 'siap' | 'dibangun'

const TIMES: readonly TryMin[] = [2, 5, 10]
const ECO_FILTERS: readonly EcoFilter[] = ['all', ...ECO_ORDER, 'portfolio']
const STATUS_FILTERS: readonly StatusFilter[] = ['all', 'siap', 'dibangun']

interface Filters {
  eco: EcoFilter
  status: StatusFilter
  time: TimeFilter
}
const NO_FILTERS: Filters = { eco: 'all', status: 'all', time: 'all' }

interface LabItem {
  key: string
  /** product with a mini-demo (null for the portfolio tools) */
  slug: ProductSlug | null
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

function readInitial(): Filters {
  if (typeof window === 'undefined') return NO_FILTERS
  const q = new URLSearchParams(window.location.search)
  const e = q.get('eco')
  const st = q.get('status')
  const m = Number(q.get('menit'))
  return {
    eco: ECO_FILTERS.includes(e as EcoFilter) ? (e as EcoFilter) : 'all',
    status: STATUS_FILTERS.includes(st as StatusFilter) ? (st as StatusFilter) : 'all',
    time: TIMES.includes(m as TryMin) ? (m as TryMin) : 'all',
  }
}

function writeUrl({ eco, status, time }: Filters) {
  try {
    const url = new URL(window.location.href)
    if (eco === 'all') url.searchParams.delete('eco')
    else url.searchParams.set('eco', eco)
    if (status === 'all') url.searchParams.delete('status')
    else url.searchParams.set('status', status)
    if (time === 'all') url.searchParams.delete('menit')
    else url.searchParams.set('menit', String(time))
    // replaceState keeps react-router's history state (no route change, focus stays on the filter)
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
  } catch {
    /* ignore */
  }
}

export default function Lab() {
  const { lang, eco: copy } = useEcoI18n()
  const P = useEcoPages(lang)
  const s = copy.lab
  const c = copy.common
  const [filters, setFilters] = useState(readInitial)
  const { eco, status, time } = filters

  const set = (next: Partial<Filters>) => {
    const v = { ...filters, ...next }
    setFilters(v)
    writeUrl(v)
  }

  const items: LabItem[] = [
    ...ECO_ORDER.flatMap((g) =>
      PRODUCTS.filter((p) => p.eco === g).map<LabItem>((p) => ({
        key: p.slug,
        slug: p.slug,
        group: g,
        minutes: TRY_MINUTES[p.slug],
        icon: p.icon,
        name: p.name,
        desc: p.descriptor[lang],
        tagline: p.tagline[lang],
        to: `/demo/${p.slug}`,
        cta: DEMO_READY[p.slug] ? c.openDemo : c.demoPlan,
        stage: DEMO_READY[p.slug] ? null : DEMO_STAGE[p.eco],
        more: { to: `/produk/${p.slug}`, label: `${c.productPage}: ${fullName(p, lang)}` },
      })),
    ),
    {
      key: 'phonefarm',
      slug: null,
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
      slug: null,
      group: 'portfolio',
      minutes: TRY_MINUTES.scrappulse,
      icon: 'pulse',
      name: s.tools.scrappulse.name,
      desc: fill(copy.karya.mergedInto, { name: 'Radar Isu' }),
      tagline: s.tools.scrappulse.desc,
      to: '/demo/radar-isu?tab=analisis',
      cta: DEMO_READY['radar-isu'] ? s.tools.scrappulse.cta : c.demoPlan,
      stage: DEMO_READY['radar-isu'] ? null : DEMO_STAGE['satu-daerah'],
      more: { to: '/produk/radar-isu#analisis', label: `${c.productPage}: Radar Isu` },
    },
  ]

  const shown = items.filter(
    (it) =>
      (eco === 'all' || it.group === eco) &&
      (status === 'all' || (status === 'siap') === (it.stage === null)) &&
      (time === 'all' || it.minutes === time),
  )
  const demoCount = PRODUCTS.filter((p) => p.slug !== 'inti' && DEMO_READY[p.slug]).length
  const preview = usePreview()

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
            label={s.filterStatus}
            options={STATUS_FILTERS.map((f) => ({ value: f, label: f === 'all' ? s.all : f === 'siap' ? s.statusLive : s.statusBuildingShort }))}
            value={status}
            onChange={(v) => set({ status: v })}
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
        {preview.enabled && P ? <p className="es-lab-hint">{P.lab.previewHint}</p> : null}
        </div>

        {shown.length > 0 ? (
          <ul className="eco-grid eco-lab-grid">
            {shown.map((it) => (
              <Card key={it.key} as="li" className="eco-lab-card es-lab-card">
                <div className="eco-lab-in" data-eco={it.group === 'portfolio' ? undefined : it.group} {...preview.bind(it.slug)}>
                  <LabArt
                    slug={it.slug}
                    icon={it.icon}
                    eco={it.group === 'portfolio' ? undefined : it.group}
                    mounted={!!it.slug && preview.mounted.includes(it.slug)}
                    playing={!!it.slug && preview.hovered === it.slug}
                    label={P?.lab.preview ?? ''}
                  />
                  <div className="eco-pcard-top">
                    <span className="eco-pcard-icon">
                      <Icon name={it.icon} size={22} />
                    </span>
                    {it.stage === null ? (
                      <span className="eco-lab-time">
                        <Icon name="clock" size={14} />
                        {fill(s.tryTime, { n: it.minutes })}
                      </span>
                    ) : (
                      <span className="eco-lab-time is-estimate" title={fill(s.tryTimeEstimateLabel, { n: it.minutes })}>
                        <Icon name="clock" size={14} />
                        <span aria-hidden="true">{fill(s.tryTimeEstimate, { n: it.minutes })}</span>
                        <span className="sr-only">{fill(s.tryTimeEstimateLabel, { n: it.minutes })}</span>
                      </span>
                    )}
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
                      <Arrow />
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
            <button type="button" className="btn btn--ghost" onClick={() => set(NO_FILTERS)}>
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

/**
 * Hover / focus preview state: `hovered` = the card playing now, `mounted` = minis kept mounted (LRU, newest last,
 * at most ECO_SITE.mini.maxMounted). Only for a fine pointer that can hover (desktop); touch keeps static art.
 */
function usePreview() {
  const enabled = useMedia('(hover: hover) and (pointer: fine)')
  const [hovered, setHovered] = useState<ProductSlug | null>(null)
  const [mounted, setMounted] = useState<ProductSlug[]>([])
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const start = (slug: ProductSlug) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      setHovered(slug)
      setMounted((m) => [...m.filter((x) => x !== slug), slug].slice(-ECO_SITE.mini.maxMounted))
    }, ECO_SITE.mini.previewDelayMs)
  }
  const stop = (slug: ProductSlug) => {
    window.clearTimeout(timer.current)
    setHovered((h) => (h === slug ? null : h))
  }
  const bind = (slug: ProductSlug | null) =>
    !enabled || !slug
      ? {}
      : {
          onPointerEnter: (e: React.PointerEvent) => e.pointerType === 'mouse' && start(slug),
          onPointerLeave: (e: React.PointerEvent) => {
            const el = e.currentTarget as HTMLElement
            if (!el.contains(document.activeElement)) stop(slug)
          },
          onFocus: () => start(slug),
          onBlur: (e: React.FocusEvent) => {
            if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) stop(slug)
          },
        }
  return { enabled, hovered, mounted, bind }
}
