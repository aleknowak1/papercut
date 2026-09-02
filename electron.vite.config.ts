import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';

export default defineConfig({
  main: {
    build: {
      lib: { entry: resolve(__dirname, 'app/main/index.ts') }
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
