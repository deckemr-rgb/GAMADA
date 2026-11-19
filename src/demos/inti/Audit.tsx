/**
 * Audit Log (lazy) — every world event (auditQuery): filters product / ecosystem / type / actor / text / time (in a
 * Drawer on phones), the table (cards < 640 px), "Ekspor CSV" / "Ekspor JSON" of exactly the filtered rows
 * (auditCsv / auditJson, file audit-gamada-<region>-<HHMM>.csv). Sekretariat sees the actor column first.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useShell } from '../../demo-kit/shell'
import { Button, Drawer, Field, Input, Segmented, Select, Table, flashNewRow, type TableColumn } from '../../demo-kit/ui'
import { hhmm, useClock, useWorld, type WorldState } from '../../demo-kit/world'
import { auditCsv, auditJson, auditQuery, type Actor, type AuditRow, type Scope } from '../../demo-kit/world/inti'
import type { EcoOrInti, ProductSlug, RoleId } from '../../content/products'
import { PRODUCTS17, day0, download, productName, type AuditUiFilter } from './model'
import { tm, useT, type Lang } from './strings'


const S = {
  id: {
    table: 'Audit Log GAMADA',
    count: (n: number) => `${n.toLocaleString('id-ID')} baris sesuai filter`,
    today: (n: number) => `Hari ini tanpa filter: ${n.toLocaleString('id-ID')} kejadian`,
    filters: 'Filter',
    filterBtn: (n: number) => (n ? `Filter (${n})` : 'Filter'),
    product: 'Produk',
    eco: 'Ekosistem',
    type: 'Jenis',
    actor: 'Aktor',
    q: 'Cari teks atau ID',
    when: 'Waktu',
    whens: { hari: 'Hari ini', semua: 'Semua' },
    all: 'Semua',
    actors: { user: 'Pengguna', clock: 'Jam dunia', tour: 'Tur', reaction: 'Reaksi otomatis' } as Record<Actor, string>,
    ecos: { 'satu-daerah': 'Satu Daerah', 'usaha-pintar': 'Usaha Pintar', 'pasar-daerah': 'Pasar Daerah', inti: 'Inti' } as Record<string, string>,
    csv: 'Ekspor CSV',
    json: 'Ekspor JSON',
    noRows: 'Tidak ada baris untuk diekspor',
    clear: 'Hapus filter',
    none: 'Tidak ada kejadian dengan filter ini.',
    cols: { at: 'Waktu', product: 'Produk', actor: 'Aktor', type: 'Jenis', summary: 'Ringkasan', id: 'ID' },
    system: 'Sistem',
    done: 'Selesai',
    exported: (n: number, f: string) => `${n} baris diekspor ke ${f}`,
  },
  en: {
    table: 'GAMADA Audit Log',
    count: (n: number) => `${n.toLocaleString('en-GB')} rows match the filter`,
    today: (n: number) => `Today without filters: ${n.toLocaleString('en-GB')} events`,
    filters: 'Filters',
    filterBtn: (n: number) => (n ? `Filters (${n})` : 'Filters'),
    product: 'Product',
    eco: 'Ecosystem',
    type: 'Type',
    actor: 'Actor',
    q: 'Search text or ID',
    when: 'Time',
    whens: { hari: 'Today', semua: 'All' },
    all: 'All',
    actors: { user: 'User', clock: 'World clock', tour: 'Tour', reaction: 'Automatic reaction' } as Record<Actor, string>,
    ecos: { 'satu-daerah': 'Satu Daerah', 'usaha-pintar': 'Usaha Pintar', 'pasar-daerah': 'Pasar Daerah', inti: 'Inti' } as Record<string, string>,
    csv: 'Export CSV',
    json: 'Export JSON',
    noRows: 'No rows to export',
    clear: 'Clear filters',
    none: 'No event matches these filters.',
    cols: { at: 'Time', product: 'Product', actor: 'Actor', type: 'Type', summary: 'Summary', id: 'ID' },
    system: 'System',
    done: 'Done',
    exported: (n: number, f: string) => `${n} rows exported to ${f}`,
  },
}
const all = (s: WorldState) => s

export default function Audit({ scope, role, filter, setFilter, flashId }: { scope: Scope; role: RoleId; filter: AuditUiFilter; setFilter: (f: AuditUiFilter) => void; flashId: string | null }) {
  const { lang } = useT()
  const L = S[lang as Lang]
  const shell = useShell()
  const s = useWorld(all)
  const now = useClock().minutes
  const sm = shell.size === 'sm'
  const [sheet, setSheet] = useState(false)
  const [said, setSaid] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  const list = useMemo(
    () =>
      auditQuery(s, {
        scope,
        ...(filter.product ? { product: filter.product } : {}),
        ...(filter.eco ? { eco: filter.eco } : {}),
        ...(filter.type ? { type: filter.type as never } : {}),
        ...(filter.actor ? { actor: filter.actor } : {}),
        ...(filter.q ? { q: filter.q } : {}),
        ...(filter.when === 'hari' ? { from: day0(now), to: now } : { to: now }),
      }),
    [s, now, scope, filter],
  )
  const todayAll = useMemo(() => auditQuery(s, { scope, from: day0(now), to: now }).length, [s, now, scope])
  const types = useMemo(() => [...new Set(auditQuery(s, { scope, to: now }).map((r) => r.type))].sort(), [s, now, scope])
  const active = (['product', 'eco', 'type', 'actor', 'q'] as const).filter((k) => filter[k]).length

  // a ?focus=AU-… arrival: the row is the only match of the search; flash it once
  useEffect(() => {
    if (!flashId) return
    const t = window.setTimeout(() => {
      const el = rootRef.current?.querySelector<HTMLElement>(`[data-audit-id="${CSS.escape(flashId)}"]`)
      const row = el?.closest<HTMLElement>('[role="row"], .dk-table-card, li') ?? el
      if (row) {
        row.scrollIntoView({ block: 'nearest' })
        flashNewRow(row)
      }
    }, 120)
    return () => window.clearTimeout(t)
  }, [flashId])

  const cols: TableColumn<AuditRow>[] = useMemo(() => {
    const actor: TableColumn<AuditRow> = { id: 'actor', header: L.cols.actor, value: (r) => L.actors[r.actor], width: 118 }
    const base: TableColumn<AuditRow>[] = [
      { id: 'at', header: L.cols.at, value: (r) => r.at, cell: (r) => <time className="dk-num">{tm(hhmm(r.at), lang as Lang)}</time>, width: 64, card: 'meta' },
      { id: 'product', header: L.cols.product, value: (r) => (r.product ? productName(r.product) : L.system), width: 118 },
      { id: 'type', header: L.cols.type, value: (r) => r.type, cell: (r) => <code className="dk-in-type">{r.type}</code>, width: 150 },
      {
        id: 'summary',
        header: L.cols.summary,
        value: (r) => r.summary[lang as Lang],
        cell: (r) => (
          <span data-audit-id={r.id} title={`${r.id} · ${r.summary[lang as Lang]}`}>
            {r.summary[lang as Lang]}
          </span>
        ),
        grow: 3,
        min: 220,
        card: 'title',
        sortable: false,
      },
    ]
    return role === 'sekretariat' ? [actor, ...base] : [base[0]!, base[1]!, actor, ...base.slice(2)]
  }, [L, lang, role])

  const stamp = hhmm(now).replace(':', '')
  const exp = (kind: 'csv' | 'json') => {
    if (!list.length) return
    const f = `audit-gamada-${s.regionId ?? 'daerah'}-${stamp}.${kind}`
    download(f, kind === 'csv' ? auditCsv(list, lang as Lang) : auditJson(list), kind === 'csv' ? 'text/csv;charset=utf-8' : 'application/json')
    setSaid(L.exported(list.length, f))
    shell.markMission('audit')
  }

  const controls = (
    <div className={`dk-in-afilters${sm ? ' is-sheet' : ''}`}>
      <Field label={L.q}>{(ids) => <Input {...ids} icon="search" value={filter.q} data-in="audit-q" onChange={(e) => setFilter({ ...filter, q: e.currentTarget.value })} />}</Field>
      <Field label={L.product}>
        {(ids) => (
          <Select {...ids} value={filter.product} data-in="audit-product" onChange={(e) => setFilter({ ...filter, product: e.currentTarget.value as ProductSlug | '' })} options={[{ value: '', label: L.all }, ...PRODUCTS17.map((p) => ({ value: p.slug, label: p.name }))]} />
        )}
      </Field>
      <Field label={L.eco}>
        {(ids) => (
          <Select {...ids} value={filter.eco} onChange={(e) => setFilter({ ...filter, eco: e.currentTarget.value as EcoOrInti | '' })} options={[{ value: '', label: L.all }, ...(['satu-daerah', 'usaha-pintar', 'pasar-daerah'] as const).map((e) => ({ value: e, label: L.ecos[e]! }))]} />
        )}
      </Field>
      <Field label={L.type}>{(ids) => <Select {...ids} value={filter.type} onChange={(e) => setFilter({ ...filter, type: e.currentTarget.value })} options={[{ value: '', label: L.all }, ...types.map((t) => ({ value: t, label: t }))]} />}</Field>
      <Field label={L.actor}>
        {(ids) => (
          <Select {...ids} value={filter.actor} onChange={(e) => setFilter({ ...filter, actor: e.currentTarget.value as Actor | '' })} options={[{ value: '', label: L.all }, ...(['user', 'clock', 'reaction', 'tour'] as const).map((a) => ({ value: a, label: L.actors[a] }))]} />
        )}
      </Field>
      <Segmented size="sm" label={L.when} value={filter.when} onChange={(v) => setFilter({ ...filter, when: v })} options={(['hari', 'semua'] as const).map((k) => ({ value: k, label: L.whens[k] }))} />
      <Button size="sm" variant="ghost" icon="reset" disabled={!active && filter.when === 'hari'} data-in="audit-clear" onClick={() => setFilter({ ...filter, product: '', eco: '', type: '', actor: '', q: '', when: 'hari' })}>
        {L.clear}
      </Button>
    </div>
  )

  return (
    <div className="dk-in-audit" ref={rootRef} data-tour="in-audit">
      <div className="dk-in-abar">
        <div>
          <p className="dk-in-status" data-in="audit-count" data-n={list.length}>
            {L.count(list.length)}
          </p>
          <p className="dk-in-muted" data-in="audit-today" data-n={todayAll}>
            {L.today(todayAll)}
          </p>
        </div>
        <div className="dk-in-aact">
          {sm && (
            <Button size="sm" variant="secondary" icon="filter" aria-haspopup="dialog" data-in="audit-filters" onClick={() => setSheet(true)}>
              {L.filterBtn(active)}
            </Button>
          )}
          <Button size="sm" variant="primary" icon="download" disabled={!list.length} title={list.length ? undefined : L.noRows} data-in="export-csv" onClick={() => exp('csv')}>
            {L.csv}
          </Button>
          <Button size="sm" variant="secondary" icon="download" disabled={!list.length} title={list.length ? undefined : L.noRows} data-in="export-json" onClick={() => exp('json')}>
            {L.json}
          </Button>
        </div>
      </div>
      <p className="dk-sr" role="status" aria-live="polite">
        {said}
      </p>
      {!sm && controls}
      <Table rows={list} columns={cols} rowId={(r) => r.id} label={L.table} activeId={flashId} densityToggle={false} height={520} highlightNew={false} empty={<p className="dk-in-muted">{L.none}</p>} />
      {sm && (
        <Drawer open={sheet} onClose={() => setSheet(false)} title={L.filters} footer={<Button variant="primary" onClick={() => setSheet(false)}>{L.done}</Button>}>
          {controls}
        </Drawer>
      )}
    </div>
  )
}
