/** 01 · Token sheet — type scale, surfaces, lines, radius, elevation and the ecosystem accents. */
import { useRef, type KeyboardEvent } from 'react'
import { useI18n } from '../../lib/i18n'
import { KPIS, TICKETS, NEW_TICKET } from '../sample'
import { fmt, type Bi } from './lde'

export type Eco = 'satu' | 'usaha' | 'pasar' | 'inti'

export const ECOS: { id: Eco; name: string; a: string; b: string; aName: string; bName: string; role: Bi }[] = [
  { id: 'satu', name: 'Satu Daerah', a: '#3fe0c0', b: '#4fd1ff', aName: 'teal', bName: 'cyan', role: { id: 'Layanan publik & pemerintahan', en: 'Public service & government' } },
  { id: 'usaha', name: 'Usaha Pintar', a: '#f59a62', b: '#ffd77e', aName: 'peach', bName: 'gold', role: { id: 'UMKM, toko & pembukuan', en: 'SMEs, retail & bookkeeping' } },
  { id: 'pasar', name: 'Pasar Daerah', a: '#8d5a9a', b: '#b9b2ff', aName: 'plum', bName: 'lavender', role: { id: 'Ekonomi & pasar lokal', en: 'Local economy & markets' } },
  { id: 'inti', name: 'GAMADA Inti', a: '#dcd8ff', b: '#f3f0ff', aName: 'lavender', bName: 'white', role: { id: 'Platform AI terpadu', en: 'Unified AI platform' } },
]

const C = {
  type: { id: 'Skala tipe', en: 'Type scale' },
  typeNote: {
    id: 'Manrope untuk antarmuka, Fraunces hanya untuk judul halaman dan angka utama. Semua angka tabular.',
    en: 'Manrope for interface, Fraunces only for page titles and headline numerals. All numerals tabular.',
  },
  surfaces: { id: 'Permukaan', en: 'Surfaces' },
  lines: { id: 'Garis', en: 'Lines' },
  radius: { id: 'Radius', en: 'Radius' },
  elevation: { id: 'Elevasi', en: 'Elevation' },
  accents: { id: 'Aksen ekosistem', en: 'Ecosystem accents' },
  accentsNote: {
    id: 'Satu aksen per tampilan. Pilih ekosistem untuk mewarnai ulang seluruh halaman ini.',
    en: 'One accent per view. Pick an ecosystem to recolour this whole page.',
  },
  accentGroup: { id: 'Aksen halaman', en: 'Page accent' },
  inUse: { id: 'Dipakai', en: 'In use' },
  danger: { id: 'Bahaya', en: 'Danger' },
  dangerRole: { id: 'Hanya untuk status bahaya: SLA lewat, gagal. Tidak pernah dekoratif.', en: 'Danger states only: SLA breached, failure. Never decorative.' },
  semantic: { id: 'Semantik tetap', en: 'Fixed semantics' },
  pos: { id: 'Membaik', en: 'Improving' },
  warn: { id: 'Perlu perhatian', en: 'Needs attention' },
}

const SURFACES = [
  { v: '--c-ink', hex: '#1A1638', role: { id: 'Kanvas · halaman', en: 'Canvas · page' } },
  { v: '--c-ink-2', hex: '#231B48', role: { id: 'Permukaan · panel', en: 'Surface · panel' } },
  { v: '--c-indigo', hex: '#2B2152', role: { id: 'Naik · hover, terpilih', en: 'Raised · hover, selected' } },
]

const LINES = [
  { cls: 'lde-ln-hair', name: { id: 'Garis rambut', en: 'Hairline' }, spec: '1px · 12%' },
  { cls: 'lde-ln-rule', name: { id: 'Garis bagian', en: 'Section rule' }, spec: '1px · 36%' },
  { cls: 'lde-ln-active', name: { id: 'Aktif', en: 'Active' }, spec: '2px · aksen 60%' },
  { cls: 'lde-ln-dash', name: { id: 'Prakiraan', en: 'Forecast' }, spec: '1.5px · 4/4' },
]

const RADII = [
  { r: 6, use: { id: 'Chip', en: 'Chip' } },
  { r: 10, use: { id: 'Input', en: 'Input' } },
  { r: 14, use: { id: 'Kartu', en: 'Card' } },
  { r: 20, use: { id: 'Panel', en: 'Panel' } },
]

const ELEV = [
  { n: 1, use: { id: 'Baris terangkat', en: 'Raised row' } },
  { n: 2, use: { id: 'Menu, tooltip', en: 'Menu, tooltip' } },
  { n: 3, use: { id: 'Bingkai perangkat', en: 'Device frame' } },
]

export default function Tokens({ eco, setEco }: { eco: Eco; setEco: (e: Eco) => void }) {
  const { lang } = useI18n()
  const groupRef = useRef<HTMLDivElement>(null)
  const kpiAduan = KPIS[0]
  const sample = NEW_TICKET

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End']
    if (!keys.includes(e.key)) return
    e.preventDefault()
    const i = ECOS.findIndex((x) => x.id === eco)
    let j = i
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % ECOS.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + ECOS.length) % ECOS.length
    else if (e.key === 'Home') j = 0
    else j = ECOS.length - 1
    const next = ECOS[j]
    if (!next) return
    setEco(next.id)
    groupRef.current?.querySelectorAll<HTMLElement>('[role="radio"]')[j]?.focus()
  }

  return (
    <div className="lde-tokens">
      {/* Type scale */}
      <div className="lde-tk-row">
        <div className="lde-tk-side">
          <h3 className="lde-cap lde-cap-strong">{C.type[lang]}</h3>
          <p className="lde-note">{C.typeNote[lang]}</p>
        </div>
        <ol className="lde-type" aria-label={C.type[lang]}>
          <li>
            <span className="lde-type-meta">Fraunces 40 · 400</span>
            <span className="lde-type-spec lde-t-f40">Meja Pimpinan</span>
          </li>
          <li>
            <span className="lde-type-meta">Fraunces 28 · 400</span>
            <span className="lde-type-spec lde-t-f28">{lang === 'id' ? 'Ringkasan pagi, 17 November' : 'Morning brief, 17 November'}</span>
          </li>
          <li>
            <span className="lde-type-meta">Manrope 32 · 600</span>
            <span className="lde-type-spec lde-t-32">{lang === 'id' ? 'Kotak masuk' : 'Inbox'}</span>
          </li>
          <li>
            <span className="lde-type-meta">Manrope 24 · 600</span>
            <span className="lde-type-spec lde-t-24">{sample.id}</span>
          </li>
          <li>
            <span className="lde-type-meta">Manrope 20 · 600</span>
            <span className="lde-type-spec lde-t-20">
              {sample.category[lang]} · {sample.kecamatan}
            </span>
          </li>
          <li>
            <span className="lde-type-meta">Manrope 16 · 400</span>
            <span className="lde-type-spec lde-t-16">
              {lang === 'id' ? 'Laporan diteruskan ke BPBD dan dijadwalkan ditinjau dalam 6 jam.' : 'Report sent to the disaster agency, inspection scheduled within 6 hours.'}
            </span>
          </li>
          <li>
            <span className="lde-type-meta">Manrope 14 · 500</span>
            <span className="lde-type-spec lde-t-14">{TICKETS.map((t) => t.kecamatan).slice(0, 4).join(' · ')}</span>
          </li>
          <li>
            <span className="lde-type-meta">Manrope 13 · 500</span>
            <span className="lde-type-spec lde-t-13">{lang === 'id' ? 'Data simulasi · seed 42 · diperbarui 07.12' : 'Simulated data · seed 42 · updated 07:12'}</span>
          </li>
          <li>
            <span className="lde-type-meta">Manrope 12 · 600 · 0.14em</span>
            <span className="lde-type-spec lde-cap">{kpiAduan.label[lang]}</span>
          </li>
          <li className="lde-type-nums">
            <span className="lde-type-meta">tabular-nums</span>
            <span className="lde-type-spec lde-t-nums" aria-label={lang === 'id' ? 'Contoh angka tabular' : 'Tabular numerals sample'}>
              <span>142</span>
              <span>{fmt(lang, 87.4, 1)}</span>
              <span>{fmt(lang, 1000)}</span>
              <span>0141</span>
            </span>
          </li>
        </ol>
      </div>

      {/* Surfaces · lines · radius · elevation */}
      <div className="lde-tk-quad">
        <div className="lde-tk-col">
          <h3 className="lde-cap lde-cap-strong">{C.surfaces[lang]}</h3>
          <ul className="lde-swatches">
            {SURFACES.map((s) => (
              <li key={s.v}>
                <span className="lde-swatch" style={{ background: `var(${s.v})` }} aria-hidden="true" />
                <span className="lde-swatch-name">{s.v}</span>
                <span className="lde-swatch-hex">{s.hex}</span>
                <span className="lde-swatch-role">{s.role[lang]}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="lde-tk-col">
          <h3 className="lde-cap lde-cap-strong">{C.lines[lang]}</h3>
          <ul className="lde-lines">
            {LINES.map((l) => (
              <li key={l.cls}>
                <span className={`lde-ln ${l.cls}`} aria-hidden="true" />
                <span className="lde-lines-name">{l.name[lang]}</span>
                <span className="lde-lines-spec">{l.spec.replace('aksen', lang === 'id' ? 'aksen' : 'accent')}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="lde-tk-col">
          <h3 className="lde-cap lde-cap-strong">{C.radius[lang]}</h3>
          <ul className="lde-radii">
            {RADII.map((r) => (
              <li key={r.r}>
                <span className="lde-radius" style={{ borderTopLeftRadius: r.r }} aria-hidden="true" />
                <span className="lde-radii-n">{r.r}</span>
                <span className="lde-radii-use">{r.use[lang]}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="lde-tk-col">
          <h3 className="lde-cap lde-cap-strong">{C.elevation[lang]}</h3>
          <ul className="lde-elev">
            {ELEV.map((e) => (
              <li key={e.n}>
                <span className={`lde-plate lde-e${e.n}`} aria-hidden="true">
                  <span className="lde-plate-n">E{e.n}</span>
                </span>
                <span className="lde-elev-use">{e.use[lang]}</span>
              </li>
            ))}
          </ul>
          <p className="lde-note lde-note-tight">{lang === 'id' ? 'Sorot atas 1px · tanpa backdrop-filter' : '1px top highlight · no backdrop-filter'}</p>
        </div>
      </div>

      {/* Ecosystem accents: the columns ARE the accent picker */}
      <div className="lde-tk-row lde-tk-acc">
        <div className="lde-tk-side">
          <h3 className="lde-cap lde-cap-strong" id="lde-acc-h">
            {C.accents[lang]}
          </h3>
          <p className="lde-note">{C.accentsNote[lang]}</p>
        </div>
        <div className="lde-acc-wrap">
          <div className="lde-accents" role="radiogroup" aria-labelledby="lde-acc-h" ref={groupRef} onKeyDown={onKey}>
            {ECOS.map((e) => {
              const on = e.id === eco
              return (
                <button
                  key={e.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  tabIndex={on ? 0 : -1}
                  className="lde-acc"
                  onClick={() => setEco(e.id)}
                >
                  <span className="lde-acc-bars" aria-hidden="true">
                    <span style={{ background: e.a }} />
                    <span style={{ background: e.b }} />
                  </span>
                  <span className="lde-acc-name">{e.name}</span>
                  <span className="lde-acc-hex">
                    {e.aName} {e.a.toUpperCase()} · {e.bName} {e.b.toUpperCase()}
                  </span>
                  <span className="lde-acc-role">{e.role[lang]}</span>
                  <span className="lde-acc-state" aria-hidden="true">
                    {on ? C.inUse[lang] : ''}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="lde-semantic">
            <div className="lde-sem-item">
              <span className="lde-sem-dot lde-sem-danger" aria-hidden="true" />
              <span className="lde-sem-name">
                {C.danger[lang]} <span className="lde-acc-hex">red #C8382F</span>
              </span>
              <span className="lde-sem-role">{C.dangerRole[lang]}</span>
            </div>
            <div className="lde-sem-item">
              <span className="lde-sem-dot lde-sem-pos" aria-hidden="true" />
              <span className="lde-sem-name">{C.pos[lang]}</span>
              <span className="lde-sem-role">{C.semantic[lang]} · delta</span>
            </div>
            <div className="lde-sem-item">
              <span className="lde-sem-dot lde-sem-warn" aria-hidden="true" />
              <span className="lde-sem-name">{C.warn[lang]}</span>
              <span className="lde-sem-role">{C.semantic[lang]} · SLA &lt; 8 {lang === 'id' ? 'j' : 'h'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
