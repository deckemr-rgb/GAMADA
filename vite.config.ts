/// <reference types="node" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync, readdirSync } from 'node:fs'

/**
 * Preload ONLY what the first paint needs: the latin fonts and the hero layers (1920 AVIF variant,
 * the one most desktops pick; phones get the 1280 variant through <picture media>, which the
 * browser preloads by itself as soon as it parses the markup).
 */
function preloadHero(): Plugin {
  return {
    name: 'gamada-preload-hero',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const tags: string[] = []
        const fonts = Object.keys(ctx.bundle ?? {}).filter((f) => /(fraunces-latin-wght-normal|manrope-latin-wght-normal).*\.woff2$/.test(f))
        for (const f of fonts) tags.push(`<link rel="preload" href="/${f}" as="font" type="font/woff2" crossorigin>`)
        const layers = JSON.parse(readFileSync('src/lib/layers.generated.json', 'utf8')) as Record<string, { files: { canvasW: number; avif: string }[] }>
        const hero: string[] = []
        for (const [key, v] of Object.entries(layers)) {
          if (!key.startsWith('hero/')) continue
          const f = v.files.find((x) => x.canvasW === 1920) ?? v.files[v.files.length - 1]
          if (f) hero.push(f.avif)
        }
        // The hero layers belong to the home page only: a deep link to /demo/*, /produk/* … would download ~250 KB of
        // images it never shows ("preloaded but not used"). A tiny inline script right after <meta charset> adds the same
        // <link rel=preload> tags, only when the page is '/', before the parser reaches the stylesheet and the entry
        // script (so the hero requests start no later than the old static tags at the end of <head>).
        const heroScript = hero.length
          ? `<script>if(location.pathname==='/')for(const h of ${JSON.stringify(hero)}){const l=document.createElement('link');l.rel='preload';l.as='image';l.type='image/avif';l.media='(min-width: 769px)';l.href=h;document.head.appendChild(l)}</script>`
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
 * Build only: an import from the barrel world/satu-daerah.ts is rewritten to the world/sd/<domain>.ts modules that
 * define the imported names, so each demo's chunk carries only the Satu Daerah selectors it uses (the barrel would
 * otherwise put every product's selectors into one shared chunk). Same bindings, same modules, only the path changes;
 * a name the map does not know keeps importing from the barrel. Dynamic `import('…/satu-daerah').then(({ a }) => …)`
 * is rewritten when all its names come from one module.
 */
function satuDaerahImports(): Plugin {
  const dir = 'src/demo-kit/world/sd'
  const owner = new Map<string, string>()
  const fromRe = /import\s*(type\s+)?\{([^}]*)\}\s*from\s*(['"])([^'"]*\/world\/satu-daerah)\3;?/g
  const dynRe = /import\((['"])([^'"]*\/world\/satu-daerah)\1\)\.then\(\(\{([^}]*)\}\)/g
  const nameOf = (spec: string) => spec.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]!.trim()
  return {
    name: 'gamada-satu-daerah-imports',
    apply: 'build',
    buildStart() {
      for (const f of readdirSync(dir)) {
        if (!f.endsWith('.ts')) continue
        const src = readFileSync(`${dir}/${f}`, 'utf8')
        for (const m of src.matchAll(/^export (?:const|function|interface|type) (\w+)/gm)) owner.set(m[1]!, f.slice(0, -3))
      }
    },
    transform(code, id) {
      if (!/src[\\/](demos|demo-kit)[\\/]/.test(id) || /world[\\/](satu-daerah|sd[\\/])/.test(id) || !code.includes('/world/satu-daerah')) return null
      let out = code.replace(fromRe, (all, typeOnly: string | undefined, list: string, q: string, path: string) => {
        if (typeOnly) return all
        const specs = list.split(',').map((s) => s.trim()).filter(Boolean)
        const by = new Map<string, string[]>()
        for (const s of specs) {
          const mod = owner.get(nameOf(s))
          if (!mod) return all
          by.set(mod, [...(by.get(mod) ?? []), s])
        }
        const base = path.replace(/satu-daerah$/, 'sd/')
        return [...by].map(([mod, ss]) => `import { ${ss.join(', ')} } from ${q}${base}${mod}${q};`).join('\n')
      })
      out = out.replace(dynRe, (all, q: string, path: string, list: string) => {
        const mods = new Set(list.split(',').map((s) => s.trim()).filter(Boolean).map((s) => owner.get(s.split(':')[0]!.trim())))
        if (mods.size !== 1 || mods.has(undefined)) return all
        return `import(${q}${path.replace(/satu-daerah$/, 'sd/')}${[...mods][0]}${q}).then(({${list}})`
      })
      return out === code ? null : { code: out, map: null }
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), preloadHero(), satuDaerahImports()],
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
            { name: 'motion', test: /node_modules[\\/](lenis[\\/]|gsap[\\/](?!Draggable|InertiaPlugin|utils[\\/](matrix|VelocityTracker)))|src[\\/]lib[\\/](motion|perf|smoothScroll)\.ts/, priority: 9 },
            // Demo size limit (≤ 180 KB per demo first load): every /demo/:slug loads the same kit core (shell, UI atoms,
            // world store + selectors, region loader, registry) and, on a first visit, the world generator. Left alone they
            // come as ~30 small chunks, each with its own import/export wrapper and its own gzip window; two groups keep
            // them in two files. Only modules no site page imports (site pages use ui/icons and i18n/roles: not here).
            { name: 'demo-gen', test: /src[\\/]demo-kit[\\/](world[\\/](seed|catalog|texts|names|rng|prng|score|labels)\.ts|docs[\\/]nik\.ts)$/, priority: 8, includeDependenciesRecursively: false },
            {
              name: 'demo-core',
              test: /src[\\/](demo-kit[\\/](shell[\\/](DemoShell|controls|TopBar|effects|Picker|EventToasts|lazy|hooks|url|missions|hotspot-store|constants|context|index|GuidePanel|Hotspot|intent)|world[\\/](util|store|selectors|clock|events|natural|ids|persist|session|index|engine-scope)|ui[\\/](Atoms|Popover|Overlay|Toast|Feedback|Form|Button|motion|strings|sla)|i18n[\\/](index|id)|region[\\/](loader|topo|wire)|frames[\\/]frames|ai[\\/]live-base)\.tsx?|demos[\\/]registry\.ts)$/,
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
