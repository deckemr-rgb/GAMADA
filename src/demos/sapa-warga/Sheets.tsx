/**
 * demos/sapa-warga/Sheets.tsx — bottom sheets inside the phone (lazy chunk): attachments (sample photos, the visitor's
 * own photo shown locally only, location), the pre-filled NIB form with a printable PDF preview, and the MPP slot
 * picker (service.booked → the queue ticket with QR arrives on the phone through the world).
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '../../lib/i18n'
import { Button, IconButton, Icon, Modal } from '../../demo-kit/ui'
import { PaperFrame, printPaper } from '../../demo-kit/frames'
import { useClock, useWorld, world } from '../../demo-kit/world'
import { Photo } from './photos'
import { PERSONA_PHOTOS, PHOTO_META, bookQueue, bookingSlots, personaCitizen, slotLabel, type PersonaKey } from './model'
import type { Staged } from './Phone'
import { fill, useT } from './strings'

function Sheet({ title, onClose, children, className }: { title: string; onClose: () => void; children: ReactNode; className?: string }) {
  const t = useT()
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const back = document.activeElement
    root.current?.querySelector<HTMLElement>('button:not([aria-label]), input, [data-autofocus]')?.focus()
    return () => {
      if (back instanceof HTMLElement && document.contains(back)) back.focus()
    }
  }, [])
  return (
    <div ref={root} className={`dk-sw-sheet${className ? ` ${className}` : ''}`} role="dialog" aria-modal="false" aria-label={title} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <header>
        <b>{title}</b>
        <IconButton icon="close" label={t.close} onClick={onClose} size="sm" />
      </header>
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ attachments */

export function AttachSheet({ persona, staged, onStage, onClose }: { persona: PersonaKey; staged: Staged; onStage: (s: Staged) => void; onClose: () => void }) {
  const { lang } = useI18n()
  const t = useT()
  const file = useRef<HTMLInputElement>(null)
  const place = useWorld((s) => {
    const c = personaCitizen(s, persona)
    return c ? (s.region.kecamatan.find((k) => k.id === c.kecamatanId)?.desa.find((d) => d.id === c.desaId)?.name ?? '') : ''
  })
  return (
    <Sheet title={t.attachTitle} onClose={onClose}>
      <p className="dk-sw-label">{t.samplePhotos}</p>
      <div className="dk-sw-gallery">
        {PERSONA_PHOTOS[persona].map((id) => (
          <button
            key={id}
            type="button"
            className={`dk-sw-thumb${staged.photo?.id === id ? ' is-on' : ''}`}
            aria-pressed={staged.photo?.id === id}
            data-sw={`photo-${id}`}
            onClick={() => {
              onStage({ ...staged, photo: { id, title: PHOTO_META[id].title }, loc: staged.loc ?? true })
              onClose()
            }}
          >
            <Photo id={id} label={PHOTO_META[id].title[lang]} tag={place} />
            <span>{PHOTO_META[id].title[lang]}</span>
          </button>
        ))}
      </div>
      <div className="dk-sw-sheet-row">
        <Button size="sm" variant="secondary" icon="camera" onClick={() => file.current?.click()}>
          {t.ownPhoto}
        </Button>
        <input
          ref={file}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (!f) return
            if (staged.photo?.url) URL.revokeObjectURL(staged.photo.url)
            onStage({ ...staged, photo: { id: 'own', url: URL.createObjectURL(f), title: { id: 'Foto Anda', en: 'Your photo' } }, loc: staged.loc ?? true })
            onClose()
          }}
        />
        <Button size="sm" variant={staged.loc ? 'primary' : 'secondary'} icon="pin" aria-pressed={!!staged.loc} onClick={() => onStage({ ...staged, loc: !staged.loc })} data-sw="share-loc">
          {staged.loc ? t.locShared : t.shareLoc}
        </Button>
      </div>
      <p className="dk-sw-fine">{t.ownPhotoNote}</p>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ form + PDF preview */

const BUSINESS: Record<PersonaKey, { id: string; en: string }> = {
  raka: { id: 'Kedai kopi · KBLI 56303 (rumah minum/kafe)', en: 'Coffee stall · KBLI 56303 (café)' },
  siti: { id: 'Warung makan · KBLI 56102', en: 'Food stall · KBLI 56102' },
  darmo: { id: 'Toko kelontong · KBLI 47111', en: 'Grocery stall · KBLI 47111' },
}

export function FormSheet({ persona, serviceId, onClose, onQueue }: { persona: PersonaKey; serviceId: string; onClose: () => void; onQueue: () => void }) {
  const { lang } = useI18n()
  const t = useT()
  const c = useWorld((s) => personaCitizen(s, persona))
  const svc = useWorld((s) => s.region.services.find((x) => x.id === serviceId)?.name ?? { id: serviceId, en: serviceId })
  const [f, setF] = useState(() => ({
    name: c?.name ?? '',
    phone: c?.phone ?? '',
    address: c?.address ?? '',
    business: BUSINESS[persona][lang],
    scale: t.scaleMicro,
  }))
  const [pdf, setPdf] = useState(false)
  const paper = useRef<HTMLDivElement>(null)
  const fields: [keyof typeof f, string][] = [
    ['name', t.fName],
    ['phone', t.fPhone],
    ['address', t.fAddress],
    ['business', t.fBusiness],
    ['scale', t.fScale],
  ]
  return (
    <Sheet title={fill(t.formTitle, { service: svc[lang] })} onClose={onClose} className="is-form">
      <p className="dk-sw-muted">{t.formLead}</p>
      <div className="dk-sw-form">
        {fields.map(([k, label]) => (
          <label key={k} className="dk-sw-field">
            <span>{label}</span>
            <input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
          </label>
        ))}
      </div>
      <div className="dk-sw-sheet-row">
        <Button size="sm" variant="secondary" icon="doc" onClick={() => setPdf(true)} data-sw="pdf">
          {t.preview}
        </Button>
        <Button size="sm" variant="primary" icon="calendar" onClick={onQueue} data-sw="form-queue">
          {t.takeQueue}
        </Button>
      </div>
      <Modal
        open={pdf}
        onClose={() => setPdf(false)}
        title={t.preview}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPdf(false)}>
              {t.close}
            </Button>
            <Button variant="primary" icon="print" onClick={() => paper.current && printPaper(paper.current)}>
              {t.printPdf}
            </Button>
          </>
        }
      >
        <div ref={paper}>
          <PaperFrame label={fill(t.pdfTitle, { service: svc[lang] })} size="auto" className="dk-sw-pdf">
            <p className="dk-sw-pdf-kop">{world.get().region.shortName.toUpperCase()} · MAL PELAYANAN PUBLIK</p>
            <h3>{fill(t.pdfTitle, { service: svc[lang] })}</h3>
            <table>
              <tbody>
                {fields.map(([k, label]) => (
                  <tr key={k}>
                    <th scope="row">{label}</th>
                    <td>{f[k]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="dk-sw-pdf-sign">
              <span>{t.pdfSign}</span>
              <b>{f.name}</b>
            </div>
            <p className="dk-sw-pdf-note">{t.pdfNote}</p>
          </PaperFrame>
        </div>
      </Modal>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ MPP slots */

export function SlotSheet({ persona, serviceId, onClose }: { persona: PersonaKey; serviceId: string; onClose: () => void }) {
  const { lang } = useI18n()
  const t = useT()
  const { minutes } = useClock()
  const bookings = useWorld((s) => s.bookings)
  const svc = useWorld((s) => s.region.services.find((x) => x.id === serviceId)?.name ?? { id: serviceId, en: serviceId })
  const slots = useMemo(() => bookingSlots(world.get(), serviceId, minutes), [serviceId, minutes, bookings]) // eslint-disable-line react-hooks/exhaustive-deps
  const place = lang === 'id' ? 'MPP' : 'Service mall'
  return (
    <Sheet title={t.slotTitle} onClose={onClose}>
      <p className="dk-sw-muted">{fill(t.slotLead, { service: svc[lang], place })}</p>
      <ul className="dk-sw-slots">
        {slots.map((sl) => (
          <li key={sl.at}>
            {sl.left > 0 ? (
              <button
                type="button"
                className="dk-sw-slot"
                data-sw="slot"
                onClick={() => {
                  const c = personaCitizen(world.get(), persona)
                  if (c) bookQueue(c.id, serviceId, sl.at)
                  onClose()
                }}
              >
                <b className="dk-num">{slotLabel(sl.at)}</b>
                <span>{fill(t.slotLeft, { n: sl.left })}</span>
                <Icon name="arrowRight" size={14} />
              </button>
            ) : (
              <span className="dk-sw-slot is-full">
                <b className="dk-num">{slotLabel(sl.at)}</b>
                <span>{t.slotFull}</span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </Sheet>
  )
}
