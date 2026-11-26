import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    base: './',
    resolve: single ? { alias: { 'virtual:pwa-register': '/src/lib/pwa-stub.ts' } } : undefined,
    plugins: [
      react(),
      single
        ? viteSingleFile()
        : VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['icon.svg', 'apple-touch-icon.png'],
            manifest: {
              name: 'Stimulus – Adaptiver Hypertrophie-Coach',
              short_name: 'Stimulus',
              description: 'Adaptive Trainingsplanung für Muskelaufbau',
              lang: 'de',
              theme_color: '#09090b',
              background_color: '#09090b',
              display: 'standalone',
              orientation: 'portrait',
              start_url: './',
              icons: [
                { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
                { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
              ],
            },
            workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'], maximumFileSizeToCacheInBytes: 5_000_000 },
          }),
    ],
    build: single ? { outDir: 'dist-single', assetsInlineLimit: 100_000_000, cssCodeSplit: false } : { outDir: 'dist' },
  };
});
