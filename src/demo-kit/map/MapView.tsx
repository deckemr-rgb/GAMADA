/**
 * MapView — the one map component of the Demo Kit (MapLibre, lazy).
 *
 * maplibre-gl, its worker and its CSS are pulled with a dynamic import() when the first MapView mounts, so they
 * form their own chunk; importing this file (or the map barrel) costs only this component. Geometry comes from
 * loadRegionGeo(regionId, { desa: false }); the heavy desa polygons (desa.min.json) are fetched lazily with
 * loadRegionDesa() only when the engine asks for them (desa layer switched on or zoomed in, flood scrubbed past
 * +0 h) or a caller does (handle.loadDesa() / handle.floodImpact()). One map per screen: a second mounted
 * MapView logs a dev warning.
 *
 *   <MapView regionId="bojonegoro" layers={[{ id: 'kec', kind: 'kecamatan' }, …]} ref={mapRef} />
 *   mapRef.current.fitKecamatan('kalitidu')
 *
 * Gestures: cooperative (two-finger pan) on touch inside scrolling pages, standard in full screen.
 * Offline / blocked basemap: plain ink background + boundaries + a small notice — never a blank map.
 */
import { memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react'
import { useI18n, type Lang } from '../../lib/i18n'
import { isEnabled } from '../../lib/motion'
import { hasWebGL } from '../../lib/perf'
import { loadRegion, loadRegionDesa, loadRegionGeo } from '../region/loader'
import type { RegionPack } from '../region/types'
import { Icon, ICON_NAMES } from '../ui/icons'
import { IconButton } from '../ui/Button'
import type { MapEngine } from './engine'
import { BASEMAP_ATTRIBUTION_TEXT, IMAGERY } from './strings'
import type { ChoroplethLayer, LngLat, MapViewHandle, MapViewProps } from './types'
import { bboxOfPolys, polysOf, type Poly } from './geo'
import { classColor, classOf, quantileBreaks } from './palette'
import './map.css'

/** this file's bilingual strings (kept per file so a demo loads only the strings of the parts it uses) */
const S = {
  mapOf: { id: 'Peta', en: 'Map of' },
  canvasOf: { id: 'Kanvas peta', en: 'Map canvas:' },
  loading: { id: 'Memuat peta…', en: 'Loading map…' },
  tiles: { id: 'Memuat citra peta…', en: 'Loading map tiles…' },
  failed: { id: 'Peta gagal dimuat. Muat ulang halaman untuk mencoba lagi.', en: 'The map failed to load. Reload the page to try again.' },
  noTiles: { id: 'Peta dasar tidak tersedia (offline atau diblokir) — batas wilayah tetap tampil.', en: 'Basemap unavailable (offline or blocked) — region boundaries still shown.' },
  noWebgl: { id: 'Peramban ini tidak mendukung WebGL — gunakan daftar kecamatan.', en: 'This browser has no WebGL — use the district list.' },
  sources: { id: 'Sumber', en: 'Sources' },
  sourcesTitle: { id: 'Sumber data peta', en: 'Map data sources' },
  basemap: { id: 'Peta dasar', en: 'Basemap' },
  imagery: { id: 'Citra satelit', en: 'Satellite imagery' },
  close: { id: 'Tutup', en: 'Close' },
  fullscreen: { id: 'Layar penuh', en: 'Full screen' },
  exitFullscreen: { id: 'Keluar layar penuh', en: 'Exit full screen' },
  zoomIn: { id: 'Perbesar', en: 'Zoom in' },
  zoomOut: { id: 'Perkecil', en: 'Zoom out' },
  resetView: { id: 'Tampilkan seluruh wilayah', en: 'Show the whole region' },
} as const
const ms = (k: keyof typeof S, lang: Lang): string => S[k][lang]

let mounted = 0

/** Every ui/icons glyph once (hidden); memoised so parent re-renders never touch it. */
const IconSheet = memo(function IconSheet() {
  return (
    <>
      {ICON_NAMES.map((n) => (
        <Icon key={n} name={n} data-icon={n} />
      ))}
    </>
  )
})

type Status = 'loading' | 'ready' | 'error' | 'nowebgl'

type RegionGeoData = Awaited<ReturnType<typeof loadRegionGeo>>
/**
 * While the engine loads (cold load, Back): the region's kecamatan as a static SVG (choropleth colours when a
 * choropleth layer is given), so the panel is never an empty box with a spinner.
 */
const RegionSilhouette = memo(function RegionSilhouette({ geo, choro }: { geo: RegionGeoData; choro: ChoroplethLayer | undefined }) {
  const shapes = useMemo(() => {
    const feats = geo.kecamatan.features
    const all: { id: string; polys: Poly[] }[] = feats.map((f) => ({ id: String((f.properties as { id?: unknown } | null)?.id ?? ''), polys: polysOf(f.geometry as never) }))
    const [w, so, e, n] = bboxOfPolys(all.flatMap((x) => x.polys))
    const k = Math.cos((((so + n) / 2) * Math.PI) / 180)
    const W = (e - w) * k
    const H = n - so
    if (!(W > 0 && H > 0)) return null
    const sc = 1000 / Math.max(W, H)
    const vals = choro ? Object.values(choro.values).filter((v): v is number => typeof v === 'number') : []
    const breaks = choro ? (choro.breaks ?? quantileBreaks(vals)) : []
    const paths = all.map(({ id, polys }) => {
      let d = ''
      for (const poly of polys)
        for (const ring of poly) {
          ring.forEach(([x, y], i) => {
            d += `${i ? 'L' : 'M'}${((x - w) * k * sc).toFixed(1)} ${((n - y) * sc).toFixed(1)}`
          })
          d += 'Z'
        }
      const v = choro?.values[id]
      return { id, d, fill: typeof v === 'number' ? classColor(classOf(v, breaks), breaks.length + 1) : null }
    })
    return { paths, vw: W * sc, vh: H * sc }
  }, [geo, choro])
  if (!shapes) return null
  return (
    <svg className="dk-map-ghost" viewBox={`-20 -20 ${shapes.vw + 40} ${shapes.vh + 40}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {shapes.paths.map((p) => (
        <path key={p.id} d={p.d} style={p.fill ? { fill: p.fill } : undefined} />
      ))}
    </svg>
  )
})

/**
 * Tahap 7 (spec §7): the camera of the map that was just unmounted. A region switch remounts the stage (DemoShell),
 * so the next MapView of ANOTHER region mounted within HANDOFF_MS starts at this camera and flies to its own bbox
 * (ENGINE.flyDur 1.2 s; a jump under reduced motion). Same region or later: no fly.
 */
let handoff: { regionId: string; center: LngLat; zoom: number; at: number } | null = null
const HANDOFF_MS = 8000

interface FpsWindow {
  samples: number[]
  avg: number
  min: number
}

export function MapView(props: MapViewProps & { ref?: Ref<MapViewHandle> }) {
  const { regionId, layers, onReady, onLayersReady, interactive = true, initialView, className, ariaLabel, notice: noticeAt, selectedId, onSelect, onMarker, fullscreenButton, minHeight, ref } = props
  const { lang } = useI18n()
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const labelsRef = useRef<HTMLDivElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const spriteRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<MapEngine | null>(null)
  const pendingHour = useRef<number | null>(null)
  /** this map's first region flies in from the previous map's camera (region switch) */
  const flyIn = useRef(false)
  const [status, setStatus] = useState<Status>('loading')
  const [notice, setNotice] = useState<'noTiles' | null>(null)
  // basemap / imagery tiles still arriving after a pan, zoom or layer switch (shown after a short delay, so a fast
  // network never flashes it)
  const [tilesLoading, setTilesLoading] = useState(false)
  const [pack, setPack] = useState<RegionPack | null>(null)
  // the outline shown while loading: the same cached request the engine uses (no extra download)
  const [ghost, setGhost] = useState<RegionGeoData | null>(null)
  useEffect(() => {
    let alive = true
    loadRegionGeo(regionId, { desa: false }).then(
      (g) => alive && setGhost(g),
      () => {},
    )
    return () => {
      alive = false
    }
  }, [regionId])
  const [full, setFull] = useState(false)
  const [srcOpen, setSrcOpen] = useState(false)
  const [fps, setFps] = useState<number | null>(null)
  const [engineTick, setEngineTick] = useState(0)
  const debugFps = useMemo(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === 'fps', [])
  const forceFallback = useMemo(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('maptiles') === 'off', [])
  const canFull = typeof document !== 'undefined' && !!document.fullscreenEnabled && (fullscreenButton ?? interactive)

  // latest callbacks without re-creating the engine
  const cb = useRef({ onSelect, onMarker, onReady, onLayersReady })
  cb.current = { onSelect, onMarker, onReady, onLayersReady }

  /* lazy desa: the engine (or a caller) asks, MapView fetches desa.min.json and hands it over */
  const regionIdRef = useRef(regionId)
  regionIdRef.current = regionId
  const desaWanted = useRef(new Set<string>())
  const desaWaiters = useRef<{ res: () => void; rej: (e: Error) => void }[]>([])
  const flushDesa = useCallback(() => {
    const e = engineRef.current
    if (!e?.hasDesa || e.regionId !== regionIdRef.current) return
    const w = desaWaiters.current.splice(0)
    for (const x of w) x.res()
  }, [])
  const fetchDesa = useCallback(
    (id: string) => {
      desaWanted.current.add(id)
      // cached in the loader: repeat calls share one request
      loadRegionDesa(id)
        .then((fc) => {
          engineRef.current?.setDesa(fc, id)
          flushDesa()
        })
        .catch((e: unknown) => {
          desaWanted.current.delete(id)
          engineRef.current?.desaFailed(id)
          if (import.meta.env.DEV) console.warn('[map] desa failed', e)
          const err = e instanceof Error ? e : new Error(String(e))
          for (const x of desaWaiters.current.splice(0)) x.rej(err)
        })
    },
    [flushDesa],
  )

  const handle = useMemo<MapViewHandle>(
    () => ({
      flyTo: (c: LngLat, z?: number) => engineRef.current?.flyTo(c, z),
      fitRegion: () => engineRef.current?.fitRegion(),
      fitKecamatan: (id: string) => engineRef.current?.fitKecamatan(id),
      setLayerVisible: (id: string, v: boolean) => engineRef.current?.setLayerVisible(id, v),
      highlight: (id: string | null) => engineRef.current?.highlight(id),
      setTime: (h: number) => {
        pendingHour.current = h
        engineRef.current?.setTime(h)
      },
      raw: () => engineRef.current?.map ?? null,
      loadDesa: () =>
        new Promise<void>((res, rej) => {
          const e = engineRef.current
          if (e?.hasDesa && e.regionId === regionIdRef.current) return res()
          desaWaiters.current.push({ res, rej })
          fetchDesa(regionIdRef.current)
        }),
      floodImpact: (h: number) => {
        const e = engineRef.current
        // null while the engine is not ready, still on the previous region, or desa are loading (the call asks)
        if (!e || e.regionId !== regionIdRef.current) {
          fetchDesa(regionIdRef.current)
          return null
        }
        return e.floodImpact(h)
      },
    }),
    [fetchDesa],
  )
  useImperativeHandle(ref, () => handle, [handle])

  /* one map per screen */
  useEffect(() => {
    mounted++
    if (mounted > 1 && import.meta.env.DEV) console.warn(`[map] ${mounted} MapViews mounted — keep one map per screen`)
    return () => {
      mounted--
    }
  }, [])

  /* engine lifecycle (once) */
  const layersRef = useRef(layers)
  layersRef.current = layers
  const langRef = useRef(lang)
  langRef.current = lang
  useEffect(() => {
    if (!hasWebGL()) {
      setStatus('nowebgl')
      return
    }
    let alive = true
    let engine: MapEngine | null = null
    const coarse = window.matchMedia('(pointer: coarse)').matches
    // the pack is already cached by the shell: its centre is the first camera (no tiles fetched for another place)
    void Promise.all([import('./engine'), import('maplibre-gl/dist/maplibre-gl.css'), loadRegion(regionIdRef.current).catch(() => null)])
      .then(async ([mod, , p]) => {
        if (!alive || !canvasRef.current || !labelsRef.current || !tipRef.current) return
        const h = handoff && handoff.regionId !== regionIdRef.current && Date.now() - handoff.at < HANDOFF_MS ? handoff : null
        handoff = null
        flyIn.current = !!h
        const start = h ? { center: h.center, zoom: h.zoom } : p ? { center: p.center as LngLat, zoom: p.zoom } : undefined
        const iconSvgs: Record<string, string> = {}
        spriteRef.current?.querySelectorAll<SVGSVGElement>('svg[data-icon]').forEach((s) => (iconSvgs[s.dataset.icon!] = s.outerHTML.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')))
        engine = await mod.MapEngine.create({
          container: canvasRef.current,
          labelsEl: labelsRef.current,
          tipEl: tipRef.current,
          lang: langRef.current,
          interactive,
          cooperative: coarse,
          forceFallback,
          debugFps,
          iconSvgs,
          start,
          callbacks: {
            onSelect: (id) => cb.current.onSelect?.(id),
            onMarker: (l, id) => cb.current.onMarker?.(l, id),
            onNotice: (k) => alive && setNotice(k),
            onNeedDesa: (id) => alive && fetchDesa(id),
            onFps: (f) => {
              if (!alive) return
              setFps(f)
              const w = window as unknown as { __mapFps?: FpsWindow }
              const s = (w.__mapFps ??= { samples: [], avg: 0, min: Infinity })
              s.samples.push(f)
              s.avg = s.samples.reduce((a, b) => a + b, 0) / s.samples.length
              s.min = Math.min(s.min, f)
            },
          },
        })
        if (!alive) {
          engine.destroy()
          return
        }
        engineRef.current = engine
        // dev / ?debug=fps hook for perf scripts and tests
        if (import.meta.env.DEV || debugFps) (window as unknown as { __dkMap?: MapViewHandle }).__dkMap = handle
        engine.setLayers(layersRef.current)
        setEngineTick((t) => t + 1)
      })
      .catch((e: unknown) => {
        if (import.meta.env.DEV) console.warn('[map] engine failed', e)
        if (alive) setStatus('error')
      })
    return () => {
      alive = false
      // hand the camera to the next map (a region switch remounts the stage, see `handoff`)
      const from = regionLoaded.current
      if (engine && from) {
        const c = engine.map.getCenter()
        handoff = { regionId: from, center: [c.lng, c.lat], zoom: engine.map.getZoom(), at: Date.now() }
      }
      engine?.destroy()
      engineRef.current = null
    }
    // the engine is created once; later prop changes go through the effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* region (fly out → swap → fly in on change) */
  const regionLoaded = useRef<string | null>(null)
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    let alive = true
    // geometry WITHOUT desa first (desa.min.json is the heaviest file; fetched lazily, see fetchDesa)
    void Promise.all([loadRegion(regionId), loadRegionGeo(regionId, { desa: false })])
      .then(async ([p, g]) => {
        if (!alive) return
        setPack(p)
        const first = regionLoaded.current === null
        await engine.setRegion(p, g, !first, first && flyIn.current)
        if (!alive) return
        if (first && initialView) engine.flyTo(initialView.center, initialView.zoom)
        regionLoaded.current = regionId
        if (pendingHour.current !== null) engine.setTime(pendingHour.current)
        // desa asked for before the engine / this region was ready, or callers still waiting
        if (desaWanted.current.has(regionId) || desaWaiters.current.length) fetchDesa(regionId)
        flushDesa()
        setStatus('ready')
        if (first) {
          cb.current.onReady?.(handle)
          // after the layer effect below has pushed the current layers: the first 'idle' = everything drawn
          if (cb.current.onLayersReady) {
            const fire = () => alive && cb.current.onLayersReady?.(handle)
            requestAnimationFrame(() => {
              if (!alive) return
              const m = engine.map
              m.once('idle', fire)
              m.triggerRepaint()
            })
          }
        }
      })
      .catch((e: unknown) => {
        if (import.meta.env.DEV) console.warn('[map] region failed', e)
        if (alive) setStatus('error')
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionId, engineTick])

  useEffect(() => {
    engineRef.current?.setLayers(layers)
  }, [layers, engineTick])

  useEffect(() => {
    engineRef.current?.setSelected(selectedId ?? null)
  }, [selectedId, engineTick, status])

  useEffect(() => {
    engineRef.current?.setLang(lang)
  }, [lang, engineTick])


  /* size + visibility */
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const ro = new ResizeObserver(() => engineRef.current?.resize())
    ro.observe(root)
    const io = new IntersectionObserver((entries) => {
      const last = entries[entries.length - 1]
      if (last) engineRef.current?.setInView(last.isIntersecting)
    })
    io.observe(root)
    return () => {
      ro.disconnect()
      io.disconnect()
    }
  }, [engineTick])

  /* full screen: standard gestures inside, cooperative on touch outside */
  useEffect(() => {
    const on = () => {
      const isFull = document.fullscreenElement === rootRef.current
      setFull(isFull)
      engineRef.current?.setCooperative(!isFull && window.matchMedia('(pointer: coarse)').matches)
    }
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])
  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void rootRef.current?.requestFullscreen?.()
  }, [])

  /* Esc closes the sources popover */
  useEffect(() => {
    if (!srcOpen) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setSrcOpen(false)
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [srcOpen])

  const label = ariaLabel ?? `${ms('mapOf', lang)} ${pack?.shortName ?? ''}`.trim()
  // the map canvas's accessible name names the region (MapLibre's Map.Title locale alone reads "Map of"); it differs
  // from the map box's own label above, so the two nested regions never share a name
  const canvasLabel = `${ms('canvasOf', lang)} ${pack?.shortName ?? ''}`.trim()
  useEffect(() => {
    engineRef.current?.setTitle(canvasLabel)
  }, [canvasLabel, engineTick])
  const zoomBy = (d: number) => {
    const m = engineRef.current?.map
    if (m) m.zoomTo(m.getZoom() + d, { duration: isEnabled('demoAnimations') ? 250 : 0 })
  }

  useEffect(() => {
    const m = status === 'ready' ? engineRef.current?.map : null
    if (!m) return
    let timer = 0
    const onData = (e: { dataType?: string; tile?: unknown }) => {
      if (e.dataType !== 'source' || !e.tile || timer) return
      timer = window.setTimeout(() => setTilesLoading(!m.areTilesLoaded()), 450)
    }
    const onIdle = () => {
      window.clearTimeout(timer)
      timer = 0
      setTilesLoading(false)
    }
    m.on('dataloading', onData)
    m.on('idle', onIdle)
    return () => {
      m.off('dataloading', onData)
      m.off('idle', onIdle)
      window.clearTimeout(timer)
    }
  }, [status, engineTick])

  return (
    <div ref={rootRef} className={`dk-map${full ? ' is-full' : ''}${className ? ` ${className}` : ''}`} role="region" aria-label={label} aria-busy={status === 'loading' || tilesLoading} style={minHeight !== undefined ? { minHeight } : undefined}>
      {/* DOM order = tab order: corner controls → Sumber → map canvas → basemap attribution (all overlays are
          absolutely positioned, so this does not change the picture) */}
      {interactive && status === 'ready' && (
        <div className="dk-map-ctrl">
          <IconButton icon="plus" label={ms('zoomIn', lang)} size="sm" variant="quiet" className="dk-map-zoom" onClick={() => zoomBy(1)} />
          <IconButton icon="minus" label={ms('zoomOut', lang)} size="sm" variant="quiet" className="dk-map-zoom" onClick={() => zoomBy(-1)} />
          <IconButton icon="home" label={ms('resetView', lang)} size="sm" variant="quiet" onClick={() => engineRef.current?.fitRegion()} />
          {canFull && <IconButton icon="fullscreen" label={ms(full ? 'exitFullscreen' : 'fullscreen', lang)} size="sm" variant="quiet" onClick={toggleFull} aria-pressed={full} />}
        </div>
      )}

      {status === 'ready' && pack && (
        <div className="dk-map-src">
          <button type="button" className="dk-map-src-btn" aria-expanded={srcOpen} aria-controls="dk-map-src-panel" onClick={() => setSrcOpen((o) => !o)}>
            <Icon name="info" size={14} />
            {ms('sources', lang)}
          </button>
          {srcOpen && (
            <div id="dk-map-src-panel" className="dk-map-src-panel" role="dialog" aria-label={ms('sourcesTitle', lang)}>
              <div className="dk-map-src-head">
                <strong>{ms('sourcesTitle', lang)}</strong>
                <IconButton icon="close" label={ms('close', lang)} size="sm" onClick={() => setSrcOpen(false)} />
              </div>
              <ul>
                <li>
                  <span className="dk-map-src-layer">{ms('basemap', lang)}</span>
                  {notice === 'noTiles' ? <span>{ms('noTiles', lang)}</span> : <span>{BASEMAP_ATTRIBUTION_TEXT}</span>}
                </li>
                {layers.some((l) => l.kind === 'imagery' && l.visible !== false) && (
                  <li>
                    <span className="dk-map-src-layer">{ms('imagery', lang)}</span>
                    <a href={IMAGERY.url} target="_blank" rel="noopener noreferrer">
                      {IMAGERY.name}
                    </a>
                    <span className="dk-map-src-lic">{IMAGERY.license}</span>
                  </li>
                )}
                {pack.sources
                  .filter((s) => /^(kecamatan|desa|rivers|roads|landmarks|hazards|stats)/.test(s.layer))
                  .map((s) => (
                    <li key={s.layer + s.name}>
                      <span className="dk-map-src-layer">{s.layer}</span>
                      {/^https?:/.test(s.url) ? (
                        <a href={s.url} target="_blank" rel="noopener noreferrer">
                          {s.name}
                        </a>
                      ) : (
                        <span>{s.name}</span>
                      )}
                      <span className="dk-map-src-lic">
                        {s.license}
                        {s.year ? ` · ${s.year}` : ''}
                      </span>
                      {s.note && <span className="dk-map-src-note">{s.note}</span>}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <div ref={canvasRef} className="dk-map-canvas" />
      <div ref={labelsRef} className="dk-map-labels" aria-hidden="true" />
      <div ref={tipRef} className="dk-map-tip" aria-hidden="true" hidden />
      {/* hidden glyph sheet: ui/icons rendered once, serialised into marker badges */}
      <div ref={spriteRef} className="dk-map-sprite" aria-hidden="true">
        <IconSheet />
      </div>

      {status === 'loading' && (
        <div className={`dk-map-state${ghost ? ' has-ghost' : ''}`} aria-live="polite">
          {ghost && <RegionSilhouette geo={ghost} choro={layers.find((l): l is ChoroplethLayer => l.kind === 'choropleth' && l.visible !== false)} />}
          <span className="dk-map-loadtag">
            <span className="dk-map-spin" aria-hidden="true" />
            {ms('loading', lang)}
          </span>
        </div>
      )}
      {(status === 'error' || status === 'nowebgl') && (
        <div className="dk-map-state is-error" role="alert">
          <Icon name="alert" size={18} />
          {ms(status === 'error' ? 'failed' : 'noWebgl', lang)}
        </div>
      )}
      {notice === 'noTiles' && status === 'ready' && (
        <p className="dk-map-notice" role="status" style={noticeAt ? (noticeAt.placement === 'bottom' ? { top: 'auto', bottom: noticeAt.inset ?? 12 } : { top: noticeAt.inset ?? 12 }) : undefined}>
          <Icon name="wifi" size={16} />
          {ms('noTiles', lang)}
        </p>
      )}
      {tilesLoading && status === 'ready' && notice !== 'noTiles' && (
        <span className="dk-map-tiles" aria-hidden="true">
          <span className="dk-map-spin" />
          {ms('tiles', lang)}
        </span>
      )}
      {debugFps && fps !== null && (
        <output className="dk-map-fps" aria-label="fps">
          {fps} fps
        </output>
      )}
    </div>
  )
}
