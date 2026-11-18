/**
 * Official minutes in the government memo layout (tata naskah dinas): generic letterhead (no real coat of arms),
 * number, day/date, time, venue, chair, participants, agenda, discussion, decisions, follow-up table with status
 * from the world, two dummy electronic signatures. PaperFrame + "Cetak / Simpan PDF" (print stylesheet).
 * Lazy chunk: loaded when the user opens it after the meeting.
 */
import { useRef } from 'react'
import { useI18n } from '../../lib/i18n'
import { useShell } from '../../demo-kit/shell'
import { Button, Modal } from '../../demo-kit/ui'
import { PaperFrame, printPaper } from '../../demo-kit/frames'
import { useWorld, type WorldState } from '../../demo-kit/world'
import { hashString } from '../../demo-kit/world/prng'
import { longDate } from '../../demo-kit/docs/nik'
import { CLIP, CONCLUSION, SCRIPT, clockText, existingAction, fullDue, picLabel, type ScriptLine } from './model'
import { useStr } from './strings'
import './official.css'

interface Props {
  open: boolean
  onClose: () => void
  meetingId: string | null
  summary: string
  topics: ScriptLine[]
}

const DAYS = { id: ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'], en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] }

function view(s: WorldState, meetingId: string | null) {
  const m = meetingId ? s.meetings.byId[meetingId] : undefined
  return {
    day: s.day,
    region: s.region.name,
    at: m?.at ?? 390,
    dur: m?.durationMin ?? 30,
    st: meetingId ? SCRIPT.actions.map((a) => existingAction(s, meetingId, a.text)?.status ?? 'baru').join('|') : '',
  }
}

export default function OfficialMinutes({ open, onClose, meetingId, topics }: Props) {
  const S = useStr()
  const { lang } = useI18n()
  const { markMission } = useShell()
  const v = useWorld((s) => view(s, meetingId), (a, b) => a.day === b.day && a.st === b.st && a.at === b.at && a.region === b.region)
  const paper = useRef<HTMLDivElement>(null)
  const status = v.st.split('|')
  const year = v.day.slice(0, 4)
  const number = `005/${(hashString(meetingId ?? 'rapat') % 400) + 100}/412.011/${year}`
  const weekday = DAYS[lang][new Date(`${v.day}T00:00:00Z`).getUTCDay()] ?? ''
  const label = new Map(CLIP.speakers.map((sp) => [sp.id, sp.label[lang]]))

  const print = () => {
    markMission('ekspor-notulen')
    // print the PaperFrame itself (printPaper only looks upward from the element it gets)
    const el = paper.current?.querySelector('.dk-paper') ?? paper.current
    if (el) printPaper(el)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={S.oTitle}
      size="lg"
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            {S.oClose}
          </Button>
          <Button variant="primary" icon="print" onClick={print} data-np="print">
            {S.oPrint}
          </Button>
        </>
      }
    >
      <div ref={paper} className="dk-np-offwrap">
        <PaperFrame label={`${S.oHead} ${number}`} size="auto" className="dk-np-off">
          <header className="dk-np-kop">
            <svg viewBox="0 0 48 56" width="44" height="52" aria-hidden="true" className="dk-np-emblem">
              <path d="M24 2 44 9v18c0 13-9 22-20 27C13 49 4 40 4 27V9Z" fill="none" stroke="currentColor" strokeWidth="2.4" />
              <path d="m24 14 3 7 7 .5-5.5 4.5 2 7L24 29l-6.5 4 2-7L14 21.5l7-.5Z" fill="currentColor" />
              <path d="M12 40c4 3 8 4 12 4s8-1 12-4" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
            <div>
              <p className="dk-np-kop1">{S.oGov(v.region)}</p>
              <p className="dk-np-kop2">{S.oSecretariat}</p>
              <p className="dk-np-kop3">{S.oAddr}</p>
            </div>
          </header>
          <h2 className="dk-np-offh">{S.oHead}</h2>
          <p className="dk-np-offno">
            {S.oNumber}: {number}
          </p>
          <dl className="dk-np-offmeta">
            <div>
              <dt>{S.nAgenda}</dt>
              <dd>{CLIP.title[lang]}</dd>
            </div>
            <div>
              <dt>{S.oDayDate}</dt>
              <dd>
                {weekday}, {longDate(v.day, lang)}
              </dd>
            </div>
            <div>
              <dt>{S.oTime}</dt>
              <dd>
                {clockText(v.at, lang)}–{clockText(v.at + v.dur, lang)} WIB
              </dd>
            </div>
            <div>
              <dt>{S.oPlace}</dt>
              <dd>{S.mPlace}</dd>
            </div>
            <div>
              <dt>{S.oChair}</dt>
              <dd>{S.oChairV}</dd>
            </div>
            <div>
              <dt>{S.nParticipants}</dt>
              <dd>{CLIP.speakers.map((sp) => label.get(sp.id)).join(', ')}</dd>
            </div>
          </dl>

          <h3>I. {S.nTopics}</h3>
          <ol className="dk-np-offlist">
            {topics.map((t) => (
              <li key={t.key}>{t.text[lang]}</li>
            ))}
          </ol>
          <h3>II. {S.nDecisions}</h3>
          <ol className="dk-np-offlist">
            {SCRIPT.decisions.map((d) => (
              <li key={d.key}>{d.text[lang]}</li>
            ))}
          </ol>
          <h3>III. {S.nActions}</h3>
          <table className="dk-np-offtable">
            <thead>
              <tr>
                <th scope="col">{S.oNo}</th>
                <th scope="col">{S.nTask}</th>
                <th scope="col">{S.nPic}</th>
                <th scope="col">{S.nDue}</th>
                <th scope="col">{S.nStatus}</th>
              </tr>
            </thead>
            <tbody>
              {SCRIPT.actions.map((a, i) => (
                <tr key={a.key}>
                  <td className="dk-num">{i + 1}</td>
                  <td>{a.text[lang]}</td>
                  <td>{picLabel(a.pic, lang, a.opdId)}</td>
                  <td className="dk-num">{fullDue(a.dueAt, lang, v.day)}</td>
                  <td>{S.fStatus[(status[i] ?? 'baru') as keyof typeof S.fStatus] ?? status[i]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* a government memo states its conclusion in the impersonal register; the AI summary stays on screen */}
          <h3>IV. {S.oConclusion}</h3>
          <p className="dk-np-offsum">{CONCLUSION[lang]}</p>

          <div className="dk-np-signs">
            {[
              { h: S.oSignClerk, t: S.oSignClerkT, seed: 3 },
              { h: S.oSignChair, t: S.oSignChairT, seed: 7 },
            ].map((b) => (
              <div key={b.t} className="dk-np-sign">
                <p>{b.h}</p>
                <QrBox seed={b.seed + (hashString(number) % 97)} />
                <p className="dk-np-esign">{S.oEsign}</p>
                <p className="dk-np-signt">{b.t}</p>
              </div>
            ))}
          </div>
          <p className="dk-np-offfoot">{S.oFoot}</p>
        </PaperFrame>
      </div>
    </Modal>
  )
}

/** decorative QR-like square (encodes nothing) */
function QrBox({ seed }: { seed: number }) {
  let a = seed >>> 0
  const rnd = () => {
    a = (a * 1664525 + 1013904223) >>> 0
    return a / 4294967296
  }
  const cells: string[] = []
  for (let y = 0; y < 13; y++)
    for (let x = 0; x < 13; x++) {
      const corner = (x < 4 && y < 4) || (x > 8 && y < 4) || (x < 4 && y > 8)
      if (corner ? (x % 3 === 0 || y % 3 === 0 || (x % 12 === 1 && y % 12 === 1)) && !(x === 3 || y === 3 || x === 9 || y === 9) : rnd() > 0.52) cells.push(`M${x} ${y}h1v1h-1z`)
    }
  return (
    <svg viewBox="0 0 13 13" width="64" height="64" className="dk-np-qr" aria-hidden="true" shapeRendering="crispEdges">
      <path d={cells.join('')} fill="currentColor" />
    </svg>
  )
}
