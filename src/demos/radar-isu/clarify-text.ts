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
  const level = nf(x.dam?.level ?? 0, lang, 2)
  const siaga = nf(x.dam?.siaga ?? 0, lang)
  const normal = nf(x.dam?.normal ?? 0, lang)
  const at = tm(x.dam?.updatedAt ?? x.now, lang)
  const first = tm(x.hoax?.firstPostAt ?? x.now, lang)
  const gov = lang === 'id' ? `Pemerintah ${x.region}` : `The ${x.region} government`
  const region = x.region
  // Sapa Warga holds real flood reports where the rumour points: the release separates "the dam has not burst" from
  // the flooding residents report, and says what they report (an evacuation request, a seeping village embankment,
  // water inside homes), never "nothing is happening" while water is in houses
  const sw = x.sapa
  const rv = x.river
  const factsId = sw ? [sw.inHomes ? 'air masuk ke dalam rumah' : '', sw.evac ? `${sw.evac} permintaan evakuasi` : '', sw.dike ? 'tanggul kecil desa yang rembes' : ''].filter(Boolean) : []
  const factsEn = sw
    ? [sw.inHomes ? 'water inside homes' : '', sw.evac ? `${sw.evac} evacuation request${sw.evac === 1 ? '' : 's'}` : '', sw.dike ? 'a small village embankment seeping' : ''].filter(Boolean)
    : []
  const swIdP = sw
    ? `Banjir di Kec. ${sw.kecamatan} yang dilaporkan warga lewat Sapa Warga (${sw.count} laporan sejak pukul ${tm(sw.since, lang)}${sw.desa ? `, terakhir dari ${sw.desa}` : ''}${factsId.length ? `: ${factsId.join(', ')}` : ''}) nyata dan tidak berasal dari bendungan. Laporan tersebut sudah diteruskan ke petugas untuk ditangani.${sw.evac ? ' Warga yang membutuhkan bantuan evakuasi diminta melapor lewat Sapa Warga atau posko terdekat.' : ' Warga di lokasi banjir tetap diminta waspada dan melapor bila air naik.'}`
    : ''
  const swEnP = sw
    ? `The flooding residents reported through Sapa Warga in ${sw.kecamatan} (${sw.count} reports since ${sw.since}${sw.desa ? `, the latest from ${sw.desa}` : ''}${factsEn.length ? `: ${factsEn.join(', ')}` : ''}) is real and does not come from the dam. The reports have been passed to field officers.${sw.evac ? ' Residents who need help to evacuate should report through Sapa Warga or the nearest post.' : ' Residents in the flooded spots should stay alert and report if the water rises.'}`
    : ''
  const rvIdP = rv
    ? `Sungai ${rv.name.replace(/^Sungai\s+/i, '')} berstatus ${rv.status === 'awas' ? 'AWAS' : 'SIAGA'} (${nf(rv.level, lang, 2)} m, batas siaga ${nf(rv.siaga, lang)} m, pukul ${tm(rv.at, lang)}); warga bantaran sungai tetap diminta waspada.`
    : ''
  const rvEnP = rv
    ? `The river (${rv.name}) is at ${rv.status === 'awas' ? 'WARNING' : 'WATCH'} level (${nf(rv.level, lang, 2)} m, watch level ${nf(rv.siaga, lang)} m, ${rv.at}); riverbank residents should stay alert.`
    : ''
  const swIdPt = sw ? `Banjir di ${sw.kecamatan} nyata${sw.evac ? ', ada permintaan evakuasi' : ''}: ditangani, bukan dari bendungan` : ''
  const swEnPt = sw ? `Flooding in ${sw.kecamatan} is real${sw.evac ? ', with an evacuation request' : ''}: being handled, not from the dam` : ''
  const rvIdPt = rv ? `Sungai berstatus ${rv.status === 'awas' ? 'AWAS' : 'SIAGA'}: warga bantaran tetap waspada` : ''
  const rvEnPt = rv ? `River at ${rv.status === 'awas' ? 'WARNING' : 'WATCH'} level: riverbank residents stay alert` : ''
  // a reassuring tone must not sound like "all is calm" when people need evacuating or the river is at alert level
  const serious = !!(sw?.evac || sw?.dike || rv)
  const withSw = (paras: string[], i: number, para: string) => {
    const add = [para, lang === 'id' ? rvIdP : rvEnP].filter(Boolean)
    return add.length ? [...paras.slice(0, i), ...add, ...paras.slice(i)] : paras
  }
  const ptsSw = (pts: string[], pt: string) => {
    const add = [pt, lang === 'id' ? rvIdPt : rvEnPt].filter(Boolean)
    return [...pts.slice(0, 3), ...add, ...pts.slice(3)].slice(0, 6)
  }
  if (lang === 'id') {
    const P: Record<Tone, ClarificationData> = {
      tegas: {
        tone,
        pressRelease: withSw(
          [
            `KLARIFIKASI: Kabar “${dam} Jebol” adalah HOAKS`,
            `${gov} menegaskan bahwa kabar yang beredar di media sosial sejak pukul ${first} tentang jebolnya ${dam} TIDAK BENAR.`,
            `Pembacaan terakhir pos pantau Siaga Wilayah (pukul ${at}) mencatat tinggi muka air ${dam} ${level} m, di bawah batas siaga ${siaga} m. Tidak ada laporan kerusakan struktur bendungan dan tidak ada perintah evakuasi terkait bendungan.`,
            `“Kami minta masyarakat berhenti meneruskan pesan berantai tersebut. Informasi kebencanaan resmi hanya disampaikan melalui kanal resmi pemerintah daerah,” tegas Kepala BPBD.`,
          ],
          3,
          swIdP,
        ).join('\n\n'),
        socialCaption: `[HOAKS] ${dam} TIDAK jebol. Tinggi muka air ${level} m, di bawah batas siaga ${siaga} m (pos pantau, pukul ${at}). Jangan teruskan pesan berantai. Info kebencanaan resmi hanya dari kanal resmi Pemkab. #CekFakta #${region.replace(/\s+/g, '')}`,
        infographicPoints: ptsSw(
          [
            serious ? `${dam} TIDAK jebol` : `${dam} AMAN, tidak jebol`,
            `Tinggi muka air ${level} m, batas siaga ${siaga} m`,
            'Tidak ada perintah evakuasi terkait bendungan',
            'Berhenti meneruskan pesan berantai',
            'Info resmi hanya dari kanal pemda',
          ],
          swIdPt,
        ),
      },
      menenangkan: {
        tone,
        pressRelease: withSw(
          [
            sw ? `${dam} Tidak Jebol; Banjir di ${sw.kecamatan} Sedang Ditangani` : serious ? `${dam} Tidak Jebol; Tetap Waspada Banjir` : `Warga Tidak Perlu Panik, ${dam} dalam Kondisi Aman`,
            `${gov} memahami kekhawatiran warga setelah beredar kabar tentang ${dam} sejak pukul ${first}. Kami sampaikan bahwa bendungan dalam kondisi aman dan terus dipantau.`,
            `Pembacaan terakhir pos pantau (pukul ${at}) mencatat tinggi muka air ${level} m, masih di bawah batas siaga ${siaga} m. Petugas berjaga di lokasi dan akan segera memberi tahu warga melalui kanal resmi bila ada perubahan.`,
            serious
              ? `“Terima kasih kepada warga yang lebih dulu bertanya sebelum menyebarkan. Bendungan tidak jebol, tetapi banjir di sejumlah titik nyata: mari saling mengingatkan untuk tetap waspada dan memakai kanal resmi,” ujar Kepala Diskominfo.`
              : `“Terima kasih kepada warga yang lebih dulu bertanya sebelum menyebarkan. Mari saling menenangkan dan saling mengingatkan,” ujar Kepala Diskominfo.`,
          ],
          3,
          swIdP,
        ).join('\n\n'),
        socialCaption: serious
          ? `Bapak/Ibu, ${dam} TIDAK jebol. Tinggi muka air ${level} m, masih di bawah batas siaga ${siaga} m (pukul ${at}). Banjir di beberapa titik${sw ? ` (Kec. ${sw.kecamatan})` : ''} nyata dan sedang ditangani; warga bantaran tetap waspada. Mohon kabar “bendungan jebol” tidak diteruskan, cek info resmi Pemkab, dan laporkan banjir lewat Sapa Warga.`
          : `Bapak/Ibu, ${dam} dalam kondisi AMAN. Tinggi muka air ${level} m, masih di bawah batas siaga ${siaga} m (pukul ${at}). Petugas terus berjaga. Bila menerima kabar “bendungan jebol”, mohon tidak diteruskan dan cek info resmi Pemkab. Terima kasih sudah saling menjaga.`,
        infographicPoints: ptsSw(
          [
            serious ? `${dam} tidak jebol dan terus dipantau` : `${dam} aman dan terus dipantau`,
            `Air ${level} m, di bawah batas siaga ${siaga} m`,
            'Petugas berjaga di lokasi',
            'Tanya dulu sebelum menyebarkan',
          ],
          swIdPt,
        ),
      },
      informatif: {
        tone,
        pressRelease: withSw(
          [
            `Fakta Kondisi ${dam} Hari Ini`,
            `Menanggapi kabar yang beredar sejak pukul ${first}, ${gov} menyampaikan data pemantauan ${dam}.`,
            `Tinggi muka air pada pembacaan terakhir (pukul ${at}): ${level} m. Rujukan: normal ${normal} m, batas siaga ${siaga} m. Pemantauan dilakukan setiap jam oleh pos pantau Siaga Wilayah, dan tidak ada laporan kerusakan struktur.`,
            `“Peringatan dini akan disiarkan bila tinggi muka air mendekati batas siaga, melalui kanal resmi dan pesan ke warga di zona terdampak,” jelas Kepala BPBD.`,
          ],
          3,
          swIdP,
        ).join('\n\n'),
        socialCaption: `Fakta ${dam} pukul ${at}: tinggi muka air ${level} m (normal ${normal} m, batas siaga ${siaga} m). Dipantau tiap jam, tidak ada kerusakan struktur. Peringatan dini dikirim lewat kanal resmi bila air mendekati batas siaga. Kabar “bendungan jebol” tidak sesuai data.`,
        infographicPoints: ptsSw(
          [`Tinggi muka air: ${level} m`, `Normal ${normal} m · siaga ${siaga} m`, 'Dipantau setiap jam', 'Tidak ada kerusakan struktur', 'Peringatan dini lewat kanal resmi'],
          swIdPt,
        ),
      },
    }
    return P[tone]
  }
  const P: Record<Tone, ClarificationData> = {
    tegas: {
      tone,
      pressRelease: withSw(
        [
          `CLARIFICATION: The “${dam} Burst” Story Is a HOAX`,
          `${gov} states that the story circulating on social media since ${first} about ${dam} bursting is NOT TRUE.`,
          `The latest Siaga Wilayah gauge reading (${at}) recorded the ${dam} water level at ${level} m, below the ${siaga} m alert level. No structural damage has been reported and no dam-related evacuation has been ordered.`,
          `“We ask the public to stop forwarding the chain message. Official disaster information is only issued through the regional government’s official channels,” said the Head of the Disaster Management Agency.`,
        ],
        3,
        swEnP,
      ).join('\n\n'),
      socialCaption: `[HOAX] ${dam} has NOT burst. Water level ${level} m, below the ${siaga} m alert level (gauge, ${at}). Do not forward the chain message. Official disaster info only comes from the government’s official channels. #FactCheck`,
      infographicPoints: ptsSw(
        [
          serious ? `${dam} has NOT burst` : `${dam} is SAFE, it has not burst`,
          `Water level ${level} m, alert level ${siaga} m`,
          'No dam-related evacuation',
          'Stop forwarding chain messages',
          'Official info only from government channels',
        ],
        swEnPt,
      ),
    },
    menenangkan: {
      tone,
      pressRelease: withSw(
        [
          sw ? `${dam} Has Not Burst; Flooding in ${sw.kecamatan} Is Being Handled` : serious ? `${dam} Has Not Burst; Stay Alert for Flooding` : `No Need to Panic: ${dam} Is Safe`,
          `${gov} understands residents’ concern after a story about ${dam} began circulating at ${first}. The dam is safe and under constant watch.`,
          `The latest gauge reading (${at}) put the water level at ${level} m, still below the ${siaga} m alert level. Officers are on site and will inform residents through official channels if anything changes.`,
          serious
            ? `“Thank you to everyone who asked before sharing. The dam has not burst, but the flooding in some places is real: let us remind each other to stay alert and use the official channels,” said the Head of the Communications Office.`
            : `“Thank you to everyone who asked before sharing. Let us keep each other calm and informed,” said the Head of the Communications Office.`,
        ],
        3,
        swEnP,
      ).join('\n\n'),
      socialCaption: serious
        ? `${dam} has NOT burst. Water level ${level} m, still below the ${siaga} m alert level (${at}). The flooding in some places${sw ? ` (${sw.kecamatan})` : ''} is real and being handled; riverbank residents stay alert. Please do not forward the “dam burst” message, check the government’s official info and report flooding through Sapa Warga.`
        : `${dam} is SAFE. Water level ${level} m, still below the ${siaga} m alert level (${at}). Officers are on watch. If you receive a “dam burst” message, please do not forward it and check the government’s official info. Thank you for looking out for each other.`,
      infographicPoints: ptsSw(
        [serious ? `${dam} has not burst and is monitored` : `${dam} is safe and monitored`, `Water ${level} m, below the ${siaga} m alert level`, 'Officers on site', 'Ask before you share'],
        swEnPt,
      ),
    },
    informatif: {
      tone,
      pressRelease: withSw(
        [
          `The Facts on ${dam} Today`,
          `Responding to the story circulating since ${first}, ${gov} shares the ${dam} monitoring data.`,
          `Water level at the latest reading (${at}): ${level} m. Reference: normal ${normal} m, alert level ${siaga} m. The Siaga Wilayah gauge reports every hour and no structural damage has been found.`,
          `“Early warnings are broadcast when the level nears the alert threshold, through official channels and messages to residents in the affected zone,” explained the Head of the Disaster Management Agency.`,
        ],
        3,
        swEnP,
      ).join('\n\n'),
      socialCaption: `${dam} facts at ${at}: water level ${level} m (normal ${normal} m, alert ${siaga} m). Monitored hourly, no structural damage. Early warnings go out on official channels if the level nears the alert threshold. The “dam burst” story does not match the data.`,
      infographicPoints: ptsSw([`Water level: ${level} m`, `Normal ${normal} m · alert ${siaga} m`, 'Monitored every hour', 'No structural damage', 'Early warnings via official channels'], swEnPt),
    },
  }
  return P[tone]
}
