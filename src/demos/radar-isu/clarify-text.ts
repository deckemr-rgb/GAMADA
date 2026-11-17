/**
 * demos/radar-isu/clarify-text.ts — the simulated clarification package in three tones (press release, social caption
 * ≤ 600 characters, 3–5 infographic points), built only from facts on screen (hoax claim, dam gauge, times). Officials
 * by title only; no invented phone numbers or links. Shape = the shared 'clarification' structured kind.
 */
import type { RadarCtx } from './ctx'

export type Tone = 'tegas' | 'menenangkan' | 'informatif'
type L = 'id' | 'en'

export interface ClarificationData {
  tone: Tone
  pressRelease: string
  socialCaption: string
  infographicPoints: string[]
}

export const CLARIFY_TEXT = {
  id: {
    answer:
      'Draf klarifikasi nada {tone} siap: rilis pers, caption media sosial, dan poin infografis. Bukti utama: tinggi muka air {level} m, di bawah batas siaga {siaga} m (data simulasi Siaga Wilayah).',
    tone: {
      tegas: 'tegas',
      menenangkan: 'menenangkan',
      informatif: 'informatif',
    } as Record<Tone, string>,
  },
  en: {
    answer:
      'A {tone} clarification is ready: press release, social caption and infographic points. Key evidence: water level {level} m, below the {siaga} m alert level (Siaga Wilayah, simulated data).',
    tone: {
      tegas: 'firm',
      menenangkan: 'reassuring',
      informatif: 'informative',
    } as Record<Tone, string>,
  },
}

/** tone from free text in ID / EN / Basa Jawa (default 'menenangkan') */
export function toneFromText(t: string): Tone {
  if (/tegas|firm|keras|strong/i.test(t)) return 'tegas'
  if (/informatif|informative|data|jelas/i.test(t)) return 'informatif'
  return 'menenangkan'
}

const nf = (n: number, lang: L, d = 1) =>
  n.toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB', {
    maximumFractionDigits: d,
    minimumFractionDigits: d,
  })
const tm = (hhmm: string, lang: L) => (lang === 'id' ? hhmm.replace(':', '.') : hhmm)

export function clarification(x: RadarCtx, tone: Tone, lang: L): ClarificationData {
  const dam = x.dam?.name ?? (lang === 'id' ? 'bendungan' : 'the dam')
  const level = nf(x.dam?.level ?? 0, lang)
  const siaga = nf(x.dam?.siaga ?? 0, lang)
  const normal = nf(x.dam?.normal ?? 0, lang)
  const at = tm(x.dam?.updatedAt ?? x.now, lang)
  const first = tm(x.hoax?.firstPostAt ?? x.now, lang)
  const gov = lang === 'id' ? `Pemerintah ${x.region}` : `The ${x.region} government`
  const region = x.region
  if (lang === 'id') {
    const P: Record<Tone, ClarificationData> = {
      tegas: {
        tone,
        pressRelease: [
          `KLARIFIKASI: Kabar “${dam} Jebol” adalah HOAKS`,
          `${gov} menegaskan bahwa kabar yang beredar di media sosial sejak pukul ${first} tentang jebolnya ${dam} TIDAK BENAR.`,
          `Data pos pantau Siaga Wilayah pukul ${at} mencatat tinggi muka air ${dam} ${level} m, di bawah batas siaga ${siaga} m. Tidak ada laporan kerusakan struktur bendungan dan tidak ada perintah evakuasi terkait bendungan.`,
          `“Kami minta masyarakat berhenti meneruskan pesan berantai tersebut. Informasi kebencanaan resmi hanya disampaikan melalui kanal resmi pemerintah daerah,” tegas Kepala BPBD.`,
        ].join('\n\n'),
        socialCaption: `[HOAKS] ${dam} TIDAK jebol. Tinggi muka air ${level} m, di bawah batas siaga ${siaga} m (pos pantau, pukul ${at}). Jangan teruskan pesan berantai. Info kebencanaan resmi hanya dari kanal resmi Pemkab. #CekFakta #${region.replace(/\s+/g, '')}`,
        infographicPoints: [
          `${dam} AMAN, tidak jebol`,
          `Tinggi muka air ${level} m, batas siaga ${siaga} m`,
          'Tidak ada perintah evakuasi terkait bendungan',
          'Berhenti meneruskan pesan berantai',
          'Info resmi hanya dari kanal pemda',
        ],
      },
      menenangkan: {
        tone,
        pressRelease: [
          `Warga Tidak Perlu Panik, ${dam} dalam Kondisi Aman`,
          `${gov} memahami kekhawatiran warga setelah beredar kabar tentang ${dam} sejak pukul ${first}. Kami sampaikan bahwa bendungan dalam kondisi aman dan terus dipantau.`,
          `Pukul ${at}, tinggi muka air tercatat ${level} m, masih di bawah batas siaga ${siaga} m. Petugas berjaga di lokasi dan akan segera memberi tahu warga melalui kanal resmi bila ada perubahan.`,
          `“Terima kasih kepada warga yang lebih dulu bertanya sebelum menyebarkan. Mari saling menenangkan dan saling mengingatkan,” ujar Bupati.`,
        ].join('\n\n'),
        socialCaption: `Bapak/Ibu, ${dam} dalam kondisi AMAN. Tinggi muka air ${level} m, masih di bawah batas siaga ${siaga} m (pukul ${at}). Petugas terus berjaga. Bila menerima kabar “bendungan jebol”, mohon tidak diteruskan dan cek info resmi Pemkab. Terima kasih sudah saling menjaga.`,
        infographicPoints: [
          `${dam} aman dan terus dipantau`,
          `Air ${level} m, di bawah batas siaga ${siaga} m`,
          'Petugas berjaga di lokasi',
          'Tanya dulu sebelum menyebarkan',
        ],
      },
      informatif: {
        tone,
        pressRelease: [
          `Fakta Kondisi ${dam} Hari Ini`,
          `Menanggapi kabar yang beredar sejak pukul ${first}, ${gov} menyampaikan data pemantauan ${dam}.`,
          `Tinggi muka air pukul ${at}: ${level} m. Rujukan: normal ${normal} m, batas siaga ${siaga} m. Pemantauan dilakukan setiap jam oleh pos pantau Siaga Wilayah, dan tidak ada laporan kerusakan struktur.`,
          `“Peringatan dini akan disiarkan bila tinggi muka air mendekati batas siaga, melalui kanal resmi dan pesan ke warga di zona terdampak,” jelas Kepala BPBD.`,
        ].join('\n\n'),
        socialCaption: `Fakta ${dam} pukul ${at}: tinggi muka air ${level} m (normal ${normal} m, batas siaga ${siaga} m). Dipantau tiap jam, tidak ada kerusakan struktur. Peringatan dini dikirim lewat kanal resmi bila air mendekati batas siaga. Kabar “bendungan jebol” tidak sesuai data.`,
        infographicPoints: [
          `Tinggi muka air: ${level} m`,
          `Normal ${normal} m · siaga ${siaga} m`,
          'Dipantau setiap jam',
          'Tidak ada kerusakan struktur',
          'Peringatan dini lewat kanal resmi',
        ],
      },
    }
    return P[tone]
  }
  const P: Record<Tone, ClarificationData> = {
    tegas: {
      tone,
      pressRelease: [
        `CLARIFICATION: The “${dam} Burst” Story Is a HOAX`,
        `${gov} states that the story circulating on social media since ${first} about ${dam} bursting is NOT TRUE.`,
        `The Siaga Wilayah gauge at ${at} recorded the ${dam} water level at ${level} m, below the ${siaga} m alert level. No structural damage has been reported and no dam-related evacuation has been ordered.`,
        `“We ask the public to stop forwarding the chain message. Official disaster information is only issued through the regional government’s official channels,” said the Head of the Disaster Management Agency.`,
      ].join('\n\n'),
      socialCaption: `[HOAX] ${dam} has NOT burst. Water level ${level} m, below the ${siaga} m alert level (gauge, ${at}). Do not forward the chain message. Official disaster info only comes from the government’s official channels. #FactCheck`,
      infographicPoints: [
        `${dam} is SAFE, it has not burst`,
        `Water level ${level} m, alert level ${siaga} m`,
        'No dam-related evacuation',
        'Stop forwarding chain messages',
        'Official info only from government channels',
      ],
    },
    menenangkan: {
      tone,
      pressRelease: [
        `No Need to Panic: ${dam} Is Safe`,
        `${gov} understands residents’ concern after a story about ${dam} began circulating at ${first}. The dam is safe and under constant watch.`,
        `At ${at} the water level was ${level} m, still below the ${siaga} m alert level. Officers are on site and will inform residents through official channels if anything changes.`,
        `“Thank you to everyone who asked before sharing. Let us keep each other calm and informed,” said the Regent.`,
      ].join('\n\n'),
      socialCaption: `${dam} is SAFE. Water level ${level} m, still below the ${siaga} m alert level (${at}). Officers are on watch. If you receive a “dam burst” message, please do not forward it and check the government’s official info. Thank you for looking out for each other.`,
      infographicPoints: [`${dam} is safe and monitored`, `Water ${level} m, below the ${siaga} m alert level`, 'Officers on site', 'Ask before you share'],
    },
    informatif: {
      tone,
      pressRelease: [
        `The Facts on ${dam} Today`,
        `Responding to the story circulating since ${first}, ${gov} shares the ${dam} monitoring data.`,
        `Water level at ${at}: ${level} m. Reference: normal ${normal} m, alert level ${siaga} m. The Siaga Wilayah gauge reports every hour and no structural damage has been found.`,
        `“Early warnings are broadcast when the level nears the alert threshold, through official channels and messages to residents in the affected zone,” explained the Head of the Disaster Management Agency.`,
      ].join('\n\n'),
      socialCaption: `${dam} facts at ${at}: water level ${level} m (normal ${normal} m, alert ${siaga} m). Monitored hourly, no structural damage. Early warnings go out on official channels if the level nears the alert threshold. The “dam burst” story does not match the data.`,
      infographicPoints: [
        `Water level: ${level} m`,
        `Normal ${normal} m · alert ${siaga} m`,
        'Monitored every hour',
        'No structural damage',
        'Early warnings via official channels',
      ],
    },
  }
  return P[tone]
}
