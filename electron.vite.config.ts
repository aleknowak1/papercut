import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';

export default defineConfig({
  main: {
    build: {
      lib: {
        entry: {
          index: resolve(__dirname, 'app/main/index.ts'),
          // The segmentation worker runs in its own utility process and needs
          // its own entry file (forked by app/main/segmentation/service.ts).
          'segmentation-worker': resolve(__dirname, 'app/main/segmentation/worker.ts')
        }
      },
      rollupOptions: {
        // Native module: must be resolved from node_modules at runtime,
        // never bundled (ADR-017; packaged builds ship it unpacked).
        external: ['onnxruntime-node']
      }
    }
  },
  preload: {
    build: {
      lib: { entry: resolve(__dirname, 'app/preload/index.ts') }
    }
  },
  renderer: {
    root: resolve(__dirname, 'app/renderer'),
    server: {
      // Bind to a concrete address (CL-0022). Left as "localhost", Node may
      // listen only on IPv6 ::1 while Chromium sometimes dials IPv4
      // 127.0.0.1 — a refused connection and a blank window, at random.
      // A numeric address leaves nothing to resolve, on either side.
      host: '127.0.0.1'
    },
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'app/renderer/index.html')
      }
    },
    plugins: [react()]
  }
});
