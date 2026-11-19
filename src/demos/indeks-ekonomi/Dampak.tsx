/**
 * Dampak — programme picker (programList: every market operation + the cooperative working-capital cohort; the
 * seeded past rice operation is measured) → "Ukur dampak" ⇒ ImpactChart (difference-in-differences: treated vs
 * control, before / after; projections of an unfinished operation as a forecast band labelled "proyeksi").
 * effectPct = the operation's effectPct (= Sinyal Pasar's opSimulate); didPct = read from the series.
 */
import { useEffect, useMemo, useState } from 'react'
import { useShell } from '../../demo-kit/shell'
import { Button, Segmented } from '../../demo-kit/ui'
import { TrendChart } from '../../demo-kit/viz'
import { useClock, useWorld, world } from '../../demo-kit/world'
import { OP_STAGE, programImpact, programList, type Impact, type ProgramRow } from '../../demo-kit/world/pasar-daerah'
import { usePdStrings } from '../../demo-kit/i18n/pd'
import { nf, sgn, useT, type Lang } from './strings'
import type { View } from './types'

const S = {
  id: {
    pick: 'Pilih program', measure: 'Ukur dampak', measured: 'terukur', proj: 'proyeksi', method: 'Metode: selisih-ganda (simulasi)',
    effOp: 'Efek harga operasi (sama dengan Sinyal Pasar)', did: 'Selisih-ganda terukur', effModal: 'Selisih-ganda indeks ekonomi',
    treatedOp: 'Pasar operasi', controlOp: 'Pasar lain', treatedM: 'Kecamatan penerima modal', controlM: 'Kecamatan lain', start: 'Program mulai',
    chart: 'Dampak program: sebelum dan sesudah', unitOp: 'indeks harga, 100 = awal jendela', unitM: 'indeks ekonomi kecamatan', none: 'Belum ada program yang bisa diukur.',
    hint: 'Pilih program lalu tekan "Ukur dampak".', kecs: (n: number) => `${n} kecamatan`, src: 'Data simulasi · metode selisih-ganda',
  },
  en: {
    pick: 'Choose a programme', measure: 'Measure impact', measured: 'measured', proj: 'projection', method: 'Method: difference-in-differences (simulated)',
    effOp: 'Operation price effect (same as Sinyal Pasar)', did: 'Measured difference-in-differences', effModal: 'Economic index difference-in-differences',
    treatedOp: 'Operation markets', controlOp: 'Other markets', treatedM: 'Districts with loans', controlM: 'Other districts', start: 'Programme starts',
    chart: 'Programme impact: before and after', unitOp: 'price index, 100 = window start', unitM: 'district economic index', none: 'No programme to measure yet.',
    hint: 'Choose a programme, then press "Measure impact".', kecs: (n: number) => `${n} districts`, src: 'Simulated data · difference-in-differences',
  },
}

const short = (p: ProgramRow, lang: Lang, commodity: (id: string) => string) => (p.kind === 'modal' ? p.title[lang] : `${p.id} · ${commodity(p.commodityId ?? '')}`)

/** pure-props chart of one impact (also for the product page later) */
export function ImpactChart({ impact, kind, lang, projection }: { impact: Impact; kind: ProgramRow['kind']; lang: Lang; projection: string }) {
  const L = S[lang]
  const op = kind === 'operasi-pasar'
  const series = [
    { id: 't', label: op ? L.treatedOp : L.treatedM, values: impact.treated },
    { id: 'c', label: op ? L.controlOp : L.controlM, values: impact.control, dashed: true },
  ]
  return (
    <TrendChart
      title={L.chart}
      unit={op ? L.unitOp : L.unitM}
      source={L.src}
      x={impact.labels}
      series={series}
      format={(v) => nf(lang, v, 1)}
      markers={[{ x: impact.split, label: L.start, tone: 'info' }]}
      {...(impact.measured ? {} : { forecast: { values: impact.after.values, lo: impact.after.lo, hi: impact.after.hi, label: projection } })}
      height={240}
    />
  )
}

export default function Dampak({ view }: { view: View }) {
  const { lang } = useT()
  const L = S[lang]
  const p = usePdStrings()
  const { markMission } = useShell()
  const now = useClock().minutes
  const ops = useWorld((s) => s.marketOps)
  const loans = useWorld((s) => s.loanApps)
  const region = useWorld((s) => s.region)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const list = useMemo(() => programList(world.get()), [ops, loans])
  const commodity = (id: string) => region.commodities.find((c) => c.id === id)?.name[lang] ?? id
  const prog = list.find((x) => x.id === view.program) ?? list[0] ?? null
  const [measured, setMeasured] = useState<string | null>(view.measure ? view.program : null)
  useEffect(() => {
    if (view.measure) setMeasured(view.program)
  }, [view.measure, view.program])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const impact = useMemo(() => (measured && prog && measured === prog.id ? programImpact(world.get(), measured, now) : null), [measured, prog, ops, loans, Math.floor(now / 10)])
  useEffect(() => {
    if (impact && prog?.kind === 'operasi-pasar') markMission('dampak')
  }, [impact, prog, markMission])

  if (!list.length) return <p className="dk-ie-muted">{L.none}</p>
  return (
    <div className="dk-ie-dampak" data-tour="ie-impact" data-ie="dampak">
      <div className="dk-ie-picker">
        {view.phone ? (
          <Segmented size="sm" label={L.pick} value={prog?.id ?? ''} onChange={(v) => view.setProgram(v)} options={list.map((x) => ({ value: x.id, label: short(x, lang, commodity) }))} />
        ) : (
          <div role="radiogroup" aria-label={L.pick} className="dk-ie-progs">
            {list.map((x) => (
              <button key={x.id} type="button" role="radio" aria-checked={prog?.id === x.id} className="dk-ie-prog" data-program={x.id} onClick={() => view.setProgram(x.id)}>
                <b>{x.title[lang]}</b>
                <small>
                  {x.kind === 'operasi-pasar' ? OP_STAGE[x.stage as keyof typeof OP_STAGE]?.[lang] ?? x.stage : L.kecs(x.kecIds.length)} · {x.measured ? L.measured : p.projection}
                </small>
              </button>
            ))}
          </div>
        )}
        <Button variant="primary" icon="chart" onClick={() => prog && setMeasured(prog.id)} disabled={!prog} data-ie="measure">
          {L.measure}
        </Button>
      </div>
      {impact && prog ? (
        <section className="dk-ie-impact" data-ie="impact" data-program={prog.id} aria-live="polite">
          <dl className="dk-ie-stats">
            {prog.kind === 'operasi-pasar' ? (
              <>
                <div>
                  <dt>{L.effOp}</dt>
                  <dd className="dk-num" data-ie="effect">{sgn(lang, impact.effectPct, 0)}%</dd>
                </div>
                <div>
                  <dt>{L.did}</dt>
                  <dd className="dk-num" data-ie="did">{impact.didPct != null ? `${sgn(lang, impact.didPct)}%` : p.projection}</dd>
                </div>
              </>
            ) : (
              <div>
                <dt>{L.effModal}</dt>
                <dd className="dk-num" data-ie="effect">{sgn(lang, impact.effectPct)}%</dd>
              </div>
            )}
            <div>
              <dt>{L.method.split(':')[0]}</dt>
              <dd>{L.method.split(': ')[1]}</dd>
            </div>
          </dl>
          <ImpactChart impact={impact} kind={prog.kind} lang={lang} projection={p.projection} />
          <p className="dk-ie-muted">{impact.note[lang]}{impact.measured ? '' : ` · ${p.projection}`}</p>
        </section>
      ) : (
        <p className="dk-ie-muted">{L.hint}</p>
      )}
    </div>
  )
}
