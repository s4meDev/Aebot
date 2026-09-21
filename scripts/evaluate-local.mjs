import { build } from 'vite';
import { spawn } from 'node:child_process';
await build({ configFile: false, build: { ssr: 'desktop/evaluate.ts', outDir: 'desktop-dist',
  emptyOutDir: false, target: 'node22', rollupOptions: { output: { format: 'es', entryFileNames: 'evaluate.mjs' } } } });
const child = spawn(process.execPath, ['desktop-dist/evaluate.mjs', ...process.argv.slice(2)], { stdio: 'inherit' });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
