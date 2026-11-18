/**
 * demos/radar-isu/Deep.tsx — "Analisis Mendalam" (ex-ScrapPulse, spec P4): up to 4 keywords, period 7/14/30 days,
 * source language; a staged run with per-source status; results = volume & momentum, bilingual sentiment, topics and
 * media leaning, key quotes, survey questions; XLSX + JSON export (lazy). Simulated data, labelled as such.
 * Opened directly by /tools/scrappulse → /demo/radar-isu?tab=analisis.
 */
import { startTransition, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Button, Chip, Icon, Input, InsightCallout, Kpi, KpiStrip, Segmented, motionMode, dropChips } from '../../demo-kit/ui'
import { LineChart } from '../../demo-kit/viz'
import { compact, dateWib } from '../../demo-kit/viz/format'
import { useShell } from '../../demo-kit/shell'
import { useI18n } from '../../lib/i18n'
import { clock, useWorld, world, type WorldState } from '../../demo-kit/world'
import { analyze, type DeepResult, type Period, type SourceLang, type Split } from './deep-model'
import { getDeepResult, setDeepResult, takeDeepKeyword, topicsOf, useDeepResult } from './model'
import { topicName } from './strings'

const S = {
  id: {
    title: 'Percakapan publik, dibedah per kata kunci',
    lead: 'Hingga 4 kata kunci. Radar menyisir semua unggahan publik yang memuat kata kunci (simulasi), lalu menyusun volume, sentimen, topik, kutipan, dan pertanyaan survei. Karena itu angkanya jauh lebih besar daripada Pantauan Live, yang hanya memuat mention terkurasi dari media & akun pantauan.',
    kw: 'Kata kunci',
    kwPh: 'Ketik kata kunci lalu Enter',
    add: 'Tambah',
    remove: 'Hapus {k}',
    max: 'Maksimal 4 kata kunci.',
    sugg: 'Saran dari topik hari ini',
    period: 'Periode',
    days: '{n} hari',
    lang: 'Bahasa sumber',
    langAll: 'ID + EN',
    run: 'Jalankan analisis',
    rerun: 'Jalankan ulang',
    need: 'Tambahkan minimal 1 kata kunci.',
    running: 'Menyisir sumber…',
    st: {
      antre: 'Menunggu',
      ambil: 'Mengambil {n} unggahan',
      analisis: 'Menganalisis sentimen & topik',
      selesai: '{n} unggahan',
      selesaiAduan: '{n} aduan',
    } as Record<string, string>,
    total: 'Total unggahan',
    totalCap: 'unggahan publik · aduan Sapa Warga ({n}) dihitung terpisah',
    excluded: 'di luar total',
    done: 'Analisis selesai: {n} unggahan untuk {k}.',
    momentum: 'Momentum 3 hari',
    net: 'Sentimen bersih',
    reach: 'Perkiraan jangkauan',
    volTitle: 'Volume & momentum',
    volUnit: 'unggahan per hari (simulasi)',
    sentTitle: 'Sentimen per kata kunci',
    sentLangTitle: 'Sentimen menurut bahasa sumber',
    pos: 'Positif',
    neu: 'Netral',
    neg: 'Negatif',
    topicsTitle: 'Topik di dalam percakapan',
    mediaTitle: 'Kecenderungan media & akun',
    mediaNote: 'nama media & akun fiktif',
    lean: { pos: 'condong positif', neu: 'berimbang', neg: 'condong negatif' },
    quotesTitle: 'Kutipan kunci',
    surveyTitle: 'Rekomendasi pertanyaan survei',
    export: 'Ekspor',
    xlsx: 'Unduh XLSX',
    json: 'Unduh JSON',
    exported: 'Berkas {f} terunduh.',
    sim: 'Data simulasi · seed {s} · dijalankan pukul {t}',
    empty: 'Pilih kata kunci dan jalankan analisis. Hasil terakhir juga masuk ke tab Laporan dan berkas ekspor.',
    insight: 'Temuan utama',
    posts: 'unggahan',
    template: 'contoh templat (simulasi): tidak ada unggahan pantauan yang memuat kata kunci ini',
    tooFew: 'Terlalu sedikit unggahan untuk bagian ini.',
  },
  en: {
    title: 'Public conversation, dissected by keyword',
    lead: 'Up to 4 keywords. The radar sweeps every public post that contains a keyword (simulated) and builds volume, sentiment, topics, quotes and survey questions. That is why the numbers are far larger than the Live Monitor, which only carries curated mentions from monitored outlets & accounts.',
    kw: 'Keywords',
    kwPh: 'Type a keyword and press Enter',
    add: 'Add',
    remove: 'Remove {k}',
    max: 'At most 4 keywords.',
    sugg: 'Suggestions from today’s topics',
    period: 'Period',
    days: '{n} days',
    lang: 'Source language',
    langAll: 'ID + EN',
    run: 'Run the analysis',
    rerun: 'Run again',
    need: 'Add at least 1 keyword.',
    running: 'Sweeping sources…',
    st: {
      antre: 'Waiting',
      ambil: 'Fetching {n} posts',
      analisis: 'Scoring sentiment & topics',
      selesai: '{n} posts',
      selesaiAduan: '{n} complaints',
    } as Record<string, string>,
    total: 'Total posts',
    totalCap: 'public posts · Sapa Warga complaints ({n}) counted separately',
    excluded: 'not in the total',
    done: 'Analysis done: {n} posts for {k}.',
    momentum: '3-day momentum',
    net: 'Net sentiment',
    reach: 'Estimated reach',
    volTitle: 'Volume & momentum',
    volUnit: 'posts per day (simulated)',
    sentTitle: 'Sentiment per keyword',
    sentLangTitle: 'Sentiment by source language',
    pos: 'Positive',
    neu: 'Neutral',
    neg: 'Negative',
    topicsTitle: 'Topics inside the conversation',
    mediaTitle: 'Media & account leaning',
    mediaNote: 'fictional outlets & accounts',
    lean: { pos: 'leans positive', neu: 'balanced', neg: 'leans negative' },
    quotesTitle: 'Key quotes',
    surveyTitle: 'Suggested survey questions',
    export: 'Export',
    xlsx: 'Download XLSX',
    json: 'Download JSON',
    exported: '{f} downloaded.',
    sim: 'Simulated data · seed {s} · run at {t}',
    empty: 'Pick keywords and run the analysis. The latest result also feeds the Report tab and the export files.',
    insight: 'Key finding',
    posts: 'posts',
    template: 'template example (simulated): no monitored post contains this keyword',
    tooFew: 'Too few posts for this section.',
  },
}
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m))
const pct = (x: number) => `${Math.round(x * 100)}%`

/* ------------------------------------------------------------------ small pieces */

function SplitBar({ s, label, t }: { s: Split; label: string; t: (typeof S)['id'] }) {
  return (
    <div className="dk-ri-split" role="img" aria-label={`${label}: ${t.pos} ${pct(s.pos)}, ${t.neu} ${pct(s.neu)}, ${t.neg} ${pct(s.neg)}`}>
      <span className="dk-ri-split-l">{label}</span>
      <span className="dk-ri-split-bar" aria-hidden="true">
        <i className="is-pos" style={{ flexGrow: s.pos }} />
        <i className="is-neu" style={{ flexGrow: s.neu }} />
        <i className="is-neg" style={{ flexGrow: s.neg }} />
      </span>
      <span className="dk-ri-split-v dk-num" aria-hidden="true">
        {pct(s.pos)} · {pct(s.neu)} · {pct(s.neg)}
      </span>
    </div>
  )
}

type Stage = 'antre' | 'ambil' | 'analisis' | 'selesai'

const selMentions = (s: WorldState) => s.mentions
const selSeed = (s: WorldState) => s.seed

export default function Deep() {
  const shell = useShell()
  const { lang } = useI18n()
  const t = S[lang]
  const mentions = useWorld(selMentions)
  const seed = useWorld(selSeed)
  const prev = useDeepResult()
  const suggestions = useMemo(() => {
    const now = clock.get().minutes
    const top = topicsOf(mentions, now, 24)
      .slice(0, 5)
      .map((c) => topicName(c.topic, lang).toLowerCase())
    return [...new Set([...top, lang === 'id' ? 'bendungan' : 'dam', lang === 'id' ? 'harga cabai' : 'chilli prices'])].slice(0, 6)
  }, [mentions, lang])

  const [kws, setKws] = useState<string[]>(() => {
    const handed = takeDeepKeyword()
    const last = getDeepResult()?.input.keywords
    if (handed) return [handed, ...(last ?? ['banjir']).filter((k) => k !== handed)].slice(0, 2)
    return last ?? (lang === 'id' ? ['banjir', 'harga cabai'] : ['flood', 'chilli prices'])
  })
  const [draft, setDraft] = useState('')
  const [days, setDays] = useState<Period>(() => prev?.input.days ?? 7)
  const [src, setSrc] = useState<SourceLang>(() => prev?.input.lang ?? 'all')
  const [run, setRun] = useState<{ stage: number; result: DeepResult } | null>(null)
  const [msg, setMsg] = useState('')
  const [done, setDone] = useState('')
  const result = run && run.stage >= 9 ? run.result : !run ? prev : null

  const add = (k: string) => {
    const v = k.trim().slice(0, 40)
    if (!v || kws.length >= 4 || kws.some((x) => x.toLowerCase() === v.toLowerCase())) return
    setKws([...kws, v])
  }
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    add(draft)
    setDraft('')
  }

  // staged run: 4 sources × (fetch, analyse) + done = 9 steps, ~2.6 s (0.6 s when motion is reduced)
  const timer = useRef(0)
  const srcRef = useRef<HTMLOListElement>(null)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const start = () => {
    if (!kws.length) return
    const r = analyze(world.get(), clock.get().minutes, {
      keywords: kws,
      days,
      lang: src,
    })
    const gap = motionMode() === 'full' ? 290 : 60
    setRun({ stage: 0, result: r })
    // phones: the form fills the screen, bring the per-source progress into view
    window.requestAnimationFrame(() =>
      srcRef.current?.scrollIntoView({
        block: 'nearest',
        behavior: motionMode() === 'full' ? 'smooth' : 'auto',
      }),
    )
    const step = (i: number) => {
      timer.current = window.setTimeout(() => {
        // the last stage reveals every result card at once: render it as a transition (interruptible, INP)
        const next = () => setRun((cur) => (cur && cur.result === r ? { ...cur, stage: i } : cur))
        if (i === 9) startTransition(next)
        else next()
        if (i < 9) step(i + 1)
        else {
          setDeepResult(r)
          if (r.keywords.length >= 2) shell.markMission('analisis')
          // the result lands below the form (phones: below the fold): bring the key finding into view and say so
          const total = r.keywords.reduce((a, k) => a + k.total, 0)
          setMsg('')
          setDone(fill(S[lang].done, { n: total.toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB'), k: r.input.keywords.join(', ') }))
          scrollPending.current = true
        }
      }, gap)
    }
    step(1)
  }

  const resRef = useRef<HTMLDivElement>(null)
  const scrollPending = useRef(false)
  useEffect(() => {
    const el = resRef.current
    if (!result || run?.stage !== 9 || !el) return
    if (scrollPending.current) {
      scrollPending.current = false
      // the result lands below the form (phones: below the fold): bring the key finding into view
      el.scrollIntoView({ block: 'start', behavior: motionMode() === 'full' ? 'smooth' : 'auto' })
      el.focus({ preventScroll: true })
    }
    return dropChips(el.querySelectorAll('.dk-ri-deep-card'))
  }, [result, run?.stage])

  const exportAs = async (kind: 'xlsx' | 'json') => {
    const m = await import('./export')
    const name = kind === 'xlsx' ? m.downloadXlsx(world.get(), clock.get().minutes, lang) : m.downloadJson(world.get(), clock.get().minutes, lang)
    shell.markMission('ekspor')
    setMsg(fill(t.exported, { f: name }))
  }

  const stageOf = (i: number): Stage => {
    if (!run) return 'antre'
    const s = run.stage
    if (s >= 2 * i + 2) return 'selesai'
    if (s === 2 * i + 1) return 'analisis'
    if (s === 2 * i) return 'ambil'
    return 'antre'
  }
  const running = !!run && run.stage < 9

  const kpi = result
    ? (() => {
        const total = result.keywords.reduce((a, k) => a + k.total, 0)
        const ks = result.keywords
        const w = (f: (k: (typeof ks)[number]) => number) => (total ? ks.reduce((a, k) => a + f(k) * k.total, 0) / total : 0)
        return {
          total,
          momentum: Math.round(w((k) => k.momentum)),
          net: Math.round(w((k) => k.sentiment.pos - k.sentiment.neg) * 100),
          reach: result.keywords.reduce((a, k) => a + k.reach, 0),
        }
      })()
    : null

  return (
    <div className="dk-ri-deep">
      <header className="dk-ri-live-h">
        <div className="dk-ri-live-ht">
          <h2 className="dk-ri-h2">{t.title}</h2>
          <p className="dk-ri-lead">{t.lead}</p>
        </div>
      </header>

      <form className="dk-ri-deep-form" onSubmit={onSubmit} aria-label={t.kw}>
        <div className="dk-ri-deep-kw">
          <label className="dk-ri-k" htmlFor="dk-ri-kw">
            {t.kw} <span className="dk-num">({kws.length}/4)</span>
          </label>
          <div className="dk-ri-kwrow">
            <Input id="dk-ri-kw" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t.kwPh} maxLength={40} disabled={kws.length >= 4} />
            <Button type="submit" variant="secondary" icon="plus" disabled={!draft.trim() || kws.length >= 4}>
              {t.add}
            </Button>
          </div>
          <div className="dk-ri-chips">
            {kws.map((k) => (
              <Chip key={k} tone="accent" onRemove={() => setKws(kws.filter((x) => x !== k))} removeLabel={fill(t.remove, { k })}>
                {k}
              </Chip>
            ))}
          </div>
          {kws.length >= 4 && <p className="dk-ri-note">{t.max}</p>}
          <p className="dk-ri-k">{t.sugg}</p>
          <div className="dk-ri-chips">
            {suggestions
              .filter((s) => !kws.some((k) => k.toLowerCase() === s))
              .map((s) => (
                <Button key={s} type="button" size="sm" variant="ghost" icon="plus" onClick={() => add(s)} disabled={kws.length >= 4}>
                  {s}
                </Button>
              ))}
          </div>
        </div>
        <div className="dk-ri-deep-opts">
          <div>
            <p className="dk-ri-k">{t.period}</p>
            <Segmented<`${Period}`>
              label={t.period}
              value={`${days}`}
              onChange={(v) => setDays(Number(v) as Period)}
              options={(['7', '14', '30'] as const).map((d) => ({
                value: d,
                label: fill(t.days, { n: d }),
              }))}
            />
          </div>
          <div>
            <p className="dk-ri-k">{t.lang}</p>
            <Segmented<SourceLang>
              label={t.lang}
              value={src}
              onChange={setSrc}
              options={[
                { value: 'all', label: t.langAll },
                { value: 'id', label: 'ID' },
                { value: 'en', label: 'EN' },
              ]}
            />
          </div>
          <Button type="button" variant="primary" icon="search" onClick={start} disabled={!kws.length || running} busy={running} data-testid="ri-deep-run">
            {result ? t.rerun : t.run}
          </Button>
          {!kws.length && <p className="dk-ri-note is-warn">{t.need}</p>}
        </div>
      </form>

      {run && (
        <ol ref={srcRef} className="dk-ri-src" aria-label={t.running} aria-live="polite">
          {run.result.sources.map((s, i) => {
            const st = stageOf(i)
            return (
              <li key={s.id} className={`is-${st}`}>
                <span className="dk-ri-src-ic" aria-hidden="true">
                  {st === 'selesai' ? <Icon name="check" size={14} /> : st === 'antre' ? <Icon name="clock" size={14} /> : <Icon name="refresh" size={14} />}
                </span>
                <span className="dk-ri-src-l">
                  {s.label[lang]}
                  {s.excluded && <small className="dk-ri-src-x"> · {t.excluded}</small>}
                </span>
                <span className="dk-ri-src-s dk-num">
                  {fill((s.excluded && st === 'selesai' ? t.st.selesaiAduan : t.st[st]) ?? '', {
                    n: s.count.toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB'),
                  })}
                </span>
                <span className="dk-ri-src-bar" aria-hidden="true">
                  <i
                    style={{
                      transform: `scaleX(${st === 'selesai' ? 1 : st === 'analisis' ? 0.7 : st === 'ambil' ? 0.35 : 0})`,
                    }}
                  />
                </span>
              </li>
            )
          })}
        </ol>
      )}

      {!result && !run && <p className="dk-ri-empty-note">{t.empty}</p>}
      <p className="dk-sr" aria-live="polite">
        {done}
      </p>

      {result && kpi && (
        <div ref={resRef} className="dk-ri-deep-res" tabIndex={-1} aria-label={t.insight}>
          <InsightCallout title={t.insight} className="dk-ri-deep-card">
            <p>{result.insight[lang]}</p>
          </InsightCallout>
          <KpiStrip label={t.volTitle} className="dk-ri-kpis dk-ri-deep-card">
            <Kpi label={t.total} value={kpi.total} caption={fill(t.totalCap, { n: result.sources.find((x) => x.excluded)?.count ?? 0 })} />
            <Kpi label={t.momentum} value={kpi.momentum} format={(n) => `${n > 0 ? '+' : ''}${Math.round(n)}%`} />
            <Kpi label={t.net} value={kpi.net} format={(n) => `${n > 0 ? '+' : ''}${Math.round(n)}`} />
            <Kpi label={t.reach} value={kpi.reach} format={(n) => compact(n, lang)} />
          </KpiStrip>
          <div className="dk-ri-deep-grid">
            <div className="dk-ri-deep-card is-wide">
              <LineChart
                title={t.volTitle}
                unit={t.volUnit}
                seed={seed}
                x={result.dates}
                xFormat={(x) => dateWib(String(x), lang, 'dayMonth')}
                series={result.keywords.map((k) => ({
                  id: k.keyword,
                  label: k.keyword,
                  values: k.daily,
                }))}
                zero
                height={220}
              />
            </div>
            <section className="dk-ri-deep-card dk-ri-panel">
              <h3 className="dk-ri-sec-t">{t.sentTitle}</h3>
              <p className="dk-ri-legend" aria-hidden="true">
                <i className="is-pos" /> {t.pos} <i className="is-neu" /> {t.neu} <i className="is-neg" /> {t.neg}
              </p>
              {result.keywords.map((k) => (
                <SplitBar key={k.keyword} s={k.sentiment} label={k.keyword} t={t} />
              ))}
              <h3 className="dk-ri-sec-t">{t.sentLangTitle}</h3>
              {result.keywords.flatMap((k) => [
                <SplitBar key={`${k.keyword}-id`} s={k.byLang.id} label={`${k.keyword} · ID`} t={t} />,
                <SplitBar key={`${k.keyword}-en`} s={k.byLang.en} label={`${k.keyword} · EN`} t={t} />,
              ])}
            </section>
            <section className="dk-ri-deep-card dk-ri-panel">
              <h3 className="dk-ri-sec-t">{t.topicsTitle}</h3>
              {!result.topics.length && <p className="dk-ri-note">{t.tooFew}</p>}
              <ul className="dk-ri-bars">
                {result.topics.slice(0, 8).map((x) => (
                  <li key={`${x.keyword}|${x.label.id}`}>
                    <span className="dk-ri-bars-l">
                      {x.label[lang]} <small>· {x.keyword}</small>
                    </span>
                    <span className="dk-ri-bars-t" aria-hidden="true">
                      <i
                        style={{
                          transform: `scaleX(${Math.min(1, x.share * 2)})`,
                        }}
                      />
                    </span>
                    <span className="dk-ri-bars-v dk-num">{pct(x.share)}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="dk-ri-deep-card dk-ri-panel">
              <h3 className="dk-ri-sec-t">
                {t.mediaTitle} <span className="dk-ri-sec-meta">{t.mediaNote}</span>
              </h3>
              {!result.media.length && <p className="dk-ri-note">{t.tooFew}</p>}
              <ul className="dk-ri-media">
                {result.media.map((m) => (
                  <li key={m.outlet}>
                    <Icon name={m.kind === 'berita' ? 'doc' : 'chat'} size={14} />
                    <span className="dk-ri-media-o">{m.outlet}</span>
                    <span className="dk-ri-media-n dk-num">
                      {m.count} {t.posts}
                    </span>
                    <span className={`dk-ri-sent is-${m.lean < -0.2 ? 'negatif' : m.lean > 0.2 ? 'positif' : 'netral'}`}>
                      <i aria-hidden="true" />
                      {m.lean < -0.2 ? t.lean.neg : m.lean > 0.2 ? t.lean.pos : t.lean.neu}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="dk-ri-deep-card dk-ri-panel">
              <h3 className="dk-ri-sec-t">{t.quotesTitle}</h3>
              {!result.quotes.length && <p className="dk-ri-note">{t.tooFew}</p>}
              <ul className="dk-ri-quotes">
                {result.quotes.map((q, i) => (
                  <li key={i} className={`is-${q.sentiment}`}>
                    <blockquote>“{q.text[lang]}”</blockquote>
                    <p className="dk-ri-note">
                      {q.outlet} · {q.keyword} · {compact(q.reach, lang)}
                      {q.template && (
                        <>
                          {' '}
                          · <i>{t.template}</i>
                        </>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
            <section className="dk-ri-deep-card dk-ri-panel">
              <h3 className="dk-ri-sec-t">{t.surveyTitle}</h3>
              {!result.survey.length && <p className="dk-ri-note">{t.tooFew}</p>}
              <ol className="dk-ri-ul">
                {result.survey.map((q, i) => (
                  <li key={i}>{q[lang]}</li>
                ))}
              </ol>
            </section>
          </div>
          <div className="dk-ri-export dk-ri-deep-card">
            <span className="dk-ri-k">{t.export}</span>
            <Button variant="secondary" icon="download" onClick={() => void exportAs('xlsx')} data-testid="ri-xlsx">
              {t.xlsx}
            </Button>
            <Button variant="secondary" icon="download" onClick={() => void exportAs('json')} data-testid="ri-json">
              {t.json}
            </Button>
            <span className="dk-ri-note" aria-live="polite">
              {msg}
            </span>
          </div>
          <p className="dk-ri-foot">
            <Icon name="info" size={14} />{' '}
            {fill(t.sim, {
              s: seed,
              t: `${String(Math.floor(result.at / 60)).padStart(2, '0')}${lang === 'id' ? '.' : ':'}${String(result.at % 60).padStart(2, '0')}`,
            })}
          </p>
        </div>
      )}
    </div>
  )
}
