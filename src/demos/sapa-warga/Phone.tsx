/**
 * demos/sapa-warga/Phone.tsx — "HP Warga": a generic messenger with the official account of the region ("via WhatsApp"
 * label, generic verified tick), three persona cards, the AI chat (useAiChat: Simulasi or Live through the proxy),
 * quick questions, attachments (sample photos, the visitor's own photo, location), a hold-to-talk voice note (lazy
 * media kit) and the sheets for the NIB form and the MPP queue.
 *
 * Ticket creation: a voice note or a photo report creates the ticket at once (complaint.created, source sapa-warga),
 * then the AI answers about that ticket; a typed report creates it when the AI's `ticket` card arrives.
 */
import { lazy, startTransition, Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { useI18n } from '../../lib/i18n'
import { useAiChat, registerScenario, type ChatMessage } from '../../demo-kit/ai/chat'
import type { SimContext, SimResponse } from '../../demo-kit/ai/types'
import { PhoneFrame } from '../../demo-kit/frames'
import { Avatar, Icon, initialsOf } from '../../demo-kit/ui'
import { useNavigate } from 'react-router'
import { demoHref, dismissHotspot, useShell } from '../../demo-kit/shell'
import { languageLabel, regionalLanguageLabel } from '../../demo-kit/i18n'
import { clock, getSession, rows, useClock, useSession, useWorld, world, type Bi, type CitizenMessage, type ComplaintCategory, type WorldState } from '../../demo-kit/world'
import {
  PERSONA_KEYS, PHOTO_META, SLUG, SW, afterPaint, bookQueue, buildContext, categoryFromLabel, classifyReport, createComplaint, kecName, liveContext, looksRegional, opdForCategory, opdShort,
  personaCitizen, placeOf, reportCoord, resolvePlace, slotLabel, summaryOf, urgencyOf, voiceSampleFor, type Created, type PersonaKey, type PhotoId, type SwContext,
} from './model'
import { Thread, emptyConv, type Conv, type MsgMeta, type ThreadActions } from './Thread'
import { fill, useT } from './strings'

const loadVoice = () => import('./VoiceSheet')
const loadSheets = () => import('./Sheets')
const VoiceSheet = lazy(loadVoice)
const AttachSheet = lazy(() => loadSheets().then((m) => ({ default: m.AttachSheet })))
const FormSheet = lazy(() => loadSheets().then((m) => ({ default: m.FormSheet })))
const SlotSheet = lazy(() => loadSheets().then((m) => ({ default: m.SlotSheet })))
/** warm a sheet's chunk on intent (hover / focus / touch) so the first tap opens it at once */
const warmVoice = () => void loadVoice().catch(() => undefined)
const warmSheets = () => void loadSheets().catch(() => undefined)

/* ------------------------------------------------------------------ the conversations survive a reload / Back */

/**
 * The phone threads live in sessionStorage next to the persisted world (same region + seed), so a reload or a trip
 * to Meja Pimpinan and Back shows the same voice note, ticket card and replies the console still lists. A saved thread
 * is dropped when its tickets no longer belong to that persona (the world was reset or reseeded).
 */
const convKey = (s: WorldState) => `gamada:sw-convs:${s.regionId}:${s.seed}`
export function loadConvs(): Map<PersonaKey, Conv> {
  const out = new Map<PersonaKey, Conv>()
  try {
    const s = world.get()
    const raw = sessionStorage.getItem(convKey(s))
    if (!raw) return out
    const data = JSON.parse(raw) as Partial<Record<PersonaKey, Conv>>
    for (const k of PERSONA_KEYS) {
      const c = data[k]
      if (!c || !Array.isArray(c.messages) || !Array.isArray(c.timeline)) continue
      const cid = s.meta.personas[k]
      const owns = (x: Created | undefined) => !x || s.complaints.byId[x.complaintId]?.citizenId === cid
      if (!Object.values(c.created ?? {}).every(owns) || !Object.values(c.meta ?? {}).every((m) => owns(m.created))) continue
      out.set(k, {
        ...c,
        meta: c.meta ?? {},
        created: c.created ?? {},
        done: c.done ?? [],
        messages: c.messages.filter((m) => m.status !== 'thinking').map((m) => (m.status === 'streaming' ? { ...m, status: 'done' as const } : m)),
      })
    }
  } catch {
    /* blocked storage: the threads simply start fresh */
  }
  return out
}
/**
 * The finished answer of every simulated reply, by the question it answers (recorded when the scenario computes it,
 * before the typing animation starts). A thread saved while the AI is still "typing" (the visitor follows a toast to
 * Meja Pimpinan, or reloads) is saved with the whole answer, its card and its chips, never half a sentence.
 */
const finals = new Map<string, SimResponse>()
function finalOf(messages: ChatMessage[], i: number): ChatMessage {
  const m = messages[i]!
  if (m.role !== 'assistant' || (m.status !== 'thinking' && m.status !== 'streaming' && m.status !== 'stopped')) return m
  let q: ChatMessage | undefined
  for (let j = i - 1; j >= 0; j--)
    if (messages[j]!.role === 'user') {
      q = messages[j]
      break
    }
  const r = q ? finals.get(q.content.trim()) : undefined
  if (!r) return m
  const out: ChatMessage = {
    ...m,
    status: 'done',
    mode: m.mode ?? 'sim',
    content: r.text,
    structured: r.structured ? [r.structured] : (m.structured ?? []),
    followUps: r.followUps ?? [],
    toolCalls: m.toolCalls?.length ? m.toolCalls : (r.toolCalls ?? []).map((c, k) => ({ ...c, id: `${m.id}-t${k}` })),
  }
  if (r.translation) out.translation = r.translation
  return out
}
let saveTimer: ReturnType<typeof setTimeout> | null = null
let lastConvs: Map<PersonaKey, Conv> | null = null
function writeConvs(): void {
  const convs = lastConvs
  if (!convs) return
  try {
    const plain: Partial<Record<PersonaKey, Conv>> = {}
    for (const [k, c] of convs) {
      // the visitor's own photo is a blob URL of this page only: keep the bubble, not the URL
      const meta = Object.fromEntries(Object.entries(c.meta).map(([id, m]) => [id, m.photo?.url ? { ...m, photo: { ...m.photo, url: undefined } } : m]))
      plain[k] = { ...c, meta, messages: c.messages.map((_, i) => finalOf(c.messages, i)) }
    }
    sessionStorage.setItem(convKey(world.get()), JSON.stringify(plain))
  } catch {
    /* storage full or blocked: the thread lives in memory only */
  }
}
function saveConvs(convs: Map<PersonaKey, Conv>, now = false): void {
  lastConvs = convs
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = null
  if (now) {
    writeConvs()
    return
  }
  saveTimer = setTimeout(() => {
    saveTimer = null
    writeConvs()
  }, 400)
}
/* a reload or a tab close never loses the last change (the 400 ms debounce would) */
if (typeof window !== 'undefined')
  window.addEventListener('pagehide', () => {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
      writeConvs()
    }
  })

/** shown while a sheet's chunk is still on its way (cold first tap) */
function SheetSkeleton({ label }: { label: string }) {
  return (
    <div className="dk-sw-sheet is-loading" role="status" aria-busy="true">
      <span className="dk-sw-typing" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span>{label}</span>
    </div>
  )
}

/** the scenario chunk, registered once (input focus / first send) */
let scenarioLoad: Promise<void> | null = null
export function loadScenario(): Promise<void> {
  scenarioLoad ??= import('./scenario').then(
    (m) => {
      const sc = m.sapaWargaScenario
      // record each finished answer by its question (see finals above)
      const rec = <A extends unknown[]>(fn: (ctx: SimContext<SwContext>, ...a: A) => SimResponse) => (ctx: SimContext<SwContext>, ...a: A): SimResponse => {
        const r = fn(ctx, ...a)
        finals.set(ctx.text.trim(), r)
        return r
      }
      registerScenario<SwContext>({ ...sc, intents: sc.intents.map((x) => ({ ...x, respond: rec(x.respond) })), fallback: rec(sc.fallback) })
    },
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
type Sheet = null | { k: 'attach' } | { k: 'voice'; quick?: boolean } | { k: 'form'; serviceId: string } | { k: 'slots'; serviceId: string }

export interface PhoneProps {
  persona: PersonaKey
  setPersona: (k: PersonaKey) => void
  convs: Map<PersonaKey, Conv>
  onCreated: (c: Created, from: Element | null) => void
  flat: boolean
  /** mobile: switch to the console tab (offered after a report instead of switching on its own) */
  toConsole: (() => void) | null
  /** the phone is on screen (always on wide layouts; the HP Warga tab on phones) */
  active: boolean
  /** phone layout: the newest background complaint, shown in the slim status line (the desk is alive) */
  ticker?: { key: string; text: string } | null
}

/* ------------------------------------------------------------------ quick chips per persona */

type Quick = { label: Bi; text?: Bi | string; act?: 'voice' | 'photo' | 'queue' | 'ktp-rl' }
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
    { label: { id: 'KTP-el rusak', en: 'Damaged e-ID' }, act: 'ktp-rl' },
    { label: { id: 'Ambil antrean MPP', en: 'Book a service-mall slot' }, act: 'queue' },
    { label: { id: 'Cek status bansos', en: 'Check social-aid status' }, text: { id: 'Cek status penerima bansos', en: 'Check my social assistance status' } },
  ],
}
/** Pak Darmo's damaged e-ID question in the region's own language (samples, "contoh"); no chip without one */
const KTP_RL: Record<string, string> = {
  jv: 'KTP-el kula rusak, pripun carane ngurus?',
  su: 'KTP-el abdi ruksak, kumaha carana ngurus nu enggal?',
  min: 'KTP-el ambo rusak, baa caronyo mangurus nan baru?',
}
function quickFor(persona: PersonaKey, code: string | undefined): Quick[] {
  return QUICK[persona].flatMap((q): Quick[] => {
    if (q.act !== 'ktp-rl') return [q]
    const text = code ? KTP_RL[code] : undefined
    return text ? [{ label: { id: `${q.label.id} (${languageLabel(code!, 'id')})`, en: `${q.label.en} (${languageLabel(code!, 'en')})` }, text }] : []
  })
}
const STORY: Record<PersonaKey, 'personaSiti' | 'personaRaka' | 'personaDarmo'> = { siti: 'personaSiti', raka: 'personaRaka', darmo: 'personaDarmo' }

/* ------------------------------------------------------------------ chat (one per persona) */

const EMPTY_MSGS: CitizenMessage[] = []

function Chat({ persona, convs, onCreated, openSheet, staged, setStaged, voiceRef, notice, active }: {
  active: boolean
  voiceRef: { current: VoiceFn | null }
  notice: ReactNode
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
  const rlName = regionalLanguageLabel(pack, lang) ?? (lang === 'id' ? 'Bahasa Indonesia' : 'Indonesian')
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
  const navigate = useNavigate()

  const chat = useAiChat(SLUG, {
    mode: session.aiMode,
    role: 'warga',
    initial: saved.messages,
    getContext: () => {
      const c = buildContext(world.get(), pack, persona, clock.get().minutes, just.current)
      just.current = null
      // Live: one language, short strings, every service within the 6 KB budget (the full context rides along)
      return session.aiMode === 'live' ? liveContext(c) : c
    },
  })
  const { send: chatSend, prepare: chatPrepare, flush: chatFlush } = chat
  const busyRef = useRef(false)
  busyRef.current = chat.busy

  const ask = useCallback(
    async (q: string, meta?: MsgMeta, justCreated?: SwContext['justCreated']) => {
      const msg = q.trim()
      if (!msg) return
      dismissHotspot('sapa-warga:voice')
      if (meta) pending.current.push({ text: msg, meta })
      // a new message while the AI is still typing: finish that answer at once (text, card, chips) instead of
      // cutting it off mid-sentence
      if (busyRef.current) {
        chatFlush()
        await new Promise((r) => setTimeout(r, 40))
      }
      try {
        await loadScenario()
      } catch {
        /* the engine answers with its generic text; the chat still works */
      }
      just.current = justCreated ?? null
      void chatSend(msg)
    },
    [chatSend, chatFlush],
  )
  // a warm-up on focus (pointerdown on a chip focuses it): it runs after the next paint, never inside the tap (INP)
  const prepare = useCallback(() => {
    requestAnimationFrame(() =>
      setTimeout(() => {
        chatPrepare()
        void loadScenario().catch(() => undefined)
      }, 0),
    )
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
    // something arrived on the phone: the "Mulai dari sini" ring has done its job (it would sit under the new card)
    if (worldMsgs.length) dismissHotspot('sapa-warga:voice')
  }, [worldMsgs.length])
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
          // Simulasi sends ids; Live sends place names (create_ticket.location) → resolve them against the region
          const named = typeof d.kecamatanId === 'string' && d.kecamatanId ? null : resolvePlace(s, d.location, { kecamatanId: c.kecamatanId, desaId: c.desaId })
          const kecId = named ? named.kecamatanId : String(d.kecamatanId)
          const desaId = named ? named.desaId : typeof d.desaId === 'string' && d.desaId ? d.desaId : kecId === c.kecamatanId ? c.desaId : (s.region.kecamatan.find((k) => k.id === kecId)?.desa[0]?.id ?? c.desaId)
          const centre = s.region.kecamatan.find((k) => k.id === kecId)?.desa.find((x) => x.id === desaId)?.centroid
          const said = typeof d.text === 'string' ? d.text : (prevUser?.content ?? String(d.summary ?? ''))
          const jv = !!looksRegional(said)
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
    if (chat.messages.length) saveConvs(convs)
  }, [convs, persona, conv, chat.messages])

  /* back on the phone tab (mobile): show the newest message (ticket updates, the rating card) */
  const wasActive = useRef(active)
  useEffect(() => {
    if (active && !wasActive.current) {
      const sc = scroll.current
      if (sc) requestAnimationFrame(() => (sc.scrollTop = sc.scrollHeight))
    }
    wasActive.current = active
  }, [active])

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
      const rc = looksRegional(res.text)
      const jv = !!rc
      const cat = classifyReport(res.text)
      const words = res.text.split(/\s+/).length
      const langLabel = rc ? languageLabel(rc, lang) : lang === 'id' ? 'Bahasa Indonesia' : 'Indonesian'
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
    // photo / location report: clear the composer first (painted at once), create the ticket right after the paint
    const ph = staged.photo
    const hasLoc = !!staged.loc
    setText('')
    setStaged({})
    afterPaint(() => reportNow(q, ph, hasLoc))
  }
  const reportNow = (q: string, ph: Staged['photo'], hasLoc: boolean) => {
    const s = world.get()
    const c = personaCitizen(s, persona)
    if (!c) return
    const caption = q || (ph && ph.id !== 'own' ? PHOTO_META[ph.id].caption[lang] : '')
    const cat = (ph && ph.id !== 'own' ? PHOTO_META[ph.id].category : null) ?? classifyReport(caption)
    const loc = hasLoc ? { label: `${s.region.kecamatan.find((k) => k.id === c.kecamatanId)?.desa.find((d) => d.id === c.desaId)?.name ?? ''}, ${kecName(s, c.kecamatanId)}` } : undefined
    const meta: MsgMeta = { ...(ph ? { photo: ph } : {}), ...(loc ? { loc } : {}) }
    let j: SwContext['justCreated'] = null
    if (cat) {
      const r = createComplaint(s, {
        citizen: c, category: cat, channel: 'wa', text: caption, lang: looksRegional(caption) ? c.lang : 'id',
        summary: ph && ph.id !== 'own' && !q ? PHOTO_META[ph.id].caption : summaryOf(s, cat, caption, c.kecamatanId, c.desaId), photo: !!ph, urgency: urgencyOf(cat, caption),
      }, 1)
      meta.created = r
      j = justFrom(s, r, cat, 'wa', null)
      onCreated(r, composer.current)
    }
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
    // the regional greeting with its own translation; the service hint is a separate line in the UI language
    if (citizen && citizen.lang !== 'id' && g && g.lang === reg) return { text: g.text, translation: lang === 'id' ? g.id : g.en, hint: t.greetHint }
    return { text: t.greetingId, translation: null, hint: null }
  }, [pack, citizen, lang, t])

  const tips = useMemo(() => {
    const icons: Record<PersonaKey, ('mic' | 'camera' | 'bell' | 'checkCircle' | 'calendar' | 'search' | 'share')[]> = { siti: ['mic', 'camera', 'share', 'bell'], raka: ['checkCircle', 'calendar', 'mic'], darmo: ['mic', 'calendar', 'search'] }
    const txt = fill(persona === 'siti' ? t.tipsSiti : persona === 'raka' ? t.tipsRaka : t.tipsDarmo, { rl: rlName })
    // Ibu Siti's last tip (the BPBD warning) is a way to make it happen: send one from Siaga Wilayah, then come back
    const goSiaga = () => {
      const href = `${demoHref('siaga-wilayah', getSession())}&role=bpbd`
      const dev = new URLSearchParams(window.location.search).get('controls') === 'all'
      navigate(dev ? `${href}&controls=all` : href)
    }
    return txt.split('|').map((text, i, all) => ({ icon: icons[persona][i] ?? 'mic', text, ...(persona === 'siti' && i === all.length - 1 ? { go: goSiaga } : {}) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona, t, rlName])
  const rlCode = pack?.languages.regional[0]
  const quick = useMemo(() => quickFor(persona, rlCode), [persona, rlCode])
  const quickChips = useMemo(() => quick.flatMap((q) => [q.label[lang], ...(q.text ? [typeof q.text === 'string' ? q.text : q.text[lang]] : [])]), [quick, lang])
  const onQuick = (q: Quick) => {
    // the visitor has started: the "start here" ring retires (its per-frame placement would otherwise weigh on every
    // later tap on this phone; after the paint, not inside this one)
    afterPaint(() => dismissHotspot('sapa-warga:voice'))
    if (q.act === 'voice') openSheet({ k: 'voice', quick: true })
    else if (q.act === 'photo') {
      // INP: the staged photo + caption render as a transition (the chip's pressed state paints first)
      startTransition(() => {
        setStaged({ photo: { id: 'genangan', title: PHOTO_META.genangan.title }, loc: true })
        setText(PHOTO_META.genangan.caption[lang])
      })
    } else if (q.act === 'queue') openSheet({ k: 'slots', serviceId: persona === 'raka' ? 'nib-oss' : 'ktp-el' })
    else if (q.text) void ask(typeof q.text === 'string' ? q.text : q.text[lang])
  }
  const hasStaged = !!staged.photo || !!staged.loc
  // one object per change, so the memoised thread skips composer-only renders (typing, staging a photo)
  const threadConv = useMemo(() => ({ ...conv, messages: chat.messages }), [conv, chat.messages])

  return (
    <>
      <div ref={scroll} className="dk-sw-scroll">
        <Thread conv={threadConv} worldMsgs={worldById} greeting={greeting} tips={tips} actions={actions} scrollRef={scroll} quickChips={quickChips} />
      </div>
      {notice}
      <div className="dk-sw-quick" role="group" aria-label={t.quick}>
        {quick.map((q, i) => (
          <button
            key={i}
            type="button"
            className={`dk-sw-chip${q.act ? ' is-act' : ''}`}
            onClick={() => onQuick(q)}
            onFocus={() => {
              prepare()
              if (q.act === 'voice') warmVoice()
              else if (q.act === 'queue') warmSheets()
            }}
            onPointerEnter={q.act === 'voice' ? warmVoice : q.act === 'queue' ? warmSheets : undefined}
            onTouchStart={q.act === 'voice' ? warmVoice : q.act === 'queue' ? warmSheets : undefined}
            data-sw={q.act ? `quick-${q.act}` : undefined}
            data-hotspot={persona === 'siti' && q.act === 'voice' ? 'voice' : undefined}
          >
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
        <button type="button" className="dk-sw-ibtn" aria-label={t.attach} title={t.attach} onClick={() => openSheet({ k: 'attach' })} onPointerEnter={warmSheets} onTouchStart={warmSheets} onFocus={warmSheets} data-sw="attach">
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
          <button type="button" className="dk-sw-ibtn is-mic" aria-label={t.record} title={t.record} onClick={() => openSheet({ k: 'voice' })} onPointerEnter={warmVoice} onTouchStart={warmVoice} onFocus={warmVoice} data-sw="mic">
            <Icon name="mic" size={19} />
          </button>
        )}
      </form>
    </>
  )
}

type VoiceFn = (r: { text: string; source: 'mic' | 'sample'; lang: string }) => void

/* ------------------------------------------------------------------ the phone */

export function Phone({ persona, setPersona, convs, onCreated, flat, toConsole, active, ticker }: PhoneProps) {
  const { lang } = useI18n()
  const t = useT()
  const shell = useShell()
  const rlName = regionalLanguageLabel(shell.pack, lang) ?? (lang === 'id' ? 'Bahasa Indonesia' : 'Indonesian')
  const { minutes } = useClock()
  const region = useWorld((s) => s.region.shortName)
  const citizens = useWorld((s) => PERSONA_KEYS.map((k) => personaCitizen(s, k)))
  const [sheet, setSheet] = useState<Sheet>(null)
  const [staged, setStaged] = useState<Staged>({})
  const openSheet = useCallback((s: Sheet) => setSheet(s), [])
  const voiceRef = useRef<VoiceFn | null>(null)
  /* the voice sheet chunk is warmed on intent only (hover / focus / touchstart on the voice chip and the mic button),
     so it stays out of the first load (size limit) and the first tap still finds it ready */
  const [notice, setNotice] = useState<{ code: string; ticketId: string } | null>(null)
  /* the "in the console" banner is a moment, not a fixture: it goes once the ticket moves on or after 12 s */
  const noticeStatus = useWorld((s) => (notice ? s.tickets.byId[notice.ticketId]?.status ?? null : null))
  useEffect(() => {
    if (!notice) return
    if (noticeStatus && noticeStatus !== 'baru') {
      setNotice(null)
      return
    }
    const id = window.setTimeout(() => setNotice(null), 12000)
    return () => window.clearTimeout(id)
  }, [notice, noticeStatus])
  const pick = (k: PersonaKey) => {
    if (k === persona) return
    dismissHotspot('sapa-warga:voice')
    setSheet(null)
    setStaged({})
    setNotice(null)
    setPersona(k)
  }
  /* persona radiogroup: one tab stop, arrows move the selection (ARIA radio pattern) */
  const radios = useRef<HTMLDivElement>(null)
  const onRadioKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : e.key === 'Home' ? -99 : e.key === 'End' ? 99 : 0
    if (!step) return
    e.preventDefault()
    const i = PERSONA_KEYS.indexOf(persona)
    const n = PERSONA_KEYS.length
    const j = step === -99 ? 0 : step === 99 ? n - 1 : (i + step + n) % n
    const k = PERSONA_KEYS[j]!
    pick(k)
    radios.current?.querySelector<HTMLElement>(`[data-sw="persona-${k}"]`)?.focus()
  }
  /* a report on mobile: stay on the phone (the reply and its translation are the point) and offer the console */
  const created = useCallback(
    (c: Created, from: Element | null) => {
      onCreated(c, from)
      if (flat) setNotice({ code: c.code, ticketId: c.ticketId })
    },
    [onCreated, flat],
  )
  const cur = citizens[PERSONA_KEYS.indexOf(persona)]
  const body = (
    <div className="dk-sw-phone">
      <header className="dk-sw-ph-head">
        <span className="dk-sw-ph-logo" aria-hidden="true">
          <Icon name="sapa" size={18} />
        </span>
        <span className="dk-sw-ph-id">
          <b>
            {fill(t.account, { region })} <span className="dk-sw-tick" role="img" title={t.verified} aria-label={t.verified}><Icon name="check" size={10} strokeWidth={2.6} /></span>
          </b>
          <small>
            {t.official} · {t.via}
          </small>
        </span>
        {cur && <Avatar name={cur.name} size={24} />}
      </header>
      <div ref={radios} className="dk-sw-personas" role="radiogroup" aria-label={t.personaGroup} onKeyDown={onRadioKey}>
        {PERSONA_KEYS.map((k, i) => {
          const c = citizens[i]
          if (!c) return null
          const first = c.name.split(' ')[0] ?? c.name
          const title = k === 'siti' ? `Ibu ${first}` : k === 'darmo' ? `Pak ${first}` : first
          return (
            <button key={k} type="button" role="radio" aria-checked={k === persona} tabIndex={k === persona ? 0 : -1} title={title} className={`dk-sw-persona${k === persona ? ' is-on' : ''}`} onClick={() => pick(k)} data-sw={`persona-${k}`}>
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
          <span className="dk-num">{fill(t.years, { n: cur.age })}</span> · {cur.address} · <b>{fill(t[STORY[persona]], { rl: rlName })}</b>
        </p>
      )}
      <Chat
        key={persona}
        persona={persona}
        convs={convs}
        onCreated={created}
        openSheet={openSheet}
        staged={staged}
        setStaged={setStaged}
        voiceRef={voiceRef}
        active={active}
        notice={
          notice && toConsole ? (
            <div className="dk-sw-notice" role="status">
              <Icon name="checkCircle" size={16} />
              <span>{fill(t.inConsole, { code: notice.code })}</span>
              <button
                type="button"
                className="dk-sw-cbtn"
                onClick={() => {
                  setNotice(null)
                  toConsole()
                }}
                data-sw="to-console"
              >
                {t.seeConsole}
                <Icon name="arrowRight" size={14} />
              </button>
            </div>
          ) : null
        }
      />
      {sheet && (
        <Suspense fallback={<SheetSkeleton label={t.loading} />}>
          {sheet.k === 'voice' ? (
            <VoiceSheet persona={persona} pack={shell.pack} quick={!!sheet.quick} onClose={() => setSheet(null)} onResult={(r) => voiceRef.current?.(r)} />
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
  if (flat)
    return (
      <section className="dk-sw-flat" aria-label={t.phoneFrame}>
        {/* no clock here: on phones the kit's top bar already shows the demo clock */}
        <div className="dk-sw-flat-status" aria-hidden="true">
          {ticker ? (
            <span className="dk-sw-ticker" key={ticker.key}>
              <i />
              {ticker.text}
            </span>
          ) : (
            <span>{lang === 'id' ? 'HP Warga' : 'Citizen phone'}</span>
          )}
        </div>
        {body}
      </section>
    )
  return (
    <PhoneFrame label={t.phoneFrame} time={slotLabel(minutes)}width="var(--dk-sw-phone-w)" className="dk-sw-frame" tilt={false}>
      {body}
    </PhoneFrame>
  )
}
