/**
 * TraceTimeline — one agent run as a timeline (pure props, reusable by /ekosistem/inti in Tahap 6): Intent (id +
 * confidence) → each tool step (name, product, duration, input / output collapsible) → Data (structured kinds) →
 * Jawaban (first token / stream time, Sim/Live). The duration bars scale by transform (no layout animation).
 */
import { PRODUCT_BY_SLUG, isProductSlug, type ProductSlug } from '../../content/products'
import type { AiTrace } from '../../demo-kit/ai/trace'

export interface TraceTimelineProps {
  trace: AiTrace
  lang: 'id' | 'en'
}
const S = {
  id: { intent: 'Intent', conf: 'keyakinan', tool: 'Alat', data: 'Data', answer: 'Jawaban', noData: 'tanpa data terstruktur', first: 'token pertama', stream: 'streaming', tokens: 'potongan', io: 'Masukan / keluaran', input: 'Masukan', output: 'Keluaran', fallback: 'jawaban cadangan', fellBack: 'Live gagal, jatuh ke simulasi', label: 'Jejak berpikir agen', steps: (n: number) => `${n} langkah` },
  en: { intent: 'Intent', conf: 'confidence', tool: 'Tool', data: 'Data', answer: 'Answer', noData: 'no structured data', first: 'first token', stream: 'streaming', tokens: 'chunks', io: 'Input / output', input: 'Input', output: 'Output', fallback: 'fallback answer', fellBack: 'Live failed, fell back to the simulation', label: 'Agent reasoning trace', steps: (n: number) => `${n} steps` },
}
const ms = (n: number | undefined | null) => (n == null ? '—' : n >= 1000 ? `${(n / 1000).toFixed(1).replace('.', ',')} s` : `${Math.round(n)} ms`)
const productOfStep = (input: Record<string, unknown>, fb: ProductSlug): ProductSlug => (typeof input.product === 'string' && isProductSlug(input.product) ? input.product : fb)

export function traceSteps(t: AiTrace): number {
  return 3 + t.steps.length
}

export function TraceTimeline({ trace, lang }: TraceTimelineProps) {
  const L = S[lang]
  const max = Math.max(1, ...trace.steps.map((s) => s.ms ?? 0))
  const n = traceSteps(trace)
  return (
    <ol className="dk-in-tl" aria-label={`${L.label} · ${L.steps(n)}`} data-in="timeline" data-steps={n}>
      <li className="dk-in-tl-step is-intent">
        <span className="dk-in-tl-k">{L.intent}</span>
        <span className="dk-in-tl-v">
          <code>{trace.intentId ?? L.fallback}</code>
          {trace.confidence != null && (
            <span className="dk-in-muted">
              {' '}
              · {L.conf} {Math.round(trace.confidence * 100)} %
            </span>
          )}
        </span>
      </li>
      {trace.steps.map((s, i) => {
        const p = productOfStep(s.input, trace.product)
        return (
          <li key={s.id || i} className="dk-in-tl-step is-tool" data-eco={PRODUCT_BY_SLUG[p]?.eco}>
            <span className="dk-in-tl-k">
              {L.tool} {i + 1}
            </span>
            <span className="dk-in-tl-v">
              <code>{s.name}</code> <span className="dk-in-tl-prod">{PRODUCT_BY_SLUG[p]?.name ?? p}</span>
              <span className="dk-in-tl-ms">{ms(s.ms)}</span>
            </span>
            <span className="dk-in-tl-bar" aria-hidden="true">
              <i style={{ transform: `scaleX(${Math.max(0.04, (s.ms ?? 0) / max)})` }} />
            </span>
            <details className="dk-in-tl-io">
              <summary>{L.io}</summary>
              <p className="dk-in-muted">{L.input}</p>
              <pre>{JSON.stringify(s.input, null, 1)}</pre>
              {s.output !== undefined && (
                <>
                  <p className="dk-in-muted">{L.output}</p>
                  <pre>{JSON.stringify(s.output, null, 1)}</pre>
                </>
              )}
            </details>
          </li>
        )
      })}
      <li className="dk-in-tl-step is-data">
        <span className="dk-in-tl-k">{L.data}</span>
        <span className="dk-in-tl-v">{trace.structuredKinds.length ? trace.structuredKinds.map((k) => <code key={k}>{k}</code>) : <span className="dk-in-muted">{L.noData}</span>}</span>
      </li>
      <li className="dk-in-tl-step is-answer">
        <span className="dk-in-tl-k">{L.answer}</span>
        <span className="dk-in-tl-v">
          <span className={`dk-in-mode is-${trace.mode}`}>{trace.mode === 'live' ? 'Live' : 'Sim'}</span>{' '}
          {trace.timing ? (
            <span>
              {L.first} {ms(trace.timing.firstTokenMs)} · {L.stream} {ms(trace.timing.streamMs)} · {trace.timing.tokens} {L.tokens}
            </span>
          ) : (
            <span className="dk-in-muted">—</span>
          )}
          {trace.fellBack && <span className="dk-in-muted"> · {L.fellBack}</span>}
        </span>
      </li>
    </ol>
  )
}
