/**
 * ui/icons.tsx — the Demo Kit line icon set: 20 × 20 grid, 1.5 px stroke, round caps/joins, currentColor.
 * Same family as src/sections/ecosystem/icons.tsx (drawn on 24, here tightened to 20 for 12–14 px UI text).
 * One glyph per product icon key in src/content/products.ts + the UI set. Decorative by default; pass
 * `title` to make the icon an image with an accessible name.
 */
import { memo, type ReactElement, type SVGProps } from 'react'

type Glyph = () => ReactElement

const dot = (cx: number, cy: number, r = 0.6) => <circle cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />

const G = {
  /* ---------------------------------------------------------------- products (keys from products.ts) */
  inti: () => (
    <>
      <path d="M10 2.8 17 6.4 10 10 3 6.4Z" />
      <path d="m3 10 7 3.6 7-3.6" />
      <path d="m3 13.6 7 3.6 7-3.6" />
    </>
  ),
  sapa: () => (
    <>
      <path d="M4.2 3.8h11.6a1.4 1.4 0 0 1 1.4 1.4v7.4a1.4 1.4 0 0 1-1.4 1.4H9.6l-3.8 2.9V14H4.2a1.4 1.4 0 0 1-1.4-1.4V5.2a1.4 1.4 0 0 1 1.4-1.4Z" />
      <path d="m7.2 9 1.9 1.8 3.7-3.8" />
    </>
  ),
  meja: () => (
    <>
      <rect x="2.6" y="3.2" width="14.8" height="10.3" rx="1.6" />
      <path d="M7.2 16.8h5.6M10 13.5v3.3" />
      <path d="m5.6 10.6 2.4-2.6 2 1.6 3.4-3.6" />
    </>
  ),
  naskah: () => (
    <>
      <path d="M12.4 2.8H5.4a1.2 1.2 0 0 0-1.2 1.2v12a1.2 1.2 0 0 0 1.2 1.2h4" />
      <path d="M7 6.6h5.2M7 9.4h3.4" />
      <path d="m15.6 8.6 1.6 1.6-5.4 5.4-2.2.6.6-2.2Z" />
    </>
  ),
  radar: () => (
    <>
      <circle cx="10" cy="10" r="7.2" />
      <circle cx="10" cy="10" r="4" />
      <path d="M10 10 15.1 4.9" />
      {dot(13, 12.6, 0.9)}
    </>
  ),
  siaga: () => (
    <>
      <path d="M5.6 11.6a3.4 3.4 0 0 1 .5-6.8 4.6 4.6 0 0 1 8.8 1.2 2.8 2.8 0 0 1-.4 5.6Z" />
      <path d="m7 14-1 2.6M10.4 14l-1 2.6M13.8 14l-1 2.6" />
    </>
  ),
  awas: () => (
    <>
      <circle cx="8.6" cy="8.6" r="5.4" />
      <path d="m12.6 12.6 4.4 4.4" />
      <path d="M8.6 5.8v5.6M10.2 6.9H7.8a1.1 1.1 0 0 0 0 2.2h1.6a1.1 1.1 0 0 1 0 2.2H6.9" />
    </>
  ),
  cek: () => (
    <>
      <path d="M11.6 2.8H5.4a1.2 1.2 0 0 0-1.2 1.2v12a1.2 1.2 0 0 0 1.2 1.2h3.8" />
      <path d="M11.6 2.8 15.8 7v1.6" />
      <path d="M11.6 2.8V7h4.2" />
      <circle cx="14" cy="14" r="3.4" />
      <path d="m12.6 14 1 1 1.9-2" />
    </>
  ),
  toko: () => (
    <>
      <path d="M3.4 7.4 4.6 3.4h10.8l1.2 4" />
      <path d="M3.4 7.4a2.2 2.2 0 0 0 4.4 0 2.2 2.2 0 0 0 4.4 0 2.2 2.2 0 0 0 4.4 0" />
      <path d="M4.4 9.4v7.2h11.2V9.4" />
      <path d="M8.4 16.6v-4h3.2v4" />
    </>
  ),
  pajak: () => (
    <>
      <path d="M4.6 2.8h10.8v14.4l-1.8-1.2-1.8 1.2-1.8-1.2-1.8 1.2-1.8-1.2-1.8 1.2Z" />
      <path d="m7.6 11.6 4.8-4.8" />
      {dot(7.9, 7.1, 0.85)}
      {dot(12.1, 11.3, 0.85)}
    </>
  ),
  juara: () => (
    <>
      <path d="M6.2 3.2h7.6v4.2a3.8 3.8 0 0 1-7.6 0Z" />
      <path d="M6.2 4.6H3.6v1.2a2.6 2.6 0 0 0 2.8 2.6M13.8 4.6h2.6v1.2a2.6 2.6 0 0 1-2.8 2.6" />
      <path d="M10 11.2v2.6M7 16.8h6M7.8 16.8l.6-3h3.2l.6 3" />
    </>
  ),
  kenal: () => (
    <>
      <rect x="2.6" y="4.2" width="14.8" height="11.6" rx="1.6" />
      <circle cx="7.4" cy="9" r="1.7" />
      <path d="M4.8 13.2a2.8 2.8 0 0 1 5.2 0" />
      <path d="M11.8 8.2h3.2M11.8 11h2.2" />
    </>
  ),
  pantau: () => (
    <>
      <path d="M2.4 10S5.2 4.6 10 4.6 17.6 10 17.6 10 14.8 15.4 10 15.4 2.4 10 2.4 10Z" />
      <circle cx="10" cy="10" r="2.6" />
      <path d="m10 9.1.3.6.7.1-.5.5.1.7-.6-.3-.6.3.1-.7-.5-.5.7-.1Z" />
    </>
  ),
  tender: () => (
    <>
      <rect x="4.2" y="3.6" width="11.6" height="13.6" rx="1.4" />
      <path d="M7.6 3.6V2.6h4.8v1" />
      <path d="M7.2 8.2h5.6M7.2 11h3.2" />
      <path d="m10.8 14.4 1.2 1.2 2.4-2.6" />
    </>
  ),
  katalog: () => (
    <>
      <path d="M4 6.6h12l-.9 9.4a1.2 1.2 0 0 1-1.2 1.1H6.1A1.2 1.2 0 0 1 4.9 16Z" />
      <path d="M7.4 8.6V5.8a2.6 2.6 0 0 1 5.2 0v2.8" />
    </>
  ),
  rapor: () => (
    <>
      <path d="M3.2 13.6a6.8 6.8 0 1 1 13.6 0" />
      <path d="M10 13.6 13 8.8" />
      {dot(10, 13.6, 1)}
      <path d="M3.2 16.6h13.6" />
    </>
  ),
  indeks: () => (
    <>
      <path d="M3.2 16.8h13.6" />
      <path d="M5.4 16.8v-4M9 16.8v-6.4M12.6 16.8v-3.8M16.2 16.8V8.6" />
      <path d="m4.6 8.2 3.6-3 3.2 2 4.6-4" />
    </>
  ),
  sinyal: () => (
    <>
      <path d="M10.8 2.8h5.2a1.2 1.2 0 0 1 1.2 1.2v5.2l-7.6 7.6a1.2 1.2 0 0 1-1.7 0l-4.7-4.7a1.2 1.2 0 0 1 0-1.7Z" />
      {dot(13.8, 6.2, 0.9)}
      <path d="m6.4 11.4 1.4-1.4 1.2 1.2 2.4-2.4" />
    </>
  ),

  /* ---------------------------------------------------------------- actions */
  plus: () => <path d="M10 4.5v11M4.5 10h11" />,
  minus: () => <path d="M4.5 10h11" />,
  close: () => <path d="m5.2 5.2 9.6 9.6M14.8 5.2l-9.6 9.6" />,
  check: () => <path d="m4.5 10.4 3.4 3.3 7.6-8" />,
  search: () => (
    <>
      <circle cx="8.8" cy="8.8" r="5.3" />
      <path d="m12.8 12.8 4 4" />
    </>
  ),
  filter: () => <path d="M3.2 4.4h13.6l-5.2 6.2v5l-3.2 1.4v-6.4Z" />,
  sort: () => <path d="M6.4 3.6v12.8M3.6 6.4l2.8-2.8 2.8 2.8M13.6 16.4V3.6M10.8 13.6l2.8 2.8 2.8-2.8" />,
  sortAsc: () => <path d="M10 15.6V4.4M5.6 8.8 10 4.4l4.4 4.4" />,
  sortDesc: () => <path d="M10 4.4v11.2M5.6 11.2l4.4 4.4 4.4-4.4" />,
  more: () => (
    <>
      {dot(4.6, 10, 1.1)}
      {dot(10, 10, 1.1)}
      {dot(15.4, 10, 1.1)}
    </>
  ),
  menu: () => <path d="M3.6 5.6h12.8M3.6 10h12.8M3.6 14.4h12.8" />,
  edit: () => (
    <>
      <path d="m12.8 3.8 3.4 3.4-8.8 8.8-4 .6.6-4Z" />
      <path d="m11 5.6 3.4 3.4" />
    </>
  ),
  trash: () => (
    <>
      <path d="M3.6 5.6h12.8M8 5.6V3.6h4v2" />
      <path d="m5.2 5.6.8 11h8l.8-11" />
      <path d="M8.4 8.8v4.8M11.6 8.8v4.8" />
    </>
  ),
  copy: () => (
    <>
      <rect x="6.8" y="6.8" width="10" height="10" rx="1.6" />
      <path d="M13.2 6.8V4.8a1.6 1.6 0 0 0-1.6-1.6H4.8a1.6 1.6 0 0 0-1.6 1.6v6.8a1.6 1.6 0 0 0 1.6 1.6h2" />
    </>
  ),
  upload: () => <path d="M10 13V3.6M6 7.4l4-3.8 4 3.8M3.6 12.4v2.8a1.6 1.6 0 0 0 1.6 1.6h9.6a1.6 1.6 0 0 0 1.6-1.6v-2.8" />,
  download: () => <path d="M10 3.6V13M6 9.2l4 3.8 4-3.8M3.6 12.4v2.8a1.6 1.6 0 0 0 1.6 1.6h9.6a1.6 1.6 0 0 0 1.6-1.6v-2.8" />,
  print: () => (
    <>
      <path d="M5.6 7.2V3.2h8.8v4" />
      <path d="M5.6 14H4a1.2 1.2 0 0 1-1.2-1.2V8.4A1.2 1.2 0 0 1 4 7.2h12a1.2 1.2 0 0 1 1.2 1.2v4.4A1.2 1.2 0 0 1 16 14h-1.6" />
      <path d="M5.6 11.2h8.8v5.6H5.6Z" />
    </>
  ),
  send: () => <path d="M17 3 8.6 11.4M17 3l-5.2 14-3.2-5.6L3 8.2Z" />,
  share: () => (
    <>
      <circle cx="14.6" cy="5" r="2" />
      <circle cx="5.4" cy="10" r="2" />
      <circle cx="14.6" cy="15" r="2" />
      <path d="m7.2 9 5.6-3M7.2 11l5.6 3" />
    </>
  ),
  external: () => <path d="M11.6 3.6h4.8v4.8M16.4 3.6 9.2 10.8M14.4 11.6v3.6a1.2 1.2 0 0 1-1.2 1.2H4.8a1.2 1.2 0 0 1-1.2-1.2V6.8a1.2 1.2 0 0 1 1.2-1.2h3.6" />,
  link: () => (
    <>
      <path d="M8.6 11.4a3.2 3.2 0 0 0 4.6 0l2.6-2.6a3.2 3.2 0 0 0-4.6-4.6l-.8.8" />
      <path d="M11.4 8.6a3.2 3.2 0 0 0-4.6 0l-2.6 2.6a3.2 3.2 0 0 0 4.6 4.6l.8-.8" />
    </>
  ),
  refresh: () => (
    <>
      <path d="M15.8 8.4A6 6 0 0 0 4.6 7" />
      <path d="M4.2 11.6A6 6 0 0 0 15.4 13" />
      <path d="M16 3.8v4.6h-4.6M4 16.2v-4.6h4.6" />
    </>
  ),
  replay: () => (
    <>
      <path d="M4.2 8.2A6 6 0 1 1 4 11.5" />
      <path d="M3.6 4.4v3.9h3.9" />
    </>
  ),
  reset: () => (
    <>
      <path d="M3.6 10a6.4 6.4 0 1 0 1.9-4.5L3.6 7.4" />
      <path d="M3.6 3.6v3.8h3.8" />
    </>
  ),

  /* ---------------------------------------------------------------- navigation */
  chevronDown: () => <path d="m5.4 7.8 4.6 4.6 4.6-4.6" />,
  chevronUp: () => <path d="m5.4 12.2 4.6-4.6 4.6 4.6" />,
  chevronLeft: () => <path d="M12.2 5.4 7.6 10l4.6 4.6" />,
  chevronRight: () => <path d="m7.8 5.4 4.6 4.6-4.6 4.6" />,
  arrowRight: () => <path d="M4 10h11.5M11 5.5 15.5 10 11 14.5" />,
  arrowLeft: () => <path d="M16 10H4.5M9 5.5 4.5 10 9 14.5" />,
  arrowUpRight: () => <path d="M6 14 14 6M7.4 6H14v6.6" />,
  home: () => <path d="M3.2 9.2 10 3.6l6.8 5.6M5 7.8v8.6h3.8v-4.4h2.4v4.4H15V7.8" />,
  fullscreen: () => <path d="M3.6 7.6v-4h4M12.4 3.6h4v4M16.4 12.4v4h-4M7.6 16.4h-4v-4" />,
  layers: () => (
    <>
      <path d="M10 3 17 6.8 10 10.6 3 6.8Z" />
      <path d="m3 10.4 7 3.8 7-3.8" />
    </>
  ),

  /* ---------------------------------------------------------------- status / feedback */
  info: () => (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 9v4.6" />
      {dot(10, 6.5, 0.8)}
    </>
  ),
  help: () => (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M7.9 7.8a2.2 2.2 0 0 1 4.2.8c0 1.6-2.1 1.9-2.1 3.2" />
      {dot(10, 14.2, 0.8)}
    </>
  ),
  alert: () => (
    <>
      <path d="M8.7 3.6a1.5 1.5 0 0 1 2.6 0l5.9 10.4a1.5 1.5 0 0 1-1.3 2.2H4.1a1.5 1.5 0 0 1-1.3-2.2Z" />
      <path d="M10 8v3.6" />
      {dot(10, 13.8, 0.8)}
    </>
  ),
  checkCircle: () => (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="m7 10.2 2.1 2 4-4.2" />
    </>
  ),
  xCircle: () => (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="m7.6 7.6 4.8 4.8M12.4 7.6l-4.8 4.8" />
    </>
  ),
  bell: () => (
    <>
      <path d="M5 13.6V9a5 5 0 0 1 10 0v4.6l1.4 1.6H3.6Z" />
      <path d="M8.2 17.2a1.9 1.9 0 0 0 3.6 0" />
    </>
  ),
  shield: () => (
    <>
      <path d="M10 2.8 16 5v4.6c0 3.6-2.6 6.4-6 7.6-3.4-1.2-6-4-6-7.6V5Z" />
      <path d="m7.4 10 1.8 1.8 3.4-3.6" />
    </>
  ),
  lock: () => (
    <>
      <rect x="4.2" y="8.6" width="11.6" height="8.4" rx="1.6" />
      <path d="M6.8 8.6V6.4a3.2 3.2 0 0 1 6.4 0v2.2" />
    </>
  ),
  eye: () => (
    <>
      <path d="M2.4 10S5.2 4.6 10 4.6 17.6 10 17.6 10 14.8 15.4 10 15.4 2.4 10 2.4 10Z" />
      <circle cx="10" cy="10" r="2.4" />
    </>
  ),
  star: () => <path d="m10 3 2.1 4.4 4.8.6-3.5 3.3.9 4.7L10 13.7 5.7 16l.9-4.7L3.1 8l4.8-.6Z" />,
  flag: () => <path d="M4.6 17.2V3.4M4.6 3.8h9.6l-1.8 3.4 1.8 3.4H4.6" />,
  spark: () => (
    <>
      <path d="M9 3c.5 3.3 1.9 4.7 5.2 5.2C10.9 8.7 9.5 10.1 9 13.4 8.5 10.1 7.1 8.7 3.8 8.2 7.1 7.7 8.5 6.3 9 3Z" />
      <path d="M14.6 12.2c.25 1.6.9 2.25 2.5 2.5-1.6.25-2.25.9-2.5 2.5-.25-1.6-.9-2.25-2.5-2.5 1.6-.25 2.25-.9 2.5-2.5Z" />
    </>
  ),
  pulse: () => <path d="M2.5 10.5h3l2-5 3.5 9 2-4h4.5" />,
  live: () => (
    <>
      {dot(10, 10, 1.6)}
      <path d="M6.6 6.6a4.8 4.8 0 0 0 0 6.8M13.4 6.6a4.8 4.8 0 0 1 0 6.8" />
      <path d="M4.2 4.2a8.2 8.2 0 0 0 0 11.6M15.8 4.2a8.2 8.2 0 0 1 0 11.6" />
    </>
  ),

  /* ---------------------------------------------------------------- objects */
  inbox: () => (
    <>
      <path d="M3.5 11.5 5.6 4.8A1.6 1.6 0 0 1 7.1 3.7h5.8a1.6 1.6 0 0 1 1.5 1.1l2.1 6.7" />
      <path d="M3.5 11.5V15a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-3.5h-4l-1 2h-3l-1-2h-4Z" />
    </>
  ),
  chat: () => (
    <>
      <path d="M4 4.5h12a1 1 0 0 1 1 1v7.5a1 1 0 0 1-1 1H9l-3.6 2.8V14H4a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1Z" />
      <path d="M6.5 8.3h7M6.5 11h4.5" />
    </>
  ),
  doc: () => (
    <>
      <path d="M5.5 2.8h6l3.5 3.5v10a1 1 0 0 1-1 1h-8.5a1 1 0 0 1-1-1V3.8a1 1 0 0 1 1-1Z" />
      <path d="M11.3 2.8v3.7H15M7.3 10h5.4M7.3 13h4" />
    </>
  ),
  folder: () => <path d="M2.8 5.4a1.2 1.2 0 0 1 1.2-1.2h3.6l1.6 1.8H16a1.2 1.2 0 0 1 1.2 1.2v8.4a1.2 1.2 0 0 1-1.2 1.2H4a1.2 1.2 0 0 1-1.2-1.2Z" />,
  stamp: () => (
    <>
      <path d="M8 3.5h4a1 1 0 0 1 1 1v1.2c0 1.2-1.5 2-1.5 3.6V10h3a1.5 1.5 0 0 1 1.5 1.5V13h-12v-1.5A1.5 1.5 0 0 1 5.5 10h3v-.7C8.5 7.7 7 6.9 7 5.7V4.5a1 1 0 0 1 1-1Z" />
      <path d="M4.5 16.5h11" />
    </>
  ),
  calendar: () => (
    <>
      <rect x="3.2" y="4.4" width="13.6" height="12.4" rx="1.6" />
      <path d="M3.2 8.4h13.6M7 2.8v3M13 2.8v3" />
    </>
  ),
  clock: () => (
    <>
      <circle cx="10" cy="10" r="6.8" />
      <path d="M10 6.4V10l2.4 1.6" />
    </>
  ),
  user: () => (
    <>
      <circle cx="10" cy="7" r="3.2" />
      <path d="M3.8 16.8a6.2 6.2 0 0 1 12.4 0" />
    </>
  ),
  users: () => (
    <>
      <circle cx="7.6" cy="7.4" r="2.8" />
      <path d="M2.6 16.4a5 5 0 0 1 10 0" />
      <path d="M12.6 4.8a2.8 2.8 0 0 1 0 5.2M14.4 12.2a5 5 0 0 1 3 4.2" />
    </>
  ),
  building: () => (
    <>
      <path d="M3.6 16.8V5.2L10 3l6.4 2.2v11.6" />
      <path d="M2.4 16.8h15.2M7 8h1.4M11.6 8H13M7 11h1.4M11.6 11H13M8.6 16.8v-3h2.8v3" />
    </>
  ),
  pin: () => (
    <>
      <path d="M10 17.4s-5.6-5-5.6-9.2a5.6 5.6 0 0 1 11.2 0c0 4.2-5.6 9.2-5.6 9.2Z" />
      <circle cx="10" cy="8.2" r="2" />
    </>
  ),
  map: () => (
    <>
      <path d="m3 5.2 4.6-1.7 4.8 1.7L17 3.8v11l-4.6 1.7-4.8-1.7L3 16.2Z" />
      <path d="M7.6 3.5v11M12.4 5.2v11.3" />
    </>
  ),
  globe: () => (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M3 10h14M10 3c2 2 2.8 4.4 2.8 7S12 15 10 17c-2-2-2.8-4.4-2.8-7S8 5 10 3Z" />
    </>
  ),
  phone: () => (
    <>
      <rect x="5.6" y="2.6" width="8.8" height="14.8" rx="1.8" />
      <path d="M8.8 14.6h2.4" />
    </>
  ),
  call: () => <path d="M6.8 3.4 4.6 3.6A1.6 1.6 0 0 0 3.2 5.4c.6 6 5.4 10.8 11.4 11.4a1.6 1.6 0 0 0 1.8-1.4l.2-2.2-3.4-1.4-1.6 1.6a8.6 8.6 0 0 1-4.6-4.6l1.6-1.6Z" />,
  mic: () => (
    <>
      <rect x="7.4" y="2.8" width="5.2" height="9" rx="2.6" />
      <path d="M4.6 9.6a5.4 5.4 0 0 0 10.8 0M10 15v2.4" />
    </>
  ),
  camera: () => (
    <>
      <path d="M3 7a1.4 1.4 0 0 1 1.4-1.4h2l1.4-2h4.4l1.4 2h2A1.4 1.4 0 0 1 17 7v8a1.4 1.4 0 0 1-1.4 1.4H4.4A1.4 1.4 0 0 1 3 15Z" />
      <circle cx="10" cy="10.8" r="3" />
    </>
  ),
  wallet: () => (
    <>
      <path d="M15.4 6.4V4.6a1.2 1.2 0 0 0-1.2-1.2H4.6a1.6 1.6 0 0 0-1.6 1.6v10.4a1.6 1.6 0 0 0 1.6 1.6h10.8a1.2 1.2 0 0 0 1.2-1.2V7.6a1.2 1.2 0 0 0-1.2-1.2H4.6A1.6 1.6 0 0 1 3 4.8" />
      {dot(13.6, 11.6, 0.9)}
    </>
  ),
  cart: () => (
    <>
      <path d="M2.6 3.4h2.2l1.8 9h8.6l1.6-6.6H5.6" />
      <circle cx="7.6" cy="15.8" r="1.2" />
      <circle cx="14" cy="15.8" r="1.2" />
    </>
  ),
  package: () => (
    <>
      <path d="M10 2.8 16.6 6v8L10 17.2 3.4 14V6Z" />
      <path d="M3.4 6 10 9.2 16.6 6M10 9.2v8M6.8 4.4l6.6 3.2" />
    </>
  ),
  truck: () => (
    <>
      <path d="M2.6 4.8h9.2v8.8H2.6ZM11.8 7.6h3l2.6 2.8v3.2h-5.6" />
      <circle cx="6" cy="14.6" r="1.6" />
      <circle cx="14.4" cy="14.6" r="1.6" />
    </>
  ),
  tag: () => (
    <>
      <path d="M10.8 2.8h5.2a1.2 1.2 0 0 1 1.2 1.2v5.2l-7.6 7.6a1.2 1.2 0 0 1-1.7 0l-4.7-4.7a1.2 1.2 0 0 1 0-1.7Z" />
      {dot(13.8, 6.2, 0.9)}
    </>
  ),
  receipt: () => (
    <>
      <path d="M4.6 2.8h10.8v14.4l-1.8-1.2-1.8 1.2-1.8-1.2-1.8 1.2-1.8-1.2-1.8 1.2Z" />
      <path d="M7.4 6.8h5.2M7.4 9.6h5.2M7.4 12.4h3" />
    </>
  ),
  coins: () => (
    <>
      <ellipse cx="8" cy="5.6" rx="4.6" ry="2" />
      <path d="M3.4 5.6v3.2c0 1.1 2 2 4.6 2s4.6-.9 4.6-2V5.6M3.4 8.8V12c0 1.1 2 2 4.6 2" />
      <ellipse cx="12.6" cy="12.6" rx="4" ry="1.8" />
      <path d="M8.6 12.6v2.6c0 1 1.8 1.8 4 1.8s4-.8 4-1.8v-2.6" />
    </>
  ),
  chart: () => (
    <>
      <path d="M3.5 3.5v13h13" />
      <path d="m6.5 12.5 3-3.5 2.5 2 4-5" />
    </>
  ),
  bars: () => <path d="M3.4 16.6h13.2M5.6 16.6V10M10 16.6V5M14.4 16.6v-8" />,
  trendUp: () => <path d="M3 14.6 8 9.6l3 3 6-6.2M12.4 6.4H17v4.6" />,
  trendDown: () => <path d="M3 5.4 8 10.4l3-3 6 6.2M12.4 13.6H17V9" />,
  grid: () => (
    <>
      <rect x="3.5" y="3.5" width="5.5" height="5.5" rx="1.2" />
      <rect x="11" y="3.5" width="5.5" height="5.5" rx="1.2" />
      <rect x="3.5" y="11" width="5.5" height="5.5" rx="1.2" />
      <rect x="11" y="11" width="5.5" height="5.5" rx="1.2" />
    </>
  ),
  list: () => (
    <>
      <path d="M7.6 5.6h9M7.6 10h9M7.6 14.4h9" />
      {dot(4, 5.6, 0.9)}
      {dot(4, 10, 0.9)}
      {dot(4, 14.4, 0.9)}
    </>
  ),
  kanban: () => (
    <>
      <rect x="2.8" y="3.4" width="4.2" height="13.2" rx="1.2" />
      <rect x="7.9" y="3.4" width="4.2" height="9" rx="1.2" />
      <rect x="13" y="3.4" width="4.2" height="11" rx="1.2" />
    </>
  ),
  rowsCompact: () => <path d="M3.5 5h13M3.5 8.3h13M3.5 11.7h13M3.5 15h13" />,
  rowsComfy: () => <path d="M3.5 6h13M3.5 10h13M3.5 14h13" />,
  settings: () => (
    <>
      <path d="M3.4 6h7.2M14.2 6h2.4M3.4 14h2.4M9.4 14h7.2" />
      <circle cx="12.4" cy="6" r="1.8" />
      <circle cx="7.6" cy="14" r="1.8" />
    </>
  ),
  play: () => <path d="M6.4 4.4v11.2l9-5.6Z" />,
  pause: () => <path d="M7 4.6v10.8M13 4.6v10.8" />,
  forward: () => <path d="M3.6 5.2v9.6l6-4.8ZM10.4 5.2v9.6l6-4.8Z" />,
  zap: () => <path d="M11 2.8 4.4 11.2H10l-1 6 6.6-8.4H10Z" />,
  wifi: () => (
    <>
      <path d="M2.8 7.6a10.4 10.4 0 0 1 14.4 0M5.2 10.4a6.8 6.8 0 0 1 9.6 0M7.6 13.2a3.2 3.2 0 0 1 4.8 0" />
      {dot(10, 15.8, 0.9)}
    </>
  ),
  signal: () => <path d="M4 15.4v-2M7.4 15.4v-4.4M10.8 15.4V8.6M14.2 15.4V6" />,
  battery: () => (
    <>
      <rect x="2.6" y="6.2" width="13" height="7.6" rx="1.8" />
      <path d="M17.4 8.8v2.4" />
      <rect x="4.4" y="8" width="8" height="4" rx="0.8" fill="currentColor" stroke="none" />
    </>
  ),
  water: () => <path d="M10 3s-5 5.6-5 9a5 5 0 0 0 10 0c0-3.4-5-9-5-9Z" />,
  rain: () => (
    <>
      <path d="M5.6 11a3.4 3.4 0 0 1 .5-6.8 4.6 4.6 0 0 1 8.8 1.2 2.8 2.8 0 0 1-.4 5.6" />
      <path d="m7.2 13.4-.8 2.4M10.4 12.6l-1.2 3.6M13.6 13.4l-.8 2.4" />
    </>
  ),
  sun: () => (
    <>
      <circle cx="10" cy="10" r="3.2" />
      <path d="M10 2.8v1.6M10 15.6v1.6M2.8 10h1.6M15.6 10h1.6M4.9 4.9 6 6M14 14l1.1 1.1M4.9 15.1 6 14M14 6l1.1-1.1" />
    </>
  ),
  moon: () => <path d="M15.6 12.4A6.4 6.4 0 0 1 7.6 4.4a6.4 6.4 0 1 0 8 8Z" />,
  language: () => (
    <>
      <path d="M2.8 4.6h7.6M6.6 3v1.6M4.4 4.6c.6 2.6 2.4 4.6 4.8 5.6M8.8 4.6c-.6 2.6-2.4 4.6-4.8 5.6" />
      <path d="m10.4 17 3-7.2 3 7.2M11.4 14.6h4" />
    </>
  ),
  dot: () => dot(10, 10, 2.2),
} satisfies Record<string, Glyph>

export type IconName = keyof typeof G

/** Every icon key, for the icon sheet and tests. */
export const ICON_NAMES = Object.keys(G) as IconName[]

export function isIconName(s: string): s is IconName {
  return Object.prototype.hasOwnProperty.call(G, s)
}

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  /** icon key; product keys come straight from PRODUCTS[slug].icon (unknown keys render a dot) */
  name: IconName | (string & {})
  /** px, default 20 */
  size?: number
  /** accessible name → role="img"; omit for decorative icons */
  title?: string
}

/** Memoised: a list re-render (new row, drawer open) does not rebuild every glyph. */
export const Icon = memo(function Icon({ name, size = 20, title, className, strokeWidth = 1.5, ...rest }: IconProps) {
  const glyph = isIconName(name) ? G[name] : G.dot
  const a11y = title ? { role: 'img' as const, 'aria-label': title } : { 'aria-hidden': true as const }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      className={className ? `dk-icon ${className}` : 'dk-icon'}
      {...a11y}
      {...rest}
    >
      {title && <title>{title}</title>}
      {glyph()}
    </svg>
  )
})
