import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = dirname(fileURLToPath(import.meta.url))
const appVersion = () =>
  readFileSync(resolve(root, 'src/version.js'), 'utf8').match(/APP_VERSION = '([^']+)'/)[1]

const versionJson = () => ({
  name: 'wordstrike-version-json',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: JSON.stringify({ version: appVersion() })
    })
  },
  configureServer(server) {
    server.middlewares.use('/version.json', (_request, response) => {
      response.setHeader('Content-Type', 'application/json')
      response.setHeader('Cache-Control', 'no-store')
      response.end(JSON.stringify({ version: appVersion() }))
    })
  }
})

export default defineConfig({
  // GitHub Pages serves this repository from /wordstrike/, not the domain root.
  // Vite uses this prefix for built JS/CSS, icons, and PWA files.
  base: '/wordstrike/',
  plugins: [
    react(),
    versionJson(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'WordStrike',
        short_name: 'WordStrike',
        description: 'Head-to-head word battle. Guess letters, solve words, sink your rival.',
        theme_color: '#0b0e1a',
        background_color: '#0b0e1a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/wordstrike/',
        scope: '/wordstrike/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,json,woff2}'],
        globIgnores: ['version.json']
      }
    })
  ],
  server: { port: 5201 }
})
