/**
 * 07 · Document: an original PaperFrame (light paper, skewed scan, generic letterhead), OCR boxes
 * appearing one by one while the extraction panel fills field by field with confidence bars (the
 * "wow" moment), AI summary, classification, a disposition draft and a stamp on approval.
 */
import { useLayoutEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { EASE } from '../../lib/motion'
import { useI18n, type Lang } from '../../lib/i18n'
import { DOC } from '../sample'
import { Icon, SectionHead, TT, fmt, motionMode, useFirstView } from './shared'

const C = {
  id: {
    title: 'Dokumen & ekstraksi',
    lead: 'Surat pindaian dibaca AI: kotak OCR muncul satu per satu, kolom terisi dengan tingkat keyakinan, lalu draf disposisi siap disetujui.',
    paper: 'Pindaian surat masuk',
    extraction: 'Ekstraksi AI',
    fields: 'kolom',
    reading: 'Membaca',
    done: 'Selesai',
    replay: 'Ulangi ekstraksi',
    check: 'Periksa',
    summary: 'Ringkasan AI',
    classification: 'Klasifikasi',
    disposition: 'Draf disposisi',
    to: 'Kepada',
    instruction: 'Instruksi',
    deadline: 'Tenggat',
    approve: 'Setujui disposisi',
    approved: 'Disposisi disetujui',
    undo: 'Batalkan',
    stamp1: 'DISETUJUI',
    stamp2: 'Disposisi · 17/11/2026',
    announceOk: 'Disposisi ke Kalaksa BPBD disetujui.',
    announceUndo: 'Persetujuan dibatalkan.',
    conf: 'keyakinan',
  },
  en: {
    title: 'Document & extraction',
    lead: 'AI reads a scanned letter: OCR boxes appear one by one, fields fill with confidence, then a disposition draft is ready to approve.',
    paper: 'Scanned incoming letter',
    extraction: 'AI extraction',
    fields: 'fields',
    reading: 'Reading',
    done: 'Done',
    replay: 'Replay extraction',
    check: 'Review',
    summary: 'AI summary',
    classification: 'Classification',
    disposition: 'Disposition draft',
    to: 'To',
    instruction: 'Instruction',
    deadline: 'Deadline',
    approve: 'Approve disposition',
    approved: 'Disposition approved',
    undo: 'Undo',
    stamp1: 'APPROVED',
    stamp2: 'Disposition · 17/11/2026',
    announceOk: 'Disposition to Kalaksa BPBD approved.',
    announceUndo: 'Approval undone.',
    conf: 'confidence',
  },
}

const REVIEW_BELOW = 0.85
const BOXES = DOC.boxes

function pct(lang: Lang, v: number) {
  return `${fmt(lang, v * 100)}%`
}

export default function DocBlock() {
  const { lang } = useI18n()
  const c = C[lang]
  const mode = motionMode()
  const rootRef = useRef<HTMLElement>(null)
  const bedRef = useRef<HTMLDivElement>(null)
  const scanRef = useRef<HTMLDivElement>(null)
  const stampRef = useRef<HTMLDivElement>(null)
  const ctxRef = useRef<gsap.Context | null>(null)
  const tlRef = useRef<gsap.core.Timeline | null>(null)
  const [filled, setFilled] = useState(mode === 'full' ? 0 : BOXES.length)
  const [ready, setReady] = useState(mode !== 'full')
  const [approved, setApproved] = useState(false)
  const [hiField, setHiField] = useState<number | null>(null)
  const [announce, setAnnounce] = useState('')

  const q = (sel: string) => rootRef.current?.querySelectorAll<HTMLElement>(sel) ?? []

  const writePcts = (vals?: number[]) => {
    q('.ldt-conf-n').forEach((el, i) => {
      const v = vals ? vals[i] ?? 0 : BOXES[i]?.conf ?? 0
      el.textContent = pct(lang, v)
    })
  }

  useLayoutEffect(() => {
    ctxRef.current = gsap.context(() => {}, rootRef)
    if (mode === 'full') {
      ctxRef.current.add(() => {
        gsap.set(q('.ldt-ocr'), { opacity: 0 })
        gsap.set(q('.ldt-field'), { opacity: 0.35 })
        gsap.set(q('.ldt-field-v'), { opacity: 0 })
        gsap.set(q('.ldt-conf-bar > i'), { scaleX: 0 })
        gsap.set(q('.ldt-after'), { opacity: 0, y: 6 })
        gsap.set(stampRef.current, { opacity: 0 })
      })
      writePcts(BOXES.map(() => 0))
    } else {
      gsap.set(q('.ldt-conf-bar > i'), { scaleX: (i: number) => BOXES[i]?.conf ?? 0 })
      gsap.set(stampRef.current, { opacity: 0 })
      writePcts()
    }
    return () => {
      ctxRef.current?.revert()
      ctxRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const run = () => {
    const ctx = ctxRef.current
    if (!ctx) return
    tlRef.current?.kill()
    setFilled(0)
    setReady(false)
    ctx.add(() => {
      const boxes = q('.ldt-ocr')
      const fields = q('.ldt-field')
      const vals = q('.ldt-field-v')
      const bars = q('.ldt-conf-bar > i')
      const nums = q('.ldt-conf-n')
      gsap.set(boxes, { opacity: 0 })
      gsap.set(fields, { opacity: 0.35 })
      gsap.set(vals, { opacity: 0 })
      gsap.set(bars, { scaleX: 0 })
      gsap.set(q('.ldt-after'), { opacity: 0, y: 6 })
      writePcts(BOXES.map(() => 0))
      const tl = gsap.timeline()
      tl.fromTo(scanRef.current, { yPercent: -12, opacity: 1 }, { yPercent: 100, duration: 1.25, ease: 'power1.inOut' }, 0)
      tl.to(scanRef.current, { opacity: 0, duration: TT.press }, 1.15)
      BOXES.forEach((b, i) => {
        const at = 0.12 + i * TT.fieldStagger
        const counter = { v: 0 }
        tl.fromTo(boxes[i] ?? null, { opacity: 0, scale: 1.06 }, { opacity: 1, scale: 1, duration: 0.26, ease: EASE.out }, at)
        tl.to(fields[i] ?? null, { opacity: 1, duration: TT.press }, at)
        tl.fromTo(vals[i] ?? null, { opacity: 0, x: -4 }, { opacity: 1, x: 0, duration: 0.26, ease: EASE.out }, at + 0.06)
        tl.to(bars[i] ?? null, { scaleX: b.conf, duration: 0.5, ease: 'power2.out' }, at + 0.06)
        tl.to(
          counter,
          {
            v: b.conf,
            duration: 0.5,
            ease: 'power2.out',
            onUpdate: () => {
              const el = nums[i]
              if (el) el.textContent = pct(lang, counter.v)
            },
          },
          at + 0.06,
        )
        tl.call(() => setFilled(i + 1), undefined, at + 0.3)
      })
      const after = 0.12 + BOXES.length * TT.fieldStagger + 0.2
      tl.to(q('.ldt-after'), { opacity: 1, y: 0, duration: TT.panel, stagger: 0.07, ease: EASE.out }, after)
      tl.call(() => setReady(true), undefined, after + 0.2)
      tlRef.current = tl
    })
  }

  useFirstView(
    bedRef,
    () => {
      if (mode === 'full') run()
      else if (mode === 'reduced') ctxRef.current?.add(() => gsap.fromTo(q('.ldt-ocr, .ldt-field, .ldt-after'), { opacity: 0 }, { opacity: 1, duration: TT.reduced }))
    },
    0.3,
  )

  const replay = () => {
    if (approved) unapprove(true)
    if (mode === 'full') run()
    else ctxRef.current?.add(() => gsap.fromTo(q('.ldt-ocr, .ldt-field, .ldt-after'), { opacity: 0 }, { opacity: 1, duration: TT.reduced }))
  }

  const approve = () => {
    setApproved(true)
    setAnnounce(c.announceOk)
    ctxRef.current?.add(() => {
      if (mode !== 'full') {
        gsap.fromTo(stampRef.current, { opacity: 0, scale: 1, rotation: -8 }, { opacity: 1, duration: TT.reduced })
        return
      }
      const tl = gsap.timeline()
      tl.fromTo(stampRef.current, { opacity: 0, scale: 1.7, rotation: -16 }, { opacity: 1, scale: 1, rotation: -8, duration: 0.26, ease: 'power4.in' })
      tl.fromTo(bedRef.current, { scale: 0.992 }, { scale: 1, duration: 0.32, ease: 'back.out(3)' }, 0.26)
      tl.fromTo(q('.ldt-approved'), { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: TT.press, ease: EASE.out }, 0.3)
    })
  }
  const unapprove = (silent = false) => {
    setApproved(false)
    if (!silent) setAnnounce(c.announceUndo)
    ctxRef.current?.add(() => gsap.to(stampRef.current, { opacity: 0, duration: mode === 'full' ? TT.press : TT.reduced }))
  }

  const reviewCount = BOXES.filter((b) => b.conf < REVIEW_BELOW).length

  return (
    <section className="ldt-block" aria-labelledby="ldt-h-doc" ref={rootRef}>
      <SectionHead num="07" id="ldt-h-doc" title={c.title} lead={c.lead} />
      <div className="ldt-docgrid">
        {/* PaperFrame */}
        <figure className="ldt-paperbed" aria-label={c.paper}>
          <div className="ldt-paper-nudge" ref={bedRef}>
            <div className="ldt-paper" style={{ transform: `rotate(${DOC.skewDeg}deg)` }}>
              <div className="ldt-letter">
                <div className="ldt-lh">
                  <svg className="ldt-lh-mark" viewBox="0 0 40 40" aria-hidden="true">
                    <circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" strokeWidth="1.6" />
                    <circle cx="20" cy="20" r="12.5" fill="none" stroke="currentColor" strokeWidth=".8" />
                    <path d="M11 24 17 15l4 6 3-4 5 7Z" fill="currentColor" />
                  </svg>
                  <div className="ldt-lh-text">
                    <span>PEMERINTAH KABUPATEN CONTOH</span>
                    <b>KECAMATAN TIRTAJAYA</b>
                    <small>Jl. Contoh Raya No. 1 · Tirtajaya · kode pos 00000</small>
                  </div>
                </div>
                <div className="ldt-lh-rule" />
                <p className="ldt-ln" style={{ top: '18%' }}>
                  <span className="ldt-lk">Nomor</span>: {DOC.number}
                </p>
                <p className="ldt-ln ldt-ln-r" style={{ top: '18%' }}>
                  Tirtajaya, {DOC.date}
                </p>
                <p className="ldt-ln" style={{ top: '24%' }}>
                  <span className="ldt-lk">Dari</span>: {DOC.from}
                </p>
                <p className="ldt-ln" style={{ top: '30%' }}>
                  <span className="ldt-lk">Perihal</span>: <b>Permohonan bantuan 4 unit pompa air</b>
                </p>
                <div className="ldt-lblock" style={{ top: '37%' }}>
                  <p>Kepada Yth.</p>
                  <p>Bupati Kabupaten Contoh</p>
                  <p>di Tempat</p>
                </div>
                <div className="ldt-lblock ldt-lbody" style={{ top: '48%' }}>
                  <p>
                    Sehubungan dengan genangan air setinggi rata-rata 40 cm yang terjadi sejak pagi hari tanggal 17 November 2026 di tiga kelurahan wilayah Kecamatan Tirtajaya, dengan ini kami mengajukan
                    permohonan bantuan 4 (empat) unit pompa air.
                  </p>
                </div>
                <p className="ldt-ln" style={{ top: '62%' }}>
                  <span className="ldt-lk">Tenggat</span>: 19 November 2026
                </p>
                <div className="ldt-lblock ldt-lbody" style={{ top: '68%' }}>
                  <p>Demikian permohonan ini kami sampaikan. Atas perhatian Bapak, kami ucapkan terima kasih.</p>
                </div>
                <div className="ldt-sign" style={{ top: '71.8%' }}>
                  <p>Camat Tirtajaya,</p>
                </div>
                <div className="ldt-tte" style={{ left: '58%', top: '78.6%', width: '30%', height: '6.8%' }}>
                  <svg viewBox="0 0 20 20" aria-hidden="true">
                    <rect x="1" y="1" width="18" height="18" rx="2" fill="none" stroke="currentColor" />
                    <path d="M4 4h4v4H4zM12 4h4v4h-4zM4 12h4v4H4zM11 11h2v2h-2zM14 14h2v2h-2zM14 11h2v1h-2z" fill="currentColor" />
                  </svg>
                  <span>
                    Ditandatangani secara
                    <br />
                    elektronik (TTE)
                  </span>
                </div>
                <div className="ldt-sign" style={{ top: '87%' }}>
                  <p>
                    <b>Camat Tirtajaya</b>
                  </p>
                </div>
                <p className="ldt-ln ldt-ln-cc" style={{ top: '93%' }}>
                  Tembusan: Kalaksa BPBD; Kepala Dinas PUPR
                </p>

                {BOXES.map((b, i) => (
                  <span
                    key={b.field.id}
                    className={`ldt-ocr${hiField === i ? ' is-hi' : ''}${b.conf < REVIEW_BELOW ? ' is-review' : ''}`}
                    style={{ left: `${b.x - 1}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%` }}
                    aria-hidden="true"
                  >
                    <span className="ldt-ocr-tag">
                      {b.field[lang]} · {pct(lang, b.conf)}
                    </span>
                  </span>
                ))}

                <div className="ldt-stamp" ref={stampRef} aria-hidden="true">
                  <b>{c.stamp1}</b>
                  <span>{c.stamp2}</span>
                  <span>Kalaksa BPBD</span>
                </div>
              </div>
              <div className="ldt-scan" ref={scanRef} aria-hidden="true">
                <i />
              </div>
            </div>
          </div>
          <figcaption className="ldt-paper-cap">
            {Icon.doc()}
            <span>{DOC.title[lang]}</span>
          </figcaption>
        </figure>

        {/* Extraction panel */}
        <div className="ldt-card ldt-extract">
          <div className="ldt-card-h">
            <span className="ldt-card-h-l">
              {Icon.spark()}
              {c.extraction}
            </span>
            <span className="ldt-ex-prog">
              <span className={`ldt-runstate is-${filled < BOXES.length ? 'run' : 'done'}`}>
                <i aria-hidden="true" />
                {filled < BOXES.length ? c.reading : c.done}
              </span>
              <span className="ldt-num ldt-faint">
                {filled}/{BOXES.length} {c.fields}
              </span>
            </span>
          </div>
          <ol className="ldt-fields">
            {BOXES.map((b, i) => (
              <li key={b.field.id} className={`ldt-field${hiField === i ? ' is-hi' : ''}`} onPointerEnter={() => setHiField(i)} onPointerLeave={() => setHiField(null)}>
                <span className="ldt-field-k">{b.field[lang]}</span>
                <span className="ldt-field-v">
                  {b.value}
                  {b.conf < REVIEW_BELOW && <em className="ldt-review">{c.check}</em>}
                </span>
                <span className="ldt-conf" aria-label={`${c.conf} ${pct(lang, b.conf)}`}>
                  <span className={`ldt-conf-bar${b.conf < REVIEW_BELOW ? ' is-low' : ''}`} aria-hidden="true">
                    <i />
                  </span>
                  <span className="ldt-conf-n ldt-num" aria-hidden="true" />
                </span>
              </li>
            ))}
          </ol>

          <div className="ldt-after ldt-ex-sec">
            <p className="ldt-ex-h">{c.summary}</p>
            <ol className="ldt-summary">
              {DOC.summary[lang].map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>
          <div className="ldt-after ldt-ex-sec ldt-ex-row">
            <p className="ldt-ex-h">{c.classification}</p>
            <span className="ldt-status ldt-status--opd">
              <i aria-hidden="true" />
              {DOC.classification[lang]}
            </span>
            {reviewCount > 0 && (
              <span className="ldt-faint ldt-ex-note">
                {reviewCount} {c.fields} · {c.check.toLowerCase()}
              </span>
            )}
          </div>
          <div className="ldt-after ldt-dispo">
            <p className="ldt-ex-h">{c.disposition}</p>
            <dl className="ldt-dl ldt-dl--tight">
              <div>
                <dt>{c.to}</dt>
                <dd>{DOC.disposition.to}</dd>
              </div>
              <div>
                <dt>{c.instruction}</dt>
                <dd>{DOC.disposition.instruction[lang]}</dd>
              </div>
              <div>
                <dt>{c.deadline}</dt>
                <dd className="ldt-num">{BOXES[3]?.value}</dd>
              </div>
            </dl>
            <div className="ldt-dispo-actions">
              {approved ? (
                <>
                  <span className="ldt-approved">
                    {Icon.check()}
                    {c.approved}
                  </span>
                  <button type="button" className="ldt-btn ldt-btn--ghost" onClick={() => unapprove()}>
                    {c.undo}
                  </button>
                </>
              ) : (
                <button type="button" className="ldt-btn ldt-btn--primary ldt-btn--lg" onClick={approve} disabled={!ready}>
                  {Icon.stamp()}
                  <span>{c.approve}</span>
                </button>
              )}
              <button type="button" className="ldt-btn ldt-btn--quiet" onClick={replay}>
                {Icon.replay()}
                <span>{c.replay}</span>
              </button>
            </div>
          </div>
          <p className="ldt-sr" aria-live="polite">
            {announce}
          </p>
        </div>
      </div>
    </section>
  )
}
