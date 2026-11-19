/**
 * siaga-wilayah/Broadcast.tsx — "Kirim peringatan dini" (lazy dialog), spec §11 P5 step 3.
 * Compose: level 1–4, area (kecamatan chips suggested by the flood model, whole kecamatan or only the affected desa),
 * channels, the message (template from the model, or "Susun dengan AI": sim scenario / Live proxy draft_alert),
 * the WA preview and the real recipient list (Camat + Kepala Desa / Lurah of every real desa, titles only, fictional
 * masked numbers). Send: flood.alert + alert.broadcast (source 'siaga-wilayah') → delivered / read ticks roll, the
 * citizens in the zone get the message on their phone in Sapa Warga (Ibu Siti among them), and the follow-ups the
 * world raised (pump package, bansos quota, shelters, Radar Isu topic …) are listed from the audit log.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { useAiChat } from '../../demo-kit/ai/chat'
import { Button, Chip, Icon, Modal, Segmented, Select, Textarea, useCountUp } from '../../demo-kit/ui'
import { useShell } from '../../demo-kit/shell'
import { regionalLanguageLabel } from '../../demo-kit/i18n'
import { PRODUCT_BY_SLUG, type ProductSlug } from '../../content/products'
import AppLink from '../../components/AppLink'
import { clock, emit, rows, settled, useSession, world, type AuditEntry } from '../../demo-kit/world'
import { alertRecipients, floodScenarioAlert, zoneCitizens } from '../../demo-kit/world/satu-daerah'
import { arrivalAt, chainText, clockText, draftLevel, floodAlerts, gaugeNow, levelState, productHref, recommendedKec, riverGauge, suggestedLevel, withSimMark } from './data'
import { draftAlert, geoContext } from './scenario'
import { fill, nf, type Bi } from './strings'
import { focusFloodArea } from './Timeline'
import { ensureDesa, impactAt, revealMap, ui, useUi } from './ui'
import './more.css'

const T = {
  title: { id: 'Kirim peringatan dini', en: 'Send an early warning' },
  desc: { id: 'Pilih level dan wilayah, periksa pratinjau WhatsApp, lalu kirim ke camat, kepala desa, dan warga di zona.', en: 'Pick the level and area, check the WhatsApp preview, then send to the district heads, village heads and residents in the zone.' },
  level: { id: 'Level peringatan', en: 'Warning level' },
  l1: { id: '1 Waspada', en: '1 Advisory' },
  l2: { id: '2 Siaga', en: '2 Watch' },
  l3: { id: '3 Awas', en: '3 Warning' },
  l4: { id: '4 Darurat', en: '4 Emergency' },
  area: { id: 'Wilayah', en: 'Area' },
  suggested: { id: 'Disarankan model (+6 j)', en: 'Suggested by the model (+6 h)' },
  addKec: { id: 'Tambah kecamatan lain', en: 'Add another district' },
  addPick: { id: 'Pilih kecamatan…', en: 'Choose a district…' },
  scope: { id: 'Cakupan', en: 'Scope' },
  scopeAll: { id: 'Seluruh desa', en: 'All villages' },
  scopeHit: { id: 'Desa terdampak ({n})', en: 'Affected villages ({n})' },
  channels: { id: 'Kanal', en: 'Channels' },
  ch_wa: { id: 'WhatsApp', en: 'WhatsApp' },
  ch_sms: { id: 'SMS', en: 'SMS' },
  ch_sirine: { id: 'Sirine desa', en: 'Village siren' },
  ch_radio: { id: 'Radio lokal', en: 'Local radio' },
  'ch_media-sosial': { id: 'Media sosial', en: 'Social media' },
  message: { id: 'Pesan', en: 'Message' },
  ai: { id: 'Susun dengan AI', en: 'Draft with AI' },
  aiBusy: { id: 'AI menyusun…', en: 'AI is drafting…' },
  aiDone: { id: 'Draf AI diterapkan · mode {m}', en: 'AI draft applied · {m} mode' },
  aiFell: { id: 'AI Live sedang sibuk, beralih ke Simulasi', en: 'Live AI is busy, switched to Simulation' },
  preview: { id: 'Pratinjau {c}', en: '{c} preview' },
  official: { id: 'BPBD {r} · akun demo (simulasi)', en: 'BPBD {r} · demo account (simulated)' },
  smsFrom: { id: 'SMS dari BPBD-{r} · demo (simulasi)', en: 'SMS from BPBD-{r} · demo (simulated)' },
  minOne: { id: 'Minimal satu kanal harus aktif.', en: 'At least one channel must stay on.' },
  recipients: { id: 'Penerima', en: 'Recipients' },
  rcptSum: { id: '{o} pejabat wilayah (jabatan, nomor fiktif) + {c} warga terdaftar Sapa Warga', en: '{o} local officials (titles, fictional numbers) + {c} residents registered in Sapa Warga' },
  more: { id: '+{n} penerima lain', en: '+{n} more recipients' },
  cancel: { id: 'Batal', en: 'Cancel' },
  send: { id: 'Kirim peringatan', en: 'Send warning' },
  approve: { id: 'Setujui & kirim', en: 'Approve & send' },
  sending: { id: 'Mengirim…', en: 'Sending…' },
  needArea: { id: 'Pilih minimal satu kecamatan.', en: 'Pick at least one district.' },
  sentTitle: { id: 'Peringatan terkirim', en: 'Warning sent' },
  delivered: { id: 'terkirim', en: 'delivered' },
  read: { id: 'dibaca', en: 'read' },
  phone: { id: 'HP warga di zona', en: 'A resident’s phone in the zone' },
  viaWa: { id: 'via WhatsApp', en: 'via WhatsApp' },
  openSapa: { id: 'Lihat di Sapa Warga', en: 'See it in Sapa Warga' },
  chain: { id: 'Efek berantai ke produk lain', en: 'Chain effects in other products' },
  open: { id: 'Buka', en: 'Open' },
  done: { id: 'Selesai', en: 'Done' },
  chars: { id: '{n}/600 karakter', en: '{n}/600 characters' },
  sim: { id: 'Simulasi', en: 'Simulation' },
  live: { id: 'Live', en: 'Live' },
  basisLine: {
    id: 'Dasar level: muka air sekarang {v} m ({st}), proyeksi puncak {p} m ±{t} ({pst}); model +6 j: {d} desa tergenang → disarankan level {l} (simulasi).',
    en: 'Level basis: river now {v} m ({st}), projected crest {p} m at ±{t} ({pst}); +6 h model: {d} villages flooded → level {l} suggested (simulated).',
  },
  stNormal: { id: 'normal', en: 'normal' },
  stSiaga: { id: 'SIAGA', en: 'WATCH' },
  stAwas: { id: 'AWAS', en: 'WARNING' },
  aiAdded: { id: 'AI menambahkan dari model: jam tiba air per desa, posko terdekat dengan sisa kapasitas{rl}.', en: 'AI added from the model: water arrival time per village, the nearest shelter with places left{rl}.' },
  meja: { id: 'Peringatan aktif tampil di peta & ringkasan pimpinan', en: 'The active warning shows on the leader’s map & summary' },
  modelWait: { id: 'Menghitung model desa +6 j… Level, wilayah dan jam tiba air diisi begitu model siap; tombol Kirim aktif setelahnya.', en: 'Computing the +6 h village model… Level, area and arrival times fill in once it is ready; Send unlocks then.' },
  waitBtn: { id: 'Menunggu model…', en: 'Waiting for the model…' },
} satisfies Record<string, Bi>

/** resolves in a fresh task after the next frame has painted */
const afterPaint = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)))

type Level = 1 | 2 | 3 | 4
const CHANNELS = ['wa', 'sms', 'sirine', 'radio', 'media-sosial'] as const
type Channel = (typeof CHANNELS)[number]

export default function Broadcast() {
  const { lang } = useI18n()
  const L = (k: keyof typeof T, v?: Record<string, string | number>) => (v ? fill(T[k][lang], v) : T[k][lang])
  const { pack, size } = useShell()
  // the AI draft adds one line in the region's language (scenario draftAlert: Jawa / Sunda / Minang)
  const rlName = ['jv', 'su', 'min'].includes(pack?.languages.regional[0] ?? '') ? regionalLanguageLabel(pack, lang) : null
  const rlLine = rlName ? (lang === 'id' ? `, dan satu kalimat ${rlName} untuk WA` : `, and one ${rlName} line for WA`) : ''
  const session = useSession()
  const impact6 = useUi((s) => s.impact6)
  const s0 = useMemo(() => world.get(), [])
  const kecName = (id: string) => s0.region.kecamatan.find((k) => k.id === id)?.name ?? id

  // the model's recommendation (one definition with the Prediksi list, Geo-AI and the insight card): the 6 kecamatan
  // with the most people in the +6 h zone; the chips add the scenario's river kecamatan
  const recommended0 = useMemo(() => recommendedKec(impact6), [impact6])
  const suggested = useMemo(() => [...new Set([...recommended0, ...s0.region.floodKecamatanIds])].slice(0, 7), [recommended0, s0])
  const recommended = useMemo(() => (recommended0.length ? recommended0 : [s0.region.floodKecamatanIds[0] ?? s0.region.kecamatan[0]!.id]), [recommended0, s0])
  // opened before the village model was in (a fast double click): compute it now; Send waits for it
  const modelReady = !!impact6
  useEffect(() => {
    if (!modelReady) void ensureDesa()
  }, [modelReady])

  // the level the river gauge + its 6-hour outlook support (the same curve as the Situation card)
  const river = useMemo(() => riverGauge(s0), [s0])
  const gNow = useMemo(() => (river ? gaugeNow(river, clock.get().minutes) : null), [river])
  const draft = useMemo(() => ui.get().draft, [])
  const [level, setLevel] = useState<Level>(draft?.level ?? suggestedLevel(gNow, river))
  const bodyRef = useRef<HTMLDivElement>(null)
  const touched = useRef(!!draft?.areas.length)
  const [kec, setKecState] = useState<string[]>(() => {
    const fromDraft = draft?.areas.map((n) => s0.region.kecamatan.find((k) => k.name.toLowerCase() === n.toLowerCase())?.id).filter((x): x is string => !!x)
    return fromDraft?.length ? fromDraft : recommended
  })
  const setKec: typeof setKecState = (v) => {
    touched.current = true
    setKecState(v)
  }
  // the model rows can land after the dialog opened: follow the recommendation until the visitor picks an area
  useEffect(() => {
    if (!touched.current) setKecState(recommended)
  }, [recommended])
  const [scope, setScope] = useState<'all' | 'hit'>('all')
  const [channels, setChannels] = useState<Channel[]>(() => (draft?.channels.filter((c): c is Channel => (CHANNELS as readonly string[]).includes(c)) ?? ['wa', 'sms']))
  const [edited, setEdited] = useState<string | null>(draft?.message || null)
  const [stage, setStage] = useState<'compose' | 'sending' | 'done'>('compose')
  const [chHint, setChHint] = useState(false)
  const kd = session.role === 'kepala-daerah'
  const [result, setResult] = useState<{ alertId: string; follow: AuditEntry[]; phones: number; sitiMsg: string | null; messageId: string | null } | null>(null)
  useEffect(() => ui.set({ draft: null }), [])

  const hitDesa = useMemo(() => (impact6?.desa ?? []).filter((d) => kec.includes(d.kecamatanId)), [impact6, kec])
  const desaIds = scope === 'hit' && hitDesa.length ? hitDesa.map((d) => d.id) : undefined
  const officials = useMemo(() => alertRecipients(s0, kec, { desaIds, pack }), [s0, kec, desaIds, pack])
  const citizens = useMemo(() => zoneCitizens(s0, kec, desaIds), [s0, kec, desaIds])
  const names = kec.map(kecName)
  const onsetH = hitDesa.length ? Math.min(...hitDesa.map((d) => d.onset)) : undefined
  const template = useMemo(() => {
    const id = draftAlert(geoContext('id'), 'id', level, names, onsetH).message
    const en = draftAlert(geoContext('en'), 'en', level, names, onsetH).message
    return { id, en }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, names.join('|'), onsetH])
  const message = edited ?? template[lang]
  /** what actually leaves the demo: always marked as a simulation */
  const outgoing = withSimMark(message, lang)

  /* ---------------------------------------------------------------- AI drafting (sim scenario or Live proxy) */
  const chat = useAiChat('siaga-wilayah', {
    mode: session.aiMode,
    role: session.role,
    getContext: () => geoContext(lang),
    onDone: (m) => {
      const a = m.structured?.find((x) => x.kind === 'alert')?.data as { level?: string; message?: string; channels?: string[] } | undefined
      if (!a?.message) return
      setEdited(a.message.slice(0, 600))
      // the structured enum stops at "awas": the "LEVEL n" in the text decides (a level-4 draft stays level 4)
      setLevel(draftLevel(a))
      const ch = (a.channels ?? []).filter((c): c is Channel => (CHANNELS as readonly string[]).includes(c))
      if (ch.length) setChannels(ch)
    },
  })
  const askAi = () => {
    const lvName = { 1: 'waspada', 2: 'siaga', 3: 'awas', 4: 'darurat' }[level]
    void chat.send(lang === 'id' ? `Susun peringatan dini level ${level} (${lvName}) untuk Kec. ${names.join(', ')}` : `Draft a level ${level} early warning for ${names.join(', ')}`)
  }
  const aiMsg = chat.last
  const aiState = chat.busy ? 'busy' : aiMsg?.status === 'done' && aiMsg.structured?.some((x) => x.kind === 'alert') ? 'done' : null

  /* ---------------------------------------------------------------- send */
  const send = async () => {
    if (!kec.length || stage !== 'compose') return
    setStage('sending')
    // let the click paint ("Mengirim…") before the world processes the alert and its chain (INP)
    await afterPaint()
    // the arrival time comes from the +6 h model rows of the chosen area, computed once here and stored with the
    // warning (never re-derived later from whatever the model state is then)
    if (!ui.get().impact6) await ensureDesa()
    const i6 = ui.get().impact6 ?? impactAt(6)
    if (!i6?.desa.length) return setStage('compose')
    const hd = (i6?.desa ?? []).filter((d) => kec.includes(d.kecamatanId))
    const onset = hd.length ? Math.min(...hd.map((d) => d.onset)) : null
    const s = world.get()
    const now = clock.get().minutes
    const gn = river ? gaugeNow(river, now) : null
    const reuse = floodAlerts(s).find((a) => a.level === level && a.kecamatanIds.length === kec.length && kec.every((k) => a.kecamatanIds.includes(k)))
    const evs: string[] = []
    let alertId = reuse?.id
    if (!alertId) {
      // the arrival clock time of the model run (07.00 anchor): the same time the AI draft, Geo-AI and the map card give
      const expectedAt = onset !== null ? arrivalAt(onset) : (gn?.awasAt ?? null)
      const e = emit('flood.alert', { ...floodScenarioAlert(s, now, { level, kecamatanIds: kec, desaIds: desaIds ?? [] }), expectedAt }, 'siaga-wilayah')
      alertId = e.payload.id!
      evs.push(e.id)
      // audit trail: who issued it and on what basis (shown on the active-warning card)
      ui.set((u) => ({ basis: { ...u.basis, [alertId!]: { by: session.role, level: gn?.level ?? 0, state: gn?.state ?? 'normal', desa: hd.length, people: hd.reduce((n, d) => n + d.people, 0), awasAt: gn?.awasAt ?? null } } }))
    }
    const msg: Bi = edited
      ? { id: withSimMark(lang === 'id' ? edited : template.id, 'id'), en: withSimMark(lang === 'en' ? edited : template.en, 'en') }
      : { id: withSimMark(template.id, 'id'), en: withSimMark(template.en, 'en') }
    const b = emit('alert.broadcast', { alertId, channels, recipients: officials.length + citizens.length, desaIds, message: msg }, 'siaga-wilayah')
    evs.push(b.id)
    await settled()
    const w = world.get()
    const audit = rows(w.auditLog)
    // follow-ups (depth 1–2) of our two root events
    const roots = new Set(evs)
    const follow: AuditEntry[] = []
    for (const a of [...audit].reverse()) {
      if (a.causeId && roots.has(a.causeId)) {
        follow.push(a)
        roots.add(a.eventId)
      }
    }
    const note = rows(w.messages).find((m) => m.kind === 'peringatan' && m.refs.includes(`alerts:${alertId}`))
    const siti = w.meta.personas.siti
    setResult({ alertId, follow, phones: note?.to.length ?? 0, sitiMsg: note && note.to.includes(siti) ? note.text[lang] : null, messageId: note?.id ?? null })
    setStage('done')
    ui.set({ flash: alertId, tab: 'alerts' })
  }
  // the sent view starts at its top (delivery ticks), whatever was scrolled to compose
  useEffect(() => {
    if (stage !== 'done') return
    const b = bodyRef.current?.closest<HTMLElement>('.dk-ov-body')
    if (b) b.scrollTop = 0
  }, [stage])

  const close = () => {
    const done = stage === 'done'
    ui.set({ broadcastOpen: false })
    if (!done) return
    // INP: the dialog closes in this frame; the map work follows after that paint
    void afterPaint().then(() => {
      // the dialog already listed every chain effect: on a phone the same notifications would cover the result, so
      // they go; then the map with the new warning zone comes into view
      if (size === 'sm') {
        document.querySelectorAll<HTMLButtonElement>('.dk-toasts .dk-toast-x').forEach((b) => b.click())
        revealMap()
      }
      // the whole new warning zone in view (the flood stretch the model framed), not one district close up
      focusFloodArea()
    })
  }
  const footer =
    stage === 'done' ? (
      <Button variant="primary" onClick={close} data-sw="bc-done">
        {L('done')}
      </Button>
    ) : (
      <>
        <Button variant="ghost" onClick={close}>
          {L('cancel')}
        </Button>
        <Button variant={level >= 3 ? 'danger' : 'primary'} icon="send" onClick={() => void send()} busy={stage === 'sending' || !modelReady} disabled={!modelReady || !kec.length || !channels.length || !message.trim()} data-sw="bc-send">
          {stage === 'sending' ? L('sending') : !modelReady ? L('waitBtn') : kd ? L('approve') : L('send')}
        </Button>
      </>
    )

  return (
    <Modal open onClose={close} title={stage === 'done' ? L('sentTitle') : L('title')} description={stage === 'done' ? undefined : L('desc')} size="lg" footer={footer} dismissable={stage !== 'sending'}>
      <div ref={bodyRef} hidden />
      {stage === 'done' && result ? (
        <Sent L={L} lang={lang} officials={officials} result={result} message={outgoing} session={session} region={s0.region.shortName} sm={size === 'sm'} />
      ) : (
        <div className="dk-sg-bc">
          <div className="dk-sg-bc-form">
            <fieldset className="dk-sg-fs">
              <legend>{L('level')}</legend>
              <Segmented<`${Level}`>
                label={L('level')}
                value={`${level}`}
                onChange={(v) => {
                  setLevel(Number(v) as Level)
                  setEdited(null)
                }}
                options={[1, 2, 3, 4].map((n) => ({ value: `${n}` as `${Level}`, label: L(`l${n}` as 'l1') }))}
              />
              {!modelReady ? (
                <p className="dk-sg-fine dk-sg-basis" role="status">
                  {L('modelWait')}
                </p>
              ) : gNow && river && (
                <p className="dk-sg-fine dk-sg-basis">
                  {L('basisLine', {
                    v: nf(gNow.level, lang, 2),
                    st: L(gNow.state === 'awas' ? 'stAwas' : gNow.state === 'siaga' ? 'stSiaga' : 'stNormal'),
                    p: nf(gNow.peak.level, lang, 2),
                    t: clockText(gNow.peak.at, lang),
                    pst: L(levelState(river, gNow.peak.level) === 'awas' ? 'stAwas' : levelState(river, gNow.peak.level) === 'siaga' ? 'stSiaga' : 'stNormal'),
                    d: nf(impact6?.desa.length ?? 0, lang),
                    l: suggestedLevel(gNow, river),
                  })}
                </p>
              )}
            </fieldset>
            <fieldset className="dk-sg-fs">
              <legend>{L('area')}</legend>
              <p className="dk-sg-fine">{L('suggested')}</p>
              <div className="dk-sg-chips" role="group" aria-label={L('area')}>
                {[...new Set([...suggested, ...kec])].map((id) => (
                  <Chip
                    key={id}
                    selected={kec.includes(id)}
                    onToggle={() => {
                      setKec((k) => (k.includes(id) ? k.filter((x) => x !== id) : [...k, id]))
                      setEdited(null)
                    }}
                  >
                    {kecName(id)}
                  </Chip>
                ))}
              </div>
              <Select
                aria-label={L('addKec')}
                value=""
                onChange={(e) => {
                  const v = e.target.value
                  if (v && !kec.includes(v)) {
                    setKec((k) => [...k, v])
                    setEdited(null)
                  }
                }}
                options={[{ value: '', label: L('addPick') }, ...s0.region.kecamatan.filter((k) => !suggested.includes(k.id) && !kec.includes(k.id)).map((k) => ({ value: k.id, label: k.name }))]}
              />
              {!kec.length && <p className="dk-sg-err">{L('needArea')}</p>}
              {hitDesa.length > 0 && (
                <Segmented
                  label={L('scope')}
                  size="sm"
                  value={scope}
                  onChange={setScope}
                  options={[
                    { value: 'all', label: L('scopeAll') },
                    { value: 'hit', label: L('scopeHit', { n: hitDesa.length }) },
                  ]}
                />
              )}
            </fieldset>
            <fieldset className="dk-sg-fs">
              <legend>{L('channels')}</legend>
              <div className="dk-sg-chips" role="group" aria-label={L('channels')}>
                {CHANNELS.map((c) => {
                  const on = channels.includes(c)
                  const last = on && channels.length === 1
                  return (
                    <button
                      key={c}
                      type="button"
                      className={`dk-chip dk-chip--neutral${on ? ' is-selected' : ''}`}
                      aria-pressed={on}
                      aria-disabled={last || undefined}
                      aria-describedby={last ? 'sw-bc-minone' : undefined}
                      onClick={() => {
                        if (last) return setChHint(true)
                        setChHint(false)
                        setChannels((x) => (on ? x.filter((y) => y !== c) : [...x, c]))
                      }}
                    >
                      <span>{L(`ch_${c}` as 'ch_wa')}</span>
                    </button>
                  )
                })}
              </div>
              <p id="sw-bc-minone" className={chHint ? 'dk-sg-err' : 'dk-sg-fine'} aria-live="polite">
                {channels.length === 1 ? L('minOne') : ''}
              </p>
            </fieldset>
            <div className="dk-sg-fs">
              <div className="dk-sg-msghead">
                <label htmlFor="sw-bc-msg">{L('message')}</label>
                <Button size="sm" variant="secondary" icon="spark" onClick={askAi} onFocus={chat.prepare} onPointerEnter={chat.prepare} busy={chat.busy} data-sw="bc-ai">
                  {chat.busy ? L('aiBusy') : L('ai')}
                </Button>
              </div>
              <Textarea id="sw-bc-msg" rows={size === 'sm' ? 6 : 5} maxLength={600} value={message} onChange={(e) => setEdited(e.target.value)} />
              <p className="dk-sg-fine" aria-live="polite">
                {L('chars', { n: message.length })}
                {aiState === 'done' && ` · ${L('aiDone', { m: aiMsg?.mode === 'live' ? L('live') : L('sim') })}`}
                {aiMsg?.fellBack && ` · ${L('aiFell')}`}
              </p>
              {aiState === 'done' && edited && aiMsg?.mode !== 'live' && <p className="dk-sg-fine dk-sg-aiadd">{L('aiAdded', { rl: rlLine })}</p>}
            </div>
          </div>
          <div className="dk-sg-bc-side">
            <p className="dk-sg-fslabel">{L('preview', { c: L(`ch_${channels.includes('wa') ? 'wa' : (channels[0] ?? 'wa')}` as 'ch_wa') })}</p>
            <div className={`dk-sg-wa${channels.includes('wa') ? '' : ' is-sms'}`}>
              <p className="dk-sg-wa-from">
                <Icon name={channels.includes('wa') ? 'shield' : 'phone'} size={14} />
                {channels.includes('wa') ? L('official', { r: s0.region.shortName }) : L('smsFrom', { r: s0.region.shortName.toUpperCase() })}
              </p>
              <p className="dk-sg-wa-bubble">
                {outgoing}
                <span className="dk-sg-wa-time dk-num">{clockText(clock.get().minutes, lang)}</span>
              </p>
            </div>
            <p className="dk-sg-fslabel">
              {L('recipients')} · {nf(officials.length + citizens.length, lang)}
            </p>
            <p className="dk-sg-fine">{L('rcptSum', { o: nf(officials.length, lang), c: nf(citizens.length, lang) })}</p>
            <ul className="dk-sg-rcpts" data-tour="sw-recipients">
              {officials.slice(0, 6).map((r) => (
                <li key={r.id}>
                  <Icon name={r.kind === 'camat' ? 'building' : 'user'} size={14} />
                  <span>{r.title[lang]}</span>
                  <span className="dk-num dk-sg-muted">{r.phone}</span>
                </li>
              ))}
            </ul>
            {officials.length > 6 && <p className="dk-sg-fine">{L('more', { n: officials.length - 6 + citizens.length })}</p>}
          </div>
        </div>
      )}
    </Modal>
  )
}

/* ------------------------------------------------------------------ after sending */
function Sent({
  L, lang, officials, result, message, session, region, sm,
}: {
  L: (k: keyof typeof T, v?: Record<string, string | number>) => string
  lang: 'id' | 'en'
  officials: ReturnType<typeof alertRecipients>
  result: { alertId: string; follow: AuditEntry[]; phones: number; sitiMsg: string | null; messageId: string | null }
  message: string
  session: ReturnType<typeof useSession>
  region: string
  sm: boolean
}) {
  const total = officials.length + result.phones
  const [read, setRead] = useState(0)
  const timer = useRef<number | null>(null)
  useEffect(() => {
    // read receipts trail the delivery (one state change, not per frame)
    timer.current = window.setTimeout(() => setRead(Math.round(total * 0.82)), 1400)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [total])
  const sentRef = useCountUp<HTMLSpanElement>(total, { format: (n) => nf(Math.round(n), lang) })
  const readRef = useCountUp<HTMLSpanElement>(read, { format: (n) => nf(Math.round(n), lang) })
  const siti = world.get().citizens.byId[world.get().meta.personas.siti]
  // one row per product: its FIRST follow-up (causal order), linked to the entity that follow-up created
  const products: AuditEntry[] = []
  for (const a of result.follow) {
    if (a.source === 'siaga-wilayah' || a.source === 'clock' || a.source === 'tour' || a.source === 'user') continue
    if (!products.some((p) => p.source === a.source)) products.push(a)
  }
  const focusOf = (a: AuditEntry): string | null => {
    const own = result.follow.filter((x) => x.source === a.source).flatMap((x) => x.entityRefs)
    // the product's own entity (not the alert / complaint it reacted to)
    const pick = own.find((r) => !r.startsWith('alerts:') && !r.startsWith('complaints:') && !r.startsWith('citizens:')) ?? own[0]
    return pick?.split(':')[1] ?? null
  }
  void region
  return (
    <div className="dk-sg-bc is-sent">
      <div className="dk-sg-bc-form">
        <p className="dk-sg-ticks" aria-live="polite">
          <span>
            <Icon name="check" size={14} /> <span ref={sentRef} className="dk-num">0</span> {L('delivered')}
          </span>
          <span className="is-read">
            <Icon name="check" size={14} />
            <Icon name="check" size={14} /> <span ref={readRef} className="dk-num">0</span> {L('read')}
          </span>
        </p>
        <ul className="dk-sg-rcpts is-sent">
          {officials.slice(0, sm ? 5 : 8).map((r, i) => (
            <li key={r.id} style={{ ['--d' as string]: `${i * 90}ms` }}>
              <Icon name={r.kind === 'camat' ? 'building' : 'user'} size={14} />
              <span>{r.title[lang]}</span>
              <span className="dk-sg-tick" aria-label={i < Math.round(officials.length * 0.82) && read ? L('read') : L('delivered')}>
                <Icon name="check" size={13} />
                {read > 0 && i < Math.round(officials.length * 0.82) && <Icon name="check" size={13} />}
              </span>
            </li>
          ))}
        </ul>
        <h3 className="dk-sg-h">
          <Icon name="share" size={16} />
          {L('chain')}
        </h3>
        <ul className="dk-sg-chain">
          {products.map((a) => (
            <li key={a.id}>
              <Icon name={PRODUCT_BY_SLUG[a.source as ProductSlug]?.icon ?? 'dot'} size={14} />
              <span>
                <strong>{PRODUCT_BY_SLUG[a.source as ProductSlug]?.name ?? a.source}</strong> · {chainText(a.summary[lang], lang)}
              </span>
              <AppLink to={productHref(a.source as ProductSlug, session, focusOf(a))} className="dk-sg-link">
                {L('open')} →
              </AppLink>
            </li>
          ))}
          {!products.some((p) => p.source === 'meja-pimpinan') && (
            <li>
              <Icon name={PRODUCT_BY_SLUG['meja-pimpinan']?.icon ?? 'dot'} size={14} />
              <span>
                <strong>{PRODUCT_BY_SLUG['meja-pimpinan']?.name ?? 'Meja Pimpinan'}</strong> · {L('meja')}
              </span>
              <AppLink to={productHref('meja-pimpinan', session)} className="dk-sg-link">
                {L('open')} →
              </AppLink>
            </li>
          )}
        </ul>
      </div>
      <div className="dk-sg-bc-side">
        <p className="dk-sg-fslabel">{L('phone')}</p>
        <div className="dk-sg-wa is-phone">
          <p className="dk-sg-wa-from">
            <Icon name="phone" size={14} />
            {siti && result.sitiMsg ? `${siti.gender === 'P' ? 'Ibu' : 'Bpk.'} ${siti.name} · ${siti.address}` : L('viaWa')}
          </p>
          <p className="dk-sg-wa-bubble is-in">
            {result.sitiMsg ?? message}
            <span className="dk-sg-wa-time dk-num">{clockText(clock.get().minutes, lang)}</span>
          </p>
        </div>
        <AppLink to={productHref('sapa-warga', session, result.messageId)} className="dk-sg-link">
          {L('openSapa')} →
        </AppLink>
      </div>
    </div>
  )
}
