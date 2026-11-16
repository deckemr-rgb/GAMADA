/** 07 · Incoming letter in an original PaperFrame: OCR boxes one by one, extraction + confidence, approve → stamp. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useI18n } from '../../lib/i18n'
import { EASE } from '../../lib/motion'
import { DOC } from '../sample'
import { Icon } from './icons'
import { SJ, clock, fmtNum, motionMode, useEnter, useGsapContext } from './shared'

const C = {
  id: {
    scan: 'Pindaian surat masuk, halaman 1 dari 1',
    scanMeta: 'Pindaian · 1 hlm · 300 dpi',
    extraction: 'Hasil ekstraksi',
    conf: 'keyakinan',
    check: 'Periksa',
    summary: 'Ringkasan AI',
    class: 'Klasifikasi',
    disposition: 'Draf disposisi',
    to: 'Kepada',
    instruction: 'Instruksi',
    due: 'Tenggat',
    approve: 'Setujui disposisi',
    undo: 'Batalkan persetujuan',
    approved: 'Disetujui',
    approvedAt: 'Disetujui · diteruskan ke',
    announce: 'Disposisi disetujui dan diteruskan ke',
    stamp: 'DISETUJUI',
    stampSub: 'Disposisi',
    fieldHint: 'Arahkan ke kolom untuk melihat letaknya di surat.',
  },
  en: {
    scan: 'Scanned incoming letter, page 1 of 1',
    scanMeta: 'Scan · 1 page · 300 dpi',
    extraction: 'Extraction',
    conf: 'confidence',
    check: 'Review',
    summary: 'AI summary',
    class: 'Classification',
    disposition: 'Routing draft',
    to: 'To',
    instruction: 'Instruction',
    due: 'Due',
    approve: 'Approve routing',
    undo: 'Undo approval',
    approved: 'Approved',
    approvedAt: 'Approved · sent to',
    announce: 'Routing approved and sent to',
    stamp: 'APPROVED',
    stampSub: 'Routing',
    fieldHint: 'Point at a field to see where it sits on the letter.',
  },
} as const

const LOW = 0.85
/** Typed line (≈ 2.2 % of the page tall) centred inside its OCR box. */
const lineTop = (i: number): string => {
  const b = DOC.boxes[i]
  return b ? `${b.y + (b.h - 2.2) / 2}%` : '0%'
}

export default function LetterDoc() {
  const { lang } = useI18n()
  const c = C[lang]
  const mode = motionMode()
  const [active, setActive] = useState<number | null>(null)
  const [approved, setApproved] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLElement>(null)
  const paperRef = useRef<HTMLDivElement>(null)
  const ctx = useGsapContext(ref)
  const firstApprove = useRef(true)
  const refocus = useRef(false)
  useEffect(() => {
    if (!refocus.current) return
    refocus.current = false
    ref.current?.querySelector<HTMLButtonElement>('.lds-dispo-act button')?.focus()
  }, [approved])
  const setApproval = (v: boolean) => {
    refocus.current = true
    setApproved(v)
  }

  useLayoutEffect(() => {
    if (mode === 'static') return
    ctx.current?.add(() => {
      const r = ref.current
      if (!r) return
      const items = r.querySelectorAll('.lds-ocr, .lds-field, .lds-sum li')
      gsap.set(items, { opacity: 0 })
      if (mode === 'full') gsap.set(r.querySelectorAll('.lds-field'), { x: 8 })
    })
  }, [ctx, mode])

  useEnter(paperRef, () =>
    ctx.current?.add(() => {
      const r = ref.current
      if (!r) return
      if (mode === 'reduced') return gsap.to(r.querySelectorAll('.lds-ocr, .lds-field, .lds-sum li'), { opacity: 1, duration: SJ.fade })
      const tl = gsap.timeline()
      tl.fromTo(r.querySelector('.lds-scanline'), { yPercent: -100, opacity: 0 }, { yPercent: 560, opacity: 1, duration: SJ.screen, ease: 'power1.inOut' }, 0)
      tl.to(r.querySelector('.lds-scanline'), { opacity: 0, duration: 0.2 }, SJ.screen - 0.15)
      r.querySelectorAll('.lds-ocr').forEach((box, i) => {
        tl.fromTo(box, { opacity: 0, scale: 1.06 }, { opacity: 1, scale: 1, duration: SJ.panel, ease: EASE.out }, 0.25 + i * SJ.ocrStagger)
      })
      r.querySelectorAll('.lds-field').forEach((row, i) => {
        tl.to(row, { opacity: 1, x: 0, duration: SJ.panel, ease: EASE.out }, 0.32 + i * SJ.ocrStagger)
      })
      tl.to(r.querySelectorAll('.lds-sum li'), { opacity: 1, duration: SJ.panel, stagger: 0.08 }, 0.4 + DOC.boxes.length * SJ.ocrStagger)
    }),
  )

  // Stamp: drops from 1.7× onto the paper, the frame takes a 2 px knock, an ink ring spreads.
  useLayoutEffect(() => {
    const initial = firstApprove.current
    firstApprove.current = false
    if (initial || !approved) return
    ctx.current?.add(() => {
      const r = ref.current
      const stamp = r?.querySelector('.lds-stamp')
      if (!r || !stamp) return
      if (mode !== 'full') return gsap.fromTo(stamp, { opacity: 0 }, { opacity: 1, duration: SJ.fade })
      const tl = gsap.timeline()
      tl.fromTo(stamp, { opacity: 0, scale: 1.7, rotation: -4 }, { opacity: 1, scale: 1, rotation: -11, duration: SJ.panel, ease: 'power4.in' }, 0)
      tl.fromTo(frameRef.current, { y: 0 }, { y: 2, duration: 0.07, yoyo: true, repeat: 1, ease: 'power1.out' }, SJ.panel - 0.02)
      tl.fromTo(r.querySelector('.lds-stamp-ring'), { opacity: 0.5, scale: 0.7 }, { opacity: 0, scale: 1.35, duration: 0.5, ease: 'power2.out' }, SJ.panel - 0.02)
      tl.fromTo(r.querySelector('.lds-approved'), { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: SJ.press }, SJ.panel)
    })
  }, [approved, ctx, mode])

  const avg = DOC.boxes.reduce((s, b) => s + b.conf, 0) / DOC.boxes.length

  return (
    <div className="lds-docgrid" ref={ref}>
      <figure className="lds-paperframe" ref={frameRef}>
        <div className="lds-paper" ref={paperRef} style={{ transform: `rotate(${DOC.skewDeg}deg)` }} role="img" aria-label={`${c.scan}: ${DOC.title[lang]}`}>
          <div className="lds-paper-in" aria-hidden="true">
            <div className="lds-lh">
              <svg className="lds-lh-mark" viewBox="0 0 40 40">
                <circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <circle cx="20" cy="20" r="13.5" fill="none" stroke="currentColor" strokeWidth=".8" />
                <path d="M9 25l7-8 4 4.5 4-6.5 7 10Z" fill="currentColor" />
                <path d="M10 28.5c3-1.4 5-1.4 7 0s4 1.4 6 0 4-1.4 7 0" fill="none" stroke="currentColor" strokeWidth="1.1" />
              </svg>
              <div>
                <p className="lds-lh-1">PEMERINTAH KABUPATEN CONTOH</p>
                <p className="lds-lh-2">KECAMATAN TIRTAJAYA</p>
                <p className="lds-lh-3">Jl. Contoh Raya No. 1, Tirtajaya · Telp. (000) 000-000</p>
              </div>
            </div>
            <p className="lds-pl" style={{ left: '62%', top: lineTop(0) }}>
              Tirtajaya, {DOC.date}
            </p>
            <p className="lds-pl" style={{ left: '12.8%', top: lineTop(0) }}>
              Nomor&nbsp;&nbsp;: {DOC.number}
            </p>
            <p className="lds-pl" style={{ left: '12.8%', top: lineTop(1) }}>
              Dari&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: {DOC.from}
            </p>
            <p className="lds-pl" style={{ left: '12.8%', top: lineTop(2) }}>
              Perihal : <b>Permohonan bantuan 4 unit pompa air</b>
            </p>
            <div className="lds-pbody" style={{ left: '12%', top: '37%' }}>
              <p>Yth. Kepala Pelaksana BPBD Kabupaten Contoh, di tempat.</p>
              <p>
                Sehubungan dengan genangan setinggi rata-rata 40 cm yang melanda tiga kelurahan di wilayah kami sejak 17 November 2026 pagi, bersama ini kami
                mengajukan permohonan bantuan 4 (empat) unit pompa air beserta operatornya.
              </p>
              <p>Demikian permohonan ini kami sampaikan. Atas perhatian Bapak, kami ucapkan terima kasih.</p>
            </div>
            <p className="lds-pl" style={{ left: '12.8%', top: lineTop(3) }}>
              Tenggat : <b>19 November 2026</b>
            </p>
            <div className="lds-psign" style={{ left: '58%', top: '75%' }}>
              <p>Camat Tirtajaya,</p>
              <svg viewBox="0 0 120 34" className="lds-psig">
                <path d="M4 24c10-14 16-18 18-12s-6 14 2 10 12-16 18-12-4 12 4 10 10-10 16-8 4 6 10 4 14-6 22-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <p className="lds-psign-tte">Ditandatangani secara elektronik (TTE)</p>
              <p className="lds-psign-name">NAMA CAMAT CONTOH</p>
            </div>
            <p className="lds-pfoot">Dokumen contoh · fiktif</p>
          </div>

          {DOC.boxes.map((b, i) => (
            <span
              key={b.field.en}
              className={`lds-ocr${b.conf < LOW ? ' is-low' : ''}${active === i ? ' is-active' : ''}`}
              style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%` }}
              aria-hidden="true"
            >
              <span className="lds-ocr-tag">{Math.round(b.conf * 100)}%</span>
            </span>
          ))}

          {approved && (
            <span className="lds-stamp" aria-hidden="true">
              <span className="lds-stamp-ring" />
              <b>{c.stamp}</b>
              <span>
                {c.stampSub} → {DOC.disposition.to}
              </span>
              <span>17 · 11 · 2026</span>
            </span>
          )}
          <span className="lds-scanline" aria-hidden="true" />
        </div>
        <figcaption className="lds-paper-cap">
          <Icon name="doc" size={14} />
          {c.scanMeta} · {DOC.number}
        </figcaption>
      </figure>

      <div className="lds-panel lds-extract">
        <div className="lds-extract-head">
          <div>
            <p className="lds-label">{c.extraction}</p>
            <h3 className="lds-h3">{DOC.title[lang]}</h3>
          </div>
          <span className="lds-class">
            <span className="lds-label">{c.class}</span>
            <span className="lds-class-chip">{DOC.classification[lang]}</span>
          </span>
        </div>

        <ul className="lds-fields" onPointerLeave={() => setActive(null)}>
          {DOC.boxes.map((b, i) => {
            const pct = Math.round(b.conf * 100)
            return (
              <li key={b.field.en} className="lds-field">
                <button
                  type="button"
                  className={`lds-field-btn${active === i ? ' is-active' : ''}`}
                  aria-pressed={active === i}
                  onPointerEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onClick={() => setActive((a) => (a === i ? null : i))}
                >
                  <span className="lds-field-k">{b.field[lang]}</span>
                  <span className="lds-field-v">{b.value}</span>
                  <span className={`lds-conf${b.conf < LOW ? ' is-low' : ''}`}>
                    <span className="lds-conf-bar" aria-hidden="true">
                      <span style={{ transform: `scaleX(${b.conf})` }} />
                    </span>
                    <span className="lds-conf-n">
                      {pct}% <span className="lds-sr">{c.conf}</span>
                    </span>
                    {b.conf < LOW && <span className="lds-conf-flag">{c.check}</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <p className="lds-hint">
          {c.fieldHint} Ø {fmtNum(avg * 100, lang, 0)}% {c.conf}.
        </p>

        <div className="lds-sum">
          <p className="lds-label">
            <Icon name="sparkle" size={14} />
            {c.summary}
          </p>
          <ol>
            {DOC.summary[lang].map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>

        <div className={`lds-dispo${approved ? ' is-approved' : ''}`}>
          <p className="lds-label">
            <Icon name="route" size={14} />
            {c.disposition}
          </p>
          <dl>
            <div>
              <dt>{c.to}</dt>
              <dd>{DOC.disposition.to}</dd>
            </div>
            <div>
              <dt>{c.instruction}</dt>
              <dd>{DOC.disposition.instruction[lang]}</dd>
            </div>
            <div>
              <dt>{c.due}</dt>
              <dd>19 Nov 2026</dd>
            </div>
          </dl>
          <div className="lds-dispo-act">
            {approved ? (
              <>
                <span className="lds-approved">
                  <Icon name="check" size={16} />
                  {c.approvedAt} {DOC.disposition.to} · {clock(lang, '07:52')}
                </span>
                <button type="button" className="lds-btn is-ghost" onClick={() => setApproval(false)}>
                  {c.undo}
                </button>
              </>
            ) : (
              <button type="button" className="lds-btn is-primary" onClick={() => setApproval(true)}>
                <Icon name="stamp" size={16} />
                {c.approve}
              </button>
            )}
          </div>
          <p className="lds-sr" aria-live="polite">
            {approved ? `${c.announce} ${DOC.disposition.to}` : ''}
          </p>
        </div>
      </div>
    </div>
  )
}
