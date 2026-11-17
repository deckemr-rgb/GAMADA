/**
 * Events — "Kejadian hari ini": today's world events worth a leader's attention, newest first, from the shared
 * audit log (the same trail GAMADA Inti shows). New rows slide in and are announced politely.
 */
import { useI18n } from '../../lib/i18n'
import { Icon, Timeline } from '../../demo-kit/ui'
import { hhmm, useWorld } from '../../demo-kit/world'
import { productName, todayEvents } from './data'
import { tr } from './strings'

export function Events() {
  const { lang } = useI18n()
  const list = useWorld(todayEvents)
  return (
    <section className="dk-mp-panel dk-mp-ev" aria-labelledby="dk-mp-ev-h">
      <header className="dk-mp-ph">
        <h3 id="dk-mp-ev-h">
          <Icon name="pulse" size={16} />
          {tr('events', lang)}
        </h3>
      </header>
      <div className="dk-mp-pb">
        {list.length ? (
          <Timeline
            live
            label={tr('events', lang)}
            items={list.map((e) => ({ id: e.id, time: hhmm(e.at), title: e.title[lang], tone: e.tone, icon: e.icon, ...(e.product ? { source: productName(e.product) } : {}) }))}
          />
        ) : (
          <p className="dk-mp-meta">{tr('eventsEmpty', lang)}</p>
        )}
      </div>
    </section>
  )
}
