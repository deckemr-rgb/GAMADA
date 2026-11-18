/**
 * Send.tsx (with the Dokumen tab) — Stepper Periksa → Tanda tangan (simulasi) → Kirim. "Kirim" emits ONE
 * bid.submitted { tenderId, businessId, price, pages: 34, docSections } (a double click sends once: a ref lock plus
 * the world's own bid row). Blocked steps are disabled with the reason shown (pajak missing, sections, signature).
 * C25 then hands the bid to Awas Belanja (the shell's toast links there).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Button, Icon, Stepper } from '../../demo-kit/ui'
import { emit, rows, useWorld, type WorldState } from '../../demo-kit/world'
import { bidPayload, procurementOfTender, requirementsFor } from '../../demo-kit/world/usaha-pintar'
import { SECTIONS, composedCount, pagesOf, setDraft, useDraft } from './draft'
import { SLUG, canLink, hrefTo, rp } from './model'
import { useDocT } from './strings-doc'

const whole = (s: WorldState) => s

export default function Send({ tenderId, total }: { tenderId: string; total: number }) {
  const { d } = useDocT()
  const s = useWorld(whole)
  const draft = useDraft(tenderId)
  const lock = useRef(false)
  const [sending, setSending] = useState(false)
  const timer = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const shop = s.meta.shopId
  const tender = s.tenders.byId[tenderId]
  const reqs = useMemo(() => requirementsFor(s, tenderId, shop), [s, tenderId, shop])
  const sent = rows(s.bids).find((b) => b.tenderId === tenderId && b.businessId === shop && b.status !== 'draf')
  if (!tender) return null
  const n = composedCount(draft)
  const allSecs = n === SECTIONS.length
  const ok = reqs.filter((r) => r.ok).length
  const tax = reqs.find((r) => r.key === 'pajak')
  const closed = tender.status !== 'dibuka'
  const why = closed ? d.whyClosed : !allSecs ? d.whyNoSections : !draft.signed ? d.whyNoSign : tax && !tax.ok ? d.whyTax : ok < reqs.length ? d.whyReqs : null
  const step = sent ? 3 : !allSecs ? 0 : !draft.signed ? 1 : 2
  const pid = procurementOfTender(s, tender)

  // "Mengirim…" for a moment first: the second click of a double click lands on this disabled button, never on the
  // cross-product toast that the bid raises
  const send = () => {
    if (lock.current || why || sent) return
    lock.current = true
    setSending(true)
    const payload = bidPayload(tenderId, shop, total, SECTIONS.map((x) => x.id), pagesOf(draft))
    timer.current = window.setTimeout(() => {
      emit('bid.submitted', payload, SLUG)
      setSending(false)
    }, 400)
  }

  return (
    <section className="dk-tp-send" aria-label={d.sendTitle} data-tp="send-box">
      <h3>{d.sendTitle}</h3>
      <Stepper steps={d.steps} current={step} label={d.sendTitle} />
      <ul className="dk-tp-send-checks">
        <li className={allSecs ? 'is-ok' : ''}>
          <Icon name={allSecs ? 'check' : 'dot'} size={14} /> {d.checkSections(n)}
        </li>
        <li className={ok === reqs.length ? 'is-ok' : ''}>
          <Icon name={ok === reqs.length ? 'check' : 'alert'} size={14} /> {d.checkReqs(ok, reqs.length)}
        </li>
        <li className="is-ok">
          <Icon name="coins" size={14} /> <span data-tp="send-price">{d.checkPrice(rp(total))}</span>
        </li>
      </ul>
      <div className="dk-tp-send-act">
        <Button variant="secondary" icon="edit" disabled={!allSecs || draft.signed || !!sent} onClick={() => setDraft(tenderId, { signed: true })} data-tp="sign" aria-describedby={!allSecs ? 'dk-tp-why' : undefined}>
          {draft.signed || sent ? d.signed : d.sign}
        </Button>
        {/* stays in place once sent (disabled): a double click never lands on what replaces it */}
        <Button variant="primary" icon={sent ? 'checkCircle' : 'send'} disabled={!!why || !!sent || sending} busy={sending} onClick={send} data-tp="send" aria-describedby={why && !sent ? 'dk-tp-why' : undefined}>
          {sent ? d.sentBtn : d.send}
        </Button>
        {why && !sent && (
          <p id="dk-tp-why" className="dk-tp-why">
            {why}
          </p>
        )}
      </div>
      {sent && (
        <div className="dk-tp-sent" role="status" data-tp="sent" data-price={sent.price}>
          <p>
            <Icon name="checkCircle" size={16} /> {d.sent(rp(sent.price), sent.pages ?? 0)}
          </p>
          <p className="dk-tp-muted">{d.sentNote}</p>
          {pid && canLink('awas-belanja') && (
            <Link className="dk-tp-link" to={hrefTo('awas-belanja', pid)} data-tp="awas-link">
              {d.seeAwas}
              <Icon name="arrowUpRight" size={14} />
            </Link>
          )}
        </div>
      )}
    </section>
  )
}
