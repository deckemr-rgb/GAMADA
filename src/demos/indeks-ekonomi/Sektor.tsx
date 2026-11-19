/**
 * Sektor — econSectors for the month (kabupaten or the selected kecamatan): hatched merged rows "Lainnya (digabung)",
 * the pack's source line (simulasi). Dinas Koperasi & UMKM sees four aggregate cards (dinkopCards: UMKM per sector,
 * Rapor Usaha score bins with < 10 merged, the cooperative working-capital programme, Katalog Lokal local spend) —
 * counts and sums only, never a business name.
 */
import { useMemo } from 'react'
import { IconButton } from '../../demo-kit/ui'
import { useClock, useWorld, world } from '../../demo-kit/world'
import { dinkopCards, econFrame, econSectors } from '../../demo-kit/world/pasar-daerah'
import { HatchBars } from './bars'
import { monthLabel, nf, rpShort, useT } from './strings'
import type { View } from './types'

const S = {
  id: {
    title: (m: string, w: string) => `Omzet per sektor · ${w} · ${m}`, kab: 'seluruh kabupaten', all: 'Tampilkan seluruh kabupaten', prev: 'Bulan sebelumnya', next: 'Bulan berikutnya',
    src: (r: string) => `Struktur sektor dari profil ekonomi ${r} (simulasi); sektor dengan < 10 usaha digabung.`, hiddenSel: (k: string) => `Kec. ${k} disembunyikan (anonimitas): sektor ditampilkan untuk seluruh kabupaten.`,
    dinkop: 'Kartu Dinas Koperasi & UMKM (agregat, tanpa nama usaha)', perSector: 'UMKM per sektor', bins: 'Sebaran Skor Rapor Usaha', binsNote: 'kelompok < 10 usaha digabung',
    modal: 'Program modal kerja Koperasi', modalBody: (n: number, v: string, k: string) => `${n} pinjaman disetujui · ${v} · kecamatan ${k} (simulasi)`, modalNone: 'Belum ada pinjaman modal kerja yang disetujui.',
    katalog: 'Belanja lokal lewat Katalog Lokal', katalogBody: (v: string, n: number) => `${v} bulan ini · ${n} pesanan dibayar (simulasi)`, toImpact: 'Ukur dampak program modal', usaha: 'usaha',
  },
  en: {
    title: (m: string, w: string) => `Turnover by sector · ${w} · ${m}`, kab: 'whole regency', all: 'Show the whole regency', prev: 'Previous month', next: 'Next month',
    src: (r: string) => `Sector structure from the ${r} economic profile (simulated); sectors with < 10 businesses merged.`, hiddenSel: (k: string) => `${k} district is hidden (anonymity): sectors shown for the whole regency.`,
    dinkop: 'Cooperatives & MSME Office cards (aggregates, no business names)', perSector: 'MSMEs per sector', bins: 'Rapor Usaha score distribution', binsNote: 'groups < 10 businesses merged',
    modal: 'Cooperative working-capital programme', modalBody: (n: number, v: string, k: string) => `${n} loans approved · ${v} · districts ${k} (simulated)`, modalNone: 'No working-capital loan approved yet.',
    katalog: 'Local spend through Katalog Lokal', katalogBody: (v: string, n: number) => `${v} this month · ${n} paid orders (simulated)`, toImpact: 'Measure the loan programme', usaha: 'businesses',
  },
}

export default function Sektor({ view }: { view: View }) {
  const { lang } = useT()
  const L = S[lang]
  const short = lang === 'id' ? 'disembunyikan (< 10 usaha)' : 'hidden (< 10 businesses)'
  const ym = view.months[view.monthIdx]!
  const econ = useWorld((s) => s.econIndex)
  const region = useWorld((s) => s.region)
  const frame = useWorld((s) => econFrame(s, ym))
  const selHidden = !!view.sel && frame.hidden.includes(view.sel)
  const scope = view.sel && !selHidden ? view.sel : null
  const kName = (k: string) => region.kecamatan.find((x) => x.id === k)?.name ?? k
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sectors = useMemo(() => econSectors(world.get(), ym, scope), [econ, ym, scope])
  const where = scope ? `Kec. ${kName(scope)}` : L.kab
  return (
    <div className="dk-ie-sektor" data-ie="sektor">
      <section className="dk-ie-card">
        <header className="dk-ie-cardhead">
          <h3 className="dk-ie-h3">{L.title(monthLabel(lang, ym), where)}</h3>
          <div className="dk-ie-monthnav">
            <IconButton icon="chevronLeft" label={L.prev} disabled={view.monthIdx === 0} onClick={() => view.setMonthIdx(view.monthIdx - 1)} />
            <IconButton icon="chevronRight" label={L.next} disabled={view.monthIdx >= view.months.length - 1} onClick={() => view.setMonthIdx(view.monthIdx + 1)} />
          </div>
        </header>
        {scope && (
          <button type="button" className="dk-chip" onClick={() => view.pick(null)}>
            {L.all}
          </button>
        )}
        {selHidden && <p className="dk-ie-muted">{L.hiddenSel(kName(view.sel!))}</p>}
        <HatchBars lang={lang} title={L.title(monthLabel(lang, ym), where)} anon={short} rows={sectors.map((r) => ({ key: r.key, label: r.label[lang], value: r.omzet, count: r.businesses, merged: r.merged }))} />
        <p className="dk-ie-muted dk-ie-src">{L.src(region.name)}</p>
      </section>
      {view.role === 'dinkop' && <Dinkop view={view} />}
    </div>
  )
}

function Dinkop({ view }: { view: View }) {
  const { lang } = useT()
  const L = S[lang]
  const short = lang === 'id' ? 'disembunyikan (< 10 usaha)' : 'hidden (< 10 businesses)'
  const now = useClock().minutes
  const scores = useWorld((s) => s.bizScores)
  const loans = useWorld((s) => s.loanApps)
  const orders = useWorld((s) => s.orders)
  const econ = useWorld((s) => s.econIndex)
  const region = useWorld((s) => s.region)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const c = useMemo(() => dinkopCards(world.get(), now), [scores, loans, orders, econ, Math.floor(now / 60)])
  const kName = (k: string) => region.kecamatan.find((x) => x.id === k)?.name ?? k
  return (
    <section className="dk-ie-dinkop" aria-label={L.dinkop} data-ie="dinkop">
      <h3 className="dk-ie-h3">{L.dinkop}</h3>
      <div className="dk-ie-cards">
        <article className="dk-ie-card">
          <h4>{L.perSector}</h4>
          <HatchBars money={false} lang={lang} title={L.perSector} anon={short} rows={c.sectors.map((r) => ({ key: r.key, label: r.label[lang], value: r.businesses, count: null, merged: r.merged, note: L.usaha }))} />
        </article>
        <article className="dk-ie-card">
          <h4>{L.bins}</h4>
          <HatchBars money={false} lang={lang} title={L.bins} anon={short} rows={c.scoreBins.map((b) => ({ key: `${b.from}`, label: `${b.from}–${b.to}`, value: b.count, count: null, merged: b.merged, note: L.usaha }))} />
          <p className="dk-ie-muted">{L.binsNote}</p>
        </article>
        <article className="dk-ie-card" data-ie="modal-card">
          <h4>{L.modal}</h4>
          <p>{c.modal.count ? L.modalBody(c.modal.count, rpShort(lang, c.modal.amount), c.modal.kecIds.map(kName).join(', ')) : L.modalNone}</p>
          {c.modal.count > 0 && (
            <button type="button" className="dk-chip" onClick={() => view.go('dampak')}>
              {L.toImpact} →
            </button>
          )}
        </article>
        <article className="dk-ie-card" data-ie="katalog-card">
          <h4>{L.katalog}</h4>
          <p className="dk-num">{L.katalogBody(rpShort(lang, c.katalog.spendMonth), c.katalog.orders)}</p>
          <small className="dk-ie-muted">{nf(lang, c.katalog.orders)} × Katalog Lokal</small>
        </article>
      </div>
    </section>
  )
}
