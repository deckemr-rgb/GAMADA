/**
 * demos/pantau-merek/BulkReply.tsx — the bulk reply sheet (lazy): tone (empatik · formal · santai), one personal draft
 * per selected review (replies.ts, from `replyInputs` + `mentionPlace`), drafts appear one by one within 2 s, "Kirim
 * n balasan" ⇒ ONE `brand.replied` (source pantau-merek) ⇒ replies under each review, "belum dibalas" −n and the
 * reputation up at once (a replied negative weighs × 0.5).
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Button, Drawer, motionMode } from '../../demo-kit/ui'
import { useShell } from '../../demo-kit/shell'
import { emit, useSession, world, type Bi } from '../../demo-kit/world'
import { mentionPlace, replyInputs, repliesPayload } from '../../demo-kit/world/usaha-pintar'
import { SLUG, afterPaint, reviewSelection, shopOf } from './model'
import { draftReply, signature, type ReplyIn, type Tone } from './replies'
import { fill, useStr } from './strings'

const S = {
  id: {
    title: 'Balas {n} ulasan',
    eyebrow: 'Draf AI · simulasi · bisa dikirim sekaligus',
    tone: 'Nada balasan',
    tones: { empatik: 'Empatik', formal: 'Formal', santai: 'Santai' } as Record<Tone, string>,
    to: 'Untuk @{a}',
    lang: 'bahasa ulasan: {l}',
    send: 'Kirim {n} balasan',
    sending: 'Menyusun draf…',
    sent: '{n} balasan terkirim',
    sentBody: 'Balasan tampil di bawah tiap ulasan; skor reputasi ikut naik.',
    none: 'Tidak ada ulasan terpilih yang masih perlu dibalas.',
  },
  en: {
    title: 'Reply to {n} reviews',
    eyebrow: 'AI drafts · simulated · send them all at once',
    tone: 'Reply tone',
    tones: { empatik: 'Empathetic', formal: 'Formal', santai: 'Casual' } as Record<Tone, string>,
    to: 'To @{a}',
    lang: 'review language: {l}',
    send: 'Send {n} replies',
    sending: 'Drafting…',
    sent: '{n} replies sent',
    sentBody: 'The replies show under each review; the reputation score rises with them.',
    none: 'None of the selected reviews still needs a reply.',
  },
}
const TONES: Tone[] = ['empatik', 'formal', 'santai']

function ToneGroup({ value, onChange, label, names }: { value: Tone; onChange: (t: Tone) => void; label: string; names: Record<Tone, string> }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TONES.indexOf(value)
    const n = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (i + 1) % 3 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (i + 2) % 3 : e.key === 'Home' ? 0 : e.key === 'End' ? 2 : -1
    if (n < 0) return
    e.preventDefault()
    onChange(TONES[n]!)
    refs.current[n]?.focus()
  }
  return (
    <div className="dk-seg dk-seg--md dk-pm-tone" role="radiogroup" aria-label={label} onKeyDown={onKey}>
      {TONES.map((t, i) => (
        <button
          key={t}
          ref={(el) => {
            refs.current[i] = el
          }}
          type="button"
          role="radio"
          aria-checked={value === t}
          tabIndex={value === t ? 0 : -1}
          onClick={() => onChange(t)}
          data-pm={`tone-${t}`}
        >
          <span>{names[t]}</span>
        </button>
      ))}
    </div>
  )
}

export default function BulkReply({ open, ids, alertId, onClose }: { open: boolean; ids: readonly string[]; alertId: string | null; onClose: () => void }) {
  const { lang } = useStr()
  const L = S[lang]
  const shell = useShell()
  const { role } = useSession()
  const owner = role === 'pemilik-toko'
  const [tone, setTone] = useState<Tone>('empatik')
  const [shown, setShown] = useState(0)
  const sent = useRef(false)
  const s = world.get()
  const shop = useMemo(() => shopOf(s), [s.meta.shopId]) // eslint-disable-line react-hooks/exhaustive-deps
  // the reviews still open, in the order they were picked
  const ms = useMemo(() => ids.map((id) => s.brandMentions.byId[id]).filter((m) => !!m && m.repliedAt == null), [ids, s.brandMentions])
  const inputs = useMemo<ReplyIn[]>(
    () =>
      ms.map((m) => {
        const r = replyInputs(m!)
        const p = mentionPlace(s, m!)
        return { handle: r.handle, item: r.item, orderCode: r.orderCode, desa: p.desa, kec: p.kecamatan, daysLate: r.daysLate, lang: r.lang, topic: r.topic, rating: r.rating }
      }),
    [ms], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const drafts = useMemo<Bi[]>(
    () =>
      inputs.map((x, i) => ({
        id: draftReply({ ...x, lang: 'id' }, tone, i, signature(owner, shop.name, shop.ownerFirst, 'id'), shop.market),
        en: draftReply({ ...x, lang: 'en' }, tone, i, signature(owner, shop.name, shop.ownerFirst, 'en'), shop.market),
      })),
    [inputs, tone, owner, shop],
  )
  // drafts land one by one (≤ 2 s for the batch); a tone switch redrafts
  useEffect(() => {
    if (!open) return
    if (motionMode() !== 'full') {
      setShown(drafts.length)
      return
    }
    setShown(0)
    const gap = Math.min(380, 2000 / Math.max(1, drafts.length))
    const ids2: number[] = []
    drafts.forEach((_, i) => ids2.push(window.setTimeout(() => setShown(i + 1), 250 + i * gap)))
    return () => ids2.forEach((x) => window.clearTimeout(x))
  }, [drafts, open])

  const ready = shown >= drafts.length && drafts.length > 0
  const send = () => {
    if (sent.current || !ready) return
    sent.current = true
    const mentionIds = ms.map((m) => m!.id)
    const payload = repliesPayload(mentionIds, tone, drafts, role, alertId ?? undefined)
    onClose()
    // the sheet closes in this frame; the one heavy emit (stream, reputation chart, KPIs) follows the paint (INP)
    afterPaint(() => {
      emit('brand.replied', payload, SLUG)
      reviewSelection.set([])
      shell.toast({ title: fill(L.sent, { n: mentionIds.length }), body: L.sentBody, tone: 'accent', icon: 'check' })
    })
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={fill(L.title, { n: ms.length })}
      eyebrow={L.eyebrow}
      width={620}
      className="dk-pm-bulk"
      footer={
        <div className="dk-pm-bulk-foot">
          <Button variant="primary" icon="send" onClick={send} disabled={!ready} busy={!ready && drafts.length > 0} data-pm="bulk-send">
            {ready ? fill(L.send, { n: ms.length }) : L.sending}
          </Button>
        </div>
      }
    >
      <ToneGroup value={tone} onChange={setTone} label={L.tone} names={L.tones} />
      {!ms.length && <p className="dk-pm-empty">{L.none}</p>}
      <ol className="dk-pm-drafts" aria-live="polite" data-pm="drafts">
        {drafts.slice(0, shown).map((d, i) => {
          const x = inputs[i]!
          return (
            <li key={`${ms[i]!.id}${tone}`} className="dk-pm-draft" data-id={ms[i]!.id}>
              <details open={shell.size !== 'sm' || i === 0}>
                <summary>
                  <b>{fill(L.to, { a: x.handle })}</b>
                  <span className="dk-pm-note">{fill(L.lang, { l: x.lang.toUpperCase() })}</span>
                </summary>
                <p className="dk-pm-m-text" lang={x.lang}>
                  {ms[i]!.text[x.lang]}
                </p>
                <p className="dk-pm-draft-t" lang={x.lang} data-pm="draft">
                  {d[x.lang]}
                </p>
              </details>
            </li>
          )
        })}
      </ol>
    </Drawer>
  )
}
