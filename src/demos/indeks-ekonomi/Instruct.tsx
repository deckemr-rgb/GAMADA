/**
 * Instruct — Kepala Daerah "Beri instruksi pemulihan" (local dialog): OPD picker (Dinas Koperasi & UMKM,
 * Disperindag, Bappeda), the text prefilled with the lowest visible kecamatan of the month ⇒ instruction.issued
 * { text, opdIds, refs: [econIndex:<kec>:<month>] } (existing C7 ⇒ Naskah Pintar letter; Meja Pimpinan lists it).
 */
import { useMemo, useState } from 'react'
import { demoHref } from '../../demo-kit/shell'
import { Button, Field, Modal, Textarea } from '../../demo-kit/ui'
import { emit, ref, rows, settled, useSession, useWorld, world } from '../../demo-kit/world'
import { econFrame } from '../../demo-kit/world/pasar-daerah'
import { DEMO_READY } from '../registry'
import { SLUG, monthLabel, nf, sgn, useT } from './strings'
import type { View } from './types'

const OPDS = [
  { id: 'diskopumkm', label: { id: 'Dinas Koperasi & UMKM', en: 'Cooperatives & MSME Office' } },
  { id: 'disperindag', label: { id: 'Disperindag', en: 'Trade & Industry Office' } },
  { id: 'bappeda', label: { id: 'Bappeda', en: 'Bappeda' } },
]
const S = {
  id: {
    title: 'Beri instruksi pemulihan', desc: 'Instruksi diteruskan ke Meja Pimpinan; Naskah Pintar menyiapkan suratnya.', opd: 'OPD penerima', text: 'Isi instruksi', send: 'Kirim instruksi', cancel: 'Batal', needOpd: 'Pilih minimal satu OPD.',
    pre: (k: string, i: string, d: string, m: string) => `Susun langkah pemulihan ekonomi Kec. ${k}: indeks ${m} ${i} (${d} poin, simulasi). Prioritaskan modal kerja UMKM, pasokan bahan pokok, dan pantau 2 minggu.`,
  },
  en: {
    title: 'Issue a recovery instruction', desc: 'The instruction goes to Meja Pimpinan; Naskah Pintar prepares the letter.', opd: 'Receiving offices', text: 'Instruction', send: 'Send instruction', cancel: 'Cancel', needOpd: 'Choose at least one office.',
    pre: (k: string, i: string, d: string, m: string) => `Prepare an economic recovery plan for ${k} district: ${m} index ${i} (${d} points, simulated). Prioritise MSME working capital and staple supply, and monitor for 2 weeks.`,
  },
}

export default function Instruct({ view, onClose, onSent }: { view: View; onClose: () => void; onSent: (code: string, href: string | null) => void }) {
  const { lang } = useT()
  const L = S[lang]
  const session = useSession()
  const ym = view.months[view.monthIdx]!
  const frame = useWorld((s) => econFrame(s, ym))
  const region = useWorld((s) => s.region)
  const low = useMemo(() => [...frame.rank].sort((a, b) => a.index - b.index || a.kecId.localeCompare(b.kecId))[0] ?? null, [frame])
  const kName = low ? region.kecamatan.find((x) => x.id === low.kecId)?.name ?? low.kecId : ''
  const pre = (l: 'id' | 'en') => (low ? S[l].pre(kName, nf(l, low.index, 1), sgn(l, low.delta), monthLabel(l, ym)) : '')
  const [text, setText] = useState(() => pre(lang))
  const [opds, setOpds] = useState<string[]>(OPDS.map((o) => o.id))
  const [busy, setBusy] = useState(false)
  const valid = opds.length > 0 && text.trim().length > 0

  const send = async () => {
    if (busy || !valid || !low) return
    setBusy(true)
    const edited = text.trim() !== pre(lang)
    const bi = edited ? { id: text.trim(), en: text.trim() } : { id: pre('id'), en: pre('en') }
    const target = ref('econIndex', `${low.kecId}:${ym}`)
    const e = emit('instruction.issued', { text: bi, opdIds: opds, refs: [target] }, SLUG)
    await settled()
    const id = e.payload.id ?? rows(world.get().instructions).filter((x) => x.refs.includes(target)).sort((a, b) => b.at - a.at)[0]?.id ?? ''
    const dev = new URLSearchParams(window.location.search).get('controls') === 'all' ? '&controls=all' : ''
    onSent(id, id && DEMO_READY['meja-pimpinan'] ? demoHref('meja-pimpinan', session, id) + dev : null)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={L.title}
      description={L.desc}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {L.cancel}
          </Button>
          <Button variant="primary" icon="send" busy={busy} disabled={!valid} onClick={() => void send()} data-ie="instruct-send">
            {L.send}
          </Button>
        </>
      }
    >
      <div className="dk-ie-instr" data-ie="instruct-dialog">
        <fieldset>
          <legend>{L.opd}</legend>
          {OPDS.map((o) => (
            <label key={o.id} className="dk-ie-check">
              <input type="checkbox" checked={opds.includes(o.id)} onChange={() => setOpds((x) => (x.includes(o.id) ? x.filter((k) => k !== o.id) : [...x, o.id]))} /> {o.label[lang]}
            </label>
          ))}
          {!opds.length && <p className="dk-ie-muted" role="status">{L.needOpd}</p>}
        </fieldset>
        <Field label={L.text}>
          {(ids) => <Textarea {...ids} rows={4} value={text} onChange={(e) => setText(e.target.value)} />}
        </Field>
      </div>
    </Modal>
  )
}
