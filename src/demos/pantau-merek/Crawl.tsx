/**
 * demos/pantau-merek/Crawl.tsx — the scan line (aria-hidden): the last scan minute and how many mentions arrived in
 * the last hour, both derived from the world minute (no motion without a world change behind it).
 */
import { memo } from 'react'
import { fill, tm, type Lang, type Strings } from './strings'

export const Crawl = memo(function Crawl({ now, fresh, running, t, lang }: { now: number; fresh: number; running: boolean; t: Strings; lang: Lang }) {
  return (
    <p className={`dk-pm-crawl${running ? ' is-run' : ''}`} aria-hidden="true">
      <i />
      <span className="dk-num">{fill(t.scanned, { t: tm(now, lang), n: fresh })}</span>
    </p>
  )
})
