/**
 * Cards — pure-props side cards of the desk: "Kejadian di daerah" (flood or the scenario button), "Peringatan dini"
 * (C31 warnings) and "Anomali harga" (C33). Each line names its commodity, market and number, so no two lines repeat.
 */
import type { ReactNode } from 'react'
import { Button, Icon } from '../../demo-kit/ui'

export function SideCard({ title, icon, tone, children, hook, sim }: { title: string; icon: 'water' | 'bell' | 'alert'; tone?: 'warn' | 'danger'; children: ReactNode; hook?: string; sim?: string }) {
  return (
    <section className={`dk-sp-card${tone ? ` is-${tone}` : ''}`} {...(hook ? { 'data-tour': hook } : {})}>
      <header className="dk-sp-card-h">
        <Icon name={icon} size={16} />
        <h3>{title}</h3>
        {sim && <span className="dk-sp-sim">{sim}</span>}
      </header>
      {children}
    </section>
  )
}

export interface RegionCardProps {
  title: string
  flood: { text: string; markets: string | null } | null
  emptyText: string
  autoText: string
  playLabel: string
  onPlay: () => void
  busy?: boolean
  hot?: boolean
  hotLabel?: string
  link?: ReactNode
}
export function RegionCard({ title, flood, emptyText, autoText, playLabel, onPlay, busy, hot, hotLabel, link }: RegionCardProps) {
  return (
    <SideCard title={title} icon="water" tone={flood ? 'warn' : undefined}>
      {flood ? (
        <>
          <p className="dk-sp-strong" data-sp="flood">{flood.text}</p>
          {flood.markets && <p className="dk-sp-muted">{flood.markets}</p>}
          {link}
        </>
      ) : (
        <>
          <p className="dk-sp-muted">{emptyText}</p>
          <p className="dk-sp-muted">{autoText}</p>
          <Button size="sm" variant="primary" icon="play" busy={busy} onClick={onPlay} data-sp="play-flood" {...(hot ? { 'data-hotspot': 'sp-anomaly', 'data-hotspot-label': hotLabel } : {})}>
            {playLabel}
          </Button>
        </>
      )}
    </SideCard>
  )
}

export interface AlertLine { id: string; text: string; meta: string; flash?: boolean }
export function AlertList({ rows, empty, openLabel, onOpen, hotId, hotLabel, kind }: { rows: AlertLine[]; empty: string; openLabel: string; onOpen: (id: string) => void; hotId?: string | null; hotLabel?: string; kind: 'warn' | 'anom' }) {
  if (!rows.length) return <p className="dk-sp-muted">{empty}</p>
  return (
    <ul className="dk-sp-alerts">
      {rows.map((r) => (
        <li key={r.id} className={`dk-sp-alert is-${kind}`} data-sp-alert={r.id}>
          <p className="dk-sp-strong">{r.text}</p>
          <p className="dk-sp-muted">{r.meta}</p>
          <Button size="sm" variant="ghost" iconEnd="arrowRight" onClick={() => onOpen(r.id)} {...(hotId === r.id ? { 'data-hotspot': 'sp-anomaly', 'data-hotspot-label': hotLabel } : {})}>
            {openLabel}
          </Button>
        </li>
      ))}
    </ul>
  )
}
