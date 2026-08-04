import { defineConfig } from 'vite';
import path from 'node:path';

const projectRoot = import.meta.dirname;

export default defineConfig({
  build: {
    ssr: path.resolve(projectRoot, 'server/index.ts'),
    outDir: 'server-dist',
    emptyOutDir: true,
    target: 'node22',
    rollupOptions: {
      output: {
        entryFileNames: 'index.js',
        format: 'es',
      },
    },
  },
});
