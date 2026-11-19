/**
 * Brief.tsx (lazy, bank drawer "Ringkas pengajuan") — sends "Ringkas pengajuan <id>" to the Rapor Usaha AI (sim or
 * Live with fallback) and renders the `rapor-usaha/loan-brief` card (3 strengths, 3 risks, recommendation, maximum)
 * from `loanBrief()` = loanAdvice + the business's data; a Live answer only supplies the wording. Fair,
 * non-discriminatory wording: business data only.
 */
import { useEffect } from 'react'
import { registerStructuredSchema, useAiChat } from '../../demo-kit/ai/chat'
import { Icon, LoadingText } from '../../demo-kit/ui'
import { clock, useSession, useWorld, world } from '../../demo-kit/world'
import { loanBrief, ruContext } from './scenario'
import { jt } from './model'
import { REC } from './Bank'
import { useT } from './strings'

const isBi = (x: unknown) => !!x && typeof (x as { id?: unknown }).id === 'string'
const briefSchema = {
  safeParse: (v: unknown) => {
    const o = v as { loanId?: unknown; rec?: unknown; strengths?: unknown; risks?: unknown; maxAmount?: unknown } | null
    const ok =
      !!o &&
      typeof o.loanId === 'string' &&
      typeof o.rec === 'string' &&
      Array.isArray(o.strengths) &&
      Array.isArray(o.risks) &&
      typeof o.maxAmount === 'number' &&
      (o.strengths as unknown[]).every((x) => isBi(x) || typeof x === 'string') &&
      (o.risks as unknown[]).every((x) => isBi(x) || typeof x === 'string')
    return ok ? { success: true as const, data: v } : { success: false as const }
  },
}
registerStructuredSchema('rapor-usaha/loan-brief', briefSchema)
registerStructuredSchema('rapor-usaha/brief_loan', briefSchema)

const S = {
  id: { q: (id: string) => `Ringkas pengajuan ${id}`, title: 'Ringkasan pengajuan (AI)', strengths: 'Kekuatan', risks: 'Risiko', max: (v: string) => `Jumlah maksimal yang wajar ${v} (simulasi)`, wait: 'Menyusun ringkasan…', fell: 'Live tidak tersedia, memakai simulasi' },
  en: { q: (id: string) => `Summarise the application ${id}`, title: 'Application summary (AI)', strengths: 'Strengths', risks: 'Risks', max: (v: string) => `Reasonable maximum ${v} (simulated)`, wait: 'Writing the summary…', fell: 'Live unavailable, using the simulation' },
}

export default function Brief({ loanId }: { loanId: string }) {
  const { lang } = useT()
  const L = S[lang]
  const session = useSession()
  const chat = useAiChat('rapor-usaha', { mode: session.aiMode, role: session.role, getContext: () => ruContext(world.get(), clock.get().minutes, loanId) })
  useEffect(() => {
    void chat.send(L.q(loanId), { maxMs: 1500 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loanId])
  const b = useWorld((s) => JSON.stringify(loanBrief(s, loanId)))
  const brief = JSON.parse(b) as ReturnType<typeof loanBrief>
  const done = chat.last?.status === 'done' && !!chat.last.structured?.some((x) => x.kind === 'rapor-usaha/loan-brief' || x.kind === 'rapor-usaha/brief_loan')
  if (!brief) return null
  if (!done) return <LoadingText>{L.wait}</LoadingText>
  const rec = REC[brief.rec]!
  return (
    <section className="dk-ru-aicard" aria-label={L.title} data-ru="loan-brief" aria-live="polite">
      <h3>
        <Icon name="spark" size={16} /> {L.title}
      </h3>
      <p>
        <b>{rec[lang]}</b> · {L.max(jt(brief.maxAmount, lang))}
      </p>
      <div className="dk-ru-brief">
        <div>
          <h4>{L.strengths}</h4>
          <ul>
            {brief.strengths.map((x) => (
              <li key={x.id}>{x[lang]}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4>{L.risks}</h4>
          <ul>
            {brief.risks.map((x) => (
              <li key={x.id}>{x[lang]}</li>
            ))}
          </ul>
        </div>
      </div>
      {chat.fellBack && <p className="dk-ru-fine">{L.fell}</p>}
    </section>
  )
}
