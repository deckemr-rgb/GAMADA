/**
 * NotaProcessor.tsx (lazy, pure props; reused by the product page mini later) — a crumpled, tilted nota becomes a
 * journal entry: deskew → OCR boxes one by one → fields (simulateExtract, extractKind 'invoice') → the balanced
 * entry card. ≤ 1.5 s with full motion (the parent's fly into the journal adds ≤ 0.5 s), instant under reduced
 * motion / static. An altered receipt shows the tamper heatmap and says it goes to "Perlu tinjauan".
 */
import { gsap } from 'gsap'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { DocViewer } from '../../demo-kit/docs/DocViewer'
import { ExtractPanel } from '../../demo-kit/docs/ExtractPanel'
import { simulateExtract } from '../../demo-kit/docs/extract'
import type { SampleDoc } from '../../demo-kit/docs/types'
import { Icon, motionMode } from '../../demo-kit/ui'
import type { LedgerLine } from '../../demo-kit/world'
import { ACCOUNT, coaOf } from '../../demo-kit/world/usaha-pintar'
import { rp } from './model'
import { useT } from './strings'

export interface NotaProcessorProps {
  doc: SampleDoc
  /** the entry the nota produces (shown when the reading is done) */
  lines: readonly LedgerLine[]
  /** altered receipt: heatmap + "needs review" note */
  review?: boolean
  /** start at once (the parent mounted it from the "Proses nota" press) */
  autoplay: boolean
  /** called once when the entry card is on screen (its element, for the fly into the journal) */
  onDone?: (entryEl: HTMLElement | null) => void
  /** already journaled: show the end state, call nothing */
  done?: boolean
}

const Viewer = memo(DocViewer)

export default function NotaProcessor({ doc, lines, review, autoplay, onDone, done: doneBefore }: NotaProcessorProps) {
  const { t, lang } = useT()
  const extracted = useMemo(() => simulateExtract(doc, { lang }), [doc, lang])
  const total = extracted.fields.length
  const [phase, setPhase] = useState<'idle' | 'run' | 'done'>(doneBefore ? 'done' : autoplay ? 'run' : 'idle')
  const [count, setCount] = useState(doneBefore ? total : 0)
  const entryRef = useRef<HTMLDivElement>(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const fired = useRef(!!doneBefore)

  useEffect(() => {
    if (phase !== 'run') return
    if (motionMode() !== 'full' || !total) {
      setCount(total)
      setPhase('done')
      return
    }
    const step = Math.min(0.11, 0.9 / total)
    const tl = gsap.timeline()
    for (let i = 1; i <= total; i++) tl.call(() => setCount(i), [], 0.3 + i * step)
    tl.call(() => setPhase('done'), [], 0.3 + total * step + 0.15)
    return () => {
      tl.kill()
    }
  }, [phase, total])

  useEffect(() => {
    if (phase !== 'done' || fired.current) return
    fired.current = true
    onDoneRef.current?.(entryRef.current)
  }, [phase])

  const running = phase !== 'idle'
  const finished = phase === 'done'
  const tamper = useMemo(() => (finished && review && extracted.tamper?.length ? { cells: extracted.tamper, opacity: 0.75 } : null), [finished, review, extracted])
  const steps = [t.stepDeskew, t.stepOcr, t.stepFields, t.stepPost]
  const stepAt = finished ? 4 : !running ? 0 : count === 0 ? 1 : count < total ? 2 : 3
  const d = lines.reduce((a, l) => a + l.debit, 0)
  const c = lines.reduce((a, l) => a + l.credit, 0)

  return (
    <div className="dk-pb-proc" data-phase={phase}>
      <ol className="dk-pb-steps" aria-label={t.processing}>
        {steps.map((s, i) => (
          <li key={s} className={i < stepAt ? 'is-done' : i === stepAt ? 'is-now' : ''}>
            <Icon name={i < stepAt ? 'check' : 'dot'} size={14} />
            {s}
          </li>
        ))}
      </ol>
      <div className="dk-pb-proc-grid">
        <Viewer doc={doc} revealBoxes={running ? count : false} boxes={extracted.fields} deskew={running} tamper={tamper} label={doc.title[lang]} height="clamp(280px, 52vh, 520px)" />
        <div className="dk-pb-proc-side">
          <ExtractPanel extracted={extracted} revealed={count} showChecks={finished} showVerdict={finished} emptyText={t.processing} />
          {finished && (
            <div ref={entryRef} className={`dk-pb-entry${review ? ' is-review' : ''}`} data-pb="entry" role="status">
              <p className="dk-pb-entry-h">
                <Icon name={review ? 'alert' : 'check'} size={16} /> {t.entryTitle}
              </p>
              <table className="dk-pb-lines">
                <thead>
                  <tr>
                    <th scope="col">{t.account}</th>
                    <th scope="col" className="is-num">{t.debit}</th>
                    <th scope="col" className="is-num">{t.credit}</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.account + l.debit}>
                      <td>
                        <span className="dk-pb-code">{coaOf(l.account).code}</span> {ACCOUNT[l.account]?.[lang] ?? l.account}
                      </td>
                      <td className="is-num">{l.debit ? rp(l.debit, lang) : ''}</td>
                      <td className="is-num">{l.credit ? rp(l.credit, lang) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="dk-pb-entry-f">
                {d === c && <span className="dk-pb-ok">✓ {t.balanced}</span>}
                {review && <span className="dk-pb-warn">{t.entryReview}</span>}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
