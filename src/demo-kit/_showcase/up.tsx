/**
 * /lab/_kit showcase — "up" (tahap 3 kit parts for Usaha Pintar): ChatThread + ChatComposer, MonthCalendar,
 * TextDiff and MoneyInput, on fictional data. Every control changes something visible.
 */
import { useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { ChatComposer, ChatThread, MoneyInput, MonthCalendar, icsFor, type CalendarEvent, type ChatMessage } from '../ui'
import { TextDiff } from '../docs/TextDiff'
import { terbilang } from '../i18n/terbilang'

const C = {
  id: {
    chat: 'Chat PO dengan pemasok (contoh fiktif)',
    place: 'Tulis pesan ke pemasok…',
    input: 'Pesan',
    cal: 'Kalender pajak November (contoh)',
    picked: 'Dipilih',
    none: 'Pilih tanggal di kalender',
    ics: 'Unduh .ics',
    diff: 'Draf dokumen: sebelum dan sesudah AI',
    money: 'Harga penawaran (simulasi)',
    inline: 'Sebaris',
    split: 'Dua kolom',
  },
  en: {
    chat: 'PO chat with a supplier (fictional example)',
    place: 'Write to the supplier…',
    input: 'Message',
    cal: 'November tax calendar (example)',
    picked: 'Selected',
    none: 'Pick a date on the calendar',
    ics: 'Download .ics',
    diff: 'Document draft: before and after AI',
    money: 'Bid price (simulated)',
    inline: 'Inline',
    split: 'Split',
  },
}

const SEED: ChatMessage[] = [
  { id: 'm1', side: 'me', text: { id: 'Pesan 200 karung pasir 25 kg untuk PO-0412, bisa kirim besok?', en: 'Ordering 200 sandbags (25 kg) for PO-0412, can you ship tomorrow?' }, at: 7 * 60 + 8, status: 'read' },
  { id: 'm2', side: 'them', author: 'CV Contoh Pemasok', text: { id: 'Siap, stok ada 240. Kirim besok 07.00 ke Pasar Kota.', en: 'Sure, 240 in stock. Shipping tomorrow 07:00 to Pasar Kota.' }, at: 7 * 60 + 9 },
  { id: 'm3', side: 'system', text: { id: 'Nota PO-0412 diteruskan ke Pajak Beres', en: 'PO-0412 receipt forwarded to Pajak Beres' } },
]
const REPLIES = [
  { id: 'Baik, dicatat: “{x}”', en: 'Noted: “{x}”' },
  { id: 'Sudah kami teruskan ke gudang: “{x}”', en: 'Passed to the warehouse: “{x}”' },
  { id: 'Terima kasih, jawaban untuk “{x}” menyusul', en: 'Thanks, an answer to “{x}” follows' },
]
const EVENTS: CalendarEvent[] = [
  { id: 'e1', at: '2026-11-10', label: { id: 'Setor PPh 21 Okt', en: 'Pay Oct PPh 21' }, tone: 'done' },
  { id: 'e2', at: '2026-11-15', label: { id: 'Setor PPh Final Okt', en: 'Pay Oct final tax' }, tone: 'done' },
  { id: 'e3', at: '2026-11-20', label: { id: 'Lapor PPh 21 Okt', en: 'File Oct PPh 21' }, tone: 'warn' },
  { id: 'e4', at: '2026-11-25', label: { id: 'Gaji karyawan', en: 'Payroll' }, tone: 'neutral' },
  { id: 'e5', at: '2026-11-30', label: { id: 'Tutup buku November', en: 'Close November books' }, tone: 'danger' },
]
const BEFORE = 'Kami menawarkan karung pasir sesuai spesifikasi dengan harga yang wajar dan pengiriman cepat.'
const AFTER = 'Kami menawarkan 2.000 karung pasir 25 kg sesuai spesifikasi HPS dengan harga Rp 15.200 per karung dan pengiriman dalam 24 jam.'

const H3 = { font: '600 15px/1.3 var(--font-body)', margin: '0 0 12px' } as const

export default function Section() {
  const { lang } = useI18n()
  const c = C[lang]
  const [msgs, setMsgs] = useState<ChatMessage[]>(SEED)
  const [typing, setTyping] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const [mode, setMode] = useState<'inline' | 'split'>('inline')
  const [price, setPrice] = useState<number | null>(35_900_000)

  const send = (text: string) => {
    const n = msgs.length
    const at = 7 * 60 + 10 + n
    setMsgs((m) => [...m, { id: `u${n}`, side: 'me', text, at, status: 'delivered' }])
    setTyping(true)
    window.setTimeout(() => {
      const r = REPLIES[n % REPLIES.length]!
      const x = text.length > 24 ? `${text.slice(0, 24)}…` : text
      setTyping(false)
      setMsgs((m) => [...m, { id: `r${n}`, side: 'them', author: 'CV Contoh Pemasok', text: { id: r.id.replace('{x}', x), en: r.en.replace('{x}', x) }, at: at + 1 }])
    }, 1200)
  }
  const quick = [
    { id: 'eta', label: { id: 'Tanya jam kirim', en: 'Ask delivery time' } },
    { id: 'nota', label: { id: 'Minta nota', en: 'Ask for the receipt' } },
  ]
  const ics = () => {
    const blob = new Blob([icsFor(EVENTS)], { type: 'text/calendar' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'kalender-pajak.ics'
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const day = picked ? EVENTS.filter((e) => e.at === picked) : []

  return (
    <div className="dk-root" data-eco="usaha-pintar" style={{ display: 'grid', gap: 32, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', minWidth: 0 }}>
      <div>
        <h3 style={H3}>ChatThread · ChatComposer</h3>
        <ChatThread messages={msgs} typing={typing && 'CV Contoh Pemasok'} quickReplies={quick} onQuick={(id) => send(quick.find((q) => q.id === id)!.label[lang])} label={{ id: C.id.chat, en: C.en.chat }} />
        <ChatComposer onSend={send} placeholder={{ id: C.id.place, en: C.en.place }} label={{ id: C.id.input, en: C.en.input }} />
      </div>
      <div>
        <h3 style={H3}>MonthCalendar</h3>
        <MonthCalendar month="2026-11" today="2026-11-18" events={EVENTS} onSelect={(d) => setPicked(d)} label={{ id: C.id.cal, en: C.en.cal }} />
        <p aria-live="polite">
          {picked ? `${c.picked}: ${picked}${day.length ? ` · ${day.map((e) => e.label[lang]).join(', ')}` : ''}` : c.none}
        </p>
        <button type="button" className="dk-btn dk-btn--secondary" onClick={ics}>
          {c.ics}
        </button>
      </div>
      <div>
        <h3 style={H3}>TextDiff</h3>
        <div role="radiogroup" aria-label="TextDiff mode">
          {(['inline', 'split'] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} className="dk-btn dk-btn--ghost" onClick={() => setMode(m)}>
              {c[m]}
            </button>
          ))}
        </div>
        <TextDiff before={BEFORE} after={AFTER} mode={mode} label={{ id: C.id.diff, en: C.en.diff }} />
      </div>
      <div>
        <h3 style={H3}>MoneyInput · terbilang</h3>
        <label>
          {c.money}
          <MoneyInput value={price} onChange={setPrice} aria-label={c.money} />
        </label>
        <p aria-live="polite">{price ? terbilang(price, lang) : '—'}</p>
      </div>
    </div>
  )
}
