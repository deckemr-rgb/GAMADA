/**
 * Mirror.tsx — the read-only "other side" panel: on the owner page "Sisi Bank/Koperasi" (status of the shop's latest
 * application at the partner cooperative), on the cooperative page "Sisi Pemilik Usaha" (what the owner sees). The
 * button is a real role switch. The approval stamp of the bank drawer flies to `[data-ru=mirror]`.
 */
import { memo } from 'react'
import { Button, Icon, StatusChip } from '../../demo-kit/ui'
import { useWorld, type LoanApp, type WorldState } from '../../demo-kit/world'
import { LENDER, jt, ownLoan, timeText } from './model'
import { useT } from './strings'

const sel = (s: WorldState): LoanApp | null => ownLoan(s)

export const Mirror = memo(function Mirror({ side, onOpen, inline }: { side: 'bank' | 'owner'; onOpen: (loanId: string | null) => void; inline?: boolean }) {
  const { t, lang } = useT()
  const loan = useWorld(sel)
  const shopName = useWorld((s) => s.businesses.byId[s.meta.shopId]?.name ?? '')
  const tone = !loan ? 'neutral' : loan.status === 'disetujui' ? 'done' : loan.status === 'ditolak' ? 'danger' : 'new'
  return (
    <aside className={`dk-ru-mirror${inline ? ' is-inline' : ''}`} aria-label={side === 'bank' ? t.mirrorBank : t.mirrorOwner} data-ru="mirror" aria-live="polite">
      <header>
        <Icon name={side === 'bank' ? 'building' : 'toko'} size={16} />
        <strong>{side === 'bank' ? t.mirrorBank : t.mirrorOwner}</strong>
      </header>
      <p className="dk-ru-muted">{side === 'bank' ? LENDER : shopName}</p>
      {loan ? (
        <div className="dk-ru-mirror-body" data-loan={loan.id} data-status={loan.status}>
          <StatusChip label={t.step[loan.status] ?? loan.status} tone={tone} />
          <dl className="dk-ru-dl">
            <div>
              <dt>{t.amount}</dt>
              <dd className="dk-num">
                {jt(loan.amount, lang)} · {t.tenor(loan.tenorMonths)}
              </dd>
            </div>
            {loan.status !== 'diajukan' && (
              <div>
                <dt>{t.decided}</dt>
                <dd className="dk-num">
                  {loan.status === 'disetujui' ? jt(loan.decidedAmount ?? loan.amount, lang) : (loan.reason?.[lang] ?? '')} · {timeText(loan.decidedAt ?? loan.at, lang)}
                </dd>
              </div>
            )}
          </dl>
        </div>
      ) : (
        <p className="dk-ru-muted">{t.mirrorNone}</p>
      )}
      <p className="dk-ru-fine">{t.mirrorRead}</p>
      <Button size="sm" variant="secondary" icon="users" onClick={() => onOpen(loan?.id ?? null)} data-ru={side === 'bank' ? 'open-bank' : 'open-owner'}>
        {side === 'bank' ? t.openBank : t.openOwner}
      </Button>
    </aside>
  )
})
