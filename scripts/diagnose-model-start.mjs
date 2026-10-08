import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import path from 'node:path';

// Somente inicialização de candidato, sem perguntas ou conversas. Não é telemetria do aplicativo.
const root = path.resolve(import.meta.dirname, '..', 'desktop-resources');
const lock = JSON.parse(await readFile(path.join(root, 'assets-lock.json'), 'utf8'));
const candidates = JSON.parse(await readFile(path.join(root, 'model-candidates.json'), 'utf8'));
const model = candidates[process.argv[2]];
if (!model) throw new Error('Candidato não cadastrado.');
const port = await new Promise((resolve, reject) => {
  const probe = createServer(); probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => { const address = probe.address(); probe.close(() => resolve(address.port)); });
});
const token = randomBytes(32).toString('hex');
const child = spawn(path.join(root, lock.runtime.directory, 'llama-server.exe'), [
  '--model', path.join(root, 'models', model.name), '--host', '127.0.0.1', '--port', String(port),
  '--ctx-size', '8192', '--parallel', '1', '--threads', '6', '--flash-attn', 'on',
  '--cache-type-k', 'q8_0', '--cache-type-v', 'q8_0', '--cache-ram', '0', '--n-gpu-layers', '0',
  '--no-webui', '--jinja', '--no-warmup',
], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, LLAMA_API_KEY: token } });
child.stderr.on('data', (chunk) => {
  const text = chunk.toString();
  // Só linhas de diagnóstico técnico; nunca escreve credencial ou caminho pessoal.
  for (const line of text.split('\n')) if (/error|failed|unsupported|not supported|model loaded|listening|warmup|architecture/i.test(line)) {
    console.log(line.replaceAll(token, '[credencial omitida]').replaceAll(root, '[recursos locais]').slice(0, 400));
  }
});
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => { child.kill(); }, 90_000);
  child.once('error', (error) => { clearTimeout(timer); reject(error); });
  child.once('exit', (code) => { clearTimeout(timer); console.log('Diagnóstico encerrado. Código:', code); resolve(); });
});
