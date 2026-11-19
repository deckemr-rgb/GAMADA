/**
 * Inti ID (lazy) — one demo account ("Akun demo GAMADA", no personal name), the role being previewed (?as=), this
 * session's role history and the AccessMatrix (= PRODUCTS[].roles). Sekretariat: "Kelola peran" toggles cells as a
 * PREVIEW only (badge "pratinjau, tidak menyimpan ke produk", Reset); no other product changes.
 */
import { useMemo, useState } from 'react'
import { Picker, useShell } from '../../demo-kit/shell'
import { Badge, Button, Icon } from '../../demo-kit/ui'
import { accessMatrix } from '../../demo-kit/world/inti'
import { ROLES, type RoleId } from '../../content/products'
import { AccessMatrix, type MatrixProduct } from './AccessMatrix'
import { PRODUCTS17, canLink, ecoOfRole, hrefTo } from './model'
import { useT, type Lang } from './strings'

const S = {
  id: {
    account: 'Akun demo GAMADA',
    accountSub: 'Satu akun, banyak peran. Pejabat hanya disebut dengan jabatannya.',
    previewing: 'Pratinjau peran',
    sessionRole: (r: string) => `Peran sesi di bilah atas: ${r}`,
    history: 'Riwayat peran sesi ini',
    noHistory: 'Belum ada peran lain yang dipratinjau.',
    count: (r: string, n: number, of: number) => `${r}: akses ke ${n} dari ${of} produk`,
    pick: 'Pilih peran untuk pratinjau',
    matrix: 'Matriks hak akses peran × produk',
    role: 'Peran',
    yes: (p: string, r: string) => `Buka ${p} sebagai ${r}`,
    no: 'Peran ini tidak punya akses',
    notReady: (p: string) => `${p} belum dibuka untuk umum`,
    toggle: (p: string, r: string, on: boolean) => `${p} untuk ${r}: ${on ? 'diizinkan' : 'tidak diizinkan'} (ketuk untuk mengubah pratinjau)`,
    changed: 'diubah di pratinjau',
    manage: 'Kelola peran',
    manageOff: 'Selesai mengelola',
    previewBadge: 'pratinjau, tidak menyimpan ke produk',
    reset: 'Reset pratinjau',
    resetWhy: 'Belum ada sel yang diubah',
    changes: (n: number) => `${n} sel diubah di pratinjau`,
    source: 'Sumber: definisi peran tiap produk (17 produk, 25 peran)',
  },
  en: {
    account: 'GAMADA demo account',
    accountSub: 'One account, many roles. Officials are named by title only.',
    previewing: 'Previewing role',
    sessionRole: (r: string) => `Session role in the top bar: ${r}`,
    history: 'Roles this session',
    noHistory: 'No other role previewed yet.',
    count: (r: string, n: number, of: number) => `${r}: access to ${n} of ${of} products`,
    pick: 'Pick a role to preview',
    matrix: 'Access matrix role × product',
    role: 'Role',
    yes: (p: string, r: string) => `Open ${p} as ${r}`,
    no: 'This role has no access',
    notReady: (p: string) => `${p} is not public yet`,
    toggle: (p: string, r: string, on: boolean) => `${p} for ${r}: ${on ? 'allowed' : 'not allowed'} (tap to change the preview)`,
    changed: 'changed in the preview',
    manage: 'Manage roles',
    manageOff: 'Done managing',
    previewBadge: 'preview, not saved to the products',
    reset: 'Reset preview',
    resetWhy: 'No cell changed yet',
    changes: (n: number) => `${n} cells changed in the preview`,
    source: 'Source: each product’s role definitions (17 products, 25 roles)',
  },
}

const M = accessMatrix()
const ROLE_IDS = Object.keys(ROLES) as RoleId[]
const HKEY = 'gamada:in:roles'
let history: RoleId[] | null = null
function loadHistory(): RoleId[] {
  if (history) return history
  try {
    history = (JSON.parse(sessionStorage.getItem(HKEY) ?? '[]') as RoleId[]).filter((r) => r in ROLES)
  } catch {
    history = []
  }
  return history
}
function pushHistory(r: RoleId): RoleId[] {
  history = [r, ...loadHistory().filter((x) => x !== r)].slice(0, 6)
  try {
    sessionStorage.setItem(HKEY, JSON.stringify(history))
  } catch {
    /* memory only */
  }
  return history
}

export default function IdTab({ role, as, setAs }: { role: RoleId; as: RoleId; setAs: (r: RoleId) => void }) {
  const { lang } = useT()
  const L = S[lang as Lang]
  const shell = useShell()
  const compact = shell.size === 'sm'
  const [hist, setHist] = useState<RoleId[]>(() => (loadHistory().includes(as) ? loadHistory() : pushHistory(as)))
  const [manage, setManage] = useState(false)
  const [over, setOver] = useState<ReadonlyMap<string, boolean>>(() => new Map())
  const sek = role === 'sekretariat'
  const name = (r: RoleId) => ROLES[r].name[lang as Lang]
  const products = useMemo<MatrixProduct[]>(() => PRODUCTS17.map((p) => ({ slug: p.slug, name: p.name, eco: p.eco, code: p.code })), [])
  const allowed = (r: RoleId, slug: string) => {
    const k = `${r}|${slug}`
    return over.has(k) ? !!over.get(k) : M.allowed(r, slug as never)
  }
  const preview = (r: RoleId) => {
    if (r === as) return
    if (ecoOfRole(r) !== ecoOfRole(as)) shell.markMission('peran')
    setAs(r)
    setHist(pushHistory(r))
  }
  const n = products.filter((p) => allowed(as, p.slug)).length

  return (
    <div className="dk-in-idtab">
      <div className="dk-in-idhead">
        <section className="dk-in-box dk-in-account" aria-labelledby="dk-in-acc-h">
          <div className="dk-in-acc-top">
            <span className="dk-in-avatar" aria-hidden="true">
              <Icon name="user" size={20} />
            </span>
            <div>
              <h2 id="dk-in-acc-h" className="dk-in-h">
                {L.account}
              </h2>
              <p className="dk-in-muted">{L.accountSub}</p>
            </div>
          </div>
          <p className="dk-in-muted">{L.sessionRole(name(role))}</p>
          <div className="dk-in-asrow">
            <span className="dk-in-muted">{L.previewing}:</span>
            <Picker label={L.pick} value={as} onChange={(v) => preview(v as RoleId)} options={ROLE_IDS.map((r) => ({ value: r, label: name(r) }))} heading={L.pick} className="dk-in-aspick">
              <span className="dk-in-ascur" data-in="as-role">
                {name(as)}
              </span>
            </Picker>
          </div>
          <p className="dk-in-count" data-in="as-count">
            {L.count(name(as), n, products.length)}
          </p>
          <div className="dk-in-hist">
            <span className="dk-in-muted">{L.history}</span>
            {hist.length > 1 ? (
              <div className="dk-in-histlist">
                {hist.map((r) => (
                  <button key={r} type="button" className={`dk-in-root${r === as ? ' is-on' : ''}`} aria-pressed={r === as} onClick={() => preview(r)}>
                    <span>{name(r)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="dk-in-muted">{L.noHistory}</p>
            )}
          </div>
        </section>
        {sek && (
          <section className="dk-in-box dk-in-manage">
            <div className="dk-in-manage-row">
              <Button variant={manage ? 'primary' : 'secondary'} icon="settings" aria-pressed={manage} data-in="manage" onClick={() => setManage((v) => !v)}>
                {manage ? L.manageOff : L.manage}
              </Button>
              <Badge tone="warn">{L.previewBadge}</Badge>
            </div>
            <p className="dk-in-muted" data-in="changes">
              {over.size ? L.changes(over.size) : L.resetWhy}
            </p>
            <Button variant="ghost" icon="reset" disabled={!over.size} data-in="manage-reset" onClick={() => setOver(new Map())}>
              {L.reset}
            </Button>
          </section>
        )}
      </div>
      <section className="dk-in-box">
        <p className="dk-in-muted dk-in-src">{L.source}</p>
        <AccessMatrix
          roles={ROLE_IDS}
          products={products}
          allowed={allowed}
          changed={(r, slug) => over.has(`${r}|${slug}`)}
          active={as}
          onRole={preview}
          manage={sek && manage}
          onCell={(r, slug) => {
            const k = `${r}|${slug}`
            const next = new Map(over)
            const base = M.allowed(r, slug as never)
            const cur = next.has(k) ? !!next.get(k) : base
            if (!cur === base) next.delete(k)
            else next.set(k, !cur)
            setOver(next)
          }}
          hrefOf={(r, slug) => (M.allowed(r, slug as never) && canLink(slug as never) ? hrefTo(slug as never, { role: r }) : null)}
          roleName={name}
          compact={compact}
          labels={{ matrix: L.matrix, role: L.role, yes: L.yes, no: L.no, notReady: L.notReady, toggle: L.toggle, changed: L.changed }}
        />
      </section>
    </div>
  )
}
