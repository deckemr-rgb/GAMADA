/**
 * tour/TourPage.tsx — the /tur route body: opener ⇄ cold chapter poster (/tur/:bab) ⇄ player (lazy) ⇄ summary.
 * /tur/<n>?resume=1 (from "Kembali ke tur") restarts chapter n on the tour world as it was left, rate from
 * sessionStorage. The opener only needs the region pack (name + desa centroids); the world, the products and the
 * ecosystem modules load on "Mulai tur" / "Putar bab N".
 */
import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { isEnabled } from '../../lib/motion'
import { PRODUCT_BY_SLUG } from '../../content/products'
import { TOUR_CHAPTERS } from '../../content/tour'
import { DEFAULT_REGION_ID, isRegionId, loadRegion } from '../region/loader'
import { preloadDemo } from '../../demos/registry'
import { intentProps } from '../shell/intent'
import { motionMode } from '../ui/motion'
import { Icon } from '../ui/icons'
import { CHAPTERS, SUMMARY_N, chapterOf, totalSeconds } from './chapters'
import { ChapterDrawer } from './ChapterDrawer'
import { Opener, type RegionDots } from './Opener'
import { fillText, useNarration } from './narration-load'
import { readResume, tourStore, useTour } from './store'
import { TOUR_STRINGS, fill } from './strings'
import type { Lang } from './types'
import './tour.css'

const loadPlayer = () => import('./Player')
const Player = lazy(loadPlayer)
const loadEngine = () => import('./engine')

const q = () => new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')

function regionOf(): { regionId: string; seed: number } {
  const p = q()
  const r = p.get('region')
  const seed = p.get('seed')
  return { regionId: r && isRegionId(r) ? r : DEFAULT_REGION_ID, seed: seed && /^\d{1,9}$/.test(seed) ? Number(seed) : 2026 }
}

const Notes = lazy(() => import('./Notes'))

export default function TourPage({ bab }: { bab: number | null }) {
  // /tur?notes=1: the presenter notes window only (no world, no engine)
  const [notes] = useState(() => q().get('notes') === '1')
  const { lang: siteLang } = useI18n()
  if (notes)
    return (
      <div className="dk-tour" lang={siteLang === 'en' ? 'en' : 'id'}>
        <Suspense fallback={null}>
          <Notes lang={siteLang === 'en' ? 'en' : 'id'} />
        </Suspense>
      </div>
    )
  return <TourMain bab={bab} />
}

function TourMain({ bab }: { bab: number | null }) {
  const { lang: siteLang } = useI18n()
  const lang: Lang = siteLang === 'en' ? 'en' : 'id'
  const t = TOUR_STRINGS[lang]
  const st = useTour()
  const [region, setRegion] = useState<RegionDots | null>(null)
  const [starting, setStarting] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const pickRef = useRef<HTMLButtonElement>(null)
  const cinematic = isEnabled('tourCinematics') && motionMode() === 'full'

  // the region (name + desa dot cloud) for the opener and the titles
  useEffect(() => {
    let alive = true
    void loadRegion(regionOf().regionId).then((p) => {
      if (!alive) return
      const [w, s, e, n] = p.bbox
      const sx = 92 / Math.max(e - w, n - s)
      const ox = (100 - (e - w) * sx) / 2
      const oy = (100 - (n - s) * sx) / 2
      const pts: [number, number][] = []
      for (const k of p.kecamatan) for (const d of k.desa.length ? k.desa : [{ centroid: k.centroid }]) {
        const c = d.centroid ?? k.centroid
        pts.push([Math.round((ox + (c[0] - w) * sx) * 10) / 10, Math.round((oy + (n - c[1]) * sx) * 10) / 10])
      }
      setRegion({ name: p.shortName, pts })
    })
    return () => {
      alive = false
    }
  }, [])

  // first mount: opener (/tur), poster (/tur/:bab) or resume (?resume=1)
  useEffect(() => {
    const p = q()
    if (bab && p.get('resume') === '1') {
      const r = readResume()
      tourStore.set({ rate: r?.rate ?? 1, seen: r?.seen ?? {} })
      void start(bab, false)
    } else if (bab) {
      const rate = Number(p.get('rate'))
      if (rate > 0 && rate <= 16) tourStore.set({ rate })
      tourStore.set({ phase: 'poster', n: bab, stage: null, playing: false })
    } else {
      const rate = Number(p.get('rate'))
      if (rate > 0 && rate <= 16) tourStore.set({ rate })
      tourStore.set({ phase: 'opener', n: 1, stage: null, playing: false })
    }
    void loadEngine().then((m) => m.exposeForTests())
    if (p.get('present') === '1') tourStore.set({ presenter: true })
    return () => {
      void loadEngine().then((m) => m.engine.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function start(n: number, reset: boolean) {
    setStarting(true)
    const [{ engine, setEngineLang }] = await Promise.all([loadEngine(), loadPlayer()])
    // Tahap 8 (INP "Mulai tur"): the button's busy state paints first; the player mount runs after that frame even
    // when both chunks are already cached
    await new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)))
    setEngineLang(lang)
    setStarting(false)
    setDrawer(false)
    const { regionId, seed } = regionOf()
    void engine.start(n, { reset, regionId, seed })
  }

  const exitToOpener = () => {
    void loadEngine().then((m) => {
      m.engine.stop()
      m.syncUrl(null)
    })
    tourStore.set({ phase: 'opener', n: 1, presenter: false, black: false, drawer: false })
  }

  const name = region?.name ?? ''
  const minutes = Math.round(totalSeconds() / 60)
  const chTitle = st.n < SUMMARY_N ? TOUR_CHAPTERS.find((c) => c.n === st.n)?.title[lang] : t.summary
  const docTitle = st.phase === 'opener' ? fill(t.docTitle, { region: name }) : fill(t.docTitleChapter, { n: st.n, title: chTitle ?? '' })

  return (
    <div className="dk-tour" lang={lang} data-cinematic={cinematic ? '' : undefined}>
      <title>{docTitle}</title>
      <main className="dk-tour-main" id="main">
        {st.phase === 'opener' ? (
          <>
            <Opener lang={lang} region={region} minutes={minutes} cinematic={cinematic} busy={starting} onStart={() => void start(1, true)} onPick={() => setDrawer(true)} pickRef={pickRef} />
            <ChapterDrawer
              open={drawer}
              lang={lang}
              onClose={() => {
                setDrawer(false)
                pickRef.current?.focus()
              }}
              onPick={(n) => {
                setDrawer(false)
                void loadEngine().then((m) => m.syncUrl(n))
                tourStore.set({ phase: 'poster', n })
              }}
            />
          </>
        ) : st.phase === 'poster' ? (
          <ChapterPoster lang={lang} n={st.n} region={name} busy={starting} onPlay={() => void start(st.n, true)} onFromStart={() => void start(1, true)} onExit={exitToOpener} />
        ) : (
          <Suspense fallback={<p className="dk-tour-loading">{t.loading}</p>}>
            <Player lang={lang} onExit={exitToOpener} />
          </Suspense>
        )}
      </main>
    </div>
  )
}

/** cold /tur/:bab: the chapter's narration + a still card + "Putar bab N" / "Mulai dari awal" */
function ChapterPoster({ lang, n, region, busy, onPlay, onFromStart, onExit }: { lang: Lang; n: number; region: string; busy: boolean; onPlay: () => void; onFromStart: () => void; onExit: () => void }) {
  const t = TOUR_STRINGS[lang]
  const narr = useNarration(lang)
  const entry = narr?.[n]
  const ch = chapterOf(n)
  const idx = TOUR_CHAPTERS.find((c) => c.n === n)
  const fills = { region }
  const slug = ch?.product
  const pre = () => {
    void loadPlayer()
    if (slug) preloadDemo(slug)
  }
  return (
    <section className="dk-tour-posterpage" aria-labelledby="dk-tour-poster-h">
      <div className="dk-tour-op-top">
        <button type="button" className="dk-tour-btn dk-tour-btn--ghost" onClick={onExit} data-tour-ctl="to-opener">
          <Icon name="arrowLeft" size={16} />
          <span>{fill(t.title, { region })}</span>
        </button>
      </div>
      <div className="dk-tour-posterpage-grid">
        <div>
          <p className="dk-tour-eyebrow">
            {n < SUMMARY_N ? fill(t.chapterOf, { n, total: SUMMARY_N }) : t.summary}
            {idx?.time ? ` · ${idx.time.replace(':', lang === 'id' ? '.' : ':')}` : ''}
          </p>
          <h1 id="dk-tour-poster-h" className="dk-tour-op-title dk-tour-op-title--sm">
            {entry ? fillText(entry.title, fills) : idx?.title[lang]}
          </h1>
          <p className="dk-tour-body">{entry ? fillText(entry.body, fills) : ''}</p>
          <p className="dk-tour-fine">{t.posterNote}</p>
          <div className="dk-tour-op-ctas">
            <button type="button" className="dk-tour-btn dk-tour-btn--accent dk-tour-btn--lg" onClick={onPlay} disabled={busy} aria-busy={busy || undefined} {...intentProps(pre)} data-tour-ctl="play-chapter">
              <Icon name="play" size={18} />
              <span>{busy ? t.loading : fill(t.playChapter, { n })}</span>
            </button>
            <button type="button" className="dk-tour-btn dk-tour-btn--lg" onClick={onFromStart} disabled={busy} {...intentProps(() => void loadPlayer())} data-tour-ctl="from-start">
              <Icon name="replay" size={18} />
              <span>{t.fromStart}</span>
            </button>
          </div>
        </div>
        <div className="dk-tour-still" aria-hidden="true">
          {idx?.products.length ? (
            idx.products.map((s) => (
              <div key={s} className="dk-tour-still-card" data-eco={PRODUCT_BY_SLUG[s].eco}>
                <Icon name={PRODUCT_BY_SLUG[s].icon} size={28} />
                <span className="dk-tour-poster-name">{PRODUCT_BY_SLUG[s].name}</span>
                <span className="dk-tour-muted">{PRODUCT_BY_SLUG[s].descriptor[lang]}</span>
              </div>
            ))
          ) : (
            <div className="dk-tour-still-card">
              <Icon name="chart" size={28} />
              <span className="dk-tour-poster-name">{t.summary}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export { CHAPTERS }
