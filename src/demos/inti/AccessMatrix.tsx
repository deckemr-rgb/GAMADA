/**
 * AccessMatrix — role × product access (pure props, reusable by /ekosistem/inti in Tahap 6). Source: accessMatrix()
 * = PRODUCTS[].roles. Desktop: a grid with a sticky role column (the role names are buttons that preview a role);
 * the active role's checks animate in (opacity / scale) when it changes. A ✓ cell links to the product opened as
 * that role (READY targets only); a ✗ cell is disabled with its reason. `manage` (Sekretariat "Kelola peran"): the
 * cells toggle a preview. Compact (phones): one role's list of products.
 */
import AppLink from '../../components/AppLink'
import type { RoleId } from '../../content/products'

export interface MatrixProduct { slug: string; name: string; eco: string; code: string }
export interface AccessMatrixProps {
  roles: readonly RoleId[]
  products: readonly MatrixProduct[]
  allowed: (role: RoleId, slug: string) => boolean
  changed?: (role: RoleId, slug: string) => boolean
  active: RoleId
  onRole: (role: RoleId) => void
  manage: boolean
  onCell: (role: RoleId, slug: string) => void
  hrefOf: (role: RoleId, slug: string) => string | null
  roleName: (r: RoleId) => string
  compact: boolean
  labels: { matrix: string; role: string; yes: (p: string, r: string) => string; no: string; notReady: (p: string) => string; toggle: (p: string, r: string, on: boolean) => string; changed: string }
}

export function AccessMatrix(p: AccessMatrixProps) {
  const { roles, products, allowed, changed, active, onRole, manage, onCell, hrefOf, roleName, compact, labels } = p
  const cell = (r: RoleId, pr: MatrixProduct, list: boolean) => {
    const ok = allowed(r, pr.slug)
    const ch = !!changed?.(r, pr.slug)
    const mark = (
      <span className={`dk-in-chk${ok ? ' is-yes' : ' is-no'}`} aria-hidden="true">
        {ok ? '✓' : '✗'}
      </span>
    )
    const text = list ? <span className="dk-in-mx-name">{pr.name}</span> : null
    const cls = `dk-in-cell${ok ? ' is-yes' : ' is-no'}${ch ? ' is-changed' : ''}`
    if (manage)
      return (
        <button type="button" className={cls} aria-pressed={ok} data-cell={`${r}|${pr.slug}`} aria-label={labels.toggle(pr.name, roleName(r), ok) + (ch ? ` (${labels.changed})` : '')} onClick={() => onCell(r, pr.slug)}>
          {mark}
          {text}
        </button>
      )
    if (!ok)
      return (
        <span className={cls} role="img" aria-disabled="true" data-cell={`${r}|${pr.slug}`} aria-label={`${pr.name}: ${labels.no}`} title={labels.no}>
          {mark}
          {text}
          {list && <small className="dk-in-why">{labels.no}</small>}
        </span>
      )
    const href = hrefOf(r, pr.slug)
    return href ? (
      <AppLink className={cls} to={href} data-cell={`${r}|${pr.slug}`} aria-label={labels.yes(pr.name, roleName(r))} title={labels.yes(pr.name, roleName(r))}>
        {mark}
        {text}
      </AppLink>
    ) : (
      <span className={cls} role="img" data-cell={`${r}|${pr.slug}`} aria-label={`${pr.name}: ✓ · ${labels.notReady(pr.name)}`} title={labels.notReady(pr.name)}>
        {mark}
        {text}
        {list && <small className="dk-in-why">{labels.notReady(pr.name)}</small>}
      </span>
    )
  }

  if (compact)
    return (
      <ul className="dk-in-mxlist is-active" key={active} aria-label={`${labels.matrix} · ${roleName(active)}`} data-tour="in-matrix" data-in="matrix">
        {products.map((pr) => (
          <li key={pr.slug} data-eco={pr.eco}>
            {cell(active, pr, true)}
          </li>
        ))}
      </ul>
    )

  return (
    <div className="dk-in-mxwrap" data-tour="in-matrix" data-in="matrix">
      <table className="dk-in-mx" aria-label={labels.matrix}>
        <thead>
          <tr>
            <th scope="col" className="dk-in-mx-corner">
              {labels.role}
            </th>
            {products.map((pr) => (
              <th key={pr.slug} scope="col" data-eco={pr.eco} title={pr.name}>
                <span className="dk-in-mx-ph">{pr.name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {roles.map((r) => (
            <tr key={r === active ? `${r}-on` : r} className={r === active ? 'is-active' : undefined} data-role={r}>
              <th scope="row">
                <button type="button" className="dk-in-mx-role" aria-pressed={r === active} onClick={() => onRole(r)}>
                  {roleName(r)}
                </button>
              </th>
              {products.map((pr) => (
                <td key={pr.slug} data-eco={pr.eco}>
                  {cell(r, pr, false)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
