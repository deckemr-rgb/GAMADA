/**
 * HoaxBanner — Meja Pimpinan's own in-canvas alert when Radar Isu detects a hoax (`hoax.detected`, e.g. the 10:00
 * rumor burst): the claim, score and spread, with "Instruksikan klarifikasi" (pre-filled for the communications
 * office) and a link to the hoax in Radar Isu. Dismissing hides this hoax only; a new one shows again.
 */
import { useLayoutEffect, useRef, useState } from 'react'
import { useI18n } from '../../lib/i18n'
import AppLink from '../../components/AppLink'
import { demoHref } from '../../demo-kit/shell'
import { Icon, IconButton, Button, enterPanel } from '../../demo-kit/ui'
import { useSession, useWorld, world, type HoaxAlert } from '../../demo-kit/world'
import { clarificationFor, hhmm, opdShort, withControls } from './data'
import { findOpd } from './data-ext'
import type { InstructionPreset } from './index'
import { tr, trf } from './strings'

export function HoaxBanner({ hoax, onClarify, overlay }: { hoax: HoaxAlert; onClarify?: (p: InstructionPreset) => void; overlay?: boolean }) {
  const { lang } = useI18n()
  const session = useSession()
  const [hidden, setHidden] = useState<string | null>(null)
  const ref = useRef<HTMLElement>(null)
  // the leader already ordered a clarification: the banner says so (amber) instead of offering the same order again
  const done = useWorld((s) => {
    const c = clarificationFor(s, hoax.id)
    if (!c) return ''
    return [hhmm(c.at), c.opdIds.map((o) => opdShort(s, o)).join(', '), (c.letterId && s.letters.byId[c.letterId]?.number) || '', c.letterId ?? ''].join('|')
  })
  const [dAt = '', dTo = '', dNo = '', dLetter = ''] = done ? done.split('|') : []
  // EN: the seeded evidence carries Indonesian decimals ("8,6 m"): write them the English way
  const evidence = hoax.evidence ? (lang === 'en' ? hoax.evidence.en.replace(/(\d),(\d+)(?=\s?m\b)/g, '$1.$2') : hoax.evidence.id) : ''
  useLayoutEffect(() => {
    if (!ref.current || hidden === hoax.id) return
    const tw = enterPanel(ref.current, { y: -8 })
    return () => tw?.kill()
  }, [hoax.id, hidden])
  if (hidden === hoax.id) return null
  const clarify = () => {
    const s = world.get()
    const kominfo = findOpd(s, 'kominfo')
    onClarify?.({
      text: { id: `Terbitkan klarifikasi resmi hari ini juga: "${hoax.claim.id}" tidak benar`, en: `Publish an official clarification today: "${hoax.claim.en}" is false` },
      opdIds: kominfo ? [kominfo, ...(findOpd(s, 'bpbd') ? [findOpd(s, 'bpbd')!] : [])] : [],
      refs: [`hoaxAlerts:${hoax.id}`],
      due: 'today',
    })
  }
  return (
    <aside ref={ref} className={`dk-mp-hoax${overlay ? ' is-overlay' : ''}${done ? ' is-handled' : ''}`} role={done ? 'status' : 'alert'} aria-label={done ? tr('hoaxHandled', lang) : tr('hoaxTitle', lang)}>
      <span className="dk-mp-hoax-ic" aria-hidden="true">
        <Icon name={done ? 'checkCircle' : 'alert'} size={18} />
      </span>
      <div className="dk-mp-hoax-b">
        <p className="dk-mp-hoax-t">
          <strong>{done ? tr('hoaxHandled', lang) : tr('hoaxTitle', lang)}</strong> · “{hoax.claim[lang]}”
        </p>
        <p className="dk-mp-hoax-d">
          {done
            ? trf(dNo ? 'hoaxHandledD' : 'hoaxHandledD0', lang, { t: lang === 'en' ? dAt.replace('.', ':') : dAt, o: dTo, n: dNo })
            : trf('hoaxScore', lang, { p: Math.round(hoax.score * 100), n: hoax.accounts.length, r: hoax.spreadPerHour.toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB', { notation: 'compact', maximumFractionDigits: 0 }) })}
          {!done && evidence ? ` · ${evidence}` : ''}
        </p>
      </div>
      <div className="dk-mp-hoax-a">
        {done && dLetter ? (
          <AppLink className="dk-mp-linkbtn" to={withControls(demoHref('naskah-pintar', session, dLetter))}>
            {tr('hoaxSeeNote', lang)}
            <Icon name="arrowUpRight" size={12} />
          </AppLink>
        ) : (
          !done &&
          onClarify && (
            <Button size="sm" variant="primary" icon="send" onClick={clarify}>
              {tr('hoaxClarify', lang)}
            </Button>
          )
        )}
        <AppLink className="dk-mp-linkbtn" to={withControls(demoHref('radar-isu', session, hoax.id))}>
          {tr('hoaxOpen', lang)}
          <Icon name="arrowUpRight" size={12} />
        </AppLink>
      </div>
      <span className="dk-mp-hoax-x">
        <IconButton icon="close" size="sm" label={tr('dismiss', lang)} onClick={() => setHidden(hoax.id)} />
      </span>
    </aside>
  )
}
