/**
 * demos/_placeholder — tahap-1 canvas for every /demo/:slug that is not DEMO_READY yet: an honest "Demo <name>
 * sedang dibangun — hadir di tahap N" hero, then the "Yang akan bisa Anda coba" preview panel (owner decision
 * 2026-11-17): the roles the demo will offer (the session role from ?role= marked current), what the world clock
 * will do (and the time the link asked for, ?t=), the AI mode (Simulasi now, Live later), the product's tour
 * chapters and its planned build stage. Everything comes from the real registries (products.ts, tour.ts,
 * demos/registry.ts). No simulated controls: the only interactive elements are real links, and the shell runs
 * `interim` (routes/Demo.tsx) so its bar shows no role / clock / AI / reset control this page would ignore. When
 * the product flips DEMO_READY, its sandbox replaces this canvas and the full bar comes back by itself.
 */
import { PRODUCT_BY_SLUG, PRODUCTS, ECOSYSTEMS, ROLES, fullName, type EcoOrInti } from '../../content/products'
import { TOUR, chapterByNumber } from '../../content/tour'
import { useEcoI18n } from '../../content/i18n/useEco'
import AppLink from '../../components/AppLink'
import { DuskArt, Icon } from '../../demo-kit/ui'
import { CLOCK, WORLD, formatTime, useClock, useSession } from '../../demo-kit/world'
import { useShellOptional } from '../../demo-kit/shell/context'
import { REGIONS } from '../../demo-kit/region/loader'
import { roleInitials } from '../../demo-kit/i18n'
import { DEMO_READY, DEMO_STAGE, type DemoCanvasProps } from '../registry'
import { PREVIEW, proseTime } from './strings'
import './placeholder.css'

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m))
const short = (eco: EcoOrInti) => ECOSYSTEMS[eco].name.replace(/^GAMADA\s+/, '')

/** Build stages of the ecosystem demos (spec §16): 2–4 hold the product demos, 5 the cinematic tour. */
const STAGES = [2, 3, 4] as const
const stageEcos = (n: number) => (Object.keys(DEMO_STAGE) as EcoOrInti[]).filter((e) => DEMO_STAGE[e] === n)
const stageProducts = (n: number) => PRODUCTS.filter((p) => DEMO_STAGE[p.eco] === n)

export default function PlaceholderCanvas({ product }: DemoCanvasProps) {
  const { lang, eco: copy } = useEcoI18n()
  const s = copy.demo
  const c = copy.common
  const v = PREVIEW[lang]
  const p = PRODUCT_BY_SLUG[product]
  const eco = ECOSYSTEMS[p.eco]
  const stage = DEMO_STAGE[p.eco]
  const titleId = `dk-ph-title-${p.slug}`
  const shell = useShellOptional()
  const link = shell?.link ?? {}
  const { role: sessionRole, aiMode, regionId } = useSession()
  // the interim shell loads no pack: the region name comes from the static registry
  const region = shell?.pack?.shortName ?? REGIONS.find((r) => r.id === regionId)?.shortName ?? TOUR.regionName
  const current = p.roles.includes(sessionRole) ? sessionRole : p.defaultRole
  const roleName = (r: typeof current) => ROLES[r].name[lang]
  const { minutes } = useClock()
  const now = formatTime(minutes)
  const linkTime = link.t != null ? formatTime(link.t) : null
  const jumps = CLOCK.jumps.map((j) => proseTime(j, lang)).join(', ')
  const peers = stageProducts(stage)
  const readyCount = peers.filter((x) => DEMO_READY[x.slug]).length

  return (
    <section className="dk-ph" data-eco={p.eco} aria-labelledby={titleId}>
      <div className="dk-ph-hero">
        <div className="dk-ph-art" aria-hidden="true">
          <DuskArt kind={p.map ? 'map' : 'chart'} />
        </div>
        <div className="dk-ph-copy">
          <p className="dk-ph-kicker">
            <span className="dk-ph-glyph" aria-hidden="true">
              <Icon name={p.icon} size={18} />
            </span>
            {eco.name} · {fill(c.stageShort, { n: stage })}
          </p>
          <h2 className="dk-ph-title" id={titleId}>
            {fill(s.building, { name: p.name })}
          </h2>
          <p className="dk-ph-stage">{fill(s.arrives, { n: stage })}</p>
          <p className="dk-ph-tagline">{p.tagline[lang]}</p>
          <p className="dk-ph-honest">{fill(s.honest, { region })}</p>
          <p className="dk-ph-actions">
            <AppLink className="dk-ph-btn" to={`/produk/${p.slug}`}>
              <Icon name="arrowLeft" size={16} />
              {c.productPage}: {fullName(p, lang)}
            </AppLink>
          </p>
        </div>
      </div>

      {/* ---------------------------------------------------------------- "Yang akan bisa Anda coba" */}
      <section className="dk-ph-try" aria-labelledby={`${titleId}-try`}>
        <header className="dk-ph-try-head">
          <p className="dk-ph-try-kicker">{v.kicker}</p>
          <h2 className="dk-ph-try-title" id={`${titleId}-try`}>
            {v.title}
          </h2>
          <p className="dk-ph-try-lead">{v.lead(stage)}</p>
        </header>

        <div className="dk-ph-try-grid">
          <section className="dk-ph-blk" aria-labelledby={`${titleId}-roles`}>
            <h3 className="dk-ph-h" id={`${titleId}-roles`}>
              <Icon name="users" size={16} />
              {v.rolesTitle}
            </h3>
            <p className="dk-ph-body">{v.rolesBody(p.roles.length)}</p>
            <ul className="dk-ph-chips">
              {p.roles.map((r) => (
                <li key={r} className={r === current ? 'dk-ph-chip is-default' : 'dk-ph-chip'} aria-current={r === current ? 'true' : undefined}>
                  <span className="dk-ph-ini" aria-hidden="true">
                    {roleInitials(r, lang)}
                  </span>
                  {roleName(r)}
                  {r === current && <span className="dk-sr"> ({v.roleCurrent})</span>}
                </li>
              ))}
            </ul>
            <p className="dk-ph-note">
              {link.role ? v.roleFromLink(roleName(current)) : v.roleDefault(roleName(current))} {v.roleLater}
            </p>
          </section>

          <section className="dk-ph-blk" aria-labelledby={`${titleId}-clock`}>
            <h3 className="dk-ph-h" id={`${titleId}-clock`}>
              <Icon name="clock" size={16} />
              {v.clockTitle}
            </h3>
            <p className="dk-ph-readout">
              <span className="dk-ph-digits" aria-hidden="true">
                {now}
              </span>
              <span className="dk-ph-tz" aria-hidden="true">
                WIB
              </span>
              <span className="dk-sr">{v.clockReadout(now)}</span>
            </p>
            <p className="dk-ph-note is-strong">
              {linkTime ? v.clockFromLink(proseTime(linkTime, lang)) : v.clockDefault(proseTime(formatTime(WORLD.clockStart), lang))} {v.clockStill}
            </p>
            <p className="dk-ph-body">{v.clockBody(region)}</p>
            <p className="dk-ph-meta">{v.clockJumps(jumps)}</p>
          </section>

          <section className="dk-ph-blk" aria-labelledby={`${titleId}-ai`}>
            <h3 className="dk-ph-h" id={`${titleId}-ai`}>
              <Icon name="spark" size={16} />
              {v.aiTitle}
            </h3>
            <dl className="dk-ph-modes">
              <div className="dk-ph-mode is-now">
                <dt>
                  <span className="dk-ph-dot" aria-hidden="true" />
                  {v.aiSim} <span className="dk-ph-when">· {v.aiSimWhen}</span>
                </dt>
                <dd>{v.aiSimBody}</dd>
              </div>
              <div className="dk-ph-mode">
                <dt>
                  <span className="dk-ph-dot" aria-hidden="true" />
                  {v.aiLive} <span className="dk-ph-when">· {v.aiLiveWhen}</span>
                </dt>
                <dd>{v.aiLiveBody}</dd>
              </div>
            </dl>
            {(link.ai === 'live' || aiMode === 'live') && <p className="dk-ph-note">{v.aiFromLink}</p>}
          </section>
        </div>

        <div className="dk-ph-try-grid is-two">
          <section className="dk-ph-blk" aria-labelledby={`${titleId}-tour`}>
            <h3 className="dk-ph-h" id={`${titleId}-tour`}>
              <Icon name="play" size={16} />
              {v.tourTitle(TOUR.regionName)}
            </h3>
            <ul className="dk-ph-links">
              {p.chapters.map((n) => {
                const ch = chapterByNumber(n)
                if (!ch) return null
                return (
                  <li key={n}>
                    <AppLink to={`/tur/${n}`} className="dk-ph-link">
                      <span className="dk-ph-time">{ch.time ?? '—'}</span>
                      <span>
                        <span className="dk-ph-link-k">{fill(c.chapter, { n })}</span>
                        {ch.title[lang]}
                      </span>
                    </AppLink>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="dk-ph-blk" aria-labelledby={`${titleId}-status`}>
            <h3 className="dk-ph-h" id={`${titleId}-status`}>
              <Icon name="layers" size={16} />
              {v.statusTitle}
            </h3>
            <p className="dk-ph-pill">
              <span className="dk-ph-dot" aria-hidden="true" />
              {v.statusPill(stage)}
            </p>
            <ol className="dk-ph-stages">
              {STAGES.map((n) => (
                <li key={n} className={n === stage ? 'dk-ph-st is-this' : 'dk-ph-st'} aria-current={n === stage ? 'step' : undefined}>
                  <span className="dk-ph-st-n">{v.stage(n)}</span>
                  <span className="dk-ph-st-name">
                    {stageEcos(n).map(short).join(' + ')}
                    <span className="dk-ph-st-k">
                      {' · '}
                      {v.stageDemos(stageProducts(n).length)}
                    </span>
                  </span>
                  {n === stage && <span className="dk-ph-st-tag">{v.thisDemo}</span>}
                </li>
              ))}
              <li className="dk-ph-st">
                <span className="dk-ph-st-n">{v.stage(5)}</span>
                <span className="dk-ph-st-name">{v.stageTour}</span>
              </li>
            </ol>
            <p className="dk-ph-meta">{v.ready(readyCount, peers.length)}</p>
          </section>
        </div>
      </section>

      <div className="dk-ph-grid">
        <section className="dk-ph-card" aria-labelledby={`${titleId}-feat`}>
          <h3 className="dk-ph-h" id={`${titleId}-feat`}>
            <Icon name="grid" size={16} />
            {s.featuresTitle}
          </h3>
          <ul className="dk-ph-list">
            <li>
              <Icon name="grid" size={16} />
              {c.frames[p.frame]}
            </li>
            {p.map ? (
              <li>
                <Icon name="map" size={16} />
                {c.map}
              </li>
            ) : null}
            {p.chat ? (
              <li>
                <Icon name="chat" size={16} />
                {c.chat}
              </li>
            ) : null}
          </ul>
        </section>

        <section className="dk-ph-card" aria-labelledby={`${titleId}-rel`}>
          <h3 className="dk-ph-h" id={`${titleId}-rel`}>
            <Icon name="layers" size={16} />
            {s.relatedTitle}
          </h3>
          <ul className="dk-ph-links">
            {p.related.map((slug) => {
              const r = PRODUCT_BY_SLUG[slug]
              return (
                <li key={slug} data-eco={r.eco}>
                  <AppLink to={`/demo/${slug}`} className="dk-ph-link">
                    <span className="dk-ph-rel-ic">
                      <Icon name={r.icon} size={16} />
                    </span>
                    <span>
                      <span className="dk-ph-link-k">{r.name}</span>
                      {r.descriptor[lang]}
                    </span>
                  </AppLink>
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </section>
  )
}
