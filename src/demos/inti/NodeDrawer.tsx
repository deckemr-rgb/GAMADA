/**
 * NodeDrawer (lazy) — one trail node = one Audit Log row: what happened, in which product, when, by whom, what caused
 * it, the business badges of the businesses it touches, "Buka di <produk>" (READY targets only) and "Lihat di Audit".
 */
import AppLink from '../../components/AppLink'
import { BizBadges, Button, Drawer, Icon } from '../../demo-kit/ui'
import { hhmm, rows, useWorld, type WorldState } from '../../demo-kit/world'
import { actorOf, productOfAudit } from '../../demo-kit/world/inti'
import { badgesOf } from '../../demo-kit/world/pasar-daerah'
import { canLink, hrefTo, productName } from './model'
import { tm, useT, type Lang } from './strings'

const S = {
  id: {
    eyebrow: 'Simpul jejak data',
    product: 'Produk',
    time: 'Waktu',
    actor: 'Aktor',
    type: 'Jenis kejadian',
    cause: 'Dipicu oleh',
    entities: 'Entitas',
    biz: 'Usaha yang terlibat',
    open: (p: string) => `Buka di ${p}`,
    notReady: (p: string) => `${p} belum dibuka untuk umum (demo tahap berikutnya)`,
    audit: 'Lihat di Audit',
    actors: { user: 'pengguna', clock: 'jam dunia', tour: 'tur', reaction: 'reaksi otomatis' },
    none: 'tidak ada (kejadian awal)',
    close: 'Tutup',
  },
  en: {
    eyebrow: 'Data trail node',
    product: 'Product',
    time: 'Time',
    actor: 'Actor',
    type: 'Event type',
    cause: 'Triggered by',
    entities: 'Entities',
    biz: 'Businesses involved',
    open: (p: string) => `Open in ${p}`,
    notReady: (p: string) => `${p} is not public yet (a later demo stage)`,
    audit: 'See in Audit',
    actors: { user: 'user', clock: 'world clock', tour: 'tour', reaction: 'automatic reaction' },
    none: 'none (first event)',
    close: 'Close',
  },
} as const

const all = (s: WorldState) => s

export default function NodeDrawer({ auditId, onClose, onAudit }: { auditId: string; onClose: () => void; onAudit: (id: string) => void }) {
  const { lang } = useT()
  const L = S[lang as Lang]
  const s = useWorld(all)
  const a = s.auditLog.byId[auditId]
  const product = a ? productOfAudit(a) : null
  const cause = a?.causeId ? rows(s.auditLog).find((x) => x.eventId === a.causeId) : undefined
  const bizIds = [...new Set((a?.entityRefs ?? []).filter((r) => r.startsWith('businesses:')).map((r) => r.slice(11)))]
  // businesses behind the row's other entities (orders, matches, loans …)
  for (const r of a?.entityRefs ?? []) {
    const [tb, id] = r.split(':') as [string, string]
    const b = (s as unknown as Record<string, { byId: Record<string, { businessId?: string }> } | undefined>)[tb]?.byId[id]?.businessId
    if (b && !bizIds.includes(b)) bizIds.push(b)
  }
  const first = a?.entityRefs[0]
  const focus = first ? first.slice(first.indexOf(':') + 1) : null
  return (
    <Drawer
      open
      onClose={onClose}
      title={a ? a.summary[lang] : auditId}
      eyebrow={<span>{L.eyebrow} · {auditId}</span>}
      footer={
        <div className="dk-in-dfoot">
          <Button variant="ghost" icon="list" data-in="to-audit" onClick={() => onAudit(auditId)}>
            {L.audit}
          </Button>
          {product && canLink(product) ? (
            <AppLink className="dk-btn dk-btn--primary dk-btn--md dk-in-open" to={hrefTo(product, { focus })} data-in="open-product">
              <Icon name="external" size={16} /> {L.open(productName(product))}
            </AppLink>
          ) : product ? (
            <span className="dk-in-muted">{L.notReady(productName(product))}</span>
          ) : null}
        </div>
      }
    >
      {a && (
        <dl className="dk-in-dl">
          <dt>{L.product}</dt>
          <dd>{productName(product)}</dd>
          <dt>{L.time}</dt>
          <dd>{tm(hhmm(a.at), lang)}</dd>
          <dt>{L.actor}</dt>
          <dd>{L.actors[actorOf(a)]}</dd>
          <dt>{L.type}</dt>
          <dd>
            <code>{a.type}</code>
          </dd>
          <dt>{L.cause}</dt>
          <dd>{cause ? `${cause.summary[lang]} (${productName(productOfAudit(cause))}, ${tm(hhmm(cause.at), lang)})` : L.none}</dd>
          <dt>{L.entities}</dt>
          <dd className="dk-in-refs">
            {a.entityRefs.map((r) => (
              <code key={r}>{r}</code>
            ))}
          </dd>
        </dl>
      )}
      {bizIds.length > 0 && (
        <div className="dk-in-biz">
          <h3 className="dk-in-h3">{L.biz}</h3>
          {bizIds.slice(0, 6).map((id) => (
            <div key={id} className="dk-in-bizrow">
              <span>{s.businesses.byId[id]?.name ?? id}</span>
              <BizBadges badges={badgesOf(s, id)} bizId={id} links />
            </div>
          ))}
        </div>
      )}
    </Drawer>
  )
}
