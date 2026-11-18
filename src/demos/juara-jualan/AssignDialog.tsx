/**
 * demos/juara-jualan/AssignDialog.tsx — "Tugaskan coaching" (lazy): three focus areas prefilled from the weakest
 * criteria, one example sentence each, baseline = the agent's avg14 on the team board (the roleplay compares with it).
 * Sends `coaching.assigned` (source juara-jualan).
 */
import { useMemo, useState } from 'react'
import { Button, Modal, Select } from '../../demo-kit/ui'
import { emit, useClock, useWorld, world, type CriterionKey } from '../../demo-kit/world'
import { CALL_CRITERIA, CRITERIA_KEYS, teamBoard } from '../../demo-kit/world/usaha-pintar'
import { exampleOf, focusOf } from './coach-text'
import { SLUG, useT } from './strings'

const S = {
  id: { title: (n: string) => `Coaching untuk ${n}`, desc: 'Tiga fokus terlemah sudah terisi dari skor. Ubah bila perlu, lalu kirim ke agen.', focus: (i: number) => `Fokus ${i + 1}`, ex: 'Contoh kalimat', base: 'Baseline (rata-rata 14 hari)', send: 'Tugaskan', cancel: 'Batal', dup: 'Pilih tiga fokus yang berbeda.', none: 'belum ada' },
  en: { title: (n: string) => `Coaching for ${n}`, desc: 'The three weakest focus areas are prefilled from the scores. Change them if needed, then send to the agent.', focus: (i: number) => `Focus ${i + 1}`, ex: 'Example sentence', base: 'Baseline (14-day average)', send: 'Assign', cancel: 'Cancel', dup: 'Pick three different focus areas.', none: 'none yet' },
}

export interface AssignDialogProps {
  agentId: string
  callId: string | null
  keys: CriterionKey[]
  onClose: () => void
  onDone: (coachingId: string, agentId: string) => void
}

export default function AssignDialog({ agentId, callId, keys, onClose, onDone }: AssignDialogProps) {
  const { lang } = useT()
  const L = S[lang]
  const agent = useWorld((s) => s.agentsSales.byId[agentId])
  const now = useClock().minutes
  const row = useWorld((s) => (agent ? teamBoard(s, now, agent.industry).find((r) => r.agent.id === agentId) : undefined))
  const [sel, setSel] = useState<CriterionKey[]>(() => {
    const out = [...keys]
    for (const k of CRITERIA_KEYS) if (out.length < 3 && !out.includes(k)) out.push(k)
    return out.slice(0, 3)
  })
  const distinct = new Set(sel).size === 3
  const baseline = row?.avg14 ?? agent?.baseline ?? 0
  const examples = useMemo(() => (agent ? sel.map((k) => exampleOf(k, agent)) : []), [agent, sel])
  if (!agent) return null
  const send = () => {
    if (!distinct) return
    const e = emit(
      'coaching.assigned',
      { agentId, focus: sel.map(focusOf), examples, focusKeys: sel, callId, baseline },
      SLUG,
    )
    const id = e.payload.id ?? ''
    onDone(id || (world.get().coachings.ids[0] ?? ''), agentId)
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={L.title(agent.name)}
      description={L.desc}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {L.cancel}
          </Button>
          <Button variant="primary" icon="send" onClick={send} disabled={!distinct} aria-describedby={distinct ? undefined : 'jj-assign-dup'}>
            {L.send}
          </Button>
        </>
      }
    >
      <div className="dk-jj-assign">
        <p className="dk-jj-muted">
          {L.base}: <b className="dk-num">{row?.avg14 ?? L.none}</b>
        </p>
        {sel.map((k, i) => (
          <div key={i} className="dk-jj-assign-r">
            <label className="dk-jj-h4" htmlFor={`jj-f-${i}`}>
              {L.focus(i)}
            </label>
            <Select
              id={`jj-f-${i}`}
              value={k}
              onChange={(e) => setSel(sel.map((x, j) => (j === i ? (e.target.value as CriterionKey) : x)))}
              options={CRITERIA_KEYS.map((c) => ({ value: c, label: CALL_CRITERIA[c][lang] }))}
            />
            <p className="dk-jj-fx">{focusOf(k)[lang]}</p>
            <p className="dk-jj-faint">
              {L.ex}: {examples[i]?.[lang]}
            </p>
          </div>
        ))}
        {!distinct && (
          <p id="jj-assign-dup" className="dk-jj-warn">
            {L.dup}
          </p>
        )}
      </div>
    </Modal>
  )
}
