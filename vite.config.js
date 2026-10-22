import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'img/logo-admpb-fire.png',
        'icons/apple-touch-icon.png',
        'manifest-catalogo.webmanifest',
      ],
      manifest: {
        name: 'Biblioteca ADMP Brasil',
        short_name: 'Biblioteca ADMPB',
        description: 'Administração da biblioteca da ADMP Brasil.',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#fbf7ee',
        theme_color: '#fbf7ee',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        navigateFallbackDenylist: [/^\/api\//],
        // Notificacoes do "Avise-me quando voltar" do acervo publico: o
        // service worker gerado carrega este arquivo de public/.
        importScripts: ['/push-sw.js'],
      },
    }),
  ],
  server: { port: 5173 },
});
