/**
 * demos/juara-jualan/Calls.tsx — "Percakapan": left 38 % = live strip + today's conversations of the industry
 * ("Skor terendah dulu" or newest), right 62 % = the open conversation. Phones: cards, the detail opens in a
 * full-height drawer; the lowest call's red "Momen" chip opens it straight at the problem moment (hotspot).
 * Also used for the agent's own conversations ("Percakapan Saya", read-only).
 */
import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { Badge, Drawer, Icon, Segmented, flashNewRow } from '../../demo-kit/ui'
import { hhmm, useClock, useWorld, type CriterionKey, type Industry, type WorldState } from '../../demo-kit/world'
import { CALL_FLAG, PRAPESAN_CLIP, callList } from '../../demo-kit/world/usaha-pintar'
import { LiveStrip } from './LiveStrip'
import Detail from './Detail'
import { useClipLib } from './clips'
import { clockText, customerParts, useT } from './strings'

export interface CallsProps {
  industry: Industry
  /** agent mode: only this agent's conversations, no supervisor actions */
  agentId?: string | null
  supervisor: boolean
  sm: boolean
  selected: string | null
  onSelect: (id: string) => void
  /** phone drawer */
  drawer: boolean
  onDrawer: (open: boolean) => void
  seekDanger: number
  onSeekDanger: () => void
  onAssign: (agentId: string, callId: string | null, keys: CriterionKey[]) => void
  onAssignIntent: () => void
}

const tone = (n: number) => (n < 60 ? 'danger' : n < 75 ? 'warn' : 'accent')

export function Calls({ industry, agentId, supervisor, sm, selected, onSelect, drawer, onDrawer, seekDanger, onSeekDanger, onAssign, onAssignIntent }: CallsProps) {
  const { t, lang } = useT()
  const calls = useWorld((s) => s.calls)
  const agents = useWorld((s) => s.agentsSales)
  const now = useClock().minutes
  const lib = useClipLib(industry)
  const [sort, setSort] = useState<'low' | 'new'>('low')
  const all = useMemo(() => callList({ calls, agentsSales: agents } as WorldState, now, industry, { sort, ...(agentId ? { agentId } : {}) }).filter((c) => c.at >= 0), [calls, agents, now, industry, sort, agentId])
  const live = useMemo(
    () => callList({ calls, agentsSales: agents } as WorldState, now, industry, { sort: 'new' }).filter((c) => c.score === null && c.transcript !== PRAPESAN_CLIP && c.at <= now && now < c.at + Math.ceil(c.durationSec / 60)),
    [calls, agents, now, industry],
  )

  // a conversation that arrives while the page is open flashes in
  const listRef = useRef<HTMLUListElement>(null)
  const seen = useRef<Set<string> | null>(null)
  useEffect(() => {
    const ids = all.map((c) => c.id)
    if (!seen.current) {
      seen.current = new Set(ids)
      return
    }
    const fresh = ids.filter((id) => !seen.current!.has(id))
    ids.forEach((id) => seen.current!.add(id))
    const root = listRef.current
    if (!root) return
    for (const id of fresh) {
      const el = root.querySelector<HTMLElement>(`[data-call-row="${id}"]`)
      if (el) flashNewRow(el, { slide: true })
    }
  }, [all])

  const pickRow = (id: string) => {
    startTransition(() => onSelect(id))
    if (sm) onDrawer(true)
  }
  const first = all[0]

  const detail = selected ? (
    <Detail callId={selected} supervisor={supervisor} sm={sm} seekDanger={seekDanger} onAssign={onAssign} onAssignIntent={onAssignIntent} />
  ) : null

  return (
    <div className="dk-jj-calls">
      <div className="dk-jj-left">
        {!agentId && <LiveStrip calls={live} lib={lib} onOpen={pickRow} t={t} lang={lang} />}
        <div className="dk-jj-listh">
          <p className="dk-jj-h4">
            {t.list} <Badge>{all.length}</Badge>
          </p>
          <Segmented<'low' | 'new'>
            size="sm"
            label={t.sortLabel}
            value={sort}
            onChange={setSort}
            options={[
              { value: 'low', label: t.sortLow },
              { value: 'new', label: t.sortNew },
            ]}
          />
        </div>
        {all.length === 0 ? (
          <p className="dk-jj-faint">{t.empty}</p>
        ) : (
          <ul ref={listRef} className="dk-jj-list">
            {all.map((c) => {
              const cust = customerParts(c.customer, lang)
              const on = c.id === selected
              const at = clockText(hhmm(c.at), lang)
              return (
                <li key={c.id} data-call-row={c.id} className={`dk-jj-row${on ? ' is-on' : ''}`}>
                  <button type="button" className="dk-jj-row-b" aria-current={on ? 'true' : undefined} onClick={() => pickRow(c.id)} aria-label={t.openCall(c.agentName, at)}>
                    <span className={`dk-jj-sc is-${c.score === null ? 'none' : tone(c.score)} dk-num`} aria-label={c.score === null ? t.unscored : t.scoreOf(c.score)}>
                      {c.score ?? '–'}
                    </span>
                    <span className="dk-jj-row-m">
                      <b>{c.agentName}</b>
                      <span className="dk-jj-muted">{cust.full}</span>
                      <span className="dk-jj-row-tags">
                        <Icon name={c.channel === 'wa' ? 'chat' : 'phone'} size={12} />
                        <span className="dk-num">{at}</span>
                        {c.live && <span className="dk-jj-pill is-live">{t.inProgress}</span>}
                        {c.score === null && !c.live && <span className="dk-jj-pill">{t.unscored}</span>}
                        {c.flags.slice(0, 1).map((f) => (
                          <span key={f} className="dk-jj-pill is-danger">
                            {CALL_FLAG[f]?.[lang] ?? f}
                          </span>
                        ))}
                        {c.topic === 'banjir' && (
                          <span className="dk-jj-pill is-warn">
                            <Icon name="water" size={12} />
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                  {sm && !agentId && first?.id === c.id && c.flags.length > 0 && !drawer && (
                    <button
                      type="button"
                      className="dk-jj-mchip is-danger dk-jj-rowchip"
                      data-hotspot="jj-marker-danger"
                      data-hotspot-label={t.dangerChip}
                      onClick={() => {
                        startTransition(() => onSelect(c.id))
                        onSeekDanger()
                        onDrawer(true)
                      }}
                    >
                      <Icon name="alert" size={14} /> {t.moments}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
      {sm ? (
        <Drawer open={drawer && !!selected} onClose={() => onDrawer(false)} title={t.detail} width={720} className="dk-jj-drawer">
          {detail}
        </Drawer>
      ) : (
        <div className="dk-jj-right">{detail}</div>
      )}
    </div>
  )
}
