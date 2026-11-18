/**
 * demos/radar-isu/Report.tsx — "Laporan" (spec P4): the daily public-opinion report, assembled from the live world
 * (KPIs, 24 h sentiment, top topics, hoax + clarification, the last Deep Analysis) in a printable PaperFrame.
 * Print / PDF, XLSX and JSON exports tick the "Ekspor laporan" mission. Labelled as a simulated demo document.
 */
import { useMemo, useRef, useState } from 'react'
import { Button, Icon } from '../../demo-kit/ui'
import { PaperFrame, printPaper } from '../../demo-kit/frames'
import { LineChart } from '../../demo-kit/viz'
import { clockWib, compact, dateWib } from '../../demo-kit/viz/format'
import { useShell } from '../../demo-kit/shell'
import { clock, rows, useWorld, world, type WorldState } from '../../demo-kit/world'
import { useI18n } from '../../lib/i18n'
import { clarAuditOf, hoaxPhase, negIssues, radarKpis, recoveryOf, sentSummary, sentimentIndex, signedIdx, useDeepResult, useNow } from './model'
import { CHANNEL_LABEL, TOPIC, type Channel } from './strings'

const S = {
  id: {
    bar: 'Laporan harian otomatis',
    print: 'Cetak / PDF',
    xlsx: 'Unduh XLSX',
    json: 'Unduh JSON',
    done: 'Berkas {f} terunduh.',
    printed: 'Dialog cetak dibuka.',
    kicker: 'Laporan Harian Opini Publik',
    title: 'Radar Isu · {r}',
    meta: '{d} · disusun otomatis pukul {t}',
    to: 'Untuk: Kepala Daerah · Kepala Diskominfo',
    sim: 'SIMULASI',
    s1: '1. Ringkasan eksekutif',
    s2: '2. Sentimen 24 jam',
    s3: '3. Topik teratas',
    s4: '4. Peringatan hoaks & tindak lanjut',
    s5: '5. Analisis mendalam terakhir',
    s6: '6. Rekomendasi',
    k1: 'Mention 24 jam',
    k2: 'Indeks sentimen',
    k3: 'Isu negatif',
    k4: 'Jangkauan',
    sum: 'Dalam 24 jam terakhir tercatat {n} mention (sebelumnya {p}) dengan indeks sentimen {v}. Topik terbesar adalah {top}; isu negatif terbesar {neg}.',
    sumNoNeg: 'tidak ada',
    hoaxNone: 'Tidak ada hoaks yang terdeteksi hari ini.',
    hoaxOn: 'Hoaks “{c}” terdeteksi pukul {t} (skor {s}%, {n} unggahan). Bukti pembanding: {e} Status: BELUM diklarifikasi.',
    hoaxDone:
      'Hoaks “{c}” terdeteksi pukul {t} (skor {s}%, {n} unggahan hoaks asli; gelembung “Hoaks bendungan” juga menghitung mention klarifikasi dan bantahan) dan diklarifikasi pukul {ct} dengan nada {tone} melalui {ch}. {move} Jejak persetujuan: disusun {by} pukul {dt}, disetujui {ap} pukul {at}{sim}, draf v{v}.',
    approvedSim: ' (persetujuan disimulasikan)',
    moveUp: 'Indeks sentimen naik {d} poin dalam 30 menit setelah klarifikasi, dari {a} menjadi {b}.',
    moveDown: 'Indeks sentimen turun {d} poin dalam 30 menit setelah klarifikasi, dari {a} menjadi {b}.',
    moveFlat: 'Indeks sentimen masih {a}; pemulihan dipantau 30 menit setelah terbit.',
    th: ['Topik', 'Mention', 'Jangkauan', 'Sentimen'],
    deepNone: 'Belum ada analisis mendalam hari ini. Jalankan dari tab Analisis Mendalam.',
    deepRow: '“{k}”: {n} unggahan dalam {d} hari, momentum {m}%, {neg}% negatif.',
    recs: {
      hoaxOn: 'Terbitkan klarifikasi resmi hoaks bendungan dalam 30 menit dan sebarkan ke grup WA RT/RW.',
      hoaxDone: 'Pertahankan klarifikasi di kanal resmi 24 jam ke depan dan pantau unggahan ulang narasi lama.',
      neg: 'Siapkan informasi resmi untuk isu “{t}” dan koordinasikan dengan OPD terkait.',
      deep: 'Gunakan pertanyaan survei dari analisis mendalam untuk survei cepat warga pekan ini.',
      base: 'Lanjutkan pemantauan rutin; laporan berikutnya disusun otomatis besok pukul 07.00.',
    },
    tone: {
      tegas: 'tegas',
      menenangkan: 'menenangkan',
      informatif: 'informatif',
    } as Record<string, string>,
    sentTitle: 'Indeks sentimen 24 jam',
    sentUnit: '−100…100',
    foot: 'Dokumen demo GAMADA · semua media, akun, dan angka adalah data simulasi · bukan dokumen resmi',
  },
  en: {
    bar: 'Automatic daily report',
    print: 'Print / PDF',
    xlsx: 'Download XLSX',
    json: 'Download JSON',
    done: '{f} downloaded.',
    printed: 'Print dialog opened.',
    kicker: 'Daily Public Opinion Report',
    title: 'Radar Isu · {r}',
    meta: '{d} · assembled automatically at {t}',
    to: 'For: Regional Head · Head of the Comms Office',
    sim: 'SIMULATED',
    s1: '1. Executive summary',
    s2: '2. Sentiment, 24 h',
    s3: '3. Top topics',
    s4: '4. Hoax alerts & follow-up',
    s5: '5. Latest deep analysis',
    s6: '6. Recommendations',
    k1: 'Mentions, 24 h',
    k2: 'Sentiment index',
    k3: 'Negative issues',
    k4: 'Reach',
    sum: 'In the last 24 hours there were {n} mentions (previously {p}) with a sentiment index of {v}. The biggest topic is {top}; the biggest negative issue is {neg}.',
    sumNoNeg: 'none',
    hoaxNone: 'No hoax was detected today.',
    hoaxOn: 'The “{c}” hoax was detected at {t} (score {s}%, {n} posts). Counter-evidence: {e} Status: NOT clarified yet.',
    hoaxDone:
      'The “{c}” hoax was detected at {t} (score {s}%, {n} original hoax posts; the “Dam hoax” bubble also counts the clarification and rebuttal mentions) and clarified at {ct} in a {tone} tone via {ch}. {move} Approval trail: drafted by the {by} at {dt}, approved by the {ap} at {at}{sim}, draft v{v}.',
    approvedSim: ' (simulated approval)',
    moveUp: 'The sentiment index rose {d} points in the 30 minutes after the clarification, from {a} to {b}.',
    moveDown: 'The sentiment index fell {d} points in the 30 minutes after the clarification, from {a} to {b}.',
    moveFlat: 'The sentiment index is still {a}; recovery is watched for 30 minutes after publishing.',
    th: ['Topic', 'Mentions', 'Reach', 'Sentiment'],
    deepNone: 'No deep analysis today yet. Run one from the Deep Analysis tab.',
    deepRow: '“{k}”: {n} posts over {d} days, {m}% momentum, {neg}% negative.',
    recs: {
      hoaxOn: 'Publish an official clarification of the dam hoax within 30 minutes and push it to neighbourhood WhatsApp groups.',
      hoaxDone: 'Keep the clarification on the official channels for the next 24 hours and watch for reposts of the old narrative.',
      neg: 'Prepare official information on “{t}” and coordinate with the agency in charge.',
      deep: 'Use the survey questions from the deep analysis for a quick citizen poll this week.',
      base: 'Keep routine monitoring; the next report is assembled automatically tomorrow at 07:00.',
    },
    tone: {
      tegas: 'firm',
      menenangkan: 'reassuring',
      informatif: 'informative',
    } as Record<string, string>,
    sentTitle: 'Sentiment index, 24 h',
    sentUnit: '−100…100',
    foot: 'GAMADA demo document · every outlet, account and number is simulated data · not an official document',
  },
}
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m))
const sg = signedIdx

const selMentions = (s: WorldState) => s.mentions
const selHoax = (s: WorldState) => s.hoaxAlerts
const selMeta = (s: WorldState) => s.meta
const selHead = (s: WorldState) => ({
  day: s.day,
  region: s.region.name,
  seed: s.seed,
})
const eqHead = (a: ReturnType<typeof selHead>, b: ReturnType<typeof selHead>) => a.day === b.day && a.region === b.region && a.seed === b.seed

export default function Report() {
  const { lang } = useI18n()
  const t = S[lang]
  const shell = useShell()
  const now = useNow()
  const mentions = useWorld(selMentions)
  const hoaxAlerts = useWorld(selHoax)
  const meta = useWorld(selMeta)
  const head = useWorld(selHead, eqHead)
  const deep = useDeepResult()
  const paper = useRef<HTMLDivElement>(null)
  const [msg, setMsg] = useState('')

  const k = radarKpis(mentions, now)
  const series = sentimentIndex(mentions, now)
  const ph = useMemo(() => hoaxPhase({ mentions, hoaxAlerts, meta }, now), [mentions, hoaxAlerts, meta, now])
  const topics = useMemo(() => {
    const by = new Map<string, { n: number; reach: number; sum: number }>()
    for (const m of rows(mentions)) {
      if (m.at > now || m.at <= now - 1440) continue
      const g = by.get(m.topic) ?? { n: 0, reach: 0, sum: 0 }
      g.n++
      g.reach += m.reach
      g.sum += m.score
      by.set(m.topic, g)
    }
    return [...by.entries()]
      .map(([topic, g]) => ({
        topic,
        n: g.n,
        reach: g.reach,
        score: g.sum / g.n,
      }))
      .sort((a, b) => b.n - a.n)
  }, [mentions, now])
  const name = (topic: string) => TOPIC[topic]?.[lang] ?? topic
  const neg = negIssues(mentions, now)[0]

  const hoaxText = (() => {
    if (ph.kind !== 'active' && ph.kind !== 'clarified') return t.hoaxNone
    const a = ph.alert
    const base = {
      c: a.claim[lang],
      t: clockWib(a.at, lang),
      s: Math.round(a.score * 100),
      n: ph.posts.length,
      e: a.evidence?.[lang] ?? '',
    }
    if (ph.kind === 'active' || !a.clarification) return fill(t.hoaxOn, base)
    const rc = recoveryOf(mentions, now, a.clarification.at)
    const d = rc.after - rc.before
    const au = clarAuditOf(a.id)
    return fill(t.hoaxDone, {
      ...base,
      move: fill(d > 0 ? t.moveUp : d < 0 ? t.moveDown : t.moveFlat, { d: Math.abs(d), a: sg(rc.before), b: sg(rc.after) }),
      by: au.draftedBy[lang],
      ap: au.approvedBy[lang],
      dt: clockWib(au.draftedAt ?? a.clarification.at, lang),
      at: clockWib(au.approvedAt ?? a.clarification.at, lang),
      sim: au.simulated === false ? '' : t.approvedSim,
      v: au.version,
      ct: clockWib(a.clarification.at, lang),
      tone: t.tone[a.clarification.tone] ?? a.clarification.tone,
      ch: a.clarification.channels.map((c) => CHANNEL_LABEL[c as Channel]?.[lang] ?? c).join(', '),
      a: sg(rc.before),
      b: sg(rc.after),
    })
  })()

  const recs = [
    ph.kind === 'active' ? t.recs.hoaxOn : ph.kind === 'clarified' ? t.recs.hoaxDone : null,
    neg ? fill(t.recs.neg, { t: name(neg.topic) }) : null,
    deep ? t.recs.deep : null,
    t.recs.base,
  ].filter((x): x is string => !!x)

  const exportAs = async (kind: 'xlsx' | 'json') => {
    const m = await import('./export')
    const f = kind === 'xlsx' ? m.downloadXlsx(world.get(), clock.get().minutes, lang) : m.downloadJson(world.get(), clock.get().minutes, lang)
    shell.markMission('ekspor')
    setMsg(fill(t.done, { f }))
  }

  return (
    <div className="dk-ri-report">
      <div className="dk-ri-report-bar">
        <span className="dk-ri-k">
          <Icon name="doc" size={14} /> {t.bar}
        </span>
        <div className="dk-ri-report-act">
          <Button
            variant="primary"
            icon="print"
            onClick={() => {
              shell.markMission('ekspor')
              setMsg(t.printed)
              const el = paper.current?.querySelector('.dk-paper')
              if (el) printPaper(el)
            }}
            data-testid="ri-print"
          >
            {t.print}
          </Button>
          <Button variant="secondary" icon="download" onClick={() => void exportAs('xlsx')} data-testid="ri-rep-xlsx">
            {t.xlsx}
          </Button>
          <Button variant="secondary" icon="download" onClick={() => void exportAs('json')} data-testid="ri-rep-json">
            {t.json}
          </Button>
        </div>
        <span className="dk-ri-note" aria-live="polite">
          {msg}
        </span>
      </div>

      <div ref={paper}>
        <PaperFrame label={t.kicker} size="auto" className="dk-ri-paper">
          <header className="dk-ri-doc-h">
            <div>
              <p className="dk-ri-doc-kicker">{t.kicker}</p>
              <h2 className="dk-ri-doc-title">{fill(t.title, { r: head.region })}</h2>
              <p className="dk-ri-doc-meta">
                {fill(t.meta, {
                  d: dateWib(head.day, lang, 'long'),
                  t: clockWib(now, lang),
                })}
              </p>
              <p className="dk-ri-doc-meta">{t.to}</p>
            </div>
            <span className="dk-ri-doc-stamp">{t.sim}</span>
          </header>

          <section>
            <h3>{t.s1}</h3>
            <p>
              {fill(t.sum, {
                n: k.count,
                p: k.prev,
                v: sg(k.sentiment),
                top: topics[0] ? name(topics[0].topic) : '–',
                neg: neg ? name(neg.topic) : t.sumNoNeg,
              })}
            </p>
            <dl className="dk-ri-doc-kpis">
              <div>
                <dt>{t.k1}</dt>
                <dd className="dk-num">{k.count}</dd>
              </div>
              <div>
                <dt>{t.k2}</dt>
                <dd className="dk-num">{sg(k.sentiment)}</dd>
              </div>
              <div>
                <dt>{t.k3}</dt>
                <dd className="dk-num">{k.negTopics}</dd>
              </div>
              <div>
                <dt>{t.k4}</dt>
                <dd className="dk-num">{compact(k.reach, lang)}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h3>{t.s2}</h3>
            <LineChart
              title={t.sentTitle}
              unit={t.sentUnit}
              seed={head.seed}
              x={series.map((p) => p.at)}
              xFormat={(x) => clockWib(Number(x), lang)}
              series={[
                {
                  id: 's',
                  label: t.sentTitle,
                  values: series.map((p) => p.value),
                },
              ]}
              yDomain={[-100, 100]}
              summary={sentSummary(series, lang, t.sentTitle)}
              height={170}
              format={(v) => sg(Math.round(v))}
            />
          </section>

          <section>
            <h3>{t.s3}</h3>
            <table className="dk-ri-doc-table">
              <thead>
                <tr>
                  {t.th.map((h, i) => (
                    <th key={h} className={i ? 'is-num' : undefined}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topics.slice(0, 6).map((x) => (
                  <tr key={x.topic}>
                    <td>{name(x.topic)}</td>
                    <td className="is-num dk-num">{x.n}</td>
                    <td className="is-num dk-num">{compact(x.reach, lang)}</td>
                    <td className="is-num dk-num">{sg(Math.round(x.score * 100))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h3>{t.s4}</h3>
            <p>{hoaxText}</p>
          </section>

          <section>
            <h3>{t.s5}</h3>
            {deep ? (
              <ul>
                {deep.keywords.map((x) => (
                  <li key={x.keyword}>
                    {fill(t.deepRow, {
                      k: x.keyword,
                      n: x.total.toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB'),
                      d: deep.input.days,
                      m: `${x.momentum > 0 ? '+' : ''}${x.momentum}`,
                      neg: Math.round(x.sentiment.neg * 100),
                    })}
                  </li>
                ))}
              </ul>
            ) : (
              <p>{t.deepNone}</p>
            )}
          </section>

          <section>
            <h3>{t.s6}</h3>
            <ol>
              {recs.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ol>
          </section>

          <footer className="dk-ri-doc-foot">{t.foot}</footer>
        </PaperFrame>
      </div>
    </div>
  )
}
