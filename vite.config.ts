import { defineConfig } from 'vite';

export default defineConfig({
  base: '/dps-maximizer/',
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    reportCompressedSize: true
  }
});
