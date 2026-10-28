import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// SNES ROMs are small (256 KB - 8 MB), so there is no streaming layer here.
// If a future core needs SharedArrayBuffer, add COOP/COEP headers in dev and
// in the PocketBase hook; the default Nostalgist build does not require them.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
