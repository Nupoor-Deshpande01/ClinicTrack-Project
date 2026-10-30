import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite config.
 * - fs.allow: the design tokens live in ../public-site/css/theme.css and are
 *   imported directly, so the dev server must be able to read one level up.
 * - proxy: during development /api and the Socket.IO /socket.io endpoint are
 *   forwarded to the Express server, so the client never needs CORS tweaks locally.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    fs: { allow: ['..'] },
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
      // The Bootstrap marketing site is served by Express under /site.
      '/site': { target: 'http://localhost:5000', changeOrigin: true },
      // ws: true lets the live queue work through the dev proxy.
      '/socket.io': { target: 'http://localhost:5000', changeOrigin: true, ws: true },
    },
  },
  build: {
    // Split the heavy, rarely-changing libraries so the app shell caches well
    // and no single chunk trips the 500 kB warning.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          forms: ['react-hook-form', '@hookform/resolvers', 'yup'],
          realtime: ['socket.io-client'],
        },
      },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
      '/site': { target: 'http://localhost:5000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:5000', changeOrigin: true, ws: true },
    },
  },
});
