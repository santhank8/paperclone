import { VitePWA } from 'vite-plugin-pwa';

export const pwaConfig = VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
  manifest: {
    name: 'Paperclip - AI Company OS',
    short_name: 'Paperclip',
    description: 'Operating system for autonomous AI companies',
    theme_color: '#000000',
    background_color: '#ffffff',
    display: 'standalone',
    orientation: 'portrait',
    scope: '/',
    start_url: '/',
    icons: [
      {
        src: 'pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: 'pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png'
      },
      {
        src: 'pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable'
      }
    ]
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
    runtimeCaching: [
      {
        urlPattern: /^https?:\/\/.+\/api\//i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-cache',
          networkTimeoutSeconds: 10,
          cacheableResponse: {
            statuses: [0, 200]
          }
        }
      }
    ]
  },
  devOptions: {
    enabled: false
  }
});
