/**
 * siaga-wilayah/Alerts.tsx — tab "Peringatan" (eager): this morning's situation (rain forecast + river gauge,
 * simulated readings at the real gauge site), the active flood warnings (level 1–4, broadcast status, "Terkonfirmasi
 * warga"), the live flood reports from Sapa Warga and the shelters. Role: Kepala Daerah gets an executive summary,
 * Dinas Pertanian reads (no send control is rendered for it).
 */
import { useEffect, useRef } from 'react'
import { Button, EmptyState, Icon, flashNewRow } from '../../demo-kit/ui'
import { emit, onEvent, rows, useClock, useSession, useWorld, world, type Alert, type WorldState } from '../../demo-kit/world'
import { canSend, clockText, confirmedIds, floodAlerts, floodClusterSize, floodReports, phonesReached, riverGauge, shelters, swRole } from './data'
import { S, levelKey, nf, useT } from './strings'
import { mapRef, revealMap, ui, useUi } from './ui'

const rainSummary = (s: WorldState) => {
  const c = rows(s.rainCells)
  if (!c.length) return null
  return { n: c.length, peak: Math.max(...c.map((x) => x.intensity)) }
}
const rainKec = (s: WorldState) => s.region.floodKecamatanIds.map((id) => s.region.kecamatan.find((k) => k.id === id)?.name ?? id).slice(0, 3).join(', ')

export function Alerts() {
  const { t } = useT()
  const role = swRole(useSession().role)
  return (
    <div className="dk-sg-tab">
      {role === 'kepala-daerah' && <Exec />}
      <Situation />
      <AlertList role={role} />
      <Reports />
      <Shelters />
      {role === 'pertanian' && <p className="dk-sg-note">{t('readOnly')}</p>}
    </div>
  )
}

/* ------------------------------------------------------------------ executive summary (Kepala Daerah) */
function Exec() {
  const { lang, t } = useT()
  const alerts = useWorld((s) => floodAlerts(s).length)
  const impact = useUi((s) => s.impact6)
  const phones = useWorld(phonesReached)
  const occ = useWorld((s) => shelters(s).reduce((n, f) => n + f.occupied, 0))
  const cells: [string, string][] = [
    [nf(alerts, lang), t('execAlerts')],
    [impact ? nf(Math.round(impact.people / 100) * 100, lang) : '—', t('execPeople')],
    [nf(occ, lang), t('execShelter')],
    [nf(phones, lang), t('execPhones')],
  ]
  return (
    <section className="dk-sg-card dk-sg-exec" aria-label={t('exec')}>
      <h3 className="dk-sg-h">{t('exec')}</h3>
      <dl className="dk-sg-kpis">
        {cells.map(([v, l]) => (
          <div key={l}>
            <dd className="dk-num">{v}</dd>
            <dt>{l}</dt>
          </div>
        ))}
      </dl>
      <p className="dk-sg-fine">{t('hudNote')}</p>
    </section>
  )
}

/* ------------------------------------------------------------------ situation: rain + river */
function Situation() {
  const { lang, t } = useT()
  const rain = useWorld(rainSummary, (a, b) => a?.n === b?.n && a?.peak === b?.peak)
  const kec = useWorld(rainKec)
  const g = useWorld(riverGauge)
  const hist = g?.history ?? []
  const lo = Math.min(...hist, g?.normal ?? 0) - 0.3
  const hi = Math.max(...hist, g?.awas ?? 1) + 0.2
  const W = 220
  const H = 44
  const x = (i: number) => (i / Math.max(1, hist.length - 1)) * W
  const y = (v: number) => H - ((v - lo) / (hi - lo || 1)) * H
  const d = hist.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  return (
    <section className="dk-sg-card" aria-labelledby="sw-sit">
      <h3 className="dk-sg-h" id="sw-sit">
        <Icon name="rain" size={16} />
        {t('situation')}
      </h3>
      <p>{rain ? t('rainOn', { n: rain.n, peak: nf(rain.peak, lang), kec }) : t('rainNone')}</p>
      {g && (
        <div className="dk-sg-gauge">
          <div>
            <p className="dk-sg-muted">
              {t('gauge')} · {g.name}
            </p>
            <p className="dk-num">{t('gaugeOf', { v: nf(g.level, lang, 2), s: nf(g.siaga, lang, 1), a: nf(g.awas, lang, 1) })}</p>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="dk-sg-spark" role="img" aria-label={`${t('gauge')} 24 h: ${nf(hist[0] ?? 0, lang, 2)} → ${nf(g.level, lang, 2)} m`}>
            <line x1="0" x2={W} y1={y(g.siaga)} y2={y(g.siaga)} className="is-siaga" />
            <line x1="0" x2={W} y1={y(g.awas)} y2={y(g.awas)} className="is-awas" />
            <path d={d} />
          </svg>
          <p className="dk-sg-fine">{t('gaugeSim')}</p>
        </div>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ active warnings */
function AlertList({ role }: { role: ReturnType<typeof swRole> }) {
  const { lang, t } = useT()
  const alerts = useWorld(floodAlerts)
  const flash = useUi((s) => s.flash)
  const ran = useUi((s) => s.ran)
  const send = canSend(role)
  const listRef = useRef<HTMLUListElement>(null)
  useEffect(() => {
    if (!flash) return
    const el = listRef.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(flash)}"]`)
    if (!el) return
    el.scrollIntoView({ block: 'nearest' })
    return flashNewRow(el)
  }, [flash, alerts])
  return (
    <section className="dk-sg-card" aria-labelledby="sw-al">
      <h3 className="dk-sg-h" id="sw-al">
        <Icon name="alert" size={16} />
        {t('alerts')}
      </h3>
      {alerts.length ? (
        <ul className="dk-sg-alerts" ref={listRef}>
          {alerts.map((a) => (
            <AlertRow key={a.id} a={a} lang={lang} canSend={send} />
          ))}
        </ul>
      ) : (
        <EmptyState
          compact
          art="map"
          title={t('noAlerts')}
          body={send ? t('noAlertsHint') : t('readOnly')}
          action={send && ran ? { label: t('ctaSend'), icon: 'send', onClick: () => ui.set({ broadcastOpen: true }) } : undefined}
        />
      )}
    </section>
  )
}

function AlertRow({ a, lang, canSend: send }: { a: Alert; lang: 'id' | 'en'; canSend: boolean }) {
  const { t } = useT()
  const nConf = a.confirmedBy?.length ?? 0
  const lv = levelKey(a.level)
  return (
    <li className={`dk-sg-alert is-l${a.level}`} data-id={a.id}>
      <button type="button" className="dk-sg-alert-main" onClick={() => {
        if (!a.kecamatanIds[0]) return
        revealMap()
        mapRef.current?.fitKecamatan(a.kecamatanIds[0])
      }}>
        <span className="dk-sg-lv">
          {t('level')} {a.level} · {S[lv][lang]}
        </span>
        <strong>{a.title[lang]}</strong>
        <span className="dk-sg-muted">
          {t('issued', { t: clockText(a.at, lang) })}
          {a.expectedAt !== null ? ` · ${t('expected', { t: clockText(a.expectedAt, lang) })}` : ''}
        </span>
      </button>
      <div className="dk-sg-alert-foot">
        {a.broadcast ? (
          <span className="dk-sg-sent">
            <Icon name="check" size={12} />
            {t('sentTo', { n: nf(a.broadcast.recipients, lang), ch: a.broadcast.channels.join(', ').toUpperCase() })}
          </span>
        ) : send ? (
          <Button size="sm" variant="secondary" icon="send" onClick={() => ui.set({ broadcastOpen: true, draft: { level: a.level, message: '', channels: ['wa', 'sms'], areas: a.kecamatanIds.map((k) => world.get().region.kecamatan.find((x) => x.id === k)?.name ?? k) } })}>
            {t('sendNow')}
          </Button>
        ) : (
          <span className="dk-sg-muted">{t('notSent')}</span>
        )}
        {nConf > 0 && (
          <span className="dk-sg-okbadge">
            <Icon name="check" size={12} />
            {t('confirmed')} · {nConf}
          </span>
        )}
      </div>
    </li>
  )
}

/* ------------------------------------------------------------------ flood reports from Sapa Warga */
function Reports() {
  const { lang, t } = useT()
  const reports = useWorld(floodReports)
  const confirmed = useWorld(confirmedIds)
  const cluster = useWorld(floodClusterSize)
  const { minutes } = useClock()
  const listRef = useRef<HTMLUListElement>(null)
  // a new flood report from anywhere (Sapa Warga, natural events, this page) slides in + flashes
  useEffect(
    () =>
      onEvent('complaint.created', (e) => {
        if (e.payload.category !== 'banjir') return
        requestAnimationFrame(() => {
          const el = listRef.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(e.payload.id ?? '')}"]`)
          if (el) flashNewRow(el, { slide: true })
        })
      }),
    [],
  )
  // two more reports next to the overnight ones near the persona's village ⇒ ≥ 5 within 1 km ⇒ the world clusters them
  const simulate = () => simulateReports()
  const shown = reports.slice(0, 6)
  return (
    <section className="dk-sg-card" aria-labelledby="sw-rp">
      <h3 className="dk-sg-h" id="sw-rp">
        <Icon name="chat" size={16} />
        {t('reports')}
        <span className="dk-sg-count dk-num">{reports.length}</span>
      </h3>
      {cluster >= 5 && <p className="dk-sg-okline">{t('reportsCluster', { n: cluster })}</p>}
      {shown.length ? (
        <ul className="dk-sg-reports" ref={listRef} aria-live="polite">
          {shown.map((c) => (
            <li key={c.id} data-id={c.id}>
              <button type="button" onClick={() => {
                revealMap()
                ui.set({ picked: { layer: 'reports', id: c.id } })
                mapRef.current?.flyTo(c.coord, 12.5)
              }}>
                <span className="dk-sg-time dk-num">{minutes - c.at < 3 && c.at <= minutes ? t('now') : clockText(c.at, lang)}</span>
                <span className="dk-sg-rtext">
                  <strong>{c.code}</strong> {c.summary[lang]}
                </span>
                {confirmed.has(c.id) && (
                  <span className="dk-sg-okbadge" title={t('confirmed')}>
                    <Icon name="check" size={12} />
                    <span className="dk-sg-sr">{t('confirmed')}</span>
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dk-sg-muted">{t('reportsNone')}</p>
      )}
      {cluster < 5 && (
        <div className="dk-sg-simrow">
          <Button size="sm" variant="ghost" icon="plus" onClick={simulate} data-sw="sim-reports">
            {t('reportsSim')}
          </Button>
          <span className="dk-sg-fine">{t('reportsSimHint')}</span>
        </div>
      )}
    </section>
  )
}

/** two flood reports next to the newest report cluster seed (same desa, ≤ 400 m) — a flow-test control, labelled so */
let simSeq = 0
function simulateReports() {
  const s = world.get()
  const seeds = floodReports(s).filter((c) => c.kecamatanId === (s.region.floodKecamatanIds[0] ?? c.kecamatanId))
  const base = seeds[0] ?? floodReports(s)[0]
  if (!base) return
  const zone = rows(s.citizens).filter((c) => c.desaId === base.desaId && c.id !== s.meta.personas.siti)
  const TEXT = [
    { text: 'Banyu kali wis mlebu omah, dhuwure sak dengkul. Nyuwun tulung.', summary: { id: 'Air sungai masuk rumah setinggi lutut, warga minta bantuan.', en: 'River water entered homes knee-deep; residents ask for help.' } },
    { text: 'Dalan desa kebanjiran, bocah-bocah ora iso sekolah.', summary: { id: 'Jalan desa tergenang, anak-anak tidak bisa ke sekolah.', en: 'Village road flooded; children cannot get to school.' } },
  ]
  TEXT.forEach((x, i) => {
    const k = ++simSeq
    const dx = (i ? -1 : 1) * 0.0018 * (1 + (k % 3) * 0.2)
    const dy = (i ? 1 : -1) * 0.0012
    emit(
      'complaint.created',
      {
        citizenId: zone[(k * 3) % Math.max(1, zone.length)]?.id ?? null, category: 'banjir', channel: 'wa', text: x.text, lang: 'jv', summary: x.summary,
        kecamatanId: base.kecamatanId, desaId: base.desaId, coord: [base.coord[0] + dx, base.coord[1] + dy], urgency: 'tinggi',
      },
      'siaga-wilayah',
    )
  })
}

/* ------------------------------------------------------------------ shelters */
function Shelters() {
  const { lang, t } = useT()
  const list = useWorld(shelters)
  const facOn = useUi((x) => x.layers.facilities)
  const occ = list.reduce((n, f) => n + f.occupied, 0)
  const cap = list.reduce((n, f) => n + f.capacity, 0)
  return (
    <section className="dk-sg-card" aria-labelledby="sw-sh">
      <h3 className="dk-sg-h" id="sw-sh">
        <Icon name="home" size={16} />
        {t('shelters')}
      </h3>
      <p>{occ ? t('sheltersOf', { o: nf(occ, lang), c: nf(cap, lang), n: list.filter((f) => f.occupied).length }) : t('sheltersIdle', { n: list.length })}</p>
      {occ > 0 && (
        <div className="dk-sg-meter" role="img" aria-label={`${Math.round((occ / Math.max(1, cap)) * 100)} %`}>
          <span style={{ transform: `scaleX(${Math.min(1, occ / Math.max(1, cap))})` }} />
        </div>
      )}
      <Button size="sm" variant="ghost" icon="pin" aria-pressed={facOn} onClick={() => {
        if (!facOn) revealMap()
        ui.layer('facilities', !facOn)
      }}>
        {facOn ? t('hideOnMap') : t('showOnMap')}
      </Button>
    </section>
  )
}
