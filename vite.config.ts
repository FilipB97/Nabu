import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Deploy na GitHub Pages leży pod /Nabu/. Lokalnie i w podglądzie chcemy /.
const base = process.env.NABU_BASE ?? '/'

export default defineConfig({
  base,
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'fonts/**/*.woff2'],
      manifest: {
        name: 'Nabu',
        short_name: 'Nabu',
        description: 'Trener języków obcych — zdania z korpusu, 10 minut dziennie',
        lang: 'pl',
        // Wartości startowe. Motyw zmienia <meta name="theme-color"> w locie,
        // ale manifest jest statyczny — tu zostaje domyślny preset (Atrament ciemny).
        background_color: '#0F1622',
        theme_color: '#0F1622',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Cała aplikacja i kroje idą do precache — bramka M0 to otwarcie bez sieci.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        // Noto Serif JP/KR po subsetowaniu (krok 07-fonts) mieszczą się poniżej tego progu.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'build/**/*.{test,spec}.ts'],
  },
})
