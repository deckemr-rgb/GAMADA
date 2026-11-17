/**
 * Briefing — "Briefing Pagi" (spec P2 steps 1–2). The briefing is a WORLD entity (`briefing.generated`), so it is the
 * same whether it was composed here, from "Tanya data" or by the tour. Each numbered card names its source product
 * and links to the entity it is about (`/demo/<source>?focus=<id>`). "Dengarkan briefing" (lazy) reads it aloud and
 * highlights the item being read. New world facts after composition show as "N pembaruan".
 */
import { lazy, Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { PRODUCT_BY_SLUG, type ProductSlug } from '../../content/products'
import AppLink from '../../components/AppLink'
import { demoHref } from '../../demo-kit/shell'
import { Button, Icon, animatePose, motionMode, type IconName } from '../../demo-kit/ui'
import { useSession, useWorld, type Briefing as BriefingT, type Minutes, type WorldState } from '../../demo-kit/world'
import { briefingItems } from '../../demo-kit/world/satu-daerah'
import { MP, refId, withControls } from './data'
import type { InstructionPreset } from './index'
import { nf, tr, trf, type Bi } from './strings'

const BriefingPlayer = lazy(() => import('./BriefingPlayer'))

const whole = (s: WorldState) => s

export interface ShownItem {
  title: Bi
  detail: Bi | null
  source: ProductSlug
  refs: string[]
  focus: string | null
}

export function Briefing({ briefing, now, assembling, fresh, onFreshDone, onCompose, onInstruct, onListened, leader }: {
  briefing: BriefingT | null
  now: Minutes
  assembling: string[] | null
  fresh: boolean
  onFreshDone: () => void
  onCompose: () => void
  onInstruct?: (p: InstructionPreset) => void
  onListened: () => void
  leader: Bi
}) {
  const { lang } = useI18n()
  const session = useSession()
  const [voice, setVoice] = useState(false)
  const [active, setActive] = useState(-1)
  const listRef = useRef<HTMLOListElement>(null)

  // current items (details + "updates since") — briefingItems is a plain function: recompute on world changes
  const current = useWorld(whole)
  const now5 = Math.floor(now / 5) * 5
  const cur = useMemo(() => briefingItems(current, now5), [current, now5])
  const shown: ShownItem[] = useMemo(() => {
    if (!briefing) return []
    return briefing.items.map((it) => {
      const match = cur.find((c) => c.title.id === it.title.id) ?? cur.find((c) => c.source === it.source && c.refs[0] === it.refs[0])
      return { title: it.title, detail: match?.detail ?? null, source: it.source, refs: it.refs, focus: refId(it.refs[0]) }
    })
  }, [briefing, cur])
  const updates = useMemo(() => (briefing ? cur.filter((c) => !briefing.items.some((b) => b.title.id === c.title.id)).length : 0), [briefing, cur])
  const sources = useMemo(() => new Set(shown.map((i) => i.source)).size, [shown])

  // staggered entrance of a freshly composed briefing (transform / opacity only)
  useLayoutEffect(() => {
    const el = listRef.current
    if (!fresh || !el || !briefing) return
    const cards = Array.from(el.children)
    const mode = motionMode()
    if (mode === 'static') return onFreshDone()
    const tw =
      mode === 'reduced'
        ? animatePose(cards, { opacity: 0 }, { opacity: 1 }, { duration: 0.15, onComplete: onFreshDone })
        : animatePose(cards, { y: 14, opacity: 0 }, { y: 0, opacity: 1 }, { duration: 0.42, stagger: MP.cardStagger, ease: 'power3.out', onComplete: onFreshDone })
    return () => tw.kill()
    // only when a new briefing lands
  }, [briefing?.id, fresh])

  const at = briefing ? `${String(Math.floor(briefing.at / 60)).padStart(2, '0')}.${String(briefing.at % 60).padStart(2, '0')}` : ''
  const minutes = Math.max(1, Math.round((shown.reduce((a, i) => a + i.title[lang].split(' ').length + (i.detail?.[lang].split(' ').length ?? 0), 0) / 2.6 + shown.length * 1.4) / 60))
  const href = (it: ShownItem) => withControls(demoHref(it.source, session, it.focus))

  return (
    <section className="dk-mp-panel dk-mp-brief" aria-labelledby="dk-mp-brief-h">
      <header className="dk-mp-ph">
        <h3 id="dk-mp-brief-h">
          <Icon name="doc" size={16} />
          {tr('briefing', lang)}
        </h3>
        {briefing && !assembling && (
          <Button size="sm" variant={voice ? 'secondary' : 'ghost'} icon={voice ? 'close' : 'play'} onClick={() => setVoice((v) => !v)} aria-pressed={voice} data-mp="listen">
            {voice ? tr('stopListen', lang) : `${tr('listen', lang)} · ${trf('listenLen', lang, { m: minutes })}`}
          </Button>
        )}
      </header>
      {briefing && !assembling && (
        <p className="dk-mp-meta">
          {trf('composedAt', lang, { t: at, n: shown.length, p: sources })}
          {updates > 0 && (
            <button type="button" className="dk-mp-upd" onClick={onCompose}>
              <Icon name="refresh" size={12} />
              {updates === 1 ? tr('update1', lang) : trf('updates', lang, { n: updates })}
            </button>
          )}
        </p>
      )}
      {voice && briefing && (
        <Suspense fallback={<p className="dk-mp-meta">{tr('loadingPlayer', lang)}</p>}>
          <BriefingPlayer items={shown} at={at} leader={leader[lang]} onActive={setActive} onListened={onListened} onEnd={() => { setVoice(false); setActive(-1) }} />
        </Suspense>
      )}
      <div className="dk-mp-pb">
        {assembling ? (
          <Assembling sources={assembling} />
        ) : !briefing ? (
          <div className="dk-mp-empty">
            <p className="dk-mp-empty-t">{tr('briefingEmpty', lang)}</p>
            <p className="dk-mp-empty-b">{tr('briefingEmptyBody', lang)}</p>
            <ul className="dk-mp-srcs" aria-hidden="true">
              {(['sapa-warga', 'siaga-wilayah', 'radar-isu', 'awas-belanja', 'sinyal-pasar', 'naskah-pintar'] as const).map((p) => (
                <li key={p}>
                  <Icon name={PRODUCT_BY_SLUG[p].icon as IconName} size={14} />
                  {PRODUCT_BY_SLUG[p].name}
                </li>
              ))}
            </ul>
            {onInstruct && (
              <Button variant="primary" icon="spark" onClick={onCompose}>
                {tr('compose', lang)}
              </Button>
            )}
          </div>
        ) : (
          <ol ref={listRef} className="dk-mp-items" aria-live="polite">
            {shown.map((it, i) => (
              <li key={`${briefing.id}-${i}`} className={`dk-mp-item${i === active ? ' is-reading' : ''}`} aria-current={i === active ? 'true' : undefined} data-source={it.source}>
                <span className="dk-mp-num dk-num" aria-hidden="true">
                  {i + 1}
                </span>
                <div className="dk-mp-item-b">
                  <p className="dk-mp-item-t">{it.title[lang]}</p>
                  {it.detail && <p className="dk-mp-item-d">{it.detail[lang]}</p>}
                  <p className="dk-mp-item-f">
                    <AppLink to={href(it)} className="dk-mp-src" aria-label={trf('openIn', lang, { p: PRODUCT_BY_SLUG[it.source].name })}>
                      <Icon name={PRODUCT_BY_SLUG[it.source].icon as IconName} size={13} />
                      {PRODUCT_BY_SLUG[it.source].name}
                      <Icon name="arrowUpRight" size={12} />
                    </AppLink>
                    {onInstruct && (
                      <button type="button" className="dk-mp-itemact" onClick={() => onInstruct({ item: { title: it.title, source: it.source, refs: it.refs } })} aria-label={trf('itemInstructAria', lang, { n: i + 1 })}>
                        <Icon name="send" size={12} />
                        {tr('itemInstruct', lang)}
                      </button>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}

function Assembling({ sources }: { sources: string[] }) {
  const { lang } = useI18n()
  return (
    <div className="dk-mp-asm" role="status">
      <p className="dk-mp-asm-t">{trf('assembling', lang, { n: nf(lang, sources.length) })}</p>
      <ul>
        {sources.map((p, i) => {
          const def = PRODUCT_BY_SLUG[p as ProductSlug]
          return (
            <li key={p} style={{ ['--i' as string]: i }}>
              <Icon name={def.icon as IconName} size={14} />
              <span>{def.name}</span>
              <span className="dk-mp-asm-ok" aria-hidden="true">
                <Icon name="check" size={14} />
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
