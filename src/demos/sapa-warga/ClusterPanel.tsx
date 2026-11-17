/**
 * demos/sapa-warga/ClusterPanel.tsx — "Klaster aduan" (lazy): heat map of today's flood reports on the real map, the
 * clusters the world formed (≥ 5 similar reports within 1 km → Meja Pimpinan, Siaga Wilayah, Radar Isu), the cluster
 * still forming with its progress, and a control to simulate one more neighbour report.
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useI18n } from '../../lib/i18n'
import { PRODUCT_BY_SLUG, type ProductSlug } from '../../content/products'
import { Button, EmptyState, Icon } from '../../demo-kit/ui'
import { demoHref } from '../../demo-kit/shell'
import { DAY_MIN, WORLD, hhmm, isEvent, onEvent, rows, useClock, useSession, useWorld, world, type LngLat, type WorldState } from '../../demo-kit/world'
import { desaName, formingCluster, kecName, neighbourReport } from './model'
import { fill, useT } from './strings'

const MiniMap = lazy(() => import('./MiniMap'))
const TARGETS: ProductSlug[] = ['meja-pimpinan', 'siaga-wilayah', 'radar-isu']

/** what each product opens on (?focus=): Radar Isu knows mentions, not clusters → the topic post the cluster raised */
function focusFor(s: WorldState, slug: ProductSlug, clusterId: string): string {
  if (slug !== 'radar-isu') return clusterId
  const cl = s.clusters.byId[clusterId]
  if (!cl) return clusterId
  const desa = desaName(s, cl.kecamatanId, cl.desaId).toLowerCase()
  const ms = rows(s.mentions).filter((m) => m.topic === 'banjir' && m.at >= cl.at)
  const m = ms.find((x) => x.at === cl.at && x.text.id.toLowerCase().includes(desa)) ?? ms.find((x) => x.text.id.toLowerCase().includes(desa)) ?? ms[0]
  return m?.id ?? clusterId
}

export default function ClusterPanel({ focus, openTicket }: { focus: string | null; openTicket: (ticketId: string) => void }) {
  const { lang } = useI18n()
  const t = useT()
  const session = useSession()
  const navigate = useNavigate()
  const { minutes: now } = useClock()
  const complaints = useWorld((s) => s.complaints)
  const clustersT = useWorld((s) => s.clusters)
  const regionId = useWorld((s) => s.regionId)
  const day = Math.floor(now / DAY_MIN) * DAY_MIN
  const flood = useMemo(() => rows(complaints).filter((c) => c.category === 'banjir' && c.at >= day && c.at <= now), [complaints, day, now])
  const clusters = useMemo(() => rows(clustersT).filter((c) => c.updatedAt >= day).sort((a, b) => b.complaintIds.length - a.complaintIds.length), [clustersT, day])
  const forming = useMemo(() => formingCluster(world.get(), now), [complaints, now]) // eslint-disable-line react-hooks/exhaustive-deps
  const [sel, setSel] = useState<string | null>(focus ?? clusters[0]?.id ?? null)
  useEffect(() => {
    if (focus) setSel(focus)
  }, [focus])
  useEffect(() => {
    if (!sel && clusters[0]) setSel(clusters[0].id)
  }, [clusters, sel])
  const cur = clusters.find((c) => c.id === sel) ?? null
  /* a cluster just formed (e.g. after "Simulasikan laporan warga sekitar"): bring the map with its heat point into view */
  const mapBox = useRef<HTMLDivElement>(null)
  useEffect(
    () =>
      onEvent('complaint.clustered', (e) => {
        if (!isEvent(e, 'complaint.clustered')) return
        const cl = world.get().clusters.byId[e.payload.clusterId ?? '']
        if (!cl || cl.at !== e.at) return
        setSel(cl.id)
        window.setTimeout(() => mapBox.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' }), 80)
      }),
    [],
  )
  const s = world.get()
  const place = (kec: string, desa: string) => `${desaName(s, kec, desa)}, Kec. ${kecName(s, kec)}`
  const siti = s.citizens.byId[s.meta.personas.siti]
  const center: LngLat = cur?.center ?? forming?.center ?? siti?.coord ?? s.region.kecamatan[0]?.centroid ?? [0, 0]
  const heat = useMemo(() => flood.map((c) => ({ coord: c.coord, weight: c.urgency === 'tinggi' ? 1.4 : 1 })), [flood])
  const markers = useMemo(
    () => [
      ...clusters.map((c) => ({ id: c.id, coord: c.center, icon: 'alert' as const, label: `${lang === 'id' ? 'Klaster' : 'Cluster'} · ${c.complaintIds.length}`, detail: place(c.kecamatanId, c.desaId), tone: 'danger' as const })),
      ...flood.filter((c) => !c.clusterId).map((c) => ({ id: c.id, coord: c.coord, icon: 'water' as const, label: c.code, detail: c.summary[lang], tone: 'warn' as const })),
    ],
    [clusters, flood, lang], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const go = (slug: ProductSlug, id: string) => {
    const href = demoHref(slug, session, focusFor(world.get(), slug, id))
    const dev = new URLSearchParams(window.location.search).get('controls') === 'all'
    navigate(dev ? `${href}&controls=all` : href)
  }
  const openFromMap = (id: string) => {
    if (clustersT.byId[id]) setSel(id)
    else {
      const c = complaints.byId[id]
      if (c) openTicket(c.ticketId)
    }
  }

  return (
    <div className="dk-sw-cluster">
      <div className="dk-sw-cl-map">
        <h3 className="dk-sw-h3">{t.clusterHead}</h3>
        <div ref={mapBox} className="dk-sw-minimap is-big" data-sw-map="">
          <Suspense fallback={<p className="dk-sw-muted">{t.mapLoading}</p>}>
            <MiniMap regionId={regionId} center={center} zoom={11.8} markers={markers} heat={heat} label={t.clusterMap} onMarker={openFromMap} />
          </Suspense>
        </div>
        <p className="dk-sw-fine">
          {t.clusterMap} · {t.simData}
        </p>
      </div>
      <div className="dk-sw-cl-list">
        {forming && forming.ids.length < WORLD.clusterMin && (
          <section className="dk-sw-forming" aria-label={t.forming}>
            <header>
              <Icon name="pulse" size={16} />
              <b>{t.forming}</b>
            </header>
            <p>{fill(t.formingBody, { have: forming.ids.length, need: WORLD.clusterMin, km: WORLD.clusterRadiusKm, place: place(forming.kecamatanId, forming.desaId) })}</p>
            <div className="dk-sw-prog" role="progressbar" aria-valuemin={0} aria-valuemax={WORLD.clusterMin} aria-valuenow={forming.ids.length} aria-label={t.forming}>
              <i style={{ transform: `scaleX(${forming.ids.length / WORLD.clusterMin})` }} />
            </div>
            <Button size="sm" variant="secondary" icon="plus" onClick={() => neighbourReport(world.get(), forming.center, forming.kecamatanId, forming.desaId)} data-sw="neighbour">
              {t.neighbour}
            </Button>
          </section>
        )}
        <h3 className="dk-sw-h3">{t.clusterList}</h3>
        {clusters.length ? (
          <ul className="dk-sw-clusters">
            {clusters.map((c) => (
              <li key={c.id}>
                <button type="button" className={`dk-sw-clcard${c.id === sel ? ' is-on' : ''}`} aria-pressed={c.id === sel} onClick={() => setSel(c.id)} data-sw="cluster">
                  <span className="dk-sw-clcard-top">
                    <Icon name="alert" size={15} />
                    <b>{place(c.kecamatanId, c.desaId)}</b>
                    <span className="dk-num">{c.id}</span>
                  </span>
                  <span className="dk-sw-muted">{fill(t.clusterOf, { n: c.complaintIds.length, km: c.radiusKm, time: hhmm(c.at).replace(':', '.') })}</span>
                </button>
                {c.id === sel && (
                  <div className="dk-sw-clmore">
                    <p className="dk-sw-label">{t.sentTo}</p>
                    <div className="dk-sw-links">
                      {TARGETS.map((p) => (
                        <button key={p} type="button" className="dk-sw-chip" onClick={() => go(p, c.id)}>
                          {fill(t.openIn, { product: PRODUCT_BY_SLUG[p].name })}
                          <Icon name="arrowUpRight" size={13} />
                        </button>
                      ))}
                    </div>
                    <ul className="dk-sw-clitems">
                      {c.complaintIds.map((id) => {
                        const x = complaints.byId[id]
                        return x ? (
                          <li key={id}>
                            <button type="button" onClick={() => openTicket(x.ticketId)}>
                              <b className="dk-num">{x.code}</b> {x.summary[lang]}
                            </button>
                          </li>
                        ) : null
                      })}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState compact art="map" title={t.clusterNone} body={fill(t.clusterNoneBody, { n: WORLD.clusterMin, km: WORLD.clusterRadiusKm })} />
        )}
      </div>
    </div>
  )
}
