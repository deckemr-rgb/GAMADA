/** 01 · Token sheet — how direction B uses type, surfaces, lines, radius, elevation and accents. */
import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import { gsap } from 'gsap'
import { useI18n } from '../../lib/i18n'
import { EASE } from '../../lib/motion'
import { SJ, motionMode, useEnter, useGsapContext } from './shared'

const C = {
  id: {
    type: 'Tipografi',
    typeNote: 'Fraunces hanya untuk judul halaman demo. Semua isi aplikasi memakai Manrope.',
    display: 'Judul demo',
    tabular: 'Angka tabular',
    tabularNote: 'Kolom angka selalu rata dan tidak “menari” saat bergulir.',
    prop: 'proporsional',
    surfaces: 'Lapisan permukaan',
    surfacesNote: 'Setiap lapis naik satu tingkat warna; hover menaikkan satu tingkat lagi.',
    canvas: 'kanvas',
    panel: 'panel',
    card: 'kartu',
    hover: 'hover +1',
    lines: 'Garis',
    hair: 'Garis rambut 12 %',
    strong: 'Pemisah kuat 22 %',
    active: 'Aktif · aksen 60 %',
    dashed: 'Prakiraan · putus-putus',
    radius: 'Radius',
    rChip: 'chip',
    rInput: 'input',
    rCard: 'kartu',
    rPanel: 'panel',
    elevation: 'Elevasi',
    elevNote: 'Sorot 1 px di tepi atas + bayangan dalam. Tanpa backdrop-filter, tanpa blur bergerak.',
    e1: 'baris, chip',
    e2: 'kartu, menu',
    e3: 'panel, frame',
    accents: 'Aksen ekosistem',
    accentsNote: 'Satu aksen per produk, berpendar lembut. Glow selalu statis.',
    danger: 'Bahaya',
    dangerRole: 'Hanya status bahaya: SLA lewat, gagal.',
    samples: [
      ['32', 'KPI', '142 aduan'],
      ['24', 'Judul panel', 'Kotak masuk aduan'],
      ['20', 'Subjudul', 'Peta kecamatan'],
      ['16', 'Teks besar', 'Laporan diteruskan ke BPBD.'],
      ['14', 'Teks & tabel', 'Isi panel, sel tabel, tombol'],
      ['13', 'Meta', 'SW-2026-0142 · 07.42 · WhatsApp'],
      ['12', 'Label', 'STATUS · KANAL · SLA'],
    ],
  },
  en: {
    type: 'Typography',
    typeNote: 'Fraunces is for demo page titles only. All app content uses Manrope.',
    display: 'Demo title',
    tabular: 'Tabular numerals',
    tabularNote: 'Number columns stay aligned and never “dance” while counting.',
    prop: 'proportional',
    surfaces: 'Surface levels',
    surfacesNote: 'Each layer rises one colour step; hover rises one more.',
    canvas: 'canvas',
    panel: 'panel',
    card: 'card',
    hover: 'hover +1',
    lines: 'Lines',
    hair: 'Hairline 12 %',
    strong: 'Strong divider 22 %',
    active: 'Active · accent 60 %',
    dashed: 'Forecast · dashed',
    radius: 'Radius',
    rChip: 'chip',
    rInput: 'input',
    rCard: 'card',
    rPanel: 'panel',
    elevation: 'Elevation',
    elevNote: '1 px top highlight + deep shadow. No backdrop-filter, no animated blur.',
    e1: 'rows, chips',
    e2: 'cards, menus',
    e3: 'panels, frames',
    accents: 'Ecosystem accents',
    accentsNote: 'One accent per product, softly glowing. Glow is always static.',
    danger: 'Danger',
    dangerRole: 'Danger states only: SLA breached, failed.',
    samples: [
      ['32', 'KPI', '142 complaints'],
      ['24', 'Panel title', 'Complaints inbox'],
      ['20', 'Subtitle', 'District map'],
      ['16', 'Body large', 'Report sent to the disaster agency.'],
      ['14', 'Body & table', 'Panel copy, table cells, buttons'],
      ['13', 'Meta', 'SW-2026-0142 · 07:42 · WhatsApp'],
      ['12', 'Label', 'STATUS · CHANNEL · SLA'],
    ],
  },
} as const

const ACCENTS = [
  {
    key: 'satu',
    name: 'Satu Daerah',
    a: ['#3FE0C0', 'teal'],
    b: ['#4FD1FF', 'cyan'],
    role: { id: 'Live, data publik, peta, layanan.', en: 'Live, public data, maps, services.' },
    chip: { id: 'Langsung', en: 'Live' },
  },
  {
    key: 'usaha',
    name: 'Usaha Pintar',
    a: ['#F59A62', 'peach'],
    b: ['#FFD77E', 'gold'],
    role: { id: 'Aksi utama, uang, peringatan ringan.', en: 'Primary action, money, soft warnings.' },
    chip: { id: 'Rp 1,2 jt', en: 'Rp 1.2 m' },
  },
  {
    key: 'pasar',
    name: 'Pasar Daerah',
    a: ['#8D5A9A', 'plum'],
    b: ['#B9B2FF', 'lavender'],
    role: { id: 'Katalog, pilihan, data sekunder.', en: 'Catalogues, choices, secondary data.' },
    chip: { id: '12 vendor', en: '12 vendors' },
  },
  {
    key: 'inti',
    name: 'GAMADA Inti',
    a: ['#DCD8FF', 'lavender-soft'],
    b: ['#F3F0FF', 'white'],
    role: { id: 'Platform, fokus, netral.', en: 'Platform, focus, neutral.' },
    chip: { id: 'Inti', en: 'Core' },
  },
] as const

export default function Tokens() {
  const { lang } = useI18n()
  const c = C[lang]
  const ref = useRef<HTMLDivElement>(null)
  const ctx = useGsapContext(ref)
  const mode = motionMode()

  useLayoutEffect(() => {
    if (mode === 'static') return
    ctx.current?.add(() => gsap.set(ref.current?.querySelectorAll('.lds-tk') ?? [], { opacity: 0, y: mode === 'full' ? 18 : 0 }))
  }, [ctx, mode])
  useEnter(ref, () =>
    ctx.current?.add(() =>
      gsap.to(ref.current?.querySelectorAll('.lds-tk') ?? [], {
        opacity: 1,
        y: 0,
        duration: mode === 'full' ? SJ.screen : SJ.fade,
        stagger: mode === 'full' ? 0.07 : 0,
        ease: EASE.out,
      }),
    ),
  )

  return (
    <div className="lds-tokens" ref={ref}>
      {/* Typography */}
      <article className="lds-panel lds-tk lds-tk-type">
        <h3 className="lds-h3">{c.type}</h3>
        <p className="lds-tk-note">{c.typeNote}</p>
        <div className="lds-tk-display">
          {(
            [
              ['40', 'Meja Pimpinan'],
              ['32', 'Sapa Warga'],
              ['28', 'Naskah Pintar'],
            ] as const
          ).map(([size, text]) => (
            <div key={size} className="lds-tk-drow">
              <span className="lds-tk-meta">
                Fraunces {size}
                <small>{c.display}</small>
              </span>
              <span className="lds-tk-fraunces" style={{ '--fs': `${size}px` } as CSSProperties}>
                {text}
              </span>
            </div>
          ))}
        </div>
        <div className="lds-tk-scale">
          {c.samples.map(([size, role, text]) => (
            <div key={size} className="lds-tk-srow">
              <span className="lds-tk-meta">
                {size}
                <small>{role}</small>
              </span>
              <span
                className={`lds-tk-manrope${size === '12' ? ' is-label' : ''}`}
                style={{ fontSize: `${size}px`, fontWeight: Number(size) >= 20 ? 700 : Number(size) >= 16 ? 600 : 500 }}
              >
                {text}
              </span>
            </div>
          ))}
        </div>
        <div className="lds-tk-tab">
          <div>
            <p className="lds-tk-sub">{c.tabular}</p>
            <p className="lds-tk-note">{c.tabularNote}</p>
          </div>
          <div className="lds-tk-tabcols" aria-hidden="true">
            {(['is-tab', 'is-prop'] as const).map((cls) => (
              <ol key={cls} className={cls}>
                {(lang === 'id' ? ['1.204', '87,4', '111,1'] : ['1,204', '87.4', '111.1']).map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ol>
            ))}
            <span className="lds-tk-tablabel">tabular</span>
            <span className="lds-tk-tablabel">{c.prop}</span>
          </div>
        </div>
      </article>

      {/* Surfaces */}
      <article className="lds-panel lds-tk lds-tk-surf">
        <h3 className="lds-h3">{c.surfaces}</h3>
        <p className="lds-tk-note">{c.surfacesNote}</p>
        <div className="lds-surf l0">
          <span className="lds-surf-tag">
            <b>--c-ink</b> #1A1638 · {c.canvas}
          </span>
          <div className="lds-surf l1">
            <span className="lds-surf-tag">
              <b>--c-ink-2</b> #231B48 · {c.panel}
            </span>
            <div className="lds-surf l2">
              <span className="lds-surf-tag">
                <b>--c-indigo</b> #2B2152 · {c.card}
              </span>
              <span className="lds-surf-skel" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <div className="lds-surf l3">
                <span className="lds-surf-tag">
                  <b>#352A63</b> · {c.hover}
                </span>
              </div>
            </div>
          </div>
        </div>
      </article>

      {/* Elevation */}
      <article className="lds-panel lds-tk lds-tk-elev">
        <h3 className="lds-h3">{c.elevation}</h3>
        <p className="lds-tk-note">{c.elevNote}</p>
        <ul className="lds-elev">
          {(
            [
              ['e1', c.e1],
              ['e2', c.e2],
              ['e3', c.e3],
            ] as const
          ).map(([k, label]) => (
            <li key={k} className={`lds-elev-tile is-${k}`}>
              <b>{k.toUpperCase()}</b>
              <small>{label}</small>
            </li>
          ))}
        </ul>
      </article>

      {/* Accents */}
      <article className="lds-panel lds-tk lds-tk-acc">
        <div className="lds-tk-head">
          <h3 className="lds-h3">{c.accents}</h3>
          <p className="lds-tk-note">{c.accentsNote}</p>
        </div>
        <ul className="lds-acc-grid">
          {ACCENTS.map((a) => (
            <li key={a.key} className={`lds-acc is-${a.key}`}>
              <p className="lds-acc-name">{a.name}</p>
              <div className="lds-acc-sw">
                {[a.a, a.b].map(([hex, label]) => (
                  <span key={hex} className="lds-acc-swatch">
                    <span className="lds-acc-dot" style={{ background: hex, boxShadow: `0 0 18px -2px ${hex}99` }} />
                    <span>
                      {label}
                      <small>{hex}</small>
                    </span>
                  </span>
                ))}
              </div>
              <div className="lds-acc-use" aria-hidden="true">
                <span className="lds-acc-chip">
                  <i />
                  {a.chip[lang]}
                </span>
                <span className="lds-acc-line" />
              </div>
              <p className="lds-acc-role">{a.role[lang]}</p>
            </li>
          ))}
          <li className="lds-acc is-danger">
            <p className="lds-acc-name">{c.danger}</p>
            <div className="lds-acc-sw">
              <span className="lds-acc-swatch">
                <span className="lds-acc-dot" style={{ background: '#C8382F' }} />
                <span>
                  red
                  <small>#C8382F</small>
                </span>
              </span>
            </div>
            <div className="lds-acc-use" aria-hidden="true">
              <span className="lds-acc-chip">
                <i />
                {lang === 'id' ? 'Terlambat 2 j' : 'Late 2 h'}
              </span>
              <span className="lds-acc-line" />
            </div>
            <p className="lds-acc-role">{c.dangerRole}</p>
          </li>
        </ul>
      </article>

      {/* Lines + radius */}
      <article className="lds-panel lds-tk lds-tk-lines">
        <div>
        <h3 className="lds-h3">{c.lines}</h3>
        <ul className="lds-lines">
          <li>
            <span className="lds-line-s is-hair" />
            {c.hair}
          </li>
          <li>
            <span className="lds-line-s is-strong" />
            {c.strong}
          </li>
          <li>
            <span className="lds-line-s is-active" />
            {c.active}
          </li>
          <li>
            <span className="lds-line-s is-dash" />
            {c.dashed}
          </li>
        </ul>
        </div>
        <div>
        <h3 className="lds-h3">{c.radius}</h3>
        <ul className="lds-radii">
          {(
            [
              [6, c.rChip],
              [10, c.rInput],
              [14, c.rCard],
              [20, c.rPanel],
            ] as const
          ).map(([r, label]) => (
            <li key={r}>
              <span className="lds-radius-box" style={{ borderTopLeftRadius: r }} />
              <b>{r}</b>
              <small>{label}</small>
            </li>
          ))}
        </ul>
        </div>
      </article>

    </div>
  )
}
