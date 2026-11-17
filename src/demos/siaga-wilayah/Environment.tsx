/**
 * siaga-wilayah/Environment.tsx — tab "Lingkungan" (lazy): SIMULATED land-use change detection. Four change sites in
 * real kecamatan (sites.ts), each with a before/after comparison of the procedural "citra (simulasi)" (imagery.ts):
 * drag the slider (or use the arrow keys) to wipe between 2019 and 2026. The map flies to the site and shows the
 * sites as markers; the real Sentinel-2 2016 mosaic (kit `imagery` layer) is one switch away.
 */
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { Button, Icon, Skeleton } from '../../demo-kit/ui'
import { useShell } from '../../demo-kit/shell'
import { world } from '../../demo-kit/world'
import { loadRegionGeo } from '../../demo-kit/region/loader'
import { changeSites, KIND_LABEL, type ChangeSite } from './sites'
import { fill, nf, type Bi } from './strings'
import { mapRef, revealMap, ui, useUi } from './ui'
import './more.css'

const T = {
  title: { id: 'Deteksi alih fungsi lahan', en: 'Land-use change detection' },
  lead: { id: 'Model membandingkan citra 2019 dan 2026 lalu menandai perubahan tutupan lahan.', en: 'The model compares 2019 and 2026 imagery and flags land-cover change.' },
  before: { id: '2019 · sebelum', en: '2019 · before' },
  after: { id: '2026 · sesudah', en: '2026 · after' },
  slider: { id: 'Geser untuk membandingkan sebelum dan sesudah', en: 'Slide to compare before and after' },
  mark: { id: 'Tandai area berubah', en: 'Outline the changed area' },
  area: { id: '{n} ha', en: '{n} ha' },
  conf: { id: 'keyakinan model {n} %', en: 'model confidence {n} %' },
  imgOn: { id: 'Tampilkan citra Sentinel-2 (2016) di peta', en: 'Show Sentinel-2 (2016) imagery on the map' },
  imgOff: { id: 'Sembunyikan citra satelit di peta', en: 'Hide the satellite imagery on the map' },
  note: { id: 'Perbandingan sebelum/sesudah ini citra prosedural (simulasi), bukan citra satelit asli. Lokasi kecamatan nyata; perubahan, luas dan keyakinan adalah simulasi. Citra di peta adalah mosaik Sentinel-2 bebas awan 2016 (EOX, CC BY 4.0).', en: 'This before/after comparison is procedural imagery (simulated), not real satellite data. District locations are real; changes, areas and confidence are simulated. The map imagery is the Sentinel-2 cloudless 2016 mosaic (EOX, CC BY 4.0).' },
  rendering: { id: 'Menyusun citra simulasi…', en: 'Rendering simulated imagery…' },
} satisfies Record<string, Bi>

const CMP = { w: 640, h: 400, kmW: 2.6 } as const

export default function Environment() {
  const { lang } = useI18n()
  const L = (k: keyof typeof T, v?: Record<string, string | number>) => (v ? fill(T[k][lang], v) : T[k][lang])
  const { pack } = useShell()
  const sites = useUi((s) => s.sites)
  const site = useUi((s) => s.site)
  const imgOn = useUi((s) => s.layers.imagery)

  // sites (once per region) + the change markers on the map
  useEffect(() => {
    ui.layer('changes', true)
    ui.layer('harvest', false)
    ui.layer('landslide', false)
    if (!pack || ui.get().sites.length) return
    let alive = true
    void loadRegionGeo(pack.id, { desa: false }).then((geo) => {
      if (!alive) return
      const centroids: Record<string, [number, number]> = {}
      for (const k of world.get().region.kecamatan) centroids[k.id] = k.centroid
      ui.set({ sites: changeSites(pack, geo, centroids) })
    })
    return () => {
      alive = false
    }
  }, [pack])
  useEffect(() => {
    if (!site && sites[0]) ui.set({ site: sites[0].id })
  }, [site, sites])

  const cur = sites.find((x) => x.id === site) ?? null
  const pick = (x: ChangeSite) => {
    revealMap()
    ui.set({ site: x.id, picked: { layer: 'changes', id: x.id } })
    mapRef.current?.flyTo(x.center, 13)
  }

  return (
    <div className="dk-sg-tab">
      <section className="dk-sg-card" aria-labelledby="sw-env-h">
        <h3 className="dk-sg-h" id="sw-env-h">
          <Icon name="eye" size={16} />
          {L('title')}
        </h3>
        <p className="dk-sg-muted">{L('lead')}</p>
        <ul className="dk-sg-sites">
          {sites.map((x) => (
            <li key={x.id}>
              <button type="button" aria-pressed={x.id === site} onClick={() => pick(x)}>
                <strong>{KIND_LABEL[x.kind][lang]}</strong>
                <span className="dk-sg-muted">
                  Kec. {x.kecamatanName} · {L('area', { n: nf(x.areaHa, lang) })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      {cur ? <Compare key={cur.id} site={cur} L={L} /> : <Skeleton height={240} radius={14} />}
      <Button variant="secondary" size="sm" icon="globe" aria-pressed={imgOn} onClick={() => {
        if (!imgOn) revealMap()
        ui.layer('imagery', !imgOn)
      }}>
        {imgOn ? L('imgOff') : L('imgOn')}
      </Button>
      <p className="dk-sg-note">{L('note')}</p>
    </div>
  )
}

function Compare({ site, L }: { site: ChangeSite; L: (k: keyof typeof T, v?: Record<string, string | number>) => string }) {
  const { lang } = useI18n()
  const { pack, markMission } = useShell()
  const beforeRef = useRef<HTMLCanvasElement>(null)
  const afterRef = useRef<HTMLCanvasElement>(null)
  const clipRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [mark, setMark] = useState(true)
  const sites = useUi((s) => s.sites)

  useEffect(() => {
    if (!pack) return
    const signal = { cancelled: false }
    setReady(false)
    void (async () => {
      const [{ painterContext, paint, cropView }, geo] = await Promise.all([import('./imagery'), loadRegionGeo(pack.id, { desa: false })])
      const desa: { kecamatanId: string; centroid: [number, number] }[] = []
      for (const k of world.get().region.kecamatan) for (const d of k.desa) desa.push({ kecamatanId: k.id, centroid: d.centroid })
      const ctx = painterContext(pack, geo, desa, sites)
      const view = cropView(ctx, site.center, CMP.kmW, CMP.w, CMP.h)
      const [b, a] = await Promise.all([paint(ctx, view, 'before', signal), paint(ctx, view, 'after', signal)])
      if (signal.cancelled || !b || !a) return
      beforeRef.current?.getContext('2d')?.drawImage(b, 0, 0)
      afterRef.current?.getContext('2d')?.drawImage(a, 0, 0)
      setReady(true)
    })()
    return () => {
      signal.cancelled = true
    }
  }, [pack, site, sites])

  const moved = useRef(false)
  const onInput = (v: number) => {
    clipRef.current?.style.setProperty('clip-path', `inset(0 0 0 ${v}%)`)
    knobRef.current?.style.setProperty('transform', `translateX(${v}cqw)`)
    if (!moved.current) {
      moved.current = true
      markMission('compare')
    }
  }
  // the changed area: blob radius → % of the crop
  const rPct = (site.radiusKm / CMP.kmW) * 100
  return (
    <section className="dk-sg-card" aria-label={`${KIND_LABEL[site.kind][lang]} · Kec. ${site.kecamatanName}`}>
      <div className={`dk-sg-cmp${ready ? '' : ' is-busy'}`}>
        <canvas ref={beforeRef} width={CMP.w} height={CMP.h} aria-hidden="true" />
        <div ref={clipRef} className="dk-sg-cmp-after" style={{ clipPath: 'inset(0 0 0 50%)' }}>
          <canvas ref={afterRef} width={CMP.w} height={CMP.h} aria-hidden="true" />
          {mark && (
            <svg className="dk-sg-cmp-mark" viewBox="0 0 100 62.5" preserveAspectRatio="none" aria-hidden="true">
              <ellipse cx="50" cy="31.25" rx={rPct * 1.15} ry={rPct * 1.15} />
            </svg>
          )}
        </div>
        <div ref={knobRef} className="dk-sg-cmp-knob" style={{ transform: 'translateX(50cqw)' }} aria-hidden="true">
          <span />
        </div>
        <span className="dk-sg-cmp-tag is-l">{L('before')}</span>
        <span className="dk-sg-cmp-tag is-r">{L('after')}</span>
        {!ready && <span className="dk-sg-cmp-wait">{L('rendering')}</span>}
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          defaultValue={50}
          className="dk-sg-cmp-range"
          aria-label={L('slider')}
          aria-valuetext={`${L('before')} | ${L('after')}`}
          onInput={(e) => onInput(Number((e.target as HTMLInputElement).value))}
          data-sw="compare"
        />
      </div>
      <div className="dk-sg-cmp-meta">
        <p>
          <strong>{site.from[lang]}</strong> → <strong>{site.to[lang]}</strong>
        </p>
        <p className="dk-sg-muted">
          Kec. {site.kecamatanName} · {L('area', { n: nf(site.areaHa, lang) })} · {L('conf', { n: Math.round(site.confidence * 100) })}
        </p>
        <label className="dk-sg-check">
          <input type="checkbox" checked={mark} onChange={(e) => setMark(e.target.checked)} />
          {L('mark')}
        </label>
      </div>
    </section>
  )
}
