/**
 * UploadOwn (lazy, Live mode only) — "Proses dokumen saya": a consent dialog, then the image goes to
 * POST /api/ai/extract through the live provider (vision via the proxy, not stored, content not logged). No
 * simulated stand-in for a user's own document: if Live is unavailable the dialog says so and nothing is processed.
 * OwnView shows the image with the boxes the model returned (percent of the page) — the object URL is revoked on close.
 */
import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import { loadAiEngine } from '../../demo-kit/ai/chat'
import type { Extracted } from '../../demo-kit/ai/types'
import { Button, Icon, Modal } from '../../demo-kit/ui'
import { useI18n } from '../../lib/i18n'
import { CEK } from './model'
import type { OwnDoc } from './Single'
import { STR } from './strings'

export function UploadDialog({ open, onClose, onResult }: { open: boolean; onClose: () => void; onResult: (r: OwnDoc) => void }) {
  const { lang } = useI18n()
  const t = STR[lang]
  const fid = useId()
  const cid = useId()
  const [file, setFile] = useState<File | null>(null)
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const ctrl = useRef<AbortController | null>(null)
  useEffect(() => () => ctrl.current?.abort(), [])

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.currentTarget.files?.[0] ?? null
    setError(null)
    if (!f) return setFile(null)
    if (!/^image\//.test(f.type)) {
      setFile(null)
      return setError(t.uploadNotImage)
    }
    if (f.size > CEK.uploadMax) {
      setFile(null)
      return setError(t.uploadTooBig)
    }
    setFile(f)
  }

  const go = async () => {
    if (!file || !consent) return
    setBusy(true)
    setError(null)
    ctrl.current?.abort()
    const c = new AbortController()
    ctrl.current = c
    try {
      const { getAi } = await loadAiEngine()
      // no sampleId: the live provider's fallback has nothing to simulate and throws → honest error below
      const ex: Extracted = await getAi('live').extract({ product: 'cek-berkas', kind: 'ktp-specimen', image: file, signal: c.signal })
      if (c.signal.aborted) return
      onResult({ url: URL.createObjectURL(file), name: file.name, extracted: ex })
    } catch {
      if (!c.signal.aborted) setError(t.uploadFail)
    } finally {
      if (!c.signal.aborted) setBusy(false)
    }
  }

  const close = () => {
    ctrl.current?.abort()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={t.uploadTitle}
      description={t.uploadBody}
      size="sm"
      footer={
        <>
          <Button variant="quiet" onClick={close}>
            {t.uploadCancel}
          </Button>
          <Button variant="primary" icon="upload" onClick={() => void go()} disabled={!file || !consent || busy} busy={busy}>
            {busy ? t.uploadReading : t.uploadGo}
          </Button>
        </>
      }
    >
      <div className="dk-cb-up">
        <label className="dk-cb-up-file" htmlFor={fid}>
          <Icon name="camera" size={18} />
          <span>{file ? file.name : t.uploadPick}</span>
          <input id={fid} type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile} />
        </label>
        <label className="dk-cb-up-consent" htmlFor={cid}>
          <input id={cid} type="checkbox" checked={consent} onChange={(e) => setConsent(e.currentTarget.checked)} />
          <span>{t.uploadConsent}</span>
        </label>
        {error && (
          <p className="dk-cb-up-err" role="alert">
            <Icon name="alert" size={14} />
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}

export function OwnView({ doc, onClose }: { doc: OwnDoc; onClose: () => void }) {
  const { lang } = useI18n()
  const t = STR[lang]
  return (
    <section className="dk-cb-own" aria-label={`${t.uploadYours}: ${doc.name}`}>
      <div className="dk-cb-own-bar">
        <span className="dk-cb-kind is-live">
          <i aria-hidden="true" />
          Live
        </span>
        <b>{t.uploadYours}</b>
        <span className="dk-cb-own-name">{doc.name}</span>
        <Button size="sm" variant="quiet" icon="close" onClick={onClose}>
          {t.uploadClose}
        </Button>
      </div>
      <div className="dk-cb-own-stage">
        <div className="dk-cb-own-page">
          <img src={doc.url} alt={`${t.uploadYours}: ${doc.name}`} />
          {doc.extracted.fields
            .filter((f) => f.box)
            .map((f, i) => (
              <span key={f.key} className="dk-cb-own-box" style={{ left: `${f.box!.x}%`, top: `${f.box!.y}%`, width: `${f.box!.w}%`, height: `${f.box!.h}%` }} title={`${f.label[lang]}: ${f.value}`}>
                <i className="dk-num">{i + 1}</i>
              </span>
            ))}
        </div>
      </div>
      <p className="dk-cb-own-note" role="status">
        <Icon name="lock" size={14} />
        {t.uploadDone}
      </p>
    </section>
  )
}
