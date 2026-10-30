import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const api = env.VITE_API_URL || 'http://cops-web.test';

  return {
    resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
    server: {
      port: 5173,
      // Same-origin in dev so Sanctum's cookie (SPA) authentication works without CORS.
      proxy: {
        '/api': { target: api, changeOrigin: true, cookieDomainRewrite: 'localhost' },
        '/sanctum': { target: api, changeOrigin: true, cookieDomainRewrite: 'localhost' },
        '/broadcasting': { target: api, changeOrigin: true, cookieDomainRewrite: 'localhost' },
      },
    },
    build: {
      outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 700,
      rollupOptions: { output: { manualChunks(id: string) {
        if (!id.includes('node_modules')) return undefined;
        if (/recharts|d3-|victory-vendor/.test(id)) return 'charts';
        if (/@tiptap|prosemirror|@mantine\/tiptap/.test(id)) return 'editor';
        if (/@mantine/.test(id)) return 'mantine';
        if (/@tabler/.test(id)) return 'icons';
        if (/react|scheduler|i18next|@tanstack|axios/.test(id)) return 'vendor';
        return undefined;
      } } },
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
        manifest: {
          name: 'Company Operations Platform',
          short_name: 'OpsPlatform',
          description: 'Archive, IT infrastructure and operations management',
          theme_color: '#3773b8',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'any',
          start_url: '/',
          scope: '/',
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // App shell only. Authenticated API data is never cached by the service worker.
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/sanctum\//],
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        },
      }),
    ],
  };
});
