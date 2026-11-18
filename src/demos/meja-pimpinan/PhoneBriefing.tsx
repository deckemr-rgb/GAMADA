/**
 * PhoneBriefing (lazy) — "Lihat di HP": the same world briefing as a chat on the leader's phone (spec P2 frame).
 * Item bubbles expand to their detail; quick replies read the briefing aloud, open "Beri instruksi" or compose the
 * briefing when there is none yet.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { PRODUCT_BY_SLUG } from '../../content/products'
import { PhoneFrame } from '../../demo-kit/frames'
import { Icon, Modal, animatePose, motionMode, type IconName } from '../../demo-kit/ui'
import { cancel, speak } from '../../demo-kit/media'
import { hhmm, rows, useClock, useWorld, world, type WorldState } from '../../demo-kit/world'
import { dayPart, mpBriefingItems } from './data'

/** the greeting follows the world time of the briefing (never "Selamat pagi" at 20.00) */
const GREET = { pagi: { id: 'pagi', en: 'morning' }, siang: { id: 'siang', en: 'afternoon' }, sore: { id: 'sore', en: 'afternoon' }, malam: { id: 'malam', en: 'evening' } } as const
import type { Bi } from './strings'

const H = {
  title: { id: 'Briefing di HP pimpinan', en: "Briefing on the leader's phone" },
  desc: { id: 'Briefing yang sama, dikirim sebagai pesan ke HP pimpinan.', en: "The same briefing, sent as messages to the leader's phone." },
  frame: { id: 'Simulasi layar HP pimpinan', en: "Simulated leader's phone screen" },
  name: { id: 'Asisten Pimpinan', en: 'Leadership Assistant' },
  sub: { id: 'akun resmi · briefing otomatis · data simulasi', en: 'official account · automatic briefing · simulated data' },
  hello: { id: 'Selamat {g}, Bapak/Ibu {l}. Briefing pukul {t}: {n} butir dari {p} produk.', en: 'Good {g}, {l}. The {t} briefing: {n} items from {p} products.' },
  tap: { id: 'Ketuk butir untuk rinciannya.', en: 'Tap an item for its detail.' },
  none: { id: 'Briefing hari ini belum disusun.', en: "Today's briefing has not been composed yet." },
  compose: { id: 'Susun sekarang', en: 'Compose now' },
  listen: { id: 'Dengarkan', en: 'Listen' },
  stop: { id: 'Berhenti', en: 'Stop' },
  instruct: { id: 'Beri instruksi', en: 'Issue instruction' },
  replies: { id: 'Balasan cepat', en: 'Quick replies' },
  read: { id: 'dibaca', en: 'read' },
}

const latest = (s: WorldState) => rows(s.briefings).find((b) => b.at >= 0) ?? null

export default function PhoneBriefing({ open, onClose, onCompose, onInstruct, leader }: { open: boolean; onClose: () => void; onCompose?: () => void; onInstruct?: () => void; leader: Bi }) {
  const { lang } = useI18n()
  const now = useClock().minutes
  const b = useWorld(latest)
  const [openItem, setOpenItem] = useState<number | null>(null)
  const [talking, setTalking] = useState(false)
  const listRef = useRef<HTMLOListElement>(null)
  const cur = useMemo(() => mpBriefingItems(world.get(), now), [b, now])
  const detail = (title: Bi) => cur.find((c) => c.title.id === title.id)?.detail[lang] ?? null
  const at = b ? hhmm(b.at).replace(':', '.') : ''
  const sources = b ? new Set(b.items.map((i) => i.source)).size : 0

  useLayoutEffect(() => {
    const el = listRef.current
    if (!el || motionMode() === 'static') return
    const tw = animatePose(Array.from(el.children), { y: 8, opacity: 0 }, { y: 0, opacity: 1 }, { duration: 0.28, stagger: 0.12, ease: 'power2.out' })
    return () => tw.kill()
  }, [b?.id])
  useEffect(() => () => cancel(), [])

  const listen = () => {
    if (!b) return
    if (talking) {
      cancel()
      setTalking(false)
      return
    }
    const text = [H.hello[lang].replace('{g}', GREET[dayPart(b.at)][lang]).replace('{l}', leader[lang]).replace('{t}', at).replace('{n}', String(b.items.length)).replace('{p}', String(sources)), ...b.items.map((it, i) => `${i + 1}. ${it.title[lang]}.`)].join(' ')
    setTalking(true)
    void speak(text, lang === 'id' ? 'id-ID' : 'en-GB').done.then(() => setTalking(false))
  }

  return (
    <Modal open={open} onClose={onClose} title={H.title[lang]} description={H.desc[lang]} size="sm">
      <div className="dk-mp-hp">
        <PhoneFrame label={H.frame[lang]} time={hhmm(now).replace(':', '.')} width={300} tilt={false}>
          <div className="dk-mp-hp-app">
            <div className="dk-mp-hp-bar">
              <span className="dk-mp-hp-av" aria-hidden="true">
                <Icon name="meja" size={16} />
              </span>
              <span>
                <strong>
                  {H.name[lang]} <Icon name="checkCircle" size={12} />
                </strong>
                <small>{H.sub[lang]}</small>
              </span>
            </div>
            <div className="dk-mp-hp-chat" aria-live="polite">
              {b ? (
                <>
                  <p className="dk-mp-hp-msg">
                    {H.hello[lang].replace('{g}', GREET[dayPart(b.at)][lang]).replace('{l}', leader[lang]).replace('{t}', at).replace('{n}', String(b.items.length)).replace('{p}', String(sources))}
                    <small>{H.tap[lang]}</small>
                  </p>
                  <ol ref={listRef} className="dk-mp-hp-items">
                    {b.items.map((it, i) => {
                      const d = detail(it.title)
                      return (
                        <li key={i}>
                          <button type="button" className="dk-mp-hp-msg is-item" aria-expanded={openItem === i} onClick={() => setOpenItem(openItem === i ? null : i)}>
                            <span className="dk-mp-hp-n dk-num">{i + 1}</span>
                            <span>
                              {it.title[lang]}
                              {openItem === i && d && <span className="dk-mp-hp-d">{d}</span>}
                              <small>
                                <Icon name={PRODUCT_BY_SLUG[it.source].icon as IconName} size={11} />
                                {PRODUCT_BY_SLUG[it.source].name}
                              </small>
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ol>
                  <p className="dk-mp-hp-time dk-num">
                    {at} · {H.read[lang]}
                  </p>
                </>
              ) : (
                <p className="dk-mp-hp-msg">{H.none[lang]}</p>
              )}
            </div>
            <div className="dk-mp-hp-replies" role="group" aria-label={H.replies[lang]}>
              {!b && onCompose && (
                <button type="button" onClick={onCompose}>
                  {H.compose[lang]}
                </button>
              )}
              {b && (
                <button type="button" onClick={listen} aria-pressed={talking}>
                  <Icon name={talking ? 'pause' : 'play'} size={12} />
                  {talking ? H.stop[lang] : H.listen[lang]}
                </button>
              )}
              {onInstruct && (
                <button type="button" onClick={onInstruct}>
                  {H.instruct[lang]}
                </button>
              )}
            </div>
          </div>
        </PhoneFrame>
      </div>
    </Modal>
  )
}
