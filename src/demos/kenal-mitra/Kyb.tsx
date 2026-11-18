/**
 * Mitra/Supplier (KYB) tab (lazy) — the KYB case of a business (kybCase): document strip NIB · NPWP · Akta (CV/PT) ·
 * Foto lokasi (SPESIMEN, kybSpecimens), "Mulai verifikasi" reads them in sequence (≤ 2.5 s), the cross-check matrix
 * (KybChecks), the owner's KYC, "Cek lokasi" (lazy map: NIB pin + photo GPS pin + 1 km ring + distance), the score
 * (100 − penalties, KYB_RULE) and the decision: Setujui ⇒ partner.verified kyb lolos (stamp "Terverifikasi", the
 * Katalog Lokal preview flips its badge) or Tandai cek manual ⇒ cek-manual (a mismatch never passes).
 */
import { lazy, memo, startTransition, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DocArt, DocViewer, DispositionStamp, simulateExtract, type SampleDoc } from '../../demo-kit/docs'
import { kybSpecimens, type KybSubject } from '../../demo-kit/docs/samples/permits'
import { preloadNow, useShell } from '../../demo-kit/shell'
import { Button, Icon, motionMode } from '../../demo-kit/ui'
import { Gauge } from '../../demo-kit/viz'
import { emit, shallowEqual, useClock, useSession, useWorld, type VerificationRequest } from '../../demo-kit/world'
import { KYB_RULE, catalogPreview, kecName, kybCase, vendorProfile, verificationOf } from '../../demo-kit/world/usaha-pintar'
import { CaseList } from './CaseList'
import { CatalogPreview } from './CatalogPreview'
import { KybChecks } from './KybChecks'
import { afterPaint, casesOf, clockText, reasonCtx, SLUG, type ReasonCheck } from './model'
import { useCaseStr } from './strings-case'

const loadMap = () => import('./LocationCheck')
const LocationCheck = lazy(loadMap)
const Viewer = memo(DocViewer)
type Kind = 'nib' | 'npwp' | 'akta' | 'lokasi'
/** per business: how far the analyst got (kept across tab switches for this page session) */
const runs = new Map<string, { read: boolean; map: boolean }>()
const ids = (a: VerificationRequest[]) => a.map((r) => `${r.id}:${r.status}:${r.priority ? 1 : 0}`).join('|')

export default function Kyb({ caseId, focusKey, onCase, onGoKyc }: { caseId: string | null; focusKey: number; onCase: (id: string) => void; onGoKyc: (requestId: string | null) => void }) {
  const shell = useShell()
  const now = useClock().minutes
  const cases = useWorld((s) => casesOf(s, 'kyb', now), (a, b) => ids(a) === ids(b))
  const hero = useWorld((s) => s.meta.facts.up?.kenalMitra.heroRequestId ?? null)
  const cur = cases.find((r) => r.id === caseId) ?? cases.find((r) => r.id === hero && r.status !== 'selesai') ?? cases.find((r) => r.status !== 'selesai') ?? cases[0] ?? null
  // pin the case on screen: a decision closes the request and must not swap the view to another case
  useEffect(() => {
    if (cur && cur.id !== caseId) onCase(cur.id)
  }, [cur, caseId, onCase])
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (focusKey && caseId) root.current?.scrollIntoView({ block: 'start', behavior: motionMode() === 'full' ? 'smooth' : 'auto' })
  }, [focusKey, caseId])
  return (
    <div ref={root} className="dk-km-case is-kyb">
      <CaseList cases={cases} cur={cur?.id ?? null} onPick={onCase} sm={shell.size === 'sm'} />
      {cur && <KybCase key={cur.id} req={cur} onGoKyc={onGoKyc} />}
    </div>
  )
}

function KybCase({ req, onGoKyc }: { req: VerificationRequest; onGoKyc: (requestId: string | null) => void }) {
  const { c, lang } = useCaseStr()
  const k = c.kyb
  const shell = useShell()
  const sm = shell.size === 'sm'
  const { regionId } = useSession()
  const seed = useWorld((s) => s.seed)
  const bizId = req.subjectId
  const kc = useWorld((s) => kybCase(s, bizId))
  const prof = useWorld((s) => vendorProfile(s, bizId))
  const biz = useWorld((s) => s.businesses.byId[bizId] ?? null)
  const kecOfBiz = useWorld((s) => (biz ? kecName(s, biz.kecamatanId) : ''))
  const photoKec = useWorld((s) => (kc ? kecName(s, kc.gps.photoKecamatanId) : ''))
  const needCode = useWorld((s) => (req.needId ? (s.catalogNeeds.byId[req.needId]?.code ?? null) : null))
  const verdict = useWorld((s) => {
    const v = verificationOf(s, bizId)
    return v && v.kind === 'kyb' && v.at >= 0 ? { result: v.result, score: v.score, at: v.at } : null
  }, shallowEqual)
  // the owner's KYC request (Joko Prasetyo's KTP for the hero), to jump there when it is not done yet
  const ownerKycReq = useWorld((s) => {
    if (!biz) return null
    for (const id of s.verificationRequests.ids) {
      const r = s.verificationRequests.byId[id]
      const d = r?.kind === 'kyc' ? s.documents.byId[r.subjectId] : undefined
      if (r && d && d.ownerName === biz.ownerName) return r.id
    }
    return null
  })
  const preview = useWorld((s) => catalogPreview(s, bizId))
  const region = useWorld((s) => s.region)
  const kecOf = useCallback((id: string) => region.kecamatan.find((x) => x.id === id)?.name ?? id, [region])
  const match = useWorld((s) => {
    for (const id of s.matches.ids) {
      const m = s.matches.byId[id]
      if (!m || m.businessId !== bizId) continue
      const n = s.catalogNeeds.byId[m.needId]
      if (!n || (n.status !== 'baru' && n.status !== 'dicocokkan')) continue
      const it = n.items.find((i) => biz?.supplies.includes(i.category)) ?? n.items[0]
      return it ? `${n.code}\u0001${it.name.id}\u0001${it.name.en}` : null
    }
    return null
  })

  // the specimens of this business (vendorProfile = the one source of NIB / NPWP / akta / address)
  const docs = useMemo(() => {
    if (!kc || !prof || !biz) return [] as { kind: Kind; doc: SampleDoc }[]
    const subj: KybSubject = {
      id: biz.id, name: biz.name, owner: biz.ownerName, legal: prof.legal, address: prof.address, kecamatan: kecOfBiz, kbli: prof.kbli.map((x) => x.code).join(', '),
      nib: prof.nib, npwp: prof.npwp, since: biz.since, coord: biz.coord, photoCoord: kc.gps.photo, akta: prof.akta,
    }
    const sp = kybSpecimens(subj, kc.mismatch ? { mismatch: kc.mismatch } : {})
    // kit workaround: the site photo's house is drawn too short for its fixed-size door (negative <rect> height)
    sp.lokasi = { ...sp.lokasi, shapes: sp.lokasi.shapes.map((x) => (x.t === 'house' && x.h * 0.62 < 270 ? { ...x, y: x.y - 30, h: 440 } : x)) }
    return kc.docs.map((d) => ({ kind: d.kind as Kind, doc: (d.kind === 'akta' ? sp.akta : sp[d.kind as 'nib' | 'npwp' | 'lokasi'])! })).filter((x) => !!x.doc)
  }, [kc, prof, biz, kecOfBiz])

  const saved = runs.get(bizId) ?? { read: !!verdict, map: !!verdict }
  const [read, setRead] = useState(saved.read)
  const [mapOn, setMapOn] = useState(saved.map)
  const [reading, setReading] = useState<number | null>(null)
  const [view, setView] = useState(0)
  const [active, setActive] = useState<string | null>(null)
  useEffect(() => {
    runs.set(bizId, { read, map: mapOn })
  }, [bizId, read, mapOn])
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach((x) => window.clearTimeout(x)), [])
  const start = () => {
    timers.current.forEach((x) => window.clearTimeout(x))
    timers.current = []
    setRead(false)
    const n = docs.length || 1
    const step = motionMode() === 'static' ? 120 : Math.floor(2400 / n)
    for (let i = 0; i < n; i++)
      timers.current.push(
        window.setTimeout(() => {
          setReading(i)
          setView(i)
        }, i * step),
      )
    timers.current.push(
      window.setTimeout(() => {
        setReading(null)
        setRead(true)
        setView(0)
      }, n * step),
    )
    preloadNow(loadMap)
  }
  const cur = docs[view] ?? docs[0]
  const extracted = useMemo(() => (cur && reading !== null ? simulateExtract(cur.doc, { lang }) : null), [cur, reading, lang])

  const ready = read && mapOn
  const lolos = kc?.result === 'lolos'
  const [deciding, setDeciding] = useState(false)
  const decide = (result: 'lolos' | 'cek-manual') => {
    if (!kc || deciding) return
    setDeciding(true)
    afterPaint(() => emit('partner.verified', { subjectKind: 'business', subjectId: bizId, kind: 'kyb', result, score: kc.score }, SLUG))
  }

  // "Tanya alasan" reads the case on screen
  useEffect(() => {
    if (!kc) return
    const checks: ReasonCheck[] = read ? kc.matrix.map((m) => ({ label: m.label, ok: m.ok })) : []
    if (read && mapOn) checks.push({ label: { id: 'Lokasi (GPS foto)', en: 'Location (photo GPS)' }, ok: kc.distanceKm <= KYB_RULE.manualKm, note: { id: `${kc.distanceKm} km`, en: `${kc.distanceKm} km` } })
    reasonCtx.set({ kind: 'kyb', code: req.code, subject: biz?.name ?? '', checks, score: kc.score, decision: kc.result, decided: !!verdict, distanceKm: mapOn ? kc.distanceKm : undefined })
  })

  if (!kc || !biz || !prof) return null
  const km = kc.distanceKm.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US')
  const far = kc.distanceKm > KYB_RULE.manualKm
  const [mCode, mId, mEn] = match ? match.split('\u0001') : []

  return (
    <section className="dk-km-kyb" aria-label={biz.name}>
      <header className="dk-km-case-h">
        <span className="dk-km-code dk-num">{req.code}</span>
        <b>{biz.name}</b>
        <span className="dk-km-muted">
          {c.requestedBy(req.requestedBy)} · {prof.legal} · Kec. {kecOfBiz}
        </span>
        {req.priority && needCode && (
          <span className="dk-km-prio">
            <Icon name="flag" size={12} />
            {needCode}
          </span>
        )}
      </header>

      <div className="dk-km-kyb-grid">
        <div className="dk-km-kyb-docs">
          <h4>{k.docs}</h4>
          <div className="dk-km-strip" role="group" aria-label={k.docs}>
            {docs.map((d, i) => (
              <button key={d.kind} type="button" className={`dk-km-thumb${i === view ? ' is-on' : ''}${reading === i ? ' is-reading' : ''}`} aria-current={i === view ? 'true' : undefined} onClick={() => setView(i)} data-doc={d.kind}>
                <DocArt doc={d.doc} label={d.doc.title[lang]} />
                <span>{k.kinds[d.kind]}</span>
              </button>
            ))}
          </div>
          {cur && (
            <Viewer
              doc={cur.doc}
              boxes={extracted?.fields}
              revealBoxes={reading !== null}
              replay={`${reading}`}
              activeKey={active}
              onBoxFocus={setActive}
              label={cur.doc.title[lang]}
              height={sm ? '260px' : 'clamp(260px, 40vh, 420px)'}
            >
              {verdict && view === 0 && (
                <DispositionStamp show heading={verdict.result === 'lolos' ? k.stamp : k.stampManual} lines={k.stampLines(verdict.score, clockText(verdict.at, lang))} x={64} y={30} width={40} />
              )}
            </Viewer>
          )}
          <div className="dk-km-row">
            <Button variant={read ? 'quiet' : 'primary'} icon={read ? 'refresh' : 'play'} onClick={start} busy={reading !== null} disabled={!!verdict} data-km="start" onPointerEnter={() => preloadNow(loadMap)}>
              {read ? k.restart : k.start}
            </Button>
            {reading !== null && (
              <span className="dk-km-muted" aria-live="polite">
                {k.reading(k.kinds[docs[reading]?.kind ?? 'nib'] ?? '')}
              </span>
            )}
          </div>
        </div>

        <div className="dk-km-kyb-side">
          {read ? (
            <KybChecks matrix={kc.matrix} kinds={kc.docs.map((d) => d.kind as Kind)} lang={lang} title={k.matrix} kindLabel={k.kinds} cell={k.cell} compact={sm} />
          ) : (
            <p className="dk-km-empty">{k.mapLocked}</p>
          )}
          {read && (
            <p className={`dk-km-owner ${kc.owner.kycDone ? 'is-ok' : 'is-wait'}`}>
              <Icon name={kc.owner.kycDone ? 'checkCircle' : 'user'} size={14} />
              <span>{kc.owner.kycDone ? k.ownerOk(kc.owner.name) : k.ownerTodo(kc.owner.name)}</span>
              {!kc.owner.kycDone && ownerKycReq && (
                <button type="button" className="dk-km-linkbtn" onClick={() => onGoKyc(ownerKycReq)}>
                  {k.ownerInline}
                </button>
              )}
            </p>
          )}
          <div className="dk-km-row">
            <Button variant={mapOn ? 'quiet' : read ? 'primary' : 'quiet'} icon="map" disabled={!read || mapOn} aria-describedby={!read ? `km-map-${req.id}` : undefined} onClick={() => startTransition(() => setMapOn(true))} onPointerEnter={() => preloadNow(loadMap)} onFocus={() => preloadNow(loadMap)} data-km="map-check">
              {k.mapCheck}
            </Button>
            {!read && (
              <span id={`km-map-${req.id}`} className="dk-km-why">
                {k.mapLocked}
              </span>
            )}
          </div>
          {mapOn && (
            <Suspense fallback={<div className="dk-km-map is-loading">{k.mapLoading}</div>}>
              <LocationCheck
                regionId={regionId}
                nib={kc.gps.nib}
                photo={kc.gps.photo}
                distanceKm={kc.distanceKm}
                far={far}
                labels={{ title: k.mapTitle, pinNib: k.pinNib(biz.name), pinPhoto: `${k.pinPhoto} · Kec. ${photoKec}`, ring: k.ring, distance: k.distance(km), verdict: far ? k.far : k.near }}
              />
            </Suspense>
          )}
          {ready && (
            <div className="dk-km-score">
              <Gauge
                seed={seed}
                title={k.score}
                value={kc.score}
                min={0}
                max={100}
                bands={[
                  { from: 0, to: KYB_RULE.pass, tone: 'warn', label: k.result['cek-manual'] },
                  { from: KYB_RULE.pass, to: 100, tone: 'accent', label: k.result.lolos },
                ]}
                size={140}
                summary={`${k.score}: ${kc.score} · ${k.result[kc.result]}`}
              />
              <div>
                <b className={`dk-km-result is-${kc.result}`}>{k.result[kc.result]}</b>
                <p className="dk-km-muted">{k.rule(KYB_RULE.kmPoints, KYB_RULE.kmCap, KYB_RULE.perMismatch, KYB_RULE.pass)}</p>
              </div>
            </div>
          )}
          {verdict ? (
            <div className="dk-km-done" role="status">
              <p>
                <Icon name={verdict.result === 'lolos' ? 'checkCircle' : 'alert'} size={16} />
                {verdict.result === 'lolos' ? k.doneOk(biz.name) : k.doneManual(biz.name)}
              </p>
              {verdict.result === 'lolos' && (
                <>
                  <p className="dk-km-muted">{k.previewNote}</p>
                  <CatalogPreview lang={lang} needs={preview.needs} suppliers={preview.suppliers} highlightId={bizId} match={mCode ? { code: mCode, item: (lang === 'id' ? mId : mEn) ?? '' } : null} kecName={kecOf} className="is-inline" />
                </>
              )}
            </div>
          ) : (
            <div className={`dk-km-decbar${sm ? ' is-sticky' : ''}`}>
              <Button variant={lolos ? 'quiet' : 'primary'} icon="flag" disabled={!ready || lolos} aria-describedby={`km-why-${req.id}`} onClick={() => decide('cek-manual')} data-km="manual">
                {k.manual}
              </Button>
              <Button variant="primary" icon="check" disabled={!ready || !lolos} aria-describedby={`km-why-${req.id}`} busy={deciding} onClick={() => decide('lolos')} data-km="approve">
                {k.approve}
              </Button>
              <span id={`km-why-${req.id}`} className="dk-km-why">
                {!ready ? k.approveLocked : lolos ? k.manualNo : k.approveNo}
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
