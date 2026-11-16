/** 01 · Token sheet — how direction C uses the shared tokens. */
import { useI18n } from '../../lib/i18n'
import { STATUS_LABEL, type TicketStatus } from '../sample'
import { Kbd, SectionHead, fmt } from './shared'

const C = {
  id: {
    title: 'Token & bahasa visual',
    lead: 'Permukaan rendah kontras, garis 1 px yang tegas, warna hanya untuk status dan titik aksen ekosistem.',
    type: 'Skala tipe',
    typeNote: 'Manrope untuk UI · Fraunces hanya judul halaman demo',
    sample: 'Aduan diteruskan ke Dinas PUPR',
    sampleShort: 'Aduan diteruskan',
    spacing: 'Spasi · grid 4 px',
    slaTones: 'Nada SLA',
    title2: 'Konsol Sapa Warga',
    numerals: 'Angka tabular',
    surfaces: 'Permukaan',
    canvas: 'Kanvas',
    panel: 'Panel',
    raised: 'Naik · hover',
    lines: 'Garis',
    lineDefault: 'Bawaan 12%',
    lineStrong: 'Pemisah 24%',
    lineActive: 'Aktif · aksen 60%',
    lineForecast: 'Prakiraan · putus',
    radius: 'Radius',
    rChip: 'chip',
    rInput: 'input',
    rCard: 'kartu',
    rPanel: 'panel',
    elevation: 'Elevasi',
    e: ['Baris, chip', 'Popover, tooltip', 'Dialog, kertas'],
    eNote: 'Sorot dalam 1 px di tepi atas · tanpa backdrop-filter',
    accents: 'Aksen ekosistem',
    accentUse: 'titik + tanda data',
    danger: 'Bahaya',
    dangerUse: 'hanya SLA terlambat, delta buruk',
    status: 'Status & papan ketik',
    focus: 'Cincin fokus',
  },
  en: {
    title: 'Tokens & visual language',
    lead: 'Low-contrast surfaces, crisp 1 px lines, colour only for status and the ecosystem accent dot.',
    type: 'Type scale',
    typeNote: 'Manrope for UI · Fraunces only for demo page titles',
    sample: 'Complaint routed to Public Works',
    sampleShort: 'Complaint routed',
    spacing: 'Spacing · 4 px grid',
    slaTones: 'SLA tones',
    title2: 'Sapa Warga console',
    numerals: 'Tabular numerals',
    surfaces: 'Surfaces',
    canvas: 'Canvas',
    panel: 'Panel',
    raised: 'Raised · hover',
    lines: 'Lines',
    lineDefault: 'Default 12%',
    lineStrong: 'Divider 24%',
    lineActive: 'Active · accent 60%',
    lineForecast: 'Forecast · dashed',
    radius: 'Radius',
    rChip: 'chip',
    rInput: 'input',
    rCard: 'card',
    rPanel: 'panel',
    elevation: 'Elevation',
    e: ['Rows, chips', 'Popover, tooltip', 'Dialog, paper'],
    eNote: '1 px inner top highlight · no backdrop-filter',
    accents: 'Ecosystem accents',
    accentUse: 'dot + data marks',
    danger: 'Danger',
    dangerUse: 'late SLA, bad deltas only',
    status: 'Status & keyboard',
    focus: 'Focus ring',
  },
}

const SIZES = [32, 24, 20, 16, 14, 13, 12] as const
const WEIGHT: Record<number, number> = { 32: 600, 24: 600, 20: 600, 16: 600, 14: 500, 13: 500, 12: 500 }

const ACCENTS = [
  { name: 'Satu Daerah', a: '--c-teal', b: '--c-cyan', ha: '#3FE0C0', hb: '#4FD1FF' },
  { name: 'Usaha Pintar', a: '--c-peach', b: '--c-gold', ha: '#F59A62', hb: '#FFD77E' },
  { name: 'Pasar Daerah', a: '--c-plum', b: '--c-lavender', ha: '#8D5A9A', hb: '#B9B2FF' },
  { name: 'GAMADA Inti', a: '--c-lavender-soft', b: '--c-white', ha: '#DCD8FF', hb: '#FFFFFF' },
]

const STATUSES: TicketStatus[] = ['baru', 'verifikasi', 'opd', 'proses', 'selesai']

export default function TokenSheet() {
  const { lang } = useI18n()
  const c = C[lang]
  return (
    <section className="ldt-block" aria-labelledby="ldt-h-tokens">
      <SectionHead num="01" id="ldt-h-tokens" title={c.title} lead={c.lead} />
      <div className="ldt-tok">
        {/* type */}
        <div className="ldt-card ldt-tok-type">
          <div className="ldt-card-h">
            <span>{c.type}</span>
            <span className="ldt-faint">{c.typeNote}</span>
          </div>
          {[40, 28].map((fs) => (
            <div key={fs} className="ldt-type-row ldt-type-row--display">
              <span className="ldt-type-meta">
                Fraunces <b>{fs}</b>
              </span>
              <span className="ldt-display" style={{ fontSize: fs }}>
                {c.title2}
              </span>
            </div>
          ))}
          {SIZES.map((s) => (
            <div key={s} className="ldt-type-row">
              <span className="ldt-type-meta">
                <b>{s}</b> / {Math.round(s * (s >= 20 ? 1.25 : 1.45))} · {WEIGHT[s]}
              </span>
              <span className="ldt-type-sample" style={{ fontSize: s, fontWeight: WEIGHT[s] }}>
                {s >= 24 ? c.sampleShort : c.sample}
              </span>
            </div>
          ))}
          <div className="ldt-type-row">
            <span className="ldt-type-meta">{c.numerals}</span>
            <span className="ldt-type-num">
              <span>{fmt(lang, 1250000)}</span>
              <span>{fmt(lang, 87.4, 1)}%</span>
              <span>19:59:42</span>
              <span>{fmt(lang, 142)}</span>
            </span>
          </div>
        </div>

        {/* surfaces */}
        <div className="ldt-card ldt-tok-surf">
          <div className="ldt-card-h">
            <span>{c.surfaces}</span>
          </div>
          <div className="ldt-surf l0">
            <span className="ldt-surf-label">
              {c.canvas} <code>--c-ink</code>
            </span>
            <div className="ldt-surf l1">
              <span className="ldt-surf-label">
                {c.panel} <code>--c-ink-2</code>
              </span>
              <div className="ldt-surf l2">
                <span className="ldt-surf-label">
                  {c.raised} <code>--c-indigo</code>
                </span>
              </div>
            </div>
          </div>
          <div className="ldt-card-h ldt-card-h--sub">
            <span>{c.spacing}</span>
          </div>
          <ul className="ldt-space">
            {[4, 8, 12, 16, 24, 32, 48, 64].map((v) => (
              <li key={v}>
                <i style={{ height: v }} aria-hidden="true" />
                <span className="ldt-num">{v}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* lines + radius */}
        <div className="ldt-card ldt-tok-lines">
          <div className="ldt-card-h">
            <span>{c.lines}</span>
          </div>
          <ul className="ldt-lines">
            <li>
              <i className="ldt-lsw ldt-lsw--d" aria-hidden="true" />
              {c.lineDefault}
            </li>
            <li>
              <i className="ldt-lsw ldt-lsw--s" aria-hidden="true" />
              {c.lineStrong}
            </li>
            <li>
              <i className="ldt-lsw ldt-lsw--a" aria-hidden="true" />
              {c.lineActive}
            </li>
            <li>
              <i className="ldt-lsw ldt-lsw--f" aria-hidden="true" />
              {c.lineForecast}
            </li>
          </ul>
          <div className="ldt-card-h ldt-card-h--sub">
            <span>{c.radius}</span>
          </div>
          <div className="ldt-radii">
            {[
              [6, c.rChip],
              [10, c.rInput],
              [14, c.rCard],
              [20, c.rPanel],
            ].map(([r, label]) => (
              <div key={r} className="ldt-radius">
                <i style={{ borderTopLeftRadius: Number(r) }} aria-hidden="true" />
                <span>
                  <b>{r}</b> {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* elevation */}
        <div className="ldt-card ldt-tok-elev">
          <div className="ldt-card-h">
            <span>{c.elevation}</span>
            <span className="ldt-faint">{c.eNote}</span>
          </div>
          <div className="ldt-elevs">
            {c.e.map((label, i) => (
              <div key={label} className={`ldt-elev ldt-e${i + 1}`}>
                <b>E{i + 1}</b>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* accents */}
        <div className="ldt-card ldt-tok-acc">
          <div className="ldt-card-h">
            <span>{c.accents}</span>
            <span className="ldt-faint">{c.accentUse}</span>
          </div>
          <ul className="ldt-acc">
            {ACCENTS.map((a) => (
              <li key={a.name}>
                <span className="ldt-dot" style={{ background: `var(${a.a})` }} aria-hidden="true" />
                <span className="ldt-acc-name">{a.name}</span>
                <span className="ldt-acc-sw" aria-hidden="true">
                  <i style={{ background: `var(${a.a})` }} />
                  <i style={{ background: `var(${a.b})` }} />
                </span>
                <code className="ldt-acc-hex">
                  {a.ha} · {a.hb}
                </code>
              </li>
            ))}
            <li className="ldt-acc-danger">
              <span className="ldt-dot" style={{ background: 'var(--c-red)' }} aria-hidden="true" />
              <span className="ldt-acc-name">{c.danger}</span>
              <span className="ldt-acc-sw" aria-hidden="true">
                <i style={{ background: 'var(--c-red)' }} />
                <i style={{ background: 'var(--ldt-danger)' }} />
              </span>
              <span className="ldt-acc-hex ldt-faint">{c.dangerUse}</span>
            </li>
          </ul>
        </div>

        {/* status + kbd */}
        <div className="ldt-card ldt-tok-status">
          <div className="ldt-card-h">
            <span>{c.status}</span>
          </div>
          <div className="ldt-chiprow">
            {STATUSES.map((s) => (
              <span key={s} className={`ldt-status ldt-status--${s}`}>
                <i aria-hidden="true" />
                {STATUS_LABEL[s][lang]}
              </span>
            ))}
          </div>
          <div className="ldt-slarow">
            <span className="ldt-faint">{c.slaTones}</span>
            <span className="ldt-sla ldt-sla--ok">20:00:00</span>
            <span className="ldt-sla ldt-sla--warn">06:00:00</span>
            <span className="ldt-sla ldt-sla--late">−02:00:00</span>
          </div>
          <div className="ldt-kbdrow">
            <span>
              <Kbd>J</Kbd>
              <Kbd>K</Kbd>
            </span>
            <span>
              <Kbd>↵</Kbd>
            </span>
            <span>
              <Kbd>N</Kbd>
            </span>
            <span className="ldt-focus-demo" aria-hidden="true">
              {c.focus}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
