/**
 * Scan — opt-in camera barcode scan (only offered where the browser has BarcodeDetector). Frames stay on the device;
 * the stream stops when the drawer closes (useCamera).
 */
import { useEffect, useRef, useState } from 'react'
import { Button, Drawer } from '../../demo-kit/ui'
import { useCamera } from '../../demo-kit/media/camera'
import { useT } from './strings'

const S = {
  id: { title: 'Pindai kode batang', start: 'Izinkan kamera', note: 'Gambar diproses di browser ini dan tidak diunggah.', err: 'Kamera tidak dapat dibuka. Ketik kode batang di kolom kode.' },
  en: { title: 'Scan a barcode', start: 'Allow camera', note: 'Frames are processed in this browser and never uploaded.', err: 'The camera could not be opened. Type the barcode in the code field.' },
}
type Detector = { detect(v: HTMLVideoElement): Promise<{ rawValue: string }[]> }

export default function Scan({ open, onClose, onCode }: { open: boolean; onClose: () => void; onCode: (c: string) => void }) {
  const { lang } = useT()
  const t = S[lang]
  const cam = useCamera({ facing: 'environment' })
  const video = useRef<HTMLVideoElement>(null)
  const [hit, setHit] = useState(false)
  useEffect(() => {
    const v = video.current
    if (!v || !cam.stream) return
    v.srcObject = cam.stream
    void v.play().catch(() => undefined)
    const D = (window as unknown as { BarcodeDetector: new (o: object) => Detector }).BarcodeDetector
    const det = new D({ formats: ['ean_13', 'code_128'] })
    const id = window.setInterval(() => {
      void det.detect(v).then((r) => {
        const c = r[0]?.rawValue
        if (c && !hit) {
          setHit(true)
          onCode(c)
          onClose()
        }
      }).catch(() => undefined)
    }, 300)
    return () => window.clearInterval(id)
  }, [cam.stream, hit, onClose, onCode])
  return (
    <Drawer open={open} onClose={onClose} title={t.title}>
      <div className="dk-ta-scan">
        <video ref={video} muted playsInline aria-label={t.title} />
        {!cam.stream && (
          <Button variant="primary" icon="camera" onClick={() => void cam.start()}>
            {t.start}
          </Button>
        )}
        {cam.error && <p className="dk-ta-muted">{t.err}</p>}
        <small className="dk-ta-muted">{t.note}</small>
      </div>
    </Drawer>
  )
}
