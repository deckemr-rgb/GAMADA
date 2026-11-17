/**
 * Surat Masuk tab (lazy). Inbox of world letters; the recent ones are shown as the kit's original letter samples
 * (three of them crooked scans). "Baca & susun disposisi": the scan straightens (DocViewer deskew), OCR boxes
 * appear one by one, the AI (Simulasi / Live) writes the 3-line summary, type, priority, deadline and a
 * disposition draft. Approve (or edit, then approve) → letter.dispositioned + one follow-up per recipient agency,
 * and the digital disposition stamp thumps onto the page. Memos from the Regional Head's instructions
 * (instruction.issued → world reaction) appear here as "Nota dinas" with their stamp.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { useShell } from '../../demo-kit/shell'
import { Badge, Button, Chip, EmptyState, Icon, Inbox, Segmented, StatusChip, useElementWidth, type InboxItem } from '../../demo-kit/ui'
import { DAY_MIN, emit, setSession, useClock, useWorld, world, type WorldState } from '../../demo-kit/world'
import { letterInbox } from '../../demo-kit/world/satu-daerah'
import type { SampleDoc } from '../../demo-kit/docs/types'
import { DocViewer, type DocViewerBox } from '../../demo-kit/docs/DocViewer'
import { DispositionStamp } from '../../demo-kit/docs/Stamp'
import { pct } from '../../demo-kit/docs/measure'
import { longDate } from '../../demo-kit/docs/nik'
import { hashString } from '../../demo-kit/world/prng'
import { PaperFrame } from '../../demo-kit/frames'
import { structuredOf, useNaskahAi, type ClassOut, type DispoOut } from './ai'
import { buildCtx } from './ctx'
import { metaOf, rowsOf, sampleMap, type Row } from './inbox'
import { clockText, dueText, opdName, resolveOpd, signer, NP, type NpRole } from './model'
import type { NpNav } from './index'
import { byText, opdLabel, useStr, type NpDict } from './strings'
import './letters.css'

type Lang = 'id' | 'en'

/** where the disposition stamp lands on a sample letter (% of the page): the empty lower-left area beside the
 *  signature block, clear of the letter text, the signature and the seal */
const STAMP = { x: 30, y: 80, w: 38 } as const

/** ISO date of a letter deadline → world minutes (16:00 that day), never in the past */
function dueMinutes(day: string, iso: string | null, now: number): number {
  if (!iso) return now + NP.letterDueDays * DAY_MIN
  const d = Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86_400_000)
  const at = d * DAY_MIN + 16 * 60
  return at > now ? at : now + NP.letterDueDays * DAY_MIN
}

/* ------------------------------------------------------------------ tab */

export default function Letters({ nav, focusLetter, focusKey }: { nav: NpNav; focusLetter: string | null; focusKey: number }) {
  const S = useStr()
  const { lang } = useI18n()
  const letters = useWorld(letterInbox)
  const day = useWorld((s) => s.day)
  const now = useClock().minutes
  const box = useRef<HTMLDivElement>(null)
  const width = useElementWidth(box)
  const compact = width > 0 && width < 760
  const map = useMemo(() => sampleMap(letters), [letters])
  const rows = useMemo(() => rowsOf(letters, map), [letters, map])
  const opdRole = nav.role === 'kepala-opd'
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const [sel, setSel] = useState<string | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  /** letters opened in this visit stay in "Perlu disposisi" (with their stamp) until the filter changes */
  const [kept, setKept] = useState<ReadonlySet<string>>(() => new Set())
  const list = useMemo(() => {
    if (opdRole && nav.myOpd) return rows.filter((r) => r.letter.disposition?.to.includes(nav.myOpd!)).sort((a, b) => (b.letter.disposition?.at ?? 0) - (a.letter.disposition?.at ?? 0))
    // a letter approved here keeps its place (newest first) instead of dropping to the end of the list
    if (filter === 'pending') return rows.filter((r) => r.letter.status === 'masuk' || kept.has(r.letter.id)).sort((a, b) => b.letter.receivedAt - a.letter.receivedAt)
    // "Semua": a memo that just arrived from the Regional Head leads the list
    const fresh = (r: Row) => !!r.letter.instructionId && r.letter.receivedAt >= now - 120
    return [...rows.filter(fresh), ...rows.filter((r) => !fresh(r))]
  }, [rows, filter, opdRole, nav.myOpd, now, kept])
  useEffect(() => {
    if (sel && !kept.has(sel)) setKept((k) => new Set(k).add(sel))
  }, [sel]) // eslint-disable-line react-hooks/exhaustive-deps
  // desktop: open a letter so the screen is never empty: the newest urgent crooked scan first (the "wow" letter)
  useEffect(() => {
    if (sel || compact || !list[0]) return
    const scan = list.filter((r) => r.doc?.scan && r.letter.status === 'masuk')
    const pick = scan.find((r) => r.sifat === 'segera') ?? scan[0] ?? list[0]
    setSel(pick.letter.id)
  }, [sel, compact, list])
  // keep the selected letter in view inside the inbox (arrivals from the banner / a toast)
  useEffect(() => {
    if (!sel) return
    const li = box.current?.querySelector<HTMLElement>(`.dk-np-lbox [data-id="${CSS.escape(sel)}"]`)
    const ul = li?.closest<HTMLElement>('.dk-inbox')
    if (li && ul) {
      const top = li.offsetTop - ul.offsetTop
      if (top < ul.scrollTop || top + li.offsetHeight > ul.scrollTop + ul.clientHeight) ul.scrollTo({ top: Math.max(0, top - 8) })
    }
  }, [sel, focusKey])

  // arrival with a focus (banner, cross-product toast)
  useEffect(() => {
    if (!focusLetter) return
    const l = world.get().letters.byId[focusLetter]
    setFilter(l && l.status !== 'masuk' ? 'all' : 'pending')
    setKept((k) => new Set(k).add(focusLetter))
    setSel(focusLetter)
    setShowDetail(true)
  }, [focusLetter, focusKey])

  const selected = rows.find((r) => r.letter.id === sel) ?? (compact ? undefined : list[0])
  const keep = (id: string) => setKept((k) => (k.has(id) ? k : new Set(k).add(id)))
  const changeFilter = (f: 'pending' | 'all') => {
    setFilter(f)
    setKept(new Set(sel ? [sel] : []))
  }
  const pending = rows.filter((r) => r.letter.status === 'masuk').length

  const items: InboxItem[] = list.map((r) => ({
    id: r.letter.id,
    title: r.subject[lang],
    preview: `${byText(r.from, lang)} · ${r.number}`,
    time: r.letter.receivedAt >= 0 ? clockText(r.letter.receivedAt, lang) : dueText(r.letter.receivedAt, lang, day).replace(/\s\d{1,2}[.:]\d{2}$/, ''),
    unread: r.letter.status === 'masuk',
    icon: r.kind === 'nota-dinas' ? 'stamp' : 'doc',
    tone: r.sifat === 'segera' && r.letter.status === 'masuk' ? 'warn' : undefined,
    meta: (
      <>
        <Badge tone={r.letter.instructionId ? 'accent' : 'neutral'}>{r.letter.instructionId ? S.lNotaFrom : S.cls[r.kind]}</Badge>
        {r.sifat === 'segera' && <Badge tone="warn">{S.sifat.segera}</Badge>}
        {r.doc?.scan && <Badge>{S.lScan}</Badge>}
        {r.letter.status === 'didisposisi' && <StatusChip label={S.lStatus.didisposisi} tone="done" />}
      </>
    ),
  }))

  const listPane = (
    <section className="dk-np-lbox" aria-label={S.lInbox}>
      <header className="dk-np-lbox-h">
        <h3>
          <Icon name="inbox" size={16} />
          {S.lInbox}
        </h3>
        {!opdRole && (
          <Segmented
            size="sm"
            label={S.lFilter}
            value={filter}
            onChange={changeFilter}
            options={[
              { value: 'pending', label: `${S.lPending} (${pending})` },
              { value: 'all', label: S.lAll },
            ]}
          />
        )}
        {opdRole && <Badge tone="accent">{S.lMine}</Badge>}
      </header>
      <Inbox
        items={items}
        label={S.lInbox}
        selectedId={selected?.letter.id ?? null}
        onSelect={(id) => {
          setSel(id)
          setShowDetail(true)
        }}
        empty={<EmptyState art="inbox" title={opdRole ? S.lEmptyMine : S.lEmpty} />}
      />
      {opdRole && (
        <p className="dk-np-lrole">
          <span>{S.lOpdWho}</span>
          <Button size="sm" variant="quiet" icon="user" onClick={() => setSession({ role: 'sekretariat' })} data-np="as-setda">
            {S.lTryAsSetda}
          </Button>
        </p>
      )}
    </section>
  )

  return (
    <div ref={box} className={`dk-np-letters${compact ? ' is-compact' : ''}`}>
      <p className="dk-np-lead dk-np-tablead">{S.lLead}</p>
      <div className="dk-np-lgrid">
        {(!compact || !showDetail || !selected) && listPane}
        {selected && (!compact || showDetail) && (
          <div className="dk-np-ldetail">
            {compact && (
              <Button variant="quiet" icon="arrowLeft" onClick={() => setShowDetail(false)} className="dk-np-back" data-np="letter-back">
                {S.lBack}
              </Button>
            )}
            <LetterDetail key={selected.letter.id} row={selected} nav={nav} compact={compact} onApproved={keep} />
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ one letter */

function boxesOf(doc: SampleDoc): DocViewerBox[] {
  return doc.fields.map((f) => {
    const h = (hashString(`${doc.id}:${f.key}`) % 1000) / 1000
    return { key: f.key, label: f.label, value: f.value, confidence: f.hard ? 0.78 + h * 0.1 : 0.9 + h * 0.09, box: pct(f.box, doc.w, doc.h) }
  })
}

interface Draft {
  to: string[]
  instruction: string
  note: string
  /** untouched AI draft: the world gets both languages from the sample */
  pristine: boolean
}

function LetterDetail({ row, nav, compact, onApproved }: { row: Row; nav: NpNav; compact: boolean; onApproved: (id: string) => void }) {
  const S = useStr()
  const { lang } = useI18n()
  const shell = useShell()
  const now = useClock().minutes
  const day = useWorld((s) => s.day)
  const opds = useWorld((s) => s.region.opd)
  const { letter, doc } = row
  const meta = metaOf(doc)
  const canAct = nav.role !== 'kepala-opd' && letter.status === 'masuk' && !!doc
  const [deskew, setDeskew] = useState(false)
  const [run, setRun] = useState(0)
  const [n, setN] = useState(0)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [editing, setEditing] = useState(false)
  const [made, setMade] = useState<string[]>([])
  const ai = useNaskahAi()
  const boxes = useMemo(() => (doc ? boxesOf(doc) : []), [doc])
  const total = boxes.length
  const reading = run > 0 && n < total
  const aiDone = !!ai.last && ai.last.status !== 'thinking' && ai.last.status !== 'streaming'
  const ready = run > 0 && n >= total && aiDone

  const clsAi = structuredOf<ClassOut>(ai.last, 'classification')
  // a Live answer without the classification tool falls back to what the letter itself says
  const cls: ClassOut | null = clsAi ?? (aiDone && meta ? { letterClass: meta.cls, nature: meta.sifat, summary: meta.summary.map((x) => x[lang]), ...(meta.due ? { deadline: meta.due } : {}) } : null)
  const disp = structuredOf<DispoOut>(ai.last, 'disposition') ?? ((ai.last?.toolCalls?.find((t) => t.name === 'draft_disposition')?.output as DispoOut | undefined) ?? null)

  // the AI draft becomes the editable draft once both the OCR and the answer are in
  useEffect(() => {
    if (!ready || draft || !meta) return
    const s = world.get()
    const ids = (disp?.to ?? []).map((t) => resolveOpd(s, t)).filter((x): x is string => !!x)
    const to = [...new Set(ids.length ? ids : meta.disposition.to)]
    setDraft({ to, instruction: disp?.instruction ?? meta.disposition.instruction[lang], note: disp?.note ?? meta.disposition.note[lang], pristine: true })
  }, [ready, draft, disp, meta, lang])

  const read = () => {
    if (!doc || !meta) return
    if (doc.scan) setDeskew(true)
    setDraft(null)
    setEditing(false)
    setN(0)
    setRun((r) => r + 1)
    ai.reset()
    const s = world.get()
    void ai.ask(
      lang === 'id' ? 'Klasifikasikan surat masuk ini dan susun draf disposisi' : 'Classify this incoming letter and draft a disposition',
      buildCtx(s, now, lang, 'letter', {
        letter: {
          number: meta.number,
          from: meta.from,
          subject: meta.subject,
          cls: meta.cls,
          sifat: meta.sifat,
          due: meta.due,
          summary: meta.summary,
          suggested: { to: meta.disposition.to.map((o) => opdName(s, o, lang)), instruction: meta.disposition.instruction, note: meta.disposition.note },
        },
      }),
    )
  }

  const approve = () => {
    if (!draft || !meta || !draft.to.length) return
    const s = world.get()
    const by = signer(nav.role)
    const note = draft.pristine
      ? { id: `${meta.disposition.instruction.id} ${meta.disposition.note.id}`, en: `${meta.disposition.instruction.en} ${meta.disposition.note.en}` }
      : { id: `${draft.instruction} ${draft.note}`.trim(), en: `${draft.instruction} ${draft.note}`.trim() }
    onApproved(letter.id)
    emit('letter.dispositioned', { letterId: letter.id, subject: meta.subject, number: meta.number, from: meta.from, to: draft.to, note, by }, 'naskah-pintar')
    const title = draft.pristine ? meta.disposition.instruction : { id: draft.instruction, en: draft.instruction }
    const due = dueMinutes(s.day, meta.due, now)
    const ids: string[] = []
    for (const opdId of draft.to) {
      const opd = s.region.opd.find((o) => o.id === opdId)
      const e = emit('actionItem.created', { title, opdId, pic: `Kepala ${opd?.short ?? opdId}`, dueAt: due, source: { kind: 'letter', id: letter.id } }, 'naskah-pintar')
      if (e.payload.id) ids.push(e.payload.id)
    }
    setMade(ids)
    setEditing(false)
    const names = draft.to.map((o) => opdName(s, o, lang)).join(', ')
    shell.toast({ title: S.lToastTitle, body: S.lToastBody(names), tone: 'accent', icon: 'stamp', action: { label: S.lSeeTasks, onClick: () => nav.go('tindak', { itemId: ids[0], opdIds: draft.to }) } })
  }

  const disposition = letter.disposition
  const stampTo = (disposition?.to ?? draft?.to ?? []).map((o) => opdLabel(opds.find((x) => x.id === o), o, lang)).join(', ')
  const stampLines = disposition
    ? [`${S.lTo}: ${stampTo}`, disposition.note[lang], `${longDate(day, lang)} · ${byText(disposition.by, lang)}`]
    : []
  const height = compact ? 'clamp(300px, 56vh, 480px)' : 'clamp(420px, 62vh, 640px)'

  if (!doc) return <ArchiveLetter row={row} S={S} lang={lang} day={day} opds={opds} nav={nav} />

  return (
    <div className="dk-np-lpane">
      <DocViewer
        doc={doc}
        boxes={boxes}
        revealBoxes={run > 0 && !disposition}
        replay={run}
        onReveal={(c) => setN(c)}
        deskew={deskew || letter.status === 'didisposisi'}
        height={height}
        label={`${S.cls[row.kind] ?? ''} ${row.number}`}
        toolbar={
          canAct && run > 0 ? (
            <Button size="sm" variant="quiet" icon="refresh" onClick={read} busy={reading || !aiDone} data-np="read">
              {S.lReread}
            </Button>
          ) : undefined
        }
      >
        <DispositionStamp show={!!disposition} heading={S.lStamp} lines={stampLines} x={STAMP.x} y={STAMP.y} width={STAMP.w} />
      </DocViewer>

      <aside className="dk-np-lside" aria-live="polite">
        <dl className="dk-np-lmeta">
          <div>
            <dt>{S.lFrom}</dt>
            <dd>{byText(row.from, lang)}</dd>
          </div>
          <div>
            <dt>{S.lNumber}</dt>
            <dd className="dk-num">{row.number}</dd>
          </div>
          <div>
            <dt>{S.lReceived}</dt>
            <dd className="dk-num">{dueText(letter.receivedAt, lang, day)}</dd>
          </div>
        </dl>

        {disposition ? (
          <DispositionDone S={S} lang={lang} by={byText(disposition.by, lang)} at={disposition.at} to={stampTo} note={disposition.note[lang]} made={made.length} onTasks={() => nav.go('tindak', made[0] ? { itemId: made[0], opdIds: disposition.to } : { opdId: disposition.to[0], opdIds: disposition.to })} opdNote={nav.role === 'kepala-opd'} />
        ) : !canAct ? (
          <p className="dk-np-muted">{S.lOpdView}</p>
        ) : run === 0 ? (
          <div className="dk-np-lprompt">
            <p>{S.lPrompt}</p>
            <Button variant="primary" icon="spark" onClick={read} data-np="read-side" onPointerEnter={ai.prepare} onFocus={ai.prepare}>
              {S.lRead}
            </Button>
          </div>
        ) : (
          <>
            {(reading || !aiDone) && (
              <div className="dk-np-progress" role="status">
                <span className="dk-np-bar" aria-hidden="true">
                  <span style={{ transform: `scaleX(${total ? n / total : 0})` }} />
                </span>
                <span className="dk-num">{reading ? (deskew && n === 0 ? S.lStraight : S.lReading(n, total)) : S.lAiThinking}</span>
              </div>
            )}
            <section className="dk-np-lcard" aria-label={S.lSummary}>
              <h4>
                {S.lSummary}
                {ai.last?.status === 'done' && <Badge tone={ai.last.mode === 'live' ? 'accent' : 'neutral'}>{S.lAiMode[ai.last.mode ?? 'sim']}</Badge>}
                {ai.last?.fellBack && <Badge tone="warn">{S.lFellBack}</Badge>}
              </h4>
              {cls ? (
                <ul className="dk-np-sum3">
                  {cls.summary.slice(0, 3).map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              ) : (
                <p className="dk-np-summary is-streaming">{ai.last?.content || '…'}</p>
              )}
              {cls && (
                <div className="dk-np-chips" data-drop>
                  <Chip icon="tag">
                    {S.lClass}: {S.cls[cls.letterClass === 'lainnya' && meta ? meta.cls : cls.letterClass] ?? cls.letterClass}
                  </Chip>
                  <Chip icon="flag" tone={cls.nature === 'segera' ? 'warn' : 'neutral'}>
                    {S.lSifat}: {S.sifat[cls.nature] ?? cls.nature}
                  </Chip>
                  <Chip icon="calendar">
                    {S.lDue}: {meta?.due ? longDate(meta.due, lang) : (cls.deadline ?? S.lNone)}
                  </Chip>
                </div>
              )}
            </section>
            {ready && draft && (
              <DraftCard S={S} lang={lang} draft={draft} setDraft={setDraft} editing={editing} setEditing={setEditing} opds={opds} onApprove={approve} role={nav.role} />
            )}
          </>
        )}
      </aside>
    </div>
  )
}

function DispositionDone({ S, lang, by, at, to, note, made, onTasks, opdNote }: { S: NpDict; lang: Lang; by: string; at: number; to: string; note: string; made: number; onTasks: () => void; opdNote: boolean }) {
  const day = useWorld((s) => s.day)
  /* today: the time only; an earlier day: its date too */
  const when = at >= 0 && at < DAY_MIN ? clockText(at, lang) : dueText(at, lang, day)
  return (
    <section className="dk-np-lcard is-done" aria-label={S.lDispo}>
      <p className="dk-np-done" role="status">
        <Icon name="stamp" size={16} />
        {S.lApproved(by, when)}
      </p>
      <dl className="dk-np-lmeta is-stack">
        <div>
          <dt>{S.lTo}</dt>
          <dd>{to}</dd>
        </div>
        <div>
          <dt>{S.lInstr}</dt>
          <dd>{note}</dd>
        </div>
      </dl>
      {made > 0 && <p className="dk-np-muted">{S.lTasksMade(made)}</p>}
      {opdNote && <p className="dk-np-muted">{S.lOpdView}</p>}
      <Button size="sm" variant="secondary" icon="kanban" onClick={onTasks} data-np="see-tasks">
        {S.lSeeTasks}
      </Button>
    </section>
  )
}

function DraftCard({
  S, lang, draft, setDraft, editing, setEditing, opds, onApprove, role,
}: {
  S: NpDict
  lang: Lang
  draft: Draft
  setDraft: (d: Draft) => void
  editing: boolean
  setEditing: (b: boolean) => void
  opds: WorldState['region']['opd']
  onApprove: () => void
  role: NpRole
}) {
  const name = (id: string) => opdLabel(opds.find((o) => o.id === id), id, lang)
  const by = role === 'kepala-daerah' ? S.by['kepala-daerah'] : S.by.sekretariat
  const add = opds.filter((o) => !draft.to.includes(o.id))
  return (
    <section className="dk-np-lcard dk-np-draft" aria-label={S.lDraft}>
      <h4>{S.lDraft}</h4>
      {editing ? (
        <div className="dk-np-edit">
          <div className="dk-np-field is-block">
            <span>{S.lTo}</span>
            <div className="dk-np-chips">
              {draft.to.map((o) => (
                <Chip key={o} tone="accent" onRemove={() => setDraft({ ...draft, to: draft.to.filter((x) => x !== o), pristine: false })} removeLabel={S.lRemoveOpd(name(o))}>
                  {name(o)}
                </Chip>
              ))}
            </div>
            <select
              className="dk-np-select"
              aria-label={S.lAddOpd}
              value=""
              onChange={(e) => e.target.value && setDraft({ ...draft, to: [...draft.to, e.target.value], pristine: false })}
              data-np="add-opd"
            >
              <option value="">{S.lPickOpd}</option>
              {add.map((o) => (
                <option key={o.id} value={o.id}>
                  {name(o.id)}
                </option>
              ))}
            </select>
          </div>
          <label className="dk-np-field is-block">
            <span>{S.lInstr}</span>
            <textarea className="dk-np-textarea" rows={3} value={draft.instruction} onChange={(e) => setDraft({ ...draft, instruction: e.target.value, pristine: false })} data-np="instr" />
          </label>
          <label className="dk-np-field is-block">
            <span>{S.lNote}</span>
            <input className="dk-np-input" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value, pristine: false })} />
          </label>
          {!draft.to.length && (
            <p className="dk-np-err" role="alert">
              {S.lNeedOpd}
            </p>
          )}
          <div className="dk-np-btns">
            {draft.to.length > 0 && (
              <Button variant="primary" icon="stamp" onClick={onApprove} data-np="save-approve">
                {S.lSaveApprove}
              </Button>
            )}
            <Button variant="quiet" onClick={() => setEditing(false)}>
              {S.lCancel}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <dl className="dk-np-lmeta is-stack">
            <div>
              <dt>{S.lTo}</dt>
              <dd className="dk-np-chips">
                {draft.to.map((o) => (
                  <Badge key={o} tone="accent">
                    {name(o)}
                  </Badge>
                ))}
              </dd>
            </div>
            <div>
              <dt>{S.lInstr}</dt>
              <dd>{draft.instruction}</dd>
            </div>
            <div>
              <dt>{S.lNote}</dt>
              <dd>{draft.note}</dd>
            </div>
          </dl>
          <div className="dk-np-btns">
            <Button variant="primary" icon="stamp" onClick={onApprove} data-np="approve">
              {role === 'kepala-daerah' ? S.lApproveAs(by) : S.lApprove}
            </Button>
            <Button variant="secondary" icon="edit" onClick={() => setEditing(true)} data-np="edit">
              {S.lEdit}
            </Button>
          </div>
        </>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ letters without a scan: archive + memos */

function ArchiveLetter({ row, S, lang, day, opds, nav }: { row: Row; S: NpDict; lang: Lang; day: string; opds: WorldState['region']['opd']; nav: NpNav }) {
  const { letter } = row
  const d = letter.disposition
  const to = (d?.to ?? []).map((o) => opdLabel(opds.find((x) => x.id === o), o, lang)).join(', ')
  const nota = !!letter.instructionId || letter.kind === 'nota-dinas'
  return (
    <div className="dk-np-lpane is-archive">
      <PaperFrame label={`${nota ? S.lNota : S.lArchive} ${letter.number}`} size="auto" className="dk-np-apaper">
        <div className="dk-np-astage">
          <p className="dk-np-akop">{nota ? S.oSecretariat : row.from.toUpperCase()}</p>
          <h3 className="dk-np-ah">{nota ? S.lNota : S.cls[row.kind]?.toUpperCase()}</h3>
          <dl className="dk-np-ameta">
            <div>
              <dt>{S.lNotaTo}</dt>
              <dd>{nota ? to : 'Bupati'}</dd>
            </div>
            <div>
              <dt>{S.lFrom}</dt>
              <dd>{nota ? (lang === 'id' ? 'Kepala Daerah' : 'Regional Head') : row.from}</dd>
            </div>
            <div>
              <dt>{S.lNumber}</dt>
              <dd className="dk-num">{letter.number}</dd>
            </div>
            <div>
              <dt>{S.lNotaHal}</dt>
              <dd>{row.subject[lang]}</dd>
            </div>
          </dl>
          {nota && (
            <>
              <p>{S.lNotaBody}</p>
              <p className="dk-np-aquote">“{letter.subject[lang]}”</p>
              <p>{S.lNotaClose}</p>
            </>
          )}
          <p className="dk-np-adate">
            {longDate(day, lang)} · {dueText(letter.receivedAt, lang, day)}
          </p>
          <p className="dk-np-afoot">{S.oFoot}</p>
          {d && <DispositionStamp show heading={S.lStamp} lines={[`${S.lTo}: ${to}`, `${longDate(day, lang)} · ${byText(d.by, lang)}`]} x={70} y={90} width={46} />}
        </div>
      </PaperFrame>
      <aside className="dk-np-lside">
        {d ? (
          <DispositionDone S={S} lang={lang} by={byText(d.by, lang)} at={d.at} to={to} note={d.note[lang]} made={0} onTasks={() => nav.go('tindak', { opdId: d.to[0], opdIds: d.to })} opdNote={nav.role === 'kepala-opd'} />
        ) : (
          <p className="dk-np-muted">{S.lStatus.masuk}</p>
        )}
      </aside>
    </div>
  )
}
