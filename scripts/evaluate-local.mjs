import { build } from 'vite';
import { spawn } from 'node:child_process';
import { publicCatalogDefinition } from './public-catalog-definition.mjs';
await build({ configFile: false, define: await publicCatalogDefinition(process.cwd()), build: { ssr: 'desktop/evaluate.ts', outDir: 'desktop-dist',
  emptyOutDir: false, target: 'node22', rollupOptions: { output: { format: 'es', entryFileNames: 'evaluate.mjs' } } } });
const child = spawn(process.execPath, ['desktop-dist/evaluate.mjs', ...process.argv.slice(2)], { stdio: 'inherit' });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
