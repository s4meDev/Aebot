import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      // Copia apenas arquivos que não passam pelo pipeline de bundle do Rollup
      // (o manifest é um arquivo estático de configuração da extensão).
      // O background service worker agora é compilado a partir de
      // `src/background.ts` via rollupOptions.input abaixo — não é mais
      // copiado manualmente, eliminando o risco de arquivos divergentes.
      name: 'copy-extension-files',
      closeBundle() {
        const distDir = path.resolve(__dirname, 'dist');
        if (!fs.existsSync(distDir)) {
          fs.mkdirSync(distDir, { recursive: true });
        }
        if (fs.existsSync('manifest.json')) {
          fs.copyFileSync('manifest.json', path.join(distDir, 'manifest.json'));
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
        background: path.resolve(__dirname, 'src/background.ts'),
      },
      output: {
        // O manifest.json espera "background.js" na raiz do dist (side_panel/MV3
        // exigem o service worker fora de /assets). Os demais entries seguem
        // para /assets normalmente.
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
