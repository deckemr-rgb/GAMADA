/**
 * Tahap 7 self-tests (run from world.selftest.ts): a region switch without reload (loadWorld fresh on another pack),
 * the flood anchor + meeting clip from any pack, the no-dam hoax variant, NIK defaults following the current region,
 * and "no undefined / NaN" in the names the scenario shows. Uses the mini fixture under a SECOND id (plan §5) and the
 * real pack of the run (REGION env, default bojonegoro).
 */
import type { RegionPack } from '../../region/types'
import { meetingBanjirFor, meetingBanjirNotesFor } from '../../media/samples'
import { makeNik, nikRegionName, parseNik } from '../../docs/nik'
import { clock } from '../clock'
import { loadWorld, world } from '../store'
import { hoaxBurst } from '../satu-daerah'
import { gaugeName } from '../sd/gauge'
import { generateWorld } from '../seed'
import { WORLD, currentRegion, rows } from '../util'
import { floodAnchor } from '../../region/anchor'

type Ok = (cond: unknown, msg: string) => void

const DEFAULT_PLACES = /Bojonegoro|Kalitidu|Ngujo|Bengawan/

/** the mini fixture as a different city: new id + names, kota (kelurahan only), no dam, its own Kemendagri codes */
function otherCity(base: RegionPack): RegionPack {
  const p = structuredClone(base) as RegionPack
  p.id = 'kota-uji'
  p.name = 'Kota Uji'
  p.shortName = 'Uji'
  p.type = 'kota'
  p.province = 'Jawa Barat'
  p.landmarks = p.landmarks.filter((l) => l.kind !== 'bendungan')
  delete p.scenario.damLandmarkId
  p.rivers = p.rivers.map((r) => ({ ...r, name: 'Sungai Uji' }))
  p.kecamatan.forEach((k, i) => {
    k.name = `Uji ${i + 1}`
    k.kemendagri = `32.73.${String(i + 1).padStart(2, '0')}`
    k.desa.forEach((d, j) => {
      d.kind = 'kelurahan'
      d.name = `Kel ${i + 1}-${j + 1}`
    })
  })
  return p
}

export async function runRegionSwitchSelftest(ok: Ok, section: (n: string) => void, packs: { label: string; pack: RegionPack }[]): Promise<void> {
  const real = packs[packs.length - 1]!.pack
  const other = otherCity(packs[0]!.pack)

  section(`tahap-7 · flood anchor + meeting clip (${packs.map((p) => p.label).join(', ')}, kota-uji)`)
  for (const p of [...packs.map((x) => x.pack), other]) {
    const a = floodAnchor(p)
    ok(!!a.kecamatanId && !!a.kecamatan && !!a.desa, `${p.id}: anchor names a kecamatan + desa (${a.kecamatan} / ${a.desa})`)
    ok(p.kecamatan.some((k) => k.id === a.kecamatanId && k.desa.some((d) => d.id === a.desaId)), `${p.id}: the anchor desa lies in the anchor kecamatan`)
    ok(a.floodKecamatan.length === p.scenario.floodKecamatanIds.filter((id) => p.kecamatan.some((k) => k.id === id)).length, `${p.id}: every flood kecamatan is named`)
    const clip = meetingBanjirFor(a)
    const notes = meetingBanjirNotesFor(a)
    const text = JSON.stringify([clip, notes])
    ok(!/undefined|NaN|\[object/.test(text), `${p.id}: meeting clip has no undefined / NaN`)
    ok(clip.segments.length === 11 && clip.speakers.some((s) => s.label.id === `Camat ${a.kecamatan}`), `${p.id}: clip keeps 11 segments, camat from the anchor`)
    if (p.id !== 'bojonegoro' && p !== packs[0]!.pack) ok(!DEFAULT_PLACES.test(text), `${p.id}: clip names no default-world place`)
    if (p.type === 'kota') ok(text.includes('Kelurahan ') && !text.includes('Desa '), `${p.id}: a kota says "Kelurahan", never "Desa"`)
  }

  section('tahap-7 · no-dam hoax variant (kota-uji)')
  const s = generateWorld(other, 42)
  const h = s.meta.facts.hoax
  ok(h.damName === 'Pintu air Sungai Uji' && h.damNameEn === 'Sungai Uji sluice gate', `no dam: the hoax is about the sluice gate (${h.damName} / ${h.damNameEn})`)
  const g = s.gauges.byId[h.gaugeId]
  ok(!!g && g.kind === 'waduk' && g.name === h.damName, 'no dam: the sluice gate has its own (simulated) gauge as evidence')
  ok(!!g && gaugeName(g).en === h.damNameEn, 'gaugeName EN of the gate reads "<river> sluice gate"')
  const burst = hoaxBurst(s, WORLD.hoaxAt)
  ok(burst.length > 0 && burst.every((m) => m.text.id.includes(h.damName) && m.text.en.includes(h.damNameEn!)), 'burst posts name the gate in ID and EN')
  ok(burst.every((m) => !m.text.id.includes('Bendungan')), 'no "Bendungan" in the no-dam posts')
  ok(!JSON.stringify(rows(s.meetings)).includes('Kalitidu'), 'meeting participants come from the anchor, not a default-world name')

  section('tahap-7 · region switch without reload (loadWorld fresh) + NIK defaults')
  await loadWorld(real, 7, { scope: 'default' })
  clock.setTime(WORLD.clockStart + 180)
  ok(world.get().regionId === real.id && currentRegion()?.id === real.id, `world + current region = ${real.id}`)
  await loadWorld(other, 7, { scope: 'default', fresh: true })
  const w = world.get()
  ok(w.regionId === 'kota-uji' && currentRegion()?.id === 'kota-uji', 'switch: world + current region = kota-uji')
  ok(clock.get().minutes === WORLD.clockStart, `switch: the clock is back at the seed start (${clock.get().minutes})`)
  const kecIds = new Set(other.kecamatan.map((k) => k.id))
  ok(rows(w.complaints).every((c) => kecIds.has(c.kecamatanId)), 'switch: every complaint lies in the new region')
  const nik = makeNik(other.kecamatan[0]!, '1990-05-04', 'L', 9123)
  ok(nik.startsWith('327301') && parseNik(nik).ok, `NIK of the new region passes the default parseNik (${nik})`)
  ok(nikRegionName(nik) === other.kecamatan[0]!.name, 'nikRegionName reads the current region first')
  ok(parseNik(makeNik('kalitidu', '1980-01-02', 'P', 9001)).ok, 'the bundled specimens (built-in table) still pass')
  // back to the run's pack
  await loadWorld(real, 7, { scope: 'default', fresh: true })
  ok(world.get().regionId === real.id, `switch back: ${real.id}`)
}
