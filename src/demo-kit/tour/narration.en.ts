/** tour/narration.en.ts — narration of chapters 1–20 (≤ 60 words each). {placeholders} come from the world (world-steps.ts chapterFacts). */
import type { Narration } from './types'

const N: Narration = {
  1: {
    title: 'Rain cells move in from upstream',
    body: 'At six in the morning, rain cells move in from upstream. Siaga Wilayah runs the six-hour forecast: {n} districts on the rain path ({kecs}) enter the flood watch zone, with rainfall peaking at {mm} mm/h.',
    happened: ['The +6 h rain forecast ran', '{n} districts in the watch zone'],
    caps: ['It starts with the weather forecast', 'The +6 h forecast plays on the map', 'Map layers: rain, rivers, villages'],
  },
  2: {
    title: 'Early warning sent',
    body: 'At 06:20 a flood warning for {kec} district goes out. Siaga Wilayah sends it to {camat} district head and {k} village heads; {w} residents in the zone receive it on their phones. {r} recipients in total, all on the data trail.',
    happened: ['Flood warning issued', '{r} recipients: district head, village heads, residents', 'Sapa Warga shows it on a resident’s phone'],
    caps: ['Flood warning for {kec} issued', 'Recipients: district and village heads in the zone', 'Send to {r} recipients', 'The warning on a resident’s phone'],
  },
  3: {
    title: 'The morning briefing writes itself',
    body: 'At seven, Meja Pimpinan assembles the morning briefing on its own: {items} items from {products} products, each linked to its source. The regional head asks which village is most at risk; the answer points to {kec} district, with its sources.',
    happened: ['{items}-item briefing assembled', 'A data question answered with sources'],
    caps: ['Compose the morning briefing', 'Listen to the briefing', 'Ask: which village is most at risk?'],
  },
  4: {
    title: 'Ibu Siti’s voice note',
    body: 'Ibu Siti Aminah from {desa} village sends a voice note in the regional language. Sapa Warga translates it, opens ticket {code} and groups {k} nearby flood complaints into one cluster that links straight to the flood warning.',
    happened: ['Ticket {code} from a voice note', 'A cluster of {k} flood complaints', 'Flood confirmed by residents'],
    caps: ['A voice note in the regional language', 'Officer console: ticket {code}', 'A cluster of {k} complaints around {desa}'],
  },
  5: {
    title: 'Coordination meeting and dispositions',
    body: 'The flood coordination meeting runs; minutes and {tasks} follow-ups are written during the meeting. The regional head’s instruction from the complaint cluster becomes a letter and dispositions that go straight to {opd1} and {opd2}.',
    happened: ['Minutes and {tasks} follow-ups written', 'Dispositions to {opd1} and {opd2}'],
    caps: ['Play the meeting recording', 'The minutes write themselves', 'Follow-ups assigned to agencies'],
  },
  6: {
    title: 'The dam-burst hoax',
    body: 'At ten, a "dam burst" story spreads: {posts} posts within minutes. Radar Isu flags it as a hoax using the river gauge data, and an official clarification goes out {m} minutes after the rumour was detected.',
    happened: ['{posts} rumour posts detected', 'Clarification out within {m} minutes'],
    caps: ['A burst of "dam burst" posts', 'Official clarification published', 'Sentiment starts to recover'],
  },
  7: {
    title: 'The emergency pump package checked',
    body: 'Awas Belanja checks the emergency water-pump package: the estimate is {gap}% above market prices ({overpay} gap, simulated) and {aff} bidders are affiliated. The advice: correct the estimate and invite local SMEs through Katalog Lokal.',
    happened: ['Estimate {gap}% above market', '{aff} affiliated bidders', 'Local SMEs invited'],
    caps: ['Estimate versus market price', 'Run the package analysis', 'Advice: invite local SMEs'],
  },
  8: {
    title: 'Needs matched to local SMEs',
    body: 'The need for {bags} sandbags and {tarps} tarps is matched to local SMEs that carry the Verified and Tax Tidy badges: {matches} matches. The order goes to {biz}.',
    happened: ['{matches} SMEs matched', 'Order sent to {biz}'],
    caps: ['The SME matching board', 'Order sent to {biz}'],
  },
  9: {
    title: 'A new SME passes verification',
    body: '{owner}’s business, {biz}, is verified by Kenal Mitra: documents, location and owner all match. The Verified badge appears in Katalog Lokal at once; {verified} businesses are now verified.',
    happened: ['KYB for {biz} passed', 'Badge appears in Katalog Lokal'],
    caps: ['Start the KYB check', 'Check the business location', 'Approve the partner'],
  },
  10: {
    title: 'Emergency tender, bid sent',
    body: 'The hardware store gets an alert for an emergency sandbag and tarp tender worth {hps} (simulated). Its win score is {p}%; the bid document is assembled and sent without retyping any business data.',
    happened: ['Win score {p}%', 'Bid sent'],
    caps: ['Win score {p}%', 'Bid sent'],
  },
  11: {
    title: 'Demand jumps, automatic PO',
    body: 'Forecast demand for {item} jumps {x}% because of the flood. Toko Autopilot prepares PO {po}; it goes to {supplier}, and the supplier replies with a delivery time.',
    happened: ['{item} demand +{x}%', 'PO {po} sent', 'The supplier replied'],
    caps: ['Flood banner: demand is rising', 'The demand forecast chart', 'Send the PO to the supplier', 'The supplier’s reply arrives'],
  },
  12: {
    title: 'Coaching for a new cashier',
    body: 'Sales conversations are scored automatically, criterion by criterion. {agent}, a new cashier, gets coaching right at the moment that was missed, with example sentences.',
    happened: ['Problem moment marked', 'Coaching assigned to {agent}'],
    caps: ['The problem moment in the recording', 'Coaching assigned'],
  },
  13: {
    title: 'Receipt to ledger, tax ready',
    body: 'The stock purchase receipt from that PO becomes a balanced journal entry. Pajak Beres computes the income tax and marks this month’s tax status: ready to file.',
    happened: ['Receipt turned into a journal entry', 'Tax status: ready to file'],
    caps: ['Process the purchase receipt', 'This month’s tax is ready to file'],
  },
  14: {
    title: 'Business score up, capital approved',
    body: 'Tidy books and taxes raise the business score to {score} ({band}). The owner shares the data; {lender} reviews it and approves working capital of {plafon} (simulated).',
    happened: ['Business score {score} ({band})', 'Working capital {plafon} approved'],
    caps: ['The business score rises', 'The cooperative approves the capital'],
  },
  15: {
    title: 'Bulk replies to complaints',
    body: '"Slow delivery" complaints are up {x}% since the flood. Pantau Merek groups them; {n} empathetic replies go out at once, each naming the customer’s own order.',
    happened: ['Complaint spike +{x}%', '{n} replies sent'],
    caps: ['The "slow delivery" cluster', '{n} empathetic replies sent'],
  },
  16: {
    title: 'Bulk aid verification',
    body: '{n} flood-aid applicant files are checked in seconds; {d} pairs of duplicate ID numbers are held before any money goes out.',
    happened: ['{n} files checked', '{d} duplicate ID pairs held'],
    caps: ['Bulk mode', 'Process {n} files', '{d} duplicate ID pairs found'],
  },
  17: {
    title: 'Prices rise, market operation',
    body: '{komoditas} prices at {pasar} start to rise; the early warning went out {days} days before the peak. A market operation is recommended, approved and running; it cuts the price spike’s peak by about {y}% (simulated).',
    happened: ['Early price warning for {komoditas}', 'Market operation running'],
    caps: ['Early price warning', 'Market operation running'],
  },
  18: {
    title: 'Impact on district economies',
    body: 'The flood lowers the economic index of {kec} district by about {d} points; the market operation holds the fall back. Districts with too few businesses are hidden to keep them anonymous.',
    happened: ['{kec} index down {d} points', 'Market operation effect recorded'],
    caps: ['District economic index map', 'Flood and programme impact recorded'],
  },
  19: {
    title: 'Closing the day and the data trail',
    body: 'The day closes at Meja Pimpinan. GAMADA Inti traces Ibu Siti’s complaint across six products, from a voice note to an order with a local SME; {events} events were recorded today.',
    happened: ['Complaint traced across {lanes} products', '{events} events recorded'],
    caps: ['The day’s summary at Meja Pimpinan', 'Play Ibu Siti’s data trail', 'Every node = one Audit Log row'],
  },
  20: {
    title: 'Today in {region}',
    body: 'One day, one world of data: citizen complaints, flood warnings, procurement, small businesses and market prices all connect. Take the summary home or try the products yourself.',
    happened: [],
    caps: [],
  },
}
export default N
