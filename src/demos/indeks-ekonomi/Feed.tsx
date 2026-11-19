/**
 * Feed — "Kejadian ekonomi hari ini": today's econ.updated rows (ActivityFeed; a hidden kecamatan's row carries no
 * number) and the hourly pulse of recorded transactions (Sparkline, econPulse().byHour up to now). Lazy: fetched on
 * intent over the side column or when an economic event arrives (plan §5 fallback).
 */
import { useMemo } from 'react'
import { ActivityFeed, type ActivityRow } from '../../demo-kit/ui'
import { Sparkline } from '../../demo-kit/viz'
import { useWorld } from '../../demo-kit/world'
import { econPulse, type econEvents } from '../../demo-kit/world/pasar-daerah'
import { PD_STRINGS } from '../../demo-kit/i18n/pd'
import { nf, sgn, useT } from './strings'

type Ev = ReturnType<typeof econEvents>[number]

export default function Feed({ events, now }: { events: Ev[]; now: number }) {
  const { lang } = useT()
  const pulse = useWorld((s) => econPulse(s, now))
  const region = useWorld((s) => s.region)
  const rows = useMemo<ActivityRow[]>(
    () =>
      events.map((e) => {
        const name = region.kecamatan.find((k) => k.id === e.kecId)?.name ?? e.kecId
        const text = (l: 'id' | 'en') =>
          e.hidden ? `Kec. ${name}: ${PD_STRINGS[l].anonHidden.toLowerCase()}` : `${e.reason[l]} · ${l === 'id' ? 'indeks' : 'index'} ${nf(l, e.index, 1)} (${sgn(l, e.delta)})`
        return { id: `${e.kecId}:${e.month}:${e.at}`, at: e.at, product: 'indeks-ekonomi', text: { id: text('id'), en: text('en') }, tone: e.delta < 0 ? 'warn' : 'ok' }
      }),
    [events, region],
  )
  const hour = Math.min(23, Math.max(0, Math.floor(now / 60)))
  const spark = pulse.byHour.slice(0, hour + 1)
  return (
    <div className="dk-ie-feed" data-ie="feed">
      <ActivityFeed
        rows={rows}
        max={6}
        label={{ id: 'Kejadian ekonomi hari ini', en: 'Economic events today' }}
        empty={{ id: 'Belum ada kejadian ekonomi hari ini (banjir, panen, atau program).', en: 'No economic event today yet (flood, harvest or programme).' }}
      />
      <div className="dk-ie-pulse">
        <span className="dk-ie-muted">
          {lang === 'id' ? `Transaksi per jam hari ini · total ${nf(lang, pulse.tx)} (simulasi)` : `Transactions per hour today · total ${nf(lang, pulse.tx)} (simulated)`}
        </span>
        <Sparkline values={spark.length > 1 ? spark : [0, ...spark]} label={lang === 'id' ? 'Transaksi per jam hari ini' : 'Transactions per hour today'} height={32} area />
      </div>
    </div>
  )
}
