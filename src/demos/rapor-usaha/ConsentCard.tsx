/**
 * ConsentCard — pure props (reused by the Tahap 6 product page): what data (6 scopes, native checkboxes, 44 px rows),
 * to whom (fixed: the partner cooperative), how long (30 / 90 / 180 days, default 90) → "Setujui berbagi". The
 * minimum to apply for capital is omzet + laporan + kyb (pre-ticked); the others are optional. `[data-ru=share]`.
 */
import { useId, useState } from 'react'
import { Button, Icon, Segmented } from '../../demo-kit/ui'
import type { ConsentScope } from '../../demo-kit/world'
import { CONSENT_SCOPE } from '../../demo-kit/world/pasar-daerah'
import type { Lang } from './model'

export const SCOPES: readonly ConsentScope[] = ['omzet', 'laporan', 'kyb', 'pajak', 'mutasi', 'supplier']
export const MIN_SCOPES: readonly ConsentScope[] = ['omzet', 'laporan', 'kyb']
type Days = 30 | 90 | 180

const S = {
  id: {
    title: 'Bagikan data ke koperasi',
    what: 'Data apa',
    whom: 'Kepada',
    long: 'Berapa lama',
    days: (n: number) => `${n} hari`,
    min: 'wajib untuk mengajukan',
    opt: 'opsional',
    grant: 'Setujui berbagi',
    none: 'Pilih minimal satu data',
    lessMin: 'Tanpa Omzet, Laporan keuangan, dan KYB, pengajuan modal belum bisa dikirim.',
    note: 'Akses bisa dicabut kapan saja di tab Berbagi data. Data hanya dibaca analis kredit (simulasi).',
    explain: {
      omzet: 'Total penjualan per bulan dari Toko Autopilot',
      laporan: 'Laba rugi dan neraca dari Pajak Beres',
      kyb: 'Hasil verifikasi usaha dari Kenal Mitra',
      pajak: 'Status pajak bulanan dari Pajak Beres',
      mutasi: 'Mutasi rekening 3 bulan',
      supplier: 'Ketepatan bayar ke pemasok',
    } as Record<ConsentScope, string>,
  },
  en: {
    title: 'Share data with the cooperative',
    what: 'Which data',
    whom: 'With',
    long: 'For how long',
    days: (n: number) => `${n} days`,
    min: 'required to apply',
    opt: 'optional',
    grant: 'Approve sharing',
    none: 'Pick at least one item',
    lessMin: 'Without turnover, financial statements and KYB the capital application cannot be sent.',
    note: 'Access can be revoked at any time in the Data sharing tab. Only the credit analyst reads the data (simulated).',
    explain: {
      omzet: 'Monthly sales total from Toko Autopilot',
      laporan: 'Profit & loss and balance sheet from Pajak Beres',
      kyb: 'Business verification result from Kenal Mitra',
      pajak: 'Monthly tax status from Pajak Beres',
      mutasi: '3-month bank statement',
      supplier: 'On-time payments to suppliers',
    },
  },
}

export interface ConsentCardProps {
  lender: string
  lang: Lang
  onGrant: (scopes: ConsentScope[], days: Days) => void
  /** a visible reason when granting is not possible */
  disabledReason?: string | null
}

export function ConsentCard({ lender, lang, onGrant, disabledReason }: ConsentCardProps) {
  const L = S[lang]
  const id = useId()
  const [pick, setPick] = useState<ConsentScope[]>([...MIN_SCOPES])
  const [days, setDays] = useState<Days>(90)
  const has = (k: ConsentScope) => pick.includes(k)
  const toggle = (k: ConsentScope) => setPick((p) => (p.includes(k) ? p.filter((x) => x !== k) : SCOPES.filter((x) => x === k || p.includes(x))))
  const reason = disabledReason ?? (pick.length ? null : L.none)
  const lessMin = MIN_SCOPES.some((k) => !pick.includes(k))
  return (
    <section className="dk-ru-card dk-ru-consent" aria-labelledby={`${id}-h`} data-ru="share">
      <h3 id={`${id}-h`}>
        <Icon name="shield" size={16} /> {L.title}
      </h3>
      <fieldset className="dk-ru-scopes">
        <legend>{L.what}</legend>
        {SCOPES.map((k) => (
          <label key={k} className="dk-ru-scope" data-scope={k}>
            <input type="checkbox" checked={has(k)} onChange={() => toggle(k)} />
            <span>
              <b>{CONSENT_SCOPE[k][lang]}</b>
              <small>
                {L.explain[k]} · {MIN_SCOPES.includes(k) ? L.min : L.opt}
              </small>
            </span>
          </label>
        ))}
      </fieldset>
      <p className="dk-ru-whom">
        <span className="dk-ru-muted">{L.whom}</span> <strong>{lender}</strong>
      </p>
      <div className="dk-ru-row">
        <span className="dk-ru-muted">{L.long}</span>
        <Segmented size="sm" label={L.long} value={String(days)} onChange={(v) => setDays(Number(v) as Days)} options={[30, 90, 180].map((n) => ({ value: String(n), label: L.days(n) }))} />
      </div>
      {lessMin && <p className="dk-ru-warn">{L.lessMin}</p>}
      <div className="dk-ru-row">
        <Button variant="primary" icon="check" disabled={!!reason} onClick={() => onGrant(pick, days)} aria-describedby={reason ? `${id}-r` : undefined} data-ru="grant">
          {L.grant}
        </Button>
        {reason && (
          <span id={`${id}-r`} className="dk-ru-reason">
            {reason}
          </span>
        )}
      </div>
      <p className="dk-ru-fine">{L.note}</p>
    </section>
  )
}
