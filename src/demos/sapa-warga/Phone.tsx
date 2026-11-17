/**
 * demos/sapa-warga/Phone.tsx — "HP Warga": a generic messenger with the official account of the region ("via WhatsApp"
 * label, generic verified tick), three persona cards, the AI chat (useAiChat: Simulasi or Live through the proxy),
 * quick questions, attachments (sample photos, the visitor's own photo, location), a hold-to-talk voice note (lazy
 * media kit) and the sheets for the NIB form and the MPP queue.
 *
 * Ticket creation: a voice note or a photo report creates the ticket at once (complaint.created, source sapa-warga),
 * then the AI answers about that ticket; a typed report creates it when the AI's `ticket` card arrives.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useI18n } from '../../lib/i18n'
import { useAiChat, registerScenario } from '../../demo-kit/ai/chat'
import { PhoneFrame } from '../../demo-kit/frames'
import { Avatar, Icon, initialsOf } from '../../demo-kit/ui'
import { useShell } from '../../demo-kit/shell'
import { clock, rows, useClock, useSession, useWorld, world, type Bi, type CitizenMessage, type ComplaintCategory, type WorldState } from '../../demo-kit/world'
import {
  PERSONA_KEYS, PHOTO_META, SLUG, SW, bookQueue, buildContext, categoryFromLabel, classifyReport, createComplaint, kecName, looksJawa, opdForCategory, opdShort,
  personaCitizen, placeOf, reportCoord, slotLabel, summaryOf, urgencyOf, voiceSampleFor, type Created, type PersonaKey, type PhotoId, type SwContext,
} from './model'
import { Thread, emptyConv, type Conv, type MsgMeta, type ThreadActions } from './Thread'
import { fill, useT } from './strings'

const VoiceSheet = lazy(() => import('./VoiceSheet'))
const AttachSheet = lazy(() => import('./Sheets').then((m) => ({ default: m.AttachSheet })))
const FormSheet = lazy(() => import('./Sheets').then((m) => ({ default: m.FormSheet })))
const SlotSheet = lazy(() => import('./Sheets').then((m) => ({ default: m.SlotSheet })))

/** the scenario chunk, registered once (input focus / first send) */
let scenarioLoad: Promise<void> | null = null
export function loadScenario(): Promise<void> {
  scenarioLoad ??= import('./scenario').then(
    (m) => registerScenario(m.sapaWargaScenario),
    (e: unknown) => {
      scenarioLoad = null
      throw e
    },
  )
  return scenarioLoad
}

export interface Staged {
  photo?: { id: PhotoId | 'own'; url?: string; title: Bi }
  loc?: boolean
}
type Sheet = null | { k: 'attach' } | { k: 'voice' } | { k: 'form'; serviceId: string } | { k: 'slots'; serviceId: string }

export interface PhoneProps {
  persona: PersonaKey
  setPersona: (k: PersonaKey) => void
  convs: Map<PersonaKey, Conv>
  onCreated: (c: Created, from: Element | null) => void
  flat: boolean
}

/* ------------------------------------------------------------------ quick chips per persona */

type Quick = { label: Bi; text?: Bi | string; act?: 'voice' | 'photo' | 'queue' }
const QUICK: Record<PersonaKey, Quick[]> = {
  siti: [
    { label: { id: 'Voice note contoh', en: 'Sample voice note' }, act: 'voice' },
    { label: { id: 'Foto genangan + lokasi', en: 'Flood photo + location' }, act: 'photo' },
    { label: { id: 'Apakah perlu mengungsi?', en: 'Should we evacuate?' }, text: { id: 'Apakah perlu mengungsi?', en: 'Should we evacuate?' } },
    { label: { id: 'Status tiket saya', en: 'My ticket status' }, text: { id: 'Cek status tiket saya', en: 'Check my ticket status' } },
  ],
  raka: [
    { label: { id: 'Syarat bikin NIB apa?', en: 'What do I need for an NIB?' }, text: { id: 'Syarat bikin NIB apa?', en: 'What do I need for an NIB?' } },
    { label: { id: 'MPP buka jam berapa?', en: 'Service mall hours?' }, text: { id: 'MPP buka jam berapa?', en: 'When is the service mall open?' } },
    { label: { id: 'Lapor lampu jalan mati', en: 'Report a street light out' }, text: { id: 'Lampu jalan di pertigaan dekat rumah saya mati seminggu', en: 'The street light at the junction near my house has been out for a week' } },
    { label: { id: 'Voice note contoh', en: 'Sample voice note' }, act: 'voice' },
  ],
  darmo: [
    { label: { id: 'Voice note contoh', en: 'Sample voice note' }, act: 'voice' },
    { label: { id: 'KTP-el rusak (Basa Jawa)', en: 'Damaged e-ID (Javanese)' }, text: 'KTP-el kula rusak, pripun carane ngurus?' },
    { label: { id: 'Ambil antrean MPP', en: 'Book a service-mall slot' }, act: 'queue' },
    { label: { id: 'Cek status bansos', en: 'Check social-aid status' }, text: { id: 'Cek status penerima bansos', en: 'Check my social assistance status' } },
  ],
}
const STORY: Record<PersonaKey, 'personaSiti' | 'personaRaka' | 'personaDarmo'> = { siti: 'personaSiti', raka: 'personaRaka', darmo: 'personaDarmo' }

/* ------------------------------------------------------------------ chat (one per persona) */

const EMPTY_MSGS: CitizenMessage[] = []

function Chat({ persona, convs, onCreated, openSheet, staged, setStaged, voiceRef }: {
  voiceRef: { current: VoiceFn | null }
  persona: PersonaKey
  convs: Map<PersonaKey, Conv>
  onCreated: PhoneProps['onCreated']
  openSheet: (s: Sheet) => void
  staged: Staged
  setStaged: (s: Staged) => void
}) {
  const { lang } = useI18n()
  const t = useT()
  const session = useSession()
  const shell = useShell()
  const pack = shell.pack
  const saved = useRef(convs.get(persona) ?? emptyConv()).current
  const [conv, setConv] = useState<Omit<Conv, 'messages'>>(() => ({ timeline: saved.timeline, meta: saved.meta, created: saved.created, done: saved.done }))
  const citizen = useWorld((s) => personaCitizen(s, persona))
  const msgsTable = useWorld((s) => s.messages)
  const worldMsgs = useMemo(() => (citizen ? rows(msgsTable).filter((m) => m.to.includes(citizen.id)) : EMPTY_MSGS), [msgsTable, citizen])
  const worldById = useMemo(() => Object.fromEntries(worldMsgs.map((m) => [m.id, m])), [worldMsgs])
  const pending = useRef<{ text: string; meta: MsgMeta }[]>([])
  const just = useRef<SwContext['justCreated']>(null)
  const done = useRef(new Set(saved.done))
  const composer = useRef<HTMLFormElement>(null)
  const scroll = useRef<HTMLDivElement>(null)
  const [text, setText] = useState('')

  const chat = useAiChat(SLUG, {
    mode: session.aiMode,
    role: 'warga',
    initial: saved.messages,
    getContext: () => {
      const c = buildContext(world.get(), pack, persona, clock.get().minutes, just.current)
      just.current = null
      return c
    },
  })
  const { send: chatSend, prepare: chatPrepare } = chat

  const ask = useCallback(
    async (q: string, meta?: MsgMeta, justCreated?: SwContext['justCreated']) => {
      const msg = q.trim()
      if (!msg) return
      if (meta) pending.current.push({ text: msg, meta })
      try {
        await loadScenario()
      } catch {
        /* the engine answers with its generic text; the chat still works */
      }
      just.current = justCreated ?? null
      void chatSend(msg)
    },
    [chatSend],
  )
  const prepare = useCallback(() => {
    chatPrepare()
    void loadScenario().catch(() => undefined)
  }, [chatPrepare])

  /* chat messages → timeline (+ the pending media meta of user messages; assigned here, never inside an updater) */
  const metaRef = useRef<Record<string, MsgMeta>>({ ...saved.meta })
  useEffect(() => {
    let changed = false
    for (const m of chat.messages) {
      if (m.role !== 'user' || metaRef.current[m.id]) continue
      const i = pending.current.findIndex((p) => p.text === m.content)
      if (i < 0) continue
      metaRef.current[m.id] = pending.current[i]!.meta
      pending.current.splice(i, 1)
      changed = true
    }
    const meta = metaRef.current
    setConv((prev) => {
      const have = new Set(prev.timeline.flatMap((e) => (e.k === 'm' ? [e.id] : [])))
      const add = chat.messages.filter((m) => !have.has(m.id))
      if (!add.length && !changed) return prev
      return { ...prev, meta: { ...meta }, timeline: add.length ? [...prev.timeline, ...add.map((m) => ({ k: 'm' as const, id: m.id }))] : prev.timeline }
    })
  }, [chat.messages])

  /* world messages (ticket updates, queue tickets, warnings, officer replies) → timeline */
  useEffect(() => {
    setConv((prev) => {
      const have = new Set(prev.timeline.flatMap((e) => (e.k === 'w' ? [e.id] : [])))
      const add = worldMsgs.filter((m) => !have.has(m.id)).sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
      if (!add.length) return prev
      return { ...prev, timeline: [...prev.timeline, ...add.map((m) => ({ k: 'w' as const, id: m.id }))] }
    })
  }, [worldMsgs])

  /* AI structured results that act on the world: ticket → complaint.created, live booking → service.booked */
  useEffect(() => {
    const s = world.get()
    const c = citizen
    if (!c) return
    const created: Record<string, Created & { pred?: string }> = {}
    chat.messages.forEach((m, mi) => {
      if (m.role !== 'assistant' || !m.structured?.length) return
      m.structured.forEach((v, i) => {
        const key = `${m.id}:${i}`
        if (done.current.has(key)) return
        if (v.kind === 'ticket') {
          done.current.add(key)
          const prevUser = [...chat.messages.slice(0, mi)].reverse().find((x) => x.role === 'user')
          const pm = prevUser ? metaRef.current[prevUser.id] : undefined
          if (pm?.created) {
            created[m.id] = pm.created
            return
          }
          if (v.data.existing) return
          const d = v.data
          const cat: ComplaintCategory = typeof d.categoryId === 'string' ? (d.categoryId as ComplaintCategory) : categoryFromLabel(String(d.category ?? ''))
          const kecId = typeof d.kecamatanId === 'string' && d.kecamatanId ? d.kecamatanId : c.kecamatanId
          const desaId = typeof d.desaId === 'string' && d.desaId ? d.desaId : kecId === c.kecamatanId ? c.desaId : (s.region.kecamatan.find((k) => k.id === kecId)?.desa[0]?.id ?? c.desaId)
          const centre = s.region.kecamatan.find((k) => k.id === kecId)?.desa.find((x) => x.id === desaId)?.centroid
          const said = typeof d.text === 'string' ? d.text : (prevUser?.content ?? String(d.summary ?? ''))
          const jv = looksJawa(said)
          const urg = String(d.urgency ?? '')
          const r = createComplaint(s, {
            citizen: c, category: cat, channel: 'wa', text: said, lang: jv ? c.lang : 'id',
            summary: summaryOf(s, cat, said, kecId, desaId, jv && typeof d.translationId === 'string' && d.translationId ? { id: d.translationId, en: String(d.summary ?? said) } : null),
            kecamatanId: kecId, desaId, coord: kecId === c.kecamatanId && desaId === c.desaId ? reportCoord(s, c, 2) : centre,
            urgency: urg === 'tinggi' || urg === 'kritis' ? 'tinggi' : urg === 'rendah' ? 'rendah' : urgencyOf(cat, said),
          })
          created[m.id] = { ...r, pred: typeof d.code === 'string' ? d.code : undefined }
          onCreated(r, document.querySelector(`[data-msg="${CSS.escape(m.id)}"]`))
        } else if (v.kind === 'booking' && m.mode === 'live') {
          done.current.add(key)
          const sl = /^(\d{1,2})[.:](\d{2})$/.exec(String(v.data.slot ?? ''))
          const at = sl ? Number(sl[1]) * 60 + Number(sl[2]) : null
          const sid = String(v.data.serviceId ?? '') || (persona === 'raka' ? 'nib-oss' : 'ktp-el')
          if (at !== null) bookQueue(c.id, sid, at < clock.get().minutes ? at + 1440 : at)
        }
      })
    })
    if (Object.keys(created).length) setConv((prev) => ({ ...prev, created: { ...prev.created, ...created } }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.messages])

  /* keep the conversation when switching persona */
  useEffect(() => {
    convs.set(persona, { ...conv, messages: chat.messages, done: [...done.current] })
  }, [convs, persona, conv, chat.messages])

  /* ------------------------------------------------------------ actions */

  const justFrom = (s: WorldState, r: Created, cat: ComplaintCategory, channel: 'voice' | 'wa', translation: Bi | null): NonNullable<SwContext['justCreated']> => {
    const cmp = s.complaints.byId[r.complaintId]
    return {
      code: r.code, category: cat, opd: opdShort(s, opdForCategory(s, cat)), slaHours: SW.slaDays[cat] * 24, channel,
      place: cmp ? placeOf(s, cmp.kecamatanId, cmp.desaId) : citizen ? placeOf(s, citizen.kecamatanId, citizen.desaId) : '', translation,
    }
  }

  const onVoice = useCallback(
    (res: { text: string; source: 'mic' | 'sample'; lang: string }) => {
      openSheet(null)
      shell.markMission('voice')
      const s = world.get()
      const c = personaCitizen(s, persona)
      if (!c) return
      const sample = voiceSampleFor(persona, pack)
      const translation = res.source === 'sample' || res.text === sample.text ? sample.translation : null
      const jv = looksJawa(res.text)
      const cat = classifyReport(res.text)
      const words = res.text.split(/\s+/).length
      const regional = pack?.languages.regional[0]
      const langLabel = jv ? (regional === 'jv' ? 'Basa Jawa' : lang === 'id' ? 'Bahasa daerah' : 'Regional language') : 'Bahasa Indonesia'
      const meta: MsgMeta = { voice: { lang: jv ? res.lang : 'id-ID', translation, secs: Math.max(3, Math.round(words / 2.3)), label: jv ? fill(t.voiceLang, { from: langLabel }) : langLabel } }
      let j: SwContext['justCreated'] = null
      if (cat) {
        const r = createComplaint(s, {
          citizen: c, category: cat, channel: 'voice', text: res.text, lang: jv ? c.lang : 'id',
          summary: translation ?? summaryOf(s, cat, res.text, c.kecamatanId, c.desaId), urgency: urgencyOf(cat, translation?.id ?? res.text), photo: false,
          ...(res.source === 'sample' && sample.id.startsWith('vn-') ? { templateId: sample.id.slice(3) } : {}),
        }, 0)
        meta.created = r
        j = justFrom(s, r, cat, 'voice', translation)
        onCreated(r, composer.current)
      }
      void ask(res.text, meta, j)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persona, pack, lang, ask, openSheet, onCreated, t],
  )

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    const q = text.trim()
    if (!staged.photo && !staged.loc) {
      if (!q) return
      setText('')
      void ask(q)
      return
    }
    // photo / location report
    const s = world.get()
    const c = personaCitizen(s, persona)
    if (!c) return
    const ph = staged.photo
    const caption = q || (ph && ph.id !== 'own' ? PHOTO_META[ph.id].caption[lang] : '')
    const cat = (ph && ph.id !== 'own' ? PHOTO_META[ph.id].category : null) ?? classifyReport(caption)
    const loc = staged.loc ? { label: `${s.region.kecamatan.find((k) => k.id === c.kecamatanId)?.desa.find((d) => d.id === c.desaId)?.name ?? ''}, ${kecName(s, c.kecamatanId)}` } : undefined
    const meta: MsgMeta = { ...(ph ? { photo: ph } : {}), ...(loc ? { loc } : {}) }
    let j: SwContext['justCreated'] = null
    if (cat) {
      const r = createComplaint(s, {
        citizen: c, category: cat, channel: 'wa', text: caption, lang: looksJawa(caption) ? c.lang : 'id',
        summary: ph && ph.id !== 'own' && !q ? PHOTO_META[ph.id].caption : summaryOf(s, cat, caption, c.kecamatanId, c.desaId), photo: !!ph, urgency: urgencyOf(cat, caption),
      }, 1)
      meta.created = r
      j = justFrom(s, r, cat, 'wa', null)
      onCreated(r, composer.current)
    }
    setText('')
    setStaged({})
    void ask(caption || (lang === 'id' ? 'Saya kirim foto dan lokasi.' : 'I am sending a photo and my location.'), meta, j)
  }

  voiceRef.current = onVoice

  const actions: ThreadActions = useMemo(
    () => ({
      send: (q: string) => void ask(q),
      openForm: (serviceId: string) => openSheet({ k: 'form', serviceId }),
      openSlots: (serviceId: string) => openSheet({ k: 'slots', serviceId }),
    }),
    [ask, openSheet],
  )

  const greeting = useMemo(() => {
    const g = pack?.languages.samples.greetings[0]
    const reg = pack?.languages.regional[0]
    if (citizen && citizen.lang !== 'id' && g && g.lang === reg) return { text: g.text, translation: lang === 'id' ? `${g.id} ${t.greetingId.split('. ').slice(1).join('. ')}` : `${g.en} ${t.greetingId.split('. ').slice(1).join('. ')}` }
    return { text: t.greetingId, translation: null }
  }, [pack, citizen, lang, t])

  const tips = useMemo(() => {
    const icons: Record<PersonaKey, ('mic' | 'camera' | 'bell' | 'checkCircle' | 'calendar' | 'search')[]> = { siti: ['mic', 'camera', 'bell'], raka: ['checkCircle', 'calendar', 'mic'], darmo: ['mic', 'calendar', 'search'] }
    const txt = persona === 'siti' ? t.tipsSiti : persona === 'raka' ? t.tipsRaka : t.tipsDarmo
    return txt.split('|').map((text, i) => ({ icon: icons[persona][i] ?? 'mic', text }))
  }, [persona, t])
  const quick = QUICK[persona]
  const onQuick = (q: Quick) => {
    if (q.act === 'voice') openSheet({ k: 'voice' })
    else if (q.act === 'photo') {
      setStaged({ photo: { id: 'genangan', title: PHOTO_META.genangan.title }, loc: true })
      setText(PHOTO_META.genangan.caption[lang])
    } else if (q.act === 'queue') openSheet({ k: 'slots', serviceId: persona === 'raka' ? 'nib-oss' : 'ktp-el' })
    else if (q.text) void ask(typeof q.text === 'string' ? q.text : q.text[lang])
  }
  const hasStaged = !!staged.photo || !!staged.loc

  return (
    <>
      <div ref={scroll} className="dk-sw-scroll">
        <Thread conv={{ ...conv, messages: chat.messages }} worldMsgs={worldById} greeting={greeting} tips={tips} actions={actions} scrollRef={scroll} />
      </div>
      <div className="dk-sw-quick" role="group" aria-label={t.quick}>
        {quick.map((q, i) => (
          <button key={i} type="button" className={`dk-sw-chip${q.act ? ' is-act' : ''}`} onClick={() => onQuick(q)} onFocus={prepare} data-sw={q.act ? `quick-${q.act}` : undefined} data-hotspot={persona === 'siti' && q.act === 'voice' ? 'voice' : undefined}>
            {q.act === 'voice' && <Icon name="mic" size={14} />}
            {q.act === 'photo' && <Icon name="camera" size={14} />}
            {q.act === 'queue' && <Icon name="calendar" size={14} />}
            {q.label[lang]}
          </button>
        ))}
      </div>
      {hasStaged && (
        <div className="dk-sw-staged" aria-label={t.attachTitle}>
          {staged.photo && (
            <span className="dk-sw-att">
              <Icon name="camera" size={14} />
              {staged.photo.title[lang]}
              <button type="button" aria-label={`${t.removeAtt}: ${staged.photo.title[lang]}`} onClick={() => setStaged({ ...staged, photo: undefined })}>
                <Icon name="close" size={12} />
              </button>
            </span>
          )}
          {staged.loc && (
            <span className="dk-sw-att">
              <Icon name="pin" size={14} />
              {t.locShared}
              <button type="button" aria-label={`${t.removeAtt}: ${t.locShared}`} onClick={() => setStaged({ ...staged, loc: false })}>
                <Icon name="close" size={12} />
              </button>
            </span>
          )}
        </div>
      )}
      <form ref={composer} className="dk-sw-compose" onSubmit={submit} data-sw-origin="">
        <button type="button" className="dk-sw-ibtn" aria-label={t.attach} title={t.attach} onClick={() => openSheet({ k: 'attach' })} data-sw="attach">
          <Icon name="camera" size={19} />
        </button>
        <label className="dk-sr" htmlFor={`dk-sw-in-${persona}`}>
          {t.typeLabel}
        </label>
        <input
          id={`dk-sw-in-${persona}`}
          className="dk-sw-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={prepare}
          placeholder={hasStaged ? t.captionHint : t.typeHint}
          autoComplete="off"
          enterKeyHint="send"
        />
        {text.trim() || hasStaged ? (
          <button type="submit" className="dk-sw-ibtn is-send" aria-label={t.send} title={t.send} data-sw="send">
            <Icon name="send" size={18} />
          </button>
        ) : (
          <button type="button" className="dk-sw-ibtn is-mic" aria-label={t.record} title={t.record} onClick={() => openSheet({ k: 'voice' })} data-sw="mic">
            <Icon name="mic" size={19} />
          </button>
        )}
      </form>
    </>
  )
}

type VoiceFn = (r: { text: string; source: 'mic' | 'sample'; lang: string }) => void

/* ------------------------------------------------------------------ the phone */

export function Phone({ persona, setPersona, convs, onCreated, flat }: PhoneProps) {
  const { lang } = useI18n()
  const t = useT()
  const shell = useShell()
  const { minutes } = useClock()
  const region = useWorld((s) => s.region.shortName)
  const citizens = useWorld((s) => PERSONA_KEYS.map((k) => personaCitizen(s, k)))
  const [sheet, setSheet] = useState<Sheet>(null)
  const [staged, setStaged] = useState<Staged>({})
  const openSheet = useCallback((s: Sheet) => setSheet(s), [])
  const voiceRef = useRef<VoiceFn | null>(null)
  const pick = (k: PersonaKey) => {
    if (k === persona) return
    setSheet(null)
    setStaged({})
    setPersona(k)
  }
  const cur = citizens[PERSONA_KEYS.indexOf(persona)]
  const body = (
    <div className="dk-sw-phone">
      <header className="dk-sw-ph-head">
        <span className="dk-sw-ph-logo" aria-hidden="true">
          <Icon name="sapa" size={18} />
        </span>
        <span className="dk-sw-ph-id">
          <b>
            {fill(t.account, { region })} <span className="dk-sw-tick" title={t.verified} aria-label={t.verified}><Icon name="check" size={10} strokeWidth={2.6} /></span>
          </b>
          <small>
            {t.official} · {t.via}
          </small>
        </span>
        {cur && <Avatar name={cur.name} size={24} />}
      </header>
      <div className="dk-sw-personas" role="radiogroup" aria-label={t.personaGroup}>
        {PERSONA_KEYS.map((k, i) => {
          const c = citizens[i]
          if (!c) return null
          const first = c.name.split(' ')[0] ?? c.name
          const title = k === 'siti' ? `Ibu ${first}` : k === 'darmo' ? `Pak ${first}` : first
          return (
            <button key={k} type="button" role="radio" aria-checked={k === persona} className={`dk-sw-persona${k === persona ? ' is-on' : ''}`} onClick={() => pick(k)} data-sw={`persona-${k}`}>
              <span className="dk-sw-pav" aria-hidden="true">
                {initialsOf(c.name)}
              </span>
              <span className="dk-sw-pname">{title}</span>
            </button>
          )
        })}
      </div>
      {cur && (
        <p className="dk-sw-pinfo">
          <span className="dk-num">{fill(t.years, { n: cur.age })}</span> · {cur.address} · <b>{t[STORY[persona]]}</b>
        </p>
      )}
      <Chat key={persona} persona={persona} convs={convs} onCreated={onCreated} openSheet={openSheet} staged={staged} setStaged={setStaged} voiceRef={voiceRef} />
      {sheet && (
        <Suspense fallback={null}>
          {sheet.k === 'voice' ? (
            <VoiceSheet persona={persona} pack={shell.pack} onClose={() => setSheet(null)} onResult={(r) => voiceRef.current?.(r)} />
          ) : sheet.k === 'attach' ? (
            <AttachSheet persona={persona} staged={staged} onStage={(s) => setStaged(s)} onClose={() => setSheet(null)} />
          ) : sheet.k === 'form' ? (
            <FormSheet persona={persona} serviceId={sheet.serviceId} onClose={() => setSheet(null)} onQueue={() => setSheet({ k: 'slots', serviceId: sheet.serviceId })} />
          ) : (
            <SlotSheet persona={persona} serviceId={sheet.serviceId} onClose={() => setSheet(null)} />
          )}
        </Suspense>
      )}
    </div>
  )
  const time = slotLabel(minutes)
  if (flat)
    return (
      <section className="dk-sw-flat" aria-label={t.phoneFrame}>
        <div className="dk-sw-flat-status" aria-hidden="true">
          <span className="dk-num">{time}</span>
          <span>{lang === 'id' ? 'HP Warga' : 'Citizen phone'}</span>
        </div>
        {body}
      </section>
    )
  return (
    <PhoneFrame label={t.phoneFrame} time={time} width="var(--dk-sw-phone-w)" className="dk-sw-frame" tilt={false}>
      {body}
    </PhoneFrame>
  )
}
