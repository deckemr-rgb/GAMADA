/**
 * /lab/_kit — TEMPORARY tahap-1 showcase of the Demo Kit. Each module builder owns one section file in
 * src/demo-kit/_showcase/<module>.tsx. ?only=<module> renders one section (screenshots / tests);
 * ?static=1 asks sections to render final states. With ?only set, the module nav switches ?only (other params kept)
 * instead of jumping to #kit-<module>, which would not be rendered. Removed (or folded into /lab) after tahap 1.
 */
import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useI18n } from '../lib/i18n'
import '../demo-kit/_showcase/showcase.css'

const MODULES = ['ui', 'frames', 'viz', 'world', 'ai', 'region', 'map', 'docs', 'media', 'shell', 'up'] as const
type ModuleId = (typeof MODULES)[number]

const SECTIONS: Record<ModuleId, LazyExoticComponent<ComponentType>> = {
  ui: lazy(() => import('../demo-kit/_showcase/ui')),
  frames: lazy(() => import('../demo-kit/_showcase/frames')),
  viz: lazy(() => import('../demo-kit/_showcase/viz')),
  world: lazy(() => import('../demo-kit/_showcase/world')),
  ai: lazy(() => import('../demo-kit/_showcase/ai')),
  region: lazy(() => import('../demo-kit/_showcase/region')),
  map: lazy(() => import('../demo-kit/_showcase/map')),
  docs: lazy(() => import('../demo-kit/_showcase/docs')),
  media: lazy(() => import('../demo-kit/_showcase/media')),
  shell: lazy(() => import('../demo-kit/_showcase/shell')),
  up: lazy(() => import('../demo-kit/_showcase/up')),
}

const TITLES: Record<ModuleId, { id: string; en: string }> = {
  ui: { id: 'Komponen UI', en: 'UI components' },
  frames: { id: 'Bingkai perangkat', en: 'Device frames' },
  viz: { id: 'Visualisasi data', en: 'Data visualisation' },
  world: { id: 'Dunia simulasi & jam', en: 'Simulated world & clock' },
  ai: { id: 'Mesin AI hybrid', en: 'Hybrid AI engine' },
  region: { id: 'Region pack', en: 'Region pack' },
  map: { id: 'Peta', en: 'Map' },
  docs: { id: 'Penampil dokumen', en: 'Document viewer' },
  media: { id: 'Suara & media', en: 'Voice & media' },
  shell: { id: 'DemoShell', en: 'DemoShell' },
  up: { id: 'Usaha Pintar: chat, kalender, diff', en: 'Usaha Pintar: chat, calendar, diff' },
}

export default function LabKit() {
  const { lang } = useI18n()
  const [params] = useSearchParams()
  const only = params.get('only') as ModuleId | null
  const filtered = !!only && MODULES.includes(only)
  const list = filtered ? [only] : MODULES
  /** ?only=<m> (or no ?only for null), keeping ?static / ?lang … */
  const onlySearch = (m: ModuleId | null) => {
    const q = new URLSearchParams(params)
    if (m) q.set('only', m)
    else q.delete('only')
    const str = q.toString()
    return str ? `?${str}` : ''
  }
  return (
    <>
      <title>Demo Kit — GAMADA</title>
      <meta name="robots" content="noindex" />
      <div className="dk-sc">
        <header className="dk-sc-head">
          <p className="dk-sc-eyebrow">{lang === 'id' ? 'Tahap 1 · halaman sementara' : 'Stage 1 · temporary page'}</p>
          <h1 className="dk-sc-title">Demo Kit</h1>
          <nav aria-label={lang === 'id' ? 'Modul' : 'Modules'} className="dk-sc-nav">
            {filtered ? (
              <>
                <Link to={{ search: onlySearch(null) }}>{lang === 'id' ? 'Semua modul' : 'All modules'}</Link>
                {MODULES.map((m) => (
                  <Link key={m} to={{ search: onlySearch(m) }} aria-current={m === only ? 'page' : undefined}>
                    {TITLES[m][lang]}
                  </Link>
                ))}
              </>
            ) : (
              MODULES.map((m) => (
                <a key={m} href={`#kit-${m}`}>
                  {TITLES[m][lang]}
                </a>
              ))
            )}
          </nav>
        </header>
        {list.map((m) => (
          <section key={m} id={`kit-${m}`} className="dk-sc-section" aria-labelledby={`kit-${m}-h`}>
            <h2 id={`kit-${m}-h`} className="dk-sc-h2">{TITLES[m][lang]}</h2>
            <Suspense fallback={<div className="dk-sc-loading" aria-hidden="true" />}>
              {(() => {
                const S = SECTIONS[m]
                return <S key={lang} />
              })()}
            </Suspense>
          </section>
        ))}
      </div>
    </>
  )
}
