/**
 * TextDiff — word-level diff of two texts ("Sebelum" template vs "Sesudah AI"): `inline` marks removed words <del>
 * and added words <ins> in one flow; `split` shows both columns. LCS over words (whitespace kept), no dependency.
 */
import { useMemo } from 'react'
import { useI18n } from '../../lib/i18n'
import { diffWords } from './diff'
import './textdiff.css'

export { diffWords, type DiffPart } from './diff'

type Bi = { id: string; en: string }

export interface TextDiffProps {
  before: string
  after: string
  mode?: 'inline' | 'split'
  label: Bi | string
  className?: string
}
export function TextDiff({ before, after, mode = 'inline', label, className }: TextDiffProps) {
  const { lang } = useI18n()
  const parts = useMemo(() => diffWords(before, after), [before, after])
  const name = typeof label === 'string' ? label : label[lang]
  const T = lang === 'id' ? { before: 'Sebelum', after: 'Sesudah', del: 'dihapus', add: 'ditambah' } : { before: 'Before', after: 'After', del: 'removed', add: 'added' }
  const render = (keep: 'add' | 'del' | 'both') =>
    parts.map((p, i) => {
      if (p.t === 'same') return <span key={i}>{p.s}</span>
      if (p.t === 'add' && keep !== 'del')
        return (
          <ins key={i}>
            <span className="dk-sr">{T.add}: </span>
            {p.s}
          </ins>
        )
      if (p.t === 'del' && keep !== 'add')
        return (
          <del key={i}>
            <span className="dk-sr">{T.del}: </span>
            {p.s}
          </del>
        )
      return null
    })
  if (mode === 'split')
    return (
      <figure className={`dk-diff is-split${className ? ` ${className}` : ''}`} aria-label={name}>
        <div>
          <figcaption>{T.before}</figcaption>
          <p>{render('del')}</p>
        </div>
        <div>
          <figcaption>{T.after}</figcaption>
          <p>{render('add')}</p>
        </div>
      </figure>
    )
  return (
    <figure className={`dk-diff${className ? ` ${className}` : ''}`} aria-label={name}>
      <p>{render('both')}</p>
    </figure>
  )
}
