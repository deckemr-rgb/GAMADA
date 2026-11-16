/** 07 · Document — scanned letter on an original PaperFrame, OCR marks that rule themselves, approve → stamp. */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { gsap } from 'gsap'
import { useI18n } from '../../lib/i18n'
import { EASE } from '../../lib/motion'
import { DOC } from '../sample'
import { IconCheck, IconScan, IconStamp, IconUndo } from './icons'
import { LDE, fmt, motionMode, observeOnce } from './lde'

const C = {
  paper: { id: 'Pindaian surat masuk, sedikit miring, dengan kotak hasil OCR bernomor 1 sampai 5', en: 'Scan of the incoming letter, slightly skewed, with OCR boxes numbered 1 to 5' },
  rescan: { id: 'Pindai ulang', en: 'Rescan' },
  rescanLabel: { id: 'Putar ulang pemindaian OCR', en: 'Replay the OCR scan' },
  number: { id: 'Nomor', en: 'Number' },
  from: { id: 'Dari', en: 'From' },
  date: { id: 'Tanggal', en: 'Date' },
  class: { id: 'Klasifikasi', en: 'Classification' },
  extract: { id: 'Ekstraksi', en: 'Extraction' },
  field: { id: 'Kolom', en: 'Field' },
  value: { id: 'Nilai', en: 'Value' },
  conf: { id: 'Keyakinan', en: 'Confidence' },
  check: { id: 'Periksa', en: 'Review' },
  summary: { id: 'Ringkasan AI · 3 baris', en: 'AI summary · 3 lines' },
  disp: { id: 'Draf disposisi', en: 'Disposition draft' },
  to: { id: 'Kepada', en: 'To' },
  instr: { id: 'Instruksi', en: 'Instruction' },
  approve: { id: 'Setujui disposisi', en: 'Approve disposition' },
  undo: { id: 'Batalkan', en: 'Undo' },
  approved: { id: 'Disetujui · diteruskan ke', en: 'Approved · forwarded to' },
  undone: { id: 'Persetujuan dibatalkan.', en: 'Approval withdrawn.' },
  stamp: { id: 'DISETUJUI', en: 'APPROVED' },
  stampTo: { id: 'Disposisi', en: 'Disposition' },
  gov: { id: 'PEMERINTAH KABUPATEN CONTOH', en: 'PEMERINTAH KABUPATEN CONTOH' },
  office: { id: 'KECAMATAN TIRTAJAYA', en: 'KECAMATAN TIRTAJAYA' },
  addr: { id: 'Jalan Contoh No. 1 · Telepon (000) 000 000 · Kode Pos 00000', en: 'Jalan Contoh No. 1 · Telepon (000) 000 000 · Kode Pos 00000' },
}

/** Body "greeking" — the scan's running text is rendered as grey line bars (only extracted fields are legible). */
const GREEK: { x: number; y: number; w: number }[] = [
  { x: 12, y: 38, w: 22 },
  { x: 18, y: 41.6, w: 70 },
  { x: 12, y: 45.2, w: 76 },
  { x: 12, y: 48.8, w: 73 },
  { x: 12, y: 52.4, w: 76 },
  { x: 12, y: 56, w: 48 },
  { x: 51, y: 63.4, w: 37 },
  { x: 18, y: 68.6, w: 70 },
  { x: 12, y: 72.2, w: 41 },
  { x: 58, y: 75, w: 18 },
]

export function PaperFrame({ skewDeg, label, children }: { skewDeg: number; label: string; children: ReactNode }) {
  return (
    <div className="lde-paper" style={{ transform: `rotate(${skewDeg}deg)` }} role="img" aria-label={label}>
      <div className="lde-paper-sheet">{children}</div>
    </div>
  )
}

export default function Doc() {
  const { lang } = useI18n()
  const [approved, setApproved] = useState(false)
  const [status, setStatus] = useState('')
  const [instr, setInstr] = useState(DOC.disposition.instruction[lang])
  const root = useRef<HTMLDivElement>(null)
  const scanRef = useRef<() => void>(() => {})
  const stampCtx = useRef<gsap.Context | null>(null)

  // Scan → OCR marks rule themselves on one by one, the extraction ledger fills in step.
  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    const mode = motionMode()
    if (mode === 'static') return
    const q = (s: string) => el.querySelectorAll<HTMLElement>(s)
    const ctx = gsap.context(() => {})
    let tl: gsap.core.Timeline | null = null

    const hidden = () => {
      gsap.set(q('.lde-ocr-t, .lde-ocr-b'), { scaleX: 0 })
      gsap.set(q('.lde-ocr-l, .lde-ocr-r'), { scaleY: 0 })
      gsap.set(q('.lde-ocr-fill, .lde-ocr-n'), { opacity: 0 })
      gsap.set(q('.lde-ex-row'), { opacity: 0 })
      gsap.set(q('.lde-conf-bar'), { scaleX: 0 })
      gsap.set(q('.lde-doc-late'), { opacity: 0 })
      gsap.set(q('.lde-scanline'), { opacity: 0, yPercent: -100 })
    }
    const finalState = () => {
      gsap.set(q('.lde-ocr-t, .lde-ocr-b'), { scaleX: 1 })
      gsap.set(q('.lde-ocr-l, .lde-ocr-r'), { scaleY: 1 })
      gsap.set(q('.lde-ocr-fill, .lde-ocr-n, .lde-ex-row, .lde-doc-late'), { opacity: 1 })
      gsap.set(q('.lde-conf-bar'), { scaleX: (_i: number, t: HTMLElement) => Number(t.dataset.s) })
      gsap.set(q('.lde-scanline'), { opacity: 0 })
    }

    const build = () => {
      tl?.kill()
      if (mode === 'reduced') {
        finalState()
        tl = gsap.timeline()
        tl.from(q('.lde-ocr, .lde-ex-row, .lde-doc-late'), { opacity: 0, duration: LDE.fade })
        return
      }
      hidden()
      const sweep = 1.15
      const boxes = Array.from(q('.lde-ocr'))
      const rows = Array.from(q('.lde-ex-row'))
      tl = gsap.timeline()
      tl.set(q('.lde-scanline'), { opacity: 1, yPercent: -100 })
      tl.to(q('.lde-scanline'), { yPercent: 0, duration: sweep, ease: 'none' }, 0)
      tl.to(q('.lde-scanline'), { opacity: 0, duration: 0.18 }, sweep - 0.12)
      boxes.forEach((b, i) => {
        const at = (Number(b.dataset.y) / 100) * sweep
        const e = (s: string) => b.querySelector(s)
        tl!.to([e('.lde-ocr-t'), e('.lde-ocr-b')], { scaleX: 1, duration: LDE.ocrEdge, ease: EASE.reveal }, at)
        tl!.to([e('.lde-ocr-l'), e('.lde-ocr-r')], { scaleY: 1, duration: LDE.ocrEdge * 0.8, ease: EASE.reveal }, at + 0.08)
        tl!.to(e('.lde-ocr-fill'), { opacity: 1, duration: LDE.press }, at + 0.16)
        tl!.fromTo(e('.lde-ocr-n'), { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: LDE.press, ease: EASE.out }, at + 0.2)
        const row = rows[i]
        if (row) {
          tl!.fromTo(row, { opacity: 0, x: -6 }, { opacity: 1, x: 0, duration: LDE.panel, ease: EASE.out }, at + 0.12)
          const bar = row.querySelector<HTMLElement>('.lde-conf-bar')
          if (bar) tl!.to(bar, { scaleX: Number(bar.dataset.s), duration: LDE.screen, ease: EASE.out }, at + 0.18)
          const n = row.querySelector<HTMLElement>('.lde-conf-n')
          if (n) {
            const o = { v: 0 }
            const target = Number(n.dataset.v)
            tl!.to(o, { v: target, duration: LDE.count * 0.8, ease: 'power2.out', onUpdate: () => (n.textContent = `${fmt(lang, Math.round(o.v))}%`) }, at + 0.18)
          }
        }
      })
      tl.to(q('.lde-doc-late'), { opacity: 1, duration: LDE.panel, stagger: 0.06 }, sweep + 0.05)
    }

    ctx.add(() => {
      if (mode === 'full') hidden()
      else gsap.set(q('.lde-ocr, .lde-ex-row, .lde-doc-late'), { opacity: 0 })
    })
    scanRef.current = () => ctx.add(build)
    const stop = observeOnce(el.querySelector('.lde-paper') ?? el, () => ctx.add(build), 0.35)
    return () => {
      stop()
      tl?.kill()
      ctx.revert()
    }
  }, [lang])

  // Stamp: drops onto the paper (scale + opacity), the sheet takes the impact with a 2 px nudge.
  useLayoutEffect(() => {
    if (!approved) return
    const el = root.current
    const stamp = el?.querySelector('.lde-stamp')
    const sheet = el?.querySelector('.lde-paper-sheet')
    const mode = motionMode()
    if (!stamp || !sheet || mode === 'static') return
    stampCtx.current?.revert()
    stampCtx.current = gsap.context(() => {
      if (mode === 'reduced') {
        gsap.from(stamp, { opacity: 0, duration: LDE.fade })
        return
      }
      const tl = gsap.timeline()
      tl.fromTo(stamp, { opacity: 0, scale: 1.7, rotate: -14 }, { opacity: 0.92, scale: 1, rotate: -8, duration: LDE.stampDrop, ease: 'power4.in' })
      tl.to(sheet, { y: 3, duration: 0.06, ease: 'power2.out' })
      tl.to(sheet, { y: 0, duration: 0.24, ease: 'power2.out' })
    })
    return () => {
      stampCtx.current?.revert()
      stampCtx.current = null
    }
  }, [approved])

  const toggleApprove = () => {
    if (approved) {
      setApproved(false)
      setStatus(C.undone[lang])
    } else {
      setApproved(true)
      setStatus(`${C.approved[lang]} ${DOC.disposition.to}.`)
    }
  }

  const [kicker, ...rest] = DOC.title[lang].split(' · ')
  const title = rest.join(' · ')

  return (
    <div className="lde-doc" ref={root}>
      <div className="lde-doc-paper">
        <div className="lde-desk">
          <PaperFrame skewDeg={DOC.skewDeg} label={C.paper[lang]}>
            <div className="lde-lh">
              <svg className="lde-lh-mark" viewBox="0 0 40 40" aria-hidden="true">
                <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <circle cx="20" cy="20" r="13" fill="none" stroke="currentColor" strokeWidth="0.8" />
                <path d="M11 24c3-2 6-2 9 0s6 2 9 0M11 19c3-2 6-2 9 0s6 2 9 0M20 8v6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <div className="lde-lh-text">
                <span className="lde-lh-gov">{C.gov[lang]}</span>
                <span className="lde-lh-office">{C.office[lang]}</span>
                <span className="lde-lh-addr">{C.addr[lang]}</span>
              </div>
            </div>
            <span className="lde-lh-rule" />
            <span className="lde-p-date" style={{ top: '18%' }}>
              Tirtajaya, {DOC.date}
            </span>
            {DOC.boxes.map((b) => (
              <span key={b.field.id} className={`lde-p-field ${b.h > 5 ? 'is-sig' : ''}`} style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%` }}>
                {b.value}
                {b.h > 5 && (
                  <svg className="lde-p-tte" viewBox="0 0 10 10" aria-hidden="true">
                    <path d="M0 0h4v4H0zM6 0h4v4H6zM0 6h4v4H0zM6 6h2v2H6zM8 8h2v2H8z" fill="currentColor" />
                  </svg>
                )}
              </span>
            ))}
            {GREEK.map((g, i) => (
              <span key={i} className="lde-p-greek" style={{ left: `${g.x}%`, top: `${g.y}%`, width: `${g.w}%` }} />
            ))}

            <span className="lde-scanline" aria-hidden="true" />
            {DOC.boxes.map((b, i) => (
              <span key={b.field.id} className="lde-ocr" data-y={b.y + b.h / 2} style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%` }}>
                <span className="lde-ocr-fill" />
                <span className="lde-ocr-e lde-ocr-t" />
                <span className="lde-ocr-e lde-ocr-r" />
                <span className="lde-ocr-e lde-ocr-b" />
                <span className="lde-ocr-e lde-ocr-l" />
                <span className="lde-ocr-n">{i + 1}</span>
              </span>
            ))}

            {approved && (
              <span className="lde-stamp" aria-hidden="true">
                <span className="lde-stamp-big">{C.stamp[lang]}</span>
                <span className="lde-stamp-line">
                  {C.stampTo[lang]} → {DOC.disposition.to}
                </span>
                <span className="lde-stamp-line">17 · XI · 2026</span>
              </span>
            )}
          </PaperFrame>
        </div>
        <button type="button" className="lde-btn lde-btn-quiet" onClick={() => scanRef.current()} aria-label={C.rescanLabel[lang]}>
          <IconScan />
          {C.rescan[lang]}
        </button>
      </div>

      <div className="lde-doc-panel">
        <p className="lde-cap">{kicker}</p>
        <h3 className="lde-doc-title">{title}</h3>
        <dl className="lde-doc-meta">
          <div>
            <dt className="lde-cap">{C.number[lang]}</dt>
            <dd className="lde-num">{DOC.number}</dd>
          </div>
          <div>
            <dt className="lde-cap">{C.from[lang]}</dt>
            <dd>{DOC.from}</dd>
          </div>
          <div>
            <dt className="lde-cap">{C.date[lang]}</dt>
            <dd className="lde-num">{DOC.date}</dd>
          </div>
        </dl>

        <div className="lde-doc-block">
          <h4 className="lde-cap lde-cap-strong">{C.extract[lang]}</h4>
          <table className="lde-ex">
            <thead className="lde-sr">
              <tr>
                <th scope="col">#</th>
                <th scope="col">{C.field[lang]}</th>
                <th scope="col">{C.value[lang]}</th>
                <th scope="col">{C.conf[lang]}</th>
              </tr>
            </thead>
            <tbody>
              {DOC.boxes.map((b, i) => {
                const pct = Math.round(b.conf * 100)
                const low = b.conf < 0.85
                return (
                  <tr key={b.field.id} className="lde-ex-row">
                    <td className="lde-ex-n lde-num">{i + 1}</td>
                    <td className="lde-ex-f">{b.field[lang]}</td>
                    <td className="lde-ex-v">{b.value}</td>
                    <td className="lde-ex-c">
                      <span className="lde-conf">
                        <span className="lde-conf-track" aria-hidden="true">
                          <span className={`lde-conf-bar ${low ? 'is-low' : ''}`} data-s={b.conf} style={{ transform: `scaleX(${b.conf})` }} />
                        </span>
                        <span className="lde-conf-n lde-num" data-v={pct}>
                          {`${fmt(lang, pct)}%`}
                        </span>
                      </span>
                      {low && <span className="lde-flag">{C.check[lang]}</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="lde-doc-block lde-doc-late">
          <h4 className="lde-cap lde-cap-strong">{C.summary[lang]}</h4>
          <ol className="lde-summary">
            {DOC.summary[lang].map((s, i) => (
              <li key={i}>
                <span className="lde-summary-n lde-num">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </div>

        <div className="lde-doc-block lde-doc-late lde-doc-class">
          <h4 className="lde-cap lde-cap-strong">{C.class[lang]}</h4>
          <span className="lde-chip lde-chip-acc">{DOC.classification[lang]}</span>
        </div>

        <div className="lde-doc-block lde-doc-late lde-disp">
          <h4 className="lde-cap lde-cap-strong">{C.disp[lang]}</h4>
          <p className="lde-disp-to">
            <span className="lde-muted">{C.to[lang]}</span> <strong>{DOC.disposition.to}</strong>
          </p>
          <label className="lde-field">
            <span className="lde-cap">{C.instr[lang]}</span>
            <textarea value={instr} onChange={(e) => setInstr(e.target.value)} rows={2} disabled={approved} />
          </label>
          <div className="lde-disp-actions">
            <button type="button" className={`lde-btn ${approved ? '' : 'lde-btn-primary'}`} onClick={toggleApprove}>
              {approved ? <IconUndo /> : <IconStamp />}
              {approved ? C.undo[lang] : C.approve[lang]}
            </button>
            {approved && (
              <span className="lde-disp-ok">
                <IconCheck size={14} />
                {C.approved[lang]} {DOC.disposition.to}
              </span>
            )}
          </div>
          <p className="lde-sr" aria-live="polite">
            {status}
          </p>
        </div>
      </div>
    </div>
  )
}
