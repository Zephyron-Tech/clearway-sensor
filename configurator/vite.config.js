import { defineConfig } from 'vite';

export default defineConfig({
  worker: { format: 'es' },
  // OpenCascade WASM načítáme sami přes ?url, předbalování by rozbilo cestu k .wasm
  optimizeDeps: { exclude: ['replicad-opencascadejs'] },
  build: { target: 'es2022', chunkSizeWarningLimit: 4000 },
});
