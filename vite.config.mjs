import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  base: './',
  root: 'src/ui',
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: path.resolve(import.meta.dirname, 'src/frontend'),
    emptyOutDir: false,
  },
});
