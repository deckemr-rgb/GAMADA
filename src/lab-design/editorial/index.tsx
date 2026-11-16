/**
 * Direction A — "Presisi editorial" (editorial precision).
 * A premium research report translated into an app: a firm 12-column grid, hairline rules instead of
 * boxes, Fraunces numerals, letter-spaced Manrope labels, one accent per view. Motion is short and exact:
 * rules that draw, numbers that tick. The wow moment is the document scan (section 07).
 */
import { useState } from 'react'
import { useI18n } from '../../lib/i18n'
import Chart from './Chart'
import Chat from './Chat'
import Doc from './Doc'
import Kpis from './Kpis'
import MapBlock from './MapBlock'
import Tickets from './Tickets'
import Tokens, { ECOS, type Eco } from './Tokens'
import { Section } from './parts'
import './editorial.css'

const S = {
  mast: { id: 'GAMADA · Lapis aplikasi', en: 'GAMADA · Application layer' },
  dir: { id: 'Arah A · Presisi editorial', en: 'Direction A · Editorial precision' },
  issue: { id: 'Edisi 17 November 2026', en: 'Issue of 17 November 2026' },
  lead: {
    id: 'Struktur datang dari garis, perataan dan tipografi, bukan dari kotak. Angka berbicara lebih dulu; warna aksen muncul sekali per tampilan, di tempat yang paling penting.',
    en: 'Structure comes from rules, alignment and type, not from boxes. Numbers speak first; the accent colour appears once per view, where it matters most.',
  },
  toc: { id: 'Daftar isi', en: 'Contents' },
  principles: { id: 'Prinsip arah ini', en: 'Principles of this direction' },
  rules: [
    { t: { id: 'Garis, bukan kotak', en: 'Rules, not boxes' }, d: { id: 'Garis rambut dan perataan grid 12 kolom membentuk struktur. Kartu jarang dipakai.', en: 'Hairlines and a 12-column grid carry the structure. Cards are rare.' } },
    { t: { id: 'Angka lebih dulu', en: 'Numbers first' }, d: { id: 'Fraunces untuk angka utama, label kapital berjarak, semua angka tabular.', en: 'Fraunces for headline numbers, spaced capitals for labels, every numeral tabular.' } },
    { t: { id: 'Satu aksen', en: 'One accent' }, d: { id: 'Warna ekosistem muncul sekali per tampilan. Merah hanya untuk bahaya.', en: 'The ecosystem colour appears once per view. Red is for danger only.' } },
  ],
  accent: { id: 'Aksen aktif', en: 'Active accent' },
}

const SECTIONS = [
  { id: 'token', k: { id: 'Fondasi', en: 'Foundations' }, t: { id: 'Lembar token', en: 'Token sheet' }, d: { id: 'Skala tipe, permukaan, garis, radius, elevasi dan aksen, sebagaimana arah ini memakainya.', en: 'Type scale, surfaces, lines, radius, elevation and accents, the way this direction uses them.' } },
  { id: 'kpi', k: { id: 'Indikator', en: 'Indicators' }, t: { id: 'Pagi ini dalam enam angka', en: 'This morning in six numbers' }, d: { id: 'Angka bergulir sekali saat pertama terlihat. Delta dibandingkan kemarin; warnanya mengikuti arah yang baik.', en: 'Numbers tick once on first view. Deltas compare with yesterday, coloured by which direction is good.' } },
  { id: 'inbox', k: { id: 'Kotak masuk', en: 'Inbox' }, t: { id: 'Aduan yang menunggu', en: 'Complaints waiting' }, d: { id: 'Tabel bergaris tanpa kartu. Coba tiket baru dan kepadatan baris; di bawah 640 px tabel menjadi kartu.', en: 'A ruled table, no cards. Try a new ticket and the row density; under 640 px the table becomes cards.' } },
  { id: 'chat', k: { id: 'Percakapan', en: 'Conversation' }, t: { id: 'Warga bertanya, AI menjawab', en: 'A citizen asks, the AI answers' }, d: { id: 'Jawaban dialirkan per token, lalu data terstruktur jatuh ke tempatnya. Buku catatan di samping mengikuti setiap langkah.', en: 'The answer streams token by token, then structured data drops into place. The ledger alongside follows each step.' } },
  { id: 'map', k: { id: 'Wilayah', en: 'Territory' }, t: { id: 'Peta aduan dan risiko', en: 'Complaints and risk map' }, d: { id: 'Koroplet lima kelas dari satu warna aksen. Peringkat di samping disusun ulang saat lapisan diganti.', en: 'A five-class choropleth from a single accent. The ranking alongside re-sorts when the layer changes.' } },
  { id: 'trend', k: { id: 'Tren', en: 'Trend' }, t: { id: 'Tiga puluh hari, tujuh ke depan', en: 'Thirty days, seven ahead' }, d: { id: 'Garis tergambar sekali. Arahkan atau fokus ke grafik untuk membaca setiap hari.', en: 'The line draws once. Hover or focus the chart to read each day.' } },
  { id: 'doc', k: { id: 'Dokumen', en: 'Document' }, t: { id: 'Surat masuk, dibaca mesin', en: 'Incoming letter, machine-read' }, d: { id: 'Pemindai menyapu halaman, kotak OCR menggaris dirinya seperti tanda editor, lalu disposisi menunggu cap Anda.', en: 'The scanner sweeps the page, OCR boxes rule themselves on like editor’s marks, then the disposition waits for your stamp.' } },
] as const

export default function Direction() {
  const { lang } = useI18n()
  const [eco, setEco] = useState<Eco>('satu')
  const ecoName = ECOS.find((e) => e.id === eco)?.name ?? ''
  const sec = (i: number) => SECTIONS[i]!

  const body = [
    <Tokens key="token" eco={eco} setEco={setEco} />,
    <Kpis key="kpi" />,
    <Tickets key="inbox" />,
    <Chat key="chat" />,
    <MapBlock key="map" />,
    <Chart key="trend" />,
    <Doc key="doc" />,
  ]

  return (
    <div className="lde-root" data-eco={eco}>
      <header className="lde-mast">
        <div className="lde-mast-top">
          <span className="lde-cap">{S.mast[lang]}</span>
          <span className="lde-cap lde-mast-dir">{S.dir[lang]}</span>
          <span className="lde-cap lde-mast-issue">{S.issue[lang]}</span>
        </div>
        <div className="lde-mast-rule" aria-hidden="true" />
        <div className="lde-mast-body">
          <div className="lde-mast-main">
            <p className="lde-mast-lead">{S.lead[lang]}</p>
            <ol className="lde-principles" aria-label={S.principles[lang]}>
              {S.rules.map((r, i) => (
                <li key={i}>
                  <span className="lde-principle-n lde-num">{['i', 'ii', 'iii'][i]}</span>
                  <span className="lde-principle-t">{r.t[lang]}</span>
                  <span className="lde-principle-d">{r.d[lang]}</span>
                </li>
              ))}
            </ol>
          </div>
          <nav className="lde-toc" aria-label={S.toc[lang]}>
            <p className="lde-cap lde-cap-strong">{S.toc[lang]}</p>
            <ol>
              {SECTIONS.map((s, i) => (
                <li key={s.id}>
                  <a href={`#lde-${s.id}`}>
                    <span className="lde-toc-n lde-num">{String(i + 1).padStart(2, '0')}</span>
                    <span>{s.t[lang]}</span>
                  </a>
                </li>
              ))}
            </ol>
            <p className="lde-toc-acc">
              <span className="lde-toc-dot" aria-hidden="true" />
              {S.accent[lang]}: {ecoName}
            </p>
          </nav>
        </div>
      </header>

      {body.map((node, i) => {
        const s = sec(i)
        return (
          <Section key={s.id} n={String(i + 1).padStart(2, '0')} id={s.id} kicker={s.k[lang]} title={s.t[lang]} dek={<p>{s.d[lang]}</p>}>
            {node}
          </Section>
        )
      })}
    </div>
  )
}
