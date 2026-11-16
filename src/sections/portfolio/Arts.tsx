/**
 * Stylised card art for the featured portfolio (decorative: the card title + text carry the
 * meaning, so every art is aria-hidden by the card). HTML/CSS + small inline SVG, sized in em on a
 * container-query font size (portfolio.css) so each scales with its card. The `.pf-art` root is
 * the element that zooms on hover.
 */
import { WORK } from '../../content/work'

/** PhoneFarm: control panel with a rack of phones. Slot states are shapes, not data. */
const FARM = 'oobooiooob' as const

export function FarmArt() {
  return (
    <div className="pf-art pf-art--farm">
      <div className="pa-farm-bar">
        <span className="pa-pill pa-pill--brand">PhoneFarm</span>
        <span className="pa-pill pa-pill--live">
          <i /> live
        </span>
      </div>
      <div className="pa-farm-rack">
        {[...FARM].map((s, i) => (
          <span key={i} className={`pa-phone pa-phone--${s}`}>
            <i className="pa-phone-l" />
            <i className="pa-phone-l pa-phone-l--s" />
          </span>
        ))}
      </div>
      <div className="pa-farm-log">
        <i />
        <i />
        <i />
      </div>
    </div>
  )
}

/** Sistem Automasi: incoming data → AI node → three outputs, as a small flow diagram. */
export function FlowArt() {
  return (
    <div className="pf-art pf-art--flow">
      <svg viewBox="0 0 320 200" className="pa-flow">
        <defs>
          <radialGradient id="pa-ai-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#4fd1ff" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#4fd1ff" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* links */}
        <g className="pa-links">
          <path d="M78 100 C 110 100, 118 100, 142 100" />
          <path d="M190 100 C 218 100, 220 48, 248 48" />
          <path d="M190 100 C 220 100, 222 100, 248 100" />
          <path d="M190 100 C 218 100, 220 152, 248 152" />
        </g>
        <g className="pa-pulses">
          <circle cx="112" cy="100" r="3" />
          <circle cx="226" cy="64" r="3" />
          <circle cx="232" cy="142" r="3" />
        </g>
        {/* input: inbox */}
        <g className="pa-node">
          <rect x="22" y="72" width="56" height="56" rx="14" />
          <path className="pa-ic" d="M36 102h8l3 6h10l3-6h8M36 102l5-14h22l5 14v10H36z" />
        </g>
        {/* AI core */}
        <circle cx="166" cy="100" r="44" fill="url(#pa-ai-glow)" />
        <g className="pa-node pa-node--ai">
          <rect x="142" y="76" width="48" height="48" rx="14" />
          <path className="pa-ic" d="M166 88l3.2 8.8 8.8 3.2-8.8 3.2-3.2 8.8-3.2-8.8-8.8-3.2 8.8-3.2z" />
        </g>
        {/* outputs: report, chat, stock */}
        <g className="pa-node pa-node--out">
          <rect x="248" y="28" width="44" height="40" rx="11" />
          <path className="pa-ic" d="M261 56v-8M270 56V40M279 56v-12" />
        </g>
        <g className="pa-node pa-node--out">
          <rect x="248" y="80" width="44" height="40" rx="11" />
          <path className="pa-ic" d="M260 93h20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-12l-6 4v-4h-2a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z" />
        </g>
        <g className="pa-node pa-node--out">
          <rect x="248" y="132" width="44" height="40" rx="11" />
          <path className="pa-ic" d="M260 146l10-5 10 5v12l-10 5-10-5zM260 146l10 5 10-5M270 151v12" />
        </g>
      </svg>
    </div>
  )
}

/** The mobile demos: one phone per APK entry (names from WORK), fanned. */
const APKS = WORK.filter((w) => w.kind === 'apk')

export function PhonesArt() {
  return (
    <div className="pf-art pf-art--phones">
      {APKS.map((a, i) => (
        <span key={a.slug} className="pa-mob" data-i={i}>
          <span className="pa-mob-scr">
            <b>{a.name}</b>
            <i className="pa-mob-hero" />
            <i className="pa-mob-l" />
            <i className="pa-mob-l pa-mob-l--s" />
            <i className="pa-mob-btn" />
          </span>
        </span>
      ))}
    </div>
  )
}
