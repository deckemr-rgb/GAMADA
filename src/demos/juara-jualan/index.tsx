/**
 * demos/juara-jualan — P10 Juara Jualan · QA & Coaching Tim Penjualan (spec §11 P10, brief docs/build/tahap3-plan.md §2).
 *
 * BrowserFrame "demo.gamada.id/juara-jualan": industry switch (Toko Bangunan default · Multifinance · Asuransi,
 * `?industry=tb|mf|asr`) + KPI strip (salesKpi), then the role's tabs. Supervisor Sales: Percakapan (live strip, list,
 * detail of the day's lowest call already open) · Tim · Coaching · Latihan · Tanya QA. Agen Sales ("Masuk sebagai"):
 * Coaching Saya · Latihan · Percakapan Saya. Secondary tabs load on intent. Emits call.scored, coaching.assigned and
 * roleplay.completed (source juara-jualan); consumes call.created (natural + C17 pre-order chats from Toko
 * Autopilot) and ?focus=<call | agent | staff | coaching id>.
 */
import { Suspense, lazy, startTransition, useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type SyntheticEvent } from 'react'
import type { DemoCanvasProps } from '../registry'
import { preloadNow, replaceQuery, useShell, type Mission } from '../../demo-kit/shell'
import { BrowserFrame } from '../../demo-kit/frames'
import { Kpi, KpiStrip, LoadingText, Segmented, Select, Skeleton, Tabs, flashNewRow, motionMode } from '../../demo-kit/ui'
import { clock, isEvent, onEvent, rows, setSession, shallowEqual, useClock, useEcosystemReady, useSession, useWorld, world, type CriterionKey, type Industry, type WorldState } from '../../demo-kit/world'
import { IND_OF_SHORT, IND_SHORT, PRAPESAN_CLIP, salesKpi, teamBoard } from '../../demo-kit/world/usaha-pintar'
import { SLUG, STRINGS, useT } from './strings'
import './juara-jualan.css'

/** the conversations view is the supervisor's landing (fetched at once there, never on the agent's landing) */
const loadCalls = () => import('./Calls')
const loadMf = () => import('./clips-mf')
const loadAsr = () => import('./clips-asr')
const Calls = lazy(() => loadCalls().then((m) => ({ default: m.Calls })))
const loadTeam = () => import('./Team')
const loadCoaching = () => import('./Coaching')
const loadAssign = () => import('./AssignDialog')
const loadAgent = () => import('./AgentHome')
const loadPractice = () => import('./Practice')
const loadQa = () => import('./AskQa')
const Team = lazy(loadTeam)
const Coaching = lazy(loadCoaching)
const AssignDialog = lazy(loadAssign)
const AgentHome = lazy(loadAgent)
const Practice = lazy(loadPractice)
const AskQa = lazy(loadQa)

type SupTab = 'calls' | 'team' | 'coaching' | 'practice' | 'qa'
type AgTab = 'mycoach' | 'practice' | 'mycalls'
type TabId = SupTab | AgTab
const LOADERS: Partial<Record<TabId, () => Promise<unknown>>> = { calls: loadCalls, team: loadTeam, coaching: loadCoaching, practice: loadPractice, qa: loadQa, mycoach: loadAgent, mycalls: loadCalls }
const TAB_PARAM: Record<TabId, string> = { calls: 'percakapan', team: 'tim', coaching: 'coaching', practice: 'latihan', qa: 'tanya-qa', mycoach: 'coaching-saya', mycalls: 'percakapan-saya' }
const PARAM_TAB = Object.fromEntries(Object.entries(TAB_PARAM).map(([k, v]) => [v, k])) as Record<string, TabId>

const qs = () => (typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search))
const bare = (id: string) => (id.includes(':') ? id.slice(id.indexOf(':') + 1) : id)

/** the agent "Masuk sebagai" starts with: newest coaching just assigned in the industry, else the new cashier (tb) */
function defaultAgent(s: WorldState, ind: Industry): string | null {
  const team = rows(s.agentsSales).filter((a) => a.industry === ind)
  const fresh = rows(s.coachings)
    .filter((c) => c.status === 'baru' && team.some((a) => a.id === c.agentId))
    .sort((a, b) => b.at - a.at)[0]
  if (fresh) return fresh.agentId
  if (ind === 'toko-bangunan') return s.meta.facts.up?.newCashierAgentId ?? team[0]?.id ?? null
  return team[0]?.id ?? null
}

/** the world clock starts on its own at 07.00 (×10) on a first visit, unless motion is reduced/off, a test drives it
 *  (?e2e=1), the page was opened at another time or it already ran this tab */
const AUTOPLAY_KEY = 'gamada:jj:autoplay'
function useAutoplay(ready: boolean, present: boolean) {
  useEffect(() => {
    if (!ready || present || motionMode() !== 'full' || qs().get('e2e') === '1') return
    try {
      if (window.sessionStorage.getItem(AUTOPLAY_KEY) === '1') return
    } catch {
      /* storage blocked: once per page load */
    }
    const id = window.setTimeout(() => {
      const c = clock.get()
      if (c.running || c.minutes !== 7 * 60 || world.status() !== 'ready') return
      clock.play()
      try {
        window.sessionStorage.setItem(AUTOPLAY_KEY, '1')
      } catch {
        /* ignore */
      }
    }, 1200)
    return () => window.clearTimeout(id)
  }, [ready, present])
}

function CallsSkel() {
  return (
    <div className="dk-jj-calls" aria-busy="true">
      <div className="dk-jj-left">
        <Skeleton lines={8} height={44} />
      </div>
      <div className="dk-jj-right">
        <Skeleton lines={10} height={22} />
      </div>
    </div>
  )
}

function Skel({ label }: { label: string }) {
  return (
    <BrowserFrame slug={SLUG} label={STRINGS.id.frame}>
      <div className="dk-jj" aria-busy="true">
        <p className="dk-jj-faint">{label}</p>
        <div className="dk-jj-head">
          <Skeleton height={40} width={360} radius={10} />
        </div>
        <div className="dk-jj-skel-kpis">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={84} radius={12} />
          ))}
        </div>
        <Skeleton height={44} radius={10} />
        <CallsSkel />
      </div>
    </BrowserFrame>
  )
}

export default function Canvas({ product }: DemoCanvasProps) {
  const ready = useEcosystemReady('usaha-pintar')
  const { t, lang } = useT()
  const shell = useShell()
  const { role, present } = useSession()
  const agentRole = role === 'agen-sales'
  const sm = shell.size === 'sm'
  useAutoplay(ready, present)

  const [industry, setIndustry] = useState<Industry>(() => IND_OF_SHORT[qs().get('industry') as 'tb'] ?? 'toko-bangunan')
  const [tab, setTab] = useState<TabId>(() => PARAM_TAB[qs().get('tab') ?? ''] ?? (agentRole ? 'mycoach' : 'calls'))
  const [sel, setSel] = useState<Partial<Record<Industry, string>>>({})
  const [drawer, setDrawer] = useState(false)
  const [seekDanger, setSeekDanger] = useState(0)
  const [agentAs, setAgentAs] = useState<string | null>(null)
  const [teamAgent, setTeamAgent] = useState<string | null>(null)
  const [coachHi, setCoachHi] = useState<string | null>(null)
  const [assign, setAssign] = useState<{ agentId: string; callId: string | null; keys: CriterionKey[] } | null>(null)
  const [practiceFor, setPracticeFor] = useState<{ agentId: string; coachingId: string | null } | null>(null)

  const now = useClock().minutes
  const kpi = useWorld((s) => (ready ? salesKpi(s, now, industry) : null), shallowEqual)
  const facts = useWorld((s) => s.meta.facts.up)
  const agentsAll = useWorld((s) => s.agentsSales)
  const coachings = useWorld((s) => s.coachings)
  const board = useWorld((s) => (ready ? teamBoard(s, now, industry) : null))

  // tabs valid for the role; a role switch lands on its first tab
  const tabs: TabId[] = agentRole ? ['mycoach', 'practice', 'mycalls'] : ['calls', 'team', 'coaching', 'practice', 'qa']
  const lastRole = useRef(agentRole)
  useEffect(() => {
    if (lastRole.current === agentRole) return
    lastRole.current = agentRole
    setTab(agentRole ? 'mycoach' : 'calls')
  }, [agentRole])
  const curTab: TabId = tabs.includes(tab) ? tab : tabs[0]!
  useEffect(() => {
    if (!ready) return
    replaceQuery({ tab: curTab === tabs[0] ? null : TAB_PARAM[curTab], industry: industry === 'toko-bangunan' ? null : IND_SHORT[industry] })
  }, [curTab, industry, ready]) // eslint-disable-line react-hooks/exhaustive-deps

  const changeTab = useCallback((v: TabId) => startTransition(() => setTab(v)), [])
  const changeInd = useCallback((v: Industry) => {
    if (v === 'multifinance') preloadNow(loadMf)
    else if (v === 'asuransi') preloadNow(loadAsr)
    startTransition(() => {
      setIndustry(v)
      setAgentAs(null)
      setTeamAgent(null)
    })
  }, [])
  const indIntent = (v: Industry) => {
    if (v === 'multifinance') preloadNow(loadMf)
    else if (v === 'asuransi') preloadNow(loadAsr)
  }
  const tabIntent = (e: SyntheticEvent) => {
    const tabEl = (e.target as Element).closest?.('[role="tab"]')
    const id = tabEl?.id.split('-t-')[1] as TabId | undefined
    const l = id ? LOADERS[id] : undefined
    if (l) preloadNow(l)
  }

  // the open conversation per industry (default: today's lowest call with an unanswered objection)
  const selected = sel[industry] ?? facts?.lowCall?.[industry] ?? null
  const selectCall = useCallback((id: string) => setSel((m) => ({ ...m, [world.get().calls.byId[id]?.industry ?? industry]: id })), [industry])

  // agent role: who is signed in
  const agentId = useMemo(() => {
    if (!ready) return null
    const s = world.get()
    if (agentAs && s.agentsSales.byId[agentAs]?.industry === industry) return agentAs
    return defaultAgent(s, industry)
  }, [ready, agentAs, industry, coachings, agentsAll]) // eslint-disable-line react-hooks/exhaustive-deps
  // pin the default once shown: finishing a practice must not swap the signed-in agent under the visitor
  useEffect(() => {
    if (agentRole && !agentAs && agentId) setAgentAs(agentId)
  }, [agentRole, agentAs, agentId])
  const myRow = board?.find((b) => b.agent.id === agentId) ?? null

  const openAssign = useCallback((agent: string, callId: string | null, keys: CriterionKey[]) => {
    preloadNow(loadAssign)
    setAssign({ agentId: agent, callId, keys })
  }, [])
  const assignIntent = useCallback(() => preloadNow(loadAssign), [])
  const asAgent = useCallback(
    (id: string) => {
      const a = world.get().agentsSales.byId[id]
      if (a && a.industry !== industry) setIndustry(a.industry)
      setAgentAs(id)
      setSession({ role: 'agen-sales' })
    },
    [industry],
  )
  const practice = useCallback((agent: string, coachingId: string | null) => {
    setPracticeFor({ agentId: agent, coachingId })
    startTransition(() => setTab('practice'))
  }, [])

  // ?focus= arrivals: call → its industry + detail; agent / staff → Tim (agent role: signed in as them); coaching →
  // its card; anything else → default tab + "not found"
  const { focus, clearFocus, toast } = shell
  const focusDone = useRef<string | null>(null)
  useEffect(() => {
    if (!focus || !ready) return
    if (focusDone.current === focus) return
    focusDone.current = focus
    const s = world.get()
    const id = bare(focus)
    const call = s.calls.byId[id]
    const staffAgent = s.staff.byId[id]?.agentId ?? null
    const agent = s.agentsSales.byId[id] ?? (staffAgent ? s.agentsSales.byId[staffAgent] : undefined)
    const coach = s.coachings.byId[id]
    if (call) {
      setIndustry(call.industry)
      setSel((m) => ({ ...m, [call.industry]: call.id }))
      if (agentRole) {
        setAgentAs(call.agentId)
        setTab('mycalls')
      } else setTab('calls')
      if (sm) setDrawer(true)
      window.setTimeout(() => {
        const row = document.querySelector<HTMLElement>(`[data-call-row="${call.id}"]`)
        row?.scrollIntoView({ block: 'nearest' })
        const box = document.querySelector<HTMLElement>(`.dk-jj-detail[data-call="${call.id}"]`) ?? row
        if (box) flashNewRow(box)
      }, 400)
    } else if (agent) {
      setIndustry(agent.industry)
      if (agentRole) {
        setAgentAs(agent.id)
        setTab('mycoach')
      } else {
        setTeamAgent(agent.id)
        setTab('team')
      }
    } else if (coach) {
      const a = s.agentsSales.byId[coach.agentId]
      if (a) setIndustry(a.industry)
      if (agentRole) {
        setAgentAs(coach.agentId)
        setTab('mycoach')
      } else setTab('coaching')
      setCoachHi(coach.id)
    } else {
      setTab(agentRole ? 'mycoach' : 'calls')
      toast({ title: STRINGS[lang].notFound, body: STRINGS[lang].notFoundBody, tone: 'warn' })
    }
    clearFocus()
  }, [focus, ready]) // eslint-disable-line react-hooks/exhaustive-deps

  // a pre-order chat from Toko Autopilot (C17) lands here: tell the supervisor and offer to open it
  const langRef = useRef(lang)
  langRef.current = lang
  const agentRoleRef = useRef(agentRole)
  agentRoleRef.current = agentRole
  useEffect(
    () =>
      onEvent('*', (e) => {
        if (!isEvent(e, 'call.created') || e.payload.transcript !== PRAPESAN_CLIP) return
        window.setTimeout(() => {
          const s = world.get()
          const c = (e.payload.id && s.calls.byId[e.payload.id]) || rows(s.calls).find((x) => x.refId === e.payload.refId)
          if (!c) return
          const L = STRINGS[langRef.current]
          const code = (c.refId && s.purchaseOrders.byId[c.refId]?.code) || c.id
          toast({
            title: L.prapesanToast(code),
            body: L.prapesanBody(s.agentsSales.byId[c.agentId]?.name ?? ''),
            tone: 'accent',
            icon: 'chat',
            action: {
              label: L.openIt,
              onClick: () => {
                setIndustry('toko-bangunan')
                setSel((m) => ({ ...m, 'toko-bangunan': c.id }))
                setTab(agentRoleRef.current ? 'mycalls' : 'calls')
                if (agentRoleRef.current) setAgentAs(c.agentId)
                setDrawer(true)
              },
            },
          })
        }, 0)
      }),
    [toast],
  )

  if (!agentRole) preloadNow(loadCalls)
  if (!ready) return <Skel label={t.loading} />

  const indOpts = (['toko-bangunan', 'multifinance', 'asuransi'] as Industry[]).map((v) => ({ value: v, label: t.ind[IND_SHORT[v]] }))
  const teamAgents = rows(agentsAll).filter((a) => a.industry === industry)
  const tabLabel: Record<TabId, string> = { calls: t.tCalls, team: t.tTeam, coaching: t.tCoach, practice: t.tPractice, qa: t.tQa, mycoach: t.tMyCoach, mycalls: t.tMyCalls }
  const icons: Record<TabId, 'chat' | 'users' | 'star' | 'mic' | 'spark' | 'list'> = { calls: 'chat', team: 'users', coaching: 'star', practice: 'mic', qa: 'spark', mycoach: 'star', mycalls: 'list' }
  const fallback = curTab === 'calls' || curTab === 'mycalls' ? <CallsSkel /> : <LoadingText>{t.loading}</LoadingText>

  let body: ReactNode = null
  if (curTab === 'calls' || curTab === 'mycalls')
    body = (
      <Calls
        industry={industry}
        agentId={curTab === 'mycalls' ? agentId : null}
        supervisor={!agentRole}
        sm={sm}
        selected={curTab === 'mycalls' && selected && world.get().calls.byId[selected]?.agentId !== agentId ? null : selected}
        onSelect={selectCall}
        drawer={drawer}
        onDrawer={setDrawer}
        seekDanger={seekDanger}
        onSeekDanger={() => setSeekDanger((n) => n + 1)}
        onAssign={openAssign}
        onAssignIntent={assignIntent}
      />
    )
  else if (curTab === 'team') body = <Team industry={industry} selected={teamAgent} onSelect={setTeamAgent} onAssign={openAssign} onAssignIntent={assignIntent} />
  else if (curTab === 'coaching') body = <Coaching industry={industry} highlight={coachHi} onAssign={openAssign} onAssignIntent={assignIntent} onPractice={practice} onAsAgent={asAgent} />
  else if (curTab === 'practice')
    body = (
      <Practice
        industry={industry}
        agentId={agentRole ? agentId : (practiceFor?.agentId && world.get().agentsSales.byId[practiceFor.agentId]?.industry === industry ? practiceFor.agentId : null)}
        coachingId={practiceFor?.coachingId ?? null}
        fixedAgent={agentRole}
      />
    )
  else if (curTab === 'qa') body = <AskQa industry={industry} openCall={selected} onAssign={openAssign} onPractice={() => changeTab('practice')} />
  else if (curTab === 'mycoach' && agentId) body = <AgentHome agentId={agentId} onPractice={practice} onCalls={() => changeTab('mycalls')} />

  return (
    <BrowserFrame slug={`${SLUG}${curTab !== tabs[0] ? `?tab=${TAB_PARAM[curTab]}` : ''}`} label={t.frame}>
      <div className="dk-jj" data-product={product} data-role={agentRole ? 'agen' : 'supervisor'}>
        <div className="dk-jj-head">
          {sm ? (
            <label className="dk-jj-indsel">
              <span className="dk-sr">{t.industry}</span>
              <Select value={industry} onChange={(e) => changeInd(e.target.value as Industry)} options={indOpts} aria-label={t.industry} onFocus={() => indIntent('multifinance')} onPointerDown={() => (indIntent('multifinance'), indIntent('asuransi'))} />
            </label>
          ) : (
            <Segmented<Industry> label={t.industry} value={industry} onChange={changeInd} onIntent={indIntent} options={indOpts} />
          )}
          {agentRole && (
            <div className="dk-jj-as">
              <label className="dk-jj-aslabel">
                <span className="dk-jj-faint">{t.roleHint}</span>
                <Select value={agentId ?? ''} onChange={(e) => setAgentAs(e.target.value)} options={teamAgents.map((a) => ({ value: a.id, label: a.name }))} aria-label={t.roleHint} />
              </label>
              {myRow && board && (
                <span className="dk-jj-rank">
                  {lang === 'id' ? `Anda #${myRow.rank} dari ${board.length}` : `You are #${myRow.rank} of ${board.length}`}
                </span>
              )}
            </div>
          )}
        </div>
        {kpi && (
          <KpiStrip label={t.kpis} className="dk-jj-kpis">
            <Kpi label={t.kToday} value={kpi.today} wrapLabel />
            <Kpi label={t.kAvg} value={kpi.avgScore ?? 0} unit="/100" caption={t.sim} wrapLabel />
            <Kpi label={t.kCoach} value={kpi.needCoaching} wrapLabel />
            <Kpi label={t.kBreach} value={kpi.breaches} wrapLabel />
          </KpiStrip>
        )}
        <div className="dk-jj-tabwrap" onPointerOver={tabIntent} onFocus={tabIntent} onTouchStart={tabIntent}>
          <Tabs<TabId> label={t.tabs} value={curTab} onChange={changeTab} items={tabs.map((id) => ({ id, label: tabLabel[id], icon: icons[id] }))}>
            <Suspense fallback={fallback}>{body}</Suspense>
          </Tabs>
        </div>
      </div>
      {assign && (
        <Suspense fallback={null}>
          <AssignDialog
            agentId={assign.agentId}
            callId={assign.callId}
            keys={assign.keys}
            onClose={() => setAssign(null)}
            onDone={(coachingId, agent) => {
              setAssign(null)
              setCoachHi(coachingId)
              const name = world.get().agentsSales.byId[agent]?.name ?? ''
              toast({
                title: langRef.current === 'id' ? `Coaching untuk ${name} dikirim` : `Coaching for ${name} sent`,
                body: langRef.current === 'id' ? 'Kartu baru muncul di Coaching Saya milik agen.' : "A new card appears in the agent's My coaching.",
                tone: 'accent',
                icon: 'star',
                action: { label: langRef.current === 'id' ? 'Lihat sebagai Agen Sales' : 'View as Sales Agent', onClick: () => asAgent(agent) },
              })
            }}
          />
        </Suspense>
      )}
    </BrowserFrame>
  )
}

/* ------------------------------------------------------------------ guide missions (spec §11 P10) */

export const missions: readonly Mission[] = [
  {
    id: 'momen',
    label: { id: 'Loncat ke momen bermasalah', en: 'Jump to the problem moment' },
    hint: {
      id: 'Di detail percakapan, klik penanda merah pada rekaman (atau kutipan bukti yang merah): rekaman loncat ke detik masalah.',
      en: 'In the conversation detail, click the red marker on the recording (or the red evidence quote): the recording jumps to the problem second.',
    },
    hintSm: {
      id: 'Ketuk chip merah “Momen” di percakapan teratas: detail terbuka tepat di detik masalah.',
      en: 'Tap the red “Moments” chip on the top conversation: the detail opens right at the problem second.',
    },
    target: '[data-hotspot="jj-marker-danger"]',
  },
  {
    id: 'nilai',
    label: { id: 'Nilai satu percakapan', en: 'Score a conversation' },
    hint: {
      id: 'Pilih percakapan “Belum dinilai”, lalu tekan “Nilai sekarang” (atau ubah skor per kriteria).',
      en: 'Pick a “Not scored” conversation, then press “Score now” (or edit the score per criterion).',
    },
    done: (e) => isEvent(e, 'call.scored') && e.source === SLUG,
  },
  {
    id: 'coaching',
    label: { id: 'Tugaskan coaching', en: 'Assign coaching' },
    hint: {
      id: '“Tugaskan coaching” di detail atau tab Coaching: 3 fokus terlemah sudah terisi, tinggal kirim.',
      en: '“Assign coaching” in the detail or the Coaching tab: the 3 weakest focus areas are prefilled, just send.',
    },
    target: '[data-jj="assign"]',
    done: (e) => isEvent(e, 'coaching.assigned') && e.source === SLUG,
  },
  {
    id: 'agen',
    label: { id: 'Lihat kartu coaching sebagai agen', en: 'See the coaching card as the agent' },
    hint: {
      id: 'Ganti peran ke Agen Sales di bilah atas (atau tombol di toast): kartu coaching terbaru muncul.',
      en: 'Switch the role to Sales Agent in the top bar (or the toast button): the newest coaching card appears.',
    },
    hintSm: { id: 'Buka ⋯ → Peran → Agen Sales.', en: 'Open ⋯ → Role → Sales Agent.' },
  },
  {
    id: 'latihan',
    label: { id: 'Selesaikan latihan roleplay', en: 'Finish a roleplay practice' },
    hint: {
      id: 'Tab Latihan: balas pelanggan simulasi minimal 6 giliran (ketik atau pilih saran), lalu lihat skornya.',
      en: 'Practice tab: answer the simulated customer for at least 6 turns (type or pick a suggestion), then see the score.',
    },
    done: (e) => isEvent(e, 'roleplay.completed') && e.source === SLUG && e.payload.turns >= 6,
  },
]

export const hotspot = {
  target: '[data-hotspot="jj-marker-danger"]',
  label: { id: 'Klik momen merah: rekaman loncat ke detik masalah', en: 'Click the red moment: the recording jumps to the problem second' },
}
