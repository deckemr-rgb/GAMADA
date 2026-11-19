/**
 * Briefing — choose sections (Peta, Sektor, Harga, Dampak), kecamatan and programmes → BriefingPaper preview (light
 * A4, the same numbers as the screen via briefingModel; hidden kecamatan hatched with the anonymity footnote) →
 * "Cetak" (printPaper) or "Unduh HTML" (briefing-ekonomi-<region>-<YYYY-MM>.html). Each export emits ONE
 * econ.briefed (a double tap within 1,5 s is ignored). Phones: the preview opens in a full-screen drawer with the
 * export buttons at its end.
 */
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Button, Drawer } from '../../demo-kit/ui'
import { PaperFrame, printPaper } from '../../demo-kit/frames'
import { emit, useClock, useWorld, world } from '../../demo-kit/world'
import { briefingModel, commodityIndex, econFrame, priceBoard, programList, type BriefingInput } from '../../demo-kit/world/pasar-daerah'
import { usePdStrings } from '../../demo-kit/i18n/pd'
import { SLUG, monthLabel, nf, rpShort, sgn, useT, type Lang } from './strings'
import type { View } from './types'

type Sec = BriefingInput['sections'][number]
const SECS: Sec[] = ['peta', 'sektor', 'harga', 'dampak']
const S = {
  id: {
    secs: { peta: 'Peta & peringkat', sektor: 'Sektor', harga: 'Harga bahan pokok', dampak: 'Dampak program' } as Record<Sec, string>,
    sections: 'Bagian briefing', kecs: 'Kecamatan yang dibahas', progs: 'Program', preview: 'Pratinjau briefing', open: 'Lihat pratinjau & ekspor',
    print: 'Cetak / PDF', download: 'Unduh HTML', exported: (f: string) => `Briefing diekspor: ${f}`, title: 'Briefing Ekonomi Daerah',
    by: (r: string) => `Disiapkan untuk ${r} · semua angka simulasi`, kab: 'Indeks kabupaten', omzet: 'Omzet UMKM', top: 'Tertinggi', bottom: 'Terendah',
    sel: 'Kecamatan pilihan', hid: 'disembunyikan', price: 'Indeks harga hari ini (100 = rata-rata 30 hari)', eff: 'efek harga', did: 'selisih-ganda', proj: 'proyeksi',
    method: 'Metode dampak: selisih-ganda (simulasi).', none: 'Pilih minimal satu bagian.', idx: 'indeks',
  },
  en: {
    secs: { peta: 'Map & ranking', sektor: 'Sectors', harga: 'Staple prices', dampak: 'Programme impact' } as Record<Sec, string>,
    sections: 'Briefing sections', kecs: 'Districts covered', progs: 'Programmes', preview: 'Briefing preview', open: 'Open preview & export',
    print: 'Print / PDF', download: 'Download HTML', exported: (f: string) => `Briefing exported: ${f}`, title: 'Regional Economic Briefing',
    by: (r: string) => `Prepared for ${r} · all figures simulated`, kab: 'Regency index', omzet: 'MSME turnover', top: 'Highest', bottom: 'Lowest',
    sel: 'Selected districts', hid: 'hidden', price: 'Price index today (100 = 30-day mean)', eff: 'price effect', did: 'diff-in-diff', proj: 'projection',
    method: 'Impact method: difference-in-differences (simulated).', none: 'Choose at least one section.', idx: 'index',
  },
}
const ROLE: Record<View['role'], { id: string; en: string }> = { bappeda: { id: 'Bappeda', en: 'Bappeda' }, dinkop: { id: 'Dinas Koperasi & UMKM', en: 'Cooperatives & MSME Office' }, 'kepala-daerah': { id: 'Kepala Daerah', en: 'Regional Head' } }

type Model = ReturnType<typeof briefingModel>
interface PriceLine { id: string; name: string; index: number; week: number }

/** the A4 paper (pure props) */
export function BriefingPaper({ m, prices, lang, role, anon, programName }: { m: Model; prices: PriceLine[]; lang: Lang; role: string; anon: string; programName: (id: string) => string }) {
  const L = S[lang]
  const sec = (k: Sec) => m.sections.includes(k)
  return (
    <div className="dk-ie-paper">
      <header>
        <p className="dk-ie-pkick">{m.region}</p>
        <h2>{L.title} · {monthLabel(lang, m.month)}</h2>
        <p className="dk-ie-pmuted">{L.by(role)}</p>
      </header>
      <p>
        <b>{L.kab}:</b> <span className="dk-num" data-ie="paper-kab">{m.kabupaten.index != null ? nf(lang, m.kabupaten.index, 1) : '–'}</span>
        {m.kabupaten.delta != null && <> ({sgn(lang, m.kabupaten.delta)})</>} · <b>{L.omzet}:</b> {rpShort(lang, m.kabupaten.omzet)}
      </p>
      {sec('peta') && (
        <section>
          <h3>{L.secs.peta}</h3>
          <div className="dk-ie-pcols">
            <div>
              <h4>{L.top}</h4>
              <ol>{m.top.map((r) => <li key={r.kecId}>{r.name} · {nf(lang, r.index, 1)} ({sgn(lang, r.delta)})</li>)}</ol>
            </div>
            <div>
              <h4>{L.bottom}</h4>
              <ol>{m.bottom.map((r) => <li key={r.kecId}>{r.name} · {nf(lang, r.index, 1)} ({sgn(lang, r.delta)})</li>)}</ol>
            </div>
          </div>
          {m.kecamatan.length > 0 && (
            <>
              <h4>{L.sel}</h4>
              <ul className="dk-ie-pkec">
                {m.kecamatan.map((k) => (
                  <li key={k.kecId} data-kec={k.kecId} data-hidden={k.hidden || undefined}>
                    {k.name}: {k.hidden || k.index == null ? <><span className="dk-ie-phatch" aria-hidden="true" /> {L.hid}*</> : <span className="dk-num" data-val>{L.idx} {nf(lang, k.index, 1)}</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
      {sec('sektor') && m.sectors.length > 0 && (
        <section>
          <h3>{L.secs.sektor}</h3>
          <ul>
            {m.sectors.map((r) => (
              <li key={r.key}>{r.label[lang]}: {r.omzet == null ? <>{anon}*</> : `${rpShort(lang, r.omzet)} (${nf(lang, r.share * 100, 1)}%)`}</li>
            ))}
          </ul>
        </section>
      )}
      {sec('harga') && (
        <section>
          <h3>{L.secs.harga}</h3>
          <p className="dk-ie-pmuted">{L.price}</p>
          <ul>{prices.map((x) => <li key={x.id}>{x.name}: {nf(lang, x.index, 1)} · 7 {lang === 'id' ? 'hari' : 'days'} {sgn(lang, x.week)}%</li>)}</ul>
        </section>
      )}
      {sec('dampak') && m.programs.length > 0 && (
        <section>
          <h3>{L.secs.dampak}</h3>
          <ul>
            {m.programs.map(({ id, impact }) => (
              <li key={id}>
                {programName(id)}: {impact ? (impact.measured ? `${L.eff} ${sgn(lang, impact.effectPct)}% · ${L.did} ${impact.didPct != null ? `${sgn(lang, impact.didPct)}%` : '–'}` : `${L.eff} ${sgn(lang, impact.effectPct)}% (${L.proj})`) : '–'}
              </li>
            ))}
          </ul>
          <p className="dk-ie-pmuted">{L.method}</p>
        </section>
      )}
      <footer className="dk-ie-pmuted">* {m.footnote[lang]}</footer>
    </div>
  )
}

export default function Briefing({ view }: { view: View }) {
  const { lang } = useT()
  const L = S[lang]
  const p = usePdStrings()
  const now = useClock().minutes
  const ym = view.months[view.monthIdx]!
  const econ = useWorld((s) => s.econIndex)
  const ops = useWorld((s) => s.marketOps)
  const loans = useWorld((s) => s.loanApps)
  const prices = useWorld((s) => s.prices)
  const region = useWorld((s) => s.region)
  const frame = useWorld((s) => econFrame(s, ym))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const progs = useMemo(() => programList(world.get()), [ops, loans])
  const [secs, setSecs] = useState<Sec[]>(SECS)
  const [kecs, setKecs] = useState<string[]>(() => {
    const low = frame.rank.slice(-2).map((r) => r.kecId)
    return [...new Set([...(view.sel ? [view.sel] : []), ...low, ...frame.hidden.slice(0, 1)])]
  })
  const [progIds, setProgIds] = useState<string[]>(() => progs.filter((x) => x.measured).map((x) => x.id))
  const [open, setOpen] = useState(false)
  const paperRef = useRef<HTMLDivElement>(null)
  const last = useRef(0)
  const [said, setSaid] = useState('')

  const input: BriefingInput = { month: ym, kecIds: kecs, programIds: progIds, sections: secs }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const m = useMemo(() => briefingModel(world.get(), now, input), [econ, ops, loans, ym, kecs.join(), progIds.join(), secs.join(), Math.floor(now / 10)])
  const priceLines = useMemo<PriceLine[]>(() => {
    const s = world.get()
    const board = priceBoard(s, now)
    return region.commodities
      .map((c) => {
        const b = board.filter((r) => r.commodityId === c.id)
        const v = commodityIndex(s, c.id, 30).values
        return { id: c.id, name: c.name[lang], index: v[v.length - 1] ?? 100, week: b.length ? b.reduce((a, r) => a + r.weekPct, 0) / b.length : 0 }
      })
      .sort((a, b) => Math.abs(b.week) - Math.abs(a.week))
      .slice(0, 4)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prices, region, lang, Math.floor(now / 30)])
  const kName = (k: string) => region.kecamatan.find((x) => x.id === k)?.name ?? k
  const pName = (id: string) => progs.find((x) => x.id === id)?.title[lang] ?? id
  const file = `briefing-ekonomi-${world.get().regionId}-${ym}.html`

  const exported = (how: 'print' | 'download') => {
    const t = Date.now()
    if (t - last.current < 1500 || !secs.length) return false
    last.current = t
    emit('econ.briefed', { month: ym, kecamatanIds: kecs, programIds: secs.includes('dampak') ? progIds : [], sections: secs, by: view.role }, SLUG)
    setSaid(L.exported(how === 'download' ? file : L.print))
    return true
  }
  const doPrint = () => {
    if (!exported('print')) return
    const el = paperRef.current
    if (el) printPaper(el)
  }
  const doDownload = () => {
    if (!exported('download')) return
    const el = paperRef.current
    if (!el) return
    const css = 'body{font:14px/1.55 system-ui,sans-serif;max-width:760px;margin:32px auto;padding:0 16px;color:#1d1b26}h2{font-size:22px;margin:4px 0}h3{font-size:16px;margin:18px 0 6px;border-bottom:1px solid #ddd}h4{margin:8px 0 4px}.dk-ie-pmuted{color:#666;font-size:12px}.dk-ie-pcols{display:grid;grid-template-columns:1fr 1fr;gap:16px}.dk-ie-phatch{display:inline-block;width:28px;height:10px;background:repeating-linear-gradient(45deg,#999 0 2px,transparent 2px 6px)}'
    const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${L.title} · ${region.name} · ${ym}</title><style>${css}</style></head><body>${el.innerHTML}</body></html>`
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
    const a = document.createElement('a')
    a.href = url
    a.download = file
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 2000)
  }
  const toggle = <T,>(list: T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  const paper = (
    <PaperFrame label={L.preview} size="auto" className="dk-ie-paperframe">
      <div ref={paperRef} data-ie="paper">
        <BriefingPaper m={m} prices={priceLines} lang={lang} role={ROLE[view.role][lang]} anon={p.anonHidden} programName={pName} />
      </div>
    </PaperFrame>
  )
  const actions: ReactNode = (
    <div className="dk-ie-export">
      <Button variant="primary" icon="download" onClick={doDownload} disabled={!secs.length} data-ie="export-download">
        {L.download}
      </Button>
      <Button variant="secondary" icon="print" onClick={doPrint} disabled={!secs.length} data-ie="export-print">
        {L.print}
      </Button>
      <p className="dk-ie-muted" role="status" aria-live="polite">{said || (!secs.length ? L.none : '')}</p>
    </div>
  )
  return (
    <div className="dk-ie-brief" data-tour="ie-briefing" data-ie="briefing">
      <div className="dk-ie-bform">
        <fieldset>
          <legend>{L.sections}</legend>
          {SECS.map((k) => (
            <label key={k} className="dk-ie-check">
              <input type="checkbox" checked={secs.includes(k)} onChange={() => setSecs((o) => SECS.filter((x) => (x === k ? !o.includes(k) : o.includes(x))))} /> {L.secs[k]}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>{L.kecs}</legend>
          <div className="dk-ie-chips">
            {[...frame.rank.map((r) => r.kecId), ...frame.hidden].sort((a, b) => kName(a).localeCompare(kName(b), 'id')).map((k) => (
              <button key={k} type="button" className="dk-chip" aria-pressed={kecs.includes(k)} onClick={() => setKecs((o) => toggle(o, k))}>
                {kName(k)}
              </button>
            ))}
          </div>
        </fieldset>
        {secs.includes('dampak') && (
          <fieldset>
            <legend>{L.progs}</legend>
            {progs.map((x) => (
              <label key={x.id} className="dk-ie-check">
                <input type="checkbox" checked={progIds.includes(x.id)} onChange={() => setProgIds((o) => toggle(o, x.id))} /> {x.title[lang]}
              </label>
            ))}
          </fieldset>
        )}
        {view.phone ? (
          <Button variant="primary" icon="doc" onClick={() => setOpen(true)} data-ie="open-preview">
            {L.open}
          </Button>
        ) : (
          actions
        )}
      </div>
      {view.phone ? (
        <Drawer open={open} onClose={() => setOpen(false)} title={L.preview} width={2000} className="dk-ie-ov dk-ie-full">
          {paper}
          {actions}
        </Drawer>
      ) : (
        <div className="dk-ie-bpreview">{paper}</div>
      )}
    </div>
  )
}
