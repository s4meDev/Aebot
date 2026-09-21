import { build } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, 'desktop-dist');
// O renderer desktop não leva o service worker nem o manifest da extensão.
await build({ configFile: false, root, base: './', plugins: [react(), {
  name: 'desktop-csp', transformIndexHtml(html) {
    return html.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'none'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'">`);
  },
}], build: { outDir: path.join(output, 'ui'), emptyOutDir: true, modulePreload: false } });
for (const entry of ['main', 'preload']) {
  await build({ configFile: false, root, build: {
    ssr: path.join(root, 'desktop', `${entry}.ts`), outDir: output, emptyOutDir: false,
    target: 'node22', rollupOptions: { external: ['electron'],
      output: { format: 'cjs', entryFileNames: `${entry}.cjs`, inlineDynamicImports: true } },
  } });
}
await mkdir(output, { recursive: true });
await writeFile(path.join(output, 'build-info.json'), JSON.stringify({ target: 'desktop-offline', builtAt: new Date().toISOString() }));
