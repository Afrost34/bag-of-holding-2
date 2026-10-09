import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

/** Short commit and date of this build, shown in Settings → About to tell versions apart. */
function buildId(): string {
  const date = new Date().toISOString().slice(0, 16).replace('T', ' ');
  let commit = process.env.GITHUB_SHA?.slice(0, 7);
  if (!commit) {
    try {
      commit = execSync('git rev-parse --short HEAD').toString().trim();
    } catch {
      commit = 'dev';
    }
  }
  return `${date} UTC · ${commit}`;
}

export default defineConfig({
  // Relative base: the same build runs on GitHub Pages (/bag-of-holding-2/), in Tauri and locally.
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_BUILD__: JSON.stringify(buildId()),
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  // SQLite ships its own .wasm next to its JS; pre-bundling would break that lookup.
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
  worker: {
    format: 'es',
  },
  build: {
    // Two chunks are one library each and load only where used: the 3D dice (one 545 kB file)
    // and PixiJS under the map canvas (526 kB). Anything else past this limit should be split.
    chunkSizeWarningLimit: 560,
    rolldownOptions: {
      output: {
        // Big libraries in chunks of their own: cached across app updates, loaded only by the
        // pages that use them (the note editor, the map canvas, the 3D dice, the boards).
        codeSplitting: {
          groups: [
            { name: 'lezer', test: /node_modules[\\/]@lezer/ },
            {
              name: 'codemirror',
              test: /node_modules[\\/](@codemirror|@marijn|style-mod|w3c-keyname|crelt)/,
            },
            { name: 'reactflow', test: /node_modules[\\/](@xyflow|d3-)/ },
          ],
        },
      },
    },
  },
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
      manifest: {
        name: 'Bag of Holding',
        short_name: 'Bag of Holding',
        description: 'D&D compendium, characters, boards, maps and campaign notes.',
        theme_color: '#22252e',
        background_color: '#121317',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2,wasm}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // 5etools art is fetched on demand from its image mirror and kept for offline use.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/raw\.githubusercontent\.com\/5etools-mirror-3\/5etools-img\//,
            handler: 'CacheFirst',
            options: {
              cacheName: '5etools-images',
              expiration: { maxEntries: 4000, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Resized copies of the same art (see ADR 0005); small, so many can be kept.
            urlPattern:
              /^https:\/\/wsrv\.nl\/\?url=https%3A%2F%2Fraw\.githubusercontent\.com%2F5etools-mirror-3%2F5etools-img%2F/,
            handler: 'CacheFirst',
            options: {
              cacheName: '5etools-images-resized',
              expiration: { maxEntries: 8000, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
