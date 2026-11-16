/**
 * MapView — the one map component of the Demo Kit (MapLibre, lazy).
 *
 * maplibre-gl, its worker and its CSS are pulled with a dynamic import() when the first MapView mounts, so they
 * form their own chunk; importing this file (or the map barrel) costs only this component. Geometry comes from
 * loadRegionGeo(regionId) (its own chunk too). One map per screen: a second mounted MapView logs a dev warning.
 *
 *   <MapView regionId="bojonegoro" layers={[{ id: 'kec', kind: 'kecamatan' }, …]} ref={mapRef} />
 *   mapRef.current.fitKecamatan('kalitidu')
 *
 * Gestures: cooperative (two-finger pan) on touch inside scrolling pages, standard in full screen.
 * Offline / blocked basemap: plain ink background + boundaries + a small notice — never a blank map.
 */
import { memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react'
import { useI18n } from '../../lib/i18n'
import { isEnabled } from '../../lib/motion'
import { hasWebGL } from '../../lib/perf'
import { loadRegion, loadRegionGeo } from '../region/loader'
import type { RegionPack } from '../region/types'
import { Icon, ICON_NAMES } from '../ui/icons'
import { IconButton } from '../ui/Button'
import type { MapEngine } from './engine'
import { BASEMAP_ATTRIBUTION_TEXT, ms } from './strings'
import type { LngLat, MapViewHandle, MapViewProps } from './types'
import './map.css'

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

interface FpsWindow {
  samples: number[]
  avg: number
  min: number
}

export function MapView(props: MapViewProps & { ref?: Ref<MapViewHandle> }) {
  const { regionId, layers, onReady, interactive = true, initialView, className, ariaLabel, selectedId, onSelect, onMarker, fullscreenButton, ref } = props
  const { lang } = useI18n()
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const labelsRef = useRef<HTMLDivElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const spriteRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<MapEngine | null>(null)
  const pendingHour = useRef<number | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [notice, setNotice] = useState<'noTiles' | null>(null)
  const [pack, setPack] = useState<RegionPack | null>(null)
  const [full, setFull] = useState(false)
  const [srcOpen, setSrcOpen] = useState(false)
  const [fps, setFps] = useState<number | null>(null)
  const [engineTick, setEngineTick] = useState(0)
  const debugFps = useMemo(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === 'fps', [])
  const forceFallback = useMemo(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('maptiles') === 'off', [])
  const canFull = typeof document !== 'undefined' && !!document.fullscreenEnabled && (fullscreenButton ?? interactive)

  // latest callbacks without re-creating the engine
  const cb = useRef({ onSelect, onMarker, onReady })
  cb.current = { onSelect, onMarker, onReady }

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
    }),
    [],
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
    void Promise.all([import('./engine'), import('maplibre-gl/dist/maplibre-gl.css')])
      .then(async ([mod]) => {
        if (!alive || !canvasRef.current || !labelsRef.current || !tipRef.current) return
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
          callbacks: {
            onSelect: (id) => cb.current.onSelect?.(id),
            onMarker: (l, id) => cb.current.onMarker?.(l, id),
            onNotice: (k) => alive && setNotice(k),
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
    void Promise.all([loadRegion(regionId), loadRegionGeo(regionId)])
      .then(async ([p, g]) => {
        if (!alive) return
        setPack(p)
        const first = regionLoaded.current === null
        await engine.setRegion(p, g, !first)
        if (!alive) return
        if (first && initialView) engine.flyTo(initialView.center, initialView.zoom)
        regionLoaded.current = regionId
        if (pendingHour.current !== null) engine.setTime(pendingHour.current)
        setStatus('ready')
        if (first) cb.current.onReady?.(handle)
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
  const zoomBy = (d: number) => {
    const m = engineRef.current?.map
    if (m) m.zoomTo(m.getZoom() + d, { duration: isEnabled('demoAnimations') ? 250 : 0 })
  }

  return (
    <div ref={rootRef} className={`dk-map${full ? ' is-full' : ''}${className ? ` ${className}` : ''}`} role="region" aria-label={label} aria-busy={status === 'loading'}>
      <div ref={canvasRef} className="dk-map-canvas" />
      <div ref={labelsRef} className="dk-map-labels" aria-hidden="true" />
      <div ref={tipRef} className="dk-map-tip" aria-hidden="true" hidden />
      {/* hidden glyph sheet: ui/icons rendered once, serialised into marker badges */}
      <div ref={spriteRef} className="dk-map-sprite" aria-hidden="true">
        <IconSheet />
      </div>

      {status === 'loading' && (
        <div className="dk-map-state" aria-live="polite">
          <span className="dk-map-spin" aria-hidden="true" />
          {ms('loading', lang)}
        </div>
      )}
      {(status === 'error' || status === 'nowebgl') && (
        <div className="dk-map-state is-error" role="alert">
          <Icon name="alert" size={18} />
          {ms(status === 'error' ? 'failed' : 'noWebgl', lang)}
        </div>
      )}
      {notice === 'noTiles' && status === 'ready' && (
        <p className="dk-map-notice" role="status">
          <Icon name="wifi" size={16} />
          {ms('noTiles', lang)}
        </p>
      )}
      {debugFps && fps !== null && (
        <output className="dk-map-fps" aria-label="fps">
          {fps} fps
        </output>
      )}

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
    </div>
  )
}
