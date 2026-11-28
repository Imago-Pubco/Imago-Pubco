/** Build of the standalone tablet kiosk only (served by server/punch on https://…:8443/). */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // public/ (face models, icon, manifest) is served by the punch server itself.
  publicDir: false,
  build: {
    outDir: 'dist-pointage',
    emptyOutDir: true,
    rollupOptions: { input: fileURLToPath(new URL('./pointage.html', import.meta.url)) },
  },
});
