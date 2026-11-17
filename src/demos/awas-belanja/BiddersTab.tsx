/**
 * BiddersTab.tsx (lazy) — "Peserta": force-layout network of the package bidders (fictional companies). Edges are
 * the kit's affiliationEdges (same address / director / registration IP / rotating wins). After the analysis the
 * linked ring starts collapsed as one node and "opens" (the wow moment); clicking an edge shows its evidence and
 * ticks the "Temukan peserta terafiliasi" mission. Below: the bidder table (cards on phones).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { Badge, Button, Chip, Icon, IconButton, Table, motionMode, type TableColumn } from '../../demo-kit/ui'
import { NetworkGraph, TONE, type NetEdge, type NetNode } from '../../demo-kit/viz'
import { useWorld, type Bidder, type WorldState } from '../../demo-kit/world'
import { affiliationEdges, type AffiliationEdge } from '../../demo-kit/world/satu-daerah'
import { AB, isAnalysed, pct, rpFull, rpShort } from './model'
import { useT } from './strings'

interface Row {
  b: Bidder
  bid: number | null
  vsLow: number | null
  ring: boolean
}

const all = (s: WorldState) => s

/** touch screens: copy says "ketuk / tap" instead of "klik / click" */
function useCoarse(): boolean {
  const [c] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true)
  return c
}

export default function BiddersTab({ id, onAnalyse, running, onEdge }: { id: string; onAnalyse: () => void; running: boolean; onEdge: () => void }) {
  const { t, lang } = useT()
  const s = useWorld(all)
  const p = s.procurements.byId[id]
  const analysed = !!p && isAnalysed(p)
  const edges = useMemo(() => affiliationEdges(s, id), [s.procurements, s.bidders, id]) // eslint-disable-line react-hooks/exhaustive-deps
  const ringIds = useMemo(() => new Set(edges.flatMap((e) => [e.a, e.b])), [edges])
  const [selEdge, setSelEdge] = useState<string | null>(null)
  const graphRef = useRef<HTMLDivElement>(null)
  const coarse = useCoarse()
  const ringy = analysed && ringIds.size >= 2
  // the ring starts as one node and "opens" a moment after an analysed package shows (once per package)
  const [opened, setOpened] = useState(() => motionMode() === 'static')
  const [manual, setManual] = useState<boolean | null>(null)
  useEffect(() => {
    setOpened(motionMode() === 'static')
    setManual(null)
  }, [id])
  useEffect(() => {
    if (!ringy || opened) return
    const c = gsap.delayedCall(AB.ringOpenDelay + 0.5, () => setOpened(true))
    return () => {
      c.kill()
    }
  }, [ringy, opened])
  const isCollapsed = ringy && (manual ?? !opened)
  const collapsed = isCollapsed ? ['ring'] : []
  const setCollapsed = (c: string[]) => setManual(c.length > 0)

  useEffect(() => setSelEdge(null), [id])

  const bidRows = useMemo<Row[]>(() => {
    if (!p) return []
    const bids = new Map((p.bids ?? []).map((b) => [b.bidderId, b.price]))
    const low = Math.min(...[...bids.values()])
    return p.bidderIds
      .map((bid) => s.bidders.byId[bid])
      .filter((b): b is Bidder => !!b)
      .map((b) => {
        const price = bids.get(b.id) ?? null
        return { b, bid: price, vsLow: price != null && Number.isFinite(low) && low > 0 ? ((price - low) / low) * 100 : null, ring: ringIds.has(b.id) }
      })
      .sort((a, b) => (a.bid ?? Infinity) - (b.bid ?? Infinity))
  }, [p, s.bidders, ringIds])

  const nodes = useMemo<NetNode[]>(
    () =>
      bidRows.map((r) => ({
        id: r.b.id,
        label: `${r.b.legal} ${r.b.name}`,
        size: r.ring ? 9 : 7,
        ...(analysed && r.ring ? { tone: 'danger' as const, cluster: 'ring' } : { color: TONE.neutral }),
        note: r.bid != null ? `${t.colBid} ${rpShort(r.bid, lang)}` : t.noBid,
      })),
    [bidRows, analysed, t, lang],
  )
  const netEdges = useMemo<NetEdge[]>(
    () =>
      edges.map((e) => ({
        id: `${e.a}|${e.b}`,
        source: e.a,
        target: e.b,
        weight: e.kinds.length,
        label: e.kinds.map((k) => t.edgeKinds[k] ?? k).join(', '),
        ...(analysed ? { tone: 'danger' as const } : {}),
      })),
    [edges, analysed, t],
  )
  if (!p) return null
  const sel = selEdge ? edges.find((e) => `${e.a}|${e.b}` === selEdge) : undefined

  return (
    <div className="dk-ab-bid">
      <div ref={graphRef} className={`dk-ab-bid-grid${sel ? ' has-ev' : ''}`}>
        <NetworkGraph
          title={t.graphTitle}
          unit={t.graphUnit}
          seed={s.seed}
          nodes={nodes}
          edges={netEdges}
          clusters={[{ id: 'ring', label: t.graphCluster(ringIds.size), color: TONE.danger }]}
          collapsed={collapsed}
          onClusterToggle={(cid, c) => setCollapsed(c ? [cid] : [])}
          selectedEdge={selEdge}
          onEdgeSelect={(e) => {
            setSelEdge(e.id ?? null)
            // the mission is about the linked bidders the analysis found, not any grey line before it
            if (analysed) onEdge()
          }}
          legend={[
            { label: t.legendRing, color: TONE.danger, kind: 'dot' },
            { label: t.legendIndep, color: TONE.neutral, kind: 'dot' },
          ]}
          actions={
            analysed && ringIds.size >= 2 ? (
              <Button size="sm" variant="ghost" icon={collapsed.length ? 'users' : 'minus'} onClick={() => setCollapsed(collapsed.length ? [] : ['ring'])}>
                {collapsed.length ? t.graphOpen : t.graphClose}
              </Button>
            ) : undefined
          }
        />
        {sel ? (
          <Evidence
            edge={sel}
            rows={bidRows}
            onClose={() => {
              const key = selEdge
              setSelEdge(null)
              // focus goes back to the line that was chosen
              requestAnimationFrame(() => {
                const hit = key ? graphRef.current?.querySelector<SVGLineElement>(`line.dk-viz-edgehit[data-e="${CSS.escape(key)}"]`) : null
                hit?.focus()
              })
            }}
          />
        ) : (
          <aside className="dk-ab-ev is-hint">
            <Icon name="info" size={16} />
            <p>{!edges.length ? t.graphNone : analysed ? (coarse ? t.graphHintTap : t.graphHint) : t.graphHintPre}</p>
            {!analysed && edges.length > 0 && (
              <Button size="sm" variant="primary" icon="zap" onClick={onAnalyse} busy={running} aria-disabled={running || undefined}>
                {running ? t.analysing : t.analyse}
              </Button>
            )}
          </aside>
        )}
      </div>
      <BidTable rows={bidRows} analysed={analysed} />
    </div>
  )
}

function Evidence({ edge, rows, onClose }: { edge: AffiliationEdge; rows: Row[]; onClose: () => void }) {
  const { t, lang } = useT()
  const a = rows.find((r) => r.b.id === edge.a)
  const b = rows.find((r) => r.b.id === edge.b)
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [edge])
  return (
    <aside
      ref={ref}
      className="dk-ab-ev"
      tabIndex={-1}
      aria-live="polite"
      aria-label={t.evidenceTitle}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return
        e.stopPropagation()
        onClose()
      }}
    >
      <header className="dk-ab-ev-h">
        <p className="dk-ab-h4">
          <Icon name="link" size={16} />
          {t.evidenceTitle}
        </p>
        <IconButton icon="close" size="sm" label={t.evidenceClose} onClick={onClose} />
      </header>
      <p className="dk-ab-ev-pair">
        <b>{a ? `${a.b.legal} ${a.b.name}` : edge.a}</b>
        <span aria-hidden="true">↔</span>
        <b>{b ? `${b.b.legal} ${b.b.name}` : edge.b}</b>
      </p>
      <div className="dk-ab-ev-kinds">
        {edge.kinds.map((k) => (
          <Chip key={k} tone="danger" icon="link">
            {t.edgeKinds[k] ?? k}
          </Chip>
        ))}
      </div>
      <ul className="dk-ab-ev-list">
        {edge.evidence.map((e) => (
          <li key={e.id}>{e[lang]}</li>
        ))}
      </ul>
      {a?.bid != null && b?.bid != null && (
        <div className="dk-ab-ev-bids">
          <p className="dk-ab-faint">{t.evidenceBids}</p>
          <p className="dk-num">
            {rpFull(a.bid, lang)} · {rpFull(b.bid, lang)} <Badge tone="danger">{t.evidenceGap(pct((Math.abs(a.bid - b.bid) / Math.min(a.bid, b.bid)) * 100, lang))}</Badge>
          </p>
        </div>
      )}
    </aside>
  )
}

function BidTable({ rows, analysed }: { rows: Row[]; analysed: boolean }) {
  const { t, lang } = useT()
  const columns = useMemo<TableColumn<Row>[]>(
    () => [
      { id: 'co', header: t.colCompany, card: 'title', min: 180, grow: 2, value: (r) => `${r.b.legal} ${r.b.name}` },
      { id: 'dir', header: t.colDirector, min: 140, grow: 1, value: (r) => r.b.director },
      { id: 'addr', header: t.colAddress, min: 180, grow: 2, value: (r) => r.b.address },
      { id: 'bid', header: t.colBid, numeric: true, card: 'meta', min: 130, value: (r) => r.bid ?? -1, cell: (r) => (r.bid != null ? rpFull(r.bid, lang) : t.noBid) },
      { id: 'low', header: t.colVsLow, numeric: true, min: 90, value: (r) => r.vsLow ?? -1, cell: (r) => (r.vsLow != null ? pct(r.vsLow, lang, true) : '—') },
      { id: 'wins', header: t.colWins, numeric: true, min: 70, value: (r) => r.b.wins },
    ],
    [t, lang],
  )
  return (
    <Table<Row>
      rows={rows}
      columns={columns}
      rowId={(r) => r.b.id}
      label={t.biddersTable}
      densityToggle={false}
      highlightNew={false}
      rowTone={(r) => (analysed && r.ring ? 'danger' : undefined)}
      toolbar={
        <span className="dk-ab-tt">
          <Icon name="users" size={16} />
          {t.biddersTable}
          <span className="dk-ab-simtag">{t.sim}</span>
        </span>
      }
    />
  )
}
