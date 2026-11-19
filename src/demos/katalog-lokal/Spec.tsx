/**
 * Spec (lazy "composer AI" chunk, preloaded on composer hover/focus): the parser turns the text into a need-spec
 * card (items as dropping chips, qty / kecamatan / days editable), the AI (sim or live, via useAiChat) words a short
 * note, a duplicate guard warns about a similar open need, and "Terbitkan kebutuhan" emits ONE need.created (source
 * katalog-lokal, by 'ai'). Local numbers always win over the AI's wording.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useAiChat } from '../../demo-kit/ai/chat'
import { Button, LoadingText, Select, dropChips } from '../../demo-kit/ui'
import { clock, emit, useSession, useWorld, world, type Bi, type WorldState } from '../../demo-kit/world'
import { needList } from '../../demo-kit/world/pasar-daerah'
import { useI18n } from '../../lib/i18n'
import { parseNeed, type ParsedItem } from './parse'
import { aiContext } from './scenario'
import { SLUG, kecName, nf, rp } from './model'

const S = {
  id: {
    title: 'Spesifikasi kebutuhan',
    ai: 'AI simulasi',
    live: 'AI Live',
    thinking: 'AI menyusun spesifikasi…',
    item: 'Barang',
    qty: 'Jumlah',
    remove: (n: string) => `Hapus ${n}`,
    kec: 'Kecamatan',
    pickKec: 'Pilih kecamatan',
    days: 'Kirim dalam (hari)',
    emergency: 'Darurat',
    budget: 'Pagu',
    sim: 'simulasi',
    publish: 'Terbitkan kebutuhan',
    cancel: 'Batal',
    noItems: 'Tidak ada barang yang dikenali; tulis jumlah dan nama barang.',
    noKec: 'Kecamatan belum dikenali: pilih dulu dari daftar.',
    dup: (code: string) => `Kebutuhan serupa sudah terbuka: ${code}`,
    dupWhy: 'Ada kebutuhan serupa yang masih terbuka: buka yang lama atau tekan "Tetap terbitkan".',
    open: 'Buka',
    force: 'Tetap terbitkan',
    sent: 'Diterbitkan',
    title1: (items: string, kec: string, em: boolean) => `${em ? 'Darurat: ' : ''}${items} untuk Kec. ${kec}`,
  },
  en: {
    title: 'Need specification',
    ai: 'Simulated AI',
    live: 'Live AI',
    thinking: 'The AI is drafting the specification…',
    item: 'Item',
    qty: 'Quantity',
    remove: (n: string) => `Remove ${n}`,
    kec: 'District',
    pickKec: 'Pick a district',
    days: 'Deliver within (days)',
    emergency: 'Emergency',
    budget: 'Budget',
    sim: 'simulated',
    publish: 'Publish the need',
    cancel: 'Cancel',
    noItems: 'No known item found; write the quantity and the item.',
    noKec: 'The district was not recognised: pick it from the list first.',
    dup: (code: string) => `A similar need is already open: ${code}`,
    dupWhy: 'A similar need is still open: open the existing one or press "Publish anyway".',
    open: 'Open',
    force: 'Publish anyway',
    sent: 'Published',
    title1: (items: string, kec: string, em: boolean) => `${em ? 'Emergency: ' : ''}${items} for ${kec}`,
  },
}
const whole = (s: WorldState) => s

export default function Spec({ text, onPublished, onOpenNeed, onCancel }: { text: string; onPublished: (id: string) => void; onOpenNeed: (id: string) => void; onCancel: () => void }) {
  const { lang } = useI18n()
  const L = S[lang]
  const s = useWorld(whole)
  const session = useSession()
  const p0 = useMemo(() => parseNeed(text, world.get()), [text])
  const [items, setItems] = useState<ParsedItem[]>(p0.items)
  const [kec, setKec] = useState(p0.kecamatanId ?? '')
  const [days, setDays] = useState(p0.deliveryDays)
  const [emergency, setEmergency] = useState(p0.emergency)
  const [force, setForce] = useState(false)
  const [done, setDone] = useState(false)
  const sent = useRef(false)
  const chipsRef = useRef<HTMLUListElement>(null)
  const chat = useAiChat(SLUG, { mode: session.aiMode, getContext: () => aiContext(world.get(), null, lang, clock.get().minutes) })

  useEffect(() => {
    void chat.send(text, { maxMs: 1400 })
    return () => chat.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useLayoutEffect(() => (chipsRef.current ? dropChips(chipsRef.current) : undefined), [])

  const cats = [...new Set(items.map((i) => i.category))].sort().join()
  const dup = kec && items.length ? needList(s, clock.get().minutes, 'terbuka').find((n) => n.kecamatanId === kec && [...new Set(n.items.map((i) => i.category))].sort().join() === cats) : undefined
  const reason = !items.length ? L.noItems : !kec ? L.noKec : dup && !force ? L.dupWhy : null

  const publish = () => {
    if (reason || sent.current) return
    sent.current = true
    const k = kecName(world.get(), kec)
    const list = (lg: 'id' | 'en') => items.map((i) => `${i.name[lg]} ${nf(lg, i.qty)} ${i.unit}`).join(' + ')
    const title: Bi = { id: S.id.title1(list('id'), k, emergency), en: S.en.title1(list('en'), k, emergency) }
    const e = emit(
      'need.created',
      { title, items: items.map((i) => ({ name: i.name, category: i.category, qty: i.qty, unit: i.unit, spec: i.spec })), kecamatanId: kec, deadlineDays: days, emergency, cause: null, by: 'ai', ...(p0.budget ? { budget: p0.budget } : {}) },
      SLUG,
    )
    setDone(true)
    if (e.payload.id) onPublished(e.payload.id)
  }
  const setQty = (i: number, v: number) => setItems((xs) => xs.map((x, k) => (k === i ? { ...x, qty: Math.max(1, Math.min(1_000_000, Math.round(v) || 1)) } : x)))
  const msg = chat.last
  const mode = session.aiMode === 'live' && !chat.fellBack ? L.live : L.ai

  return (
    <section className="dk-kl-specdraft" aria-labelledby="kl-spec-h" data-kl="spec">
      <h3 id="kl-spec-h">{L.title}</h3>
      <div className="dk-kl-ainote" aria-live="polite">
        <span className="dk-kl-chip">{mode}</span>
        {msg?.content ? <p>{msg.content}</p> : <LoadingText>{L.thinking}</LoadingText>}
      </div>
      <ul className="dk-kl-specitems" ref={chipsRef}>
        {items.map((it, i) => (
          <li key={`${it.category}-${i}`} data-kl-item={it.category}>
            <b>{it.name[lang]}</b>
            <label>
              <span className="dk-sr">
                {L.qty} {it.name[lang]}
              </span>
              <input type="number" inputMode="numeric" min={1} value={it.qty} onChange={(e) => setQty(i, Number(e.target.value))} className="dk-input dk-num" data-kl="qty" />
            </label>
            <span>{it.unit}</span>
            <button type="button" className="dk-kl-x" aria-label={L.remove(it.name[lang])} onClick={() => setItems((xs) => xs.filter((_, k) => k !== i))}>
              ×
            </button>
            <span className="dk-kl-muted">{it.spec[lang]}</span>
          </li>
        ))}
      </ul>
      <div className="dk-kl-specrow">
        <label>
          <span>{L.kec}</span>
          <Select value={kec} onChange={(e) => setKec(e.target.value)} options={[{ value: '', label: L.pickKec, disabled: true }, ...s.region.kecamatan.map((k) => ({ value: k.id, label: k.name }))]} data-kl="kec-select" />
        </label>
        <label>
          <span>{L.days}</span>
          <input type="number" min={1} max={60} value={days} onChange={(e) => setDays(Math.max(1, Math.min(60, Math.round(Number(e.target.value)) || 1)))} className="dk-input dk-num" data-kl="days" />
        </label>
        <label className="dk-kl-check">
          <input type="checkbox" checked={emergency} onChange={(e) => setEmergency(e.target.checked)} data-kl="emergency" />
          {L.emergency}
        </label>
        {p0.budget ? (
          <span className="dk-num">
            {L.budget} {rp(p0.budget)} <span className="dk-kl-sim">{L.sim}</span>
          </span>
        ) : null}
      </div>
      {dup && !force && (
        <p className="dk-kl-dup" role="status" data-kl="dup">
          {L.dup(dup.code)}
          <Button size="sm" variant="ghost" onClick={() => onOpenNeed(dup.id)}>
            {L.open}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setForce(true)} data-kl="force">
            {L.force}
          </Button>
        </p>
      )}
      <div className="dk-kl-compose-act">
        <Button variant="primary" onClick={publish} disabled={!!reason || done} aria-describedby={reason ? 'kl-pub-why' : undefined} data-kl="publish">
          {done ? L.sent : L.publish}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {L.cancel}
        </Button>
      </div>
      {reason && (
        <p id="kl-pub-why" className="dk-kl-why">
          {reason}
        </p>
      )}
    </section>
  )
}
