/**
 * Berbagi.tsx (lazy) — "Berbagi data": the ConsentCard (grant ⇒ `consent.granted`) and the shop's consents (what, to
 * whom, until when, used by which application) with "Cabut akses" ⇒ `consent.revoked` (applying is then disabled
 * with the reason in Modal kerja). A ?focus=IZ-… arrival flashes the row.
 */
import { useEffect, useRef, useState } from 'react'
import { Button, Icon, StatusChip, flashNewRow } from '../../demo-kit/ui'
import { emit, useWorld, type Consent, type WorldState } from '../../demo-kit/world'
import { CONSENT_SCOPE, consentsOf } from '../../demo-kit/world/pasar-daerah'
import { ConsentCard, SCOPES } from './ConsentCard'
import { dateOf, grant } from './consent'
import { LENDER, SLUG, timeText, uiStore, useUi } from './model'
import { useT } from './strings'

const S = {
  id: {
    title: 'Akses data yang Anda berikan',
    empty: 'Belum ada akses data yang dibagikan.',
    active: 'Aktif',
    revoked: (t: string) => `Dicabut ${t}`,
    until: (d: string, n: number) => `${n} hari · berlaku s.d. ${d}`,
    usedBy: (codes: string) => `Dipakai untuk pengajuan ${codes}`,
    revoke: 'Cabut akses',
    notShared: 'Tidak dibagikan',
    granted: 'Data dibagikan ke koperasi.',
    revokedSaid: 'Akses data dicabut.',
  },
  en: {
    title: 'Data access you have given',
    empty: 'No data access shared yet.',
    active: 'Active',
    revoked: (t: string) => `Revoked ${t}`,
    until: (d: string, n: number) => `${n} days · valid until ${d}`,
    usedBy: (codes: string) => `Used for application ${codes}`,
    revoke: 'Revoke access',
    notShared: 'Not shared',
    granted: 'Data shared with the cooperative.',
    revokedSaid: 'Data access revoked.',
  },
}

const listSel = (s: WorldState) => consentsOf(s, s.meta.shopId)
const same = (a: Consent[], b: Consent[]) => a.length === b.length && a.every((x, i) => x === b[i])
const usesSel = (s: WorldState) => {
  const out: Record<string, string[]> = {}
  for (const id of s.loanApps.ids) {
    const l = s.loanApps.byId[id]!
    if (l.consentId && l.businessId === s.meta.shopId) (out[l.consentId] ??= []).push(l.id)
  }
  return JSON.stringify(out)
}

export default function Berbagi() {
  const { lang } = useT()
  const L = S[lang]
  const list = useWorld(listSel, same)
  const uses = JSON.parse(useWorld(usesSel)) as Record<string, string[]>
  const shop = useWorld((s) => s.meta.shopId)
  const day = useWorld((s) => s.day)
  const flash = useUi((u) => u.flash)
  const box = useRef<HTMLUListElement>(null)
  const [said, setSaid] = useState('')
  useEffect(() => {
    if (!flash || !flash.startsWith('IZ')) return
    const el = box.current?.querySelector<HTMLElement>(`[data-consent="${flash}"]`)
    if (!el) return
    el.scrollIntoView({ block: 'nearest' })
    flashNewRow(el)
    uiStore.set({ flash: null })
  }, [flash, list.length])
  return (
    <div className="dk-ru-share">
      <ConsentCard
        lender={LENDER}
        lang={lang}
        onGrant={(sc, d) => {
          grant(sc, d, shop)
          setSaid(L.granted)
        }}
      />
      <section className="dk-ru-card" aria-labelledby="dk-ru-share-h">
        <h3 id="dk-ru-share-h">{L.title}</h3>
        {list.length ? (
          <ul className="dk-ru-consents" ref={box}>
            {list.map((c) => (
              <li key={c.id} className="dk-ru-consent-row" data-consent={c.id} data-revoked={c.revokedAt !== null}>
                <div className="dk-ru-consent-h">
                  <strong>{c.lender}</strong>
                  <StatusChip label={c.revokedAt === null ? L.active : L.revoked(timeText(c.revokedAt, lang))} tone={c.revokedAt === null ? 'done' : 'neutral'} />
                </div>
                <ul className="dk-ru-scopechips" aria-label={c.id}>
                  {SCOPES.map((k) => (
                    <li key={k} className={c.scopes.includes(k) ? 'is-on' : 'is-off'}>
                      {c.scopes.includes(k) ? <Icon name="check" size={12} /> : <Icon name="minus" size={12} />} {CONSENT_SCOPE[k][lang]}
                      {!c.scopes.includes(k) && <span className="dk-sr-only"> · {L.notShared}</span>}
                    </li>
                  ))}
                </ul>
                <small className="dk-ru-muted dk-num">
                  {c.id} · {L.until(dateOf(day, c.until, lang), c.days)}
                  {uses[c.id] ? ` · ${L.usedBy(uses[c.id]!.join(', '))}` : ''}
                </small>
                {c.revokedAt === null && (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon="lock"
                    onClick={() => {
                      emit('consent.revoked', { consentId: c.id }, SLUG)
                      setSaid(L.revokedSaid)
                    }}
                    data-ru="revoke"
                  >
                    {L.revoke}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="dk-ru-muted">{L.empty}</p>
        )}
      </section>
      <p className="dk-sr-only" aria-live="polite">
        {said}
      </p>
    </div>
  )
}
