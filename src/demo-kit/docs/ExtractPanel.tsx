/**
 * ExtractPanel — extracted fields (numbered like the OCR boxes) with confidence bars, the consistency checks and
 * the result badge Lengkap / Kurang / Perlu Cek Manual with its reasons. Rows appear as `revealed` grows (sync with
 * DocViewer.onReveal); checks + verdict appear once every field is in.
 */
import { useEffect, useRef } from 'react'
import type { Extracted, ExtractedField } from '../ai/types'
import { useI18n } from '../../lib/i18n'
import { Icon } from '../ui/icons'
import { dropChips, flashNewRow } from '../ui/motion'
import { DOCS } from './DocViewer'
import { verdictOf, type Verdict, type VerdictResult } from './extract'
import { longDate } from './nik'
import { fieldKind, presenceText } from './values'
import './docs.css'

export interface ExtractPanelProps {
  extracted: Extracted | null
  /** number of fields shown (default: all) */
  revealed?: number
  /** "reading…" skeleton */
  loading?: boolean
  activeKey?: string | null
  onFieldFocus?: (key: string | null) => void
  title?: string
  showChecks?: boolean
  showVerdict?: boolean
  /** override the computed verdict */
  verdict?: VerdictResult
  /**
   * text while nothing is read yet (default "Pilih dokumen untuk mulai membaca."). When a document is already on
   * screen, name the action instead, e.g. readPrompt('Baca surat', lang) → "Tekan “Baca surat” untuk mulai membaca."
   */
  emptyText?: string
  className?: string
}

/** "Press “<action>” to start reading." — the empty-state prompt once a document is shown but not read yet */
export function readPrompt(action: string, lang: 'id' | 'en'): string {
  return lang === 'id' ? `Tekan “${action}” untuk mulai membaca.` : `Press “${action}” to start reading.`
}

export const VERDICT_LABEL: Record<Verdict, { id: string; en: string }> = {
  lengkap: { id: 'Lengkap', en: 'Complete' },
  kurang: { id: 'Kurang', en: 'Incomplete' },
  'cek-manual': { id: 'Perlu Cek Manual', en: 'Needs manual check' },
}

const S = {
  id: { title: 'Hasil ekstraksi', fields: 'Isian terbaca', checks: 'Cek konsistensi', reading: 'Membaca dokumen…', of: 'dari', sim: 'Simulasi', live: 'Live', low: 'periksa', conf: 'keyakinan', result: 'Hasil verifikasi', empty: 'Pilih dokumen untuk mulai membaca.' },
  en: { title: 'Extraction result', fields: 'Fields read', checks: 'Consistency checks', reading: 'Reading the document…', of: 'of', sim: 'Simulation', live: 'Live', low: 'check', conf: 'confidence', result: 'Verification result', empty: 'Pick a document to start reading.' },
}

/**
 * ISO dates read as dates; Rupiah ONLY for amount fields (field.kind 'amount', or an amount key such as total /
 * bayar / saldo / modal), so postcodes, KBLI codes, RT/RW, years, NIK and account numbers stay verbatim;
 * presence values (ada / tidak ada) in the UI language.
 */
function showValue(f: ExtractedField, lang: 'id' | 'en'): string {
  const v = f.value
  const kind = fieldKind(f.key, v, f.kind)
  if (kind === 'presence') return presenceText(v, lang)
  if (kind === 'amount' && /^\d+$/.test(v)) return `Rp ${Number(v).toLocaleString('id-ID')}`
  const m = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?$/.exec(v)
  if (!m || !m[1]) return v
  return m[2] ? `${longDate(m[1], lang)} ${m[2]}` : longDate(m[1], lang)
}

const STATUS_ICON = { ok: 'check', warn: 'alert', fail: 'close' } as const

export function ExtractPanel({ extracted, revealed, loading, activeKey, onFieldFocus, title, showChecks = true, showVerdict = true, verdict, emptyText, className }: ExtractPanelProps) {
  const { lang } = useI18n()
  const s = S[lang]
  const fields = extracted?.fields ?? []
  const n = Math.min(revealed ?? fields.length, fields.length)
  const done = !!extracted && n >= fields.length
  const v = verdict ?? (extracted ? verdictOf(extracted) : null)
  const listRef = useRef<HTMLOListElement>(null)
  const checksRef = useRef<HTMLUListElement>(null)
  const lastN = useRef(0)

  // new rows slide in with the accent flash
  useEffect(() => {
    const ol = listRef.current
    if (!ol) return
    const kills: (() => void)[] = []
    if (n > lastN.current && n - lastN.current <= 3) {
      for (let i = lastN.current; i < n; i++) {
        const li = ol.children[i] as HTMLElement | undefined
        if (li) kills.push(flashNewRow(li))
      }
    }
    lastN.current = n
    return () => kills.forEach((k) => k())
  }, [n])
  useEffect(() => {
    lastN.current = 0
  }, [extracted])
  useEffect(() => {
    if (done && showChecks && checksRef.current) return dropChips(checksRef.current)
  }, [done, showChecks, extracted])

  return (
    <section className={`dk-xp${className ? ` ${className}` : ''}`} aria-label={title ?? s.title}>
      <header className="dk-xp-head">
        <h3 className="dk-xp-title">{title ?? s.title}</h3>
        {extracted && <span className="dk-xp-mode">{extracted.mode === 'live' ? s.live : s.sim}</span>}
        <span className="dk-xp-count dk-num">{loading ? s.reading : extracted ? `${n} ${s.of} ${fields.length}` : ''}</span>
        {/* announced twice only: when reading starts and with the final count (not every revealed field) */}
        <span className="dk-sr" aria-live="polite">
          {loading || (extracted && !done) ? s.reading : done ? `${s.fields}: ${fields.length}` : ''}
        </span>
      </header>

      {!extracted && !loading && <p className="dk-xp-empty">{emptyText ?? s.empty}</p>}
      {loading && (
        <div className="dk-xp-skel" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} />
          ))}
        </div>
      )}

      {extracted && (
        <ol ref={listRef} className="dk-xp-fields" aria-label={s.fields}>
          {fields.slice(0, n).map((f, i) => {
            const low = f.confidence < DOCS.lowConfidence
            const pctv = Math.round(f.confidence * 100)
            return (
              <li key={f.key} className={`dk-xp-row${activeKey === f.key ? ' is-active' : ''}${low ? ' is-low' : ''}`}>
                <button
                  type="button"
                  className="dk-xp-rowbtn"
                  onPointerEnter={() => onFieldFocus?.(f.key)}
                  onPointerLeave={() => onFieldFocus?.(null)}
                  onFocus={() => onFieldFocus?.(f.key)}
                  onBlur={() => onFieldFocus?.(null)}
                  aria-label={`${i + 1}. ${f.label[lang]}: ${showValue(f, lang)}, ${s.conf} ${pctv}%${low ? ` (${s.low})` : ''}`}
                >
                  <span className="dk-xp-mark dk-num" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="dk-xp-label">{f.label[lang]}</span>
                  <span className="dk-xp-value">{showValue(f, lang)}</span>
                  <span className="dk-xp-conf" aria-hidden="true">
                    <span className="dk-xp-bar">
                      <i style={{ transform: `scaleX(${f.confidence})` }} />
                    </span>
                    <span className="dk-num">{pctv}%</span>
                    {low && <span className="dk-xp-lowtag">{s.low}</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      )}

      {extracted && done && showChecks && !!extracted.checks?.length && (
        <div className="dk-xp-checks">
          <h4 className="dk-xp-sub">{s.checks}</h4>
          <ul ref={checksRef}>
            {extracted.checks.map((c) => (
              <li key={c.id} className={`dk-xp-check is-${c.status}`}>
                <span className="dk-xp-ci" aria-hidden="true">
                  <Icon name={STATUS_ICON[c.status]} size={14} strokeWidth={2} />
                </span>
                <span className="dk-xp-cl">
                  <span>
                    <span className="dk-sr">{c.status === 'ok' ? 'OK: ' : c.status === 'warn' ? (lang === 'id' ? 'Perhatian: ' : 'Warning: ') : lang === 'id' ? 'Gagal: ' : 'Failed: '}</span>
                    {c.label[lang]}
                  </span>
                  {c.note && <small>{c.note}</small>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {extracted && done && showVerdict && v && (
        <div className={`dk-xp-verdict is-${v.verdict}`} role="status">
          <span className="dk-xp-vlabel">{s.result}</span>
          <span className="dk-xp-vbadge">
            <Icon name={v.verdict === 'lengkap' ? 'check' : v.verdict === 'kurang' ? 'info' : 'alert'} size={16} strokeWidth={2} />
            {VERDICT_LABEL[v.verdict][lang]}
          </span>
          {v.reasons.length > 0 && (
            <ul className="dk-xp-reasons">
              {v.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
