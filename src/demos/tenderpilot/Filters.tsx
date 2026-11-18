/**
 * Filters.tsx — KBLI · lokasi · nilai · tenggat for the feed (`tenderFeed` filters); every option shows its count.
 * Inline above the feed on wide screens, inside a bottom Drawer on phones.
 */
import { Field, Select } from '../../demo-kit/ui'
import type { FeedFilters } from '../../demo-kit/world/usaha-pintar'
import type { Strings } from './strings'

export interface FeedCounts { kbli: number; kecamatan: number; value: Record<'kecil' | 'sedang' | 'besar', number>; deadline: Record<'3' | '7' | 'semua', number> }
export type Filt = Required<Pick<FeedFilters, 'kbli'>> & { kecamatanId: string | null; value: 'kecil' | 'sedang' | 'besar' | null; deadlineDays: 3 | 7 | null }
export const NO_FILTER: Filt = { kbli: 'semua', kecamatanId: null, value: null, deadlineDays: null }
export const activeCount = (f: Filt) => (f.kbli === 'cocok' ? 1 : 0) + (f.kecamatanId ? 1 : 0) + (f.value ? 1 : 0) + (f.deadlineDays ? 1 : 0)

export default function Filters({ f, counts, all, kecs, onChange, t }: { f: Filt; counts: FeedCounts; all: number; kecs: { id: string; name: string; n: number }[]; onChange: (f: Filt) => void; t: Strings }) {
  return (
    <div className="dk-tp-filters" role="group" aria-label={t.filters}>
      <Field label={t.fKbli}>
        {(ids) => (
          <Select
            {...ids}
            data-tp="f-kbli"
            value={f.kbli}
            onChange={(e) => onChange({ ...f, kbli: e.target.value as Filt['kbli'] })}
            options={[
              { value: 'semua', label: `${t.fAll} (${all})` },
              { value: 'cocok', label: `${t.fKbliMatch} (${counts.kbli})` },
            ]}
          />
        )}
      </Field>
      <Field label={t.fLoc}>
        {(ids) => (
          <Select
            {...ids}
            data-tp="f-loc"
            value={f.kecamatanId ?? ''}
            onChange={(e) => onChange({ ...f, kecamatanId: e.target.value || null })}
            options={[{ value: '', label: `${t.fAllKec} (${all})` }, ...kecs.map((k) => ({ value: k.id, label: `${k.name} (${k.n})` }))]}
          />
        )}
      </Field>
      <Field label={t.fValue}>
        {(ids) => (
          <Select
            {...ids}
            data-tp="f-value"
            value={f.value ?? ''}
            onChange={(e) => onChange({ ...f, value: (e.target.value || null) as Filt['value'] })}
            options={[
              { value: '', label: `${t.fAll} (${all})` },
              { value: 'kecil', label: `${t.fSmall} (${counts.value.kecil})` },
              { value: 'sedang', label: `${t.fMid} (${counts.value.sedang})` },
              { value: 'besar', label: `${t.fBig} (${counts.value.besar})` },
            ]}
          />
        )}
      </Field>
      <Field label={t.fDeadline}>
        {(ids) => (
          <Select
            {...ids}
            data-tp="f-deadline"
            value={f.deadlineDays ? String(f.deadlineDays) : ''}
            onChange={(e) => onChange({ ...f, deadlineDays: e.target.value ? (Number(e.target.value) as 3 | 7) : null })}
            options={[
              { value: '', label: `${t.fAll} (${counts.deadline.semua})` },
              { value: '3', label: `${t.f3} (${counts.deadline['3']})` },
              { value: '7', label: `${t.f7} (${counts.deadline['7']})` },
            ]}
          />
        )}
      </Field>
    </div>
  )
}
