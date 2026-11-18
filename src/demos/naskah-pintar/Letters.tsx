/**
 * Surat Masuk tab (lazy). Inbox of world letters; the recent ones are shown as the kit's original letter samples
 * (three of them crooked scans). "Baca & susun disposisi": the scan straightens (DocViewer deskew), OCR boxes
 * appear one by one, the AI (Simulasi / Live) writes the 3-line summary, type, priority, deadline and a
 * disposition draft. Approve (or edit, then approve) → letter.dispositioned + one follow-up per recipient agency,
 * and the digital disposition stamp thumps onto the page. Memos from the Regional Head's instructions
 * (instruction.issued → world reaction) appear here as "Nota dinas" with their stamp.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { gsap } from 'gsap'
import { useI18n } from '../../lib/i18n'
import { useShell } from '../../demo-kit/shell'
import { Badge, Button, Chip, EmptyState, Icon, Inbox, Segmented, StatusChip, motionMode, useElementWidth, type InboxItem } from '../../demo-kit/ui'
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
import { LETTER_LINKS, SCRIPT, clockText, dueText, existingAction, opdName, picFor, picLabel, resolveOpd, sampleMeeting, signer, NP, type NpRole } from './model'
import type { NpNav } from './index'
import { STR, byText, opdLabel, useStr, type NpDict } from './strings'
import { getTrail, setTrail, type Trail } from './trail'
import { approveNow, submitForApproval } from './approvals'
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

/** ISO date of the day a world minute falls on (letters received / dispositioned on earlier days) */
function isoOf(day: string, at: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + Math.floor(at / DAY_MIN) * 86_400_000).toISOString().slice(0, 10)
}

/** sample notes that read oddly as a disposition note (by letter number) */
const NOTE_FIX: Readonly<Record<string, { id: string; en: string }>> = {
  '140/087/412.416.12/2026': { id: 'Prioritas: tanggul yang belum tertangani hari ini berisiko membanjiri permukiman.', en: 'Priority: if the embankment is not handled today, homes may flood.' },
}
const noteOf = (meta: { number: string; disposition: { note: { id: string; en: string } } }) => NOTE_FIX[meta.number] ?? meta.disposition.note

/** the meeting follow-up a letter asks for again (LETTER_LINKS), once the meeting has created it: "id|no|opd|pic|due" */
function linkOf(s: WorldState, number: string | undefined): string | null {
  const key = number ? LETTER_LINKS[number] : undefined
  const i = key ? SCRIPT.actions.findIndex((a) => a.key === key) : -1
  const sa = SCRIPT.actions[i]
  const m = sampleMeeting(s)
  const it = sa && m ? existingAction(s, m.id, sa.text) : undefined
  return it ? `${it.id}|${i + 1}|${it.opdId}|${it.pic}|${it.dueAt}` : null
}

/* ------------------------------------------------------------------ tab */

export default function Letters({ nav, focusLetter, focusKey, autoRead = false }: { nav: NpNav; focusLetter: string | null; focusKey: number; autoRead?: boolean }) {
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
    if (opdRole && nav.myOpd) {
      const me = nav.myOpd
      const s = world.get()
      /* dispositions to this agency (an older one whose subject clearly belongs to another agency is left out), then
         the letters waiting for the Secretariat that the AI would route here */
      const mine = rows
        .filter((r) => {
          const d = r.letter.disposition
          if (!d?.to.includes(me)) return false
          if (r.letter.instructionId || r.doc) return true
          const hit = resolveOpd(s, r.subject.id)
          return !hit || d.to.includes(hit)
        })
        .sort((a, b) => (b.letter.disposition?.at ?? 0) - (a.letter.disposition?.at ?? 0))
      const soon = rows.filter((r) => r.letter.status === 'masuk' && !!metaOf(r.doc)?.disposition.to.includes(me))
      return [...soon, ...mine]
    }
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
            <LetterDetail key={selected.letter.id} row={selected} nav={nav} compact={compact} onApproved={keep} autoRead={autoRead && selected.letter.id === focusLetter ? focusKey : 0} />
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


function LetterDetail({ row, nav, compact, onApproved, autoRead }: { row: Row; nav: NpNav; compact: boolean; onApproved: (id: string) => void; autoRead: number }) {
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
  /** what happened to this letter in this session (history card); kept in trail.ts, so reopening shows the same */
  const [trail, setTrailState] = useState<Trail>(() => getTrail(day, letter.id))
  const updTrail = (f: (t: Trail) => Trail) => {
    const next = f(getTrail(day, letter.id))
    setTrail(day, letter.id, next)
    setTrailState(next)
  }
  const made = trail.madeIds
  const root = useRef<HTMLDivElement>(null)
  /** arrival from the Kepala Daerah desk: the approve button is brought into view once (not on every render) */
  const landed = useRef(false)
  /** link the disposition to the meeting follow-up it repeats (default) instead of creating a second task */
  const [link, setLink] = useState(true)
  const linked = useWorld((s) => linkOf(s, meta?.number))
  const [lId, lNo, lOpd, lPic, lDue] = linked ? linked.split('|') : []
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
    const fixed = NOTE_FIX[meta.number]
    setDraft({ to, instruction: disp?.instruction ?? meta.disposition.instruction[lang], note: fixed ? fixed[lang] : (disp?.note ?? meta.disposition.note[lang]), pristine: true })
  }, [ready, draft, disp, meta, lang])

  /* the scan is read: the summary does not keep the reader waiting for the rest of the stream */
  const aiBusy = ai.busy
  const flush = ai.flush
  useEffect(() => {
    if (run > 0 && total > 0 && n >= total && aiBusy) flush()
  }, [run, n, total, aiBusy, flush])

  /* arrival from the Kepala Daerah desk: the OCR boxes come in quicker (the Regent wants the decision, not the show) */
  const fast = autoRead > 0
  useEffect(() => {
    if (!fast || run === 0 || total === 0) return
    if (motionMode() === 'static') {
      setN(total)
      return
    }
    setN(0)
    const tl = gsap.timeline()
    for (let i = 1; i <= total; i++) tl.call(() => setN(i), [], i * 0.08)
    return () => void tl.kill()
  }, [fast, run, total])

  /* arrival from the Kepala Daerah desk ("Baca & setujui"): bring the letter into view at once, then the approve
     button (focused) as soon as the draft is ready — on a phone it would otherwise sit far below the fold */
  useEffect(() => {
    if (!autoRead) return
    const smooth = motionMode() === 'full' ? 'smooth' : 'auto'
    requestAnimationFrame(() => root.current?.scrollIntoView({ block: 'start', behavior: smooth }))
  }, [autoRead])
  useEffect(() => {
    if (!autoRead || !ready || !draft || landed.current) return
    landed.current = true
    requestAnimationFrame(() => {
      const btn = root.current?.querySelector<HTMLElement>('[data-np="approve"]')
      if (!btn) return
      btn.scrollIntoView({ block: 'center', behavior: motionMode() === 'full' ? 'smooth' : 'auto' })
      btn.focus({ preventScroll: true })
    })
  }, [autoRead, ready, draft])

  const read = () => {
    if (!doc || !meta) return
    const conf = boxes.map((b) => Math.round((b.confidence ?? 0.9) * 100))
    updTrail((t) => ({ ...t, readAt: now, conf: conf.length ? [Math.min(...conf), Math.max(...conf)] : null }))
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
          suggested: { to: meta.disposition.to.map((o) => opdName(s, o, lang)), instruction: meta.disposition.instruction, note: noteOf(meta) },
        },
      }),
    )
  }

  /* Sekretariat drafts and submits; the Regional Secretary approves (simulated e-signature a moment later). The
     Regent approves directly. Maker and checker are never the same role. */
  const commit = (d: Draft, by: string) => {
    if (!meta || !d.to.length) return
    const s = world.get()
    const link0 = link ? linkOf(s, meta.number) : null
    const [linkedId, no, linkOpd] = link0 ? link0.split('|') : []
    const linkNo = linkOpd && d.to.includes(linkOpd) ? Number(no) : null
    /* a linked agency gets its own line: it continues the meeting follow-up (no second task, no "work with yourself") */
    const per = linkNo !== null && linkOpd ? { id: ` ${STR.id.lLinkInstr(opdName(s, linkOpd, 'id'), linkNo)}`, en: ` ${STR.en.lLinkInstr(opdName(s, linkOpd, 'en'), linkNo)}` } : { id: '', en: '' }
    const n0 = noteOf(meta)
    const note = d.pristine
      ? { id: `${meta.disposition.instruction.id} ${n0.id}${per.id}`, en: `${meta.disposition.instruction.en} ${n0.en}${per.en}` }
      : { id: `${d.instruction} ${d.note}${per.id}`.trim(), en: `${d.instruction} ${d.note}${per.en}`.trim() }
    onApproved(letter.id)
    emit('letter.dispositioned', { letterId: letter.id, subject: meta.subject, number: meta.number, from: meta.from, to: d.to, note, by }, 'naskah-pintar')
    const title = d.pristine ? meta.disposition.instruction : { id: d.instruction, en: d.instruction }
    /* "... hari ini" in the instruction: due today 16.00 (the letter's own deadline stays the outer limit) */
    const today = /hari ini|today/i.test(d.pristine ? meta.disposition.instruction.id : d.instruction)
    const due = today ? (16 * 60 > now ? 16 * 60 : now + 120) : dueMinutes(s.day, meta.due, now)
    const ids: string[] = []
    for (const opdId of d.to) {
      if (linkNo !== null && opdId === linkOpd) continue
      const opd = s.region.opd.find((o) => o.id === opdId)
      const e = emit('actionItem.created', { title, opdId, pic: picFor(opd, opdId), dueAt: due, source: { kind: 'letter', id: letter.id } }, 'naskah-pintar')
      if (e.payload.id) ids.push(e.payload.id)
    }
    updTrail((t) => ({ ...t, made: ids.length, madeIds: ids, linkedNo: linkNo }))
    setEditing(false)
    const names = d.to.map((o) => opdName(s, o, lang)).join(', ')
    const first = ids[0] ?? (linkNo !== null ? linkedId : undefined)
    shell.toast({
      title: S.lToastTitle,
      body: linkNo !== null ? `${S.lToastBody(names)} ${S.lLinkedDone(linkNo)}` : S.lToastBody(names),
      tone: 'accent',
      icon: 'stamp',
      action: { label: S.lSeeTasks, onClick: () => nav.go('tindak', { ...(first ? { itemId: first } : {}), opdIds: d.to }) },
    })
  }
  const approve = () => {
    if (!draft || !meta || !draft.to.length || trail.submittedAt !== null) return
    updTrail((t) => ({ ...t, submittedAt: now, edited: !draft.pristine }))
    setEditing(false)
    if (nav.role === 'kepala-daerah') return commit(draft, signer(nav.role))
    const d = draft
    /* waits for the Regional Secretary: "Setujui sebagai Sekda" below, or the Sekda signs once the clock has moved on
       a few minutes (approvals.ts; it still lands if the user has opened another letter or tab meanwhile) */
    submitForApproval(letter.id, now, () => commit(d, signer(nav.role)))
  }

  /* arrival from the Kepala Daerah desk: start reading at once */
  useEffect(() => {
    if (autoRead && canAct && run === 0) read()
  }, [autoRead]) // eslint-disable-line react-hooks/exhaustive-deps

  const disposition = letter.disposition
  const stampTo = (disposition?.to ?? draft?.to ?? []).map((o) => opdLabel(opds.find((x) => x.id === o), o, lang)).join(', ')
  const stampLines = disposition
    ? [`${S.lTo}: ${stampTo}`, disposition.note[lang], `${longDate(isoOf(day, disposition.at), lang)} · ${byText(disposition.by, lang)}`]
    : []
  const trailEl = disposition ? (
    <ol className="dk-np-trail" aria-label={S.lTrail}>
      <li>{S.lTrailReceived(dueText(letter.receivedAt, lang, day))}</li>
      {trail.readAt !== null && trail.conf && <li>{S.lTrailRead(clockText(trail.readAt, lang), trail.conf[0], trail.conf[1])}</li>}
      {trail.viaInstrAt !== null && <li>{S.lTrailInstr(clockText(trail.viaInstrAt, lang))}</li>}
      {trail.submittedAt !== null && nav.role !== 'kepala-daerah' && <li>{S.lTrailDraft(clockText(trail.submittedAt, lang), trail.edited)}</li>}
      <li>{trail.submittedAt !== null && nav.role !== 'kepala-daerah' ? S.lTrailApproved(byText(disposition.by, lang), clockText(disposition.at, lang)) : S.lTrailDone(byText(disposition.by, lang), dueText(disposition.at, lang, day))}</li>
      {trail.made > 0 && <li>{S.lTrailTasks(trail.made)}</li>}
      {trail.linkedNo !== null && <li>{S.lTrailLinked(trail.linkedNo)}</li>}
    </ol>
  ) : null
  const height = compact ? 'clamp(300px, 56vh, 480px)' : 'clamp(420px, 62vh, 640px)'

  if (!doc) return <ArchiveLetter row={row} S={S} lang={lang} day={day} opds={opds} nav={nav} />

  /* phones, Kepala Daerah: the AI summary and the draft first, the scan below (the decision is the point) */
  const sideFirst = compact && nav.role === 'kepala-daerah' && canAct
  return (
    <div ref={root} className={`dk-np-lpane${sideFirst ? ' is-side-first' : ''}`}>
      <DocViewer
        doc={doc}
        boxes={boxes}
        revealBoxes={fast && run > 0 && !disposition ? n : run > 0 && !disposition}
        replay={run}
        onReveal={fast ? undefined : (c) => setN(c)}
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
          <DispositionDone
            S={S}
            lang={lang}
            by={byText(disposition.by, lang)}
            at={disposition.at}
            to={stampTo}
            note={disposition.note[lang]}
            made={made.length}
            linkedNo={trail.linkedNo}
            trail={trailEl}
            onTasks={() => nav.go('tindak', made[0] ? { itemId: made[0], opdIds: disposition.to } : lId && trail.linkedNo !== null ? { itemId: lId, opdIds: disposition.to } : { opdId: disposition.to[0], opdIds: disposition.to })}
            opdNote={nav.role === 'kepala-opd'}
          />
        ) : !canAct ? (
          <p className="dk-np-muted">{nav.role === 'kepala-opd' && letter.status === 'masuk' ? `${S.lForUnit} · ${S.lAwait}` : S.lOpdView}</p>
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
            {ready && draft && trail.submittedAt === null && (
              <DraftCard
                S={S}
                lang={lang}
                draft={draft}
                setDraft={setDraft}
                editing={editing}
                setEditing={setEditing}
                opds={opds}
                onApprove={approve}
                role={nav.role}
                linkNote={lNo && lOpd && draft.to.includes(lOpd) ? S.lLinked(Number(lNo), picLabel(lPic ?? '', lang, lOpd), dueText(Number(lDue), lang, day)) : null}
                link={link}
                setLink={setLink}
              />
            )}
            {trail.submittedAt !== null && !disposition && (
              <div className="dk-np-lcard dk-np-waitcard">
                <p className="dk-np-progress dk-np-wait" role="status">
                  <Icon name="send" size={14} />
                  <span>{S.lWaitSekda}</span>
                </p>
                <p className="dk-np-muted">{S.lWaitHow}</p>
                <Button variant="primary" icon="stamp" onClick={() => approveNow(letter.id)} data-np="sekda-approve">
                  {S.lAsSekda}
                </Button>
              </div>
            )}
          </>
        )}
      </aside>
    </div>
  )
}

function DispositionDone({ S, lang, by, at, to, note, made, onTasks, opdNote, linkedNo = null, trail = null }: { S: NpDict; lang: Lang; by: string; at: number; to: string; note: string; made: number; onTasks: () => void; opdNote: boolean; linkedNo?: number | null; trail?: ReactNode }) {
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
      {linkedNo !== null && <p className="dk-np-muted">{S.lLinkedDone(linkedNo)}</p>}
      {opdNote && <p className="dk-np-muted">{S.lOpdView}</p>}
      {trail && (
        <div className="dk-np-trailbox">
          <h5>{S.lTrail}</h5>
          {trail}
        </div>
      )}
      <Button size="sm" variant="secondary" icon="kanban" onClick={onTasks} data-np="see-tasks">
        {S.lSeeTasks}
      </Button>
    </section>
  )
}

function DraftCard({
  S, lang, draft, setDraft, editing, setEditing, opds, onApprove, role, linkNote, link, setLink,
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
  /** "already handled in the meeting" (null when the letter repeats no meeting follow-up) */
  linkNote: string | null
  link: boolean
  setLink: (b: boolean) => void
}) {
  const name = (id: string) => opdLabel(opds.find((o) => o.id === id), id, lang)
  const by = role === 'kepala-daerah' ? S.by['kepala-daerah'] : S.by.sekretariat
  const add = opds.filter((o) => !draft.to.includes(o.id))
  return (
    <section className="dk-np-lcard dk-np-draft" aria-label={S.lDraft}>
      <h4>{S.lDraft}</h4>
      {linkNote && (
        <div className="dk-np-linknote" role="note">
          <p>
            <Icon name="link" size={14} />
            {linkNote}
          </p>
          <label className="dk-np-check">
            <input type="checkbox" checked={link} onChange={(e) => setLink(e.target.checked)} data-np="link-existing" />
            <span>{S.lLinkOpt}</span>
          </label>
        </div>
      )}
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
                {role === 'kepala-daerah' ? S.lSaveApprove : S.lSubmit}
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
            <Button variant="primary" icon={role === 'kepala-daerah' ? 'stamp' : 'send'} onClick={onApprove} data-np="approve">
              {role === 'kepala-daerah' ? S.lApproveAs(by) : S.lSubmit}
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
            {S.lLetterDate}: {longDate(isoOf(day, letter.receivedAt), lang)} · {S.lReceived} {dueText(letter.receivedAt, lang, day)}
          </p>
          <p className="dk-np-afoot">{S.oFoot}</p>
          {d && <DispositionStamp show heading={S.lStamp} lines={[`${S.lTo}: ${to}`, `${longDate(isoOf(day, d.at), lang)} · ${byText(d.by, lang)}`]} x={70} y={90} width={46} />}
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
