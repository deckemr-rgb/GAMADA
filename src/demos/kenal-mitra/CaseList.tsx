/**
 * CaseList — the requests of one lane (open first, priority first; closed today after) as a side list on desktop and a
 * select on phones. Shared by the KYC and KYB tabs (lazy chunk).
 */
import type { KeyboardEvent } from 'react'
import { Icon, Select } from '../../demo-kit/ui'
import { subjectName } from '../../demo-kit/world/usaha-pintar'
import { useWorld, type VerificationRequest } from '../../demo-kit/world'
import { useCaseStr } from './strings-case'

export function CaseList({ cases, cur, onPick, sm }: { cases: VerificationRequest[]; cur: string | null; onPick: (id: string) => void; sm: boolean }) {
  const { c } = useCaseStr()
  const names = useWorld((s) => cases.map((r) => subjectName(s, r)).join('\u0001'))
  const nameOf = (i: number) => names.split('\u0001')[i] ?? ''
  if (!cases.length) return <p className="dk-km-empty">{c.noCases}</p>
  if (sm)
    return (
      <label className="dk-km-casepick">
        <span>{c.pickCase}</span>
        <Select
          value={cur ?? ''}
          onChange={(e) => onPick(e.target.value)}
          options={cases.map((r, i) => ({ value: r.id, label: `${r.code} · ${nameOf(i)}${r.status === 'selesai' ? ` · ${c.done}` : ''}` }))}
          aria-label={c.pickCase}
        />
      </label>
    )
  const onKey = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const btns = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button')]
    const i = btns.indexOf(document.activeElement as HTMLButtonElement)
    const n = btns[(i + (e.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length]
    if (n) {
      e.preventDefault()
      n.focus()
    }
  }
  return (
    <nav className="dk-km-cases" aria-label={c.cases}>
      <ul onKeyDown={onKey}>
        {cases.map((r, i) => (
          <li key={r.id}>
            <button type="button" className={`dk-km-case-btn${r.id === cur ? ' is-on' : ''}${r.status === 'selesai' ? ' is-done' : ''}`} aria-current={r.id === cur ? 'true' : undefined} data-case={r.id} onClick={() => onPick(r.id)}>
              <span className="dk-km-code dk-num">{r.code}</span>
              <b>{nameOf(i)}</b>
              <span className="dk-km-case-st">
                {r.priority && r.status !== 'selesai' && <Icon name="flag" size={12} />}
                {r.status === 'selesai' ? c.done : c.open}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
