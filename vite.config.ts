/// <reference types="node" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'

/**
 * Deploy base path. Default '/' (dev, preview, e2e, the budgets). The GitHub Pages build serves the site under the
 * repository's sub-path: GAMADA_BASE=/GAMADA/ npm run build (.github/workflows/pages.yml). Always '/…/'.
 */
const BASE = ((b: string) => {
  const inner = b.replace(/^\/+|\/+$/g, '')
  return inner ? `/${inner}/` : '/'
})(process.env.GAMADA_BASE?.trim() || '/')

/**
 * Preload ONLY what the first paint needs: the latin fonts and the hero layers (1920 AVIF variant,
 * the one most desktops pick; phones get the 1280 variant through <picture media>, which the
 * browser preloads by itself as soon as it parses the markup).
 */
function preloadHero(base: string): Plugin {
  return {
    name: 'gamada-preload-hero',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const tags: string[] = []
        const fonts = Object.keys(ctx.bundle ?? {}).filter((f) => /(fraunces-latin-wght-normal|manrope-latin-wght-normal).*\.woff2$/.test(f))
        for (const f of fonts) tags.push(`<link rel="preload" href="${base}${f}" as="font" type="font/woff2" crossorigin>`)
        const layers = JSON.parse(readFileSync('src/lib/layers.generated.json', 'utf8')) as Record<string, { files: { canvasW: number; avif: string }[] }>
        const hero: string[] = []
        for (const [key, v] of Object.entries(layers)) {
          if (!key.startsWith('hero/')) continue
          const f = v.files.find((x) => x.canvasW === 1920) ?? v.files[v.files.length - 1]
          if (f) hero.push(base + f.avif.replace(/^\//, ''))
        }
        // The hero layers belong to the home page only: a deep link to /demo/*, /produk/* … would download ~250 KB of
        // images it never shows ("preloaded but not used"). A tiny inline script right after <meta charset> adds the same
        // <link rel=preload> tags, only when the page is '/' (the base), before the parser reaches the stylesheet and the entry
        // script (so the hero requests start no later than the old static tags at the end of <head>).
        const heroScript = hero.length
          ? `<script>if(location.pathname==='${base}')for(const h of ${JSON.stringify(hero)}){const l=document.createElement('link');l.rel='preload';l.as='image';l.type='image/avif';l.media='(min-width: 769px)';l.href=h;document.head.appendChild(l)}</script>`
          : ''
        const charset = /<meta charset="UTF-8" \/>/i
        const withHero = heroScript && charset.test(html) ? html.replace(charset, (m) => `${m}\n    ${heroScript}`) : html
        if (heroScript && withHero === html) tags.push(heroScript)
        return withHero.replace('</head>', `    ${tags.join('\n    ')}\n  </head>`)
      },
    },
  }
}

/**
 * Build only: an import from a world barrel (world/satu-daerah.ts, world/usaha-pintar.ts, world/pasar-daerah.ts) is
 * rewritten to the world modules that DEFINE the imported names (re-exports are followed: `export { a } from`,
 * `export *`, an imported-then-exported name), so each demo's chunk carries only the selectors it uses (a barrel
 * would otherwise put every product's selectors into one shared chunk). Same bindings, same modules, only the path
 * changes; a name that cannot be resolved keeps importing from the barrel. Dynamic
 * `import('…/<barrel>').then(({ a }) => …)` is rewritten when all its names come from one module.
 */
function barrelImports(barrels: Record<string, string>): Plugin {
  const worldDir = 'src/demo-kit/world'
  const read = new Map<string, string | null>()
  const src = (rel: string): string | null => {
    if (!read.has(rel)) {
      let t: string | null = null
      for (const ext of ['.ts', '.tsx', '/index.ts']) {
        try {
          t = readFileSync(`${worldDir}/${rel}${ext}`, 'utf8')
          break
        } catch {
          /* next */
        }
      }
      read.set(rel, t)
    }
    return read.get(rel)!
  }
  /** "up/../price-math" → "price-math" (paths relative to the world dir) */
  const join = (from: string, spec: string): string | null => {
    if (!spec.startsWith('.')) return null
    const parts = from.split('/').slice(0, -1)
    for (const p of spec.split('/')) {
      if (p === '.' || p === '') continue
      if (p === '..') {
        if (!parts.length) return null
        parts.pop()
      } else parts.push(p)
    }
    return parts.join('/')
  }
  const listHas = (list: string, name: string) => list.split(',').map((x) => x.trim().replace(/^type\s+/, '')).includes(name)
  const cache = new Map<string, string | null>()
  function resolve(rel: string, name: string, depth = 0): string | null {
    const key = `${rel}#${name}`
    if (cache.has(key)) return cache.get(key)!
    cache.set(key, null)
    const t = src(rel)
    let out: string | null = null
    if (t && depth < 8) {
      if (new RegExp(`^export (?:async )?(?:const|function|interface|type|class|let) ${name}(?![\\w$])`, 'm').test(t)) out = rel
      for (const m of t.matchAll(/export\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
        if (out) break
        if (listHas(m[1]!, name)) {
          const p = join(rel, m[2]!)
          out = p ? resolve(p, name, depth + 1) : null
          if (!out) break
        }
      }
      if (!out) {
        for (const m of t.matchAll(/export\s*\{([^}]*)\}(?!\s*from)/g)) {
          if (!listHas(m[1]!, name)) continue
          for (const im of t.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
            if (!listHas(im[1]!, name)) continue
            const p = join(rel, im[2]!)
            out = p ? resolve(p, name, depth + 1) : null
          }
        }
      }
      if (!out) for (const m of t.matchAll(/export\s*\*\s*from\s*['"]([^'"]+)['"]/g)) {
        const p = join(rel, m[1]!)
        out = p ? resolve(p, name, depth + 1) : null
        if (out) break
      }
    }
    cache.set(key, out)
    return out
  }
  const names = Object.keys(barrels).map((b) => b.replace(/^world\//, ''))
  const alt = names.join('|')
  const fromRe = new RegExp(`import\\s*(type\\s+)?\\{([^}]*)\\}\\s*from\\s*(['"])([^'"]*\\/world\\/(${alt}))\\3;?`, 'g')
  const dynRe = new RegExp(`import\\((['"])([^'"]*\\/world\\/(${alt}))\\1\\)\\.then\\(\\(\\{([^}]*)\\}\\)`, 'g')
  const nameOf = (spec: string) => spec.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]!.trim()
  return {
    name: 'gamada-world-barrel-imports',
    apply: 'build',
    buildStart() {
      read.clear()
      cache.clear()
    },
    transform(code, id) {
      const p = id.replace(/\\/g, '/')
      if (!/src\/(demos|demo-kit)\//.test(p) || names.some((n) => p.endsWith(`/world/${n}.ts`)) || !names.some((n) => code.includes(`/world/${n}`))) return null
      const warn = (m: string) => this.warn(m)
      let out = code.replace(fromRe, (all, typeOnly: string | undefined, list: string, q: string, path: string, barrel: string) => {
        if (typeOnly) return all
        const specs = list.split(',').map((x) => x.trim()).filter(Boolean)
        const by = new Map<string, string[]>()
        for (const sp of specs) {
          const mod = resolve(barrel, nameOf(sp))
          if (!mod) {
            warn(`barrel name not resolved: ${nameOf(sp)} (${barrel}) — keeps the barrel import`)
            return all
          }
          by.set(mod, [...(by.get(mod) ?? []), sp])
        }
        const base = path.slice(0, -barrel.length)
        return [...by].map(([mod, ss]) => `import { ${ss.join(', ')} } from ${q}${base}${mod}${q};`).join('\n')
      })
      out = out.replace(dynRe, (all, q: string, path: string, barrel: string, list: string) => {
        const mods = new Set(list.split(',').map((x) => x.trim()).filter(Boolean).map((x) => resolve(barrel, x.split(':')[0]!.trim())))
        if (mods.size !== 1 || mods.has(null)) return all
        return `import(${q}${path.slice(0, -barrel.length)}${[...mods][0]}${q}).then(({${list}})`
      })
      return out === code ? null : { code: out, map: null }
    },
  }
}

export default defineConfig({
  base: BASE,
  plugins: [react(), tailwindcss(), preloadHero(BASE), barrelImports({ 'world/satu-daerah': 'world/sd', 'world/usaha-pintar': 'world/up', 'world/pasar-daerah': 'world/pd' })],
  // client-side routes (/karya, /faq …): dev + preview serve index.html for unknown paths.
  // Static hosts need the same rewrite (e.g. Netlify `/* /index.html 200`, Vercel rewrites).
  appType: 'spa',
  server: {
    port: 5173,
    host: '127.0.0.1',
    // dev only: same-origin /api/ai/* → the AI proxy (`npm run ai:mock` / `npm run ai:dev`), so the site can use
    // VITE_AI_PROXY_URL="" (see .env.example). Without the proxy running, health fails and the demo stays on Simulation.
    proxy: { '/api/ai': { target: process.env.AI_PROXY_TARGET ?? 'http://127.0.0.1:8787', changeOrigin: false } },
  },
  preview: { port: 4173, host: '127.0.0.1' },
  build: {
    target: 'es2022',
    cssMinify: true,
    modulePreload: { polyfill: false },
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 900,
    rolldownOptions: {
      output: {
        // Home JS budget (spec §14, ≤ 253.6 KB gzip): without these groups the lazy routes' shared imports split the
        // home set into many small chunks (react, preload-helper, gsap, motion, perf, smoothScroll …), each with its
        // own wrapper/gzip overhead. Two groups keep the always-loaded core in two files. Draggable / Inertia stay in
        // their lazy home section (Testimonials), off the critical path.
        codeSplitting: {
          groups: [
            { name: 'vendor', test: /node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]|preload-helper/, priority: 10 },
            { name: 'motion', test: /node_modules[\\/](lenis[\\/]|gsap[\\/](?!Draggable|InertiaPlugin|utils[\\/](matrix|VelocityTracker)))|src[\\/]lib[\\/](motion|perf|smoothScroll|base)\.ts/, priority: 9 },
            // (lib/base.ts: the deploy-base helpers, imported by home and the lazy demo/tour chunks alike; in this
            // always-loaded group it never becomes a separate home request)
            // Demo size limit (≤ 180 KB per demo first load): every /demo/:slug loads the same kit core (shell, UI atoms,
            // world store + selectors, region loader, registry) and, on a first visit, the world generator. Left alone they
            // come as ~30 small chunks, each with its own import/export wrapper and its own gzip window; two groups keep
            // them in two files. Only modules no site page imports (site pages use ui/icons and i18n/roles: not here).
            { name: 'demo-gen', test: /src[\\/]demo-kit[\\/](world[\\/](seed|catalog|texts|names|rng|prng|score|labels)\.ts|docs[\\/]nik\.ts)$/, priority: 8, includeDependenciesRecursively: false },
            // tahap 4: the Usaha Pintar world modules (world/eco.ts) as two chunks instead of ~15 small shared ones —
            // 'usaha-pintar/data' (seed extension + the modules it needs; every UP, KL, RU, Inti page loads it) and the
            // live module (natural events + boot handlers). Only these modules (no dependencies pulled in).
            {
              name: 'up-data',
              // (not pd/shock-commodities / pd/loan-math: the PD boot module imports them and must stay UP-free)
              test: /src[\\/]demo-kit[\\/](world[\\/]up[\\/](data|seed-up|reputation|win-score|config|omzet|tax-constants|texts|criteria|base|call-score)|docs[\\/]samples[\\/]cv-data)\.ts$/,
              priority: 8,
              includeDependenciesRecursively: false,
            },
            { name: 'up-live', test: /src[\\/]demo-kit[\\/]world[\\/]up[\\/](boot|natural-up|audit-boot|labels|reactions-boot|reducers-boot)\.ts$/, priority: 8, includeDependenciesRecursively: false },
            {
              name: 'demo-core',
              test: /src[\\/](demo-kit[\\/](shell[\\/](DemoShell|controls|TopBar|effects|Picker|EventToasts|lazy|hooks|url|missions|hotspot-store|constants|context|index|GuidePanel|Hotspot|intent)|world[\\/](util|store|selectors|clock|events|natural|ids|persist|session|index|engine-scope|eco|ext)|ui[\\/](Atoms|Popover|Overlay|Toast|Feedback|Form|Button|motion|strings|sla)|i18n[\\/](index|id)|region[\\/](loader|topo|wire)|frames[\\/]frames|ai[\\/]live-base)\.tsx?|demos[\\/]registry\.ts)$/,
              priority: 8,
              // only these modules: their dependencies (lib/i18n, AppLink, products, icons …) stay where home and the
              // site pages need them
              includeDependenciesRecursively: false,
            },
          ],
        },
      },
    },
  },
})
