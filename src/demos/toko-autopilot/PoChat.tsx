/**
 * PoChat — standalone WA-style thread of one purchase order (pure props, reusable by the product page mini): the
 * sent bubble lists exactly the PO payload lines, then the supplier's reply (after a typing pause). `side` flips the
 * view for the Supplier role, which answers with quick replies.
 */
import { ChatThread, type ChatMessage } from '../../demo-kit/ui'
import type { Bi } from '../../demo-kit/world'
import { rp, type Lang } from './strings'

export interface PoChatProps {
  code: string
  shop: string
  supplier: string
  items: { name: string; qty: number; unit: string }[]
  total: number
  sentAt: number
  reply: { message: Bi; at: number; eta: string | null } | null
  typing?: boolean
  side?: 'shop' | 'supplier'
  quickReplies?: { id: string; label: Bi }[]
  onQuick?: (id: string) => void
  quickDisabled?: Bi
  lang: Lang
}

export default function PoChat({ code, shop, supplier, items, total, sentAt, reply, typing, side = 'shop', quickReplies, onQuick, quickDisabled, lang }: PoChatProps) {
  const me = side === 'shop'
  const L = lang === 'id'
  const order = `${L ? `Pesanan ${code}` : `Order ${code}`}:\n${items.map((i) => `• ${i.name} × ${i.qty.toLocaleString(L ? 'id-ID' : 'en-GB')} ${i.unit}`).join('\n')}\n${L ? 'Total' : 'Total'} ${rp(total)}`
  const msgs: ChatMessage[] = [
    { id: `${code}:sys`, side: 'system', text: L ? `${code} dikirim ke ${supplier}` : `${code} sent to ${supplier}`, at: sentAt },
    { id: `${code}:po`, side: me ? 'me' : 'them', text: order, at: sentAt, author: shop, ...(me ? { status: reply && !typing ? 'read' : 'delivered' } : {}) } as ChatMessage,
  ]
  if (reply && !typing)
    msgs.push({ id: `${code}:re`, side: me ? 'them' : 'me', text: reply.eta ? `${reply.message[lang]}\n${L ? 'Perkiraan tiba' : 'ETA'}: ${reply.eta}` : reply.message[lang], at: reply.at, author: supplier } as ChatMessage)
  return (
    <div data-tour="po-chat" className="dk-ta-pochat">
      <ChatThread
        label={{ id: `Chat ${code} dengan ${me ? supplier : shop}`, en: `${code} chat with ${me ? supplier : shop}` }}
        messages={msgs}
        typing={typing ? supplier : false}
        {...(quickReplies ? { quickReplies, onQuick, quickDisabled } : {})}
        highlightId={reply && !typing ? `${code}:re` : undefined}
      />
    </div>
  )
}
