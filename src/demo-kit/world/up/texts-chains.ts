/**
 * world/up/texts-chains.ts — texts only the chain reactions use (PO reasons, the flood burst, recovery posts).
 */
import type { Bi } from '../types'

/* ------------------------------------------------------------------ PO reasons (C15) */
export const PO_REASON: Bi[] = [
  { id: 'Permintaan {pct} karena {cause}: {item} habis dalam {days} hari', en: 'Demand {pct} because of {cause}: {item} runs out in {days} days' },
  { id: '{cause} menaikkan permintaan {pct}; stok {item} cukup {days} hari', en: '{cause} lifts demand {pct}; {item} stock lasts {days} days' },
]

/** C28 burst: delivery complaints after the flood (8, then one per hour), each distinct */
export const BURST_DELIVERY: Bi[] = [
  { id: 'Pesanan {order} ({item}) ke {desa} belum sampai, sudah telat {days} hari. Jalannya banjir ya?', en: 'Order {order} ({item}) to {desa} hasn’t arrived, {days} days late. Is the road flooded?' },
  { id: 'Nunggu {item} dari tadi pagi, {order} belum ada kabar ke {desa}.', en: 'Waiting since this morning for {item}; no news on {order} to {desa}.' },
  { id: '{order} telat {days} hari, padahal butuh {item} sebelum air naik di {desa}.', en: '{order} is {days} days late and I need {item} before the water rises in {desa}.' },
  { id: 'Admin, kiriman {item} ({order}) ke {desa} kapan? Tidak ada ETA sama sekali.', en: 'Admin, when does the {item} ({order}) reach {desa}? No ETA at all.' },
  { id: 'Sudah bayar {item} kemarin, {order} belum jalan ke {desa}. Mohon kabarnya.', en: 'Paid for {item} yesterday; {order} hasn’t left for {desa}. Please update me.' },
  { id: 'Kurirnya tidak bisa dihubungi, {item} untuk {desa} masih tertahan ({order}).', en: 'Can’t reach the courier; {item} for {desa} is still held ({order}).' },
  { id: '{days} hari menunggu {item}, pesanan {order} ke {desa} tanpa kabar.', en: '{days} days waiting for {item}; order {order} to {desa}, no word.' },
  { id: 'Tolong prioritaskan {order}, {item} dibutuhkan posko di {desa}.', en: 'Please prioritise {order}; the post in {desa} needs {item}.' },
  { id: 'Kiriman {item} {order} ke {desa} mundur lagi, sudah {days} hari.', en: '{item} delivery {order} to {desa} slipped again; {days} days now.' },
  { id: 'Status {order} masih “dikemas” sejak {days} hari lalu. {desa} sudah tergenang.', en: '{order} has said “packing” for {days} days. {desa} is already flooded.' },
  { id: 'Apa {item} untuk {desa} bisa diambil sendiri saja? {order} belum datang.', en: 'Can I just pick up the {item} for {desa}? {order} hasn’t come.' },
  { id: 'Pesanan {item} ({order}) belum diantar, akses ke {desa} memang susah tapi tolong dikabari.', en: '{item} ({order}) not delivered; access to {desa} is hard, but please keep me posted.' },
  { id: 'Telat {days} hari untuk {order}. Saya beli {item} di tempat lain dulu kalau begini.', en: '{order} is {days} days late. I may buy {item} elsewhere at this rate.' },
  { id: 'Ada info pengiriman ke {desa}? {order} ({item}) belum muncul.', en: 'Any news on deliveries to {desa}? {order} ({item}) hasn’t shown up.' },
]
export const BURST_STOK: Bi = { id: '{item} kosong di {outlet} pagi ini, padahal mau dipakai di {desa}.', en: '{item} was out of stock at {outlet} this morning; I needed it in {desa}.' }
export const BURST_HARGA: Bi = { id: 'Harga {item} di {outlet} naik waktu banjir begini, kurang pas.', en: '{item} at {outlet} costs more during the flood; not fair.' }
/** C29 follow-ups of a replied author / after an announcement (positive) */
export const RECOVERY_TEXT: Bi[] = [
  { id: 'Terima kasih sudah dibalas, {order} katanya dikirim begitu jalan ke {desa} bisa dilewati.', en: 'Thanks for replying; {order} ships as soon as the road to {desa} is passable.' },
  { id: 'Sudah dapat kabar dari toko soal {item}, saya ambil sendiri saja.', en: 'Got an update from the shop about {item}; I’ll pick it up myself.' },
  { id: 'Responnya cepat, jadwal ulang {order} ke {desa} sudah jelas.', en: 'Quick response; {order} to {desa} is rescheduled clearly.' },
  { id: 'Pengumuman tokonya jelas, {item} bisa diambil di {market}.', en: 'The shop’s notice is clear; {item} can be collected at {market}.' },
  { id: 'Salut, toko tetap kasih kabar walau banjir. {item} sudah saya ambil.', en: 'Respect: the shop kept us posted despite the flood. Collected the {item}.' },
  { id: 'Akhirnya ada info resmi soal kiriman ke {kec}. Terima kasih.', en: 'Finally an official update on deliveries to {kec}. Thank you.' },
]
