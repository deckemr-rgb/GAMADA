/**
 * siaga-wilayah/Alerts.tsx — tab "Peringatan" (eager): this morning's situation (rain forecast + river gauge,
 * simulated readings at the real gauge site), the active flood warnings (level 1–4, broadcast status, "Terkonfirmasi
 * warga"), the live flood reports from Sapa Warga and the shelters. Role: Kepala Daerah gets an executive summary,
 * Dinas Pertanian reads (no send control is rendered for it).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { ROLES } from '../../content/products'
import { Button, EmptyState, Icon, flashNewRow } from '../../demo-kit/ui'
import { currentRegion, emit, naturalEventsOn, onEvent, rows, useClock, useSession, useWorld, world, type Alert, type Complaint, type RegionalLang, type WorldState } from '../../demo-kit/world'
import AppLink from '../../components/AppLink'
import { FC_T0, RIVER_CREST_AT, SHELTER_SHARE, allGauges, canSend, clockText, confirmedIds, dayPart, floodAlerts, floodClusterSize, floodReports, gaugeName, gaugeNow, levelState, phonesReached, productHref, riverLevelAt, shelterOcc, shelters, swRole } from './data'
import { S, levelKey, nf, useT, type Bi } from './strings'
import { mapRef, revealMap, ui, useUi } from './ui'

const rainSummary = (s: WorldState) => {
  const c = rows(s.rainCells)
  if (!c.length) return null
  return { n: c.length, peak: Math.max(...c.map((x) => x.intensity)) }
}
const rainKec = (s: WorldState) => s.region.floodKecamatanIds.map((id) => s.region.kecamatan.find((k) => k.id === id)?.name ?? id).slice(0, 3).join(', ')

export function Alerts({ sm = false }: { sm?: boolean }) {
  const { t } = useT()
  const role = swRole(useSession().role)
  return (
    <div className="dk-sg-tab">
      {/* phones: the summary sits right under the map instead (index.tsx) */}
      {role === 'kepala-daerah' && !sm && <Exec />}
      <Situation />
      <AlertList role={role} />
      <Reports />
      <Shelters />
      {role === 'pertanian' && <p className="dk-sg-note">{t('readOnly')}</p>}
    </div>
  )
}

/* ------------------------------------------------------------------ executive summary (Kepala Daerah) */
export function Exec({ compact = false }: { compact?: boolean }) {
  const { lang, t } = useT()
  const alerts = useWorld(floodAlerts)
  const i6 = useUi((s) => s.impact6)
  const now = useUi((s) => s.impact)
  const ran = useUi((s) => s.ran)
  const impact = i6 ?? (ran ? now : null)
  const phones = useWorld(phonesReached)
  const { minutes } = useClock()
  const occ = useWorld((s) => shelters(s).reduce((n, f) => n + shelterOcc(s, f, minutes), 0))
  // people of the forecast zone that fall inside a warning zone (same model rows, same rounding)
  const warned = useMemo(() => {
    if (!impact || !alerts.length) return null
    const kec = new Set(alerts.flatMap((a) => a.kecamatanIds))
    return impact.desa.reduce((n, d) => (kec.has(d.kecamatanId) ? n + d.people : n), 0)
  }, [impact, alerts])
  const r100 = (n: number) => nf(Math.round(n / 100) * 100, lang)
  const cells: [string, string][] = [
    [nf(alerts.length, lang), t('execAlerts')],
    [impact ? r100(impact.people) : '—', t('execPeople')],
    [warned !== null ? r100(warned) : '—', t('execWarned')],
    [nf(occ, lang), t('execShelter')],
  ]
  const pct = impact && warned !== null && impact.people ? Math.round((warned / impact.people) * 100) : null
  return (
    <section className={`dk-sg-card dk-sg-exec${compact ? ' is-compact' : ''}`} aria-label={t('exec')}>
      <h3 className="dk-sg-h">{t('exec')}</h3>
      <dl className="dk-sg-kpis">
        {cells.map(([v, l]) => (
          <div key={l}>
            <dd className="dk-num">{v}</dd>
            <dt>{l}</dt>
          </div>
        ))}
      </dl>
      <p className="dk-sg-fine">
        {pct !== null ? `${t('execCover', { p: pct })} ` : ''}
        {phones > 0 ? `${t('execPhones', { n: nf(phones, lang) })} ` : ''}
        {t('hudNote')}
      </p>
    </section>
  )
}

/* ------------------------------------------------------------------ situation: rain + water gauges */
function Situation() {
  const { lang, t } = useT()
  const rain = useWorld(rainSummary, (a, b) => a?.n === b?.n && a?.peak === b?.peak)
  const kec = useWorld(rainKec)
  const gauges = useWorld(allGauges)
  const session = useSession()
  const { minutes } = useClock()
  const hour = useUi((s) => s.hour)
  const pick = useUi((s) => s.gauge)
  const flash = useUi((s) => s.flash)
  const g = gauges.find((x) => x.id === pick) ?? gauges[0] ?? null
  const boxRef = useRef<HTMLDivElement>(null)
  // arrival with ?focus=<gauge id> (Radar Isu: the dam as evidence): bring the curve into view and flash it
  useEffect(() => {
    if (!flash || !g || flash !== g.id || !boxRef.current) return
    boxRef.current.scrollIntoView({ block: 'nearest' })
    return flashNewRow(boxRef.current)
  }, [flash, g])
  const river = g?.kind === 'sungai'
  const now = g ? gaugeNow(g, minutes) : null
  // the last 24 h up to the world clock (+ the 6-hour outlook, dashed) on the river; the dam shows its seeded day
  const hist = !g ? [] : river ? Array.from({ length: 25 }, (_, i) => riverLevelAt(g, minutes - (24 - i) * 60)) : g.history
  const fc = g && river ? Array.from({ length: 7 }, (_, i) => riverLevelAt(g, minutes + i * 60)) : []
  const all = [...hist, ...fc]
  const lo = Math.min(...all, g?.normal ?? 0) - 0.3
  const hi = Math.max(...all, g?.awas ?? 1) + 0.2
  const W = 220
  const H = 44
  const span = Math.max(1, hist.length - 1 + (fc.length ? fc.length - 1 : 0))
  const x = (i: number) => (i / span) * W
  const y = (v: number) => H - ((v - lo) / (hi - lo || 1)) * H
  const d = hist.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const dFc = fc.map((v, i) => `${i ? 'L' : 'M'}${x(hist.length - 1 + i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const stKey = (st: 'normal' | 'siaga' | 'awas') => (st === 'awas' ? 'lv3' : st === 'siaga' ? 'lv2' : 'gaugeNormal')
  // the slider is the 6-hour model run anchored at 07.00 (+6 h = 13.00), the same anchor as every arrival time
  const at = hour > 0 && g && river ? riverLevelAt(g, FC_T0 + hour * 60) : null
  return (
    <section className="dk-sg-card" aria-labelledby="sw-sit">
      <h3 className="dk-sg-h" id="sw-sit">
        <Icon name="rain" size={16} />
        {t(`sit_${dayPart(minutes)}`)}
        <span className="dk-sg-muted dk-num"> · {clockText(minutes, lang)}</span>
      </h3>
      <p>{minutes >= RIVER_CREST_AT ? t('rainDone') : rain ? t('rainOn', { n: rain.n, peak: nf(rain.peak, lang), kec }) : t('rainNone')}</p>
      {g && now && (
        <div className="dk-sg-gauge" ref={boxRef}>
          {gauges.length > 1 && (
            <div className="dk-sg-gpick" role="group" aria-label={t('gauge')}>
              {gauges.map((x) => {
                const st = gaugeNow(x, minutes).state
                return (
                  <button
                    key={x.id}
                    type="button"
                    aria-pressed={x.id === g.id}
                    onClick={() => {
                      ui.set({ gauge: x.id })
                      revealMap()
                      mapRef.current?.flyTo(x.coord, 11.5)
                    }}
                  >
                    <span className="dk-sg-gname">{x.kind === 'waduk' ? x.name : t('gaugeRiver')}</span>
                    <span className={`dk-sg-gst is-${st}`}>{t(stKey(st))}</span>
                  </button>
                )
              })}
            </div>
          )}
          <div>
            <p className="dk-sg-muted">
              {t('gauge')} · {gaugeName(g.name, lang)}
            </p>
            <p className="dk-num">
              {t('gaugeOf', { v: nf(now.level, lang, 2), s: nf(g.siaga, lang, 1), a: nf(g.awas, lang, 1) })}{' '}
              <span className={`dk-sg-gst is-${now.state}`}>{t(stKey(now.state))}</span>
            </p>
            {river && (
              <p className="dk-sg-outlook">
                {Math.abs(now.trend) >= 0.02 ? t(now.trend > 0 ? 'gaugeUp' : 'gaugeDown', { v: nf(Math.abs(now.trend), lang, 2) }) : t('gaugeFlat')}
                {now.peak.at > minutes ? ` · ${t('gaugePeak', { v: nf(now.peak.level, lang, 2), t: clockText(now.peak.at, lang), st: t(stKey(levelState(g, now.peak.level))) })}` : ''}
                {now.awasAt !== null ? ` · ${t('gaugeAwasAt', { t: clockText(now.awasAt, lang) })}` : ''}
              </p>
            )}
            {at !== null && g && minutes <= RIVER_CREST_AT && (
              <p className="dk-sg-fine dk-num">{t('gaugeAtH', { h: nf(hour, lang, hour % 1 ? 2 : 0), t: clockText(FC_T0 + hour * 60, lang), v: nf(at, lang, 2), st: t(stKey(levelState(g, at))) })}</p>
            )}
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="dk-sg-spark" role="img" aria-label={`${t('gauge')} ${gaugeName(g.name, lang)} 24 h: ${nf(hist[0] ?? 0, lang, 2)} → ${nf(now.level, lang, 2)} m${fc.length ? ` · +6 h ${nf(fc[fc.length - 1] ?? 0, lang, 2)} m` : ''}`}>
            <line x1="0" x2={W} y1={y(g.siaga)} y2={y(g.siaga)} className="is-siaga" />
            <line x1="0" x2={W} y1={y(g.awas)} y2={y(g.awas)} className="is-awas" />
            <path d={d} />
            {dFc && <path d={dFc} className="is-fc" />}
            <circle cx={x(hist.length - 1)} cy={y(now.level)} r="3" className="is-now" />
          </svg>
          <p className="dk-sg-fine">{river ? t('gaugeSimFc') : t('gaugeSim')}</p>
          {g.kind === 'waduk' && (
            <AppLink to={productHref('radar-isu', session)} className="dk-sg-link">
              {t('gaugeDamUse')} →
            </AppLink>
          )}
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
  const { minutes } = useClock()
  const basis = useUi((s) => s.basis[a.id])
  const nConf = a.confirmedBy?.length ?? 0
  const lv = levelKey(a.level)
  const arrived = a.expectedAt !== null && minutes >= a.expectedAt
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
          {a.expectedAt !== null ? ` · ${t(arrived ? 'expectedPast' : 'expected', { t: clockText(a.expectedAt, lang) })}` : ''}
        </span>
        {basis && (
          <span className="dk-sg-fine dk-sg-basis">
            {t('basis', {
              by: ROLES[basis.by as keyof typeof ROLES]?.name[lang] ?? basis.by,
              v: nf(basis.level, lang, 2),
              st: t(basis.state === 'awas' ? 'lv3' : basis.state === 'siaga' ? 'lv2' : 'gaugeNormal'),
              d: nf(basis.desa, lang),
              p: nf(Math.round(basis.people / 100) * 100, lang),
            })}
            {basis.awasAt !== null ? ` ${t('basisAwas', { t: clockText(basis.awasAt, lang) })}` : ''}
          </span>
        )}
      </button>
      <div className="dk-sg-alert-foot">
        {a.broadcast ? (
          <span className="dk-sg-sent">
            <Icon name="check" size={12} />
            {t('sentTo', { n: nf(a.broadcast.recipients, lang), ch: a.broadcast.channels.join(', ').toUpperCase() })}
          </span>
        ) : send ? (
          <Button size="sm" variant="secondary" icon="send" data-tour="sw-send-now" onClick={() => ui.set({ broadcastOpen: true, draft: { level: a.level, message: '', channels: ['wa', 'sms'], areas: a.kecamatanIds.map((k) => world.get().region.kecamatan.find((x) => x.id === k)?.name ?? k) } })}>
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
  const all = useWorld(floodReports)
  const confirmed = useWorld(confirmedIds)
  const cluster = useWorld(floodClusterSize)
  const { minutes } = useClock()
  // only what has come in by the world clock (a jump back to 06.00 hides the reports of 06.45)
  const reports = useMemo(() => all.filter((c) => c.at <= minutes), [all, minutes])
  // the same wording twice from one desa is flagged as a duplicate report (a real triage step), not hidden
  const dupOf = useMemo(() => {
    const m = new Map<string, string>()
    const first = new Map<string, Complaint>()
    for (const c of [...reports].reverse()) {
      const k = `${c.desaId}|${c.summary.id}`
      const f = first.get(k)
      if (f) m.set(c.id, f.code)
      else first.set(k, c)
    }
    return m
  }, [reports])
  const [more, setMore] = useState(false)
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
  const shown = more ? reports : reports.slice(0, 6)
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
                mapRef.current?.flyTo(c.coord, 11.5)
              }}>
                <span className="dk-sg-time dk-num">{minutes - c.at < 3 && c.at <= minutes ? t('now') : clockText(c.at, lang)}</span>
                <span className="dk-sg-rtext">
                  <strong>{c.code}</strong> {c.summary[lang]}
                  {dupOf.has(c.id) && <span className="dk-sg-dup"> · {t('dupOf', { c: dupOf.get(c.id)! })}</span>}
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
      {reports.length > 6 && (
        <Button size="sm" variant="ghost" icon={more ? 'chevronUp' : 'chevronDown'} aria-expanded={more} onClick={() => setMore((v) => !v)}>
          {more ? t('reportsLess') : t('reportsAll', { n: reports.length })}
        </Button>
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

/**
 * Flow step 3 from the guided CTA: the reports card in view, the reports layer on, two more simulated reports next
 * to the overnight ones (a labelled flow test) so the world clusters them and confirms the warning, map on the spot.
 */
export function confirmStep(): void {
  ui.set({ tab: 'alerts', panelOpen: true })
  ui.layer('reports', true)
  if (floodClusterSize(world.get()) < 5) simulateReports()
  requestAnimationFrame(() => {
    const s = world.get()
    const cl = rows(s.clusters).filter((c) => c.category === 'banjir').sort((a, b) => b.complaintIds.length - a.complaintIds.length)[0]
    const at = cl?.center ?? floodReports(s)[0]?.coord
    if (at) mapRef.current?.flyTo(at, 11)
    const el = document.getElementById('sw-rp')?.closest<HTMLElement>('.dk-sg-card')
    if (el) flashNewRow(el)
  })
}

/** two flood reports next to the newest report cluster seed (same desa, ≤ 400 m) — a flow-test control, labelled so */
let simSeq = 0
function simulateReports() {
  const s = world.get()
  const seeds = floodReports(s).filter((c) => c.kecamatanId === (s.region.floodKecamatanIds[0] ?? c.kecamatanId))
  const base = seeds[0] ?? floodReports(s)[0]
  if (!base) return
  const zone = rows(s.citizens).filter((c) => c.desaId === base.desaId && c.id !== s.meta.personas.siti)
  const TEXT: { text: RegText; summary: Bi }[] = [
    {
      text: { jv: 'Banyu kali wis mlebu omah, dhuwure sak dengkul. Nyuwun tulung.', su: 'Cai walungan geus asup ka imah, jerona satuur. Nyuhunkeun tulung.', min: 'Aia batang alah masuak rumah, tingginyo salutuik. Tolong bantu kami.' },
      summary: { id: 'Air sungai masuk rumah setinggi lutut, warga minta bantuan.', en: 'River water entered homes knee-deep; residents ask for help.' },
    },
    {
      text: { jv: 'Dalan desa kebanjiran, bocah-bocah ora iso sekolah.', su: 'Jalan lembur kabanjiran, barudak teu bisa sakola.', min: 'Jalan kampuang kabanjiran, anak-anak indak bisa pai ka sakola.' },
      summary: { id: 'Jalan desa tergenang, anak-anak tidak bisa ke sekolah.', en: 'Village road flooded; children cannot get to school.' },
    },
  ]
  TEXT.forEach((x0, i) => {
    const x = { ...x0, ...regional(x0.text, x0.summary.id) }
    const k = ++simSeq
    const dx = (i ? -1 : 1) * 0.0018 * (1 + (k % 3) * 0.2)
    const dy = (i ? 1 : -1) * 0.0012
    emit(
      'complaint.created',
      {
        citizenId: zone[(k * 3) % Math.max(1, zone.length)]?.id ?? null, category: 'banjir', channel: 'wa', text: x.text, lang: x.lang, summary: x.summary,
        kecamatanId: base.kecamatanId, desaId: base.desaId, coord: [base.coord[0] + dx, base.coord[1] + dy], urgency: 'tinggi',
      },
      'siaga-wilayah',
    )
  })
}

/**
 * The morning's flood reports as the world clock runs (scripted from the scenario: the water climbs along the river
 * through the morning and recedes in the afternoon). One report per slot, in the flood kecamatan, as if sent via
 * Sapa Warga. Fires only for minutes the running clock crosses (never for jumps), off in tour / presenter mode, and
 * never twice (the text is unique per slot). Simulated citizen reports.
 */
/** a report line in the region's own language (Basa Jawa / Sunda / Minang samples, marked "contoh" in the pack sense) */
type RegText = Partial<Record<'jv' | 'su' | 'min', string>>
/** the line in the running region's first regional language; a region without one gets the Indonesian line */
function regional(t: RegText | string, idText: string): { text: string; lang: RegionalLang | 'id' } {
  if (typeof t === 'string') return { text: t, lang: 'id' }
  const p = currentRegion()
  const code = p?.languages.regional[0]
  const river = p?.rivers.find((r) => r.id === p.scenario.floodRiverId)?.name ?? 'kali'
  const x = code && code in t ? t[code as keyof RegText] : undefined
  return x ? { text: x.replace('{river}', river), lang: code as RegionalLang } : { text: idText.replace('{river}', river), lang: 'id' }
}
const SCRIPT: { at: number; text: RegText | string; summary: Bi; urgency: 'tinggi' | 'sedang' }[] = [
  {
    at: 7 * 60 + 6, urgency: 'sedang',
    text: { jv: 'Banyu {river} wis munggah tekan dalan desa, durung mlebu omah. Warga wis ngangkati barang.', su: 'Cai {river} geus naek nepi ka jalan lembur, can asup ka imah. Warga geus ngangkatan barang.', min: 'Aia {river} alah naiak sampai ka jalan kampuang, alun masuak rumah. Warga alah mangangkek barang.' },
    summary: { id: 'Air {river} naik sampai jalan desa, belum masuk rumah; warga mulai mengangkat barang.', en: '{river} water has reached the village road, not yet inside homes; residents are moving belongings up.' },
  },
  { at: 7 * 60 + 19, urgency: 'sedang', text: 'Sawah di pinggir sungai sudah terendam semua, padi yang mau panen tenggelam.', summary: { id: 'Sawah di tepi sungai terendam seluruhnya, padi siap panen tenggelam.', en: 'Riverside paddies fully submerged, rice ready for harvest under water.' } },
  { at: 7 * 60 + 33, urgency: 'tinggi', text: 'Mohon perahu karet, ada lansia di RT 03 yang belum bisa keluar rumah.', summary: { id: 'Minta perahu karet: lansia di RT 03 belum bisa keluar rumah.', en: 'Rubber boat requested: an elderly resident in RT 03 cannot leave the house.' } },
  { at: 7 * 60 + 52, urgency: 'sedang', text: 'Air masuk halaman SD, murid dipulangkan lebih awal oleh guru.', summary: { id: 'Air masuk halaman SD, murid dipulangkan lebih awal.', en: 'Water in the primary school yard; pupils sent home early.' } },
  { at: 8 * 60 + 14, urgency: 'tinggi', text: { jv: 'Kreteg desa wis kelem, montor ora iso liwat. Dalan alternatif lewat tanggul.', su: 'Sasak lembur geus kakeueum, motor teu bisa liwat. Jalan alternatif ngaliwatan tanggul.', min: 'Jambatan kampuang alah tabanam, onda indak bisa lewat. Jalan lain lewat tanggua.' }, summary: { id: 'Jembatan desa terendam, motor tidak bisa lewat; jalur alternatif lewat tanggul.', en: 'Village bridge submerged, motorbikes cannot pass; detour along the embankment.' } },
  { at: 8 * 60 + 41, urgency: 'tinggi', text: { jv: 'Banyu wis sak dengkul neng njero omah, listrik dipateni dhewe.', su: 'Cai geus satuur di jero imah, listrik dipareuman ku sorangan.', min: 'Aia alah salutuik di dalam rumah, listrik dimatian surang.' }, summary: { id: 'Air selutut di dalam rumah, warga mematikan listrik sendiri.', en: 'Knee-deep water inside homes; residents switched off the power themselves.' } },
  { at: 9 * 60 + 20, urgency: 'sedang', text: 'Posko balai desa mulai penuh, butuh tikar, selimut dan air bersih.', summary: { id: 'Posko balai desa mulai penuh, butuh tikar, selimut, dan air bersih.', en: 'The village-hall shelter is filling up; mats, blankets and clean water needed.' } },
  { at: 10 * 60 + 5, urgency: 'tinggi', text: 'Air sudah sepinggang di jalan utama, warga mengungsi ke tanggul.', summary: { id: 'Air sepinggang di jalan utama, warga mengungsi ke tanggul.', en: 'Waist-deep water on the main road; residents moving to the embankment.' } },
  { at: 11 * 60 + 30, urgency: 'tinggi', text: { jv: 'Pak RT njaluk bantuan sega bungkus kanggo warga sing ngungsi neng langgar.', su: 'Pa RT menta bantuan sangu bungkus keur warga nu ngungsi di tajug.', min: 'Pak RT mintak bantuan nasi bungkuih untuak warga nan mangungsi di surau.' }, summary: { id: 'Ketua RT minta nasi bungkus untuk warga yang mengungsi di musala.', en: 'The RT head asks for meal packs for residents sheltering at the prayer house.' } },
  { at: 15 * 60 + 30, urgency: 'sedang', text: 'Air mulai surut dari halaman, di jalan masih selutut.', summary: { id: 'Air mulai surut dari halaman, di jalan masih selutut.', en: 'Water receding from yards, still knee-deep on the road.' } },
  { at: 16 * 60 + 40, urgency: 'sedang', text: 'Air sudah keluar dari rumah, warga mulai membersihkan lumpur. Butuh kaporit.', summary: { id: 'Air sudah keluar dari rumah, warga membersihkan lumpur; butuh kaporit.', en: 'Water has left the houses; residents clearing mud, chlorine needed.' } },
]
export function scriptedReport(minute: number): void {
  const i = SCRIPT.findIndex((x) => x.at === minute)
  if (i < 0 || !naturalEventsOn() || world.status() !== 'ready') return
  const x0 = SCRIPT[i]!
  const river = currentRegion()?.rivers.find((r) => r.id === currentRegion()?.scenario.floodRiverId)?.name ?? ''
  const x = { ...x0, ...regional(x0.text, x0.summary.id), summary: { id: x0.summary.id.replace('{river}', river || 'sungai'), en: x0.summary.en.replace('{river}', river || 'River') } }
  const s = world.get()
  if (rows(s.complaints).some((c) => c.text === x.text)) return
  const kecIds = s.region.floodKecamatanIds.length ? s.region.floodKecamatanIds : s.region.kecamatan.slice(0, 2).map((k) => k.id)
  const k = s.region.kecamatan.find((y) => y.id === kecIds[i % kecIds.length])
  if (!k || !k.desa.length) return
  const d = k.desa[(i * 3 + 1) % k.desa.length]!
  const j = ((i * 37) % 11) / 11 - 0.5
  const citizen = rows(s.citizens).find((c) => c.desaId === d.id && c.id !== s.meta.personas.siti)
  const base = citizen?.coord ?? d.centroid ?? [k.centroid[0] + j * 0.03, k.centroid[1] - j * 0.02]
  emit(
    'complaint.created',
    { citizenId: citizen?.id ?? null, category: 'banjir', channel: 'wa', text: x.text, lang: x.lang, summary: x.summary, kecamatanId: k.id, desaId: d.id, coord: [base[0] + j * 0.004, base[1] + j * 0.003], urgency: x.urgency },
    'sapa-warga',
  )
}

/* ------------------------------------------------------------------ shelters */
function Shelters() {
  const { lang, t } = useT()
  const list = useWorld(shelters)
  const session = useSession()
  const facOn = useUi((x) => x.layers.facilities)
  const i6 = useUi((x) => x.impact6)
  const { minutes } = useClock()
  // occupancy follows the world clock (evacuees keep arriving after the warning until a shelter is full)
  const occs = useWorld((s) => shelters(s).map((f) => shelterOcc(s, f, minutes)), (a, b) => a.length === b.length && a.every((v, i) => v === b[i]))
  const alerts = useWorld(floodAlerts)
  const occ = occs.reduce((n, v) => n + v, 0)
  const cap = list.reduce((n, f) => n + f.capacity, 0)
  const full = list.filter((f, i) => f.capacity > 0 && occs[i]! >= f.capacity).length
  // the warning zone's evacuation need against the shelter capacity (simulation assumption, said so)
  const warned = useMemo(() => {
    if (!i6 || !alerts.length) return 0
    const kec = new Set(alerts.flatMap((a) => a.kecamatanIds))
    return i6.desa.reduce((n, d) => (kec.has(d.kecamatanId) ? n + d.people : n), 0)
  }, [i6, alerts])
  const need = Math.round((warned * SHELTER_SHARE) / 100) * 100
  return (
    <section className="dk-sg-card" aria-labelledby="sw-sh">
      <h3 className="dk-sg-h" id="sw-sh">
        <Icon name="home" size={16} />
        {t('shelters')}
      </h3>
      <p>
        {occ ? t('sheltersOf', { o: nf(occ, lang), c: nf(cap, lang), n: occs.filter((v) => v > 0).length }) : t('sheltersIdle', { n: list.length })}
        {full > 0 && <span className="dk-sg-gst is-awas"> {t('sheltersFull', { n: full })}</span>}
      </p>
      {occ > 0 && (
        <div className="dk-sg-meter" role="img" aria-label={`${Math.round((occ / Math.max(1, cap)) * 100)} %`}>
          <span style={{ transform: `scaleX(${Math.min(1, occ / Math.max(1, cap))})` }} />
        </div>
      )}
      {need > cap && (
        <>
          <p className="dk-sg-fine dk-sg-need">{t('sheltersNeed', { need: nf(need, lang), c: nf(cap, lang), gap: nf(Math.round((need - cap) / 100) * 100, lang) })}</p>
          <AppLink to={productHref('katalog-lokal', session)} className="dk-sg-link">
            {t('sheltersGear')} →
          </AppLink>
        </>
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
