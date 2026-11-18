/**
 * demos/pantau-merek/Announce.tsx — the service notice step of the spike sheet: the analyst drafts it
 * (`pantau-merek/announcement`; Live may only reword it, the facts stay the computed draft's), offer choice, channels
 * incl. "Struk kasir" (Toko Autopilot), "Terbitkan" ⇒ ONE `brand.announced` (source pantau-merek). "Gratis ongkir"
 * needs the owner: the Brand Manager sees why and a real button that hands the draft to the owner (role switch).
 * `Published` shows a notice already out (also the `?focus=BN-…` landing).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Chip, Icon } from '../../demo-kit/ui'
import type { UseAiChat } from '../../demo-kit/ai/chat'
import { emit, rows, setSession, useSession, useWorld, world, type BrandAnnouncement, type WorldState } from '../../demo-kit/world'
import { ANNOUNCE_CHANNEL } from '../../demo-kit/world/usaha-pintar'
import { OFFERS, announcementDraft, type Offer } from './announce-text'
import { SLUG, pendingDraft, usePendingDraft } from './model'
import { fill, tm, useStr } from './strings'

type Ch = BrandAnnouncement['channels'][number]
const CHS: Ch[] = ['marketplace', 'sosmed', 'ulasan-peta', 'wa-status', 'struk']

const S = {
  id: {
    ask: (o: Offer) => `Sarankan pengumuman layanan (penawaran: ${o})`,
    drafting: 'Menyusun draf pengumuman…',
    draft: 'Draf pengumuman',
    sim: 'AI · simulasi',
    live: 'AI Live (fakta dari data demo)',
    offer: 'Penawaran untuk pembeli',
    offers: { 'ambil-sendiri': 'Ambil sendiri', 'jadwal-ulang': 'Jadwal ulang', 'gratis-ongkir': 'Gratis ongkir' } as Record<Offer, string>,
    channels: 'Terbitkan ke kanal',
    strukNote: 'Struk kasir: tampil di Kasir Toko Autopilot.',
    needCh: 'Pilih minimal satu kanal.',
    needOwner: 'Gratis ongkir perlu persetujuan pemilik.',
    askOwner: 'Minta persetujuan pemilik (ganti peran)',
    waiting: 'Draf ini menunggu persetujuan Anda sebagai pemilik.',
    publish: 'Terbitkan',
    by: { 'brand-manager': 'Brand Manager', 'pemilik-toko': 'Pemilik toko' } as Record<string, string>,
    pubAt: 'Terbit {t} oleh {b}',
    none: 'Belum ada pengumuman untuk lonjakan ini.',
  },
  en: {
    ask: (o: Offer) => `Suggest a service notice (offer: ${o})`,
    drafting: 'Drafting the notice…',
    draft: 'Draft notice',
    sim: 'AI · simulated',
    live: 'Live AI (facts from the demo data)',
    offer: 'Offer for buyers',
    offers: { 'ambil-sendiri': 'Self pick-up', 'jadwal-ulang': 'Reschedule', 'gratis-ongkir': 'Free re-delivery' } as Record<Offer, string>,
    channels: 'Publish to channels',
    strukNote: 'Receipts: shown at the Toko Autopilot till.',
    needCh: 'Pick at least one channel.',
    needOwner: 'Free re-delivery needs the owner’s approval.',
    askOwner: 'Ask the owner to approve (switch role)',
    waiting: 'This draft is waiting for your approval as the owner.',
    publish: 'Publish',
    by: { 'brand-manager': 'Brand Manager', 'pemilik-toko': 'Shop owner' } as Record<string, string>,
    pubAt: 'Published {t} by {b}',
    none: 'No notice for this spike yet.',
  },
}

export default function Announce({ alertId, chat, onPublished }: { alertId: string; chat: UseAiChat; onPublished: () => void }) {
  const { lang } = useStr()
  const L = S[lang]
  const { role, aiMode } = useSession()
  const owner = role === 'pemilik-toko'
  const pend = usePendingDraft()
  const mine = pend && pend.alertId === alertId ? pend : null
  const [offer, setOffer] = useState<Offer>(() => (mine?.offer as Offer | undefined) ?? 'ambil-sendiri')
  const [chs, setChs] = useState<Ch[]>(() => mine?.channels ?? CHS)
  const asked = useRef<Offer | null>(null)
  const startN = useRef(chat.messages.length)
  const { send, stop } = chat
  useEffect(() => {
    if (asked.current) return
    asked.current = offer
    startN.current = chat.messages.length
    let finished = false
    void send(L.ask(offer), { maxMs: 1500 }).finally(() => (finished = true))
    return () => {
      if (finished) return
      stop()
      asked.current = null
    }
  }, [send, stop, offer, L]) // eslint-disable-line react-hooks/exhaustive-deps
  const local = useMemo(() => announcementDraft(world.get(), alertId, offer), [alertId, offer])
  // a Live answer may reword the notice for the offer it was asked about; everything else is the computed draft
  const mine2 = chat.messages.slice(startN.current).filter((m) => m.role === 'assistant' && !(m.status === 'stopped' && !m.content))
  const ai = mine2.flatMap((m) => m.structured ?? []).find((x) => x.kind === 'pantau-merek/announcement')?.data as { text?: string; offer?: string } | undefined
  const liveText = aiMode === 'live' && ai?.text && ai.offer === offer ? ai.text : null
  const text = { ...local, ...(liveText ? { [lang]: liveText } : {}) }
  const answered = mine2.some((m) => m.status !== 'thinking' && m.status !== 'streaming')
  const needOwner = offer === 'gratis-ongkir' && !owner
  const blocked = !chs.length || needOwner || !answered
  const sent = useRef(false)
  const publish = () => {
    if (blocked || sent.current) return
    const s = world.get()
    const a = s.brandAlerts.byId[alertId]
    if (!a) return
    sent.current = true
    emit('brand.announced', { businessId: s.meta.shopId, alertId, topic: a.topic, text, channels: chs, offer, by: role }, SLUG)
    pendingDraft.set(null)
    onPublished()
  }
  const handOver = () => {
    pendingDraft.set({ alertId, offer, channels: chs, text })
    setSession({ role: 'pemilik-toko' })
  }
  return (
    <div className="dk-pm-ann" data-pm="announce">
      {mine && owner && (
        <p className="dk-pm-flood is-info" role="status">
          {L.waiting}
        </p>
      )}
      <div className="dk-pm-ann-draft">
        <p className="dk-pm-k">
          {L.draft} · <span className="dk-pm-note">{liveText ? L.live : L.sim}</span>
        </p>
        {answered ? (
          <p className="dk-pm-ann-text" data-pm="announce-text">
            {text[lang]}
          </p>
        ) : (
          <p className="dk-pm-ai">
            <Icon name="spark" size={14} />
            {L.drafting}
          </p>
        )}
      </div>
      <fieldset className="dk-pm-fs">
        <legend className="dk-pm-k">{L.offer}</legend>
        <div className="dk-pm-chips">
          {OFFERS.map((o) => (
            <Chip key={o} selected={offer === o} aria-current={offer === o} onToggle={() => setOffer(o)}>
              {L.offers[o]}
            </Chip>
          ))}
        </div>
      </fieldset>
      <fieldset className="dk-pm-fs">
        <legend className="dk-pm-k">{L.channels}</legend>
        <div className="dk-pm-chips">
          {CHS.map((c) => (
            <Chip key={c} selected={chs.includes(c)} onToggle={() => setChs((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]))}>
              {ANNOUNCE_CHANNEL[c][lang]}
            </Chip>
          ))}
        </div>
        {chs.includes('struk') && <p className="dk-pm-note">{L.strukNote}</p>}
      </fieldset>
      <div className="dk-pm-sheet-act">
        {needOwner && (
          <Button variant="secondary" icon="user" onClick={handOver} data-pm="ask-owner">
            {L.askOwner}
          </Button>
        )}
        <Button variant="primary" icon="send" disabled={blocked} aria-describedby={blocked && answered ? 'dk-pm-ann-why' : undefined} onClick={publish} data-pm="announce-publish">
          {L.publish}
        </Button>
      </div>
      {answered && (needOwner || !chs.length) && (
        <p id="dk-pm-ann-why" className="dk-pm-note is-warn">
          {needOwner ? L.needOwner : L.needCh}
        </p>
      )}
    </div>
  )
}

const selAnns = (s: WorldState) => s.brandAnnouncements
export function Published({ alertId }: { alertId: string }) {
  const { lang } = useStr()
  const L = S[lang]
  const anns = useWorld(selAnns)
  const a = rows(anns)
    .filter((x) => x.alertId === alertId)
    .sort((x, y) => y.at - x.at)[0]
  if (!a) return <p className="dk-pm-empty">{L.none}</p>
  return (
    <div className="dk-pm-ann" data-pm="announce-published" data-id={a.id}>
      <p className="dk-pm-k dk-num">{fill(L.pubAt, { t: tm(a.at, lang), b: L.by[a.by] ?? a.by })}</p>
      <p className="dk-pm-ann-text">{a.text[lang]}</p>
      <div className="dk-pm-chips">
        {a.channels.map((c) => (
          <span key={c} className="dk-pm-tagchip">
            {ANNOUNCE_CHANNEL[c][lang]}
          </span>
        ))}
        {a.offer && <span className="dk-pm-tagchip is-acc">{L.offers[a.offer]}</span>}
      </div>
      {a.channels.includes('struk') && <p className="dk-pm-note">{L.strukNote}</p>}
    </div>
  )
}
