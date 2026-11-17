/**
 * AskAi (lazy) — the verification assistant under the result: explains the verdict, the heatmap, the NIK, what is
 * missing, the bansos batch and quota. Simulation by default (scenario.ts, registered when this chunk loads); in Live
 * mode the same chat goes through the proxy (prompts/cek-berkas.ts, tool check_documents → kind 'doc-check') and
 * falls back to the simulation automatically. Context: the result on screen + the world batch, ≤ 2 KB.
 */
import { useCallback, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { registerScenario, useAiChat, type ChatMessage, type Structured } from '../../demo-kit/ai/chat'
import { useShell } from '../../demo-kit/shell'
import { Icon, IconButton } from '../../demo-kit/ui'
import { hhmm, rows, useSession, world } from '../../demo-kit/world'
import { bansosBatch } from '../../demo-kit/world/satu-daerah'
import { useI18n, type Lang } from '../../lib/i18n'
import { bulkLog, bulkProcessed, sessionLog, summarize, type CekContext, type CekRole } from './model'
import { cekScenario } from './scenario'
import { STR } from './strings'

registerScenario(cekScenario)

function buildContext(role: CekRole, doc: CekContext['doc']): CekContext {
  const s = world.get()
  const name = (id: string) => s.region.kecamatan.find((k) => k.id === id)?.name ?? id
  const prog = rows(s.programs).find((p) => p.open && p.kind === 'bansos-banjir')
  const log = sessionLog.get()
  // the batch this session last emitted (what the grid shows and the world holds); else the live batch
  const ran = bulkLog.get()
  const live = ran ? null : bansosBatch(s)
  const sum = ran ? ran.summary : summarize(live!)
  const zone = ran ? ran.zone : live!.zone
  const b = { total: sum.total, lolos: sum.lolos, kurang: sum.kurang, ganda: sum.ganda, gandaPairs: sum.gandaPairs, luarZona: sum.luarZona, outside: sum.outside }
  return {
    role,
    mode: 'single',
    doc,
    batch: { ...b, processed: !!ran || bulkProcessed(s), zone: zone.map(name) },
    program: prog ? { quota: prog.quota, kecamatan: prog.kecamatanIds.map(name), openedAt: hhmm(prog.openedAt) } : null,
    session: { verified: log.length, manual: log.filter((r) => r.verdict === 'cek-manual').length },
    region: s.region.name,
  }
}

export default function AskAi({ role, doc, onClose }: { role: CekRole; doc: CekContext['doc']; onClose: () => void }) {
  const { lang } = useI18n()
  const t = STR[lang]
  const session = useSession()
  const shell = useShell()
  const docRef = useRef(doc)
  docRef.current = doc
  const getContext = useCallback(() => buildContext(role, docRef.current), [role])
  const chat = useAiChat('cek-berkas', { getContext, mode: session.aiMode, role })
  const [draft, setDraft] = useState('')
  const logRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const last = chat.messages[chat.messages.length - 1]

  useLayoutEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chat.messages.length, last?.content.length, last?.structured?.length, chat.followUps.length])

  useLayoutEffect(() => {
    inputRef.current?.focus({ preventScroll: true })
  }, [])

  const ask = (text: string) => {
    void chat.send(text)
    shell.markMission('ask-ai')
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (chat.busy) {
      chat.stop()
      return
    }
    const v = draft.trim()
    if (!v) return
    setDraft('')
    ask(v)
  }
  const starters = lang === 'id'
    ? doc?.verdict === 'cek-manual'
      ? ['Kenapa perlu cek manual?', 'Bagian mana yang diedit?', 'Apa yang harus disampaikan ke warga?']
      : doc?.verdict === 'kurang'
        ? ['Apa yang kurang?', 'Apa yang harus disampaikan ke warga?', 'Bagaimana NIK dicek?']
        : ['Kenapa hasilnya begitu?', 'Bagaimana NIK dicek?', 'Berapa NIK ganda?']
    : doc?.verdict === 'cek-manual'
      ? ['Why does it need a manual check?', 'Which part was edited?', 'What should I tell the citizen?']
      : doc?.verdict === 'kurang'
        ? ['What is missing?', 'What should I tell the citizen?', 'How is the NIK checked?']
        : ['Why this result?', 'How is the NIK checked?', 'How many duplicate NIKs?']
  const suggestions = chat.messages.length === 0 ? starters : chat.followUps

  return (
    <section
      className="dk-cb-chat"
      aria-label={t.aiTitle}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return
        e.stopPropagation()
        onClose()
      }}
    >
      <header className="dk-cb-chat-head">
        <span className="dk-cb-chat-av" aria-hidden="true">
          <Icon name="spark" size={16} />
        </span>
        <span className="dk-cb-chat-who">
          <b>{t.aiTitle}</b>
          <small>{t.aiSub}</small>
        </span>
        <span className={`dk-cb-chat-mode${session.aiMode === 'live' ? ' is-live' : ''}`}>{session.aiMode === 'live' ? t.aiLive : t.aiSim}</span>
        <IconButton icon="close" label={t.aiClose} size="sm" onClick={onClose} />
      </header>
      <div className="dk-cb-chat-log" ref={logRef} role="log" aria-live="polite" aria-relevant="additions">
        {chat.messages.length === 0 && <p className="dk-cb-chat-empty">{t.aiEmpty}</p>}
        {chat.messages.map((m) => (m.role === 'user' ? <p key={m.id} className="dk-cb-msg is-user">{m.content}</p> : <AiMsg key={m.id} m={m} lang={lang} />))}
      </div>
      {suggestions.length > 0 && !chat.busy && (
        <div className="dk-cb-chat-chips" role="group" aria-label={t.aiSuggest}>
          {suggestions.map((s) => (
            <button key={s} type="button" onClick={() => ask(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
      <form className="dk-cb-chat-form" onSubmit={submit}>
        <label className="dk-sr" htmlFor="dk-cb-ask">
          {t.aiInput}
        </label>
        <input id="dk-cb-ask" ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} onFocus={chat.prepare} placeholder={t.aiPlaceholder} autoComplete="off" maxLength={400} />
        <button type="submit" className={chat.busy ? 'is-stop' : ''} aria-label={chat.busy ? t.aiStop : t.aiSend}>
          <Icon name={chat.busy ? 'pause' : 'send'} size={16} />
        </button>
      </form>
    </section>
  )
}

function AiMsg({ m, lang }: { m: ChatMessage; lang: Lang }) {
  const t = STR[lang]
  if (m.status === 'thinking') {
    return (
      <div className="dk-cb-typing" role="status">
        <i aria-hidden="true" />
        <i aria-hidden="true" />
        <i aria-hidden="true" />
        <span className="dk-sr">{t.aiThinking}</span>
      </div>
    )
  }
  const streaming = m.status === 'streaming'
  return (
    <div className={`dk-cb-msg is-ai${m.status === 'error' ? ' is-error' : ''}`}>
      <p aria-hidden={streaming || undefined}>{renderBold(m.content)}</p>
      {m.translation && (
        <p className="dk-cb-msg-tr">
          <span className="dk-sr">{t.aiTranslation}: </span>
          {renderBold(m.translation)}
        </p>
      )}
      {!!m.toolCalls?.length && (
        <div className="dk-cb-steps">
          {m.toolCalls.map((c) => (
            <span key={c.id}>
              <Icon name="zap" size={11} />
              {c.name}
              <i className="dk-num">{c.ms ?? 0} ms</i>
            </span>
          ))}
        </div>
      )}
      {m.structured?.map((s, i) => <DocCheck key={i} s={s} lang={lang} />)}
      {(m.status === 'done' || m.status === 'stopped') && (
        <span className="dk-cb-msg-meta">
          {m.mode === 'live' ? t.aiLive : t.aiSim}
          {m.fellBack ? ` · ${t.aiFell}` : ''}
        </span>
      )}
    </div>
  )
}

const STATUS_NAME: Record<string, { id: string; en: string }> = {
  lengkap: { id: 'Lengkap', en: 'Complete' },
  kurang: { id: 'Kurang', en: 'Incomplete' },
  ganda: { id: 'Ganda', en: 'Duplicate' },
  diedit: { id: 'Diedit', en: 'Edited' },
}

function DocCheck({ s, lang }: { s: Structured; lang: Lang }) {
  const t = STR[lang]
  if (s.kind !== 'doc-check') return null
  const d = s.data as { status?: string; missing?: string[]; notes?: string[] }
  return (
    <div className="dk-cb-struct">
      <span className="dk-cb-struct-h">{t.aiResult} · check_documents</span>
      <span className={`dk-cb-struct-chip is-${d.status ?? ''}`}>
        <small>{t.aiStatus}</small>
        {STATUS_NAME[d.status ?? '']?.[lang] ?? d.status}
      </span>
      {!!d.missing?.length && (
        <span className="dk-cb-struct-chip">
          <small>{t.aiMissing}</small>
          {d.missing.join('; ')}
        </span>
      )}
      {!!d.notes?.length && (
        <span className="dk-cb-struct-chip">
          <small>{t.aiNotes}</small>
          {d.notes.join(' · ')}
        </span>
      )}
    </div>
  )
}

/** **bold** → <b> (the only markdown the prompt allows) */
function renderBold(text: string) {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  return parts.map((p, i) => (i % 2 ? <b key={i}>{p}</b> : p))
}
