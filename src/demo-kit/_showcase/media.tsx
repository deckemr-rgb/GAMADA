/**
 * /lab/_kit showcase — "media" module (owner: docs-media builder).
 * 1. Hold-to-record (Web Speech, region speech codes) with the sample voice-note fallback.
 * 2. A 5-speaker meeting snippet with a seekable timeline; minutes items appear as the meeting plays.
 * 3. A sales call with coaching markers (jump to the moment).
 * 4. "Dengarkan" (TTS) on an AI answer with current-word highlight.
 */
import { useEffect, useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { SectionHeader } from '../ui'
import { loadRegion } from '../region/loader'
import { AudioPlayer, MEETING_BANJIR, MEETING_BANJIR_NOTES, SALES_CALL, SpeakButton, SpokenText, VOICE_NOTES, VoiceRecorder, useSpeakText, type VoiceResult } from '../media'
import './docs-media.css'

const C = {
  id: {
    h1: 'Warga cukup bicara, laporan tercatat',
    l1: 'Tahan tombol mikrofon dan bicara dalam Basa Jawa atau Bahasa Indonesia. Tanpa mikrofon, pakai voice note contoh.',
    out: 'Hasil transkripsi',
    wait: 'Belum ada rekaman. Tahan tombol mikrofon atau putar voice note contoh.',
    src: { mic: 'dari mikrofon', sample: 'dari voice note contoh' },
    h2: 'Rapat berjalan, notulen menulis dirinya sendiri',
    l2: 'Lima pembicara, linimasa bisa digeser, klik baris mana pun untuk memutar dari sana.',
    minutes: 'Tindak lanjut tertangkap',
    none: 'Putar rapat untuk melihat tindak lanjut muncul.',
    h3: 'Loncat ke detik masalah dalam rekaman',
    l3: 'Penanda momen di panggilan penjualan: klik "Keberatan tidak dijawab".',
    jumped: 'Momen dipilih',
    h4: 'Jawaban AI bisa didengarkan',
    l4: 'Tombol Dengarkan membacakan teks dengan suara sintetis bahasa Indonesia bila tersedia.',
    answer:
      'Hari ini ada 47 aduan baru. Tiga perlu perhatian: genangan di Kalitidu naik dua hari berturut-turut, lampu jalan di Sumbang mati seminggu, dan antrean layanan KTP di kecamatan Kanor melewati batas waktu.',
  },
  en: {
    h1: 'Citizens just speak, the report is filed',
    l1: 'Hold the microphone button and speak Javanese or Indonesian. No microphone? Use the sample voice note.',
    out: 'Transcript',
    wait: 'Nothing recorded yet. Hold the microphone button or play the sample voice note.',
    src: { mic: 'from the microphone', sample: 'from the sample voice note' },
    h2: 'The meeting runs, the minutes write themselves',
    l2: 'Five speakers, a seekable timeline, click any line to play from there.',
    minutes: 'Action items captured',
    none: 'Play the meeting to see action items appear.',
    h3: 'Jump to the problem second in a recording',
    l3: 'Moment markers on a sales call: click "Objection not answered".',
    jumped: 'Selected moment',
    h4: 'AI answers you can listen to',
    l4: 'The Listen button reads the text aloud with an Indonesian synthetic voice when one is available.',
    answer:
      'Hari ini ada 47 aduan baru. Tiga perlu perhatian: genangan di Kalitidu naik dua hari berturut-turut, lampu jalan di Sumbang mati seminggu, dan antrean layanan KTP di kecamatan Kanor melewati batas waktu.',
  },
}

function RecorderDemo() {
  const { lang } = useI18n()
  const c = C[lang]
  const [codes, setCodes] = useState<readonly string[]>(['jv-ID', 'id-ID'])
  const [res, setRes] = useState<VoiceResult | null>(null)
  useEffect(() => {
    let on = true
    loadRegion('bojonegoro')
      .then((p) => on && setCodes(p.languages.speechCodes))
      .catch(() => {})
    return () => {
      on = false
    }
  }, [])
  const sample = VOICE_NOTES[0]!
  return (
    <div className="dk-scm-block">
      <SectionHeader index="01" title={c.h1} lead={c.l1} as="h3" />
      <div className="dk-scm-grid">
        <VoiceRecorder speechCodes={codes} sample={sample} onResult={setRes} />
        <div className="dk-scm-out" aria-live="polite">
          <h4>{c.out}</h4>
          {res ? (
            <>
              <p>{res.text}</p>
              <small>
                {c.src[res.source]} · {res.lang}
              </small>
              {res.source === 'sample' && sample.translation && <small>{sample.translation[lang]}</small>}
            </>
          ) : (
            <small>{c.wait}</small>
          )}
        </div>
      </div>
    </div>
  )
}

function MeetingDemo() {
  const { lang } = useI18n()
  const c = C[lang]
  const [seg, setSeg] = useState(-1)
  const order = MEETING_BANJIR.segments.map((s) => s.id)
  const items = MEETING_BANJIR_NOTES.actions.filter((a) => order.indexOf(a.seg) <= seg)
  return (
    <div className="dk-scm-block">
      <SectionHeader index="02" title={c.h2} lead={c.l2} as="h3" />
      <div className="dk-scm-grid">
        <AudioPlayer clip={MEETING_BANJIR} onSegment={setSeg} />
        <div className="dk-scm-out" aria-live="polite">
          <h4>{c.minutes}</h4>
          {items.length ? (
            items.map((a) => (
              <p key={a.seg + a.pic}>
                <b>{a.pic}</b> · {a.text[lang]}
                <br />
                <small className="dk-num">{a.due.replace('T', ' · ').slice(5)}</small>
              </p>
            ))
          ) : (
            <small>{c.none}</small>
          )}
        </div>
      </div>
    </div>
  )
}

function CallDemo() {
  const { lang } = useI18n()
  const c = C[lang]
  const [m, setM] = useState<string | null>(null)
  return (
    <div className="dk-scm-block" data-eco="usaha-pintar">
      <SectionHeader index="03" title={c.h3} lead={c.l3} as="h3" />
      <AudioPlayer clip={SALES_CALL} onMarker={(x) => setM(x.label[lang])} maxHeight="260px" />
      {m && (
        <p className="dk-scm-row" aria-live="polite">
          <small className="dk-faint">{c.jumped}:</small> <b>{m}</b>
        </p>
      )}
    </div>
  )
}

function TtsDemo() {
  const { lang } = useI18n()
  const c = C[lang]
  const sp = useSpeakText(c.answer, 'id-ID')
  return (
    <div className="dk-scm-block">
      <SectionHeader index="04" title={c.h4} lead={c.l4} as="h3" />
      <div className="dk-scm-tts">
        <SpokenText words={sp.words} state={sp.state} />
        <div className="dk-scm-row">
          <SpeakButton state={sp.state} onToggle={sp.toggle} />
        </div>
      </div>
    </div>
  )
}

export default function Section() {
  return (
    <div className="dk-root dk-scm" data-eco="satu-daerah">
      <RecorderDemo />
      <MeetingDemo />
      <CallDemo />
      <TtsDemo />
    </div>
  )
}
