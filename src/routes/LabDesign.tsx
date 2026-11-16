/**
 * /lab/_design — TEMPORARY tahap-0 page: three candidate visual directions for the "application
 * layer" of the ecosystem demos, shown side by side with the same sample content
 * (src/lab-design/sample.ts). ?dir=editorial|senja|tenang selects one (shareable, used by the
 * screenshot tool). Each direction is its own lazy chunk. Removed once a direction is chosen.
 */
import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react'
import { useSearchParams } from 'react-router'
import { useI18n } from '../lib/i18n'
import { DIRECTIONS, type DirectionId } from '../lab-design/sample'
import '../lab-design/lab-design.css'

const VIEWS: Record<DirectionId, LazyExoticComponent<ComponentType>> = {
  editorial: lazy(() => import('../lab-design/editorial')),
  senja: lazy(() => import('../lab-design/senja')),
  tenang: lazy(() => import('../lab-design/tenang')),
}

const COPY = {
  id: {
    eyebrow: 'Tahap 0 · halaman sementara',
    title: 'Tiga arah visual lapis aplikasi',
    lead: 'Konten contoh yang sama (KPI, tabel, chat, peta, dokumen) dirender dengan tiga arah. Pilih satu; sisanya dibuang.',
    tabs: 'Pilih arah visual',
    note: 'Semua data di halaman ini fiktif (contoh).',
  },
  en: {
    eyebrow: 'Stage 0 · temporary page',
    title: 'Three visual directions for the app layer',
    lead: 'The same sample content (KPIs, table, chat, map, document) rendered in three directions. Pick one; the others are dropped.',
    tabs: 'Choose a visual direction',
    note: 'All data on this page is fictional (sample).',
  },
}

export default function LabDesign() {
  const { lang } = useI18n()
  const c = COPY[lang]
  const [params, setParams] = useSearchParams()
  const raw = params.get('dir')
  const dir: DirectionId = DIRECTIONS.some((d) => d.id === raw) ? (raw as DirectionId) : 'editorial'
  const View = VIEWS[dir]
  const meta = DIRECTIONS.find((d) => d.id === dir)!

  return (
    <>
      <title>{`${c.title} — GAMADA`}</title>
      <meta name="robots" content="noindex" />
      <div className="labd">
        <header className="labd-head">
          <p className="labd-eyebrow">{c.eyebrow}</p>
          <h1 className="labd-title">{c.title}</h1>
          <p className="labd-lead">{c.lead}</p>
          <div className="labd-tabs" role="tablist" aria-label={c.tabs}>
            {DIRECTIONS.map((d) => (
              <button
                key={d.id}
                type="button"
                role="tab"
                id={`labd-tab-${d.id}`}
                aria-selected={d.id === dir}
                aria-controls="labd-panel"
                className="labd-tab"
                onClick={() => {
                  const next = new URLSearchParams(params)
                  next.set('dir', d.id)
                  setParams(next, { replace: true, preventScrollReset: true })
                }}
              >
                <span className="labd-tab-code">{d.code}</span>
                {d.name[lang]}
              </button>
            ))}
          </div>
          <p className="labd-brief">{meta.brief[lang]}</p>
        </header>
        <section id="labd-panel" role="tabpanel" aria-labelledby={`labd-tab-${dir}`} className="labd-panel" data-dir={dir}>
          <Suspense fallback={<div className="labd-loading" aria-hidden="true" />}>
            <View key={`${dir}-${lang}`} />
          </Suspense>
        </section>
        <p className="labd-note">{c.note}</p>
      </div>
    </>
  )
}
