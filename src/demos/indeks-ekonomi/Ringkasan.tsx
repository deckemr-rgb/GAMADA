/**
 * Ringkasan (Kepala Daerah) — three headline cards (biggest drop, biggest rise, programme effect) for the month on
 * the scrubber, the compact map + Play (MapStage from Peta), and "Beri instruksi pemulihan" (instruction dialog,
 * lazy) for the lowest visible kecamatan.
 */
import { useMemo } from 'react'
import { Button } from '../../demo-kit/ui'
import { useClock, useWorld, world } from '../../demo-kit/world'
import { econFrame, programImpact, programList } from '../../demo-kit/world/pasar-daerah'
import { MapStage } from './Peta'
import { monthLabel, nf, sgn, useT } from './strings'
import type { View } from './types'

const S = {
  id: { drop: 'Penurunan terbesar', rise: 'Kenaikan terbesar', prog: 'Efek program', vs: 'vs bulan sebelumnya', open: 'Buka kecamatan', see: 'Lihat di Dampak', none: 'Tidak ada perubahan', instruct: 'Beri instruksi pemulihan', title: (m: string) => `Ringkasan ekonomi · ${m}`, eff: (e: string, d: string) => `efek harga ${e}% · selisih-ganda ${d}`, noProg: 'Belum ada program terukur.' },
  en: { drop: 'Biggest drop', rise: 'Biggest rise', prog: 'Programme effect', vs: 'vs the previous month', open: 'Open the district', see: 'See in Impact', none: 'No change', instruct: 'Issue a recovery instruction', title: (m: string) => `Economic summary · ${m}`, eff: (e: string, d: string) => `price effect ${e}% · diff-in-diff ${d}`, noProg: 'No measured programme yet.' },
}

export default function Ringkasan({ view }: { view: View }) {
  const { lang } = useT()
  const L = S[lang]
  const now = useClock().minutes
  const ym = view.months[view.monthIdx]!
  const frame = useWorld((s) => econFrame(s, ym))
  const region = useWorld((s) => s.region)
  const ops = useWorld((s) => s.marketOps)
  const loans = useWorld((s) => s.loanApps)
  const name = (k: string) => region.kecamatan.find((x) => x.id === k)?.name ?? k
  const byDelta = [...frame.rank].sort((a, b) => a.delta - b.delta || a.kecId.localeCompare(b.kecId))
  const drop = byDelta[0]
  const rise = byDelta[byDelta.length - 1]
  const prog = useMemo(() => {
    const s = world.get()
    const p = programList(s).find((x) => x.kind === 'operasi-pasar' && x.measured) ?? programList(s).find((x) => x.measured)
    return p ? { p, impact: programImpact(s, p.id, now) } : null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ops, loans, Math.floor(now / 10)])
  return (
    <div className="dk-ie-ring" data-ie="ringkasan">
      <h3 className="dk-ie-h3">{L.title(monthLabel(lang, ym))}</h3>
      <div className="dk-ie-heads">
        {drop && drop.delta < 0 ? (
          <button type="button" className="dk-ie-head is-down" data-ie="head-drop" onClick={() => view.pick(drop.kecId)}>
            <span className="dk-ie-hk">{L.drop}</span>
            <b>Kec. {name(drop.kecId)}</b>
            <span className="dk-num dk-ie-hv">{sgn(lang, drop.delta)}</span>
            <small>{lang === 'id' ? 'indeks' : 'index'} {nf(lang, drop.index, 1)} · {L.vs}</small>
          </button>
        ) : (
          <div className="dk-ie-head"><span className="dk-ie-hk">{L.drop}</span><b>{L.none}</b></div>
        )}
        {rise && rise.delta > 0 ? (
          <button type="button" className="dk-ie-head is-up" data-ie="head-rise" onClick={() => view.pick(rise.kecId)}>
            <span className="dk-ie-hk">{L.rise}</span>
            <b>Kec. {name(rise.kecId)}</b>
            <span className="dk-num dk-ie-hv">{sgn(lang, rise.delta)}</span>
            <small>{lang === 'id' ? 'indeks' : 'index'} {nf(lang, rise.index, 1)} · {L.vs}</small>
          </button>
        ) : (
          <div className="dk-ie-head"><span className="dk-ie-hk">{L.rise}</span><b>{L.none}</b></div>
        )}
        {prog?.impact ? (
          <button
            type="button"
            className="dk-ie-head"
            data-ie="head-prog"
            onClick={() => {
              view.setProgram(prog.p.id)
              view.go('dampak')
            }}
          >
            <span className="dk-ie-hk">{L.prog}</span>
            <b>{prog.p.title[lang]}</b>
            <span className="dk-num dk-ie-hv">{sgn(lang, prog.impact.effectPct)}%</span>
            <small>{L.eff(sgn(lang, prog.impact.effectPct), prog.impact.didPct != null ? `${sgn(lang, prog.impact.didPct)}%` : '–')} · {L.see} →</small>
          </button>
        ) : (
          <div className="dk-ie-head"><span className="dk-ie-hk">{L.prog}</span><b>{L.noProg}</b></div>
        )}
      </div>
      <div className="dk-ie-ringmap">
        <MapStage view={view} compact />
        <Button variant="primary" icon="send" onClick={view.instruct} data-ie="instruct">
          {L.instruct}
        </Button>
      </div>
    </div>
  )
}
