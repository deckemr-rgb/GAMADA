/**
 * demos/pantau-merek/replies.ts — personal reply drafts (simulated AI wording) from `replyInputs`: handle, item, order
 * code, desa / kecamatan, days late, rating. Three tones × five openings, actions and closings per language; draft i
 * of a batch takes entry i of each pool, and every sentence carries an entity field, so 5 drafts never share a
 * sentence. The language follows the review (EN reviews get EN replies).
 */
import type { BrandMention } from '../../demo-kit/world'

export type Tone = 'empatik' | 'formal' | 'santai'
type L = 'id' | 'en'
export interface ReplyIn { handle: string; item: string | null; orderCode: string | null; desa: string; kec: string; daysLate: number | null; lang: L; topic: BrandMention['topic']; rating: number | null }

const OPEN: Record<L, Record<Tone, string[]>> = {
  id: {
    empatik: ['Halo @{h}, mohon maaf sekali atas ketidaknyamanannya.', 'Kak @{h}, terima kasih sudah sabar menunggu dan mau bercerita.', '@{h}, kami ikut menyesal pesanan Anda belum sampai.', 'Salam @{h}, kami mengerti kekecewaan Anda.', 'Halo @{h}, maaf kami membuat Anda menunggu tanpa kabar.'],
    formal: ['Yth. @{h}, terima kasih atas ulasan Anda.', 'Kepada @{h}, kami mohon maaf atas kendala ini.', 'Salam hormat @{h}, keluhan Anda sudah kami terima.', '@{h}, terima kasih telah menyampaikan masukan ini.', 'Yth. @{h}, kami telah memeriksa pesanan Anda.'],
    santai: ['Halo @{h}! Waduh, maaf banget ya.', 'Hai @{h}, makasih udah kabarin kami.', '@{h}, duh, maaf ya bikin nunggu.', 'Halo @{h}, kami dengar keluhannya, nih.', 'Hai @{h}! Maaf ya, lagi seret banget minggu ini.'],
  },
  en: {
    empatik: ['Hi @{h}, we are truly sorry for the trouble.', '@{h}, thank you for your patience and for telling us.', '@{h}, we are sorry your order has not arrived yet.', 'Hello @{h}, we understand how frustrating this is.', 'Hi @{h}, sorry we kept you waiting without news.'],
    formal: ['Dear @{h}, thank you for your review.', 'Dear @{h}, we apologise for this issue.', '@{h}, we have received your complaint.', '@{h}, thank you for sharing this feedback.', 'Dear @{h}, we have checked your order.'],
    santai: ['Hey @{h}! Ouch, so sorry about that.', 'Hi @{h}, thanks for the heads-up.', '@{h}, ugh, sorry for the wait.', 'Hey @{h}, we hear you.', 'Hi @{h}! Sorry, this week has been rough.'],
  },
}

const MID: Record<L, Record<'pengiriman' | 'stok' | 'harga' | 'lain', Record<Tone, string>>> = {
  id: {
    pengiriman: {
      empatik: 'Kami paham menunggu {item} untuk {order} ke {desa} selama {days} hari itu berat, apalagi saat air naik.',
      formal: 'Pesanan {order} ({item}) ke Desa {desa} tertunda {days} hari karena akses ke Kec. {kec} tergenang banjir.',
      santai: '{order} yang isinya {item} memang nyangkut {days} hari, jalur ke {desa} lagi kena genangan.',
    },
    stok: {
      empatik: 'Maaf, {item} habis sejak permintaan naik tajam setelah banjir; stok baru sudah kami pesan ke pemasok.',
      formal: 'Persediaan {item} sedang kosong karena lonjakan permintaan saat banjir; pemesanan ulang sudah kami kirim ke pemasok.',
      santai: '{item} lagi ludes diborong sejak banjir, stok baru sudah kami pesan.',
    },
    harga: {
      empatik: 'Harga {item} mengikuti harga pemasok minggu ini; selama siaga banjir kami tidak menaikkan harga barang darurat.',
      formal: 'Harga {item} disesuaikan dengan harga pemasok; selama peringatan banjir harga barang darurat tidak kami naikkan.',
      santai: 'Harga {item} ikut harga pemasok minggu ini, tapi barang darurat banjir nggak kami naikkan.',
    },
    lain: {
      empatik: 'Terima kasih sudah jujur soal {topic} di ulasan Anda tentang {item}.',
      formal: 'Masukan Anda mengenai {topic} untuk {item} sudah kami teruskan ke kepala toko.',
      santai: 'Soal {topic} buat {item} udah kami catat dan teruskan ke kepala toko.',
    },
  },
  en: {
    pengiriman: {
      empatik: 'We know waiting {days} day(s) for the {item} of {order} to {desa} is hard, especially with the water rising.',
      formal: 'Order {order} ({item}) to {desa} is {days} day(s) late because the roads into {kec} are flooded.',
      santai: '{order} with the {item} is stuck {days} day(s), the route to {desa} is under water.',
    },
    stok: {
      empatik: 'Sorry, the {item} sold out after demand jumped with the flood; new stock is already ordered.',
      formal: 'The {item} is out of stock after the flood demand surge; a reorder has been sent to the supplier.',
      santai: 'The {item} got cleared out since the flood, new stock is on order.',
    },
    harga: {
      empatik: 'The {item} price follows our supplier this week; during the flood alert we do not raise emergency item prices.',
      formal: 'The {item} price follows the supplier price; emergency items are not marked up during the flood alert.',
      santai: 'The {item} price follows the supplier this week, but flood items are not marked up.',
    },
    lain: {
      empatik: 'Thank you for being honest about the {topic} of the {item}.',
      formal: 'Your feedback on the {topic} of the {item} has been passed to the store manager.',
      santai: 'Noted on the {topic} of the {item}, passed to the store manager.',
    },
  },
}

const ACT: Record<L, string[]> = {
  id: [
    'Sopir kami berangkat lagi ke {desa} begitu jalur aman; perkiraan tiba kami kirim lewat pesan hari ini.',
    '{item} untuk Anda sudah kami sisihkan di gudang, jadi tidak ikut habis.',
    'Kalau mendesak, {item} bisa diambil sendiri di {market} hari ini; tunjukkan nomor {ref}.',
    'Kami cek ulang rute ke Kec. {kec} tiap jam dan kabari Anda saat {ref} berangkat.',
    'Jadwal kirim ulang {ref} bisa Anda pilih sendiri, pagi atau sore.',
  ],
  en: [
    'Our driver heads to {desa} again as soon as the road is safe; we will message you an ETA today.',
    'We have set aside your {item} in the warehouse so it will not sell out.',
    'If it is urgent, you can pick up the {item} at {market} today; show the number {ref}.',
    'We re-check the route to {kec} every hour and will tell you when {ref} leaves.',
    'You can choose the new delivery slot for {ref}, morning or afternoon.',
  ],
}

const CLOSE: Record<L, Record<Tone, string[]>> = {
  id: {
    empatik: ['Kami kabari lagi soal {ref} sebelum pukul 12.00.', 'Terima kasih sudah tetap percaya pada kami untuk {ref}.', 'Semoga {ref} cepat sampai dan rumah Anda aman.', 'Kalau ada yang kurang soal {ref}, balas pesan ini saja.', 'Kami pantau sendiri {ref} sampai di tangan Anda.'],
    formal: ['Informasi lanjutan mengenai {ref} kami sampaikan melalui pesan resmi.', 'Kami siap membantu bila ada pertanyaan tentang {ref}.', 'Atas pengertian Anda terkait {ref}, kami ucapkan terima kasih.', 'Status {ref} dapat Anda tanyakan ke admin kami kapan saja.', 'Kami pastikan {ref} ditangani hari ini.'],
    santai: ['Nanti kami kabarin lagi soal {ref} ya!', 'Makasih udah sabar nungguin {ref}.', 'Semoga {ref} cepet nyampe, tetap aman ya!', 'Kalau masih ada yang ganjel soal {ref}, chat aja.', 'Kami kawal {ref} sampai beres, ya.'],
  },
  en: {
    empatik: ['We will update you on {ref} before noon.', 'Thank you for still trusting us with {ref}.', 'We hope {ref} arrives soon and your home stays safe.', 'If anything about {ref} is still wrong, just reply here.', 'We are personally tracking {ref} until it reaches you.'],
    formal: ['Further information on {ref} will follow by official message.', 'We are glad to help with any question about {ref}.', 'Thank you for your understanding regarding {ref}.', 'You may ask our admin about the status of {ref} at any time.', 'We will make sure {ref} is handled today.'],
    santai: ['We will ping you about {ref} again!', 'Thanks for hanging on for {ref}.', 'Hope {ref} gets there soon, stay safe!', 'Anything else bugging you about {ref}? Just chat us.', 'We will stay on {ref} until it is done.'],
  },
}

const TOPIC: Record<L, Record<BrandMention['topic'], string>> = {
  id: { pengiriman: 'pengiriman', kualitas: 'kualitas', harga: 'harga', layanan: 'layanan', stok: 'stok' },
  en: { pengiriman: 'delivery', kualitas: 'quality', harga: 'price', layanan: 'service', stok: 'stock' },
}

const put = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (m, k: string) => v[k] ?? m)

/** one draft: opening + topic sentence + action (delivery only) + closing, then the signature line */
export function draftReply(x: ReplyIn, tone: Tone, i: number, sign: string, market: string): string {
  const l = x.lang
  const item = x.item ?? (l === 'id' ? 'pesanan Anda' : 'your order')
  const ref = x.orderCode ?? item
  const v = { h: x.handle, item, order: x.orderCode ?? item, desa: x.desa || x.kec, kec: x.kec || x.desa, days: String(x.daysLate ?? 1), ref, market, topic: TOPIC[l][x.topic] }
  const k = x.topic === 'pengiriman' || x.topic === 'stok' || x.topic === 'harga' ? x.topic : 'lain'
  const parts = [OPEN[l][tone][i % 5]!, MID[l][k][tone]]
  if (k === 'pengiriman') parts.push(ACT[l][i % 5]!)
  else if (k === 'stok') parts.push(l === 'id' ? 'Begitu {item} datang, Anda kami kabari lebih dulu.' : 'As soon as the {item} arrives, you will hear from us first.')
  parts.push(CLOSE[l][tone][i % 5]!)
  return `${parts.map((p) => put(p, v)).join(' ')}\n${sign}`
}

/** "— Tim <shop>" (Brand Manager) or "— <first name>, pemilik" (owner) */
export const signature = (owner: boolean, shop: string, first: string, lang: L): string =>
  owner ? (lang === 'id' ? `— ${first}, pemilik` : `— ${first}, owner`) : lang === 'id' ? `— Tim ${shop}` : `— ${shop} team`
