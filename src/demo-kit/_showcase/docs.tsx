/**
 * /lab/_kit showcase — "docs" module (owner: docs-media builder).
 * 1. An incoming letter: OCR boxes one by one → extraction → AI summary + disposition draft → approve → stamp.
 * 2. Identity specimens with the tamper heatmap (KTP, edited KTP, KK, NIB, domisili, house photo).
 * 3. A crumpled receipt straightened ("luruskan"), read, and turned into a journal entry.
 */
import { useEffect, useMemo, useState } from 'react'
import { useI18n, type Lang } from '../../lib/i18n'
import { Button, Badge, InsightCallout, SectionHeader } from '../ui'
import {
  DispositionStamp,
  DocArt,
  DocViewer,
  ExtractPanel,
  FINANCE,
  HOUSES,
  IDENTITY,
  LETTERS,
  PERMITS,
  TamperToggle,
  getSample,
  idr,
  longDate,
  simulateExtract,
  type SampleDoc,
} from '../docs'
import './docs-media.css'

const OPD: Record<string, string> = {
  bpbd: 'BPBD',
  pupr: 'Dinas PUPR',
  dinsos: 'Dinsos',
  dinkes: 'Dinkes',
  distan: 'Distan',
  dpmptsp: 'DPMPTSP',
  diskominfo: 'Diskominfo',
  bappeda: 'Bappeda',
}

const C = {
  id: {
    h1: 'Surat pindaian berantakan jadi disposisi rapi',
    l1: 'Pilih surat, biarkan AI membacanya kotak demi kotak, lalu setujui draf disposisi.',
    h2: 'KTP yang diedit ketahuan dalam sekali baca',
    l2: 'Spesimen fiktif bertanda air. Nyalakan peta panas untuk melihat area yang dicurigai diedit.',
    h3: 'Nota kusut menjadi jurnal rapi',
    l3: 'Luruskan foto nota, baca isinya, lalu entri jurnal tersusun otomatis.',
    gallery: 'Contoh dokumen',
    read: 'Baca surat',
    readDoc: 'Verifikasi dokumen',
    reread: 'Baca ulang',
    straighten: 'Luruskan',
    raw: 'Tampilkan pindaian asli',
    straightenRead: 'Luruskan & baca',
    reading: (n: number, t: number) => `Membaca surat… ${n}/${t}`,
    readingDoc: (n: number, t: number) => `Membaca dokumen… ${n}/${t}`,
    summary: 'Ringkasan AI',
    cls: 'Klasifikasi',
    sifat: 'Sifat',
    due: 'Tenggat',
    none: 'Tidak ada',
    draft: 'Draf disposisi',
    to: 'Kepada',
    instr: 'Instruksi',
    note: 'Catatan',
    approve: 'Setujui disposisi',
    approved: 'Disposisi disetujui dan dikirim ke OPD tujuan.',
    undo: 'Batalkan persetujuan',
    stamp: 'DISPOSISI',
    stampBy: 'Bupati',
    journal: 'Entri jurnal otomatis',
    debit: 'Debit',
    credit: 'Kredit',
    review: 'Perlu tinjauan',
    reviewList: 'Transaksi yang perlu ditinjau',
    journalWarn: 'Total nota tidak cocok dengan jumlah item: entri ditahan sampai dicek manual.',
    csv: 'Unduh CSV contoh',
    sifatV: { segera: 'Segera', biasa: 'Biasa', rahasia: 'Rahasia' },
    clsV: { undangan: 'Undangan', permohonan: 'Permohonan', laporan: 'Laporan', edaran: 'Edaran', 'nota-dinas': 'Nota dinas' },
  },
  en: {
    h1: 'A messy scanned letter becomes a clean disposition',
    l1: 'Pick a letter, let the AI read it box by box, then approve the disposition draft.',
    h2: 'An edited ID card is caught in one read',
    l2: 'Fictional watermarked specimens. Turn on the heatmap to see the areas suspected of editing.',
    h3: 'A crumpled receipt becomes a tidy journal entry',
    l3: 'Straighten the receipt photo, read it, and the journal entry writes itself.',
    gallery: 'Sample documents',
    read: 'Read letter',
    readDoc: 'Verify document',
    reread: 'Read again',
    straighten: 'Straighten',
    raw: 'Show the raw scan',
    straightenRead: 'Straighten & read',
    reading: (n: number, t: number) => `Reading the letter… ${n}/${t}`,
    readingDoc: (n: number, t: number) => `Reading the document… ${n}/${t}`,
    summary: 'AI summary',
    cls: 'Type',
    sifat: 'Priority',
    due: 'Deadline',
    none: 'None',
    draft: 'Disposition draft',
    to: 'To',
    instr: 'Instruction',
    note: 'Note',
    approve: 'Approve disposition',
    approved: 'Disposition approved and sent to the assigned offices.',
    undo: 'Undo approval',
    stamp: 'DISPOSISI',
    stampBy: 'Regent',
    journal: 'Automatic journal entry',
    debit: 'Debit',
    credit: 'Credit',
    review: 'Needs review',
    reviewList: 'Transactions to review',
    journalWarn: 'The receipt total does not match its items: the entry is held for a manual check.',
    csv: 'Download sample CSV',
    sifatV: { segera: 'Urgent', biasa: 'Normal', rahasia: 'Confidential' },
    clsV: { undangan: 'Invitation', permohonan: 'Request', laporan: 'Report', edaran: 'Circular', 'nota-dinas': 'Internal memo' },
  },
}

/** read flow shared by the three demos */
function useRead(doc: SampleDoc, lang: Lang) {
  const extracted = useMemo(() => simulateExtract(doc, { lang }), [doc, lang])
  const [run, setRun] = useState(0)
  const [n, setN] = useState(0)
  useEffect(() => {
    setRun(0)
    setN(0)
  }, [doc.id])
  const reading = run > 0 && n < extracted.fields.length
  const done = run > 0 && n >= extracted.fields.length
  return {
    extracted,
    reveal: run > 0,
    runKey: run,
    n,
    reading,
    done,
    start: () => {
      setN(0)
      setRun((r) => r + 1)
    },
    onReveal: (c: number) => setN(c),
  }
}

function Gallery({ docs, value, onChange, label }: { docs: SampleDoc[]; value: string; onChange: (id: string) => void; label: string }) {
  const { lang } = useI18n()
  return (
    <div className="dk-scd-gallery" role="radiogroup" aria-label={label}>
      {docs.map((d) => (
        <button key={d.id} type="button" role="radio" aria-checked={d.id === value} className={`dk-scd-thumb${d.id === value ? ' is-on' : ''}`} onClick={() => onChange(d.id)}>
          <span className={`dk-scd-mini is-${d.bg}`} aria-hidden="true">
            <DocArt doc={d} />
          </span>
          <span className="dk-scd-tt">
            <b>{d.title[lang]}</b>
            <small>{d.caption[lang]}</small>
          </span>
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ 1 · letter → disposition */

function LetterDemo() {
  const { lang } = useI18n()
  const c = C[lang]
  const [id, setId] = useState(LETTERS[1]?.id ?? '')
  const doc = getSample(id) ?? LETTERS[0]!
  const r = useRead(doc, lang)
  const [deskew, setDeskew] = useState(false)
  const [approved, setApproved] = useState(false)
  useEffect(() => {
    setDeskew(false)
    setApproved(false)
  }, [id])
  const meta = doc.meta.kind === 'letter' ? doc.meta : null
  const total = r.extracted.fields.length
  const read = () => {
    if (doc.scan) setDeskew(true)
    setApproved(false)
    r.start()
  }
  return (
    <div className="dk-scd-block">
      <SectionHeader index="01" title={c.h1} lead={c.l1} as="h3" />
      <Gallery docs={LETTERS} value={id} onChange={setId} label={c.gallery} />
      <div className="dk-scd-grid">
        <DocViewer
          doc={doc}
          boxes={r.extracted.fields}
          revealBoxes={r.reveal}
          replay={r.runKey}
          onReveal={r.onReveal}
          deskew={deskew}
          toolbar={
            <>
              {doc.scan && (
                <Button size="sm" variant="quiet" icon={deskew ? 'reset' : 'spark'} onClick={() => setDeskew((d) => !d)}>
                  {deskew ? c.raw : c.straighten}
                </Button>
              )}
              <Button size="sm" variant="primary" icon={r.done ? 'refresh' : 'doc'} onClick={read} busy={r.reading}>
                {r.done ? c.reread : c.read}
              </Button>
            </>
          }
        >
          {meta && (
            <DispositionStamp
              show={approved}
              heading={c.stamp}
              lines={[`${c.to}: ${meta.disposition.to.map((o) => OPD[o] ?? o).join(', ')}`, meta.disposition.instruction[lang], `${longDate('2026-11-17', lang)} · ${c.stampBy}`]}
              x={66}
              y={doc.id.includes('undangan') ? 70 : 64}
            />
          )}
        </DocViewer>
        <div className="dk-scd-side">
          <ExtractPanel extracted={r.reveal ? r.extracted : null} revealed={r.n} loading={false} showVerdict={false} />
          {meta && r.done && (
            <section className="dk-scd-card" aria-label={c.summary}>
              <h4 className="dk-scd-h4">{c.summary}</h4>
              <ul className="dk-scd-sum">
                {meta.summary.map((l) => (
                  <li key={l.id}>{l[lang]}</li>
                ))}
              </ul>
              <dl className="dk-scd-dl">
                <div>
                  <dt>{c.cls}</dt>
                  <dd>
                    <Badge>{c.clsV[meta.cls]}</Badge>
                  </dd>
                </div>
                <div>
                  <dt>{c.sifat}</dt>
                  <dd>
                    <Badge tone={meta.sifat === 'segera' ? 'warn' : 'neutral'}>{c.sifatV[meta.sifat]}</Badge>
                  </dd>
                </div>
                <div>
                  <dt>{c.due}</dt>
                  <dd className="dk-num">{meta.due ? longDate(meta.due, lang) : c.none}</dd>
                </div>
              </dl>
              <h4 className="dk-scd-h4">{c.draft}</h4>
              <dl className="dk-scd-dl is-stack">
                <div>
                  <dt>{c.to}</dt>
                  <dd>{meta.disposition.to.map((o) => OPD[o] ?? o).join(', ')}</dd>
                </div>
                <div>
                  <dt>{c.instr}</dt>
                  <dd>{meta.disposition.instruction[lang]}</dd>
                </div>
                <div>
                  <dt>{c.note}</dt>
                  <dd>{meta.disposition.note[lang]}</dd>
                </div>
              </dl>
              <div className="dk-scd-actions" aria-live="polite">
                {approved ? (
                  <>
                    <p className="dk-scd-ok">{c.approved}</p>
                    <Button size="sm" variant="quiet" icon="reset" onClick={() => setApproved(false)}>
                      {c.undo}
                    </Button>
                  </>
                ) : (
                  <Button variant="primary" icon="stamp" onClick={() => setApproved(true)}>
                    {c.approve}
                  </Button>
                )}
              </div>
            </section>
          )}
          {r.reading && (
            <p className="dk-scd-progress dk-num" aria-live="polite">
              <span style={{ transform: `scaleX(${r.n / Math.max(1, total)})` }} aria-hidden="true" />
              {c.reading(r.n, total)}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ 2 · identity + tamper heatmap */

const ID_DOCS = [...IDENTITY, ...PERMITS, ...HOUSES]

function IdentityDemo() {
  const { lang } = useI18n()
  const c = C[lang]
  const [id, setId] = useState('ktp-siti-edit')
  const doc = getSample(id) ?? IDENTITY[0]!
  const r = useRead(doc, lang)
  const [heat, setHeat] = useState(0)
  useEffect(() => setHeat(0), [id])
  // heat appears with the verdict of an edited document
  useEffect(() => {
    if (r.done && doc.tamper?.length) setHeat(0.7)
  }, [r.done, doc])
  const cells = r.extracted.tamper ?? []
  const max = cells.reduce((m, x) => Math.max(m, x.score), 0)
  return (
    <div className="dk-scd-block">
      <SectionHeader index="02" title={c.h2} lead={c.l2} as="h3" />
      <Gallery docs={ID_DOCS} value={id} onChange={setId} label={c.gallery} />
      <div className="dk-scd-grid">
        <DocViewer
          doc={doc}
          replay={r.runKey}
          boxes={r.extracted.fields}
          revealBoxes={r.reveal}
          onReveal={r.onReveal}
          deskew={r.reveal}
          tamper={r.done && cells.length ? { cells, opacity: heat } : null}
          height="clamp(300px, 56vh, 560px)"
          toolbar={
            <>
              {r.done && cells.length > 0 && <TamperToggle opacity={heat} onChange={setHeat} maxScore={max} />}
              <Button size="sm" variant="primary" icon={r.done ? 'refresh' : 'shield'} onClick={r.start} busy={r.reading}>
                {r.done ? c.reread : c.readDoc}
              </Button>
            </>
          }
        />
        <div className="dk-scd-side">
          <ExtractPanel extracted={r.reveal ? r.extracted : null} revealed={r.n} />
          {r.reading && <p className="dk-scd-progress dk-num">{c.readingDoc(r.n, r.extracted.fields.length)}</p>}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ 3 · receipt deskew → journal */

function ReceiptDemo() {
  const { lang } = useI18n()
  const c = C[lang]
  const [id, setId] = useState('nota-tb')
  const doc = getSample(id) ?? FINANCE[0]!
  const r = useRead(doc, lang)
  const [deskew, setDeskew] = useState(false)
  useEffect(() => setDeskew(false), [id])
  const go = () => {
    setDeskew(true)
    r.start()
  }
  const m = doc.meta
  const csvHref = useMemo(() => (m.kind === 'mutasi' ? `data:text/csv;charset=utf-8,${encodeURIComponent(m.csv)}` : null), [m])
  return (
    <div className="dk-scd-block">
      <SectionHeader index="03" title={c.h3} lead={c.l3} as="h3" />
      <Gallery docs={FINANCE} value={id} onChange={setId} label={c.gallery} />
      <div className="dk-scd-grid">
        <DocViewer
          doc={doc}
          replay={r.runKey}
          boxes={r.extracted.fields}
          revealBoxes={r.reveal}
          onReveal={r.onReveal}
          deskew={deskew}
          tamper={r.done && doc.tamper ? { cells: r.extracted.tamper ?? [], opacity: 0.6 } : null}
          toolbar={
            <Button size="sm" variant="primary" icon={r.done ? 'refresh' : 'spark'} onClick={go} busy={r.reading}>
              {r.done ? c.reread : doc.scan ? c.straightenRead : c.readDoc}
            </Button>
          }
        />
        <div className="dk-scd-side">
          <ExtractPanel extracted={r.reveal ? r.extracted : null} revealed={r.n} />
          {r.done && (m.kind === 'nota' || m.kind === 'faktur') && (
            <section className="dk-scd-card" aria-label={c.journal}>
              <h4 className="dk-scd-h4">{c.journal}</h4>
              {m.edited ? (
                <InsightCallout title={c.review}>{c.journalWarn}</InsightCallout>
              ) : (
                <table className="dk-scd-journal">
                  <tbody>
                    <tr>
                      <th scope="row">{c.debit}</th>
                      <td>{m.journal.debit}</td>
                      <td className="dk-num">Rp {idr(m.journal.amount)}</td>
                    </tr>
                    <tr>
                      <th scope="row">{c.credit}</th>
                      <td>{m.journal.credit}</td>
                      <td className="dk-num">Rp {idr(m.journal.amount)}</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="dk-scd-memo">
                        {m.journal.memo[lang]}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </section>
          )}
          {r.done && m.kind === 'mutasi' && (
            <section className="dk-scd-card" aria-label={c.reviewList}>
              <h4 className="dk-scd-h4">{c.reviewList}</h4>
              <ul className="dk-scd-review">
                {m.rows
                  .filter((x) => x.review)
                  .map((x) => (
                    <li key={x.desc}>
                      <span>
                        <b>{x.desc}</b>
                        <small>{x.reviewReason?.[lang]}</small>
                      </span>
                      <span className="dk-num">{x.debit ? `−${idr(x.debit)}` : `+${idr(x.credit)}`}</span>
                    </li>
                  ))}
              </ul>
              {csvHref && (
                <a className="dk-scd-link" href={csvHref} download="mutasi-bank-arta-kencana-fiktif.csv">
                  {c.csv}
                </a>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Section() {
  return (
    <div className="dk-root dk-scd" data-eco="satu-daerah">
      <LetterDemo />
      <IdentityDemo />
      <div data-eco="usaha-pintar">
        <ReceiptDemo />
      </div>
    </div>
  )
}
