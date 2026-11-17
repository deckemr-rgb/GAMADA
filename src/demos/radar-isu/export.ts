/**
 * demos/radar-isu/export.ts — "Ekspor XLSX / JSON" (spec P4 cek lulus), loaded only when a visitor exports.
 * No dependency: a minimal SpreadsheetML (.xlsx) writer = a store-only ZIP (CRC-32, no compression) holding the
 * workbook, a two-style stylesheet (bold header) and one sheet per table with inline strings. Same data in JSON.
 * Everything is simulated (fictional outlets / accounts) and says so in the metadata.
 */
import { rows, type WorldState } from '../../demo-kit/world'
import { getDeepResult, hoaxPhase, radarKpis, sentimentIndex } from './model'
import { TOPIC } from './strings'

type L = 'id' | 'en'
type Cell = string | number | null
interface Sheet {
  name: string
  header: string[]
  rows: Cell[][]
  widths?: number[]
}

const hm = (min: number, lang: L) => {
  const m = ((Math.floor(min) % 1440) + 1440) % 1440
  const day = Math.floor(min / 1440)
  const s = `${String(Math.floor(m / 60)).padStart(2, '0')}${lang === 'id' ? '.' : ':'}${String(m % 60).padStart(2, '0')}`
  return day < 0 ? `${s} (${day}d)` : s
}

/* ------------------------------------------------------------------ the export data */

export function buildExport(s: WorldState, now: number, lang: L) {
  const k = radarKpis(s.mentions, now)
  const series = sentimentIndex(s.mentions, now)
  const ments = rows(s.mentions)
    .filter((m) => m.at <= now && m.at > now - 1440)
    .sort((a, b) => b.at - a.at)
  const by = new Map<string, { n: number; reach: number; sum: number }>()
  for (const m of ments) {
    const g = by.get(m.topic) ?? { n: 0, reach: 0, sum: 0 }
    g.n++
    g.reach += m.reach
    g.sum += m.score
    by.set(m.topic, g)
  }
  const topics = [...by.entries()]
    .map(([topic, g]) => ({
      topic,
      label: TOPIC[topic]?.[lang] ?? topic,
      mentions: g.n,
      reach: g.reach,
      score: Math.round((g.sum / g.n) * 100) / 100,
    }))
    .sort((a, b) => b.mentions - a.mentions)
  const ph = hoaxPhase(s, now)
  const hoaxes = rows(s.hoaxAlerts).map((h) => ({
    id: h.id,
    detectedAt: hm(h.at, lang),
    claim: h.claim[lang],
    score: h.score,
    spreadPerHour: h.spreadPerHour,
    accounts: h.accounts,
    // the world writes the gauge numbers with a decimal comma in both languages; English uses a point
    evidence: h.evidence ? (lang === 'en' ? h.evidence.en.replace(/(\d),(\d)/g, '$1.$2') : h.evidence.id) : null,
    status: h.status,
    posts: ph.kind !== 'idle' && 'alert' in ph && ph.alert.id === h.id ? ph.posts.length : null,
    clarification: h.clarification
      ? {
          at: hm(h.clarification.at, lang),
          tone: h.clarification.tone,
          channels: h.clarification.channels,
        }
      : null,
  }))
  const deep = getDeepResult()
  return {
    meta: {
      product: 'Radar Isu (GAMADA demo)',
      region: s.region.name,
      day: s.day,
      worldTime: hm(now, lang),
      seed: s.seed,
      lang,
      note:
        lang === 'id'
          ? 'Data simulasi untuk demo GAMADA. Semua media, akun, dan angka fiktif; nama tempat nyata.'
          : 'Simulated data for the GAMADA demo. Every outlet, account and number is fictional; place names are real.',
    },
    summary: {
      mentions24h: k.count,
      mentionsPrev24h: k.prev,
      sentimentIndex: k.sentiment,
      negativeTopics: k.negTopics,
      reach24h: k.reach,
    },
    topics,
    sentimentSeries: series.map((p) => ({
      at: hm(p.at, lang),
      index: p.value,
    })),
    hoaxes,
    mentions: ments.map((m) => ({
      id: m.id,
      time: hm(m.at, lang),
      outlet: m.outlet,
      kind: m.kind,
      author: m.author,
      text: m.text[lang],
      sentiment: m.sentiment,
      score: m.score,
      topic: TOPIC[m.topic]?.[lang] ?? m.topic,
      reach: m.reach,
      hoax: m.hoaxId ?? (m.rumor ? 'rumor' : null),
    })),
    deepAnalysis: deep
      ? {
          keywords: deep.input.keywords,
          periodDays: deep.input.days,
          sourceLang: deep.input.lang,
          dates: deep.dates,
          perKeyword: deep.keywords.map((x) => ({
            keyword: x.keyword,
            total: x.total,
            momentumPct: x.momentum,
            reach: x.reach,
            sentiment: x.sentiment,
            sentimentByLang: x.byLang,
            daily: x.daily,
          })),
          sources: deep.sources.map((x) => ({
            source: x.label[lang],
            posts: x.count,
          })),
          topics: deep.topics.map((x) => ({
            keyword: x.keyword,
            topic: x.label[lang],
            share: x.share,
          })),
          media: deep.media,
          quotes: deep.quotes.map((q) => ({
            keyword: q.keyword,
            outlet: q.outlet,
            sentiment: q.sentiment,
            reach: q.reach,
            text: q.text[lang],
          })),
          surveyQuestions: deep.survey.map((q) => q[lang]),
          insight: deep.insight[lang],
        }
      : null,
  }
}

export type RadarExport = ReturnType<typeof buildExport>

function sheets(x: RadarExport, lang: L): Sheet[] {
  const id = lang === 'id'
  const out: Sheet[] = [
    {
      name: id ? 'Ringkasan' : 'Summary',
      header: [id ? 'Butir' : 'Item', id ? 'Nilai' : 'Value'],
      widths: [34, 70],
      rows: [
        [id ? 'Produk' : 'Product', x.meta.product],
        [id ? 'Wilayah' : 'Region', x.meta.region],
        [id ? 'Tanggal' : 'Date', x.meta.day],
        [id ? 'Jam dunia' : 'World time', x.meta.worldTime],
        ['Seed', x.meta.seed],
        [id ? 'Catatan' : 'Note', x.meta.note],
        [id ? 'Mention 24 jam' : 'Mentions, 24 h', x.summary.mentions24h],
        [id ? 'Mention 24 jam sebelumnya' : 'Mentions, previous 24 h', x.summary.mentionsPrev24h],
        [id ? 'Indeks sentimen (−100…100)' : 'Sentiment index (−100…100)', x.summary.sentimentIndex],
        [id ? 'Topik bernada negatif' : 'Topics leaning negative', x.summary.negativeTopics],
        [id ? 'Perkiraan jangkauan' : 'Estimated reach', x.summary.reach24h],
      ],
    },
    {
      name: 'Mention',
      header: [
        'ID',
        id ? 'Jam' : 'Time',
        'Outlet',
        id ? 'Jenis' : 'Kind',
        id ? 'Akun' : 'Account',
        id ? 'Teks' : 'Text',
        id ? 'Sentimen' : 'Sentiment',
        'Skor',
        id ? 'Topik' : 'Topic',
        id ? 'Jangkauan' : 'Reach',
        id ? 'Hoaks' : 'Hoax',
      ],
      widths: [10, 9, 22, 9, 20, 70, 11, 8, 18, 11, 10],
      rows: x.mentions.map((m) => [m.id, m.time, m.outlet, m.kind, m.author, m.text, m.sentiment, m.score, m.topic, m.reach, m.hoax]),
    },
    {
      name: id ? 'Topik' : 'Topics',
      header: [id ? 'Topik' : 'Topic', 'Mention', id ? 'Jangkauan' : 'Reach', id ? 'Skor sentimen' : 'Sentiment score'],
      widths: [24, 10, 12, 16],
      rows: x.topics.map((t) => [t.label, t.mentions, t.reach, t.score]),
    },
    {
      name: id ? 'Sentimen' : 'Sentiment',
      header: [id ? 'Jam' : 'Time', id ? 'Indeks' : 'Index'],
      widths: [14, 10],
      rows: x.sentimentSeries.map((p) => [p.at, p.index]),
    },
    {
      name: id ? 'Hoaks' : 'Hoaxes',
      header: [
        'ID',
        id ? 'Terdeteksi' : 'Detected',
        id ? 'Klaim' : 'Claim',
        id ? 'Skor' : 'Score',
        id ? 'Sebaran/jam' : 'Spread/h',
        id ? 'Akun awal (fiktif)' : 'First accounts (fictional)',
        id ? 'Bukti' : 'Evidence',
        'Status',
        id ? 'Klarifikasi' : 'Clarification',
      ],
      widths: [10, 11, 44, 8, 12, 40, 70, 13, 40],
      rows: x.hoaxes.map((h) => [
        h.id,
        h.detectedAt,
        h.claim,
        h.score,
        h.spreadPerHour,
        h.accounts.join(', '),
        h.evidence,
        h.status,
        h.clarification ? `${h.clarification.at} · ${h.clarification.tone} · ${h.clarification.channels.join(', ')}` : null,
      ]),
    },
  ]
  const d = x.deepAnalysis
  if (d) {
    out.push({
      name: id ? 'Analisis volume' : 'Analysis volume',
      header: [id ? 'Tanggal' : 'Date', ...d.perKeyword.map((k) => k.keyword)],
      widths: [12, ...d.perKeyword.map(() => 16)],
      rows: d.dates.map((date, i) => [date, ...d.perKeyword.map((k) => k.daily[i] ?? null)]),
    })
    out.push({
      name: id ? 'Analisis sentimen' : 'Analysis sentiment',
      header: [
        id ? 'Kata kunci' : 'Keyword',
        'Total',
        id ? 'Momentum %' : 'Momentum %',
        id ? 'Jangkauan' : 'Reach',
        id ? 'Positif' : 'Positive',
        id ? 'Netral' : 'Neutral',
        id ? 'Negatif' : 'Negative',
        'ID +',
        'ID −',
        'EN +',
        'EN −',
      ],
      widths: [20, 10, 12, 12, 10, 10, 10, 8, 8, 8, 8],
      rows: d.perKeyword.map((k) => [
        k.keyword,
        k.total,
        k.momentumPct,
        k.reach,
        k.sentiment.pos,
        k.sentiment.neu,
        k.sentiment.neg,
        k.sentimentByLang.id.pos,
        k.sentimentByLang.id.neg,
        k.sentimentByLang.en.pos,
        k.sentimentByLang.en.neg,
      ]),
    })
    out.push({
      name: id ? 'Analisis topik & kutipan' : 'Analysis topics & quotes',
      header: [id ? 'Jenis' : 'Type', id ? 'Kata kunci' : 'Keyword', id ? 'Isi' : 'Content', id ? 'Nilai' : 'Value'],
      widths: [16, 18, 80, 12],
      rows: [
        ...d.topics.map((t): Cell[] => [id ? 'Topik' : 'Topic', t.keyword, t.topic, t.share]),
        ...d.quotes.map((q): Cell[] => [id ? 'Kutipan' : 'Quote', q.keyword, `${q.text} (${q.outlet})`, q.reach]),
        ...d.surveyQuestions.map((q): Cell[] => [id ? 'Pertanyaan survei' : 'Survey question', '', q, null]),
        [id ? 'Temuan' : 'Finding', '', d.insight, null],
      ],
    })
  }
  return out
}

/* ------------------------------------------------------------------ SpreadsheetML */

const esc = (v: string) =>
  v.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
function colName(i: number): string {
  let s = ''
  let n = i + 1
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}
function cell(v: Cell, ref: string, style: number): string {
  const s = style ? ` s="${style}"` : ''
  if (v === null || v === undefined || v === '') return ''
  if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${s}><v>${v}</v></c>`
  return `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`
}
function sheetXml(sh: Sheet): string {
  const all: Cell[][] = [sh.header, ...sh.rows]
  const body = all.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => cell(v, `${colName(ci)}${ri + 1}`, ri === 0 ? 1 : 0)).join('')}</row>`).join('')
  const cols = sh.widths?.length ? `<cols>${sh.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : ''
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols}<sheetData>${body}</sheetData></worksheet>`
}
const safeName = (n: string, used: Set<string>) => {
  let s = n.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31)
  let i = 2
  while (used.has(s.toLowerCase())) s = `${s.slice(0, 28)} ${i++}`
  used.add(s.toLowerCase())
  return s
}

export function xlsxFiles(list: Sheet[]): { name: string; data: string }[] {
  const used = new Set<string>()
  const names = list.map((s) => safeName(s.name, used))
  return [
    {
      name: '[Content_Types].xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${list.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
    },
    {
      name: '_rels/.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: 'xl/workbook.xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${list.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${list.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    {
      name: 'xl/styles.xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    },
    ...list.map((sh, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: sheetXml(sh),
    })),
  ]
}

/* ------------------------------------------------------------------ store-only ZIP */

let CRC: Uint32Array | null = null
function crc32(b: Uint8Array): number {
  if (!CRC) {
    CRC = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      CRC[n] = c >>> 0
    }
  }
  let c = 0xffffffff
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]!) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export function zipStore(files: { name: string; data: string }[], date = new Date(2026, 10, 17, 9, 0, 0)): Uint8Array {
  const enc = new TextEncoder()
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
  const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const f of files) {
    const name = enc.encode(f.name)
    const data = enc.encode(f.data)
    const crc = crc32(data)
    const lh = new DataView(new ArrayBuffer(30))
    lh.setUint32(0, 0x04034b50, true)
    lh.setUint16(4, 20, true)
    lh.setUint16(6, 0x0800, true)
    lh.setUint16(8, 0, true)
    lh.setUint16(10, dosTime, true)
    lh.setUint16(12, dosDate, true)
    lh.setUint32(14, crc, true)
    lh.setUint32(18, data.length, true)
    lh.setUint32(22, data.length, true)
    lh.setUint16(26, name.length, true)
    lh.setUint16(28, 0, true)
    parts.push(new Uint8Array(lh.buffer), name, data)
    const ch = new DataView(new ArrayBuffer(46))
    ch.setUint32(0, 0x02014b50, true)
    ch.setUint16(4, 20, true)
    ch.setUint16(6, 20, true)
    ch.setUint16(8, 0x0800, true)
    ch.setUint16(10, 0, true)
    ch.setUint16(12, dosTime, true)
    ch.setUint16(14, dosDate, true)
    ch.setUint32(16, crc, true)
    ch.setUint32(20, data.length, true)
    ch.setUint32(24, data.length, true)
    ch.setUint16(28, name.length, true)
    ch.setUint32(42, offset, true)
    central.push(new Uint8Array(ch.buffer), name)
    offset += 30 + name.length + data.length
  }
  const cdSize = central.reduce((a, b) => a + b.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, files.length, true)
  end.setUint16(10, files.length, true)
  end.setUint32(12, cdSize, true)
  end.setUint32(16, offset, true)
  const all = [...parts, ...central, new Uint8Array(end.buffer)]
  const out = new Uint8Array(all.reduce((a, b) => a + b.length, 0))
  let p = 0
  for (const a of all) {
    out.set(a, p)
    p += a.length
  }
  return out
}

/* ------------------------------------------------------------------ downloads */

function save(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}
const baseName = (s: WorldState, now: number) => `radar-isu_${s.regionId}_${s.day}_${String(Math.floor(now / 60)).padStart(2, '0')}${String(now % 60).padStart(2, '0')}`

/** download the workbook; returns the file name */
export function downloadXlsx(s: WorldState, now: number, lang: L): string {
  const data = buildExport(s, now, lang)
  const bytes = zipStore(xlsxFiles(sheets(data, lang)))
  const name = `${baseName(s, now)}.xlsx`
  save(
    new Blob([bytes as BlobPart], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    name,
  )
  return name
}

/** download the same data as JSON; returns the file name */
export function downloadJson(s: WorldState, now: number, lang: L): string {
  const name = `${baseName(s, now)}.json`
  save(
    new Blob([JSON.stringify(buildExport(s, now, lang), null, 2)], {
      type: 'application/json',
    }),
    name,
  )
  return name
}
