// optimize-svg.mjs — shrink the SVG sources in src-art/scenes in place.
//   1. de-duplicate identical gradients (same type, attributes and stops → one id, refs rewritten)
//   2. svgo multipass: convertPathData precision 1, mergePaths, removeUselessDefs, cleanupIds …
// usage: node tools/optimize-svg.mjs [filter]
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { optimize } from "svgo";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src-art", "scenes");
const only = process.argv[2];

const SVGO = {
  multipass: true,
  floatPrecision: 1,
  plugins: [
    {
      name: "preset-default",
      params: {
        overrides: {
          convertPathData: { floatPrecision: 1, transformPrecision: 3 },
          cleanupNumericValues: { floatPrecision: 1 },
          convertTransform: { floatPrecision: 3 },
        },
      },
    },
    "mergePaths",
    "removeUselessDefs",
    { name: "cleanupIds", params: { minify: true } },
    "reusePaths",
  ],
};

/** Merge identical <linearGradient>/<radialGradient> definitions. Returns [svg, removedCount]. */
function dedupeGradients(svg) {
  const re = /<(linearGradient|radialGradient)\b([^>]*?)\bid="([^"]+)"([^>]*)>([\s\S]*?)<\/\1>/g;
  const canon = new Map(); // signature → id
  const alias = new Map(); // duplicate id → canonical id
  let m;
  while ((m = re.exec(svg))) {
    const [, tag, a1, id, a2, body] = m;
    const sig = `${tag}|${(a1 + a2).replace(/\s+/g, " ").trim()}|${body.replace(/\s+/g, " ").trim()}`;
    const first = canon.get(sig);
    if (first) alias.set(id, first);
    else canon.set(sig, id);
  }
  if (!alias.size) return [svg, 0];
  let out = svg.replace(re, (full, _tag, _a1, id) => (alias.has(id) ? "" : full));
  for (const [dup, keep] of alias) {
    const esc = dup.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`url\\(#${esc}\\)`, "g"), `url(#${keep})`).replace(new RegExp(`href="#${esc}"`, "g"), `href="#${keep}"`);
  }
  return [out, alias.size];
}

let before = 0, after = 0, gradsRemoved = 0;
for (const scene of readdirSync(SRC)) {
  const dir = join(SRC, scene);
  if (!statSync(dir).isDirectory()) continue;
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".svg"))) {
    const key = `${scene}/${f}`;
    if (only && !key.includes(only)) continue;
    const p = join(dir, f);
    const src = readFileSync(p, "utf8");
    const [deduped, n] = dedupeGradients(src);
    const res = optimize(deduped, { path: p, ...SVGO });
    const gradsBefore = (src.match(/<(linear|radial)Gradient\b/g) ?? []).length;
    const gradsAfter = (res.data.match(/<(linear|radial)Gradient\b/g) ?? []).length;
    before += src.length; after += res.data.length; gradsRemoved += gradsBefore - gradsAfter;
    writeFileSync(p, res.data);
    console.log(`${key.padEnd(40)} ${(src.length / 1024).toFixed(1).padStart(6)} KB → ${(res.data.length / 1024).toFixed(1).padStart(6)} KB  gradients ${gradsBefore}→${gradsAfter}${n ? ` (${n} duplicates merged)` : ""}`);
  }
}
console.log(`\ntotal ${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB (−${(100 - (after / before) * 100).toFixed(0)} %), gradients removed: ${gradsRemoved}`);
