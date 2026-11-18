/**
 * Inbox.tsx — the Dokumen tab (first screen): Kotak Dokumen (26 %) · the selected document (44 %: a static tilted
 * nota until "Proses nota", then the lazy NotaProcessor; the bank statement opens the lazy Mutasi view) · "Jurnal hari
 * ini" (30 %: every natural sale lands here as a journal row, flashed). Phones stack the three.
 */
import { Suspense, lazy, memo, startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { DocArt } from '../../demo-kit/docs/DocArt'
import { FICTIONAL_BANK } from '../../demo-kit/docs/samples/finance'
import { intentProps } from '../../demo-kit/shell'
import { Button, Icon, flashNewRow, motionMode, useCountUp } from '../../demo-kit/ui'
import { emit, hhmm, useWorld, world, type LedgerEntry, type WorldState } from '../../demo-kit/world'
import { coaOf } from '../../demo-kit/world/usaha-pintar'
import { SLUG, entryAmount, inboxDocs, notaPosting, rp, type InboxDoc, type RoleKey } from './model'
import { docOf } from './notadoc'
import { useT, type Strings } from './strings'

export const loadProcessor = () => import('./NotaProcessor')
export const loadMutasi = () => import('./Mutasi')
const NotaProcessor = lazy(loadProcessor)
const Mutasi = lazy(loadMutasi)

const docsSel = (s: WorldState) => inboxDocs(s)
const ledgerSel = (s: WorldState) => s.ledger
const shopSel = (s: WorldState) => s.meta.shopId

export default function Inbox({ roleKey, selected, onSelect, onPosted, onOpenEntry, onReview, arrivedPo }: {
  roleKey: RoleKey
  selected: string | null
  onSelect: (id: string) => void
  /** a document was journaled: the entry card (fly source) and the new ledger id */
  onPosted: (ledgerId: string, fromEl: HTMLElement | null) => void
  onOpenEntry: (ledgerId: string) => void
  onReview: () => void
  arrivedPo: string | null
}) {
  const { t, lang } = useT()
  const docs = useWorld(docsSel)
  const sel = docs.find((d) => d.id === selected) ?? docs[0] ?? null
  const [running, setRunning] = useState<string | null>(null)
  const stagger = useRef(motionMode() === 'full')
  useEffect(() => {
    stagger.current = false
  }, [])

  return (
    <div className="dk-pb-docs">
      <section className="dk-pb-col dk-pb-box" aria-labelledby="pb-inbox-h">
        <h2 id="pb-inbox-h" className="dk-pb-h">
          <Icon name="inbox" size={16} /> {t.inbox}
        </h2>
        <ul className="dk-pb-inbox" aria-label={t.inboxLabel}>
          {docs.map((d, i) => (
            <li key={d.id} className={stagger.current ? 'is-in' : undefined} style={stagger.current ? { animationDelay: `${i * 60}ms` } : undefined}>
              <InboxRow d={d} t={t} lang={lang} active={sel?.id === d.id} onSelect={onSelect} />
            </li>
          ))}
        </ul>
      </section>
      <section className="dk-pb-col dk-pb-view" aria-label={t.viewerLabel}>
        {sel?.kind === 'mutasi' ? (
          <Suspense fallback={<p className="dk-pb-muted">{t.loading}</p>}>
            <Mutasi roleKey={roleKey} onReview={onReview} />
          </Suspense>
        ) : sel ? (
          <NotaView key={sel.id} d={sel} t={t} lang={lang} running={running === sel.id} onRun={() => startTransition(() => { onSelect(sel.id); setRunning(sel.id) })} onPosted={onPosted} onOpenEntry={onOpenEntry} arrived={arrivedPo === sel.id} />
        ) : (
          <p className="dk-pb-muted">{t.pickDoc}</p>
        )}
      </section>
      <TodayFeed roleKey={roleKey} t={t} lang={lang} onOpenEntry={onOpenEntry} />
    </div>
  )
}

const InboxRow = memo(function InboxRow({ d, t, lang, active, onSelect }: { d: InboxDoc; t: Strings; lang: 'id' | 'en'; active: boolean; onSelect: (id: string) => void }) {
  const title = d.kind === 'mutasi' ? t.docMutasi(FICTIONAL_BANK) : d.kind === 'edit' ? t.docEdit(d.supplier) : t.docNota(d.supplier, d.po?.code ?? '')
  const sub = d.kind === 'mutasi' ? t.docMutasiSub : d.po ? t.docNotaSub(d.po.items.length, rp(d.po.total, lang)) : hhmm(d.at)
  const chip = d.booked ? t.statusDone : d.kind === 'mutasi' ? t.statusCsv : d.kind === 'edit' ? t.statusEdit : d.isNew ? t.statusNew : t.statusRcv
  const tone = d.booked ? 'done' : d.kind === 'edit' ? 'warn' : d.isNew ? 'new' : 'neutral'
  return (
    <button type="button" className={`dk-pb-doc${active ? ' is-active' : ''}${d.booked ? ' is-booked' : ''}`} aria-pressed={active} onClick={() => startTransition(() => onSelect(d.id))} data-doc={d.id}>
      <Icon name={d.kind === 'mutasi' ? 'bars' : 'receipt'} size={18} />
      <span className="dk-pb-doc-t">
        <span>{title}</span>
        <small>{sub}</small>
      </span>
      <span className={`dk-pb-st is-${tone}`}>{chip}</span>
    </button>
  )
})

function NotaView({ d, t, lang, running, onRun, onPosted, onOpenEntry, arrived }: {
  d: InboxDoc
  t: Strings
  lang: 'id' | 'en'
  running: boolean
  onRun: () => void
  onPosted: (ledgerId: string, fromEl: HTMLElement | null) => void
  onOpenEntry: (ledgerId: string) => void
  arrived: boolean
}) {
  const doc = useMemo(() => docOf(world.get(), d), [d])
  const posting = useMemo(() => notaPosting(world.get(), d), [d])
  const ledgerId = useWorld((s) => (d.booked ? (Object.values(s.ledger.byId).find((j) => j.source === 'nota' && j.refId === (d.po?.id ?? d.id))?.id ?? null) : null))
  const [justPosted, setJustPosted] = useState(false)
  const postedRef = useRef(false)
  if (!doc || !posting) return <p className="dk-pb-muted">{t.pickDoc}</p>
  if ((running && !d.booked) || justPosted)
    return (
      <Suspense fallback={<StaticNota doc={doc} t={t} />}>
        <NotaProcessor
          doc={doc}
          lines={posting.lines}
          review={d.kind === 'edit'}
          autoplay
          onDone={(el) => {
            if (postedRef.current) return
            postedRef.current = true
            setJustPosted(true)
            const e = emit('ledger.posted', posting, SLUG)
            const id = e.payload.id ?? ''
            onPosted(id, el)
          }}
        />
      </Suspense>
    )
  return (
    <div className="dk-pb-nota">
      {arrived && !d.booked && (
        <p className="dk-pb-arrived" role="status">
          <Icon name="bell" size={14} /> {t.arrivedPo}
        </p>
      )}
      <StaticNota doc={doc} t={t} />
      <div className="dk-pb-nota-bar">
        <p>
          <strong>{doc.title[lang]}</strong>
          <span>{rp(posting.lines[0]?.debit ?? 0, lang)}</span>
        </p>
        {d.booked ? (
          <Button variant="secondary" icon="check" onClick={() => ledgerId && onOpenEntry(ledgerId)} disabled={!ledgerId}>
            {t.processed}
          </Button>
        ) : (
          <Button variant="primary" icon="spark" onClick={onRun} data-pb="process" data-hotspot="pb-process" {...intentProps(loadProcessor)}>
            {t.process}
          </Button>
        )}
      </div>
    </div>
  )
}

function StaticNota({ doc, t }: { doc: NonNullable<ReturnType<typeof docOf>>; t: Strings }) {
  const rot = doc.scan?.rotate ?? 0
  return (
    <div className="dk-pb-thumb" aria-label={t.viewerLabel}>
      <div className="dk-pb-thumb-in" style={{ transform: `rotate(${rot}deg)` }}>
        <DocArt doc={doc} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ today's journal feed */

const FEED_N = 8
const SAY_EVERY_MS = 8000

function TodayFeed({ roleKey, t, lang, onOpenEntry }: { roleKey: RoleKey; t: Strings; lang: 'id' | 'en'; onOpenEntry: (id: string) => void }) {
  const ledger = useWorld(ledgerSel)
  const shop = useWorld(shopSel)
  const today = useMemo(() => {
    const out: LedgerEntry[] = []
    for (const id of ledger.ids) {
      const j = ledger.byId[id]
      if (j && j.businessId === shop && j.at >= 0) out.push(j)
    }
    return out.sort((a, b) => b.at - a.at || b.id.localeCompare(a.id))
  }, [ledger, shop])
  const sales = today.filter((j) => j.source === 'sale').length
  const countRef = useCountUp<HTMLSpanElement>(sales, { format: (n) => String(Math.round(n)) })
  const listRef = useRef<HTMLOListElement>(null)
  const seen = useRef<Set<string> | null>(null)
  const [said, setSaid] = useState('')
  const lastSay = useRef(0)
  const pendingSay = useRef(0)
  const shown = today.slice(0, FEED_N)

  useEffect(() => {
    const ids = new Set(today.map((j) => j.id))
    if (!seen.current) {
      seen.current = ids
      return
    }
    const fresh = shown.filter((j) => !seen.current!.has(j.id))
    seen.current = ids
    if (!fresh.length) return
    const cleanups: (() => void)[] = []
    for (const j of fresh) {
      const el = listRef.current?.querySelector<HTMLElement>(`[data-ledger="${CSS.escape(j.id)}"]`)
      if (el) cleanups.push(flashNewRow(el, { slide: true }))
    }
    pendingSay.current += fresh.length
    const now = performance.now()
    if (now - lastSay.current > SAY_EVERY_MS) {
      lastSay.current = now
      setSaid(t.said(pendingSay.current))
      pendingSay.current = 0
    }
    return () => cleanups.forEach((c) => c())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today])

  return (
    <section className="dk-pb-col dk-pb-feed" aria-labelledby="pb-feed-h" data-pb="feed">
      <h2 id="pb-feed-h" className="dk-pb-h">
        <Icon name="list" size={16} /> {t.feed}
      </h2>
      <p className="dk-pb-feed-count">
        <Icon name="check" size={14} /> <span ref={countRef} className="dk-num">{sales}</span> <span>{t.feedCount}</span>
      </p>
      <p className="dk-sr" aria-live="polite">
        {said}
      </p>
      {shown.length ? (
        <ol ref={listRef} className="dk-pb-feed-list" aria-label={t.feedLabel}>
          {shown.map((j) => (
            <li key={j.id} data-ledger={j.id}>
              <button type="button" className="dk-pb-feed-row" onClick={() => onOpenEntry(j.id)}>
                <span className="dk-pb-feed-time">{hhmm(j.at)}</span>
                <span className="dk-pb-feed-memo">
                  {j.memo[lang]}
                  <small>
                    {t.srcLabel[j.source] ?? j.source}
                    {j.needsReview ? ` · ${t.needsReview}` : ''}
                    {roleKey === 'konsultan' ? ` · ${j.lines.map((l) => `${l.debit ? "D" : lang === "id" ? "K" : "C"} ${coaOf(l.account).code}`).join(' ')}` : ''}
                  </small>
                </span>
                <span className={`dk-pb-feed-amt${j.source === 'sale' ? ' is-in' : ''}`}>
                  {roleKey === 'owner' && j.source === 'sale' ? `+${rp(saleIn(j), lang)}` : rp(entryAmount(j), lang)}
                </span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="dk-pb-muted">{t.feedEmpty}</p>
      )}
    </section>
  )
}

/** money in of a sale entry (Kas + Bank debits) */
const saleIn = (j: LedgerEntry) => j.lines.reduce((a, l) => a + (l.account === 'Kas' || l.account === 'Bank' ? l.debit : 0), 0)
