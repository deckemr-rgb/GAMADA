/**
 * Export.tsx (lazy) — Ekspor: the checklist of the month (PPh Final computed, PPh 21 computed, journal reviewed),
 * previews of the Coretax XML import template STRUCTURE (monthly PPh 21 withholding, BPMP) and of the journal CSV,
 * both labelled "Contoh simulasi · bukan untuk diunggah" with the NPWP masked and no billing code, real downloads,
 * and "Tandai siap lapor" ⇒ tax.ready (disabled with its reason until both taxes are computed). The owner can
 * "Kirim ke konsultan" (role switch + toast).
 */
import { useMemo, useState } from 'react'
import { useShell } from '../../demo-kit/shell'
import { Button, Icon, Segmented } from '../../demo-kit/ui'
import { setSession, useWorld, world, type WorldState } from '../../demo-kit/world'
import { coaOf, ledgerRows, pendingReviews, vendorProfile } from '../../demo-kit/world/usaha-pintar'
import { computePphFinal, markReady } from './actions'
import { pph21Rows } from './pph21'
import { SOURCES } from './rules'
import { download, isoOf, monthName, periodOf, rp, taxAmountOf, taxItemOf, type RoleKey, type TabId } from './model'
import { useT } from './strings'

const S = {
  id: {
    title: (m: string) => `Ekspor ${m}`,
    check: 'Sebelum lapor',
    final: 'PPh Final UMKM',
    pph21: 'PPh 21 karyawan',
    est: 'estimasi, belum dihitung',
    done: 'dihitung',
    review: (n: number) => (n ? `${n} jurnal masih perlu tinjauan (boleh menyusul)` : 'Semua jurnal sudah ditinjau'),
    compute: 'Hitung sekarang',
    openPph21: 'Buka PPh 21',
    ready: 'Tandai siap lapor',
    readyWhy: 'Hitung PPh Final dan PPh 21 dulu.',
    isReady: (m: string) => `Pajak ${m} siap lapor. Status ini dibaca TenderPilot untuk syarat "status pajak".`,
    toKonsultan: 'Kirim ke konsultan',
    sentTitle: 'Dikirim ke Konsultan Pajak',
    sentBody: 'Sekarang Anda melihat Pajak Beres sebagai konsultan.',
    label: 'Contoh simulasi · bukan untuk diunggah',
    official: 'SIMULASI · bukan dokumen resmi',
    billing: 'Kode billing dibuat di Coretax DJP, tidak disimulasikan di sini.',
    fmt: 'Format',
    xml: 'XML Coretax (struktur)',
    csv: 'CSV jurnal',
    dl: (f: string) => `Unduh ${f}`,
    lines: (n: number) => `${n} baris`,
    template: 'Template',
  },
  en: {
    title: (m: string) => `${m} export`,
    check: 'Before filing',
    final: 'Final income tax',
    pph21: 'Employee PPh 21',
    est: 'estimate, not computed yet',
    done: 'computed',
    review: (n: number) => (n ? `${n} journal entries still need review (can follow later)` : 'Every journal entry is reviewed'),
    compute: 'Compute now',
    openPph21: 'Open PPh 21',
    ready: 'Mark ready to file',
    readyWhy: 'Compute the final tax and PPh 21 first.',
    isReady: (m: string) => `${m} taxes are ready to file. TenderPilot reads this status for its "tax status" requirement.`,
    toKonsultan: 'Send to the consultant',
    sentTitle: 'Sent to the tax consultant',
    sentBody: 'You now see Pajak Beres as the consultant.',
    label: 'Simulated example · not for upload',
    official: 'SIMULATION · not an official document',
    billing: 'The billing code is made in DJP Coretax; it is not simulated here.',
    fmt: 'Format',
    xml: 'Coretax XML (structure)',
    csv: 'Journal CSV',
    dl: (f: string) => `Download ${f}`,
    lines: (n: number) => `${n} lines`,
    template: 'Template',
  },
}

const sel = (s: WorldState) => {
  const p = periodOf(s)
  return { f: taxItemOf(s, 'pph-final-umkm', p) ?? null, p21: taxItemOf(s, 'pph21', p) ?? null, rev: pendingReviews(s, s.meta.shopId) }
}
const eq = (a: ReturnType<typeof sel>, b: ReturnType<typeof sel>) => a.f === b.f && a.p21 === b.p21 && a.rev === b.rev

export default function Export({ roleKey, onTab }: { roleKey: RoleKey; onTab: (t: TabId) => void }) {
  const { lang } = useT()
  const L = S[lang]
  const { toast } = useShell()
  const { f, p21, rev } = useWorld(sel, eq)
  const period = useWorld(periodOf)
  const amtF = useWorld((s) => (f ? taxAmountOf(s, f).amount : 0))
  const amtP = useWorld((s) => (p21 ? taxAmountOf(s, p21).amount : 0))
  const ledger = useWorld((s) => s.ledger)
  const [fmt, setFmt] = useState<'xml' | 'csv'>('xml')
  const m = monthName(period, lang)
  const okF = f?.amount != null
  const okP = p21?.amount != null
  const ready = (f?.status === 'siap' || f?.status === 'dilaporkan') && (p21?.status === 'siap' || p21?.status === 'dilaporkan')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const files = useMemo(() => buildFiles(lang), [lang, ledger, f, p21])
  const text = fmt === 'xml' ? files.xml : files.csv
  const preview = text.split('\n').slice(0, fmt === 'xml' ? 34 : 16).join('\n')

  return (
    <div className="dk-pb-export">
      <section className="dk-pb-card" aria-labelledby="pb-ex-check">
        <h3 id="pb-ex-check">{L.check}</h3>
        <ul className="dk-pb-check">
          <li className={okF ? 'is-ok' : ''}>
            <Icon name={okF ? 'check' : 'dot'} size={16} />
            <span>
              {L.final} <strong>{rp(amtF, lang)}</strong> <small>({okF ? L.done : L.est})</small>
            </span>
            {!okF && (
              <Button size="sm" variant="secondary" icon="spark" onClick={() => computePphFinal()} data-pb="compute-final">
                {L.compute}
              </Button>
            )}
          </li>
          <li className={okP ? 'is-ok' : ''}>
            <Icon name={okP ? 'check' : 'dot'} size={16} />
            <span>
              {L.pph21} <strong>{rp(amtP, lang)}</strong> <small>({okP ? L.done : L.est})</small>
            </span>
            {!okP && (
              <Button size="sm" variant="quiet" icon="forward" onClick={() => onTab('pph21')}>
                {L.openPph21}
              </Button>
            )}
          </li>
          <li className={rev ? 'is-warn' : 'is-ok'}>
            <Icon name={rev ? 'alert' : 'check'} size={16} />
            <span>{L.review(rev)}</span>
            {rev > 0 && (
              <Button size="sm" variant="quiet" icon="forward" onClick={() => onTab('jurnal')}>
                {lang === 'id' ? 'Buka Jurnal' : 'Open Journal'}
              </Button>
            )}
          </li>
        </ul>
        <div className="dk-pb-ready">
          {ready ? (
            <p className="dk-pb-ok-line" role="status" data-pb="ready-done">
              <Icon name="check" size={16} /> {L.isReady(m)}
            </p>
          ) : (
            <>
              <Button variant="primary" icon="check" disabled={!okF || !okP} onClick={() => markReady()} data-pb="ready" data-hotspot="pb-ready" aria-describedby={!okF || !okP ? 'pb-ready-why' : undefined}>
                {L.ready}
              </Button>
              {(!okF || !okP) && (
                <span id="pb-ready-why" className="dk-pb-why">
                  {L.readyWhy}
                </span>
              )}
            </>
          )}
          {roleKey === 'owner' && (
            <Button
              variant="secondary"
              icon="send"
              onClick={() => {
                setSession({ role: 'konsultan-pajak' })
                toast({ title: L.sentTitle, body: L.sentBody, tone: 'accent', icon: 'user' })
              }}
              data-pb="to-konsultan"
            >
              {L.toKonsultan}
            </Button>
          )}
        </div>
      </section>
      <section className="dk-pb-card" aria-labelledby="pb-ex-files">
        <div className="dk-pb-ex-h">
          <h3 id="pb-ex-files">{L.title(m)}</h3>
          <Segmented size="sm" label={L.fmt} value={fmt} onChange={setFmt} options={[{ value: 'xml', label: L.xml }, { value: 'csv', label: L.csv }]} />
        </div>
        <p className="dk-pb-stamp">{L.label} · {L.official}</p>
        <pre className="dk-pb-pre" tabIndex={0} aria-label={fmt === 'xml' ? L.xml : L.csv}>
          {preview}
          {'\n…'}
        </pre>
        <p className="dk-pb-muted">
          {L.lines(text.split('\n').length)} · {L.billing}{' '}
          {fmt === 'xml' && (
            <>
              {L.template}:{' '}
              <a className="dk-pb-cite" href={SOURCES.coretax.url} target="_blank" rel="noreferrer">
                {SOURCES.coretax.ref}
              </a>
            </>
          )}
        </p>
        <div className="dk-pb-ex-dl">
          <Button variant="secondary" icon="download" onClick={() => download(`pajak-beres-bpmp-${period}-SIMULASI.xml`, files.xml, 'application/xml')} data-pb="dl-xml">
            {L.dl('XML')}
          </Button>
          <Button variant="secondary" icon="download" onClick={() => download(`pajak-beres-jurnal-${period}-SIMULASI.csv`, files.csv, 'text/csv')} data-pb="dl-csv">
            {L.dl('CSV')}
          </Button>
        </div>
      </section>
    </div>
  )
}


const xmlEsc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const csvCell = (s: string | number) => (typeof s === 'number' ? String(s) : /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)

/** the two export files (the XML is the STRUCTURE of the Coretax monthly PPh 21 import template, simulated values) */
function buildFiles(lang: 'id' | 'en'): { xml: string; csv: string } {
  const s = world.get()
  const shop = s.meta.shopId
  const period = periodOf(s)
  const vp = vendorProfile(s, shop)
  const tin = (vp?.npwp ?? '').replace(/\s/g, '')
  const pay = pph21Rows(s)
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!-- CONTOH SIMULASI · bukan untuk diunggah · SIMULATED EXAMPLE · not for upload -->',
    '<!-- NPWP tersamar, nama dan NIK karyawan tidak dicantumkan, tanpa kode billing -->',
    '<MmPayrollBulk>',
    `  <TIN>${xmlEsc(tin)}</TIN>`,
    '  <ListOfMmPayroll>',
    ...pay.flatMap((r, i) => [
      '    <MmPayroll>',
      `      <TaxPeriodMonth>${Number(period.slice(5, 7))}</TaxPeriodMonth>`,
      `      <TaxPeriodYear>${period.slice(0, 4)}</TaxPeriodYear>`,
      '      <CounterpartOpt>Resident</CounterpartOpt>',
      `      <CounterpartTin>SPESIMEN-${String(i + 1).padStart(2, '0')}</CounterpartTin>`,
      `      <StatusTaxExemption>${r.staff.ptkp}</StatusTaxExemption>`,
      `      <Position>${xmlEsc(r.staff.job)}</Position>`,
      '      <TaxObjectCode>21-100-01</TaxObjectCode>',
      `      <Gross>${r.staff.gross}</Gross>`,
      `      <Rate>${(r.rate * 100).toFixed(2)}</Rate>`,
      `      <Tax>${r.amount}</Tax>`,
      `      <WithholdingDate>${isoOf(s, 0)}</WithholdingDate>`,
      '    </MmPayroll>',
    ]),
    '  </ListOfMmPayroll>',
    '</MmPayrollBulk>',
  ].join('\n')
  const head = lang === 'id' ? ['tanggal', 'nomor', 'keterangan', 'kode_akun', 'akun', 'debit', 'kredit'] : ['date', 'number', 'memo', 'account_code', 'account', 'debit', 'credit']
  const from = -(Number(s.day.slice(8, 10)) - 1) * 1440
  const lines = [`# ${lang === 'id' ? 'CONTOH SIMULASI · bukan untuk diunggah' : 'SIMULATED EXAMPLE · not for upload'}`, head.join(',')]
  for (const j of ledgerRows(s, shop, { from }).slice().reverse())
    for (const l of j.lines) lines.push([isoOf(s, j.at), j.id, j.memo[lang], coaOf(l.account).code, l.account, l.debit, l.credit].map(csvCell).join(','))
  return { xml, csv: lines.join('\n') }
}
