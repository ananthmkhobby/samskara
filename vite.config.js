import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Lets the dev server respond when reached through a tunnel hostname
  // (e.g. `vercel dev` + localtunnel, used to give Twilio's WhatsApp
  // webhook a public HTTPS URL during local testing) — Vite's dev server
  // otherwise rejects any request whose Host header isn't localhost, as a
  // DNS-rebinding protection. Only affects `vite`/`vercel dev`; the
  // production build (`vite build`) runs no dev server at all.
  server: {
    allowedHosts: ['.loca.lt', '.trycloudflare.com'],
    // `vercel dev` emulates the serverless functions in api/*.js — running
    // on its own port here rather than fronting this whole dev server,
    // because vercel dev's own router also applies vercel.json's SPA
    // rewrite (needed in production so deep links serve index.html) to
    // every non-/api path, including Vite's own internal asset requests
    // (/src/main.jsx, /@vite/client, ...), corrupting them. Proxying just
    // /api from Vite avoids that entirely.
    proxy: {
      // An uncommon port, deliberately — 3000/3001 turned out to already be
      // in use by an unrelated project's dev server on this machine, which
      // silently split requests between the two (both ended up listening on
      // "localhost:3001" on different interfaces), causing some webhook
      // calls to hang against the wrong server entirely.
      '/api': 'http://localhost:3099',
    },
  },
  // `vite preview` (serves the production dist/ build) needs the same two
  // settings as `server` above — used instead of the dev server when
  // tunneling, since dev mode's dozens of unbundled module/CSS requests
  // trip localtunnel's free-tier rate limit on load; a production build is
  // 1-2 files and loads fine through the tunnel.
  preview: {
    allowedHosts: ['.loca.lt', '.trycloudflare.com'],
    proxy: {
      '/api': 'http://localhost:3099',
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'fonts/SourceSerif4-Variable.woff2', 'fonts/SourceSerif4-Italic-Variable.woff2'],
      manifest: {
        name: 'Samskara Vamsha Vruksha',
        short_name: 'Vamsha Vruksha',
        description: "Your family's living record — births, marriages, memories, and life lessons, kept in one place.",
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#F5EFE3',
        theme_color: '#5C1414',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // /api/* are OpenAI-backed serverless functions — never cache
        // responses that depend on a live key/quota or a specific prompt.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
})
