#!/usr/bin/env node
/**
 * tools/shot-diff.mjs — pixel diff of the final screenshots against the earlier stages (Tahap 7 plan §2 item 13).
 *
 *   node tools/shot-diff.mjs [--new docs/shots/demo/tahap-7] [--base dir1,dir2,…] [--md out.md]
 *
 * For every PNG in --new, the first PNG with the same file name in the --base folders (in order) is the baseline.
 * Default baseline = the latest earlier stage that has the shot: tahap-6 (site), tahap-5 (tour, Toko Autopilot),
 * tahap-4 (Pasar Daerah + Inti), tahap-3 (Usaha Pintar), tahap-2 (Satu Daerah). No copy into a separate baseline
 * folder: the stage folders ARE the baseline (disk), and they are never rewritten.
 * Pixels are compared with pixelmatch (threshold 0.1, anti-aliasing ignored). When the widths differ (a DPR 2 phone
 * shot, or a scaled full-page site shot), the baseline is resized to the new width first (sharp, aspect kept); then
 * both are compared over the top overlap (a full-page baseline vs a viewport shot compares the first screen). The
 * note column says when that happened.
 * Output: a markdown table (stdout, or --md file) with % changed per page. Judgement, not a gate.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'
import sharp from 'sharp'

const args = process.argv.slice(2)
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : def
}
const NEW = opt('new', 'docs/shots/demo/tahap-7')
const BASES = opt('base', ['tahap-6', 'tahap6', 'tahap-5', 'tahap-4', 'tahap-3', 'tahap-2'].map((d) => `docs/shots/demo/${d}`).join(',')).split(',')
const MD = opt('md', null)

function crop(png, w, h) {
  if (png.width === w && png.height === h) return png.data
  const out = Buffer.alloc(w * h * 4)
  for (let y = 0; y < h; y++) png.data.copy(out, y * w * 4, y * png.width * 4, y * png.width * 4 + w * 4)
  return out
}

const rows = []
for (const f of readdirSync(NEW).filter((n) => n.endsWith('.png')).sort()) {
  const base = BASES.map((d) => join(d, f)).find((p) => existsSync(p))
  if (!base) {
    rows.push({ f, base: '-', pct: null, note: 'new shot (no baseline)' })
    continue
  }
  let a = PNG.sync.read(readFileSync(base))
  const b = PNG.sync.read(readFileSync(join(NEW, f)))
  const orig = `${a.width}×${a.height}`
  if (a.width !== b.width) {
    const { data, info } = await sharp(readFileSync(base)).ensureAlpha().resize({ width: b.width }).raw().toBuffer({ resolveWithObject: true })
    a = { width: info.width, height: info.height, data }
  }
  const w = Math.min(a.width, b.width)
  const h = Math.min(a.height, b.height)
  const diff = pixelmatch(crop(a, w, h), crop(b, w, h), null, w, h, { threshold: 0.1 })
  const scaled = orig !== `${b.width}×${b.height}`
  rows.push({ f, base: base.replace(/\\/g, '/').replace('docs/shots/demo/', ''), pct: (diff / (w * h)) * 100, note: scaled ? `baseline ${orig} scaled/cropped to ${w}×${h}` : '' })
}

const lines = ['| Shot | Baseline | % changed | Note |', '|---|---|---:|---|']
for (const r of rows) lines.push(`| ${r.f} | ${r.base} | ${r.pct == null ? '-' : r.pct.toFixed(1)} | ${r.note} |`)
const md = lines.join('\n') + '\n'
if (MD) writeFileSync(MD, md)
process.stdout.write(md)
