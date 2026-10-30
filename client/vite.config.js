import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite config.
 * - fs.allow: the design tokens live in ../public-site/css/theme.css and are
 *   imported directly, so the dev server must be able to read one level up.
 * - proxy: during development /api is forwarded to the Express server, so the
 *   client never needs CORS tweaks locally.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    fs: { allow: ['..'] },
    proxy: { '/api': { target: 'http://localhost:5000', changeOrigin: true } },
  },
  preview: {
    port: 4173,
    proxy: { '/api': { target: 'http://localhost:5000', changeOrigin: true } },
  },
});
