/// <reference types="node" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'

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
        for (const [key, v] of Object.entries(layers)) {
          if (!key.startsWith('hero/')) continue
          const f = v.files.find((x) => x.canvasW === 1920) ?? v.files[v.files.length - 1]
          if (f) tags.push(`<link rel="preload" href="${f.avif}" as="image" type="image/avif" media="(min-width: 769px)">`)
        }
        return html.replace('</head>', `    ${tags.join('\n    ')}\n  </head>`)
      },
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), preloadHero()],
  // client-side routes (/karya, /faq …): dev + preview serve index.html for unknown paths.
  // Static hosts need the same rewrite (e.g. Netlify `/* /index.html 200`, Vercel rewrites).
  appType: 'spa',
  server: { port: 5173, host: '127.0.0.1' },
  preview: { port: 4173, host: '127.0.0.1' },
  build: {
    target: 'es2022',
    cssMinify: true,
    modulePreload: { polyfill: false },
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 900,
  },
})
