/**
 * Direction B — "Sinematik senja" (cinematic dusk). The application layer continues the GAMADA
 * home page: layered dusk surfaces, a static edge-light on panels, glowing accents, Fraunces in
 * section titles, a few fireflies in empty space, and two "wow" moments (ticket flight, flood wash).
 */
import { useLayoutEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react'
import { gsap } from 'gsap'
import { useI18n } from '../../lib/i18n'
import { EASE } from '../../lib/motion'
import { SJ, motionMode, seeded, useEnter, useGsapContext, useOnScreen, type Bi } from './shared'
import Tokens from './Tokens'
import Kpis from './Kpis'
import Sapa from './Sapa'
import RegionMap from './RegionMap'
import TrendChart from './TrendChart'
import LetterDoc from './LetterDoc'
import './senja.css'

const MAST = {
  eyebrow: { id: 'Arah B · lapis aplikasi', en: 'Direction B · app layer' },
  title: { id: 'Senja yang bekerja.', en: 'Dusk that works.' },
  lead: {
    id: 'Cahaya beranda dibawa masuk ke produk: permukaan berlapis gradien senja, tepi panel yang menyala lembut, aksen yang berpendar. Di bawahnya tetap disiplin produk: grid 4 px, angka tabular, kontras AA.',
    en: 'The home page light carried into the product: layered dusk surfaces, softly lit panel edges, glowing accents. Underneath, product discipline: a 4 px grid, tabular numerals, AA contrast.',
  },
  traits: [
    { tone: 'peach', text: { id: 'Gradien senja berlapis', en: 'Layered dusk gradients' } },
    { tone: 'lav', text: { id: 'Tepi bercahaya statis', en: 'Static edge light' } },
    { tone: 'teal', text: { id: 'Aksen berpendar, bukan berkedip', en: 'Accents glow, never blink' } },
    { tone: 'gold', text: { id: 'Dua momen “wow”, sisanya tenang', en: 'Two “wow” moments, the rest calm' } },
  ],
} as const

interface SectionDef {
  id: string
  eyebrow: Bi
  title: Bi
  lead: Bi
  specs: Bi[]
  body: () => ReactNode
}

const SECTIONS: SectionDef[] = [
  {
    id: 'token',
    eyebrow: { id: 'Token', en: 'Tokens' },
    title: { id: 'Cahaya senja, disiplin produk.', en: 'Dusk light, product discipline.' },
    lead: {
      id: 'Tiga lapis permukaan, satu garis rambut, tiga elevasi dengan sorot 1 px di tepi atas. Warna aksen menandai ekosistem; merah hanya untuk bahaya.',
      en: 'Three surface levels, one hairline, three elevations with a 1 px top highlight. Accent colour marks the ecosystem; red is for danger only.',
    },
    specs: [
      { id: 'Manrope 12–32 · Fraunces 28–40', en: 'Manrope 12–32 · Fraunces 28–40' },
      { id: 'tanpa backdrop-filter', en: 'no backdrop-filter' },
    ],
    body: () => <Tokens />,
  },
  {
    id: 'kpi',
    eyebrow: { id: 'Meja Pimpinan · KPI', en: 'Leadership Desk · KPIs' },
    title: { id: 'Pagi ini, dalam enam angka.', en: 'This morning, in six numbers.' },
    lead: {
      id: 'Angka bergulir sekali saat pertama terlihat. Selisih dibanding kemarin diberi warna menurut arti, bukan arah: naik bisa berarti buruk.',
      en: 'Numbers roll once on first view. The change vs yesterday is coloured by meaning, not direction: up can be bad.',
    },
    specs: [
      { id: 'count-up ≤ 600 ms', en: 'count-up ≤ 600 ms' },
      { id: 'tabular-nums', en: 'tabular-nums' },
    ],
    body: () => <Kpis />,
  },
  {
    id: 'sapa',
    eyebrow: { id: 'Sapa Warga · kotak masuk & chat', en: 'Sapa Warga · inbox & chat' },
    title: { id: 'Dari pesan warga ke tiket, dalam satu tarikan napas.', en: 'From a citizen’s message to a ticket, in one breath.' },
    lead: {
      id: 'Warga menulis lewat WhatsApp, asisten menjawab per token, lalu tiketnya terbang ke kotak masuk petugas. Coba tombol “Simulasikan tiket baru” atau “Putar ulang”.',
      en: 'A citizen writes on WhatsApp, the assistant answers token by token, then the ticket flies into the officers’ inbox. Try “Simulate new ticket” or “Replay”.',
    },
    specs: [
      { id: 'momen wow · 1,2 s', en: 'wow moment · 1.2 s' },
      { id: 'stream 25–45 token/dtk', en: 'stream 25–45 tokens/s' },
    ],
    body: () => <Sapa />,
  },
  {
    id: 'peta',
    eyebrow: { id: 'Siaga Wilayah · peta', en: 'Siaga Wilayah · map' },
    title: { id: 'Di mana aduan menumpuk, di mana air naik.', en: 'Where complaints pile up, where water rises.' },
    lead: {
      id: 'Peta tematik tujuh kecamatan. Ganti lapisan ke “Risiko banjir” dan air menyebar mengikuti sungai, kecamatan demi kecamatan.',
      en: 'A thematic map of seven districts. Switch the layer to “Flood risk” and the water spreads along the river, district by district.',
    },
    specs: [
      { id: 'momen wow · 1,2 s', en: 'wow moment · 1.2 s' },
      { id: 'poligon bisa difokus', en: 'focusable polygons' },
    ],
    body: () => <RegionMap />,
  },
  {
    id: 'grafik',
    eyebrow: { id: 'Grafik · tren & prakiraan', en: 'Chart · trend & forecast' },
    title: { id: 'Tiga puluh hari ke belakang, tujuh ke depan.', en: 'Thirty days back, seven ahead.' },
    lead: {
      id: 'Garis 2 px dengan area 16 %, prakiraan putus-putus dengan pita 10 %. Arahkan kursor atau pakai tombol panah untuk membaca nilai harian.',
      en: 'A 2 px line with a 16 % area, a dashed forecast with a 10 % band. Hover, or use the arrow keys, to read daily values.',
    },
    specs: [
      { id: 'tergambar ≤ 800 ms', en: 'draws in ≤ 800 ms' },
      { id: 'ringkasan untuk pembaca layar', en: 'screen-reader summary' },
    ],
    body: () => <TrendChart />,
  },
  {
    id: 'dokumen',
    eyebrow: { id: 'Naskah Pintar · surat masuk', en: 'Naskah Pintar · incoming letter' },
    title: { id: 'Surat dibaca, diringkas, didisposisikan.', en: 'Letters read, summarised, routed.' },
    lead: {
      id: 'Pindaian surat ditandai kotak OCR satu per satu, lalu tiap kolom diberi tingkat keyakinan. Pimpinan cukup memeriksa dan menyetujui disposisi.',
      en: 'The scanned letter gets its OCR boxes one by one, each field with a confidence score. The head of office only checks and approves the routing.',
    },
    specs: [
      { id: 'kertas tema terang · AA', en: 'light paper theme · AA' },
      { id: 'cap 320 ms', en: 'stamp 320 ms' },
    ],
    body: () => <LetterDoc />,
  },
]

/** A few firefly specks per section (CSS transform/opacity loop, paused off-screen, off in reduced motion). */
function useFireflies(seed: number, count: number) {
  return useMemo(() => {
    const rnd = seeded(seed)
    return Array.from({ length: count }, () => ({
      '--x': `${55 + rnd() * 42}%`,
      '--y': `${4 + rnd() * 120}px`,
      '--dx': `${(rnd() - 0.5) * 70}px`,
      '--dy': `${-18 - rnd() * 34}px`,
      '--d': `${7 + rnd() * 6}s`,
      '--delay': `${-rnd() * 8}s`,
      '--s': `${2 + rnd() * 1.6}px`,
    })) as CSSProperties[]
  }, [seed, count])
}

function Section({ def, index }: { def: SectionDef; index: number }) {
  const { lang } = useI18n()
  const ref = useRef<HTMLElement>(null)
  const headRef = useRef<HTMLDivElement>(null)
  const ctx = useGsapContext(ref)
  const mode = motionMode()
  const flies = useFireflies(index * 17 + 5, 3)

  useLayoutEffect(() => {
    if (mode === 'static') return
    ctx.current?.add(() => {
      const kids = headRef.current?.querySelectorAll('[data-reveal]')
      if (kids) gsap.set(kids, { opacity: 0, y: mode === 'full' ? 14 : 0 })
    })
  }, [ctx, mode])

  useEnter(headRef, () => {
    ctx.current?.add(() => {
      const kids = headRef.current?.querySelectorAll('[data-reveal]')
      if (!kids) return
      gsap.to(kids, {
        opacity: 1,
        y: 0,
        duration: mode === 'full' ? SJ.screen : SJ.fade,
        stagger: mode === 'full' ? 0.07 : 0,
        ease: EASE.out,
      })
    })
  })

  useOnScreen(ref, (v) => ref.current?.setAttribute('data-ff', v ? 'run' : 'paused'))

  const num = String(index + 1).padStart(2, '0')
  return (
    <section ref={ref} className="lds-sec" id={`lds-${def.id}`} aria-labelledby={`lds-${def.id}-t`} data-ff="paused">
      <span className="lds-ffs" aria-hidden="true">
        {flies.map((s, i) => (
          <span key={i} className="lds-ff" style={s} />
        ))}
      </span>
      <div className="lds-sec-head" ref={headRef}>
        <div className="lds-sec-copy">
          <p className="lds-eyebrow" data-reveal="">
            <span className="lds-eyebrow-num">{num}</span>
            {def.eyebrow[lang]}
          </p>
          <h2 className="lds-h2" id={`lds-${def.id}-t`} data-reveal="">
            {def.title[lang]}
          </h2>
          <p className="lds-lead" data-reveal="">
            {def.lead[lang]}
          </p>
        </div>
        <ul className="lds-specs" data-reveal="" aria-label={lang === 'id' ? 'Catatan spesifikasi' : 'Spec notes'}>
          {def.specs.map((s) => (
            <li key={s.en}>{s[lang]}</li>
          ))}
        </ul>
      </div>
      {def.body()}
    </section>
  )
}

export default function Direction() {
  const { lang } = useI18n()
  const mode = motionMode()
  return (
    <div className="lds-root" data-mode={mode}>
      <div className="lds-aurora" aria-hidden="true" />
      <header className="lds-mast">
        <p className="lds-eyebrow">{MAST.eyebrow[lang]}</p>
        <p className="lds-mast-title">{MAST.title[lang]}</p>
        <p className="lds-mast-lead">{MAST.lead[lang]}</p>
        <ul className="lds-traits">
          {MAST.traits.map((t) => (
            <li key={t.text.en} className={`lds-trait is-${t.tone}`}>
              <span className="lds-trait-dot" aria-hidden="true" />
              {t.text[lang]}
            </li>
          ))}
        </ul>
      </header>
      {SECTIONS.map((def, i) => (
        <Section key={def.id} def={def} index={i} />
      ))}
    </div>
  )
}
