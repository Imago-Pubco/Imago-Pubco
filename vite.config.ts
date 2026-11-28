import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    // Only used with VITE_BACKEND=api, against a locally running `npm start`.
    proxy: {
      '/api': 'http://localhost:8080',
      // Punch card server (npm run pointage): self-signed HTTPS, local only.
      '/punch-api': { target: 'https://localhost:8443', secure: false },
    },
  },
});
