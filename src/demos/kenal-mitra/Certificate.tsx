/**
 * Certificate (lazy) — the verification certificate the partner bank reads (PaperFrame SPESIMEN, print / save as PDF).
 * Every value comes from the world: the verification row, its request and the subject's name.
 */
import { useRef } from 'react'
import { PaperFrame, printPaper } from '../../demo-kit/frames'
import { Button, Modal } from '../../demo-kit/ui'
import { useWorld } from '../../demo-kit/world'
import { subjectName } from '../../demo-kit/world/usaha-pintar'
import { clockText } from './model'
import { STR } from './strings'
import { useCaseStr } from './strings-case'

export default function Certificate({ verificationId, onClose }: { verificationId: string; onClose: () => void }) {
  const { c, lang } = useCaseStr()
  const k = c.cert
  const t = STR[lang]
  const paper = useRef<HTMLDivElement>(null)
  const data = useWorld((s) => {
    const v = s.verifications.byId[verificationId]
    if (!v) return null
    const reqId = s.verificationRequests.ids.find((id) => s.verificationRequests.byId[id]?.verificationId === verificationId)
    const r = reqId ? s.verificationRequests.byId[reqId] : undefined
    const subject = r ? subjectName(s, r) : v.subjectKind === 'business' ? (s.businesses.byId[v.subjectId]?.name ?? v.subjectId) : (s.documents.byId[v.subjectId]?.ownerName ?? v.subjectId)
    return { v, code: r?.code ?? '—', by: r?.requestedBy ?? '—', subject }
  })
  const when = data ? (data.v.at >= 0 ? t.at(clockText(data.v.at, lang)) : t.daysAgo(Math.max(1, Math.ceil(-data.v.at / 1440)))) : ''
  return (
    <Modal
      open
      onClose={onClose}
      title={k.title}
      size="md"
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            {k.close}
          </Button>
          <Button variant="primary" icon="print" onClick={() => paper.current && printPaper(paper.current)} disabled={!data}>
            {k.print}
          </Button>
        </>
      }
    >
      {data && (
        <div ref={paper}>
          <PaperFrame label={k.title} size="auto" className="dk-km-cert">
            <p className="dk-km-cert-issuer">{k.issuer}</p>
            <h3>{k.title}</h3>
            <dl>
              <dt>{k.code}</dt>
              <dd className="dk-num">{data.code}</dd>
              <dt>{k.subject}</dt>
              <dd>{data.subject}</dd>
              <dt>{k.kind}</dt>
              <dd>{data.v.kind.toUpperCase()}</dd>
              <dt>{k.result}</dt>
              <dd>{t.result[data.v.result] ?? data.v.result}</dd>
              <dt>{k.score}</dt>
              <dd className="dk-num">{data.v.kind === 'kyc' ? t.riskOf(data.v.score) : t.scoreOf(data.v.score)}</dd>
              <dt>{k.when}</dt>
              <dd>{when}</dd>
              <dt>{k.by}</dt>
              <dd>{data.by}</dd>
            </dl>
            <p className="dk-km-cert-note">{k.note}</p>
            <span className="dk-km-cert-mark" aria-hidden="true">
              SPESIMEN
            </span>
          </PaperFrame>
        </div>
      )}
    </Modal>
  )
}
