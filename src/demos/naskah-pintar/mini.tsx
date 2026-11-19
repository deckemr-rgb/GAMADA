/**
 * naskah-pintar — mini-demo (Tahap 6 plan §2.3, P3 wow): the meeting transcript runs while the minutes write
 * themselves, follow-ups land with owner and deadline, and an incoming letter gets its disposition stamp. Constant fixture.
 */
import { PRODUCT_BY_SLUG, type Bi } from '../../content/products'
import { MiniFrame, frameIndex, onFrom, useBi, useMiniScript, type MiniStep } from '../mini-kit'
import type { MiniProps } from '../minis'

const FRAMES: readonly MiniStep[] = [
  { id: 'rapat', ms: 2200, caption: { id: 'Rapat koordinasi banjir diputar', en: 'The flood coordination meeting plays' } },
  { id: 'notulen', ms: 2600, caption: { id: 'Notulen terisi selama rapat', en: 'Minutes fill in during the meeting' } },
  { id: 'tindak', ms: 2600, caption: { id: 'Tindak lanjut dengan PIC dan tenggat', en: 'Follow-ups with owners and deadlines' } },
  { id: 'disposisi', ms: 3000, caption: { id: 'Surat masuk menjadi disposisi', en: 'An incoming letter becomes a disposition' } },
]

const LINES: readonly { who: string; c: string; text: Bi }[] = [
  { who: 'Sekda', c: 'var(--c-lavender)', text: { id: 'Kita fokus ke Kanor dan Baureno dulu.', en: 'We focus on Kanor and Baureno first.' } },
  { who: 'Kadis PUPR', c: 'var(--c-peach)', text: { id: 'Dua pompa bisa dikirim sore ini.', en: 'Two pumps can go out this afternoon.' } },
  { who: 'Kalaksa BPBD', c: 'var(--c-teal)', text: { id: 'Posko dibuka di balai desa pukul 13.00.', en: 'A post opens at the village hall at 13:00.' } },
  { who: 'Kadinsos', c: 'var(--c-gold)', text: { id: 'Pendaftaran bansos dibuka besok.', en: 'Aid registration opens tomorrow.' } },
]

const ACTIONS: readonly { what: Bi; pic: string; due: string }[] = [
  { what: { id: 'Kirim 2 pompa ke Kanor', en: 'Send 2 pumps to Kanor' }, pic: 'PUPR', due: '17/11' },
  { what: { id: 'Buka posko balai desa', en: 'Open the village-hall post' }, pic: 'BPBD', due: '17/11' },
  { what: { id: 'Buka pendaftaran bansos', en: 'Open aid registration' }, pic: 'Dinsos', due: '18/11' },
]

const T = {
  live: { id: 'Transkrip live', en: 'Live transcript' },
  minutes: { id: 'Notulen', en: 'Minutes' },
  decision: { id: 'Keputusan: prioritas Kanor dan Baureno', en: 'Decision: Kanor and Baureno first' },
  follow: { id: 'Tindak lanjut', en: 'Follow-ups' },
  letter: { id: 'Surat masuk · Segera', en: 'Incoming letter · Urgent' },
  letterBody: { id: 'Permohonan bantuan karung pasir dari Kec. Kanor', en: 'Request for sandbags from Kanor district' },
  to: { id: 'Kepada: Kalaksa BPBD · tindak lanjuti hari ini', en: 'To: Disaster Agency head · act today' },
  stamp: { id: 'DISPOSISI', en: 'DISPOSITION' },
}

export default function Mini(p: MiniProps) {
  const s = useMiniScript(FRAMES, p.playing, { still: p.frame, onCaption: p.onCaption })
  const t = useBi()
  const on = (id: string) => onFrom(FRAMES, s.index, id)
  const shownLines = Math.min(LINES.length, s.index + 1 + (s.index >= frameIndex(FRAMES, 'notulen') ? 1 : 0))
  const letter = s.index >= frameIndex(FRAMES, 'disposisi')
  return (
    <MiniFrame slug="naskah-pintar" kind={PRODUCT_BY_SLUG['naskah-pintar'].frame} eco="satu-daerah" frame={s.id} step={s.step}>
      <div className="mk-app" style={{ gridTemplateColumns: '44% 1fr' }}>
        <div className="mk-panel">
          <p className="mk-h">
            <span>{t(T.live)}</span>
            <span className="mk-pill is-danger">● REC</span>
          </p>
          <ul className="mk-list">
            {LINES.map((l, i) => (
              <li key={l.who} className={'mk-in' + (i < shownLines ? ' is-on' : '')} style={{ display: 'grid', gap: '0.2em' }}>
                <strong style={{ color: l.c, fontSize: '0.85em' }}>{l.who}</strong>
                <span>{t(l.text)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div style={{ position: 'relative', minHeight: 0 }}>
          <div className="mk-panel" style={{ height: '100%', transition: 'opacity .35s ease', opacity: letter ? 0.25 : 1 }}>
            <p className="mk-h">{t(T.minutes)}</p>
            <div className={'mk-item mk-in' + on('notulen')} style={{ marginBottom: '1.2cqw' }}>
              <span className="mk-dot" />
              <span className="mk-t">{t(T.decision)}</span>
            </div>
            <p className={'mk-h mk-fade' + on('tindak')}>{t(T.follow)}</p>
            <ul className="mk-list">
              {ACTIONS.map((a, i) => (
                <li
                  key={a.pic}
                  className={'mk-item mk-in' + on('tindak')}
                  style={{ transitionDelay: s.id === 'tindak' && !s.calm ? `${i * 0.3}s` : '0s', display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '1cqw' }}
                >
                  <span className="mk-t">{t(a.what)}</span>
                  <span className="mk-pill">{a.pic}</span>
                  <span className="mk-muted">{a.due}</span>
                </li>
              ))}
            </ul>
          </div>
          <div
            className={'mk-panel mk-in' + on('disposisi')}
            style={{ position: 'absolute', inset: '6% 4%', display: 'grid', alignContent: 'start', gap: '1.2cqw', background: 'var(--dk-paper)', color: 'var(--dk-paper-ink)', borderColor: 'transparent' }}
          >
            <span className="mk-h" style={{ color: 'var(--dk-paper-muted)', margin: 0 }}>
              {t(T.letter)}
            </span>
            <strong>{t(T.letterBody)}</strong>
            <span style={{ color: 'var(--dk-paper-muted)' }}>{t(T.to)}</span>
            <span
              className={'mk-pop' + on('disposisi')}
              style={{
                justifySelf: 'end',
                marginTop: '1cqw',
                padding: '0.4em 0.9em',
                border: '2px solid #b3261e',
                borderRadius: '0.4em',
                color: '#b3261e',
                fontWeight: 800,
                letterSpacing: '0.12em',
                rotate: '-8deg',
                transitionDelay: s.calm ? '0s' : '0.5s',
              }}
            >
              {t(T.stamp)}
            </span>
          </div>
        </div>
      </div>
    </MiniFrame>
  )
}
