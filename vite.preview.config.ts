import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('./preview', import.meta.url)),
  plugins: [react(), tailwindcss()],
  resolve: { tsconfigPaths: true },
  server: { fs: { allow: [fileURLToPath(new URL('.', import.meta.url))] } },
  build: { outDir: '../.preview', emptyOutDir: true }
});
