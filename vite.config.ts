/**
 * CDN Strategy (DD-V2-219):
 * - Static assets (sprites, audio, facts.db) → Cloudflare R2
 * - Web build → Cloudflare Pages
 * - Hashed filenames get: Cache-Control: public, max-age=31536000, immutable
 * - facts.db gets: Cache-Control: public, max-age=3600 (1h TTL for updates)
 * - Set VITE_ASSET_BASE_URL env var to CDN origin for production builds
 */
import { defineConfig, type Plugin } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

/**
 * Vite plugin that injects a Content-Security-Policy meta tag into index.html.
 * In development (Vite dev server active), a relaxed policy is used to allow
 * HMR and Phaser eval. In production, a strict policy is enforced (DD-V2-228).
 */
function cspInjectPlugin(): Plugin {
  return {
    name: 'csp-inject',
    transformIndexHtml(html, ctx) {
      const isDev = ctx.server !== undefined
      const csp = isDev
        ? "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss: http://localhost:*; font-src 'self'"
        : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://*.terragacha.com; font-src 'self'"
      return html.replace(
        '</head>',
        `  <meta http-equiv="Content-Security-Policy" content="${csp}">\n  </head>`
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte(), cspInjectPlugin()],
  base: process.env.VITE_ASSET_BASE_URL || '/',
  server: {
    // Mobile testing on local network
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
  build: {
    // Optimize for mobile — target <500KB per chunk
    // Run `npm run build -- --mode analyze` with rollup-plugin-visualizer to inspect
    target: 'es2022',
    minify: 'esbuild',
    chunkSizeWarningLimit: 500, // 500KB warning threshold
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
          'sql-wasm': ['sql.js'],
        },
      },
    },
  },
})
