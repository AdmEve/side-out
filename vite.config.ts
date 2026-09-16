import { defineConfig } from 'vite';

// Phaser is loaded from a CDN <script> tag (see index.html) and used as the global
// `Phaser`, so it is never bundled. That keeps our bundle small and lets the built
// page run inside a strict-CSP host that only allows scripts from cdnjs.
export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  build: {
    target: 'es2020',
    assetsDir: '.',
    rollupOptions: {
      output: {
        format: 'iife',
        entryFileNames: 'game.js',
        assetFileNames: '[name][extname]',
      },
    },
  },
});
