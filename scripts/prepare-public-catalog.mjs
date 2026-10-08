import { build } from 'vite';
import { spawn } from 'node:child_process';
import { publicCatalogDefinition } from './public-catalog-definition.mjs';
await build({ configFile: false, define: await publicCatalogDefinition(process.cwd()), build: { ssr: 'desktop/prepareCatalog.ts', outDir: 'desktop-dist',
  emptyOutDir: false, target: 'node22', rollupOptions: { output: { format: 'es', entryFileNames: 'prepare-catalog.mjs' } } } });
const child = spawn(process.execPath, ['desktop-dist/prepare-catalog.mjs', ...process.argv.slice(2)],
  { stdio: 'inherit', windowsHide: true });
child.once('error', () => { process.exitCode = 1; });
child.once('exit', code => { process.exitCode = code ?? 1; });
