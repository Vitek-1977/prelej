import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
// Na GitHub Pages běží hra v podadresáři /<repo>/ – workflow nastaví BASE_PATH.
const base = process.env.BASE_PATH ?? '/';
const version = `${pkg.version}${process.env.GITHUB_SHA ? '+' + process.env.GITHUB_SHA.slice(0, 7) : ''}`;

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  build: {
    target: 'safari15',
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Přelej',
        short_name: 'Přelej',
        description: 'Barevná přelévací hra. Offline, bez reklam, bez registrace.',
        lang: 'cs',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b0f1a',
        theme_color: '#0b0f1a',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,json,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
