import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

const projectRoot = import.meta.dirname;

export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      // O manifest é estático e precisa ser copiado para a pasta final.
      name: 'copy-extension-files',
      closeBundle() {
        const distDir = path.resolve(projectRoot, 'dist');
        const manifestSource = path.resolve(projectRoot, 'manifest.json');
        if (!fs.existsSync(distDir)) {
          fs.mkdirSync(distDir, { recursive: true });
        }
        if (fs.existsSync(manifestSource)) {
          fs.copyFileSync(manifestSource, path.join(distDir, 'manifest.json'));
        }
      },
    },
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    modulePreload: false,
    rollupOptions: {
      input: {
        main: 'index.html',
        background: path.resolve(projectRoot, 'src/background.ts'),
      },
      output: {
        // O Manifest V3 procura background.js na raiz da extensão.
        entryFileNames: (chunkInfo) =>
          chunkInfo.name === 'background' ? 'background.js' : 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
  server: {
    port: 5173,
  },
});
