/**
 * demos/radar-isu/Clarify.tsx — "Susun klarifikasi" (spec P4 step 3–4), a lazy drawer. Pick a tone (tegas /
 * menenangkan / informatif); the AI drafts a press release, a social caption (≤ 600 characters) and infographic points
 * through the hybrid engine (Simulasi by default, Live through the proxy's draft_clarification tool, falling back to
 * Simulasi). "Terbitkan" emits clarification.published (source radar-isu): the world posts the recovery mentions
 * over the next 30 world minutes and the sentiment line turns up.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Chip, Drawer, Icon, Segmented, dropChips } from '../../demo-kit/ui'
import { useAiChat, type Structured } from '../../demo-kit/ai/chat'
import { useShell } from '../../demo-kit/shell'
import { clock, emit, useSession, useWorld, world, type WorldState } from '../../demo-kit/world'
import { radarCtx } from './ctx'
import { useDeferredOpen } from './model'
import { clarification, type ClarificationData } from './clarify-text'
import { CHANNELS, CHANNEL_LABEL, TONES, type Channel, type Tone } from './strings'
import './scenario'

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
    drafting: 'AI menyusun klarifikasi…',
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
    drafting: 'The AI is drafting the clarification…',
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

function CopyBtn({ text, label, done }: { text: string; label: string; done: string }) {
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
        void navigator.clipboard?.writeText(text).then(
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
  const localDraft = useMemo(
    () => (!aiDraft && last?.status === 'done' ? clarification(radarCtx(world.get(), clock.get().minutes), tone, lang) : null),
    [aiDraft, last?.status, tone, lang],
  )
  const draft = aiDraft ?? localDraft

  // draft on open and on every tone change (the AI result lands in a few seconds); a new tone aborts the old draft
  const prompt = alert ? T.prompt(TONE_WORD[lang][tone]) : null
  const { send, stop } = chat
  useEffect(() => {
    if (!open || !prompt) return
    void send(prompt)
    return () => stop()
  }, [open, prompt, send, stop])

  const pointsRef = useRef<HTMLOListElement>(null)
  useEffect(() => {
    if (draft && pointsRef.current) return dropChips(pointsRef.current)
  }, [draft])

  const publish = () => {
    if (!alert || !draft || !channels.length) return
    emit('clarification.published', { hoaxId: alert.id, tone, channels }, 'radar-isu')
    shell.toast({
      title: fill(T.published, { n: channels.length }),
      tone: 'accent',
      icon: 'check',
    })
    onClose()
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
                <Chip key={c} selected={channels.includes(c)} onToggle={() => setChannels((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]))}>
                  {CHANNEL_LABEL[c][lang]}
                </Chip>
              ))}
            </div>
          </fieldset>
          {!channels.length && <p className="dk-ri-note is-warn">{T.needChannel}</p>}
          <Button variant="primary" icon="send" onClick={publish} disabled={!draft || busy || !channels.length || alert?.status !== 'aktif'} data-testid="ri-publish">
            {mode === 'approve' ? T.approve : T.publish}
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
          {last?.status === 'thinking' && (
            <p className="dk-ri-think">
              <span className="dk-ri-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              {T.drafting}
            </p>
          )}
          {last && last.content && <p className="dk-ri-clar-ans">{last.content}</p>}
          {!!last?.toolCalls?.length && (
            <ol className="dk-ri-steps" aria-label={T.steps}>
              {last.toolCalls.map((c) => (
                <li key={c.id}>
                  <Icon name="check" size={13} /> <code>{c.name}</code>
                  {c.ms ? <span className="dk-num"> · {c.ms} ms</span> : null}
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

        {draft && !busy && (
          <div className="dk-ri-draft">
            {localDraft && <p className="dk-ri-note">{T.localDraft}</p>}
            <section className="dk-ri-draft-sec">
              <header className="dk-ri-draft-h">
                <h3 className="dk-ri-sec-t">{T.press}</h3>
                <CopyBtn text={draft.pressRelease} label={T.copy} done={T.copied} />
              </header>
              <div className="dk-ri-press">{draft.pressRelease.split(/\n{2,}/).map((para, i) => (i === 0 ? <h4 key={i}>{para}</h4> : <p key={i}>{para}</p>))}</div>
            </section>
            <section className="dk-ri-draft-sec">
              <header className="dk-ri-draft-h">
                <h3 className="dk-ri-sec-t">{T.caption}</h3>
                <span className="dk-ri-k dk-num">{fill(T.chars, { n: draft.socialCaption.length })}</span>
                <CopyBtn text={draft.socialCaption} label={T.copy} done={T.copied} />
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
            <p className="dk-ri-note">{T.simData}</p>
          </div>
        )}
      </div>
    </Drawer>
  )
}
