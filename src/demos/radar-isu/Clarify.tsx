/**
 * demos/radar-isu/Clarify.tsx — "Susun klarifikasi" (spec P4 step 3–4), a lazy drawer. Pick a tone (tegas /
 * menenangkan / informatif); the AI drafts a press release, a social caption (≤ 600 characters) and infographic points
 * through the hybrid engine (Simulasi by default, Live through the proxy's draft_clarification tool, falling back to
 * Simulasi). "Terbitkan" emits clarification.published (source radar-isu): the world posts the recovery mentions
 * over the next 30 world minutes and the sentiment line turns up.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Chip, Drawer, Icon, Segmented, Skeleton, dropChips } from '../../demo-kit/ui'
import { useAiChat, type Structured } from '../../demo-kit/ai/chat'
import { useShell } from '../../demo-kit/shell'
import { clock, emit, useSession, useWorld, world, type WorldState } from '../../demo-kit/world'
import { radarCtx } from './ctx'
import { afterPaint, approvalFor, recordClarAudit, useDeferredOpen } from './model'
import { clockWib } from '../../demo-kit/viz/format'
import { clarification, type ClarificationData } from './clarify-text'
import { CHANNELS, CHANNEL_LABEL, TONES, type Channel, type Tone } from './strings'
import './scenario'

/** real ms the simulated drafting may take before the rest of the draft is shown at once */
const DRAFT_CAP_MS = 1300
/** real ms the simulated approver (Head of the Communications Office) takes to answer, then a beat to read it */
const APPROVE_MS = 1300
const READ_MS = 700

const S = {
  id: {
    titleDraft: 'Susun klarifikasi',
    titleApprove: 'Tinjau & setujui klarifikasi',
    eyebrow: 'Peringatan hoaks {id}',
    tone: 'Nada',
    toneOpts: {
      tegas: 'Tegas',
      menenangkan: 'Menenangkan',
      informatif: 'Informatif',
    } as Record<Tone, string>,
    drafting: 'Menyusun draf klarifikasi…',
    steps: 'Langkah agent',
    press: 'Rilis pers',
    caption: 'Caption media sosial',
    chars: '{n}/600 karakter',
    infographic: 'Teks infografis',
    copy: 'Salin',
    copied: 'Tersalin',
    channels: 'Terbitkan ke',
    publish: 'Terbitkan (simulasi)',
    approve: 'Setujui & terbitkan (simulasi)',
    needChannel: 'Pilih minimal satu kanal.',
    redraft: 'Susun ulang',
    mode: { sim: 'Simulasi', live: 'Live' },
    fellBack: 'AI Live sedang sibuk, draf ini dari Simulasi.',
    simData: 'Angka dari pos pantau Siaga Wilayah (data simulasi).',
    localDraft: 'AI Live menjawab tanpa draf terstruktur; draf di bawah disusun dari data di layar.',
    published: 'Klarifikasi terbit di {n} kanal. Sentimen dipantau 30 menit ke depan.',
    approveNote: 'Disusun oleh Humas/Diskominfo, menunggu persetujuan Anda.',
    error: 'Draf gagal disusun. Coba susun ulang.',
    prompt: (tone: string) => `Susun klarifikasi nada ${tone} untuk hoaks bendungan`,
    simMark: '[SIMULASI DEMO GAMADA]',
    tools: {
      'siaga_wilayah.tinggi_muka_air': 'Cek data pos pantau Siaga Wilayah',
      susun_klarifikasi: 'Susun draf rilis, caption, dan infografis',
      cek_hoaks: 'Cek status hoaks',
      sapa_warga: 'Cek laporan warga di Sapa Warga',
    } as Record<string, string>,
    publishBusy: 'Menyusun draf…',
    submit: 'Ajukan persetujuan & terbitkan (simulasi)',
    releasedAs: 'Rilis atas nama Diskominfo, tanpa kutipan Kepala Daerah.',
    waiting: 'Menunggu persetujuan…',
    auditWait: 'Jejak persetujuan: disusun {d} · menunggu persetujuan {a} · draf v{v}.',
    auditAsking: 'Jejak persetujuan: disusun {d} pukul {t} · diajukan ke {a}, menunggu jawaban… · draf v{v}.',
    auditDone: 'Jejak persetujuan: disusun {d} pukul {t} · disetujui {a} pukul {u} (persetujuan disimulasikan) · draf v{v}.',
    auditHead: 'Jejak persetujuan: disusun {d} · menunggu persetujuan Anda ({a}) · draf v{v}. Tercatat di Laporan dan ekspor.',
    publishedBy: 'Disetujui {a} pukul {u}.',
  },
  en: {
    titleDraft: 'Draft a clarification',
    titleApprove: 'Review & approve the clarification',
    eyebrow: 'Hoax alert {id}',
    tone: 'Tone',
    toneOpts: {
      tegas: 'Firm',
      menenangkan: 'Reassuring',
      informatif: 'Informative',
    } as Record<Tone, string>,
    drafting: 'Drafting the clarification…',
    steps: 'Agent steps',
    press: 'Press release',
    caption: 'Social media caption',
    chars: '{n}/600 characters',
    infographic: 'Infographic text',
    copy: 'Copy',
    copied: 'Copied',
    channels: 'Publish to',
    publish: 'Publish (simulated)',
    approve: 'Approve & publish (simulated)',
    needChannel: 'Pick at least one channel.',
    redraft: 'Redraft',
    mode: { sim: 'Simulation', live: 'Live' },
    fellBack: 'AI Live is busy; this draft comes from the Simulation.',
    simData: 'Figures from the Siaga Wilayah gauge (simulated data).',
    localDraft: 'AI Live answered without a structured draft; the draft below is built from the data on screen.',
    published: 'Clarification published on {n} channels. Sentiment is monitored for the next 30 minutes.',
    approveNote: 'Drafted by the Comms Office, awaiting your approval.',
    error: 'The draft failed. Try redrafting.',
    prompt: (tone: string) => `Draft a ${tone} clarification for the dam hoax`,
    simMark: '[GAMADA DEMO SIMULATION]',
    tools: {
      'siaga_wilayah.tinggi_muka_air': 'Checked the Siaga Wilayah gauge',
      susun_klarifikasi: 'Drafted the release, caption and infographic',
      cek_hoaks: 'Checked the hoax status',
      sapa_warga: 'Checked citizen reports in Sapa Warga',
    } as Record<string, string>,
    publishBusy: 'Drafting…',
    submit: 'Send for approval & publish (simulated)',
    releasedAs: 'Released in the Comms Office’s name, no quote of the Regional Head.',
    waiting: 'Waiting for approval…',
    auditWait: 'Approval trail: drafted by the {d} · awaiting approval by the {a} · draft v{v}.',
    auditAsking: 'Approval trail: drafted by the {d} at {t} · sent to the {a}, awaiting an answer… · draft v{v}.',
    auditDone: 'Approval trail: drafted by the {d} at {t} · approved by the {a} at {u} (simulated approval) · draft v{v}.',
    auditHead: 'Approval trail: drafted by the {d} · awaiting your approval ({a}) · draft v{v}. Recorded in the Report and the exports.',
    publishedBy: 'Approved by the {a} at {u}.',
  },
}
const TONE_WORD = {
  id: { tegas: 'tegas', menenangkan: 'menenangkan', informatif: 'informatif' },
  en: { tegas: 'firm', menenangkan: 'reassuring', informatif: 'informative' },
} as const

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m))

function asClarification(st: Structured[]): ClarificationData | null {
  const x = st.find((v) => v.kind === 'clarification')
  if (!x) return null
  const d = x.data as Partial<ClarificationData>
  if (typeof d.pressRelease !== 'string' || typeof d.socialCaption !== 'string' || !Array.isArray(d.infographicPoints)) return null
  return d as ClarificationData
}

function CopyBtn({ text, label, done, mark }: { text: string; label: string; done: string; mark: string }) {
  const [ok, setOk] = useState(false)
  useEffect(() => {
    if (!ok) return
    const id = window.setTimeout(() => setOk(false), 1600)
    return () => window.clearTimeout(id)
  }, [ok])
  return (
    <Button
      size="sm"
      variant="ghost"
      icon={ok ? 'check' : 'copy'}
      onClick={() => {
        // a copied draft leaves the demo: it carries the simulation marker so it cannot pass as an official text
        void navigator.clipboard?.writeText(`${mark}\n${text}`).then(
          () => setOk(true),
          () => setOk(false),
        )
      }}
      aria-live="polite"
    >
      {ok ? done : label}
    </Button>
  )
}

const selRole = (s: WorldState) => s.hoaxAlerts

export default function Clarify({ open, mode, hoaxId, onClose }: { open: boolean; mode: 'draft' | 'approve'; hoaxId: string; onClose: () => void }) {
  const session = useSession()
  const bodyRef = useRef<HTMLDivElement>(null)
  const shown = useDeferredOpen(open, bodyRef)
  const lang = session.lang
  const T = S[lang]
  const shell = useShell()
  const hoaxes = useWorld(selRole)
  const alert = hoaxes.byId[hoaxId]
  const [tone, setTone] = useState<Tone>(mode === 'approve' ? 'menenangkan' : 'menenangkan')
  const [channels, setChannels] = useState<Channel[]>(['situs-resmi', 'medsos-resmi', 'grup-wa'])
  const chat = useAiChat('radar-isu', {
    mode: session.aiMode,
    role: session.role,
    lang,
    getContext: () => radarCtx(world.get(), clock.get().minutes),
  })
  const last = chat.last
  const aiDraft = useMemo(() => asClarification(chat.structured), [chat.structured])
  // a Live answer without the structured package (the model only wrote text): fall back to the package built from
  // the same on-screen facts, and say so
  const localDraft = useMemo(() => (!aiDraft && last?.status === 'done' ? clarification(radarCtx(world.get(), clock.get().minutes), tone, lang) : null), [aiDraft, last?.status, tone, lang])
  const draft = aiDraft ?? localDraft

  // draft on open and on every tone change (the AI result lands in a few seconds); a new tone aborts the old draft
  const prompt = alert ? T.prompt(TONE_WORD[lang][tone]) : null
  const { send, stop } = chat
  // every draft request (open, tone change, redraft) is a draft version in the approval trail
  const version = useRef(0)
  const lastPrompt = useRef<string | null>(null)
  useEffect(() => {
    if (!open || !prompt) return
    // a re-run of the same request (dev StrictMode) is not a new draft
    if (lastPrompt.current !== prompt) version.current++
    lastPrompt.current = prompt
    void send(prompt)
    return () => stop()
  }, [open, prompt, send, stop])
  // a simulated draft never keeps the visitor waiting long: after DRAFT_CAP_MS the rest of it shows at once
  const { flush, busy: chatBusy } = chat
  useEffect(() => {
    if (!chatBusy) return
    const id = window.setTimeout(flush, DRAFT_CAP_MS)
    return () => window.clearTimeout(id)
  }, [chatBusy, flush])
  /* the approval is a step of its own: the Comms Office sends the draft to its head (a simulated approver who answers
     after a moment, labelled as such) and the release goes out only once approved; the Regional Head approves herself */
  const [stage, setStage] = useState<'draft' | 'asking' | 'approved'>('draft')
  const times = useRef<{ drafted: number; approved: number }>({
    drafted: 0,
    approved: 0,
  })
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), [])
  const approval = approvalFor(session.role)

  const pointsRef = useRef<HTMLOListElement>(null)
  useEffect(() => {
    if (draft && pointsRef.current) return dropChips(pointsRef.current)
  }, [draft])

  const head = mode === 'approve'
  const release = () => {
    if (!alert || !draft || !channels.length) return
    const payload = { hoaxId: alert.id, tone, channels: [...channels] }
    recordClarAudit(alert.id, {
      ...approval,
      version: Math.max(1, version.current),
      draftedAt: times.current.drafted,
      approvedAt: times.current.approved,
      simulated: !head,
    })
    // the drawer closes and the toast shows in this frame; the world update (recovery mentions, every subscriber
    // re-rendering) follows right after the paint
    onClose()
    // phones: the card itself now says "Diklarifikasi … disetujui …" in view; a second toast would only stack on
    // the detection toast over the card's next step
    if (shell.size !== 'sm')
      shell.toast({
        title: fill(T.published, { n: payload.channels.length }),
        body: fill(T.publishedBy, {
          a: approval.approvedBy[lang],
          u: clockWib(times.current.approved, lang),
        }),
        tone: 'accent',
        icon: 'check',
      })
    afterPaint(() => emit('clarification.published', payload, 'radar-isu'))
  }
  const publish = () => {
    if (!alert || !draft || !channels.length || stage !== 'draft') return
    const now = clock.get().minutes
    times.current = { drafted: now, approved: now }
    if (head) {
      // the Regional Head's own click is the approval
      release()
      return
    }
    setStage('asking')
    timers.current.push(
      window.setTimeout(() => {
        times.current.approved = Math.max(times.current.drafted, clock.get().minutes)
        setStage('approved')
        timers.current.push(window.setTimeout(release, READ_MS))
      }, APPROVE_MS),
    )
  }

  const busy = chat.busy
  return (
    <Drawer
      open={shown}
      onClose={onClose}
      title={mode === 'approve' ? T.titleApprove : T.titleDraft}
      eyebrow={fill(T.eyebrow, { id: hoaxId })}
      width={600}
      footer={
        <div className="dk-ri-clar-foot">
          <fieldset className="dk-ri-chan">
            <legend className="dk-ri-k">{T.channels}</legend>
            <div className="dk-ri-chips">
              {CHANNELS.map((c) => (
                <Chip
                  key={c}
                  selected={channels.includes(c)}
                  aria-describedby={channels.length ? undefined : 'dk-ri-needch'}
                  onToggle={() => setChannels((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]))}
                >
                  {CHANNEL_LABEL[c][lang]}
                </Chip>
              ))}
            </div>
          </fieldset>
          {!channels.length && (
            <p id="dk-ri-needch" className="dk-ri-note is-warn">
              {T.needChannel}
            </p>
          )}
          <p className={`dk-ri-note dk-ri-audit${stage === 'approved' ? ' is-ok' : ''}`} aria-live="polite">
            <Icon name={stage === 'approved' ? 'check' : 'stamp'} size={13} />{' '}
            {fill(head ? T.auditHead : stage === 'asking' ? T.auditAsking : stage === 'approved' ? T.auditDone : T.auditWait, {
              d: approval.draftedBy[lang],
              a: approval.approvedBy[lang],
              v: Math.max(1, version.current),
              t: clockWib(times.current.drafted, lang),
              u: clockWib(times.current.approved, lang),
            })}
          </p>
          {/* while the AI drafts, the button says so (never a near-normal button that silently ignores a tap) */}
          <Button
            variant="primary"
            icon={stage === 'draft' ? 'send' : 'stamp'}
            onClick={publish}
            busy={busy || stage === 'asking'}
            disabled={!draft || busy || stage !== 'draft' || !channels.length || alert?.status !== 'aktif'}
            data-testid="ri-publish"
          >
            {busy ? T.publishBusy : stage !== 'draft' ? fill(T.waiting, { a: approval.approvedBy[lang] }) : head ? T.approve : fill(T.submit, { a: approval.approvedBy[lang] })}
          </Button>
        </div>
      }
    >
      <div ref={bodyRef} className="dk-ri-clar">
        {mode === 'approve' && <p className="dk-ri-note">{T.approveNote}</p>}
        {alert && <p className="dk-ri-hoax-claim">“{alert.claim[lang]}”</p>}
        <div className="dk-ri-clar-tone">
          <span className="dk-ri-k">{T.tone}</span>
          <Segmented<Tone> label={T.tone} value={tone} onChange={setTone} options={TONES.map((x) => ({ value: x, label: T.toneOpts[x] }))} />
        </div>

        <div className="dk-ri-clar-ai" aria-live="polite" aria-busy={busy}>
          {busy && (
            <p className="dk-ri-think">
              <span className="dk-ri-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              {T.drafting}
            </p>
          )}
          {!busy && last && last.content && <p className="dk-ri-clar-ans">{last.content}</p>}
          {!!last?.toolCalls?.length && (
            <ol className="dk-ri-steps" aria-label={T.steps}>
              {last.toolCalls.map((c) => (
                <li key={c.id}>
                  <Icon name="check" size={13} /> <span>{T.tools[c.name] ?? c.name.replace(/[._]/g, ' ')}</span>
                </li>
              ))}
            </ol>
          )}
          {last?.status === 'error' && (
            <p className="dk-ri-note is-warn">
              {T.error}{' '}
              <Button size="sm" variant="ghost" icon="refresh" onClick={() => prompt && void chat.send(prompt)}>
                {T.redraft}
              </Button>
            </p>
          )}
          {last?.status === 'done' && (
            <p className="dk-ri-mode">
              <span className={`dk-ri-mode-pill is-${last.mode ?? 'sim'}`}>{T.mode[last.mode ?? 'sim']}</span>
              {last.fellBack && <span className="dk-ri-note">{T.fellBack}</span>}
            </p>
          )}
        </div>

        {busy && (
          <div className="dk-ri-draft is-skel" aria-hidden="true">
            <section className="dk-ri-draft-sec">
              <header className="dk-ri-draft-h">
                <h3 className="dk-ri-sec-t">{T.press}</h3>
              </header>
              <div className="dk-ri-press">
                <Skeleton height={16} width="70%" />
                <Skeleton lines={4} />
              </div>
            </section>
            <section className="dk-ri-draft-sec">
              <header className="dk-ri-draft-h">
                <h3 className="dk-ri-sec-t">{T.caption}</h3>
              </header>
              <div className="dk-ri-caption">
                <Skeleton lines={3} />
              </div>
            </section>
            <section className="dk-ri-draft-sec">
              <header className="dk-ri-draft-h">
                <h3 className="dk-ri-sec-t">{T.infographic}</h3>
              </header>
              <Skeleton lines={3} height={28} />
            </section>
          </div>
        )}
        {draft && !busy && (
          <div className="dk-ri-draft">
            {localDraft && <p className="dk-ri-note">{T.localDraft}</p>}
            <section className="dk-ri-draft-sec">
              <header className="dk-ri-draft-h">
                <h3 className="dk-ri-sec-t">{T.press}</h3>
                <CopyBtn text={draft.pressRelease} label={T.copy} done={T.copied} mark={T.simMark} />
              </header>
              <div className="dk-ri-press">{draft.pressRelease.split(/\n{2,}/).map((para, i) => (i === 0 ? <h4 key={i}>{para}</h4> : <p key={i}>{para}</p>))}</div>
            </section>
            <section className="dk-ri-draft-sec">
              <header className="dk-ri-draft-h">
                <h3 className="dk-ri-sec-t">{T.caption}</h3>
                <span className="dk-ri-k dk-num">{fill(T.chars, { n: draft.socialCaption.length })}</span>
                <CopyBtn text={draft.socialCaption} label={T.copy} done={T.copied} mark={T.simMark} />
              </header>
              <p className="dk-ri-caption">{draft.socialCaption}</p>
            </section>
            <section className="dk-ri-draft-sec">
              <header className="dk-ri-draft-h">
                <h3 className="dk-ri-sec-t">{T.infographic}</h3>
              </header>
              <ol ref={pointsRef} className="dk-ri-info">
                {draft.infographicPoints.map((pt, i) => (
                  <li key={i}>
                    <span className="dk-ri-info-n dk-num">{i + 1}</span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ol>
            </section>
            <p className="dk-ri-note">
              {T.simData}
              {!head && ` ${T.releasedAs}`}
            </p>
          </div>
        )}
      </div>
    </Drawer>
  )
}
