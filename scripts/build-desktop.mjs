import { build } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { publicCatalogDefinition } from './public-catalog-definition.mjs';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, 'desktop-dist');
const publicCatalog = await publicCatalogDefinition(root);
// O renderer desktop não leva o service worker nem o manifest da extensão.
await build({ configFile: false, root, base: './', plugins: [react(), {
  name: 'desktop-csp', transformIndexHtml(html) {
    return html.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'none'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'">`);
  },
}], build: { outDir: path.join(output, 'ui'), emptyOutDir: true, modulePreload: false } });
for (const entry of ['main', 'preload']) {
  await build({ configFile: false, root, define: publicCatalog, build: {
    ssr: path.join(root, 'desktop', `${entry}.ts`), outDir: output, emptyOutDir: false,
    target: 'node22', rollupOptions: { external: ['electron'],
      output: { format: 'cjs', entryFileNames: `${entry}.cjs`, codeSplitting: false } },
  } });
}
await mkdir(output, { recursive: true });
const assets = JSON.parse(await readFile(path.join(root, 'desktop-resources/assets-lock.json'), 'utf8'));
if (!/^[\w.-]+\.gguf$/.test(assets.model.name)) throw new Error('Nome do modelo inválido para o instalador.');
// O NSIS usa o mesmo nome do lock; trocar o modelo não pode deixar o Setup procurando o antigo.
await writeFile(path.join(output, 'model-install.nsh'), `!define AEBOT_MODEL_FILE "${assets.model.name}"\n`);
await writeFile(path.join(output, 'build-info.json'), JSON.stringify({ target: 'desktop-offline', builtAt: new Date().toISOString(),
  publicCatalogIndexSha256: JSON.parse(publicCatalog.__AEBOT_PUBLIC_CATALOG_INDEX_SHA256__) }));
