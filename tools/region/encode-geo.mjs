#!/usr/bin/env node
/**
 * encode-geo.mjs — write the compact geometry files the browser fetches, from the canonical GeoJSON:
 *   packs/<id>/geo.json  → packs/<id>/geo.min.json
 *   packs/<id>/desa.json → packs/<id>/desa.min.json
 * Format and encoder: tools/region/lib/topo.mjs; decoder: src/demo-kit/region/topo.ts. build-<id>.mjs calls this
 * at the end; validate.mjs checks that each .min file decodes to exactly its canonical file.
 *
 *   node tools/region/encode-geo.mjs [packId …]
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { encodeTopo } from './lib/topo.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const PACKS = join(HERE, '..', '..', 'src', 'demo-kit', 'region', 'packs')

export function encodePack(id) {
  const out = []
  for (const name of ['geo', 'desa']) {
    const src = join(PACKS, id, `${name}.json`)
    if (!existsSync(src)) continue
    const raw = readFileSync(src, 'utf8')
    const min = JSON.stringify(encodeTopo(JSON.parse(raw))) + '\n'
    writeFileSync(join(PACKS, id, `${name}.min.json`), min)
    const gz = (s) => (gzipSync(s, { level: 9 }).length / 1024).toFixed(1)
    out.push(`${name}.json ${gz(raw)} KB gz → ${name}.min.json ${gz(min)} KB gz`)
  }
  return out
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(PACKS).filter((d) => statSync(join(PACKS, d)).isDirectory())
  for (const id of ids) console.log(`[encode-geo] ${id}: ${encodePack(id).join(' · ')}`)
}
