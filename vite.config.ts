import { defineConfig } from 'vite';

export default defineConfig({
  root: 'frontend',
  base: './',
  build: {
    outDir: '../frontend/dist',
    emptyOutDir: true,
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
