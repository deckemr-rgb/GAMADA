/**
 * InstructionDialog (lazy) — "Beri instruksi" (spec P2 step 5). Pick an AI suggestion derived from today's world
 * (or the item / hoax / AI draft that opened the dialog), or write one; choose the agencies and the deadline; send.
 * Sending emits `instruction.issued` (source meja-pimpinan); the world turns it into a disposition letter and one
 * task per agency in Naskah Pintar (chain C7). The dialog then shows exactly what was created, read back from the
 * world, with a link to the letter in Naskah Pintar.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { PRODUCT_BY_SLUG } from '../../content/products'
import AppLink from '../../components/AppLink'
import { demoHref } from '../../demo-kit/shell'
import { Button, Chip, Field, Icon, Modal, Segmented, Textarea, animatePose, motionMode, type IconName } from '../../demo-kit/ui'
import { DAY_MIN, clock, emit, hhmm, settled, useSession, world, type Bi, type Minutes } from '../../demo-kit/world'
import { opdShort, withControls } from './data'
import { leaderIdeas, presetFor, type Idea } from './ideas'
import type { InstructionPreset } from './index'

const D = {
  title: { id: 'Beri instruksi', en: 'Issue an instruction' },
  desc: { id: 'Instruksi menjadi disposisi di Naskah Pintar dan tugas di setiap OPD tujuan.', en: 'The instruction becomes a disposition in Naskah Pintar and a task at every agency addressed.' },
  ideas: { id: 'Saran AI dari kondisi hari ini', en: "AI suggestions from today's situation" },
  from: { id: 'dari', en: 'from' },
  text: { id: 'Isi instruksi', en: 'Instruction' },
  textHint: { id: 'Jelas dan terukur: apa, di mana, kapan dilaporkan.', en: 'Clear and measurable: what, where, when to report.' },
  opds: { id: 'OPD tujuan', en: 'Agencies' },
  opdsHint: { id: 'Pilih minimal satu.', en: 'Pick at least one.' },
  due: { id: 'Tenggat', en: 'Deadline' },
  dToday: { id: 'Hari ini 16.00', en: 'Today 16:00' },
  dTomorrow: { id: 'Besok 16.00', en: 'Tomorrow 16:00' },
  d3: { id: '3 hari', en: '3 days' },
  cancel: { id: 'Batal', en: 'Cancel' },
  send: { id: 'Kirim instruksi', en: 'Send instruction' },
  sending: { id: 'Mengirim…', en: 'Sending…' },
  sentTitle: { id: 'Instruksi diteruskan', en: 'Instruction forwarded' },
  s1: { id: 'Instruksi tercatat pukul {t}', en: 'Instruction recorded at {t}' },
  s2: { id: 'Nota dinas {n} terdisposisi di Naskah Pintar', en: 'Memo {n} dispositioned in Naskah Pintar' },
  s3: { id: '{n} tugas dibuat: {o}', en: '{n} tasks created: {o}' },
  s4: { id: 'Tenggat {d}, PIC: kepala OPD masing-masing', en: 'Due {d}, owner: each agency head' },
  open: { id: 'Buka di Naskah Pintar', en: 'Open in Naskah Pintar' },
  done: { id: 'Selesai', en: 'Done' },
  another: { id: 'Instruksi lain', en: 'Another instruction' },
  marketOp: { id: 'menyetujui rekomendasi operasi pasar', en: 'approves the market-operation recommendation' },
  sendTo: { id: 'Akan dikirim ke:', en: 'Will be sent to:' },
  sendNone: { id: 'Belum ada OPD tujuan: pilih minimal satu.', en: 'No agency yet: pick at least one.' },
}
type Due = 'today' | 'tomorrow' | 'd3'

function dueAt(d: Due, now: Minutes): Minutes {
  const day = Math.floor(now / DAY_MIN) * DAY_MIN
  return d === 'today' ? Math.max(now + 60, day + 16 * 60) : d === 'tomorrow' ? day + DAY_MIN + 16 * 60 : day + 3 * DAY_MIN + 16 * 60
}

/** let the browser paint the pressed / busy state before the world work (keeps the click's next paint fast, INP) */
const afterPaint = () => new Promise<void>((r) => window.requestAnimationFrame(() => window.setTimeout(r, 0)))

export default function InstructionDialog({ open, onClose, preset: given }: { open: boolean; onClose: () => void; preset?: InstructionPreset }) {
  // the world minute when the dialog opened (suggestions and deadlines are fixed for the life of the dialog)
  const [now] = useState(() => clock.get().minutes)
  // a briefing item becomes its suggestion here (lazy chunk), then the dialog works on a plain preset
  const [preset] = useState<InstructionPreset | undefined>(() => (given?.item ? presetFor(world.get(), now, given.item) : given))
  const { lang } = useI18n()
  const session = useSession()
  const ideas = useMemo<Idea[]>(() => {
    const list = leaderIdeas(world.get(), now)
    if (preset?.text) return [{ id: 'preset', text: preset.text, opdIds: preset.opdIds ?? [], refs: preset.refs ?? [], ...(preset.origin ? { origin: preset.origin } : {}), source: 'meja-pimpinan' as const }, ...list.filter((i) => i.text.id !== preset.text!.id)].slice(0, 6)
    return list
    // ideas are fixed for the life of the dialog
  }, [])
  const first = ideas[0]
  const [pick, setPick] = useState<string | null>(preset?.text ? 'preset' : null)
  const [text, setText] = useState<Bi>(preset?.text ?? { id: '', en: '' })
  const [opds, setOpds] = useState<string[]>(preset?.opdIds ?? [])
  // urgent wording (a hoax clarification, "hari ini", "segera") defaults to today
  const [due, setDue] = useState<Due>(() => given?.due ?? preset?.due ?? (/hari ini|segera|darurat|today|urgent|immediately/i.test(preset?.text?.[lang] ?? '') ? 'today' : 'tomorrow'))
  // the agencies were filled by a suggestion (not chosen by hand): typing a new text clears them once
  const autoOpds = useRef(true)
  const [state, setState] = useState<'edit' | 'sending' | 'sent'>('edit')
  const [result, setResult] = useState<{ at: Minutes; letter: string | null; letterId: string | null; tasks: string[]; dueAt: Minutes } | null>(null)
  // agency order fixed when the dialog opens (pre-selected first), so chips do not jump while toggling
  const allOpds = useMemo(() => { const init = preset?.opdIds ?? ideas[0]?.opdIds ?? []; return [...world.get().region.opd].sort((a, b) => Number(init.includes(b.id)) - Number(init.includes(a.id))) }, [])
  const choose = (i: Idea) => {
    setPick(i.id)
    setText(i.text)
    setOpds(i.opdIds)
    autoOpds.current = true
  }
  useEffect(() => {
    if (!preset && first && !pick) choose(first)
    // pre-select the first suggestion once
  }, [])

  const chosen = ideas.find((i) => i.id === pick)
  const canSend = !!text[lang].trim() && opds.length > 0 && state === 'edit'
  const send = async () => {
    if (!canSend) return
    setState('sending')
    await afterPaint()
    const due0 = dueAt(due, clock.get().minutes)
    const custom = chosen && chosen.text[lang] === text[lang] ? chosen.text : { id: text[lang], en: text[lang] }
    const refs = chosen?.refs ?? preset?.refs ?? []
    const origin = chosen?.origin ?? preset?.origin
    const e = emit('instruction.issued', { text: custom, opdIds: opds, dueAt: due0, refs, ...(origin ? { origin } : {}) }, 'meja-pimpinan')
    await settled()
    const s = world.get()
    const ins = e.payload.id ? s.instructions.byId[e.payload.id] : undefined
    const letter = ins?.letterId ? s.letters.byId[ins.letterId] : undefined
    setResult({ at: e.at, letter: letter?.number ?? null, letterId: letter?.id ?? null, tasks: ins?.actionItemIds ?? [], dueAt: due0 })
    setState('sent')
  }

  const stepsRef = useRef<HTMLOListElement>(null)
  useLayoutEffect(() => {
    if (state !== 'sent' || !stepsRef.current || motionMode() === 'static') return
    const tw = animatePose(Array.from(stepsRef.current.children), { x: -8, opacity: 0 }, { x: 0, opacity: 1 }, { duration: 0.3, stagger: 0.18, ease: 'power2.out' })
    return () => tw.kill()
  }, [state])

  const dueText = (m: Minutes) => {
    const d = Math.floor(m / DAY_MIN) - Math.floor(now / DAY_MIN)
    return `${d === 0 ? (lang === 'id' ? 'hari ini' : 'today') : d === 1 ? (lang === 'id' ? 'besok' : 'tomorrow') : lang === 'id' ? `${d} hari lagi` : `in ${d} days`} ${hhmm(m)}`
  }

  if (state === 'sent' && result) {
    const tasks = result.tasks.map((id) => world.get().actionItems.byId[id]).filter(Boolean)
    return (
      <Modal
        open={open}
        onClose={onClose}
        title={D.sentTitle[lang]}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setState('edit'); setResult(null); setPick(null); setText({ id: '', en: '' }); setOpds([]) }}>
              {D.another[lang]}
            </Button>
            <Button variant="primary" onClick={onClose}>
              {D.done[lang]}
            </Button>
          </>
        }
      >
        <ol ref={stepsRef} className="dk-mp-sent" aria-live="polite">
          <li>
            <Icon name="checkCircle" size={16} />
            {D.s1[lang].replace('{t}', hhmm(result.at))}
            <span className="dk-mp-sent-q">“{text[lang]}”</span>
          </li>
          <li>
            <Icon name="stamp" size={16} />
            {D.s2[lang].replace('{n}', result.letter ?? '–')}
          </li>
          <li>
            <Icon name="kanban" size={16} />
            {D.s3[lang].replace('{n}', String(tasks.length)).replace('{o}', tasks.map((t) => opdShort(world.get(), t!.opdId)).join(', '))}
          </li>
          <li>
            <Icon name="clock" size={16} />
            {D.s4[lang].replace('{d}', dueText(result.dueAt))}
          </li>
        </ol>
        {result.letterId && (
          <AppLink className="dk-mp-linkbtn is-big" to={withControls(demoHref('naskah-pintar', session, result.letterId))}>
            <Icon name={PRODUCT_BY_SLUG['naskah-pintar'].icon as IconName} size={14} />
            {D.open[lang]}
            <Icon name="arrowUpRight" size={12} />
          </AppLink>
        )}
      </Modal>
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={D.title[lang]}
      description={D.desc[lang]}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {D.cancel[lang]}
          </Button>
          <Button variant="primary" icon="send" onClick={() => void send()} disabled={!canSend} busy={state === 'sending'} data-mp="send-instruction">
            {state === 'sending' ? D.sending[lang] : D.send[lang]}
          </Button>
        </>
      }
    >
      <div className="dk-mp-ins">
        {ideas.length > 0 && (
          <fieldset className="dk-mp-ideas">
            <legend>{D.ideas[lang]}</legend>
            {ideas.map((i) => (
              <button key={i.id} type="button" className={`dk-mp-idea${pick === i.id ? ' is-on' : ''}`} aria-pressed={pick === i.id} onClick={() => choose(i)}>
                <Icon name={i.source === 'meja-pimpinan' ? 'spark' : (PRODUCT_BY_SLUG[i.source].icon as IconName)} size={14} />
                <span className="dk-mp-idea-t">{i.text[lang]}</span>
                <span className="dk-mp-idea-m">
                  {i.opdIds.map((o) => opdShort(world.get(), o)).join(', ')}
                  {i.source !== 'meja-pimpinan' ? ` · ${D.from[lang]} ${PRODUCT_BY_SLUG[i.source].name}` : ''}
                  {i.origin?.startsWith('marketOps:') ? ` · ${D.marketOp[lang]}` : ''}
                </span>
              </button>
            ))}
          </fieldset>
        )}
        <Field label={D.text[lang]} hint={D.textHint[lang]}>
          {(ids) => (
            <Textarea
              {...ids}
              rows={3}
              value={text[lang]}
              onChange={(e) => {
                // a hand-written instruction starts with no agencies, so a tap on a chip adds it (never removes a
                // suggestion's pre-selection by surprise)
                if (pick !== null && autoOpds.current) setOpds([])
                autoOpds.current = false
                setPick(null)
                setText({ id: e.target.value, en: e.target.value })
              }}
            />
          )}
        </Field>
        <fieldset className="dk-mp-opds">
          <legend>
            {D.opds[lang]} <span className="dk-mp-meta">{D.opdsHint[lang]}</span>
          </legend>
          <div className="dk-mp-chips">
            {allOpds.map((o) => (
              <Chip key={o.id} selected={opds.includes(o.id)} icon={opds.includes(o.id) ? 'check' : undefined} onToggle={() => { autoOpds.current = false; setOpds((l) => (l.includes(o.id) ? l.filter((x) => x !== o.id) : [...l, o.id])) }}>
                {o.short}
              </Chip>
            ))}
          </div>
        </fieldset>
        <p className="dk-mp-sendto" aria-live="polite">
          <Icon name="send" size={12} />
          {opds.length ? `${D.sendTo[lang]} ${opds.map((o) => opdShort(world.get(), o)).join(', ')}` : D.sendNone[lang]}
        </p>
        <div className="dk-mp-due">
          <span className="dk-mp-due-l">{D.due[lang]}</span>
          <Segmented<Due>
            size="sm"
            label={D.due[lang]}
            value={due}
            onChange={setDue}
            options={[
              { value: 'today', label: dueAt('today', now) > Math.floor(now / DAY_MIN) * DAY_MIN + 16 * 60 ? `${lang === 'id' ? 'Hari ini' : 'Today'} ${hhmm(dueAt('today', now)).replace(':', lang === 'id' ? '.' : ':')}` : D.dToday[lang] },
              { value: 'tomorrow', label: D.dTomorrow[lang] },
              { value: 'd3', label: D.d3[lang] },
            ]}
          />
        </div>
      </div>
    </Modal>
  )
}
