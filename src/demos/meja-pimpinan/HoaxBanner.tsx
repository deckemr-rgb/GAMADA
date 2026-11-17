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
import { useSession, world, type HoaxAlert } from '../../demo-kit/world'
import { findOpd, withControls } from './data'
import type { InstructionPreset } from './index'
import { nf, tr, trf } from './strings'

export function HoaxBanner({ hoax, onClarify }: { hoax: HoaxAlert; onClarify?: (p: InstructionPreset) => void }) {
  const { lang } = useI18n()
  const session = useSession()
  const [hidden, setHidden] = useState<string | null>(null)
  const ref = useRef<HTMLElement>(null)
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
    })
  }
  return (
    <aside ref={ref} className="dk-mp-hoax" role="alert" aria-label={tr('hoaxTitle', lang)}>
      <span className="dk-mp-hoax-ic" aria-hidden="true">
        <Icon name="alert" size={18} />
      </span>
      <div className="dk-mp-hoax-b">
        <p className="dk-mp-hoax-t">
          <strong>{tr('hoaxTitle', lang)}</strong> · “{hoax.claim[lang]}”
        </p>
        <p className="dk-mp-hoax-d">
          {trf('hoaxScore', lang, { p: Math.round(hoax.score * 100), n: hoax.accounts.length, r: nf(lang, hoax.spreadPerHour) })}
          {hoax.evidence ? ` · ${hoax.evidence[lang]}` : ''}
        </p>
      </div>
      <div className="dk-mp-hoax-a">
        {onClarify && (
          <Button size="sm" variant="primary" icon="send" onClick={clarify}>
            {tr('hoaxClarify', lang)}
          </Button>
        )}
        <AppLink className="dk-mp-linkbtn" to={withControls(demoHref('radar-isu', session, hoax.id))}>
          {tr('hoaxOpen', lang)}
          <Icon name="arrowUpRight" size={12} />
        </AppLink>
        <IconButton icon="close" size="sm" label={tr('dismiss', lang)} onClick={() => setHidden(hoax.id)} />
      </div>
    </aside>
  )
}
