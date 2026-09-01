import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

const projectRoot = import.meta.dirname;

export default defineConfig(({ mode }) => {
  const developmentExtension = mode === 'development-extension';
  return {
    base: './',
    plugins: [
      react(),
      {
        // O build comum já é o pacote empresarial. O perfil local precisa ser
        // pedido explicitamente para não voltar ao localhost por acidente.
        name: 'copy-extension-files',
        closeBundle() {
          const distDir = path.resolve(projectRoot, 'dist');
          const manifestSource = path.resolve(projectRoot, 'manifest.json');
          if (!fs.existsSync(distDir)) {
            fs.mkdirSync(distDir, { recursive: true });
          }
          if (fs.existsSync(manifestSource)) {
            const manifest = JSON.parse(fs.readFileSync(manifestSource, 'utf8'));
            if (developmentExtension) {
              delete manifest.key;
              manifest.host_permissions = [
                'https://generativelanguage.googleapis.com/*',
                'http://127.0.0.1/*',
                'http://localhost/*',
              ];
              manifest.content_security_policy = {
                extension_pages: "script-src 'self'; object-src 'self'; connect-src https://generativelanguage.googleapis.com http://127.0.0.1:* http://localhost:*",
              };
            }
            fs.writeFileSync(
              path.join(distDir, 'manifest.json'),
              `${JSON.stringify(manifest, null, 2)}\n`,
              'utf8'
            );
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
  };
});
