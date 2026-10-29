import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  root: 'frontend',
  base: './',
  plugins: [solidPlugin()],
  build: {
    outDir: '../frontend/dist',
    emptyOutDir: true,
    target: 'esnext',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8080',
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
      },
    },
  },
});
