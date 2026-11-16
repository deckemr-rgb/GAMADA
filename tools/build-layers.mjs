// build-layers.mjs — rasterise the layered SVG sources into trimmed, multi-resolution WebP.
//
//   node tools/build-layers.mjs            # build everything
//   node tools/build-layers.mjs hero/sky   # only matching keys
//
// Source:  src-art/scenes/<scene>/<layer>.svg   (2560 × 2304 canvas, 16:9 frame + 30 % bleed)
// Output:  public/scenes/<scene>/<layer>-<W>.{avif,webp}  for canvas widths W ∈ {1280, 1920*, 2560}
//          (* 1920 only for layers whose trimmed box is wider than LARGE_MIN_W)
//          public/scenes/<scene>/<layer>-blur.webp  for depth-of-field layers (pre-blurred, 1280)
//          src/lib/layers.generated.json  — bbox (canvas px) + files + byte sizes per layer
//
// Every image is trimmed to its alpha bounding box, so a 300-px figure no longer costs a
// full-viewport transparent surface. The runtime positions it with the same cover mapping
// as the old full-canvas <img> (src/lib/frame.ts → computeFrame).
import sharp from "sharp";
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync, rmSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src-art", "scenes");
const OUT = join(ROOT, "public", "scenes");
const JSON_OUT = join(ROOT, "src", "lib", "layers.generated.json");

const CANVAS = { w: 2560, h: 2304 };
const WIDTHS = [1280, 1920, 2560];
const LARGE_MIN_W = 1400; // trimmed width (canvas px) above which a 1920 variant is emitted
const PAD = 4; // px of transparent padding kept around the trimmed box
const ALPHA_MIN = 3; // alpha (0-255) below which a pixel counts as empty
const WEBP = { quality: 72, alphaQuality: 60, effort: 6 }; // fallback format
const AVIF = { quality: 45, effort: 5 }; // primary format (~2× smaller than WebP for this art)
const AVIF_SMALL_Q = 38; // the 1280 (mobile) variant tolerates a little more compression
const AVIF_FALLBACK_LAYER_Q = 34; // static waterfall fallbacks are covered by the shader most of the time
const LOW_PRIORITY = new Set(["tranquility/waterfall", "biodiversity/waterfall"]);

/** Layers baked into another one at build time (and not emitted on their own). */
const BAKE = {
  "hero/sky": [{ key: "hero/sun-glow", blend: "screen" }],
};
const BAKED_AWAY = new Set(Object.values(BAKE).flat().map((b) => b.key));

/** Depth-of-field layers get a pre-blurred variant (cross-faded at runtime instead of filter: blur()). */
const DOF = new Set(["hero/grass-front", "tranquility/plants-front", "biodiversity/flowers-front"]);
const DOF_SIGMA_AT_2560 = 7; // ≈ DOF.maxBlurPx (4 css px) on a 1440-wide screen

const only = process.argv.slice(2);
const t0 = Date.now();

async function renderRaw(key) {
  const svg = readFileSync(join(SRC, `${key}.svg`));
  const img = sharp(svg, { density: 72, limitInputPixels: false }).resize(CANVAS.w, CANVAS.h, { fit: "fill" }).ensureAlpha();
  return img.raw().toBuffer({ resolveWithObject: true });
}

function alphaBox(data, info) {
  const { width, height, channels } = info;
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) {
    let row = y * width * channels + 3;
    for (let x = 0; x < width; x++, row += channels) {
      if (data[row] >= ALPHA_MIN) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  x0 = Math.max(0, x0 - PAD); y0 = Math.max(0, y0 - PAD);
  x1 = Math.min(width - 1, x1 + PAD); y1 = Math.min(height - 1, y1 + PAD);
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

function isOpaque(data, info) {
  for (let i = 3; i < data.length; i += info.channels * 97) if (data[i] < 250) return false;
  return true;
}

const manifest = existsSync(JSON_OUT) && only.length ? JSON.parse(readFileSync(JSON_OUT, "utf8")) : {};
const scenes = readdirSync(SRC).filter((d) => statSync(join(SRC, d)).isDirectory());
let totalDesktop = 0, totalMobile = 0;

for (const scene of scenes) {
  mkdirSync(join(OUT, scene), { recursive: true });
  for (const file of readdirSync(join(SRC, scene)).filter((f) => f.endsWith(".svg"))) {
    const key = `${scene}/${basename(file, ".svg")}`;
    if (BAKED_AWAY.has(key)) continue;
    if (only.length && !only.some((o) => key.includes(o))) continue;

    let { data, info } = await renderRaw(key);
    for (const b of BAKE[key] ?? []) {
      const over = await renderRaw(b.key);
      const merged = await sharp(data, { raw: info })
        .composite([{ input: over.data, raw: over.info, blend: b.blend }])
        .raw()
        .toBuffer({ resolveWithObject: true });
      data = merged.data; info = merged.info;
    }
    const box = alphaBox(data, info);
    if (!box) { console.warn(`skip ${key}: empty`); continue; }
    const opaque = isOpaque(data, info) && box.w === CANVAS.w && box.h === CANVAS.h;
    const cropped = sharp(data, { raw: info }).extract({ left: box.x, top: box.y, width: box.w, height: box.h });
    const croppedPng = await cropped.png().toBuffer();

    // remove stale outputs of this layer
    // exact match only: "elder" must not delete "elder-rod-*" outputs
    const stem = basename(file, ".svg");
    const own = (f) => f.startsWith(`${stem}-`) && /^(\d+|blur)\.(webp|avif)$/.test(f.slice(stem.length + 1));
    for (const f of readdirSync(join(OUT, scene))) if (own(f)) rmSync(join(OUT, scene, f));
    const old = join(OUT, scene, file);
    if (existsSync(old)) rmSync(old); // the runtime no longer ships SVG

    const files = [];
    const widths = WIDTHS.filter((W) => W !== 1920 || box.w >= LARGE_MIN_W);
    for (const W of widths) {
      const pw = Math.max(1, Math.round((box.w * W) / CANVAS.w));
      const ph = Math.max(1, Math.round((box.h * W) / CANVAS.w));
      const stem = `${basename(file, ".svg")}-${W}`;
      const resized = await sharp(croppedPng).resize(pw, ph, { kernel: "lanczos3" }).png().toBuffer();
      const webp = await sharp(resized).webp({ ...WEBP, ...(opaque ? { alphaQuality: 100 } : {}) }).toBuffer();
      const aq = LOW_PRIORITY.has(key) ? AVIF_FALLBACK_LAYER_Q : W === 1280 ? AVIF_SMALL_Q : AVIF.quality;
      const avif = await sharp(resized).avif({ ...AVIF, quality: aq }).toBuffer();
      writeFileSync(join(OUT, scene, `${stem}.webp`), webp);
      writeFileSync(join(OUT, scene, `${stem}.avif`), avif);
      files.push({ canvasW: W, w: pw, h: ph, webp: `/scenes/${scene}/${stem}.webp`, avif: `/scenes/${scene}/${stem}.avif`, bytes: avif.length, bytesWebp: webp.length });
    }

    let blur;
    if (DOF.has(key)) {
      const W = 1280;
      const k = W / CANVAS.w;
      const sigma = DOF_SIGMA_AT_2560 * k;
      const grow = Math.ceil(sigma * 3 / k); // canvas px of spill
      const gb = { x: Math.max(0, box.x - grow), y: Math.max(0, box.y - grow) };
      gb.w = Math.min(CANVAS.w, box.x + box.w + grow) - gb.x;
      gb.h = Math.min(CANVAS.h, box.y + box.h + grow) - gb.y;
      const region = await sharp(data, { raw: info }).extract({ left: gb.x, top: gb.y, width: gb.w, height: gb.h }).png().toBuffer();
      const pw = Math.round(gb.w * k), ph = Math.round(gb.h * k);
      const blurred = await sharp(region).resize(pw, ph).blur(sigma).png().toBuffer();
      const stem = `${basename(file, ".svg")}-blur`;
      const webp = await sharp(blurred).webp({ ...WEBP, quality: 60 }).toBuffer();
      const avif = await sharp(blurred).avif({ ...AVIF, quality: 40 }).toBuffer();
      writeFileSync(join(OUT, scene, `${stem}.webp`), webp);
      writeFileSync(join(OUT, scene, `${stem}.avif`), avif);
      blur = { bbox: gb, webp: `/scenes/${scene}/${stem}.webp`, avif: `/scenes/${scene}/${stem}.avif`, w: pw, h: ph, bytes: avif.length, bytesWebp: webp.length };
    }

    manifest[key] = { bbox: box, opaque, files, ...(blur ? { blur } : {}) };
    const desk = files[files.length - 1]?.bytes ?? 0; // AVIF
    const mob = files[0]?.bytes ?? 0;
    console.log(`${key.padEnd(34)} box ${String(box.w).padStart(4)}×${String(box.h).padEnd(4)} @(${box.x},${box.y})  2560w ${(desk / 1024).toFixed(1).padStart(6)} KB · 1280w ${(mob / 1024).toFixed(1).padStart(5)} KB${blur ? ` · blur ${(blur.bytes / 1024).toFixed(1)} KB` : ""}`);
  }
}

let totalDesktopWebp = 0, totalMobileWebp = 0, totalLaptop = 0;
for (const v of Object.values(manifest)) {
  const big = v.files[v.files.length - 1], small = v.files[0];
  const mid = v.files.find((f) => f.canvasW === 1920) ?? big;
  totalDesktop += big?.bytes ?? 0; totalMobile += small?.bytes ?? 0; totalLaptop += mid?.bytes ?? 0;
  totalDesktopWebp += big?.bytesWebp ?? 0; totalMobileWebp += small?.bytesWebp ?? 0;
  totalDesktop += v.blur?.bytes ?? 0; totalLaptop += v.blur?.bytes ?? 0;
}
writeFileSync(JSON_OUT, JSON.stringify(manifest, null, 1));
console.log(`\n${Object.keys(manifest).length} layers · desktop (2560w) ${(totalDesktop / 1024).toFixed(0)} KB · mobile (1280w) ${(totalMobile / 1024).toFixed(0)} KB · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
